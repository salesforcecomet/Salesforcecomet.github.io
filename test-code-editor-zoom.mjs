import fs from 'node:fs';

const js = fs.readFileSync('src/code-editor.js', 'utf8');
const html = fs.readFileSync('src/code-editor.html', 'utf8');
let failed = 0;

function check(label, condition) {
    console.log(`  ${condition ? 'PASS' : 'FAIL'} ${label}`);
    if (!condition) failed++;
}

console.log('== Code editor zoom regression checks ==');
check('visible zoom-out control', html.includes('id="btn-font-minus"'));
check('visible zoom-in control', html.includes('id="btn-font-plus"'));
check('visible/resettable font-size display', html.includes('id="font-size-display"'));
check('font size is clamped to 8–40px', /Math\.max\(8, Math\.min\(40,/.test(js));
check('zoom persists editor settings', /fontSizeSaveTimer = setTimeout\(saveAllEditorSettings, 220\)/.test(js));
check('trackpad pinch supports Ctrl and Cmd', /browserEvent\.ctrlKey && !browserEvent\.metaKey/.test(js));
check('pinch stream is throttled', /lastEditorZoomWheelAt < 45/.test(js));
check('keyboard zoom is editor-focus scoped', js.includes('function isEditorZoomShortcut(e)'));
check('keyboard reset is implemented', js.includes('resetEditorFontSize();'));
check('main editor uses shared wheel handler', js.includes('editorInstance.onMouseWheel(handleEditorZoomWheel)'));
check('split editor uses shared wheel handler', js.includes('rightEditorInstance.onMouseWheel(handleEditorZoomWheel)'));
check('diff editors use shared wheel handler', (js.match(/onMouseWheel\(handleEditorZoomWheel\)/g) || []).length >= 4);
check('modal zoom buttons each bind once', (js.match(/btnModalFontPlus\.addEventListener/g) || []).length === 1 && (js.match(/btnModalFontMinus\.addEventListener/g) || []).length === 1);

console.log(`\n${failed ? 'ZOOM CHECKS FAILED' : 'ALL ZOOM CHECKS PASSED'}${failed ? ` (${failed})` : ''}`);
process.exit(failed ? 1 : 0);
