// Extracts the EXACT #terminal-body-problems CSS from code-editor.html and
// builds a faithful harness so we can verify light-theme colors live.
const fs = require('fs');

const html = fs.readFileSync('src/code-editor.html', 'utf8');

// Grab the problems block: from "#terminal-body-problems .pi-summary {" through
// the end of the light-theme chip override (just before "/* ── Code Coverage").
const startMarker = '#terminal-body-problems .pi-summary {';
const endMarker = '/* \u2500\u2500 Code Coverage tab \u2500\u2500 */';
const s = html.indexOf(startMarker);
const e = html.indexOf(endMarker);
if (s < 0 || e < 0 || e <= s) {
  console.error('markers not found', s, e);
  process.exit(1);
}
// Trim the leading indentation of each line to keep the embedded <style> clean.
let css = html.slice(s, e)
  .split('\n')
  .map(l => l.replace(/^\s{8}/, ''))
  .join('\n')
  .trim();

// Accent family (mirrors theme-manager deriveAccentShades for a purple org to
// prove the fix follows the org hue, plus the light-theme body vars).
const accentCss = `
        :root {
            --text-main: #cccccc;
            --text-muted: #858585;
            --text-active: #ffffff;
            --sfarc-accent: #7c3aed;
            --sfarc-accent-rgb: 124, 58, 237;
            --sfarc-accent-light: #b49be8;
            --sfarc-accent-dark: #5b21b6;
            --sfarc-accent-dark-rgb: 91, 33, 182;
            --sfarc-accent-glow: #a78bfa;
            --sfarc-accent-glow-rgb: 167, 139, 250;
        }
        body[data-theme="sfarc-light"] {
            --text-main: #333333;
            --text-muted: #616161;
            --text-active: #000000;
        }
        body[data-theme="sfarc-light"] #terminal-body-problems .pi-summary {
            border-bottom-color: rgba(15, 23, 42, 0.15);
        }
        body[data-theme="sfarc-light"] #terminal-body-problems .pi-table td.pi-pos {
            color: #64748b;
        }
        body[data-theme="sfarc-light"] #terminal-body-problems .pi-table td.pi-msg {
            color: #374151;
        }
        body[data-theme="sfarc-light"] #terminal-body-problems .pi-table td.pi-file {
            color: #0f172a;
        }
`;

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Problems Panel — Light Theme Colors</title>
<style>
    body {
        margin: 0;
        padding: 28px;
        font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
        display: flex;
        justify-content: center;
    }
    .frame {
        width: 980px;
        max-width: 97vw;
        background: #17181c;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .frame.light {
        background: #ffffff;
        border-color: rgba(15,23,42,0.14);
    }
    .bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: #252526;
        border-bottom: 1px solid #333;
    }
    .frame.light .bar { background: #f3f3f3; border-bottom-color: #e5e5e5; }
    .bar button {
        padding: 6px 14px;
        font-size: 11.5px;
        font-weight: 600;
        border-radius: 6px;
        border: 1px solid rgba(128,128,128,0.35);
        background: transparent;
        color: #ccc;
        cursor: pointer;
    }
    .frame.light .bar button { color: #333; }
    .bar .spacer { flex: 1; }
    .bar .hint { font-size: 11px; color: #888; }
    .frame.light .bar .hint { color: #616161; }

    .terminal-body-problems {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 14px;
        background: #181818;
        min-height: 260px;
        font-family: 'Fira Code', 'Consolas', monospace;
    }
    .frame.light .terminal-body-problems { background: #ffffff; }

    #terminal-body-problems .pi-table-wrap { max-height: 420px; }

${accentCss}
${css}
</style>
</head>
<body>
    <div class="frame" id="frame">
        <div class="bar">
            <span class="hint">Accent: purple org (#7c3aed) — dark shade #5b21b6, glow #a78bfa</span>
            <span class="spacer"></span>
            <button id="toggle">Toggle Light</button>
        </div>
        <div id="terminal-body-problems" class="terminal-body-problems">
            <div class="pi-summary">
                <span class="pi-sum-title"><i class="fa-solid fa-list-check"></i> Problems</span>
                <span class="pi-sum-chip error"><b>0</b> errors</span>
                <span class="pi-sum-chip warning"><b>0</b> warnings</span>
                <span class="pi-sum-chip info"><b>2</b> info</span>
                <button class="pi-clear" title="Clear all problems"><i class="fa-solid fa-broom"></i> Clear</button>
            </div>
            <div class="pi-table-wrap">
                <table class="pi-table">
                    <thead>
                        <tr>
                            <th class="pi-th-sev"></th>
                            <th>File</th>
                            <th>Line</th>
                            <th>Message</th>
                            <th class="pi-th-action"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="info problem-item">
                            <td class="pi-sev"><i class="fa-solid fa-circle-info"></i></td>
                            <td class="pi-file">AnimalsCallouts.cls</td>
                            <td class="pi-pos">L2:5</td>
                            <td class="pi-msg">Missing '{' at 'public'</td>
                            <td class="pi-action"><button class="pi-jump">\u2192 Jump to Line</button></td>
                        </tr>
                        <tr class="info problem-item">
                            <td class="pi-sev"><i class="fa-solid fa-circle-info"></i></td>
                            <td class="pi-file">AnimalsCallouts.cls</td>
                            <td class="pi-pos">L1:1</td>
                            <td class="pi-msg">Line 2, Col 5: Missing '{' at 'public'</td>
                            <td class="pi-action"><button class="pi-jump">\u2192 Jump to Line</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        const frame = document.getElementById('frame');
        document.getElementById('toggle').addEventListener('click', () => {
            const light = frame.classList.toggle('light');
            document.body.setAttribute('data-theme', light ? 'sfarc-light' : 'sfarc-dark');
            document.body.style.background = light ? '#eef2f7' : '#0d0e12';
        });
    </script>
</body>
</html>
`;

fs.writeFileSync('scratch-harness/problems-light-preview.html', harness);
console.log('wrote scratch-harness/problems-light-preview.html');
