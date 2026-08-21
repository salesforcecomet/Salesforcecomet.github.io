const fs = require('fs');
function extract(selector, file) {
  const css = fs.readFileSync(file, 'utf8');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|\\n)([^\\n]*' + esc + '[^\\n]*\\{[\\s\\S]*?\\n\\})', 'm');
  const m = css.match(re);
  return m ? m[2].trim() : null;
}
const rules = [];
const add = (l, s, f) => rules.push(`/* ${l} */\n${extract(s, f) || '/* NOT FOUND */'}`);
add('slider pill', '.slds-builder-header__nav-list .sfir-nav-slider', 'src/styles/sfir.css');
add('item action', '.slds-builder-header__item-action,', 'src/styles/sfir.css');
add('active item', '.slds-builder-header__item-action.sfir-nav-active', 'src/styles/sfir.css');
add('active hover', '.slds-builder-header__item-action.sfir-nav-active:hover', 'src/styles/sfir.css');
add('dark active', 'body.sfarc-dark-theme .slds-builder-header__item-action.sfir-nav-active', 'src/styles/sfir.css');

// accentContrastColor ported verbatim from theme-manager.js
const lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
function hexToRgbArr(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function mixHex(hex, other, weight) {
  const a = hexToRgbArr(hex), b = hexToRgbArr(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * weight));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function accentContrastColor(color) {
  const [r, g, b] = hexToRgbArr(color).map(v => lin(v / 255));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum > 0.5) return mixHex(color, '#000000', 0.5);
  return '#ffffff';
}
const LIME = '#D2FF59';
const BLUE = '#2196f3';
const contrastLime = accentContrastColor(LIME);
const contrastBlue = accentContrastColor(BLUE);

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { background: #101113; font-family: sans-serif; padding: 24px; }
${rules.join('\n')}
.slds-builder-header__nav-list { position: relative; display: inline-flex; list-style: none; margin: 0; padding: 0; gap: 4px; }
.slds-builder-header__nav-item { position: relative; display: inline-flex; }
.slds-builder-header__nav-item a { display: inline-flex; align-items: center; height: 24px; padding: 0 14px; border-radius: 8px; text-decoration: none; }
</style>
</head>
<body class="sfarc-dark-theme">
  <div style="margin-bottom: 28px;">
    <div style="color:#94a3b8; font-size:12px; margin-bottom:6px;">Lime accent (light) — text should be a dark shade, no glow:</div>
    <ul class="slds-builder-header__nav-list" id="nav-lime" style="--sfarc-accent: ${LIME}; --sfarc-accent-contrast: ${contrastLime};">
      <li class="sfir-nav-slider" style="position:absolute; top:3px; bottom:3px; left:3px; width:80px; background-color:${LIME}; border-radius:8px; pointer-events:none;"></li>
      <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action sfir-nav-active" href="#">Export</a></li>
    </ul>
  </div>
  <div>
    <div style="color:#94a3b8; font-size:12px; margin-bottom:6px;">Blue accent (dark) — text stays white:</div>
    <ul class="slds-builder-header__nav-list" id="nav-blue" style="--sfarc-accent: ${BLUE}; --sfarc-accent-contrast: ${contrastBlue};">
      <li class="sfir-nav-slider" style="position:absolute; top:3px; bottom:3px; left:3px; width:80px; background-color:${BLUE}; border-radius:8px; pointer-events:none;"></li>
      <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action sfir-nav-active" href="#">Export</a></li>
    </ul>
  </div>
  <script>
    window.__measure = () => {
      const pill = document.getElementById('nav-lime').querySelector('.sfir-nav-slider');
      const limeText = getComputedStyle(document.querySelector('#nav-lime .sfir-nav-active'));
      const blueText = getComputedStyle(document.querySelector('#nav-blue .sfir-nav-active'));
      return {
        limeContrast: '${contrastLime}',
        blueContrast: '${contrastBlue}',
        pillShadow: getComputedStyle(pill).boxShadow,
        limeTextColor: limeText.color,
        blueTextColor: blueText.color,
      };
    };
  </script>
</body>
</html>`;
fs.writeFileSync('scratch-harness/nav-pill-preview.html', html);
console.log('written scratch-harness/nav-pill-preview.html');
