const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('src/inspector.css', 'utf8') + '\n' + fs.readFileSync('src/log-viewer.css', 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trace Flag + Execution Order Preview</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; min-height: 100vh; }
${css}
body { display: flex; gap: 20px; padding: 20px; }
.preview-section { flex: 1; background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.preview-section h2 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #1f2937; }
.demo-modal { position: relative; width: 100%; height: 400px; background: #e2e8f0; border-radius: 8px; overflow: hidden; }
.demo-modal .sfarc-modal-content { transform: none; animation: none; width: 480px; height: 380px; margin: 10px auto; }
.demo-tree { max-height: 500px; overflow-y: auto; }
</style>
</head>
<body>
<div class="preview-section">
<h2>Trace Flag Drawer (5px padding, smooth animation)</h2>
<div class="demo-modal">
<div class="sfarc-modal sfarc-drawer-modal" style="display: flex;">
<div class="sfarc-modal-content sfarc-modal-large">
<div class="sfarc-modal-header">
<h3>New Trace Flag</h3>
<div class="sfarc-modal-header-actions">
<button class="sfarc-btn-primary">Save Trace</button>
<button class="sfarc-modal-close">&times;</button>
</div>
</div>
<div class="sfarc-modal-body">
<div class="sfarc-form-group">
<label>Select User</label>
<input type="text" value="Vishu Grade" readonly>
</div>
<div class="sfarc-form-row">
<div class="sfarc-form-group">
<label>Start Date</label>
<input type="text" value="18/08/2026, 02:40 PM">
</div>
<div class="sfarc-form-group">
<label>Expiration Hours</label>
<select><option selected>1 hour</option></select>
</div>
</div>
<div class="sfarc-form-group">
<label>Select Debug Level</label>
<select><option>-- Select Debug Level --</option></select>
</div>
</div>
</div>
</div>
</div>
</div>

<div class="preview-section">
<h2>Execution Order (lighter, easier to scan)</h2>
<div class="demo-tree" id="order-container">
<div class="exec-tree-diagram">
<div class="tree-node-wrapper">
<div class="tree-node node-soql">
<div class="node-icon"><i class="fa-solid fa-database"></i></div>
<div class="node-label">SELECT Id, Name FROM Account</div>
<div class="node-timestamp">07:15:18.0</div>
</div>
</div>
<div class="tree-node-wrapper">
<div class="tree-node node-dml">
<div class="node-icon"><i class="fa-solid fa-pen"></i></div>
<div class="node-label">Insert: Account</div>
<div class="node-timestamp">07:15:18.123</div>
</div>
<div class="tree-children">
<div class="tree-node-wrapper">
<div class="tree-node node-trigger">
<div class="node-icon"><i class="fa-solid fa-bolt"></i></div>
<div class="node-label">AccountTrigger</div>
<div class="node-timestamp">07:15:18.456</div>
</div>
</div>
<div class="tree-node-wrapper">
<div class="tree-node node-method">
<div class="node-icon"><i class="fa-solid fa-code"></i></div>
<div class="node-label">AccountService.processAccount()</div>
<div class="node-timestamp">07:15:18.789</div>
</div>
</div>
</div>
</div>
<div class="tree-node-wrapper">
<div class="tree-node node-flow">
<div class="node-icon"><i class="fa-solid fa-diagram-project"></i></div>
<div class="node-label">AccountFlow</div>
<div class="node-timestamp">07:15:19.012</div>
</div>
</div>
</div>
</div>
</div>
</body>
</html>`;

fs.mkdirSync('scratch-harness', { recursive: true });
fs.writeFileSync('scratch-harness/trace-order-preview.html', html);
console.log('Built: scratch-harness/trace-order-preview.html');
