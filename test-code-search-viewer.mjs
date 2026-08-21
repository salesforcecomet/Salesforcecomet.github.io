// Dev-only test — NOT part of the extension build.
//
// Verifies the code-search viewer optimization (src/code-search.js):
//   1. Sparse matches → only context windows around match lines are rendered
//      (jump-to-match) with a "Show all N lines" fallback — not the whole file.
//   2. Dense / no-keyword case → full file rendered in bounded chunks of
//      SFARC_CODE_CHUNK lines with a "Show more" row, so a 10k-line file never
//      builds 10k DOM rows synchronously.
//   3. Tokenizer regex + escape helper are hoisted (compiled once, not per line).
//
// It tests the REAL code: sfarcBuildCodeLineHtml, sfarcTokenizePart,
// sfarcCodeAppendChunk, sfarcCodeRenderFullChunked, sfarcCodeMoreRowHtml and
// window.renderCodeSearchViewer are extracted VERBATIM from src/code-search.js
// (brace-matched, string/template/comment-aware) and run against a DOM stub.
//
// Run:  node test-code-search-viewer.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(__dirname, "src", "code-search.js"), "utf8");
const N = 10000; // seeded file lines
const CHUNK = 2000;

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
// 1. Verbatim extraction (same brace-matching approach as the other dev tests).
// ────────────────────────────────────────────────────────────────────────────
function extractFunction(src, name) {
  const m = new RegExp("function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) throw new Error(`function ${name} not found in source`);
  return extractBraceRange(src, m.index, `function ${name}`);
}

function extractWindowFunction(src, name) {
  const m = new RegExp("window\\.\\s*" + name + "\\s*=\\s*function").exec(src);
  if (!m) throw new Error(`window.${name} not found in source`);
  return extractBraceRange(src, m.index, `window.${name}`);
}

function extractBraceRange(src, startIdx, label) {
  let i = startIdx;
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
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  throw new Error(`unbalanced ${label}`);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Minimal DOM stub.
// ────────────────────────────────────────────────────────────────────────────
class FakeEl {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = { add: () => {}, contains: (c) => !!this._classes && this._classes.has(c) };
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
    parseHtmlInto(this, this._html);
  }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text || ""; }
  set href(v) { this._href = v; }
  get href() { return this._href || ""; }
  set value(v) { this._value = v; }
  get value() { return this._value || ""; }
  insertAdjacentHTML(position, html) {
    if (position === "beforeend") {
      this._html += String(html);
      parseHtmlInto(this, String(html));
    }
  }
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

function parseHtmlInto(parent, html) {
  // Flat parse: tags become child stubs; non-whitespace text runs attach to the
  // most recently opened element (so the "Show more" row's label is readable).
  const re = /<([a-zA-Z0-9]+)(?:\s+class="([^"]*)")?[^>]*>|([^<]+)/g;
  let m;
  let lastEl = null;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const el = new FakeEl(m[1]);
      if (m[2]) el.className = m[2];
      el.parentNode = parent;
      parent.children.push(el);
      lastEl = el;
    } else if (m[3] && m[3].trim()) {
      if (lastEl) lastEl._text = (lastEl._text || "") + m[3];
    }
  }
}

let fakeViewer = null;
const genericEls = new Map();
const fakeDocument = {
  createElement: (tag) => new FakeEl(tag),
  createDocumentFragment: () => new FakeEl("fragment"),
  getElementById: (id) => {
    if (id === "sfarc-code-search-viewer") return fakeViewer;
    if (!genericEls.has(id)) genericEls.set(id, new FakeEl("div"));
    return genericEls.get(id);
  },
};

const fakeWindow = {
  sfarcCodeSearchMatches: [],
  sfarcCurrentCodeFile: null,
  sfarcCurrentCodeIndex: -1,
  openCodeSearchDrawer: () => { throw new Error("openCodeSearchDrawer should not run in local-search tests"); },
};

// ────────────────────────────────────────────────────────────────────────────
// 3. Build the REAL functions in one shared scope (hoisted helpers + state).
// ────────────────────────────────────────────────────────────────────────────
const helpersStart = SRC.indexOf("const SFARC_CODE_TOKENIZER_RE");
const helpersEnd = SRC.indexOf("window.renderCodeSearchViewer = function");
if (helpersStart < 0 || helpersEnd < 0) throw new Error("code-search feature block not found in source");
const helpersBlock = SRC.slice(helpersStart, helpersEnd);

const api = new Function(
  "document", "window",
  helpersBlock +
    extractWindowFunction(SRC, "renderCodeSearchViewer").replace("window.renderCodeSearchViewer = function", "function renderCodeSearchViewer") + "\n" +
    "return { sfarcBuildCodeLineHtml, sfarcTokenizePart, sfarcCodeMoreRowHtml, sfarcCodeAppendChunk, sfarcCodeRenderFullChunked, renderCodeSearchViewer, " +
    "  getState: () => ({ shown: sfarcCodeFullState ? sfarcCodeFullState.shown : -1, total: sfarcCodeFullState ? sfarcCodeFullState.total : -1 }) };"
)(fakeDocument, fakeWindow);

const { sfarcBuildCodeLineHtml, sfarcCodeMoreRowHtml, renderCodeSearchViewer } = api;
const state = () => api.getState();

function renderedLineCount() {
  return (fakeViewer.innerHTML.match(/id="sfarc-code-line-/g) || []).length;
}
function hasLine(n) {
  return fakeViewer.innerHTML.includes(`id="sfarc-code-line-${n}"`);
}
function moreRow() {
  return fakeViewer.querySelector(".sfarc-code-more");
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Source-integrity checks.
// ────────────────────────────────────────────────────────────────────────────
console.log("── Source integrity ────────────────────────────────────────────");
ok(SRC.includes("const SFARC_CODE_TOKENIZER_RE = /('[^']*')|"), "tokenizer regex declared once as a hoisted constant");
ok(SRC.includes("part.replace(SFARC_CODE_TOKENIZER_RE"), "tokenizer helper uses the hoisted constant");
ok(!SRC.includes("const tokenizer = /"), "no per-line tokenizer recompilation remains");
ok(SRC.includes("function sfarcBuildCodeLineHtml"), "line-builder extracted to a top-level function");
ok(SRC.includes("sfarcCodeRenderFullChunked(viewer, lines, keyword, keywordRegex)"), "sparse-mode Show-all routes to the chunked full renderer");
ok(SRC.includes("const sparse = priority.size > 0 && priority.size * 7 < lines.length;"), "jump-to-match windowing heuristic present");
ok(SRC.includes("sfarcCodeAppendChunk()"), "chunked full-file append present");
ok(!/const tokenizer = /.test(SRC), "no per-line tokenizer recompilation remains");

// ────────────────────────────────────────────────────────────────────────────
// 5. Windowed mode: 10k-line file with 5 sparse matches.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Sparse matches → jump-to-match windows ───────────────────────");
const matchLines = [100, 2000, 5000, 8000, 9999];
const body = Array.from({ length: N }, (_, i) => {
  const lineNum = i + 1;
  const isMatch = matchLines.includes(lineNum);
  return isMatch ? `public class Foo${lineNum} { // needle marker` : `private Integer field${lineNum} = ${lineNum};`;
}).join("\n");

const file = {
  type: "ApexClass", name: "Foo", id: "01pX", body,
  matches: matchLines.map((ln) => ({ lineNumber: ln, content: `needle on ${ln}` })),
};

fakeViewer = new FakeEl("div");
fakeWindow.sfarcCodeSearchMatches = [file];
renderCodeSearchViewer(0, "needle", null, true);

ok(renderedLineCount() < 100, "windowed render is bounded, not the whole file", `${renderedLineCount()} rows rendered`);
ok(!!moreRow(), "Show-all row present");
ok(moreRow().textContent.includes("Show all 10000 lines"), "Show-all row labels the fallback");
for (const ln of matchLines) {
  ok(hasLine(ln), `match line ${ln} rendered`);
  const windowEnd = Math.min(ln + 2, N);
ok(hasLine(ln - 2) && hasLine(windowEnd), `context window around ${ln} rendered (${ln - 2}..${windowEnd})`);
}
ok(!hasLine(500), "non-window line 500 not rendered");
ok(!hasLine(6000), "non-window line 6000 not rendered");
ok(fakeViewer.innerHTML.includes("<mark"), "keyword highlighted in windowed mode");

// Show-all → chunked full render
moreRow().onclick();
ok(renderedLineCount() === CHUNK, "Show-all switches to chunked full render", `${renderedLineCount()} rows in first chunk`);
ok(!!moreRow() && moreRow().textContent.includes("8000 remaining"), "chunked Show-more row present");

// Click through to the end
let clicks = 0;
while (moreRow()) {
  moreRow().onclick();
  clicks++;
  if (clicks > 10) break;
}
ok(renderedLineCount() === N, "all 10k lines reachable via Show-more", `${renderedLineCount()} / ${N}`);
ok(!moreRow(), "no Show-more row remains after full traversal");

// ────────────────────────────────────────────────────────────────────────────
// 6. Dense matches → full file chunked from the top.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Dense matches → chunked full render ───────────────────────────");
const denseBody = Array.from({ length: N }, (_, i) => `public void method${i}() { int x = ${i}; /* every line matches */ }`).join("\n");
const denseFile = { type: "ApexClass", name: "Dense", id: "01pY", body: denseBody, matches: [{ lineNumber: 1, content: "x" }] };
fakeViewer = new FakeEl("div");
fakeWindow.sfarcCodeSearchMatches = [denseFile];
renderCodeSearchViewer(0, "x", null, true);
ok(renderedLineCount() === CHUNK, "dense render starts chunked", `${renderedLineCount()} rows (not ${N})`);
ok(!!moreRow(), "dense render shows Show-more row");
moreRow().onclick();
ok(renderedLineCount() === CHUNK * 2, "chunked append adds exactly one chunk");

// ────────────────────────────────────────────────────────────────────────────
// 7. Jump-to-line expands the chunked render to cover the target.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Jump-to-line expansion ───────────────────────────────────────");
fakeViewer = new FakeEl("div");
fakeWindow.sfarcCodeSearchMatches = [denseFile];
renderCodeSearchViewer(0, "x", 5000, true);
ok(hasLine(5000), "jump target line is rendered", `rendered ${renderedLineCount()} rows`);
ok(renderedLineCount() >= 5000 && renderedLineCount() < 10000, "expansion stops at the target, not the whole file", `${renderedLineCount()} rows`);
ok(!!moreRow(), "Show-more row remains for the rest of the file");

// ────────────────────────────────────────────────────────────────────────────
// 8. Edge cases.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Edge cases ─────────────────────────────────────────────────");
fakeViewer = new FakeEl("div");
const tinyFile = { type: "ApexClass", name: "Tiny", id: "01pZ", body: "a\nb\nc", matches: [{ lineNumber: 2, content: "b" }] };
fakeWindow.sfarcCodeSearchMatches = [tinyFile];
renderCodeSearchViewer(0, "b", null, true);
ok(renderedLineCount() === 3 && !moreRow(), "tiny file renders fully, no Show-all row", `${renderedLineCount()} rows`);

fakeViewer = new FakeEl("div");
const emptyFile = { type: "ApexClass", name: "Empty", id: "01pQ", body: "", matches: undefined };
fakeWindow.sfarcCodeSearchMatches = [emptyFile];
renderCodeSearchViewer(0, "zork", null, true);
ok(fakeViewer.innerHTML !== undefined && !moreRow(), "empty file renders without crashing");

// ────────────────────────────────────────────────────────────────────────────
// 9. Unit sanity: line builder + more-row html.
// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Unit sanity ─────────────────────────────────────────────────");
const lineHtml = sfarcBuildCodeLineHtml("public class Foo { String name = 'x'; }", 42, "Foo", /(Foo)/gi);
ok(lineHtml.includes('id="sfarc-code-line-42"'), "line builder emits the jump id");
ok(lineHtml.includes('color: #569cd6'), "keywords tokenized");
ok(lineHtml.includes('color: #ce9178'), "strings tokenized");
ok(lineHtml.includes("<mark"), "keyword highlighted");
const moreHtml = sfarcCodeMoreRowHtml("Show 100 more");
ok(moreHtml.includes("sfarc-code-more") && moreHtml.includes("Show 100 more"), "more-row html well-formed");

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
