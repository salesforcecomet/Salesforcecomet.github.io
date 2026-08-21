// Dev-only test — NOT part of the extension build.
//
// Verifies the log-viewer optimization (src/log-viewer.js):
//   1. Shared line cache: a 200k-line log is split ONCE, not 13+ times.
//   2. Chunked raw-log render: `renderLog` puts only SFARC_LOG_CHUNK lines in
//      the DOM at once with a "Show more" row, and `sfarcLogExpandTo` /
//      `sfarcLogRenderAll` expand on demand for search/jump/legend features.
//
// It tests the REAL code: renderLog, sfarcLogAppendChunk, sfarcLogExpandTo,
// sfarcLogRenderAll, getLogLines, plus the module state block, are extracted
// VERBATIM from src/log-viewer.js and run against a minimal DOM stub.
// (escapeHtml is a trivial, stable 5-replacement utility — asserted in source
// and provided as an inline stand-in, like test-18k-stress.mjs does.)
//
// Run:  node test-log-viewer-chunk.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(__dirname, "src", "log-viewer.js"), "utf8");
const N = 200000; // seeded log lines (max-size debug log)

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
// 1. Verbatim function extraction (same approach as test-18k-stress.mjs).
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

// ────────────────────────────────────────────────────────────────────────────
// 2. Minimal DOM stub for the pieces the log renderer touches.
// ────────────────────────────────────────────────────────────────────────────
class FakeEl {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = { add: (c) => { (this._classes ||= new Set()).add(c); }, contains: (c) => !!this._classes && this._classes.has(c) };
    this.style = {};
    this._html = "";
  }
  get className() { return this._className || ""; }
  set className(v) {
    this._className = v;
    (this._classes ||= new Set());
    for (const c of String(v).split(/\s+/)) if (c) this._classes.add(c);
  }
  set innerHTML(v) {
    this._html = String(v);
    this.children = [];
    // Flat parse: every child tag becomes a stub so structural lookups resolve.
    const re = /<([a-zA-Z0-9]+)(?:\s+class="([^"]*)")?[^>]*>/g;
    let m;
    while ((m = re.exec(this._html))) {
      const el = new FakeEl(m[1]);
      if (m[2]) el.className = m[2];
      el.parentNode = this;
      this.children.push(el);
    }
    const text = this._html.replace(/<[^>]*>/g, "");
    if (text.trim()) this.textContent = text;
  }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text !== undefined ? this._text : (this.children.map((c) => c.textContent || "").join("")); }
  appendChild(child) {
    if (child.tagName === "FRAGMENT") {
      for (const c of child.children) { c.parentNode = this; this.children.push(c); }
    } else {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }
  remove() {
    if (this.parentNode) {
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
      this.parentNode = null;
    }
  }
  querySelector(sel) {
    if (sel.startsWith(".")) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) return this;
      for (const c of this.children) { const r = c.querySelector(sel); if (r) return r; }
      return null;
    }
    if (this.tagName === sel.toUpperCase()) return this;
    for (const c of this.children) { const r = c.querySelector(sel); if (r) return r; }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const collect = (node) => {
      for (const c of node.children) {
        if (sel.startsWith(".") && c.classList.contains(sel.slice(1))) out.push(c);
        else if (!sel.startsWith(".") && c.tagName === sel.toUpperCase()) out.push(c);
        collect(c);
      }
    };
    collect(this);
    return out;
  }
}
class FakeFragment extends FakeEl {
  constructor() { super("fragment"); }
}

let fakeContainer = null;
const fakeDocument = {
  createElement: (tag) => new FakeEl(tag),
  createDocumentFragment: () => new FakeFragment(),
  getElementById: (id) => (id === "log-container" ? fakeContainer : null),
};

const fakeEscapeHtml = (text) =>
  !text ? "" : String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Minimal sfApi stub for the fetchLogMetadata regression below.
const fakeWindow = {
  sfApi: {
    query: async (q, isTooling) => ({
      records: [{
        Id: "07LNS00000iADIn2AO",
        LogUser: { Name: "Vishu Grade", Id: "005000000000001" },
        Operation: "Api",
        Status: "Success",
        DurationMilliseconds: 1234,
        LogLength: 1048576,
        StartTime: "2026-08-18T10:00:00.000Z",
        Application: "API",
        Request: "ExecuteAnonymous",
        Location: "class"
      }]
    })
  }
};

// ────────────────────────────────────────────────────────────────────────────
// 3. Build the REAL functions in one shared scope (module state included).
// ────────────────────────────────────────────────────────────────────────────
// The contiguous block added for this feature: cache vars, getLogLines, chunk
// state, sfarcLogAppendChunk, sfarcLogExpandTo, sfarcLogRenderAll.
const stateStart = SRC.indexOf("let cachedLogText = null;");
const stateEnd = SRC.indexOf("function renderLog(text) {");
if (stateStart < 0 || stateEnd < 0) throw new Error("log-viewer feature block not found in source");
const stateBlock = SRC.slice(stateStart, stateEnd);

const api = new Function(
  "document", "escapeHtml",
  stateBlock +
    extractFunction(SRC, "renderLog") + "\n" +
    "return { getLogLines, sfarcLogAppendChunk, sfarcLogExpandTo, sfarcLogRenderAll, renderLog," +
    "  getState: () => ({ container: sfarcLogContainer, rendered: sfarcLogRendered, total: sfarcLogTotal, fullyRendered: sfarcLogFullyRendered, cachedText: cachedLogText, cachedLines: cachedLogLines }) };"
)(fakeDocument, fakeEscapeHtml);

const { renderLog, getLogLines, sfarcLogExpandTo, sfarcLogRenderAll } = api;
const state = () => api.getState();

// ────────────────────────────────────────────────────────────────────────────
// 4. Source-integrity checks.
// ────────────────────────────────────────────────────────────────────────────
console.log("── Source integrity ────────────────────────────────────────────");
const splitSites = [...SRC.matchAll(/const lines = text\.split\('\\n'\);/g)].length;
const cacheSites = [...SRC.matchAll(/const lines = getLogLines\(text\);/g)].length;
ok(splitSites === 0, `no raw text.split('\\n') left in render passes`, `raw=${splitSites}`);  ok(cacheSites >= 8, `render passes route through getLogLines`, `cached=${cacheSites}`);
ok(SRC.includes("if (targetId === 'log') sfarcLogRenderAll();"), "log-tab search expands the full log before highlighting");
ok(SRC.includes("sfarcLogExpandTo(lineNum);"), "jumpToLogLine expands to the target line");
ok(SRC.includes("sfarcLogRenderAll();\n\n                // Find all matches"), "legend click expands the full log before jumping");
ok(SRC.includes("sfarcLogRenderAll();\n\n            // Find first error"), "issues-badge click expands the full log before finding the first error");
ok(SRC.includes("escapeHtml(text)") && SRC.includes('"&amp;"') && SRC.includes("&#039;"), "escapeHtml still the expected 5-replacement utility");
// Regression: the security-badge `tab` declaration must NOT be swallowed by a
// trailing `// comment` on the same line (that produced
// `ReferenceError: tab is not defined` → "Error fetching log: tab is not defined").
ok(
  SRC.includes("// Update the Security Tab count badge\n    const tab = document.querySelector('.viewer-subtab[data-subtarget=\"security\"] span');"),
  "security-badge tab declaration lives on its own line (not inside the comment)"
);
ok(
  !SRC.includes("// Update the Security Tab count badge        const tab ="),
  "no comment-swallowed const tab remains in renderSecurityAnalysis"
);

// ────────────────────────────────────────────────────────────────────────────
// 5. Cache identity: the same string parses ONCE; different text re-parses.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Shared line cache ───────────────────────────────────────────");
const t1 = "a\nb\nc";
const l1a = getLogLines(t1);
const l1b = getLogLines(t1);
ok(l1a === l1b && l1a.length === 3, "line cache returns the SAME array for the same text");
ok(state().cachedText === t1, "cache remembers the last text");
const l2 = getLogLines("x\ny");
ok(l2 !== l1a && l2.length === 2, "line cache re-splits when the text changes");

// ────────────────────────────────────────────────────────────────────────────
// 6. Chunked renderLog on a 200,000-line log.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Chunked raw-log render (200,000 lines) ───────────────────────");
const logText = Array.from({ length: N }, (_, i) =>
  `15:00:00.${String(i % 1000).padStart(3, "0")} (${i + 1})|${i % 7 === 0 ? "USER_DEBUG" : i % 5 === 0 ? "SOQL_EXECUTE_BEGIN" : "CODE_UNIT_STARTED"}|Line ${i}`
).join("\n");

fakeContainer = new FakeEl("div");
renderLog(logText);

const lines = () => fakeContainer.querySelectorAll(".log-line").length;
const moreRow = () => fakeContainer.querySelector(".sfarc-log-more");
const CHUNK = 2000;

ok(lines() === CHUNK, "initial render is bounded to one chunk", `${lines()} nodes (not ${N})`);
ok(!!moreRow(), "initial render shows the Show-more row");
ok(moreRow().textContent.includes("198000 remaining"), "Show-more label reports remaining count");

// Click through: each click appends exactly one chunk
let clicks = 0;
while (moreRow()) {
  const before = lines();
  const row = moreRow();
  row.onclick();
  clicks++;
  const delta = lines() - before;
  ok(delta === CHUNK, `click ${clicks} appends exactly one chunk`, `+${delta}`);
  if (clicks > 120) break; // safety
}
ok(lines() === N, "all 200k lines revealed via Show-more", `${lines()} / ${N}`);
ok(!moreRow(), "no Show-more row remains after full traversal");
ok(fakeContainer.querySelectorAll(".log-line")[0].classList.contains("log-event-user-debug"), "event-class styling survives chunking");
ok(fakeContainer.querySelectorAll(".log-line")[5].classList.contains("log-event-query"), "query-class styling survives chunking");

// ────────────────────────────────────────────────────────────────────────────
// 7. Expand-on-demand semantics (jump / search / legend).
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Expand-on-demand ────────────────────────────────────────────");
fakeContainer = new FakeEl("div");
renderLog(logText); // reset to first chunk
ok(lines() === CHUNK && state().rendered === CHUNK, "state reset per renderLog call");

sfarcLogExpandTo(25000); // jump to line 25,000
ok(lines() === 26000, "expandTo renders only the chunks needed for the target line", `rendered=${lines()}`);
ok(state().rendered === 26000 && !state().fullyRendered, "expandTo stops at the target, not the whole log");

sfarcLogRenderAll();
ok(lines() === N && state().fullyRendered, "renderAll completes the full log");
ok(!moreRow(), "renderAll removes the Show-more row");

// Expand after fully rendered is a no-op (search keystrokes stay cheap)
fakeContainer = new FakeEl("div");
renderLog(logText);
sfarcLogRenderAll();
const beforeAll = lines();
sfarcLogRenderAll();
ok(lines() === beforeAll && state().fullyRendered, "repeated renderAll is a no-op once fully rendered");

// ────────────────────────────────────────────────────────────────────────────
// 8. Empty / invalid input paths.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Edge cases ─────────────────────────────────────────────────");
fakeContainer = new FakeEl("div");
renderLog("");
ok(fakeContainer.children.length === 1 && fakeContainer.children[0].tagName === "DIV", "empty text shows the loading placeholder");
renderLog(null);
ok(fakeContainer.children.length === 1, "null text shows the loading placeholder");
renderLog("only\none\nline");
ok(lines() === 3 && state().fullyRendered, "tiny logs render fully in one chunk");

// ────────────────────────────────────────────────────────────────────────────
// 9. Timing sanity: bounded initial render, then full expansion.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Timing ─────────────────────────────────────────────────────");
fakeContainer = new FakeEl("div");
const t0 = Date.now();
renderLog(logText);
const initialMs = Date.now() - t0;
ok(initialMs < 1000, "initial chunked render is fast", `${initialMs}ms for first ${CHUNK} lines`);

const t1x = Date.now();
sfarcLogRenderAll();
const fullMs = Date.now() - t1x;
ok(fullMs < 15000, "full 200k-line render completes within sanity bound", `${fullMs}ms`);

// ────────────────────────────────────────────────────────────────────────────
// 10. renderSecurityAnalysis regression: the security badge update must run.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── renderSecurityAnalysis regression ───────────────────────────");
const securityContainer = new FakeEl("div");
const securityBadge = new FakeEl("span");
securityBadge._text = "Security Analysis (0)";
const securityDoc = {
  ...fakeDocument,
  getElementById: (id) => (id === "security-container" ? securityContainer : null),
  querySelector: (sel) => (sel === '.viewer-subtab[data-subtarget="security"] span' ? securityBadge : null),
};
// renderSecurityAnalysis contains regex literals with braces (`{15,18}`), which
// the brace-matching extractFunction can't parse — slice between the function
// header and the next top-level function instead.
const rsaStart = SRC.indexOf("function renderSecurityAnalysis(text) {");
const rsaEndBoundary = SRC.indexOf("\nfunction renderQueries(text) {", rsaStart);
if (rsaStart < 0 || rsaEndBoundary < 0) throw new Error("renderSecurityAnalysis boundary not found");
const rsaSlice = SRC.slice(rsaStart, rsaEndBoundary);
const rsaClose = rsaSlice.lastIndexOf("\n}\n");
if (rsaClose < 0) throw new Error("renderSecurityAnalysis closing brace not found");
const rsaSource = rsaSlice.slice(0, rsaClose + 3);
const secApi = new Function(
  "document", "escapeHtml",
  "function getLogLines(text) { return text.split('\\n'); }\n" +
    rsaSource +
    "\nreturn { renderSecurityAnalysis };"
)(securityDoc, fakeEscapeHtml);

try {
  secApi.renderSecurityAnalysis("01:01:01.001 (1)|CODE_UNIT_STARTED|[1]|MyClass\n01:01:01.002 (2)|EXCEPTION_THROWN|[2]|System.SecurityException|INSUFFICIENT_ACCESS_OR_READONLY on Account\nplain line\n");
  ok(true, "renderSecurityAnalysis completes without throwing");
  ok(securityBadge.textContent === "Security Analysis (1)", "security badge count updates", `got ${securityBadge.textContent}`);
} catch (e) {
  ok(false, "renderSecurityAnalysis completes without throwing", e.message);
}

try {
  secApi.renderSecurityAnalysis("no interesting lines here\n");
  ok(securityBadge.textContent === "Security Analysis (0)", "empty log leaves badge at 0", `got ${securityBadge.textContent}`);
} catch (e) {
  ok(false, "renderSecurityAnalysis handles a clean log", e.message);
}

// ────────────────────────────────────────────────────────────────────────────
// fetchLogMetadata regression: it must parse the query response through the
// query() helper (parsed JSON), NOT a raw fetch() Response (which has no
// .records). The old code left currentLogMeta null forever, sticking the
// Details tab on its static "Loading details..." placeholder.
// ────────────────────────────────────────────────────────────────────────────
let fmdPromise;
let ordPromise;
{
  const fmdStart = SRC.indexOf("async function fetchLogMetadata() {");
  const fmdEnd = SRC.indexOf("\nasync function fetchLogContent() {", fmdStart);
  if (fmdStart < 0 || fmdEnd < 0) throw new Error("fetchLogMetadata boundary not found");
  const fmdSource = SRC.slice(fmdStart, fmdEnd).replace(/\n\s*$/, "");

  // The fixed implementation must NOT read .records off a raw fetch() result.
  ok(!/sfApi\.fetch\([^)]*\)[\s\S]{0,120}\.records/.test(fmdSource),
    "fetchLogMetadata parses through query()/json, not raw fetch().records",
    "no raw-fetch .records access");
  ok(/window\.sfApi\.query\(query, true\)/.test(fmdSource),
    "fetchLogMetadata uses the parsed-JSON query() helper",
    "query(query, true) present");

  fakeWindow._logId = "07LNS00000iADIn2AO";
  fakeWindow._h = { fmdRendered: 0, fmdSummary: 0 };
  const fmdApi = new Function(
    "window",
    "let currentLogMeta = null;\n" +
      "let currentLogBody = '01:01:01.001 (1)|EXCEPTION_THROWN|...';\n" +
      "let logId = window._logId;\n" +
      "function renderLogDetails() { window._h.fmdRendered++; }\n" +
      "function updateSummaryHeader() { window._h.fmdSummary++; }\n" +
      fmdSource +
      "\nreturn { run: fetchLogMetadata, get meta() { return currentLogMeta; } };"
  )(fakeWindow);

  fmdPromise = (async () => {
    await fmdApi.run();
    const meta = fmdApi.meta;
    ok(meta !== null, "fetchLogMetadata populates currentLogMeta", meta ? `user=${meta.LogUser?.Name}` : "still null");
    ok(meta && meta.LogUser && meta.LogUser.Name === "Vishu Grade", "metadata keeps nested LogUser shape", meta ? JSON.stringify(meta.LogUser) : "");
    ok(fakeWindow._h.fmdRendered === 1, "fetchLogMetadata re-renders Details after metadata arrives", `${fakeWindow._h.fmdRendered} render(s)`);
    ok(fakeWindow._h.fmdSummary === 1, "fetchLogMetadata refreshes the footer summary", `${fakeWindow._h.fmdSummary} call(s)`);
  })().catch((e) => {
    console.error("fetchLogMetadata harness crashed:", e);
    ok(false, "fetchLogMetadata harness runs without crashing", e.message);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 18MB-log crash regression: the render pipeline must yield between passes,
// and the heavy tab views (Execution Order / Flow / Raw Tree) must be async +
// chunked with O(1) id→node lookups (the old `nodes.find` inside the per-line
// loop was O(n²) and froze the page — Chrome's "Pages Unresponsive").
// ────────────────────────────────────────────────────────────────────────────
{
  // Source integrity: no quadratic lookups left, helpers wired into pipeline.
  ok(!/nodes\.find\(n => n\.id/.test(SRC), "renderOrder has no O(n²) nodes.find lookups");
  ok(!/nodes\.some\(n => n\.children\.includes\(node\.id\)/.test(SRC), "root detection is O(n) via childSet");
  ok(/async function renderOrder/.test(SRC), "renderOrder is async");
  ok(/async function renderFlowAnalysis/.test(SRC), "renderFlowAnalysis is async");
  // Clutter removal: the Raw Tree / SOQL Board duplicates are gone entirely.
  ok(!/renderRawTree|renderSoqlBoard|soql-board|raw-tree/.test(SRC), "Raw Tree + SOQL Board views removed (clutter)");
  // Load is lazy: the eager per-view passes were stripped from the load path;
  // only the chunked log + cheap counters run on load, analyses run on demand.
  const loadBlock = SRC.slice(SRC.indexOf("Rendering log explorer..."), SRC.indexOf("function updateLegendCounts(text) {") + 1);
  ok(/renderLog\(text\);/.test(loadBlock), "load renders the chunked log explorer");
  ok(/updateLegendCounts\(text\);/.test(loadBlock), "load updates legend counts");
  ok(!/renderQueries\(text\);/.test(loadBlock), "load no longer eagerly runs SOQL analysis");
  ok(!/renderSecurityAnalysis\(text\);/.test(loadBlock), "load no longer eagerly runs security analysis");
  ok(!/renderOrder\(text\)/.test(loadBlock), "load no longer eagerly builds execution order");
  ok(/targetId === 'user-debug'/.test(SRC), "Apex Debug analysis runs lazily on tab open");
  ok(/targetId === 'gov-limits'/.test(SRC), "Performance analysis runs lazily on tab open");
  ok(/subtarget === 'queries'/.test(SRC), "SOQL analysis runs lazily on sub-tab open");
  // With lazy loading the load path yields between its (now few) passes;
  // the heavy per-tab renderers yield internally via sfarcRenderRowsChunked.
  const yieldCount = (SRC.match(/await sfarcYield\(\)/g) || []).length;
  ok(yieldCount >= 3, "load pipeline yields between passes", `${yieldCount} yields`);
  ok(/function sfarcRenderRowsChunked/.test(SRC), "chunked row-render helper present");
  ok(/function sfarcRenderToken/.test(SRC), "generation-token guard present");

  // Behavioral: run the REAL renderOrder against 40k synthetic code-unit
  // events. The execution table is intentionally capped at 500 visible rows
  // while its summary receives the full set, keeping large logs responsive.
  const ordStart = SRC.indexOf("async function renderOrder(text) {");
  const ordEnd = SRC.indexOf("\nfunction escapeRegExp", ordStart);
  if (ordStart < 0 || ordEnd < 0) throw new Error("renderOrder boundary not found");
  const ordSource = SRC.slice(ordStart, ordEnd).replace(/\n\s*$/, "");

  const NODES = 40000;
  const logLines = [];
  for (let i = 0; i < NODES; i++) {
    const t = String(600000 + i).padStart(7, "0");
    logLines.push(`06:02:43.882 (${t})|CODE_UNIT_STARTED|[EXEC]|ClassName.method${i}()`);
    logLines.push(`06:02:43.883 (${t + 100})|CODE_UNIT_FINISHED|[EXEC]|ClassName.method${i}()`);
  }
  const ordLog = logLines.join("\n");

  const ordDoc = {
    _stats: { chunkCalls: 0, insertedRows: 0 },
    getElementById: (id) => (id === "order-container" ? ordContainer : null),
    querySelector: () => ordContainer,
  };
  let ordHtml = "";
  const ordContainer = {
    get innerHTML() { return ordHtml; },
    set innerHTML(html) {
      ordHtml = html;
      ordDoc._stats.insertedRows = Math.max(0, (html.match(/<tr>/g) || []).length - 1);
    },
    isConnected: true,
    querySelector: () => ordContainer,
    insertAdjacentHTML(pos, html) {
      ordDoc._stats.chunkCalls++;
      ordDoc._stats.insertedRows += (html.match(/tree-node-wrapper/g) || []).length;
    },
  };

  const ordApi = new Function(
    "document",
    "let sfarcRenderGen = 0;\n" +
      "function sfarcRenderToken() { return ++sfarcRenderGen; }\n" +
      "function sfarcYield() { return Promise.resolve(); }\n" +
      "function getLogLines(text) { return text.split('\\n'); }\n" +
      "const escapeHtml = (t) => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');\n" +
      "let summaryCalls = 0; let summaryRows = 0;\n" +
      "function renderExecutionSummary(rows) { summaryCalls++; summaryRows = rows.length; }\n" +
      "async function sfarcRenderRowsChunked(container, rowHtmls, gen, chunkSize) {\n" +
      "  container.innerHTML = '';\n" +
      "  for (let i = 0; i < rowHtmls.length; i += (chunkSize || 600)) {\n" +
      "    if (gen !== sfarcRenderGen || !container.isConnected) return false;\n" +
      "    container.insertAdjacentHTML('beforeend', rowHtmls.slice(i, i + (chunkSize || 600)).join(''));\n" +
      "    await sfarcYield();\n" +
      "  }\n" +
      "  return gen === sfarcRenderGen;\n" +
      "}\n" +
      ordSource +
      "\nreturn { run: () => renderOrder('" + ordLog.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/'/g, "\\'") + "').then(() => ({ summaryCalls, summaryRows, chunks: document._stats.chunkCalls, rows: document._stats.insertedRows })) };"
  )(ordDoc);

  ordPromise = (async () => {
    const t0 = Date.now();
    const res = await ordApi.run();
    const elapsed = Date.now() - t0;
    ok(Number.isFinite(res.rows) && res.rows === 500, "renderOrder caps the visible table at 500 rows", `${res.rows}/500`);
    ok(res.chunks === 0, "bounded execution table needs no incremental DOM chunks", `${res.chunks} chunks`);
    ok(res.summaryCalls === 1, "renderOrder still runs the execution summary", `${res.summaryCalls} call(s)`);
    ok(res.summaryRows === NODES * 2, "execution summary receives every parsed event", `${res.summaryRows}/${NODES * 2}`);
    ok(elapsed < 5000, "renderOrder on 40k nodes completes fast (O(n), not O(n²))", `${elapsed}ms`);
  })().catch((e) => {
    console.error("renderOrder harness crashed:", e);
    ok(false, "renderOrder harness runs without crashing", e.message);
  });
}

Promise.all([fmdPromise, ordPromise]).then(() => {
  console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
});
