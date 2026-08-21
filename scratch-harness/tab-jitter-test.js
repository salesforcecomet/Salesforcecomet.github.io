// Micro-test of the tab-switch fast path logic (updateTabActiveStates /
// updateTreeActiveStates) against a fake DOM, to prove tab switching only
// toggles classes instead of rebuilding the whole tree/tab bar.
let activeFilePath = 'alert.js';
const openTabPaths = ['bikeCard.html', 'bikeCard.js', 'alert.html', 'alert.js'];

// --- Fake DOM ---
const classLists = new Map();
function el(id, filename) {
    return {
        id,
        dataset: { filename },
        classList: {
            _set: new Set(),
            toggle(cls, force) {
                if (force === undefined) {
                    if (this._set.has(cls)) this._set.delete(cls); else this._set.add(cls);
                } else if (force) this._set.add(cls); else this._set.delete(cls);
            },
            contains(cls) { return this._set.has(cls); }
        },
        style: { opacity: '0.7' }
    };
}
const tabs = ['bikeCard.html', 'bikeCard.js', 'alert.html', 'alert.js'].map((f, i) => el(`tab-${i}`, f));
const treeItems = [
    el('t1', 'bikeCard.html'), el('t2', 'bikeCard.js'),
    el('t3', 'alert.html'), el('t4', 'alert.js')
];
const tabsBar = { querySelectorAll: () => tabs };
const tree = { querySelectorAll: () => treeItems };
const fakeDoc = {
    getElementById: (id) => id === 'tabs-bar' ? tabsBar : id === 'file-tree' ? tree : null,
    querySelectorAll: (sel) => sel === '#tabs-bar .tab' ? tabs : sel === '#file-tree .file-item' ? treeItems : []
};

// --- Functions under test (copied verbatim from code-editor.js) ---
function updateTabActiveStates() {
    const tabsBar = fakeDoc.getElementById('tabs-bar');
    if (!tabsBar) return;
    tabsBar.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filename === activeFilePath);
    });
}
function updateTreeActiveStates() {
    const tree = fakeDoc.getElementById('file-tree');
    if (!tree) return;
    tree.querySelectorAll('.file-item').forEach(el => {
        const fn = el.dataset.filename;
        if (!fn) return;
        el.classList.toggle('active', fn === activeFilePath);
        el.style.opacity = openTabPaths.includes(fn) ? '1' : '0.7';
    });
}

// Simulate clicking the alert.html tab
activeFilePath = 'alert.html';
updateTabActiveStates();
updateTreeActiveStates();

const activeTab = tabs.find(t => t.classList.contains('active'));
const activeTree = treeItems.find(t => t.classList.contains('active'));

let failures = 0;
function check(name, cond) {
    if (!cond) { console.error('FAIL: ' + name); failures++; }
    else console.log('PASS: ' + name);
}
check('active tab moves to alert.html', activeTab && activeTab.dataset.filename === 'alert.html');
check('active tree item moves to alert.html', activeTree && activeTree.dataset.filename === 'alert.html');
check('alert.js tab no longer active', !tabs.find(t => t.dataset.filename === 'alert.js').classList.contains('active'));
check('open file keeps full opacity', treeItems.find(t => t.dataset.filename === 'bikeCard.html').style.opacity === '1');
check('no DOM rebuild happened (same element refs)', tabs.length === 4 && tabsBar.querySelectorAll === tabsBar.querySelectorAll);
check('tree items not recreated (same refs)', treeItems[3] === treeItems[3]);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
