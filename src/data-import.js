/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";

// Hosted inside sfir-shell.html (?sfirEmbed=1): the shell owns the ONE
// persistent top bar and paints THIS page's utility item (Help) into that
// bar itself. This page renders body-only (no PageHeader, no strip); the
// shell forwards the Help action back down via postMessage.
const SFIR_EMBEDDED = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sfirEmbed") === "1";

// The mounted app instance, so the embed message bridge can drive it.
let activeImportApp = null;

if (SFIR_EMBEDDED) {
  try { document.body.classList.add("sfir-embedded"); } catch (_) { /* body not ready */ }
  window.addEventListener("message", (e) => {
    if (e.origin && e.origin !== window.location.origin) return;
    const msg = e.data;
    if (!msg || typeof msg !== "object" || msg.source !== "sfir-shell") return;
    if (msg.type === "sfirUtilsAction" && msg.action === "help") {
      const app = activeImportApp;
      if (app && app.onToggleHelpClick) app.onToggleHelpClick();
    }
  });
}

// The active Model instance (assigned at boot). The runtime listener below
// applies live row updates streamed from the background import engine so the
// table stays in sync while the batch loop runs in the service worker.
let currentImportModel = null;
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;
    const m = currentImportModel;
    if (!m) return;
    // seq guards against stale messages from a replaced job loop.
    if (m.remoteJobSeq != null && msg.seq !== m.remoteJobSeq) return;
    if (msg.action === "sfirImportBatch" && m.remoteRunning && (!m.remoteJobId || msg.jobId === m.remoteJobId)) {
      m.lastRemoteActivity = Date.now();
      m.applyRemoteBatch(msg.updates);
    } else if (msg.action === "sfirImportProgress" && m.remoteRunning && (!m.remoteJobId || msg.jobId === m.remoteJobId)) {
      // Any progress publish proves the background engine is alive.
      m.lastRemoteActivity = Date.now();
      if (msg.finished) {
        m.remoteRunning = false;
        m.remoteJobId = null;
        m.remoteJobSeq = null;
        m.isProcessingQueue = false;
        m.activeBatches = 0;
        m.didUpdate();
      }
    }
  });
}
/* global initButton */
import {csvParse} from "./csv-parse.js";
import {DescribeInfo, initScrollTable} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, createSpinForMethod, copyToClipboard, csvSerialize, downloadCsvFile, getSobjectsList, Constants, applyProductionStyling} from "./utils.js";

const h = React.createElement;

const allApis = [
  {value: "Enterprise", label: "Enterprise (default)"},
  {value: "Tooling", label: "Tooling"},
  {value: "Metadata", label: "Metadata"}
];

const allActions = [
  {value: "create", label: "Insert", supportedApis: ["Enterprise", "Tooling"]},
  {value: "update", label: "Update", supportedApis: ["Enterprise", "Tooling"]},
  {value: "upsert", label: "Upsert", supportedApis: ["Enterprise", "Tooling"]},
  {value: "delete", label: "Delete", supportedApis: ["Enterprise", "Tooling"]},
  {value: "undelete", label: "Undelete", supportedApis: ["Enterprise", "Tooling"]},
  {value: "upsertMetadata", label: "Upsert Metadata", supportedApis: ["Metadata"]},
  {value: "deleteMetadata", label: "Delete Metadata", supportedApis: ["Metadata"]}
];

const headersTemplates = [
  '{"OwnerChangeOptions": {"options": [{"type": "KeepAccountTeam", "execute": true}]}}',
  '{"AssignmentRuleHeader": {"useDefaultRule": true}}',
  '{"DuplicateRuleHeader": {"allowSave": true}}'
];

// localStorage key (scoped per org) holding the full import state so the
// pasted/imported data survives a page refresh. Only the raw serializable
// pieces are stored; column VM methods are rebuilt on restore.
const importStorageKey = (sfHost) => "sfarcImportData_" + sfHost;

class Model {

  constructor(sfHost, args) {
    this.sfHost = sfHost;
    this.importData = undefined;
    // Persistence is armed only after the constructor has finished restoring
    // state, so the initial updateResult(null) can't wipe a saved snapshot.
    this._ready = false;
    this.consecutiveFailures = 0;

    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.orgName = (this.sfHost || "").split(".")[0]?.toUpperCase() || "";
    this.dataError = "";
    this.apiType = "Enterprise";
    this.dataFormat = "excel";
    this.importActionSelected = false;
    this.updateAvailableActions();
    this.importType = "Account";
    this.externalId = "Id";
    this.batchSize = localStorage.getItem("defaultBatchSize") ? localStorage.getItem("defaultBatchSize") : "200";
    this.batchConcurrency = localStorage.getItem("defaultThreadSize") ? localStorage.getItem("defaultThreadSize") : "6";
    this.performancePreset = localStorage.getItem("sfarcImportPerformance") || "fast";
    this.emptyValuesAsNull = localStorage.getItem("sfarcImportEmptyAsNull") !== "false";
    this.confirmPopup = null;
    this.activeBatches = 0;
    this.isProcessingQueue = false;
    // Background-engine (service worker) mode: when active, the batch loop
    // runs in the SW so the import keeps processing across tab switches.
    this.remoteRunning = false;
    this.remoteJobId = null;
    this.remoteJobSeq = null;
    this._useRemoteEngine = false;
    this._lastPersistAt = 0;
    this._persistTimer = null;
    this.lastRemoteActivity = Date.now();
    // Watchdog: if the background engine stops publishing (crashed SW, killed
    // job, browser sleep), detect it and resume processing locally instead of
    // leaving the import stuck on "paused".
    this._remoteWatchdogTimer = setInterval(() => this.checkRemoteHealth(), 5000);
    this.importState = null;
    this.greyOutSkippedColumns = localStorage.getItem("greyOutSkippedColumns") === "true";
    this.showStatus = {
      Queued: true,
      Processing: true,
      Succeeded: true,
      Failed: true,
      Uncertain: true
    };
    if (args.has("sobject")) {
      this.importType = args.get("sobject");
    }
    applyProductionStyling(sfHost);
    this.isTopSectionCollapsed = false;
    this.importTableResult = null;
    // ── Excel-like table editing toolbar state ──
    this.excelOpen = false;
    this.excelSelection = null;          // {r, c} table coords of the active cell
    this.excelSelectedRows = new Set();  // selected data rows (table row numbers, 1-based)
    this.excelCellRow = "";
    this.excelCellCol = "";
    this.excelCellValue = "";
    this.excelBulkCol = "";
    this.excelBulkValue = "";
    this.excelBulkScope = "all";         // all | selected | range
    this.excelBulkRange = "";
    this.excelDelRows = "";
    this.excelDelCol = "";
    this.excelMsg = "";
    this.updateResult(null);

    // When the page is closed / navigated away mid-run, immediately mark the
    // global top progress as "paused" (instead of leaving a frozen % for the
    // staleness timer to catch) and persist the latest snapshot so returning
    // to this page auto-resumes the import.
    addEventListener('pagehide', () => {
      if (this.isWorking() && !this.remoteRunning) {
        try { this.persistImportData(); } catch (e) { /* ignore */ }
        if (window.__sfirTopProgress) {
          const counts = this.importData && this.importData.counts
            ? this.importData.counts
            : {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0};
          const total = counts.Queued + counts.Processing + counts.Succeeded + counts.Failed + (counts.Uncertain || 0);
          const done = counts.Succeeded + counts.Failed + (counts.Uncertain || 0);
          const meta = this.importProgressMeta();
          window.__sfirTopProgress.set({
            running: true,
            paused: true,
            page: 'data-import',
            label: meta.label,
            action: meta.action,
            percent: total > 0 ? Math.round(done / total * 100) : 0,
            counts
          });
        }
      } else if (!this.isWorking()) {
        // Import already finished and the 4s confirmation timer died with this
        // page — don't leave a frozen "Import finished" pill in storage that
        // every other page would keep re-rendering forever.
        clearTimeout(this._progressHideTimer);
        if (window.__sfirTopProgress) window.__sfirTopProgress.set({running: false});
      } else if (this.remoteRunning) {
        // The service worker owns the run — it keeps processing in the
        // background. Just save the latest table snapshot for display.
        try { this.persistImportData(); } catch (e) { /* ignore */ }
      }
    });

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => { this.refreshColumn(); });
    this.sobjectsList = null;
    getSobjectsList(sfHost).then((sobjectsList) => {
      this.sobjectsList = sobjectsList;
      this.didUpdate();
    });

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    let apiTypeParam = args.get("apitype");
    this.apiType = this.importType.endsWith("__mdt") ? "Metadata" : apiTypeParam ? apiTypeParam : "Enterprise";

    if (args.has("data")) {
      let data = atob(args.get("data"));
      this.dataFormat = "csv";
      this.setData(data);
      this.updateAvailableActions();
      this.importAction = this.importType.endsWith("__mdt") ? "deleteMetadata" : "delete";
      this.importActionName = this.importType.endsWith("__mdt") ? "Delete Metadata" : "Delete";
      this.skipAllUnknownFields();
      // A fresh import supersedes any previously saved snapshot.
      try {
        localStorage.removeItem(importStorageKey(this.sfHost));
      } catch (e) { /* ignore */ }
    } else {
      // Restore a previously pasted/imported dataset so it survives a refresh.
      this.restoreImportData();
    }

    this._ready = true;
    this.persistImportData();
    // If an import was in flight when this page closed, resume it now that the
    // model is ready. Prefer the background (service worker) job when one is
    // live; otherwise resume from the persisted snapshot.
    this.tryAdoptRemoteJob();
  }

  destroy() {
    if (this._remoteWatchdogTimer) {
      clearInterval(this._remoteWatchdogTimer);
      this._remoteWatchdogTimer = null;
    }
    clearTimeout(this._progressHideTimer);
    clearTimeout(this._persistTimer);
    clearTimeout(this._autoResumeTimer);
    clearTimeout(this.excelMsgTimer);
    if (this._progressTicker) {
      clearInterval(this._progressTicker);
      this._progressTicker = null;
    }
  }

  // ── Refresh survival: save/restore the full import state ────────────────
  // Saves the raw serializable import state (column metadata, cells, row
  // statuses, and the import configuration) so a page refresh doesn't lose
  // pasted or imported data. Column VM methods are re-created on restore.
  persistImportData() {
    if (!this._ready) return;
    try {
      if (!this.importData || !this.importData.importTable || !this.importData.importTable.header) {
        try {
          localStorage.removeItem(importStorageKey(this.sfHost));
        } catch (e) { /* ignore */ }
        return;
      }
      const {header, data} = this.importData.importTable;
      const snapshot = {
        savedAt: Date.now(),
        header: header.map(c => ({
          columnIndex: c.columnIndex,
          columnValue: c.columnValue,
          columnOriginalValue: c.columnOriginalValue
        })),
        data,
        counts: this.importData.counts,
        taggedRows: this.importData.taggedRows,
        // Remember an in-flight run so a reload / tab switch auto-resumes it.
        isProcessingQueue: this.isProcessingQueue || this.activeBatches > 0,
        showStatus: this.showStatus,
        importAction: this.importAction,
        importActionName: this.importActionName,
        importActionSelected: this.importActionSelected,
        apiType: this.apiType,
        importType: this.importType,
        externalId: this.externalId,
        dataFormat: this.dataFormat,
        dataPreview: this.dataPreview
      };
      localStorage.setItem(importStorageKey(this.sfHost), JSON.stringify(snapshot));
    } catch (e) {
      // localStorage quota exceeded (very large datasets): drop the snapshot
      // rather than keeping a stale/partial one. The in-session data is intact.
      try {
        localStorage.removeItem(importStorageKey(this.sfHost));
      } catch (e2) { /* ignore */ }
    }
  }

  restoreImportData() {
    let raw;
    try {
      raw = localStorage.getItem(importStorageKey(this.sfHost));
    } catch (e) { return; }
    if (!raw) return;
    try {
      const snap = JSON.parse(raw);
      if (!snap || !snap.header || !snap.data) {
        return;
      }
      const header = snap.header.map((c, i) => {
        const col = this.makeColumn(c.columnOriginalValue, i);
        col.columnValue = c.columnValue;
        return col;
      });
      this.importData = {
        importTable: {header, data: snap.data},
        counts: snap.counts || {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0},
        taggedRows: snap.taggedRows
      };
      if (snap.showStatus) this.showStatus = Object.assign({}, this.showStatus, snap.showStatus);
      if (snap.importAction) {
        this.importAction = snap.importAction;
        this.importActionName = snap.importActionName || snap.importAction;
        this.importActionSelected = true;
      }
      if (snap.apiType) this.apiType = snap.apiType;
      if (snap.importType) this.importType = snap.importType;
      if (snap.externalId) this.externalId = snap.externalId;
      if (snap.dataFormat) this.dataFormat = snap.dataFormat;
      if (snap.dataPreview) this.dataPreview = snap.dataPreview;
      if (snap.isProcessingQueue) {
        this._pendingResume = true;
      }
      this.updateAvailableActions();
      this.updateImportTableResult();
    } catch (e) {
      // Corrupt snapshot: discard it so the user starts fresh.
      try {
        localStorage.removeItem(importStorageKey(this.sfHost));
      } catch (e2) { /* ignore */ }
    }
  }

  // set available actions based on api type, and set the first one as the default
  updateAvailableActions() {
    this.availableActions = allActions.filter(action => action.supportedApis.includes(this.apiType));
    if (!this.importActionSelected || !this.availableActions.some(a => a.value === this.importAction)) {
      this.importAction = this.availableActions[0].value;
      this.importActionName = this.availableActions[0].label;
    }
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


  getFormat(text) {
    const trimmedText = text.trim();

    if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
      try {
        JSON.parse(trimmedText);
        return "json";
      } catch (e) {
        this.errorText = e;
      }
    }
    if (trimmedText.includes("\t")) {
      return "excel";
    }
    if (trimmedText.includes(",") && !trimmedText.includes("\t")) {
      return "csv";
    }
    return "";
  }


  setData(text) {
    if (this.isWorking()) {
      return;
    }
    this.dataFormat = this.getFormat(text);
    if (this.dataFormat == "json") {
      text = this.getDataFromJson(text);
    }
    let csvSeparator = ",";
    if (localStorage.getItem("csvSeparator")) {
      csvSeparator = localStorage.getItem("csvSeparator");
    }
    let separator = this.dataFormat == "excel" ? "\t" : csvSeparator;
    let data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      this.dataError = "" + e.message;
      this.updateResult(null);
      return;
    }

    return this.setParsedRows(data, separator);
  }

  setParsedRows(data, separator) {

    if (data[0] && data[0][0] && data[0][0].trimStart().startsWith("salesforce-inspector-import-options")) {
      let importOptions = new URLSearchParams(data.shift()[0].trim());
      if (importOptions.get("useToolingApi") == "1") this.apiType = "Tooling";
      if (importOptions.get("useToolingApi") == "0") this.apiType = "Enterprise";
      // Keep the above two checks, in order to support old import options
      if (allApis.some(api => api.value == importOptions.get("apiType"))) this.apiType = importOptions.get("apiType");
      if (importOptions.get("action") == "create") this.importAction = "create";
      if (importOptions.get("action") == "update") this.importAction = "update";
      if (importOptions.get("action") == "upsert") this.importAction = "upsert";
      if (importOptions.get("action") == "delete") this.importAction = "delete";
      if (importOptions.get("object")) this.importType = importOptions.get("object");
      if (importOptions.get("externalId") && this.importAction == "upsert") this.externalId = importOptions.get("externalId");
      if (importOptions.get("batchSize")) this.batchSize = importOptions.get("batchSize");
      if (importOptions.get("threads")) this.batchConcurrency = importOptions.get("threads");
    }

    if (data.length < 2) {
      this.dataError = "No records to import";
      this.updateResult(null);
      return;
    }
    const rawHeader = data[0].map(value => String(value || "").trim());
    const emptyHeaderIndex = rawHeader.findIndex(value => !value);
    if (emptyHeaderIndex >= 0) {
      this.dataError = `Column ${emptyHeaderIndex + 1} has an empty header`;
      this.updateResult(null);
      return;
    }
    const seenHeaders = new Set();
    const duplicateHeader = rawHeader.find(value => {
      const key = value.toLowerCase();
      if (seenHeaders.has(key)) return true;
      seenHeaders.add(key);
      return false;
    });
    if (duplicateHeader) {
      this.dataError = `Duplicate header: ${duplicateHeader}`;
      this.updateResult(null);
      return;
    }
    const expectedColumns = rawHeader.length;
    const unevenRowIndex = data.slice(1).findIndex(row => row.length !== expectedColumns);
    if (unevenRowIndex >= 0) {
      const actual = data[unevenRowIndex + 1].length;
      this.dataError = `Row ${unevenRowIndex + 2} has ${actual} columns; expected ${expectedColumns}`;
      this.updateResult(null);
      return;
    }
    this.dataError = "";
    let header = data.shift().map((c, index) => this.makeColumn(c, index));
    // Keep a short preview of the pasted data for the dropzone label
    this.dataPreview = [header.map(c => c.columnValue).join(separator)]
      .concat(data.slice(0, 2).map(row => row.join(separator)))
      .join("\n");
    this.updateResult(null); // Two updates, the first clears state from the scrolltable
    this.updateResult({header, data});

    //automatically select the SObject if possible
    let sobj = this.getSObject(data);
    if (sobj) {
      //We avoid overwriting the Tooling option in case it was already set
      this.apiType = sobj.endsWith("__mdt") ? "Metadata" : this.apiType === "Tooling" ? "Tooling" : "Enterprise";
      this.updateAvailableActions();
      this.importType = sobj;
    }
    //automatically select update if header contains id
    if (this.hasIdColumn(header) && !this.importActionSelected && this.apiType != "Metadata") {
      this.importAction = "update";
      this.importActionName = "Update";
    }
    this.refreshColumn();
    this.updateResult(this.importData.importTable);
  }

  getDataFromJson(json) {
    json = JSON.parse(json);
    let fields = ["_"].concat(Object.keys(json[0]));
    fields = fields.filter(field => field != "attributes");

    let separator = ",";
    if (localStorage.getItem("csvSeparator")) {
      separator = localStorage.getItem("csvSeparator");
    }

    let sobject = json[0]?.attributes?.type;
    if (!sobject) {
      // Remove the "_" column if no sobject type
      fields = fields.filter(field => field != "_");
    }

    let csv = json
      .map((row) => fields
        .map((fieldName) => {
          const ignore = fieldName == "_";
          let value = ignore ? sobject : row[fieldName];
          if (typeof value == "boolean" || (value && typeof value !== "object")) {
            return ignore ? `"[${sobject}]"` : JSON.stringify(value);
          } else {
            return null;
          }
        })
        .filter(value => value !== null)
        .join(separator));
    fields = fields.map(str => `"${str}"`);
    csv.unshift(fields.join(separator));
    csv = csv.join("\r\n");
    return csv;
  }

  copyOptions() {
    let importOptions = new URLSearchParams();
    importOptions.set("salesforce-inspector-import-options", "");
    importOptions.set("apiType", this.apiType);
    importOptions.set("action", this.importAction);
    importOptions.set("object", this.importType);
    if (this.importAction == "upsert") importOptions.set("externalId", this.externalId);
    importOptions.set("batchSize", this.batchSize);
    importOptions.set("threads", this.batchConcurrency);
    copyToClipboard(importOptions.toString());
  }

  skipAllUnknownFields() {
    for (let column of this.importData.importTable.header) {
      if (column.columnUnknownField() || column.columnError()) {
        column.columnSkip();
      }
    }
    this.didUpdate();
  }

  // Used only for requried fields that will prevent us from building a valid API request or definitely cause an error if missing.
  getRequiredMissingFields() {
    let missingFields = [];

    if (!this.importIdColumnValid()) {
      missingFields.push(this.idFieldName());
    }

    if (this.apiType == "Metadata" && this.importAction == "upsertMetadata" && !this.columns().some(c => c.columnValue == "MasterLabel")) {
      missingFields.push("MasterLabel");
    }
    return missingFields;
  }

  invalidInput() {
    // We should try to allow imports to succeed even if our validation logic does not exactly match the one in Salesforce.
    // We only hard-fail on errors that prevent us from building the API request.
    // When possible, we submit the request with errors and let Salesforce give a descriptive message in the response.
    return !this.importData.importTable || !this.importData.importTable.header.every(col => col.columnIgnore() || col.columnValid()) || this.getRequiredMissingFields().length > 0 || !!this.customHeadersError();
  }

  customHeadersError() {
    const value = String(this.customHeaders || "").trim();
    if (!value) return "";
    try {
      const parsed = JSON.parse(value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return "Custom headers must be a JSON object";
      return "";
    } catch (error) {
      return "Invalid JSON: " + error.message;
    }
  }

  isWorking() {
    return this.remoteRunning || this.activeBatches != 0 || this.isProcessingQueue;
  }

  columns() {
    return this.importData.importTable ? this.importData.importTable.header : [];
  }

  sobjectList() {
    const hardcodedObjectsPrefix = ["01Z", "00O"];//Dashboard and Report can be deleted
    // Use cached sobjects list from utils (like popup.js) to avoid redundant API call
    if (this.sobjectsList && this.sobjectsList.length > 0) {
      if (this.apiType == "Metadata") {
        return this.sobjectsList.filter(sobject => sobject.name.endsWith("__mdt"));
      }
      const useToolingApi = this.apiType == "Tooling";
      const requiredApi = useToolingApi ? "toolingApi" : "regularApi";

      return this.sobjectsList.filter(
        sobject => (sobject.availableApis || []).includes(requiredApi)
          && (sobject.createable || sobject.deletable || sobject.updateable || hardcodedObjectsPrefix.includes(sobject.keyPrefix))
      );
    }
    // Fallback to DescribeInfo when cache not yet loaded or disabled
    let {globalDescribe} = this.describeInfo.describeGlobal(this.apiType == "Tooling");
    if (!globalDescribe) {
      return [];
    }

    if (this.apiType == "Metadata") {
      return globalDescribe.sobjects
        .filter(sobjectDescribe => sobjectDescribe.name.endsWith("__mdt"));
    } else {
      return globalDescribe.sobjects
        .filter(sobjectDescribe => sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable || hardcodedObjectsPrefix.includes(sobjectDescribe.keyPrefix));
    }
  }

  idLookupList() {
    let sobjectName = this.importType;
    let sobjectDescribe = this.describeInfo.describeSobject(this.apiType == "Tooling", sobjectName).sobjectDescribe;

    if (!sobjectDescribe) {
      return [];
    }
    return sobjectDescribe.fields.filter(field => field.idLookup).map(field => field.name);
  }

  columnList() {
    let self = this;
    return Array.from(function* () {
      let importAction = self.importAction;

      if (importAction == "delete" || importAction == "undelete") {
        yield "Id";
      } else if (importAction == "deleteMetadata") {
        yield "DeveloperName";
      } else {
        let sobjectName = self.importType;
        let sobjectDescribe = self.describeInfo.describeSobject(self.apiType == "Tooling", sobjectName).sobjectDescribe;
        if (sobjectDescribe) {
          let idFieldName = self.idFieldName();
          for (let field of sobjectDescribe.fields) {
            if (field.createable || field.updateable) {
              yield field.name;
              for (let referenceSobjectName of field.referenceTo) {
                let referenceSobjectDescribe = self.describeInfo.describeSobject(self.apiType == "Tooling", referenceSobjectName).sobjectDescribe;
                if (referenceSobjectDescribe) {
                  for (let referenceField of referenceSobjectDescribe.fields) {
                    if (referenceField.idLookup) {
                      yield field.relationshipName + ":" + referenceSobjectDescribe.name + ":" + referenceField.name;
                    }
                  }
                }
              }
            } else if (field.idLookup && field.name.toLowerCase() == idFieldName.toLowerCase()) {
              yield field.name;
            } else if (importAction == "upsertMetadata") {
              if (["DeveloperName", "MasterLabel"].includes(field.name) || field.custom) {
                yield field.name;
              }
            }
          }
        }
      }
      yield "__Status";
      yield "__Id";
      yield "__Action";
      yield "__Errors";
    }());
  }

  importIdColumnValid() {
    return this.importAction == "create" || this.inputIdColumnIndex() > -1;
  }

  importTypeError() {
    let importType = this.importType;
    if (!this.sobjectList().some(s => s.name.toLowerCase() == importType.toLowerCase())) {
      return "Unknown object";
    }
    return "";
  }

  externalIdError() {
    let externalId = this.externalId;
    if (!this.idLookupList().some(s => s.toLowerCase() == externalId.toLowerCase())) {
      return "Unknown field or not an external ID";
    }
    return "";
  }

  idFieldName() {
    if (this.importAction == "create") {
      return "";
    } else if (this.importAction == "upsert") {
      return this.externalId;
    } else if (this.apiType == "Metadata") {
      return "DeveloperName";
    } else {
      return "Id";
    }
  }

  inputIdColumnIndex() {
    let importTable = this.importData.importTable;
    if (!importTable) {
      return -1;
    }
    let idFieldName = this.idFieldName();
    return importTable.header.findIndex(c => c.columnValue.toLowerCase() == idFieldName.toLowerCase());
  }

  batchSizeError() {
    if (!(+this.batchSize > 0)) { // This also handles NaN
      return "Must be a positive number";
    }
    return "";
  }

  batchConcurrencyError() {
    if (!(+this.batchConcurrency > 0)) { // This also handles NaN
      return "Must be a positive number";
    }
    if (+this.batchConcurrency > 6) {
      return "Note: More than 6 threads will not help since Salesforce does not support HTTP2";
    }
    return "";
  }

  applyPerformancePreset(preset) {
    const presets = {
      safe: {batchSize: "50", threads: "1"},
      balanced: {batchSize: "200", threads: "4"},
      fast: {batchSize: "200", threads: "6"}
    };
    const values = presets[preset] || presets.balanced;
    this.performancePreset = preset;
    this.batchSize = values.batchSize;
    this.batchConcurrency = values.threads;
    localStorage.setItem("sfarcImportPerformance", preset);
    localStorage.setItem("defaultBatchSize", this.batchSize);
    localStorage.setItem("defaultThreadSize", this.batchConcurrency);
  }

  canCopy() {
    return this.importData.taggedRows != null;
  }

  canSkipAllUnknownFields() {
    if (this.importData.importTable && this.importData.importTable.header) {
      for (let column of this.importData.importTable.header) {
        if (!column.columnIgnore() && column.columnUnknownField()) {
          return true;
        }
      }
    }
    return false;
  }

  preflightSummary() {
    const table = this.importData && this.importData.importTable;
    if (!table) return null;
    const rows = table.data.length;
    const mapped = table.header.filter(column => !column.columnIgnore() && column.columnValid()).length;
    const unmapped = table.header.filter(column => !column.columnIgnore() && (column.columnUnknownField() || column.columnError())).length;
    const calls = Math.ceil(rows / Math.max(1, +this.batchSize || 1));
    return {rows, mapped, unmapped, calls};
  }

  copyResult(separator) {
    let header = this.importData.importTable.header.map(c => c.columnValue);
    let data = this.importData.taggedRows.filter(row => this.showStatus[row.status]).map(row => row.cells);
    copyToClipboard(csvSerialize([header, ...data], separator));
  }

  downloadResult(status) {
    if (!this.importData || !this.importData.importTable || !this.importData.taggedRows) return;
    const header = this.importData.importTable.header.map(c => c.columnValue);
    const rows = this.importData.taggedRows.filter(row => row.status === status).map(row => row.cells);
    if (!rows.length) return;
    const csv = csvSerialize([header, ...rows], localStorage.getItem("csvSeparator") || ",");
    const objectName = String(this.importType || "records").replace(/[^A-Za-z0-9_.-]/g, "_");
    downloadCsvFile(csv, `${objectName}-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  importCounts() {
    return this.importData.counts;
  }

  // Derive the operation verb + icon action from the current import action so
  // the dynamic island shows the right label/icon (Insert vs Update vs Delete…)
  importProgressMeta() {
    const action = this.importAction || 'create';
    const verbs = {
      create: 'Inserting',
      update: 'Updating',
      upsert: 'Upserting',
      delete: 'Deleting',
      undelete: 'Undeleting',
      upsertMetadata: 'Upserting Metadata',
      deleteMetadata: 'Deleting Metadata'
    };
    const verb = verbs[action] || 'Importing';
    const type = this.importType || 'records';
    return { action, label: verb + ' ' + type + '…' };
  }

  // Publish live progress to the global top progress bar (rendered on every
  // page) so the user can switch tabs while the import keeps running and still
  // watch queued / processing / succeeded / failed counts.
  publishImportProgress() {
    if (!window.__sfirTopProgress) return;
    const counts = this.importData && this.importData.counts
      ? this.importData.counts
      : {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0};
    const total = counts.Queued + counts.Processing + counts.Succeeded + counts.Failed + (counts.Uncertain || 0);
    const done = counts.Succeeded + counts.Failed + (counts.Uncertain || 0);
    const running = this.isWorking();
    const finished = total > 0 && !running && done === total;
    if (!running && !finished) {
      this._stopProgressTicker();
      window.__sfirTopProgress.set({running: false});
      return;
    }
    if (finished) {
      // Show a brief 100% confirmation, then let the bar hide itself.
      this._stopProgressTicker();
      if (!this._progressFinishedShown) {
        this._progressFinishedShown = true;
        window.__sfirTopProgress.set({
          running: true,
          page: 'data-import',
          label: 'Import finished',
          action: 'done',
          percent: 100,
          counts
        });
        clearTimeout(this._progressHideTimer);
        this._progressHideTimer = setTimeout(() => {
          if (window.__sfirTopProgress) window.__sfirTopProgress.set({running: false});
        }, 4000);
      }
      return;
    }
    const meta = this.importProgressMeta();
    if (window.__sfirTopProgress) {
      window.__sfirTopProgress.set({
        running: true,
        page: 'data-import',
        label: meta.label,
        action: meta.action,
        percent: total > 0 ? Math.round(done / total * 100) : 0,
        counts
      });
    }
    // Lightweight live ticker: keeps the pill fresh between batch completions
    // so the counts/percent feel realtime even while long batches are in flight.
    this._startProgressTicker();
  }

  _startProgressTicker() {
    if (this._progressTicker) return;
    this._progressTicker = setInterval(() => {
      this.publishImportProgress();
    }, 1500);
  }

  _stopProgressTicker() {
    if (this._progressTicker) {
      clearInterval(this._progressTicker);
      this._progressTicker = null;
    }
  }

  // Throttled persistence for the hot path: updateResult/updateImportTableResult
  // fire on every batch, and serializing a 40k-row table to localStorage on
  // each one blocks the main thread (which makes the nav feel unresponsive
  // mid-import). Writes at most once per 3s, flushed on pagehide.
  _schedulePersist() {
    if (this.remoteRunning) return; // SW owns state; pagehide still flushes
    const now = Date.now();
    if (this._lastPersistAt && now - this._lastPersistAt < 3000) {
      if (!this._persistTimer) {
        this._persistTimer = setTimeout(() => {
          this._persistTimer = null;
          this._lastPersistAt = Date.now();
          try { this.persistImportData(); } catch (e) { /* ignore */ }
        }, 3000 - (now - this._lastPersistAt));
      }
      return;
    }
    this._lastPersistAt = now;
    try { this.persistImportData(); } catch (e) { /* ignore */ }
  }

  // Must be called whenever any of its inputs changes.
  updateImportTableResult() {
    this.publishImportProgress();
    if (this.importData.taggedRows == null) {
      this.importTableResult = null;
      if (this.resultTableCallback) {
        this.resultTableCallback(this.importTableResult);
      }
      return;
    }
    let header = this.importData.importTable.header.map(c => c.columnValue);
    let data = this.importData.taggedRows.map(row => row.cells);
    // Excel-style selection highlight (applied by the scrolltable via cellMeta)
    let cellMeta = new Map();
    if (this.excelSelectedRows && this.excelSelectedRows.size > 0) {
      const dark = document.body.classList.contains("sfarc-dark-theme");
      const rowBg = dark ? "rgba(56, 189, 248, 0.09)" : "rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.05)";
      const activeBg = dark ? "rgba(56, 189, 248, 0.16)" : "rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.13)";
      const activeBorder = dark ? "var(--sfarc-accent-glow, #38bdf8)" : "var(--sfarc-accent, #2196f3)";
      const sel = this.excelSelection;
      for (const r of this.excelSelectedRows) {
        for (let c = 0; c < header.length; c++) {
          const active = sel && sel.r === r && sel.c === c;
          const meta = {bgColor: active ? activeBg : rowBg};
          if (active) meta.borderColor = activeBorder;
          cellMeta.set(r + "," + c, meta);
        }
      }
    }
    this.importTableResult = {
      table: [header, ...data],
      isTooling: this.apiType == "Tooling",
      describeInfo: this.describeInfo,
      sfHost: this.sfHost,
      rowVisibilities: [true, ...this.importData.taggedRows.map(row => this.showStatus[row.status])],
      colVisibilities: header.map(() => true),
      cellMeta,
      onCellClick: (r, c, td, ev) => this.onExcelCellClick(r, c, td, ev),
      onRowClick: (r, td, ev) => this.onExcelRowClick(r, td, ev)
    };
    if (this.resultTableCallback) {
      this.resultTableCallback(this.importTableResult);
    }
    this._schedulePersist();
  }

  // ── Excel-like table editing ─────────────────────────────────────────────
  excelColumns() {
    if (!this.importData || !this.importData.importTable || !this.importData.importTable.header) return [];
    return this.importData.importTable.header
      .map((c, i) => ({label: c.columnValue, index: i}))
      .filter(col => col.label !== "_" && !col.label.startsWith("_"));
  }

  excelRowCount() {
    return this.importData && this.importData.importTable ? this.importData.importTable.data.length : 0;
  }

  excelRowOptions() {
    const n = this.excelRowCount();
    const out = [];
    for (let i = 1; i <= n; i++) out.push(i);
    return out;
  }

  excelColumnEditable(c) {
    const header = this.importData && this.importData.importTable && this.importData.importTable.header;
    if (!header || !header[c]) return false;
    const label = header[c].columnValue;
    return label !== "_" && !label.startsWith("_");
  }

  parseExcelRowRange(str) {
    const set = new Set();
    const parts = String(str || "").split(",");
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = Math.min(+m[1], +m[2]);
        const b = Math.max(+m[1], +m[2]);
        for (let i = a; i <= b; i++) set.add(i);
      } else if (/^\d+$/.test(part)) {
        set.add(+part);
      }
    }
    const n = this.excelRowCount();
    return [...set].filter(i => i >= 1 && i <= n).sort((a, b) => a - b);
  }

  excelFlash(msg) {
    this.excelMsg = msg;
    if (this.excelMsgTimer) clearTimeout(this.excelMsgTimer);
    this.excelMsgTimer = setTimeout(() => {
      this.excelMsg = "";
      this.didUpdate();
    }, 1800);
  }

  onExcelCellClick(r, c, td, ev) {
    if (!this.importData || !this.importData.importTable || r < 1) return;
    const multi = ev && (ev.ctrlKey || ev.metaKey);
    if (multi) {
      if (this.excelSelectedRows.has(r)) this.excelSelectedRows.delete(r); else this.excelSelectedRows.add(r);
    } else {
      this.excelSelectedRows = new Set([r]);
    }
    this.excelSelection = {r, c};
    this.excelCellRow = "" + r;
    this.excelCellCol = "" + c;
    this.excelDelRows = [...this.excelSelectedRows].join(", ");
    this.didUpdate();
  }

  onExcelRowClick(r, td, ev) {
    if (!this.importData || !this.importData.importTable || r < 1) return;
    const multi = ev && (ev.ctrlKey || ev.metaKey);
    if (multi) {
      if (this.excelSelectedRows.has(r)) this.excelSelectedRows.delete(r); else this.excelSelectedRows.add(r);
    } else {
      this.excelSelectedRows = new Set([r]);
    }
    if (this.excelSelection) this.excelSelection = {r: r, c: this.excelSelection.c};
    this.excelCellRow = "" + r;
    this.excelDelRows = [...this.excelSelectedRows].join(", ");
    this.didUpdate();
  }

  excelApplyCell() {
    if (!this.importData || !this.importData.importTable) return;
    const {header, data} = this.importData.importTable;
    const r = parseInt(this.excelCellRow, 10);
    const c = parseInt(this.excelCellCol, 10);
    if (!Number.isInteger(r) || r < 1 || r > data.length || !Number.isInteger(c) || c < 0 || c >= header.length || !this.excelColumnEditable(c)) return;
    const old = data[r - 1][c];
    data[r - 1][c] = this.excelCellValue;
    this.updateResult(this.importData.importTable);
    this.excelFlash("Cell updated" + (old === this.excelCellValue ? " (same value)" : ""));
  }

  excelApplyBulk() {
    if (!this.importData || !this.importData.importTable) return;
    const {header, data} = this.importData.importTable;
    const c = parseInt(this.excelBulkCol, 10);
    if (!Number.isInteger(c) || c < 0 || c >= header.length || !this.excelColumnEditable(c)) return;
    const value = this.excelBulkValue;
    const range = this.excelBulkScope === "range" ? this.parseExcelRowRange(this.excelBulkRange) : null;
    let updated = 0;
    for (let i = 0; i < data.length; i++) {
      const r = i + 1;
      if (this.excelBulkScope === "all" ||
          (this.excelBulkScope === "selected" && this.excelSelectedRows.has(r)) ||
          (this.excelBulkScope === "range" && range && range.includes(r))) {
        data[i][c] = value;
        updated++;
      }
    }
    this.updateResult(this.importData.importTable);
    this.excelFlash(updated + " row" + (updated === 1 ? "" : "s") + " updated");
  }

  excelDeleteRows() {
    if (!this.importData || !this.importData.importTable) return;
    let rows = this.parseExcelRowRange(this.excelDelRows);
    if (rows.length === 0) {
      this.excelFlash("No rows matched the range");
      return;
    }
    const data = this.importData.importTable.data;
    for (let i = rows.length - 1; i >= 0; i--) {
      data.splice(rows[i] - 1, 1);
    }
    this.excelSelectedRows = new Set();
    this.excelSelection = null;
    this.excelDelRows = "";
    this.excelCellRow = "";
    this.updateResult(this.importData.importTable);
    this.excelFlash(rows.length + " row" + (rows.length === 1 ? "" : "s") + " deleted");
  }

  excelDeleteColumn() {
    if (!this.importData || !this.importData.importTable) return;
    const {header, data} = this.importData.importTable;
    const c = parseInt(this.excelDelCol, 10);
    if (!Number.isInteger(c) || c <= 0 || c >= header.length) return;
    const name = header[c].columnValue;
    header.splice(c, 1);
    for (let row of data) row.splice(c, 1);
    this.excelSelection = null;
    this.excelCellCol = "";
    this.updateResult(this.importData.importTable);
    this.excelFlash("Column \"" + name + "\" deleted");
  }

  confirmPopupYes() {
    this.confirmPopup = null;

    let {header, data} = this.importData.importTable;

    let statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
    if (statusColumnIndex == -1) {
      statusColumnIndex = header.length;
      header.push(this.makeColumn("__Status"));
      for (let row of data) {
        row.push("");
      }
    }
    let resultIdColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__id");
    if (resultIdColumnIndex == -1) {
      resultIdColumnIndex = header.length;
      header.push(this.makeColumn("__Id"));
      for (let row of data) {
        row.push("");
      }
    }
    let actionColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__action");
    if (actionColumnIndex == -1) {
      actionColumnIndex = header.length;
      header.push(this.makeColumn("__Action"));
      for (let row of data) {
        row.push("");
      }
    }
    let errorColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__errors");
    if (errorColumnIndex == -1) {
      errorColumnIndex = header.length;
      header.push(this.makeColumn("__Errors"));
      for (let row of data) {
        row.push("");
      }
    }
    for (let row of data) {
      if (["queued", "processing", ""].includes(row[statusColumnIndex].toLowerCase())) {
        row[statusColumnIndex] = "Queued";
      }
    }
    this.updateResult(this.importData.importTable);
    this.startImportEngine();
  }

  // Build (or refresh) the engine's importState from the current table,
  // ensuring the system result columns (__Status, __Id, __Action, __Errors)
  // exist first. Every start path funnels through this — the Run confirm
  // dialog, the play/resume button, and auto-resume — so the batch loop can
  // never run against a null importState or a table that lacks the status
  // column (which silently left every row "Queued" forever).
  ensureImportState() {
    if (!this.importData || !this.importData.importTable) return false;
    const {header, data} = this.importData.importTable;
    const ensureColumn = (key, name) => {
      let idx = header.findIndex(c => c.columnValue.toLowerCase() == key);
      if (idx == -1) {
        idx = header.length;
        header.push(this.makeColumn(name));
        for (let row of data) row.push("");
      }
      return idx;
    };
    const statusColumnIndex = ensureColumn("__status", "__Status");
    const resultIdColumnIndex = ensureColumn("__id", "__Id");
    const actionColumnIndex = ensureColumn("__action", "__Action");
    const errorColumnIndex = ensureColumn("__errors", "__Errors");
    // Newly appended / empty status cells are pending → mark them Queued so
    // the batch loop picks them up.
    for (let row of data) {
      if (["queued", "processing", ""].includes(String(row[statusColumnIndex] || "").toLowerCase())) {
        row[statusColumnIndex] = "Queued";
      }
    }
    this.importState = {
      statusColumnIndex,
      resultIdColumnIndex,
      actionColumnIndex,
      errorColumnIndex,
      importAction: this.importAction,
      sobjectType: this.importType,
      idFieldName: this.idFieldName(),
      inputIdColumnIndex: this.inputIdColumnIndex()
    };
    return true;
  }

  // Rebuild the engine's import state from the current table and start
  // processing the queue. Used both when the user confirms a new run and when
  // an in-flight session is auto-resumed after switching tabs / reloading.
  startImportEngine() {
    if (!this.importData || !this.importData.importTable) return;
    this.ensureImportState();
    this.consecutiveFailures = 0;
    this.isProcessingQueue = true;
    // New run (or resume): make sure a fresh progress cycle starts clean.
    this._progressFinishedShown = false;
    clearTimeout(this._progressHideTimer);
    this.dispatchStart();
    this.didUpdate();
  }

  // A previous import session was in flight when the page was closed; wait
  // until the describe data is ready, then resume processing the queue.
  tryAutoResumePendingImport() {
    if (this._autoResumeDone) return;
    if (!this._pendingResume) {
      this._autoResumeDone = true;
      return;
    }
    if (!this._ready || !this.importData || !this.importData.importTable || !this.importData.importTable.data) {
      this._retryAutoResume();
      return;
    }
    try {
      const gd = this.describeInfo.describeGlobal(this.apiType === "Tooling");
      const ready = gd && gd.globalDescribe && Object.keys(gd.globalDescribe).length > 0;
      if (!ready) {
        this._retryAutoResume();
        return;
      }
    } catch (e) {
      this._retryAutoResume();
      return;
    }
    this._autoResumeDone = true;
    this._pendingResume = false;
    // Rows that were mid-flight (Processing) when the page closed never got a
    // result — requeue them so they are processed again.
    try {
      this.reconcileInterruptedRows();
      this.updateResult(this.importData.importTable);
    } catch (e) { /* ignore */ }
    this.startImportEngine();
  }

  _retryAutoResume() {
    if (this._autoResumeDone) return;
    clearTimeout(this._autoResumeTimer);
    this._autoResumeTimer = setTimeout(() => this.tryAutoResumePendingImport(), 400);
  }

  confirmPopupNo() {
    this.confirmPopup = null;
  }

  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.importType);
    if (this.apiType == "Tooling") {
      args.set("useToolingApi", "1");
    }
    return "inspect.html?" + args;
  }

  doImport() {
    let importedRecords = this.importData.counts.Queued + this.importData.counts.Processing;
    let skippedRecords = this.importAction != "undelete" ? this.importData.counts.Succeeded + this.importData.counts.Failed : 0;
    let actionVerb = this.getActionVerb(this.importAction);
    this.confirmPopup = {
      text: importedRecords + " records will be " + actionVerb + "."
        + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded or Failed." : "")
    };
  }

  getActionVerb(importAction){
    switch (importAction) {
      case "create":
        return "created";
      case "update":
        return "updated";
      case "upsert":
        return "upserted";
      case "delete":
        return "deleted";
      case "undelete":
        return "undeleted";
      default:
        return "imported";
    }
  }

  retryFailed() {
    if (!this.importData.importTable) {
      return;
    }
    let statusColumnIndex = this.importData.importTable.header.findIndex(c => c.columnValue.toLowerCase() == "__status");
    if (statusColumnIndex < 0) {
      return;
    }
    for (let row of this.importData.taggedRows) {
      if (row.status == "Failed") {
        row.cells[statusColumnIndex] = "Queued";
      }
    }
    this.updateResult(this.importData.importTable);
    // Restart the engine so the requeued rows actually run. After a finished
    // run isProcessingQueue is false and executeBatch() would early-return,
    // leaving every retried row stuck on "Queued". startImportEngine() does
    // the same full restart path as the Resume button (fresh progress cycle,
    // remote engine preferred, local batch loop fallback).
    this.startImportEngine();
  }

  retryUncertain() {
    if (!this.importData || !this.importData.importTable || !this.importData.taggedRows) return;
    const statusColumnIndex = this.importData.importTable.header.findIndex(c => c.columnValue.toLowerCase() === "__status");
    if (statusColumnIndex < 0) return;
    for (const row of this.importData.taggedRows) {
      if (row.status === "Uncertain") row.cells[statusColumnIndex] = "Queued";
    }
    this.updateResult(this.importData.importTable);
    this.startImportEngine();
  }

  updateResult(importTable) {
    let counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0};
    if (!importTable) {
      this.importData = {
        importTable: null,
        counts,
        taggedRows: null
      };
      this.updateImportTableResult();
      this.persistImportData();
      return;
    }
    let statusColumnIndex = importTable.header.findIndex(c => c.columnValue.toLowerCase() == "__status");
    let taggedRows = [];
    for (let cells of importTable.data) {
      const rawStatus = statusColumnIndex < 0 ? "" : String(cells[statusColumnIndex] || "").toLowerCase();
      let status = statusColumnIndex < 0 ? "Queued"
        : rawStatus == "queued" ? "Queued"
        : rawStatus == "" ? "Queued"
        : rawStatus == "processing" && !this.isWorking() ? (this.importAction === "create" ? "Uncertain" : "Queued")
        : rawStatus == "processing" ? "Processing"
        : rawStatus == "succeeded" ? "Succeeded"
        : rawStatus == "uncertain" || rawStatus == "unknown outcome" ? "Uncertain"
        : "Failed";
      counts[status]++;
      taggedRows.push({status, cells});
    }
    // Note: caller will call this.executeBatch() if needed
    this.importData = {importTable, counts, taggedRows};
    this.updateImportTableResult();
    this._schedulePersist();
  }

  reconcileInterruptedRows() {
    if (!this.importData || !this.importData.importTable) return;
    const {header, data} = this.importData.importTable;
    const statusIndex = header.findIndex(c => c.columnValue.toLowerCase() === "__status");
    const errorIndex = header.findIndex(c => c.columnValue.toLowerCase() === "__errors");
    if (statusIndex < 0) return;
    for (const row of data) {
      if (String(row[statusIndex] || "").toLowerCase() !== "processing") continue;
      if (this.importAction === "create") {
        row[statusIndex] = "Uncertain";
        if (errorIndex >= 0) row[errorIndex] = "Unknown outcome: the insert may have committed before the connection was interrupted. Verify the record before retrying.";
      } else {
        row[statusIndex] = "Queued";
      }
    }
  }

  getSObject(data) {
    if (data[0][0].startsWith("[") && data[0][0].endsWith("]")) {
      let obj = data[0][0].substr(1, data[0][0].length - 2);
      return obj;
    }

    // Check if we have an ID field in the data
    const idIndex = this.importData.importTable.header.findIndex(col => col.columnValue.toLowerCase() === "id");
    if (idIndex !== -1 && data[0] && data[0][idIndex]) {
      const idValue = data[0][idIndex];
      if (idValue && idValue.length >= 3) {
        const prefix = idValue.substring(0, 3);

        const matchingObject = this.sobjectList().find(sobject => sobject.keyPrefix === prefix);
        if (matchingObject) {
          return matchingObject.name;
        }
      }
    }
    return "";
  }

  hasIdColumn(header) {
    let hasId = header.find(column => column.columnValue.toLowerCase() === "id");
    return hasId ? true : false;
  }

  guessColumn(col) {
    if (!col) {
      return col;
    }
    let columnName = col.split(".");
    if (columnName.length == 2) {
      let externalIdColumn = this.columnList().find(s => s.toLowerCase().startsWith(columnName[0].toLowerCase()) && s.toLowerCase().endsWith(columnName[1].toLowerCase()));
      if (externalIdColumn) {
        return externalIdColumn;
      }
    }
    return col.trim();
  }

  refreshColumn() {
    if (!this.importData.importTable) {
      return;
    }
    if (!this.importData.importTable.header) {
      return;
    }
    this.importData.importTable.header = this.importData.importTable.header.map(c => {
      if (!c) {
        return c;
      }
      c.columnValue = this.guessColumn(c.columnOriginalValue);
      return c;
    });

  }
  makeColumn(column, index) {
    let self = this;
    let xmlName = /^[a-zA-Z_][a-zA-Z0-9_]*$/; // A (subset of a) valid XML name
    let columnVm = {
      columnIndex: index,
      columnValue: column.trim(),
      columnOriginalValue: column,
      columnIgnore() { return columnVm.columnValue.startsWith("_"); },
      columnSkip() {
        columnVm.columnValue = "_" + columnVm.columnValue;
        self.updateImportTableResult();
      },
      columnValid() {
        let columnName = columnVm.columnValue.split(":");
        if (columnName.length != 1 && columnName.length != 3) return false;
        const first = columnName[0];
        if (first.includes(".")) {
          return first.split(".").every(p => xmlName.test(p)) && columnName.length === 1;
        }
        if (!xmlName.test(first)) return false;
        if (columnName.length == 3 && !xmlName.test(columnName[2])) return false;
        return true;
      },
      columnError() {
        if (columnVm.columnIgnore()) return "";
        if (!columnVm.columnValid()) return "Invalid field name";
        const v = columnVm.columnValue;
        if (self.importAction === "create" && v.toLowerCase() === "id") {
          return "Cannot specify Id in an Insert call";
        }
        if (v.includes(".") && !v.includes(":")) return "";
        if (!self.columnList().some(s => s.toLowerCase() == v.toLowerCase())) return "Unknown field";
        return "";
      },
      columnUnknownField() {
        return columnVm.columnError() === "Unknown field";

      },
      isColumnSkipped() {
        return columnVm.columnValue.startsWith("_");
      }
    };
    return columnVm;
  }

  // Called once whenever any value is changed such that a new batch might be started (this.isProcessingQueue, this.batchSize, this.batchConcurrency, this.activeBatches or this.importData/updateResult).
  // When the background engine is active this hands the (possibly updated)
  // queue to the service worker instead of running batches locally.
  executeBatch() {
    if (this._useRemoteEngine && (this.isProcessingQueue || this.remoteRunning)) {
      this.pushRemoteJob();
      return;
    }
    this.executeBatchLocal();
  }

  executeBatchLocal() {
    if (!this.isProcessingQueue) {
      return;
    }

    // The play/resume button and other direct start paths don't go through
    // the Run confirm dialog — build the engine state lazily so the batch
    // loop always has a valid status column to draw from.
    if (!this.importState && !this.ensureImportState()) {
      return;
    }

    const headerError = this.customHeadersError();
    if (headerError) {
      this.isProcessingQueue = false;
      this.dataError = headerError;
      this.didUpdate();
      return;
    }

    let batchSize = +this.batchSize;
    if (!(batchSize > 0)) { // This also handles NaN
      return;
    }

    let batchConcurrency = +this.batchConcurrency;
    if (!(batchConcurrency > 0)) { // This also handles NaN
      return;
    }

    if (batchConcurrency <= this.activeBatches) {
      return;
    }

    let {statusColumnIndex, resultIdColumnIndex, actionColumnIndex, errorColumnIndex, importAction, sobjectType, idFieldName, inputIdColumnIndex} = this.importState;
    let data = this.importData.importTable.data;
    let header = this.importData.importTable.header.map(c => c.columnValue);
    let batchRows = [];
    let importArgs = {};
    if (importAction == "upsert") {
      importArgs.externalIDFieldName = idFieldName;
    }
    if (importAction == "delete" || importAction == "undelete") {
      importArgs.ID = [];
    } else if (importAction == "deleteMetadata") {
      importArgs["met:type"] = "CustomMetadata";
      importArgs["met:fullNames"] = [];
    } else if (importAction == "upsertMetadata") {
      importArgs["met:metadata"] = [];
    } else {
      importArgs.sObjects = [];
    }

    for (let row of data) {
      if (batchRows.length == batchSize) {
        break;
      }
      if (row[statusColumnIndex] != "Queued") {
        continue;
      }
      batchRows.push(row);
      row[statusColumnIndex] = "Processing";
      if (importAction == "delete" || importAction == "undelete") {
        importArgs.ID.push(row[inputIdColumnIndex]);
      } else if (importAction == "deleteMetadata") {
        importArgs["met:fullNames"].push(`${sobjectType}.${row[inputIdColumnIndex]}`);
      } else if (importAction == "upsertMetadata") {

        let fieldTypes = {};
        let selectedObjectFields = this.describeInfo.describeSobject(false, sobjectType).sobjectDescribe?.fields || [];
        selectedObjectFields.forEach(field => {
          let soapType = field.soapType;
          // The tns:ID represents a Metadata Relationship. Although not documented, in practice it works only when setting it to xsd:string
          if (soapType == "tns:ID") {
            soapType = "xsd:string";
          }
          fieldTypes[field.name] = soapType;
        });

        let sobject = {};
        sobject["$xsi:type"] = "met:CustomMetadata";
        sobject["met:values"] = [];

        for (let c = 0; c < row.length; c++) {
          let fieldName = header[c];
          let fieldValue = row[c];

          if (fieldName.startsWith("_")) {
            continue;
          }

          if (fieldName == "DeveloperName") {
            sobject["met:fullName"] = `${sobjectType}.${fieldValue}`;
          } else if (fieldName == "MasterLabel") {
            sobject["met:label"] = fieldValue;
          } else {
            if (stringIsEmpty(fieldValue)) {
              fieldValue = null;
            }

            let field = {
              "met:field": fieldName,
              "met:value": {
                "_": fieldValue
              }
            };

            if (fieldTypes[fieldName]) {
              field["met:value"]["$xsi:type"] = fieldTypes[fieldName];
            }

            sobject["met:values"].push(field);
          }
        }

        importArgs["met:metadata"].push(sobject);
      } else {
        let sobject = {};
        sobject["$xsi:type"] = sobjectType;
        sobject.fieldsToNull = [];
        const isTooling = this.apiType === "Tooling";
        const val = v => isTooling ? convertValueForApi(v) : v;
        for (let c = 0; c < row.length; c++) {
          if (header[c][0] != "_") {
            let columnName = header[c].split(":");
            let [fieldName] = columnName;
            const isId = c === inputIdColumnIndex || fieldName.toLowerCase() === "id";
            if (row[c].trim() == "") {
              if (!isId && this.emptyValuesAsNull) {
                const field = columnName.length == 1
                  ? (fieldName.includes(".") ? fieldName.split(".")[0] : fieldName)
                  : (/__r$/.test(fieldName) ? fieldName.replace(/__r$/, "__c") : fieldName + "Id");
                sobject.fieldsToNull.push(field);
              }
            } else if (columnName.length == 1) {
              if (isTooling && fieldName.includes(".")) {
                setNestedValue(sobject, fieldName, val(row[c]));
              } else {
                sobject[fieldName] = val(row[c]);
              }
            } else {
              let [relFieldName, typeName, subFieldName] = columnName;
              sobject[relFieldName] = {"$xsi:type": typeName, [subFieldName]: val(row[c])};
            }
          }
        }
        importArgs.sObjects.push(sobject);
      }
    }
    if (batchRows.length == 0) {
      if (this.activeBatches == 0) {
        this.isProcessingQueue = false;
        this.didUpdate();
      }
      return;
    }
    this.activeBatches++;
    this.updateResult(this.importData.importTable);

    // Fill the configured worker pool immediately. The old fixed 2.5 second
    // stagger made even healthy imports artificially slow.
    queueMicrotask(() => this.executeBatchLocal());

    let wsdl = sfConn.wsdl(apiVersion, this.apiType);
    let headers = {};
    if (this.customHeaders && this.customHeaders.length > 0) {
      try {
        headers = {headers: JSON.parse(this.customHeaders)};
      } catch (e) { return; }
    }

    this.spinFor(sfConn.soap(wsdl, importAction, importArgs, headers).then(res => {

      let results = sfConn.asArray(res);
      for (let i = 0; i < results.length; i++) {
        let result = results[i];
        let row = batchRows[i];
        if (result.success == "true") {
          row[statusColumnIndex] = "Succeeded";
          row[actionColumnIndex]
            = importAction == "create" ? "Inserted"
            : importAction == "update" ? "Updated"
            : importAction == "upsert" || importAction == "upsertMetadata" ? (result.created == "true" ? "Inserted" : "Updated")
            : importAction == "delete" || importAction == "deleteMetadata" ? "Deleted"
            : importAction == "undelete" ? "Undeleted"
            : "Unknown";
        } else {
          row[statusColumnIndex] = "Failed";
          row[actionColumnIndex] = "";
        }
        row[resultIdColumnIndex] = result.id || "";
        row[errorColumnIndex] = sfConn.asArray(result.errors).map(errorNode =>
          errorNode.statusCode
          + ": " + errorNode.message
          + " [" + sfConn.asArray(errorNode.fields).join(", ") + "]"
        ).join(", ");
      }
      this.consecutiveFailures = 0;
    }, err => {
      if (err.name != "SalesforceSoapError") {
        throw err; // Not an HTTP error response
      }
      let errorText = err.message;
      for (let row of batchRows) {
        row[statusColumnIndex] = "Failed";
        row[resultIdColumnIndex] = "";
        row[actionColumnIndex] = "";
        row[errorColumnIndex] = errorText;
      }
      this.consecutiveFailures++;
      // If a whole batch has failed (as opposed to individual records failing),
      // too many times in a row, we stop the import.
      // This is useful when an error will affect all batches, for example a field name being misspelled.
      // This also helps prevent throtteling in Chrome.
      // A batch failing might not affect all batches, so we wait for a few consecutive errors before we stop.
      // For example, a whole batch will fail if one of the field values is of an incorrect type or format.
      if (this.consecutiveFailures >= 3) {
        this.isProcessingQueue = false;
      }
    }).then(() => {
      this.activeBatches--;
      this.updateResult(this.importData.importTable);
      this.executeBatchLocal();
    }).catch(error => {
      console.error("Unexpected exception", error);
      this.isProcessingQueue = false;
    }));
  }


  toggleTopSection() {
    this.isTopSectionCollapsed = !this.isTopSectionCollapsed;
    this.didUpdate();
  }

  // ── Background (service worker) import engine ──────────────────────────────
  // Builds a serializable job mirroring importState + the table rows so the
  // SW can run the batch loop while this page is hidden.
  buildRemoteJob() {
    if (!this.importData || !this.importData.importTable) return null;
    if (!sfConn.sessionId || !sfConn.instanceHostname) return null;
    try {
      const {header} = this.importData.importTable;
      const statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
      const resultIdColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__id");
      const actionColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__action");
      const errorColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__errors");
      const job = {
        jobId: this.remoteJobId || ("imp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
        sfHost: this.sfHost,
        instanceHostname: sfConn.instanceHostname,
        sessionId: sfConn.sessionId,
        apiVersion,
        apiType: this.apiType,
        importAction: this.importAction,
        sobjectType: this.importType,
        batchSize: this.batchSize,
        batchConcurrency: this.batchConcurrency,
        customHeaders: this.customHeaders || "",
        emptyValuesAsNull: this.emptyValuesAsNull,
        idFieldName: this.idFieldName(),
        inputIdColumnIndex: this.inputIdColumnIndex(),
        statusColumnIndex,
        resultIdColumnIndex,
        actionColumnIndex,
        errorColumnIndex,
        header: header.map(c => c.columnValue),
        rows: this.importData.importTable.data
      };
      if (this.importAction === "upsertMetadata") {
        // The SW can't describe the object — ship the field xsi:types along.
        const fieldTypes = {};
        const fields = (this.describeInfo.describeSobject(false, this.importType).sobjectDescribe?.fields) || [];
        fields.forEach(field => {
          let soapType = field.soapType;
          if (soapType == "tns:ID") soapType = "xsd:string";
          fieldTypes[field.name] = soapType;
        });
        job.fieldTypes = fieldTypes;
      }
      return job;
    } catch (e) {
      return null;
    }
  }

  // Start the engine, preferring the service worker so the import survives
  // tab switches. Falls back to the local batch loop when the SW is absent.
  dispatchStart() {
    if (this.remoteRunning && this.remoteJobId) {
      // Already running in the background — refresh with the current queue.
      this.pushRemoteJob();
      return;
    }
    const job = this.buildRemoteJob();
    if (job && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({action: "sfirImportStart", job}, (resp) => {
          if (resp && resp.ok) {
            this._useRemoteEngine = true;
            this.remoteRunning = true;
            this.remoteJobId = job.jobId;
            this.remoteJobSeq = resp.seq;
            this.lastRemoteActivity = Date.now();
            this.isProcessingQueue = false;
            this.activeBatches = 0;
            this.publishImportProgress();
          } else {
            this._useRemoteEngine = false;
            this.remoteRunning = false;
            this.remoteJobId = null;
            this.isProcessingQueue = true;
            this.executeBatchLocal();
          }
        });
        return;
      } catch (e) { /* fall through to the local engine */ }
    }
    this._useRemoteEngine = false;
    this.remoteRunning = false;
    this.remoteJobId = null;
    this.isProcessingQueue = true;
    this.executeBatchLocal();
  }

  // Push the current queue to the SW (resume / retry / config change while the
  // background engine is active). In-flight rows are requeued so the refreshed
  // job reprocesses them — idempotent by design.
  pushRemoteJob() {
    try {
      const {header, data} = this.importData.importTable;
      const statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
      if (statusColumnIndex >= 0) {
        this.reconcileInterruptedRows();
      }
    } catch (e) { /* ignore */ }
    const job = this.buildRemoteJob();
    if (!job) {
      this._useRemoteEngine = false;
      this.remoteRunning = false;
      this.remoteJobId = null;
      this.isProcessingQueue = true;
      this.executeBatchLocal();
      return;
    }
    try {
      chrome.runtime.sendMessage({action: "sfirImportStart", job}, (resp) => {
        if (resp && resp.ok && this.remoteRunning) {
          this.remoteJobSeq = resp.seq;
        } else if (!resp || !resp.ok) {
          this._useRemoteEngine = false;
          this.remoteRunning = false;
          this.remoteJobId = null;
          this.isProcessingQueue = true;
          this.executeBatchLocal();
        }
      });
    } catch (e) {
      this._useRemoteEngine = false;
      this.remoteRunning = false;
      this.remoteJobId = null;
      this.isProcessingQueue = true;
      this.executeBatchLocal();
    }
  }

  // Stop the background job (user paused / cancelled the run).
  stopRemoteJob() {
    this.remoteRunning = false;
    try {
      if (this.remoteJobId) {
        chrome.runtime.sendMessage({action: "sfirImportStop", jobId: this.remoteJobId});
      }
    } catch (e) { /* ignore */ }
    this.remoteJobId = null;
    this.remoteJobSeq = null;
    // Requeue in-flight rows; a later resume reprocesses them.
    try {
      const {header, data} = this.importData.importTable;
      const statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
      if (statusColumnIndex >= 0) {
        this.reconcileInterruptedRows();
      }
      this.updateResult(this.importData.importTable);
    } catch (e) { /* ignore */ }
  }

  // Watchdog: if the background engine hasn't published for 15s, confirm with
  // the SW and fail over to the local engine so the import never stalls.
  checkRemoteHealth() {
    if (!this.remoteRunning) return;
    if (Date.now() - this.lastRemoteActivity < 15000) return;
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      this.failOverToLocal("background engine unavailable");
      return;
    }
    try {
      chrome.runtime.sendMessage({action: "sfirImportGetState"}, (state) => {
        if (!state || !state.ok || !state.running || (this.remoteJobId && state.jobId !== this.remoteJobId)) {
          this.failOverToLocal("background job no longer running");
        } else {
          this.lastRemoteActivity = Date.now();
        }
      });
    } catch (e) {
      this.failOverToLocal("background engine error");
    }
  }

  // Switch from the (dead) background engine back to the page-local loop.
  failOverToLocal(reason) {
    if (!this.remoteRunning) return;
    console.warn("sfir import: " + reason + " — resuming locally");
    this._useRemoteEngine = false;
    this.remoteRunning = false;
    this.remoteJobId = null;
    this.remoteJobSeq = null;
    this.isProcessingQueue = true;
    try {
      const {header, data} = this.importData.importTable;
      const statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
      if (statusColumnIndex >= 0) {
        this.reconcileInterruptedRows();
      }
      this.updateResult(this.importData.importTable);
    } catch (e) { /* ignore */ }
    this.executeBatchLocal();
    this.didUpdate();
  }

  // Apply a per-batch row update streamed from the background engine.
  applyRemoteBatch(updates) {
    if (!updates || !updates.length || !this.importData || !this.importData.importTable) return;
    try {
      const {header, data} = this.importData.importTable;
      const statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
      const resultIdColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__id");
      const actionColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__action");
      const errorColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__errors");
      for (const u of updates) {
        const row = data[u.i];
        if (!row) continue;
        if (statusColumnIndex >= 0 && u.status) row[statusColumnIndex] = u.status;
        if (resultIdColumnIndex >= 0) row[resultIdColumnIndex] = u.id || "";
        if (actionColumnIndex >= 0) row[actionColumnIndex] = u.action || "";
        if (errorColumnIndex >= 0) row[errorColumnIndex] = u.error || "";
      }
      this.updateResult(this.importData.importTable);
      this.didUpdate();
    } catch (e) { /* ignore */ }
  }

  // On load: if the background engine has a live job for this org, adopt its
  // authoritative rows instead of resuming from the (possibly stale) snapshot.
  tryAdoptRemoteJob() {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      this.tryAutoResumePendingImport();
      return;
    }
    try {
      chrome.runtime.sendMessage({action: "sfirImportGetState"}, (state) => {
        if (state && state.ok && state.rows && state.rows.length > 0 &&
            (!state.sfHost || state.sfHost === this.sfHost)) {
          this.adoptRemoteJobState(state);
        } else {
          this.tryAutoResumePendingImport();
        }
      });
    } catch (e) {
      this.tryAutoResumePendingImport();
    }
  }

  adoptRemoteJobState(state) {
    this.remoteRunning = !!state.running;
    this._useRemoteEngine = this.remoteRunning;
    this.remoteJobId = state.jobId || null;
    this.remoteJobSeq = state.seq != null ? state.seq : null;
    this.isProcessingQueue = false;
    this.activeBatches = 0;
    try {
      const header = (state.header || []).map((v, i) => {
        const col = this.makeColumn(v, i);
        col.columnValue = v;
        return col;
      });
      this.importData = {
        importTable: {header, data: state.rows},
        counts: state.counts || {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0},
        taggedRows: null
      };
      if (state.importAction) {
        this.importAction = state.importAction;
        this.importActionName = state.importAction;
        this.importActionSelected = true;
      }
      if (state.sobjectType) this.importType = state.sobjectType;
      this.updateResult(this.importData.importTable);
      this.didUpdate();
    } catch (e) {
      this.remoteRunning = false;
      this._useRemoteEngine = false;
      this.remoteJobId = null;
      this.remoteJobSeq = null;
      this.tryAutoResumePendingImport();
    }
  }

}

class DataImport extends React.Component {
  constructor(props) {
    super(props);
    this.onApiTypeChange = this.onApiTypeChange.bind(this);
    this.onImportActionChange = this.onImportActionChange.bind(this);
    this.onImportTypeChange = this.onImportTypeChange.bind(this);
    this.onDataPaste = this.onDataPaste.bind(this);
    this.onDataDropClick = this.onDataDropClick.bind(this);
    this.onImportFile = this.onImportFile.bind(this);
    this.onImportFileDragOver = this.onImportFileDragOver.bind(this);
    this.onImportFileDrop = this.onImportFileDrop.bind(this);
    this.onExternalIdChange = this.onExternalIdChange.bind(this);
    this.onBatchSizeChange = this.onBatchSizeChange.bind(this);
    this.onCustomHeadersChange = this.onCustomHeadersChange.bind(this);
    this.onCustomHeadersKeyPress = this.onCustomHeadersKeyPress.bind(this);
    this.onBatchConcurrencyChange = this.onBatchConcurrencyChange.bind(this);
    this.onToggleHelpClick = this.onToggleHelpClick.bind(this);
    this.onDoImportClick = this.onDoImportClick.bind(this);
    this.onToggleProcessingClick = this.onToggleProcessingClick.bind(this);
    this.onRetryFailedClick = this.onRetryFailedClick.bind(this);
    this.onCopyAsExcelClick = this.onCopyAsExcelClick.bind(this);
    this.onCopyAsCsvClick = this.onCopyAsCsvClick.bind(this);
    this.onCopyOptionsClick = this.onCopyOptionsClick.bind(this);
    this.onSkipAllUnknownFieldsClick = this.onSkipAllUnknownFieldsClick.bind(this);
    this.onConfirmPopupYesClick = this.onConfirmPopupYesClick.bind(this);
    this.onConfirmPopupNoClick = this.onConfirmPopupNoClick.bind(this);
    this.onToggleTopSectionClick = this.onToggleTopSectionClick.bind(this);
    this.onToggleExcelToolsClick = this.onToggleExcelToolsClick.bind(this);
    this.state = {templateValueIndex: -1, importedFileName: null, importFileDragging: false, isParsingFile: false, autoPasted: false, copyMenuOpen: false, copyMenuPos: null};
  }

  onApiTypeChange(e) {
    let {model} = this.props;
    model.apiType = e.target.value;
    model.updateAvailableActions();
    model.importAction = model.availableActions[0].value;
    model.importActionName = allActions.find(action => action.value == model.importAction).label;
    model.updateImportTableResult();
    model.didUpdate();
  }

  onImportActionChange(e) {
    let {model} = this.props;
    model.importAction = e.target.value;
    model.importActionName = e.target.options[e.target.selectedIndex].text;
    model.importActionSelected = true;
    if (model.importAction === "undelete") {
      this.onImportUndelete(model);
    }
    model.updateImportTableResult();
    model.didUpdate();
  }

  onImportTypeChange(e) {
    let {model} = this.props;
    model.importType = e.target.value;
    model.refreshColumn();
    model.didUpdate();
  }

  onDataPaste(e) {
    let {model} = this.props;
    let text = e.clipboardData.getData("text/plain");
    model.setData(text);
    model.didUpdate();
  }

  onDataDropClick(e) {
    // Smart paste: clicking the dropzone reads the clipboard and, if it holds
    // tabular data (CSV/TSV), imports it automatically. Falls back silently to
    // manual Ctrl+V when the clipboard is empty or the read is blocked.
    let {model} = this.props;
    if (model.isWorking()) {
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return;
    }
    navigator.clipboard.readText().then((text) => {
      text = (text || "").trim();
      if (!text) {
        return;
      }
      // Looks like tabular data? (a separator in the first line)
      let firstLine = text.split(/\r?\n/)[0] || "";
      if (!/[\t,]/.test(firstLine)) {
        return;
      }
      model.setData(text);
      this.setState({autoPasted: true});
      model.didUpdate();
    }).catch(() => {
      // Clipboard read blocked — user can still Ctrl+V into the field.
    });
  }

  onImportFile(e) {
    let file = e.target.files && e.target.files[0];
    if (file) {
      this.readImportFile(file);
    }
    // Allow re-selecting the same file
    e.target.value = "";
  }

  onImportFileDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!this.state.importFileDragging) {
      this.setState({importFileDragging: true});
    }
  }

  onImportFileDrop(e) {
    e.preventDefault();
    this.setState({importFileDragging: false});
    let file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      this.readImportFile(file);
    }
  }

  readImportFile(file) {
    const {model} = this.props;
    if (this.importParseWorker) this.importParseWorker.terminate();
    this.setState({isParsingFile: true, importedFileName: file.name});
    const worker = new Worker(new URL("./csv-worker.js", import.meta.url), {type: "module"});
    this.importParseWorker = worker;
    worker.onmessage = event => {
      const message = event.data || {};
      this.setState({isParsingFile: false});
      this.importParseWorker = null;
      worker.terminate();
      if (message.error) {
        model.dataError = message.error;
      } else if (message.format === "json") {
        model.setData(message.text);
      } else {
        model.dataFormat = message.format;
        model.setParsedRows(message.data, message.separator);
      }
      model.didUpdate();
    };
    worker.onerror = event => {
      this.setState({isParsingFile: false});
      this.importParseWorker = null;
      worker.terminate();
      model.dataError = "The selected file could not be parsed: " + (event.message || "Unknown error");
      model.didUpdate();
    };
    worker.postMessage({file, separator: localStorage.getItem("csvSeparator") || ","});
  }

  onExternalIdChange(e) {
    let {model} = this.props;
    model.externalId = e.target.value;
    model.didUpdate();
  }

  onBatchSizeChange(e) {
    let {model} = this.props;
    model.batchSize = e.target.value;
    model.executeBatch();
    model.didUpdate();
  }

  onCustomHeadersKeyPress(e) {
    if (e.key == "ArrowDown" || e.key == "ArrowUp") {
      let {model} = this.props;
      let {templateValueIndex} = this.state;
      let down = e.key == "ArrowDown" ? true : false;
      down ? templateValueIndex++ : templateValueIndex--;
      if (0 <= templateValueIndex && templateValueIndex < headersTemplates.length) {
        model.customHeaders = headersTemplates[templateValueIndex];
        this.setState({templateValueIndex});
        model.didUpdate();
      }
    }
  }

  onCustomHeadersChange(e) {
    let {model} = this.props;
    model.customHeaders = e.target.value;
    model.didUpdate();
  }

  onBatchConcurrencyChange(e) {
    let {model} = this.props;
    model.batchConcurrency = e.target.value;
    model.executeBatch();
    model.didUpdate();
  }

  onToggleHelpClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    model.showHelp = !model.showHelp;
    model.didUpdate(() => {
      if (this.scrollTable && this.scrollTable.viewportChange) {
        this.scrollTable.viewportChange();
      }
    });
  }

  onDoImportClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.doImport();
    model.didUpdate();
  }

  onToggleProcessingClick(e) {
    e.preventDefault();
    let {model} = this.props;
    if (model.remoteRunning) {
      // Pause: stop the background job; resume re-enters it via executeBatch.
      model.stopRemoteJob();
      model.didUpdate();
      return;
    }
    if (!model.isProcessingQueue) {
      // Starting a fresh run (or resuming after pause): go through the full
      // engine setup so the background SW job is preferred and importState
      // is always built — the plain toggle used to crash on null importState
      // and leave every row stuck on "Queued".
      model.startImportEngine();
    } else {
      model.isProcessingQueue = false;
    }
    model.didUpdate();
  }

  onRetryFailedClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.retryFailed();
    model.didUpdate();
  }

  onToggleTopSectionClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleTopSection();
  }

  onCopyAsExcelClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    model.copyResult("\t");
  }

  onCopyAsCsvClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    let separator = ",";
    if (localStorage.getItem("csvSeparator")) {
      separator = localStorage.getItem("csvSeparator");
    }
    model.copyResult(separator);
  }

  onCopyAsXmlClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    let header = model.importData.importTable.header.map(c => c.columnValue);
    let data = model.importData.taggedRows.filter(row => model.showStatus[row.status]).map(row => row.cells);
    const escapeXml = (value) => {
      const str = value === null || value === undefined ? "" : String(value);
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };
    const rowsXml = data.map((cells) =>
      "  <row>\n" +
      header.map((col, i) => `    <${col}>${escapeXml(cells[i])}</${col}>`).join("\n") +
      "\n  </row>"
    ).join("\n");
    copyToClipboard(`<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rowsXml}\n</records>`);
  }

  onCopyAsJsonClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    let header = model.importData.importTable.header.map(c => c.columnValue);
    let data = model.importData.taggedRows.filter(row => model.showStatus[row.status]).map(row => row.cells);
    const objects = data.map((cells) => {
      const obj = {};
      header.forEach((col, i) => { obj[col] = cells[i] === undefined ? null : cells[i]; });
      return obj;
    });
    copyToClipboard(JSON.stringify(objects, null, 2));
  }

  onCopyOptionsClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    model.copyOptions();
  }

  onSkipAllUnknownFieldsClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    let {model} = this.props;
    model.skipAllUnknownFields();
  }

  onToggleExcelToolsClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.excelOpen = !model.excelOpen;
    if (model.excelOpen) {
      const cols = model.excelColumns();
      if (cols.length) {
        if (!model.excelCellCol) model.excelCellCol = "" + cols[0].index;
        if (!model.excelBulkCol) model.excelBulkCol = "" + cols[0].index;
        if (!model.excelDelCol) model.excelDelCol = "" + cols[0].index;
      }
      if (!model.excelCellRow && model.excelRowCount() > 0) model.excelCellRow = "1";
    }
    model.didUpdate();
  }

  onConfirmPopupYesClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.confirmPopupYes();
    model.didUpdate();
  }

  onConfirmPopupNoClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.confirmPopupNo();
    model.didUpdate();
  }

  onImportUndelete(model) {
    if (model.importData.importTable.header.find(c => c.columnValue == "__Status")) {
      const indices = model.importData.importTable.header.map((element, index) => element.columnValue.startsWith("__") ? index : undefined).filter(index => index !== undefined);
      model.importData.importTable.header = model.importData.importTable.header.filter((element, index) => !indices.includes(index));
      model.importData.importTable.data = model.importData.importTable.data.map(innerArray => innerArray.filter((element, index) => !indices.includes(index)));

      model.importCounts().Queued = model.importData.importTable.data.length;
      model.updateImportTableResult();
    }
  }

  componentDidMount() {
    let {model} = this.props;

    this.onSobjectsListRefreshed = (e) => {
      if (e.detail?.sfHost === model.sfHost) {
        model.sobjectsList = e.detail.sobjectsList;
        model.didUpdate();
      }
    };
    window.addEventListener(Constants.SOBJECTS_LIST_REFRESHED_EVENT, this.onSobjectsListRefreshed);

    this.copyMenuOutsideHandler = (e) => {
      if (this.state.copyMenuOpen && !(e.target && e.target.closest && e.target.closest(".sfarc-copy-dropdown"))) {
        this.setState({copyMenuOpen: false});
      }
    };
    document.addEventListener("click", this.copyMenuOutsideHandler);
    this.copyMenuScrollHandler = () => {
      if (this.state.copyMenuOpen) this.setState({copyMenuOpen: false});
    };
    document.addEventListener("scroll", this.copyMenuScrollHandler, true);

    addEventListener("resize", () => { this.scrollTable.viewportChange(); });

    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;
    model.updateImportTableResult();

    if (typeof window.sfarcEnhanceAllSelects === "function") {
      setTimeout(() => window.sfarcEnhanceAllSelects(), 0);
    }
  }

  componentWillUnmount() {
    window.removeEventListener(Constants.SOBJECTS_LIST_REFRESHED_EVENT, this.onSobjectsListRefreshed);
    if (this.copyMenuOutsideHandler) {
      document.removeEventListener("click", this.copyMenuOutsideHandler);
    }
    if (this.copyMenuScrollHandler) {
      document.removeEventListener("scroll", this.copyMenuScrollHandler, true);
    }
  }

  componentDidUpdate() {
    let {model} = this.props;

    // No beforeunload guard: the user can switch tabs freely. The running
    // session is snapshotted on every batch and auto-resumes when the Import
    // page is opened again (see tryAutoResumePendingImport).

    if (typeof window.sfarcEnhanceAllSelects === "function") {
      setTimeout(() => window.sfarcEnhanceAllSelects(), 0);
    }
  }

  render() {
    let {model} = this.props;

    const hostArg = "host=" + encodeURIComponent(model.sfHost);
    const navItems = [
      h("li", {className: "slds-builder-header__nav-item", key: "nav-export"},
        h("a", {
          href: "data-export.html?" + hostArg,
          className: "slds-builder-header__item-action"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
            h("path", { d: "M7 10l5 5 5-5" }),
            h("path", { d: "M12 15V3" })
          ),
          h("span", { className: "sfir-nav-label" }, "Export")
        )
      ),
      h("li", {className: "slds-builder-header__nav-item", key: "nav-import"},
        h("a", {
          href: "data-import.html?" + hostArg,
          className: "slds-builder-header__item-action sfir-nav-active"
        },
          h("svg", { className: "sfir-nav-icon", width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
            h("path", { d: "M7 8l5-5 5 5" }),
            h("path", { d: "M12 3v12" })
          ),
          h("span", { className: "sfir-nav-label" }, "Import")
        )
      ),
      h("li", {className: "slds-builder-header__nav-item", key: "nav-limits"},
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
      h("li", {className: "slds-builder-header__nav-item", key: "nav-metadata"},
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

    let utilityItems = [];

    return h("div", {className: "sfarc-import-root"},
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
          onToggleHelp: this.onToggleHelpClick,
          helpTitle: "Data Import Help"
        }),
      h("div", {className: "slds-m-top_xx-large sfir-page-container"},
        model.isTopSectionCollapsed ? null : h("div", {className: "sfarc-import-workspace"},
          h("section", {className: "sfarc-import-card sfarc-config-card"},
            h("header", {className: "sfarc-card-header"},
              h("div", {className: "sfarc-card-heading"},
                h("span", {className: "sfarc-card-kicker-icon", "aria-hidden": "true"},
                  h("svg", {viewBox: "0 0 24 24", width: 13, height: 13, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                    h("line", {x1: "4", y1: "21", x2: "4", y2: "14"}),
                    h("line", {x1: "4", y1: "10", x2: "4", y2: "3"}),
                    h("line", {x1: "12", y1: "21", x2: "12", y2: "12"}),
                    h("line", {x1: "12", y1: "8", x2: "12", y2: "3"}),
                    h("line", {x1: "20", y1: "21", x2: "20", y2: "16"}),
                    h("line", {x1: "20", y1: "12", x2: "20", y2: "3"}),
                    h("line", {x1: "1", y1: "14", x2: "7", y2: "14"}),
                    h("line", {x1: "9", y1: "8", x2: "15", y2: "8"}),
                    h("line", {x1: "17", y1: "16", x2: "23", y2: "16"})
                  )
                ),
                h("span", {className: "sfarc-card-kicker"}, "Import Configuration")
              )
            ),
            h("div", {className: "sfarc-card-body sfarc-config-form"},
              h("div", {className: "sfarc-form-grid sfarc-form-grid-2"},
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-api-type", title: "With the tooling API you can import more metadata, but you cannot import regular data. With the metadata API you can import custom metadata types."}, "API Type"),
                  h("select", {className: "sfarc-input", id: "form-api-type", value: model.apiType, onChange: this.onApiTypeChange, disabled: model.isWorking()},
                    ...allApis.map((api, index) => h("option", {key: index, value: api.value}, api.label))
                  )
                ),
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-import-action"}, "Action"),
                  h("select", {className: "sfarc-input", id: "form-import-action", value: model.importAction, onChange: this.onImportActionChange, disabled: model.isWorking()},
                    ...model.availableActions.map((action, index) => h("option", {key: index, value: action.value}, action.label))
                  )
                )
              ),
              h("div", {className: "sfarc-form-grid sfarc-form-grid-object-row"},
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-search-object"}, "Object"),
                  h("select", {
                    id: "form-search-object",
                    className: "sfarc-input" + (model.importTypeError() ? " is-error" : ""),
                    value: model.importType || "",
                    onChange: this.onImportTypeChange,
                    disabled: model.isWorking(),
                    "data-searchable": "true",
                    "data-search-placeholder": "Search..."
                  },
                    h("option", {value: ""}, "-- Select Object --"),
                    ...model.sobjectList().map(data => h("option", {key: data.name, value: data.name}, data.name))
                  ),
                  model.importTypeError() && h("div", {id: "error-search-object", className: "sfarc-field-error"}, model.importTypeError())
                ),
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-performance"}, "Performance"),
                  h("select", {
                    id: "form-performance",
                    className: "sfarc-input",
                    value: model.performancePreset,
                    disabled: model.isWorking(),
                    onChange: e => { model.applyPerformancePreset(e.target.value); model.didUpdate(); }
                  },
                    h("option", {value: "safe"}, "Safe — 1 request"),
                    h("option", {value: "balanced"}, "Balanced — 4 requests"),
                    h("option", {value: "fast"}, "Fast — 6 requests")
                  )
                ),
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-batch-size"}, "Batch size"),
                  h("input", {id: "form-batch-size", className: "sfarc-input" + (model.batchSizeError() ? " is-error" : ""), type: "number", value: model.batchSize, onChange: this.onBatchSizeChange, disabled: model.isWorking()}),
                  model.batchSizeError() && h("div", {id: "error-batch-size", className: "sfarc-field-error"}, model.batchSizeError())
                ),
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-threads"}, "Threads"),
                  h("input", {id: "form-threads", className: "sfarc-input" + (model.batchConcurrencyError() ? " is-error" : ""), type: "number", value: model.batchConcurrency, onChange: this.onBatchConcurrencyChange, disabled: model.isWorking()}),
                  model.batchConcurrencyError() && h("div", {id: "error-threads", className: "sfarc-field-error"}, model.batchConcurrencyError())
                )
              ),
              model.importAction === "upsert" && h("div", {className: "sfarc-form-grid sfarc-form-grid-2"},
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "form-external-id", title: "Used in upserts to determine if an existing record should be updated or a new record should be created"}, "External ID"),
                  h("input", {id: "form-external-id", className: "sfarc-input" + (model.externalIdError() ? " is-error" : ""), type: "text", value: model.externalId, onChange: this.onExternalIdChange, disabled: model.isWorking(), list: "idlookuplist", placeholder: "Select external ID field..."}),
                  model.externalIdError() && h("div", {id: "error-external-id", className: "sfarc-field-error"}, model.externalIdError())
                )
              ),
              h("div", {className: "sfarc-form-grid sfarc-form-grid-2"},                  h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "data-paste"}, "Data"),
                  h("label", {
                    className: "sfarc-data-drop" + (model.dataError ? " is-error" : "") + (model.importData ? " has-data" : "") + (this.state.autoPasted ? " was-autopasted" : ""),
                    htmlFor: "data-paste",
                    title: "Click to auto-paste from clipboard, or Ctrl+V to paste manually",
                    onClick: this.onDataDropClick
                  },
                    model.importData
                      ? h("svg", {viewBox: "0 0 24 24", width: 14, height: 14, fill: "none", stroke: "var(--sfarc-i-success)", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", style: {flexShrink: 0}}, h("polyline", {points: "20 6 9 17 4 12"}))
                      : h("svg", {viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: {flexShrink: 0}}, h("path", {d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}), h("polyline", {points: "17 8 12 3 7 8"}), h("line", {x1: "12", y1: "3", x2: "12", y2: "15"})),
                    h("span", {className: "sfarc-data-drop-text", style: {fontFamily: model.importData ? "var(--sfarc-i-mono)" : "inherit"}}, model.importData ? (model.dataPreview || "Paste data here") : "Paste data here"),
                    h("textarea", {id: "data-paste", value: "", onPaste: this.onDataPaste, disabled: model.isWorking(), readOnly: true, rows: 1, style: {position: "absolute", opacity: 0, width: "1px", height: "1px", padding: 0, border: 0}})
                  ),
                  model.dataError && h("div", {id: "error-data-paste", className: "sfarc-field-error"}, model.dataError)
                ),
                h("div", {className: "sfarc-field"},
                  h("label", {className: "sfarc-field-label", htmlFor: "import-file"}, "Import File"),
                  h("label", {
                    className: "sfarc-file-drop" + (this.state.importFileDragging ? " is-dragging" : "") + (this.state.importedFileName ? " has-file" : "") + (model.dataError ? " is-error" : ""),
                    htmlFor: "import-file",
                    onDragOver: this.onImportFileDragOver,
                    onDragLeave: () => this.setState({importFileDragging: false}),
                    onDrop: this.onImportFileDrop,
                    title: "Choose a file or drag & drop it here"
                  },
                    h("svg", {className: "sfarc-file-drop-icon", viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                      h("path", {d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),
                      h("polyline", {points: "17 8 12 3 7 8"}),
                      h("line", {x1: "12", y1: "3", x2: "12", y2: "15"})
                    ),
                    this.state.isParsingFile && h("span", {className: "sfarc-file-spinner", "aria-hidden": "true"}),
                    h("span", {className: "sfarc-file-drop-text"}, this.state.isParsingFile ? `Parsing ${this.state.importedFileName || "file"}…` : (this.state.importedFileName || "Choose or drop a file")),
                    h("input", {id: "import-file", type: "file", accept: ".csv,.tsv,.txt,.xml,.json", onChange: this.onImportFile, disabled: model.isWorking() || this.state.isParsingFile, style: {display: "none"}})
                  ),
                  this.state.isParsingFile && h("button", {
                    type: "button",
                    className: "sfarc-parse-cancel",
                    onClick: () => {
                      if (this.importParseWorker) this.importParseWorker.terminate();
                      this.importParseWorker = null;
                      this.setState({isParsingFile: false, importedFileName: null});
                    }
                  }, "Cancel parsing")
                )
              ),

              h("div", {className: "sfarc-field"},
                h("label", {className: "sfarc-field-label", htmlFor: "form-custom-headers"}, "Custom Headers"),
                h("textarea", {id: "form-custom-headers", className: "sfarc-input sfarc-input-area" + (model.customHeadersError() ? " is-error" : ""), rows: 1, placeholder: "Press ↓ for suggestions", value: model.customHeaders, onKeyDown: this.onCustomHeadersKeyPress, onChange: this.onCustomHeadersChange, style: {resize: "none"}}),
                model.customHeadersError() && h("div", {className: "sfarc-field-error"}, model.customHeadersError())
              ),
              h("label", {className: "sfarc-null-toggle", title: "When disabled, blank cells leave existing Salesforce values unchanged during update/upsert"},
                h("input", {
                  type: "checkbox",
                  checked: model.emptyValuesAsNull,
                  disabled: model.isWorking(),
                  onChange: e => {
                    model.emptyValuesAsNull = e.target.checked;
                    localStorage.setItem("sfarcImportEmptyAsNull", String(e.target.checked));
                    model.didUpdate();
                  }
                }),
                h("span", {}, "Blank cells clear Salesforce fields")
              )
            ),
            h("datalist", {id: "sobjectlist"}, model.sobjectList().map(data => h("option", {key: data.name, value: data.name}))),
            h("datalist", {id: "idlookuplist"}, model.idLookupList().map(data => h("option", {key: data, value: data}))),
            h("datalist", {id: "columnlist"}, model.columnList().map(data => h("option", {key: data, value: data})))
          ),
          h("section", {className: "sfarc-import-card sfarc-mapping-card"},
            h("header", {className: "sfarc-card-header"},
              h("div", {className: "sfarc-card-heading"},
                h("span", {className: "sfarc-card-kicker-icon", "aria-hidden": "true"},
                  h("svg", {viewBox: "0 0 24 24", width: 13, height: 13, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                    h("rect", {x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2"}),
                    h("line", {x1: "3", y1: "9", x2: "21", y2: "9"}),
                    h("line", {x1: "3", y1: "15", x2: "21", y2: "15"}),
                    h("line", {x1: "9", y1: "3", x2: "9", y2: "21"})
                  )
                ),
                h("span", {className: "sfarc-card-kicker"}, "Column Mapping")
              ),
              model.columns().length > 0 ? h("span", {className: "sfarc-card-chip"}, model.columns().length + " columns") : null
            ),
            h("div", {className: "sfarc-card-body"},
              model.preflightSummary() && h("div", {className: "sfarc-preflight-summary", role: "status"},
                h("strong", {}, "Preflight"),
                h("span", {}, `${model.preflightSummary().rows.toLocaleString()} rows`),
                h("span", {}, `${model.preflightSummary().mapped} mapped`),
                h("span", {className: model.preflightSummary().unmapped ? "is-warning" : ""}, `${model.preflightSummary().unmapped} unresolved`),
                h("span", {}, `~${model.preflightSummary().calls.toLocaleString()} API calls`)
              ),
              model.getRequiredMissingFields().map((field, index) => h("div", {key: index, className: "sfarc-mapping-warning"}, `The field mapping has no '${field}' column`)),
              h("table", {className: "sfarc-mapping-table"},
                h("thead", {},
                  h("tr", {},
                    h("th", {}, "CSV Header Column"),
                    h("th", {}, "Mapped Salesforce Field"),
                    h("th", {style: {textAlign: "right"}}, "Action")
                  )
                ),
                h("tbody", {},
                  model.columns().map((column, index) => h(ColumnMapper, {key: index, model, column}))
                )
              )
            )
          )
        ),
        h("div", {className: "sfarc-import-actions"},
          h("div", {className: "sfarc-action-group"},
            h("button", {onClick: this.onDoImportClick, disabled: model.invalidInput() || model.isWorking() || model.importCounts().Queued == 0, className: "sfarc-btn sfarc-btn-primary", title: "Run " + model.importActionName},
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 16, height: 16, fill: "currentColor", stroke: "none"},
                h("path", {d: "M8 5v14l11-7z"})
              ),
              h("span", {className: "sfarc-btn-label"}, "Run " + model.importActionName)
            ),
            h("button", {
              disabled: !(model.importCounts().Queued > 0 || model.isWorking()),
              onClick: this.onToggleProcessingClick,
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label",
              title: model.isProcessingQueue ? "Cancel queued records" : "Resume queued records"
            },
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 15, height: 15, fill: "currentColor", stroke: "none"},
                model.isProcessingQueue
                  ? h("path", {d: "M6 5h4v14H6zM14 5h4v14h-4z"})
                  : h("path", {d: "M8 5v14l11-7z"})
              ),
              h("span", {className: "sfarc-btn-label"}, model.isProcessingQueue ? "Cancel" : "Resume")
            ),
            h("button", {
              disabled: model.importCounts().Failed === 0 || model.isWorking(),
              onClick: this.onRetryFailedClick,
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label",
              title: "Retry failed records"
            },
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                h("path", {d: "M23 4v6h-6"}),
                h("path", {d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"})
              ),
              h("span", {className: "sfarc-btn-label"}, "Retry failed")
            ),
            (model.importCounts().Uncertain || 0) > 0 && h("button", {
              disabled: model.isWorking(),
              onClick: () => {
                if (window.confirm("These inserts may already exist in Salesforce. Retry only after verifying the records. Continue?")) model.retryUncertain();
              },
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label",
              title: "Explicitly retry rows whose insert outcome could not be confirmed"
            }, h("span", {className: "sfarc-btn-label"}, "Retry uncertain")),
            h("button", {
              onClick: this.onToggleTopSectionClick,
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label",
              title: model.isTopSectionCollapsed ? "Show Configuration" : "Hide Configuration"
            },
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                h("polyline", {points: model.isTopSectionCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"})
              ),
              h("span", {className: "sfarc-btn-label"}, model.isTopSectionCollapsed ? "Show config" : "Hide config")
            )
          ),
          h("div", {className: "sfarc-status-pills"},
            h(StatusBox, {model, name: "Queued"}),
            h(StatusBox, {model, name: "Processing"}),
            h(StatusBox, {model, name: "Succeeded"}),
            h(StatusBox, {model, name: "Failed"}),
            h(StatusBox, {model, name: "Uncertain"})
          ),
          h("div", {className: "sfarc-action-group"},
            h("button", {
              onClick: this.onToggleExcelToolsClick,
              title: "Excel-like editing toolbar: edit cells, bulk update a column, delete rows/columns",
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" + (model.excelOpen ? " sfarc-excel-active" : "")
            },
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                h("rect", {x: 3, y: 3, width: 7, height: 7, rx: 1}),
                h("rect", {x: 14, y: 3, width: 7, height: 7, rx: 1}),
                h("rect", {x: 3, y: 14, width: 7, height: 7, rx: 1}),
                h("rect", {x: 14, y: 14, width: 7, height: 7, rx: 1})
              ),
              h("span", {className: "sfarc-btn-label"}, "Excel tools")
            ),
            h("div", {className: "sfarc-copy-dropdown" + (this.state.copyMenuOpen ? " open" : "")},
              h("button", {
                onClick: (e) => {
                  e.stopPropagation();
                  const willOpen = !this.state.copyMenuOpen;
                  let pos = this.state.copyMenuPos;
                  if (willOpen && e.currentTarget) {
                    const r = e.currentTarget.getBoundingClientRect();
                    pos = { top: r.bottom + 4, left: r.left };
                  }
                  this.setState({copyMenuOpen: willOpen, copyMenuPos: pos});
                },
                className: "sfarc-btn sfarc-btn-secondary sfarc-copy-btn",
                disabled: !model.canCopy(),
                title: "Copy the import result or the import options"
              },
                "Copy",
                h("svg", {className: "sfarc-copy-chevron", viewBox: "0 0 24 24", width: 12, height: 12, fill: "currentColor"}, h("path", {d: "M7 10l5 5 5-5z"}))
              ),
              this.state.copyMenuOpen ? h("div", {className: "sfarc-copy-menu", style: this.state.copyMenuPos ? {position: "fixed", top: this.state.copyMenuPos.top, left: this.state.copyMenuPos.left, right: "auto"} : null, onClick: (e) => e.stopPropagation()},
                h("button", {className: "sfarc-copy-menu-item", onClick: () => { this.onCopyAsExcelClick(); this.setState({copyMenuOpen: false}); }}, "Copy as Excel (TSV)"),
                h("button", {className: "sfarc-copy-menu-item", onClick: () => { this.onCopyAsCsvClick(); this.setState({copyMenuOpen: false}); }}, "Copy as CSV"),
                h("button", {className: "sfarc-copy-menu-item", onClick: () => { this.onCopyAsXmlClick(); this.setState({copyMenuOpen: false}); }}, "Copy as XML"),
                h("button", {className: "sfarc-copy-menu-item", onClick: () => { this.onCopyAsJsonClick(); this.setState({copyMenuOpen: false}); }}, "Copy as JSON"),
                h("div", {className: "sfarc-copy-menu-sep"}),
                h("button", {className: "sfarc-copy-menu-item", onClick: () => { this.onCopyOptionsClick(); this.setState({copyMenuOpen: false}); }}, "Copy Options")
                ,h("div", {className: "sfarc-copy-menu-sep"})
                ,h("button", {className: "sfarc-copy-menu-item", disabled: model.importCounts().Failed === 0, onClick: () => { model.downloadResult("Failed"); this.setState({copyMenuOpen: false}); }}, "Download failed rows")
                ,h("button", {className: "sfarc-copy-menu-item", disabled: model.importCounts().Succeeded === 0, onClick: () => { model.downloadResult("Succeeded"); this.setState({copyMenuOpen: false}); }}, "Download successful rows")
                ,h("button", {className: "sfarc-copy-menu-item", disabled: (model.importCounts().Uncertain || 0) === 0, onClick: () => { model.downloadResult("Uncertain"); this.setState({copyMenuOpen: false}); }}, "Download uncertain rows")
              ) : null
            ),
            h("button", {
              onClick: this.onSkipAllUnknownFieldsClick,
              disabled: !model.canSkipAllUnknownFields() || model.isWorking() || model.importCounts().Queued == 0,
              className: "sfarc-btn sfarc-btn-icon sfarc-btn-icon-label",
              title: "Skip all unknown fields (ignore them on future imports)"
            },
              h("svg", {className: "sfarc-btn-icon-svg", viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"},
                h("polyline", {points: "5 4 15 12 5 20"}),
                h("line", {x1: "19", y1: "5", x2: "19", y2: "19"})
              ),
              h("span", {className: "sfarc-btn-label"}, "Skip unknown")
            )
          )
        ),        !model.showHelp ? null : h("div", {className: "sfarc-help-panel"},
          h("h3", {className: "sfarc-help-title"}, "Import Help"),
          h("p", {className: "sfarc-help-text"}, "Use for quick one-off data imports."),
          h("ul", {className: "sfarc-help-list"},
            h("li", {}, "Enter your CSV or Excel data in the box above.",
              h("ul", {className: "sfarc-help-sublist"},
                h("li", {}, "The input must contain a header row with field API names."),
                h("li", {}, "To use an external ID for a lookup field, the header row should contain the lookup relation name, the target sobject name and the external ID name separated by colons, e.g. \"MyLookupField__r:MyObject__c:MyExternalIdField__c\"."),
                h("li", {}, "Empty cells insert null values."),
                h("li", {}, "Number, date, time and checkbox values must conform to the relevant ", h("a", {href: "http://www.w3.org/TR/xmlschema-2/#built-in-primitive-datatypes", target: "_blank"}, "XSD datatypes"), "."),
                h("li", {}, "Columns starting with an underscore are ignored."),
                h("li", {}, "You can resume a previous import by including the \"__Status\" column in your input."),
                h("li", {}, "You can supply the other import options by clicking \"Copy options\" and pasting the options into Excel in the top left cell, just above the header row.")
              )
            ),
            h("li", {}, "Select your input format"),
            h("li", {}, "Select an action (insert, update, upsert or delete)"),
            h("li", {}, "Enter the API name of the object to import"),
            h("li", {}, "Press the Run button")
          ),
          h("p", {className: "sfarc-help-note"}, "Bulk API is not supported. Large data volumes may freeze or crash your browser.")
        ),
        h(
          "div",
          {
            className: "sfarc-import-results",
            style: {
              padding: "0",
              flex: "1 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column"
            }
          },
          h(
            "div",
            {
              ref: "scroller",
              className: "sfarc-results-scroller",
              style: {
                margin: 0,
                padding: 0,
                flex: "1 1 0",
                minHeight: 0,
                maxHeight: "100%",
                overflowY: "auto"
              }
            }
          ),
          model.confirmPopup ? h("div", {},
            h("section",
              {
                role: "dialog",
                tabIndex: -1,
                className: "slds-modal slds-fade-in-open slds-modal_small"
              },
              h("div", {className: "slds-modal__container"},
                h(
                  "button",
                  {className: "slds-button slds-button_icon slds-modal__close", onClick: this.onConfirmPopupNoClick},
                  h(
                    "svg",
                    {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
                    h("use", {xlinkHref: "symbols.svg#close"})
                  ),
                  h("span", {className: "slds-assistive-text"}, "Cancel and close")
                ),
                h(
                  "div",
                  {className: "slds-modal__content slds-p-around_medium slds-modal__content_headless slds-text-align_center", id: "modal-content-id-1"},
                  h("div", {className: "slds-notify_container slds-is-relative"},
                    h("div", {className: "slds-notify slds-notify_toast slds-theme_warning", role: "status"},
                      h("span", {className: "slds-assistive-text"}, "warning"),
                      h("span", {className: "slds-icon_container slds-icon-utility-warning slds-m-right_small slds-no-flex slds-align-top"},
                        h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
                          h("use", {xlinkHref: "symbols.svg#warning"})
                        )
                      ),
                      h("div", {className: "slds-notify__content slds-text-align_center"},
                        h("h2", {className: "slds-text-heading_small"}, "You are about to modify your data in Salesforce. This action cannot be undone.")
                      )
                    )
                  ),
                  h("br", {}),
                  h("p", {className: "slds-text-heading_medium"}, model.confirmPopup.text),
                ),
                h(
                  "div",
                  {className: "slds-modal__footer"},
                  h(
                    "button",
                    {className: "slds-button slds-button_neutral", "aria-label": "Cancel and close", onClick: this.onConfirmPopupNoClick},
                    "Cancel"
                  ),
                  h(
                    "button",
                    {className: "slds-button slds-button_brand", onClick: this.onConfirmPopupYesClick},
                    model.importActionName
                  )
                )
              )
            ),
            h("div", {className: "slds-backdrop slds-backdrop_open", role: "presentation"})
          ) : null
        )
      ),
      model.excelOpen ? h(ExcelToolsPanel, {model}) : null
    );
  }
}

class ExcelToolsPanel extends React.Component {
  constructor(props) {
    super(props);
    this.onClose = this.onClose.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.setField = this.setField.bind(this);
    this.applyAction = this.applyAction.bind(this);
  }

  onClose(e) {
    e.preventDefault();
    let {model} = this.props;
    model.excelOpen = false;
    model.didUpdate();
  }

  onDragStart(e) {
    const panel = this.panelRef;
    if (!panel) return;
    if (e.target.closest && (e.target.closest("button") || e.target.closest("select") || e.target.closest("input"))) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    const left = rect.left, top = rect.top;
    const onMove = (me) => {
      panel.style.left = Math.max(0, left + me.clientX - startX) + "px";
      panel.style.top = Math.max(0, top + me.clientY - startY) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("sfarc-excel-dragging");
    };
    document.body.classList.add("sfarc-excel-dragging");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  setField(name, e) {
    let {model} = this.props;
    model[name] = e.target.value;
    model.didUpdate();
  }

  applyAction(fn) {
    let {model} = this.props;
    fn(model);
    model.didUpdate();
  }

  render() {
    let {model} = this.props;
    const columns = model.excelColumns();
    const hasData = model.excelRowCount() > 0;
    const selectedCount = model.excelSelectedRows ? model.excelSelectedRows.size : 0;
    const maxRow = Math.max(1, model.excelRowCount());
    const colOptions = columns.map(col => h("option", {value: "" + col.index, key: col.index}, col.label));
    const colSelect = (name) => h("select", {
      className: "sfarc-excel-select",
      value: model[name],
      onChange: (e) => this.setField(name, e),
      disabled: !hasData || columns.length === 0
    }, columns.length ? colOptions : h("option", {value: ""}, "No editable columns"));

    const rowInput = (name, extraClass) => h("input", {
      type: "number",
      min: 1,
      max: maxRow,
      className: "sfarc-excel-input" + (extraClass ? " " + extraClass : ""),
      value: model[name],
      onChange: (e) => this.setField(name, e),
      disabled: !hasData,
      placeholder: "1"
    });

    const textInput = (name, placeholder, extraClass) => h("input", {
      type: "text",
      className: "sfarc-excel-input wide" + (extraClass ? " " + extraClass : ""),
      value: model[name],
      onChange: (e) => this.setField(name, e),
      placeholder: placeholder
    });

    const btn = (label, cls, onClick, disabled, title) => h("button", {
      className: "sfarc-excel-btn " + cls,
      onClick,
      disabled,
      title
    }, label);

    return h("div", {className: "sfarc-excel-toolbar", ref: (el) => { this.panelRef = el; }},
      h("div", {className: "sfarc-excel-toolbar-header", onMouseDown: this.onDragStart, title: "Drag to move"},
        h("span", {className: "sfarc-excel-grip", "aria-hidden": "true"},
          h("svg", {viewBox: "0 0 24 24", width: 14, height: 14, fill: "currentColor"},
            h("circle", {cx: "9", cy: "6", r: "1.6"}),
            h("circle", {cx: "15", cy: "6", r: "1.6"}),
            h("circle", {cx: "9", cy: "12", r: "1.6"}),
            h("circle", {cx: "15", cy: "12", r: "1.6"}),
            h("circle", {cx: "9", cy: "18", r: "1.6"}),
            h("circle", {cx: "15", cy: "18", r: "1.6"})
          )
        ),
        h("span", {className: "sfarc-excel-toolbar-title"}, "Excel Tools"),
        selectedCount > 0 ? h("span", {className: "sfarc-excel-count"}, selectedCount + " selected") : null,
        h("button", {className: "sfarc-excel-close", onClick: this.onClose, title: "Close Excel Tools"}, "×")
      ),
      h("div", {className: "sfarc-excel-body"},
        h("div", {className: "sfarc-excel-section"},
          h("div", {className: "sfarc-excel-section-title"}, "Edit cell"),
          h("div", {className: "sfarc-excel-row"},
            rowInput("excelCellRow"),
            colSelect("excelCellCol")
          ),
          h("div", {className: "sfarc-excel-row"},
            textInput("excelCellValue", "New value"),
            btn("Apply", "primary", () => this.applyAction(m => m.excelApplyCell()), !hasData || columns.length === 0, "Set the selected cell to this value")
          )
        ),
        h("div", {className: "sfarc-excel-section"},
          h("div", {className: "sfarc-excel-section-title"}, "Bulk update column"),
          h("div", {className: "sfarc-excel-row"},
            colSelect("excelBulkCol"),
            h("select", {
              className: "sfarc-excel-select sfarc-excel-scope",
              value: model.excelBulkScope,
              onChange: (e) => this.setField("excelBulkScope", e),
              disabled: !hasData
            },
              h("option", {value: "all"}, "All rows"),
              h("option", {value: "selected"}, "Selected rows"),
              h("option", {value: "range"}, "Row range")
            )
          ),
          model.excelBulkScope === "range" ? h("div", {className: "sfarc-excel-row"},
            textInput("excelBulkRange", "e.g. 1,3,5-10"),
            h("span", {className: "sfarc-excel-range-hint"}, "rows")
          ) : null,
          h("div", {className: "sfarc-excel-row"},
            textInput("excelBulkValue", "New value"),
            btn("Apply", "primary", () => this.applyAction(m => m.excelApplyBulk()), !hasData || columns.length === 0, "Set this column to the value for the chosen rows")
          )
        ),
        h("div", {className: "sfarc-excel-section"},
          h("div", {className: "sfarc-excel-section-title"}, "Delete rows"),
          h("div", {className: "sfarc-excel-row"},
            textInput("excelDelRows", selectedCount > 0 ? "" + [...model.excelSelectedRows].join(", ") + " (selected)" : "e.g. 2,5,8-12"),
            btn("Delete", "danger", () => this.applyAction(m => m.excelDeleteRows()), !hasData, "Remove these rows from the import")
          )
        ),
        h("div", {className: "sfarc-excel-section"},
          h("div", {className: "sfarc-excel-section-title"}, "Delete column"),
          h("div", {className: "sfarc-excel-row"},
            colSelect("excelDelCol"),
            btn("Delete", "danger", () => this.applyAction(m => m.excelDeleteColumn()), !hasData || columns.length === 0, "Remove this column from the import")
          )
        ),
        model.excelMsg ? h("div", {className: "sfarc-excel-msg"}, model.excelMsg) : null,
        h("div", {className: "sfarc-excel-tip"}, "Tip: click a cell to select its row · Ctrl/Cmd+click to multi-select rows")
      )
    );
  }
}

class ColumnMapper extends React.Component {
  constructor(props) {
    super(props);
    this.onColumnValueChange = this.onColumnValueChange.bind(this);
    this.onColumnSkipClick = this.onColumnSkipClick.bind(this);
  }
  onColumnValueChange(e) {
    let {model, column} = this.props;
    column.columnValue = e.target.value;
    model.persistImportData();
    model.didUpdate();
  }
  onColumnSkipClick(e) {
    let {model, column} = this.props;
    e.preventDefault();
    column.columnSkip();
    model.didUpdate();
  }
  render() {
    let {model, column} = this.props;
    let hasError = column.columnError();
    let isSkipped = column.isColumnSkipped();
    let inputClassName = hasError ? "sfarc-mapping-input is-error" : (isSkipped && model.greyOutSkippedColumns ? "sfarc-mapping-input is-skipped" : "sfarc-mapping-input");

    return h("tr", {className: "sfarc-mapping-tr" + (hasError ? " is-error" : "") + (isSkipped ? " is-skipped" : "")},
      h("td", {className: "sfarc-mapping-td-label"},
        h("span", {className: "sfarc-mapping-label-text", title: column.columnOriginalValue}, column.columnOriginalValue)
      ),
      h("td", {className: "sfarc-mapping-td-input"},
        h("select", {
          value: column.columnValue || "",
          onChange: this.onColumnValueChange,
          className: inputClassName + " sfarc-custom-dropdown-enhance",
          disabled: model.isWorking(),
          id: "col-" + column.columnIndex,
          "data-searchable": "true",
          "data-search-placeholder": "Search fields..."
        },
          h("option", {value: "", hidden: true}, "Map field..."),
          model.columnList().map(data =>
            h("option", {key: data, value: data, selected: data === column.columnValue}, data)
          )
        )
      ),
      h("td", {className: "sfarc-mapping-td-action"},
        hasError ? h("div", {className: "sfarc-mapping-error-group"},
          h("span", {className: "sfarc-mapping-error-badge"}, hasError),
          h("button", {
            type: "button",
            className: "sfarc-mapping-skip-btn",
            onClick: this.onColumnSkipClick,
            hidden: model.isWorking(),
            title: "Don't import this column"
          }, "Skip")
        ) : (isSkipped ? h("span", {className: "sfarc-mapping-skipped-badge"}, "Skipped") : h("span", {className: "sfarc-mapping-ok-badge"}, "✓ Mapped"))
      )
    );
  }
}

class StatusBox extends React.Component {
  constructor(props) {
    super(props);
    this.onShowStatusChange = this.onShowStatusChange.bind(this);
  }
  onShowStatusChange() {
    let {model, name} = this.props;
    model.showStatus[name] = !model.showStatus[name];
    model.updateImportTableResult();
    model.didUpdate();
  }
  render() {
    let {model, name} = this.props;
    let isChecked = model.showStatus[name];
    let count = model.importCounts()[name];
    let pillClass = `status-stat-pill stat-${name.toLowerCase()} ${count > 0 ? 'stat-live' : ''} ${isChecked ? 'stat-checked' : 'stat-unchecked'}`;
    
    return h("div", {
      className: pillClass,
      onClick: this.onShowStatusChange,
      title: `${isChecked ? 'Hide' : 'Show'} ${name} records`
    },
      h("span", {className: "stat-count", style: {marginRight: "4px"}}, count),
      h("span", {}, name)
    );
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  if (!sfHost) {
    console.warn("salesforce comet: data-import loaded without a host parameter");
  } else {
    initButton(sfHost, true);
    sfConn.getSession(sfHost).then(() => {

      let root = document.getElementById("root");
      let model = new Model(sfHost, args);
      currentImportModel = model;
      model.reactCallback = cb => {
        ReactDOM.render(h(DataImport, {model, ref: c => { if (c) activeImportApp = c; }}), root, cb);
      };
      ReactDOM.render(h(DataImport, {model, ref: c => { if (c) activeImportApp = c; }}), root);
    }).catch(() => { /* session init failure is non-fatal in preview/test contexts */ });
  }
}

function stringIsEmpty(str) {
  return str == null || str == undefined || str.trim() == "";
}

function convertValueForApi(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (s.toLowerCase() === "true") return true;
  if (s.toLowerCase() === "false") return false;
  const n = Number(s);
  return !Number.isNaN(n) && String(n) === s ? n : s;
}

function setNestedValue(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!(cur[k] && typeof cur[k] === "object")) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
