// Dev-only test — NOT part of the extension build.
//
// Verifies the tab-switch popup fixes in src/main.js + src/content.js:
//   1. Expanding via sfarcExpandPopupContainer (DevTools/Debug Logs/Org) then
//      restoring must clear min-width too — the old restore only cleared
//      width/max-width, so visiting DevTools once left the popup stuck at its
//      780px minimum on every other tab ("sometimes it does not shift").
//   2. The restore must be surgical: it must not nuke the inline transition.
//   3. The three expansion branches must all route through the shared helper
//      (single state machine — no desync after rapid tab switching).
//   4. content.js watchdog: when mainLoaded but #sfarc-panel is missing, the
//      panel must be re-injected instead of the launcher silently dying.
//
// Run:  node test-popup-restore.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");
const CONTENT = fs.readFileSync(path.join(__dirname, "src", "content.js"), "utf8");

let failures = 0;
let checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) {
    console.log(`  PASS  ${label}${extra ? `  (${extra})` : ""}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${extra ? `  (${extra})` : ""}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Extract the real functions/blocks verbatim.
// ────────────────────────────────────────────────────────────────────────────
function extractFunction(src, name) {
  const m = new RegExp("function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) throw new Error(`function ${name} not found in source`);
  let i = m.index;
  let depth = 0;
  let inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(m.index, i + 1);
}

// The restore block inside loadTabContent's hideAllContainers.
const restoreAnchor = "// Restore/minimize popup size if it was expanded. Surgical restore:";
const restoreStart = MAIN.indexOf(restoreAnchor);
const restoreEnd = MAIN.indexOf("};", restoreStart);
if (restoreStart < 0 || restoreEnd < 2) throw new Error("restore block not found");
// Trim the arrow-function closing `};` — keep just the if-block so it can be
// evaluated as a standalone statement.
const restoreBlock = MAIN.slice(restoreStart, restoreEnd).replace(/\n\s*}$/, "");

const helperSrc = extractFunction(MAIN, "sfarcExpandPopupContainer");

// A fake element that mimics the real style/dataset API: cssText is directly
// settable (like a real element), setProperty appends a declaration,
// removeProperty strips the matching declaration.
function makePopup() {
  const style = {
    _css: "",
    get cssText() { return this._css; },
    set cssText(v) { this._css = v; },
    setProperty(prop, value, priority) {
      this.removeProperty(prop);
      this._css += `${prop}: ${priority === "important" ? value + " !important" : value}; `;
    },
    removeProperty(prop) {
      this._css = this._css.replace(new RegExp(`${prop}: [^;]+; ?`), "");
    },
  };
  const el = {
    style,
    dataset: {},
    classList: { _set: new Set(), remove(c) { this._set.delete(c); }, add(c) { this._set.add(c); }, contains(c) { return this._set.has(c); } },
  };
  return el;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Expand → restore round-trip must fully return to the base size.
// ────────────────────────────────────────────────────────────────────────────
{
  const popup = makePopup();
  popup.style.cssText = "transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s;"; // panel markup inline style
  const doc = { querySelector: (sel) => (sel === ".sfarc-popup-container" ? popup : null) };
  const api = new Function("document", helperSrc + "\nreturn { sfarcExpandPopupContainer };")(doc);

  // DevTools expansion (the min-width offender).
  api.sfarcExpandPopupContainer({ width: "max-content", "min-width": "780px", "max-width": "92vw" });
  ok(popup.dataset.expanded === "true", "expansion marks dataset.expanded", popup.dataset.expanded);
  ok(popup.dataset.originalCssText.includes("transition"), "expansion captures the original inline cssText", "captured");
  ok(popup.style.cssText.includes("min-width: 780px !important"), "expansion applies min-width 780px", popup.style.cssText.trim());

  // Restore via the real restore block.
  const restoreApi = new Function(
    "document",
    restoreBlock + "\nreturn { restore: () => {} };" // block runs immediately; give it a document
  )({ querySelector: () => popup, querySelectorAll: () => [], getElementById: () => null });

  ok(popup.dataset.expanded === "false", "restore resets dataset.expanded", popup.dataset.expanded);
  ok(!popup.style.cssText.includes("min-width"), "restore clears min-width (old code kept it)", popup.style.cssText.trim() || "(empty)");
  ok(!popup.style.cssText.includes("width: max-content"), "restore clears expansion width", popup.style.cssText.trim() || "(empty)");
  ok(!popup.style.cssText.includes("max-width"), "restore clears expansion max-width", popup.style.cssText.trim() || "(empty)");
  ok(popup.style.cssText.includes("transition"), "restore keeps the inline transition (does not nuke cssText)", popup.style.cssText.trim());

  // Re-expansion after restore must still work (no desync).
  api.sfarcExpandPopupContainer({ width: "90vw", "max-width": "90vw" });
  ok(popup.dataset.expanded === "true", "re-expansion works after restore", popup.dataset.expanded);
  ok(popup.style.cssText.includes("width: 90vw !important"), "re-expansion reapplies width", popup.style.cssText.trim());
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Source integrity: all three expansion branches use the shared helper.
// ────────────────────────────────────────────────────────────────────────────
{
  const devtools = MAIN.slice(MAIN.indexOf("if (tab === 'devtools')"), MAIN.indexOf("await loadDevToolsContent();"));
  const debugLogs = MAIN.slice(MAIN.indexOf("} else if (tab === 'debug-logs')"), MAIN.indexOf("await loadDebugLogsContent();"));
  const org = MAIN.slice(MAIN.indexOf("} else if (tab === 'org')"), MAIN.indexOf("// Fetch real org data"));

  ok(devtools.includes("sfarcExpandPopupContainer({"), "DevTools branch uses the shared helper");
  ok(!/style\.setProperty/.test(devtools), "DevTools branch has no duplicated inline expansion", "no setProperty");
  ok(debugLogs.includes("sfarcExpandPopupContainer({"), "Debug Logs branch uses the shared helper");
  ok(org.includes("sfarcExpandPopupContainer({"), "Org branch uses the shared helper");
  ok(!/style\.cssText = popupContainer\.dataset\.originalCssText \|\| ''/.test(MAIN), "no cssText-nuking restore remains");
  ok(MAIN.split("Restore/minimize popup size if it was expanded. Surgical restore:").length === 3, "both restore blocks updated", "2/2 surgical");
}

// ────────────────────────────────────────────────────────────────────────────
// 4. content.js watchdog: re-injects when the panel is wiped.
// ────────────────────────────────────────────────────────────────────────────
{
  const wdStart = CONTENT.indexOf("// Keep the injected panel alive across Salesforce SPA navigations.");
  const wdEnd = CONTENT.indexOf("setInterval(ensurePanelPresent, 2000);") + "setInterval(ensurePanelPresent, 2000);".length;
  if (wdStart < 0 || wdEnd < 0) throw new Error("watchdog block not found");
  const watchdogSrc = CONTENT.slice(wdStart, wdEnd).replace("setInterval(ensurePanelPresent, 2000);", "");

  const sent = [];
  const fakeWindow = {};
  const makeChrome = () => ({
    runtime: { id: "ext", lastError: null, sendMessage: (msg, cb) => { sent.push(msg); cb({ success: true }); } },
  });
  const makeApi = (doc, loaded) => new Function(
    "window", "chrome", "document",
    "let mainLoaded = arguments[3];" +
      watchdogSrc +
      "\nreturn { ensurePanelPresent: () => { ensurePanelPresent(); return mainLoaded; } };"
  )(fakeWindow, makeChrome(), doc, loaded);

  // Panel present → no message.
  const docWithPanel = { getElementById: (id) => (id === "sfarc-panel" ? {} : null) };
  const api2 = makeApi(docWithPanel, true);
  api2.ensurePanelPresent();
  ok(sent.length === 0, "watchdog stays quiet while the panel exists", `${sent.length} message(s)`);

  // Panel missing → re-sends loadMain and resets the flag.
  const api3 = makeApi({ getElementById: () => null }, true);
  const stillLoaded = api3.ensurePanelPresent();
  ok(sent.length === 1 && sent[0].action === "loadMain", "watchdog re-sends loadMain when the panel is gone", JSON.stringify(sent));
  ok(stillLoaded === true, "watchdog restores mainLoaded after re-injection", "true");

  // waitForPanelReady must also re-trigger loadMain instead of waiting 3s.
  const wfpStart = CONTENT.indexOf("function waitForPanelReady");
  const wfpEnd = CONTENT.indexOf("\n// Keep the injected panel alive");
  const wfpSrc = CONTENT.slice(wfpStart, wfpEnd);
  ok(wfpSrc.includes("chrome.runtime.sendMessage({ action: 'loadMain' }"), "waitForPanelReady re-triggers loadMain when the panel is missing");
}

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
