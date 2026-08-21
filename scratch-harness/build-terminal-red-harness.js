// Reproduces the code-editor terminal tab bar (Problems badge, Security badge,
// Tailer button) with the REAL code-editor.html CSS to verify the red is dark
// in light mode and unchanged in dark mode.
const fs = require('fs');
const html = fs.readFileSync('src/code-editor.html', 'utf8');
const styles = html.match(/<style>([\s\S]*?)<\/style>/g) || [];
const allCss = styles.map(s => s.replace(/^<style>/, '').replace(/<\/style>$/, '')).join('\n');

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Terminal Tab Red — Light Mode</title>
<style>
${allCss}
  /* Harness scaffolding */
  body { margin: 0; padding: 28px; font-family: 'Inter', sans-serif; background: #f3f4f6; }
  .frame { max-width: 860px; background: #ffffff; border: 1px solid #e2e4e8; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 30px rgba(15,23,42,0.08); }
  .terminal-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid rgba(15,23,42,0.08); }
  .terminal-tabs { display: flex; align-items: center; gap: 2px; overflow-x: auto; }
  .terminal-controls { display: flex; align-items: center; gap: 6px; }
  .term-control-btn { color: #6b7280; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 12px; }
  .measure {
    position: fixed; bottom: 8px; left: 8px; z-index: 999; background: rgba(0,0,0,0.82); color: #7ee787;
    font: 11px/1.6 ui-monospace, monospace; padding: 8px 10px; border-radius: 8px; white-space: pre; max-width: 92vw;
  }
  #toggle-dark { margin-bottom: 12px; cursor: pointer; }
</style>
</head>
<body data-theme="sfarc-light">
  <button id="toggle-dark">Toggle dark theme</button>
  <div class="frame">
    <div class="terminal-header">
      <div class="terminal-tabs">
        <div id="terminal-tab-problems" class="terminal-tab active">
          <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 4px;">warning</span> Problems <span
            id="problems-count" style="background: rgba(248, 113, 113, 0.2); color: #f87171; padding: 1px 6px; border-radius: 999px; font-size: 10px; display: inline-block;">3</span>
        </div>
        <div id="terminal-tab-security" class="terminal-tab">
          <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 4px;">shield</span> Security &amp; Health <span
            id="security-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 1px 6px; border-radius: 999px; font-size: 10px; display: inline-block;">0/100</span>
        </div>
        <div id="terminal-tab-coverage" class="terminal-tab">
          <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 4px;">pie_chart</span> Code Coverage <span
            id="coverage-badge" style="background: rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.2); color: var(--sfarc-accent-glow, #38bdf8); padding: 1px 6px; border-radius: 999px; font-size: 10px; display: none;">0%</span>
        </div>
        <div id="terminal-tab-revisions" class="terminal-tab">
          <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 4px;">history</span> Revisions
        </div>
      </div>
      <div class="terminal-controls">
        <div id="btn-toggle-log-tailer"
          style="font-size: 10px; padding: 2px 6px; background: rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
          title="Toggle Live Debug Log Tailer">
          <i class="fa-solid fa-power-off"></i> Tailer: OFF
        </div>
        <div id="btn-clear-terminal" class="term-control-btn" title="Clear Console">
          <i class="fa-solid fa-trash-can"></i>
        </div>
      </div>
    </div>
  </div>
  <div class="measure" id="measure"></div>
<script>
  function measure() {
    const el = document.getElementById('measure');
    const dark = document.body.getAttribute('data-theme') === 'sfarc-dark';
    const g = id => { const e = document.getElementById(id); const c = getComputedStyle(e); return c.color + '  bg: ' + c.backgroundColor; };
    el.textContent =
      'theme: ' + (dark ? 'DARK' : 'LIGHT') + '\\n' +
      'problems badge: ' + g('problems-count') + '\\n' +
      'security badge: ' + g('security-badge') + '\\n' +
      'tailer button:  ' + g('btn-toggle-log-tailer');
  }
  document.getElementById('toggle-dark').addEventListener('click', () => {
    document.body.setAttribute('data-theme', document.body.getAttribute('data-theme') === 'sfarc-dark' ? 'sfarc-light' : 'sfarc-dark');
    measure();
  });
  measure();
</script>
</body>
</html>
`;

fs.writeFileSync('scratch-harness/terminal-red-preview.html', harness);
console.log('written', harness.length, 'bytes');
