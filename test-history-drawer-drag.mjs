// Regression tests for the query-history drawer (src/data-export.js + sfir.css):
//   1. The drawer launches CENTERED on screen (CSS left:50% top:50% translate(-50%,-50%)).
//   2. Dragging the header moves it with clamped coordinates, disables the
//      entrance animation, and persists the position for the next open.
//   3. The WHOLE header is a grab surface (tabs/buttons included) — but a
//      plain click still works (drag engages only after >4px movement), and
//      the search input is never a drag surface (caret/text selection).
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const src = fs.readFileSync('src/data-export.js', 'utf8');
const css = fs.readFileSync('src/styles/sfir.css', 'utf8');

// ── CSS: centered launch + drag affordances ───────────────────────────────
check('final drawer rule centers horizontally', /\.sfir-history-drawer\s*\{[^}]*left:\s*50%/.test(css));
check('final drawer rule centers vertically', /\.sfir-history-drawer\s*\{[^}]*top:\s*50%/.test(css));
check('final drawer rule translates -50%,-50%', /\.sfir-history-drawer\s*\{[^}]*transform:\s*translate\(-50%,\s*-50%\)/.test(css));
check('centered keyframes exist', /@keyframes sfirDrawerCenter\s*\{/.test(css));
// The centered rule is the one immediately preceding @keyframes sfirDrawerCenter.
const centerKey = css.indexOf('@keyframes sfirDrawerCenter');
const centerRuleStart = css.lastIndexOf('.sfir-history-drawer {', centerKey);
const centerRuleEnd = css.indexOf('}', centerKey);
const centerRule = css.slice(centerRuleStart, centerRuleEnd);

check('final animation is NOT !important (inline drag can stop it)', !/animation:\s*sfirDrawerCenter[^;]*!important/.test(centerRule));
check('final left/top/transform are NOT !important (inline drag can set them)', !/left:\s*50%!important/.test(centerRule) && !/top:\s*50%!important/.test(centerRule) && !/transform:\s*translate\(-50%,\s*-50%\)!important/.test(centerRule));
check('earlier sfirDropIn animation rules are not !important', (() => {
  const anims = [...css.matchAll(/animation:\s*sfirDropIn[^;]*;/g)].map(m => m[0]);
  return anims.length >= 3 && anims.every(a => !a.includes('!important'));
})());
check('NO sliding ::after sweep on the clear button (it covered the label on hover)', !/\.sfir-history-drawer-clear-btn::after/.test(css));
check('clear button label cannot be covered (no inset:0 positioned pseudo-element)', !/\.sfir-history-drawer-clear-btn::after\s*\{[^}]*inset:\s*0/.test(css));
check('header grab cursor', /\.sfir-history-drawer-header\s*\{\s*cursor:\s*grab/.test(css));
check('header touch-action none (touch drag)', /\.sfir-history-drawer-header\s*\{[^}]*touch-action:\s*none/.test(css));
check('drawer uses the current wide layout (850px)', /width:\s*850px\s*!important/.test(css));
check('dragging class rule', /\.sfir-history-drawer\.sfir-history-drawer-dragging\s*\{/.test(css));
check('dragging class blocks text selection', /\.sfir-history-drawer\.sfir-history-drawer-dragging\s*\{[^}]*user-select:\s*none/.test(css));

// ── JS: toggle opens centered (no button-relative position) ───────────────
check('toggleHistoryDrawer uses persisted pos, no button math', (() => {
  const m = /toggleHistoryDrawer\(\)\s*\{[\s\S]*?\n  \}/.exec(src);
  return m && m[0].includes('historyDrawerLastPos') && !m[0].includes('getBoundingClientRect');
})());
check('module-level dragged-pos variable declared', /\nlet historyDrawerLastPos = null;/.test(src));
check('NO React pointer props on the header (React 15 ignores them)', !/onPointerDown:|onPointerMove:|onPointerUp:|onPointerCancel:/.test(src));
check('header binds drag via native ref listener', /className: "sfir-history-drawer-header",\s*ref: \(el\) => this\._bindHistoryDrawerDrag\(el\)/.test(src));
check('_bindHistoryDrawerDrag wires native pointer listeners', /_bindHistoryDrawerDrag\(el\) \{[\s\S]*?addEventListener\("pointerdown"[\s\S]*?addEventListener\("pointermove"[\s\S]*?addEventListener\("pointerup"[\s\S]*?addEventListener\("pointercancel"/.test(src));
check('no search-wrapper drag exclusion remains (whole header draggable)', !src.includes('closest("button, input, a, .sfir-history-drawer-search-wrapper'));
check('history item rows have NO Load button (clicking the row loads)', !src.includes('sfir-history-item-load-btn') && src.includes('onClick: () => isSavedTab ? this.onSelectSavedItem(item) : this.onSelectHistoryItem(item)'));
check('pointer capture is wrapped in try/catch', src.includes('if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);') && src.includes('} catch (_) {'));
check('pointerdown does NOT setPointerCapture (Chrome redirects click to the capture target, killing the History/Saved toggle)', (() => { const m = /onHistoryDrawerPointerDown\(e\) \{([\s\S]*?)\n  \}/.exec(src); return m && !m[1].includes('currentTarget.setPointerCapture('); })());
check('setPointerCapture only fires after the drag engages (>4px) in pointermove', /if \(!d\.dragging && Math\.abs\(dx\) < 4[\s\S]*?d\.dragging = true;[\s\S]*?setPointerCapture/.test(src));

// ── JS behavior: extract the three drag methods and exercise them ─────────
function extractDragMethods() {
  const start = src.indexOf('onHistoryDrawerPointerDown(e) {');
  const end = src.indexOf('onSelectHistoryItem(entry)', start);
  const methods = src.slice(start, end);
  const fn = new Function('stateBox', 'window', `
    let historyDrawerLastPos = stateBox.lastPos;
    return class DragHarness {
      static get lastPos() { return historyDrawerLastPos; }
      constructor() {
        this._historyDrag = null;
        this.setState = (patch) => stateBox.patches.push(patch);
      }
      ${methods}
    };
  `);
  return fn;
}

function makeDragEnv() {
  const style = {};
  const cls = new Set();
  const drawer = {
    style,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), has: (c) => cls.has(c) },
    getBoundingClientRect: () => ({ left: 400, top: 300, width: 600, height: 500 }),
    get offsetWidth() { return 600; }
  };
  const header = {
    closest: () => drawer,
    setPointerCapture: () => { header.captured = true; },
    releasePointerCapture: () => { header.captured = false; }
  };
  return { drawer, header, cls };
}

function pev(header, { x, y, button = 0, target = null }) {
  return {
    button,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: header,
    target: target || { closest: () => null },
    preventDefault() { this._prevented = true; }
  };
}

const stateBox = { lastPos: null, patches: [] };
const fakeWindow = { innerWidth: 1200, innerHeight: 900 };
const Harness = extractDragMethods()(stateBox, fakeWindow);
const self = new Harness();
const getLastPos = () => Harness.lastPos;
const env = makeDragEnv();

// 1. Drag start on header background
const down = pev(env.header, { x: 400, y: 300 });
self.onHistoryDrawerPointerDown(down);
check('pointerdown initializes drag state', self._historyDrag && self._historyDrag.origLeft === 400 && self._historyDrag.origTop === 300);
check('pointerdown does NOT capture pointer (click must survive to reach the tabs)', env.header.captured === undefined);

// 2. Micro-move (<4px) is ignored — click intent preserved
const tiny = pev(env.header, { x: 401, y: 301 });
self.onHistoryDrawerPointerMove(tiny);
check('micro-move under 4px does not move drawer', env.drawer.style.left === undefined && self._historyDrag.dragging === false);
check('micro-move does not capture pointer either', env.header.captured === undefined);
self.onHistoryDrawerPointerUp(tiny);
check('micro-move does not persist a position', stateBox.patches.length === 0);

// 3. Real move +100/+60 → drag engages, clamped on screen (viewport 1200x900)
self.onHistoryDrawerPointerDown(down);
const move = pev(env.header, { x: 500, y: 360 });
self.onHistoryDrawerPointerMove(move);
check('real move adds dragging class', env.cls.has('sfir-history-drawer-dragging'));
check('drag engage captures pointer (keeps move/up flowing outside the header)', env.header.captured === true);
check('drag moves drawer to orig + delta', env.drawer.style.left === '500px' && env.drawer.style.top === '360px');
check('drag disables transform', env.drawer.style.transform === 'none');
check('drag disables entrance animation', env.drawer.style.animation === 'none');

// 4. Clamp to viewport edges (1200x900 viewport, 600x500 drawer → max 592x392)
const far = pev(env.header, { x: 5000, y: 5000 });
self.onHistoryDrawerPointerMove(far);
check('drag clamps to viewport right edge', env.drawer.style.left === '592px');
check('drag clamps to viewport bottom edge', env.drawer.style.top === '392px');

// 5. Drop → persist position + release
const up = pev(env.header, { x: 5000, y: 5000 });
self.onHistoryDrawerPointerUp(up);
check('pointerup releases capture', env.header.captured === false);
check('pointerup removes dragging class', !env.cls.has('sfir-history-drawer-dragging'));
check('dragged position persisted', getLastPos() && typeof getLastPos().left === 'number' && getLastPos().transform === 'none' && getLastPos().animation === 'none');
check('setState receives persisted pos', stateBox.patches.length === 1 && stateBox.patches[0].historyDropdownPos === getLastPos());

// 6. Plain click (down+up, no move) on a button is NOT a drag — buttons keep working
const env2 = makeDragEnv();
const self2 = new (extractDragMethods()(stateBox, fakeWindow))();
const onBtn = pev(env2.header, { x: 400, y: 300, target: { closest: (sel) => sel === 'button' ? {} : null } });
self2.onHistoryDrawerPointerDown(onBtn);
self2.onHistoryDrawerPointerUp(onBtn);
check('click on a button does not drag or persist', !env2.cls.has('sfir-history-drawer-dragging') && stateBox.patches.length === 1);
check('plain click never captured the pointer (tab onClick still fires)', env2.header.captured !== true);

// 7. Drag works even when starting ON a button (whole header is a grab surface)
const env4 = makeDragEnv();
const self4 = new (extractDragMethods()(stateBox, fakeWindow))();
const onBtn2 = pev(env4.header, { x: 400, y: 300, target: { closest: (sel) => sel === 'button' ? {} : null } });
self4.onHistoryDrawerPointerDown(onBtn2);
self4.onHistoryDrawerPointerMove(pev(env4.header, { x: 440, y: 330 }));
check('drag starts from a button after real movement', env4.drawer.style.left === '440px' && env4.cls.has('sfir-history-drawer-dragging'));

// 8. Search input is never a drag surface (caret/text-selection protected)
const env5 = makeDragEnv();
const self5 = new (extractDragMethods()(stateBox, fakeWindow))();
const onInput = pev(env5.header, { x: 400, y: 300, target: { closest: (sel) => sel === 'input' ? {} : null } });
self5.onHistoryDrawerPointerDown(onInput);
self5.onHistoryDrawerPointerMove(pev(env5.header, { x: 500, y: 360 }));
check('drag never starts from the search input', env5.drawer.style.left === undefined && !env5.cls.has('sfir-history-drawer-dragging'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
