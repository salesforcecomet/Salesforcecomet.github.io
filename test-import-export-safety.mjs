await import("./test-import-stubs.mjs");
import {csvParse} from "./src/csv-parse.js";
import fs from "node:fs";

let checks = 0;
let failures = 0;
function check(name, condition) {
  checks++;
  if (!condition) {
    failures++;
    console.error("FAIL:", name);
  }
}

let malformedRejected = false;
try { csvParse('Name\n"unfinished'); } catch (_) { malformedRejected = true; }
check("malformed quoted CSV rejected", malformedRejected);

const Model = globalThis.__DataImportModel;
const model = new Model("acme.my.salesforce.com", new URLSearchParams());
model.setData("Name,Name\nA,B");
check("duplicate headers rejected", /Duplicate header/i.test(model.dataError));
model.setData("Name,Phone\nA,1\nB");
check("uneven rows rejected", /expected 2/i.test(model.dataError));

model.importAction = "create";
model.importData = {
  importTable: {
    header: [model.makeColumn("Name", 0), model.makeColumn("__Status", 1), model.makeColumn("__Errors", 2)],
    data: [["Acme", "Processing", ""]]
  },
  counts: {},
  taggedRows: null
};
model.reconcileInterruptedRows();
check("interrupted insert becomes uncertain", model.importData.importTable.data[0][1] === "Uncertain");
check("uncertain insert receives verification message", /verify/i.test(model.importData.importTable.data[0][2]));
model.destroy();

const exportSource = fs.readFileSync("src/data-export.js", "utf8");
check("export accumulation uses push", /rt\.records\.push\(\.\.\.expRecords\)/.test(exportSource));
check("Bulk API 2.0 query path implemented", /jobs\/query/.test(exportSource) && /doBulkExport/.test(exportSource));
check("large clipboard guard implemented", /canUseClipboardExport/.test(exportSource));
check("safe 200-row preview implemented", /onPreviewExport/.test(exportSource) && /Preview 200/.test(exportSource));
check("unlimited REST export requires confirmation", /Run an unlimited REST export/.test(exportSource));

const importSource = fs.readFileSync("src/data-import.js", "utf8");
check("file parsing can be cancelled", /Cancel parsing/.test(importSource) && /importParseWorker\.terminate/.test(importSource));
check("local import no longer has fixed 2.5 second delay", !/setTimeout\(this\.executeBatchLocal\.bind\(this\),\s*2500\)/.test(importSource));

console.log(`${checks - failures}/${checks} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
