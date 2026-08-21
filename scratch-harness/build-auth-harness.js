const fs = require('fs');
let css = fs.readFileSync('src/styles/record-clone.css', 'utf8');
// Extract CSS blocks: modal overlay/card/header + auth tiles + form
const grab = (a, b) => {
  const i = css.indexOf(a); if (i === -1) return '';
  const j = css.indexOf(b, i); return css.slice(i, j === -1 ? i + 3000 : j);
};
let rules = '';
rules += grab('.sfarc-modal-overlay', '.sfarc-modal-card');
rules += grab('.sfarc-modal-card', '.sfarc-modal-header');
rules += grab('.sfarc-auth-tiles-grid', '/* Input with icon */');
rules += grab('.sfarc-input-with-icon', '/*');
rules += grab('.sfarc-modal-close-btn', '.sfarc-modal-title');
rules += grab('.sfarc-form-group', '.sfarc-input');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, Segoe UI, sans-serif; background: #eef1f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
${rules}
.sfarc-modal-overlay { display: flex; position: static; padding: 30px; background: transparent; }
.sfarc-modal-card { width: 500px; box-shadow: 0 20px 60px rgba(15,23,42,.25); }
.sfarc-auth-tiles-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
.sfarc-auth-tile { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #dbe1e8; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all .16s ease; }
.sfarc-auth-tile:hover { border-color: #0176d3; background: #fff; box-shadow: 0 4px 14px rgba(1,118,211,.12); transform: translateY(-1px); }
.sfarc-auth-tile-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.sfarc-auth-tile-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sfarc-auth-tile-icon.prod { background: rgba(22,163,74,.14); color: #16a34a; }
.sfarc-auth-tile-icon.sandbox { background: rgba(180,83,9,.14); color: #d97706; }
.sfarc-auth-tile-title { font-size: 12.5px; font-weight: 700; color: #0f172a; }
.sfarc-auth-tile-sub { font-size: 11px; color: #64748b; margin-top: 1px; }
.sfarc-auth-tile-arrow { color: #94a3b8; display: flex; transition: transform .16s ease; }
.sfarc-auth-tile:hover .sfarc-auth-tile-arrow { color: #0176d3; transform: translateX(3px); }
.sfarc-divider-badge { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: #64748b; }
.sfarc-divider-badge::before, .sfarc-divider-badge::after { content: ''; flex: 1; height: 1px; background: #dbe1e8; }
.sfarc-divider-text { font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; white-space: nowrap; }
.sfarc-form-group { display: flex; flex-direction: column; gap: 5px; }
.sfarc-form-label { font-size: 10.5px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: #64748b; }
.sfarc-input-with-icon { position: relative; display: flex; align-items: center; }
.sfarc-input-with-icon .sfarc-input { padding-left: 34px !important; }
.sfarc-input { width: 100%; border: 1px solid #dbe1e8; border-radius: 10px; padding: 8px 12px; font-size: 12.5px; background: #f8fafc; color: #0f172a; outline: none; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; }
.sfarc-input:focus { border-color: #0176d3; box-shadow: 0 0 0 3px rgba(1,118,211,.14); background: #fff; }
.sfarc-input-icon { position: absolute; left: 11px; display: flex; pointer-events: none; color: #64748b; z-index: 1; }
.sfarc-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
.sfarc-modal-title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
.sfarc-modal-close-btn { background: transparent; border: none; cursor: pointer; color: #64748b; padding: 6px; border-radius: 8px; display: flex; transition: background .15s, color .15s; }
.sfarc-modal-close-btn:hover { background: #eef1f5; color: #0f172a; }
.sfarc-modal-body { padding: 20px 24px; }
.sfarc-modal-footer { padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px; }
</style></head><body>
<div class="sfarc-modal-overlay"><div class="sfarc-modal-card">
  <div class="sfarc-modal-header">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:10px;background:rgba(1,118,211,.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5"/><circle cx="7.5" cy="16.5" r="1.5"/></svg>
      </div>
      <h3 class="sfarc-modal-title">Authorize Destination Org</h3>
    </div>
    <button class="sfarc-modal-close-btn" title="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
  <div class="sfarc-modal-body">
    <div style="font-size:12px;color:#64748b;margin-bottom:16px;line-height:1.5;">Login to open an active session in your browser, or connect an org directly using a Session ID / Access Token.</div>
    <div class="sfarc-auth-tiles-grid">
      <div class="sfarc-auth-tile production">
        <div class="sfarc-auth-tile-left">
          <div class="sfarc-auth-tile-icon prod"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div><div class="sfarc-auth-tile-title">Production / Developer Org</div><div class="sfarc-auth-tile-sub">https://login.salesforce.com</div></div>
        </div>
        <div class="sfarc-auth-tile-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      </div>
      <div class="sfarc-auth-tile sandbox">
        <div class="sfarc-auth-tile-left">
          <div class="sfarc-auth-tile-icon sandbox"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg></div>
          <div><div class="sfarc-auth-tile-title">Sandbox Org</div><div class="sfarc-auth-tile-sub">https://test.salesforce.com</div></div>
        </div>
        <div class="sfarc-auth-tile-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      </div>
    </div>
    <div class="sfarc-divider-badge"><span class="sfarc-divider-text">OR CONNECT VIA ACCESS TOKEN / SESSION ID</span></div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="sfarc-form-group">
        <label class="sfarc-form-label">Org Hostname / Domain</label>
        <div class="sfarc-input-with-icon">
          <span class="sfarc-input-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
          <input type="text" class="sfarc-input" placeholder="e.g. my-company.my.salesforce.com">
        </div>
      </div>
      <div class="sfarc-form-group">
        <label class="sfarc-form-label">Session ID / Access Token (sid)</label>
        <div class="sfarc-input-with-icon">
          <span class="sfarc-input-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5"/><circle cx="7.5" cy="16.5" r="1.5"/></svg></span>
          <input type="password" class="sfarc-input" placeholder="e.g. 00D50000000...">
        </div>
      </div>
    </div>
  </div>
  <div class="sfarc-modal-footer">
    <button style="background:#fff;border:1px solid #dbe1e8;color:#334155;border-radius:8px;padding:8px 16px;font-size:12.5px;font-weight:600;cursor:pointer;">Close</button>
    <button style="background:#0176d3;border:none;color:#fff;border-radius:8px;padding:8px 16px;font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>Connect Org Session</button>
  </div>
</div></div>
</body></html>`;
fs.writeFileSync('scratch-harness/preview-auth.html', html);
console.log('auth harness written');
