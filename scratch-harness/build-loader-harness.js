// Builds loader-preview.html — shows the new .comet-loader / .comet-loader-inline
// on light and dark backgrounds, using the exact CSS appended to controls.css.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const controls = fs.readFileSync(path.join(ROOT, 'src', 'controls.css'), 'utf8');
// Grab just the comet-loader block for the harness
const start = controls.indexOf('/* ── Unified Comet Loader');
const loaderCss = start >= 0 ? controls.slice(start) : controls;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Unified Comet Loader</title>
<style>
${loaderCss}
body { margin: 0; font-family: Inter, sans-serif; }
.grid { display: flex; gap: 40px; padding: 40px; flex-wrap: wrap; }
.cell { width: 200px; height: 200px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; border: 1px solid rgba(0,0,0,0.12); }
.light { background: #ffffff; }
.dark { background: #17181c; }
.label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.dark .label { color: #6b7686; }
.row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; }
.dark .row { color: #e6e9ef; }
</style>
</head>
<body>
<div class="grid">
  <div class="cell light">
    <div class="label">Light · standalone</div>
    <div class="comet-loader"></div>
  </div>
  <div class="cell dark">
    <div class="label">Dark · standalone</div>
    <div class="comet-loader" style="--sfarc-loader-ring: var(--sfarc-accent-light, #5eb4ff);"></div>
  </div>
  <div class="cell light">
    <div class="label">Light · inline</div>
    <div class="row"><span class="comet-loader-inline"></span>Loading Permission Sets...</div>
  </div>
  <div class="cell dark">
    <div class="label">Dark · inline</div>
    <div class="row"><span class="comet-loader-inline" style="--sfarc-loader-ring: var(--sfarc-accent-light, #5eb4ff);"></span>Loading objects...</div>
  </div>
</div>
<script>
  // Report computed styles to verify the loader is animating
  const el = document.querySelector('.comet-loader');
  const cs = getComputedStyle(el);
  window.__loader = {
    display: cs.display,
    width: cs.width,
    aspectRatio: cs.aspectRatio,
    animation: cs.animationName + ' ' + cs.animationDuration + ' ' + cs.animationIterationCount + ' ' + cs.animationTimingFunction,
    bgImage: cs.backgroundImage.includes('linear-gradient') ? 'linear-gradient' : cs.backgroundImage
  };
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'loader-preview.html'), html);
console.log('Wrote scratch-harness/loader-preview.html');
