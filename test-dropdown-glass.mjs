// Regression tests for the frosted-glass dropdown/panel restyle:
//   1. Floating menus/popovers/context menus use NEUTRAL charcoal glass in
//      dark mode — no slate/navy blue cast (old rgba(15,23,42) / rgba(30,41,59)
//      / rgba(18,22,30) backgrounds are gone from dark floating surfaces).
//   2. Heavy blur (>=24px) + low saturation (<=160%) so content shows through.
//   3. Light menus are translucent white glass with blur.
//   4. The selected option tints with the ORG accent, not a hardcoded sky blue.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const files = {
  custom: fs.readFileSync('src/custom-dropdown.css', 'utf8'),
  sfir: fs.readFileSync('src/styles/sfir.css', 'utf8'),
  inspector: fs.readFileSync('src/inspector.css', 'utf8'),
  dataExport: fs.readFileSync('src/data-export.css', 'utf8')
};

// ── Dark surfaces are neutral charcoal, not slate/navy blue ───────────────
const BLUE_DARK_BGS = [
  'rgba(15, 23, 42, 0.84)', // old custom menu (slate-900)
  'rgba(30, 41, 59, 0.85)', // old inspector menus / drawer modal / results
  'rgba(47, 63, 86, 0.85)', // old custom trigger hover
  'rgba(18, 22, 30, 0.82)', // old sfir dropdowns group
  'rgba(18, 22, 30, 0.85)', // old datatype dropdown
  'rgba(20, 24, 32, 0.82)', // old tab context menu
  'rgba(18, 22, 30, 0.78)', // old search-mode popover
  'rgba(22, 25, 32, 0.92)', // old history drawer (dark)
  'rgba(18, 22, 30, 0.82)', // old history drawer
  'rgba(22, 25, 32, 0.97)'  // old history drawer (near-opaque)
];
const allCss = Object.values(files).join('\n');
for (const old of BLUE_DARK_BGS) {
  check(`blue-ish dark bg removed: ${old}`, !allCss.includes(old));
}

check('custom menu dark = neutral charcoal glass', /\.sfarc-dark-theme \.sfarc-custom-dropdown-menu,[\s\S]*?background: rgba\(10, 13, 18, 0\.55\) !important/.test(files.custom));
check('custom menu blur >= 24px', /blur\(28px\) saturate\(150%\)/.test(files.custom));
check('custom trigger dark = neutral glass', /\.sfarc-dark-theme \.sfarc-custom-dropdown-trigger \{[\s\S]*?background: rgba\(15, 18, 24, 0\.6\) !important/.test(files.custom));
check('selected option tints with org accent (no hardcoded sky blue)', /\.sfarc-dark-theme \.sfarc-custom-dropdown-option\.sfarc-selected,[\s\S]*?rgba\(var\(--sfarc-accent-rgb, 56, 189, 248\), 0\.16\)/.test(files.custom));
check('selected option no longer hardcoded sky blue', !files.custom.includes('rgba(14, 165, 233, 0.25)'));

// ── Light menu is translucent white glass ─────────────────────────────────
check('light menu translucent white glass', /\.sfarc-custom-dropdown-menu \{[\s\S]*?background: rgba\(255, 255, 255, 0\.6\) !important/.test(files.custom));
check('light menu heavy blur', /\.sfarc-custom-dropdown-menu \{[\s\S]*?blur\(28px\) saturate\(160%\)/.test(files.custom));

// ── Other dropdown families updated ───────────────────────────────────────
check('tab context menu dark glass', /\.sfir-tab-context-menu \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\) !important/.test(files.dataExport));
check('sfir dropdowns group dark glass', /\.sfarc-context-menu \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\) !important/.test(files.sfir));
check('copy menu dark glass', /\.sfir-copy-menu \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\) !important/.test(files.sfir));
check('datatype dropdown dark glass', /\.sfir-datatype-dropdown-menu \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\) !important/.test(files.sfir));
check('history drawer dark glass (neutral, blurred)', /\.sfir-history-drawer \{[\s\S]*?background: rgba\(12, 15, 20, 0\.75\) !important[\s\S]*?blur\(28px\)/.test(files.sfir));
check('inspector dropdown-menu dark glass', /\.sfarc-dark-theme \.sfarc-dropdown-menu \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\);/.test(files.inspector));
check('search-mode popover dark glass (final rule)', /#sfarc-search-mode-popover \{[\s\S]*?background: rgba\(12, 15, 20, 0\.6\) !important/.test(files.inspector));
check('tooltips neutral dark glass', /\.sfarc-dark-theme \.sfarc-custom-tooltip \{[\s\S]*?background: rgba\(12, 15, 20, 0\.75\) !important/.test(files.inspector));

// ── No high-saturation (>=180%) boost left in dark-scoped rules ──────────
// Line-based: for every declaration line with saturate(180%+), look back to
// the nearest opening brace and require the selector NOT to be dark-scoped.
function darkHighSaturation(css) {
  const lines = css.split('\n');
  let pendingSelector = '';
  for (const line of lines) {
    if (line.includes('{')) pendingSelector = line.slice(line.lastIndexOf('{') + 1);
    if (/saturate\((18|19)\d%|saturate\(200%/.test(line)) {
      if (/sfarc-dark-theme|dark-theme|dark_mode|darkMode/.test(pendingSelector)) {
        return line.trim();
      }
    }
  }
  return null;
}
let offender = darkHighSaturation(files.custom) || darkHighSaturation(files.sfir) || darkHighSaturation(files.inspector) || darkHighSaturation(files.dataExport);
check('no saturate(180%+) left in dark-scoped rules', offender === null);
if (offender) console.log('      offender: ' + offender);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
