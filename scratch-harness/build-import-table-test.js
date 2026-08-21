const fs = require("fs");
const path = require("path");

// Same load order as src/data-import.html
const cssFiles = [
  "src/button.css",
  "src/data-load.css",
  "src/styles/slds/slds.css",
  "src/styles/sfir.css",
  "src/custom-dropdown.css",
  "src/data-import.css",
  "src/glass-toast.css",
  "src/controls.css"
];
const css = cssFiles
  .map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");

const stripExports = src => src.replace(/^export\s+/gm, "");
const dataLoad = stripExports(fs.readFileSync(path.join(__dirname, "..", "src/data-load.js"), "utf8"))
  .replace(/^import\s+.*$/gm, "");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Data Import Table Row Height Test</title>
<style>
  html, body { margin: 0; padding: 0; }
  body.sfarc-dark-theme { background: #0d1117; }
  #scroller { position: fixed; top: 0; left: 0; right: 0; height: 400px; overflow: auto; background: #151a22; }
</style>
<style>
${css}
</style>
</head>
<body class="sfarc-dark-theme">
<div id="scroller"></div>
<script>
function isRecordId(id) { return typeof id === "string" && /^[a-zA-Z0-9]{15,18}$/.test(id); }
${dataLoad}
const scroller = document.getElementById("scroller");
const st = initScrollTable(scroller);
const header = ["OBJECT", "ID", "NAME", "ACCOUNT", "ACCOUNT.ACTIVE__C", "CREATEDDATE", "LASTMODIFIEDDATE"];
const rows = [
  ["[Opportunity]", "006NS00000n3iUwYAI", "University of AZ SLA", "[Account]", "Yes", "2026-07-23T12:36:47.000+0000", "2026-07-23T12:36:47.000+0000"],
  ["[Opportunity]", "006NS00000n3il3YAA", "University of AZ Installations", "[Account]", "Yes", "2026-07-23T12:36:46.000+0000", "2026-07-23T12:36:46.000+0000"],
  ["[Opportunity]", "006NS00000n3ijRYAQ", "Express Logistics Portable Truck Generators", "[Account]", "Yes", "2026-07-23T12:36:42.000+0000", "2026-07-23T12:36:42.000+0000"]
];
st.dataChange({
  table: [header, ...rows],
  isTooling: false,
  describeInfo: null,
  sfHost: "test",
  rowVisibilities: rows.map(() => true),
  colVisibilities: header.map(() => true)
});
window.__measure = () => {
  const tds = document.querySelectorAll("#scroller .scrolltable-cell:not(.header)");
  const heights = [...new Set([...tds].map(td => Math.round(td.getBoundingClientRect().height)))];
  const first = document.querySelector("#scroller .scrolltable-cell:not(.header)");
  const cs = first ? getComputedStyle(first) : null;
  return {
    cellHeights: heights,
    padding: cs ? cs.padding : null,
    fontSize: cs ? cs.fontSize : null,
    lineHeight: cs ? cs.lineHeight : null,
    whiteSpace: cs ? cs.whiteSpace : null
  };
};
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "import-table-test.html"), html);
console.log("written:", html.length, "bytes");
