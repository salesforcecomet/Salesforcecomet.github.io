// Dev test: Flow Scanner canvas focus must be a single active session.
// Clicking a new element cancels the previous element's overlay interval /
// listeners, so the highlighter can't jitter between the last and new element.
import { readFileSync } from "fs";

const src = readFileSync("src/flow-scanner-content/content-script.js", "utf8");
const dist = readFileSync("dist/src/flow-scanner-content/content-script.js", "utf8");

let checks = 0;
let failed = 0;
function check(name, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log("  FAIL:", name);
  }
}

// 1. A module-level session holder exists and a new focus clears it first.
check("activeFocusCleanup declared", /\bactiveFocusCleanup\s*=\s*null/.test(src));
check(
  "new focus cancels previous session first",
  /typeof activeFocusCleanup === 'function'[\s\S]{0,120}activeFocusCleanup\(\)/.test(src) ||
    /"function"==typeof activeFocusCleanup\s*\{\s*try\s*\{\s*activeFocusCleanup\(\)/.test(src)
);

// 2. The auto-hide timeout must only clean up ITS OWN session (identity check),
//    so a stale timeout can never hide or re-target a newer highlight.
check(
  "cleanup identity guard in source",
  /activeFocusCleanup === cleanup/.test(src)
);
check("cleanup identity guard in dist", /activeFocusCleanup===cleanup/.test(dist));

// 3. Exactly one reposition interval per call site (old duplicate removed).
check("single overlay interval", (src.match(/setInterval\(onOverlaySignal, 250\)/g) || []).length === 1);

// 4. A stale session is torn down on a new focus: interval, RAF, listeners, overlay.
check(
  "cleanup tears down interval+RAF+listeners+overlay+class",
  /clearInterval\(posTimer\)/.test(src) &&
    /cancelAnimationFrame\(rafId\)/.test(src) &&
    /removeEventListener\('scroll', onOverlaySignal, true\)/.test(src) &&
    /removeEventListener\('resize', onOverlaySignal\)/.test(src) &&
    /overlay\.style\.display = 'none'/.test(src) &&
    /targetNode\.classList\.remove\('fs-target-node-focus'\)/.test(src)
);

// 5. The overlay is still shared (single element) — the fix cancels the stale
//    updater instead of spawning a second overlay.
check("overlay still one shared element", /getElementById\('fs-canvas-target-highlighter'\)/.test(src));
check(
  "overlay created once",
  (src.match(/id = 'fs-canvas-target-highlighter'/g) || []).length === 1
);

console.log(`\n${checks - failed}/${checks} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
