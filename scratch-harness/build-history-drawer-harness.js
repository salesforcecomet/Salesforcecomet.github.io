#!/usr/bin/env node
// Builds scratch-harness/history-drawer-preview.html — the query-history drawer
// with REAL styles/sfir.css + controls.css and the REAL drag handlers extracted
// from src/data-export.js. Verifies the drawer launches CENTERED, is WIDE, and
// that dragging the header (even from a button) actually moves it.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sfir = fs.readFileSync(path.join(root, 'src', 'styles', 'sfir.css'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'src', 'controls.css'), 'utf8');
const dataExport = fs.readFileSync(path.join(root, 'src', 'data-export.js'), 'utf8');

// Extract the real drag machinery (_bindHistoryDrawerDrag + the three pointer
// handlers) up to onSelectHistoryItem.
const mStart = dataExport.indexOf('_bindHistoryDrawerDrag(el)');
const mEnd = dataExport.indexOf('onSelectHistoryItem(entry)', mStart);
const dragMethods = dataExport.slice(mStart, mEnd);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>History drawer — centered, wide, draggable</title>
<style>
${sfir}
${controls}
body { margin: 0; background: #0b0c0e; height: 100vh; }
body.sfarc-dark-theme { background: #0b0c0e; }
#report { position: fixed; bottom: 8px; left: 8px; right: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre-wrap; background: rgba(0,0,0,0.75); padding: 8px 12px; border-radius: 8px; z-index: 9999999; }
</style>
</head>
<body class="sfarc-dark-theme">
<div class="sfir-history-drawer">
  <div class="sfir-history-drawer-header">
    <div class="sfir-history-drawer-grip" aria-hidden="true"></div>
    <div class="sfir-history-drawer-segmented-control">
      <span class="sfir-history-seg-indicator left"></span>
      <button type="button" class="sfir-segmented-tab active" id="sfir-tab-recent">History (2)</button>
      <button type="button" class="sfir-segmented-tab" id="sfir-tab-saved">★ Saved (0)</button>
    </div>
    <div class="sfir-history-drawer-search-wrapper">
      <span class="sfir-history-drawer-search-icon">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </span>
      <input type="text" class="sfir-history-drawer-search" placeholder="Search history queries..." value="">
    </div>
    <div class="sfir-history-drawer-actions">
      <button type="button" class="sfir-history-drawer-clear-btn">Clear History</button>
      <button type="button" class="sfir-history-drawer-close-btn">✕</button>
    </div>
  </div>
  <div class="sfir-history-drawer-body">
    <div class="sfir-history-item">
      <span class="sfir-history-item-badge">SOQL</span>
      <code class="sfir-history-item-code">SELECT Id, Name, CreatedDate, LastModifiedDate FROM Acco...</code>
      <div class="sfir-history-item-actions">
        <button class="sfir-history-item-delete-btn">🗑</button>
      </div>
    </div>
    <div class="sfir-history-item">
      <span class="sfir-history-item-badge">SOQL</span>
      <code class="sfir-history-item-code">SELECT DandbCompanyId, Active__c, AccountSource, Account...</code>
      <div class="sfir-history-item-actions">
        <button class="sfir-history-item-delete-btn">🗑</button>
      </div>
    </div>
  </div>
</div>
<pre id="report"></pre>
<script>
(function () {
  const d = document.querySelector('.sfir-history-drawer');
  const header = document.querySelector('.sfir-history-drawer-header');

  // Real drag handlers from src/data-export.js
  const DragHarness = new Function('stateBox', 'window', \`
    let historyDrawerLastPos = stateBox.lastPos;
    return class DragHarness {
      static get lastPos() { return historyDrawerLastPos; }
      constructor() {
        this._historyDrag = null;
        this.setState = (patch) => { stateBox.patches.push(patch); };
      }
      ${dragMethods}
    };
  \`)({ lastPos: null, patches: [] }, window);
  const h = new DragHarness();

  // Bind the REAL way the extension does it — native listeners via the ref
  // helper (React 15 can't receive onPointer* props).
  h._bindHistoryDrawerDrag(header);

  function hex(v) {
    const m = v.match(/\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(n => ('0' + (+n).toString(16)).slice(-2)).join('');
  }
  function measure() {
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return {
      viewport: vw + 'x' + vh,
      rect: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height),
      center: Math.round(cx) + ',' + Math.round(cy),
      viewportCenter: Math.round(vw / 2) + ',' + Math.round(vh / 2),
      width: Math.round(r.width),
      left: cs.left, top: cs.top, transform: cs.transform,
      bg: hex(cs.backgroundColor),
      headerCursor: getComputedStyle(header).cursor,
      headerTouchAction: getComputedStyle(header).touchAction
    };
  }
  window.__drawer = measure;
  window.__dragSim = function () {
    const start = measure();
    const hr = header.getBoundingClientRect();
    const sx = hr.left + hr.width / 2, sy = hr.top + 10;
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sx, clientY: sy, pointerId: 7, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + 40, clientY: sy + 10, pointerId: 7, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + 150, clientY: sy + 60, pointerId: 7, button: 0 }));
    const during = measure();
    header.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: sx + 150, clientY: sy + 60, pointerId: 7, button: 0 }));
    const after = measure();
    return { start, during, after, lastPos: DragHarness.lastPos };
  };
  window.__dragFromButton = function () {
    const start = measure();
    const tab = document.querySelector('.sfir-segmented-tab');
    const tr = tab.getBoundingClientRect();
    tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: tr.left + 10, clientY: tr.top + 5, pointerId: 9, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: tr.left + 60, clientY: tr.top + 30, pointerId: 9, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: tr.left + 60, clientY: tr.top + 30, pointerId: 9, button: 0 }));
    return { start, after: measure(), lastPos: DragHarness.lastPos };
  };
  window.__dragFromInput = function () {
    const start = measure();
    const input = document.querySelector('.sfir-history-drawer-search');
    const ir = input.getBoundingClientRect();
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: ir.left + 20, clientY: ir.top + 5, pointerId: 11, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: ir.left + 120, clientY: ir.top + 40, pointerId: 11, button: 0 }));
    header.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: ir.left + 120, clientY: ir.top + 40, pointerId: 11, button: 0 }));
    return { start, after: measure(), lastPos: DragHarness.lastPos };
  };
  // History/Saved tab switching. Bound at load so a REAL browser click (CDP
  // Input.dispatchMouseEvent → trusted pointer events → real click) activates
  // the Saved tab exactly like the production onClick would.
  const savedTab = document.getElementById('sfir-tab-saved');
  const recentTab = document.getElementById('sfir-tab-recent');
  const segInd = document.querySelector('.sfir-history-seg-indicator');
  function activateSaved() {
    savedTab.classList.add('active');
    recentTab.classList.remove('active');
    segInd.classList.add('right');
    segInd.classList.remove('left');
  }
  savedTab.addEventListener('click', activateSaved);
  window.__tabState = function () {
    return {
      savedActive: savedTab.classList.contains('active'),
      recentActive: recentTab.classList.contains('active'),
      indicatorRight: segInd.classList.contains('right')
    };
  };
  window.__lastPos = function () { return DragHarness.lastPos; };

  // Synthetic click-through (complements the real-browser CDP test):
  // pointerdown → pointerup (through the drag handlers) → click. The drag
  // handlers must NOT swallow this — in production, a setPointerCapture on
  // pointerdown would redirect the click to the header and the Saved tab
  // would be unclickable.
  window.__clickSavedTab = function () {
    const r = savedTab.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    savedTab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 23, button: 0 }));
    savedTab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 23, button: 0 }));
    savedTab.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return Object.assign(window.__tabState(), { dragStateCleared: h._historyDrag === null });
  };
  document.getElementById('report').textContent = JSON.stringify(measure(), null, 1);
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'history-drawer-preview.html'), html);
console.log('Wrote scratch-harness/history-drawer-preview.html (' + html.length + ' bytes)');
