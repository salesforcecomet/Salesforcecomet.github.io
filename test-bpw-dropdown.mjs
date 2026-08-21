// Regression tests for the Bulk Permission Wizard's Permission Set dropdown
// becoming a custom searchable dropdown:
//   1. bulk-permission-wizard.html loads custom-dropdown.css + custom-dropdown.js.
//   2. The wizard's Permission Set select opts into searchability
//      (500 options -> the custom dropdown shows a search input automatically).
//   3. The native chevron is hidden once the select is enhanced (no double
//      arrow next to the custom trigger's own chevron).
//   4. The wizard's change listener still fires when a menu option is picked
//      (custom-dropdown dispatches a bubbling change event on the select).
//   5. Restoring a saved value re-renders the trigger label (the menu rebuild
//      triggered by the options MutationObserver reads the restored .value).
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const html = fs.readFileSync('src/bulk-permission-wizard.html', 'utf8');
const css = fs.readFileSync('src/bulk-permission-wizard.css', 'utf8');
const js = fs.readFileSync('src/bulk-permission-wizard.js', 'utf8');
const cdJs = fs.readFileSync('src/custom-dropdown.js', 'utf8');
const cdCss = fs.readFileSync('src/custom-dropdown.css', 'utf8');

// ── Page wiring ────────────────────────────────────────────────────────────
check('page loads custom-dropdown.css', html.includes('custom-dropdown.css'));
check('page loads custom-dropdown.js', html.includes('custom-dropdown.js'));

// ── Native chevron hidden when enhanced ────────────────────────────────────
check('chevron hidden when select enhanced (:has)', /\.bpw-select-wrap:has\(\.sfarc-custom-processed\) > \.bpw-select-chevron\s*\{\s*display:\s*none/.test(css));

// ── Select is searchable by construction ───────────────────────────────────
// The wizard renders the select inside its template; the custom dropdown adds
// a search input when options.length > 8 — the wizard loads up to 500.
check('custom dropdown auto-adds search when >8 options', /selectEl\.options\.length > 8/.test(cdJs));
check('wizard loads up to 500 permission sets', /LIMIT 500/.test(js));
check('select has a search placeholder', /data-search-placeholder="Search permission sets\.\.\."/.test(js));

// ── Custom dropdown dispatches change that the wizard listens for ─────────
check('custom dropdown dispatches bubbling change on pick', /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)/ .test(cdJs));
check('wizard listens for change on the permission set select', /permSetSelect\.addEventListener\('change'/.test(js));
check('wizard stores picked id from the select value', /permSetSelect\.addEventListener\('change', \(\) => \{ st\.permissionSetId = permSetSelect\.value; \}\)/.test(js));

// ── Dynamic option repopulation triggers a menu rebuild ───────────────────
check('custom dropdown observes select childList (options injected later)', /observer\.observe\(selectEl, \{ childList: true, attributes: true, subtree: true \}\)/.test(cdJs));
check('custom dropdown rebuilds menu on select change', /selectEl\.addEventListener\('change', \(\) => \{[\s\S]*?rebuildMenu\(\);\s*\}\)/.test(cdJs));
check('wizard replaces options after the async fetch', /permSetSelect\.innerHTML = permissionSets\.map/.test(js));
check('wizard restores saved value after populating', /if \(st\.permissionSetId\) permSetSelect\.value = st\.permissionSetId;/.test(js));

// ── Menu mount: teleported to body when opened ────────────────────────────
check('menu teleported to body on open (escapes overflow clipping)', /document\.body\.appendChild\(menu\)/.test(cdJs));
check('menu is positioned fixed with top z-index', /menu\.style\.zIndex = '2147483647'/.test(cdJs));

// ── Dark theme reachable for the BPW page ─────────────────────────────────
check('custom dropdown dark rules target the themed scope', /\.sfarc-dark-theme \.sfarc-custom-dropdown-menu/.test(cdCss));
check('menu carries its own dark class when teleported', /syncMenuTheme\(menu, selectEl\)/.test(cdJs));

// ── dist ships the wiring ──────────────────────────────────────────────────
const distHtml = fs.readFileSync('dist/src/bulk-permission-wizard.html', 'utf8');
check('dist page loads custom-dropdown.css', distHtml.includes('custom-dropdown.css'));
check('dist page loads custom-dropdown.js', distHtml.includes('custom-dropdown.js'));
check('dist css hides chevron when enhanced', fs.readFileSync('dist/src/bulk-permission-wizard.css', 'utf8').includes('sfarc-custom-processed'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
