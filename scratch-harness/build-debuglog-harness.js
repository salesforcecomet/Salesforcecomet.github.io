const fs = require('fs');
const css = fs.readFileSync('src/inspector.css', 'utf8');
// Extract the relevant blocks: log-table body rows + log-actions pill + dark overrides
const extract = (start, end) => {
  const i = css.indexOf(start);
  if (i === -1) return '';
  const j = css.indexOf(end, i);
  return css.slice(i, j === -1 ? i + 2000 : j);
};
let rules = '';
rules += extract('/* \u2500\u2500 Body: neutral rows', '/* User = plain blue text');
rules += extract('.sfarc-log-actions {', '/* Selected rows must beat');
rules += extract('.sfarc-dark-theme .sfarc-log-actions,', '/* \u2500\u2500 Icon button groups');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, sans-serif; padding: 20px; background: #fff; }
h3 { margin: 0 0 12px; font-size: 14px; }
table.sfarc-table.sfarc-log-table { border-collapse: separate; border-spacing: 0; font-size: 11px; width: 100%; max-width: 760px; }
th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 16px; border-bottom: 2px solid #d6dde3; }
${rules}
</style></head><body>
<h3>Debug Log Rows — zebra contrast fix (light)</h3>
<table class="sfarc-table sfarc-log-table">
<thead><tr><th style="width:36px"></th><th style="width:115px">Action</th><th>User</th><th>Operation</th><th>Status</th></tr></thead>
<tbody>
<tr><td style="width:36px; padding:3px 4px; text-align:center"><input type="checkbox"></td><td><div class="sfarc-log-actions"><button class="sfarc-action-icon sfarc-view-log-btn" title="Open Log"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button><button class="sfarc-action-icon sfarc-download-log-btn" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button><button class="sfarc-action-icon delete sfarc-delete-log-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button></div></td><td>Salesforce Comet</td><td>executeAnonymous</td><td class="sfarc-status-success">Success</td></tr>
<tr><td style="width:36px; padding:3px 4px; text-align:center"><input type="checkbox"></td><td><div class="sfarc-log-actions"><button class="sfarc-action-icon sfarc-view-log-btn" title="Open Log"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button><button class="sfarc-action-icon sfarc-download-log-btn" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button><button class="sfarc-action-icon delete sfarc-delete-log-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button></div></td><td>Salesforce Comet</td><td>/aura</td><td class="sfarc-status-error">Error</td></tr>
<tr><td style="width:36px; padding:3px 4px; text-align:center"><input type="checkbox"></td><td><div class="sfarc-log-actions"><button class="sfarc-action-icon sfarc-view-log-btn" title="Open Log"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button><button class="sfarc-action-icon sfarc-download-log-btn" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button><button class="sfarc-action-icon delete sfarc-delete-log-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button></div></td><td>Salesforce Comet</td><td>executeAnonymous</td><td class="sfarc-status-success">Success</td></tr>
<tr><td style="width:36px; padding:3px 4px; text-align:center"><input type="checkbox"></td><td><div class="sfarc-log-actions"><button class="sfarc-action-icon sfarc-view-log-btn" title="Open Log"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button><button class="sfarc-action-icon sfarc-download-log-btn" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button><button class="sfarc-action-icon delete sfarc-delete-log-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button></div></td><td>Salesforce Comet</td><td>/aura</td><td class="sfarc-status-success">Success</td></tr>
</tbody></table>
</body></html>`;
fs.writeFileSync('scratch-harness/preview-debuglog.html', html);
console.log('harness written');
