/**
 * Salesforce Flow Scanner - Content Script v2.0
 * 
 * Uses the official @flow-scanner/lightning-flow-scanner-core bundled engine.
 * Fetches raw Flow XML via Salesforce Tooling API and runs all 20+ official rules.
 */

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let currentFlowId = null;
  let currentFlowName = 'Salesforce_Flow';
  let currentFlowVersion = 'v1';
  let isDarkMode = false;
  let userHideFloatingBtn = false;
  let uiInjected = false;
  let lastScanResults = [];
  let scanInProgress = false;
  let panelVisible = false;
  let interceptedFlowData = null;
  let userFlowRuleSettings = {}; // { settingsRuleId: { enabled, severity, threshold } } from sfiSettings

  // ─── Listen for Interceptor Data (MAIN World -> ISOLATED World) ───────────
  window.addEventListener('__flowScannerDataReady', (e) => {
    if (e.detail && e.detail.record) {
      interceptedFlowData = e.detail.record;
      console.debug('[FlowScanner] ✅ Received intercepted flow metadata directly from Salesforce UI framework.');
    }
  });

  // ─── Utility: Extract Flow ID from URL ────────────────────────────────────
  function extractFlowIdFromUrl(url) {
    // Salesforce Flow Builder URL patterns:
    // .../flowBuilder.app?flowId=301NS0000312UsqYAE
    // .../flowBuilder.app?flowId=runtime_payments__GeneratePaymentLink-1
    // .../flow/301NS0000312UsqYAE
    const patterns = [
      /[?&#]flowId=([a-zA-Z0-9_]{3,100}(?:-\d+)?)/i,   // ?flowId=301... or ?flowId=developerName-1
      /\/flow\/([0-9a-zA-Z]{15,18})/i,                  // /flow/<id>
      /\b(301[a-zA-Z0-9]{12,15})\b/,                    // bare 301... ID
    ];
    for (const pattern of patterns) {
      const m = url.match(pattern);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  // ─── Fetch flow via Background Worker (Multi-Matrix background engine) ─────
  function extensionContextIsAvailable() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch (e) {
      return false;
    }
  }

  function getRuntimeLastError() {
    try {
      return chrome.runtime?.lastError || null;
    } catch (e) {
      return { message: 'Extension context invalidated' };
    }
  }

  function fetchFlowViaBackground(params) {
    return new Promise((resolve, reject) => {
      // Chrome invalidates every previously injected content script when an
      // unpacked extension is reloaded. Do not surface its internal exception
      // as an authentication failure, and never force-refresh a Flow Builder
      // page because the user may have unsaved edits.
      if (!extensionContextIsAvailable()) {
        reject(new Error('Flow Scanner was updated. Refresh this Flow Builder page, then scan again.'));
        return;
      }

      const message = {
        type: 'FETCH_FLOW',
        tabUrl: window.location.href,
        ...params
      };

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = getRuntimeLastError();
          if (runtimeError) {
            const message = runtimeError.message || '';
            if (message.includes('Extension context invalidated')) {
              reject(new Error('Flow Scanner was updated. Refresh this Flow Builder page, then scan again.'));
            } else {
              reject(new Error(`Extension error: ${message}`));
            }
            return;
          }
          if (!response || !response.ok) {
            reject(new Error(response?.error || 'Unknown error fetching flow'));
            return;
          }
          resolve(response.record);
        });
      } catch (e) {
        if (String(e?.message || e).includes('Extension context invalidated')) {
          reject(new Error('Flow Scanner was updated. Refresh this Flow Builder page, then scan again.'));
        } else {
          reject(e);
        }
      }
    });
  }

  async function fetchFlowById(flowId) {
    return fetchFlowViaBackground({ flowId });
  }

  async function fetchFlowByName(flowName) {
    // Keep the message contract aligned with the background worker. This used
    // to send `flowName`, which meant name-based Flow Builder URLs produced no
    // Tooling query at all.
    return fetchFlowViaBackground({ flowApiName: flowName });
  }

  function isLoginPage() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();
    if (host === 'login.salesforce.com' || host === 'test.salesforce.com') return true;
    if (path.includes('/login.jsp') || path.endsWith('/login') || href.includes('unauthenticated')) return true;
    if (document.querySelector('#login_form, #Login, form[name="login"], input[name="username"][name="pw"]')) return true;
    return false;
  }

  // Helper: check if current screen is a Flow Builder screen
  function isFlowBuilderScreen() {
    if (isLoginPage()) return false;

    const url = window.location.href.toLowerCase();
    // Must be actual Flow Builder app canvas, NOT setup list (/setup/Flows) or detail page (/lightning/r/Flow/)
    if (url.includes('flowbuilder.app') || url.includes('flowid=')) {
      return true;
    }
    const pageTitle = (document.title || '').toLowerCase();
    if (pageTitle.includes('flow builder')) {
      return true;
    }
    if (document.querySelector('[data-aura-class="builderHeader"], [data-aura-class="flowBuilderAppHeader"], .flow-builder-header')) {
      return true;
    }
    return false;
  }

  function detectCurrentFlow() {
    if (!isFlowBuilderScreen()) return null;
    const url = window.location.href;

    // 1. Try flowId from URL query params or hash
    const rawVal = extractFlowIdFromUrl(url);
    if (rawVal) {
      // If 15-18 char alphanumeric Salesforce ID starting with 301 or 00D/01M/etc.
      if (/^[a-zA-Z0-9]{15,18}$/.test(rawVal) && (rawVal.startsWith('301') || rawVal.startsWith('00D'))) {
        return { type: 'id', value: rawVal };
      } else {
        return { type: 'name', value: rawVal };
      }
    }

    // 2. Check URL search params for flowApiName or DeveloperName
    try {
      const u = new URL(url);
      const nameParam = u.searchParams.get('developerName') || u.searchParams.get('flowApiName') || u.searchParams.get('name');
      if (nameParam) return { type: 'name', value: nameParam };
    } catch (e) {}

    // 3. Try reading the flow's DeveloperName from the Flow Builder DOM
    const nameSelectors = [
      '[data-aura-class="builderHeader"] .slds-truncate',
      '[data-aura-class="flowBuilderAppHeader"] .slds-truncate',
      '[data-aura-class="flowBuilderAppHeader"] .title',
      '.builderHeader .title',
      '.slds-page-header__title .slds-truncate',
      'h1.slds-page-header__title',
      '.slds-page-header__title',
    ];

    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text && text.length > 2 && !text.toLowerCase().includes('flow builder') && !text.toLowerCase().includes('salesforce')) {
        return { type: 'name', value: text };
      }
    }

    // 4. Fall back to page title: often "My Flow Name | Flow Builder | Salesforce"
    const pageTitle = document.title;
    if (pageTitle) {
      const part = pageTitle.split(/[|\-]/)[0].trim();
      if (part && part.length > 2 && !part.toLowerCase().includes('salesforce')) {
        return { type: 'name', value: part };
      }
    }

    return null;
  }


  // ─── Strip nulls recursively (Tooling API may return null for unset fields) ──
  function stripNulls(obj) {
    if (Array.isArray(obj)) return obj.map(stripNulls).filter(x => x !== null && x !== undefined);
    if (typeof obj === 'object' && obj !== null) {
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined) {
          const cleaned = stripNulls(v);
          if (cleaned !== null && cleaned !== undefined) clean[k] = cleaned;
        }
      }
      return clean;
    }
    return obj;
  }

  // ─── Run official lightning-flow-scanner-core scan ───────────────────────
  async function runOfficialScan(flowRecord) {
    if (!window.lightningFlowScanner) {
      throw new Error('Flow Scanner engine not loaded. Please reload the page.');
    }

    const { Flow, ScanFlows } = window.lightningFlowScanner;

    // The Tooling API returns metadata as a JSON object
    // Strip all null/undefined values before passing to Flow constructor
    const rawMetadata = flowRecord.Metadata || flowRecord;
    const metadata = stripNulls(rawMetadata);
    const flowName = flowRecord.FullName || flowRecord.DeveloperName || 'UnknownFlow';

    console.debug('[FlowScanner] Metadata keys:', Object.keys(metadata));

    // Build Flow object from metadata JSON directly
    // The Flow constructor accepts (path, data) where data is the parsed XML object
    const flowObj = new Flow(flowName, metadata);
    console.debug('[FlowScanner] Flow created:', flowObj.name, 'type:', flowObj.type, 'elements:', flowObj.elements.length);

    // Run the official scan
    const scanResults = ScanFlows([flowObj]);
    console.debug('[FlowScanner] Scan completed, results:', scanResults.length);

    return { scanResults, flowObj };
  }

  function findReferencedFieldsForNode(rawFlow, elementName) {
    if (!rawFlow || !elementName) return [];
    try {
      const flowStr = JSON.stringify(rawFlow);
      const escapedName = elementName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('(?:\\{|\\b)' + escapedName + '\\.([a-zA-Z0-9_]+)\\b', 'g');
      
      const fields = new Set();
      let match;
      while ((match = regex.exec(flowStr)) !== null) {
        const field = match[1];
        if (field && !['storeOutputAutomatically', 'queriedFields', 'assignNullValuesIfNoRecordsFound', 'connector', 'faultConnector', 'element', 'name', 'apiName', 'object', 'recordLookups'].includes(field)) {
          fields.add(field);
        }
      }
      return Array.from(fields).sort();
    } catch (e) {
      return [];
    }
  }

  // ─── Map simplified Settings rule ids to the official scanner rule ids ──
  // The Settings catalog uses short ids ("action-in-loop"), while the official
  // engine uses its own ids/class names ("action-call-in-loop"/"ActionCallsInLoop").
  const SETTINGS_RULE_ALIASES = {
    'action-in-loop': ['action-call-in-loop', 'ActionCallsInLoop'],
    'dml-in-loop': ['dml-in-loop', 'DMLStatementInLoop'],
    'duplicate-dml': ['duplicate-dml', 'DuplicateDMLOperation'],
    'cyclomatic-complexity': ['excessive-cyclomatic-complexity', 'CyclomaticComplexity'],
    'flow-naming': ['invalid-naming-convention', 'FlowName'],
    'get-record-all-fields': ['get-record-all-fields', 'GetRecordAllFields'],
    'hardcoded-id': ['hardcoded-id', 'HardcodedId'],
    'hardcoded-url': ['hardcoded-url', 'HardcodedUrl'],
    'inactive-flow': ['inactive-flow', 'InactiveFlow'],
    'hardcoded-secret': ['hardcoded-secret', 'HardcodedSecret'],
    'soql-in-loop': ['soql-in-loop', 'SOQLQueryInLoop'],
    'unsafe-context': ['unsafe-running-context', 'UnsafeRunningContext'],
    'missing-fault-path': ['missing-fault-path', 'MissingFaultPath'],
    'missing-null-handler': ['missing-null-handler', 'MissingNullHandler'],
    'api-version': ['invalid-api-version', 'APIVersion'],
    'missing-filter-trigger': ['missing-record-trigger-filter', 'MissingFilterRecordTrigger'],
    'same-record-updates': ['same-record-field-updates', 'SameRecordFieldUpdates'],
    'cognitive-complexity': ['cognitive-complexity', 'CognitiveComplexity'],
    'unused-variable': ['unused-variable', 'UnusedVariable'],
    'flow-description': ['missing-flow-description', 'FlowDescription']
  };

  // Find the saved settings entry for a rule, matching by official rule id or
  // class name (direct key match first, then via the alias map).
  function findSavedRuleConfig(ruleDef) {
    const ruleIdRaw = (ruleDef && (ruleDef.ruleId || ruleDef.name)) || '';
    const ruleNameRaw = (ruleDef && ruleDef.name) || '';
    if (userFlowRuleSettings[ruleIdRaw]) return userFlowRuleSettings[ruleIdRaw];
    if (ruleNameRaw && userFlowRuleSettings[ruleNameRaw]) return userFlowRuleSettings[ruleNameRaw];
    for (const key of Object.keys(userFlowRuleSettings)) {
      const aliases = SETTINGS_RULE_ALIASES[key];
      if (aliases && (aliases.includes(ruleIdRaw) || aliases.includes(ruleNameRaw))) {
        return userFlowRuleSettings[key];
      }
    }
    return null;
  }

  function loadUserRuleSettings() {
    try {
      if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
      chrome.storage.sync.get(['sfiSettings'], (result) => {
        userFlowRuleSettings = (result && result.sfiSettings && result.sfiSettings.flowScannerRules) || {};
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sfiSettings) {
          userFlowRuleSettings = (changes.sfiSettings.newValue && changes.sfiSettings.newValue.flowScannerRules) || {};
        }
      });
    } catch (e) { }
  }

  // ─── Format scan results for display ────────────────────────────────────
  function formatResults(scanResults, flowName, rawFlow) {
    const issues = [];

    for (const scanResult of scanResults) {
      for (const ruleResult of scanResult.ruleResults) {
        if (!ruleResult.details || ruleResult.details.length === 0) continue;

        const ruleDef = ruleResult.ruleDefinition;
        // Apply the user's Flow Scanner Rules settings (disable / severity override)
        const savedConfig = findSavedRuleConfig(ruleDef);
        if (savedConfig && savedConfig.enabled === false) continue;
        const severity = (savedConfig && savedConfig.severity) || ruleDef.severity || ruleResult.severity || 'warning';

        for (const violation of ruleResult.details) {
          const ruleId = ruleDef.ruleId || ruleDef.name;
          const elementName = violation.name || violation.element?.name || 'N/A';
          let detectedFields = [];

          if (ruleId === 'get-record-all-fields' && rawFlow && elementName !== 'N/A') {
            detectedFields = findReferencedFieldsForNode(rawFlow, elementName);
          }

          issues.push({
            ruleId: ruleId,
            ruleName: ruleDef.label || ruleDef.name,
            elementName: elementName,
            elementType: violation.subtype || violation.element?.subtype || '',
            severity: severity,
            description: ruleDef.summary || ruleDef.description || '',
            category: ruleDef.category || 'problem',
            docUrl: ruleResult.messageUrl || '',
            detectedFields: detectedFields
          });
        }
      }
    }

    return issues;
  }

  // ─── Inject UI ───────────────────────────────────────────────────────────
  function injectUI() {
    if (uiInjected) return;

    // Remove any old UI
    const old = document.getElementById('fs-panel');
    if (old) old.remove();

    uiInjected = true;

    // Create backdrop overlay
    const backdrop = document.createElement('div');
    backdrop.id = 'fs-backdrop';
    backdrop.onclick = () => togglePanel(false);
    document.body.appendChild(backdrop);

    const logoUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/icon-48.png') : '';

    // Create floating trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'fs-trigger-btn';
    triggerBtn.innerHTML = `
      <img src="${logoUrl}" width="16" height="16" class="fs-trigger-logo" />
      <span class="fs-btn-label">Flow Scanner</span>
      <span class="fs-badge" id="fs-badge" style="display:none">0</span>
    `;
    triggerBtn.onclick = () => {
      togglePanel(true);
      triggerScan();
    };
    document.body.appendChild(triggerBtn);

    // Create results panel
    const panel = document.createElement('div');
    panel.id = 'fs-panel';
    panel.innerHTML = `
      <div class="fs-panel-header" title="Drag to reposition">
        <div class="fs-panel-title">
          <svg class="fs-drag-grip" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>
          <img src="${logoUrl}" width="18" height="18" class="fs-header-logo" />
          <span>Flow Scanner</span>
        </div>
        <div class="fs-panel-actions">
          <button class="fs-icon-btn" id="fs-scan-btn" title="Scan Current Flow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Scan Flow
          </button>
          <div class="fs-dropdown-wrapper" id="fs-export-dropdown-wrapper" style="display:none">
            <button class="fs-icon-btn fs-dropdown-toggle" id="fs-export-dropdown-btn" title="Export Options">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
              <span class="fs-dropdown-caret">▾</span>
            </button>
            <div class="fs-dropdown-menu" id="fs-export-dropdown-menu">
              <button class="fs-dropdown-item" id="fs-export-txt-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sfarc-accent, #2196f3)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Export Text Report (.md)</span>
              </button>
              <button class="fs-dropdown-item" id="fs-export-img-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sfarc-accent, #2196f3)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Export Image Report (.png)</span>
              </button>
            </div>
          </div>
          <button class="fs-icon-btn fs-theme-btn" id="fs-theme-btn" title="Switch to Dark Theme">
            <svg class="fs-theme-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="fs-theme-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </button>
          <button class="fs-icon-btn fs-close-btn" id="fs-close-btn" title="Close">✕</button>
        </div>
      </div>
      <div class="fs-panel-meta" id="fs-panel-meta">
        <div class="fs-meta-left">
          <span class="fs-meta-item" id="fs-flow-name">No flow detected</span>
        </div>
        <div class="fs-meta-right">
          <span class="fs-meta-badge" id="fs-status-badge">Ready</span>
        </div>
      </div>
      <div class="fs-tabs">
        <button class="fs-tab active" data-tab="all">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          All Issues
        </button>
        <button class="fs-tab" data-tab="error">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e5484d" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Errors
        </button>
        <button class="fs-tab" data-tab="warning">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Warnings
        </button>
        <button class="fs-tab" data-tab="info">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Info
        </button>
        <div class="fs-search-wrapper" id="fs-search-wrapper" title="Search elements & rules">
          <svg class="fs-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="fs-search-input" placeholder="Search elements & rules…" spellcheck="false" autocomplete="off" />
          <button type="button" class="fs-search-clear" id="fs-search-clear" title="Clear search (Esc)" tabindex="-1" style="display:none">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="fs-panel-body" id="fs-panel-body">
        <div class="fs-empty-state" id="fs-empty-state">
          <div class="fs-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--sfarc-accent, #2196f3)" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div class="fs-empty-text">Click "Scan Flow" to analyze the current flow</div>
          <div class="fs-empty-sub">Opens any flow in Salesforce Flow Builder to begin</div>
        </div>
        <div class="fs-results-list" id="fs-results-list" style="display:none"></div>
      </div>
      <div class="fs-panel-footer" id="fs-panel-footer" style="display:none">
        <span id="fs-result-summary"></span>
        <span class="fs-version">Flow Scanner v5.4.0</span>
      </div>
    `;
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector('.fs-panel-header'));

    // Event listeners
    document.getElementById('fs-scan-btn').onclick = () => triggerScan();
    document.getElementById('fs-close-btn').onclick = () => togglePanel(false);
    document.getElementById('fs-theme-btn').onclick = () => toggleTheme();

    // Export Dropdown handlers
    const dropdownWrapper = document.getElementById('fs-export-dropdown-wrapper');
    const dropdownBtn = document.getElementById('fs-export-dropdown-btn');
    const dropdownMenu = document.getElementById('fs-export-dropdown-menu');

    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.onclick = (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      };
      document.addEventListener('click', (e) => {
        if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
          dropdownMenu.classList.remove('show');
        }
      });
    }

    document.getElementById('fs-export-txt-btn').onclick = () => {
      if (dropdownMenu) dropdownMenu.classList.remove('show');
      exportTextReport();
    };
    document.getElementById('fs-export-img-btn').onclick = () => {
      if (dropdownMenu) dropdownMenu.classList.remove('show');
      exportImageReport();
    };

    // Search control — always-visible field with icon + clear button
    const searchWrapper = document.getElementById('fs-search-wrapper');
    const searchInput = document.getElementById('fs-search-input');
    const searchClear = document.getElementById('fs-search-clear');

    const syncSearchClear = () => {
      if (!searchClear) return;
      searchClear.style.display = searchInput && searchInput.value.trim() ? 'inline-flex' : 'none';
    };

    if (searchWrapper && searchInput) {
      // Clicking anywhere in the pill focuses the input
      searchWrapper.onclick = (e) => {
        if (e.target !== searchClear) searchInput.focus();
      };

      searchInput.oninput = () => {
        syncSearchClear();
        const activeTab = panel.querySelector('.fs-tab.active');
        const currentTab = activeTab ? activeTab.dataset.tab : 'all';
        renderResults(lastScanResults, currentTab, searchInput.value);
      };

      // Esc inside the search clears it first; a second Esc closes the panel
      searchInput.onkeydown = (e) => {
        if (e.key === 'Escape' && searchInput.value) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = '';
          syncSearchClear();
          const activeTab = panel.querySelector('.fs-tab.active');
          renderResults(lastScanResults, activeTab ? activeTab.dataset.tab : 'all', '');
        }
      };

      if (searchClear) {
        searchClear.onclick = (e) => {
          e.stopPropagation();
          searchInput.value = '';
          syncSearchClear();
          searchInput.focus();
          const activeTab = panel.querySelector('.fs-tab.active');
          renderResults(lastScanResults, activeTab ? activeTab.dataset.tab : 'all', '');
        };
      }

      syncSearchClear();
    }

    // Keyboard shortcuts listener (Space + R to open & scan, Escape to close)
    const keysPressed = {};

    document.addEventListener('keydown', (e) => {
      // 1. Close on Escape key
      if (e.key === 'Escape' && panelVisible) {
        togglePanel(false);
        return;
      }

      // 2. Ignore shortcut if user is currently typing in an input, textarea, or contentEditable element
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName ? activeEl.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || activeEl.isContentEditable) {
          return;
        }
      }

      keysPressed[e.code] = true;

      // Check if Space and R are pressed together (or Space held down while pressing R)
      const isSpace = keysPressed['Space'] || e.code === 'Space' || e.key === ' ';
      const isR = keysPressed['KeyR'] || e.code === 'KeyR' || e.key === 'r' || e.key === 'R';

      if (isSpace && isR) {
        e.preventDefault();
        togglePanel(true);
        triggerScan();
      }
    });

    document.addEventListener('keyup', (e) => {
      delete keysPressed[e.code];
    });

    // Tab switching
    panel.querySelectorAll('.fs-tab').forEach(tab => {
      tab.onclick = () => {
        panel.querySelectorAll('.fs-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const q = searchInput ? searchInput.value : '';
        renderResults(lastScanResults, tab.dataset.tab, q);
      };
    });
  }

  function getFlyDeltas(panel, flyBtn) {
    // Distance from the panel's bottom-right corner to the button's center —
    // the genie folds toward that exact spot.
    let dx = 14, dy = 22;
    if (flyBtn && flyBtn.getBoundingClientRect) {
      try {
        const t = flyBtn.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        if (t.width > 0 && p.width > 0) {
          const targetX = t.left + t.width / 2;
          const targetY = t.top + t.height / 2;
          dx = targetX - p.right;
          dy = targetY - p.bottom;
        }
      } catch (e) { }
    }
    return { dx: Math.round(dx), dy: Math.round(dy) };
  }

  function squashButton(btn) {
    // Compress & rebound the button while the panel folds into / grows out of it.
    if (!btn) return;
    btn.classList.remove('fs-genie-squash');
    void btn.offsetWidth;
    btn.classList.add('fs-genie-squash');
    clearTimeout(btn.__fsSquashTimer);
    btn.__fsSquashTimer = setTimeout(() => btn.classList.remove('fs-genie-squash'), 480);
  }

  function togglePanel(force) {
    const panel = document.getElementById('fs-panel');
    const backdrop = document.getElementById('fs-backdrop');
    const triggerBtn = document.getElementById('fs-trigger-btn');
    const launcherBtn = document.getElementById('flow-scanner-launcher-btn');
    if (!panel) return;
    const shouldShow = force !== undefined ? force : !panelVisible;
    panelVisible = shouldShow;

    // The floating button the genie folds into (visible trigger, else launcher).
    const flyBtn = (triggerBtn && triggerBtn.style.display !== 'none') ? triggerBtn
      : (launcherBtn && launcherBtn.style.display !== 'none' ? launcherBtn : null);

    if (shouldShow) {
      // Genie launch: unfold from the button, restarting every time it opens.
      panel.classList.remove('fs-genie-closing', 'fs-genie-opening');
      panel.style.display = 'flex';
      const { dx, dy } = getFlyDeltas(panel, flyBtn);
      panel.style.setProperty('--fs-genie-dx', dx + 'px');
      panel.style.setProperty('--fs-genie-dy', dy + 'px');
      void panel.offsetWidth; // force reflow so the animation restarts
      panel.classList.add('fs-genie-opening');
      squashButton(flyBtn);
    } else {
      // Genie minimize: fly back into the button, then hide.
      panel.classList.remove('fs-genie-opening');
      const { dx, dy } = getFlyDeltas(panel, flyBtn);
      panel.style.setProperty('--fs-genie-dx', dx + 'px');
      panel.style.setProperty('--fs-genie-dy', dy + 'px');
      panel.classList.add('fs-genie-closing');
      squashButton(flyBtn);
      const hideAfterClose = (e) => {
        // Only the panel's own closing animation counts (inner animations bubble).
        if (e && e.target !== panel) return;
        panel.removeEventListener('animationend', hideAfterClose);
        if (!panelVisible && panel.classList.contains('fs-genie-closing')) {
          panel.style.display = 'none';
          panel.classList.remove('fs-genie-closing');
        }
      };
      panel.addEventListener('animationend', hideAfterClose);
      // Safety fallback if the animation never fires.
      setTimeout(hideAfterClose, 460);
    }

    if (backdrop) {
      backdrop.style.display = 'none';
    }
    const showBtns = (!panelVisible && !userHideFloatingBtn);
    if (triggerBtn) {
      triggerBtn.style.display = showBtns ? 'inline-flex' : 'none';
    }
    if (launcherBtn) {
      launcherBtn.style.display = showBtns ? 'inline-flex' : 'none';
    }
  }

  function makeDraggable(element, handle) {
    if (!element || !handle) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
      e.preventDefault();
      handle.style.cursor = 'grabbing';
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      let newTop = element.offsetTop - pos2;
      let newLeft = element.offsetLeft - pos1;

      const minTop = 5;
      const maxTop = Math.max(10, window.innerHeight - 50);
      const minLeft = 5;
      const maxLeft = Math.max(10, window.innerWidth - 100);

      newTop = Math.max(minTop, Math.min(newTop, maxTop));
      newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));

      element.style.top = newTop + "px";
      element.style.left = newLeft + "px";
      element.style.right = "auto";
      element.style.bottom = "auto";
      element.style.transform = "none";
    }

    function closeDragElement() {
      handle.style.cursor = 'grab';
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
    }
  }

  function toggleTheme(forceDark) {
    const panel = document.getElementById('fs-panel');
    const themeBtn = document.getElementById('fs-theme-btn');
    if (!panel) return;

    isDarkMode = forceDark !== undefined ? forceDark : !isDarkMode;

    if (isDarkMode) {
      panel.classList.add('fs-dark-theme');
    } else {
      panel.classList.remove('fs-dark-theme');
    }

    if (themeBtn) {
      const moon = themeBtn.querySelector('.fs-theme-moon');
      const sun = themeBtn.querySelector('.fs-theme-sun');
      if (moon && sun) {
        moon.style.display = isDarkMode ? 'none' : 'inline-block';
        sun.style.display = isDarkMode ? 'inline-block' : 'none';
      }
      themeBtn.title = isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }

    try {
      chrome.storage.local.set({ fs_theme: isDarkMode ? 'dark' : 'light' });
    } catch (e) {}
  }

  // ─── Update UI state ─────────────────────────────────────────────────────
  function setStatus(text, type = 'info') {
    const badge = document.getElementById('fs-status-badge');
    if (badge) {
      badge.textContent = text;
      badge.className = `fs-meta-badge fs-status-${type}`;
    }
  }

  function setFlowName(name) {
    const el = document.getElementById('fs-flow-name');
    if (el) el.textContent = name || 'Unknown Flow';
  }

  // ─── Rule Details Database (Hardcoded remediation & impact guides) ───────
  const RULE_DETAILS_DB = {
    'dml-in-loop': {
      title: 'DML Statement In A Loop',
      problem: 'Executing DML operations (create, update, delete) inside a loop is a high-risk anti-pattern. Each iteration consumes a database operation call.',
      impact: 'Will trigger Governor Limit exceptions (limit of 150 DML statements per transaction) when processing collections > 150 records, causing full flow failure.',
      steps: [
        '1. Collect all records into a Record Collection variable inside the loop using an Assignment element.',
        '2. Place a single Create/Update/Delete Records element OUTSIDE and AFTER the loop.',
        '3. Pass the entire Record Collection to the database element for bulk processing.'
      ]
    },
    'soql-in-loop': {
      title: 'SOQL Query (Get Records) In A Loop',
      problem: 'Executing a Get Records query inside a loop runs a separate database query for every item in the loop collection.',
      impact: 'Hits the 100 SOQL query governor limit, crashing the transaction with "System.LimitException: Too many SOQL queries: 101".',
      steps: [
        '1. Move the Get Records element OUTSIDE and BEFORE the loop.',
        '2. Query all required candidate records into a single collection beforehand.',
        '3. Use a Collection Filter or Decision element inside the loop to reference the pre-fetched collection.'
      ]
    },
    'missing-fault-path': {
      title: 'Missing Fault Connector / Error Handling',
      problem: 'Database operations (Get, Create, Update, Delete) and Action elements can fail at runtime due to validation rules, required fields, unhandled exceptions, or record locks.',
      impact: 'Without a Fault Path, failures show generic, unhandled fault error screens to end-users ("An unhandled fault has occurred in this flow").',
      steps: [
        '1. Drag a second connector from the database or action element (Salesforce creates a red dashed Fault connector).',
        '2. Connect the Fault connector to an Error Screen or logging element.',
        '3. Display a helpful message or log {!$Flow.FaultMessage} for debugging.'
      ]
    },
    'get-record-all-fields': {
      title: 'Get Records Stores All Fields',
      problem: 'The Get Records element is retrieving all fields automatically without specifying the queried fields required by the flow.',
      impact: 'Harmful to performance, increases heap memory consumption, and violates security/least-privilege guidelines.',
      steps: [
        '1. Open the Get Records element in Flow Builder.',
        '2. Under "How to Store Flow Data", select "Choose fields and let Salesforce store the rest automatically" or "Choose fields and assign variables (advanced)".',
        '3. Select ONLY the specific fields required by downstream elements.'
      ]
    },
    'hardcoded-id': {
      title: 'Hardcoded Salesforce Record ID',
      problem: 'Directly hardcoding 15 or 18-character Salesforce record IDs (e.g. 001..., 003..., 005...) in formulas or filter criteria.',
      impact: 'Record IDs are specific to a single Salesforce org. Hardcoded IDs WILL break when migrating between Sandbox, Developer, and Production environments.',
      steps: [
        '1. Store the record ID in a Custom Label, Custom Metadata Type, or Custom Setting.',
        '2. Or dynamically query the record ID using a Get Records element by DeveloperName/Type.'
      ]
    },
    'missing-flow-description': {
      title: 'Missing Flow Description',
      problem: 'The Flow Description field in Flow Settings is blank.',
      impact: 'Reduces team maintainability and governance. Admins cannot easily understand the purpose or trigger conditions of the flow.',
      steps: [
        '1. Click the Settings (gear icon) in Flow Builder -> Edit Details.',
        '2. Provide a clear description summarizing the business purpose, trigger conditions, and actions of this flow.'
      ]
    },
    'unused-variable': {
      title: 'Unused Flow Resource / Variable',
      problem: 'A variable, formula, constant, or text template is defined in the Manager tab but never referenced in any flow element.',
      impact: 'Creates unnecessary clutter, increases cognitive overhead, and consumes extra memory during flow execution.',
      steps: [
        '1. Open the Manager tab in the left sidebar.',
        '2. Locate the unreferenced resource, right-click, and select Delete.'
      ]
    },
    'missing-null-handler': {
      title: 'Missing Null Pointer Check After Get Records',
      problem: 'Referencing fields of a Get Records result directly without checking if a record was actually returned by the query.',
      impact: 'If the Get Records query returns no matching records (null), referencing its fields causes a Null Pointer crash at runtime.',
      steps: [
        '1. Add a Decision element immediately after the Get Records element.',
        '2. Add an outcome condition: {!Get_Record} Is Null False.',
        '3. Only process the record along the "Is Null False" branch.'
      ]
    },
    'api-version': {
      title: 'Outdated Flow API Version',
      problem: 'The flow is running on an outdated Salesforce API version.',
      impact: 'Misses out on performance optimizations, security patches, and modern Flow Builder capabilities introduced in newer releases.',
      steps: [
        '1. Click Settings (gear icon) -> Edit Details.',
        '2. Select the latest API Version from the dropdown.',
        '3. Save and re-test the flow.'
      ]
    },
    'trigger-order': {
      title: 'Missing Trigger Order on Record-Triggered Flow',
      problem: 'Multiple record-triggered flows exist for the same object and event without explicit Trigger Order values.',
      impact: 'Flows execute in an unpredictable order, causing race conditions and inconsistent database states.',
      steps: [
        '1. Open Settings -> Edit Details.',
        '2. In the "Trigger Order" field, enter a value from 1 to 2000 (e.g. 10, 20, 30).',
        '3. Lower numbers execute first, establishing a deterministic execution sequence.'
      ]
    },
    'unconnected-element': {
      title: 'Unconnected / Orphan Element',
      problem: 'An element exists on the canvas but has no incoming connector path from the Start element.',
      impact: 'The element will never execute, cluttering the visual diagram and confusing developers.',
      steps: [
        '1. Connect the element into the main flow execution path.',
        '2. Or delete the element if it is no longer required.'
      ]
    },
    'same-record-field-updates': {
      title: 'Redundant Update Element in Before-Save Flow',
      problem: 'Using an Update Records element to update the triggering record ($Record) in a Fast Field Updates (Before-Save) flow.',
      impact: 'Before-Save flows automatically save changes made to $Record without needing an Update element. Using an Update element triggers unnecessary database recursive loops.',
      steps: [
        '1. Remove the Update Records element.',
        '2. Use an Assignment element to set values directly on {!$Record.Field_Name}.',
        '3. Salesforce will save the updated values automatically.'
      ]
    },
    'missing-record-trigger-filter': {
      title: 'Missing Entry Criteria Filter',
      problem: 'A Record-Triggered Flow has no entry conditions configured.',
      impact: 'Fires on every single record create/update across the org, consuming CPU time limits and slowing down bulk updates.',
      steps: [
        '1. Click the Start element -> Edit.',
        '2. Set Filter Conditions (e.g. Status Equals Active, or IsChanged = True).',
        '3. Ensure the flow only runs when relevant fields change.'
      ]
    },
    'hardcoded-secret': {
      title: 'Hardcoded Secret / Credential',
      problem: 'Hardcoding passwords, API tokens, bearer keys, or secret credentials inside flow formulas or text templates.',
      impact: 'Exposes sensitive credentials in metadata, security audits, and debug logs.',
      steps: [
        '1. Store secrets securely in Salesforce Named Credentials or External Credentials.',
        '2. Reference the credential in HTTP Callout actions rather than hardcoding tokens in flow elements.'
      ]
    },
    'duplicate-dml': {
      title: 'Duplicate DML Operations On Same Object',
      problem: 'Multiple separate Create/Update/Delete Records elements operating on the same SObject type in a single flow path.',
      impact: 'Consumes multiple DML governor limits and triggers repetitive Apex triggers and automation execution.',
      steps: [
        '1. Combine record updates into a single record collection.',
        '2. Perform a single DML operation on the collection at the end of the flow.'
      ]
    }
  };

  // ─── Canvas Highlighting & Visual Pin Badges ─────────────────────────────
  function clearCanvasHighlights() {
    document.querySelectorAll('.fs-highlight-node-error, .fs-highlight-node-warning').forEach(el => {
      el.classList.remove('fs-highlight-node-error', 'fs-highlight-node-warning');
    });
    document.querySelectorAll('.fs-node-pin-badge').forEach(badge => badge.remove());
  }

  function highlightNodesOnCanvas(issues) {
    clearCanvasHighlights();
    if (!issues || issues.length === 0) return;

    // Build map of elementName -> worst issue severity & issue list
    const nodeIssueMap = {};
    for (const issue of issues) {
      const name = issue.elementName;
      if (!name || name === 'N/A' || name === 'Global') continue;
      if (!nodeIssueMap[name]) {
        nodeIssueMap[name] = { severity: issue.severity, count: 1, rules: [issue.ruleName] };
      } else {
        nodeIssueMap[name].count++;
        nodeIssueMap[name].rules.push(issue.ruleName);
        if (issue.severity === 'error') nodeIssueMap[name].severity = 'error';
      }
    }

    // Query canvas DOM nodes in Salesforce Flow Builder (supports standard & Shadow DOM)
    const selectors = [
      '[data-element-name]',
      '[data-node-id]',
      '.flowbuilder-canvas-node',
      '.builder-node',
      '.flow-element',
      'g.node',
      '[class*="builder-node"]'
    ];

    const foundElements = new Map();

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const attrName = el.getAttribute('data-element-name') || el.getAttribute('data-node-id') || el.getAttribute('id') || el.textContent;
        if (attrName) {
          for (const elemName of Object.keys(nodeIssueMap)) {
            if (attrName.toLowerCase().includes(elemName.toLowerCase())) {
              foundElements.set(el, elemName);
            }
          }
        }
      });
    });

    // Fallback: search all canvas SVG text or label elements if specific data attributes are not available
    if (foundElements.size === 0) {
      document.querySelectorAll('text, span, div.slds-truncate').forEach(el => {
        const txt = el.textContent ? el.textContent.trim() : '';
        if (txt) {
          for (const elemName of Object.keys(nodeIssueMap)) {
            if (txt.toLowerCase() === elemName.toLowerCase()) {
              const nodeContainer = el.closest('.builder-node, g.node, [class*="node"], div[data-aura-class], div.slds-box') || el.parentElement;
              if (nodeContainer) foundElements.set(nodeContainer, elemName);
            }
          }
        }
      });
    }

    // Apply glowing highlights and pin badges
    foundElements.forEach((elemName, domNode) => {
      const info = nodeIssueMap[elemName];
      if (!info) return;

      const isErr = info.severity === 'error';
      domNode.classList.add(isErr ? 'fs-highlight-node-error' : 'fs-highlight-node-warning');

      // Create glowing pin badge
      const pin = document.createElement('div');
      pin.className = `fs-node-pin-badge ${isErr ? 'fs-node-pin-error' : 'fs-node-pin-warning'}`;
      pin.textContent = info.count;
      pin.setAttribute('data-tooltip', `⚠️ ${info.count} issue(s): ${info.rules.slice(0, 2).join(', ')}`);

      pin.onclick = (e) => {
        e.stopPropagation();
        togglePanel(true);
        const searchInput = document.getElementById('fs-search-input');
        if (searchInput) {
          searchInput.value = elemName;
          const searchClear = document.getElementById('fs-search-clear');
          if (searchClear) searchClear.style.display = 'inline-flex';
          renderResults(lastScanResults, 'all', elemName);
        }
      };

      // Set position relative if needed
      const style = window.getComputedStyle(domNode);
      if (style.position === 'static') {
        domNode.style.position = 'relative';
      }

      domNode.appendChild(pin);
    });      console.debug(`[FlowScanner Canvas] Highlighted ${foundElements.size} node(s) on Flow Builder Canvas.`);
  }

  function renderResults(issues, filter = 'all', query = '') {
    const list = document.getElementById('fs-results-list');
    const empty = document.getElementById('fs-empty-state');
    const footer = document.getElementById('fs-panel-footer');
    const summary = document.getElementById('fs-result-summary');
    const badge = document.getElementById('fs-badge');
    const scoreBadge = document.getElementById('fs-score-badge');

    if (!list) return;

    let filtered = filter === 'all' ? issues : issues.filter(i => {
      if (filter === 'error') return i.severity === 'error';
      if (filter === 'warning') return i.severity === 'warning';
      if (filter === 'info') return i.severity === 'note' || i.severity === 'info';
      return true;
    });

    if (query && query.trim() !== '') {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(i =>
        (i.ruleName || '').toLowerCase().includes(q) ||
        (i.elementName || '').toLowerCase().includes(q) ||
        (i.ruleId || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos = issues.filter(i => i.severity !== 'error' && i.severity !== 'warning').length;

    // Calculate Flow Health Scorecard (100 max)
    const score = Math.max(0, 100 - (errors * 15 + warnings * 5 + infos * 2));
    let grade = 'A+';
    let scoreClass = 'fs-score-a';
    if (score >= 95) { grade = 'A+ (Optimal)'; scoreClass = 'fs-score-a'; }
    else if (score >= 85) { grade = 'A (Good)'; scoreClass = 'fs-score-a'; }
    else if (score >= 75) { grade = 'B (Moderate)'; scoreClass = 'fs-score-b'; }
    else if (score >= 60) { grade = 'C (Warning)'; scoreClass = 'fs-score-c'; }
    else { grade = 'F (High Risk)'; scoreClass = 'fs-score-f'; }

    // Apply glowing visual pins and highlights directly onto Salesforce Flow Builder Canvas
    highlightNodesOnCanvas(issues);

    if (issues.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'flex';
      empty.innerHTML = `
        <div class="fs-empty-icon">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="fs-empty-text">No issues found!</div>
        <div class="fs-empty-sub">Your flow passed all Salesforce Flow Scanner checks</div>
      `;
      if (footer) footer.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }

    // Update badge
    if (badge) {
      badge.textContent = issues.length;
      badge.style.display = 'inline-flex';
      badge.className = errors > 0 ? 'fs-badge fs-badge-error' : warnings > 0 ? 'fs-badge fs-badge-warning' : 'fs-badge fs-badge-info';
    }

    // Update footer summary
    const iconErr = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    const iconWarn = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const iconInfo = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    if (footer) footer.style.display = 'flex';
    if (summary) {
      summary.innerHTML = `
        <span class="fs-count-chip fs-chip-error">${iconErr} ${errors} Error${errors !== 1 ? 's' : ''}</span>
        <span class="fs-count-chip fs-chip-warning">${iconWarn} ${warnings} Warning${warnings !== 1 ? 's' : ''}</span>
        <span class="fs-count-chip fs-chip-info">${iconInfo} ${infos} Info</span>
      `;
    }

    // Render issue rows
    empty.style.display = 'none';
    list.style.display = 'block';

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="fs-no-filtered">
          <div class="fs-no-filtered-icon">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="fs-no-filtered-text">No ${filter} issues found</div>
          <div class="fs-no-filtered-sub">Your flow has 0 ${filter} level violations</div>
        </div>
      `;
      return;
    }

    const svgError = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e5484d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    const svgWarning = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const svgInfo = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    const svgProblem = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const svgRisk = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    const svgFix = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

    list.innerHTML = filtered.map((issue, idx) => {
      const severityIcon = issue.severity === 'error' ? svgError : issue.severity === 'warning' ? svgWarning : svgInfo;
      const severityClass = `fs-sev-${issue.severity}`;

      // Lookup hardcoded rule details
      const ruleKey = (issue.ruleId || '').toLowerCase();
      const ruleNameKey = (issue.ruleName || '').toLowerCase();
      const details = RULE_DETAILS_DB[ruleKey] || RULE_DETAILS_DB[ruleNameKey] || {
        title: issue.ruleName,
        problem: issue.description || 'This element violates Salesforce Flow best practices.',
        impact: 'May cause runtime exceptions, governor limit failures, or maintenance issues.',
        steps: ['Inspect the element in Flow Builder and apply recommended Salesforce Flow guidelines.']
      };

      return `
        <div class="fs-issue-row ${severityClass}" data-idx="${idx}" style="animation-delay: ${idx * 0.035}s">
          <div class="fs-issue-summary">
            <span class="fs-sev-icon">${severityIcon}</span>
            <span class="fs-rule-name">${escapeHtml(issue.ruleName)}</span>
            <div class="fs-issue-element">
              <span class="fs-element-label">ELEMENT:</span>
              <code class="fs-element-name">${escapeHtml(issue.elementName)}</code>
              ${issue.elementType ? `<span class="fs-element-type">${escapeHtml(issue.elementType)}</span>` : ''}
            </div>
            <span class="fs-chevron">▼</span>
          </div>
          <div class="fs-issue-details" id="details-${idx}">
            ${issue.description ? `<div class="fs-issue-desc">${escapeHtml(issue.description)}</div>` : ''}
            <div class="fs-detail-section">
              <div class="fs-detail-header">${svgProblem} Problem Explanation</div>
              <div class="fs-detail-content">${escapeHtml(details.problem)}</div>
            </div>
            <div class="fs-detail-section">
              <div class="fs-detail-header">${svgRisk} Governor Limit & Risk</div>
              <div class="fs-detail-impact">${escapeHtml(details.impact)}</div>
            </div>
            <div class="fs-detail-section">
              <div class="fs-detail-header">${svgFix} How To Fix</div>
              <div class="fs-detail-solution">
                ${details.steps.map(step => `<div class="fs-solution-step">${escapeHtml(step)}</div>`).join('')}
              </div>
            </div>
            ${(issue.ruleId === 'get-record-all-fields' && issue.detectedFields && issue.detectedFields.length > 0) ? `
            <div class="fs-detail-section fs-fields-section">
              <div class="fs-fields-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Detected Downstream Fields for '${escapeHtml(issue.elementName)}':
              </div>
              <div class="fs-fields-desc">
                Flow Scanner analyzed your flow diagram and detected <strong>${issue.detectedFields.length} field(s)</strong> referenced downstream:
              </div>
              <div class="fs-fields-chips">
                ${issue.detectedFields.map(f => `<span class="fs-fields-chip">${escapeHtml(f)}</span>`).join('')}
              </div>
              <div class="fs-fields-hint">
                👉 In Flow Builder: Open '${escapeHtml(issue.elementName)}' ➔ How to Store Flow Data ➔ "Choose fields and let Salesforce store the rest automatically" ➔ Add these fields.
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Show export dropdown button
    const exportDropdownWrapper = document.getElementById('fs-export-dropdown-wrapper');
    if (exportDropdownWrapper) exportDropdownWrapper.style.display = 'inline-block';

    // Attach click handlers for expandable issue rows and element navigation
    list.querySelectorAll('.fs-issue-row').forEach(row => {
      // Element badge click handler (navigates & focuses directly without toggling accordion)
      const elemBadge = row.querySelector('.fs-issue-element');
      if (elemBadge) {
        elemBadge.onclick = (e) => {
          e.stopPropagation();
          const elemCode = row.querySelector('.fs-element-name');
          if (elemCode && elemCode.textContent) {
            scrollToCanvasNode(elemCode.textContent.trim());
          }
        };
      }

      // Row click handler (toggles accordion and navigates)
      row.onclick = () => {
        row.classList.toggle('expanded');
        const elemCode = row.querySelector('.fs-element-name');
        if (elemCode && elemCode.textContent) {
          scrollToCanvasNode(elemCode.textContent.trim());
        }
      };
    });
  }

  function findCanvasElementNode(elemName) {
    if (!elemName || elemName === 'N/A') return null;

    const raw = elemName.trim();
    const spaced = raw.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    const searchTerms = Array.from(new Set([raw.toLowerCase(), spaced.toLowerCase()]));

    function queryAllDeep(selector, root = document) {
      let results = [];
      try {
        results = Array.from(root.querySelectorAll(selector));
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
        let currentNode = walker.nextNode();
        while (currentNode) {
          if (currentNode.shadowRoot) {
            results = results.concat(queryAllDeep(selector, currentNode.shadowRoot));
          }
          currentNode = walker.nextNode();
        }
      } catch (e) {}
      return results;
    }

    // 0. Special handling for Start Node / Flow-level issues (undefined, Draft, Start, Flow)
    const lowerRaw = raw.toLowerCase();
    if (lowerRaw === 'undefined' || lowerRaw === 'draft' || lowerRaw === 'start' || lowerRaw === 'flow') {
      const startNodes = queryAllDeep('[aria-label*="Start"], [title*="Start"], .slds-card, builder_platform_interaction-alc-element-card');
      for (const node of startNodes) {
        const text = (node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '').toLowerCase();
        if (text.includes('start')) {
          return node.closest('.slds-card') || node.closest('.base-card') || node.closest('builder_platform_interaction-alc-element-card') || node;
        }
      }
      const anyCards = queryAllDeep('.slds-card, .base-card, builder_platform_interaction-alc-element-card');
      if (anyCards.length > 0) return anyCards[0];
    }

    // 1. Exact Salesforce Flow Builder LWC Component Selectors (Screen, Get, Create, Update, Delete, Decision, Assignment, Loop, Subflow, etc.)
    for (const term of searchTerms) {
      const exactSelectors = [
        `.text-element-label[title="${term}"]`,
        `[title="${term}"]`,
        `[aria-label*="${term}"]`,
        `[data-element-name="${term}"]`,
        `[data-node-id="${term}"]`
      ];

      for (const sel of exactSelectors) {
        const nodes = queryAllDeep(sel);
        if (nodes.length > 0) {
          const match = nodes[0];
          return match.closest('.slds-card') || match.closest('.base-card') || match.closest('builder_platform_interaction-alc-element-card') || match.closest('g') || match;
        }
      }
    }

    // 2. Connector / Path / Line Selectors
    for (const term of searchTerms) {
      const connectorSelectors = [
        `g[data-connector-id*="${term}"]`,
        `path[data-connector-id*="${term}"]`,
        `.flow-connector`,
        `g.connector`
      ];
      for (const sel of connectorSelectors) {
        const nodes = queryAllDeep(sel);
        for (const node of nodes) {
          const attr = (node.getAttribute('data-connector-id') || node.getAttribute('aria-label') || '').toLowerCase();
          if (attr.includes(term)) return node;
        }
      }
    }

    // 3. Left Manager / Resource Sidebar Selectors (Variables, Formulas, Templates)
    for (const term of searchTerms) {
      const sidebarSelectors = [
        `lightning-tree-item[title*="${term}"]`,
        `.slds-tree__item[title*="${term}"]`,
        `[title*="${term}"]`
      ];
      for (const sel of sidebarSelectors) {
        const nodes = queryAllDeep(sel);
        if (nodes.length > 0) return nodes[0];
      }
    }

    // 4. Generic Fallback Selectors across DOM
    const fallbackSelectors = [
      `.text-element-label`,
      `[aria-label]`,
      `[data-element-name]`,
      `[data-node-id]`,
      `.slds-card`,
      `.base-card`,
      `builder_platform_interaction-alc-element-card`,
      `.builder-node`,
      `g`
    ];

    for (const term of searchTerms) {
      for (const sel of fallbackSelectors) {
        const nodes = queryAllDeep(sel);
        for (const node of nodes) {
          const titleText = (node.getAttribute('title') || '').toLowerCase();
          const ariaText = (node.getAttribute('aria-label') || '').toLowerCase();
          const nodeText = (node.textContent || '').toLowerCase();

          if (titleText.includes(term) || ariaText.includes(term) || (nodeText.includes(term) && nodeText.length < 200)) {
            return node.closest('.slds-card') || node.closest('.base-card') || node.closest('builder_platform_interaction-alc-element-card') || node.closest('.builder-node') || node.closest('g') || node;
          }
        }
      }
    }
    return null;
  }

  // ONE active focus session at a time. Starting a new focus cancels the
  // previous element's interval/listeners first, so the shared overlay can
  // never keep snapping back to the previously focused element (which caused
  // the jittery back-and-forth between the last and the newly clicked element).
  let activeFocusCleanup = null;

  function scrollToCanvasNode(elemName) {
    if (!elemName || elemName === 'N/A' || elemName === 'Global') return;

    // Cancel any previous focus session before starting a new one.
    if (typeof activeFocusCleanup === 'function') {
      try { activeFocusCleanup(); } catch (e) { }
      activeFocusCleanup = null;
    }

    // Remove any previous red outline target focus
    document.querySelectorAll('.fs-target-node-focus').forEach(el => el.classList.remove('fs-target-node-focus'));

    const targetNode = findCanvasElementNode(elemName);

    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      targetNode.classList.add('fs-target-node-focus');

      // Create or update high-visibility floating rotating dotted/dashed red overlay box
      let overlay = document.getElementById('fs-canvas-target-highlighter');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'fs-canvas-target-highlighter';
        overlay.className = 'fs-target-overlay-glow';
        overlay.innerHTML = `
          <svg width="100%" height="100%" class="fs-rotating-dash-svg">
            <rect x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx="10" ry="10" class="fs-dash-rect"/>
          </svg>
        `;
        document.body.appendChild(overlay);
      }

      const updateOverlayPos = () => {
        const rect = targetNode.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        overlay.style.top = (rect.top - 3) + 'px';
        overlay.style.left = (rect.left - 3) + 'px';
        overlay.style.width = (rect.width + 6) + 'px';
        overlay.style.height = (rect.height + 6) + 'px';
        overlay.style.display = 'block';
      };

      updateOverlayPos();
      let rafId = null;
      let lastPosUpdate = 0;
      const POS_THROTTLE_MS = 80;
      const onOverlaySignal = () => {
        const now = Date.now();
        if (now - lastPosUpdate < POS_THROTTLE_MS) return;
        lastPosUpdate = now;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateOverlayPos);
      };
      window.addEventListener('scroll', onOverlaySignal, true);
      window.addEventListener('resize', onOverlaySignal);
      const posTimer = setInterval(onOverlaySignal, 250);

      // Cleanup for THIS session only. A newer focus replaces activeFocusCleanup,
      // so a stale auto-hide timeout can never hide or re-target a newer highlight.
      const cleanup = () => {
        clearInterval(posTimer);
        cancelAnimationFrame(rafId);
        window.removeEventListener('scroll', onOverlaySignal, true);
        window.removeEventListener('resize', onOverlaySignal);
        if (overlay) overlay.style.display = 'none';
        if (targetNode) targetNode.classList.remove('fs-target-node-focus');
      };
      activeFocusCleanup = cleanup;

      // Keep glowing rotating dotted red highlight visible for 5.5 seconds
      setTimeout(() => {
        if (activeFocusCleanup === cleanup) {
          activeFocusCleanup = null;
          cleanup();
        }
      }, 5500);
    }
  }

  // ─── Export Functions ───────────────────────────────────────────────────

  async function exportTextReport() {
    try {
      if (!lastScanResults) {
        await triggerScan();
      }
      if (!lastScanResults || lastScanResults.length === 0) {
        alert('No scan results available to export. Please run a scan first.');
        return;
      }
      const flowName = currentFlowName || 'Salesforce_Flow';
      const dateStr = new Date().toLocaleString();
      const errors = lastScanResults.filter(i => i.severity === 'error');
      const warnings = lastScanResults.filter(i => i.severity === 'warning');
      const infos = lastScanResults.filter(i => i.severity !== 'error' && i.severity !== 'warning');

      let text = `# ⚡ Flow Scanner Report\n\n`;
      text += `**Flow Name**: \`${flowName}\`  \n`;
      text += `**Flow Version**: \`${currentFlowVersion}\`  \n`;
      text += `**Generated On**: \`${dateStr}\`  \n\n`;

      text += `## 📊 Executive Summary\n\n`;
      text += `- 🔴 **Errors**: ${errors.length}\n`;
      text += `- 🟡 **Warnings**: ${warnings.length}\n`;
      text += `- 🔵 **Info**: ${infos.length}\n`;
      text += `- **Total Issues**: ${lastScanResults.length}\n\n`;

      text += `---\n\n`;
      text += `## 🚨 Detailed Rule Violations\n\n`;

      lastScanResults.forEach((issue, idx) => {
        const ruleKey = (issue.ruleId || '').toLowerCase();
        const ruleNameKey = (issue.ruleName || '').toLowerCase();
        const details = RULE_DETAILS_DB[ruleKey] || RULE_DETAILS_DB[ruleNameKey] || {
          problem: issue.description || 'Violates Salesforce Flow best practices.',
          impact: 'May cause governor limit failures or runtime issues.',
          steps: ['Inspect element in Flow Builder and fix.']
        };

        const sevTag = issue.severity.toUpperCase();
        text += `### ${idx + 1}. [${sevTag}] ${issue.ruleName} (\`${issue.ruleId}\`)\n`;
        text += `- **Element**: \`${issue.elementName}\`${issue.elementType ? ` (${issue.elementType})` : ''}\n`;
        if (issue.description) text += `- **Summary**: ${issue.description}\n`;
        text += `- 📌 **Problem Explanation**: ${details.problem}\n`;
        text += `- 🚨 **Governor Limit & Risk**: ${details.impact}\n`;
        text += `- 🛠️ **How to Fix**:\n`;
        details.steps.forEach(step => {
          text += `  1. ${step}\n`;
        });
        text += `\n`;
      });

      text += `---\n*Report generated by Flow Scanner*\n`;

      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Flow_Report_${flowName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      console.debug('[FlowScanner] Text report exported successfully.');
    } catch (err) {
      console.error('[FlowScanner] Error exporting text report:', err);
      alert('Failed to export text report: ' + err.message);
    }
  }

  async function exportImageReport() {
    try {
      if (!lastScanResults) {
        await triggerScan();
      }
      if (!lastScanResults || lastScanResults.length === 0) {
        alert('No scan results available to export image. Please run a scan first.');
        return;
      }
      const flowName = currentFlowName || 'Salesforce_Flow';
      const dateStr = new Date().toLocaleDateString();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 960;
      const issues = lastScanResults;
      const errors = issues.filter(i => i.severity === 'error').length;
      const warnings = issues.filter(i => i.severity === 'warning').length;
      const infos = issues.filter(i => i.severity !== 'error' && i.severity !== 'warning').length;

      const M = 28;                                   // page margin
      const HEADER_H = 88;
      const SUMMARY_H = 118;
      const CARD_H = 70;
      const CARD_GAP = 12;
      const FOOTER_H = 56;
      const totalHeight = HEADER_H + SUMMARY_H + (issues.length > 0 ? issues.length * (CARD_H + CARD_GAP) + 8 : 80) + FOOTER_H;

      canvas.width = width * 2; // HD 2x scale
      canvas.height = totalHeight * 2;
      ctx.scale(2, 2);

      // ── Canvas helpers ──────────────────────────────────────────────────
      function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function chip(text, x, y, w, h, bg, color, border) {
        ctx.fillStyle = bg;
        rr(x, y, w, h, 5);
        ctx.fill();
        if (border) {
          ctx.strokeStyle = border;
          ctx.lineWidth = 1;
          rr(x, y, w, h, 5);
          ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.fillText(text, x + (w - ctx.measureText(text).width) / 2, y + h / 2 + 3.5);
      }

      // ── Page background ─────────────────────────────────────────────────
      ctx.fillStyle = '#f4f6f9';
      ctx.fillRect(0, 0, width, totalHeight);

      // ── Header ──────────────────────────────────────────────────────────
      const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
      headerGrad.addColorStop(0, '#12263a');
      headerGrad.addColorStop(1, '#1f3a5c');
      ctx.fillStyle = headerGrad;
      rr(0, 0, width, HEADER_H, 0);
      ctx.fill();

      // title only (no branding)
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 17px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Flow Scanner Report', M, HEADER_H / 2 + 6);

      // right-side meta chips (flow name, version, date)
      const metaFont = '600 10.5px Inter, sans-serif';
      let chipX = width - M;
      const rightChips = [
        { text: dateStr, w: 0 },
        { text: `Version ${String(currentFlowVersion || '1').replace(/^v/i, '')}`, w: 0 },
        { text: flowName, w: 0 }
      ];
      rightChips.forEach((c, i) => {
        ctx.font = metaFont;
        const tw = ctx.measureText(c.text).width + 20;
        const w = Math.max(c.w || tw, tw);
        chipX -= w;
        const isFlow = i === 2;
        if (isFlow) {
          ctx.fillStyle = '#ffffff';
          rr(chipX, HEADER_H / 2 - 12, w, 24, 5);
          ctx.fill();
          ctx.fillStyle = '#1f2937';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          rr(chipX, HEADER_H / 2 - 12, w, 24, 5);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1;
          rr(chipX, HEADER_H / 2 - 12, w, 24, 5);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        }
        ctx.fillText(c.text, chipX + (w - ctx.measureText(c.text).width) / 2, HEADER_H / 2 + 4.5);
        chipX -= 8;
      });

      // ── Executive summary ───────────────────────────────────────────────
      let sy = HEADER_H + 26;
      ctx.fillStyle = '#64748b';
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillText('EXECUTIVE SUMMARY', M, sy);
      sy += 13;
      const statW = (width - M * 2 - 12 * 3) / 4;
      const statH = 56;
      const stats = [
        { label: 'Errors', value: errors, accent: '#dc2626' },
        { label: 'Warnings', value: warnings, accent: '#d97706' },
        { label: 'Info', value: infos, accent: '#2563eb' },
        { label: 'Total Issues', value: issues.length, accent: '#334155' }
      ];
      stats.forEach((s, i) => {
        const x = M + i * (statW + 12);
        // neutral card
        ctx.fillStyle = '#ffffff';
        rr(x, sy, statW, statH, 6);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        rr(x, sy, statW, statH, 6);
        ctx.stroke();
        // thin accent bar on the left
        ctx.fillStyle = s.accent;
        rr(x, sy + 10, 3, statH - 20, 1.5);
        ctx.fill();
        // value + label in neutral slate
        ctx.fillStyle = '#1e293b';
        ctx.font = '800 19px Inter, sans-serif';
        ctx.fillText(String(s.value), x + 16, sy + 25);
        ctx.fillStyle = '#64748b';
        ctx.font = '700 9px Inter, sans-serif';
        ctx.fillText(s.label.toUpperCase(), x + 16, sy + 43);
      });

      // ── Issue cards ─────────────────────────────────────────────────────
      let y = HEADER_H + SUMMARY_H + 6;
      if (issues.length === 0) {
        ctx.fillStyle = '#ffffff';
        rr(M, y, width - M * 2, 70, 6);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        rr(M, y, width - M * 2, 70, 6);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillText('No issues detected — this flow is clean.', M + 20, y + 40);
      } else {
        issues.forEach((issue, idx) => {
          const sev = issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info';
          const sevColor = sev === 'error' ? '#dc2626' : sev === 'warning' ? '#d97706' : '#2563eb';
          const sevBg = sev === 'error' ? '#fbf3f3' : sev === 'warning' ? '#faf6ee' : '#f2f6fc';
          const sevBorder = sev === 'error' ? '#e9d3d3' : sev === 'warning' ? '#e6dcbf' : '#d5e1f0';
          const sevLabel = sev === 'error' ? 'ERROR' : sev === 'warning' ? 'WARNING' : 'INFO';

          // card body
          ctx.fillStyle = '#ffffff';
          rr(M, y, width - M * 2, CARD_H, 6);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          rr(M, y, width - M * 2, CARD_H, 6);
          ctx.stroke();

          // left severity accent bar
          ctx.fillStyle = sevColor;
          rr(M, y + 10, 3, CARD_H - 20, 1.5);
          ctx.fill();

          // index badge (rounded square, not circle)
          const idxStr = String(idx + 1).padStart(2, '0');
          ctx.fillStyle = '#f1f5f9';
          rr(M + 16, y + 12, 20, 18, 4);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          rr(M + 16, y + 12, 20, 18, 4);
          ctx.stroke();
          ctx.fillStyle = '#475569';
          ctx.font = '700 9.5px Inter, sans-serif';
          ctx.fillText(idxStr, M + 26 - ctx.measureText(idxStr).width / 2, y + 25);

          // severity tag + rule name
          ctx.font = '700 9.5px Inter, sans-serif';
          const pillW = ctx.measureText(sevLabel).width + 14;
          chip(sevLabel, M + 46, y + 12, pillW, 18, sevBg, sevColor, sevBorder);
          const ruleX = M + 46 + pillW + 12;

          // rule id, right aligned (measured first so the name never overlaps it)
          ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = '#94a3b8';
          const idStr = issue.ruleId || '';
          const idW = ctx.measureText(idStr).width;
          ctx.fillText(idStr, width - M - idW, y + 26);

          // rule name, clipped to keep clear of the rule id
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px Inter, sans-serif';
          const nameMaxW = width - M - idW - 18 - ruleX;
          const fullName = issue.ruleName || 'Unknown Rule';
          let nameText = fullName;
          while (nameText.length > 1 && ctx.measureText(nameText + '…').width > nameMaxW) {
            nameText = nameText.slice(0, -1);
          }
          if (nameText.length < fullName.length) nameText += '…';
          ctx.fillText(nameText, ruleX, y + 26);

          // element chip + description on second line (neutral, small radius)
          const elText = `ELEMENT: ${issue.elementName || 'Unknown'}${issue.elementType ? ` · ${issue.elementType}` : ''}`;
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          // budget: keep at least ~120px for the description
          const chipMaxW = Math.max(60, width - M - ruleX - 150);
          let elTextFinal = elText;
          if (ctx.measureText(elText).width + 14 > chipMaxW) {
            while (elTextFinal.length > 6 && ctx.measureText(elTextFinal + '…').width + 14 > chipMaxW) {
              elTextFinal = elTextFinal.slice(0, -1);
            }
            elTextFinal += '…';
          }
          const elW = ctx.measureText(elTextFinal).width + 14;
          ctx.fillStyle = '#f1f5f9';
          rr(ruleX, y + 38, elW, 18, 4);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          rr(ruleX, y + 38, elW, 18, 4);
          ctx.stroke();
          ctx.fillStyle = '#475569';
          ctx.fillText(elTextFinal, ruleX + 7, y + 50);

          // description, safely clipped
          ctx.font = '400 11px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          const desc = issue.description || '';
          const maxDescW = Math.max(40, width - M - ruleX - elW - 24);
          let clipped = desc;
          if (ctx.measureText(clipped).width > maxDescW) {
            while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxDescW) {
              clipped = clipped.slice(0, -1);
            }
            clipped += '…';
          }
          ctx.fillText(clipped, ruleX + elW + 14, y + 50);

          y += CARD_H + CARD_GAP;
        });
      }

      // ── Footer ──────────────────────────────────────────────────────────
      const fy = totalHeight - FOOTER_H;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, fy + 20);
      ctx.lineTo(width - M, fy + 20);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 10.5px Inter, sans-serif';
      ctx.fillText('Scanned by Salesforce Comet Chrome extension', M, fy + 40);
      ctx.textAlign = 'right';
      const verLabel = (currentFlowVersion || '1').replace(/^v/i, '');
      ctx.fillText(`v${verLabel} · ${dateStr}`, width - M, fy + 40);
      ctx.textAlign = 'left';

      // Trigger PNG Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Flow_Report_${flowName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.debug('[FlowScanner] Image report exported successfully.');
    } catch (err) {
      console.error('[FlowScanner] Error exporting image report:', err);
      alert('Failed to export image report: ' + err.message);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setProgress(pct, statusText) {
    const wrapper = document.getElementById('fs-progress-wrapper');
    const fill = document.getElementById('fs-progress-fill');
    const pctLabel = document.getElementById('fs-progress-pct');

    const roundedPct = Math.min(Math.round(pct), 100);
    if (wrapper) wrapper.style.display = roundedPct > 0 && roundedPct < 100 ? 'flex' : 'none';
    if (fill) fill.style.width = `${roundedPct}%`;
    if (pctLabel) pctLabel.textContent = '';

    if (statusText) {
      setStatus(statusText, 'scanning');
    }
  }

  function toggleAppleAIGlow(show) {
    let glowScreen = document.getElementById('fs-apple-ai-glow-screen');
    if (!glowScreen) {
      glowScreen = document.createElement('div');
      glowScreen.id = 'fs-apple-ai-glow-screen';
      document.body.appendChild(glowScreen);
    }
    if (show) {
      glowScreen.classList.add('active');
    } else {
      glowScreen.classList.remove('active');
    }
  }

  // ─── Main Scan Trigger ───────────────────────────────────────────────────
  async function triggerScan() {
    if (scanInProgress) return;
    scanInProgress = true;
    toggleAppleAIGlow(true);

    const scanBtn = document.getElementById('fs-scan-btn');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = `<span class="fs-spinner"></span> Scanning...`;
    }

    setProgress(15, 'Detecting Flow');

    try {
      // Detect flow from URL
      const flowInfo = detectCurrentFlow();
      if (!flowInfo) {
        throw new Error('No flow detected. Please open a flow in Salesforce Flow Builder.');
      }

      console.debug('[FlowScanner] Detected flow:', flowInfo);
      setFlowName(`Loading ${flowInfo.value}...`);

      setProgress(40, 'Fetching Flow metadata');

      // Fetch flow data via background service worker (handles authentication)
      let flowRecord;
      if (interceptedFlowData) {
        console.debug('[FlowScanner] ⚡ Using intercepted Flow metadata instead of API fetch.');
        flowRecord = interceptedFlowData;
      } else {
        if (flowInfo.type === 'id') {
          flowRecord = await fetchFlowById(flowInfo.value);
        } else {
          flowRecord = await fetchFlowByName(flowInfo.value);
        }
      }

      setProgress(75, 'Analyzing 20+ Flow rules');

      currentFlowName = flowRecord.FullName || flowRecord.DeveloperName || flowInfo.value || 'Salesforce_Flow';
      currentFlowVersion = flowRecord.VersionNumber ? `v${flowRecord.VersionNumber}` : (flowRecord.Status ? `Status: ${flowRecord.Status}` : 'v1');
      const flowName = currentFlowName;
      setFlowName(`${flowName} (${currentFlowVersion})`);
      console.debug('[FlowScanner] Got flow record:', flowName);

      // Run official scan
      const { scanResults, flowObj } = await runOfficialScan(flowRecord);

      setProgress(95, 'Formatting Report');

      const issues = formatResults(scanResults, flowName, flowRecord);
      lastScanResults = issues;

      setProgress(100, 'Complete');

      setStatus(`${issues.length} issue${issues.length !== 1 ? 's' : ''} found`, issues.length > 0 ? 'error' : 'ok');

      // Show panel and render results
      togglePanel(true);
      renderResults(issues, 'all');

      // Reset tab to "All"
      document.querySelectorAll('.fs-tab').forEach(t => t.classList.remove('active'));
      const allTab = document.querySelector('.fs-tab[data-tab="all"]');
      if (allTab) allTab.classList.add('active');

    } catch (err) {
      console.error('[FlowScanner] Error:', err);
      setStatus('Error', 'error');

      const empty = document.getElementById('fs-empty-state');
      const list = document.getElementById('fs-results-list');
      if (empty) {
        empty.style.display = 'flex';

        // Check if this is an auth error or a "no flow" error
        const isAuthError = err.message.includes('401') || err.message.includes('authenticated') ||
                            err.message.includes('session') || err.message.includes('permission');

        empty.innerHTML = `
          <div class="fs-empty-icon">⚠️</div>
          <div class="fs-empty-text fs-empty-text-error">Scan Failed</div>
          <div class="fs-empty-sub fs-empty-sub-error">${escapeHtml(err.message.split('•').join('\n•'))}</div>
          ${isAuthError ? `
          <div class="fs-auth-fix">
            <strong>💡 Alternative: Let the interceptor capture the flow</strong><br>
            1. Keep this extension installed<br>
            2. <strong>Close and reopen</strong> the flow in Flow Builder<br>
            3. Wait for the flow to fully load, then click <strong>Scan Flow</strong><br>
            The extension will capture the flow data automatically as it loads.
          </div>` : ''}
        `;
      }
      if (list) list.style.display = 'none';
      togglePanel(true);
    } finally {
      scanInProgress = false;
      toggleAppleAIGlow(false);
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Scan Flow
        `;
      }
    }
  }

  // ─── Listen for messages from popup ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TRIGGER_SCAN') {
      triggerScan();
      sendResponse({ ok: true });
    }
    if (msg.type === 'GET_RESULTS') {
      sendResponse({ results: lastScanResults });
    }
    if (msg.type === 'TOGGLE_HIDE_BTN') {
      userHideFloatingBtn = !!msg.hide;
      const triggerBtn = document.getElementById('fs-trigger-btn');
      if (triggerBtn) {
        triggerBtn.style.display = (userHideFloatingBtn || panelVisible) ? 'none' : 'flex';
      }
      sendResponse({ ok: true });
    }
    return true;
  });

  // ─── URL change detection (SPA navigation) ───────────────────────────────
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Reset when navigating away from a flow
      const flowId = extractFlowIdFromUrl(url);
      if (!flowId && !url.includes('flowBuilder')) {
        lastScanResults = [];
      }
    }
  }).observe(document, { subtree: true, childList: true });

  // ─── Real-Time Auto-Scan Observer ────────────────────────────────────────
  let realtimeTimer = null;

  function setupRealtimeObserver() {
    const observer = new MutationObserver((mutations) => {
      const isEditing = mutations.some(m => {
        const t = m.target;
        if (!t) return false;
        
        // Ignore mutations caused by FlowScanner itself (adding/removing badges or UI)
        if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
            let onlyFs = true;
            const nodesToCheck = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)];
            for (const n of nodesToCheck) {
                if (n.nodeType !== 1) { 
                    onlyFs = false; 
                    break; 
                }
                const isFsClass = typeof n.className === 'string' && n.className.includes('fs-');
                const isFsId = n.id && n.id.startsWith('fs-');
                if (!isFsClass && !isFsId) {
                    onlyFs = false;
                    break;
                }
            }
            if (nodesToCheck.length > 0 && onlyFs) {
                return false;
            }
        }

        const cls = typeof t.className === 'string' ? t.className : '';
        return cls.includes('builder') || cls.includes('canvas') || cls.includes('node') || cls.includes('flow');
      });

      if (isEditing) {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
          triggerScanSilently();
        }, 2000); // 2 second debounced auto-scan after editing
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  async function triggerScanSilently() {
    if (scanInProgress) return;
    try {
      const flowInfo = detectCurrentFlow();
      if (!flowInfo) return;
      
      let flowRecord;
      if (interceptedFlowData) {
        flowRecord = interceptedFlowData;
      } else {
        flowRecord = flowInfo.type === 'id' ? await fetchFlowById(flowInfo.value) : await fetchFlowByName(flowInfo.value);
      }
      
      const flowName = flowRecord.FullName || flowRecord.DeveloperName || flowInfo.value || 'UnknownFlow';
      const { scanResults } = await runOfficialScan(flowRecord);
      const issues = formatResults(scanResults, flowName, flowRecord);
      lastScanResults = issues;

      // Update floating trigger button badge
      const badge = document.getElementById('fs-badge');
      if (badge) {
        badge.textContent = issues.length;
        badge.style.display = 'inline-flex';
        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;
        badge.className = errors > 0 ? 'fs-badge fs-badge-error' : warnings > 0 ? 'fs-badge fs-badge-warning' : 'fs-badge fs-badge-info';
      }

      // If panel is currently visible, update results in real-time
      if (panelVisible) {
        renderResults(issues, 'all');
      }
      console.debug('[FlowScanner Realtime] ⚡ Auto-scanned:', issues.length, 'issues found.');
    } catch (e) {
      // Silent error catching for real-time polling
    }
  }

  // ─── Initialize ──────────────────────────────────────────────────────────
  function init() {
    const updateVisibility = () => {
      const isFlowScreen = isFlowBuilderScreen();
      const triggerBtn = document.getElementById('fs-trigger-btn');
      const launcherBtn = document.getElementById('flow-scanner-launcher-btn');

      if (isFlowScreen) {
        if (!uiInjected) {
          injectUI();
          setupRealtimeObserver();
        }
        const showBtns = (!panelVisible && !userHideFloatingBtn);
        if (triggerBtn) triggerBtn.style.display = showBtns ? 'inline-flex' : 'none';
        if (launcherBtn) launcherBtn.style.display = showBtns ? 'inline-flex' : 'none';
      } else {
        if (triggerBtn) triggerBtn.style.display = 'none';
        if (launcherBtn) launcherBtn.style.display = 'none';
        const panel = document.getElementById('fs-panel');
        if (panel) panel.classList.remove('active');
        const backdrop = document.getElementById('fs-backdrop');
        if (backdrop) backdrop.classList.remove('active');
      }
    };

    updateVisibility();
    let lastHref = location.href;
    let lastTitle = document.title;
    const visibilityScheduled = { v: false };
    const scheduleVisibilityCheck = (delayMs = 200) => {
      if (visibilityScheduled.v) return;
      visibilityScheduled.v = true;
      setTimeout(() => {
        visibilityScheduled.v = false;
        const changed = lastHref !== location.href || lastTitle !== document.title;
        lastHref = location.href;
        lastTitle = document.title;
        if (changed) updateVisibility();
      }, delayMs);
    };

    window.addEventListener('popstate', scheduleVisibilityCheck);
    window.addEventListener('hashchange', scheduleVisibilityCheck);
    document.addEventListener('click', () => scheduleVisibilityCheck(400), true);

    let titleObserver = null;
    try {
      const titleEl = document.querySelector('title');
      if (titleEl && typeof MutationObserver !== 'undefined') {
        titleObserver = new MutationObserver(() => scheduleVisibilityCheck(150));
        titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
      }
    } catch (e) {}

    setInterval(scheduleVisibilityCheck, 5000);

    try {
      loadUserRuleSettings();

      chrome.storage.local.get(['fs_theme', 'fs_hide_floating_btn'], (res) => {
        if (res && res.fs_theme === 'dark') {
          toggleTheme(true);
        }
        if (res && res.fs_hide_floating_btn) {
          userHideFloatingBtn = true;
          updateVisibility();
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.fs_hide_floating_btn) {
          userHideFloatingBtn = Boolean(changes.fs_hide_floating_btn.newValue);
          updateVisibility();
        }
      });
    } catch (e) {}
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
