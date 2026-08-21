// Regression tests: in dark mode every extension toggle knob must be black
// (the white thumbs were designed for light mode and glow against dark tracks).
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const inspector = fs.readFileSync('src/inspector.css', 'utf8');
const controls = fs.readFileSync('src/controls.css', 'utf8');
const sfir = fs.readFileSync('src/styles/sfir.css', 'utf8');
const settings = fs.readFileSync('src/settings.css', 'utf8');
const qs = fs.readFileSync('src/quick-settings.css', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');

console.log('== 1. Header Hide Icons apple switch (inspector.css + main.js) ==');
check('handle starts white inline (light mode)', /background-color: #ffffff/.test(main));
check('dark override beats inline style', /#sfarc-panel\.sfarc-dark-theme #sfarc-header-icons-toggle \.sfarc-apple-switch-handle \{[\s\S]*?background-color: #000 !important;/.test(inspector));

console.log('== 2. Inspector .sfarc-slider toggles ==');
check('inspector dark knob override', /\.sfarc-dark-theme \.sfarc-slider:before \{[\s\S]*?background-color: #000 !important;/.test(inspector));
check('controls.css unified dark knob (panel)', /#sfarc-panel\.sfarc-dark-theme \.sfarc-slider:before \{[\s\S]*?background-color: #000 !important;/.test(controls));
check('controls.css unified dark knob (body)', /body\.sfarc-dark-theme \.sfarc-slider:before,[\s\S]*?background-color: #000 !important;/.test(controls));

console.log('== 3. Data Export / Import header toggle (sfir.css) ==');
check('sfir dark knob override', /body\.sfarc-dark-theme \.sfir-header-toggle-switch::after \{[\s\S]*?background-color: #000 !important;/.test(sfir));

console.log('== 4. Settings mac toggle (settings.css) ==');
check('mac dark knob override (body class)', /body\.sfarc-dark-theme \.mac-toggle-switch label:before,[\s\S]*?background-color: #000;/.test(settings));
check('mac dark knob override (data-theme)', /\[data-theme="dark"\] \.mac-toggle-switch label:before \{[\s\S]*?background-color: #000;/.test(settings));

console.log('== 5. Quick settings slider (quick-settings.css) ==');
check('qs dark knob is black not light gray', /body\.sfarc-dark-theme \.slider:before \{[\s\S]*?background-color: #000;/.test(qs));
check('qs light-mode knob still white', /\.slider:before \{[\s\S]*?background-color: white;/.test(qs));
check('sfir light-mode knob still white', /\.sfir-header-toggle-switch::after \{[\s\S]*?background-color: #ffffff !important;/.test(sfir));
check('mac light-mode knob still white', /\.mac-toggle-switch label:before \{[\s\S]*?background-color: #ffffff;/.test(settings));

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
