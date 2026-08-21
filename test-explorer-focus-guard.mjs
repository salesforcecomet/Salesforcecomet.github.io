// Regression tests for the explorer "already-open" focus guards:
//  1. Clicking an already-open file must focus it, never re-fetch: every
//     single-file loader (apex/trigger/vfpage/vfcomponent/lms/agentforce)
//     short-circuits via focusIfAlreadyLoaded; bundle loaders (lwc/aura)
//     short-circuit via focusIfBundleLoaded.
//  2. Single-file loaders no longer rebuild the whole explorer tree after
//     load (openFileInEditor's incremental highlight move is enough) — that
//     full rebuild was the fade/bounce wave on every open.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const js = fs.readFileSync('src/code-editor.js', 'utf8');
const distJs = fs.readFileSync('dist/src/code-editor.js', 'utf8');

console.log('== 1. Already-open guards exist on every loader ==');
check('helper focusIfAlreadyLoaded defined', /function focusIfAlreadyLoaded\(fileName, openInSidePane = false\)/.test(js));
check('helper focusIfBundleLoaded defined', /function focusIfBundleLoaded\(bundleName, openInSidePane = false\)/.test(js));
check('helper findBundlePrimaryFile defined', /function findBundlePrimaryFile\(bundleName\)/.test(js));
check('loadApexAsset guarded', /async function loadApexAsset\(apexId, apexName\) \{\n\s+if \(focusIfAlreadyLoaded\(apexName \? `\$\{apexName\}\.cls` : ''\)\) return;/.test(js));
check('loadApexTrigger guarded', /async function loadApexTrigger\(triggerId, triggerName\) \{\n\s+if \(focusIfAlreadyLoaded\(triggerName \? `\$\{triggerName\}\.trigger` : ''\)\) return;/.test(js));
check('loadVfPage guarded', /async function loadVfPage\(pageId, pageName\) \{\n\s+if \(focusIfAlreadyLoaded\(pageName \? `\$\{pageName\}\.page` : ''\)\) return;/.test(js));
check('loadVfComponent guarded', /async function loadVfComponent\(compId, compName\) \{\n\s+if \(focusIfAlreadyLoaded\(compName \? `\$\{compName\}\.component` : ''\)\) return;/.test(js));
check('loadLmsChannel guarded', /async function loadLmsChannel\(channelId, channelName, openInSidePane = false\) \{\n\s+const name = channelName \|\| 'CustomChannel';\n\s+const fileName = `\$\{name\}\.messageChannel-meta\.xml`;\n\s+if \(focusIfAlreadyLoaded\(fileName, openInSidePane\)\) return;/.test(js));
check('loadAgentforceType guarded', /async function loadAgentforceType\(typeId, typeName, openInSidePane = false\) \{\n\s+const name = typeName \|\| 'CustomAiFunction';\n\s+const fileName = `\$\{name\}\.genAiFunction-meta\.xml`;\n\s+if \(focusIfAlreadyLoaded\(fileName, openInSidePane\)\) return;/.test(js));
check('loadLwcBundle guarded', /async function loadLwcBundle\(bundleId, bundleName, openInSidePane = false\) \{\n\s+if \(focusIfBundleLoaded\(bundleName, openInSidePane\)\) return;/.test(js));
check('loadAuraBundle guarded', /async function loadAuraBundle\(auraId, auraName, openInSidePane = false\) \{\n\s+if \(focusIfBundleLoaded\(auraName, openInSidePane\)\) return;/.test(js));

console.log('== 2. Single-file loaders no longer rebuild the whole tree ==');
// The four identical-pattern loaders dropped `renderOrgExplorerTree()` just
// before `openFileInEditor(fileName)`; the two side-pane ones dropped it
// before `openFileInEditor(fileName, openInSidePane)`.
check('no renderOrgExplorerTree directly before openFileInEditor(fileName)', !/renderOrgExplorerTree\(\);\n\s+openFileInEditor\(fileName\);/.test(js));
check('no renderOrgExplorerTree before side-pane openFileInEditor', !/renderOrgExplorerTree\(\);\n\s+openFileInEditor\(fileName, openInSidePane\);/.test(js));
// Bundle loaders legitimately keep their re-render (subfolder expansion).
function sliceFn(src, name) {
  const i = src.indexOf('function ' + name);
  if (i < 0) return '';
  const j = src.indexOf('\n    }', i);
  return j > i ? src.slice(i, j) : src.slice(i, i + 4000);
}
const lwcFn = sliceFn(js, 'loadLwcBundle');
const auraFn = sliceFn(js, 'loadAuraBundle');
check('loadLwcBundle still re-renders tree for bundle files', lwcFn.includes('renderOrgExplorerTree();'));
check('loadAuraBundle still re-renders tree for bundle files', auraFn.includes('renderOrgExplorerTree();'));
check('openFileInEditor still runs updateTreeActiveStates (incremental)', /updateTabActiveStates\(\);\n\s+updateTreeActiveStates\(\);/.test(js));

console.log('== 3. dist ships the guards ==');
check('dist: focusIfAlreadyLoaded helper', distJs.includes('focusIfAlreadyLoaded'));
check('dist: focusIfBundleLoaded helper', distJs.includes('focusIfBundleLoaded'));
check('dist: 6 loader guard call sites', (distJs.match(/focusIfAlreadyLoaded\(/g) || []).length === 7); // 1 def + 6 calls
check('dist: 2 bundle guard call sites', (distJs.match(/focusIfBundleLoaded\(/g) || []).length === 3); // 1 def + 2 calls

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
