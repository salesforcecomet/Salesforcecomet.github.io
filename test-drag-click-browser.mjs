// test-drag-click-browser.mjs
// REAL-BROWSER regression for the pointer-capture click-redirect bug.
//
// The History/Saved drawer used to call setPointerCapture on pointerdown.
// In Chrome, capturing on pointerdown redirects the subsequent click to the
// CAPTURE TARGET (the header), so the tab button's onClick never fires — the
// Saved toggle was unclickable. The fix captures only after the drag engages
// (>4px). Synthetic PointerEvents (used by test-history-drawer-drag.mjs)
// CANNOT capture, so they never reproduced the bug — only trusted browser
// input can.
//
// This test drives a real headless Chrome through the shared CDP driver
// (scratch-harness/cdp-driver.mjs):
//   1. NEGATIVE — a page with the OLD buggy pattern (capture on pointerdown):
//      a real click on a button inside the captured surface must land on the
//      header, NOT the button. Proves the browser behavior the fix relies on
//      (and would fail loudly if Chrome ever changes it).
//   2. POSITIVE — the real history-drawer preview (real code extracted from
//      src/data-export.js): a real click on ★ Saved activates the Saved tab.
//   3. POSITIVE — a real drag (press, move >4px, release) still moves the
//      drawer and persists the position.
// Skips with exit code 0 (SKIP) if no Chrome/Chromium binary is available.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, launchChrome, connect, makePage, sleep } from './scratch-harness/cdp-driver.mjs';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const chromePath = findChrome();
if (!chromePath) {
  console.log('SKIP: no Chrome/Chromium binary found — set CHROME_PATH to run the real-browser test');
  process.exit(0);
}

let launched;
try {
  // Build the REAL drawer preview fresh from src (extracts the live drag code).
  execSync('node scratch-harness/build-history-drawer-harness.js', { stdio: 'ignore' });

  launched = await launchChrome();
  const session = await connect(launched.port);
  const page = makePage(session.cdp, session.sessionId);

  // ── 1. NEGATIVE: capture-on-pointerdown redirects the click to the header ──
  // The button must be a DESCENDANT of the captured surface (like the tabs in
  // the drawer header) so its pointerdown bubbles into the capture handler.
  const buggyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">
    <div id="header" style="padding:10px 12px;background:#222;display:inline-block">
      <button id="target-btn" style="padding:8px 16px;font-size:13px;">Click me</button>
    </div>
    <script>
      const header = document.getElementById('header');
      const btn = document.getElementById('target-btn');
      window.__events = { headerClicks: 0, buttonClicks: 0, captured: false };
      // OLD buggy pattern: capture on pointerdown.
      header.addEventListener('pointerdown', (e) => {
        try { header.setPointerCapture(e.pointerId); window.__events.captured = true; } catch (err) {}
      });
      header.addEventListener('click', () => window.__events.headerClicks++);
      btn.addEventListener('click', () => window.__events.buttonClicks++);
    </script></body></html>`;
  const buggyFile = path.join(launched.profile, 'buggy.html');
  fs.writeFileSync(buggyFile, buggyHtml);

  await page.navigate(pathToFileURL(buggyFile).href);
  await sleep(150); // let listeners attach
  const btnCenter = await page.elementCenter('#target-btn');
  await page.mouseClick(btnCenter.x, btnCenter.y);
  await sleep(150);
  const buggyEvents = await page.evaluate('window.__events');
  check('NEGATIVE: click on a button inside a capture-on-pointerdown surface does NOT reach the button (captured=' + buggyEvents.captured + ')',
    buggyEvents.buttonClicks === 0);
  check('NEGATIVE: that click lands on the capture target (the header) — the exact bug that made Saved unclickable',
    buggyEvents.headerClicks >= 1 && buggyEvents.buttonClicks === 0);

  // ── 2. POSITIVE: real click on ★ Saved activates the tab ──────────────────
  const drawerUrl = pathToFileURL(path.join(process.cwd(), 'scratch-harness', 'history-drawer-preview.html')).href;
  await page.navigate(drawerUrl);
  await page.waitFor('!!window.__tabState', { label: 'drawer harness boot' });
  const before = await page.evaluate('window.__tabState()');
  check('POSITIVE: drawer starts on History (Saved inactive)', before && before.savedActive === false && before.recentActive === true);

  const savedCenter = await page.elementCenter('#sfir-tab-saved');
  await page.mouseClick(savedCenter.x, savedCenter.y);
  await sleep(150);
  const after = await page.evaluate('window.__tabState()');
  check('POSITIVE: real browser click on ★ Saved activates the Saved tab', after.savedActive === true && after.recentActive === false && after.indicatorRight === true);

  // ── 3. POSITIVE: a real drag still moves the drawer + persists the spot ───
  // Start from the History tab (the header's own center is the search input,
  // deliberately excluded from dragging). The drag is purely HORIZONTAL:
  // real pointer events hit-test, so a downward move would leave the 44px
  // header before capture engages (capture only happens after >4px) and the
  // drawer would never move — that is exactly why real input matters.
  await sleep(600); // let the entrance animation settle
  const beforeDrag = await page.evaluate('window.__drawer()');
  const historyTabCenter = await page.elementCenter('#sfir-tab-recent');
  await page.mouseDrag(historyTabCenter.x, historyTabCenter.y, 150, 0);
  await sleep(250);
  const afterDrag = await page.evaluate('window.__drawer()');
  const lastPos = await page.evaluate('window.__lastPos()');
  const moved = Math.abs(afterDrag.rect.split(' ')[0].split(',')[0] - beforeDrag.rect.split(' ')[0].split(',')[0]) >= 100;
  check('POSITIVE: real drag (press, >4px move, release) moves the drawer', moved, beforeDrag.rect + ' → ' + afterDrag.rect);
  check('POSITIVE: drag persists the position (transform none, clamped coords)', !!lastPos && lastPos.transform === 'none' && typeof lastPos.left === 'number');

  session.close();
} catch (e) {
  console.error('ERROR: ' + e.message);
  fail++;
} finally {
  if (launched && launched.chrome && !launched.chrome.killed) { try { launched.chrome.kill('SIGKILL'); } catch { /* already dead */ } }
  if (launched && launched.profile) { try { fs.rmSync(launched.profile, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
