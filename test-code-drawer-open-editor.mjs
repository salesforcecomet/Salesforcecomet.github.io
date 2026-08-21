// Dev-only test — NOT part of the extension build.
//
// Verifies the code-search drawer's "Open in Editor" deep-link mapping
// (src/code-search.js, sfarcCodeDrawerEditorParams): each search-result file
// type resolves to the right code-editor OPEN_ASSET params, and the drawer
// header no longer carries the old Salesforce Setup link.
//
// Run:  node test-code-drawer-open-editor.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(__dirname, "src", "code-search.js"), "utf8");

let failures = 0;
let checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) console.log(`  PASS  ${label}${extra ? `  (${extra})` : ""}`);
  else {
    failures++;
    console.error(`  FAIL  ${label}${extra ? `  (${extra})` : ""}`);
  }
}

// Extract sfarcCodeDrawerEditorParams VERBATIM.
const fnStart = SRC.indexOf("function sfarcCodeDrawerEditorParams(");
if (fnStart < 0) throw new Error("sfarcCodeDrawerEditorParams not found in src/code-search.js");
let i = fnStart;
let depth = 0;
let inStr = null;
let end = -1;
for (; i < SRC.length; i++) {
  const c = SRC[i];
  if (inStr) {
    if (c === "\\") { i++; continue; }
    if (c === inStr) inStr = null;
    continue;
  }
  if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error("unbalanced sfarcCodeDrawerEditorParams");
const fn = eval(`(${SRC.slice(fnStart, end)})`);

// ────────────────────────────────────────────────────────────────────────────
console.log("── Deep-link param mapping ──────────────────────────────────────");
ok(
  JSON.stringify(fn({ type: "ApexClass", id: "01p1", name: "MyClass" })) ===
    JSON.stringify({ apexId: "01p1", apexName: "MyClass", type: "apex" }),
  "ApexClass → apex deep-link"
);
ok(
  JSON.stringify(fn({ type: "ApexTrigger", id: "01q1", name: "MyTrigger" })) ===
    JSON.stringify({ triggerId: "01q1", triggerName: "MyTrigger", type: "trigger" }),
  "ApexTrigger → trigger deep-link"
);
ok(
  JSON.stringify(fn({ type: "ApexPage", id: "0661", name: "MyPage" })) ===
    JSON.stringify({ pageId: "0661", pageName: "MyPage", type: "vfpage" }),
  "ApexPage → Visualforce page deep-link"
);
const lwc = fn({ type: "LightningComponentResource", id: "r1", bundleId: "0Rb1", name: "myBundle / myComponent.js" });
ok(
  JSON.stringify(lwc) === JSON.stringify({ bundleId: "0Rb1", bundleName: "myBundle", type: "lwc" }),
  "LightningComponentResource → LWC bundle deep-link (bundle name before ' / ')"
);
ok(fn({ type: "LightningComponentResource", id: "r1", bundleId: "0Rb1", name: "onlyName" }).bundleName === "onlyName", "LWC without ' / ' keeps the full name as bundle name");
ok(fn({ type: "SomethingElse", id: "x" }) === null, "unknown type → null (button becomes a no-op)");
ok(fn(null) === null && fn(undefined) === null, "missing file → null");

// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Source integrity (Setup link removed, editor button wired) ───");
ok(!SRC.includes("sfarc-code-drawer-setup-link"), "old Setup link element is gone");
ok(!SRC.includes("/lightning/setup/ApexClasses/page"), "Setup URL building is gone");
ok(SRC.includes('id="sfarc-code-drawer-editor-btn"'), "Open-in-Editor button exists in the drawer header");
ok(SRC.includes("action: 'openExtensionPage', page: 'code-editor'"), "button sends the code-editor open message");
ok(SRC.includes("sfarcCodeDrawerEditorParams(file)"), "click handler resolves params through the helper");

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
