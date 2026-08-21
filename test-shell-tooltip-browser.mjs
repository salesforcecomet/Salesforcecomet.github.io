// test-shell-tooltip-browser.mjs
// REAL-BROWSER verification (shared CDP driver, trusted input) of two UI
// behaviors that synthetic tests can only approximate:
//
// A. TOOLTIP SIDE-CACHE (custom-tooltip.js): repeated hovers on the same
//    element must keep the same side (WeakMap cache), a fresh element must
//    still auto-pick the side with the most room, and an explicit
//    data-tooltip-side pin must always win.
//    Real hover = Input.dispatchMouseEvent mouseMoved → real mouseover.
//
// B. SHELL TAB SWITCHING (sfir-shell.html/js): clicking the four nav pills
//    switches the active page AND swaps that tab's controls into the ONE top
//    bar (Templates+toggles on Export, Help on Import, Refresh+host on
//    Limits/Metadata), keeps iframes mounted (no reload), and slides the
//    active pill. Real click = trusted mousePressed/mouseReleased.
//
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
  // Build BOTH harnesses fresh from src (real custom-tooltip.js + real shell).
  execSync('node scratch-harness/build-help-tooltip-harness.js', { stdio: 'ignore' });
  execSync('node scratch-harness/build-sfir-shell-harness.js', { stdio: 'ignore' });

  launched = await launchChrome();
  const session = await connect(launched.port);
  const page = makePage(session.cdp, session.sessionId);
  const tooltipUrl = pathToFileURL(path.join(process.cwd(), 'scratch-harness', 'help-tooltip-preview.html')).href;
  const shellUrl = pathToFileURL(path.join(process.cwd(), 'scratch-harness', 'sfir-shell-preview.html')).href;

  // ── A. Tooltip side-cache ─────────────────────────────────────────────────
  await page.navigate(tooltipUrl);
  await page.waitFor("typeof window.__tipSide === 'function'", { label: 'tooltip harness boot' });

  // 1. First hover on the top-bar button: space above is tiny, so auto picks
  //    'bottom' and caches it.
  let c = await page.elementCenter('#sfir-tip-top');
  await page.mouseMove(c.x, c.y);
  await sleep(60);
  check('tooltip: first hover on the top-edge button auto-picks bottom', (await page.evaluate(`window.__tipSide('#sfir-tip-top')`)) === 'bottom');

  // 2. Move away → tooltip hides.
  await page.mouseMove(10, 880);
  await sleep(150);
  check('tooltip: moving away hides the tooltip', (await page.evaluate(`window.__tipSide('#sfir-tip-top')`)) === 'hidden');

  // 3. Hover again → same element, so the cache keeps 'bottom'.
  c = await page.elementCenter('#sfir-tip-top');
  await page.mouseMove(c.x, c.y);
  await sleep(60);
  check('tooltip: repeated hover keeps the cached side (no flip)', (await page.evaluate(`window.__tipSide('#sfir-tip-top')`)) === 'bottom');

  // 4. Relocate the button mid-viewport: auto-direction would now pick 'top'
  //    (plenty of room above), but the cached 'bottom' must be kept — that is
  //    the cache working, not the space calculation.
  await page.mouseMove(10, 880);
  await sleep(150);
  await page.evaluate(`window.__placeButton(400)`);
  c = await page.elementCenter('#sfir-tip-top');
  await page.mouseMove(c.x, c.y);
  await sleep(60);
  check('tooltip: cache wins over auto-direction after the element moves (still bottom)',
    (await page.evaluate(`window.__tipSide('#sfir-tip-top')`)) === 'bottom',
    'auto would have picked top at y=400');

  // 5. A FRESH element (never hovered, no cache) with room above must still
  //    auto-pick 'top' — proves the cache, not a global preference.
  await page.mouseMove(10, 880);
  await sleep(150);
  c = await page.elementCenter('.sfir-tip-fresh');
  await page.mouseMove(c.x, c.y);
  await sleep(60);
  check('tooltip: a fresh element still auto-picks top when there is room above',
    (await page.evaluate(`window.__tipSide('.sfir-tip-fresh')`)) === 'top');

  // 6. An explicit data-tooltip-side="bottom" pin always wins, even with
  //    room above.
  await page.mouseMove(10, 880);
  await sleep(150);
  c = await page.elementCenter('.sfir-tip-pinned');
  await page.mouseMove(c.x, c.y);
  await sleep(60);
  check('tooltip: explicit data-tooltip-side="bottom" pin wins over auto',
    (await page.evaluate(`window.__tipSide('.sfir-tip-pinned')`)) === 'bottom');

  // ── B. Shell tab switching (one bar, iframes kept alive) ──────────────────
  await page.navigate(shellUrl);
  await page.waitFor("typeof window.__shellProbe === 'function'", { label: 'shell harness boot' });
  await sleep(300); // initial utils state from the export stub iframe

  let probe = JSON.parse(await page.evaluate('window.__shellProbe()'));
  check('shell: starts on Export with its controls in the one bar',
    probe.activeNav === 'export' && probe.utils.templateOptions === 2 && probe.utils.toggles === 2 && probe.utils.refresh === false);
  const pillExport = probe.pillTransform;
  const framesExport = probe.frames.slice();

  // Mark the export iframe DOM node — the shell must keep it mounted (no
  // reload/recreate) across tab switches.
  const marked = await page.evaluate(`(() => {
    const f = document.querySelector('iframe[data-tab="export"]');
    if (!f) return false;
    f.__marker = 12345;
    return true;
  })()`);
  check('shell: export iframe exists to mark', marked === true);

  async function clickTab(key) {
    const c = await page.elementCenter('a[data-page="' + key + '"]');
    await page.mouseClick(c.x, c.y);
    await page.waitFor(`JSON.parse(window.__shellProbe()).activeNav === '${key}'`, { label: 'switch to ' + key });
    await sleep(120);
    return JSON.parse(await page.evaluate('window.__shellProbe()'));
  }

  // Import → Help only in the bar.
  probe = await clickTab('import');
  check('shell: Import swaps in only the Help button',
    probe.activeNav === 'import' && probe.utils.templateOptions === 0 && probe.utils.toggles === 0 &&
    probe.utils.refresh === false && probe.utils.controls.some(cls => String(cls).includes('sfir-header-icon-btn')));
  check('shell: active pill slides to Import', probe.pillTransform !== pillExport, pillExport + ' → ' + probe.pillTransform);

  // Limits → Refresh + host pill.
  probe = await clickTab('limits');
  check('shell: Limits swaps in Refresh + host pill',
    probe.activeNav === 'limits' && probe.utils.refresh === true && probe.utils.hostPill === true && probe.utils.toggles === 0);
  check('shell: active pill slides to Limits', probe.pillTransform !== pillExport && probe.pillTransform !== 'null');

  // Metadata → Refresh too.
  probe = await clickTab('metadata');
  check('shell: Metadata swaps in Refresh', probe.activeNav === 'metadata' && probe.utils.refresh === true);

  // Back to Export → templates + toggles restored, iframe NOT recreated.
  probe = await clickTab('export');
  const marker = await page.evaluate(`document.querySelector('iframe[data-tab="export"]').__marker`);
  check('shell: returning to Export restores Templates + toggles',
    probe.activeNav === 'export' && probe.utils.templateOptions === 2 && probe.utils.toggles === 2);
  check('shell: export iframe was NOT recreated (same DOM node, no reload)', marker === 12345);
  check('shell: only the export frame is active after returning', probe.frames.filter(f => f.endsWith(':ACTIVE')).join(',') === 'export:ACTIVE');

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
