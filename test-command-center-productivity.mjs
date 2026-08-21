import fs from "node:fs";

const main = fs.readFileSync("src/main.js", "utf8");
const css = fs.readFileSync("src/inspector.css", "utf8");
const checks = [
  ["keyboard guidance is visible", /sfarc-search-keyboard-hints/.test(main) && /Navigate/.test(main) && /Open/.test(main)],
  ["commands can be pinned persistently", /sfarcPinnedCommands/.test(main) && /togglePinnedCommand/.test(main)],
  ["pinned commands sort first", /Number\(pinnedCommandIds\.has\(b\.id\)\)/.test(main)],
  ["pinned and all-command sections show counts", /sfarc-command-section-title/.test(main) && /sfarc-section-count/.test(main)],
  ["pin controls do not execute commands", /closest\('\.sfarc-command-pin'\)/.test(main)],
  ["selected command has an enter hint", /sfarc-command-enter-hint/.test(main) && /↵/.test(main)],
  ["command icons consistently use the configured accent", !/--sfarc-command-color/.test(main) && /\.sfarc-command-icon[\s\S]*color:\s*var\(--sfarc-accent/.test(css)],
  ["feature summaries use a fixed right-aligned column", /sfarc-command-item > \.sfarc-suggestion-category/.test(css) && /justify-content:\s*flex-end/.test(css) && /text-align:\s*right/.test(css)],
  ["review prompt can be dismissed", /sfarc-rb-dismiss-btn/.test(main) && /sfarcReviewPromptSnoozedUntil/.test(main)],
  ["list animation is short and capped", /Math\.min\(idx \* 0\.012, 0\.12\)/.test(main)],
  ["reduced motion is respected", /prefers-reduced-motion/.test(css)],
  ["responsive keyboard hints exist", /max-width: 1050px/.test(css)]
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { failed++; console.error("FAIL:", name); }
}
console.log(`${checks.length - failed}/${checks.length} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
