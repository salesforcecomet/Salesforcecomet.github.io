// Dev tests for src/close-on-outside.js — the universal "tap outside to
// close" handler, exercised against a fake DOM, plus wiring checks that every
// extension page + the injected panel actually load the script.
import fs from 'fs';

let passed = 0;
let failed = 0;
const failReasons = [];

function check(name, cond, extra = '') {
    if (cond) {
        passed++;
    } else {
        failed++;
        failReasons.push(`${name}${extra ? ' — ' + extra : ''}`);
        console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`);
    }
}

// ── Extract the IIFE body from close-on-outside.js ────────────────────────
const src = fs.readFileSync('src/close-on-outside.js', 'utf8');
const bodyMatch = src.match(/\(function\s*\(\)\s*\{([\s\S]*?)\}\)\(\);\s*$/);
check('extract IIFE body', !!bodyMatch, 'could not isolate the IIFE body');
const iifeBody = bodyMatch ? bodyMatch[1] : '';

// ── Fake DOM ───────────────────────────────────────────────────────────────
class FakeClassList {
    constructor(el, classes = []) { this.el = el; this.set = new Set(classes); }
    contains(c) { return this.set.has(c); }
    add(...cs) { cs.forEach(c => this.set.add(c)); }
    remove(...cs) { cs.forEach(c => this.set.delete(c)); }
}

class FakeEl {
    constructor(tag, opts = {}) {
        this.tag = tag;
        this.id = opts.id || '';
        this.isConnected = true;
        this.classList = new FakeClassList(this, opts.classes || []);
        this.style = opts.style || { display: '' };
        this.hidden = !!opts.hidden;
        this.parent = null;
        this.children = [];
        this.baseDisplay = opts.display !== undefined ? opts.display : (this.style.display || 'block');
    }
    // Computed display, recomputed on every read: inline style wins, then the
    // .hidden class, then the .open class, then the element's base display.
    get _display() {
        if (this.style && this.style.display) return this.style.display;
        if (this.classList.contains('hidden')) return 'none';
        if (this.classList.contains('open')) return 'flex';
        return this.baseDisplay;
    }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    contains(t) {
        let n = t;
        while (n) { if (n === this) return true; n = n.parent; }
        return false;
    }
    matches(sel) {
        if (!sel) return false;
        return sel.split(',').some((s) => {
            s = s.trim();
            if (s.startsWith('.')) return this.classList.contains(s.slice(1));
            if (s.startsWith('#')) return (this.id || '') === s.slice(1);
            return this.tag === s;
        });
    }
}

class FakeDocument {
    constructor(root) {
        this.root = root;
        this.listeners = {};
        this.all = [];
        const walk = (n) => { this.all.push(n); (n.children || []).forEach(walk); };
        walk(root);
    }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    querySelector(sel) { return this.all.find((n) => n.matches(sel)) || null; }
    querySelectorAll(sel) { return this.all.filter((n) => n.matches(sel)); }
    getComputedStyle(el) { return { display: el._display }; }
}

function buildDom() {
    const root = new FakeEl('root');
    // Panel: trace + level drawer modals (the screenshot's Create Log Level)
    const level = new FakeEl('div', {
        id: 'sfarc-level-modal',
        classes: ['sfarc-modal', 'sfarc-drawer-modal'],
        style: { display: 'flex' },
        display: 'flex'
    });
    const levelContent = new FakeEl('div', { classes: ['sfarc-modal-content'] });
    level.appendChild(levelContent);
    const trace = new FakeEl('div', {
        id: 'sfarc-trace-modal',
        classes: ['sfarc-modal', 'sfarc-drawer-modal'],
        style: { display: 'none' },
        display: 'none'
    });
    const traceContent = new FakeEl('div', { classes: ['sfarc-modal-content'] });
    trace.appendChild(traceContent);
    // anonymous-apex: .modal with .open class + naked history drawer
    // Real CSS: .modal { display:none } unless .modal.open { display:flex }
    const help = new FakeEl('div', { id: 'help-modal', classes: ['modal', 'open'], display: 'none' });
    help.appendChild(new FakeEl('div', { classes: ['modal-content'] }));
    const history = new FakeEl('div', { id: 'history-drawer', classes: ['drawer', 'open'], display: 'flex' });
    const historyBody = new FakeEl('div', { classes: ['drawer-body'] });
    history.appendChild(historyBody);
    // popup: .modal.visible (hidden-class mechanism)
    const popupModal = new FakeEl('div', { id: 'add-account-modal', classes: ['modal', 'visible'], display: 'flex' });
    popupModal.appendChild(new FakeEl('div', { classes: ['modal-content'] }));
    // code-editor: .modal-overlay with inline display
    const overlay = new FakeEl('div', { id: 'json-to-apex-modal', classes: ['modal-overlay'], style: { display: 'flex' }, display: 'flex' });
    overlay.appendChild(new FakeEl('div', { classes: ['modal-card'] }));
    // Mirror the real panel: trace modal comes before level modal in the DOM,
    // so level (later) paints on top and is the "topmost" when both are open.
    [trace, level, help, history, popupModal, overlay].forEach((n) => root.appendChild(n));
    return { root, level, levelContent, trace, traceContent, help, history, historyBody, popupModal, overlay };
}

// ── Run the real handler against the fake DOM ─────────────────────────────
const dom = buildDom();
const doc = new FakeDocument(dom.root);
new Function('window', 'document', 'Element', 'getComputedStyle', iifeBody)(
    {}, doc, FakeEl, (el) => doc.getComputedStyle(el)
);

const fire = (type, target, extra = {}) => {
    (doc.listeners[type] || []).forEach((fn) => fn({ target, ...extra }));
};
const visible = (el) => el._display !== 'none' && !el.classList.contains('hidden');
const dump = () => ({
    level: `${dom.level.style.display}/${dom.level._display}`,
    trace: `${dom.trace.style.display}/${dom.trace._display}`,
    help: `open=${dom.help.classList.contains('open')} disp=${dom.help._display}`,
    history: `open=${dom.history.classList.contains('open')}`,
    popup: `hidden=${dom.popupModal.classList.contains('hidden')} disp=${dom.popupModal._display}`,
    overlay: `${dom.overlay.style.display}`
});

check('wired click + keydown listeners', (doc.listeners.click || []).length === 1 && (doc.listeners.keydown || []).length === 1);

// 1) Backdrop click closes the Create Log Level drawer (the screenshot case)
fire('click', dom.level);
check('level modal closes on backdrop click', dom.level.style.display === 'none', JSON.stringify(dom.level.style));

// 2) Click inside the content card does NOT close it
dom.level.style.display = 'flex';
fire('click', dom.levelContent);
check('level modal stays open when clicking inside content', visible(dom.level));

// 3) Stacked modals: clicking the top backdrop only closes the top one
dom.trace.style.display = 'flex';
fire('click', dom.level);
check('only topmost stacked modal closes', dom.level.style.display === 'none' && dom.trace.style.display === 'flex');

// 4) Naked drawer: click outside closes it, click inside keeps it open.
//    (Earlier backdrop clicks legitimately closed it — any outside click does.)
dom.history.classList.add('open');
fire('click', dom.root);
check('history drawer closes on outside click', !dom.history.classList.contains('open'), JSON.stringify(dump()));
dom.history.classList.add('open');
fire('click', dom.historyBody);
check('history drawer stays open on inside click', dom.history.classList.contains('open'));

// 5) .open-class modal closes by removing .open (never inline display)
dom.help.classList.add('open');
fire('click', dom.help);
check('help modal closes via .open removal', !dom.help.classList.contains('open') && !dom.help.style.display);

// 6) .hidden-class modal closes by re-adding hidden
fire('click', dom.popupModal);
check('popup modal closes via .hidden re-add', dom.popupModal.classList.contains('hidden'));

// 7) .modal-overlay closes via inline display
fire('click', dom.overlay);
check('modal-overlay closes via inline display', dom.overlay.style.display === 'none');

// 8) Esc closes the topmost visible overlay
dom.level.style.display = 'flex';
fire('keydown', null, { key: 'Escape' });
check('Esc closes topmost visible modal', dom.level.style.display === 'none' && dom.trace.style.display === 'flex', JSON.stringify(dump()));

// 9) Idempotency: closing an already-closed modal never re-opens or throws
fire('click', dom.level);
fire('click', dom.level);
check('close is idempotent', dom.level.style.display === 'none');

// ── Wiring checks ──────────────────────────────────────────────────────────
const htmlPages = ['anonymous-apex', 'code-editor', 'metadata-exporter', 'popup', 'quick-settings', 'record-viewer', 'record-clone', 'data-export', 'data-import'];
htmlPages.forEach((p) => {
    const html = fs.readFileSync(`src/${p}.html`, 'utf8');
    check(`${p}.html includes close-on-outside.js`, html.includes('<script src="close-on-outside.js"></script>'));
});

const bg = fs.readFileSync('src/background.js', 'utf8');
check('background injects close-on-outside in loadMain', bg.includes("'src/close-on-outside.js',\n                        'src/smart-suggestions.js',\n                        'src/main.js'"));
check('background retry bootstraps the guarded content script instead of reinjecting main',
    bg.includes("files: ['src/content.js']") &&
    !bg.includes("files: ['src/glass-toast.js', 'src/close-on-outside.js', 'src/smart-suggestions.js', 'src/main.js']"));

check('selector covers .sfarc-drawer-modal', src.includes("'.sfarc-drawer-modal'"));
check('selector covers .modal-overlay', src.includes("'.modal-overlay'"));
check('selector covers #history-drawer naked drawer', src.includes("NAKED_DRAWER_SELECTOR = '#history-drawer'"));
check('script is guarded against double-loading', src.includes('window.__sfarcCloseOnOutside'));

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed > 0) {
    console.log('Failures:\n - ' + failReasons.join('\n - '));
    process.exit(1);
}
