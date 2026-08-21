const fs = require("fs");
// Extract the Bulk Permission Wizard CSS rules from code-editor.html at
// build time (brace-matched so multi-line rules are kept whole).
const src = fs.readFileSync("src/code-editor.html", "utf8");
const styleBlocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
const block = styleBlocks.find(b => b.includes(".bpw-tab")) || "";
const rules = [];
let i = 0;
const n = block.length;
while (i < n) {
  const j = block.indexOf("{", i);
  if (j === -1) break;
  let depth = 1;
  let k = j + 1;
  while (depth > 0 && k < n) {
    if (block[k] === "{") depth++;
    else if (block[k] === "}") depth--;
    k++;
  }
  const sel = block.slice(i, j).trim();
  const body = block.slice(j, k);
  if (sel.includes("bpw-") || sel.includes("bpw-tab") || sel.endsWith(".tool-tab") || sel.includes(".tool-tab ") || sel === ".tool-label" || sel.includes(".tool-label ") || sel.includes(".tool-btn") || sel.includes(".tool-input") || sel.includes(".tool-select")) {
    rules.push(sel + " " + body);
  }
  i = k;
}
const bpwCss = rules.join("\n");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../src/custom-dropdown.css">
<style>
body { font-family: -apple-system, sans-serif; margin: 0; background: #1e1e1e; }
.tool-tab { box-sizing: border-box; }
</style>
<style>
${bpwCss}
</style>
</head><body>
<div class="tool-tab bpw-tab" style="display:flex;flex-direction:column;height:100vh;box-sizing:border-box;padding:16px;gap:12px;overflow:auto;">
  <div class="bpw-header"><div class="bpw-header-title"><i class="fa-solid fa-layer-group"></i><div class="bpw-header-text"><h2>Bulk Permission Wizard</h2><p>Guided setup to grant bulk permissions.</p></div></div></div>
  <div class="bpw-stepper">
    <div class="bpw-step active" data-bpw-step="1"><div class="bpw-step-circle">1</div><div class="bpw-step-label">Target &amp; Objects</div></div>
    <div class="bpw-step-line"></div>
    <div class="bpw-step" data-bpw-step="2"><div class="bpw-step-circle">2</div><div class="bpw-step-label">Objects &amp; Record Types</div></div>
    <div class="bpw-step-line"></div>
    <div class="bpw-step" data-bpw-step="3"><div class="bpw-step-circle">3</div><div class="bpw-step-label">Fields &amp; Perms</div></div>
    <div class="bpw-step-line"></div>
    <div class="bpw-step" data-bpw-step="4"><div class="bpw-step-circle">4</div><div class="bpw-step-label">Verify &amp; Execute</div></div>
  </div>
  <div class="bpw-body">
    <div class="bpw-panel" data-bpw-panel="1">
      <div class="bpw-controls">
        <div class="bpw-control-group"><label class="tool-label" for="bpw-permset">Permission Set</label><select id="bpw-permset" class="tool-select bpw-permset"><option>Loading permission sets...</option></select></div>
        <div class="bpw-control-group bpw-target-search"><label class="tool-label" for="bpw-target-name">Target Name</label><div class="bpw-search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="bpw-target-name" class="tool-input" placeholder="Enter target Name (e.g. Sales_User_PS)..."></div></div>
        <div class="bpw-control-group bpw-object-search"><label class="tool-label" for="bpw-object-search">SELECT OBJECTS</label><div class="bpw-search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="bpw-object-search" class="tool-input" placeholder="Search objects..."></div></div>
      </div>
      <div class="bpw-list-box">
        <div class="bpw-list-toolbar"><label class="bpw-select-all"><input type="checkbox" id="bpw-select-all"><span>Select All</span></label><span class="bpw-count-badge" id="bpw-count-badge">950 objects</span><div class="bpw-selected-pills" id="bpw-selected-pills"><span class="bpw-pill"><i class="fa-solid fa-xmark"></i> Account</span><span class="bpw-pill"><i class="fa-solid fa-xmark"></i> Opportunity</span></div></div>
        <div class="bpw-list-head"><span class="bpw-list-check"></span><span class="bpw-list-name">Object API Name</span><span class="bpw-list-desc">Description</span></div>
        <div class="bpw-list-scroll" id="bpw-object-list" style="max-height:260px;overflow-y:auto;">
          <div class="bpw-object-row"><span class="bpw-object-check"><input type="checkbox" checked></span><span class="bpw-object-name">AcceptedEventRelation</span><span class="bpw-object-desc">Accepted Event Relation</span></div>
          <div class="bpw-object-row"><span class="bpw-object-check"><input type="checkbox"></span><span class="bpw-object-name">Account</span><span class="bpw-object-desc"></span></div>
          <div class="bpw-object-row"><span class="bpw-object-check"><input type="checkbox"></span><span class="bpw-object-name">AccountChangeEvent</span><span class="bpw-object-desc">Account Change Event</span></div>
          <div class="bpw-object-row"><span class="bpw-object-check"><input type="checkbox"></span><span class="bpw-object-name">AccountCleanInfo</span><span class="bpw-object-desc">Account Clean Info</span></div>
          <div class="bpw-object-row"><span class="bpw-object-check"><input type="checkbox"></span><span class="bpw-object-name">AccountContactRole</span><span class="bpw-object-desc">Account Contact Role</span></div>
        </div>
      </div>
      <div class="bpw-footer"><button class="tool-btn primary bpw-next" id="bpw-next-1"><i class="fa-solid fa-arrow-right"></i> Next</button></div>
    </div>
  </div>
</div>
<script src="../lib/font-awesome.min.js"></script>
<script>
// Theme switcher for verification
document.body.setAttribute('data-theme', 'sfarc-dark');
window.setTheme = function(t) { document.body.setAttribute('data-theme', t); };
</script>
</body></html>`;
fs.writeFileSync("scratch-harness/bpw-preview.html", html);
console.log("written scratch-harness/bpw-preview.html, bpw css bytes:", bpwCss.length);
