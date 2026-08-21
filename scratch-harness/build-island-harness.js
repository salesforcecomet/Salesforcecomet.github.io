const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src", "styles", "sfir.css"), "utf8");

const start = css.indexOf("/* ── Global top progress bar");
const end = css.indexOf(".sfir-page-container");
const block = css.slice(start, end);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dynamic Island Progress — Live Preview</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: 'Inter', system-ui, sans-serif; }
  .stage { position: fixed; inset: 0; display: flex; flex-direction: column; }
  .stage.dark { background: #0b0c0f; }
  .stage.light { background: linear-gradient(160deg, #eef2f6, #dbe1e8); }
  #harness-toolbar {
    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 10px; border-radius: 999px;
    background: rgba(30, 30, 30, 0.92); border: 1px solid rgba(100,116,139,0.4);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35); font-family: 'Segoe UI', system-ui, sans-serif;
  }
  #harness-toolbar button {
    border: 1px solid rgba(100,116,139,0.4); background: rgba(255,255,255,0.08);
    color: #e2e8f0; font-size: 12px; font-weight: 600; padding: 5px 12px;
    border-radius: 999px; cursor: pointer;
  }
  #harness-toolbar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  #mock-topbar {
    position: fixed; top: 0; left: 0; right: 0; height: 48px; z-index: 2147483645;
    display: flex; align-items: center; gap: 14px; padding: 0 14px;
    background: rgba(24,26,30,0.92); border-bottom: 1px solid rgba(255,255,255,0.08);
    font-family: 'Segoe UI', system-ui, sans-serif; color: #e2e8f0;
  }
  .mtb-left { display: flex; align-items: center; gap: 8px; }
  .mtb-url {
    flex: 1; max-width: 420px; display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; padding: 5px 12px; font-size: 11px; color: #94a3b8;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtb-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .mtb-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 3px 9px; }
  .mtb-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  ${block}
</style>
</head>
<body>
<div class="stage dark" id="stage"></div>
<div id="mock-topbar">
  <div class="mtb-left">
    <img src="https://placehold.co/24x24/3b82f6/ffffff?text=C" alt="logo" style="width:20px;height:20px;border-radius:5px;object-fit:cover;">
    <span style="font-weight:600;font-size:12.5px;">Salesforce Comet</span>
  </div>
  <div class="mtb-url"><i class="fa-solid fa-lock"></i> vishupgrade-dev-ed.my.salesforce.com</div>
  <div class="mtb-right">
    <span class="mtb-chip" title="Connection: Normal"><i class="mtb-dot" style="background:#38bdf8;"></i> Normal</span>
    <span class="mtb-chip" title="Log tailer"><i class="mtb-dot" style="background:#fbbf24;"></i> &gt; 45k</span>
  </div>
</div>
<div id="harness-toolbar">
  <button data-theme="dark" class="active">Dark</button>
  <button data-theme="light">Light</button>
  <span style="color:#64748b;font-size:11px">┃</span>
  <button data-action="insert" class="active">Insert</button>
  <button data-action="update">Update</button>
  <button data-action="upsert">Upsert</button>
  <button data-action="delete">Delete</button>
  <button data-action="done">Done</button>
  <span style="color:#64748b;font-size:11px">┃</span>
  <button id="t-demo" class="active">Demo Cycle</button>
  <button id="t-expand">Force Expand</button>
  <button id="t-paused">Paused</button>
</div>

<div class="sfir-top-progress active" id="bar">
  <div class="sfir-top-progress-fill"></div>
  <div class="sfir-top-progress-ring" id="ring"></div>
  <div class="sfir-top-progress-pill show" id="pill">
    <div class="sfir-island-rest">
      <span class="sfir-top-progress-dot"></span>
      <span class="sfir-top-progress-percent">56%</span>
    </div>
    <div class="sfir-island-body">
      <div class="sfir-island-hero">
        <span class="sfir-island-thumb"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M12 12v8"/><path d="m8 16 4-4 4 4"/></svg></span>
        <span class="sfir-island-titles">
          <span class="sfir-top-progress-label">Importing Account…</span>
          <span class="sfir-island-subtitle">56% · 0 ok · 15600 failed</span>
        </span>
        <span class="sfir-island-wave"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="sfir-island-track">
        <span class="sfir-island-time-l">0 of 28000 records</span>
        <span class="sfir-island-bar"><span class="sfir-island-bar-fill" style="width:56%"></span></span>
        <span class="sfir-island-time-r">56%</span>
      </div>
      <div class="sfir-island-controls">
        <span class="sfir-top-progress-counts">
          <span class="sfir-top-progress-count queued"><i></i>11200 queued</span>
          <span class="sfir-top-progress-count processing"><i></i>1200 processing</span>
          <span class="sfir-top-progress-count ok"><i></i>0 ok</span>
          <span class="sfir-top-progress-count failed"><i></i>15600 failed</span>
        </span>
      </div>
    </div>
  </div>
</div>

<script>
  const stage = document.getElementById('stage');
  const bar = document.getElementById('bar');
  document.getElementById('harness-toolbar').addEventListener('click', (e) => {
    if (e.target.dataset.theme) {
      const dark = e.target.dataset.theme === 'dark';
      stage.className = 'stage ' + (dark ? 'dark' : 'light');
      document.body.classList.toggle('sfarc-dark-theme', dark);
      document.querySelectorAll('#harness-toolbar button[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === e.target.dataset.theme));
    } else if (e.target.dataset.action) {
      setAction(e.target.dataset.action);
      document.querySelectorAll('#harness-toolbar button[data-action]').forEach(b => b.classList.toggle('active', b === e.target));
    } else if (e.target.id === 't-expand') {
      stopIslandDemo();
      document.getElementById('pill').classList.toggle('force-expand');
    } else if (e.target.id === 't-paused') {
      stopIslandDemo();
      bar.classList.toggle('paused');
    } else if (e.target.id === 't-demo') {
      const btn = e.target;
      const on = btn.classList.toggle('active');
      if (on) { window.__islandDemo = true; startDemo(); }
      else stopIslandDemo();
    }
  });

  const pill = document.getElementById('pill');
  const ACTIONS = {
    insert: { verb: 'Inserting', accent: 'linear-gradient(135deg, #0176d3, #38bdf8)', wave: '#38bdf8', svg: '<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M12 12v8"/><path d="m8 16 4-4 4 4"/>' },
    update: { verb: 'Updating', accent: 'linear-gradient(135deg, #d97706, #f59e0b)', wave: '#fbbf24', svg: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>' },
    upsert: { verb: 'Upserting', accent: 'linear-gradient(135deg, #7c3aed, #a78bfa)', wave: '#a78bfa', svg: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>' },
    delete: { verb: 'Deleting', accent: 'linear-gradient(135deg, #dc2626, #f87171)', wave: '#f87171', svg: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>' },
    undelete: { verb: 'Undeleting', accent: 'linear-gradient(135deg, #059669, #34d399)', wave: '#34d399', svg: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>' },
    done: { verb: 'Import finished', accent: 'linear-gradient(135deg, #16a34a, #4ade80)', wave: '#4ade80', svg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>' }
  };
  function setAction(action) {
    const a = ACTIONS[action] || ACTIONS.insert;
    const thumb = document.querySelector('.sfir-island-thumb');
    if (thumb) {
      thumb.style.background = a.accent;
      thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + a.svg + '</svg>';
    }
    document.querySelectorAll('.sfir-island-wave i').forEach(el => el.style.setProperty('background', a.wave, 'important'));
    document.querySelector('.sfir-top-progress-label').textContent = action === 'done' ? a.verb : (a.verb + ' Account…');
    const ring = document.getElementById('ring');
    if (ring) ring.style.setProperty('--sfir-ring-pct', action === 'done' ? 100 : 49);
  }
  let demoOpen = false;
  function stopIslandDemo() {
    window.__islandDemo = false;
    document.getElementById('t-demo').classList.remove('active');
  }
  function startDemo() {
    if (!window.__islandDemo) return;
    demoOpen = !demoOpen;
    pill.classList.toggle('force-expand', demoOpen);
    setTimeout(startDemo, demoOpen ? 2400 : 1500);
  }
  // Auto-run the open/close cycle once on load so the animation is obvious.
  setTimeout(() => { window.__islandDemo = true; startDemo(); }, 700);
</script>
</body>
</html>
`;

// add force-expand helper for harness (tall live-activity card)
const forced = block + `
.sfir-top-progress-pill.force-expand {
    width: 300px !important;
    height: 202px !important;
    border-radius: 14px !important;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.3) !important;
}
.sfir-top-progress-pill.force-expand .sfir-island-rest {
    display: none !important;
}
.sfir-top-progress-pill.force-expand .sfir-island-body {
    display: flex !important;
    animation: sfirIslandBodyIn 0.45s cubic-bezier(0.32, 0.72, 0, 1) both !important;
}
`;

const finalHtml = html.includes(".sfir-top-progress-pill.force-expand {") ? html : html.replace(block, forced);

fs.writeFileSync(path.join(__dirname, "preview-island.html"), finalHtml);
console.log("Wrote scratch-harness/preview-island.html (" + finalHtml.length + " bytes)");
