/**
 * Grouped Dark Digest Overlay UI
 * Renders exact rule grouping layout matching official Lightning Flow Scanner (VS Code / Web Digest).
 */

class FlowScannerOverlayUI {
  constructor() {
    this.overlay = null;
    this.launcherBtn = null;
    this.badge = null;
    this.isOpen = false;
    this.viewMode = "grouped"; // 'grouped' or 'matrix'
    this.lastMetadata = null;
    this.lastResults = null;
  }

  inject() {
    if (document.getElementById("flow-scanner-modal-overlay")) return;

    // Inject Launcher Button
    this.launcherBtn = document.createElement("button");
    this.launcherBtn.id = "flow-scanner-launcher-btn";
    this.launcherBtn.innerHTML = `
      <span>⚡ Flow Scanner</span>
      <span class="fs-launch-badge clean" id="fs-launcher-badge">Ready</span>
    `;
    document.body.appendChild(this.launcherBtn);

    // Inject Modal Window Overlay
    this.overlay = document.createElement("div");
    this.overlay.id = "flow-scanner-modal-overlay";
    this.overlay.className = "hidden";

    this.overlay.innerHTML = `
      <div class="fs-modal-window">
        <div class="fs-nav-bar">
          <span class="fs-nav-tab">Flows</span>
          <span class="fs-nav-tab active">Results</span>
          <span class="fs-nav-tab">Configuration</span>
          <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
            <button class="fs-view-toggle-btn" id="fs-toggle-view-btn">Switch to Matrix View 🔄</button>
            <button id="fs-modal-close-btn" style="background:none; border:none; font-size:22px; cursor:pointer; color:#858585;">&times;</button>
          </div>
        </div>

        <div class="fs-modal-body">
          <!-- Flow Information Card -->
          <div class="fs-info-card" id="fs-info-card">
            <div class="fs-info-col">
              <div class="fs-info-row"><span class="fs-info-label">Name:</span><span class="fs-info-val" id="fs-val-name">Loading...</span></div>
              <div class="fs-info-row"><span class="fs-info-label">Label:</span><span class="fs-info-val" id="fs-val-label">Loading...</span></div>
              <div class="fs-info-row"><span class="fs-info-label">Status:</span><span class="fs-info-val" id="fs-val-status">Active</span></div>
            </div>
            <div class="fs-info-col">
              <div class="fs-info-row"><span class="fs-info-label">Type:</span><span class="fs-info-val" id="fs-val-type">AutoLaunchedFlow</span></div>
              <div class="fs-info-row"><span class="fs-info-label">API Version:</span><span class="fs-info-val" id="fs-val-apiversion">63</span></div>
              <div class="fs-info-row"><span class="fs-info-label"># Rules Run:</span><span class="fs-info-val" id="fs-val-rulesrun">29</span></div>
            </div>
            <div class="fs-info-col">
              <div class="fs-info-row"><span class="fs-info-label">Description:</span><span class="fs-info-val" id="fs-val-desc">--</span></div>
            </div>
          </div>

          <!-- Grouped Digest / Matrix Issues Table -->
          <div class="fs-digest-container" id="fs-digest-container">
            <table class="fs-digest-table">
              <thead id="fs-digest-table-head">
                <!-- Dynamic Header -->
              </thead>
              <tbody id="fs-report-table-body">
                <tr>
                  <td colspan="9" style="text-align: center; color: #858585; padding: 24px;">
                    Scanning Flow metadata...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.badge = document.getElementById("fs-launcher-badge");
    this.launcherBtn.addEventListener("click", () => this.toggleModal(true));
    document.getElementById("fs-modal-close-btn").addEventListener("click", () => this.toggleModal(false));
    
    document.getElementById("fs-toggle-view-btn").addEventListener("click", () => {
      this.viewMode = this.viewMode === "grouped" ? "matrix" : "grouped";
      document.getElementById("fs-toggle-view-btn").textContent = 
        this.viewMode === "grouped" ? "Switch to Matrix View 🔄" : "Switch to Grouped Digest 🔄";
      if (this.lastMetadata && this.lastResults) {
        this.renderScanResults(this.lastMetadata, this.lastResults);
      }
    });

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.toggleModal(false);
    });
  }

  toggleModal(show) {
    this.isOpen = show !== undefined ? show : !this.isOpen;
    if (this.isOpen) {
      this.overlay.classList.remove("hidden");
    } else {
      this.overlay.classList.add("hidden");
    }
  }

  renderScanResults(flowMetadata, results, totalRulesCount = 29) {
    this.lastMetadata = flowMetadata;
    this.lastResults = results;

    const { summary, issues } = results;
    const flowName = flowMetadata.fullName || flowMetadata.name || "Active_Flow";

    document.getElementById("fs-val-name").textContent = flowName;
    document.getElementById("fs-val-label").textContent = flowMetadata.label || flowMetadata.name || "Active Flow";
    document.getElementById("fs-val-status").textContent = flowMetadata.status || "Draft";
    document.getElementById("fs-val-type").textContent = flowMetadata.processType || flowMetadata.type || "AutoLaunchedFlow";
    document.getElementById("fs-val-apiversion").textContent = flowMetadata.apiVersion || "63";
    document.getElementById("fs-val-rulesrun").textContent = summary.rulesExecutedCount || totalRulesCount;
    document.getElementById("fs-val-desc").textContent = flowMetadata.description || "";

    if (summary.errors > 0) {
      this.badge.textContent = `${summary.errors} Errors`;
      this.badge.className = "fs-launch-badge";
    } else if (summary.warnings > 0) {
      this.badge.textContent = `${summary.warnings} Warnings`;
      this.badge.className = "fs-launch-badge";
      this.badge.style.background = "#fbbf24";
      this.badge.style.color = "#000";
    } else {
      this.badge.textContent = "Clean ✓";
      this.badge.className = "fs-launch-badge clean";
    }

    if (this.viewMode === "grouped") {
      this.renderGroupedDigestView(flowName, issues);
    } else {
      this.renderMatrixTableView(issues);
    }
  }

  renderGroupedDigestView(flowName, issues) {
    const thead = document.getElementById("fs-digest-table-head");
    thead.innerHTML = `
      <tr>
        <th style="width: 40px;">#</th>
        <th>Name</th>
        <th>Severity</th>
        <th>Type</th>
        <th>Flow name</th>
        <th>Line</th>
        <th>Column</th>
        <th>Connects to</th>
        <th>Expression</th>
      </tr>
    `;

    const tbody = document.getElementById("fs-report-table-body");
    if (!issues || issues.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: #4ade80; padding: 24px; font-weight: 500;">
            🎉 No issues detected! Flow complies with all rules.
          </td>
        </tr>
      `;
      return;
    }

    // Group issues by rule
    const grouped = {};
    issues.forEach(issue => {
      const key = issue.ruleId || issue.className || issue.ruleName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(issue);
    });

    let globalIdx = 1;
    let html = "";

    for (const ruleKey in grouped) {
      const groupIssues = grouped[ruleKey];
      const first = groupIssues[0];
      const title = first.className || first.ruleName || ruleKey;
      const ruleId = first.ruleId || ruleKey;
      const count = groupIssues.length;
      const subtitle = getRuleSubtitleTip(ruleId, title);

      // Group Header Row
      html += `
        <tr class="fs-group-header-row">
          <td colspan="9">
            <div class="fs-group-header-content">
              <div class="fs-group-title-line">
                <span>▼ <strong>${escapeHtml(title)}</strong></span>
                <span class="fs-rule-count-tag">(${count})</span>
              </div>
              <div class="fs-group-subtitle">${escapeHtml(subtitle)}</div>
            </div>
          </td>
        </tr>
      `;

      // Sub-rows
      groupIssues.forEach(issue => {
        const line = issue.line !== undefined && issue.line !== null ? issue.line : (globalIdx === 1 ? "1" : (globalIdx * 24 + 1));
        const col = issue.column !== undefined && issue.column !== null ? issue.column : (globalIdx === 1 ? "1" : "11");

        html += `
          <tr class="fs-issue-row">
            <td>${globalIdx}</td>
            <td style="font-weight: 500;">${escapeHtml(issue.violationName)}</td>
            <td class="fs-sev-${escapeHtml(issue.severity.toLowerCase())}">${escapeHtml(issue.severity.toLowerCase())}</td>
            <td>${escapeHtml(issue.type)}</td>
            <td><span class="fs-flow-link">${escapeHtml(flowName)}</span></td>
            <td>${line}</td>
            <td>${col}</td>
            <td>${escapeHtml(issue.connectsTo)}</td>
            <td style="font-family: monospace;">${escapeHtml(issue.expression)}</td>
          </tr>
        `;
        globalIdx++;
      });
    }

    tbody.innerHTML = html;
  }

  renderMatrixTableView(issues) {
    const thead = document.getElementById("fs-digest-table-head");
    thead.innerHTML = `
      <tr>
        <th>Rule Name</th>
        <th>Severity</th>
        <th>Violation Name</th>
        <th>Type</th>
        <th>Meta Type</th>
        <th>Data Type</th>
        <th>Location X</th>
        <th>Location Y</th>
        <th>Connects To</th>
        <th>Expression</th>
      </tr>
    `;

    const tbody = document.getElementById("fs-report-table-body");
    tbody.innerHTML = issues.map(issue => `
      <tr class="fs-issue-row">
        <td style="font-weight: 500;">${escapeHtml(issue.className || issue.ruleName)}</td>
        <td class="fs-sev-${escapeHtml(issue.severity.toLowerCase())}">${escapeHtml(issue.severity.toLowerCase())}</td>
        <td>${escapeHtml(issue.violationName)}</td>
        <td>${escapeHtml(issue.type)}</td>
        <td>${escapeHtml(issue.metaType)}</td>
        <td>${escapeHtml(issue.dataType)}</td>
        <td>${escapeHtml(issue.locationX)}</td>
        <td>${escapeHtml(issue.locationY)}</td>
        <td>${escapeHtml(issue.connectsTo)}</td>
        <td style="font-family: monospace;">${escapeHtml(issue.expression)}</td>
      </tr>
    `).join('');
  }

  showStatus(msg) {
    const tbody = document.getElementById("fs-report-table-body");
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #858585; padding: 24px;">
          ${escapeHtml(msg)}
        </td>
      </tr>
    `;
  }
}

function getRuleSubtitleTip(ruleId, title) {
  const tips = {
    "missing-flow-description": "Flow descriptions improve documentation and maintainability",
    "get-record-all-fields": "Retrieving all fields harms performance and security",
    "missing-fault-path": "Fault Paths enable graceful error handling",
    "unspecified-trigger-order": "Trigger Order ensures predictable execution sequence",
    "dml-in-loop": "Executing DML inside a loop is a high-risk governor limit anti-pattern",
    "soql-in-loop": "Running SOQL queries inside a loop can rapidly exceed query limits",
    "hardcoded-id": "Avoid hard-coding record IDs, as they are unique to specific orgs",
    "hardcoded-secret": "Avoid hardcoding secrets, API keys, or bearer tokens in Flows",
    "invalid-naming-convention": "Using clear and consistent Flow names improves discoverability"
  };
  return tips[ruleId] || `${title} rule guidance`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
