import fs from 'node:fs';
import vm from 'node:vm';

const js = fs.readFileSync('src/code-editor.js', 'utf8');
const toast = fs.readFileSync('src/glass-toast.js', 'utf8');
const checks = [
  ['dirty state helper checks content and isDirty', js.includes('function fileHasUnsavedChanges') && js.includes('file.content !== file.savedContent')],
  ['single tab close awaits confirmation', js.includes('if (!(await confirmCloseFiles([fileName]))) return false')],
  ['close others guards all affected files', js.includes("openTabPaths.filter(openFile => openFile !== fileName)")],
  ['close right guards affected files', js.includes('const closing = openTabPaths.slice(idx + 1)')],
  ['close all guards all files', js.includes('confirmCloseFiles([...openTabPaths])')],
  ['dialog has explicit keep and discard actions', js.includes("confirmText: 'Discard & Close'") && js.includes("cancelText: 'Keep Editing'")],
  ['saving files cannot be closed', js.includes('savingFilePaths.has(fileName)')],
  ['save starts a persistent loading toast', js.includes('window.toast?.loading(') && js.includes('{ duration: 0 }')],
  ['successful deploy replaces loading toast', js.includes("type: 'success'") && js.includes('Saved and deployed ${savingFilePath}')],
  ['failed save remains visible and states changes remain unsaved', js.includes("type: 'error', message, duration: 0") && js.includes('Your changes are still unsaved')],
  ['retry dismisses previous persistent failure', js.includes('window.toast.dismiss(previousToastId)')],
  ['toast library supports loading/update/dismiss', ['toast.loading', 'toast.update', 'toast.dismiss'].every(name => toast.includes(name))]
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? '✓' : '✗'} ${name}`); if (!pass) failed++; }
new vm.Script(js);
if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} checks passed`);
