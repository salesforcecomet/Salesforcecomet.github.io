// Regression tests for tooltip-side stability (src/custom-tooltip.js) and the
// shell's top-bar tooltip pinning (src/sfir-shell.js + sfir-shell.html):
//   1. The custom tooltip caches the auto-chosen side per target element
//      (sideCache), so repeated hovers never flip between above/below.
//   2. The auto-direction logic still runs when there is no cached side.
//   3. data-tooltip-side explicitly pins a side (used by the shell header).
//   4. The shell pins its top-bar utility buttons (Help, Refresh, org badge)
//      to data-tooltip-side="bottom" so their tooltips never clip out of the
//      top of the viewport or flip sides.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, p), 'utf8');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL ' + name); }
}

const tip = read('src/custom-tooltip.js');
const shell = read('src/sfir-shell.js');
const shellHtml = read('src/sfir-shell.html');

// ── 1. Side cache exists and is consulted before the auto logic ────────────
check('sideCache WeakMap exists', /const sideCache = new WeakMap\(\);/.test(tip));
check('sideCache is read before auto logic', /const cached = sideCache\.get\(target\);/.test(tip));
check('cached side only reused while it has room', /cached && sideHasRoom\(cached, rect, tipRect\)/.test(tip));
check('first hover caches the auto-chosen side', /sideCache\.set\(target, side\);/.test(tip));

// ── 2. Auto logic still runs with no cache / no room ───────────────────────
check('auto direction calculation retained', /spaceTop < tipRect\.height \+ gap/.test(tip));
check('fallback chain retained (bottom/right/left)', /spaceBottom >= tipRect\.height \+ gap \? 'bottom' : \(spaceRight >= tipRect\.width \+ gap \? 'right' : 'left'\)/.test(tip));

// ── 3. data-tooltip-side explicit pin ─────────────────────────────────────
check('data-tooltip-side read as first priority', /let side = target\.getAttribute\('data-tooltip-side'\);/.test(tip));
check('explicit side falls back gracefully when it cannot fit', /if \(!sideHasRoom\(side, rect, tipRect\)\)/.test(tip));

// ── 4. Shell top-bar buttons pinned to bottom ─────────────────────────────
check('shell Help button pinned to bottom', /setAttribute\("data-tooltip-side", "bottom"\);[\s\S]{0,200}btn\.title = tabKey === "export" \? "Export Help" : "Data Import Help";/.test(shell));
check('shell Refresh button pinned to bottom', /const btn = el\("button", "sfir-shell-refresh-btn"\);[\s\S]{0,120}setAttribute\("data-tooltip-side", "bottom"\);[\s\S]{0,80}btn\.title = "Refresh";/.test(shell));
check('shell org badge pinned to bottom', /<a id="sfarc-home-link"[^>]*data-tooltip-side="bottom"[^>]*>/.test(shellHtml));

console.log(`\n${passed}/${passed + failed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
