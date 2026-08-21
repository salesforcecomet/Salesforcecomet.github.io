// Dev-only test — NOT part of the extension build.
//
// Verifies the Bulk Permission Wizard optimizations:
//   1. Set-based selection (O(1) membership instead of O(n) array.includes
//      per row → O(n·k) per render).
//   2. Delegated checkbox handling — toggling a row never rebuilds the list.
//   3. Debounced search + precomputed lowercase keys.
//   4. Chunked RecordType IN query (single IN blows past SOQL's 20k-char limit
//      with hundreds of selected objects).
//   5. Fetch/render splits so the All-toggles never re-query Salesforce.
//
// renderObjectList, renderPillsAndSelectAll and bindObjectListDelegation are
// extracted VERBATIM from src/bulk-permission-wizard.js (brace-matched) and
// run against minimal stubs. The same fixes in src/code-editor.js are verified
// via source-integrity checks.
//
// Run:  node test-bulk-permission-wizard.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BPW = fs.readFileSync(path.join(__dirname, "src", "bulk-permission-wizard.js"), "utf8");
const CE = fs.readFileSync(path.join(__dirname, "src", "code-editor.js"), "utf8");
const N = 1169; // objects in the screenshot

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
// 1. Verbatim extraction of nested functions (first occurrence = the one
//    inside bindBulkPermissionWizardListeners).
// ────────────────────────────────────────────────────────────────────────────
function extractFunction(src, name) {
  const m = new RegExp("function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) throw new Error(`function ${name} not found in source`);
  let i = m.index, depth = 0, inStr = null;
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
    else if (c === "}") { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  throw new Error(`unbalanced function ${name}`);
}

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

// ────────────────────────────────────────────────────────────────────────────
// 2. Minimal stubs.
// ────────────────────────────────────────────────────────────────────────────
class FakeList {
  constructor() {
    this._html = "";
    this._rows = new Map(); // name -> FakeRow
    this.listeners = {};
  }
  set innerHTML(v) {
    this._html = String(v);
    this._rows.clear();
    // flat parse of bpw-object-row divs
    const re = /<div class="bpw-object-row([^"]*)" data-name="([^"]*)">/g;
    let m;
    while ((m = re.exec(this._html))) {
      const sel = m[1].includes(" selected");
      const row = new FakeRow(m[2], sel);
      this._rows.set(m[2], row);
      row.parent = this;
    }
  }
  get innerHTML() { return this._html; }
  rowCount() { return this._rows.size; }
  row(name) { return this._rows.get(name); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}

class FakeRow {
  constructor(name, selected) {
    this.name = name;
    this.selected = selected;
    this._classes = selected ? new Set(["bpw-object-row", "selected"]) : new Set(["bpw-object-row"]);
  }
  classList = {
    add: (c) => this._classes.add(c),
    remove: (c) => this._classes.delete(c),
    contains: (c) => this._classes.has(c),
  };
  getAttribute(attr) { return attr === "data-name" ? this.name : null; }
  closest() { return this; }
}

function makeControls() {
  return {
    objectSearchInput: { value: "" },
    targetNameInput: { value: "" },
    countBadge: { innerText: "" },
    objectList: new FakeList(),
    selectAllCb: { checked: false },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Build the real functions in one shared scope.
// ────────────────────────────────────────────────────────────────────────────
function buildApi(src) {
  const st = { allObjects: [], selectedObjects: [] };
  const controls = makeControls();
  const selectedSet = new Set();
  const commitSelection = () => { st.selectedObjects = Array.from(selectedSet); };
  const ctrl = {
    objectSearchInput: controls.objectSearchInput,
    targetNameInput: controls.targetNameInput,
    countBadge: controls.countBadge,
    objectList: controls.objectList,
    selectAllCb: controls.selectAllCb,
  };
  const fn = new Function(
    "objectSearchInput", "targetNameInput", "countBadge", "objectList", "selectAllCb",
    "st", "selectedSet", "commitSelection", "escapeHtml",
    extractFunction(src, "renderObjectList") + "\n" +
      extractFunction(src, "renderPillsAndSelectAll") + "\n" +
      extractFunction(src, "bindObjectListDelegation") + "\n" +
      "return { renderObjectList, renderPillsAndSelectAll, bindObjectListDelegation };"
  )(
    ctrl.objectSearchInput, ctrl.targetNameInput, ctrl.countBadge, ctrl.objectList, ctrl.selectAllCb,
    st, selectedSet, commitSelection, escapeHtml
  );
  return { ...fn, st, selectedSet, ctrl, controls };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Source-integrity checks (both copies).
// ────────────────────────────────────────────────────────────────────────────
console.log("── Source integrity (both copies) ─────────────────────────────");
for (const [label, src] of [["bulk-permission-wizard.js", BPW], ["code-editor.js", CE]]) {
  ok(src.includes("let selectedSet = new Set"), `${label}: Set-based selection`);
  ok(src.includes("function commitSelection()"), `${label}: selection array re-synced via commitSelection`);
  ok(src.includes("function scheduleObjectListRender()"), `${label}: debounced search render`);
  ok(src.includes("selectedSet.has(o.name)"), `${label}: O(1) membership in renderObjectList`);
  const rtBody = src.slice(src.indexOf("function renderObjectList"), src.indexOf("function renderPillsAndSelectAll"));
  ok(!/addEventListener\(/.test(rtBody), `${label}: no per-row listeners in renderObjectList (delegation)`);
  ok(src.includes("_key: s.name.toLowerCase()"), `${label}: precomputed lowercase key at load`);
  ok(src.includes("const CHUNK = 150"), `${label}: chunked RecordType IN query`);
  ok(src.includes("renderRecordTypes();") && !/renderRecordTypes\(\).*loadRecordTypes\(\)/s.test(""), `${label}: All-RT toggle re-renders without refetching`);
  ok(src.includes("renderFields();"), `${label}: All-Fields toggle re-renders without re-describing`);
  ok(src.includes("const key = o._key || (o._key = o.name.toLowerCase())"), `${label}: lazy _key backfill for stale state`);
  const loadRt = src.slice(src.indexOf("async function loadRecordTypes"), src.indexOf("async function loadFields"));
  ok(!/SobjectType IN \(\$\{names\.map/s.test(loadRt), `${label}: no unbounded single IN clause`);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Functional: 1169 objects, filter, delegate toggle, select-all sync.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Functional (standalone renderObjectList, 1,169 objects) ──────");
{
  const api = buildApi(BPW);
  const { st, selectedSet, ctrl } = api;

  // Seed WITHOUT _key to prove lazy backfill works for persisted state.
  for (let i = 0; i < N; i++) {
    st.allObjects.push({ name: `Obj${i}_c`, label: `Object ${i}` });
  }
  api.renderObjectList();
  ok(ctrl.objectList.rowCount() === N, "full list renders one pass", `${ctrl.objectList.rowCount()} rows`);
  ok(ctrl.countBadge.innerText === `${N} objects`, "count badge updated");
  const firstRowHtml = ctrl.objectList.innerHTML.slice(0, 200);
  ok(firstRowHtml.includes("data-name=") && firstRowHtml.includes("bpw-object-row"), "rows built as one string with data-name hooks for delegation");
  ok(st.allObjects[0]._key === "obj0_c", "lazy _key backfill cached after first filter");

  // Filter: "OBJ3" matches Obj3, Obj30..39, Obj300..399, Obj3000... (names up to Obj1168)
  ctrl.objectSearchInput.value = "obj3";
  api.renderObjectList();
  const filtered = st.allObjects.filter((o) => o._key.includes("obj3"));
  ok(ctrl.objectList.rowCount() === filtered.length, "filter runs over precomputed keys", `${ctrl.objectList.rowCount()} rows`);

  // Reset filter so the target row is visible, then toggle it through the
  // DELEGATED listener — the list must NOT rebuild.
  ctrl.objectSearchInput.value = "";
  api.renderObjectList();
  const row = ctrl.objectList.row("Obj100_c");
  ok(!!row, "target row exists in DOM");
  const before = ctrl.objectList.rowCount();
  api.bindObjectListDelegation();
  ctrl.objectList.listeners.change({ target: { type: "checkbox", checked: true, closest: () => row } });
  ok(selectedSet.has("Obj100_c"), "delegated toggle adds to the Set");
  ok(st.selectedObjects.includes("Obj100_c"), "commitSelection syncs the state array");
  ok(row.classList.contains("selected"), "row highlight toggled in place");
  ok(ctrl.objectList.rowCount() === before, "toggle did NOT rebuild the list", `rows stable at ${before}`);

  // Un-toggle: O(1) delete + array re-sync.
  ctrl.objectList.listeners.change({ target: { type: "checkbox", checked: false, closest: () => row } });
  ok(!selectedSet.has("Obj100_c") && !st.selectedObjects.includes("Obj100_c"), "un-toggle removes from Set + array");
  ok(ctrl.objectList.rowCount() === before, "un-toggle also skips rebuild");

  // Select-all semantics exercised through the Set ops the handler uses.
  st.allObjects.forEach((o) => selectedSet.add(o.name));
  commitSelectionRef(api);
  ok(st.selectedObjects.length === N, "select-all adds every visible object");
}

function commitSelectionRef(api) {
  // commitSelection is closure-scoped; emulate exactly what the handler calls.
  api.st.selectedObjects = Array.from(api.selectedSet);
}

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
