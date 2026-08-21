/* global React ReactDOM */
import { sfConn, apiVersion } from "./inspector.js";
import { getLinkTarget, nullToEmptyString, isOptionEnabled, PromptTemplate, Constants, UserInfoModel, createSpinForMethod, copyToClipboard, downloadCsvFile, StorageHistory } from "./utils.js";
import {csvParse} from "./csv-parse.js";
/* global initButton */
import { Enumerable, DescribeInfo, initScrollTable, s } from "./data-load.js";
import { PageHeader } from "./components/PageHeader.js";
import { getCaretCoordinates } from "./caret.js";

// Hosted inside sfir-shell.html (?sfirEmbed=1): the shell renders the ONE
// persistent top bar and paints THIS page's utility items (Templates select,
// Tooling/QueryAll toggles, Help) into that bar itself. This page renders
// body-only (no PageHeader, no strip) and pushes its utilities state up via
// postMessage; the shell forwards user actions back down.
const SFIR_EMBEDDED = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sfirEmbed") === "1";

// The mounted App instance, so the embed message bridge can drive it.
let activeExportApp = null;

function sfirPushUtilsState() {
  const app = activeExportApp;
  if (!app || !app.props || !app.props.model || !window.parent || window.parent === window) return;
  const m = app.props.model;
  const state = {
    templates: Array.isArray(m.queryTemplates) ? m.queryTemplates : [],
    queryTooling: !!m.queryTooling,
    queryAll: !!m.queryAll,
    exportApiMode: m.exportApiMode || "auto",
    incrementalEnabled: !!m.incrementalEnabled,
    selectedTemplate: m.selectedQueryTemplate || ""
  };
  const sig = JSON.stringify(state);
  if (sig === (window.__sfirLastUtilsPush || "")) return;
  window.__sfirLastUtilsPush = sig;
  try {
    window.parent.postMessage({ source: "sfir-embed", tab: "export", type: "sfirUtilsState", state }, "*");
  } catch (_) { /* no parent / cross-origin — ignore */ }
}

if (SFIR_EMBEDDED) {
  try { document.body.classList.add("sfir-embedded"); } catch (_) { /* body not ready */ }
  window.addEventListener("message", (e) => {
    if (e.origin && e.origin !== window.location.origin) return;
    const msg = e.data;
    if (!msg || typeof msg !== "object" || msg.source !== "sfir-shell") return;
    if (msg.type === "sfirUtilsRequest") { sfirPushUtilsState(); return; }
    if (msg.type !== "sfirUtilsAction") return;
    const app = activeExportApp;
    if (!app || !app.props || !app.props.model) return;
    const m = app.props.model;
    if (msg.action === "selectTemplate" && typeof msg.value === "string") {
      m.selectedQueryTemplate = msg.value;
      m.selectQueryTemplate();
      m.didUpdate();
    } else if (msg.action === "tooling") {
      m.queryTooling = !!msg.value;
      m.updateCurrentTabProperty("queryTooling", m.queryTooling);
      m.queryAutocompleteHandler();
      m.didUpdate();
    } else if (msg.action === "queryAll") {
      m.queryAll = !!msg.value;
      m.updateCurrentTabProperty("queryAll", m.queryAll);
      m.didUpdate();
    } else if (msg.action === "exportApiMode") {
      m.exportApiMode = ["auto", "rest", "bulk"].includes(msg.value) ? msg.value : "auto";
      localStorage.setItem("sfarcExportApiMode", m.exportApiMode);
      m.apiDecision = m.exportApiMode === "auto" ? "Auto will estimate volume before export" : `${m.exportApiMode === "bulk" ? "Bulk API 2.0" : "REST API"} selected manually`;
      m.didUpdate();
    } else if (msg.action === "incremental") {
      m.incrementalEnabled = !!msg.value;
      localStorage.setItem("sfarcIncrementalExport", String(m.incrementalEnabled));
      m.didUpdate();
    } else if (msg.action === "help" && app.onToggleHelp) {
      app.onToggleHelp();
    }
  });
}

// Remember the query-history drawer's dragged position across opens so it
// reopens where the user left it (null = launch centered on screen).
let historyDrawerLastPos = null;

const DATA_TYPES = [
  { key: "", label: "All Data Types" },
  { key: "string", label: "Text / String" },
  { key: "reference", label: "Lookup / Reference" },
  { key: "picklist", label: "Picklist" },
  { key: "multipicklist", label: "Multi-Select Picklist" },
  { key: "boolean", label: "Checkbox (Boolean)" },
  { key: "date", label: "Date / Time" },
  { key: "double", label: "Number / Currency" },
  { key: "textarea", label: "Text Area" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "url", label: "URL" },
  { key: "id", label: "ID" }
];

// Friendly labels for the per-pill datatype icon tooltip. Keys are the
// Salesforce describe `type` values surfaced through autocomplete results.
const DATA_TYPE_LABELS = {
  string: "Text",
  textarea: "Text Area",
  longtextarea: "Long Text Area",
  richtextarea: "Rich Text Area",
  html: "HTML",
  id: "ID",
  reference: "Lookup / Reference",
  masterrecord: "Master-Detail Relationship",
  externalLookup: "External Lookup",
  indirectLookup: "Indirect Lookup",
  picklist: "Picklist",
  multipicklist: "Multi-Select Picklist",
  combobox: "Combobox",
  boolean: "Checkbox (Boolean)",
  number: "Number",
  double: "Number / Currency",
  int: "Number",
  long: "Number",
  currency: "Currency",
  percent: "Percent",
  date: "Date",
  datetime: "Date / Time",
  time: "Time",
  email: "Email",
  phone: "Phone",
  url: "URL",
  base64: "Base64",
  anyType: "Any Type",
  location: "Location",
  address: "Address",
  encryptedstring: "Encrypted Text",
  recordType: "Record Type",
  complexvalue: "Complex Value",
  blob: "Blob",
  autonumber: "Auto Number",
  formula: "Formula",
  calculated: "Formula",
  junctionIdList: "Junction ID List"
};

const AUTOCOMPLETE_TYPE_LABELS = {
  object: "SObject",
  relationshipName: "Relationship",
  variable: "Variable",
  fieldName: "Field",
  null: "Null",
  picklistValue: "Picklist Value"
};

// Tooltip text for a suggestion pill's type icon: the datatype when the
// result is a field, otherwise a humanized label for the autocomplete kind.
function suggestionTooltip(r) {
  if (!r) return "Field";
  if (r.dataType && DATA_TYPE_LABELS[r.dataType]) return DATA_TYPE_LABELS[r.dataType];
  if (r.dataType) return r.dataType;
  if (r.autocompleteType && AUTOCOMPLETE_TYPE_LABELS[r.autocompleteType]) return AUTOCOMPLETE_TYPE_LABELS[r.autocompleteType];
  return r.autocompleteType || "Field";
}

function createQueryHistory(storageKey, max) {
  const isSaved = storageKey === "insextSavedQueryHistory";
  return new StorageHistory(storageKey, max, {
    isValidEntry: (e) => typeof e === "object",
    matchAdd: (e, ent) => e.query === ent.query && e.useToolingApi === ent.useToolingApi,
    matchRemove: (e, ent) => e.query === ent.query && e.useToolingApi === ent.useToolingApi,
    sortComparator: isSaved ? (a, b) => (a.query > b.query ? 1 : b.query > a.query ? -1 : 0) : null,
    addToFront: true
  });
}

// --- Binary OpenXML XLSX Zip Builder for genuine Multi-Tab Excel (.xlsx) files ---
function crc32Table() {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}
const CRC32_TABLE = crc32Table();

function calcCrc32(data) {
  let bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

class SimpleZip {
  constructor() {
    this.files = [];
  }
  addFile(name, content) {
    let data = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
    let crc = calcCrc32(data);
    this.files.push({ name, data, crc, size: data.length });
  }
  generateBlob() {
    let parts = [];
    let centralDirectory = [];
    let offset = 0;

    for (let file of this.files) {
      let nameBytes = new TextEncoder().encode(file.name);

      let header = new Uint8Array(30 + nameBytes.length);
      let view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, file.crc, true);
      view.setUint32(18, file.size, true);
      view.setUint32(22, file.size, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(nameBytes, 30);

      parts.push(header);
      parts.push(file.data);

      let cdHeader = new Uint8Array(46 + nameBytes.length);
      let cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, file.crc, true);
      cdView.setUint32(20, file.size, true);
      cdView.setUint32(24, file.size, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      cdHeader.set(nameBytes, 46);

      centralDirectory.push(cdHeader);
      offset += header.length + file.size;
    }

    let cdOffset = offset;
    let cdSize = 0;
    for (let cd of centralDirectory) {
      parts.push(cd);
      cdSize += cd.length;
    }

    let eocd = new Uint8Array(22);
    let eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, this.files.length, true);
    eocdView.setUint16(10, this.files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);

    parts.push(eocd);

    return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

function toColName(col) {
  let name = "";
  col = Math.floor(col);
  while (col >= 0) {
    name = String.fromCharCode((col % 26) + 65) + name;
    col = Math.floor(col / 26) - 1;
  }
  return name;
}

function buildXlsxBlob(sheets) {
  const zip = new SimpleZip();

  const escapeXml = (str) => {
    if (str == null) return "";
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  contentTypesXml += `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n`;
  contentTypesXml += `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n`;
  contentTypesXml += `  <Default Extension="xml" ContentType="application/xml"/>\n`;
  contentTypesXml += `  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n`;
  sheets.forEach((_, i) => {
    contentTypesXml += `  <Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
  });
  contentTypesXml += `</Types>`;
  zip.addFile("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  let mainRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  mainRelsXml += `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
  mainRelsXml += `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n`;
  mainRelsXml += `</Relationships>`;
  zip.addFile("_rels/.rels", mainRelsXml);

  // 3. xl/workbook.xml
  let workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  workbookXml += `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n`;
  workbookXml += `  <sheets>\n`;
  sheets.forEach((sheet, i) => {
    workbookXml += `    <sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>\n`;
  });
  workbookXml += `  </sheets>\n`;
  workbookXml += `</workbook>`;
  zip.addFile("xl/workbook.xml", workbookXml);

  // 4. xl/_rels/workbook.xml.rels
  let wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  wbRelsXml += `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
  sheets.forEach((_, i) => {
    wbRelsXml += `  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>\n`;
  });
  wbRelsXml += `</Relationships>`;
  zip.addFile("xl/_rels/workbook.xml.rels", wbRelsXml);

  // 5. xl/worksheets/sheet1.xml, sheet2.xml, etc.
  sheets.forEach((sheet, i) => {
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    sheetXml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;
    sheetXml += `  <sheetData>\n`;

    // Row 1: Headers
    sheetXml += `    <row r="1">\n`;
    sheet.headers.forEach((h, colIdx) => {
      sheetXml += `      <c r="${toColName(colIdx)}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>\n`;
    });
    sheetXml += `    </row>\n`;

    // Data Rows
    sheet.rows.forEach((row, rowIdx) => {
      let rNum = rowIdx + 2;
      sheetXml += `    <row r="${rNum}">\n`;
      row.forEach((val, colIdx) => {
        if (val != null && val !== "") {
          let cellRef = `${toColName(colIdx)}${rNum}`;
          if (typeof val === "number") {
            sheetXml += `      <c r="${cellRef}"><v>${val}</v></c>\n`;
          } else {
            sheetXml += `      <c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>\n`;
          }
        }
      });
      sheetXml += `    </row>\n`;
    });

    sheetXml += `  </sheetData>\n`;
    sheetXml += `</worksheet>`;
    zip.addFile(`xl/worksheets/sheet${i + 1}.xml`, sheetXml);
  });

  return zip.generateBlob();
}

class Model {
  static QUERY_TAB_PREFIX = "Query";

  constructor({ sfHost, args }) {
    this.sfHost = sfHost;
    this.customFaviconColor = localStorage.getItem(this.sfHost + "_customFavicon") || "";
    this.orgName = (this.sfHost || "").split(".")[0]?.toUpperCase() || "";
    this.queryInput = null;
    this.filterColumn = ""; // Default filter column
    this.initialQuery = "";
    this.spinnerCount = 0;

    // Initialize spinFor method early - needed by describeInfo and userInfoModel
    this.spinFor = createSpinForMethod(this);

    // Create a silent spinner for background metadata fetches — these should NOT
    // increment spinnerCount (which shows the header loading indicator).
    // The describe info updates via the didUpdate callback instead.
    const silentSpinFor = promise => promise.catch(() => { });

    this.describeInfo = new DescribeInfo(silentSpinFor, () => {
      this.expandAutocomplete = true;
      this.queryAutocompleteHandler({ newDescribe: true });
      this.didUpdate();
    });
    this.showHelp = false;
    this.winInnerHeight = 0;
    this.queryAll = localStorage.getItem("sfarcDefaultQueryAll") === "true";
    this.maxQueryRecords = Math.max(100, Math.min(50000, Number(localStorage.getItem("sfarcMaxQueryRecords")) || 10000));
    this.queryTooling = false;
    this.exportApiMode = localStorage.getItem("sfarcExportApiMode") || "auto";
    this.resolvedApiMode = null;
    this.apiDecision = "Auto will estimate volume before export";
    this.incrementalEnabled = localStorage.getItem("sfarcIncrementalExport") === "true";
    this.incrementalObject = "";
    this.incrementalCheckpoint = "";
    this.prefHideRelations = localStorage.getItem("hideObjectNameColumnsDataExport") == "true"; // default to false
    this.prefPreventLineWrap = localStorage.getItem("preventLineWrapDataExport") !== "false"; // default to true (matches v1.27 behavior)
    this.autocompleteResults = { sobjectName: "", title: "\u00A0", results: [] };
    this.autocompleteClick = null;
    this.isWorking = false;
    this.exportStatus = "Ready";
    this.exportError = null;
    this.exportedData = null;
    let historyNb = localStorage.getItem("numberOfQueriesInHistory");
    this.queryHistory = createQueryHistory("insextQueryHistory", historyNb ? historyNb : 100);
    this.selectedHistoryEntry = null;
    let savedNb = localStorage.getItem("numberOfQueriesSaved");
    this.savedHistory = createQueryHistory("insextSavedQueryHistory", savedNb ? savedNb : 50);
    this.selectedSavedEntry = null;
    this.expandAutocomplete = false;
    this.expandSavedOptions = false;
    this.resultsFilter = "";
    this.displayPerformance = localStorage.getItem("displayQueryPerformance") !== "false"; // default to true
    this.performancePoints = [];
    this.startTime = null;
    this.lastStartTime = null;
    this.totalTime = 0;
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.exportProgress = {};
    this.queryName = "";
    this.queryTemplates = localStorage.getItem("queryTemplates") ? localStorage.getItem("queryTemplates").split("//") : [
      "SELECT Id FROM ",
      'FIND {""}\nIN Name Fields\nRETURNING Contact(Name, Phone)',
      "{\n\tuiapi {\n\t\tquery {\n\t\t\tContact {\n\t\t\t\tedges {\n\t\t\t\t\t node {\n\t\t\t\t\t\tId\n\t\t\t\t\t\tName { value }\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}",
      "SELECT Id FROM WHERE",
      "SELECT Id FROM WHERE IN",
      "SELECT Id FROM WHERE LIKE",
      "SELECT Id FROM WHERE ORDER BY"
    ];
    this.separator = getSeparator();
    this.soqlPrompt = "";
    this.enableQueryTypoFix = localStorage.getItem("enableQueryTypoFix") == "true";

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    let queryFromUrl = false;
    if (args.has("query")) {
      this.initialQuery = args.get("query");
      this.queryTooling = args.has("useToolingApi");
      queryFromUrl = true;
    } else if (args.has("sobject") && args.has("listView")) {
      const sobj = args.get("sobject");
      const lvLocator = args.get("listView");
      this.initialQuery = `SELECT Id FROM ${sobj} LIMIT 200`;
      this.queryTooling = false;
      queryFromUrl = true;
      sfConn.getSession(this.sfHost).then(() => {
        sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "describeSObject", { sObjectType: sobj }).catch(() => { });
        sfConn.rest(`/services/data/v${apiVersion}/sobjects/${sobj}/listviews/${lvLocator}/describe`)
          .then(res => {
            if (res && res.query) {
              if (this.queryInput) {
                this.queryInput.value = res.query;
                this.queryAutocompleteHandler();
              } else {
                this.initialQuery = res.query;
              }
            }
          })
          .catch(err => {
            console.warn("Failed to describe List View:", err);
          });
      });
    } else if (this.queryHistory.list[0]) {
      this.initialQuery = this.queryHistory.list[0].query;
      this.queryTooling = this.queryHistory.list[0].useToolingApi;
    } else {
      this.initialQuery = "SELECT Id FROM Account LIMIT 200";
      this.queryTooling = false;
    }

    if (args.has("error")) {
      this.exportError = args.get("error") + " " + args.get("error_description");
    }

    this.queryTabs = [];
    this.activeTabIndex = 0;
    this.loadQueryTabs(queryFromUrl);
  }

  downloadAsCsv() {
    const csvContent = this.exportedData.csvSerialize(this.separator);
    const objectType = this.exportedData.records.length > 0 && this.exportedData.records[0].attributes
      ? this.exportedData.records[0].attributes.type
      : "export";
    const incomplete = !!this.exportError || (this.exportedData.totalSize >= 0 && this.exportedData.records.length !== this.exportedData.totalSize);
    const filename = `${objectType}-${incomplete ? "incomplete-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvFile(csvContent, filename);
  }

  updatedExportedData() {
    if (this.exportedData) {
      this.exportedData.updateColumnsVisibility();
    }
    this.publishExportProgress();
    this.resultTableCallback(this.exportedData);
  }

  // Publish live export progress to the global top progress bar so the user
  // can switch tabs while the query runs and still watch it from any page.
  publishExportProgress() {
    if (!window.__sfirTopProgress) return;
    const data = this.exportedData;
    if (!this.isWorking) {
      if (this._wasPublishingExport) {
        this._wasPublishingExport = false;
        window.__sfirTopProgress.set({ running: false });
      }
      return;
    }
    this._wasPublishingExport = true;
    const done = data ? data.records.length : 0;
    const total = data && data.totalSize > 0 ? data.totalSize : done;
    const type = data && data.records[0] && data.records[0].attributes ? data.records[0].attributes.type : 'records';
    window.__sfirTopProgress.set({
      running: true,
      page: 'data-export',
      label: 'Exporting ' + type + '…',
      percent: total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0,
      counts: { done, total }
    });
  }
  setResultsFilter(value) {
    this.resultsFilter = value;
    if (this.exportedData == null) {
      return;
    }
    // Recalculate visibility
    this.exportedData.updateVisibility();
    this.updatedExportedData();
  }
  setQueryMethod(data, query, vm) {
    let method;
    let queryParams = "/?q=" + encodeURIComponent(query);
    const baseParams = { progressHandler: vm.exportProgress, useCache: false };
    let params = baseParams;

    if (data.isTooling) {
      method = "tooling/query";
    } else if (this.queryAll) {
      method = "queryAll";
    } else if (this.queryInput.value.toLowerCase().startsWith("find")) {
      method = "search";
    } else if (this.queryInput.value.trim().startsWith("{")) {
      method = "graphql";
      queryParams = "";
      params = { ...baseParams, method: "POST", body: { "query": "query objects " + query } };
    } else {
      method = "query";
    }
    data.endpoint = "/services/data/v" + apiVersion + "/" + method + queryParams;
    data.params = params;
    data.queryMethod = method;
  }
  setQueryName(value) {
    this.queryName = value;
  }
  setQueryInput(queryInput) {
    this.queryInput = queryInput;
    queryInput.value = this.initialQuery;
    this.initialQuery = null;
  }
  toggleHelp() {
    this.showHelp = !this.showHelp;
  }
  toggleExpand() {
    this.expandAutocomplete = !this.expandAutocomplete;
  }
  toggleSavedOptions() {
    this.expandSavedOptions = !this.expandSavedOptions;
  }
  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.autocompleteResults.sobjectName);
    if (this.queryTooling) {
      args.set("useToolingApi", "1");
    }
    return (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("src/record-viewer.html?" + args) : ("record-viewer.html?" + args);
  }
  selectHistoryEntry() {
    if (this.selectedHistoryEntry != null) {
      this.queryInput.value = this.selectedHistoryEntry.query;
      this.queryTooling = this.selectedHistoryEntry.useToolingApi;
      this.queryAutocompleteHandler();
      this.selectedHistoryEntry = null;
    }
  }
  selectQueryTemplate() {
    this.queryInput.value = this.selectedQueryTemplate.trimStart();
    this.queryInput.focus();
    let indexPos = this.queryInput.value.toLowerCase().indexOf("from ");
    if (indexPos !== -1) {
      this.queryInput.setRangeText("", indexPos + 5, indexPos + 5, "end");
    }
  }
  initPerf() {
    if (!this.displayPerformance) {
      return;
    }
    this.performancePoints = [];
    this.startTime = performance.now();
    this.lastStartTime = this.startTime;
  }
  markPerf() {
    if (!this.displayPerformance) {
      return;
    }
    const now = performance.now();
    const perfPoint = now - this.lastStartTime;
    this.lastStartTime = now;
    this.performancePoints.push(perfPoint);
    this.totalTime = now - this.startTime;
  }
  perfStatus() {
    if (!this.displayPerformance || !this.startTime || this.performancePoints.length === 0) {
      return null;
    }
    const batches = this.performancePoints.length;
    let batchStats = "";
    let batchCount = "";
    if (batches > 1) {
      const avgTime = this.performancePoints.reduce((a, b) => a + b, 0) / batches;
      const maxTime = Math.max(...this.performancePoints);
      const minTime = Math.min(...this.performancePoints);
      const avg = `Avg ${avgTime.toFixed(1)}ms`;
      const max = `Max ${maxTime.toFixed(1)}ms`;
      const min = `Min ${minTime.toFixed(1)}ms`;
      batchStats = `Batch Performance: ${avg}, ${min}, ${max}`;
      batchCount = `${batches} Batches / `;
    }
    let text = `${batchCount}${this.totalTime.toFixed(1)}ms`;
    // Once every batch has finished, surface the grand total of loaded records.
    const records = this.exportedData && this.exportedData.records ? this.exportedData.records.length : 0;
    if (!this.isWorking && records > 0) {
      text += ` · ${records.toLocaleString()} records`;
    }
    return { text, batchStats };
  }
  clearHistory() {
    this.queryHistory.clear();
  }
  selectSavedEntry() {
    let delimiter = ":";
    if (this.selectedSavedEntry != null) {
      let queryStr = "";
      if (this.selectedSavedEntry.query.includes(delimiter) && (this.selectedSavedEntry.query.toLowerCase().indexOf(":select") >= 0 || this.selectedSavedEntry.query.toLowerCase().indexOf(":find") >= 0)) {
        let query = this.selectedSavedEntry.query.split(delimiter);
        this.queryName = query[0];
        queryStr = this.selectedSavedEntry.query.substring(this.selectedSavedEntry.query.indexOf(delimiter) + 1);
      } else {
        queryStr = this.selectedSavedEntry.query;
      }
      this.queryInput.value = queryStr;
      this.queryTooling = this.selectedSavedEntry.useToolingApi;
      this.queryAutocompleteHandler();
      this.selectedSavedEntry = null;
    }
  }
  clearSavedHistory() {
    this.savedHistory.clear();
  }
  addToHistory() {
    this.savedHistory.add({ query: this.getQueryToSave(), useToolingApi: this.queryTooling });
  }
  removeFromHistory() {
    this.savedHistory.remove({ query: this.getQueryToSave(), useToolingApi: this.queryTooling });
  }
  getQueryToSave() {
    return this.queryName != "" ? this.queryName + ":" + this.queryInput.value.trim() : this.queryInput.value.trim();
  }
  autocompleteReload() {
    this.describeInfo.reloadAll();
  }
  canCopy() {
    return this.exportedData != null;
  }
  canDelete() {
    //In order to allow deletion, we should have at least 1 element and the Id field should have been included in the query
    return this.exportedData
      && (this.exportedData.countOfVisibleRecords === null /* no filtering has been done yet*/ || this.exportedData.countOfVisibleRecords > 0)
      && this.exportedData.records.length < 20001 && !this.exportStatus.includes("Exporting") && this.exportedData?.table?.at(0)?.find(header => header.toLowerCase() === "id");
  }
  copyAsExcel() {
    if (!this.canUseClipboardExport()) return;
    copyToClipboard(this.exportedData.csvSerialize("\t"));
  }
  copyAsCsv() {
    if (!this.canUseClipboardExport()) return;
    copyToClipboard(this.exportedData.csvSerialize(this.separator));
  }
  copyAsJson() {
    if (!this.canUseClipboardExport()) return;
    copyToClipboard(JSON.stringify(this.exportedData.records, null, "  "));
  }
  copyAsXml() {
    if (!this.canUseClipboardExport()) return;
    const table = this.exportedData.getVisibleTable();
    if (!table || table.length === 0) return;
    const header = table[0];
    const escapeXml = (value) => {
      const str = value === null || value === undefined ? "" : String(value);
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };
    const rowsXml = table.slice(1).map((row) =>
      "  <row>\n" +
      header.map((col, i) => `    <${col}>${escapeXml(row[i])}</${col}>`).join("\n") +
      "\n  </row>"
    ).join("\n");
    copyToClipboard(`<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rowsXml}\n</records>`);
  }
  canUseClipboardExport() {
    const count = this.exportedData && this.exportedData.records ? this.exportedData.records.length : 0;
    if (count <= 10000) return true;
    const message = `Clipboard export is disabled for ${count.toLocaleString()} records to prevent the page from freezing. Download CSV instead.`;
    if (typeof toast !== "undefined" && toast.warning) toast.warning(message);
    else this.exportError = message;
    this.didUpdate();
    return false;
  }
  hasSubqueries() {
    if (!this.exportedData || !this.exportedData.records || this.exportedData.records.length === 0) {
      return false;
    }
    for (const rec of this.exportedData.records) {
      for (const key of Object.keys(rec)) {
        if (key === "attributes") continue;
        const val = rec[key];
        if (val && typeof val === "object" && Array.isArray(val.records)) {
          return true;
        }
      }
    }
    return false;
  }

  downloadMultiTabExcel() {
    if (!this.exportedData || !this.exportedData.records || this.exportedData.records.length === 0) {
      if (typeof toast !== "undefined" && toast.warning) toast.warning("No exported data available for Multi-Tab Excel.");
      return;
    }

    const records = this.exportedData.records;
    const parentType = records[0].attributes && records[0].attributes.type
      ? records[0].attributes.type
      : "Export";

    // 1. Discover all subquery relationship keys
    const subqueryKeys = new Set();
    records.forEach(rec => {
      Object.keys(rec).forEach(key => {
        if (key === "attributes") return;
        const val = rec[key];
        if (val && typeof val === "object" && Array.isArray(val.records)) {
          subqueryKeys.add(key);
        }
      });
    });

    // Helper: Extract primitive fields recursively
    const extractPrimitiveFields = (obj, prefix = "") => {
      let fields = {};
      for (const key of Object.keys(obj)) {
        if (key === "attributes") continue;
        const val = obj[key];
        if (val && typeof val === "object") {
          if (Array.isArray(val.records)) {
            continue; // Skip subquery arrays for primitive fields extraction
          }
          if ("street" in val || "city" in val || "state" in val || "postalCode" in val || "country" in val) {
            const addr = [val.street, val.city, val.state, val.postalCode, val.country]
              .map(v => v ? String(v).trim() : "")
              .filter(Boolean)
              .join(", ");
            fields[prefix + key] = addr;
          } else if ("latitude" in val && "longitude" in val) {
            fields[prefix + key] = `Lat: ${val.latitude}, Lon: ${val.longitude}`;
          } else {
            Object.assign(fields, extractPrimitiveFields(val, prefix + key + "."));
          }
        } else {
          fields[prefix + key] = val;
        }
      }
      return fields;
    };

    const sanitizeSheetName = (name) => {
      let clean = String(name).replace(/[\\/*?:\[\]]/g, "_").trim();
      return clean.length > 31 ? clean.substring(0, 31) : (clean || "Sheet");
    };

    const sheets = [];

    // --- SHEET 1: Parent Sheet ---
    const parentHeadersSet = new Set();
    const parentFlatRecords = records.map(rec => {
      const flat = extractPrimitiveFields(rec);
      Object.keys(flat).forEach(k => parentHeadersSet.add(k));
      return flat;
    });
    const parentHeaders = Array.from(parentHeadersSet);

    const parentRows = parentFlatRecords.map(flat => {
      return parentHeaders.map(h => flat[h]);
    });

    sheets.push({
      name: sanitizeSheetName(parentType),
      headers: parentHeaders,
      rows: parentRows
    });

    // --- SHEETS 2...N: Subquery Child Sheets ---
    subqueryKeys.forEach(relKey => {
      const childHeadersSet = new Set();
      const parentIdHeader = `${parentType}.Id`;
      const parentNameHeader = `${parentType}.Name`;

      childHeadersSet.add(parentIdHeader);
      const parentHasName = records.some(r => r.Name !== undefined);
      if (parentHasName) {
        childHeadersSet.add(parentNameHeader);
      }

      const childRows = [];

      records.forEach(parentRec => {
        const parentId = parentRec.Id || "";
        const parentName = parentRec.Name || "";
        const subqueryObj = parentRec[relKey];

        if (subqueryObj && Array.isArray(subqueryObj.records)) {
          subqueryObj.records.forEach(childRec => {
            const childFlat = extractPrimitiveFields(childRec);
            Object.keys(childFlat).forEach(k => childHeadersSet.add(k));

            const rowMap = {
              [parentIdHeader]: parentId,
              ...(parentHasName ? { [parentNameHeader]: parentName } : {}),
              ...childFlat
            };

            childRows.push(rowMap);
          });
        }
      });

      const childHeaders = Array.from(childHeadersSet);
      const childDataRows = childRows.map(flat => {
        return childHeaders.map(h => flat[h]);
      });

      sheets.push({
        name: sanitizeSheetName(relKey),
        headers: childHeaders,
        rows: childDataRows
      });
    });

    // --- Generate Genuine Binary .xlsx File ---
    const filename = `${parentType}-MultiTab-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const blob = buildXlsxBlob(sheets);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  deleteRecords(e) {
    let data = this.exportedData.csvSerialize(this.separator);
    let encodedData = btoa(unescape(encodeURIComponent(data)));

    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("data", encodedData);

    const objectType = this.exportedData.records.length > 0 && this.exportedData.records[0].attributes
      ? this.exportedData.records[0].attributes.type
      : null;
    if (objectType) {
      args.set("sobject", objectType);
    }

    if (this.queryTooling) args.set("apitype", "Tooling");

    window.open("data-import.html?" + args, getLinkTarget(e, false));
  }
  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }
  /**
   * SOQL query autocomplete handling.
   * Put caret at the end of a word or select some text to autocomplete it.
   * Searches for both label and API name.
   * Autocompletes sobject names after the "from" keyword.
   * Autocompletes field names, if the "from" keyword exists followed by a valid object name.
   * Supports relationship fields.
   * Autocompletes field values (picklist values, date constants, boolean values).
   * Autocompletes any textual field value by performing a Salesforce API query when Ctrl+Space is pressed.
   * Inserts all autocomplete field suggestions when Ctrl+Space is pressed.
   * Supports subqueries in where clauses, but not in select clauses.
   */
  /**
   * SOQL query autocomplete handling.
   * Put caret at the end of a word or select some text to autocomplete it.
   * Searches for both label and API name.
   * Autocompletes sobject names after the "from" keyword.
   * Autocompletes field names, if the "from" keyword exists followed by a valid object name.
   * Supports relationship fields.
   * Autocompletes field values (picklist values, date constants, boolean values).
   * Autocompletes any textual field value by performing a Salesforce API query when Ctrl+Space is pressed.
   * Inserts all autocomplete field suggestions when Ctrl+Space is pressed.
   * Supports subqueries in where clauses, but not in select clauses.
   */
  queryAutocompleteHandler(e = {}) {
    let vm = this; // eslint-disable-line consistent-this
    let useToolingApi = vm.queryTooling;
    let query = vm.queryInput.value;
    let selStart = vm.queryInput.selectionStart;
    let selEnd = vm.queryInput.selectionEnd;
    let ctrlSpace = e.ctrlSpace;

    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    let newAutocompleteState = [useToolingApi, query, selStart, selEnd].join("$");
    if (newAutocompleteState == vm.autocompleteState && !ctrlSpace && !e.newDescribe) {
      return;
    }
    vm.autocompleteState = newAutocompleteState;

    // Cancel any async operation since its results will no longer be relevant.
    if (vm.autocompleteProgress.abort) {
      vm.autocompleteProgress.abort();
    }

    vm.autocompleteClick = ({ value, suffix, link }) => {
      if (link) {
        window.open(link, "_blank");
      } else {
        vm.queryInput.focus();
        // handle existing commas after selection. Unconditionally add a comma otherwise.
        let textAfter = query.substring(selEnd);
        if (suffix && suffix.trim() == ",") {
          if (textAfter.trim().startsWith(",")) {
            suffix = "";
          } else {
            suffix = ", ";
          }
        }
        vm.queryInput.setRangeText(value + suffix, selStart, selEnd, "end");
        //add query suffix if needed
        if (value.startsWith("FIELDS") && !query.toLowerCase().includes("limit")) {
          vm.queryInput.value += " LIMIT 200";
        }
        // Persist the updated query to the current tab
        vm.updateCurrentTabQuery(vm.queryInput.value);
        vm.queryAutocompleteHandler();
      }
    };

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    let searchTerm = selStart != selEnd
      ? query.substring(selStart, selEnd)
      : query.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    function sortRank({ value, title }) {
      let i = 0;
      if (value.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (title.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (value.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (title.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (value.toLowerCase().includes("__" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (value.toLowerCase().includes("_" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (title.toLowerCase().includes(" " + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      return i;
    }
    function resultsSort(a, b) {
      return sortRank(a) - sortRank(b) || a.rank - b.rank || a.value.localeCompare(b.value);
    }

    // If we are just after the "from" keyword, autocomplete the sobject name
    if (query.substring(0, selStart).match(/(^|\s)from\s*$/i)) {
      let { globalStatus, globalDescribe } = vm.describeInfo.describeGlobal(useToolingApi);
      if (!globalDescribe) {
        switch (globalStatus) {
          case "loading":
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Loading metadata...",
              results: []
            };
            return;
          case "loadfailed":
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Loading metadata failed.",
              results: [{ value: "Retry", title: "Retry" }]
            };
            vm.autocompleteClick = vm.autocompleteReload.bind(vm);
            return;
          default:
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Unexpected error: " + globalStatus,
              results: []
            };
            return;
        }
      }
      vm.autocompleteResults = {
        sobjectName: "",
        title: "OBJECTS SUGGESTIONS:",
        results: new Enumerable(globalDescribe.sobjects)
          .filter(sobjectDescribe => sobjectDescribe.name.toLowerCase().includes(searchTerm.toLowerCase()) || sobjectDescribe.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(sobjectDescribe => ({ value: sobjectDescribe.name, title: sobjectDescribe.label, suffix: " ", rank: 1, autocompleteType: "object", dataType: "" }))
          .toArray()
          .sort(resultsSort)
      };
      return;
    }

    let sobjectName, isAfterFrom;
    // Find out what sobject we are querying, by using the word after the "from" keyword.
    // Assuming no subqueries in the select clause, we should find the correct sobjectName. There should be only one "from" keyword, and strings (which may contain the word "from") are only allowed after the real "from" keyword.
    let fromKeywordMatch = /(^|\s)from\s+([a-z0-9_]*)/i.exec(query);
    let findKeywordMatch = /(^|\s)find\s+([a-z0-9_]*)/i.exec(query);
    let graphKeywordMatch = /(^|\s)uiapi\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch) {
      sobjectName = fromKeywordMatch[2];
      isAfterFrom = selStart > fromKeywordMatch.index + 1;
    } else {
      // We still want to find the from keyword if the user is typing just before the keyword, and there is no space.
      fromKeywordMatch = /^from\s+([a-z0-9_]*)/i.exec(query.substring(selEnd));
      if (fromKeywordMatch) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = false;
      } else {
        let title = findKeywordMatch || graphKeywordMatch ? "" : "\"from\" keyword not found";
        vm.autocompleteResults = {
          sobjectName: "",
          title,
          results: []
        };
        return;
      }
    }
    // If we are in a subquery, try to detect that.
    fromKeywordMatch = /\(\s*select.*\sfrom\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch && fromKeywordMatch.index < selStart) {
      let subQuery = query.substring(fromKeywordMatch.index, selStart);
      // Try to detect if the subquery ends before the selection
      if (subQuery.split(")").length < subQuery.split("(").length) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = selStart > fromKeywordMatch.index + fromKeywordMatch[0].length;
      }
    }
    vm.updateCurrentTabName(sobjectName);
    let { sobjectStatus, sobjectDescribe } = vm.describeInfo.describeSobject(useToolingApi, sobjectName);
    if (!sobjectDescribe) {
      switch (sobjectStatus) {
        case "loading":
          vm.autocompleteResults = {
            sobjectName,
            title: "Loading " + sobjectName + " metadata...",
            results: []
          };
          return;
        case "loadfailed":
          vm.autocompleteResults = {
            sobjectName,
            title: "Loading " + sobjectName + " metadata failed.",
            results: [{ value: "Retry", title: "Retry" }]
          };
          vm.autocompleteClick = vm.autocompleteReload.bind(vm);
          return;
        case "notfound":
          vm.autocompleteResults = {
            sobjectName,
            title: "Unknown object: " + sobjectName,
            results: []
          };
          return;
        default:
          vm.autocompleteResults = {
            sobjectName,
            title: "Unexpected error for object: " + sobjectName + ": " + sobjectStatus,
            results: []
          };
          return;
      }
    }

    /*
     * The context of a field is used to support queries on relationship fields.
     *
     * For example: If the cursor is at the end of the query "select Id from Contact where Account.Owner.Usern"
     * then the the searchTerm we want to autocomplete is "Usern", the contextPath is "Account.Owner." and the sobjectName is "Contact"
     *
     * When autocompleting field values in the query "select Id from Contact where Account.Type = 'Cus"
     * then the searchTerm we want to autocomplete is "Cus", the fieldName is "Type", the contextPath is "Account." and the sobjectName is "Contact"
     */

    let contextEnd = selStart;

    // If we are on the right hand side of a comparison operator, autocomplete field values
    let isFieldValue = query.substring(0, selStart).match(/\s*[<>=!]+\s*('?[^'\s]*)$/);

    // In clause on picklist field
    let isInWithValues = query.substring(0, selStart).match(/\s*in\s*\(\s*(?:(?:'[^']*'\s*,\s*)+|')('?[^'\s]*)$/i);
    let inValuesUtilized = "";
    if (isInWithValues) {
      if (isInWithValues[0] && isInWithValues[0].match(/\s*in\s*\(\s*(?:')$/i)) { // extra single quote
        selStart -= 1;
        isInWithValues[0] = isInWithValues[0].substring(0, isInWithValues[0].length - 1);
      }
      isFieldValue = isInWithValues;
      inValuesUtilized = isInWithValues[0].toLowerCase();
    }

    let fieldName = null;
    if (isFieldValue) {
      let fieldEnd = selStart - isFieldValue[0].length;
      fieldName = query.substring(0, fieldEnd).match(/[a-zA-Z0-9_]*$/)[0];
      contextEnd = fieldEnd - fieldName.length;
      selStart -= isFieldValue[1].length;
    }

    /*
    contextSobjectDescribes is a set of describe results for the relevant context sobjects.
    Example: "select Subject, Who.Name from Task"
    The context sobjects for "Subject" is {"Task"}.
    The context sobjects for "Who" is {"Task"}.
    The context sobjects for "Name" is {"Contact", "Lead"}.
    */
    let contextSobjectDescribes = new Enumerable([sobjectDescribe]);
    let contextPath = query.substring(0, contextEnd).match(/[a-zA-Z0-9_.]*$/)[0];
    let sobjectStatuses = new Map(); // Keys are error statuses, values are an object name with that status. Only one object name in the value, since we only show one error message.
    if (contextPath) {
      let contextFields = contextPath.split(".");
      contextFields.pop(); // always empty
      for (let referenceFieldName of contextFields) {
        let newContextSobjectDescribes = new Set();
        for (let referencedSobjectName of contextSobjectDescribes
          .flatMap(contextSobjectDescribe => contextSobjectDescribe.fields)
          .filter(field => field.relationshipName && field.relationshipName.toLowerCase() == referenceFieldName.toLowerCase())
          .flatMap(field => field.referenceTo)
        ) {
          let { sobjectStatus, sobjectDescribe } = vm.describeInfo.describeSobject(useToolingApi, referencedSobjectName);
          if (sobjectDescribe) {
            newContextSobjectDescribes.add(sobjectDescribe);
          } else {
            sobjectStatuses.set(sobjectStatus, referencedSobjectName);
          }
        }
        contextSobjectDescribes = new Enumerable(newContextSobjectDescribes);
      }
    }

    if (!contextSobjectDescribes.some()) {
      if (sobjectStatuses.has("loading")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + sobjectStatuses.get("loading") + " metadata...",
          results: []
        };
        return;
      }
      if (sobjectStatuses.has("loadfailed")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + sobjectStatuses.get("loadfailed") + " metadata failed.",
          results: [{ value: "Retry", title: "Retry" }]
        };
        vm.autocompleteClick = vm.autocompleteReload.bind(vm);
        return;
      }
      if (sobjectStatuses.has("notfound")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unknown object: " + sobjectStatuses.get("notfound"),
          results: []
        };
        return;
      }
      if (sobjectStatuses.size > 0) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unexpected error: " + sobjectStatus,
          results: []
        };
        return;
      }
      vm.autocompleteResults = {
        sobjectName,
        title: "Unknown field: " + sobjectName + "." + contextPath,
        results: []
      };
      return;
    }

    if (isFieldValue) {
      // Autocomplete field values
      let contextValueFields = contextSobjectDescribes
        .flatMap(sobjectDescribe => sobjectDescribe.fields
          .filter(field => field.name.toLowerCase() == fieldName.toLowerCase())
          .map(field => ({ sobjectDescribe, field }))
        )
        .toArray();
      if (contextValueFields.length == 0) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unknown field: " + sobjectDescribe.name + "." + contextPath + fieldName,
          results: []
        };
        return;
      }
      let fieldNames = contextValueFields.map(contextValueField => contextValueField.sobjectDescribe.name + "." + contextValueField.field.name).join(", ");
      if (ctrlSpace) {
        // Since this performs a Salesforce API call, we ask the user to opt in by pressing Ctrl+Space
        if (contextValueFields.length > 1) {
          vm.autocompleteResults = {
            sobjectName,
            title: "Multiple possible fields: " + fieldNames,
            results: []
          };
          return;
        }
        let contextValueField = contextValueFields[0];
        let queryMethod = useToolingApi ? "tooling/query" : vm.queryAll ? "queryAll" : "query";
        let whereClause = contextValueField.field.name + " like '%" + searchTerm.replace(/([\\'])/g, "\\$1") + "%'";
        if (contextValueField.sobjectDescribe.name.toLowerCase() === "recordtype") {
          let sobject = contextPath.split(".")[0];
          sobject = sobject.toLowerCase() === "recordtype" ? vm.autocompleteResults.sobjectName : sobject;
          whereClause += vm.autocompleteResults.sobjectName ? " AND SobjectType = '" + sobject + "'" : "";
        }
        let acQuery = "SELECT " + contextValueField.field.name + " FROM " + contextValueField.sobjectDescribe.name + " WHERE " + whereClause + " GROUP BY " + contextValueField.field.name + " LIMIT 100";

        vm.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/" + queryMethod + "/?q=" + encodeURIComponent(acQuery), { progressHandler: vm.autocompleteProgress })
          .catch(err => {
            if (err.name != "AbortError") {
              vm.autocompleteResults = {
                sobjectName,
                title: "Error: " + err.message,
                results: []
              };
              vm.didUpdate();
            }
            return null;
          })
          .then(data => {
            vm.autocompleteProgress = {};
            if (!data) {
              return;
            }
            vm.autocompleteResults = {
              sobjectName,
              title: fieldNames + " values suggestions:",
              results: new Enumerable(data.records)
                .map(record => record[contextValueField.field.name])
                .filter(value => value)
                .map(value => ({ value: "'" + value + "'", title: value, suffix: " ", rank: 1, autocompleteType: "fieldValue" }))
                .toArray()
                .sort(resultsSort)
            };
            vm.expandAutocomplete = true;
            vm.didUpdate();
          }));
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + fieldNames + " values...",
          results: []
        };
        vm.expandAutocomplete = true;
        vm.didUpdate();
        return;
      }
      let ar = new Enumerable(contextValueFields).flatMap(function* ({ field }) {
        yield* field.picklistValues.filter(
          pickVal => !inValuesUtilized.includes(pickVal.value.toLowerCase())
        ).map(
          pickVal => ({ value: "'" + pickVal.value + "'", title: pickVal.label, suffix: " ", rank: 1, autocompleteType: "picklistValue", dataType: "" })
        );
        if (field.type == "boolean") {
          yield { value: "true", title: "true", suffix: " ", rank: 1 };
          yield { value: "false", title: "false", suffix: " ", rank: 1 };
        }
        if (field.type == "date" || field.type == "datetime") {
          let pad = (n, d) => ("000" + n).slice(-d);
          let d = new Date();
          if (field.type == "date") {
            yield { value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2), title: "Today", suffix: " ", rank: 1 };
          }
          if (field.type == "datetime") {
            yield {
              value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) + "T"
                + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3)
                + (d.getTimezoneOffset() <= 0 ? "+" : "-") + pad(Math.floor(Math.abs(d.getTimezoneOffset()) / 60), 2)
                + ":" + pad(Math.abs(d.getTimezoneOffset()) % 60, 2),
              title: "Now",
              suffix: " ",
              rank: 1
            };
          }
          // from https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select_dateformats.htm Winter 24
          yield { value: "YESTERDAY", title: "Starts 12:00:00 the day before and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "TODAY", title: "Starts 12:00:00 of the current day and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "TOMORROW", title: "Starts 12:00:00 after the current day and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_WEEK", title: "Starts 12:00:00 on the first day of the week before the most recent first day of the week and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_WEEK", title: "Starts 12:00:00 on the most recent first day of the week before the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_WEEK", title: "Starts 12:00:00 on the most recent first day of the week after the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_MONTH", title: "Starts 12:00:00 on the first day of the month before the current day and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_MONTH", title: "Starts 12:00:00 on the first day of the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_MONTH", title: "Starts 12:00:00 on the first day of the month after the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the last 90 days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the next 90 days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the last n days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the next n days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next week and continues for the next n weeks.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_DAYS_AGO:n", title: "Starts at 12:00:00 AM on the day n days before the current day and continues for 24 hours. (The range doesn't include today.)", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous week and continues for the last n weeks.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_WEEKS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the month that started n months before the start of the current month and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next month and continues for the next n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_MONTHS_AGO:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_QUARTER", title: "Starts 12:00:00 of the current quarter and continues to the end of the current quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_QUARTER", title: "Starts 12:00:00 of the previous quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_QUARTER", title: "Starts 12:00:00 of the next quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_QUARTERS:n", title: "Starts 12:00:00 of the next quarter and continues to the end of the nth quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_QUARTERS:n", title: "Starts 12:00:00 of the previous quarter and continues to the end of the previous nth quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_QUARTERS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the calendar quarter n quarters before the current calendar quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_YEAR", title: "Starts 12:00:00 on January 1 of the current year and continues through the end of December 31 of the current year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_YEAR", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_YEAR", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of the nth year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of the previous nth year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_YEARS_AGO:n", title: "Starts at 12:00:00 AM on January 1 of the calendar year n years before the current calendar year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the current fiscal quarter and continues through the end of the last day of the fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of the nth fiscal quarter. The fiscal year is defined in the company profile under Setup atCompany Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of the previous nth fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_FISCAL_QUARTERS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the fiscal quarter n fiscal quarters before the current fiscal quarter and continues through the end of the last day of that fiscal quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "THIS_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the current fiscal year and continues through the end of the last day of the fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "NEXT_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of the nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "LAST_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of the previous nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
          yield { value: "N_FISCAL_YEARS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the fiscal year n fiscal years ago and continues through the end of the last day of that fiscal year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: "" };
        }
        if (field.nillable) {
          yield { value: "null", title: "null", suffix: " ", rank: 1, autocompleteType: "null", dataType: "" };
        }
      })
        .filter(res => res.value.toLowerCase().includes(searchTerm.toLowerCase()) || res.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .toArray()
        .sort(resultsSort);
      vm.autocompleteResults = {
        sobjectName,
        title: fieldNames + (ar.length == 0 ? " values (Press Ctrl+Space to load suggestions):" : " values:"),
        results: ar
      };
      return;
    } else {
      // Autocomplete field names and functions
      if (ctrlSpace) {
        let includeFormula = localStorage.getItem("includeFormulaFieldsFromExportAutocomplete") !== "false";
        let ar = contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => (field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase())) && (includeFormula || !field.calculated))
          // Bulk Query cannot select compound container values. Their scalar
          // children (BillingStreet, BillingCity, Latitude, etc.) are already
          // present and are the portable representation across REST/Bulk.
          .filter(field => !["address", "location"].includes(String(field.type || "").toLowerCase()))
          .map(field => contextPath + field.name)
          .filter(fieldName => !vm.selectedFieldNamesSet().has(fieldName.toLowerCase()))
          .toArray();
        if (ar.length > 0) {
          vm.queryInput.focus();
          vm.queryInput.setRangeText(ar.join(", ") + (isAfterFrom ? " " : ""), selStart - contextPath.length, selEnd, "end");
          vm.updateCurrentTabQuery(vm.queryInput.value);
        }
        vm.queryAutocompleteHandler();
        vm.didUpdate();
        return;
      }
      vm.autocompleteResults = {
        sobjectName,
        title: (contextSobjectDescribes.map(sobjectDescribe => sobjectDescribe.name).toArray().join(", ") + " FIELDS SUGGESTIONS:").toUpperCase(),
        results: contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .flatMap(function* (field) {
            yield {
              value: field.name, title: field.label, suffix: isAfterFrom ? " " : ", ", rank: 1,
              autocompleteType: "fieldName", dataType: field.type,
              isCustom: /__c$/i.test(field.name), isFormula: !!field.calculated,
              isRequired: field.nillable === false && field.defaultedOnCreate !== true,
              isRelationship: false
            };
            if (field.relationshipName) {
              yield { value: field.relationshipName + ".", title: field.label, suffix: "", rank: 1, autocompleteType: "relationshipName", dataType: "", isRelationship: true };
            }
          })
          .concat(
            new Enumerable(["FIELDS(ALL)", "FIELDS(STANDARD)", "FIELDS(CUSTOM)", "AVG", "COUNT", "COUNT_DISTINCT", "MIN", "MAX", "SUM", "CALENDAR_MONTH", "CALENDAR_QUARTER", "CALENDAR_YEAR", "DAY_IN_MONTH", "DAY_IN_WEEK", "DAY_IN_YEAR", "DAY_ONLY", "FISCAL_MONTH", "FISCAL_QUARTER", "FISCAL_YEAR", "HOUR_IN_DAY", "WEEK_IN_MONTH", "WEEK_IN_YEAR", "toLabel", "convertTimezone", "convertCurrency", "FORMAT", "GROUPING"])
              .filter(fn => fn.toLowerCase().startsWith(searchTerm.toLowerCase()))
              .map(fn => {
                if (fn.includes(")")) { //Exception to easily support functions with hardcoded parameter options
                  return { value: fn, title: fn, suffix: "", rank: 2, autocompleteType: "variable", dataType: "" };
                } else {
                  return { value: fn, title: fn + "()", suffix: "(", rank: 2, autocompleteType: "variable", dataType: "" };
                }
              })
          )
          .toArray()
          // Don't re-suggest fields already present in the query's SELECT clause.
          .filter(r => !vm.selectedFieldNamesSet().has((r.value || "").toLowerCase()))
          .sort(resultsSort)
      };
      return;
    }
  }
  // Field names already present in the query's top-level SELECT clause. The
  // suggestions panel should not re-offer fields the user already selected.
  selectedFieldNamesSet() {
    const set = new Set();
    const query = (this.queryInput && this.queryInput.value) || "";
    const selectMatch = /^\s*SELECT\b/i.exec(query);
    if (!selectMatch) return set;
    // Find the top-level FROM (skip subquery FROMs by tracking parenthesis depth).
    let depth = 0;
    let fromIdx = -1;
    for (let i = selectMatch.index; i < query.length; i++) {
      const ch = query[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (depth === 0 && /^from\b/i.test(query.substr(i, 4)) && /[\s,]/i.test(query[i - 1] || " ")) {
        fromIdx = i;
        break;
      }
    }
    if (fromIdx === -1) return set;
    query.slice(selectMatch.index + 6, fromIdx).split(",").forEach(part => {
      const t = (part || "").trim().replace(/\s+AS\s+\w+\s*$/i, "").trim();
      const name = (t.match(/([A-Za-z_][A-Za-z0-9_.]*)\s*$/) || [])[1];
      if (name) set.add(name.toLowerCase());
    });
    return set;
  }
  removeTypo(query) {
    // Remove double commas
    query = query.replace(/,\s*,/g, ",");
    // Remove trailing comma before FROM (handles both main query and subqueries)
    query = query.replace(/,\s*FROM\s+/gi, " FROM ");
    // Remove trailing comma before closing parenthesis (subqueries like "Select Id, from contacts)")
    query = query.replace(/,\s*\)/g, ")");
    // Remove multiple spaces
    query = query.replace(/\s+/g, " ");
    // Remove duplicate fields in SELECT clause
    query = this.removeDuplicateFields(query);

    return query.trim();
  }
  removeDuplicateFields(query) {
    // Match the outermost SELECT ... FROM pattern
    return query.replace(/\bSELECT\b([\s\S]*?)\bFROM\b/gi, (match, fieldsPart) => {
      let fields = fieldsPart.split(",").map(f => f.trim()).filter(f => f.length > 0);
      let seen = new Set();
      let unique = [];
      for (let field of fields) {
        let key = field.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(field);
        }
      }
      return "SELECT " + unique.join(", ") + " FROM";
    });
  }
  doExport() {
    let vm = this; // eslint-disable-line consistent-this
    let exportedData = new RecordTable(vm);
    exportedData.isTooling = vm.queryTooling;
    exportedData.describeInfo = vm.describeInfo;
    exportedData.sfHost = vm.sfHost;
    vm.initPerf();
    // Always clean up trailing commas before executing, regardless of enableQueryTypoFix setting
    let query = vm.removeTypo(vm.queryInput.value);
    if (vm.incrementalEnabled) query = vm.prepareIncrementalQuery(query);
    vm.queryInput.value = query; // Update the input value with the cleaned query
    const limitMatch = query.match(/\bLIMIT\s+(\d+)\b/i);
    const bulkEligible = !vm.queryTooling && !/^\s*(FIND|\{)/i.test(query);
    // Auto mode starts with REST. Salesforce REST returns small result sets in
    // a single response, while creating and polling a Bulk API job adds several
    // seconds even when an object only contains a few records. Use Bulk
    // automatically only when the query explicitly requests a large result;
    // users can still force Bulk for an unbounded high-volume export.
    const effectiveApiMode = vm.resolvedApiMode || vm.exportApiMode;
    const useBulk = bulkEligible && (effectiveApiMode === "bulk" || (effectiveApiMode === "auto" && limitMatch && +limitMatch[1] > 10000));
    vm.resolvedApiMode = null;
    if (useBulk) {
      vm.doBulkExport(query);
      return;
    }
    function batchHandler(batch) {
      return batch.catch(err => {
        if (err.name == "AbortError") {
          return { records: [], done: true, totalSize: -1 };
        }
        throw err;
      }).then(data => {
        let fieldsResponses = { query: "records", queryAll: "records", "tooling/query": "records", search: "searchRecords", graphql: "data" };
        let isSoql = fieldsResponses[exportedData.queryMethod] === "records";
        if (exportedData.queryMethod === "graphql") {
          exportedData.sobject = Object.keys(data.data.uiapi.query)[0];
          let dataGraph = data.data.uiapi.query[exportedData.sobject].edges.map(record => {
            const firstProperty = Object.keys(record.node)[0];

            const transformed = {};
            if (firstProperty) {
              for (const key in record.node) {
                if (Object.prototype.hasOwnProperty.call(record.node, key)) {
                  transformed[key] = (typeof record.node[key] === "object" && "value" in record.node[key]) ? record.node[key].value : record.node[key];
                  transformed.attributes = { type: exportedData.sobject };
                }
              }
            }
            return transformed;
          });
          exportedData.addToTable(dataGraph);
        } else {
          exportedData.addToTable(data[fieldsResponses[exportedData.queryMethod]]);
        }

        let recs = exportedData.records.length;
        let total = exportedData.totalSize;
        if (data.totalSize != -1) {
          exportedData.totalSize = isSoql ? data.totalSize : recs;
          total = exportedData.totalSize;
        }
        if (!data.done && isSoql) {
          let pr = batchHandler(sfConn.rest(data.nextRecordsUrl, { progressHandler: vm.exportProgress, useCache: false }));
          vm.isWorking = true;
          vm.exportStatus = `Exporting... Completed ${recs} of ${total} record${s(total)}.`;
          vm.exportError = null;
          vm.exportedData = exportedData;
          vm.markPerf();
          vm.updatedExportedData();
          vm.didUpdate();
          return pr;
        }
        vm.queryHistory.add({ query, useToolingApi: exportedData.isTooling });
        if (recs == 0) {
          vm.isWorking = false;
          vm.exportStatus = "No data exported." + (total > 0 ? ` ${total} record${s(total)}.` : "");
          vm.exportError = null;
          vm.exportedData = exportedData;
          vm.markPerf();
          vm.updatedExportedData();
          return null;
        } else {
          vm.updateCurrentTabName(exportedData.records[0].attributes.type);
        }
        vm.isWorking = false;
        vm.exportStatus = `Exported ${recs}${recs !== total ? (" of " + total) : ""} record${s(recs)}`;
        vm.exportError = null;
        vm.exportedData = exportedData;
        vm.markPerf();
        vm.updatedExportedData();
        vm.saveIncrementalCheckpoint(exportedData.records);
        // Store the results in the current tab
        if (vm.queryTabs[vm.activeTabIndex]) {
          vm.queryTabs[vm.activeTabIndex].results = exportedData;
          vm.saveQueryTabs();
        }
        return null;
      }, err => {
        // Handle all errors — re-throw any non-SalesforceRestError after showing a message
        let recs = exportedData.records.length;
        let total = exportedData.totalSize;
        if (total != -1) {
          // We already got some data. Show it, and indicate that not all data was exported
          vm.isWorking = false;
          vm.exportStatus = `Exported ${recs} of ${total} record${s(total)}. Stopped by error.`;
          vm.exportError = err.message || String(err);
          vm.exportedData = exportedData;
          vm.updatedExportedData();
          vm.markPerf();
          return null;
        }
        vm.isWorking = false;
        vm.exportStatus = "Error";
        vm.exportError = err.message || String(err);
        vm.exportedData = null;
        vm.updatedExportedData();
        return null;
      });
    }
    this.setQueryMethod(exportedData, query, vm);
    vm.spinFor(batchHandler(sfConn.rest(exportedData.endpoint, exportedData.params))
      .catch(error => {
        console.error(error);
        vm.isWorking = false;
        vm.exportStatus = "Error";
        vm.exportError = "UNEXPECTED EXCEPTION:" + error;
        vm.exportedData = null;
        vm.markPerf();
        vm.updatedExportedData();
      }));
    vm.setResultsFilter("");
    vm.isWorking = true;
    vm.exportStatus = "Exporting...";
    vm.exportError = null;
    vm.exportedData = exportedData;
    vm.updatedExportedData();
  }

  async doBulkExport(query) {
    const vm = this;
    const exportedData = new RecordTable(vm);
    const objectMatch = query.match(/\bFROM\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    const objectType = objectMatch ? objectMatch[1] : "Record";
    vm.isWorking = true;
    vm.exportError = null;
    vm.exportStatus = "Creating Bulk API 2.0 query job…";
    vm.exportedData = exportedData;
    vm.updatedExportedData();
    vm.didUpdate();
    try {
      const job = await sfConn.rest(`/services/data/v${apiVersion}/jobs/query`, {
        method: "POST",
        body: {operation: vm.queryAll ? "queryAll" : "query", query, contentType: "CSV", columnDelimiter: "COMMA", lineEnding: "LF"},
        useCache: false
      });
      let state = job;
      while (!["JobComplete", "Failed", "Aborted"].includes(state.state)) {
        vm.exportStatus = `Bulk query ${state.state || "Queued"}…`;
        vm.didUpdate();
        await new Promise(resolve => setTimeout(resolve, 1000));
        state = await sfConn.rest(`/services/data/v${apiVersion}/jobs/query/${job.id}`, {useCache: false});
      }
      if (state.state !== "JobComplete") throw new Error(state.errorMessage || `Bulk query ended with ${state.state}`);
      let locator = null;
      do {
        const params = new URLSearchParams({maxRecords: "50000"});
        if (locator) params.set("locator", locator);
        const xhr = await sfConn.rest(`/services/data/v${apiVersion}/jobs/query/${job.id}/results?${params}`, {
          responseType: "text",
          headers: {Accept: "text/csv"},
          useCache: false,
          progressHandler: vm.exportProgress
        }, true);
        const rows = csvParse(xhr.responseText || "", ",");
        const header = rows.shift() || [];
        const records = rows.filter(row => row.some(value => value !== "")).map(row => {
          const record = {attributes: {type: objectType}};
          header.forEach((name, index) => { record[name] = row[index] == null ? "" : row[index]; });
          return record;
        });
        exportedData.addToTable(records);
        locator = xhr.getResponseHeader("Sforce-Locator");
        if (!locator || locator === "null") locator = null;
        vm.exportStatus = `Bulk export: ${exportedData.records.length.toLocaleString()} records received…`;
        vm.updatedExportedData();
        vm.didUpdate();
      } while (locator);
      exportedData.totalSize = exportedData.records.length;
      vm.isWorking = false;
      vm.exportStatus = `Exported ${exportedData.records.length.toLocaleString()} records with Bulk API 2.0`;
      vm.queryHistory.add({query, useToolingApi: false});
      if (vm.queryTabs[vm.activeTabIndex]) vm.queryTabs[vm.activeTabIndex].results = exportedData;
      vm.updatedExportedData();
      vm.saveIncrementalCheckpoint(exportedData.records);
      vm.didUpdate();
    } catch (error) {
      const message = error.message || String(error);
      if (exportedData.records.length === 0 && /compound data|compound field|not supported in bulk query/i.test(message)) {
        vm.resolvedApiMode = "rest";
        vm.apiDecision = "REST fallback · Bulk API does not support selected compound fields";
        vm.exportStatus = "Retrying with REST API…";
        vm.exportError = null;
        vm.didUpdate();
        vm.doExport();
        return;
      }
      vm.isWorking = false;
      vm.exportError = message;
      vm.exportStatus = exportedData.records.length ? `Incomplete bulk export: ${exportedData.records.length.toLocaleString()} records` : "Bulk export failed";
      vm.updatedExportedData();
      vm.didUpdate();
    }
  }

  incrementalStorageKey(objectName) {
    return `sfarcIncrementalCheckpoint:${this.sfHost}:${objectName}`;
  }

  prepareIncrementalQuery(query) {
    const objectMatch = query.match(/\bFROM\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (!objectMatch || /^\s*(FIND|\{)/i.test(query)) return query;
    const objectName = objectMatch[1];
    this.incrementalObject = objectName;
    const checkpoint = localStorage.getItem(this.incrementalStorageKey(objectName)) || "";
    this.incrementalCheckpoint = checkpoint;
    // Keep the generated clause idempotent when a user runs a previously
    // augmented query again. Only ISO timestamp clauses created by this
    // feature are replaced; hand-authored date expressions remain intact.
    let next = query.replace(/\s+(AND|WHERE)\s+SystemModstamp\s*>\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\b/ig, (match, joiner) => joiner.toUpperCase() === "WHERE" ? " WHERE " : "");
    next = next.replace(/\bWHERE\s+AND\b/i, "WHERE");
    next = next.replace(/\bWHERE\s+(?=(GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|FOR\s+VIEW|FOR\s+REFERENCE)\b)/i, "");
    if (!this.selectedFieldNamesSet().has("systemmodstamp")) {
      next = next.replace(/^\s*SELECT\s+/i, "SELECT SystemModstamp, ");
    }
    if (!checkpoint) return next;
    const condition = `SystemModstamp > ${checkpoint}`;
    const tailMatch = next.match(/\s+(GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|FOR\s+VIEW|FOR\s+REFERENCE)\b/i);
    const insertAt = tailMatch ? tailMatch.index : next.length;
    const head = next.slice(0, insertAt);
    const tail = next.slice(insertAt);
    return `${head}${/\bWHERE\b/i.test(head) ? " AND " : " WHERE "}${condition}${tail}`;
  }

  saveIncrementalCheckpoint(records) {
    if (!this.incrementalEnabled || !this.incrementalObject || !records || !records.length) return;
    const values = records.map(record => record.SystemModstamp).filter(Boolean).sort();
    if (!values.length) return;
    const latest = values[values.length - 1];
    localStorage.setItem(this.incrementalStorageKey(this.incrementalObject), latest);
    this.incrementalCheckpoint = latest;
  }

  async preflightApi(query) {
    const unsupported = this.getBulkUnsupportedFields(query);
    if (unsupported.length) {
      this.resolvedApiMode = "rest";
      this.apiDecision = `REST selected · ${unsupported.length} compound field${unsupported.length === 1 ? "" : "s"} unsupported by Bulk`;
      return;
    }
    if (this.exportApiMode !== "auto") {
      this.resolvedApiMode = this.exportApiMode;
      this.apiDecision = `${this.exportApiMode === "bulk" ? "Bulk API 2.0" : "REST API"} selected manually`;
      return;
    }
    if (this.queryTooling || !/^\s*SELECT\b/i.test(query) || /\bGROUP\s+BY\b|\bTYPEOF\b/i.test(query)) {
      this.resolvedApiMode = "rest";
      this.apiDecision = "REST selected · Tooling or complex query";
      return;
    }
    const fromMatch = query.match(/\bFROM\s+([A-Za-z_][A-Za-z0-9_]*)([\s\S]*)$/i);
    if (!fromMatch) return;
    const objectName = fromMatch[1];
    let tail = fromMatch[2] || "";
    tail = tail.replace(/\s+(ORDER\s+BY|LIMIT|OFFSET|FOR\s+VIEW|FOR\s+REFERENCE)[\s\S]*$/i, "");
    const countQuery = `SELECT COUNT() FROM ${objectName}${tail}`;
    this.apiDecision = "Estimating record volume…";
    this.didUpdate();
    try {
      const result = await sfConn.rest(`/services/data/v${apiVersion}/query/?q=${encodeURIComponent(countQuery)}`, {useCache: false});
      const estimate = Number(result.totalSize ?? result.records?.[0]?.expr0 ?? 0);
      this.resolvedApiMode = estimate > 10000 ? "bulk" : "rest";
      this.apiDecision = `${this.resolvedApiMode === "bulk" ? "Bulk API 2.0" : "REST API"} selected · ${estimate.toLocaleString()} estimated records`;
    } catch (error) {
      this.resolvedApiMode = "rest";
      this.apiDecision = "REST selected · estimate unavailable";
    }
  }

  getBulkUnsupportedFields(query) {
    const selectMatch = String(query || "").match(/^\s*SELECT\s+([\s\S]*?)\s+FROM\s+/i);
    if (!selectMatch) return [];
    const selected = new Set(selectMatch[1].split(",").map(value => value.trim().toLowerCase()));
    const fields = Array.isArray(this.autocompleteResults?.results) ? this.autocompleteResults.results : [];
    return [...new Set(fields
      .filter(field => field.autocompleteType === "fieldName" && ["address", "location"].includes(String(field.dataType || "").toLowerCase()) && selected.has(String(field.value || "").toLowerCase()))
      .map(field => field.value))];
  }

  stopExport() {
    this.exportProgress.abort();
  }
  doQueryPlan() {
    let vm = this; // eslint-disable-line consistent-this
    let exportedData = new RecordTable(vm);

    vm.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/query/?explain=" + encodeURIComponent(vm.queryInput.value)).then(res => {
      exportedData.addToTable(res.plans);
      vm.exportStatus = "";
      vm.performancePoints = [];
      vm.exportedData = exportedData;
      vm.updatedExportedData();
      vm.didUpdate();
    }, () => {
      vm.isWorking = false;
    }));
    vm.autocompleteResults = {
      sobjectName: "",
      title: "Query Plan Tool:",
      results: [{ value: "Developer Console Query Plan Tool FAQ", title: "Developer Console Query Plan Tool FAQ", rank: 1, autocompleteType: "fieldName", dataType: "", link: "https://help.salesforce.com/s/articleView?id=000386864&type=1" },
      { value: "Get Feedback on Query Performance", title: "Get Feedback on Query Performance", suffix: " ", rank: 1, autocompleteType: "fieldName", dataType: "", link: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_query_explain.htm" },
      ]
    };
  }

  loadQueryTabs(queryFromUrl) {
    const savedTabs = localStorage.getItem(`${this.sfHost}_queryTabs`);
    if (savedTabs) {
      this.queryTabs = JSON.parse(savedTabs);
      // Ensure every tab has a stable unique id — used as the React key so
      // reconciliation never reuses the wrong DOM node across reorder/close.
      this.queryTabs.forEach((tab, i) => {
        if (!tab.id) {
          tab.id = `tab-${i}-${Math.random().toString(36).slice(2, 10)}`;
        }
      });
      if (queryFromUrl) {
        const newTabName = `${Model.QUERY_TAB_PREFIX} ${this.queryTabs.length + 1}`;
        this.queryTabs.push({ id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: newTabName, query: this.initialQuery, queryTooling: this.queryTooling, queryAll: this.queryAll, results: null, isManuallyRenamed: false });
        this.activeTabIndex = this.queryTabs.length - 1;
        this.saveQueryTabs();
      } else {
        this.activeTabIndex = 0;
      }
    } else {
      this.queryTabs = [{ id: `tab-init-${Date.now()}`, name: `${Model.QUERY_TAB_PREFIX} 1`, query: this.initialQuery, queryTooling: this.queryTooling, queryAll: this.queryAll, results: null, isManuallyRenamed: false }];
      this.activeTabIndex = 0;
    }
  }

  saveQueryTabs() {
    // Create a copy of the tabs without the results property
    const tabsToSave = this.queryTabs.map(tab => ({
      id: tab.id,
      name: tab.name,
      query: tab.query, queryTooling: tab.queryTooling,
      queryAll: tab.queryAll, isManuallyRenamed: tab.isManuallyRenamed || false
    }));
    localStorage.setItem(`${this.sfHost}_queryTabs`, JSON.stringify(tabsToSave));
  }

  addQueryTab() {
    const newTabName = `${Model.QUERY_TAB_PREFIX} ${this.getNextQueryTabIndex()}`;
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queryTabs.push({ id: newTabId, name: newTabName, query: "", queryTooling: false, queryAll: false, results: null, isManuallyRenamed: false });
    this.activeTabIndex = this.queryTabs.length - 1;
    this.setActiveTab(this.activeTabIndex);
    this.saveQueryTabs();
  }

  removeQueryTab(index) {
    if (this.queryTabs.length > 1) {
      this.queryTabs.splice(index, 1);
      if (this.activeTabIndex >= index) {
        this.activeTabIndex = Math.max(0, this.activeTabIndex - 1);
      }
      // Guard against any stale activeTabIndex (e.g. from a prior reorder)
      this.activeTabIndex = Math.min(this.activeTabIndex, this.queryTabs.length - 1);
      this.setActiveTab(this.activeTabIndex);
      this.saveQueryTabs();
      this.didUpdate();
    }
  }

  removeOtherQueryTabs(index) {
    if (this.queryTabs.length > 1) {
      const tabToKeep = this.queryTabs[index];
      this.queryTabs = [tabToKeep];
      this.activeTabIndex = 0;
      this.setActiveTab(this.activeTabIndex);
      this.saveQueryTabs();
      this.didUpdate();
    }
  }

  removeRightQueryTabs(index) {
    if (this.queryTabs.length > index + 1) {
      this.queryTabs.splice(index + 1);
      if (this.activeTabIndex > index) {
        this.activeTabIndex = index;
      }
      this.setActiveTab(this.activeTabIndex);
      this.saveQueryTabs();
      this.didUpdate();
    }
  }

  removeAllQueryTabs() {
    this.queryTabs = [];
    this.addQueryTab();
  }

  setActiveTab(index) {
    // Clamp so a stale/out-of-range index can never throw and freeze the UI.
    if (!this.queryTabs || this.queryTabs.length === 0) {
      this.activeTabIndex = 0;
      return;
    }
    if (index < 0 || index >= this.queryTabs.length || !this.queryTabs[index]) {
      index = Math.max(0, Math.min(index, this.queryTabs.length - 1));
    }
    this.activeTabIndex = index;
    // Update the query input value to match the current tab's query
    if (this.queryInput) {
      this.queryInput.value = this.queryTabs[index].query;
    }
    this.queryTooling = this.queryTabs[index].queryTooling;
    this.queryAll = this.queryTabs[index].queryAll;
    // Update the exported data with the tab's results
    this.exportedData = this.queryTabs[index].results;
    // Update the UI with the new data
    if (this.exportedData) {
      this.exportStatus = `Loaded ${this.exportedData.records.length} record${s(this.exportedData.records.length)}`;
    } else {
      this.exportStatus = "";
    }
    this.updatedExportedData();
    this.didUpdate();
  }
  /*
  Returns the next available index number for query tabs
  */
  getNextQueryTabIndex() {
    let maxIndex = 0;
    const prefix = Model.QUERY_TAB_PREFIX;

    this.queryTabs.forEach(tab => {
      if (tab.name.startsWith(prefix)) {
        // Extract number from tab name (e.g., "Query 1" -> 1, "Query 2" -> 2)
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = tab.name.match(new RegExp(`^${escapedPrefix}\\s+(\\d+)`));
        if (match) {
          const index = parseInt(match[1], 10);
          if (index > maxIndex) {
            maxIndex = index;
          }
        }
      }
    });
    return maxIndex + 1;
  }
  updateCurrentTabQuery(query) {
    if (this.queryTabs[this.activeTabIndex]) {
      this.queryTabs[this.activeTabIndex].query = query;
      this.saveQueryTabs();
    }
  }

  updateCurrentTabProperty(propertyName, value) {
    if (this.queryTabs[this.activeTabIndex]) {
      this.queryTabs[this.activeTabIndex][propertyName] = value;
      this.saveQueryTabs();
    }
  }

  updateCurrentTabName(name) {
    if (this.queryTabs[this.activeTabIndex]
      && !this.queryTabs[this.activeTabIndex].name.includes(name)
      && !this.queryTabs[this.activeTabIndex].isManuallyRenamed) {
      // Check if there are any other tabs with the same name
      let count = 1;
      let newName = name;
      while (this.queryTabs.some(tab => tab.name === newName)) {
        newName = `${name} (${count})`;
        count++;
      }
      this.queryTabs[this.activeTabIndex].name = newName;
      this.saveQueryTabs();
    }
  }

  updateTabName(index, newName) {
    if (this.queryTabs[index] && newName.trim()) {
      let trimmedName = newName.trim();
      // Check if there are any other tabs with the same name
      let count = 1;
      let finalName = trimmedName;
      while (this.queryTabs.some((tab, i) => i !== index && tab.name === finalName)) {
        finalName = `${trimmedName} (${count})`;
        count++;
      }
      this.queryTabs[index].name = finalName;
      this.queryTabs[index].isManuallyRenamed = true;
      this.saveQueryTabs();
      this.didUpdate();
    }
  }

  reorderTabs(fromIndex, toIndex) {
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex < this.queryTabs.length && toIndex < this.queryTabs.length && fromIndex !== toIndex) {
      const [movedTab] = this.queryTabs.splice(fromIndex, 1);
      this.queryTabs.splice(toIndex, 0, movedTab);

      // Update active tab index if the active tab was moved
      if (this.activeTabIndex === fromIndex) {
        this.activeTabIndex = toIndex;
      } else if (this.activeTabIndex > fromIndex && this.activeTabIndex <= toIndex) {
        this.activeTabIndex--;
      } else if (this.activeTabIndex < fromIndex && this.activeTabIndex >= toIndex) {
        this.activeTabIndex++;
      }

      // Sync the query editor / results with the (possibly moved) active tab,
      // otherwise the highlighted tab and its content can desync.
      this.setActiveTab(this.activeTabIndex);
      this.saveQueryTabs();
    }
  }

  getCurrentTabQuery() {
    return this.queryTabs[this.activeTabIndex]?.query || "";
  }
}

function RecordTable(vm) {
  /*
  We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
  This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
  We don't care, because we don't need a stable set of columns for our use case.
  */
  let columnIdx = new Map();
  let header = ["_actions", "_"];
  function discoverColumns(record, prefix, row) {
    for (const field of Object.keys(record)) {
      if (field === "attributes") {
        continue;
      }
      let column = prefix + field;
      let c;
      if (columnIdx.has(column)) {
        c = columnIdx.get(column);
      } else {
        c = header.length;
        columnIdx.set(column, c);
        for (let row of rt.table) {
          row.push(undefined);
        }
        header[c] = column;
        if (typeof record[field] == "object" && record[field] != null && vm.prefHideRelations) {
          rt.colVisibilities.push(false);
        } else { rt.colVisibilities.push(true); }
      }
      row[c] = record[field];
      if (typeof record[field] == "object" && record[field] != null) {
        discoverColumns(record[field], column + ".", row);
      }
    }
  }
  function cellToString(cell) {
    if (cell == null) {
      return "";
    } else if (typeof cell == "object") {
      if (cell.attributes && cell.attributes.type) {
        return "[" + cell.attributes.type + "]";
      }
      // Format compound Address fields (e.g., BillingAddress, ShippingAddress)
      if ("street" in cell || "city" in cell || "state" in cell || "country" in cell || "postalCode" in cell) {
        let addr = [cell.street, cell.city, cell.state, cell.postalCode, cell.country]
          .map(val => val ? String(val).trim() : "")
          .filter(Boolean)
          .join(", ");
        return addr.replace(/\r?\n/g, " ");
      }
      // Format compound Location fields (Geolocation)
      if ("latitude" in cell && "longitude" in cell) {
        if (cell.latitude == null && cell.longitude == null) {
          return "";
        }
        return "Lat: " + cell.latitude + ", Lon: " + cell.longitude;
      }
      // General fallback to JSON string representation
      try {
        let jsonStr = JSON.stringify(cell);
        return jsonStr.replace(/\r?\n/g, " ");
      } catch (e) {
        return ("" + cell).replace(/\r?\n/g, " ");
      }
    } else {
      return ("" + cell).replace(/\r?\n/g, " ");
    }
  }

  let isVisible = (row, filter) => {
    // If no filter is applied, show all rows
    if (!filter) {
      return true;
    }
    // If no columns are selected, search all columns
    if (!vm.filterColumns || vm.filterColumns.length === 0) {
      return row.some(cell => {
        if (cell == null) {
          return false;
        }
        return cellToString(cell).toLowerCase().includes(filter.toLowerCase());
      });
    }

    // Search in all selected columns
    return vm.filterColumns.some(column => {
      const columnIndex = header.findIndex(col => col === column);
      if (columnIndex === -1) {
        return false;
      }

      const cell = row[columnIndex];
      if (cell == null) {
        return false;
      }
      return cellToString(cell).toLowerCase().includes(filter.toLowerCase());
    });
  };

  let rt = {
    records: [],
    table: [],
    rowVisibilities: [],
    colVisibilities: [true, !vm.prefHideRelations],
    countOfVisibleRecords: null,
    isTooling: false,
    totalSize: -1,
    preventLineWrap: vm.prefPreventLineWrap,
    addToTable(expRecords) {
      // Avoid copying every record accumulated so far on every query page.
      rt.records.push(...expRecords);
      if (rt.table.length == 0 && expRecords.length > 0) {
        rt.table.push(header);
        rt.rowVisibilities.push(true);
      }
      let filter = vm.resultsFilter;
      for (let record of expRecords) {
        let row = new Array(header.length);
        row[0] = record;
        row[1] = record;
        rt.table.push(row);
        rt.rowVisibilities.push(isVisible(row, filter));
        discoverColumns(record, "", row);
      }
    },
    csvSerialize: separator => rt.getVisibleTable().map(row => row.map(cell => "\"" + cellToString(cell).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n"),
    updateVisibility() {
      let filter = vm.resultsFilter;
      let countOfVisibleRecords = 0;
      for (let r = 1/* always show header */; r < rt.table.length; r++) {
        let visible = isVisible(rt.table[r], filter);
        rt.rowVisibilities[r] = visible;
        if (visible) countOfVisibleRecords++;
      }
      this.countOfVisibleRecords = countOfVisibleRecords;
      vm.exportStatus = "Filtered " + countOfVisibleRecords + " records out of " + rt.records.length + " records";
    },
    filterColumns(table, colVis) {
      let filteredArray = table.map(row => row.filter((_, index) => colVis[index]));
      return filteredArray;
    },
    updateColumnsVisibility() {
      if (rt.table.length > 0 && header.length > 0) {
        rt.colVisibilities = header.map((colName, colIdx) => {
          if (colIdx === 0 || colName === "_actions") return true; // Action buttons column is always visible
          if (colIdx === 1 || colName === "_") {
            return !vm.prefHideRelations; // Object column hides/shows when user toggles Hide/Show Object Columns!
          }
          if (colName.includes(".") && vm.prefHideRelations) {
            return false;
          }
          return true;
        });
      }
    },
    getVisibleTable() {
      if (vm.resultsFilter) {
        let filteredTable = [];
        for (let i = 0; i < rt.table.length; i++) {
          if (rt.rowVisibilities[i]) { filteredTable.push(rt.table[i]); }
        }
        if (vm.prefHideRelations) { return rt.filterColumns(filteredTable, rt.colVisibilities); } else { return filteredTable; }

      }
      if (vm.prefHideRelations) { return rt.filterColumns(rt.table, rt.colVisibilities); } else { return rt.table; }
    }
  };
  return rt;
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onQueryAllChange = this.onQueryAllChange.bind(this);
    this.onQueryToolingChange = this.onQueryToolingChange.bind(this);
    this.onPrefHideRelationsChange = this.onPrefHideRelationsChange.bind(this);
    this.onSelectQueryTemplate = this.onSelectQueryTemplate.bind(this);
    this.onClearHistory = this.onClearHistory.bind(this);
    this.onSelectSavedEntry = this.onSelectSavedEntry.bind(this);
    this.onAddToHistory = this.onAddToHistory.bind(this);
    this.onRemoveFromHistory = this.onRemoveFromHistory.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onToggleExpand = this.onToggleExpand.bind(this);
    this.onToggleSavedOptions = this.onToggleSavedOptions.bind(this);
    this.onExport = this.onExport.bind(this);
    this.onPreviewExport = this.onPreviewExport.bind(this);
    this.onAddAllFields = this.onAddAllFields.bind(this);
    this.onCopyQuery = this.onCopyQuery.bind(this);
    this.onQueryPlan = this.onQueryPlan.bind(this);
    this.onCopyAsExcel = this.onCopyAsExcel.bind(this);
    this.onCopyAsCsv = this.onCopyAsCsv.bind(this);
    this.onDownloadAsCsv = this.onDownloadAsCsv.bind(this);
    this.onDownloadMultiTabExcel = this.onDownloadMultiTabExcel.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onCopyAsXml = this.onCopyAsXml.bind(this);
    this.onDeleteRecords = this.onDeleteRecords.bind(this);
    this.onResultsFilterInput = this.onResultsFilterInput.bind(this);
    this.onSetQueryName = this.onSetQueryName.bind(this);
    this.onStopExport = this.onStopExport.bind(this);
    this.onToggleTopSection = this.onToggleTopSection.bind(this);
    this.onExpandQueryEditorHover = this.onExpandQueryEditorHover.bind(this);
    this.toggleDataTypeFilterMenu = this.toggleDataTypeFilterMenu.bind(this);
    this.toggleHistoryDrawer = this.toggleHistoryDrawer.bind(this);
    this.onSelectHistoryItem = this.onSelectHistoryItem.bind(this);
    this.onDeleteHistoryItem = this.onDeleteHistoryItem.bind(this);
    this.openSaveQueryModal = this.openSaveQueryModal.bind(this);
    this.confirmSaveQuery = this.confirmSaveQuery.bind(this);
    this.suggestQueryName = this.suggestQueryName.bind(this);
    this.onSelectSavedItem = this.onSelectSavedItem.bind(this);
    this.onDeleteSavedItem = this.onDeleteSavedItem.bind(this);
    this.onShowExportQuery = this.onShowExportQuery.bind(this);
    this.onCloseExportQuery = this.onCloseExportQuery.bind(this);
    this.onFieldInfo = this.onFieldInfo.bind(this);
    this.onCloseFieldInfo = this.onCloseFieldInfo.bind(this);
    this.state = {
      hideButtonsOption: JSON.parse(localStorage.getItem("hideExportButtonsOption")),
      isDropdownOpen: false,
      hideTopSection: false,
      lastExecutedQuery: "",
      showDataTypeFilterMenu: false,
      selectedDataTypeFilters: [],
      showHistoryDrawer: false,
      historyDropdownPos: null,
      historySearchQuery: "",
      showSaveQueryModal: false,
      saveQueryName: "",
      saveQueryText: "",
      activeHistoryTab: "recent",
      confirmDialog: null,
      activeAutocompleteIndex: 0,
      showExportQueryModal: false,
      exportQueryCopied: false,
      showFieldInfoPanel: false,
      fieldInfoSearch: "",
      fieldSuggestionCategory: "all",
      showResultInsights: false,
      resultSortColumn: "",
      resultSortDirection: "asc",
      resultGroupColumn: "",
      resultPinnedColumn: "",
      // --- Cell Annotation State ---
      highlightMode: false,
      pendingColor: "#fbbf24",
      highlightType: "background", // "background" | "border"
      showColorPicker: false
    };
    this.cellMeta = new Map(); // keyed by "r,c" → { bgColor, borderColor }
    this.onCellClick = this.onCellClick.bind(this);
    this.onApplyHighlight = this.onApplyHighlight.bind(this);
    this.onToggleHighlightMode = this.onToggleHighlightMode.bind(this);

    this.onClearAnnotations = this.onClearAnnotations.bind(this);
    this.filterColumns = []; // Initialize as an empty array
    this.onAddTab = this.onAddTab.bind(this);
    this.onRemoveTab = this.onRemoveTab.bind(this);
    this.onRemoveOtherTabs = this.onRemoveOtherTabs.bind(this);
    this.onRemoveRightTabs = this.onRemoveRightTabs.bind(this);
    this.onRemoveAllTabs = this.onRemoveAllTabs.bind(this);
    this.onTabClick = this.onTabClick.bind(this);
    this.onQueryInput = this.onQueryInput.bind(this);
    this.onTabNameEdit = this.onTabNameEdit.bind(this);
    this.onTabNameSubmit = this.onTabNameSubmit.bind(this);
    this.onTabDragStart = this.onTabDragStart.bind(this);
    this.onTabDragOver = this.onTabDragOver.bind(this);
    this.onTabDrop = this.onTabDrop.bind(this);
    this.onTabDragLeave = this.onTabDragLeave.bind(this);
    this.onTabDragEnd = this.onTabDragEnd.bind(this);
    this.onTabContextMenu = this.onTabContextMenu.bind(this);
    this.onOverlayContextMenu = this.onOverlayContextMenu.bind(this);
    this.onCloseContextMenu = this.onCloseContextMenu.bind(this);
    this.updateQueryBackdrop = this.updateQueryBackdrop.bind(this);
    this.pushUndoState = this.pushUndoState.bind(this);
    this.performUndo = this.performUndo.bind(this);
    this.performRedo = this.performRedo.bind(this);

    this.undoStack = [];
    this.redoStack = [];

    // Tab editing state
    this.state = {
      ...this.state,
      editingTabIndex: -1,
      editingTabName: "",
      draggedTabIndex: -1,
      dropTargetIndex: -1,
      contextMenu: null
    };
  }
  onQueryAllChange(e) {
    let { model } = this.props;
    model.queryAll = e.target.checked;
    model.updateCurrentTabProperty("queryAll", model.queryAll);
    model.didUpdate();
  }
  onQueryToolingChange(e) {
    let { model } = this.props;
    model.queryTooling = e.target.checked;
    model.updateCurrentTabProperty("queryTooling", model.queryTooling);
    model.queryAutocompleteHandler();
    model.didUpdate();
  }

  onPrefHideRelationsChange() {
    let { model } = this.props;
    model.prefHideRelations = !model.prefHideRelations;
    model.updatedExportedData();
    model.didUpdate();
  }
  // ---- Cell Annotation Methods ----
  onToggleHighlightMode() {
    this.setState(prev => {
      const entering = !prev.highlightMode;
      if (entering) {
        document.body.classList.add("sfir-highlight-mode");
        document.body.style.setProperty("--sfir-pending-color", prev.pendingColor);
      } else {
        document.body.classList.remove("sfir-highlight-mode");
      }
      return {
        highlightMode: entering,
        showColorPicker: entering
      };
    });
  }
  onApplyHighlight(color) {
    document.body.style.setProperty("--sfir-pending-color", color);
    this.setState({ pendingColor: color });
  }
  onClearAnnotations() {
    this.cellMeta.clear();
    document.body.classList.remove("sfir-highlight-mode");
    // Re-trigger dataChange so the table re-renders without annotations
    if (this.scrollTable && this.props.model.exportedData) {
      this.scrollTable.dataChange(this.props.model.exportedData);
    }
    this.setState({ highlightMode: false, showColorPicker: false });
  }
  onCellClick(r, c, td, ev) {
    if (this.state.highlightMode) {
      ev.stopPropagation();
      let key = r + "," + c;
      let existing = this.cellMeta.get(key) || {};
      if (this.state.highlightType === "border") {
        let newColor = existing.borderColor === this.state.pendingColor ? null : this.state.pendingColor;
        this.cellMeta.set(key, { ...existing, borderColor: newColor });
        if (td) {
          if (newColor) {
            td.style.setProperty("box-shadow", `inset 0 0 0 2.5px ${newColor}`, "important");
            td.style.setProperty("z-index", "2", "important");
          } else {
            td.style.removeProperty("box-shadow");
            td.style.removeProperty("z-index");
          }
        }
      } else {
        let newColor = existing.bgColor === this.state.pendingColor ? null : this.state.pendingColor;
        this.cellMeta.set(key, { ...existing, bgColor: newColor });
        if (td) {
          if (newColor) {
            td.style.setProperty("background-color", newColor, "important");
          } else {
            td.style.removeProperty("background-color");
          }
        }
      }
      // Re-render table
      if (this.scrollTable && this.props.model.exportedData) {
        this.scrollTable.dataChange(this.props.model.exportedData);
      }
    }
  }
  toggleHistoryDrawer() {
    // The drawer launches centered on screen. If the user dragged it to a
    // custom spot, it reopens where they left it (historyDrawerLastPos);
    // otherwise CSS centers it (no inline pos).
    this.setState(prev => ({ showHistoryDrawer: !prev.showHistoryDrawer, historySearchQuery: "", historyDropdownPos: historyDrawerLastPos }));
  }

  // The extension ships React v15.4.0, which has NO pointer-event support —
  // onPointerDown/onPointerMove props are unknown and silently dropped (with
  // a console warning), so the drawer was never actually draggable in the
  // extension. Bind the handlers as native DOM listeners via a ref instead.
  _bindHistoryDrawerDrag(el) {
    if (el && !el.__sfirDragBound) {
      el.__sfirDragBound = true;
      el.addEventListener("pointerdown", (e) => this.onHistoryDrawerPointerDown(e));
      el.addEventListener("pointermove", (e) => this.onHistoryDrawerPointerMove(e));
      el.addEventListener("pointerup", (e) => this.onHistoryDrawerPointerUp(e));
      el.addEventListener("pointercancel", (e) => this.onHistoryDrawerPointerUp(e));
    } else if (!el && this._historyDrag) {
      // Drawer closed mid-drag — drop stale drag state so the next open
      // starts clean.
      this._historyDrag = null;
    }
  }

  onHistoryDrawerPointerDown(e) {
    if (e.button !== 0) return; // primary button only
    const drawer = e.currentTarget.closest(".sfir-history-drawer");
    if (!drawer) return;
    const rect = drawer.getBoundingClientRect();
    this._historyDrag = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      width: rect.width,
      height: rect.height,
      dragging: false,
      // The search input must keep caret/text-selection behavior, so a drag
      // never starts from it. Everything else in the header (including the
      // tabs and buttons) is a valid grab surface — clicks still work because
      // the drag only engages after real movement (>4px).
      onInput: !!(e.target && e.target.closest && e.target.closest("input"))
    };
    // NOTE: no setPointerCapture here. In Chrome, capturing on pointerdown
    // redirects the subsequent click to the capture target (the header), so
    // the History/Saved tab onClick would never fire — the toggle would be
    // unclickable in the real extension (it only worked in the harness,
    // where synthetic events can't capture). Capture is taken in
    // onHistoryDrawerPointerMove the moment the drag actually engages.
  }

  onHistoryDrawerPointerMove(e) {
    const d = this._historyDrag;
    if (!d || d.onInput) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // wait for real intent, keep clicks
    d.dragging = true;
    // Capture the pointer NOW that the drag is real, so move/up events keep
    // firing on the header even when the cursor leaves it. Safe for clicks:
    // the user has already moved >4px, so this is a drag, not a click (and
    // the click the browser may still fire lands on the header — harmless).
    // Wrapped in try/catch so environments that throw on synthetic/unknown
    // pointerIds still get in-header dragging.
    try {
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) { /* synthetic event / capture unavailable */ }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(d.origLeft + dx, 8), vw - d.width - 8);
    const top = Math.min(Math.max(d.origTop + dy, 8), vh - d.height - 8);
    const drawer = e.currentTarget.closest(".sfir-history-drawer");
    if (!drawer) return;
    drawer.classList.add("sfir-history-drawer-dragging");
    drawer.style.left = left + "px";
    drawer.style.top = top + "px";
    drawer.style.transform = "none";
    drawer.style.animation = "none";
  }

  onHistoryDrawerPointerUp(e) {
    const d = this._historyDrag;
    if (!d) return;
    this._historyDrag = null;
    const drawer = e.currentTarget.closest(".sfir-history-drawer");
    if (drawer) drawer.classList.remove("sfir-history-drawer-dragging");
    if (e.currentTarget.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
    }
    if (!d.dragging) return; // it was a click — let it fire normally
    if (drawer) {
      const rect = drawer.getBoundingClientRect();
      historyDrawerLastPos = {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        transform: "none",
        animation: "none"
      };
      this.setState({ historyDropdownPos: historyDrawerLastPos });
    }
  }
  onSelectHistoryItem(entry) {
    if (!entry) return;
    let { model } = this.props;
    model.selectedHistoryEntry = entry;
    model.selectHistoryEntry();
    this.setState({ showHistoryDrawer: false });
    this.updateQueryBackdrop();
    model.didUpdate();
  }
  onDeleteHistoryItem(e, entry) {
    if (e) e.stopPropagation();
    let { model } = this.props;
    model.queryHistory.remove(entry);
    model.didUpdate();
  }
  suggestQueryName(queryStr) {
    if (!queryStr || !queryStr.trim()) return "My Saved Query";
    let q = queryStr.trim();
    let fromMatch = q.match(/\bFROM\s+([a-zA-Z0-9_.]+)/i);
    let objName = fromMatch ? fromMatch[1] : "";
    let whereMatch = q.match(/\bWHERE\s+([\s\S]*?)(?=\s+\b(WITH|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET)\b|$)/i);
    let whereClause = whereMatch ? whereMatch[1].trim() : "";

    if (objName) {
      if (whereClause) {
        let cleanWhere = whereClause.replace(/\s+/g, ' ');
        if (cleanWhere.length > 25) cleanWhere = cleanWhere.substring(0, 25) + "...";
        return `${objName} (${cleanWhere})`;
      }
      return `${objName} Query`;
    }
    return "Saved Query";
  }
  openSaveQueryModal() {
    let queryText = (this.refs.query ? this.refs.query.value : "").trim();
    if (!queryText) {
      if (typeof toast !== "undefined" && toast.warning) toast.warning("Please write or enter a SOQL query before saving.");
      return;
    }

    let { model } = this.props;
    let existingIndex = model.savedHistory?.list?.findIndex(item => (item.query || "").trim() === queryText);

    if (existingIndex !== undefined && existingIndex !== -1) {
      // Query is ALREADY saved: toggle/delete from saved queries in real-time without showing modal!
      model.savedHistory.remove(model.savedHistory.list[existingIndex]);
      model.didUpdate();
      return;
    }

    // Query is NOT saved: open modal to save & name
    let suggested = this.suggestQueryName(queryText);
    this.setState({
      showSaveQueryModal: true,
      saveQueryName: suggested,
      saveQueryText: queryText
    });
  }
  confirmSaveQuery(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    let name = (this.state.saveQueryName || "").trim() || "Saved Query";
    let queryText = this.state.saveQueryText || (this.refs.query ? this.refs.query.value : "").trim();
    let { model } = this.props;

    try {
      if (model && model.savedHistory) {
        let existingIndex = model.savedHistory.list.findIndex(item => (item.query || "").trim() === queryText);
        if (existingIndex !== -1) {
          model.savedHistory.remove(model.savedHistory.list[existingIndex]);
        }
        model.savedHistory.add({
          name: name,
          query: queryText,
          useToolingApi: !!model.queryTooling
        });
      }
    } catch (error) {
      console.error("Failed to save query:", error);
    }

    if (model && model.didUpdate) {
      model.didUpdate();
    }

    // Trigger macOS Genie Minimization Animation
    this.setState({ isMinimizingGenie: true });

    // Pulse bottom-left Query History button as Genie animation completes
    setTimeout(() => {
      this.setState({ showHistoryPulse: true });
      setTimeout(() => {
        this.setState({ showHistoryPulse: false });
      }, 600);
    }, 350);

    // Dismiss modal after animation finishes
    setTimeout(() => {
      this.setState({
        showSaveQueryModal: false,
        isMinimizingGenie: false,
        saveQueryName: "",
        saveQueryText: ""
      });
    }, 450);
  }
  onSelectSavedItem(item) {
    if (!item) return;
    let { model } = this.props;
    let queryStr = item.query || "";
    if (this.refs.query) {
      this.refs.query.value = queryStr;
    }
    model.updateCurrentTabQuery(queryStr);
    model.queryTooling = !!item.useToolingApi;
    this.setState({ showHistoryDrawer: false });
    this.updateQueryBackdrop();
    model.didUpdate();
  }
  onDeleteSavedItem(e, item) {
    if (e) e.stopPropagation();
    let { model } = this.props;
    model.savedHistory.remove(item);
    model.didUpdate();
  }
  onSelectQueryTemplate(e) {
    let { model } = this.props;
    model.selectedQueryTemplate = e.target.value;
    model.selectQueryTemplate();
    model.didUpdate();
  }
  onClearHistory(e) {
    e.preventDefault();
    this.openConfirm({
      title: "Clear Query History",
      message: "Are you sure you want to clear the query history? This cannot be undone.",
      confirmLabel: "Clear History",
      onConfirm: () => {
        let { model } = this.props;
        model.clearHistory();
        model.didUpdate();
      }
    });
  }
  onSelectSavedEntry(e) {
    let { model } = this.props;
    model.selectedSavedEntry = JSON.parse(e.target.value);
    model.selectSavedEntry();
    model.didUpdate();
  }
  onAddToHistory(e) {
    e.preventDefault();
    let { model } = this.props;
    model.addToHistory();
    model.didUpdate();
  }
  onRemoveFromHistory(e) {
    e.preventDefault();
    this.openConfirm({
      title: "Remove Saved Query",
      message: "Are you sure you want to remove this saved query?",
      confirmLabel: "Remove",
      onConfirm: () => {
        let { model } = this.props;
        model.removeFromHistory();
        model.toggleSavedOptions();
        model.didUpdate();
      }
    });
  }
  onClearSavedHistory(e) {
    e.preventDefault();
    this.openConfirm({
      title: "Remove All Saved Queries",
      message: "Are you sure you want to remove all saved queries? This cannot be undone.",
      confirmLabel: "Remove All",
      onConfirm: () => {
        let { model } = this.props;
        model.clearSavedHistory();
        model.toggleSavedOptions();
        model.didUpdate();
      }
    });
  }
  openConfirm({ title, message, confirmLabel, onConfirm }) {
    this.setState({ confirmDialog: { title, message, confirmLabel, onConfirm } });
  }
  closeConfirm() {
    this.setState({ confirmDialog: null });
  }
  onToggleHelp(e) {
    if (e && e.preventDefault) e.preventDefault();
    let { model } = this.props;
    model.toggleHelp();
    model.didUpdate();
  }

  onToggleExpand(e) {
    if (e && e.preventDefault) e.preventDefault();
    let { model } = this.props;
    model.toggleExpand();
    model.didUpdate();
  }
  onToggleSavedOptions(e) {
    if (e && e.preventDefault) e.preventDefault();
    let { model } = this.props;
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onToggleTopSection(e) {
    if (e) e.preventDefault();
    this.setState({ hideTopSection: !this.state.hideTopSection });
  }
  onExpandQueryEditorHover() {
    if (this.state.hideTopSection) {
      this.setState({ hideTopSection: false });
    }
  }
  onExport() {
    let { model } = this.props;
    let queryText = (this.refs.query ? this.refs.query.value : (model.query || "")).trim();
    const unboundedRestQuery = model.exportApiMode === "rest" &&
      /^\s*SELECT\b/i.test(queryText) && !/\bLIMIT\s+\d+\b/i.test(queryText);
    if (unboundedRestQuery) {
      this.openConfirm({
        title: "Run an unlimited REST export?",
        message: "This query has no LIMIT and may use significant browser memory. Use Preview 200 first, or switch API to Auto/Bulk 2.0 for large exports.",
        confirmLabel: "Run unlimited",
        onConfirm: () => this.runExportQuery(queryText)
      });
      return;
    }
    this.runExportQuery(queryText);
  }

  async runExportQuery(queryText) {
    let { model } = this.props;
    this.setState({
      lastExecutedQuery: queryText || model.query || ""
    });
    // Running the query — collapse the field-suggestions panel automatically
    // (typing in the editor re-opens it on the next keystroke).
    model.expandAutocomplete = false;
    await model.preflightApi(queryText || model.query || "");
    model.doExport();
    model.didUpdate();
  }

  onPreviewExport() {
    let {model} = this.props;
    let queryText = (this.refs.query ? this.refs.query.value : (model.query || "")).trim();
    if (!/^\s*SELECT\b/i.test(queryText)) {
      this.runExportQuery(queryText);
      return;
    }
    if (/\bLIMIT\s+\d+\b/i.test(queryText)) {
      queryText = queryText.replace(/\bLIMIT\s+\d+\b/i, "LIMIT 200");
    } else if (/\bOFFSET\s+\d+\s*$/i.test(queryText)) {
      queryText = queryText.replace(/\s+(OFFSET\s+\d+\s*)$/i, " LIMIT 200 $1");
    } else {
      queryText += " LIMIT 200";
    }
    if (this.refs.query) this.refs.query.value = queryText;
    if (model.queryInput) model.queryInput.value = queryText;
    model.updateCurrentTabQuery(queryText);
    this.runExportQuery(queryText);
  }

  onAddAllFields(e) {
    if (e) e.preventDefault();
    const { model } = this.props;
    model.expandAutocomplete = true;
    model.queryAutocompleteHandler({ ctrlSpace: true, explicitCtrlSpace: true });
    model.didUpdate();
    this.autoGrowQueryTextarea();
  }

  applyResultSort(column, direction) {
    const {model} = this.props;
    const data = model.exportedData;
    if (!data || !data.table || data.table.length < 3) return;
    const index = data.table[0].indexOf(column);
    if (index < 0) return;
    const sign = direction === "desc" ? -1 : 1;
    const header = data.table[0];
    const rows = data.table.slice(1).sort((a, b) => {
      const av = a[index] == null ? "" : a[index];
      const bv = b[index] == null ? "" : b[index];
      const an = Number(av), bn = Number(bv);
      return sign * (Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av).localeCompare(String(bv), undefined, {numeric: true}));
    });
    data.table = [header, ...rows];
    data.rowVisibilities = new Array(data.table.length).fill(true);
    if (this.scrollTable) this.scrollTable.dataChange(data);
    this.setState({resultSortColumn: column, resultSortDirection: direction});
  }

  pinResultColumn(column) {
    const {model} = this.props;
    const data = model.exportedData;
    if (!data || !data.table || !column) { this.setState({resultPinnedColumn: ""}); return; }
    const index = data.table[0].indexOf(column);
    if (index <= 0) { this.setState({resultPinnedColumn: column}); return; }
    // Mutate rows in place so RecordTable's private header reference stays
    // synchronized for filtering and subsequent visibility updates.
    data.table.forEach(row => row.unshift(row.splice(index, 1)[0]));
    if (Array.isArray(data.colVisibilities)) {
      data.colVisibilities.unshift(data.colVisibilities.splice(index, 1)[0]);
    }
    if (this.scrollTable) this.scrollTable.dataChange(data);
    this.setState({resultPinnedColumn: column});
  }

  getResultInsights() {
    const data = this.props.model.exportedData;
    if (!data || !data.table || data.table.length < 2) return {columns: [], groups: []};
    const headers = data.table[0].filter(name => name !== "_" && name !== "_actions");
    const rows = data.table.slice(1);
    const columns = headers.map(name => {
      const index = data.table[0].indexOf(name);
      const values = rows.map(row => row[index]).filter(value => value !== "" && value != null);
      const numeric = values.map(Number).filter(Number.isFinite);
      return {
        name, count: values.length, blank: rows.length - values.length,
        distinct: new Set(values.map(String)).size,
        min: numeric.length ? Math.min(...numeric) : null,
        max: numeric.length ? Math.max(...numeric) : null,
        sum: numeric.length ? numeric.reduce((a, b) => a + b, 0) : null,
        average: numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null
      };
    });
    const groupName = this.state.resultGroupColumn;
    const groups = [];
    if (groupName) {
      const index = data.table[0].indexOf(groupName);
      const counts = new Map();
      rows.forEach(row => { const key = String(row[index] ?? "(Blank)"); counts.set(key, (counts.get(key) || 0) + 1); });
      [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([value, count]) => groups.push({value, count}));
    }
    return {columns, groups};
  }

  onCopyQuery() {
    // Now opens modal instead of silent copy
    this.setState({ showExportQueryModal: true, exportQueryCopied: false });
  }
  onShowExportQuery() {
    this.setState({ showExportQueryModal: true, exportQueryCopied: false });
  }
  onCloseExportQuery() {
    this.setState({ showExportQueryModal: false, exportQueryCopied: false });
  }
  onFieldInfo() {
    this.setState({ showFieldInfoPanel: true, fieldInfoSearch: "" });
  }
  onCloseFieldInfo() {
    this.setState({ showFieldInfoPanel: false, fieldInfoSearch: "" });
  }
  onQueryPlan() {
    let { model } = this.props;
    model.doQueryPlan();
    model.didUpdate();
  }
  onCopyAsExcel() {
    let { model } = this.props;
    model.copyAsExcel();
    model.didUpdate();
  }
  onCopyAsCsv() {
    let { model } = this.props;
    model.copyAsCsv();
    model.didUpdate();
  }
  onDownloadAsCsv() {
    let { model } = this.props;
    model.downloadAsCsv();
    model.didUpdate();
  }
  onDownloadMultiTabExcel() {
    let { model } = this.props;
    model.downloadMultiTabExcel();
    model.didUpdate();
  }
  onCopyAsJson() {
    let { model } = this.props;
    model.copyAsJson();
    model.didUpdate();
  }
  onCopyAsXml() {
    let { model } = this.props;
    model.copyAsXml();
    model.didUpdate();
  }
  onDeleteRecords(e) {
    let { model } = this.props;
    model.deleteRecords(e);
    model.didUpdate();
  }
  onResultsFilterInput(e) {
    let { model } = this.props;
    const value = e.target.value;
    model.resultsFilter = value;
    clearTimeout(this.resultsFilterTimer);
    this.resultsFilterTimer = setTimeout(() => {
      model.setResultsFilter(value);
      model.didUpdate();
    }, 180);
    if (value.length == 0) {
      this.setState({ isDropdownOpen: false });
    }
  }
  onSetQueryName(e) {
    let { model } = this.props;
    model.setQueryName(e.target.value);
    model.didUpdate();
  }
  onStopExport() {
    let { model } = this.props;
    model.stopExport();
    model.didUpdate();
  }
  onAddTab(e) {
    e.preventDefault();
    let { model } = this.props;
    model.addQueryTab();
  }
  onRemoveTab(e, index) {
    e.preventDefault();
    e.stopPropagation();
    let { model } = this.props;
    // Add removing class for animation, then remove after animation completes
    const tabElements = document.querySelectorAll('.query-tab');
    const tabEl = tabElements[index];
    if (tabEl) {
      tabEl.classList.add('removing');
      setTimeout(() => {
        model.removeQueryTab(index);
      }, 250); // Match animation duration (250ms)
    } else {
      model.removeQueryTab(index);
    }
  }

  onRemoveOtherTabs() {
    let { model } = this.props;
    if (this.state.contextMenu) {
      model.removeOtherQueryTabs(this.state.contextMenu.index);
    }
    this.onCloseContextMenu();
  }

  onRemoveRightTabs() {
    let { model } = this.props;
    if (this.state.contextMenu) {
      model.removeRightQueryTabs(this.state.contextMenu.index);
    }
    this.onCloseContextMenu();
  }

  onRemoveAllTabs() {
    let { model } = this.props;
    model.removeAllQueryTabs();
    this.onCloseContextMenu();
  }

  onTabClick(e, index) {
    e.preventDefault();
    let { model } = this.props;
    model.setActiveTab(index);
  }

  onQueryInput(e) {
    let { model } = this.props;
    model.updateCurrentTabQuery(e.target.value);
    model.queryAutocompleteHandler();
    this.setState({ activeAutocompleteIndex: 0 });
    this.pushUndoState();
    model.didUpdate();
    this.autoGrowQueryTextarea();
  }

  autoGrowQueryTextarea() {
    const el = this.refs.query;
    if (!el) return;
    try {
      // Reset to content height so scrollHeight reflects the text, then grow to
      // fit the content plus one extra line. Capped at ~45% of the viewport so a
      // very long query can't push the results pane off screen (it scrolls then).
      // rows=1 keeps the default rows=2 from inflating the measured height.
      el.setAttribute("rows", "1");
      el.style.height = "auto";
      const cs = window.getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight) || 20;
      const cap = Math.max(120, Math.round((window.innerHeight || 800) * 0.45));
      el.style.maxHeight = cap + "px";
      const target = Math.min(el.scrollHeight + lineHeight, cap);
      // Important so no stylesheet rule (e.g. the old fixed 48px) can override.
      el.style.setProperty("height", target + "px", "important");
    } catch (e) {
      /* never let auto-grow break query typing */
    }
  }

  onTabNameEdit(e, index) {
    e.stopPropagation();
    let { model } = this.props;
    this.setState({
      editingTabIndex: index,
      editingTabName: model.queryTabs[index].name
    });
  }

  onTabNameSubmit(e, index) {
    e.preventDefault();
    e.stopPropagation();
    let { model } = this.props;
    if (this.state.editingTabName.trim()) {
      model.updateTabName(index, this.state.editingTabName);
    }
    this.setState({
      editingTabIndex: -1,
      editingTabName: ""
    });
  }

  onTabDragStart(e, index) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target);
    this.setState({ draggedTabIndex: index, dropTargetIndex: -1 });
  }

  onTabDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Update drop target index if different from current
    if (this.state.dropTargetIndex !== index && this.state.draggedTabIndex !== index) {
      this.setState({ dropTargetIndex: index });
    }
  }

  onTabDragLeave(e) {
    // Only clear if we're leaving the tabs container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      this.setState({ dropTargetIndex: -1 });
    }
  }

  onTabDrop(e, index) {
    e.preventDefault();
    let { model } = this.props;
    const fromIndex = this.state.draggedTabIndex;
    if (fromIndex !== -1 && fromIndex !== index) {
      model.reorderTabs(fromIndex, index);
    }
    this.setState({ draggedTabIndex: -1, dropTargetIndex: -1 });
  }

  onTabDragEnd() {
    // Reset drag state when drag operation ends
    this.setState({ draggedTabIndex: -1, dropTargetIndex: -1 });
  }

  onTabContextMenu(e, index) {
    e.preventDefault();
    e.stopPropagation();
    this.setState({
      contextMenu: {
        x: e.clientX,
        y: e.clientY,
        index
      }
    });
  }

  onOverlayContextMenu(e) {
    e.preventDefault();
    e.target.style.visibility = "hidden";
    let target = document.elementFromPoint(e.clientX, e.clientY);
    e.target.style.visibility = "visible";

    if (target) {
      let event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: e.clientX,
        clientY: e.clientY
      });
      if (!target.dispatchEvent(event)) {
        return;
      }
    }
    this.onCloseContextMenu();
  }

  onCloseContextMenu() {
    this.setState({ contextMenu: null });
  }

  pushUndoState() {
    let queryInput = this.refs.query;
    if (!queryInput) return;
    let currentVal = queryInput.value;
    let caret = queryInput.selectionStart;

    if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1].query !== currentVal) {
      this.undoStack.push({ query: currentVal, caret });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
    }
  }

  performUndo() {
    let queryInput = this.refs.query;
    if (!queryInput || this.undoStack.length <= 1) return;

    let currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    let previousState = this.undoStack[this.undoStack.length - 1];
    queryInput.value = previousState.query;
    queryInput.selectionStart = queryInput.selectionEnd = previousState.caret;

    let { model } = this.props;
    model.updateCurrentTabQuery(previousState.query);
    this.updateQueryBackdrop();
    model.didUpdate();
  }

  performRedo() {
    let queryInput = this.refs.query;
    if (!queryInput || this.redoStack.length === 0) return;

    let nextState = this.redoStack.pop();
    this.undoStack.push(nextState);

    queryInput.value = nextState.query;
    queryInput.selectionStart = queryInput.selectionEnd = nextState.caret;

    let { model } = this.props;
    model.updateCurrentTabQuery(nextState.query);
    this.updateQueryBackdrop();
    model.didUpdate();
  }

  updateQueryBackdrop() {
    let queryInput = this.refs.query;
    let backdrop = this.refs.queryBackdrop;
    if (!queryInput || !backdrop) return;

    let text = queryInput.value || "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    let highlighted = escaped.replace(/(\bSELECT\s+)([\s\S]*?)(?=\s+\bFROM\b|$)/gi, (match, p1, p2) => {
      if (!p2 || !p2.trim()) return match;
      return p1 + `<span class="soql-field-highlight">${p2}</span>`;
    });

    highlighted = highlighted.replace(/(\bFROM\s+)([a-zA-Z0-9_.]+)/gi, (match, fromKw, objName) => {
      if (!objName || !objName.trim()) return match;
      return fromKw + `<span class="soql-object-highlight">${objName}</span>`;
    });

    highlighted = highlighted.replace(/(\bWHERE\s+)([\s\S]*?)(?=\s+\b(WITH|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|UPDATE|FOR)\b|$)/gi, (match, whereKw, whereCond) => {
      if (!whereCond || !whereCond.trim()) return match;
      return whereKw + `<span class="soql-where-highlight">${whereCond}</span>`;
    });

    let replaceChildQueries = (htmlStr) => {
      let result = "";
      let i = 0;
      while (i < htmlStr.length) {
        let subStart = htmlStr.substring(i).search(/\(\s*SELECT\b/i);
        if (subStart === -1) {
          result += htmlStr.substring(i);
          break;
        }
        let startIndex = i + subStart;
        result += htmlStr.substring(i, startIndex);
        let depth = 0;
        let endIndex = -1;
        for (let j = startIndex; j < htmlStr.length; j++) {
          if (htmlStr[j] === '(') depth++;
          else if (htmlStr[j] === ')') {
            depth--;
            if (depth === 0) {
              endIndex = j;
              break;
            }
          }
        }
        if (endIndex !== -1) {
          let rawSubquery = htmlStr.substring(startIndex, endIndex + 1);
          let cleanSubquery = rawSubquery.replace(/<\/?span[^>]*>/gi, "");
          result += `<span class="soql-childquery-highlight">${cleanSubquery}</span>`;
          i = endIndex + 1;
        } else {
          result += htmlStr.substring(startIndex);
          break;
        }
      }
      return result;
    };

    highlighted = replaceChildQueries(highlighted);

    if (text.endsWith("\n")) {
      highlighted += "<br>&nbsp;";
    }

    backdrop.innerHTML = highlighted;
    backdrop.scrollTop = queryInput.scrollTop;
    backdrop.scrollLeft = queryInput.scrollLeft;
  }

  componentDidMount() {
    if (SFIR_EMBEDDED) sfirPushUtilsState();
    let { model } = this.props;
    let queryInput = this.refs.query;
    model.setQueryInput(queryInput);
    if (model.args && model.args.get('openFieldInfo') === 'true') {
        setTimeout(() => {
            this.setState({ showFieldInfoPanel: true });
        }, 500);
    }
    // Close the history drawer with Escape (same UX as a native dropdown).
    this.__sfirHistoryEscHandler = (e) => {
      if (e.key === "Escape" && this.state && this.state.showHistoryDrawer) {
        this.setState({ showHistoryDrawer: false });
      }
    };
    addEventListener("keydown", this.__sfirHistoryEscHandler);
    // Native listener so auto-grow always runs on typing even if a synthetic
    // handler upstream ever throws.
    if (queryInput && !queryInput.__sfirAutoGrowBound) {
      queryInput.__sfirAutoGrowBound = true;
      queryInput.addEventListener("input", () => { this.autoGrowQueryTextarea(); });
    }
    this.autoGrowQueryTextarea();
    model.soqlPrompt = this.refs.prompt;
    //Set the cursor focus on query text area
    if (localStorage.getItem("disableQueryInputAutoFocus") !== "true") {
      queryInput.focus();
    }

    let syncBackdrop = () => {
      this.updateQueryBackdrop();
    };

    function queryAutocompleteEvent() {
      model.queryAutocompleteHandler();
      if (model.autocompleteResults && model.autocompleteResults.results && model.autocompleteResults.results.length > 0) {
        model.expandAutocomplete = true;
      }
      model.didUpdate();
      syncBackdrop();
    }
    queryInput.addEventListener("input", queryAutocompleteEvent);
    queryInput.addEventListener("select", queryAutocompleteEvent);

    // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
    queryInput.addEventListener("keyup", queryAutocompleteEvent);
    queryInput.addEventListener("mouseup", queryAutocompleteEvent);
    queryInput.addEventListener("scroll", () => {
      let backdrop = this.refs.queryBackdrop;
      if (backdrop && queryInput) {
        backdrop.scrollTop = queryInput.scrollTop;
        backdrop.scrollLeft = queryInput.scrollLeft;
      }
    });
    this.updateQueryBackdrop();
    this.pushUndoState();



    // Listen for Shift + Space shortcut to toggle History Drawer
    this.globalKeyDownHandler = (e) => {
      if (e.shiftKey && (e.code === "Space" || e.keyCode === 32)) {
        let activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (activeTag !== "input" && activeTag !== "textarea") {
          e.preventDefault();
          this.toggleHistoryDrawer();
        }
      }
    };
    document.addEventListener("keydown", this.globalKeyDownHandler);

    // Click-outside handler: dismiss color picker and note popovers
    this.globalAnnotClickOutside = (e) => {
      // Dismiss color picker if click is outside the picker popover and highlight button
      if (this.state.showColorPicker) {
        let pickerEl = document.querySelector(".sfir-color-picker-popover");
        let highlightBtn = document.querySelector(".sfir-annot-btn");
        if (pickerEl && !pickerEl.contains(e.target) && (!highlightBtn || !highlightBtn.contains(e.target))) {
          this.setState({ showColorPicker: false });
        }
      }
    };
    document.addEventListener("click", this.globalAnnotClickOutside, true);


    // We do not want to perform Salesforce API calls for autocomplete on every keystroke, so we only perform these when the user pressed Ctrl+Space
    // Chrome on Linux does not fire keypress when the Ctrl key is down, so we listen for keydown. Might be https://code.google.com/p/chromium/issues/detail?id=13891#c50
    queryInput.addEventListener("keydown", e => {
      let isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      let cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Autocomplete navigation
      if (model.expandAutocomplete) {
        const displayResults = this.getDisplayResults();
        if (displayResults.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            this.setState(prevState => ({
              activeAutocompleteIndex: Math.min(prevState.activeAutocompleteIndex + 1, displayResults.length - 1)
            }));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            this.setState(prevState => ({
              activeAutocompleteIndex: Math.max(prevState.activeAutocompleteIndex - 1, 0)
            }));
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            if (typeof model.autocompleteClick === "function") {
              model.autocompleteClick(displayResults[this.state.activeAutocompleteIndex]);
            }
            model.didUpdate();
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          model.expandAutocomplete = false;
          model.autocompleteResults.results = [];
          model.didUpdate();
          return;
        }
      }

      // Ctrl+Z or Cmd+Z (Undo)
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.performUndo();
        return;
      }

      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z (Redo)
      if ((cmdOrCtrl && e.key.toLowerCase() === 'y') || (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.performRedo();
        return;
      }

      // Ctrl+Space / Cmd+Space / Option+Space (Insert all field names / load field values / trigger autocomplete)
      const isSpace = e.key === " " || e.key === "Spacebar" || e.code === "Space" || e.keyCode === 32 || e.which === 32;
      if ((e.ctrlKey || e.metaKey || (isMac && e.altKey)) && isSpace) {
        e.preventDefault();
        e.stopPropagation();
        model.expandAutocomplete = true;
        model.queryAutocompleteHandler({ ctrlSpace: true, explicitCtrlSpace: true });
        model.didUpdate();
        syncBackdrop();
        this.autoGrowQueryTextarea();
        return;
      }
    });

    // Auto-expand suggestions section when user focuses or clicks inside the query editor
    queryInput.addEventListener("focus", () => {
      model.expandAutocomplete = true;
      model.queryAutocompleteHandler();
      model.didUpdate();
    });
    queryInput.addEventListener("click", () => {
      if (!model.expandAutocomplete || !model.autocompleteResults || model.autocompleteResults.results.length === 0) {
        model.expandAutocomplete = true;
        model.queryAutocompleteHandler();
        model.didUpdate();
      }
    });

    addEventListener("message", e => {
      if (e.data.command === "open-export-autocomplete") {
        model.queryAutocompleteHandler({ ctrlSpace: true });
        model.didUpdate();
      } else if (e.data.command === "open-export-execute") {
        this.onExport();
        model.didUpdate();
      }
    });

    this.scrollTable = initScrollTable(this.refs.scroller);
    // Wrap dataChange to inject cellMeta + onCellClick into data on every update
    const originalDataChange = this.scrollTable.dataChange.bind(this.scrollTable);
    this.scrollTable.dataChange = (data) => {
      if (data && typeof data === "object") {
        data.cellMeta = this.cellMeta;
        data.onCellClick = this.onCellClick;
      }
      originalDataChange(data);
    };
    model.resultTableCallback = this.scrollTable.dataChange;

    let recalculateHeight = this.recalculateSize.bind(this);
    if (!window.webkitURL) {
      // Firefox
      // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
      new MutationObserver(recalculateHeight).observe(queryInput, { attributes: true });
    } else {
      // Chrome
      // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
      // Instead we listen to a few events which are often fired at the same time.
      // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
      queryInput.addEventListener("mousemove", recalculateHeight);
      addEventListener("mouseup", recalculateHeight);
    }
    function resize() {
      model.winInnerHeight = innerHeight;
      model.didUpdate(); // Will call recalculateSize
    }
    addEventListener("resize", resize);
    resize();

    this.clickOutsideHandler = (e) => {
      let textarea = this.refs.query;
      let autocompleteBox = document.querySelector(".autocomplete-box");
      let funnelWrapper = document.querySelector(".sfir-datatype-filter-wrapper");
      if (textarea && !textarea.contains(e.target) && autocompleteBox && !autocompleteBox.contains(e.target)) {
        if (model.expandAutocomplete || (model.autocompleteResults && model.autocompleteResults.results.length > 0)) {
          model.expandAutocomplete = false;
          model.autocompleteResults.results = [];
          model.didUpdate();
        }
      }
      if (funnelWrapper && !funnelWrapper.contains(e.target)) {
        if (this.state.showDataTypeFilterMenu) {
          this.setState({ showDataTypeFilterMenu: false });
        }
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);
  }

  componentWillUnmount() {
    if (this.clickOutsideHandler) {
      document.removeEventListener("click", this.clickOutsideHandler);
    }
    if (this.globalKeyDownHandler) {
      document.removeEventListener("keydown", this.globalKeyDownHandler);
    }
    if (this.globalAnnotClickOutside) {
      document.removeEventListener("click", this.globalAnnotClickOutside, true);
    }
    // Clean up body classes added by annotation modes
    document.body.classList.remove("sfir-highlight-mode");
  }

  toggleDataTypeFilterMenu(e) {
    if (e) e.stopPropagation();
    this.setState(prevState => ({ showDataTypeFilterMenu: !prevState.showDataTypeFilterMenu }));
  }

  selectDataTypeFilter(key) {
    if (!key) {
      this.setState({ selectedDataTypeFilters: [], activeAutocompleteIndex: 0 });
      return;
    }
    this.setState(prevState => {
      let filters = [...(prevState.selectedDataTypeFilters || [])];
      let index = filters.indexOf(key);
      if (index >= 0) {
        filters.splice(index, 1);
      } else {
        filters.push(key);
      }
      return { selectedDataTypeFilters: filters, activeAutocompleteIndex: 0 };
    });
  }
  componentDidUpdate() {
    if (SFIR_EMBEDDED) sfirPushUtilsState();
    this.recalculateSize();
    this.updateQueryBackdrop();
    this.autoGrowQueryTextarea();
    const activeItem = document.getElementById("active-autocomplete-item");
    if (activeItem && activeItem.scrollIntoView) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
  recalculateSize() {
    // Investigate if we can use the IntersectionObserver API here instead, once it is available.
    this.scrollTable.viewportChange();
  }
  toggleQueryMoreMenu() {
    this.refs.buttonQueryMenu.classList.toggle("slds-is-open");
  }

  getDisplayResults() {
    let { model } = this.props;
    let selectedFilters = this.state.selectedDataTypeFilters || [];
    let rawResults = (model.autocompleteResults && model.autocompleteResults.results) ? model.autocompleteResults.results : [];
    if (!rawResults || rawResults.length === 0) return [];
    if (selectedFilters.length === 0) return rawResults;
    return rawResults.filter(r => {
      if (!r.dataType) return false;
      let dt = r.dataType.toLowerCase();
      return selectedFilters.some(filterType => {
        if (filterType === "date") return dt === "date" || dt === "datetime";
        if (filterType === "double") return dt === "double" || dt === "int" || dt === "currency" || dt === "percent";
        return dt === filterType.toLowerCase();
      });
    });
  }

  renderExportQueryModal() {
    if (!this.state.showExportQueryModal) return null;
    let { model } = this.props;
    let queryUrl;
    try {
      let url = new URL(window.location.href);
      url.searchParams.set("query", model.queryInput ? model.queryInput.value : "");
      queryUrl = url.toString();
    } catch (e) { queryUrl = window.location.href; }
    return h("div", {
      className: "sfir-modal-overlay",
      onClick: (e) => { if (e.target === e.currentTarget) this.onCloseExportQuery(); }
    },
      h("div", { className: "sfir-modal-card sfir-export-query-modal" },
        h("div", { className: "sfir-modal-header" },
          h("div", { className: "sfir-modal-header-left" },
            h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0, color: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))" } },
              h("path", { d: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" }),
              h("polyline", { points: "16 6 12 2 8 6" }),
              h("line", { x1: "12", y1: "2", x2: "12", y2: "15" })
            ),
            h("span", { className: "sfir-modal-title" }, "Export Query URL")
          ),
          h("button", { className: "sfir-modal-close-btn", onClick: this.onCloseExportQuery, title: "Close" }, "\u2715")
        ),
        h("div", { className: "sfir-modal-body" },
          h("p", { className: "sfir-modal-desc" }, "Share this URL to open the same query in salesforce comet. Anyone with access to this org can use it."),
          h("div", { className: "sfir-export-url-row" },
            h("input", {
              readOnly: true,
              className: "sfir-export-url-input",
              value: queryUrl,
              onClick: (e) => e.target.select()
            }),
            h("button", {
              className: "slds-button slds-button_brand sfir-copy-url-btn",
              onClick: () => {
                navigator.clipboard.writeText(queryUrl).then(() => {
                  this.setState({ exportQueryCopied: true });
                  setTimeout(() => this.setState({ exportQueryCopied: false }), 2200);
                });
              }
            },
              this.state.exportQueryCopied
                ? h("span", { className: "sfir-copy-success" }, "\u2713 Copied!")
                : "Copy URL"
            )
          ),
          h("div", { className: "sfir-modal-actions" },
            h("a", {
              href: queryUrl,
              target: "_blank",
              rel: "noopener noreferrer",
              className: "slds-button slds-button_neutral"
            }, "Open in New Tab"),
            h("button", { className: "slds-button slds-button_neutral", onClick: this.onCloseExportQuery }, "Close")
          )
        )
      )
    );
  }

  renderFieldInfoModal() {
    if (!this.state.showFieldInfoPanel) return null;
    let { model } = this.props;
    let sobjectName = model.autocompleteResults.sobjectName || "";
    let fields = [];
    if (sobjectName) {
      let useToolingApi = model.queryTooling || false;
      let result = model.describeInfo.describeSobject(useToolingApi, sobjectName);
      if (result.sobjectDescribe && result.sobjectDescribe.fields) {
        fields = result.sobjectDescribe.fields.slice();
      }
    }
    let search = (this.state.fieldInfoSearch || "").toLowerCase();
    let visibleFields = search
      ? fields.filter(function (f) { return f.name.toLowerCase().includes(search) || (f.label || "").toLowerCase().includes(search) || (f.type || "").toLowerCase().includes(search); })
      : fields;
    return h("div", {
      className: "sfir-modal-overlay",
      onClick: (e) => { if (e.target === e.currentTarget) this.onCloseFieldInfo(); }
    },
      h("div", { className: "sfir-modal-card sfir-field-info-modal" },
        h("div", { className: "sfir-modal-header" },
          h("div", { className: "sfir-modal-header-left" },
            h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0, color: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))" } },
              h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
              h("line", { x1: "3", y1: "9", x2: "21", y2: "9" }),
              h("line", { x1: "3", y1: "15", x2: "21", y2: "15" }),
              h("line", { x1: "9", y1: "3", x2: "9", y2: "21" })
            ),
            h("span", { className: "sfir-modal-title" }, sobjectName ? sobjectName + " \u2014 Field Info" : "Field Info")
          ),
          h("button", { className: "sfir-modal-close-btn", onClick: this.onCloseFieldInfo, title: "Close" }, "\u2715")
        ),
        h("div", { className: "sfir-modal-body" },
          !sobjectName
            ? h("div", { className: "sfir-field-info-empty" },
              h("svg", { width: "44", height: "44", viewBox: "0 0 24 24", fill: "none", stroke: "#94a3b8", strokeWidth: "1.5" },
                h("circle", { cx: "11", cy: "11", r: "8" }),
                h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
              ),
              h("p", { style: { color: "#64748b", marginTop: "12px", fontWeight: 600 } }, "No SObject detected"),
              h("p", { style: { color: "#94a3b8", fontSize: "12px" } }, "Type a SOQL query with a FROM clause first, then click Field Info again.")
            )
            : [
              h("div", { className: "sfir-field-info-toolbar", key: "toolbar" },
                h("input", {
                  type: "text",
                  placeholder: "Search fields by name, label or type\u2026",
                  className: "sfir-field-info-search",
                  value: this.state.fieldInfoSearch,
                  onChange: (e) => this.setState({ fieldInfoSearch: e.target.value }),
                  autoFocus: true
                }),
                h("span", { className: "sfir-field-info-count" }, visibleFields.length + " / " + fields.length + " fields")
              ),
              fields.length === 0
                ? h("div", { className: "sfir-field-info-empty", key: "loading" },
                  h("p", { style: { color: "#64748b" } }, "Loading metadata for " + sobjectName + "\u2026")
                )
                : h("div", { className: "sfir-field-info-table-wrap", key: "table" },
                  h("table", { className: "sfir-field-info-table" },
                    h("thead", {},
                      h("tr", {},
                        h("th", {}, "API Name"),
                        h("th", {}, "Label"),
                        h("th", {}, "Type"),
                        h("th", {}, "Required"),
                        h("th", {}, "Updateable"),
                        h("th", {}, "Length")
                      )
                    ),
                    h("tbody", {},
                      visibleFields.length === 0
                        ? h("tr", {}, h("td", { colSpan: 6, style: { textAlign: "center", padding: "20px", color: "#94a3b8" } }, "No fields match your search."))
                        : visibleFields.map(function (f) {
                          return h("tr", { key: f.name, className: "sfir-field-info-row" },
                            h("td", { className: "sfir-field-name" }, h("code", {}, f.name)),
                            h("td", {}, f.label || ""),
                            h("td", {}, h("span", { className: "sfir-field-type-badge sfir-type-" + (f.type || "other") }, f.type || "")),
                            h("td", { className: f.nillable === false ? "sfir-field-yes" : "sfir-field-no" }, f.nillable === false ? "\u2713" : "\u2014"),
                            h("td", { className: f.updateable ? "sfir-field-yes" : "sfir-field-no" }, f.updateable ? "\u2713" : "\u2014"),
                            h("td", { style: { color: "#64748b" } }, f.length || "")
                          );
                        })
                    )
                  )
                ),
              h("div", { className: "sfir-modal-actions", key: "actions" },
                h("a", {
                  href: model.showDescribeUrl(),
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "slds-button slds-button_neutral"
                }, "Open Full Metadata"),
                h("button", { className: "slds-button slds-button_neutral", onClick: this.onCloseFieldInfo }, "Close")
              )
            ]
        )
      )
    );
  }

  render() {
    let { model } = this.props;
    const perf = model.perfStatus();
    let currentQueryText = (model.query || (this.refs && this.refs.query ? this.refs.query.value : "")).trim();
    let hasQueryText = currentQueryText.length > 0;
    let isSaved = hasQueryText && model.savedHistory && model.savedHistory.list && model.savedHistory.list.some(item => (item.query || "").trim() === currentQueryText);
    const suggestionCategory = this.state.fieldSuggestionCategory || "all";
    const allFieldSuggestions = model.autocompleteResults?.results || [];
    const visibleFieldSuggestions = allFieldSuggestions.filter(field => {
      if (suggestionCategory === "standard" && (field.isCustom || field.autocompleteType !== "fieldName")) return false;
      if (suggestionCategory === "custom" && !field.isCustom) return false;
      if (suggestionCategory === "formula" && !field.isFormula) return false;
      if (suggestionCategory === "relationship" && !field.isRelationship) return false;
      if (suggestionCategory === "required" && !field.isRequired) return false;
      if (suggestionCategory.startsWith("type:") && field.dataType !== suggestionCategory.slice(5)) return false;
      return true;
    });

    // Define navigation items for this page
    const hostArg = "host=" + encodeURIComponent(model.sfHost);
    const navItems = [
      h("li", { className: "slds-builder-header__nav-item", key: "nav-export" },
        h("a", {
          href: "data-export.html?" + hostArg,
          className: "slds-builder-header__item-action sfir-nav-active"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
            h("path", { d: "M7 10l5 5 5-5" }),
            h("path", { d: "M12 15V3" })
          ),
          h("span", { className: "sfir-nav-label" }, "Export")
        )
      ),
      h("li", { className: "slds-builder-header__nav-item", key: "nav-import" },
        h("a", {
          href: "data-import.html?" + hostArg,
          className: "slds-builder-header__item-action"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
            h("path", { d: "M7 8l5-5 5 5" }),
            h("path", { d: "M12 3v12" })
          ),
          h("span", { className: "sfir-nav-label" }, "Import")
        )
      ),
      h("li", { className: "slds-builder-header__nav-item", key: "nav-limits" },
        h("a", {
          href: "org-limits.html?" + hostArg,
          className: "slds-builder-header__item-action"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" })
          ),
          h("span", { className: "sfir-nav-label" }, "Limits")
        )
      ),
      h("li", { className: "slds-builder-header__nav-item", key: "nav-metadata" },
        h("a", {
          href: "metadata-exporter.html?" + hostArg,
          className: "slds-builder-header__item-action"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }),
            h("path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" }),
            h("path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" })
          ),
          h("span", { className: "sfir-nav-label" }, "Metadata")
        )
      )
    ];

    // Define utility items for this page (injected as "slots")
    const utilityItems = [
      h("div", {key: "header-incremental", className: "slds-builder-header__utilities-item sfir-border-none slds-m-right_x-small"},
        h("label", {className: "sfir-header-toggle-container", title: model.incrementalCheckpoint ? `Last checkpoint: ${model.incrementalCheckpoint}` : "Export records changed since the last successful export"},
          h("span", null, "Incremental"),
          h("input", {
            type: "checkbox",
            checked: model.incrementalEnabled,
            onChange: e => {
              model.incrementalEnabled = e.target.checked;
              localStorage.setItem("sfarcIncrementalExport", String(model.incrementalEnabled));
              model.didUpdate();
            }
          }),
          h("span", {className: "sfir-header-toggle-switch"})
        )
      ),
      // Templates select
      h("div", { key: "header-templates", className: "slds-builder-header__utilities-item sfir-border-none slds-m-right_x-small" },
        h("select", {
          value: "",
          onChange: this.onSelectQueryTemplate,
          className: "query-history sfir-header-select",
          title: "Templates"
        },
          h("option", { value: "", disabled: true, defaultValue: true, hidden: true }, "Templates"),
          model.queryTemplates.map(q => h("option", { key: q, value: q }, q))
        )
      ),

      // Tooling API Toggle Switch
      h("div", { key: "header-tooling", className: "slds-builder-header__utilities-item sfir-border-none slds-m-right_x-small" },
        h("label", { className: "sfir-header-toggle-container", title: "Toggle Tooling API" },
          h("span", {}, "Tooling API"),
          h("input", {
            type: "checkbox",
            checked: model.queryTooling,
            onChange: this.onQueryToolingChange,
            disabled: model.queryAll
          }),
          h("span", { className: "sfir-header-toggle-switch" })
        )
      ),

      // Deleted/Archived Records Toggle Switch
      h("div", { key: "header-queryall", className: "slds-builder-header__utilities-item sfir-border-none slds-m-right_x-small" },
        h("label", { className: "sfir-header-toggle-container", title: "Toggle Deleted/Archived Records (QueryAll)" },
          h("span", {}, "QueryAll"),
          h("input", {
            type: "checkbox",
            checked: model.queryAll,
            onChange: this.onQueryAllChange,
            disabled: model.queryTooling
          }),
          h("span", { className: "sfir-header-toggle-switch" })
        )
      ),

    ].filter(Boolean); // Remove null items

    return h("div", { style: { position: "relative" } },
      SFIR_EMBEDDED
        ? null
        : h(PageHeader, {
          orgName: model.orgName,
          sfLink: model.sfLink,
          sfHost: model.sfHost,
          spinnerCount: model.spinnerCount,
          ...model.userInfoModel.getProps(),
          navItems,
          utilityItems,
          onToggleHelp: this.onToggleHelp,
          helpTitle: "Export Help"
        }),

      h("div", { className: "slds-m-top_xx-large sfir-page-container" },
        h("div", {
          className: "sfir-dynamic-island-wrapper " + (this.state.hideTopSection ? "is-collapsed" : "is-expanded"),
          onMouseEnter: this.state.hideTopSection ? this.onExpandQueryEditorHover : null,
          onClick: this.state.hideTopSection ? this.onExpandQueryEditorHover : null,
          title: this.state.hideTopSection ? "Hover or click to expand Query Editor" : ""
        },
          h("div", { className: "sfir-collapsed-query-banner" },
            h("div", { className: "sfir-collapsed-query-content" },
              h("div", { className: "sfir-query-icon-chip" },
                h("svg", { className: "sfir-query-icon-svg", viewBox: "0 0 24 24", width: "13", height: "13" },
                  h("path", { fill: "currentColor", d: "M13 2L3 14h7v8l10-12h-7V2z" })
                )
              ),
              h("span", { className: "sfir-query-title" }, "Query Editor"),
              model.queryTabs && model.queryTabs[model.activeTabIndex]
                ? h("span", { className: "sfir-query-tab-name" }, model.queryTabs[model.activeTabIndex].name)
                : null,
              h("code", { className: "sfir-query-preview-text" },
                (model.queryTabs && model.queryTabs[model.activeTabIndex] && model.queryTabs[model.activeTabIndex].query) || model.query || ""
              )
            ),
            h("div", { className: "sfir-collapsed-query-action" },
              h("button", {
                className: "sfir-expand-btn",
                title: "Expand Query Editor",
                onClick: this.onExpandQueryEditorHover
              },
                h("svg", { className: "sfir-expand-icon-svg", viewBox: "0 0 24 24", width: "13", height: "13" },
                  h("path", { fill: "currentColor", d: "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" })
                )
              )
            )
          ),            h("div", { className: "sfir-editor-card-content" },
            h("div", {
              className: "query-tabs",
              onDragLeave: this.onTabDragLeave
            },
              model.queryTabs.map((tab, index) =>
                h("div", {
                  key: tab.id || index,
                  className: `query-tab ${index === model.activeTabIndex ? "active" : ""} ${this.state.draggedTabIndex === index ? "dragging" : ""} ${this.state.dropTargetIndex === index ? "drop-target" : ""}`,
                  onClick: e => this.onTabClick(e, index),
                  draggable: true,
                  onDragStart: e => this.onTabDragStart(e, index),
                  onDragOver: e => this.onTabDragOver(e, index),
                  onDragLeave: e => this.onTabDragLeave(e),
                  onDrop: e => this.onTabDrop(e, index),
                  onDragEnd: e => this.onTabDragEnd(e),
                  onContextMenu: e => this.onTabContextMenu(e, index)
                },
                  h("span", { className: "query-tab-icon" },
                    h("svg", { width: "12", height: "12", viewBox: "0 0 24 24" },
                      h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }),
                      h("polyline", { points: "14 2 14 8 20 8", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })
                    )
                  ),
                  this.state.editingTabIndex === index
                    ? h("input", {
                      type: "text",
                      className: "query-tab-name-input",
                      value: this.state.editingTabName,
                      onChange: e => this.setState({ editingTabName: e.target.value }),
                      onBlur: e => this.onTabNameSubmit(e, index),
                      onKeyDown: e => {
                        if (e.key === "Enter") {
                          this.onTabNameSubmit(e, index);
                        } else if (e.key === "Escape") {
                          this.setState({
                            editingTabIndex: -1,
                            editingTabName: ""
                          });
                        }
                        e.stopPropagation();
                      },
                      onMouseDown: e => e.stopPropagation(),
                      onContextMenu: e => e.stopPropagation()
                    })
                    : h("span", {
                    className: "query-tab-name",
                    onDoubleClick: e => this.onTabNameEdit(e, index)
                  }, tab.name),
                  h("span", {
                    className: "query-tab-close",
                    onClick: e => this.onRemoveTab(e, index)
                  }, "×")
                )
              ),
              h("div", {
                className: "add-tab-button",
                onClick: this.onAddTab,
                role: "button",
                "aria-label": "Add new query tab"
              },
                h("svg", { className: "add-tab-icon", viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round" },
                  h("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                  h("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
                )
              )
            ),
            h("div", { className: "sfir-editor-row" },
              h("div", { className: "query-editor-wrapper", style: { position: "relative" } },
                h("div", {
                  id: "query-backdrop",
                  className: "query-backdrop",
                  ref: "queryBackdrop",
                  "aria-hidden": "true"
                }),
                h("textarea", {
                  id: "query",
                  ref: "query",
                  onChange: this.onQueryInput
                })
              ),
              model.expandAutocomplete
                ? h("div", { className: "sfir-suggestions-panel expanded" },
                    h("div", { className: "sfir-suggestions-heading" },
                      h("div", { className: "sfir-suggestions-title" }, model.autocompleteResults && model.autocompleteResults.title ? model.autocompleteResults.title : "FIELD SUGGESTIONS:"),
                      h("select", {
                        className: "sfir-field-category", value: this.state.fieldSuggestionCategory,
                        onChange: e => this.setState({fieldSuggestionCategory: e.target.value}),
                        title: "Filter fields by category or data type"
                      },
                        h("option", {value: "all"}, "All fields"),
                        h("option", {value: "standard"}, "Standard"),
                        h("option", {value: "custom"}, "Custom"),
                        h("option", {value: "formula"}, "Formula"),
                        h("option", {value: "relationship"}, "Relationship"),
                        h("option", {value: "required"}, "Required"),
                        h("option", {value: "type:string"}, "Text"),
                        h("option", {value: "type:boolean"}, "Checkbox"),
                        h("option", {value: "type:date"}, "Date"),
                        h("option", {value: "type:datetime"}, "Date/Time"),
                        h("option", {value: "type:currency"}, "Currency"),
                        h("option", {value: "type:reference"}, "Lookup")
                      ),
                      h("button", {
                        type: "button",
                        className: "sfir-add-all-fields",
                        onClick: this.onAddAllFields,
                        title: "Add every available field to SELECT (Ctrl/Cmd/Option + Space)",
                        "aria-label": "Add all fields to query"
                      },
                        h("i", { className: "fa-solid fa-list-check", "aria-hidden": "true" }),
                        h("span", null, "Add all fields"),
                        h("kbd", null, "⌃ Space")
                      )
                    ),
                    h("div", { className: "autocomplete-results" },
                      visibleFieldSuggestions.length > 0
                        ? visibleFieldSuggestions.map(r => (
                          h("span", { className: "slds-pill slds-pill_link slds-m-vertical_xxx-small", key: r.value },
                            h("span", { className: "slds-pill__icon_container " + r.autocompleteType + " " + r.dataType },
                              h("span", {
                                className: "sfir-autocomplete-icon",
                                title: suggestionTooltip(r),
                                onClick: e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (window.__sfarcTooltip) {
                                    window.__sfarcTooltip.show(e.currentTarget, suggestionTooltip(r));
                                  }
                                }
                              })
                            ),
                            h("a", { tabIndex: 0, title: r.title, onClick: e => { e.preventDefault(); model.autocompleteClick(r); model.didUpdate(); }, href: "#", className: "slds-pill__action slds-p-right_x-small" },
                              h("span", { className: "slds-pill__label" }, r.value)
                            )
                          )))
                        : h("span", { className: "sfir-suggestions-empty" }, allFieldSuggestions.length ? "No fields match this filter" : "Type in the query to see field suggestions")
                    )
                  )
                : null
            ),
            h("div", { className: "sfir-buttons-row" },
              h("div", { className: "autocomplete-header" },
                h("div", { className: "sfir-query-tab-bottom-actions" },
                  (model.queryTemplates && model.queryTemplates.length > 0) ? h("select", {
                    className: "query-history sfir-header-select",
                    value: model.selectedQueryTemplate || "",
                    onChange: e => {
                      model.selectedQueryTemplate = e.target.value;
                      model.selectQueryTemplate();
                    }
                  },
                    h("option", { value: "", disabled: true, hidden: true }, "Templates"),
                    model.queryTemplates.map(t => h("option", { key: t, value: t }, t))
                  ) : null,
                  h("button", {
                    type: "button",
                    className: "sfir-history-tab-btn" + (this.state.showHistoryDrawer ? " active" : "") + (this.state.showHistoryPulse ? " genie-pulse" : ""),
                    onClick: this.toggleHistoryDrawer,
                    title: "Query History (Shift + Space)"
                  },
                    h("svg", { viewBox: "0 0 24 24", width: "15", height: "15" },
                      h("path", { fill: "currentColor", d: "M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" })
                    )
                  )
                ),
                h("ul", { className: "slds-button-group-row flex-right" },
                  h("li", {className: "slds-button-group-item"},
                    h("select", {
                      value: model.exportApiMode,
                      className: "sfir-inline-api-select",
                      title: "Choose export API strategy",
                      "aria-label": "Export API strategy",
                      disabled: model.isWorking,
                      onChange: e => {
                        model.exportApiMode = e.target.value;
                        localStorage.setItem("sfarcExportApiMode", model.exportApiMode);
                        model.apiDecision = model.exportApiMode === "auto" ? "Auto will estimate volume before export" : `${model.exportApiMode === "bulk" ? "Bulk API 2.0" : "REST API"} selected manually`;
                        model.didUpdate();
                      }
                    },
                      h("option", {value: "auto"}, "API: Auto"),
                      h("option", {value: "rest"}, "API: REST"),
                      h("option", {value: "bulk"}, "API: Bulk 2.0")
                    )
                  ),

                  h("li", { className: "slds-button-group-item" },
                    h("button", {
                      type: "button",
                      disabled: model.isWorking || !hasQueryText,
                      onClick: this.onPreviewExport,
                      title: "Run a safe 200-row preview",
                      className: "slds-button slds-button_neutral"
                    }, "Preview 200")
                  ),
                  h("li", { className: "slds-button-group-item" },
                    h("button", {
                      tabIndex: 1,
                      disabled: model.isWorking,
                      onClick: this.onExport,
                      className: "slds-button slds-button_brand sfir-run-export-btn" + (hasQueryText ? " has-query" : "") + (model.isWorking ? " sfir-btn-executing" : "")
                    },
                      model.isWorking
                        ? [
                          h("svg", {
                            key: "spin",
                            className: "sfir-spinner-icon",
                            viewBox: "0 0 24 24",
                            width: "14",
                            height: "14",
                            style: { marginRight: "6px", flexShrink: 0 }
                          },
                            h("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeDasharray: "28 10" })
                          ),
                          "Executing..."
                        ]
                        : [
                          h("svg", {
                            key: "play",
                            className: "sfir-btn-icon",
                            viewBox: "0 0 24 24",
                            width: "14",
                            height: "14",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            style: { marginRight: "6px", flexShrink: 0 }
                          },
                            h("path", { d: "m6 3 14 9-14 9V3z" })
                          ),
                          "Run Export"
                        ]
                    )
                  ),
                  hasQueryText ? h("li", { className: "slds-button-group-item" },
                    h("button", {
                      tabIndex: 2,
                      onClick: this.openSaveQueryModal,
                      title: isSaved ? "Query is saved to history" : "Save current query to saved history",
                      className: "slds-button slds-button_neutral sfir-save-query-btn-hdr" + (isSaved ? " is-saved" : "")
                    },
                      h("svg", {
                        className: "sfir-btn-icon",
                        viewBox: "0 0 24 24",
                        width: "14",
                        height: "14",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        style: { marginRight: "6px", flexShrink: 0, color: "#eab308" }
                      },
                        h("path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" })
                      ),
                      isSaved ? "Saved" : "Save Query"
                    )
                  ) : null,
                  h("li", { className: "slds-button-group-item" },
                    isOptionEnabled("export-query", this.state.hideButtonsOption) ? h("button", { tabIndex: 3, onClick: this.onCopyQuery, title: "Share this query as a URL", className: "slds-button slds-button_neutral copy-id" },
                      h("svg", {
                        className: "sfir-btn-icon",
                        viewBox: "0 0 24 24",
                        width: "14",
                        height: "14",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        style: { marginRight: "6px", flexShrink: 0 }
                      },
                        h("path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }),
                        h("path", { d: "m16 6-4-4-4 4" }),
                        h("path", { d: "M12 2v13" })
                      ),
                      "Export Query") : null
                  ),
                  h("li", { className: "slds-button-group-item" },
                    h("button", { tabIndex: 4, onClick: this.onQueryPlan, className: "slds-button slds-button_neutral" },
                      h("svg", {
                        className: "sfir-btn-icon",
                        viewBox: "0 0 24 24",
                        width: "14",
                        height: "14",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        style: { marginRight: "6px", flexShrink: 0 }
                      },
                        h("path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }),
                        h("path", { d: "M7 16h.01" }),
                        h("path", { d: "M11 12h.01" }),
                        h("path", { d: "M15 8h.01" }),
                        h("path", { d: "M19 4h.01" })
                      ),
                      "Query Plan")
                  ),
                  h("li", { className: "slds-button-group-item" },
                    h("button", { tabIndex: 5, onClick: this.onFieldInfo, title: model.autocompleteResults.sobjectName ? "Show field info for " + model.autocompleteResults.sobjectName : "Show field info for the current SObject", className: "slds-button slds-button_neutral" },
                      h("svg", {
                        className: "sfir-btn-icon",
                        viewBox: "0 0 24 24",
                        width: "14",
                        height: "14",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        style: { marginRight: "6px", flexShrink: 0 }
                      },
                        h("path", { d: "M3 6h18" }),
                        h("path", { d: "M7 12h10" }),
                        h("path", { d: "M10 18h4" })
                      ),
                      model.autocompleteResults.sobjectName ? model.autocompleteResults.sobjectName + " Field Info" : "Field Info")
                  ),
                  h("li", { className: "slds-button-group-item" },
                    h("div", { className: "slds-dropdown-trigger" },
                      h("button", { tabIndex: 5, type: "button", className: model.expandAutocomplete ? "slds-button slds-button_icon slds-button_icon-more toggle contract" : "slds-button slds-button_icon slds-button_icon-more toggle expand", onClick: this.onToggleExpand, title: model.expandAutocomplete ? "Hide field suggestions" : "Show field suggestions", style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", minWidth: "22px", padding: "0" } },
                        h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
                          h("path", { d: model.expandAutocomplete ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6" })
                        )
                      )
                    ))
                )
              )
            ),
            !model.showHelp ? null : h("div", { className: "sfarc-help-panel" },
              h("div", { className: "sfarc-help-title" },
                h("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "var(--sfarc-accent, #2196f3)", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                  h("circle", { cx: "12", cy: "12", r: "9.5" }),
                  h("path", { d: "M9.2 9.2a2.8 2.8 0 0 1 5.4.8c0 1.8-2.6 2.5-2.6 3.8" }),
                  h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
                ),
                "Export Help"
              ),
              h("p", { className: "sfarc-help-text" },
                "Use for quick one-off data exports. Enter a ",
                h("a", { href: "https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm", target: "_blank" }, "SOQL"),
                ", ",
                h("a", { href: "https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_sosl.htm", target: "_blank" }, "SOSL"),
                ", or ",
                h("a", { href: "https://developer.salesforce.com/docs/platform/graphql/guide/query-record-examples.html", target: "_blank" }, "GraphQL"),
                " query in the box above and press Export."
              ),
              h("p", { className: "sfarc-help-text" },
                "Press ",
                h("kbd", { style: { padding: "1px 5px", borderRadius: "4px", background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)", fontSize: "11px", fontWeight: "600" } }, "Ctrl+Space"),
                " to insert all field name autosuggestions or to load suggestions for field values."
              ),
              h("div", { className: "sfarc-help-note" },
                "Supports the full SOQL language. Columns in CSV output depend on the returned data. Bulk API is not supported (large volumes may freeze the browser)."
              )
            ),
            null
          )),
        h(
          "div",
          {
            className: "slds-card slds-m-horizontal_medium" + ((!model.exportedData || !model.exportedData.records || model.exportedData.records.length === 0) && !model.isWorking ? ' sfir-empty-results' : ''),
            id: "result-area",
            style: {
              flex: "1 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              paddingTop: "5px",
              paddingBottom: "5px",
              marginBottom: "5px"
            }
          },
          h("div", { className: "slds-card__body slds-card__body_inner", style: { flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", position: "relative" } },
            h("div", { className: "result-bar-column", style: { position: "relative", zIndex: 60 } },
              h("div", { className: "result-bar-row-1" },
                h("div", { className: "result-bar-left-controls" },
                  h("h3", { className: "slds-text-heading_small" }, "Export Result"),
                  h("button", {
                    className: "slds-button slds-button_neutral slds-m-left_small",
                    onClick: this.onToggleTopSection,
                    title: this.state.hideTopSection ? "Show query box" : "Hide query box"
                  },
                    this.state.hideTopSection
                      ? h("svg", { className: "slds-button__icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
                        h("circle", { cx: "12", cy: "12", r: "3" })
                      )
                      : h("svg", { className: "slds-button__icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }),
                        h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
                      ),
                    h("span", { className: "sfir-btn-label" }, this.state.hideTopSection ? "Show query" : "Hide query")
                  ),
                  h("div", { className: "slds-button-group slds-m-left_small" },
                    model.hasSubqueries() ? h("button", {
                      className: "slds-button slds-button_success sfir-multitab-excel-btn",
                      style: { background: "#107c41", color: "#ffffff", fontWeight: "600", borderColor: "#0e6b37" },
                      disabled: !model.canCopy(),
                      onClick: this.onDownloadMultiTabExcel,
                      title: "Export SOQL subquery results into a Multi-Tab Excel spreadsheet (Tab 1: Parent, Tab 2+: Children with Parent references)"
                    },
                      h("svg", { className: "slds-button__icon slds-button__icon_left", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                        h("polyline", { points: "7 10 12 15 17 10" }),
                        h("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
                      ),
                      "Multi-Tab Excel"
                    ) : null,
                    // Single Combined Copy Dropdown Button (on hover/click reveals Excel, CSV, JSON options)
                    model.canCopy() ? h("div", {
                      className: "sfir-copy-dropdown-wrapper" + (this.state.showCopyMenu ? " open" : ""),
                      onMouseEnter: () => this.setState({ showCopyMenu: true }),
                      onMouseLeave: () => this.setState({ showCopyMenu: false })
                    },
                      h("button", {
                        type: "button",
                        className: "slds-button slds-button_neutral sfir-copy-main-btn",
                        onClick: (e) => {
                          e.stopPropagation();
                          this.setState({ showCopyMenu: !this.state.showCopyMenu });
                        },
                        title: ""
                      },
                        h("svg", { className: "slds-button__icon slds-button__icon_left", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                          h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
                          h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
                        ),
                        "Copy",
                        h("svg", { viewBox: "0 0 24 24", width: "12", height: "12", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { marginLeft: "4px", flexShrink: 0 } },
                          h("polyline", { points: "6 9 12 15 18 9" })
                        )
                      ),
                      this.state.showCopyMenu && h("div", {
                        className: "sfir-copy-menu",
                        onClick: (e) => e.stopPropagation()
                      },
                        h("div", {
                          role: "button",
                          tabIndex: 0,
                          className: "sfir-copy-menu-item",
                          onClick: (e) => {
                            e.stopPropagation();
                            this.onCopyAsExcel();
                            this.setState({ showCopyMenu: false });
                          }
                        },
                          h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "#107c41", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                            h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
                            h("line", { x1: "9", y1: "3", x2: "9", y2: "21" }),
                            h("line", { x1: "15", y1: "3", x2: "15", y2: "21" }),
                            h("line", { x1: "3", y1: "9", x2: "21", y2: "9" }),
                            h("line", { x1: "3", y1: "15", x2: "21", y2: "15" })
                          ),
                          "Copy (Excel)"
                        ),
                        h("div", {
                          role: "button",
                          tabIndex: 0,
                          className: "sfir-copy-menu-item",
                          onClick: (e) => {
                            e.stopPropagation();
                            this.onCopyAsCsv();
                            this.setState({ showCopyMenu: false });
                          }
                        },
                          h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                            h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                            h("polyline", { points: "14 2 14 8 20 8" }),
                            h("line", { x1: "8", y1: "13", x2: "16", y2: "13" }),
                            h("line", { x1: "8", y1: "17", x2: "16", y2: "17" })
                          ),
                          "Copy (CSV)"
                        ),
                        h("div", {
                          role: "button",
                          tabIndex: 0,
                          className: "sfir-copy-menu-item",
                          onClick: (e) => {
                            e.stopPropagation();
                            this.onCopyAsJson();
                            this.setState({ showCopyMenu: false });
                          }
                        },
                          h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "#8b5cf6", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                            h("path", { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" }),
                            h("path", { d: "M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 1 2 2 2 2 0 0 1-2 2v5a2 2 0 0 1-2 2h-1" })
                          ),
                          "Copy (JSON)"
                        ),
                        h("div", {
                          role: "button",
                          tabIndex: 0,
                          className: "sfir-copy-menu-item",
                          onClick: (e) => {
                            e.stopPropagation();
                            this.onCopyAsXml();
                            this.setState({ showCopyMenu: false });
                          }
                        },
                          h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "#d9534f", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                            h("polyline", { points: "16 18 22 12 16 6" }),
                            h("polyline", { points: "8 6 2 12 8 18" })
                          ),
                          "Copy (XML)"
                        )
                      )
                    ) : null,
                    model.canCopy() ? h("button", { className: "slds-button slds-button_neutral", onClick: this.onDownloadAsCsv },
                      h("svg", { className: "slds-button__icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                        h("polyline", { points: "7 10 12 15 17 10" }),
                        h("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
                      ),
                      h("span", { className: "sfir-btn-label" }, "CSV")
                    ) : null,                    model.canCopy() ? h("button", { className: "slds-button slds-button_neutral", onClick: this.onPrefHideRelationsChange },
                      model.prefHideRelations
                        ? h("svg", { className: "slds-button__icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            h("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
                            h("circle", { cx: "12", cy: "12", r: "3" })
                          )
                        : h("svg", { className: "slds-button__icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            h("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }),
                            h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
                          ),
                      h("span", { className: "sfir-btn-label" }, model.prefHideRelations ? "Show columns" : "Hide columns")
                    ) : null,
                    model.canCopy() ? h("button", {
                      className: "slds-button slds-button_neutral" + (this.state.showResultInsights ? " active" : ""),
                      onClick: () => this.setState({showResultInsights: !this.state.showResultInsights}),
                      title: "Sort, pin, group, and inspect column statistics"
                    }, h("i", {className: "fa-solid fa-chart-column", style: {marginRight: "6px"}}), "Analyze") : null,
                  model.exportedData && model.exportedData.table[0]?.length > 0 && !model.exportError ? h("div", {
                    className: "slds-form-element result-bar-filter-container" + (this.state.isDropdownOpen ? " is-expanded" : "")
                  },
                    h("div", { className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left slds-button-group" },
                      h("input", {
                        className: "slds-input result-filter-input slds-m-around_none",
                        placeholder: model.filterColumns?.length > 0
                          ? `Filter (${model.filterColumns.length})`
                          : "Filter",
                        type: "search",
                        value: model.resultsFilter,
                        onInput: this.onResultsFilterInput
                      }),
                      h("button", {
                        type: "button",
                        className: "result-filter-toggle" + (this.state.isDropdownOpen ? " active" : ""),
                        title: "Filter by specific column(s)",
                        disabled: !model.exportedData,
                        onClick: () => this.setState({ isDropdownOpen: !this.state.isDropdownOpen })
                      },
                        h("svg", {
                          viewBox: "0 0 24 24",
                          width: "14",
                          height: "14",
                          style: {
                            fill: "currentColor",
                            flexShrink: 0,
                            transform: this.state.isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease"
                          }
                        },
                          h("path", { d: "M7 10l5 5 5-5z" })
                        )
                      ),
                      this.state.isDropdownOpen && h("div", {
                        className: "sfir-col-filter-dropdown",
                        onClick: (e) => e.stopPropagation()
                      },
                        h("div", { className: "sfir-col-filter-header" },
                          h("div", { className: "sfir-col-filter-title-group" },
                            h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", style: { fill: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))", flexShrink: 0 } },
                              h("path", { d: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" })
                            ),
                            h("span", { className: "sfir-col-filter-title" }, "Filter by Column"),
                            model.filterColumns?.length > 0
                              ? h("span", { className: "sfir-col-filter-count-badge" }, `${model.filterColumns.length} selected`)
                              : h("span", { className: "sfir-col-filter-count-badge muted" }, "All Columns")
                          ),
                          h("div", { className: "sfir-col-filter-actions" },
                            h("span", {
                              role: "button",
                              tabIndex: 0,
                              className: "sfir-col-action-link",
                              onClick: () => {
                                let allCols = (model.exportedData?.table[0] || []).filter(c => c !== "_" && c !== "_actions");
                                model.filterColumns = [...allCols];
                                model.setResultsFilter(model.resultsFilter);
                                this.setState({});
                              }
                            }, "Select All"),
                            h("span", { className: "sfir-col-action-sep" }, "•"),
                            h("span", {
                              role: "button",
                              tabIndex: 0,
                              className: "sfir-col-action-link danger",
                              onClick: () => {
                                model.filterColumns = [];
                                model.setResultsFilter(model.resultsFilter);
                                this.setState({});
                              }
                            }, "Clear")
                          )
                        ),
                        h("div", { className: "sfir-col-filter-search-box" },
                          h("svg", { viewBox: "0 0 24 24", width: "13", height: "13", className: "sfir-search-icon" },
                            h("path", { fill: "#94a3b8", d: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" })
                          ),
                          h("input", {
                            type: "text",
                            className: "sfir-col-search-input",
                            placeholder: "Search columns...",
                            value: this.state.colFilterSearchText || "",
                            onInput: (e) => this.setState({ colFilterSearchText: e.target.value })
                          }),
                          this.state.colFilterSearchText ? h("button", {
                            type: "button",
                            className: "sfir-col-search-clear",
                            onClick: () => this.setState({ colFilterSearchText: "" })
                          }, "✕") : null
                        ),
                        h("div", { className: "sfir-col-filter-list" },
                          (() => {
                            let search = (this.state.colFilterSearchText || "").toLowerCase().trim();
                            let cols = (model.exportedData?.table[0] || []).filter(c => c !== "_" && c !== "_actions");
                            let filtered = cols.filter(c => !search || c.toLowerCase().includes(search));
                            if (filtered.length === 0) {
                              return h("div", { className: "sfir-col-empty" }, "No matching columns");
                            }
                            return filtered.map(column => {
                              let isChecked = model.filterColumns?.includes(column) || false;
                              return h("label", {
                                key: column,
                                className: `sfir-col-filter-item ${isChecked ? "selected" : ""}`,
                                onClick: (e) => {
                                  e.preventDefault();
                                  if (isChecked) {
                                    model.filterColumns = model.filterColumns.filter(c => c !== column);
                                  } else {
                                    model.filterColumns = [...(model.filterColumns || []), column];
                                  }
                                  model.setResultsFilter(model.resultsFilter);
                                  this.setState({});
                                }
                              },
                                h("input", {
                                  type: "checkbox",
                                  className: "sfir-col-checkbox",
                                  checked: isChecked,
                                  onChange: () => { }
                                }),
                                h("span", { className: "sfir-col-name" }, column)
                              );
                            });
                          })()
                        )
                      )
                    )
                  ) : null
                  )
                ),
                // Right Side Controls: Annotation Toolbar & Delete Records Button
                h("div", { className: "result-bar-right-controls" },
                  // --- Annotation Toolbar Buttons ---
                  // Separator
                  model.canCopy() ? h("div", { style: { width: "1px", height: "20px", background: "#d8dde6", margin: "0 4px", display: "inline-block", verticalAlign: "middle" } }) : null,
                    // Highlight Button with Color Picker Popover
                    model.canCopy() ? h("div", { style: { position: "relative", display: "inline-block" } },
                      h("button", {
                        className: "slds-button slds-button_neutral sfir-annot-btn" + (this.state.highlightMode ? " sfir-annot-btn--active" : ""),
                        onClick: this.onToggleHighlightMode,
                        title: this.state.highlightMode ? "Exit Highlight Mode (click any cell to highlight it)" : "Highlight Cell — click to pick a color, then click any cell"
                      },
                        h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "slds-button__icon slds-button__icon_left" },
                          h("path", { d: "M12 2a7 7 0 0 1 7 7c0 3.25-2.28 6-5.5 7.5L12 22l-1.5-5.5C7.28 15 5 12.25 5 9a7 7 0 0 1 7-7z", fill: this.state.pendingColor, stroke: this.state.pendingColor }),
                          h("circle", { cx: "12", cy: "9", r: "2.5", fill: "white", stroke: "none" })
                        ),
                        "Highlight",
                        h("svg", { viewBox: "0 0 24 24", width: "10", height: "10", fill: "currentColor", stroke: "none", style: { marginLeft: "3px" } },
                          h("path", { d: "M7 10l5 5 5-5z" })
                        )
                      ),
                      // Color Picker Popover
                      this.state.showColorPicker ? h("div", {
                        className: "sfir-color-picker-popover",
                        onClick: (e) => e.stopPropagation()
                      },
                        // --- Highlight Type Toggle ---
                        h("div", { className: "sfir-hl-type-toggle" },
                          h("button", {
                            className: "sfir-hl-type-btn" + (this.state.highlightType === "background" ? " active" : ""),
                            onClick: () => this.setState({ highlightType: "background" }),
                            title: "Fill cell with background color"
                          },
                            h("svg", { viewBox: "0 0 24 24", width: "13", height: "13", fill: this.state.highlightType === "background" ? this.state.pendingColor : "currentColor", stroke: "none" },
                              h("rect", { x: "2", y: "2", width: "20", height: "20", rx: "3" })
                            ),
                            "Background"
                          ),
                          h("button", {
                            className: "sfir-hl-type-btn" + (this.state.highlightType === "border" ? " active" : ""),
                            onClick: () => this.setState({ highlightType: "border" }),
                            title: "Outline cell with a colored border"
                          },
                            h("svg", { viewBox: "0 0 24 24", width: "13", height: "13", fill: "none", stroke: this.state.highlightType === "border" ? this.state.pendingColor : "currentColor", strokeWidth: "2.5" },
                              h("rect", { x: "2", y: "2", width: "20", height: "20", rx: "3" })
                            ),
                            "Border"
                          )
                        ),
                        h("div", { className: "sfir-color-picker-title" },
                          h("svg", { viewBox: "0 0 24 24", width: "12", height: "12", fill: "none", stroke: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))", strokeWidth: "2" }, h("path", { d: "M12 2a7 7 0 0 1 7 7c0 3.25-2.28 6-5.5 7.5L12 22l-1.5-5.5C7.28 15 5 12.25 5 9a7 7 0 0 1 7-7z" })),
                          "Pick Color"
                        ),
                        h("div", { className: "sfir-color-swatches" },
                          [
                            { color: "#fbbf24", label: "Amber" },
                            { color: "#34d399", label: "Emerald" },
                            { color: "#60a5fa", label: "Blue" },
                            { color: "#f87171", label: "Red" },
                            { color: "#c084fc", label: "Purple" },
                            { color: "#fb923c", label: "Orange" },
                            { color: "#a3e635", label: "Lime" },
                            { color: "#f9a8d4", label: "Pink" },
                            { color: "#94a3b8", label: "Slate" },
                          ].map(({ color, label }) =>
                            h("button", {
                              key: color,
                              className: "sfir-color-swatch" + (this.state.pendingColor === color ? " selected" : ""),
                              style: {
                                backgroundColor: color,
                                border: this.state.pendingColor === color ? "2px solid var(--sfarc-accent, var(--sfarc-accent, #2196f3))" : "2px solid rgba(0,0,0,0.12)",
                                boxShadow: this.state.pendingColor === color ? "0 0 0 3px rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.35)" : "none"
                              },
                              title: label,
                              onClick: () => this.onApplyHighlight(color)
                            })
                          )
                        ),
                        h("div", { className: "sfir-color-picker-custom" },
                          h("label", { className: "sfir-color-picker-custom-label" }, "Custom:"),
                          h("input", {
                            type: "color",
                            value: this.state.pendingColor,
                            className: "sfir-color-custom-input",
                            onChange: (e) => this.onApplyHighlight(e.target.value)
                          })
                        ),
                        h("div", { className: "sfir-color-picker-tip" },
                          this.state.highlightType === "border"
                            ? "✓ Click any cell to outline its border. Click again to remove."
                            : "✓ Click any cell to fill its background. Click again to remove."
                        )
                      ) : null
                    ) : null,
                    // Clear All Annotations Button
                    model.canCopy() && this.cellMeta && this.cellMeta.size > 0 ? h("button", {
                      className: "slds-button slds-button_neutral sfir-annot-btn sfir-annot-btn--clear",
                      onClick: this.onClearAnnotations,
                      title: "Clear all highlights"
                    },
                      h("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "slds-button__icon slds-button__icon_left" },
                        h("path", { d: "M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" }),
                        h("line", { x1: "18", y1: "9", x2: "12", y2: "15" }),
                        h("line", { x1: "12", y1: "9", x2: "18", y2: "15" })
                      ),
                      "Clear"
                    ) : null,
                    // Time badge (between Highlight and Delete Records)
                    model.canCopy() && perf ? h("span", { className: "sfir-time-badge", title: perf.batchStats }, perf.text) : null,
                    // Delete Records Button (at the end)
                    isOptionEnabled("delete", this.state.hideButtonsOption)
                      ? h("div", { style: { width: "1px", height: "20px", background: "#d8dde6", margin: "0 4px", display: "inline-block", verticalAlign: "middle" } })
                      : null,
                    isOptionEnabled("delete", this.state.hideButtonsOption)
                      ? h("button", { className: "slds-button slds-button_destructive", disabled: !model.canDelete(), onClick: this.onDeleteRecords, title: "Open the 'Data Import' page with preloaded records to delete (< 20k records). 'Id' field needs to be queried" },
                        h("svg", { className: "slds-button__icon slds-button__icon_left", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                          h("polyline", { points: "3 6 5 6 21 6" }),
                          h("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
                        ),
                        "Delete Records"
                      ) : null
                )
              )
            ),
            this.state.showResultInsights && model.canCopy() ? (() => {
              const insights = this.getResultInsights();
              const headers = insights.columns.map(column => column.name);
              return h("div", {className: "sfir-result-insights"},
                h("div", {className: "sfir-insight-controls"},
                  h("label", null, "Sort", h("select", {value: this.state.resultSortColumn, onChange: e => this.applyResultSort(e.target.value, this.state.resultSortDirection)}, h("option", {value: ""}, "Select column"), headers.map(name => h("option", {key: name, value: name}, name)))),
                  h("button", {type: "button", onClick: () => { const direction = this.state.resultSortDirection === "asc" ? "desc" : "asc"; this.applyResultSort(this.state.resultSortColumn, direction); }}, this.state.resultSortDirection === "asc" ? "↑ Asc" : "↓ Desc"),
                  h("label", null, "Pin first", h("select", {value: this.state.resultPinnedColumn, onChange: e => this.pinResultColumn(e.target.value)}, h("option", {value: ""}, "Select column"), headers.map(name => h("option", {key: name, value: name}, name)))),
                  h("label", null, "Group summary", h("select", {value: this.state.resultGroupColumn, onChange: e => this.setState({resultGroupColumn: e.target.value})}, h("option", {value: ""}, "None"), headers.map(name => h("option", {key: name, value: name}, name))))
                ),
                insights.groups.length ? h("div", {className: "sfir-group-summary"}, insights.groups.map(group => h("span", {key: group.value}, `${group.value}: ${group.count}`))) : null,
                h("div", {className: "sfir-stat-grid"}, insights.columns.map(column => h("div", {className: "sfir-stat-card", key: column.name},
                  h("strong", null, column.name),
                  h("span", null, `${column.count} values · ${column.distinct} distinct · ${column.blank} blank`),
                  column.sum == null ? null : h("span", null, `Sum ${column.sum.toLocaleString()} · Avg ${column.average.toLocaleString(undefined, {maximumFractionDigits: 2})} · Min ${column.min.toLocaleString()} · Max ${column.max.toLocaleString()}`)
                )))
              );
            })() : null,
            h("textarea", {
              className: "slds-box slds-theme_error",
              readOnly: true,
              value: nullToEmptyString(model.exportError),
              hidden: model.exportError == null,
              style: { flex: "1 1 0", minHeight: 0, resize: "none" }
            }),
            h("div", {
              ref: "scroller",
              className: "sfir-table-scroller",
              hidden: model.exportError != null || (!model.exportedData || !model.exportedData.records || model.exportedData.records.length === 0),
              style: { flex: "1 1 0", minHeight: 0, height: "100%", overflowY: "auto" }
            }),
            // Empty state text when no results
            (!model.exportedData || !model.exportedData.records || model.exportedData.records.length === 0) && !model.isWorking && !model.exportError
              ? h("div", { className: "sfir-empty-state", style: { flex: "1 1 auto", height: "100%", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", color: "var(--sfarc-secondary-text, #94a3b8)", opacity: 0.7, margin: "auto" } },
                  h("svg", { viewBox: "0 0 24 24", width: "40", height: "40", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", style: { marginBottom: "12px", opacity: 0.5 } },
                    h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                    h("polyline", { points: "14 2 14 8 20 8" }),
                    h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
                    h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
                    h("polyline", { points: "10 9 9 9 8 9" })
                  ),
                  h("div", { style: { fontSize: "14px", fontWeight: 600, marginBottom: "4px" } }, "No results yet"),
                  h("div", { style: { fontSize: "12px", opacity: 0.7 } }, "Run a query to see results here")
                )
              : null,
            model.isWorking ? h("div", { className: "sfir-result-table-footer" },
              h("div", { className: "sfir-table-footer-right result-status" },
                h("button", { className: "slds-button slds-button_destructive", onClick: this.onStopExport }, "Stop")
              )
            ) : null
          )
        ),
        this.state.contextMenu && h("div", {
          className: "context-menu-overlay",
          style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
          onClick: this.onCloseContextMenu,
          onContextMenu: this.onOverlayContextMenu
        }),
        this.state.contextMenu && h("div", {
          className: "slds-dropdown slds-dropdown_left slds-dropdown_small sfir-tab-context-menu",
          style: { position: "fixed", top: this.state.contextMenu.y, left: this.state.contextMenu.x, zIndex: 3000, minWidth: "160px" }
        },
          h("ul", { className: "slds-dropdown__list", role: "menu" },
            h("li", { className: "slds-dropdown__item", role: "presentation" },
              h("a", { href: "#", role: "menuitem", tabIndex: "-1", onClick: (e) => { e.preventDefault(); this.onTabNameEdit(e, this.state.contextMenu.index); this.onCloseContextMenu(); } },
                h("span", { className: "slds-truncate sfir-context-menu-item" },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" })
                  ),
                  "Rename Tab"
                )
              )
            ),
            h("li", { className: "slds-has-divider_top-space", role: "separator" }),
            h("li", { className: "slds-dropdown__item", role: "presentation" },
              h("a", { href: "#", role: "menuitem", tabIndex: "-1", onClick: (e) => { e.preventDefault(); this.onRemoveTab(e, this.state.contextMenu.index); this.onCloseContextMenu(); } },
                h("span", { className: "slds-truncate sfir-context-menu-item" },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                    h("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                  ),
                  "Close Tab"
                )
              )
            ),
            h("li", { className: "slds-dropdown__item", role: "presentation" },
              h("a", { href: "#", role: "menuitem", tabIndex: "-1", onClick: (e) => { e.preventDefault(); this.onRemoveOtherTabs(); } },
                h("span", { className: "slds-truncate sfir-context-menu-item" },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("path", { d: "m12 2 10 6-10 6L2 8Z" }),
                    h("path", { d: "m2 16 10 6 10-6" })
                  ),
                  "Close Others"
                )
              )
            ),
            h("li", { className: "slds-dropdown__item", role: "presentation" },
              h("a", { href: "#", role: "menuitem", tabIndex: "-1", onClick: (e) => { e.preventDefault(); this.onRemoveRightTabs(); } },
                h("span", { className: "slds-truncate sfir-context-menu-item" },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("polyline", { points: "13 17 18 12 13 7" }),
                    h("polyline", { points: "6 17 11 12 6 7" })
                  ),
                  "Close to Right"
                )
              )
            ),
            h("li", { className: "slds-dropdown__item", role: "presentation" },
              h("a", { href: "#", role: "menuitem", tabIndex: "-1", onClick: (e) => { e.preventDefault(); this.onRemoveAllTabs(); } },
                h("span", { className: "slds-truncate sfir-context-menu-item" },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
                    h("line", { x1: "9", y1: "9", x2: "15", y2: "15" }),
                    h("line", { x1: "15", y1: "9", x2: "9", y2: "15" })
                  ),
                  "Close All"
                )
              )
            )
          )
        ),

        // Save Query Modal Overlay
        this.state.showSaveQueryModal && h("div", {
          className: "sfir-modal-overlay" + (this.state.isMinimizingGenie ? " is-genie-minimizing" : ""),
          onClick: () => !this.state.isMinimizingGenie && this.setState({ showSaveQueryModal: false })
        },
          h("div", {
            className: "sfir-save-query-modal" + (this.state.isMinimizingGenie ? " is-genie-minimizing" : ""),
            onClick: (e) => e.stopPropagation()
          },
            h("div", { className: "sfir-modal-header" },
              h("div", { className: "sfir-modal-title-group" },
                h("svg", { viewBox: "0 0 52 52", style: { width: "18px", height: "18px", fill: "var(--sfarc-accent, var(--sfarc-accent, #2196f3))", marginRight: "6px" } },
                  h("use", { xlinkHref: "symbols.svg#bookmark" })
                ),
                h("h3", { className: "sfir-modal-title" }, "Save Query")
              ),
              h("button", {
                type: "button",
                className: "sfir-modal-close-btn",
                onClick: () => this.setState({ showSaveQueryModal: false })
              }, "✕")
            ),
            h("div", { className: "sfir-modal-body" },
              h("label", { className: "sfir-modal-label" }, "Query Name (Auto-Suggested)"),
              h("input", {
                type: "text",
                className: "sfir-modal-input",
                value: this.state.saveQueryName,
                onChange: (e) => this.setState({ saveQueryName: e.target.value }),
                placeholder: "Enter a descriptive name...",
                autoFocus: true,
                onKeyDown: (e) => {
                  if (e.key === "Enter") {
                    this.confirmSaveQuery(e);
                  }
                }
              }),
              h("label", { className: "sfir-modal-label", style: { marginTop: "12px" } }, "Query Preview"),
              h("div", { className: "sfir-modal-code-preview" }, this.state.saveQueryText)
            ),
            h("div", { className: "sfir-modal-footer" },
              h("button", {
                type: "button",
                className: "sfir-modal-cancel-btn",
                onClick: (e) => {
                  if (e) e.stopPropagation();
                  this.setState({ showSaveQueryModal: false });
                }
              }, "Cancel"),
              h("button", {
                type: "button",
                className: "sfir-modal-save-btn",
                onClick: (e) => this.confirmSaveQuery(e)
              }, "Save")
            )
          )
        )),

        // Bottom Slide-Up History & Saved Drawer
        this.state.showHistoryDrawer ? (() => {
          let isSavedTab = this.state.activeHistoryTab === "saved";
          let historyList = isSavedTab ? (model.savedHistory.list || []) : (model.queryHistory.list || []);
          let search = (this.state.historySearchQuery || "").toLowerCase().trim();
          let filteredList = historyList.filter(item => {
            if (!search) return true;
            let q = (item.query || "").toLowerCase();
            let n = (item.name || "").toLowerCase();
            return q.includes(search) || n.includes(search);
          });

          return h("div", {
            className: "sfir-history-dropdown-layer",
            onClick: () => this.setState({ showHistoryDrawer: false })
          },
            h("div", {
              className: "sfir-history-drawer",
              style: this.state.historyDropdownPos || {},
              onClick: (e) => e.stopPropagation()
            },
              // Drawer Header (drag anywhere on the header to move the drawer)
              h("div", {
                className: "sfir-history-drawer-header",
                ref: (el) => this._bindHistoryDrawerDrag(el)
              },
                // Dotted grip — a visual drag handle pinned to the top center
                // of the header. It's part of the header, so pointer events
                // bubble to the same drag binding (and it never steals a
                // click because the drag only engages after >4px movement).
                h("div", { className: "sfir-history-drawer-grip", "aria-hidden": "true" }),
                h("div", { className: "sfir-history-drawer-segmented-control" },
                  h("span", { className: "sfir-history-seg-indicator" + (isSavedTab ? " right" : " left") }),
                  h("button", {
                    type: "button",
                    className: "sfir-segmented-tab" + (!isSavedTab ? " active" : ""),
                    onClick: () => this.setState({ activeHistoryTab: "recent" })
                  }, `History (${model.queryHistory.list.length})`),
                  h("button", {
                    type: "button",
                    className: "sfir-segmented-tab" + (isSavedTab ? " active" : ""),
                    onClick: () => this.setState({ activeHistoryTab: "saved" })
                  }, `★ Saved (${model.savedHistory.list.length})`)
                ),
                h("div", { className: "sfir-history-drawer-search-wrapper" },
                  h("span", { className: "sfir-history-drawer-search-icon" },
                    h("svg", { viewBox: "0 0 24 24", width: "13", height: "13", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                      h("circle", { cx: "11", cy: "11", r: "8" }),
                      h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
                    )
                  ),
                  h("input", {
                    type: "text",
                    className: "sfir-history-drawer-search",
                    placeholder: isSavedTab ? "Search saved queries..." : "Search history queries...",
                    value: this.state.historySearchQuery,
                    autoFocus: true,
                    onInput: (e) => this.setState({ historySearchQuery: e.target.value })
                  })
                ),
                h("div", { className: "sfir-history-drawer-actions" },
                  !isSavedTab ? h("button", {
                    type: "button",
                    className: "sfir-history-drawer-clear-btn",
                    onClick: (e) => this.onClearHistory(e)
                  },
                    h("svg", {
                      width: "15",
                      height: "15",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "2",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      style: { marginRight: "6px", flexShrink: 0 }
                    },
                      h("path", { d: "M3 6h18" }),
                      h("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                      h("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                      h("line", { x1: "14", y1: "11", x2: "14", y2: "17" })
                    ),
                    "Clear History"
                  ) : null,
                  h("button", {
                    type: "button",
                    className: "sfir-history-drawer-close-btn",
                    onClick: () => this.setState({ showHistoryDrawer: false }),
                    title: "Close Drawer"
                  }, "✕")
                )
              ),

              // Drawer Body with tab transition animation
              h("div", { 
                className: "sfir-history-drawer-body",
                key: isSavedTab ? "saved-tab" : "recent-tab"
              },
                filteredList.length === 0
                  ? h("div", { className: "sfir-history-empty-state" },
                    h("div", { className: "sfir-history-empty-icon" },
                      isSavedTab
                        ? h("svg", { viewBox: "0 0 24 24", width: "26", height: "26", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" },
                          h("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" })
                        )
                        : h("svg", { viewBox: "0 0 24 24", width: "26", height: "26", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" },
                          h("circle", { cx: "12", cy: "12", r: "9" }),
                          h("polyline", { points: "12 7 12 12 15.5 14" })
                        )
                    ),
                    h("p", { className: "sfir-history-empty-title" },
                      search
                        ? "No matching queries found"
                        : (isSavedTab ? "No saved queries yet" : "No query history yet")
                    ),
                    h("p", { className: "sfir-history-empty-sub" },
                      search
                        ? "Try a different keyword."
                        : (isSavedTab
                          ? "Click the Save button under the query editor to bookmark queries."
                          : "Run a query and it will appear here automatically."
                        )
                    )
                  )
                  : filteredList.map((item, idx) =>
                    h("div", {
                      key: idx,
                      className: "sfir-history-item" + (isSavedTab ? " sfir-saved-item" : ""),
                      onClick: () => isSavedTab ? this.onSelectSavedItem(item) : this.onSelectHistoryItem(item)
                    },
                      // Col 1 — type badge
                      h("div", { className: "sfir-history-item-type" },
                        h("span", { className: "sfir-history-chip sfir-history-chip-soql" }, "SOQL"),
                        item.useToolingApi ? h("span", { className: "sfir-history-chip sfir-history-chip-tooling" }, "Tooling API") : null
                      ),
                      // Col 2 — query (name sits above it for saved items)
                      h("div", { className: "sfir-saved-item-content" },
                        isSavedTab && h("div", { className: "sfir-saved-item-name" },
                          h("span", { className: "sfir-saved-star" }, "★ "),
                          item.name || "Saved Query"
                        ),
                        // No title attribute here: the global custom-tooltip
                        // system converts [title] into a floating popup, so a
                        // full-query title made hovering a row spawn a tooltip
                        // that just repeats the visible query text.
                        h("div", { className: "sfir-history-item-query" }, item.query)
                      ),
                      // Col 3 — grouped action icons (clicking the row itself
                      // loads the query, so there's no separate Load button)
                      h("div", { className: "sfir-history-item-actions" },
                        h("button", {
                          type: "button",
                          className: "sfir-history-item-delete-btn",
                          title: isSavedTab ? "Delete saved query" : "Delete query",
                          onClick: (e) => {
                            if (isSavedTab) {
                              this.onDeleteSavedItem(e, item);
                            } else {
                              this.onDeleteHistoryItem(e, item);
                            }
                          }
                        },
                          h("svg", {
                            width: "13",
                            height: "13",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            style: { display: "block" }
                          },
                            h("path", { d: "M3 6h18" }),
                            h("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
                          )
                        )
                      )
                    )
                  )
              )
            )
          );
        })() : null,

      this.renderExportQueryModal(),
      this.renderFieldInfoModal(),
      this.state.confirmDialog ? h("div", { className: "sfir-modal-overlay", onClick: () => this.closeConfirm() },
        h("div", { className: "sfir-modal-card sfir-confirm-modal", onClick: (e) => e.stopPropagation() },
          h("div", { className: "sfir-modal-header" },
            h("div", { className: "sfir-modal-title-group" },
              h("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "#ef4444", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                h("path", { d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
              ),
              h("h3", { className: "sfir-modal-title" }, this.state.confirmDialog.title)
            ),
            h("button", { type: "button", className: "sfir-modal-close-btn", onClick: () => this.closeConfirm() }, "\u2715")
          ),
          h("div", { className: "sfir-modal-body" },
            h("p", { style: { color: "var(--sfir-text-secondary, #64748b)", margin: 0, lineHeight: 1.5 } }, this.state.confirmDialog.message)
          ),
          h("div", { className: "sfir-modal-footer" },
            h("button", { type: "button", className: "sfir-modal-cancel-btn", onClick: () => this.closeConfirm() }, "Cancel"),
            h("button", { type: "button", className: "sfir-modal-save-btn sfir-confirm-danger-btn", onClick: () => {
              const fn = this.state.confirmDialog.onConfirm;
              this.closeConfirm();
              if (fn) fn();
            } }, this.state.confirmDialog.confirmLabel)
          )
        )
      ) : null
    );
  }
}

{

  let args = new URLSearchParams(location.search);
  let sfHost = args.get("host");
  let hash = new URLSearchParams(location.hash); //User-agent OAuth flow
  if (!sfHost && hash) {
    sfHost = decodeURIComponent(hash.get("instance_url")).replace(/^https?:\/\//i, "");
  }
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model({ sfHost, args });
    model.reactCallback = cb => {
      ReactDOM.render(h(App, { model, ref: c => { if (c) activeExportApp = c; } }), root, cb);
    };

    // Update host and sfLink after session is established (for OAuth redirect case)
    if (sfConn.instanceHostname && model.sfHost !== sfConn.instanceHostname) {
      model.sfHost = sfConn.instanceHostname;
      model.sfLink = "https://" + sfConn.instanceHostname;
      model.orgName = (model.sfHost || "").split(".")[0]?.toUpperCase() || "";
    }

    ReactDOM.render(h(App, { model, ref: c => { if (c) activeExportApp = c; } }), root);
  });

}

function getSeparator() {
  let separator = ",";
  if (localStorage.getItem("csvSeparator")) {
    separator = localStorage.getItem("csvSeparator");
  }
  return separator;
}

// Theme Synchronization
function initThemeSync() {
  const loadTheme = () => {
    chrome.storage.sync.get(['sfiSettings'], (result) => {
      const settings = result.sfiSettings || {};
      const theme = settings.theme || 'system';
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (document.body) {
        if (isDark) {
          document.body.classList.add('sfarc-dark-theme');
        } else {
          document.body.classList.remove('sfarc-dark-theme');
        }
      }
    });
  };
  if (document.body) {
    loadTheme();
  } else {
    document.addEventListener('DOMContentLoaded', loadTheme);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.sfiSettings) {
      loadTheme();
    }
  });
}
initThemeSync();
