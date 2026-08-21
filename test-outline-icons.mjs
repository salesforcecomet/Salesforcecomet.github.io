// Dev-only test — NOT part of the extension build.
//
// Verifies the command icon renderer uses filled SVGs inheriting the shared
// accent color, with a solid Font Awesome glyph fallback during early boot.
//
// Run:  node test-outline-icons.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");

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

// Extract sfarcOutlineIconHtml VERBATIM (brace-matched, strings/comments aware).
const fnStart = SRC.indexOf("function sfarcOutlineIconHtml(");
const fnEndAnchor = SRC.indexOf("window.sfarcOutlineIconHtml = sfarcOutlineIconHtml;");
if (fnStart < 0 || fnEndAnchor < 0) throw new Error("sfarcOutlineIconHtml not found in src/main.js");
let i = fnStart;
let depth = 0;
let inStr = null;
let end = -1;
for (; i < SRC.length && i < fnEndAnchor; i++) {
  const c = SRC[i];
  if (inStr) {
    if (c === "\\") { i++; continue; }
    if (c === inStr) inStr = null;
    continue;
  }
  if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
  if (c === "{" ) depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) throw new Error("unbalanced sfarcOutlineIconHtml");
const helperSource = SRC.slice(fnStart, end);

// Stubbed FontAwesome with a couple of real-shaped defs (w, h, aliases, unicode, path).
const fakeFA = {
  findIconDefinition: ({ iconName }) => {
    const map = {
      cloud: [640, 512, [], "", "M1 2L3 4"],
      bolt: [448, 512, [], "", "M5 6L7 8"],
      "file-export": [576, 512, [], "", "M9 10L11 12"]
    };
    return map[iconName] ? { icon: map[iconName] } : null;
  }
};
global.window = { FontAwesome: fakeFA };
// Module-scope eval keeps function declarations local — capture as an expression.
const sfarcOutlineIconHtml = eval(`(${helperSource})`);

// ────────────────────────────────────────────────────────────────────────────
console.log("── Filled SVG rendering ─────────────────────────────────────────");
const cloud = sfarcOutlineIconHtml("fa-cloud", 16);
ok(cloud.startsWith("<svg"), "known icon renders an <svg>", cloud.slice(0, 40));
ok(cloud.includes('viewBox="0 0 640 512"'), "viewBox uses the icon's native dimensions");
ok(cloud.includes('width="16"') && cloud.includes('height="16"'), "renders at the requested size");
ok(cloud.includes('fill="currentColor"') && !cloud.includes('stroke="currentColor"'), "filled style inherits currentColor");
ok(!cloud.includes('stroke-width='), "filled icon has no artificial outline width");
ok(cloud.includes('d="M1 2L3 4"'), "carries the icon's own path data");

const bolt = sfarcOutlineIconHtml("fa-bolt", 20);
ok(bolt.includes('viewBox="0 0 448 512"') && bolt.includes('fill="currentColor"'), "per-icon dimensions and fill are preserved");

// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Solid fallback ───────────────────────────────────────────────");
const unknown = sfarcOutlineIconHtml("fa-does-not-exist", 16);
ok(unknown.startsWith("<i class=\"fa-solid fa-does-not-exist\""), "unknown icon falls back to the solid glyph");
ok(sfarcOutlineIconHtml(null, 16).startsWith("<i class=\"fa-solid fa-circle-question\""), "null icon falls back gracefully");
ok(sfarcOutlineIconHtml(undefined, 16).startsWith("<i class=\"fa-solid fa-circle-question\""), "undefined icon falls back gracefully");

// FA not loaded at all (e.g. during early boot) -> solid fallback, no throw.
global.window = { FontAwesome: undefined };
try {
  const noFa = sfarcOutlineIconHtml("fa-cloud", 16);
  ok(noFa.startsWith("<i class=\"fa-solid fa-cloud\""), "FA missing -> solid fallback, no throw");
} catch (e) {
  ok(false, "FA missing -> solid fallback, no throw", e.message);
}
global.window = { FontAwesome: fakeFA };

// ────────────────────────────────────────────────────────────────────────────
console.log("\n── Source integrity (wiring) ────────────────────────────────────");
ok(SRC.includes("${sfarcOutlineIconHtml(cmd.icon, 16)}"), "renderCommands embeds the outline renderer for command icons");
ok(SRC.indexOf("fa-solid ${cmd.icon}") === -1 || !SRC.includes("                <i class=\"fa-solid ${cmd.icon}\"></i>"), "no leftover solid icon <i> in the command item markup");

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
