const h = React.createElement;

function getApiHost(host) {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  h = h.replace(".file.force.com", ".my.salesforce.com");
  h = h.replace(".content.force.com", ".my.salesforce.com");
  h = h.replace(".documentforce.com", ".my.salesforce.com");
  h = h.replace(".staticforce.com", ".my.salesforce.com");
  if (h.includes(".lightning.force.com")) {
    h = h.replace(".lightning.force.com", ".my.salesforce.com");
  } else if (h.includes("--c.visualforce.com")) {
    h = h.replace("--c.visualforce.com", ".my.salesforce.com");
  }
  return h;
}

function isRecordId(id) {
  if (!id || typeof id !== "string") return false;
  let clean = id.trim();
  return (clean.length === 15 || clean.length === 18) && /^[a-zA-Z0-9]{15,18}$/.test(clean);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Parse the single "Session ID" input. Accepts the frontdoor session link the
// extension's "Copy Session ID URL" button generates
// (https://<host>/secur/frontdoor.jsp?sid=00D...) — the org host is read from
// the link — or a raw SID, which falls back to the page's current org host.
function parseSessionInput(raw, fallbackHost = "") {
  const value = (raw || "").trim();
  if (!value) return { host: "", sessionId: "" };
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      const sid = u.searchParams.get("sid") || u.searchParams.get("sessionId") || "";
      if (sid) {
        return { host: getApiHost(u.hostname), sessionId: decodeURIComponent(sid) };
      }
    } catch (e) { /* fall through to raw SID handling */ }
  }
  return { host: getApiHost(fallbackHost), sessionId: value };
}

class OrgClient {
  constructor(host = "", sessionId = "") {
    this.host = getApiHost(host);
    this.sessionId = sessionId;
  }

  setSession(sessionId, host) {
    this.sessionId = sessionId;
    this.host = getApiHost(host);
  }

  async rest(path, options = {}) {
    let apiHost = getApiHost(this.host);
    if (!apiHost || !this.sessionId) {
      throw new Error("Org session not configured.");
    }
    const url = path.startsWith("http") ? path : `https://${apiHost}${path}`;
    const method = options.method || "GET";
    const headers = {
      "Authorization": `Bearer ${this.sessionId}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(method === "POST" || method === "PATCH" ? { "Sforce-Duplicate-Rule-Header": "allowSave=true" } : {}),
      ...(options.headers || {})
    };

    const reqConfig = { method, headers };
    if (options.body) {
      reqConfig.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    let response = await fetch(url, reqConfig);

    // Auto-retry 401 with fresh background cookie if session expired
    if (response.status === 401 && typeof chrome !== 'undefined' && chrome.runtime) {
      const freshCookie = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: `https://${apiHost}` }, (res) => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve(res);
        });
      });
      if (freshCookie && freshCookie.value && freshCookie.value !== this.sessionId) {
        this.sessionId = freshCookie.value;
        reqConfig.headers["Authorization"] = `Bearer ${this.sessionId}`;
        response = await fetch(url, reqConfig);
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (e) { }
      const errMsg = (errJson && errJson[0] && errJson[0].message) || (errJson && errJson.error_description) || errText || response.statusText;
      throw new Error(`[${response.status}] ${errMsg}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      return await response.json();
    }
    return await response.text();
  }

  async restBase64(path) {
    const apiHost = getApiHost(this.host);
    if (!apiHost || !this.sessionId) throw new Error("Org session not configured.");
    const url = path.startsWith("http") ? path : `https://${apiHost}${path}`;
    const request = () => fetch(url, { headers: { "Authorization": `Bearer ${this.sessionId}` } });
    let response = await request();
    if (response.status === 401 && typeof chrome !== "undefined" && chrome.runtime) {
      const freshCookie = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "getCookie", name: "sid", url: `https://${apiHost}` }, res => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve(res);
        });
      });
      if (freshCookie?.value) {
        this.sessionId = freshCookie.value;
        response = await request();
      }
    }
    if (!response.ok) throw new Error(`[${response.status}] Unable to download file content.`);
    return arrayBufferToBase64(await response.arrayBuffer());
  }
}

class RecordCloneApp extends React.Component {
  constructor(props) {
    super(props);

    // Read URL params (e.g. from context menu / record page)
    const urlParams = new URLSearchParams(window.location.search);
    const initialHost = urlParams.get("host") || "";
    const initialObjectType = urlParams.get("objectType") || "Account";
    const initialRecordId = urlParams.get("recordId") || "";

    this.state = {
      connectedOrgs: [],
      sourceHost: getApiHost(initialHost),
      sourceSessionId: "",
      destHost: "",
      destSessionId: "",

      // Multi-Step Wizard State
      activeStep: 1, // 1: Setup, 2: Relationships, 3: Attachments, 4: Review

      // Authorize Modal State
      showAuthModal: false,
      authTarget: "source", // 'source' or 'dest'
      authHost: "",
      authSessionId: "",

      // Target Record Setup & Smart Selection Modes
      availableSObjects: [
        { name: "Account", label: "Account (Account)" },
        { name: "Contact", label: "Contact (Contact)" },
        { name: "Opportunity", label: "Opportunity (Opportunity)" },
        { name: "Lead", label: "Lead (Lead)" },
        { name: "Case", label: "Case (Case)" },
        { name: "Campaign", label: "Campaign (Campaign)" },
        { name: "Asset", label: "Asset (Asset)" },
        { name: "Contract", label: "Contract (Contract)" },
        { name: "Order", label: "Order (Order)" },
        { name: "Quote", label: "Quote (Quote)" },
        { name: "Product2", label: "Product2 (Product2)" },
        { name: "Task", label: "Task (Task)" },
        { name: "Event", label: "Event (Event)" }
      ],
      selectionMode: "search", // 'search', 'bulk_ids', 'soql', 'recent'
      bulkRecordIds: "",
      soqlQuery: `SELECT Id, Name FROM ${initialObjectType} ORDER BY LastModifiedDate DESC LIMIT 10`,
      soqlResults: [],
      selectedSoqlRecordIds: [],
      isExecutingSoql: false,
      recentRecords: [],
      isLoadingRecent: false,

      objectType: initialObjectType,
      recordId: initialRecordId,
      recordName: "",
      searchQuery: "",
      searchResults: [],
      isSearching: false,

      // Relationships & Depth
      cloneDepth: "record_children", // 'record_only', 'record_children', 'deep_clone'
      availableChildRelations: [],
      selectedChildRelations: [],

      // Attachments & Files
      cloneFiles: true,
      cloneNotes: true,
      cloneContentVersions: true,

      // Field Mapping & Conflict Resolution
      conflictMode: "duplicate", // 'skip', 'update', 'duplicate'
      missingFieldsHandling: "skip", // 'skip', 'create', 'map'

      // Advanced Preservations
      preserveOwner: true,
      preserveRecordType: true,
      preserveLookups: true,
      preserveCurrency: true,
      preserveMultiPicklists: true,

      // Progress & Console Log State
      showPreviewModal: false,
      showProgressModal: false,
      progressStep: 0,
      progressPercent: 0,
      progressStatusText: "",
      consoleLogs: [],
      createdRecords: [],

      // Preview Summary Data
      previewSummary: null,
      isLoadingPreview: false,

      // History & Templates
      cloneHistory: [],
      cloneTemplates: [],
      activeTab: "clone" // 'clone', 'history', 'templates'
    };

    this.sourceConn = new OrgClient();
    this.destConn = new OrgClient();
    this.recordSearchRequest = 0;
  }

  componentDidMount() {
    this.discoverConnectedOrgs();
    this.loadHistoryAndTemplates();
    if (this.state.recordId) {
      this.fetchRecordDetails(this.state.recordId);
    }
  }

  // Discover connected Salesforce orgs from browser cookies
  discoverConnectedOrgs() {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      chrome.cookies.getAll({ name: "sid" }, async (cookies) => {
        if (cookies && cookies.length > 0) {
          const orgMap = new Map();

          for (let c of cookies) {
            if (c.domain && !c.domain.includes("help.salesforce.com") && !c.domain.includes("success.salesforce.com")) {
              let domain = c.domain.startsWith(".") ? c.domain.substring(1) : c.domain;
              if (domain.includes("salesforce.com") || domain.includes("force.com") || domain.includes("cloudforce.com")) {
                let apiHost = getApiHost(domain);
                if (apiHost && !orgMap.has(apiHost)) {
                  let sessionCookie = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: "https://" + apiHost }, (res) => {
                      if (chrome.runtime.lastError) { /* ignore */ }
                      resolve(res);
                    });
                  });
                  let sidValue = (sessionCookie && sessionCookie.value) ? sessionCookie.value : c.value;
                  orgMap.set(apiHost, {
                    host: apiHost,
                    sessionId: sidValue
                  });
                }
              }
            }
          }

          const orgList = Array.from(orgMap.values());
          let initialSourceHost = getApiHost(this.state.sourceHost);
          let defaultSource = (initialSourceHost && orgList.some(o => o.host === initialSourceHost))
            ? initialSourceHost
            : (orgList.length > 0 ? orgList[0].host : "");
          // Never silently clone back into the source org. A destination must be
          // chosen explicitly when only one authenticated org is available.
          let defaultDest = orgList.length > 1 ? orgList.find(o => o.host !== defaultSource)?.host || "" : "";

          this.setState({
            connectedOrgs: orgList,
            sourceHost: defaultSource,
            destHost: defaultDest
          }, () => {
            this.initConnections();
          });
        }
      });
    }
  }

  // Initialize connections for Source & Destination Orgs
  async initConnections() {
    const { sourceHost, destHost, connectedOrgs, manualDestHost, manualDestSessionId } = this.state;

    let normalizedSource = getApiHost(sourceHost);
    let sourceOrg = connectedOrgs.find(o => o.host === normalizedSource);
    let sourceSessionId = sourceOrg ? sourceOrg.sessionId : "";

    if (normalizedSource && typeof chrome !== 'undefined' && chrome.runtime) {
      let freshCookie = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: "https://" + normalizedSource }, (res) => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve(res);
        });
      });
      if (freshCookie && freshCookie.value) {
        sourceSessionId = freshCookie.value;
      }
    }
    this.sourceConn.setSession(sourceSessionId, normalizedSource);

    let normalizedDest = getApiHost(destHost);
    let destOrg = connectedOrgs.find(o => o.host === normalizedDest);
    let destSessionId = destOrg ? destOrg.sessionId : manualDestSessionId;

    if (normalizedDest && typeof chrome !== 'undefined' && chrome.runtime) {
      let freshCookie = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: "https://" + normalizedDest }, (res) => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve(res);
        });
      });
      if (freshCookie && freshCookie.value) {
        destSessionId = freshCookie.value;
      }
    }
    this.destConn.setSession(destSessionId, normalizedDest || manualDestHost);

    if (this.state.objectType) {
      this.fetchChildRelationships();
      this.fetchRecentRecords();
    }
    this.fetchAvailableSObjects();
  }

  // Fetch all queryable & createable SObjects dynamically from Source Org
  async fetchAvailableSObjects() {
    if (!this.sourceConn || !this.state.sourceHost) return;
    try {
      let res = await this.sourceConn.rest("/services/data/v60.0/sobjects");
      if (res && res.sobjects) {
        let sobjects = res.sobjects
          .filter(s => s.queryable && s.createable && !s.deprecatedAndHidden)
          .map(s => ({
            name: s.name,
            label: s.label === s.name ? s.name : `${s.label} (${s.name})`,
            custom: s.custom
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        this.setState({ availableSObjects: sobjects });
      }
    } catch (e) {
      console.warn("Failed to fetch SObjects list:", e);
    }
  }

  // Fetch 15 most recent records for selected SObject
  async fetchRecentRecords() {
    const { objectType, sourceHost } = this.state;
    if (!objectType || !sourceHost) return;
    this.setState({ isLoadingRecent: true });

    try {
      let q = `SELECT Id, Name, LastModifiedDate FROM ${objectType} ORDER BY LastModifiedDate DESC LIMIT 15`;
      let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(q)}`);
      this.setState({
        recentRecords: res?.records || [],
        isLoadingRecent: false
      });
    } catch (e) {
      try {
        let q = `SELECT Id, LastModifiedDate FROM ${objectType} ORDER BY LastModifiedDate DESC LIMIT 15`;
        let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(q)}`);
        this.setState({
          recentRecords: res?.records || [],
          isLoadingRecent: false
        });
      } catch (err) {
        this.setState({ recentRecords: [], isLoadingRecent: false });
      }
    }
  }

  // Run custom SOQL query
  async runSoqlQuery() {
    const { soqlQuery, sourceHost } = this.state;
    if (!soqlQuery || !sourceHost) return;
    const normalizedQuery = soqlQuery.trim().replace(/;\s*$/, "");
    const fromMatch = normalizedQuery.match(/\bFROM\s+([a-zA-Z0-9_]+)\b/i);
    if (!/^SELECT\s+/i.test(normalizedQuery) || !fromMatch) {
      toast.error("Enter a valid SELECT query.");
      return;
    }
    if (fromMatch[1].toLowerCase() !== this.state.objectType.toLowerCase()) {
      toast.error(`The query must select from ${this.state.objectType}.`);
      return;
    }
    if (!/\bId\b/i.test(normalizedQuery.split(/\bFROM\b/i)[0])) {
      toast.error("Include Id in the SELECT fields so records can be cloned.");
      return;
    }
    this.setState({ isExecutingSoql: true, soqlResults: [], selectedSoqlRecordIds: [] });

    try {
      let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(normalizedQuery)}`);
      let records = (res?.records || []).filter(record => isRecordId(record.Id));
      this.setState({
        soqlResults: records,
        selectedSoqlRecordIds: records.map(r => r.Id),
        isExecutingSoql: false
      });
    } catch (e) {
      toast.error("SOQL Query Error: " + e.message);
      this.setState({ isExecutingSoql: false });
    }
  }

  // Fetch Child Relationships for selected SObject
  async fetchChildRelationships() {
    const { objectType, sourceHost } = this.state;
    if (!objectType || !sourceHost) return;

    try {
      let desc = await this.sourceConn.rest(`/services/data/v60.0/sobjects/${objectType}/describe`);
      if (desc && desc.childRelationships) {
        let rels = desc.childRelationships
          .filter(r => r.relationshipName && r.childSObject)
          .map(r => ({
            name: r.relationshipName,
            childSObject: r.childSObject,
            field: r.field
          }));
        this.setState({ availableChildRelations: rels });
      }
    } catch (e) {
      console.warn("Failed to describe child relationships:", e);
    }
  }

  // Real-time record search
  async handleRecordSearch(queryStr) {
    const requestId = ++this.recordSearchRequest;
    let cleanStr = (queryStr || "").trim();
    let isId = isRecordId(cleanStr);

    this.setState({
      searchQuery: queryStr,
      recordId: isId ? cleanStr : (cleanStr ? this.state.recordId : ""),
      isSearching: !isId && cleanStr.length >= 2
    });

    if (!cleanStr || cleanStr.length < 2 || isId) {
      this.setState({ searchResults: [], isSearching: false });
      if (isId) {
        this.fetchRecordDetails(cleanStr);
      }
      return;
    }

    const { objectType } = this.state;
    try {
      const safeSearch = cleanStr.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      let q = `SELECT Id, Name FROM ${objectType} WHERE Name LIKE '%${safeSearch}%' LIMIT 8`;
      let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(q)}`);
      if (requestId !== this.recordSearchRequest) return;
      if (res && res.records) {
        this.setState({ searchResults: res.records, isSearching: false });
      } else {
        this.setState({ searchResults: [], isSearching: false });
      }
    } catch (e) {
      // Fallback search without Name field if SObject does not have Name
      try {
        let q = `SELECT Id FROM ${objectType} LIMIT 8`;
        let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(q)}`);
        if (requestId !== this.recordSearchRequest) return;
        this.setState({ searchResults: res?.records || [], isSearching: false });
      } catch (err) {
        this.setState({ searchResults: [], isSearching: false });
      }
    }
  }

  // Select record from search results
  selectRecord(rec) {
    this.setState({
      recordId: rec.Id,
      recordName: rec.Name || rec.Id,
      searchQuery: rec.Name || rec.Id,
      searchResults: []
    });
  }

  // Fetch Record Details
  async fetchRecordDetails(recordId) {
    const { objectType } = this.state;
    if (!recordId || !objectType) return;

    try {
      let q = `SELECT Id, Name FROM ${objectType} WHERE Id = '${recordId}' LIMIT 1`;
      let res = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(q)}`);
      if (res && res.records && res.records.length > 0) {
        this.setState({ recordName: res.records[0].Name || recordId });
      }
    } catch (e) {
      this.setState({ recordName: recordId });
    }
  }

  // Resolve target Record IDs across all 4 selection modes
  getTargetRecordIds() {
    const { selectionMode, recordId, searchQuery, bulkRecordIds, selectedSoqlRecordIds } = this.state;
    let ids = [];
    if (selectionMode === "search" || selectionMode === "recent") {
      let singleId = (recordId || searchQuery || "").trim();
      if (isRecordId(singleId)) ids.push(singleId);
    } else if (selectionMode === "bulk_ids") {
      ids = (bulkRecordIds || "")
        .split(/[\s,;\n]+/)
        .map(id => id.trim())
        .filter(id => isRecordId(id));
    } else if (selectionMode === "soql") {
      ids = [...(selectedSoqlRecordIds || [])];
    }
    return [...new Set(ids.filter(id => isRecordId(id)))];
  }

  validateStepOne(showMessage = true) {
    const { sourceHost, destHost, objectType } = this.state;
    let message = "";
    if (!sourceHost) message = "Connect and select a source org.";
    else if (!destHost) message = "Connect and select a destination org.";
    else if (sourceHost === destHost) message = "Source and destination must be different orgs.";
    else if (!objectType) message = "Select a Salesforce object.";
    else if (this.getTargetRecordIds().length === 0) message = "Select at least one valid record before continuing.";
    if (message && showMessage) toast.error(message);
    return !message;
  }

  goToStep(step) {
    const currentStep = this.state.activeStep;
    if (step <= currentStep) return this.setState({ activeStep: step });
    if (step !== currentStep + 1) return;
    if (currentStep === 1 && !this.validateStepOne()) return;
    this.setState({ activeStep: step });
  }

  // Generate Pre-Clone Preview Summary
  async generatePreviewSummary() {
    const { objectType, selectedChildRelations, cloneFiles, cloneDepth } = this.state;
    if (!this.validateStepOne()) return;
    let targetIds = this.getTargetRecordIds();
    if (targetIds.length === 0) {
      toast.error("Please select or enter at least one valid Record ID to clone.");
      return;
    }
    let recordId = targetIds[0];

    this.setState({ isLoadingPreview: true, showPreviewModal: true });

    try {
      // 1. Describe Parent Object in Source & Dest Orgs
      let sourceDesc = await this.sourceConn.rest(`/services/data/v60.0/sobjects/${objectType}/describe`);
      let destDesc = await this.destConn.rest(`/services/data/v60.0/sobjects/${objectType}/describe`);

      let sourceFields = sourceDesc.fields || [];
      let destFieldsMap = new Map((destDesc.fields || []).map(f => [f.name, f]));

      let missingFields = sourceFields.filter(f => !destFieldsMap.has(f.name) && f.createable);

      // 2. Query Parent Record
      let createableFieldNames = sourceFields.filter(f => f.createable).map(f => f.name).join(", ");
      let parentQuery = `SELECT ${createableFieldNames} FROM ${objectType} WHERE Id = '${recordId}'`;
      let parentRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(parentQuery)}`);
      let parentRecord = parentRes?.records?.[0] || null;

      // 3. Count Child Records
      let childCounts = [];
      let totalChildren = 0;

      for (let relName of (cloneDepth === "record_only" ? [] : selectedChildRelations)) {
        let relInfo = this.state.availableChildRelations.find(r => r.name === relName || r.childSObject === relName);
        if (relInfo) {
          try {
            let childQuery = `SELECT Id FROM ${relInfo.childSObject} WHERE ${relInfo.field} = '${recordId}'`;
            let childRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(childQuery)}`);
            let count = childRes?.records?.length || 0;
            childCounts.push({ childSObject: relInfo.childSObject, count: count });
            totalChildren += count;
          } catch (err) {
            console.warn(`Could not count child records for ${relName}:`, err);
          }
        }
      }

      // 4. Count Files / Attachments
      let filesCount = 0;
      if (cloneFiles) {
        try {
          let fileQuery = `SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${recordId}'`;
          let fileRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(fileQuery)}`);
          filesCount = fileRes?.records?.length || 0;
        } catch (err) {
          console.warn("Could not count files:", err);
        }
      }

      this.setState({
        previewSummary: {
          objectType,
          recordId,
          recordName: this.state.recordName || recordId,
          fieldsCount: sourceFields.length,
          missingFields,
          childCounts,
          totalChildren,
          filesCount,
          totalTargetRecords: targetIds.length
        },
        isLoadingPreview: false
      });

    } catch (e) {
      toast.error("Error generating preview summary: " + e.message);
      this.setState({ isLoadingPreview: false, showPreviewModal: false });
    }
  }

  // Execute Record Clone Process
  async executeClone() {
    const { objectType, selectedChildRelations, cloneFiles, cloneDepth, preserveRecordType } = this.state;
    if (!this.validateStepOne()) return;
    let targetRecordIds = this.getTargetRecordIds();

    if (targetRecordIds.length === 0) {
      toast.error("Please select or enter at least one valid Record ID to clone.");
      return;
    }

    this.setState({
      showPreviewModal: false,
      showProgressModal: true,
      progressStep: 1,
      progressPercent: 10,
      progressStatusText: `Describing Metadata for ${objectType}...`,
      consoleLogs: [`Started Record Clone pipeline for ${targetRecordIds.length} record(s)...`]
    });

    const log = (msg) => {
      this.setState(prev => ({
        consoleLogs: [...prev.consoleLogs, `[${new Date().toLocaleTimeString()}] ${msg}`]
      }));
    };

    let createdRecordsList = [];

    try {
      // Step 1: Describe Parent Metadata in both Orgs
      log(`Describing SObject metadata for ${objectType}...`);
      let sourceDesc = await this.sourceConn.rest(`/services/data/v60.0/sobjects/${objectType}/describe`);
      let destDesc = await this.destConn.rest(`/services/data/v60.0/sobjects/${objectType}/describe`);

      let destCreateableFieldsMap = new Map(
        (destDesc.fields || [])
          .filter(f => f.createable && f.type !== "address" && f.type !== "location" && f.name !== "Id")
          .map(f => [f.name, f])
      );

      let queryFields = (sourceDesc.fields || [])
        .filter(f => destCreateableFieldsMap.has(f.name))
        .map(f => f.name)
        .join(", ");

      // Map RecordTypeId if present
      let recordTypeMap = new Map();
      if (preserveRecordType && destDesc.recordTypeInfos && destDesc.recordTypeInfos.length > 0) {
        destDesc.recordTypeInfos.forEach(rt => {
          if (rt.available && rt.recordTypeId) {
            recordTypeMap.set(rt.developerName || rt.name, rt.recordTypeId);
          }
        });
      }

      let totalRecords = targetRecordIds.length;
      let currentIdx = 0;

      for (let currentRecordId of targetRecordIds) {
        currentIdx++;
        let pct = Math.floor((currentIdx / totalRecords) * 80) + 10;
        this.setState({
          progressStep: 2,
          progressPercent: pct,
          progressStatusText: `Cloning Record ${currentIdx} of ${totalRecords} (${currentRecordId})...`
        });

        log(`----------------------------------------`);
        log(`Processing Record [${currentIdx}/${totalRecords}]: ${currentRecordId}`);

        try {
          let parentRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(`SELECT ${queryFields} FROM ${objectType} WHERE Id = '${currentRecordId}'`)}`);
          let parentData = parentRes?.records?.[0];

          if (!parentData) {
            log(`⚠️ Warning: Record ${currentRecordId} not found in Source Org. Skipping.`);
            continue;
          }

          let sourceRecordTypeId = parentData["RecordTypeId"];
          let mappedRecordTypeId = null;
          if (preserveRecordType && sourceRecordTypeId && sourceDesc.recordTypeInfos) {
            let sourceRtInfo = sourceDesc.recordTypeInfos.find(rt => rt.recordTypeId === sourceRecordTypeId);
            if (sourceRtInfo) {
              let rtName = sourceRtInfo.developerName || sourceRtInfo.name;
              mappedRecordTypeId = recordTypeMap.get(rtName) || null;
            }
          }

          // Construct Clean Payload for Destination Record
          let newRecordPayload = {};
          destCreateableFieldsMap.forEach((fieldObj, fieldName) => {
            let val = parentData[fieldName];
            if (val !== undefined && val !== null && fieldName !== "Id") {
              if (fieldName === "OwnerId") return;
              if (fieldName === "RecordTypeId") {
                if (mappedRecordTypeId) {
                  newRecordPayload["RecordTypeId"] = mappedRecordTypeId;
                }
                return;
              }
              if (fieldObj.type === "reference") return; // Skip foreign lookup IDs

              newRecordPayload[fieldName] = val;
            }
          });

          log(`Creating parent record in Destination Org...`);

          let createRes = await this.destConn.rest(`/services/data/v60.0/sobjects/${objectType}`, {
            method: "POST",
            body: JSON.stringify(newRecordPayload),
            headers: {
              "Content-Type": "application/json",
              "Sforce-Duplicate-Rule-Header": "allowSave=true"
            }
          });

          let newParentId = createRes?.id;
          if (!newParentId) {
            log(`❌ Failed to create parent record ${currentRecordId} in Destination Org.`);
            continue;
          }

          let parentNameVal = parentData.Name || parentData.Subject || parentData.CaseNumber || newParentId;
          log(`✓ Created parent record in Destination Org! New ID: ${newParentId}`);

          createdRecordsList.push({
            id: newParentId,
            objectType: objectType,
            name: parentNameVal,
            url: `https://${this.state.destHost}/lightning/r/${objectType}/${newParentId}/view`,
            isParent: true
          });

          // Step 4: Clone Selected Child Records
          if (cloneDepth !== "record_only" && selectedChildRelations.length > 0) {
            for (let relName of selectedChildRelations) {
              let relInfo = this.state.availableChildRelations.find(r => r.name === relName || r.childSObject === relName);
              if (relInfo) {
                try {
                  log(`Querying child records for ${relInfo.childSObject}...`);
                  let childSourceDesc = await this.sourceConn.rest(`/services/data/v60.0/sobjects/${relInfo.childSObject}/describe`);
                  let childDestDesc = await this.destConn.rest(`/services/data/v60.0/sobjects/${relInfo.childSObject}/describe`);

                  let childDestCreateableMap = new Map(
                    (childDestDesc.fields || [])
                      .filter(f => f.createable && f.type !== "address" && f.type !== "location" && f.name !== "Id")
                      .map(f => [f.name, f])
                  );

                  let childQueryFields = (childSourceDesc.fields || [])
                    .filter(f => childDestCreateableMap.has(f.name))
                    .map(f => f.name)
                    .join(", ");

                  let childQuery = `SELECT ${childQueryFields} FROM ${relInfo.childSObject} WHERE ${relInfo.field} = '${currentRecordId}'`;
                  let childRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(childQuery)}`);
                  let childRecords = childRes?.records || [];

                  log(`Found ${childRecords.length} ${relInfo.childSObject} records to clone...`);

                  for (let childRec of childRecords) {
                    try {
                      let childPayload = {};
                      childDestCreateableMap.forEach((fieldObj, fieldName) => {
                        let val = childRec[fieldName];
                        if (val !== undefined && val !== null && fieldName !== "Id") {
                          if (fieldName === "OwnerId" || fieldName === relInfo.field) return;
                          if (fieldObj.type === "reference") return; // Skip foreign lookups
                          childPayload[fieldName] = val;
                        }
                      });

                      // Rebuild Parent Lookup ID to point to newly created parent record
                      childPayload[relInfo.field] = newParentId;

                      let childCreateRes = await this.destConn.rest(`/services/data/v60.0/sobjects/${relInfo.childSObject}`, {
                        method: "POST",
                        body: JSON.stringify(childPayload),
                        headers: {
                          "Content-Type": "application/json",
                          "Sforce-Duplicate-Rule-Header": "allowSave=true"
                        }
                      });
                      log(`  ✓ Cloned ${relInfo.childSObject} record ID: ${childCreateRes?.id}`);

                      if (childCreateRes?.id) {
                        let childNameVal = childRec.Name || childRec.Subject || childRec.CaseNumber || childCreateRes.id;
                        createdRecordsList.push({
                          id: childCreateRes.id,
                          objectType: relInfo.childSObject,
                          name: childNameVal,
                          url: `https://${this.state.destHost}/lightning/r/${relInfo.childSObject}/${childCreateRes.id}/view`,
                          isParent: false
                        });
                      }
                    } catch (childErr) {
                      log(`  ⚠️ Warning: Could not clone ${relInfo.childSObject} record (${childRec.Id || 'child'}): ${childErr.message}`);
                    }
                  }
                } catch (relErr) {
                  log(`  ⚠️ Warning: Failed querying child relation ${relName}: ${relErr.message}`);
                }
              }
            }
          }

          // Step 5: Transfer Files & Attachments
          if (cloneFiles) {
            try {
              let fileQuery = `SELECT ContentDocumentId, ContentDocument.LatestPublishedVersionId, ContentDocument.Title FROM ContentDocumentLink WHERE LinkedEntityId = '${currentRecordId}'`;
              let fileRes = await this.sourceConn.rest(`/services/data/v60.0/query?q=${encodeURIComponent(fileQuery)}`);
              let fileLinks = fileRes?.records || [];

              if (fileLinks.length > 0) {
                log(`Found ${fileLinks.length} files to transfer...`);
                for (let fileLink of fileLinks) {
                  try {
                    let versionId = fileLink?.ContentDocument?.LatestPublishedVersionId;
                    let title = fileLink?.ContentDocument?.Title || "Cloned File";

                    if (versionId) {
                      log(`  Downloading ContentVersion ${versionId} (${title})...`);
                      let cvData = await this.sourceConn.rest(`/services/data/v60.0/sobjects/ContentVersion/${versionId}`);
                      let versionData = await this.sourceConn.restBase64(cvData.VersionData);

                      let cvPayload = {
                        Title: cvData.Title,
                        PathOnClient: cvData.PathOnClient || `${title}.dat`,
                        VersionData: versionData,
                        FirstPublishLocationId: newParentId
                      };

                      let cvRes = await this.destConn.rest(`/services/data/v60.0/sobjects/ContentVersion`, {
                        method: "POST",
                        body: JSON.stringify(cvPayload),
                        headers: { "Content-Type": "application/json" }
                      });

                      log(`  ✓ Transferred ContentVersion: ${cvRes?.id}`);
                    }
                  } catch (fileErr) {
                    log(`  ⚠️ Warning: Failed to transfer file: ${fileErr.message}`);
                  }
                }
              }
            } catch (filesErr) {
              log(`  ⚠️ Warning: Could not query files: ${filesErr.message}`);
            }
          }
        } catch (recErr) {
          log(`❌ Error processing record ${currentRecordId}: ${recErr.message}`);
        }
      } // End for (let currentRecordId of targetRecordIds)

      this.setState({
        createdRecords: createdRecordsList,
        progressStep: 6,
        progressPercent: 100,
        progressStatusText: `🎉 Clone Pipeline Completed! Created ${createdRecordsList.length} total records.`,
        consoleLogs: [...this.state.consoleLogs, `[${new Date().toLocaleTimeString()}] 🎉 Clone Pipeline Completed! ${createdRecordsList.length} total records created.`]
      });

      // Save one accurate batch history entry. Parent IDs are retained so users
      // can audit multi-record runs without relying on loop-local variables.
      const createdParents = createdRecordsList.filter(item => item.isParent);
      this.saveToHistory({
        objectType,
        sourceRecordId: targetRecordIds[0],
        sourceRecordIds: targetRecordIds,
        recordName: targetRecordIds.length === 1 ? (this.state.recordName || targetRecordIds[0]) : `${targetRecordIds.length} ${objectType} records`,
        newRecordId: createdParents[0]?.id || "",
        newRecordIds: createdParents.map(item => item.id),
        sourceHost: this.state.sourceHost,
        destHost: this.state.destHost,
        timestamp: new Date().toISOString(),
        status: createdParents.length === targetRecordIds.length ? "Success" : "Partial"
      });

    } catch (err) {
      log(`❌ ERROR: ${err.message}`);
      this.setState({
        progressStatusText: "Clone Failed",
        consoleLogs: [...this.state.consoleLogs, `[${new Date().toLocaleTimeString()}] ❌ Failed: ${err.message}`]
      });
    }
  }

  // Storage for Clone History & Presets
  loadHistoryAndTemplates() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(["sfarc_clone_history", "sfarc_clone_templates"], (res) => {
        this.setState({
          cloneHistory: res.sfarc_clone_history || [],
          cloneTemplates: res.sfarc_clone_templates || []
        });
      });
    }
  }

  saveToHistory(entry) {
    const updatedHistory = [entry, ...this.state.cloneHistory.slice(0, 49)];
    this.setState({ cloneHistory: updatedHistory });
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ "sfarc_clone_history": updatedHistory });
    }
  }

  render() {
    const { connectedOrgs, sourceHost, destHost, availableSObjects, selectionMode, bulkRecordIds, soqlQuery, soqlResults, selectedSoqlRecordIds, isExecutingSoql, recentRecords, isLoadingRecent, objectType, recordId, recordName, searchQuery, searchResults, isSearching, cloneDepth, availableChildRelations, selectedChildRelations, cloneFiles, cloneNotes, cloneContentVersions, conflictMode, preserveOwner, preserveRecordType, showPreviewModal, showProgressModal, previewSummary, isLoadingPreview, progressPercent, progressStatusText, consoleLogs, createdRecords, showAuthModal, authTarget, authHost, authSessionId, activeStep } = this.state;

    let targetIdsCount = this.getTargetRecordIds().length;
    let progressWidth = ((activeStep - 1) / 3) * 100;
    let sameOrgSelected = !!sourceHost && sourceHost === destHost;
    let canContinue = this.validateStepOne(false);

    return h("div", { className: "sfarc-clone-wrapper" },

      // Sticky Top Appbar Header
      h("div", { className: "sfarc-clone-header" },
        h("div", { className: "sfarc-clone-logo-group" },
          h("img", { src: (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("icons/icon-48.png") : "../icons/icon-48.png", className: "sfarc-clone-logo-img", alt: "salesforce comet" }),
          h("div", {},
            h("h1", { className: "sfarc-clone-title" }, "Record Clone Between Orgs"),
            h("div", { className: "sfarc-clone-subtitle" }, "Zero-setup high-speed cross-org record & relationship cloner")
          )
        ),

        // Connected Orgs Selector Grid inside Header (styled as concise horizontal bar)
        h("div", { className: "sfarc-clone-header-orgs" },
          // Source Org
          h("div", { className: "sfarc-header-org-selector source" },
            h("div", { className: "sfarc-org-pill" },
              // Cloud download icon
              h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: "4px" } },
                h("path", { d: "M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.25" }),
                h("line", { x1: "12", y1: "12", x2: "12", y2: "20" }),
                h("polyline", { points: "9 17 12 20 15 17" })
              ),
              h("span", {}, "Source")
            ),
            h("select", {
              className: "sfarc-org-select-concise",
              value: sourceHost,
              onChange: (e) => this.setState({ sourceHost: e.target.value }, () => this.initConnections())
            },
              !sourceHost && h("option", { value: "" }, "Select source org"),
              connectedOrgs.map(o => h("option", { key: o.host, value: o.host }, o.host))
            ),
            h("div", { className: "sfarc-org-actions" },
              sourceHost && h("a", {
                href: "https://" + sourceHost,
                target: "_blank",
                className: "sfarc-org-action-btn open",
                title: `Open ${sourceHost} in new tab`
              },
                h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
                  h("polyline", { points: "15 3 21 3 21 9" }),
                  h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
                )
              ),
              h("div", {
                role: "button",
                className: "sfarc-org-action-btn auth",
                title: "Authorize / Connect New Source Org",
                onClick: () => this.setState({ showAuthModal: true, authTarget: "source", authHost: "", authSessionId: "" })
              },
                h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("path", { d: "M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5" }),
                  h("circle", { cx: "7.5", cy: "16.5", r: "1.5" })
                )
              ),
              h("span", { className: `sfarc-org-status-dot ${sourceHost ? "connected" : "disconnected"}`, title: sourceHost ? "Connected" : "Not connected" })
            )
          ),

          // Arrow Icon
          h("div", { className: "sfarc-org-arrow-connector" },
            h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" },
              h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }),
              h("polyline", { points: "12 5 19 12 12 19" })
            )
          ),

          // Destination Org
          h("div", { className: "sfarc-header-org-selector destination" },
            h("div", { className: "sfarc-org-pill destination" },
              // Cloud upload icon
              h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: "4px" } },
                h("path", { d: "M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.25" }),
                h("line", { x1: "12", y1: "20", x2: "12", y2: "12" }),
                h("polyline", { points: "9 15 12 12 15 15" })
              ),
              h("span", {}, "Dest")
            ),
            h("select", {
              className: "sfarc-org-select-concise",
              value: destHost,
              onChange: (e) => this.setState({ destHost: e.target.value }, () => this.initConnections())
            },
              !destHost && h("option", { value: "" }, "Select destination org"),
              connectedOrgs.map(o => h("option", { key: o.host, value: o.host }, o.host))
            ),
            h("div", { className: "sfarc-org-actions" },
              destHost && h("a", {
                href: "https://" + destHost,
                target: "_blank",
                className: "sfarc-org-action-btn open",
                title: `Open ${destHost} in new tab`
              },
                h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
                  h("polyline", { points: "15 3 21 3 21 9" }),
                  h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
                )
              ),
              h("div", {
                role: "button",
                className: "sfarc-org-action-btn auth",
                title: "Authorize / Connect New Destination Org",
                onClick: () => this.setState({ showAuthModal: true, authTarget: "dest", authHost: "", authSessionId: "" })
              },
                h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("path", { d: "M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5" }),
                  h("circle", { cx: "7.5", cy: "16.5", r: "1.5" })
                )
              ),
              h("span", { className: `sfarc-org-status-dot ${destHost ? "connected" : "disconnected"}`, title: destHost ? "Connected" : "Not connected" })
            )
          )
        )
      ),

      // Page Content Container
      h("div", { className: "sfarc-clone-container" },

        // Multi-Step Wizard Stepper Bar
        h("div", { className: "sfarc-wizard-stepper" },
          h("div", { className: "sfarc-stepper-progress-track" },
            h("div", { className: "sfarc-stepper-progress-fill", style: { width: `${progressWidth}%` } })
          ),
          [
            { step: 1, title: "Choose records", iconClass: "fa-solid fa-globe" },
            { step: 2, title: "Relationships", iconClass: "fa-solid fa-sitemap" },
            { step: 3, title: "Files & options", iconClass: "fa-solid fa-paperclip" },
            { step: 4, title: "Review", iconClass: "fa-solid fa-bolt" }
          ].map(s =>
            h("div", {
              key: s.step,
              className: "sfarc-step-item" + (activeStep === s.step ? " active" : "") + (activeStep > s.step ? " completed" : ""),
              role: "button",
              tabIndex: s.step <= activeStep + 1 ? 0 : -1,
              "aria-current": activeStep === s.step ? "step" : undefined,
              onClick: () => this.goToStep(s.step)
            },
              h("div", { className: "sfarc-step-circle" }, activeStep > s.step ? "✓" : s.step),
              h("div", { className: "sfarc-step-title" }, s.title)
            )
          )
        ),

        // STEP 1: Orgs & Target Record Setup
        activeStep === 1 && h("div", { className: "sfarc-step-content-pane" },

          // Object & Record Search Card
          h("div", { className: "sfarc-clone-section" },
            h("div", { className: "sfarc-section-heading" },
              h("div", {},
                h("h3", { className: "sfarc-section-title" }, "Choose records to clone"),
                h("p", { className: "sfarc-section-description" }, "Select an object, then choose one or more records from the source org.")
              ),
              targetIdsCount > 0 && h("div", { className: "sfarc-selection-count", role: "status" }, `${targetIdsCount} selected`)
            ),
            (!destHost || sameOrgSelected) && h("div", { className: "sfarc-inline-warning", role: "alert" },
              h("i", { className: "fa-solid fa-triangle-exclamation" }),
              sameOrgSelected
                ? "Choose a destination different from the source org."
                : "Connect a second Salesforce org and choose it as the destination."
            ),

            // Horizontal row: Object Select + Search Input (when in search mode)
            h("div", { className: "sfarc-form-row" },
              h("div", { className: "sfarc-form-group object-select" },
                h("label", { className: "sfarc-form-label" }, "Object"),
                h("select", {
                  className: "sfarc-input",
                  value: objectType,
                  onChange: (e) => {
                    let newObj = e.target.value;
                    this.setState({
                      objectType: newObj,
                      recordId: "",
                      recordName: "",
                      searchQuery: "",
                      searchResults: [],
                      bulkRecordIds: "",
                      soqlResults: [],
                      selectedSoqlRecordIds: [],
                      selectedChildRelations: [],
                      soqlQuery: `SELECT Id, Name FROM ${newObj} ORDER BY LastModifiedDate DESC LIMIT 10`
                    }, () => {
                      this.fetchChildRelationships();
                      this.fetchRecentRecords();
                    });
                  }
                },
                  (availableSObjects || []).map(obj =>
                    h("option", { key: obj.name, value: obj.name }, obj.label)
                  )
                )
              ),

              // Selection Mode 1: Single Record Search / ID Input
              selectionMode === "search" && h("div", { className: "sfarc-form-group search-input" },
                h("label", { className: "sfarc-form-label" }, "Find a record"),
                h("div", { className: "sfarc-search-results-wrapper" },
                  h("input", {
                    type: "text",
                    className: "sfarc-input",
                    placeholder: `Search ${objectType} by Name or enter 15/18-char Record ID...`,
                    value: searchQuery || recordId,
                    onInput: (e) => this.handleRecordSearch(e.target.value)
                  }),
                  searchResults.length > 0 && h("div", { className: "sfarc-search-dropdown" },
                    searchResults.map(rec =>
                      h("div", {
                        key: rec.Id,
                        className: "sfarc-search-item",
                        onClick: () => this.selectRecord(rec)
                      },
                        h("span", { className: "sfarc-search-item-title" }, rec.Name || rec.Id),
                        h("span", { className: "sfarc-search-item-subtitle" }, rec.Id)
                      )
                    )
                  )
                )
              )
            ),

            h("div", { className: "sfarc-mode-label" }, "Selection method"),
            // Smart Selection Mode Tabs
            h("div", { className: "sfarc-mode-tabs" },
              [
                { id: "search", title: "Search or ID", iconClass: "fa-solid fa-magnifying-glass" },
                { id: "bulk_ids", title: "Paste IDs", iconClass: "fa-solid fa-list-check" },
                { id: "soql", title: "SOQL", iconClass: "fa-solid fa-code" },
                { id: "recent", title: "Recent", iconClass: "fa-solid fa-clock-rotate-left" }
              ].map(tab =>
                h("button", {
                  type: "button",
                  key: tab.id,
                  className: "sfarc-mode-tab-btn" + (selectionMode === tab.id ? " active" : ""),
                  "aria-pressed": selectionMode === tab.id,
                  onClick: () => this.setState(prev => ({
                    selectionMode: tab.id,
                    searchResults: [],
                    ...((tab.id === "search" || tab.id === "recent") && tab.id !== prev.selectionMode
                      ? { recordId: "", recordName: "", searchQuery: "" }
                      : {})
                  }))
                },
                  h("i", { className: tab.iconClass, style: { marginRight: "6px" } }),
                  tab.title
                )
              )
            ),

            // Selection Mode 2: Bulk Record IDs Textarea
            selectionMode === "bulk_ids" && h("div", { className: "sfarc-form-group" },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" } },
                h("label", { className: "sfarc-form-label" }, "Enter Comma or Line-Separated Record IDs"),
                h("span", { style: { fontSize: "11px", fontWeight: "700", color: "#10b981" } },
                  `${this.getTargetRecordIds().length} valid IDs`
                )
              ),
              h("textarea", {
                className: "sfarc-bulk-textarea",
                placeholder: `Paste Record IDs separated by comma or newline...\ne.g.\n001dL000028VBWDQA4\n001dL000028VBWDQA5\n001dL000028VBWDQA6`,
                value: bulkRecordIds,
                onInput: (e) => this.setState({ bulkRecordIds: e.target.value })
              })
            ),

            // Selection Mode 3: SOQL Query Builder
            selectionMode === "soql" && h("div", { className: "sfarc-soql-box" },
              h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
                h("textarea", {
                  className: "sfarc-soql-input",
                  placeholder: `SELECT Id, Name FROM ${objectType} ORDER BY LastModifiedDate DESC LIMIT 10`,
                  value: soqlQuery,
                  onInput: (e) => this.setState({ soqlQuery: e.target.value })
                }),
                h("button", {
                  type: "button",
                  className: "sfarc-btn-primary",
                  style: { whiteSpace: "nowrap", height: "42px" },
                  onClick: () => this.runSoqlQuery(),
                  disabled: isExecutingSoql
                }, isExecutingSoql ? "Running…" : "Run query")
              ),
              soqlResults && soqlResults.length > 0 && h("div", { className: "sfarc-results-table-container" },
                h("table", { className: "sfarc-results-table" },
                  h("thead", {},
                    h("tr", {},
                      h("th", { style: { width: "40px" } },
                        h("input", {
                          type: "checkbox",
                          checked: selectedSoqlRecordIds.length === soqlResults.length,
                          onChange: (e) => {
                            this.setState({
                              selectedSoqlRecordIds: e.target.checked ? soqlResults.map(r => r.Id) : []
                            });
                          }
                        })
                      ),
                      h("th", {}, "Record ID"),
                      h("th", {}, "Name / Subject"),
                      h("th", {}, "Action")
                    )
                  ),
                  h("tbody", {},
                    soqlResults.map(rec =>
                      h("tr", { key: rec.Id },
                        h("td", {},
                          h("input", {
                            type: "checkbox",
                            checked: selectedSoqlRecordIds.includes(rec.Id),
                            onChange: (e) => {
                              let exists = selectedSoqlRecordIds.includes(rec.Id);
                              this.setState({
                                selectedSoqlRecordIds: exists
                                  ? selectedSoqlRecordIds.filter(id => id !== rec.Id)
                                  : [...selectedSoqlRecordIds, rec.Id]
                              });
                            }
                          })
                        ),
                        h("td", { style: { fontFamily: "Monaco, monospace", fontWeight: "700" } }, rec.Id),
                        h("td", {}, rec.Name || rec.Subject || rec.CaseNumber || "-"),
                        h("td", {},
                          h("button", {
                            type: "button",
                            className: "sfarc-open-record-btn",
                            onClick: () => this.setState({ recordId: rec.Id, recordName: rec.Name || rec.Id, selectionMode: "search" })
                          }, "Select")
                        )
                      )
                    )
                  )
                )
              )
            ),

            // Selection Mode 4: Recent Records Picklist
            selectionMode === "recent" && h("div", {},
              isLoadingRecent ? h("div", { style: { fontSize: "12px", color: "var(--clone-text-secondary, #94a3b8)", padding: "10px" } }, `Loading recent ${objectType} records...`)
                : (recentRecords.length === 0 ? h("div", { style: { fontSize: "12px", color: "var(--clone-text-secondary, #94a3b8)", padding: "10px" } }, `No recent ${objectType} records found.`)
                  : h("div", { className: "sfarc-recent-grid" },
                    recentRecords.map(rec =>
                      h("div", {
                        key: rec.Id,
                        className: "sfarc-recent-card" + (recordId === rec.Id ? " selected" : ""),
                        onClick: () => this.setState({ recordId: rec.Id, recordName: rec.Name || rec.Id, searchQuery: rec.Name || rec.Id })
                      },
                        h("div", { className: "rec-title", style: { fontSize: "12.5px", fontWeight: "700" } }, rec.Name || rec.Id),
                        h("div", { className: "rec-id", style: { fontSize: "11px", fontFamily: "var(--clone-mono, monospace)" } }, rec.Id)
                      )
                    )
                  ))
            )
          )
        ),

        // STEP 2: Relationship Handling Depth & Child Objects
        activeStep === 2 && h("div", { className: "sfarc-step-content-pane" },
          h("div", { className: "sfarc-clone-section" },
            h("h3", { className: "sfarc-section-title" }, "2. Relationship Handling Depth"),
            h("div", { className: "sfarc-radio-group", style: { marginBottom: "16px" } },
              [
                { id: "record_only", title: "Record only" },
                { id: "record_children", title: "Record and selected children" }
              ].map(opt =>
                h("button", {
                  key: opt.id,
                  type: "button",
                  className: "sfarc-radio-pill" + (cloneDepth === opt.id ? " active" : ""),
                  onClick: () => this.setState({ cloneDepth: opt.id })
                }, opt.title)
              )
            ),

            cloneDepth !== "record_only" && h("div", {},
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
                h("label", { className: "sfarc-form-label" }, "Select Child Relationships to Clone"),
                h("div", { style: { display: "flex", gap: "8px" } },
                  h("button", {
                    type: "button",
                    className: "sfarc-open-record-btn",
                    onClick: () => this.setState({ selectedChildRelations: availableChildRelations.map(rel => rel.name) })
                  }, "Select All"),
                  h("button", {
                    type: "button",
                    className: "sfarc-open-record-btn",
                    onClick: () => this.setState({ selectedChildRelations: [] })
                  }, "Clear All")
                )
              ),
              h("div", { className: "sfarc-checkbox-grid" },
                availableChildRelations.map(rel =>
                  h("label", { key: rel.name, className: "sfarc-checkbox-pill" },
                    h("input", {
                      type: "checkbox",
                      checked: selectedChildRelations.includes(rel.name),
                      onChange: (e) => {
                        let updated = e.target.checked
                          ? [...selectedChildRelations, rel.name]
                          : selectedChildRelations.filter(c => c !== rel.name);
                        this.setState({ selectedChildRelations: updated });
                      }
                    }),
                    `${rel.name} (${rel.childSObject})`
                  )
                )
              )
            )
          )
        ),

        // STEP 3: Attachments, Files & Advanced Settings
        activeStep === 3 && h("div", { className: "sfarc-step-content-pane" },
          h("div", { className: "sfarc-clone-section" },
            h("h3", { className: "sfarc-section-title" }, "Files"),
            h("p", { className: "sfarc-section-description", style: { marginBottom: "12px" } }, "Copy Salesforce Files and link the new versions to each cloned parent record."),
            h("div", { className: "sfarc-checkbox-grid" },
              [
                { key: "cloneFiles", label: "Copy linked Salesforce Files" }
              ].map(item =>
                h("label", { key: item.key, className: "sfarc-checkbox-pill" },
                  h("input", {
                    type: "checkbox",
                    checked: this.state[item.key],
                    onChange: (e) => this.setState({ [item.key]: e.target.checked })
                  }),
                  item.label
                )
              )
            )
          ),

          h("div", { className: "sfarc-clone-section", style: { marginTop: "16px" } },
            h("h3", { className: "sfarc-section-title" }, "Record handling"),
            h("p", { className: "sfarc-section-description", style: { marginBottom: "12px" } }, "Owners are assigned by Salesforce in the destination org. Source-org lookup IDs are excluded to prevent invalid references."),
            h("div", { className: "sfarc-checkbox-grid" },
              [
                { key: "preserveRecordType", label: "Match record type by developer name" }
              ].map(item =>
                h("label", { key: item.key, className: "sfarc-checkbox-pill" },
                  h("input", {
                    type: "checkbox",
                    checked: this.state[item.key],
                    onChange: (e) => this.setState({ [item.key]: e.target.checked })
                  }),
                  item.label
                )
              )
            )
          )
        ),

        // STEP 4: Review & Start Clone Pipeline
        activeStep === 4 && h("div", { className: "sfarc-step-content-pane" },
          h("div", { className: "sfarc-clone-section" },
            h("h3", { className: "sfarc-section-title" },
              h("i", { className: "fa-solid fa-bolt", style: { marginRight: "6px" } }),
              "4. Review & Launch Pipeline"
            ),

            h("div", { className: "sfarc-summary-grid", style: { marginTop: "12px" } },
              h("div", { className: "sfarc-summary-card" },
                h("div", { className: "sfarc-summary-number" }, targetIdsCount),
                h("div", { className: "sfarc-summary-label" }, "Target Records")
              ),
              h("div", { className: "sfarc-summary-card" },
                h("div", { className: "sfarc-summary-number" }, cloneDepth === "record_only" ? 0 : selectedChildRelations.length),
                h("div", { className: "sfarc-summary-label" }, "Child SObjects")
              ),
              h("div", { className: "sfarc-summary-card" },
                h("div", { className: "sfarc-summary-number" }, cloneFiles ? "Yes" : "No"),
                h("div", { className: "sfarc-summary-label" }, "Transfer Files")
              )
            ),

            h("table", { className: "sfarc-info-table", style: { marginTop: "16px" } },
              h("tbody", {},
                h("tr", {},
                  h("td", { className: "label" }, "Source Org"),
                  h("td", { className: "value" }, sourceHost || "-")
                ),
                h("tr", {},
                  h("td", { className: "label" }, "Destination Org"),
                  h("td", { className: "value" }, destHost || "-")
                ),
                h("tr", {},
                  h("td", { className: "label" }, "Target SObject"),
                  h("td", { className: "value" }, objectType)
                ),
                h("tr", {},
                  h("td", { className: "label" }, "Selected Child Relations"),
                  h("td", { className: "value" }, cloneDepth === "record_only" ? "None" : (selectedChildRelations.join(", ") || "None"))
                )
              )
            ),

            h("div", { style: { display: "flex", gap: "12px", marginTop: "24px" } },
              h("button", {
                type: "button",
                className: "sfarc-btn-secondary",
                style: { flex: 1 },
                onClick: () => this.generatePreviewSummary()
              },
                h("i", { className: "fa-solid fa-magnifying-glass", style: { marginRight: "6px" } }),
                isLoadingPreview ? "Checking Schema..." : "Preview Schema Summary"
              ),
              h("button", {
                type: "button",
                className: "sfarc-btn-primary",
                style: { flex: 2, backgroundColor: "#10b981", borderColor: "#10b981", fontSize: "14px", padding: "12px 24px" },
                onClick: () => this.executeClone()
              },
                h("i", { className: "fa-solid fa-bolt", style: { marginRight: "6px" } }),
                "Start Clone Pipeline Now"
              )
            )
          )
        ),

        // Footer Step Navigation Bar
        h("div", { className: "sfarc-wizard-footer" },
          h("button", {
            type: "button",
            className: "sfarc-btn-secondary",
            disabled: activeStep === 1,
            onClick: () => this.setState({ activeStep: Math.max(1, activeStep - 1) })
          }, "← Back"),              h("div", { style: { fontSize: "13px", fontWeight: "700", color: "var(--clone-text-secondary, #94a3b8)" } }, `Step ${activeStep} of 4`),

          activeStep < 4 ? h("button", {
            type: "button",
            className: "sfarc-btn-primary",
            disabled: activeStep === 1 && !canContinue,
            onClick: () => {
              if (activeStep === 1 && !this.validateStepOne()) return;
              this.setState({ activeStep: activeStep + 1 });
            }
          }, `Next: ${["Relationships", "Attachments & Settings", "Review & Launch"][activeStep - 1]} →`)
            : h("button", {
              type: "button",
              className: "sfarc-btn-primary",
              style: { backgroundColor: "#10b981", borderColor: "#10b981" },
              onClick: () => this.executeClone()
            },
              h("i", { className: "fa-solid fa-bolt", style: { marginRight: "6px" } }),
              "Start Clone Pipeline Now"
            )
        ),

        // Preview Summary Modal Dialog
        showPreviewModal && previewSummary && h("div", { className: "sfarc-modal-overlay" },
          h("div", { className: "sfarc-modal-card" },
            h("div", { className: "sfarc-modal-header" },
              h("h3", { className: "sfarc-modal-title" }, "Clone Summary & Dependency Check"),
              h("button", {
                className: "sfarc-modal-close-btn",
                onClick: () => this.setState({ showPreviewModal: false }),
                title: "Close"
              },
                h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  h("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                )
              )
            ),
            h("div", { className: "sfarc-modal-body" },
              h("div", { className: "sfarc-summary-grid" },
                h("div", { className: "sfarc-summary-card" },
                  h("div", { className: "sfarc-summary-number" }, previewSummary.fieldsCount),
                  h("div", { className: "sfarc-summary-label" }, "Fields")
                ),
                h("div", { className: "sfarc-summary-card" },
                  h("div", { className: "sfarc-summary-number" }, previewSummary.totalChildren),
                  h("div", { className: "sfarc-summary-label" }, "Child Records")
                ),
                h("div", { className: "sfarc-summary-card" },
                  h("div", { className: "sfarc-summary-number" }, previewSummary.filesCount),
                  h("div", { className: "sfarc-summary-label" }, "Files")
                )
              ),

              h("table", { className: "sfarc-info-table" },
                h("tbody", {},
                  h("tr", {},
                    h("td", { className: "label" }, "SObject"),
                    h("td", { className: "value" }, previewSummary.objectType)
                  ),
                  h("tr", {},
                    h("td", { className: "label" }, "Source Record Name"),
                    h("td", { className: "value" }, previewSummary.recordName)
                  ),
                  h("tr", {},
                    h("td", { className: "label" }, "Source Record ID"),
                    h("td", { className: "value" }, previewSummary.recordId)
                  )
                )
              ),

              previewSummary.missingFields.length > 0 && h("div", { style: { marginTop: "16px" } },
                h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f59e0b", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" } },
                  h("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } },
                    h("path", { d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                    h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                    h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
                  ),
                  `Destination Missing ${previewSummary.missingFields.length} Fields`
                ),
                h("div", { style: { fontSize: "11px", color: "#64748b" } }, previewSummary.missingFields.map(f => f.name).join(", "))
              )
            ),
            h("div", { className: "sfarc-modal-footer" },
              h("button", {
                className: "sfarc-btn-secondary",
                onClick: () => this.setState({ showPreviewModal: false })
              }, "Cancel"),
              h("button", {
                className: "sfarc-btn-primary",
                onClick: () => this.executeClone()
              }, "Start Clone Now")
            )
          )
        ),

        // Real-Time Progress Window Modal Dialog
        showProgressModal && h("div", { className: "sfarc-modal-overlay" },
          h("div", { className: "sfarc-modal-card" },
            h("div", { className: "sfarc-modal-header" },
              h("h3", { className: "sfarc-modal-title" }, "Cloning Record Between Orgs..."),
              h("button", {
                className: "sfarc-modal-close-btn",
                onClick: () => this.setState({ showProgressModal: false }),
                title: "Close"
              },
                h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  h("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                )
              )
            ),
            h("div", { className: "sfarc-modal-body" },
              h("div", { style: { fontSize: "13px", fontWeight: "700", color: "var(--clone-text-primary, #e8eaef)", marginBottom: "4px" } }, progressStatusText),
              h("div", { className: "sfarc-progress-bar-container" },
                h("div", { className: "sfarc-progress-bar-fill", style: { width: `${progressPercent}%` } })
              ),
              h("div", { className: "sfarc-console-output" }, consoleLogs.join("\n")),

              // Created Records List & Links Section
              createdRecords && createdRecords.length > 0 && h("div", { className: "sfarc-created-records-section" },
                h("div", { className: "sfarc-created-records-header" },
                  h("div", { className: "sfarc-created-records-title" },
                    `🎉 ${createdRecords.length} Records Created in Destination Org`
                  ),
                  h("button", {
                    type: "button",
                    className: "sfarc-open-record-btn",
                    style: { backgroundColor: "var(--sfarc-accent, #2196f3)", color: "#ffffff", border: "none" },
                    onClick: () => {
                      createdRecords.forEach(rec => window.open(rec.url, "_blank"));
                    }
                  }, "🚀 Open All Records in New Tabs")
                ),
                h("div", { className: "sfarc-created-records-list" },
                  createdRecords.map((rec, idx) =>
                    h("div", {
                      key: rec.id || idx,
                      className: "sfarc-created-record-item" + (rec.isParent ? " parent-rec" : "")
                    },
                      h("div", { className: "sfarc-record-info-group" },
                        h("span", { className: "sfarc-sobject-badge" + (rec.isParent ? " parent" : ""), style: rec.isParent ? { display: "inline-flex", alignItems: "center", gap: "5px" } : undefined },
                          rec.isParent ? h("span", { style: { display: "inline-flex" } },
                            h("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "currentColor", style: { marginRight: "5px" } },
                              h("path", { d: "M12 2l2.4 5.2 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8z" })
                            ),
                            `${rec.objectType} (Parent)`
                          ) : rec.objectType
                        ),
                        h("div", {},
                          h("a", {
                            href: rec.url,
                            target: "_blank",
                            className: "sfarc-record-name-link"
                          }, rec.name),
                          h("div", { className: "sfarc-record-id-sub" }, rec.id)
                        )
                      ),
                      h("a", {
                        href: rec.url,
                        target: "_blank",
                        className: "sfarc-open-record-btn",
                        title: "Open Record in Salesforce",
                        style: { display: "inline-flex", alignItems: "center", gap: "5px" }
                      },
                        h("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                          h("path", { d: "M7 17 17 7" }),
                          h("polyline", { points: "8 7 17 7 17 16" })
                        ),
                        "Open Record"
                      )
                    )
                  )
                )
              )
            ),
            h("div", { className: "sfarc-modal-footer" },
              h("button", {
                className: "sfarc-btn-primary",
                onClick: () => this.setState({ showProgressModal: false })
              }, progressPercent === 100 ? "Done" : "Close Window")
            )
          )
        ),

        // Authorize Org Modal
        showAuthModal && h("div", { className: "sfarc-modal-overlay" },
          h("div", { className: "sfarc-modal-card", style: { maxWidth: "860px", borderRadius: "18px", overflow: "hidden" } },
            h("div", { className: "sfarc-modal-header", style: { background: "var(--clone-card-2, #f8fafc)", padding: "18px 24px", borderBottom: "1px solid var(--clone-card-border, rgba(15,23,42,0.1))" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
                h("div", { style: { width: "32px", height: "32px", borderRadius: "10px", backgroundColor: "var(--clone-accent-soft, rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.12))", color: "var(--clone-warning, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" } },
                  h("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    h("path", { d: "M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5" }),
                    h("circle", { cx: "7.5", cy: "16.5", r: "1.5" })
                  )
                ),
                h("h3", { className: "sfarc-modal-title", style: { fontSize: "16px", fontWeight: "800", color: "var(--clone-text-primary, #0f172a)" } }, `Authorize ${authTarget === "source" ? "Source" : "Destination"} Org`)
              ),
              h("button", {
                className: "sfarc-modal-close-btn",
                onClick: () => this.setState({ showAuthModal: false }),
                title: "Close"
              },
                h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                  h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  h("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                )
              )
            ),
            h("div", { className: "sfarc-modal-body", style: { padding: "20px 24px" } },
              h("div", { style: { fontSize: "12px", color: "var(--clone-text-secondary, #64748b)", marginBottom: "16px", lineHeight: "1.5" } },
                "Login to open an active session in your browser, or connect an org directly using a Session ID / Access Token."
              ),

              // Visual Action Tiles
              h("div", { className: "sfarc-auth-tiles-grid" },
                // Tile 1: Production / Dev Org
                h("div", {
                  className: "sfarc-auth-tile production",
                  onClick: () => window.open("https://login.salesforce.com", "_blank")
                },
                  h("div", { className: "sfarc-auth-tile-left" },
                    h("div", { className: "sfarc-auth-tile-icon prod" },
                      h("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("circle", { cx: "12", cy: "12", r: "10" }),
                        h("path", { d: "M2 12h20" }),
                        h("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })
                      )
                    ),
                    h("div", {},
                      h("div", { className: "sfarc-auth-tile-title" }, "Production / Developer Org"),
                      h("div", { className: "sfarc-auth-tile-sub" }, "https://login.salesforce.com")
                    )
                  ),
                  h("div", { className: "sfarc-auth-tile-arrow" },
                    h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                      h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }),
                      h("polyline", { points: "12 5 19 12 12 19" })
                    )
                  )
                ),

                // Tile 2: Sandbox Org
                h("div", {
                  className: "sfarc-auth-tile sandbox",
                  onClick: () => window.open("https://test.salesforce.com", "_blank")
                },
                  h("div", { className: "sfarc-auth-tile-left" },
                    h("div", { className: "sfarc-auth-tile-icon sandbox" },
                      h("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" })
                      )
                    ),
                    h("div", {},
                      h("div", { className: "sfarc-auth-tile-title" }, "Sandbox Org"),
                      h("div", { className: "sfarc-auth-tile-sub" }, "https://test.salesforce.com")
                    )
                  ),
                  h("div", { className: "sfarc-auth-tile-arrow" },
                    h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                      h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }),
                      h("polyline", { points: "12 5 19 12 12 19" })
                    )
                  )
                )
              ),

              // Divider Badge
              h("div", { className: "sfarc-divider-badge" },
                h("span", { className: "sfarc-divider-text" }, "OR CONNECT VIA ACCESS TOKEN / SESSION ID")
              ),

              // Manual Input Form — single field: the Session ID / Access Token
              // as generated by the extension ("Copy Session ID URL"). The org
              // host is auto-detected from the pasted session link, so only one
              // parameter is needed.
              h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
                h("div", { className: "sfarc-form-group" },
                  h("label", { className: "sfarc-form-label" }, "Session ID / Access Token (SID)"),
                  h("div", { className: "sfarc-input-with-icon" },
                    h("span", { className: "sfarc-input-icon" },
                      h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                        h("path", { d: "M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5" }),
                        h("circle", { cx: "7.5", cy: "16.5", r: "1.5" })
                      )
                    ),
                    h("input", {
                      type: "password",
                      className: "sfarc-input",
                      placeholder: "Paste the session URL or SID — e.g. https://my-company.my.salesforce.com/secur/frontdoor.jsp?sid=00D...",
                      value: authSessionId,
                      onInput: (e) => this.setState({ authSessionId: e.target.value })
                    })
                  ),
                  h("div", { style: { fontSize: "11px", color: "var(--clone-text-secondary, #64748b)", lineHeight: "1.5" } },
                    "Paste the value copied by the extension's \"Copy Session ID URL\" button (a frontdoor session link) — the org host is detected automatically. A raw Session ID also works and uses the current org's host."
                  )
                )
              )
            ),
            h("div", { className: "sfarc-modal-footer", style: { padding: "14px 24px", backgroundColor: "var(--clone-card-2, #f8fafc)", borderTop: "1px solid var(--clone-card-border, rgba(15,23,42,0.1))" } },
              h("button", {
                className: "sfarc-btn-secondary",
                onClick: () => this.setState({ showAuthModal: false })
              }, "Close"),
              h("button", {
                className: "sfarc-btn-primary",
                onClick: () => {
                  // Single parameter: the Session ID / session URL generated by
                  // the extension — host is auto-detected from the value.
                  const parsed = parseSessionInput(authSessionId, this.state.sourceHost);
                  if (!parsed.host || !parsed.sessionId) {
                    toast.error("Please enter a valid Session ID or session URL.");
                    return;
                  }
                  let newOrg = { host: parsed.host, sessionId: parsed.sessionId };
                  let updatedOrgs = [newOrg, ...connectedOrgs.filter(o => o.host !== parsed.host)];
                  if (authTarget === "source") {
                    this.sourceConn.setSession(parsed.sessionId, parsed.host);
                    this.setState({ connectedOrgs: updatedOrgs, sourceHost: parsed.host, showAuthModal: false }, () => this.initConnections());
                  } else {
                    this.destConn.setSession(parsed.sessionId, parsed.host);
                    this.setState({ connectedOrgs: updatedOrgs, destHost: parsed.host, showAuthModal: false }, () => this.initConnections());
                  }
                }
              },
                h("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "currentColor", style: { marginRight: "6px", flexShrink: 0 } },
                  h("path", { d: "M13 2 3 14h7l-1 8 10-12h-7l1-8z" })
                ),
                "Connect Org Session"
              )
            )
          )
        )
      )
    );
  }
}

// Render React App
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("root");
  if (root) {
    ReactDOM.render(h(RecordCloneApp), root);
  }
});
