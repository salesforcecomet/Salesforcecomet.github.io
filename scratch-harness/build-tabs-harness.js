// Builds a harness that embeds the REAL log-viewer.html body + log-viewer.css
// so we can verify the consolidated 8-tab bar and sub-tab switching.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'src', 'log-viewer.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src', 'log-viewer.css'), 'utf8');

// Extract only the body inner content (skip scripts we can't run)
const body = html.split('<body>')[1].split('</body>')[0]
  .replace(/<script[\s\S]*?<\/script>/g, '');

// Minimal stub JS to exercise the tab logic
const stub = `
window.currentLogBody = '01:00:00.000 (1)|USER_DEBUG|[1]|DEBUG|hi';
window.currentLogMeta = null;
function renderOrder(t){ document.getElementById('order-container').innerHTML = '<div class="mock">Execution Order rendered</div>'; }
function renderFlowAnalysis(t){ document.getElementById('flow-container').innerHTML = '<div class="mock">Flow Analysis rendered</div>'; }
function renderRawTree(t){ document.getElementById('raw-tree-container').innerHTML = '<div class="mock">Raw Tree rendered</div>'; }
function renderQueries(t){ document.getElementById('queries-container').innerHTML = '<div class="mock">SOQL rendered</div>'; }
function renderSoqlBoard(t){ document.getElementById('soql-board-container').innerHTML = '<div class="mock">Board rendered</div>'; }
function renderDML(t){ document.getElementById('dml-container').innerHTML = '<div class="mock">DML rendered</div>'; }
function renderSecurityAnalysis(t){ document.getElementById('security-container').innerHTML = '<div class="mock">Security rendered</div>'; }
function renderGovLimits(t){ document.getElementById('gov-limits-container').innerHTML = '<div class="mock">Limits rendered</div>'; }
function renderUserDebug(t){ document.getElementById('user-debug-container').innerHTML = '<div class="mock">Debug rendered</div>'; }
function renderLogDetails(){ document.getElementById('details-container').innerHTML = '<div class="mock">Details rendered</div>'; }
function performLogViewerSearch(){}
window.ApexVariableTracker = { parseLog: function(){} };
window.FieldImpactAnalyzer = { parseLog: function(t){ document.getElementById('sfarc-fi-cards-container').innerHTML = '<div class="mock">Field Impact rendered</div>'; } };
`;

const harness = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Debug Log Viewer — Tab Harness</title>
<style>
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
/* color accent vars theme-manager would set */
:root {
  --sfarc-accent: #2196f3;
  --sfarc-accent-light: #5eb4ff;
}
</style>
<style>${css}</style>
</head>
<body>
${body}
<script>${stub}</script>
<script>
// copy of the real tab logic from log-viewer.js (setupTabs + activateSubTab)
function activateSubTab(subTab) {
    if (!subTab) return;
    const group = subTab.closest('.tab-content');
    if (!group) return;
    const subtarget = subTab.dataset.subtarget;
    group.querySelectorAll('.viewer-subtab').forEach(s => s.classList.remove('sfarc-active'));
    subTab.classList.add('sfarc-active');
    group.querySelectorAll('.sub-tab-content').forEach(c => c.style.display = 'none');
    const targetContent = document.getElementById('content-' + subtarget);
    if (targetContent) targetContent.style.display = 'flex';
    if (subtarget === 'field-impact') window.FieldImpactAnalyzer.parseLog(window.currentLogBody);
    else if (subtarget === 'order' && window.currentLogBody) renderOrder(window.currentLogBody);
    else if (subtarget === 'flow' && window.currentLogBody) renderFlowAnalysis(window.currentLogBody);
}
function setupTabs() {
    document.querySelectorAll('.viewer-subtab').forEach(subTab => {
        subTab.addEventListener('click', () => { activateSubTab(subTab); performLogViewerSearch(); });
    });
    document.querySelectorAll('.viewer-tab').forEach(tab => {
        tab.classList.remove('disabled');
        tab.addEventListener('click', () => {
            document.querySelectorAll('.viewer-tab').forEach(t => t.classList.remove('sfarc-active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            tab.classList.add('sfarc-active');
            const targetId = tab.dataset.target;
            const targetContent = document.getElementById('content-' + targetId);
            if (targetContent) {
                targetContent.style.display = 'flex';
                if (targetId === 'details') targetContent.style.display = 'block';
            }
            if (targetId === 'var-tracker') { targetContent.style.display = 'flex'; window.ApexVariableTracker.parseLog(window.currentLogBody); }
            else if (targetId === 'details' && window.currentLogMeta) renderLogDetails();
            if (targetContent && targetContent.querySelector('.viewer-subtab')) activateSubTab(targetContent.querySelector('.viewer-subtab'));
            const legend = document.getElementById('legend-container');
            legend.style.display = (targetId === 'log') ? 'flex' : 'none';
            performLogViewerSearch();
        });
    });
}
setupTabs();
// render a fake log so containers have content
renderOrder(window.currentLogBody); renderFlowAnalysis(window.currentLogBody); renderRawTree(window.currentLogBody);
renderQueries(window.currentLogBody); renderSoqlBoard(window.currentLogBody); renderDML(window.currentLogBody);
renderSecurityAnalysis(window.currentLogBody); renderGovLimits(window.currentLogBody); renderUserDebug(window.currentLogBody);
renderLogDetails();
document.querySelector('.viewer-tab[data-target="log"]').classList.add('sfarc-active');
</script>
</body>
</html>`;

const out = path.join(__dirname, 'log-viewer-tabs-preview.html');
fs.writeFileSync(out, harness);
console.log('Wrote', out, (harness.length / 1024).toFixed(1) + 'KB');
