// Regression tests: every surface filled with the org accent color must use
// var(--sfarc-accent-contrast) for its text, so light org accents get dark
// readable text (white-on-lime is unreadable) while dark accents keep white.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const sfir = fs.readFileSync('src/styles/sfir.css', 'utf8');
const de = fs.readFileSync('src/data-export.css', 'utf8');
const ce = fs.readFileSync('src/code-editor.html', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');
const tm = fs.readFileSync('src/theme-manager.js', 'utf8');

console.log('== 1. Contrast var is defined ==');
check('theme-manager sets --sfarc-accent-contrast', /setProperty\('--sfarc-accent-contrast', accentContrastColor\(color\)\)/.test(tm));
check('uses gamma-corrected luminance', /v <= 0\.04045 \? v \/ 12\.92/.test(tm));

console.log('== 2. Accent-filled surfaces use the contrast var ==');
check('nav active pill', /sfir-nav-active[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('query tab active', /\.query-tab\.active[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('header btn (gradient)', /\.sfir-header-btn[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('save-query is-saved', /\.sfir-save-query-btn\.is-saved[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('history item load btn', /\.sfir-history-item-load-btn[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('history drawer btn hover/active', /\.sfir-history-drawer-btn:hover[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('funnel btn active', /\.sfir-funnel-btn\.active[\s\S]*?color: var\(--sfarc-accent-contrast/.test(sfir));
check('status bar', /\.status-bar \{[\s\S]*?color: var\(--sfarc-accent-contrast/.test(ce));
check('btn-blue', /\.btn-blue \{[\s\S]*?color: var\(--sfarc-accent-contrast/.test(ce));
check('editor context menu hover', /\.tab-context-menu-item:hover[\s\S]*?color: var\(--sfarc-accent-contrast/.test(ce));
check('find toggle active', /\.find-toggle-btn\.active[\s\S]*?color: var\(--sfarc-accent-contrast/.test(ce));
check('run-export hover switches to contrast', /\.sfir-run-export-btn:hover \{[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(sfir));
check('run-export base uses accent + contrast (both modes)', /\.sfir-run-export-btn,\s*button\.sfir-run-export-btn \{[\s\S]*?background-color: var\(--sfarc-accent, #0084ff\) !important;[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(sfir));
check('run-export has-query uses contrast', /\.sfir-run-export-btn\.has-query \{[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(de));
check('tab context menu hover uses contrast (light)', /\.sfir-tab-context-menu \.slds-dropdown__item a:hover,[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(de));
check('tab context menu hover uses contrast (dark)', /body\.sfarc-dark-theme \.sfir-tab-context-menu \.slds-dropdown__item a:hover,[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(de));
check('history shortcut badge uses contrast on accent hover', /\.sfir-history-drawer-btn:hover \.sfir-history-shortcut-badge,[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;/.test(sfir));

console.log('== 3. Icons on accent backgrounds follow the contrast color ==');
check('autocomplete-header svg rule excludes brand buttons (sfir)', /body\.sfarc-dark-theme \.autocomplete-header \.slds-button:not\(\.slds-button_brand\)[\s\S]*?svg[\s\S]*?color: #e2e8f0 !important/.test(sfir));
check('autocomplete-header svg rule excludes brand buttons (data-export)', /body\.sfarc-dark-theme \.autocomplete-header \.slds-button:not\(\.slds-button_brand\)[\s\S]*?svg[\s\S]*?color: #e2e8f0 !important/.test(de));
check('brand button svgs use contrast color (sfir)', /\.autocomplete-header \.sfir-run-export-btn svg,[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;[\s\S]*?fill: currentColor !important;/.test(sfir));
check('brand button svgs use contrast color (data-export)', /\.autocomplete-header \.sfir-run-export-btn svg,[\s\S]*?color: var\(--sfarc-accent-contrast, #ffffff\) !important;[\s\S]*?fill: currentColor !important;/.test(de));

console.log('== 4. Inline styles in main.js ==');
const inline = (main.match(/var\(--sfarc-accent-contrast, #?[a-z]+\)/g) || []).length;
check('all 5 accent-filled inline styles use contrast', inline >= 5);

console.log('== 5. No white text left on plain accent backgrounds ==');
// accent bg + white text in the SAME rule block must not exist anymore
const leftover = [];
const re = /([^{}]+)\{([^{}]*)\}/g;
for (const [file, css] of [['sfir.css', sfir], ['data-export.css', de], ['code-editor.html', ce]]) {
  let m;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1], body = m[2];
    if (/background[^;]*var\(--(?:sfarc-accent|primary)(?![-\w])/.test(body) &&
        /(^|[;{]\s*)color\s*:\s*(?:#fff\b|#ffffff\b|white\b)\s*;/.test(body)) {
      leftover.push(file + ' :: ' + sel.trim().replace(/\s+/g, ' ').slice(0, 60));
    }
  }
}
check('no white text on plain accent bg (sfir + code-editor)', leftover.length === 0);
if (leftover.length) console.log('  leftover:', leftover.slice(0, 5).join('\n  '));

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
