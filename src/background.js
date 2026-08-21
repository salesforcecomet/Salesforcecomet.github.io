
// ====== Extension Uninstall Feedback URL ======
const UNINSTALL_SURVEY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeDbm7Td86kEJq76g6phAg49BDY_qs0hUc2EdEzTVPHYTXhtQ/viewform?usp=publish-editor';
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.setUninstallURL) {
    chrome.runtime.setUninstallURL(UNINSTALL_SURVEY_URL);
}

// Session tokens are ephemeral. Remove disk-backed cache keys left by older
// releases; current releases use chrome.storage.session exclusively.
chrome.storage.local.remove(['sfarc_cached_session', 'sessionInfo']);

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sfiAutoLoginCleanup') {
        // Transient quick-login credentials (stored by the popup) must never
        // outlive a short window, even if the login page never opened.
        chrome.storage.local.remove('sfiAutoLogin');
    }
});

let sfHost;

// ════════════════════════════════════════════════════════════════════════════
//  Background Import Engine
//  Runs the data-import batch loop in the service worker so the import keeps
//  processing even when the user switches tabs (hidden pages get throttled /
//  frozen by Chrome, which is why the engine cannot live on the page alone).
//  The import page sends a serialized job; the SW executes batches, publishes
//  progress to chrome.storage.local (rendered on every page), persists the
//  job so it survives SW restarts, and streams row updates back to the page.
// ════════════════════════════════════════════════════════════════════════════
const SFIR_IMPORT_JOB_KEY = 'sfirImportJob';
const SFIR_IMPORT_PROGRESS_KEY = 'sfirTopProgress';
let sfirImportJob = null;
let sfirImportTicker = null;

function sfirAsArray(x) {
    if (!x) return [];
    if (x instanceof Array) return x;
    return [x];
}

function sfirStringIsEmpty(str) {
    return str == null || str == undefined || String(str).trim() == "";
}

function sfirConvertValueForApi(value) {
    const s = String(value ?? "").trim();
    if (!s) return null;
    if (s.toLowerCase() === "true") return true;
    if (s.toLowerCase() === "false") return false;
    const n = Number(s);
    return !Number.isNaN(n) && String(n) === s ? n : s;
}

function sfirSetNestedValue(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!(cur[k] && typeof cur[k] === "object")) cur[k] = {};
        cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
}

// MV3 service workers have no DOMParser/XMLSerializer/CharacterData, so SOAP
// requests are built and responses parsed with plain string logic.
function sfirXmlEscape(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function sfirXmlUnescape(str) {
    return String(str)
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

function sfirXmlStringify({name, attributes, value}) {
    function build(elName, elAttrs, params) {
        if (params == null) {
            return "<" + elName + elAttrs + ' xsi:nil="true"/>';
        }
        if (typeof params == "object") {
            let inner = "";
            for (let [key, val] of Object.entries(params)) {
                if (key == "_") {
                    if (val == null) {
                        elAttrs += ' xsi:nil="true"';
                    } else {
                        inner += sfirXmlEscape(val);
                    }
                } else if (key == "$xsi:type") {
                    elAttrs += ' xsi:type="' + sfirXmlEscape(val) + '"';
                } else if (val === undefined) {
                    // ignore
                } else if (Array.isArray(val)) {
                    for (let element of val) {
                        inner += build(key, "", element);
                    }
                } else {
                    inner += build(key, "", val);
                }
            }
            return "<" + elName + elAttrs + ">" + inner + "</" + elName + ">";
        }
        return "<" + elName + elAttrs + ">" + sfirXmlEscape(params) + "</" + elName + ">";
    }
    return '<?xml version="1.0" encoding="UTF-8"?>' + build(name, attributes || "", value);
}

// Minimal XML tokenizer producing a tree of {name, attrs, children, text}.
function sfirXmlParseTree(xml) {
    let pos = 0;
    const src = String(xml);
    function err(msg) { throw new Error("sfirXmlParse: " + msg + " at " + pos); }
    function skipWs() { while (pos < src.length && /\s/.test(src[pos])) pos++; }
    function readName() {
        let start = pos;
        while (pos < src.length && !/[\s\/>=]/.test(src[pos])) pos++;
        if (pos === start) err("expected tag name");
        return src.slice(start, pos);
    }
    function parseNode() {
        if (src[pos] !== "<") err("expected <");
        pos++;
        const name = readName();
        const attrs = {};
        for (;;) {
            skipWs();
            if (pos >= src.length) err("unterminated tag " + name);
            const ch = src[pos];
            if (ch === ">") { pos++; break; }
            if (ch === "/") {
                if (src[pos + 1] !== ">") err("bad self-close");
                pos += 2;
                return {name, attrs, children: [], text: ""};
            }
            const aName = readName();
            skipWs();
            let aVal = "";
            if (src[pos] === "=") {
                pos++;
                skipWs();
                const q = src[pos];
                if (q !== '\"' && q !== "'") err("bad quote");
                pos++;
                let vs = pos;
                while (pos < src.length && src[pos] !== q) pos++;
                if (pos >= src.length) err("unterminated attr " + aName);
                aVal = sfirXmlUnescape(src.slice(vs, pos));
                pos++;
            }
            attrs[aName] = aVal;
        }
        const children = [];
        let text = "";
        for (;;) {
            if (pos >= src.length) err("unterminated element " + name);
            if (src[pos] === "<") {
                if (src.startsWith("</", pos)) {
                    const end = src.indexOf(">", pos);
                    if (end === -1) err("unterminated close tag");
                    pos = end + 1;
                    break;
                }
                if (src.startsWith("<!--", pos)) {
                    const end = src.indexOf("-->", pos);
                    if (end === -1) err("unterminated comment");
                    pos = end + 3;
                    continue;
                }
                if (src.startsWith("<![CDATA[", pos)) {
                    const end = src.indexOf("]]>", pos);
                    if (end === -1) err("unterminated CDATA");
                    text += src.slice(pos + 9, end);
                    pos = end + 3;
                    continue;
                }
                children.push(parseNode());
            } else {
                const start = pos;
                while (pos < src.length && src[pos] !== "<") pos++;
                text += sfirXmlUnescape(src.slice(start, pos));
            }
        }
        return {name, attrs, children, text};
    }
    skipWs();
    // skip XML declaration / processing instructions
    while (src.startsWith("<?", pos)) {
        const end = src.indexOf("?>", pos);
        if (end === -1) err("unterminated declaration");
        pos = end + 2;
        skipWs();
    }
    const root = parseNode();
    return root;
}

function sfirFindNode(node, localName) {
    if (!node) return null;
    const bare = node.name.replace(/^.*:/, "");
    if (bare === localName) return node;
    for (const child of node.children || []) {
        const found = sfirFindNode(child, localName);
        if (found) return found;
    }
    return null;
}

function sfirXmlParse(node) {
    function parseValue(n) {
        let str = n.text || "";
        let obj = null;
        if (n.attrs && n.attrs["xsi:nil"] === "true") return null;
        const type = n.attrs && n.attrs["xsi:type"];
        if (type) obj = {"$xsi:type": type};
        for (const child of n.children || []) {
            if (obj == null) obj = {};
            const name = child.name.replace(/^.*:/, "");
            const content = parseValue(child);
            if (name in obj) {
                if (obj[name] instanceof Array) {
                    obj[name].push(content);
                } else {
                    obj[name] = [obj[name], content];
                }
            } else {
                obj[name] = content;
            }
        }
        return obj || str;
    }
    return parseValue(node);
}

const SFIR_WSDL = {
    Enterprise: {
        servicePortAddress: "/services/Soap/c/",
        targetNamespaces: ' xmlns="urn:enterprise.soap.sforce.com" xmlns:sf="urn:sobject.enterprise.soap.sforce.com"',
        apiName: "Enterprise"
    },
    Tooling: {
        servicePortAddress: "/services/Soap/T/",
        targetNamespaces: ' xmlns="urn:tooling.soap.sforce.com" xmlns:sf="urn:sobject.tooling.soap.sforce.com" xmlns:mns="urn:metadata.tooling.soap.sforce.com"',
        apiName: "Tooling"
    },
    Metadata: {
        servicePortAddress: "/services/Soap/m/",
        targetNamespaces: ' xmlns="http://soap.sforce.com/2006/04/metadata"',
        apiName: "Metadata"
    },
    Partner: {
        servicePortAddress: "/services/Soap/u/",
        targetNamespaces: ' xmlns="urn:partner.soap.sforce.com" xmlns:sf="urn:sobject.partner.soap.sforce.com"',
        apiName: "Partner"
    }
};

async function sfirSoapCall(job, method, args, headers) {
    const wsdl = SFIR_WSDL[job.apiType] || SFIR_WSDL.Enterprise;
    const url = `https://${job.instanceHostname}${wsdl.servicePortAddress}${job.apiVersion}?cache=${Math.random()}`;
    let sessionHeaderKey = wsdl.apiName == "Metadata" ? "met:SessionHeader" : "SessionHeader";
    let sessionIdKey = wsdl.apiName == "Metadata" ? "met:sessionId" : "sessionId";
    let requestMethod = wsdl.apiName == "Metadata" ? `met:${method}` : method;
    let requestAttributes = [
        'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    ];
    if (wsdl.apiName == "Metadata") {
        requestAttributes.push('xmlns:met="http://soap.sforce.com/2006/04/metadata"');
    }
    let requestBody = sfirXmlStringify({
        name: "soapenv:Envelope",
        attributes: ` ${requestAttributes.join(" ")}${wsdl.targetNamespaces}`,
        value: {
            "soapenv:Header": Object.assign({}, {[sessionHeaderKey]: {[sessionIdKey]: job.sessionId}}, headers),
            "soapenv:Body": {[requestMethod]: args}
        }
    });
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml",
            "SOAPAction": '""',
            "CallOptions": "client:salesforce comet"
        },
        body: requestBody
    });
    const text = await response.text();
    const root = sfirXmlParseTree(text);
    if (response.status == 200) {
        const responseBody = sfirFindNode(root, method + "Response");
        if (responseBody) {
            const parsed = sfirXmlParse(responseBody);
            if (parsed && typeof parsed == "object" && "result" in parsed) {
                return parsed.result;
            }
            return parsed;
        }
        return null;
    }
    let err = new Error();
    err.name = "SalesforceSoapError";
    err.detail = text;
    try {
        const fault = sfirFindNode(root, "faultstring");
        err.message = fault ? (fault.text || "").trim() : `HTTP error ${response.status} ${response.statusText || ""}`;
    } catch (ex) {
        err.message = `HTTP error ${response.status} ${response.statusText || ""}`;
    }
    throw err;
}

function sfirImportCounts(job) {
    const counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Uncertain: 0};
    const s = job.statusColumnIndex;
    if (!job.rows) return counts;
    for (const row of job.rows) {
        const st = (row[s] || "").toLowerCase();
        if (st === "queued") counts.Queued++;
        else if (st === "processing") counts.Processing++;
        else if (st === "succeeded") counts.Succeeded++;
        else if (st === "failed") counts.Failed++;
        else if (st === "uncertain" || st === "unknown outcome") counts.Uncertain++;
    }
    return counts;
}

// Progress publications are throttled + coalesced: every write to
// chrome.storage.local is broadcast to EVERY extension page (onChanged),
// and with dozens of batches per minute that storm serializes megabytes on
// each page's main thread — enough to make a freshly opened tab render
// blank. At most one storage write per SFIR_PUBLISH_INTERVAL_MS, with a
// trailing flush so the newest counts always land.
const SFIR_PUBLISH_INTERVAL_MS = 600;
let sfirPublishTimer = null;
let sfirPublishLastAt = 0;
let sfirPublishQueued = null;

function sfirImportPublish(job, finished) {
    const counts = sfirImportCounts(job);
    const total = counts.Queued + counts.Processing + counts.Succeeded + counts.Failed + counts.Uncertain;
    const done = counts.Succeeded + counts.Failed + counts.Uncertain;
    const payload = {
        running: !finished && job.running !== false,
        page: "data-import",
        label: "Importing " + (job.sobjectType || "records") + "…",
        percent: total > 0 ? Math.round(done / total * 100) : 0,
        counts,
        updatedAt: Date.now()
    };
    const send = (p) => {
        try {
            chrome.storage.local.set({[SFIR_IMPORT_PROGRESS_KEY]: p});
        } catch (e) {}
        // Stream counts to the import page if it is open, so its status
        // pills update live.
        try {
            chrome.runtime.sendMessage({action: "sfirImportProgress", counts: p.counts, percent: p.percent, running: p.running, finished: !!finished, jobId: job.jobId, seq: job.seq}).catch(() => {});
        } catch (e) {}
    };
    if (finished) {
        // Final state must always land immediately, cancel any pending flush.
        if (sfirPublishTimer) { clearTimeout(sfirPublishTimer); sfirPublishTimer = null; }
        sfirPublishQueued = null;
        sfirPublishLastAt = Date.now();
        send(payload);
        return;
    }
    const now = Date.now();
    if (now - sfirPublishLastAt >= SFIR_PUBLISH_INTERVAL_MS) {
        sfirPublishLastAt = now;
        send(payload);
        return;
    }
    // Too soon — keep only the newest payload and flush it shortly after.
    sfirPublishQueued = payload;
    if (!sfirPublishTimer) {
        sfirPublishTimer = setTimeout(() => {
            sfirPublishTimer = null;
            const p = sfirPublishQueued;
            sfirPublishQueued = null;
            if (p) {
                sfirPublishLastAt = Date.now();
                send(p);
            }
        }, Math.max(50, SFIR_PUBLISH_INTERVAL_MS - (now - sfirPublishLastAt)));
    }
}

// Stream per-batch row updates to the import page so its table / status pills
// stay live while the engine runs in the service worker.
function sfirSendBatch(job, updates) {
    if (!updates || !updates.length) return;
    try {
        chrome.runtime.sendMessage({action: "sfirImportBatch", jobId: job.jobId, seq: job.seq, updates}).catch(() => {});
    } catch (e) {}
}

// The full job (every row) is only persisted for SW-restart resume, and
// only the freshest state matters — so write it at most once per 15s with a
// trailing flush. Persisting megabytes of rows per batch was the main
// cause of the whole system stalling during large imports (every storage
// write is broadcast to every extension page).
const SFIR_PERSIST_INTERVAL_MS = 15000;
let sfirPersistTimer = null;
let sfirPersistLastAt = 0;
let sfirPersistPending = false;

function sfirWriteJobToStorage() {
    const job = sfirImportJob;
    if (!job) {
        try { chrome.storage.local.remove(SFIR_IMPORT_JOB_KEY); } catch (e) {}
        return;
    }
    try {
        chrome.storage.local.set({
            [SFIR_IMPORT_JOB_KEY]: {
                jobId: job.jobId,
                sfHost: job.sfHost,
                instanceHostname: job.instanceHostname,
                sessionId: job.sessionId,
                apiVersion: job.apiVersion,
                apiType: job.apiType,
                importAction: job.importAction,
                sobjectType: job.sobjectType,
                batchSize: job.batchSize,
                batchConcurrency: job.batchConcurrency,
                customHeaders: job.customHeaders,
                emptyValuesAsNull: job.emptyValuesAsNull !== false,
                idFieldName: job.idFieldName,
                inputIdColumnIndex: job.inputIdColumnIndex,
                statusColumnIndex: job.statusColumnIndex,
                resultIdColumnIndex: job.resultIdColumnIndex,
                actionColumnIndex: job.actionColumnIndex,
                errorColumnIndex: job.errorColumnIndex,
                header: job.header,
                rows: job.rows,
                running: job.running !== false
            }
        }, () => {
            // storage.local has a quota; very large datasets may overflow it.
            // That only loses the SW-restart resume capability — the in-memory
            // job keeps running and the page re-syncs from sfirImportGetState.
            if (chrome.runtime.lastError) {
                try {
                    chrome.storage.local.set({
                        [SFIR_IMPORT_JOB_KEY]: {
                            jobId: job.jobId,
                            sfHost: job.sfHost,
                            running: true,
                            overflowed: true
                        }
                    });
                } catch (e) {}
            }
        });
    } catch (e) {}
}

function sfirPersistJob() {
    const now = Date.now();
    if (now - sfirPersistLastAt >= SFIR_PERSIST_INTERVAL_MS) {
        sfirPersistLastAt = now;
        sfirWriteJobToStorage();
        return;
    }
    sfirPersistPending = true;
    if (!sfirPersistTimer) {
        sfirPersistTimer = setTimeout(() => {
            sfirPersistTimer = null;
            if (sfirPersistPending) {
                sfirPersistPending = false;
                sfirPersistLastAt = Date.now();
                sfirWriteJobToStorage();
            }
        }, Math.max(500, SFIR_PERSIST_INTERVAL_MS - (now - sfirPersistLastAt)));
    }
}

function sfirImportDone(job) {
    job.running = false;
    sfirImportPublish(job, true);
    if (sfirImportJob === job) sfirImportPersistOff();
}

function sfirImportPersistOff() {
    try { chrome.storage.local.remove(SFIR_IMPORT_JOB_KEY); } catch (e) {}
    if (sfirImportTicker) {
        clearInterval(sfirImportTicker);
        sfirImportTicker = null;
    }
    // Drop any pending throttled persist so a finished job is never
    // re-written to storage after removal.
    if (sfirPersistTimer) {
        clearTimeout(sfirPersistTimer);
        sfirPersistTimer = null;
    }
    sfirPersistPending = false;
}

function sfirStartTicker(job) {
    if (sfirImportTicker) clearInterval(sfirImportTicker);
    sfirImportTicker = setInterval(() => {
        // A newer job may have replaced this one — never touch its ticker.
        if (sfirImportJob !== job) {
            clearInterval(sfirImportTicker);
            sfirImportTicker = null;
            return;
        }
        if (!job || job.running === false) {
            clearInterval(sfirImportTicker);
            sfirImportTicker = null;
            return;
        }
        sfirImportPublish(job);
    }, 1500);
}

// Build one batch of SOAP args from the queued rows — mirrors the page-side
// engine (data-import.js executeBatch) so behavior is identical.
function sfirBuildBatch(job) {
    const {statusColumnIndex, inputIdColumnIndex, importAction, sobjectType, idFieldName, header} = job;
    const batchSize = +job.batchSize || 200;
    let data = job.rows;
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
    for (let i = 0; i < data.length; i++) {
        if (batchRows.length == batchSize) break;
        const row = data[i];
        if (row[statusColumnIndex] != "Queued") continue;
        batchRows.push(i);
        row[statusColumnIndex] = "Processing";
        if (importAction == "delete" || importAction == "undelete") {
            importArgs.ID.push(row[inputIdColumnIndex]);
        } else if (importAction == "deleteMetadata") {
            importArgs["met:fullNames"].push(`${sobjectType}.${row[inputIdColumnIndex]}`);
        } else if (importAction == "upsertMetadata") {
            let fieldTypes = job.fieldTypes || {};
            let sobject = {"$xsi:type": "met:CustomMetadata", "met:values": []};
            for (let c = 0; c < row.length; c++) {
                let fieldName = header[c];
                let fieldValue = row[c];
                if (String(fieldName).startsWith("_")) continue;
                if (fieldName == "DeveloperName") {
                    sobject["met:fullName"] = `${sobjectType}.${fieldValue}`;
                } else if (fieldName == "MasterLabel") {
                    sobject["met:label"] = fieldValue;
                } else {
                    if (sfirStringIsEmpty(fieldValue)) fieldValue = null;
                    let field = {"met:field": fieldName, "met:value": {"_": fieldValue}};
                    if (fieldTypes[fieldName]) field["met:value"]["$xsi:type"] = fieldTypes[fieldName];
                    sobject["met:values"].push(field);
                }
            }
            importArgs["met:metadata"].push(sobject);
        } else {
            let sobject = {"$xsi:type": sobjectType, fieldsToNull: []};
            const isTooling = job.apiType === "Tooling";
            const val = v => isTooling ? sfirConvertValueForApi(v) : v;
            for (let c = 0; c < row.length; c++) {
                const colName = header[c];
                if (!colName || colName[0] == "_") continue;
                let columnName = colName.split(":");
                let [fieldName] = columnName;
                const isId = c === inputIdColumnIndex || String(fieldName).toLowerCase() === "id";
                if (sfirStringIsEmpty(row[c])) {
                    if (!isId && job.emptyValuesAsNull !== false) {
                        const field = columnName.length == 1
                            ? (String(fieldName).includes(".") ? String(fieldName).split(".")[0] : fieldName)
                            : (/__r$/.test(fieldName) ? String(fieldName).replace(/__r$/, "__c") : fieldName + "Id");
                        sobject.fieldsToNull.push(field);
                    }
                } else if (columnName.length == 1) {
                    if (isTooling && String(fieldName).includes(".")) {
                        sfirSetNestedValue(sobject, fieldName, val(row[c]));
                    } else {
                        sobject[fieldName] = val(row[c]);
                    }
                } else {
                    let [relFieldName, typeName, subFieldName] = columnName;
                    sobject[relFieldName] = {"$xsi:type": typeName, [subFieldName]: val(row[c])};
                }
            }
            importArgs.sObjects.push(sobject);
        }
    }
    return {batchRows, importArgs};
}

async function sfirExecuteBatch(job) {
    if (job.running === false || !job.rows) return;
    let batchSize = +job.batchSize;
    if (!(batchSize > 0)) return;
    let batchConcurrency = +job.batchConcurrency;
    if (!(batchConcurrency > 0)) return;
    if (batchConcurrency <= job.activeBatches) return;
    const {batchRows, importArgs} = sfirBuildBatch(job);
    if (batchRows.length == 0) {
        if (job.activeBatches == 0) {
            sfirImportDone(job);
            sfirImportPublish(job, true);
        }
        return;
    }
    job.activeBatches++;
    sfirImportPublish(job);
    let headers = {};
    if (job.customHeaders && job.customHeaders.length > 0) {
        try {
            headers = {headers: JSON.parse(job.customHeaders)};
        } catch (e) {
            // Invalid JSON headers — ignore rather than killing the batch loop.
            headers = {};
        }
    }
    let updates = [];
    try {
        const res = await sfirSoapCall(job, job.importAction, importArgs, headers);
        let results = sfirAsArray(res);
        for (let i = 0; i < results.length; i++) {
            let result = results[i];
            let row = job.rows[batchRows[i]];
            if (!row) continue;
            if (result.success == "true") {
                row[job.statusColumnIndex] = "Succeeded";
                row[job.actionColumnIndex]
                    = job.importAction == "create" ? "Inserted"
                    : job.importAction == "update" ? "Updated"
                    : job.importAction == "upsert" || job.importAction == "upsertMetadata" ? (result.created == "true" ? "Inserted" : "Updated")
                    : job.importAction == "delete" || job.importAction == "deleteMetadata" ? "Deleted"
                    : job.importAction == "undelete" ? "Undeleted"
                    : "Unknown";
            } else {
                row[job.statusColumnIndex] = "Failed";
                row[job.actionColumnIndex] = "";
            }
            row[job.resultIdColumnIndex] = result.id || "";
            row[job.errorColumnIndex] = sfirAsArray(result.errors).map(errorNode =>
                errorNode.statusCode
                + ": " + errorNode.message
                + " [" + sfirAsArray(errorNode.fields).join(", ") + "]"
            ).join(", ");
            updates.push({
                i: batchRows[i],
                status: row[job.statusColumnIndex],
                action: row[job.actionColumnIndex] || "",
                id: row[job.resultIdColumnIndex] || "",
                error: row[job.errorColumnIndex] || ""
            });
        }
        job.consecutiveFailures = 0;
    } catch (err) {
        if (err.name != "SalesforceSoapError") throw err;
        let errorText = err.message;
        for (let idx of batchRows) {
            let row = job.rows[idx];
            if (!row) continue;
            row[job.statusColumnIndex] = "Failed";
            row[job.resultIdColumnIndex] = "";
            row[job.actionColumnIndex] = "";
            row[job.errorColumnIndex] = errorText;
            updates.push({i: idx, status: "Failed", action: "", id: "", error: errorText});
        }
        job.consecutiveFailures++;
        if (job.consecutiveFailures >= 3) {
            job.running = false;
        }
    } finally {
        job.activeBatches--;
        if (sfirImportJob === job) {
            sfirImportPublish(job);
            sfirSendBatch(job, updates);
            sfirPersistJob();
        }
        if (job.running !== false && sfirImportJob === job) {
            sfirExecuteBatch(job);
        } else if (job.activeBatches <= 0 && sfirImportJob === job) {
            sfirImportPublish(job, true);
            sfirImportPersistOff();
        }
    }
}

function sfirStartImportJob(job) {
    if (job.customHeaders && job.customHeaders.length > 0) {
        try {
            const parsedHeaders = JSON.parse(job.customHeaders);
            if (!parsedHeaders || Array.isArray(parsedHeaders) || typeof parsedHeaders !== "object") {
                return {ok: false, error: "Custom Headers must be a JSON object."};
            }
        } catch (e) {
            return {ok: false, error: "Custom Headers contains invalid JSON."};
        }
    }
    if (sfirImportJob && (sfirImportJob.jobId !== job.jobId || sfirImportJob.running !== false)) {
        // A previous loop is running — stop it before swapping in the fresh
        // job (different jobId = superseded; same jobId = page refreshed the
        // queue). Its in-flight batches must not write over the new job.
        sfirImportJob.running = false;
    }
    job.activeBatches = job.activeBatches || 0;
    job.consecutiveFailures = job.consecutiveFailures || 0;
    job.running = true;
    job.statusColumnIndex = job.statusColumnIndex;
    job.seq = Date.now();
    sfirImportJob = job;
    sfirPersistJob();
    sfirStartTicker(job);
    // Fill the concurrency window immediately. Each completed request starts
    // one replacement, so configured concurrency is effective from the start.
    const concurrency = Math.max(1, +job.batchConcurrency || 1);
    for (let i = 0; i < concurrency; i++) sfirExecuteBatch(job);
    return {ok: true, jobId: job.jobId, seq: job.seq};
}

function sfirStopImportJob(jobId) {
    if (!sfirImportJob) return {ok: true};
    if (jobId && sfirImportJob.jobId !== jobId) return {ok: true};
    sfirImportJob.running = false;
    sfirImportPublish(sfirImportJob, true);
    sfirImportPersistOff();
    return {ok: true};
}

function sfirGetImportState() {
    if (!sfirImportJob) return {ok: true, running: false};
    const counts = sfirImportCounts(sfirImportJob);
    return {
        ok: true,
        running: sfirImportJob.running !== false,
        jobId: sfirImportJob.jobId,
        seq: sfirImportJob.seq,
        sfHost: sfirImportJob.sfHost,
        counts,
        header: sfirImportJob.header,
        rows: sfirImportJob.rows,
        apiType: sfirImportJob.apiType,
        importAction: sfirImportJob.importAction,
        sobjectType: sfirImportJob.sobjectType
    };
}

// Rehydrate a persisted job when the service worker (re)starts so an import
// that was mid-flight keeps running even across SW restarts.
function sfirRehydrateJob() {
    chrome.storage.local.get(SFIR_IMPORT_JOB_KEY, (result) => {
        const job = result && result[SFIR_IMPORT_JOB_KEY];
        if (!job || !job.rows) return;
        if (job.running === false) return;
        // An insert response may have been lost after Salesforce committed it.
        // Never auto-retry that ambiguous row; non-create operations are safe
        // to retry using their ID/external ID.
        for (const row of job.rows) {
            if (String(row[job.statusColumnIndex] || "").toLowerCase() !== "processing") continue;
            if (job.importAction === "create") {
                row[job.statusColumnIndex] = "Uncertain";
                if (job.errorColumnIndex >= 0) row[job.errorColumnIndex] = "Unknown outcome: verify the record before retrying.";
            } else {
                row[job.statusColumnIndex] = "Queued";
            }
        }
        // If the import page is open it owns the queue (it will adopt this
        // job via sfirImportGetState) — never double-run.
        chrome.tabs.query({url: chrome.runtime.getURL("src/data-import.html") + "*"}, (tabs) => {
            if (tabs && tabs.length > 0) return;
            sfirStartImportJob(Object.assign({}, job, {
                activeBatches: 0,
                consecutiveFailures: 0
            }));
        });
    });
}

// Resume any import that was mid-flight when the service worker (re)started.
sfirRehydrateJob();

const LOG_BODY_CACHE_MAX = 20;
const logBodyCache = new Map();
function cacheLogBody(key, value) {
    // LRU eviction: delete oldest entries when over limit
    if (logBodyCache.size >= LOG_BODY_CACHE_MAX) {
        const oldestKey = logBodyCache.keys().next().value;
        logBodyCache.delete(oldestKey);
    }
    logBodyCache.set(key, value);
}

// ====== Proxy URL allowlist (security) ======
// The background proxy must never fetch arbitrary URLs on behalf of a
// content script — an open proxy is a store-review and security violation.
// Only Salesforce-family HTTPS hosts (matching host_permissions), plus the
// extension's own blob:/data:/chrome-extension: URLs, are allowed.
const SF_HOST_SUFFIX_RE = /(^|\.)(salesforce\.com|force\.com|salesforce-setup\.com|visualforce\.com|cloudforce\.com|salesforce-communities\.com)$/i;
function isAllowedProxyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
        const url = new URL(rawUrl);
        if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
        if (url.protocol === 'chrome-extension:') return true;
        if (url.protocol !== 'https:') return false;
        return SF_HOST_SUFFIX_RE.test(url.hostname);
    } catch (e) {
        return false;
    }
}

// Open new tab immediately next to current active tab
function createTabNextToCurrent(tabProps, sender) {
    const activeTab = sender && sender.tab ? sender.tab : null;
    if (activeTab && activeTab.index !== undefined && activeTab.windowId !== undefined) {
        chrome.tabs.create({
            ...tabProps,
            windowId: activeTab.windowId,
            index: activeTab.index + 1
        });
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const current = tabs && tabs[0];
            if (current && current.index !== undefined) {
                chrome.tabs.create({
                    ...tabProps,
                    windowId: current.windowId,
                    index: current.index + 1
                });
            } else {
                chrome.tabs.create(tabProps);
            }
        });
    }
}

// Pages that make sense as a single instance — re-launching them should focus
// the already-open tab instead of stacking another copy.
const SINGLE_INSTANCE_PAGES = new Set([
    'settings', 'welcome', 'org-limits', 'api-statistics', 'automation-cascade',
    'diff-checker', 'event-monitor', 'bulk-permission-wizard', 'bulk-field-builder',
    'code-coverage', 'graphql-explorer', 'record-viewer', 'code-editor',
    'metadata-exporter', 'log-viewer', 'rest-explorer', 'anonymous-apex'
]);

// Reuse an already-open extension page tab when possible: an exact URL match is
// always reused; for single-instance pages any open tab of the same page is
// focused (params like ?host= are ignored). Otherwise a new tab is created.
function reuseOrCreateExtensionTab(url, sender, page) {
    const pagePath = url.split('?')[0];
    // NOTE: chrome.tabs.query's url filter needs the 'tabs' permission (which we
    // intentionally don't request), so it can silently return zero matches for
    // our own chrome-extension:// pages. Query all tabs and filter manually —
    // an extension can always read the URL of its own pages.
    chrome.tabs.query({}, (allTabs) => {
        const existingTabs = (allTabs || []).filter(t => t.url && t.url.split('?')[0] === pagePath);
        let targetTab = null;
        if (existingTabs.length > 0) {
            if (existingTabs.some(t => t.url === url)) {
                targetTab = existingTabs.find(t => t.url === url);
            } else if (SINGLE_INSTANCE_PAGES.has(page)) {
                targetTab = existingTabs[0];
            }
        }
        if (targetTab && targetTab.id) {
            chrome.tabs.update(targetTab.id, { active: true });
            if (targetTab.windowId) {
                chrome.windows.update(targetTab.windowId, { focused: true });
            }
            return;
        }
        createTabNextToCurrent({ url: url, active: true }, sender);
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Keep-alive ping from content scripts to prevent stale connections
    if (request.action === 'keepAlive') {
        sendResponse({ alive: true });
        return true;
    }

    if (request.message === "getSfHost") {
        if (!request.url || request.url.includes("null") || request.url === "https://null/") {
            sendResponse(null);
            return true;
        }
        let currentDomain = "";
        try {
            currentDomain = new URL(request.url).hostname;
        } catch (e) {
            sendResponse(null);
            return true;
        }
        if (!currentDomain || currentDomain === "null") {
            sendResponse(null);
            return true;
        }
        chrome.cookies.get({ url: request.url, name: "sid", storeId: sender.tab ? sender.tab.cookieStoreId : undefined }, cookie => {
            const err = chrome.runtime.lastError;
            if (err || !cookie || currentDomain.endsWith(".mcas.ms")) {
                sendResponse(currentDomain);
                return;
            }
            const [orgId] = cookie.value.split("!");
            const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn", "force.com"];

            // Use Promise.all to avoid calling sendResponse multiple times or never
            Promise.all(orderedDomains.map(domain =>
                new Promise(resolve => {
                    chrome.cookies.getAll({ name: "sid", domain: domain, secure: true, storeId: sender.tab ? sender.tab.cookieStoreId : undefined }, cookies => {
                        const err2 = chrome.runtime.lastError;
                        if (err2 || !cookies) {
                            resolve(null);
                            return;
                        }
                        const match = cookies.find(c => c && c.value && c.value.startsWith(orgId + "!") && c.domain !== "help.salesforce.com");
                        resolve(match ? match.domain : null);
                    });
                })
            )).then(results => {
                // Pick the first match in priority order
                const foundDomain = results.find(d => d !== null);
                sendResponse(foundDomain || currentDomain);
            });
        });
        return true;
    }
    if (request.message === "getSession") {
        sfHost = request.sfHost;
        if (!sfHost || sfHost === "null" || sfHost === "undefined") {
            sendResponse(null);
            return true;
        }
        chrome.cookies.get({ url: "https://" + sfHost, name: "sid", storeId: sender.tab ? sender.tab.cookieStoreId : undefined }, sessionCookie => {
            const err = chrome.runtime.lastError;
            if (err || !sessionCookie) {
                sendResponse(null);
                return;
            }
            let session = { key: sessionCookie.value, hostname: sessionCookie.domain };
            sendResponse(session);
        });
        return true;
    } else if (request.message === "createWindow") {
        const brow = typeof browser === "undefined" ? chrome : browser;
        brow.windows.create({
            url: request.url,
            incognito: request.incognito ?? false
        });
    } else if (request.message === "reloadPage") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    }

    // ── Background data-import engine (runs batches in the SW so the import
    // keeps processing while the user switches tabs) ──
    if (request.action === 'sfirImportStart') {
        try {
            sendResponse(sfirStartImportJob(request.job));
        } catch (e) {
            sendResponse({ok: false, error: (e && e.message) || String(e)});
        }
        return true;
    }
    if (request.action === 'sfirImportStop') {
        sendResponse(sfirStopImportJob(request.jobId));
        return true;
    }
    if (request.action === 'sfirImportGetState') {
        sendResponse(sfirGetImportState());
        return true;
    }

    if (request.action === 'getCookie') {
        const potentialNames = ['sid', 'sid_Client', '__Host-sid'];

        const blacklist = request.blacklist || [];

        // Fetch only 'sid' cookies instead of every cookie in the browser (BUG 8 fix)
        const requestedNames = request.name ? [request.name, ...potentialNames] : potentialNames;
        const uniqueNames = [...new Set(requestedNames)];

        Promise.all(uniqueNames.map(name =>
            new Promise(resolve => chrome.cookies.getAll({ name }, resolve))
        )).then(results => {
            const cookies = results.flat();

            // Find ALL matching session cookies
            let matchingCookies = cookies;

            // Apply blacklist
            if (blacklist.length > 0) {
                matchingCookies = matchingCookies.filter(c => !blacklist.includes(c.value));
            }

            if (!matchingCookies || matchingCookies.length === 0) {
                console.warn(`salesforce comet: No session cookies found for names: ${potentialNames.join(', ')}`);
                sendResponse(null);
                return;
            }

            let bestCookie = null;
            let targetHostname = null;

            if (request.url) {
                try {
                    targetHostname = new URL(request.url).hostname;
                } catch (e) { }
            } else if (sender.tab && sender.tab.url && !sender.tab.url.startsWith('chrome-extension:')) {
                try {
                    targetHostname = new URL(sender.tab.url).hostname;
                } catch (e) { }
            }

            // Silently process cookies

            if (targetHostname) {
                // Priority 1: Base Org Name match across salesforce.com domains
                if (targetHostname.includes('.lightning.force.com') || targetHostname.includes('.force.com')) {
                    const baseOrgName = targetHostname.split('.')[0];
                    bestCookie = matchingCookies.find(c => c.domain.includes(baseOrgName) && (c.domain.includes('.my.salesforce.com') || c.domain.includes('.salesforce.com')));
                }

                // Priority 2: Exact domain match or sub-domain match for the current tab's hostname
                if (!bestCookie) {
                    bestCookie = matchingCookies.find(c => targetHostname.endsWith(c.domain.startsWith('.') ? c.domain.substring(1) : c.domain));
                }

                // Priority 3: Visualforce to My Domain conversion match
                if (!bestCookie && targetHostname.includes('--c.visualforce.com')) {
                    const parts = targetHostname.split('--c.visualforce.com');
                    const myDomain = parts[0].replace('--', '-') + '.my.salesforce.com';
                    bestCookie = matchingCookies.find(c => c.domain.includes(myDomain));
                }
            }

            // Fallback 1: Preferred domains (Global search)
            if (!bestCookie) {
                bestCookie = matchingCookies.find(c => c.domain.includes('.my.salesforce.com'));
            }
            if (!bestCookie) {
                bestCookie = matchingCookies.find(c => c.domain.includes('.salesforce.com'));
            }

            // Fallback 2: Prefer standard session cookie names — but ONLY among
            // Salesforce-domain cookies. The initial cookies.getAll({name:'sid'})
            // is global, so a non-Salesforce site using a cookie literally named
            // "sid" must never be mistaken for a Salesforce session (that would
            // cause wrong-org 401s or wrong-org API calls in multi-org browsers).
            const salesforceCookies = matchingCookies.filter(c =>
                c && /(?:salesforce|force|cloudforce|visualforce|sfcrmproducts)\.(?:com|cn|mil)$/i.test(c.domain || '')
            );
            if (!bestCookie) {
                bestCookie = salesforceCookies.find(c => c.name === '__Host-sid');
            }
            if (!bestCookie) {
                bestCookie = salesforceCookies.find(c => c.name === 'sid');
            }
            if (!bestCookie) {
                bestCookie = salesforceCookies[0];
            }
            // NOTE: deliberately no "first available cookie of any kind" fallback —
            // a random unrelated 'sid' cookie is worse than no session at all.

            if (!bestCookie) {
                console.warn(`salesforce comet: No suitable session cookie found`);
            }

            sendResponse(bestCookie || null);
        }).catch(() => sendResponse(null));

        return true; // Indicates async response
    }

    if (request.action === 'fetch') {
        const { url, options = {} } = request;

        // Reject any URL outside the Salesforce allowlist before touching the network.
        if (!isAllowedProxyUrl(url)) {
            sendResponse({
                ok: false,
                status: 0,
                statusText: 'Blocked',
                error: `Blocked proxy fetch to non-Salesforce URL: "${url}"`
            });
            return true;
        }

        const isLogBody = url.includes('/tooling/sobjects/ApexLog/') && url.endsWith('/Body');
        if (isLogBody && logBodyCache.has(url)) {
            sendResponse(logBodyCache.get(url));
            return true;
        }

        // Sanitize options: only pass safe, serializable fetch fields
        const safeOptions = {
            method: options.method || 'GET',
            headers: options.headers || {},
            // MV3 service workers: do NOT include 'credentials' or 'cache' as they can cause issues
        };
        if (options.body !== undefined && options.body !== null) {
            safeOptions.body = typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;
        }

        // Validate URL before attempting fetch
        if (!url || url.startsWith('null') || url.startsWith('undefined')) {
            sendResponse({
                ok: false,
                status: 0,
                error: `Invalid URL: "${url}" — Salesforce session may not be initialized yet.`
            });
            return true;
        }

        // Background script fetch — wrap in try/catch for MV3 service worker stability
        (async () => {
            try {
                const response = await fetch(url, safeOptions);
                const text = await response.text();
                const responseData = {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    text: text
                };
                if (isLogBody && response.ok) {
                    cacheLogBody(url, responseData);
                }
                sendResponse(responseData);
            } catch (error) {
                console.error('salesforce comet: Background fetch failed for URL:', url, 'Error:', error);
                sendResponse({
                    ok: false,
                    status: 0,
                    statusText: 'Network Error',
                    error: error.message || 'Failed to fetch — network unreachable or service worker restarted.'
                });
            }
        })();

        return true; // Async
    }

    if (request.action === 'fetchBlob') {
        const { url } = request;
        // Same allowlist as the JSON proxy — never fetch arbitrary hosts.
        if (!isAllowedProxyUrl(url)) {
            sendResponse({ ok: false, error: `Blocked proxy fetch to non-Salesforce URL: "${url}"` });
            return true;
        }
        (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    sendResponse({ ok: false, error: 'HTTP ' + response.status });
                    return;
                }
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ ok: true, dataUrl: reader.result });
                };
                reader.onerror = () => {
                    sendResponse({ ok: false, error: 'FileReader error' });
                };
                reader.readAsDataURL(blob);
            } catch (error) {
                sendResponse({ ok: false, error: error.message });
            }
        })();
        return true; // Async
    }

    // Inject console suppressor into the page's MAIN world (bypasses Salesforce CSP)
    if (request.action === 'inject-console-suppressor') {
        const tabId = sender.tab && sender.tab.id;
        if (tabId) {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['src/console-suppressor.js'],
                world: 'MAIN'
            }).catch(() => {
                // Silent — suppression is best-effort
            });
        }
        sendResponse({ ok: true });
        return false;
    }

    if (request.action === 'openIncognito') {
        chrome.windows.create({
            url: request.url,
            incognito: true,
            state: 'maximized'
        });
        sendResponse({ success: true });
    }

    if (request.action === 'quick-login') {
        const acc = request.account;
        const loginData = {
            username: acc.username,
            password: acc.password || '',
            url: acc.loginUrl,
            timestamp: Date.now()
        };

        // Watchdog: transient credentials must not outlive a short window.
        chrome.alarms.create('sfiAutoLoginCleanup', { when: Date.now() + 40000 }).catch(() => { });

        chrome.storage.local.set({ sfiAutoLogin: loginData }, () => {
            let url = acc.loginUrl;
            if (!url.startsWith('http')) url = 'https://' + url;
            const cleanUrl = new URL(url);
            cleanUrl.searchParams.set('un', acc.username);
            // sender.tab may be missing (e.g. the popup); fall back to the most
            // recently focused tab so the login page opens in a real tab.
            if (sender.tab && sender.tab.id) {
                chrome.tabs.update(sender.tab.id, { url: cleanUrl.toString() });
            } else {
                chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                    const tab = tabs && tabs[0];
                    if (tab && tab.id) {
                        chrome.tabs.update(tab.id, { url: cleanUrl.toString() });
                    } else {
                        chrome.tabs.create({ url: cleanUrl.toString(), active: true });
                    }
                });
            }
        });
        sendResponse({ success: true });
    }

    if (request.action === 'loadMain') {
        const tabId = sender.tab && sender.tab.id;
        if (!tabId) {
            sendResponse({ success: false, error: 'No sender tab available for script injection.' });
            return;
        }

        // Never inject the in-org UI into Salesforce-owned public properties.
        // `*.salesforce.com` also matches trailhead.salesforce.com, so relying
        // on the match pattern alone is not sufficient.
        let senderHost = '';
        try {
            senderHost = new URL(sender.tab.url || sender.url || '').hostname.toLowerCase();
        } catch (e) { }
        const excludedHosts = new Set([
            'trailhead.salesforce.com',
            'help.salesforce.com',
            'developer.salesforce.com',
            'status.salesforce.com',
            'trust.salesforce.com'
        ]);
        if (!senderHost || excludedHosts.has(senderHost)) {
            sendResponse({ success: false, error: 'Salesforce Comet is not injected on this Salesforce public site.' });
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            // Reserve initialization in the tab in the same operation that
            // checks it. This closes the check-then-inject race when startup,
            // a keyboard shortcut, and a SPA recovery request arrive together.
            func: () => {
                if (window.__SFARC_MAIN_LOADED__ && window.togglePanel) return 'loaded';
                if (window.__SFARC_MAIN_LOADING__) return 'loading';
                window.__SFARC_MAIN_LOADING__ = true;
                return 'reserved';
            }
        }).then((results) => {
            const state = results && results[0] && results[0].result;
            if (state === 'loaded' || state === 'loading') {
                sendResponse({ success: true, alreadyLoaded: state === 'loaded', loading: state === 'loading' });
                return null;
            }

            return chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['src/console-suppressor.js'],
                world: 'MAIN'
            }).catch(() => { }).then(() => chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['src/glass-toast.css', 'src/inspector.css', 'src/devtools-styles.css', 'src/bulk-field-builder.css', 'src/controls.css']
            })).then(() => {
                // Then inject scripts
                return chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [
                        'src/glass-toast.js',
                        'src/lib/font-awesome.min.js',
                        'src/data-builder.js',
                        'src/code-search.js',
                        'src/bulk-field-builder.js',
                        'src/close-on-outside.js',
                        'src/smart-suggestions.js',
                        'src/main.js'
                    ]
                });
            }).then(() => {
                return chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        window.__SFARC_MAIN_LOADED__ = true;
                        window.__SFARC_MAIN_LOADING__ = false;
                    }
                });
            }).then(() => {
                sendResponse({ success: true });
            });
        }).catch((error) => {
            console.error('Failed to load main logic:', error);
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => { window.__SFARC_MAIN_LOADING__ = false; }
            }).catch(() => { }).finally(() => {
                sendResponse({ success: false, error: error.message });
            });
        });

        return true; // Async
    }

    if (request.action === 'openExtensionPage') {
        let url;
        let paramsObj = request.params || {};
        if (!paramsObj.host) {
            if (sender.tab && sender.tab.url) {
                try {
                    const tabUrl = new URL(sender.tab.url);
                    if (tabUrl.hostname.includes('salesforce') || tabUrl.hostname.includes('force.com')) {
                        paramsObj.host = tabUrl.hostname;
                    }
                } catch (e) { }
            }
        }
        const params = '?' + new URLSearchParams(paramsObj).toString();

        // The four SFIR tabs (Export/Import/Limits/Metadata) live inside the
        // persistent shell (sfir-shell.html): the top bar is rendered once and
        // never reloads; the tab bodies are iframes that swap underneath it.
        const shellTab = (tab) => chrome.runtime.getURL('src/sfir-shell.html' + params + (params.length > 1 ? '&' : '') + 'tab=' + tab);

        switch (request.page) {
            case 'sfir-shell':
                url = chrome.runtime.getURL('src/sfir-shell.html' + params);
                break;
            case 'data-export':
                url = shellTab('export');
                break;
            case 'record-clone':
                url = chrome.runtime.getURL('src/record-clone.html' + params);
                break;
            case 'anonymous-apex':
                url = chrome.runtime.getURL('src/anonymous-apex.html' + params);
                break;
            case 'data-import':
                url = shellTab('import');
                break;
            case 'metadata':
            case 'metadata-exporter':
                url = shellTab('metadata');
                break;

            case 'automation-cascade':
                url = chrome.runtime.getURL('src/automation-cascade.html' + params);
                break;
            case 'code-editor':
                url = chrome.runtime.getURL('src/code-editor.html' + params);
                break;
            case 'bulk-permission-wizard':
                url = chrome.runtime.getURL('src/bulk-permission-wizard.html' + params);
                break;
            case 'record-viewer':
                url = chrome.runtime.getURL('src/record-viewer.html' + params);
                break;
            case 'debug-logs-tab':
            case 'log-viewer': {
                // Pre-cache the session for the standalone tab before opening it.
                // When the tab opens, it becomes the active tab, making
                // getSessionFromActiveTab() unreliable. We solve this by storing
                // the session directly from the sender tab's cookies now.
                const targetUrl = chrome.runtime.getURL(`src/${request.page}.html` + params);
                const senderTab = sender.tab;

                const openLogViewer = (cachedSession) => {
                    if (cachedSession) {
                        const cleanInstanceUrl = (cachedSession.instanceUrl || '').replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
                        chrome.storage.session.set({
                            sfarc_cached_session: {
                                sessionId: cachedSession.sessionId,
                                instanceUrl: cleanInstanceUrl,
                                timestamp: Date.now()
                            }
                        }, () => {
                            createTabNextToCurrent({ url: targetUrl, active: true }, sender);
                        });
                    } else {
                        createTabNextToCurrent({ url: targetUrl, active: true }, sender);
                    }
                };

                if (request.sessionAuth && request.sessionAuth.sessionId && request.sessionAuth.instanceUrl) {
                    openLogViewer(request.sessionAuth);
                    return true;
                }

                if (senderTab && senderTab.url) {
                    try {
                        const senderUrl = new URL(senderTab.url);
                        if (senderUrl.hostname.includes('salesforce') || senderUrl.hostname.includes('force.com')) {
                            // Normalize to my.salesforce.com for API calls
                            let instanceHostname = senderUrl.hostname;
                            if (instanceHostname.includes('.lightning.force.com')) {
                                instanceHostname = instanceHostname.replace('.lightning.force.com', '.my.salesforce.com');
                            }
                            if (instanceHostname.includes('.trailblaze.my.salesforce-setup.com')) {
                                instanceHostname = instanceHostname.replace('.trailblaze.my.salesforce-setup.com', '.trailblaze.my.salesforce.com');
                            } else if (instanceHostname.includes('.my.salesforce-setup.com')) {
                                instanceHostname = instanceHostname.replace('.my.salesforce-setup.com', '.my.salesforce.com');
                            } else if (instanceHostname.includes('.salesforce-setup.com')) {
                                instanceHostname = instanceHostname.replace('.salesforce-setup.com', '.my.salesforce.com');
                            }
                            instanceHostname = instanceHostname.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
                            const instanceUrl = `https://${instanceHostname}`;

                            // Extract the org prefix just like Speedy Debugger
                            let domainUrl = senderUrl.hostname.split('.')[0];
                            let domainUrldev = domainUrl;

                            if (domainUrl.includes('dev-ed')) {
                                domainUrl = domainUrl + '.develop';
                            }

                            const possibleDomains = [
                                domainUrl + '.my.salesforce.com',
                                domainUrldev + '.my.salesforce.com',
                                domainUrl + '.sandbox.my.salesforce.com',
                                domainUrldev + '.sandbox.my.salesforce.com',
                                senderUrl.hostname // Fallback to whatever they are currently on
                            ];

                            // Try to get 'sid' cookie for these domains
                            Promise.all(possibleDomains.map(domain =>
                                new Promise(resolve => chrome.cookies.getAll({ name: 'sid', domain: domain }, resolve))
                            )).then(results => {
                                // Flatten and find the first valid 'sid' cookie
                                const allCookies = results.flat().filter(c => c && c.value);
                                let sessionCookie = allCookies[0];

                                // Fallback: if strict domain search failed, do a global 'sid' search and filter
                                if (!sessionCookie) {
                                    return new Promise(resolve => chrome.cookies.getAll({ name: 'sid' }, resolve))
                                        .then(globalCookies => {
                                            const filtered = globalCookies.filter(c => c && c.value);
                                            // Priority 1: .my.salesforce.com
                                            let best = filtered.find(c => c.domain.includes('.my.salesforce.com'));
                                            // Priority 2: .salesforce.com
                                            if (!best) best = filtered.find(c => c.domain.includes('.salesforce.com'));

                                            if (best) {
                                                openLogViewer({
                                                    sessionId: decodeURIComponent(best.value),
                                                    instanceUrl: `https://${best.domain.startsWith('.') ? best.domain.substring(1) : best.domain}`
                                                });
                                            } else {
                                                openLogViewer(null);
                                            }
                                        });
                                }

                                if (sessionCookie) {
                                    const bestDomain = sessionCookie.domain.startsWith('.') ? sessionCookie.domain.substring(1) : sessionCookie.domain;
                                    openLogViewer({
                                        sessionId: decodeURIComponent(sessionCookie.value),
                                        instanceUrl: `https://${bestDomain}`
                                    });
                                } else {
                                    openLogViewer(null);
                                }
                            }).catch(() => openLogViewer(null));
                        } else {
                            openLogViewer(null);
                        }
                    } catch (e) {
                        openLogViewer(null);
                    }
                } else {
                    openLogViewer(null);
                }
                return true; // async
            }
            case 'data-builder':
                url = chrome.runtime.getURL('src/data-builder.html' + params);
                break;
            case 'settings':
                url = chrome.runtime.getURL('src/settings.html' + params);
                break;
            case 'rest-explorer':
                url = chrome.runtime.getURL('src/rest-explorer.html' + params);
                break;
            case 'graphql-explorer':
                url = chrome.runtime.getURL('src/graphql-explorer.html' + params);
                break;
            case 'org-limits':
                url = shellTab('limits');
                break;
            case 'diff-checker':
                url = chrome.runtime.getURL('src/diff-checker.html' + params);
                break;
            case 'event-monitor':
                url = chrome.runtime.getURL('src/event-monitor.html' + params);
                break;
            case 'bulk-field-builder':
            case 'bulk-field':
                url = chrome.runtime.getURL('src/bulk-field-builder.html' + params);
                break;
            case 'code-coverage':
                url = chrome.runtime.getURL('src/code-coverage.html' + params);
                break;
            default:
                console.warn('Unknown extension page requested:', request.page);
                return;
        }

        if (url) {
            chrome.storage.local.get(['sfarc_editor_launch_mode'], (res) => {
                const launchMode = res.sfarc_editor_launch_mode || 'tab';

                if (request.page === 'code-editor' || url.includes('code-editor.html')) {
                    const editorUrlPrefix = chrome.runtime.getURL('src/code-editor.html');
                    const targetHost = (paramsObj.host || '').toLowerCase();
                    const editorUrlHost = (tabUrl) => {
                        try { return (new URL(tabUrl).searchParams.get('host') || '').toLowerCase(); }
                        catch (e) { return ''; }
                    };
                    chrome.tabs.query({}, (allTabs) => {
                        const existingTabs = (allTabs || []).filter(t => t.url && t.url.startsWith(editorUrlPrefix));
                        // Only reuse an editor tab that is bound to the SAME org.
                        // With multiple orgs signed in, reusing the first editor tab
                        // leaks another org's session, files and errors into the
                        // wrong editor — a new tab (with its own host param) is
                        // created for every other org.
                        const sameOrgTabs = targetHost
                            ? existingTabs.filter(t => editorUrlHost(t.url) === targetHost)
                            : existingTabs;
                        const targetTab = sameOrgTabs[0] || null;
                        if (targetTab && targetTab.id) {
                            chrome.tabs.update(targetTab.id, { active: true });
                            if (targetTab.windowId) {
                                chrome.windows.update(targetTab.windowId, { focused: true });
                            }
                            chrome.tabs.sendMessage(targetTab.id, {
                                action: 'OPEN_ASSET',
                                params: { ...(request.params || {}), host: paramsObj.host || '' }
                            }, () => {
                                if (chrome.runtime.lastError) { /* suppress connection error */ }
                            });
                            return;
                        }

                        if (launchMode === 'window' || request.launchMode === 'window') {
                            chrome.windows.create({
                                url: url,
                                type: 'popup',
                                width: 1400,
                                height: 900,
                                focused: true
                            });
                        } else {
                            createTabNextToCurrent({
                                url: url,
                                active: true
                            }, sender);
                        }
                    });
                } else if (launchMode === 'window' || request.launchMode === 'window') {
                    chrome.windows.create({
                        url: url,
                        type: 'popup',
                        width: 1400,
                        height: 900,
                        focused: true
                    });
                } else {
                    reuseOrCreateExtensionTab(url, sender, request.page);
                }
            });
        }
        // Don't return true - we're not sending an async response
    }
});


// Set Onboarding flag & auto-inject main.js on active Salesforce tabs so welcome screen displays over org page
chrome.runtime.onInstalled.addListener((details) => {
    if (chrome.runtime.setUninstallURL) {
        chrome.runtime.setUninstallURL(UNINSTALL_SURVEY_URL);
    }
    chrome.storage.local.get(['sfarcHasSeenOnboarding'], (res) => {
        if (!res || !res.sfarcHasSeenOnboarding) {
            chrome.storage.local.set({ sfarc_needs_onboarding: true, sfarcHasSeenOnboarding: false });

            // Bootstrap existing org tabs so the welcome overlay is available
            // without requiring a refresh. Public Salesforce properties such
            // as Trailhead are intentionally excluded.
            chrome.tabs.query({ url: ['*://*.salesforce.com/*', '*://*.force.com/*', '*://*.salesforce-setup.com/*', '*://*.lightning.force.com/*', '*://*.my.salesforce.com/*'] }, (tabs) => {
                for (const tab of tabs) {
                    if (!tab.id) continue;
                    let host = '';
                    try { host = new URL(tab.url || '').hostname.toLowerCase(); } catch (e) { }
                    if (['trailhead.salesforce.com', 'help.salesforce.com', 'developer.salesforce.com', 'status.salesforce.com', 'trust.salesforce.com'].includes(host)) continue;

                    // Ask the existing manifest content script first. Only
                    // inject when there is no receiver (typical immediately
                    // after installing/upgrading the extension).
                    chrome.tabs.sendMessage(tab.id, { action: 'sfarc-bootstrap-status' }, () => {
                        if (!chrome.runtime.lastError) return;
                        chrome.scripting.insertCSS({
                            target: { tabId: tab.id, frameIds: [0] },
                            files: ['src/glass-toast.css', 'src/inspector.css', 'src/devtools-styles.css', 'src/bulk-field-builder.css', 'src/controls.css']
                        }).then(() => chrome.scripting.executeScript({
                            target: { tabId: tab.id, frameIds: [0] },
                            files: ['src/content.js']
                        })).catch(() => { });
                    });
                }
            });
        }
    });
});

// ====== Salesforce Flow Scanner API Integration ======
const FLOW_CACHE_TTL_MS = 5 * 60 * 1000;
const flowCache = new Map();
const flowInflight = new Map();

function flowCacheKey(request) {
    const { flowId, flowApiName, flowName } = request;
    return `${flowId || ''}|${flowApiName || flowName || ''}`;
}

function getCachedFlow(request) {
    const key = flowCacheKey(request);
    const entry = flowCache.get(key);
    if (entry && (Date.now() - entry.timestamp) < FLOW_CACHE_TTL_MS) {
        return entry.value;
    }
    flowCache.delete(key);
    return null;
}

function setCachedFlow(request, value) {
    const key = flowCacheKey(request);
    flowCache.set(key, { timestamp: Date.now(), value });
    if (flowCache.size > 50) {
        const oldestKey = flowCache.keys().next().value;
        flowCache.delete(oldestKey);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FETCH_FLOW') {
        const tabUrl = sender.tab?.url || request.tabUrl || '';

        const cached = getCachedFlow(request);
        if (cached) {
            sendResponse(cached);
            return false;
        }

        const dedupKey = flowCacheKey(request) + '|' + tabUrl;
        const inflight = flowInflight.get(dedupKey);
        if (inflight) {
            inflight.then(sendResponse).catch(err => {
                sendResponse({ ok: false, error: err.message || 'Error in background worker' });
            });
            return true;
        }

        const promise = handleFetchFlow(request, tabUrl, sender.tab?.cookieStoreId)
            .then(result => {
                if (result && result.ok) setCachedFlow(request, result);
                return result;
            })
            .finally(() => {
                flowInflight.delete(dedupKey);
            });

        flowInflight.set(dedupKey, promise);
        promise.then(sendResponse).catch(err => {
            sendResponse({ ok: false, error: err.message || 'Error in background worker' });
        });
        return true;
    }
    if (request.type === 'PING_FLOW_SCANNER') {
        sendResponse({ ok: true, version: '5.4.0' });
        return false;
    }
});

function flowScannerApiOrigins(tabUrl) {
    if (!tabUrl || tabUrl.includes("null") || tabUrl === "https://null/") return [];
    try {
        const url = new URL(tabUrl);
        if (!url.hostname || url.hostname === "null") return [];
        const origins = [];
        const addOrigin = (origin) => {
            if (origin && !origins.includes(origin)) origins.push(origin);
        };

        if (url.hostname.includes('.lightning.force.com')) {
            addOrigin(`https://${url.hostname.replace('.lightning.force.com', '.my.salesforce.com')}`);
        }
        if (url.hostname.includes('.salesforce-setup.com')) {
            // Trailblazer (dev org) setup hosts are xxx.trailblaze.my.salesforce-setup.com;
            // a naive replace would double .my. (xxx.trailblaze.my.my.salesforce.com), a
            // hostname that does not resolve. Handle the trailblaze form first, then
            // the generic form, and collapse any already-doubled .my.my.
            let setupHost = url.hostname;
            if (setupHost.includes('.trailblaze.my.salesforce-setup.com')) {
                setupHost = setupHost.replace('.trailblaze.my.salesforce-setup.com', '.trailblaze.my.salesforce.com');
            } else if (setupHost.includes('.my.salesforce-setup.com')) {
                setupHost = setupHost.replace('.my.salesforce-setup.com', '.my.salesforce.com');
            } else {
                setupHost = setupHost.replace('.salesforce-setup.com', '.my.salesforce.com');
            }
            setupHost = setupHost.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
            addOrigin(`https://${setupHost}`);
        }
        addOrigin(url.origin);
        return origins;
    } catch (e) {
        return [];
    }
}

async function gatherSessionCandidates(tabUrl, cookieStoreId) {
    const candidates = [];
    const seen = new Set();
    const cookieNames = ['sid', 'sid_Client', '__Host-sid'];
    const addCookie = (baseUrl, cookie) => {
        if (!cookie || !cookie.value) return;
        let token;
        try {
            token = decodeURIComponent(cookie.value);
        } catch (e) {
            return;
        }
        if (!/^00D[a-zA-Z0-9]{12,15}!/.test(token)) return;
        const key = `${baseUrl}|${token}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ baseUrl, token, cookieName: cookie.name });
    };

    for (const origin of flowScannerApiOrigins(tabUrl)) {
        for (const name of cookieNames) {
            try {
                const cookie = await chrome.cookies.get({
                    url: `${origin}/`,
                    name,
                    ...(cookieStoreId ? { storeId: cookieStoreId } : {})
                });
                addCookie(origin, cookie);
            } catch (e) {
            }
        }
    }
    return candidates;
}

function buildFlowQueries(flowId, flowApiName) {
    const queries = [];
    if (flowId) {
        queries.push({ priority: 0, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Id = '${flowId}' LIMIT 1` });
        queries.push({ priority: 1, text: `SELECT Id, FullName, Metadata FROM Flow WHERE DefinitionId = '${flowId}' ORDER BY VersionNumber DESC LIMIT 1` });
    }
    if (flowApiName) {
        const cleanName = flowApiName.replace(/-\d+$/, '');
        const escapedName = flowApiName.replace(/'/g, "\\'");
        const escapedClean = cleanName.replace(/'/g, "\\'");

        queries.push({ priority: 0, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Definition.DeveloperName = '${escapedClean}' ORDER BY VersionNumber DESC LIMIT 1` });
        queries.push({ priority: 1, text: `SELECT Id, FullName, Metadata FROM Flow WHERE FullName = '${escapedClean}' ORDER BY VersionNumber DESC LIMIT 1` });
        queries.push({ priority: 2, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Definition.DeveloperName = '${escapedName}' ORDER BY VersionNumber DESC LIMIT 1` });

        const namespaceParts = escapedClean.split('__');
        if (namespaceParts.length === 2) {
            queries.push({ priority: 3, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Definition.NamespacePrefix = '${namespaceParts[0]}' AND Definition.DeveloperName = '${namespaceParts[1]}' ORDER BY VersionNumber DESC LIMIT 1` });
        }

        queries.push({ priority: 4, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Definition.MasterLabel = '${escapedClean}' ORDER BY VersionNumber DESC LIMIT 1` });
        queries.push({ priority: 5, text: `SELECT Id, FullName, Metadata FROM Flow WHERE Definition.MasterLabel = '${escapedName}' ORDER BY VersionNumber DESC LIMIT 1` });
    }
    return queries.sort((a, b) => a.priority - b.priority).map(q => q.text);
}

async function tryFlowFetchOnce({ baseUrl, sidToken, authFormat, query, version }) {
    const toolingEndpoint = `${baseUrl}/services/data/${version}/tooling/query/?q=${encodeURIComponent(query)}`;
    const response = await fetch(toolingEndpoint, {
        method: 'GET',
        headers: {
            'Authorization': `${authFormat} ${sidToken}`,
            'Accept': 'application/json',
            'X-Chatter-Entity-Encoding': 'false'
        }
    });
    if (response.ok) {
        const data = await response.json();
        if (data.records && data.records.length > 0) {
            return { found: true, record: data.records[0] };
        }
        return { found: false, empty: true };
    }
    const isAuthError = response.status === 401 || response.status === 403;
    const errText = isAuthError ? '' : await response.text().catch(() => '');
    return {
        found: false,
        authFailed: isAuthError,
        status: response.status,
        statusText: response.statusText,
        errText
    };
}

async function handleFetchFlow(request, tabUrl, cookieStoreId) {
    const { flowId, flowApiName: requestedFlowApiName, flowName } = request;
    const flowApiName = requestedFlowApiName || flowName;
    const sessionCandidates = await gatherSessionCandidates(tabUrl, cookieStoreId);
    if (sessionCandidates.length === 0) {
        return { ok: false, error: 'No active Salesforce session cookie (sid) found.' };
    }
    try { new URL(tabUrl); } catch (e) { return { ok: false, error: 'Invalid Tab URL' }; }

    const queries = buildFlowQueries(flowId, flowApiName);
    if (queries.length === 0) {
        return { ok: false, error: 'Could not identify the flow from this Flow Builder URL. Open the flow directly and try again.' };
    }

    const apiVersions = ['v62.0', 'v60.0'];
    const authHeaderFormats = ['Bearer', 'OAuth'];
    let lastErrorDetails = null;
    let authFailedCombo = new Set();

    for (const session of sessionCandidates) {
        for (const authFormat of authHeaderFormats) {
            const authKey = `${session.baseUrl}|${session.token.slice(0, 10)}|${authFormat}`;
            if (authFailedCombo.has(authKey)) continue;

            for (const version of apiVersions) {
                for (const query of queries) {
                    try {
                        const result = await tryFlowFetchOnce({
                            baseUrl: session.baseUrl,
                            sidToken: session.token,
                            authFormat,
                            query,
                            version
                        });

                        if (result.found) {
                            return { ok: true, record: result.record, source: 'tooling-api' };
                        }
                        if (result.authFailed) {
                            authFailedCombo.add(authKey);
                            break;
                        }
                        if (!result.empty && result.status) {
                            lastErrorDetails = `Status: ${result.status} ${result.statusText || ''}` + (result.errText ? `, Body: ${result.errText.substring(0, 200)}` : '');
                        }
                    } catch (fetchErr) {
                        lastErrorDetails = `Network/CORS error: ${fetchErr.message}`;
                    }
                }
                if (authFailedCombo.has(authKey)) break;
            }
        }
    }

    let errorMsg = 'Could not fetch Flow metadata via Tooling API.';
    if (lastErrorDetails) {
        errorMsg += ` Last API Error: ${lastErrorDetails}`;
    }
    return { ok: false, error: errorMsg };
}

// ════════════════════════════════════════════════════════════════════════════
//  Native right-click context menu (Chrome-style, like the reference)
//  Shows on any Salesforce page: Salesforce Comet ▸ Data Export / Comet
//  Launcher / Code Editor. Created once on install/startup.
// ════════════════════════════════════════════════════════════════════════════
function sfarcOpenPageFromContextMenu(page, tab) {
    let host = '';
    if (tab && tab.url) {
        try {
            const u = new URL(tab.url);
            if (u.hostname.includes('salesforce') || u.hostname.includes('force.com')) {
                host = u.hostname;
            }
        } catch (e) { }
    }
    const params = '?' + new URLSearchParams(host ? { host } : {}).toString();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/' + page + '.html' + params) });
}

function sfarcLaunchCometFromContextMenu(tab) {
    if (!tab || !tab.id) return;
    const isSf = tab.url && (tab.url.includes('salesforce.com') || tab.url.includes('force.com'));
    if (!isSf) {
        sfarcOpenPageFromContextMenu('code-editor', tab);
        return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'sfarc-launch-comet' }, () => {
        if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/content.js']
            }).then(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'sfarc-launch-comet' });
            }).catch(() => { });
        }
    });
}

if (typeof chrome !== 'undefined' && chrome.contextMenus) {
    const SF_SALESFORCE_URLS = [
        'https://*.salesforce.com/*',
        'https://*.force.com/*',
        'https://*.salesforce-setup.com/*',
        'https://*.visualforce.com/*'
    ];

    // All tools that can appear in the right-click menu. The `id` doubles as
    // the extension page file name (src/<id>.html). 'comet-launcher' injects
    // the Comet panel into the current tab instead of opening a page.
    // `icon` is a leading emoji glyph — Chrome's contextMenus API has no icon
    // support on items, so a monochrome-friendly glyph is the standard way to
    // give each entry a visual marker.
    const SFARC_MENU_TOOLS = {
        'data-export':       { title: 'Data Export', icon: '\u2B07\uFE0F' },
        'comet-launcher':    { title: 'Comet Launcher', icon: '\u2728' },
        'code-editor':       { title: 'Code Editor', icon: '</>' },
        'org-limits':        { title: 'Org Limits', icon: '\u23F1\uFE0F' },
        'metadata-exporter': { title: 'Metadata Exporter', icon: '\u2630\uFE0F' },
        'anonymous-apex':    { title: 'Execute Anonymous Apex', icon: '\u26A1\uFE0E' },
        'debug-logs-tab':   { title: 'Debug Logs', icon: '\u263B\uFE0E' },
        'log-viewer':        { title: 'Debug Logs', icon: '\u263B\uFE0E', redirect: 'debug-logs-tab' },
        'event-monitor':     { title: 'Event Monitor', icon: '\u26A1' },
        'code-coverage':     { title: 'Code Coverage', icon: '\u2697\uFE0F' },
        'rest-explorer':     { title: 'REST Explorer', icon: '\u2708\uFE0F' },
        'graphql-explorer':  { title: 'GraphQL Explorer', icon: '\u2B22' },
        'record-clone':      { title: 'Record Clone', icon: '\u2398\uFE0F' },
        'bulk-permission-wizard': { title: 'Bulk Permission Wizard', icon: '\u2696\uFE0F' },
        'bulk-field-builder': { title: 'Bulk Field Builder', icon: '\u25A4' },
        'data-builder':      { title: 'Data Builder', icon: '\u25A3' },
        'data-import':       { title: 'Data Import', icon: '\u2B06\uFE0F' },
        'diff-checker':      { title: 'Diff Checker', icon: '\u21C6' },
        'api-statistics':    { title: 'API Statistics', icon: '\u2197' },
        'automation-cascade': { title: 'Automation Cascade', icon: '\u27F3' }
    };

    const DEFAULT_MENU_TOOLS = ['data-export', 'comet-launcher', 'code-editor'];

    // Serialize menu rebuilds. sfarcMenuCreate fires from several triggers
    // (startup, install, storage change, top-level) and removeAll + the storage
    // read are async — overlapping builds raced and created duplicate ids
    // ("Cannot create item with duplicate id sfarc-comet-root"). Queueing the
    // builds so only one runs at a time, and removing each id before creating
    // it, makes the menu idempotent.
    let sfarcMenuBuildChain = Promise.resolve();
    const sfarcMenuCreate = () => {
        sfarcMenuBuildChain = sfarcMenuBuildChain
            .then(() => new Promise((resolve) => {
                try { chrome.contextMenus.removeAll(); } catch (e) { }
                chrome.storage.sync.get(['sfiSettings'], (result) => {
                    try {
                        const settings = (result && result.sfiSettings) || {};
                        const cfg = settings.contextMenu || {};
                        if (cfg.enabled === false) return;
                        const tools = Array.isArray(cfg.tools) && cfg.tools.length ? cfg.tools : DEFAULT_MENU_TOOLS;
                        const custom = Array.isArray(cfg.custom) ? cfg.custom : [];

                        const createSafe = (props) => {
                            // Idempotency: remove the id first (no-op when it
                            // doesn't exist), so a stale in-flight build can
                            // never trip the duplicate-id error.
                            try {
                                chrome.contextMenus.remove(props.id, () => {
                                    void chrome.runtime.lastError; // expected when absent
                                    chrome.contextMenus.create(props);
                                });
                            } catch (e) { }
                        };

                        createSafe({
                            id: 'sfarc-comet-root',
                            title: 'Salesforce Comet',
                            contexts: ['page', 'selection', 'link', 'editable', 'frame'],
                            documentUrlPatterns: SF_SALESFORCE_URLS
                        });

                        tools.forEach((toolId) => {
                            const tool = SFARC_MENU_TOOLS[toolId];
                            if (!tool) return;
                            createSafe({
                                id: 'sfarc-menu-' + toolId,
                                parentId: 'sfarc-comet-root',
                                title: (tool.icon ? tool.icon + ' ' : '') + tool.title,
                                contexts: ['page', 'selection', 'link', 'editable', 'frame'],
                                documentUrlPatterns: SF_SALESFORCE_URLS
                            });
                        });

                        custom.forEach((entry, i) => {
                            const name = (entry && entry.name) ? String(entry.name).trim() : '';
                            if (!name) return;
                            createSafe({
                                id: 'sfarc-menu-custom-' + i,
                                parentId: 'sfarc-comet-root',
                                title: '\u2192 ' + name,
                                contexts: ['page', 'selection', 'link', 'editable', 'frame'],
                                documentUrlPatterns: SF_SALESFORCE_URLS
                            });
                        });
                    } finally {
                        resolve();
                    }
                });
            }))
            .catch(() => { });
    };

    const sfarcCustomEntryTarget = (i) => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['sfiSettings'], (result) => {
                const settings = (result && result.sfiSettings) || {};
                const cfg = settings.contextMenu || {};
                const custom = Array.isArray(cfg.custom) ? cfg.custom : [];
                const entry = custom[i];
                resolve(entry ? entry.url : '');
            });
        });
    };

    try { sfarcMenuCreate(); } catch (e) { }
    chrome.runtime.onInstalled.addListener(() => { try { sfarcMenuCreate(); } catch (e) { } });
    chrome.runtime.onStartup.addListener(() => { try { sfarcMenuCreate(); } catch (e) { } });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sfiSettings) {
            try { sfarcMenuCreate(); } catch (e) { }
        }
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        const id = info.menuItemId;
        if (id === 'sfarc-comet-root') return;

        if (typeof id === 'string' && id.startsWith('sfarc-menu-custom-')) {
            const idx = parseInt(id.replace('sfarc-menu-custom-', ''), 10);
            sfarcCustomEntryTarget(idx).then((target) => {
                if (!target) return;
                // Extension tool page (bare id, e.g. "org-limits") vs external URL
                if (!/^https?:\/\//i.test(target)) {
                    sfarcOpenPageFromContextMenu(target.replace(/\.html$/, ''), tab);
                } else {
                    chrome.tabs.create({ url: target });
                }
            });
            return;
        }

        const page = typeof id === 'string' && id.startsWith('sfarc-menu-') ? id.replace('sfarc-menu-', '') : '';
        if (page === 'comet-launcher') {
            sfarcLaunchCometFromContextMenu(tab);
        } else if (page && SFARC_MENU_TOOLS[page]) {
            const tool = SFARC_MENU_TOOLS[page];
            const targetPage = tool.redirect || page;
            sfarcOpenPageFromContextMenu(targetPage, tab);
        }
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  Org Subdomain Registry (background keeper)
//  content.js records each org page into chrome.storage.local.sfarcOrgSubdomains
//  (hostname -> { subdomain, lastSeen }) so tool pages can color their favicon
//  like the org the user was last working in. The content script can lag behind
//  (slow injection, page not yet ready) or never run, so the service worker
//  keeps the registry fresh directly from tab URLs with the same key/shape.
//  Writes are throttled per host — the URL is the same on every status flip.
// ════════════════════════════════════════════════════════════════════════════
const SFARC_BG_GENERIC_HOSTS = ['www', 'login', 'test', 'help', 'trailhead', 'status', 'trust', 'developer', 'force', 'salesforce'];
const sfarcRegistryWriteTimes = {}; // host -> last write timestamp (throttle)

function sfarcOrgSubdomainFromUrl(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (!host || (!host.includes('salesforce') && !host.includes('force.com'))) return null;
        const parts = host.split('.');
        const first = parts[0];
        if (parts.length < 2 || !first || SFARC_BG_GENERIC_HOSTS.includes(first)) return null;
        return { host, subdomain: first.replace(/--c$/, '') };
    } catch (e) {
        return null;
    }
}

function sfarcRecordOrgSubdomainFromUrl(url) {
    const info = sfarcOrgSubdomainFromUrl(url);
    if (!info) return;
    const now = Date.now();
    if (sfarcRegistryWriteTimes[info.host] && now - sfarcRegistryWriteTimes[info.host] < 60000) return;
    sfarcRegistryWriteTimes[info.host] = now;
    const entry = { subdomain: info.subdomain, lastSeen: now };
    chrome.storage.local.get(['sfarcOrgSubdomains'], (res) => {
        if (chrome.runtime && chrome.runtime.lastError) return;
        const map = (res && res.sfarcOrgSubdomains) || {};
        map[info.host] = entry;
        chrome.storage.local.set({ sfarcOrgSubdomains: map });
    });
}

if (typeof chrome !== 'undefined' && chrome.tabs) {
    // Record the new URL as soon as a tab navigates, and again on completion
    // (tab.url is then authoritative) — covers pages where the content script
    // hasn't run yet. Idempotent: same host, same entry, newer lastSeen.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            sfarcRecordOrgSubdomainFromUrl(changeInfo.url);
        } else if (changeInfo.status === 'complete') {
            sfarcRecordOrgSubdomainFromUrl(tab.url);
        }
    });

    // Track the active tab too: switching orgs without a reload should still
    // move the "last active" marker so tool-page favicons follow immediately.
    chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (chrome.runtime && chrome.runtime.lastError) return;
            sfarcRecordOrgSubdomainFromUrl(tab && tab.url);
        });
    });
}
