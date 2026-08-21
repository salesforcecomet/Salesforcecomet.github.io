// Dev-only stress test — NOT part of the extension build.
//
// Seeds 18,000 fake Apex classes (plus large members/coverage/LWC datasets) and
// verifies the three big list surfaces render WITHOUT jank:
//   1. Code Editor file tree   (renderOrgExplorerTree, src/code-editor.js)
//   2. Metadata Exporter members + coverage (renderMembersList / renderCoverageList,
//      src/metadata-exporter.js)
//   3. Code Editor metadata tab + coverage + LWC list (renderMetadataTypesList /
//      renderMetadataMembersList / renderCoverageList / renderLwcList, src/main.js)
//
// It does NOT test copies: every render function and the sfarcRenderChunkedList
// helper are extracted VERBATIM from the real source files (brace-matched,
// string/template/comment-aware) and executed against a minimal DOM stub.
//
// Run:  node test-18k-stress.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNK = 500;
const N = 18000; // seeded Apex classes / members / coverage rows

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
// 1. Extract a top-level (or IIFE-nested) `function NAME(...) {...}` verbatim.
//    Skips '...', "...", `...` (templates), // and /* */ comments while counting
//    braces, so template literals full of HTML/braces never confuse the match.
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
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  throw new Error(`unbalanced function ${name}`);
}

const normalize = (s) => s.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");

// ────────────────────────────────────────────────────────────────────────────
// 2. Minimal DOM stub.
//
//    innerHTML is parsed just enough to matter: every `<tag class="...">` in a
//    template becomes a FLAT child stub (tags with no class still become a
//    child so tag selectors like `tbody` resolve). This mirrors the real DOM's
//    structural lookups (`.tree-folder-children`, `tbody`, `.item-checkbox`,
//    `.file-item-menu-btn`, ...) without implementing an HTML parser.
//    querySelector never caches — it returns what's actually in children or
//    null, exactly like the browser, so `if (prev) prev.remove()` works.
// ────────────────────────────────────────────────────────────────────────────
class FakeClassList {
  constructor(el) { this._el = el; this._set = new Set(); }
  add(...c) { c.forEach((x) => this._set.add(x)); }
  remove(...c) { c.forEach((x) => this._set.delete(x)); }
  contains(c) { return this._set.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this._set.has(c) : !!force;
    on ? this._set.add(c) : this._set.delete(c);
    return on;
  }
}

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*?)?)\s*(\/?)>/g;

class FakeEl {
  constructor(tag = "div") {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.id = "";
    this.value = "";
    this._className = "";
    this._textContent = "";
    this._innerHTML = "";
    this.onclick = null;
    this.onchange = null;
    this.onmousedown = null;
    this.oncontextmenu = null;
  }
  get className() { return this._className; }
  set className(v) { this._className = v; }
  get classList() { return (this._cl = this._cl || new FakeClassList(this)); }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this.children = [];
    if (!this._innerHTML) return;
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(this._innerHTML))) {
      const tag = m[1].toLowerCase();
      const attrs = m[2] || "";
      if (m[3] === "/") continue; // self-closing: skip
      const classMatch = /class="([^"]*)"/.exec(attrs);
      const el = new FakeEl(tag);
      if (classMatch) el.className = classMatch[1];
      this.children.push(el);
    }
  }
  appendChild(child) {
    if (child && child.__isFragment) {
      for (const c of child.children) { c.parentNode = this; this.children.push(c); }
      child.children = [];
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (this.parentNode) {
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
      this.parentNode = null;
    }
  }
  addEventListener(type, fn) { this["on" + type] = fn; }
  _match(sel) {
    if (sel.startsWith(".")) return this._className.split(/\s+/).includes(sel.slice(1));
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }
  querySelector(sel) {
    for (const c of this.children) if (c._match(sel)) return c;
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const c of this.children) {
      if (c._match(sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
  }
}

class FakeFragment {
  constructor() { this.children = []; this.__isFragment = true; }
  appendChild(c) { c.parentNode = null; this.children.push(c); return c; }
}

const byId = new Map();
const fakeDocument = {
  createElement: (tag) => new FakeEl(tag),
  createDocumentFragment: () => new FakeFragment(),
  getElementById: (id) => byId.get(id) || null,
  body: new FakeEl("body"),
  addEventListener: () => {},
  readyState: "complete",
};
const fakeEscapeHtml = (s) => String(s).replace(/[&<>"]/g, (x) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]));
const fakeWindow = { escapeHtml: fakeEscapeHtml, innerWidth: 1024, innerHeight: 768, addEventListener: () => {} };

function register(id, el) { byId.set(id, el); return el; }

// ────────────────────────────────────────────────────────────────────────────
// 3. Source files → extract the real functions.
// ────────────────────────────────────────────────────────────────────────────
const SRC = {
  codeEditor: fs.readFileSync(path.join(__dirname, "src/code-editor.js"), "utf8"),
  metaExporter: fs.readFileSync(path.join(__dirname, "src/metadata-exporter.js"), "utf8"),
  main: fs.readFileSync(path.join(__dirname, "src/main.js"), "utf8"),
};

const chunkedCopies = {
  "code-editor.js": extractFunction(SRC.codeEditor, "sfarcRenderChunkedList"),
  "metadata-exporter.js": extractFunction(SRC.metaExporter, "sfarcRenderChunkedList"),
  "main.js": extractFunction(SRC.main, "sfarcRenderChunkedList"),
};

console.log("── Source integrity ──────────────────────────────────────────────");
// All three copies of the helper must be code-identical (comments may differ).
const normalized = Object.values(chunkedCopies).map(normalize);
ok(new Set(normalized).size === 1, "sfarcRenderChunkedList identical across code-editor.js / metadata-exporter.js / main.js");

// Every big-list render function must route through the chunked helper.
const routingChecks = [
  ["code-editor.js", "renderOrgExplorerTree"],
  ["metadata-exporter.js", "renderMembersList"],
  ["metadata-exporter.js", "renderCoverageList"],
  ["main.js", "renderMetadataTypesList"],
  ["main.js", "renderMetadataMembersList"],
  ["main.js", "renderCoverageList"],
  ["main.js", "renderLwcList"],
];
const srcKey = { "code-editor.js": "codeEditor", "metadata-exporter.js": "metaExporter", "main.js": "main" };
for (const [file, fn] of routingChecks) {
  const body = extractFunction(SRC[srcKey[file]], fn);
  ok(body.includes("sfarcRenderChunkedList("), `${file} :: ${fn} calls sfarcRenderChunkedList`);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Data seeds.
// ────────────────────────────────────────────────────────────────────────────
function seedApexClasses(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ Id: `01p${String(i).padStart(15, "0")}`, Name: `Class_${i}` });
  return arr;
}
function seedMembers(n) {
  return seedApexClasses(n).map((c) => ({
    fullName: c.Name,
    lastModifiedDate: "2024-01-01T00:00:00Z",
    lastModifiedByName: "Buffy Bot",
  }));
}
function seedCoverage(n) {
  return seedApexClasses(n).map((c, i) => ({ name: c.Name, percent: (i * 7) % 101, covered: 10, uncovered: 20 }));
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const isMoreRow = (c) => c._className.split(/\s+/).includes("sfarc-more-row");
const rowCount = (container) => container.children.filter((c) => !isMoreRow(c)).length;

// ────────────────────────────────────────────────────────────────────────────
// 5. Shared stress runner: renders via the real chunked helper and verifies
//    bounded DOM + progressive "Show more" + timing.
// ────────────────────────────────────────────────────────────────────────────
function stressList(label, render, getContainer, itemsForNaive) {
  const t0 = now();
  render();
  const initialMs = now() - t0;
  const container = getContainer();
  const initialRows = rowCount(container);

  // Bounded initial render: exactly chunk rows, plus one "Show more" row.
  ok(initialRows === CHUNK, `${label}: initial DOM bounded at ${CHUNK} rows`, `${initialRows} rows + 1 "Show more" (NOT ${N})`);
  ok(container.children.some(isMoreRow), `${label}: \"Show more\" row present after initial render`);
  ok(initialMs < 250, `${label}: initial render fast`, `${initialMs.toFixed(1)}ms`);

  // Progressive reveal: each click adds exactly the next chunk, and the
  // "Show more" row disappears exactly when all N rows are in the DOM.
  const t1 = now();
  let clicks = 0;
  let prevRows = initialRows;
  let moreRow = container.children.find(isMoreRow) || null;
  while (moreRow) {
    moreRow.onclick();
    clicks++;
    const rows = rowCount(container);
    const expectedAdd = Math.min(CHUNK, N - prevRows);
    ok(rows === prevRows + expectedAdd, `${label}: \"Show more\" #${clicks} adds exactly ${expectedAdd} rows`, `+${rows - prevRows}`);
    prevRows = rows;
    moreRow = container.children.find(isMoreRow) || null;
  }
  const totalMs = now() - t1;
  const expectedClicks = Math.ceil(N / CHUNK) - 1;
  ok(clicks === expectedClicks, `${label}: revealed all ${N} items`, `${clicks} clicks`);
  ok(prevRows === N, `${label}: final DOM holds exactly ${N} rows`, `${prevRows} rows`);
  ok(totalMs < 5000, `${label}: full click-through fast`, `${totalMs.toFixed(1)}ms`);

  // Naive (pre-fix) comparison: the old code built all rows in one pass.
  const naive = new FakeEl("div");
  const items = itemsForNaive || seedApexClasses(N);
  const t2 = now();
  for (let i = 0; i < items.length; i++) {
    const d = new FakeEl("div");
    d.innerHTML = `<span>${items[i].Name || items[i].fullName || items[i].name}</span>`;
    naive.appendChild(d);
  }
  const naiveMs = now() - t2;
  ok(naive.children.length === N, `${label}: naive full build creates all ${N} nodes at once`, `${naive.children.length} nodes in ${naiveMs.toFixed(1)}ms`);

  return { initialMs, totalMs, naiveMs };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Test 1 — Code Editor file tree (real renderOrgExplorerTree, 18k classes)
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Code Editor file tree (18,000 Apex classes) ───────────────────");
{
  const renderOrgExplorerTree = new Function(
    "document", "window", "sfarcRenderChunkedList",
    "orgMetadata", "expandedFolders", "openTabPaths", "activeFilePath",
    "currentBundleInfo", "currentFiles", "getFileIconHtml",
    "loadApexAsset", "loadApexTrigger", "loadLwcBundle", "loadAuraBundle",
    "loadVfPage", "loadLmsChannel", "loadAgentforceType", "openFileContextMenu",
    "openFileInEditor", "promptAddNewFile", "toggleFolder", "renderTabs",
    extractFunction(SRC.codeEditor, "renderOrgExplorerTree") + "\nreturn renderOrgExplorerTree;"
  )(
    fakeDocument, fakeWindow, new Function("document", chunkedCopies["code-editor.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    { apexClasses: seedApexClasses(N), apexTriggers: [], lwcBundles: [], auraBundles: [], lmsChannels: [], agentforceTypes: [], vfPages: [], vfComponents: [] },
    new Set(["folder-lwc"]), [], null, { id: null, name: null, type: null }, {},
    () => "",
    () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {},
    () => {}, () => {}, () => {}, () => {}, () => {}
  );

  const tree = register("file-tree", new FakeEl("div"));
  register("sidebar-search-input", new FakeEl("input"));

  stressList("file tree", () => renderOrgExplorerTree(""), () => {
    const apexFolder = tree.children[0];
    return apexFolder.querySelector(".tree-folder-children");
  }, seedApexClasses(N));
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Test 2 — Metadata Exporter members + coverage (real functions, 18k)
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Metadata Exporter (18,000 members / coverage rows) ──────────────");
{
  const renderMembersList = new Function(
    "document", "window", "sfarcRenderChunkedList",
    "currentType", "typeMembers", "selectedMembers", "selectedTypes",
    "renderTypesList", "renderSelectionPane", "openSourceDrawer",
    extractFunction(SRC.metaExporter, "renderMembersList") + "\nreturn renderMembersList;"
  )(
    fakeDocument, fakeWindow, new Function("document", chunkedCopies["metadata-exporter.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    "ApexClass",
    { ApexClass: seedMembers(N) },
    {}, new Set(),
    () => {}, () => {}, () => {}
  );

  const membersList = register("members-list", new FakeEl("div"));
  register("member-search", new FakeEl("input"));
  register("filter-user", new FakeEl("input"));
  register("sort-members", (() => { const e = new FakeEl("select"); e.value = "name"; return e; })());

  // The members renderer owns a semantic table; rows live in its tbody rather
  // than directly under the outer list container.
  stressList("members list", () => renderMembersList(), () => membersList.children[0].children[1], seedMembers(N));

  const renderCoverageList = new Function(
    "document", "window", "sfarcRenderChunkedList", "coverageData",
    extractFunction(SRC.metaExporter, "renderCoverageList") + "\nreturn renderCoverageList;"
  )(
    fakeDocument, fakeWindow, new Function("document", chunkedCopies["metadata-exporter.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    seedCoverage(N)
  );

  const coverageList = register("coverage-list", new FakeEl("div"));
  stressList("coverage list", () => renderCoverageList(""), () => coverageList, seedCoverage(N));
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Test 3 — main.js metadata tab + coverage + LWC list (real functions)
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── main.js Code Editor metadata tab (18,000 members) ───────────────");
{
  const renderMetadataTypesList = new Function(
    "document", "sfarcRenderChunkedList", "metadataState", "escapeHtml", "selectMetadataType",
    extractFunction(SRC.main, "renderMetadataTypesList") + "\nreturn renderMetadataTypesList;"
  )(
    fakeDocument, new Function("document", chunkedCopies["main.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    { types: [], currentType: null, selectedTypes: new Set(), selectedMembers: {} },
    fakeEscapeHtml, () => {}
  );
  register("sfarc-meta-types-list", new FakeEl("div"));
  renderMetadataTypesList(""); // small list — just verifies it runs via the chunked path

  const renderMetadataMembersList = new Function(
    "document", "sfarcRenderChunkedList", "metadataState", "escapeHtml", "toggleMemberSelection",
    extractFunction(SRC.main, "renderMetadataMembersList") + "\nreturn renderMetadataMembersList;"
  )(
    fakeDocument, new Function("document", chunkedCopies["main.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    { currentType: "ApexClass", membersCache: { ApexClass: seedMembers(N) }, selectedMembers: {}, selectedTypes: new Set() },
    fakeEscapeHtml, () => {}
  );
  const metaMembersList = register("sfarc-meta-members-list", new FakeEl("div"));
  register("sfarc-meta-filter-user", new FakeEl("input"));
  register("sfarc-meta-filter-date", new FakeEl("input"));
  stressList("metadata members list", () => renderMetadataMembersList(""), () => metaMembersList, seedMembers(N));

  const renderCoverageList = new Function(
    "document", "sfarcRenderChunkedList", "metadataState",
    extractFunction(SRC.main, "renderCoverageList") + "\nreturn renderCoverageList;"
  )(
    fakeDocument, new Function("document", chunkedCopies["main.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    { coverageData: seedCoverage(N) }
  );
  const coverageList = register("sfarc-coverage-list", new FakeEl("div"));
  stressList("coverage list", () => renderCoverageList(""), () => coverageList, seedCoverage(N));

  const renderLwcList = new Function(
    "document", "sfarcRenderChunkedList", "escapeHtml", "formatApexDate", "storeSessionForEditor",
    extractFunction(SRC.main, "renderLwcList") + "\nreturn renderLwcList;"
  )(
    fakeDocument, new Function("document", chunkedCopies["main.js"] + "\nreturn sfarcRenderChunkedList;")(fakeDocument),
    fakeEscapeHtml, () => "Jan 1, 2024", () => {}
  );
  const lwcList = register("lwc-list", new FakeEl("div"));
  register("sfarc-global-search", new FakeEl("input"));
  const lwcSeed = [];
  for (let i = 0; i < N; i++) {
    lwcSeed.push({ Id: `0x${i}`, MasterLabel: `Lwc_${i}`, DeveloperName: `Lwc_${i}`, ApiVersion: 60, LastModifiedDate: "2024-01-01T00:00:00Z", LastModifiedBy: { Name: "Buffy Bot" } });
  }
  const t = now();
  renderLwcList(lwcSeed);
  ok(now() - t < 250, "LWC list initial render fast", `${(now() - t).toFixed(1)}ms`);
  const lwcTable = lwcList.children[0].children[0];
  const lwcTbody = lwcTable.querySelector("tbody");
  ok(lwcTbody && rowCount(lwcTbody) === CHUNK && lwcTbody.children.some(isMoreRow),
    "LWC list initial DOM bounded via sfarcRenderChunkedList", `${rowCount(lwcTbody)} rows + 1 "Show more"`);
}

// ────────────────────────────────────────────────────────────────────────────
console.log("\n" + (failures === 0 ? "ALL 18K STRESS CHECKS PASSED ✔" : `${failures} CHECK(S) FAILED ✘`));
process.exit(failures === 0 ? 0 : 1);
