/**
 * Flow Scanner Network Interceptor
 * Runs at document_start in MAIN world (world: "MAIN" in manifest).
 *
 * Intercepts ALL fetch() and XHR calls made by the Salesforce page.
 * When the Flow Builder loads a flow, it makes authenticated API calls
 * that carry the session automatically. We capture those responses.
 *
 * Captured data is stored in window.__flowScannerCapture for later use.
 * Also captures instance URL and session from Salesforce page globals.
 */
(function () {
  'use strict';

  const CAPTURE_KEY = '__flowScannerCapture';
  const SESSION_KEY = '__flowScannerSession';

  // ─── Helper: Is this response likely flow metadata? ─────────────────────
  function looksLikeFlowMetadata(data) {
    if (!data || typeof data !== 'object') return false;
    // Single flow record from Tooling API
    if (data.Metadata && (data.FullName || data.Id)) return true;
    // Array result from SOQL query
    if (data.records && Array.isArray(data.records) && data.records.length > 0) {
      const r = data.records[0];
      if (r.Metadata || r.FullName) return true;
    }
    // Raw flow metadata object (has typical flow fields)
    const flowFields = ['processType', 'recordLookups', 'decisions', 'actionCalls', 'loops', 'label'];
    const matches = flowFields.filter(f => f in data).length;
    return matches >= 2;
  }

  // ─── Capture helper ──────────────────────────────────────────────────────
  function captureIfFlow(url, data) {
    if (!looksLikeFlowMetadata(data)) return;

    let record = data;
    // Unwrap SOQL query results
    if (data.records && data.records.length > 0) {
      record = data.records[0];
    }

    // First capture wins: Flow Builder loads one flow per page, and later
    // responses (e.g. subflow lookups) must not overwrite the real flow.
    const existing = window[CAPTURE_KEY] || null;
    if (existing) {
      if (existing.Id && record.Id && existing.Id !== record.Id) return;
      if (existing.FullName && record.FullName && existing.FullName !== record.FullName) return;
    }

    window[CAPTURE_KEY] = record;
    console.debug('[FlowScanner Interceptor] ✓ Captured flow data from:', url.substring(0, 80));
    // Dispatch an event so content script knows data is ready
    window.dispatchEvent(new CustomEvent('__flowScannerDataReady', { detail: { url, record } }));
  }

  // ─── Cheap pre-filter: only inspect flow-relevant responses ──────────────
  // The page makes a constant stream of /services/data REST calls; cloning and
  // JSON-parsing every one of them is wasteful. Flow metadata only ever comes
  // back from Tooling API calls or Flow Builder endpoints.
  function isFlowRelevantUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('/tooling/')) return true; // Tooling API (rare, metadata-only)
    if (lower.includes('flowbuilder') || lower.includes('/flow/')) return true;
    return false;
  }

  // ─── Capture session / instance URL from Salesforce page globals ─────────
  function extractSalesforceSession() {
    const session = {
      sessionId: null,
      instanceUrl: null,
    };

    // Try various Salesforce global objects
    try { session.sessionId = session.sessionId || window?.sforce?.connection?.sessionId; } catch (e) {}
    try { session.sessionId = session.sessionId || window?.UserContext?.sessionId; } catch (e) {}
    try { session.sessionId = session.sessionId || window?.sfdcSessionId; } catch (e) {}
    try { session.sessionId = session.sessionId || window?.Sfdc?.canvas?.oauth?.token; } catch (e) {}

    try { session.instanceUrl = window?.sforce?.connection?.instanceUrl; } catch (e) {}
    try { session.instanceUrl = session.instanceUrl || window?.UserContext?.instanceUrl; } catch (e) {}

    // Try to get instance URL from the page's known redirects / config
    if (!session.instanceUrl) {
      // For MyDomain orgs: convert lightning URL to my.salesforce.com
      const host = window.location.hostname; // e.g. myorg.lightning.force.com
      if (host.includes('.lightning.force.com')) {
        session.instanceUrl = 'https://' + host.replace('.lightning.force.com', '.my.salesforce.com');
      } else {
        session.instanceUrl = window.location.origin;
      }
    }

    if (session.sessionId || session.instanceUrl) {
      window[SESSION_KEY] = session;
    }
    return session;
  }

  // ─── Intercept fetch() ───────────────────────────────────────────────────
  const _originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const response = await _originalFetch.apply(this, arguments);

    try {
      const url = (typeof input === 'string' ? input : input?.url) || '';
      if (isFlowRelevantUrl(url)) {
        const clone = response.clone();
        clone.json().then(data => captureIfFlow(url, data)).catch(() => {});
      }
    } catch (e) {
      // Never let our interceptor break the page
    }

    return response;
  };

  // ─── Intercept XMLHttpRequest ────────────────────────────────────────────
  const _origOpen = XMLHttpRequest.prototype.open;
  const _origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._flowScannerUrl = url ? url.toString() : '';
    return _origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const url = this._flowScannerUrl || '';
        if (isFlowRelevantUrl(url)) {
          const data = JSON.parse(this.responseText);
          captureIfFlow(url, data);
        }
      } catch (e) {}
    });
    return _origSend.apply(this, arguments);
  };

  // ─── Expose a function for the background to call ───────────────────────
  // Background uses executeScript to call this and get captured data
  window.__flowScannerGetCapture = function () {
    // Also try to extract session now (page might have loaded globals by now)
    extractSalesforceSession();
    return {
      capture: window[CAPTURE_KEY] || null,
      session: window[SESSION_KEY] || null,
      currentUrl: window.location.href,
    };
  };

  // Extract session at startup (some globals may be available immediately)
  setTimeout(extractSalesforceSession, 1000);
  setTimeout(extractSalesforceSession, 3000); // Try again after page settles
})();
