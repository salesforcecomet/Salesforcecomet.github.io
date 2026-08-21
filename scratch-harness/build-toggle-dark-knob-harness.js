// Builds toggle-dark-knob-preview.html — reproduces every pill toggle in the
// extension (header apple switch, inspector slider, sfir header toggle,
// settings mac toggle, quick-settings slider) with the REAL production CSS
// rules extracted from the source files, then measures the knob colors.
const fs = require('fs');

function extract(selector, file) {
  const css = fs.readFileSync(file, 'utf8');
  // find the selector (possibly in a comma group)
  const re = new RegExp('(^|\\n)([^\\n]*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\{[\\s\\S]*?\\n\\})', 'm');
  const m = css.match(re);
  return m ? m[2].trim() : null;
}

const rules = [];
function add(label, selector, file) {
  const r = extract(selector, file);
  rules.push(`/* ${label} */\n${r || '/* NOT FOUND: ' + selector + ' */'}`);
}

// Header apple switch (inspector.css + main.js inline styles)
add('apple switch track', '.sfarc-apple-switch', 'src/inspector.css');
add('apple switch active track', '.sfarc-apple-switch', 'src/inspector.css');
add('apple handle dark', '#sfarc-panel.sfarc-dark-theme #sfarc-header-icons-toggle .sfarc-apple-switch-handle', 'src/inspector.css');
add('slider base', '.sfarc-slider:before', 'src/inspector.css');
add('slider dark knob', '.sfarc-dark-theme .sfarc-slider:before', 'src/inspector.css');
add('sfir toggle track', '.sfir-header-toggle-switch', 'src/styles/sfir.css');
add('sfir toggle knob', '.sfir-header-toggle-switch::after', 'src/styles/sfir.css');
add('sfir dark knob', 'body.sfarc-dark-theme .sfir-header-toggle-switch::after', 'src/styles/sfir.css');
add('mac label', '.mac-toggle-switch label:before', 'src/settings.css');
// These two live mid comma-group so the single-selector extractor can't grab them:
rules.push(`/* controls dark knob (group) */
body.sfarc-dark-theme .sfarc-switch .sfarc-slider:before,
body.sfarc-dark-theme .sfarc-toggle-switch .sfarc-slider:before,
body.sfarc-dark-theme .sfarc-slider:before,
#sfarc-panel.sfarc-dark-theme .sfarc-slider:before {
    background-color: #000 !important;
}`);
rules.push(`/* mac dark knob (group) */
body.sfarc-dark-theme .mac-toggle-switch label:before,
[data-theme="dark"] .mac-toggle-switch label:before {
  background-color: #000;
}`);
add('qs slider knob', '.slider:before', 'src/quick-settings.css');
add('qs dark knob', 'body.sfarc-dark-theme .slider:before', 'src/quick-settings.css');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { background: #1e1e1e; color: #fff; font-family: sans-serif; padding: 24px; }
.row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; font-size: 13px; }
.row .label { width: 220px; color: #bbb; }
${rules.join('\n')}
/* geometry for inspector slider + quick settings slider */
.sfarc-switch, .sfarc-toggle-switch { width: 36px; height: 20px; position: relative; display: inline-block; }
.sfarc-switch .sfarc-slider, .sfarc-toggle-switch .sfarc-slider { position: absolute; inset: 0; border-radius: 9999px; }
.sfarc-toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.sfarc-slider { position: absolute; inset: 0; background-color: #555; border-radius: 24px; }
.slider { position: relative; display: inline-block; width: 40px; height: 20px; }
.slider input { opacity: 0; width: 0; height: 0; position: absolute; }
.sfir-toggle { position: relative; display: inline-block; }
.sfir-header-toggle-switch { position: relative; display: inline-block; width: 36px; height: 20px; background-color: #475569; border-radius: 9999px; vertical-align: middle; }
.sfir-header-toggle-switch::after { content: ""; position: absolute; width: 16px; height: 16px; border-radius: 50%; background-color: #ffffff; top: 2px; left: 2px; }
.mac-toggle-switch { position: relative; width: 42px; height: 24px; }
.mac-toggle-switch input { opacity: 0; width: 0; height: 0; }
.mac-toggle-switch label { position: absolute; inset: 0; background-color: #39393d; border-radius: 24px; }
.mac-toggle-switch label:before { position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px; background-color: #ffffff; border-radius: 50%; }
</style>
</head>
<body class="sfarc-dark-theme" data-theme="dark">
  <div id="sfarc-panel" class="sfarc-dark-theme" style="background:#2b2b2b; padding:16px; border-radius:10px;">
    <div class="row"><span class="label">1. Header Hide Icons (apple switch)</span>
      <div id="sfarc-header-icons-toggle" style="display:flex; align-items:center; gap:8px;">
        <div id="appleswitch" class="sfarc-apple-switch" style="position:relative; width:36px; height:20px; background-color:#e9e9ea; border-radius:10px;">
          <div id="applehandle" class="sfarc-apple-switch-handle" style="position:absolute; top:2px; left:2px; width:16px; height:16px; background-color:#ffffff; border-radius:50%;"></div>
        </div>
      </div>
    </div>
    <div class="row"><span class="label">2. Inspector .sfarc-slider (on)</span>
      <label class="sfarc-toggle-switch"><input type="checkbox" checked><span class="sfarc-slider"></span></label>
    </div>
    <div class="row"><span class="label">3. Data Export header toggle (sfir)</span>
      <span id="sfirtoggle" class="sfir-header-toggle-switch"></span>
    </div>
    <div class="row"><span class="label">4. Settings mac toggle (on)</span>
      <div class="mac-toggle-switch"><input type="checkbox" checked><label></label></div>
    </div>
    <div class="row"><span class="label">5. Quick settings slider (on)</span>
      <label class="slider"><input type="checkbox" checked><span class="slider round"></span></label>
    </div>
  </div>
  <script>
    window.__measure = () => {
      const g = (id) => getComputedStyle(document.getElementById(id)).backgroundColor;
      const q = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el, '::before').backgroundColor : getComputedStyle(el, '::after').backgroundColor;
      };
      const panel = document.getElementById('sfarc-panel');
      return {
        panelClass: panel.className,
        bodyClass: document.body.className,
        appleHandle: g('applehandle'),
        appleTrack: g('appleswitch'),
        sliderKnob: getComputedStyle(document.querySelector('.sfarc-toggle-switch .sfarc-slider'), '::before').backgroundColor,
        sfirKnob: getComputedStyle(document.getElementById('sfirtoggle'), '::after').backgroundColor,
        macKnob: getComputedStyle(document.querySelector('.mac-toggle-switch label'), '::before').backgroundColor,
        qsKnob: getComputedStyle(document.querySelector('.slider .round'), '::before').backgroundColor,
      };
    };
  </script>
</body>
</html>`;

fs.writeFileSync('scratch-harness/toggle-dark-knob-preview.html', html);
console.log('written scratch-harness/toggle-dark-knob-preview.html');
