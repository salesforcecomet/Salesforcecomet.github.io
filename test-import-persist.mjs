// Node-based test: Data Import state must survive a "page refresh"
// (a fresh Model with the same sfHost restores the saved snapshot).

import "./test-import-stubs.mjs";

const { default: mod } = await import("./src/data-import.js");
// data-import.js doesn't export anything, so pull Model via a side-channel.
// Instead: re-read the file? No — data-import.js has no exports, so we rely on
// a globals hook we install before import.
const Model = globalThis.__DataImportModel;

function freshModel(sfHost) {
  return new Model(sfHost, new URLSearchParams());
}

// ── 1. Paste data ─────────────────────────────────────────────────────────
const m1 = freshModel("acme.my.salesforce.com");
m1.setData([
  "OBJECT,ID,NAME",
  "[Account],001abc,Acme Corp",
  "[Account],001def,Globex"
].join("\n"));

const saved = JSON.parse(localStorage.getItem("sfarcImportData_acme.my.salesforce.com"));
if (!saved) { console.error("FAIL: nothing saved after setData"); process.exit(1); }
if (saved.data.length !== 2) { console.error("FAIL: expected 2 saved rows, got", saved.data.length); process.exit(1); }
if (saved.header[1].columnValue !== "ID") { console.error("FAIL: header not saved", saved.header); process.exit(1); }
console.log("PASS: setData persisted 2 rows,", saved.header.length, "columns");

// ── 2. Simulate refresh: fresh Model, same host ───────────────────────────
const m2 = freshModel("acme.my.salesforce.com");
if (!m2.importData || !m2.importData.importTable || m2.importData.importTable.data.length !== 2) {
  console.error("FAIL: restored model has no data", m2.importData);
  process.exit(1);
}
const rows2 = m2.importData.importTable.data;
if (rows2[0][2] !== "Acme Corp") { console.error("FAIL: row content wrong", rows2[0]); process.exit(1); }
const cols2 = m2.importData.importTable.header;
if (cols2[1].columnValue !== "ID") { console.error("FAIL: column mapping not restored", cols2[1]); process.exit(1); }
console.log("PASS: refresh restored 2 rows, headers, and mappings");

// ── 3. Mapping edit survives refresh ──────────────────────────────────────
const m3 = freshModel("acme.my.salesforce.com");
m3.importData.importTable.header[1].columnValue = "AccountId";
m3.persistImportData();
const m4 = freshModel("acme.my.salesforce.com");
if (m4.importData.importTable.header[1].columnValue !== "AccountId") {
  console.error("FAIL: mapping edit not restored", m4.importData.importTable.header[1]);
  process.exit(1);
}
console.log("PASS: mapping edit (AccountId) survived refresh");

// ── 4. Clear data removes the snapshot ────────────────────────────────────
const m5 = freshModel("acme.my.salesforce.com");
m5.updateResult(null);
if (localStorage.getItem("sfarcImportData_acme.my.salesforce.com") !== null) {
  console.error("FAIL: cleared data should remove snapshot");
  process.exit(1);
}
console.log("PASS: clearing data removes the saved snapshot");

// ── 5. Different org does not leak ────────────────────────────────────────
const m6 = freshModel("other.my.salesforce.com");
if (m6.importData && m6.importData.importTable) {
  console.error("FAIL: other org restored cross-org data");
  process.exit(1);
}
console.log("PASS: snapshots are scoped per org");

// Tear down: clear all timers so the process can exit cleanly.
for (const m of [m1, m2, m3, m4, m5, m6]) m.destroy();

console.log("\nALL TESTS PASSED");
