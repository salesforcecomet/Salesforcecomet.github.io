(function () {
    let isMonacoReady = false;
    let pendingDeferredFileOpen = null;

    let editorInstance = null;
    let rightEditorInstance = null;
    let diffEditorInstance = null;

    let isDiffMode = false;
    let isSplitView = false;

    let currentFiles = {}; // { 'myLwc.js': { id: '...', content: '...', language: 'javascript' } }
    let openTabPaths = []; // ['myLwc.js', 'myLwc.html', 'myLwc.css']
    let activeFilePath = null;
    let rightActiveFilePath = null;
    let currentBundleInfo = { id: null, name: null, type: null };
    let draggedTabIndex = null;

    // Delete Modal Pending State
    let pendingDeleteTarget = { id: null, name: null, type: null };

    // Find & Replace State
    let findState = {
        isCaseSensitive: false,
        isWholeWord: false,
        isRegex: false
    };

    // Expanded Org Metadata Explorer State
    let orgMetadata = {
        apexClasses: [],
        apexTriggers: [],
        lwcBundles: [],
        auraBundles: [],
        lmsChannels: [],
        agentforceTypes: [],
        vfPages: [],
        vfComponents: []
    };
    let expandedFolders = new Set(['folder-lwc']); // Folders currently open

    // Get URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    // Every editor tab is bound to ONE org via its ?host= pin. Session state
    // (open tabs / files / active file) must be scoped per org — extension
    // pages share chrome.storage, so a shared key would restore another
    // org's classes into this editor.
    const editorOrgHost = (urlParams.get('host') || urlParams.get('instance') || '').toLowerCase();
    const sessionStateKey = 'sfarc_editor_session_state' + (editorOrgHost ? '_' + editorOrgHost : '');
    const paramBundleId = urlParams.get('bundleId');
    const paramBundleName = urlParams.get('bundleName');
    const paramApexId = urlParams.get('apexId');
    const paramApexName = urlParams.get('apexName');
    const paramTriggerId = urlParams.get('triggerId');
    const paramTriggerName = urlParams.get('triggerName');
    const paramPageId = urlParams.get('pageId');
    const paramPageName = urlParams.get('pageName');
    const paramOpenTool = urlParams.get('openTool');

    // Editor welcome screen quick actions
    const welcomeExplorer = document.getElementById('welcome-explorer');
    const welcomeSearch = document.getElementById('welcome-search');
    const welcomeNewFile = document.getElementById('welcome-new-file');
    if (welcomeExplorer) {
        welcomeExplorer.addEventListener('click', () => {
            const actExplorer = document.getElementById('act-btn-explorer');
            if (actExplorer) actExplorer.click();
        });
    }
    if (welcomeSearch) {
        welcomeSearch.addEventListener('click', () => {
            const actFindOrg = document.getElementById('act-btn-find-org');
            if (actFindOrg) actFindOrg.click();
        });
    }
    if (welcomeNewFile) {
        welcomeNewFile.addEventListener('click', () => {
            const btnAddFile = document.getElementById('btn-add-file');
            const actExplorer = document.getElementById('act-btn-explorer');
            if (btnAddFile) btnAddFile.click();
            if (actExplorer) actExplorer.click();
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function cleanErrorMessage(msg) {
        if (!msg || typeof msg !== 'string') return msg || '';
        let clean = msg;

        // 1. Strip prefix prefixes
        clean = clean.replace(/^(Creation Failed|Save Failed|Error creating asset|Error saving file|Error):\s*/i, '');

        // 2. Strip 'Salesforce API Error: 400 - ' or 'Salesforce API Error: 400' or 'Salesforce API Error:'
        clean = clean.replace(/Salesforce API Error:\s*\d*\s*[^-\n:]*[-:]*\s*/gi, '');

        // 3. Strip 'Compilation Failure /c/.../...:0,0 :' or 'Compilation Failure ... :'
        clean = clean.replace(/Compilation Failure\s+[^:]+:\d+,\d+\s*:\s*/gi, '');
        clean = clean.replace(/Compilation Failure\s+[^:]+:\s*/gi, '');
        clean = clean.replace(/Compilation Failure:\s*/gi, '');

        // 4. Strip file path markers like '/c/Tttytu/Tttytu.js:0,0 :' or 'lwc/Tttytu/Tttytu.js:0,0 :'
        clean = clean.replace(/\/[a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+:\d+,\d+\s*:\s*/gi, '');

        // 5. Strip error codes like 'LWC1116:' or 'LWC1001:' or 'APEX_001:'
        clean = clean.replace(/\b[A-Z]{2,6}\d{3,6}:\s*/gi, '');

        // 6. Clean leading or trailing colons, hyphens, and whitespace
        clean = clean.replace(/^[:\s-]+/, '').trim();

        return clean || msg;
    }

    function updateHeaderContextButtons() {
        const hdrRunTests = document.getElementById('hdr-btn-run-tests');
        const hdrSecurity = document.getElementById('hdr-btn-security');
        const hdrExecApex = document.getElementById('hdr-btn-exec-apex');
        const actRunTests = document.getElementById('act-btn-run-tests');
        const actSecurity = document.getElementById('act-btn-security');
        const btnAddFile = document.getElementById('btn-add-file');
        const tabCoverage = document.getElementById('terminal-tab-coverage');
        const tabSecurity = document.getElementById('terminal-tab-security');
        const btnDownloadFile = document.getElementById('btn-download-file');

        const isApex = currentBundleInfo.type === 'apex' || (activeFilePath && (activeFilePath.endsWith('.cls') || activeFilePath.endsWith('.trigger')));
        const isLwc = currentBundleInfo.type === 'lwc';
        const hasFile = activeFilePath && currentFiles[activeFilePath];

        if (hdrRunTests) hdrRunTests.style.display = isApex ? 'inline-flex' : 'none';
        if (hdrSecurity) hdrSecurity.style.display = isApex ? 'inline-flex' : 'none';
        if (hdrExecApex) hdrExecApex.style.display = isApex ? 'inline-flex' : 'none';
        if (btnDownloadFile) btnDownloadFile.style.display = hasFile ? 'inline-flex' : 'none';

        if (actRunTests) actRunTests.style.display = isApex ? 'flex' : 'none';
        if (actSecurity) actSecurity.style.display = isApex ? 'flex' : 'none';
        if (btnAddFile) btnAddFile.style.display = isLwc ? 'inline-flex' : 'none';
        if (tabCoverage) tabCoverage.style.display = isApex ? 'inline-flex' : 'none';
        if (tabSecurity) tabSecurity.style.display = isApex ? 'inline-flex' : 'none';
    }

    function updateStatusOrgDomain() {
        const domainSpan = document.getElementById('status-org-domain');
        const urlPill = document.getElementById('status-org-url');
        if (!domainSpan) return;

        let host = urlParams.get('host') || urlParams.get('instance') || '';

        if (!host && window.sfApi) {
            if (window.sfApi.hostname) host = window.sfApi.hostname;
            else if (window.sfApi.domain) host = window.sfApi.domain;
            else if (window.sfApi.instanceUrl) {
                try {
                    host = new URL(window.sfApi.instanceUrl).hostname;
                } catch (e) {
                    host = window.sfApi.instanceUrl;
                }
            }
        }

        if (!host && window.location.host && !window.location.host.startsWith('chrome-extension')) {
            host = window.location.host;
        }

        if (host) {
            domainSpan.innerText = host;
            if (urlPill) {
                urlPill.title = `Connected Org: https://${host} (Click to Open Org Setup)`;
                urlPill.onclick = () => {
                    const targetUrl = host.startsWith('http') ? host : `https://${host}`;
                    window.open(targetUrl, '_blank');
                };
            }
        } else {
            domainSpan.innerText = 'Salesforce Org';
        }
    }

    // DSA Optimization: High-Performance LRU & TTL Salesforce Tooling API Cache Map
    class SmartTtlCache {
        constructor(maxSize = 300, ttlMs = 300000) { // 5-minute TTL, 300 max items
            this.cache = new Map();
            this.maxSize = maxSize;
            this.ttlMs = ttlMs;
        }

        get(key) {
            if (!this.cache.has(key)) return null;
            const entry = this.cache.get(key);
            if (Date.now() - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
                return null;
            }
            // LRU Eviction Order Refresh
            this.cache.delete(key);
            this.cache.set(key, entry);
            return entry.data;
        }

        set(key, data) {
            if (this.cache.has(key)) this.cache.delete(key);
            else if (this.cache.size >= this.maxSize) {
                // LRU Eviction: Remove oldest accessed entry
                const oldestKey = this.cache.keys().next().value;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            this.cache.set(key, { timestamp: Date.now(), data });
        }

        delete(key) {
            this.cache.delete(key);
        }

        clear() {
            this.cache.clear();
        }
    }

    const sfQueryCache = new SmartTtlCache(300, 300000);
    const inFlightQueryMap = new Map(); // Request Coalescing Promise Map

    async function cachedSfApiQuery(soql, isTooling = true, forceRefresh = false) {
        if (!window.sfApi) throw new Error('Salesforce API session unavailable.');

        const cacheKey = `${isTooling ? 'tooling:' : 'data:'}${soql}`;

        // 1. Check for concurrent in-flight promise (Request Coalescing algorithm)
        if (!forceRefresh && inFlightQueryMap.has(cacheKey)) {
            return inFlightQueryMap.get(cacheKey);
        }

        // 2. Check LRU/TTL Memory Cache
        if (!forceRefresh) {
            const cachedData = sfQueryCache.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        // 3. Dispatch & Store In-Flight Promise
        const requestPromise = (async () => {
            try {
                const res = await window.sfApi.query(soql, isTooling);
                if (res && res.records) {
                    sfQueryCache.set(cacheKey, res);
                }
                return res;
            } finally {
                inFlightQueryMap.delete(cacheKey);
            }
        })();

        inFlightQueryMap.set(cacheKey, requestPromise);
        return requestPromise;
    }

    function invalidateOrgMetadataCache() {
        sfQueryCache.clear();
        inFlightQueryMap.clear();
    }

    async function initSession() {
        if (window.sfApi) {
            try {
                if (!window.sfApi.sessionId) await window.sfApi.init();
                window.sfApi.rest = sfApiRest;
                updateStatusOrgDomain();
            } catch (e) {
                console.error('Session init error:', e);
            }
        }
        updateStatusOrgDomain();
    }

    async function sfApiRest(url, options = {}) {
        if (!window.sfApi) throw new Error('Salesforce API session unavailable.');

        const res = await window.sfApi.fetch(url, options);
        if (!res) throw new Error('No response received from Salesforce API.');

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            let errMsg = `Salesforce API Error: ${res.status} - ${res.statusText || 'Request failed'}`;
            try {
                const errJson = JSON.parse(text);
                if (Array.isArray(errJson) && errJson[0]) {
                    errMsg = errJson[0].message || errJson[0].errorCode || errMsg;
                } else if (errJson.message) {
                    errMsg = errJson.message;
                }
            } catch (e) { }
            throw new Error(errMsg);
        }

        const text = await res.text().catch(() => '');
        if (!text || text.trim() === '') return {};
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    }

    let statusResetTimer = null;
    function setStatus(msg, isError = false) {
        const el = document.getElementById('status-message');
        if (!el) return;
        el.className = isError ? 'status-msg-error' : '';
        el.innerHTML = isError
            ? `<i class="fa-solid fa-circle-exclamation" style="margin-right: 5px;"></i><span>${escapeHtml(msg)}</span>`
            : `<span>${escapeHtml(msg)}</span>`;
        el.style.color = isError ? '#ffb4ab' : '#ffffff';
        el.title = msg;
        if (isError) {
            // Auto-dismiss transient errors so the status bar returns to Ready.
            if (statusResetTimer) clearTimeout(statusResetTimer);
            statusResetTimer = setTimeout(() => {
                setStatus('Ready.');
            }, 10000);
        }
    }

    function logToTerminal(message, type = 'info') {
        const outputBody = document.getElementById('terminal-body-output');
        if (!outputBody) return;

        const timeStr = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-circle-check';
        else if (type === 'warn') icon = 'fa-triangle-exclamation';
        else if (type === 'error') icon = 'fa-circle-xmark';

        entry.innerHTML = `
            <span class="log-timestamp">[${timeStr}]</span>
            <i class="fa-solid ${icon}" style="font-size: 11px; margin-top: 3px;"></i>
            <span>${escapeHtml(message)}</span>
        `;

        outputBody.appendChild(entry);
        // Cap terminal history so long sessions (live tailer polls every 3s,
        // live-debug captures) never grow the DOM without bound.
        while (outputBody.childElementCount > 500) {
            outputBody.removeChild(outputBody.firstChild);
        }
        outputBody.scrollTop = outputBody.scrollHeight;
    }

    function problemSeverity(text) {
        if (/\b(error|exception|failure)\b/i.test(text)) return 'error';
        if (/\b(warn(ing)?)\b/i.test(text)) return 'warning';
        return 'info';
    }

    function updateProblemsSummary() {
        const problemsBody = document.getElementById('terminal-body-problems');
        if (!problemsBody) return;
        let summary = document.getElementById('problems-summary');
        const items = problemsBody.querySelectorAll('.problem-item');
        const counts = { error: 0, warning: 0, info: 0 };
        items.forEach(i => {
            const sev = i.classList.contains('warning') ? 'warning' : i.classList.contains('info') ? 'info' : 'error';
            counts[sev]++;
        });
        if (items.length === 0) {
            if (summary) summary.remove();
            return;
        }
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'problems-summary';
            problemsBody.insertBefore(summary, problemsBody.firstChild);
        }
        summary.innerHTML = `
            <span class="pi-sum-title"><i class="fa-solid fa-list-check"></i> Problems</span>
            <span class="pi-sum-chip error"><b>${counts.error}</b> error${counts.error === 1 ? '' : 's'}</span>
            <span class="pi-sum-chip warning"><b>${counts.warning}</b> warning${counts.warning === 1 ? '' : 's'}</span>
            <span class="pi-sum-chip info"><b>${counts.info}</b> info</span>
            <button id="problems-clear-btn" class="pi-clear" title="Clear all problems"><i class="fa-solid fa-broom"></i> Clear</button>
        `;
        const clearBtn = summary.querySelector('#problems-clear-btn');
        if (clearBtn && !clearBtn.dataset.bound) {
            clearBtn.dataset.bound = '1';
            clearBtn.addEventListener('click', clearAllProblems);
        }
    }

    function clearAllProblems() {
        const problemsBody = document.getElementById('terminal-body-problems');
        const badge = document.getElementById('problems-count');
        if (!problemsBody) return;
        problemsBody.innerHTML = '<div style="color: #64748b; font-style: italic;">No compilation problems detected.</div>';
        Object.keys(currentFiles).forEach(f => {
            if (currentFiles[f]) currentFiles[f].hasError = false;
        });
        renderTabs();
        if (badge) {
            badge.innerText = '0';
            badge.style.display = 'none';
        }
    }

    function addProblemDiagnostic(fileName, line, column, errorText) {
        const cleanedText = cleanErrorMessage(errorText);
        if (currentFiles[fileName]) {
            currentFiles[fileName].hasError = true;
            renderTabs();
        }

        const problemsBody = document.getElementById('terminal-body-problems');
        const badge = document.getElementById('problems-count');
        if (!problemsBody) return;

        if (problemsBody.children.length === 1 && problemsBody.children[0].innerText.includes('No compilation problems')) {
            problemsBody.innerHTML = '';
        }

        // Deduplication check to prevent duplicate problem entries
        const cleanErr = (cleanedText || '').trim();
        const existingItems = Array.from(problemsBody.querySelectorAll('.problem-item'));
        const isDuplicate = existingItems.some(el => el.innerText.includes(cleanErr));
        if (isDuplicate) return;

        const sev = problemSeverity(cleanErr || '');

        // Build the Problems table lazily on the first entry.
        let table = problemsBody.querySelector('table.pi-table');
        if (!table) {
            const wrap = document.createElement('div');
            wrap.className = 'pi-table-wrap';
            wrap.innerHTML = `
                <table class="pi-table">
                    <thead>
                        <tr>
                            <th class="pi-th-sev"></th>
                            <th class="pi-th-file">File</th>
                            <th class="pi-th-pos">Line</th>
                            <th class="pi-th-msg">Message</th>
                            <th class="pi-th-action"></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>`;
            problemsBody.appendChild(wrap);
            table = wrap.querySelector('table.pi-table');
        }
        const tbody = table.querySelector('tbody');

        const item = document.createElement('tr');
        item.className = `problem-item ${sev}`;
        item.innerHTML = `
            <td class="pi-sev"><i class="fa-solid ${sev === 'error' ? 'fa-circle-xmark' : sev === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i></td>
            <td class="pi-file" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</td>
            <td class="pi-pos">L${parseInt(line, 10)}:${parseInt(column, 10)}</td>
            <td class="pi-msg">${escapeHtml(cleanErr)}</td>
            <td class="pi-action"><button class="pi-jump" title="Jump to line"><i class="fa-solid fa-arrow-right-to-bracket"></i> Jump to Line</button></td>
        `;
        tbody.appendChild(item);

        item.onclick = () => {
            // Jump to the problem's file (opening it if needed), then reveal the line.
            const doReveal = () => {
                if (editorInstance && activeFilePath === fileName) {
                    editorInstance.revealPositionInCenter({ lineNumber: parseInt(line), column: parseInt(column) });
                    editorInstance.setPosition({ lineNumber: parseInt(line), column: parseInt(column) });
                    editorInstance.focus();
                }
            };
            if (currentFiles[fileName] && activeFilePath !== fileName) {
                openFileInEditor(fileName);
                setTimeout(doReveal, 80);
            } else {
                doReveal();
            }
        };
        const jumpBtn = item.querySelector('.pi-jump');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                item.onclick();
            });
        }

        // NOTE: the row is already inside the table's <tbody> above — appending
        // it to problemsBody here would MOVE it out of the table, leaving the
        // table header with an empty body and the problems listed below it.
        updateProblemsSummary();

        const totalProblems = problemsBody.querySelectorAll('.problem-item').length;
        if (badge) {
            badge.innerText = totalProblems;
            badge.style.display = totalProblems > 0 ? 'inline-block' : 'none';
        }

        showTerminalTab('problems');
    }

    function clearTerminal() {
        const outputBody = document.getElementById('terminal-body-output');
        const problemsBody = document.getElementById('terminal-body-problems');
        const coverageBody = document.getElementById('terminal-body-coverage');
        const securityBody = document.getElementById('terminal-body-security');
        const logsContainer = document.getElementById('live-logs-container');
        const badge = document.getElementById('problems-count');

        if (outputBody) outputBody.innerHTML = '';
        if (logsContainer) logsContainer.innerHTML = '<div style="color: #64748b; font-style: italic;">Listening for incoming Org debug logs... Execute Apex or trigger any Org event (Flow, Trigger, API) to view live variable outputs here.</div>';
        if (problemsBody) problemsBody.innerHTML = '<div style="color: #64748b; font-style: italic;">No compilation problems detected.</div>';
        if (coverageBody) coverageBody.innerHTML = '<div style="color: #64748b; font-style: italic;">Run Apex Tests to view code coverage breakdown.</div>';
        if (securityBody) securityBody.innerHTML = '<div style="color: #64748b; font-style: italic;">Click "Analyze Security" to scan active Apex class for anti-patterns and vulnerabilities.</div>';
        if (badge) {
            badge.innerText = '0';
            badge.style.display = 'none';
        }
    }

    function showTerminalTab(tabName) {
        const termPanel = document.getElementById('terminal-panel');
        if (termPanel && termPanel.classList.contains('collapsed')) {
            termPanel.classList.remove('collapsed');
            const btnToggleTerm = document.getElementById('btn-toggle-terminal');
            if (btnToggleTerm) {
                const iconDown = btnToggleTerm.querySelector('.icon-down');
                const iconUp = btnToggleTerm.querySelector('.icon-up');
                if (iconDown && iconUp) {
                    iconDown.style.display = 'block';
                    iconUp.style.display = 'none';
                } else {
                    btnToggleTerm.className = 'fa-solid fa-chevron-down term-control-btn';
                }
                btnToggleTerm.title = 'Collapse Terminal';
            }
            if (editorInstance) editorInstance.layout();
        }

        const tabLogs = document.getElementById('terminal-tab-logs');
        const tabOutput = document.getElementById('terminal-tab-output');
        const tabProblems = document.getElementById('terminal-tab-problems');
        const tabCoverage = document.getElementById('terminal-tab-coverage');
        const tabRevisions = document.getElementById('terminal-tab-revisions');
        const tabSecurity = document.getElementById('terminal-tab-security');

        const bodyLogs = document.getElementById('terminal-body-logs');
        const bodyOutput = document.getElementById('terminal-body-output');
        const bodyProblems = document.getElementById('terminal-body-problems');
        const bodyCoverage = document.getElementById('terminal-body-coverage');
        const bodyRevisions = document.getElementById('terminal-body-revisions');
        const bodySecurity = document.getElementById('terminal-body-security');

        // Showing a hidden body (display: none -> flex) restarts every CSS
        // entrance animation on its children, replaying a wave of slide-ins
        // each time you switch tabs. Suppress animations for this frame so
        // only genuinely NEW items (appended later) animate.
        const suppressAnim = (body) => {
            if (!body) return;
            body.classList.add('term-anim-suppress');
            requestAnimationFrame(() => requestAnimationFrame(() => {
                body.classList.remove('term-anim-suppress');
            }));
        };

        [tabLogs, tabOutput, tabProblems, tabCoverage, tabRevisions, tabSecurity].forEach(t => t && t.classList.remove('active'));
        [bodyLogs, bodyOutput, bodyProblems, bodyCoverage, bodyRevisions, bodySecurity].forEach(b => b && (b.style.display = 'none'));

        if (tabName === 'logs') {
            if (tabLogs) tabLogs.classList.add('active');
            suppressAnim(bodyLogs);
            if (bodyLogs) bodyLogs.style.display = 'flex';
        } else if (tabName === 'output') {
            if (tabOutput) tabOutput.classList.add('active');
            suppressAnim(bodyOutput);
            if (bodyOutput) bodyOutput.style.display = 'flex';
        } else if (tabName === 'problems') {
            if (tabProblems) tabProblems.classList.add('active');
            suppressAnim(bodyProblems);
            if (bodyProblems) bodyProblems.style.display = 'flex';
        } else if (tabName === 'coverage') {
            if (tabCoverage) tabCoverage.classList.add('active');
            suppressAnim(bodyCoverage);
            if (bodyCoverage) bodyCoverage.style.display = 'flex';
        } else if (tabName === 'revisions') {
            if (tabRevisions) tabRevisions.classList.add('active');
            suppressAnim(bodyRevisions);
            if (bodyRevisions) bodyRevisions.style.display = 'flex';
            renderRevisionHistory();
        } else if (tabName === 'security') {
            if (tabSecurity) tabSecurity.classList.add('active');
            suppressAnim(bodySecurity);
            if (bodySecurity) bodySecurity.style.display = 'flex';
            if (typeof analyzeApexSecurity === 'function') {
                analyzeApexSecurity();
            }
        }
    }
    window.showTerminalTab = showTerminalTab;

    let isLogTailerActive = false;
    let lastSeenLogId = null;
    let logTailerIntervalId = null;
    let logTailerGeneration = 0;
    let logPollInFlight = false;

    // Theme-aware red: #f87171 (light red) washes out on white, so light mode
    // uses the darker red-700 (#b91c1c) for badges / status text.
    function isLightMode() {
        const el = document.body;
        return !!(el && el.getAttribute && el.getAttribute('data-theme') === 'sfarc-light');
    }
    function dangerColor() {
        return isLightMode() ? '#b91c1c' : '#f87171';
    }
    function dangerSoftBg() {
        return isLightMode() ? 'rgba(185, 28, 28, 0.14)' : 'rgba(248, 113, 113, 0.3)';
    }

    function toggleLogTailer() {
        isLogTailerActive = !isLogTailerActive;
        logTailerGeneration++;
        const btn = document.getElementById('btn-toggle-log-tailer');
        const badge = document.getElementById('logs-badge');
        if (btn) {
            btn.innerHTML = isLogTailerActive ? `<i class="fa-solid fa-tower-broadcast"></i> Tailer: ON` : `<i class="fa-solid fa-power-off"></i> Tailer: OFF`;
            btn.style.background = isLogTailerActive ? 'rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.2)' : 'rgba(239, 68, 68, 0.2)';
            btn.style.color = isLogTailerActive ? 'var(--sfarc-accent-glow, #38bdf8)' : dangerColor();
        }
        if (badge) badge.style.display = isLogTailerActive ? 'inline-block' : 'none';

        if (isLogTailerActive && !logTailerIntervalId) {
            // Re-read the latest real log when enabling after an OFF period;
            // the inline cache is intentionally cleared while disabled.
            lastSeenLogId = null;
            updateMonacoInlineVariableDecorations();
            pollLatestDebugLogs();
            logTailerIntervalId = setInterval(pollLatestDebugLogs, 3000);
        } else if (!isLogTailerActive && logTailerIntervalId) {
            clearInterval(logTailerIntervalId);
            logTailerIntervalId = null;
        }

        if (!isLogTailerActive) {
            if (editorInstance) {
                activeDecorations = editorInstance.deltaDecorations(activeDecorations, []);
            }
            liveCapturedVariablesByClass = {};
        }
    }

    async function pollLatestDebugLogs(force = false) {
        if ((!isLogTailerActive && !force) || !window.sfApi || (!force && document.hidden)) return;
        // setInterval must not start another Tooling API request while a slow
        // request is still running. This also prevents out-of-order log bodies.
        if (logPollInFlight) return;
        logPollInFlight = true;
        const pollGeneration = logTailerGeneration;
        const btnRefreshLogsManual = document.getElementById('btn-refresh-logs-manual');
        let iconEl = null;
        if (btnRefreshLogsManual) {
            iconEl = btnRefreshLogsManual.querySelector('.fa-rotate');
            if (iconEl) iconEl.classList.add('fa-spin');
        }
        try {
            const res = await cachedSfApiQuery(`SELECT Id, LogLength, Operation, Request, Status, DurationMilliseconds, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT 1`, true, true);
            if (!res || !res.records || !res.records[0]) return;

            const latestLog = res.records[0];
            if (latestLog.Id !== lastSeenLogId) {
                lastSeenLogId = latestLog.Id;
                await processApexLogBody(latestLog, pollGeneration, force);
            }
        } catch (e) {
        } finally {
            logPollInFlight = false;
            if (iconEl) {
                // Keep spinning for at least 600ms to ensure the animation is visible and satisfying
                setTimeout(() => {
                    iconEl.classList.remove('fa-spin');
                }, 600);
            }
        }
    }

    async function processApexLogBody(logHeader, pollGeneration = logTailerGeneration, force = false) {
        try {
            const endpoint = `/services/data/v60.0/tooling/sobjects/ApexLog/${logHeader.Id}/Body`;
            const logText = await sfApiRest(endpoint, { method: 'GET' });

            if (typeof logText !== 'string' || !logText) return;

            // A poll that began while Tailer was ON may finish after the user
            // switches it OFF. It may still populate the log panel when forced,
            // but it must never restore inline values or green highlights.
            const canCaptureInline = isLogTailerActive && pollGeneration === logTailerGeneration;
            if (!canCaptureInline && !force) return;

            const container = document.getElementById('live-logs-container');
            if (!container) return;

            const lines = logText.split('\n');
            const variables = [];
            const debugMessages = [];
            const exceptions = [];

            // Track which class each log event belongs to (METHOD_ENTRY/METHOD_EXIT
            // stack — same approach the Log Viewer uses), so inline decorations are
            // attributed to the class that actually executed instead of matching the
            // previous class's line numbers on whatever file is open now.
            let currentClass = 'AnonymousApex';
            let codeUnitClass = 'AnonymousApex';
            const classCallStack = [];

            const classFromMethodSignature = (parts) => {
                // Standard Apex logs are METHOD_ENTRY|[line]|id|Class.method().
                // Using parts[3] reads the Salesforce id, not the signature.
                const signature = [...parts].reverse().find(part => /[.(]/.test(part) && !/^\[/.test(part));
                if (!signature) return null;
                const beforeArgs = signature.replace(/\(.*/, '').trim();
                const segments = beforeArgs.split('.').filter(Boolean);
                return segments.length >= 2 ? segments[segments.length - 2] : null;
            };

            const classFromCodeUnit = (parts) => {
                const raw = (parts[parts.length - 1] || '').trim();
                if (!raw || raw.startsWith('[')) return null;
                // Handles "MyClass", "MyClass.myMethod", and
                // "MyTrigger on Account trigger event BeforeInsert".
                const token = raw.split(/\s+on\s+|\s+/)[0];
                const segments = token.split('.').filter(Boolean);
                return segments[segments.length - 1] || null;
            };

            lines.forEach(line => {
                const parts = line.split('|');
                if (line.includes('|CODE_UNIT_STARTED|')) {
                    codeUnitClass = classFromCodeUnit(parts) || codeUnitClass;
                    currentClass = codeUnitClass;
                    classCallStack.length = 0;
                } else if (line.includes('|CODE_UNIT_FINISHED|')) {
                    classCallStack.length = 0;
                    codeUnitClass = 'AnonymousApex';
                    currentClass = codeUnitClass;
                } else if (line.includes('|METHOD_ENTRY|')) {
                    // Push a frame for every entry, including platform methods,
                    // so a later METHOD_EXIT cannot pop the wrong user class.
                    currentClass = classFromMethodSignature(parts) || currentClass || codeUnitClass;
                    classCallStack.push(currentClass);
                } else if (line.includes('|METHOD_EXIT|')) {
                    if (classCallStack.length > 0) {
                        classCallStack.pop();
                        currentClass = classCallStack.length > 0
                            ? classCallStack[classCallStack.length - 1]
                            : codeUnitClass;
                    }
                } else if (line.includes('|USER_DEBUG|')) {
                    const match = line.match(/\|USER_DEBUG\|\[(\d+)\]\|([A-Z]+)\|(.*)/);
                    if (match) {
                        debugMessages.push({ line: match[1], level: match[2], text: match[3], cls: currentClass });
                    }
                } else if (line.includes('|VARIABLE_ASSIGNMENT|')) {
                    const match = line.match(/\|VARIABLE_ASSIGNMENT\|\[(\d+)\]\|([^|]+)\|(.*)/);
                    if (match) {
                        variables.push({ line: match[1], varName: match[2], value: match[3], cls: currentClass });
                    }
                } else if (line.includes('|EXCEPTION_THROWN|')) {
                    const match = line.match(/\|EXCEPTION_THROWN\|\[(\d+)\]\|(.*)/);
                    if (match) {
                        exceptions.push({ line: match[1], text: match[2], cls: currentClass });
                    }
                }
            });

            if (variables.length === 0 && debugMessages.length === 0 && exceptions.length === 0) return;

            if (container.children.length === 1 && container.children[0].innerText.includes('Listening for incoming')) {
                container.innerHTML = '';
            }

            const timeStr = new Date(logHeader.StartTime || Date.now()).toLocaleTimeString();
            const card = document.createElement('div');
            card.className = 'log-card';
            card.style.background = 'rgba(255, 255, 255, 0.04)';
            card.style.borderLeft = '3px solid var(--sfarc-accent-glow, #38bdf8)';
            card.style.padding = '8px 12px';
            card.style.borderRadius = '4px';

            let liveVarsMapUpdated = false;

            // Build this log's events into a fresh per-class map, then merge it in,
            // replacing only the classes this execution touched. Classes executed in
            // earlier logs keep their captured data, so reopening them still shows
            // their own values — never another class's line-number-matched data.
            const logEventsByClass = {};
            const storeEvent = (lineStr, cls, data) => {
                const lineNum = parseInt(lineStr);
                if (lineNum <= 0) return;
                const key = cls || 'AnonymousApex';
                if (!logEventsByClass[key]) logEventsByClass[key] = {};
                logEventsByClass[key][lineNum] = logEventsByClass[key][lineNum] || [];
                logEventsByClass[key][lineNum].push(data);
                liveVarsMapUpdated = true;
            };

            variables.forEach(v => storeEvent(v.line, v.cls, { type: 'var', name: v.varName, value: v.value, time: timeStr }));
            debugMessages.forEach(d => storeEvent(d.line, d.cls, { type: 'debug', level: d.level, text: d.text, time: timeStr }));
            exceptions.forEach(ex => storeEvent(ex.line, ex.cls, { type: 'error', text: ex.text, time: timeStr }));

            if (canCaptureInline) {
                Object.keys(logEventsByClass).forEach(key => {
                    liveCapturedVariablesByClass[key] = logEventsByClass[key];
                });
            }

            if (canCaptureInline && liveVarsMapUpdated) {
                updateMonacoInlineVariableDecorations();
            }

            let varsHtml = '';
            variables.forEach(v => {
                varsHtml += `
                    <div style="font-size: 11.5px; color: #4ade80; display: flex; align-items: center; gap: 8px;">
                        <span>🔹 <strong>${escapeHtml(v.cls)} · Line ${v.line}</strong> <code style="color: #f7df1e;">${escapeHtml(v.varName)}</code> = <span style="color: #e2e8f0;">${escapeHtml(v.value)}</span></span>
                    </div>
                `;
            });

            let debugsHtml = '';
            debugMessages.forEach(d => {
                debugsHtml += `
                    <div style="font-size: 11.5px; color: var(--sfarc-accent-glow, #38bdf8); display: flex; align-items: center; gap: 8px;">
                        <span>⚡ <strong>${escapeHtml(d.cls)} · Line ${d.line}</strong> System.debug: <span style="color: #ffffff;">${escapeHtml(d.text)}</span></span>
                    </div>
                `;
            });

            let errsHtml = '';
            exceptions.forEach(ex => {
                errsHtml += `
                    <div style="font-size: 11.5px; color: #f87171; display: flex; align-items: center; gap: 8px;">
                        <span>💥 <strong>${escapeHtml(ex.cls)} · Line ${ex.line}</strong> Exception: ${escapeHtml(ex.text)}</span>
                    </div>
                `;
            });

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 500; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                    <span><i class="fa-solid fa-bolt" style="color: #fbbf24;"></i> ApexLog Event: <strong>${escapeHtml(logHeader.Operation || 'Execute')}</strong> (${logHeader.Status})</span>
                    <span style="font-size: 10.5px; color: #94a3b8;">${timeStr} (${logHeader.DurationMilliseconds || 0}ms)</span>
                </div>
                ${errsHtml}
                ${varsHtml}
                ${debugsHtml}
            `;

            container.insertBefore(card, container.firstChild);
            showTerminalTab('logs');
            logToTerminal(`Live Debug Event Captured: ${variables.length} variables, ${debugMessages.length} debug logs. Highlighted in Monaco Editor!`, 'success');
        } catch (e) {
            console.error('Error processing log body:', e);
        }
    }

    // Captured log events, keyed by class name → line number → events. A log is
    // only ever rendered on the file whose class matches the execution, so opening
    // a different class never shows another class's line-number-matched variables.
    let liveCapturedVariablesByClass = {};
    let activeDecorations = [];

    // Map the currently open file to the class name used in log METHOD_ENTRY lines
    // (e.g. 'MyController.cls' → 'MyController'). Triggers and other extensions are
    // matched case-insensitively; files that aren't Apex have no class context.
    function getActiveFileClassName() {
        if (!activeFilePath) return null;
        const base = activeFilePath.split(/[\\/]/).pop();
        const match = base.match(/^([a-zA-Z0-9_]+)\.(cls|trigger)$/i);
        return match ? match[1] : null;
    }

    function updateMonacoInlineVariableDecorations() {
        if (!editorInstance) return;
        const decorations = [];

        // This is the final safety gate. File switches, model swaps, manual log
        // refreshes, and late network responses all call this function; OFF must
        // always mean no line color, glyph, or hover payload in Monaco.
        if (!isLogTailerActive) {
            activeDecorations = editorInstance.deltaDecorations(activeDecorations, []);
            return;
        }

        // Only render events captured for the class that is open right now.
        // Salesforce class names are case-insensitive, so match case-insensitively.
        const activeClass = getActiveFileClassName();
        if (!activeClass) {
            activeDecorations = editorInstance.deltaDecorations(activeDecorations, []);
            return;
        }
        const classKey = Object.keys(liveCapturedVariablesByClass)
            .find(k => k.toLowerCase() === activeClass.toLowerCase());
        const classVars = classKey ? liveCapturedVariablesByClass[classKey] : null;
        if (!classVars) {
            activeDecorations = editorInstance.deltaDecorations(activeDecorations, []);
            return;
        }

        Object.keys(classVars).forEach(lineStr => {
            const lineNum = parseInt(lineStr);
            const infos = classVars[lineStr];
            const model = editorInstance.getModel();
            if (!Number.isInteger(lineNum) || lineNum < 1 || !model || lineNum > model.getLineCount()) return;

            // Values can be long object dumps — keep the hover compact and scannable.
            const tidy = (s) => {
                const str = String(s == null ? '' : s);
                const single = str.replace(/\s+/g, ' ').trim();
                return single.length > 220 ? single.slice(0, 217) + '…' : single;
            };

            let hoverContent = `**🔹 Live Apex Log Data — ${activeClass}**\n\n`;
            let hasVars = false;
            let hasDebugs = false;
            let hasErrors = false;

            infos.forEach(info => {
                if (info.type === 'var') {
                    hoverContent += `**\`${info.name}\`** = \`${tidy(info.value)}\`\n\n`;
                    hasVars = true;
                } else if (info.type === 'debug') {
                    hoverContent += `⚡ **System.debug**: \`${tidy(info.text)}\`\n\n`;
                    hasDebugs = true;
                } else if (info.type === 'error') {
                    hoverContent += `💥 **Exception**: \`${tidy(info.text)}\`\n\n`;
                    hasErrors = true;
                }
            });

            hoverContent += `*Captured from ${activeClass} execution at ${infos[0].time}*`;

            let bgClass = 'inline-var-green-bg';
            let glyphClass = 'inline-var-glyph';
            
            if (hasErrors) {
                bgClass = 'inline-var-red-bg';
                glyphClass = 'inline-var-red-glyph';
            } else if (hasDebugs && !hasVars) {
                bgClass = 'inline-var-blue-bg';
                glyphClass = 'inline-var-blue-glyph';
            }

            decorations.push({
                range: new monaco.Range(lineNum, 1, lineNum, 1000),
                options: {
                    isWholeLine: true,
                    className: bgClass,
                    glyphMarginClassName: glyphClass,
                    hoverMessage: {
                        value: hoverContent
                    }
                }
            });
        });

        activeDecorations = editorInstance.deltaDecorations(activeDecorations, decorations);
    }

    // Apex PMD Static Code Analysis Scanner Integration
    // Debounced: swapping the editor model fires onDidChangeModelContent right
    // after the explicit scan call, which used to run the PMD scan + security
    // audit twice per file open (duplicate console lines, duplicate work).
    let pmdScanTimer = null;
    function runApexPmdScan(editor) {
        if (!editor || typeof monaco === 'undefined' || !monaco.editor) return;
        clearTimeout(pmdScanTimer);
        pmdScanTimer = setTimeout(() => {
            const model = editor.getModel();
            if (!model) return;

            const code = model.getValue();
            if (!code) {
                monaco.editor.setModelMarkers(model, 'apex-pmd', []);
                return;
            }

            import('./apex-pmd-engine.js').then(({ analyzeApexPmd }) => {
            const pmdMarkers = analyzeApexPmd(code);
            const monacoMarkers = pmdMarkers.map(m => {
                let severity = monaco.MarkerSeverity.Info;
                if (m.severity === 'error') severity = monaco.MarkerSeverity.Error;
                else if (m.severity === 'warning') severity = monaco.MarkerSeverity.Warning;

                return {
                    severity: severity,
                    message: m.message,
                    startLineNumber: m.startLineNumber,
                    startColumn: m.startColumn,
                    endLineNumber: m.endLineNumber,
                    endColumn: m.endColumn,
                    source: 'Apex PMD'
                };
            });

            monaco.editor.setModelMarkers(model, 'apex-pmd', monacoMarkers);
            // Run the security audit only when this file's content hasn't been
            // audited yet (first open / edit). Switching between already-open
            // tabs re-renders the cached report silently — no duplicate audit.
            const auditFile = currentFiles[activeFilePath];
            const cached = auditFile && auditFile.audit;
            if (cached && cached.content === code && cached.fileName === activeFilePath) {
                if (typeof renderSecurityFindings === 'function') {
                    renderSecurityFindings(cached.findings, cached.score, true);
                }
            } else if (activeFilePath && (activeFilePath.endsWith('.cls') || activeFilePath.endsWith('.trigger')) && typeof analyzeApexSecurity === 'function') {
                analyzeApexSecurity();
            }
        }).catch(err => {
            console.warn('Apex PMD Scan failed:', err);
        });
        }, 350);
    }

    function getFileIconHtml(fileName) {
        // File sheet icon with the file-type icon stacked on its corner (VS Code style).
        const stack = (typeIcon, color) =>
            `<div class="file-icon-stack"><i class="fa-regular fa-file file-icon-base"></i><i class="${typeIcon} file-icon-badge" style="color:${color};"></i></div>`;

        if (!fileName) return stack('fa-solid fa-file', '#94a3b8');

        if (fileName.includes('JSON-to-Apex') || fileName.includes('JSON to Apex')) {
            return stack('fa-solid fa-code', '#facc15');
        } else if (fileName.includes('SOQL-to-GraphQL') || fileName.includes('SOQL to GraphQL')) {
            return stack('fa-solid fa-network-wired', '#ec4899');
        } else if (fileName.includes('Metadata-Backup') || fileName.includes('Metadata Backup')) {
            return stack('fa-solid fa-box-archive', '#06b6d4');
        } else if (fileName.includes('Anon-Apex') || fileName.includes('Anon Apex')) {
            return stack('fa-solid fa-terminal', '#4ade80');
        } else if (fileName.includes('Bulk-Permission-Wizard') || fileName.includes('Bulk Permission Wizard')) {
            return stack('fa-solid fa-layer-group', 'var(--sfarc-accent-glow, #38bdf8)');
        }

        if (fileName.endsWith('.js')) {
            return stack('fa-brands fa-js', '#f7df1e');
        } else if (fileName.endsWith('.html')) {
            return stack('fa-brands fa-html5', '#e34f26');
        } else if (fileName.endsWith('.css')) {
            return stack('fa-brands fa-css3-alt', '#1572b6');
        } else if (fileName.endsWith('.svg')) {
            return stack('fa-solid fa-bezier-curve', '#ff9800');
        } else if (fileName.endsWith('.xml') || fileName.endsWith('.js-meta.xml')) {
            return stack('fa-solid fa-file-code', '#858585');
        } else if (fileName.endsWith('.cls')) {
            return stack('fa-solid fa-code', 'var(--sfarc-accent-glow, #38bdf8)');
        } else if (fileName.endsWith('.trigger')) {
            return stack('fa-solid fa-bolt', '#fbbf24');
        } else if (fileName.endsWith('.json')) {
            return stack('fa-solid fa-file-lines', '#a855f7');
        } else if (fileName.endsWith('.cmp') || fileName.endsWith('.app')) {
            return stack('fa-solid fa-bolt-lightning', '#e06c75');
        } else if (fileName.endsWith('.page')) {
            return stack('fa-solid fa-file-code', '#ec4899');
        } else if (fileName.endsWith('.component')) {
            return stack('fa-solid fa-puzzle-piece', '#8b5cf6');
        }
        return stack('fa-solid fa-file', '#94a3b8');
    }

    // Reusable JSON to Apex Generator Helper
    function jsonToApexWrapperGenerator(className, jsonText) {
        if (!jsonText) {
            throw new Error('JSON input is empty');
        }
        const parsed = JSON.parse(jsonText);
        const innerClasses = [];

        function capitalize(s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
        }

        function getApexType(val, keyName) {
            if (val === null || val === undefined) return 'Object';
            if (typeof val === 'boolean') return 'Boolean';
            if (typeof val === 'number') return Number.isInteger(val) ? 'Integer' : 'Decimal';
            if (typeof val === 'string') return 'String';
            if (Array.isArray(val)) {
                const itemType = val.length > 0 ? getApexType(val[0], keyName) : 'Object';
                return `List<${itemType}>`;
            }
            if (typeof val === 'object') {
                const subClassName = capitalize(keyName);
                generateInnerClass(subClassName, val);
                return subClassName;
            }
            return 'Object';
        }

        function generateInnerClass(name, obj) {
            let props = [];
            Object.keys(obj).forEach(k => {
                const typeStr = getApexType(obj[k], k);
                props.push(`        public ${typeStr} ${k};`);
            });

            innerClasses.push(`    public class ${name} {\n${props.join('\n')}\n    }`);
        }

        let topLevelProps = [];
        Object.keys(parsed).forEach(k => {
            const typeStr = getApexType(parsed[k], k);
            topLevelProps.push(`    public ${typeStr} ${k};`);
        });

        return `public with sharing class ${className} {\n${topLevelProps.join('\n')}\n\n${innerClasses.join('\n\n')}\n\n    public static ${className} parse(String json) {\n        return (${className}) System.JSON.deserialize(json, ${className}.class);\n    }\n}`;
    }

    // Feature: JSON to Apex Class Converter (Beta)
    function convertJsonToApexClass() {
        const className = document.getElementById('json-apex-class-name')?.value.trim() || 'AccountWrapper';
        const jsonText = document.getElementById('json-input-payload')?.value.trim();
        const resultTextarea = document.getElementById('json-apex-result');

        if (!jsonText) {
            toast.warning('Please paste a JSON payload to convert.');
            return;
        }

        try {
            const apexCode = jsonToApexWrapperGenerator(className, jsonText);
            if (resultTextarea) resultTextarea.value = apexCode;
            logToTerminal(`Generated Apex Wrapper Class '${className}' from JSON payload`, 'success');
        } catch (e) {
            console.error('JSON to Apex Error:', e);
            if (resultTextarea) resultTextarea.value = `// Invalid JSON Payload: ${e.message}`;
            logToTerminal(`JSON to Apex Error: ${e.message}`, 'error');
        }
    }

    // Feature: SOQL to GraphQL Converter
    function convertSoqlToGraphQl() {
        const soql = document.getElementById('soql-input-query')?.value.trim();
        const resultTextarea = document.getElementById('graphql-result-query');

        if (!soql) {
            toast.error('Please enter a SOQL query to convert.');
            return;
        }

        try {
            const match = soql.match(/SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+LIMIT\s+(\d+))?/i);
            if (!match) {
                throw new Error('Could not parse SOQL syntax. Format: SELECT fields FROM Object WHERE condition LIMIT N');
            }

            const fieldsRaw = match[1];
            const sObj = match[2];
            const whereClause = match[3];
            const limitVal = match[4];

            const fields = fieldsRaw.split(',').map(f => f.trim()).filter(f => f && !f.startsWith('('));

            let fieldNodes = fields.map(f => `              ${f}`).join('\n');
            let argsArr = [];

            if (whereClause) {
                argsArr.push(`where: { ${whereClause.replace(/['"]/g, '"')} }`);
            }
            if (limitVal) {
                argsArr.push(`first: ${limitVal}`);
            }

            const argsStr = argsArr.length > 0 ? `(\n            ${argsArr.join('\n            ')}\n          )` : '';

            const graphql = `query get${sObj}s {\n  uiapi {\n    query {\n      ${sObj}${argsStr} {\n        edges {\n          node {\n${fieldNodes}\n          }\n        }\n      }\n    }\n  }\n}`;

            if (resultTextarea) resultTextarea.value = graphql;
            logToTerminal(`Converted SOQL query for '${sObj}' into Salesforce UI API GraphQL query format`, 'success');
        } catch (e) {
            console.error('SOQL to GraphQL Error:', e);
            if (resultTextarea) resultTextarea.value = `# Error: ${e.message}`;
            logToTerminal(`SOQL to GraphQL Error: ${e.message}`, 'error');
        }
    }

    // Feature: Backup & Metadata Exporter
    function renderBackupPreview() {
        const format = document.getElementById('backup-format-select')?.value;
        const preview = document.getElementById('backup-preview-text');

        if (format === 'bundle' && activeFilePath && currentFiles[activeFilePath]) {
            let fileList = Object.keys(currentFiles).map(f => `  - ${currentBundleInfo.name}/${f}`).join('\n');
            if (preview) preview.value = `--- Active Bundle Backup (${currentBundleInfo.name}) ---\nFiles Included:\n${fileList}`;
        } else {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n    <types>\n        <members>*</members>\n        <name>ApexClass</name>\n    </types>\n    <types>\n        <members>*</members>\n        <name>LightningComponentBundle</name>\n    </types>\n    <apiVersion>60.0</apiVersion>\n</Package>`;
            if (preview) preview.value = xml;
        }
    }

    function downloadBackupPackage() {
        const format = document.getElementById('backup-format-select')?.value;
        const text = document.getElementById('backup-preview-text')?.value || '';

        const fileName = format === 'bundle' ? `${currentBundleInfo.name || 'ComponentBackup'}.json` : 'package.xml';
        const mimeType = format === 'bundle' ? 'application/json' : 'text/xml';

        let content = text;
        if (format === 'bundle') {
            content = JSON.stringify(currentFiles, null, 2);
        }

        const blob = new Blob([content], { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        logToTerminal(`Downloaded Metadata Backup: ${fileName}`, 'success');
    }

    // Initialize Monaco Editor & Register Salesforce Snippets
    function initMonaco() {
        const vsPath = '../lib/monaco-editor/min/vs';
        require.config({ paths: { 'vs': vsPath } });

        // Resolve the user's accent color for Monaco's theme JSON (CSS vars can't be used there).
        const monacoAccent = (() => {
            try {
                return (getComputedStyle(document.documentElement).getPropertyValue('--sfarc-accent-glow') || '').trim() || '#38bdf8';
            } catch (e) {
                return '#38bdf8';
            }
        })();

        // Chrome extensions cannot spawn Web Workers from chrome-extension://
        // origins — Monaco's editor worker would throw a SecurityError and leave
        // the editor pane blank. Provide a minimal stub worker instead (we don't
        // need language services; Apex/JS/HTML highlighting is all client-side).
        //
        // MV3 forbids blob: in the extension CSP, so this must be a real bundled
        // worker file (chrome-extension:// origin = 'self', which IS allowed).
        if (!window.MonacoEnvironment) {
            try {
                // Resolve from this document, not chrome.runtime.getURL(). During
                // extension reloads the runtime URL can point at a newer extension
                // origin while this still-open page retains the old CSP origin.
                const workerUrl = new URL('monaco-stub-worker.js', document.baseURI).href;
                window.MonacoEnvironment = {
                    getWorker: function () {
                        return new Worker(workerUrl);
                    }
                };
            } catch (e) {
                // If workers are entirely unavailable, Monaco still renders the
                // editor without a worker for plain text/JS via its fallback.
            }
        }

        require(['vs/editor/editor.main'], function () {
            isMonacoReady = true;

            // Disable TS/JS semantic and syntax validation to prevent loading missing tsWorker.js
            if (monaco.languages && monaco.languages.typescript) {
                if (monaco.languages.typescript.javascriptDefaults) {
                    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true,
                        noSuggestionDiagnostics: true
                    });
                    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                        noLib: true,
                        allowNonTsExtensions: true
                    });
                }
                if (monaco.languages.typescript.typescriptDefaults) {
                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true,
                        noSuggestionDiagnostics: true
                    });
                    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                        noLib: true,
                        allowNonTsExtensions: true
                    });
                }
            }

            monaco.editor.defineTheme('sfarc-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
                    { token: 'keyword.type', foreground: '569cd6' },
                    { token: 'storage', foreground: '569cd6' },
                    { token: 'storage.type', foreground: '569cd6' },
                    { token: 'type', foreground: '4ec9b0' },
                    { token: 'type.identifier', foreground: '4ec9b0' },
                    { token: 'class', foreground: '4ec9b0' },
                    { token: 'identifier', foreground: '9cdcfe' },
                    { token: 'variable', foreground: '9cdcfe' },
                    { token: 'variable.parameter', foreground: '9cdcfe' },
                    { token: 'function', foreground: 'dcdcaa' },
                    { token: 'member', foreground: '9cdcfe' },
                    { token: 'string', foreground: 'ce9178' },
                    { token: 'number', foreground: 'b5cea8' },
                    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
                    { token: 'annotation', foreground: 'c586c0' },
                    { token: 'delimiter', foreground: 'd4d4d4' }
                ],
                colors: {
                    'editor.background': '#1e1e1e',
                    'editor.foreground': '#d4d4d4',
                    'editor.lineHighlightBackground': '#282828',
                    'editorLineNumber.foreground': '#858585',
                    'editorLineNumber.activeForeground': '#c6c6c6',
                    'editorCursor.foreground': '#aeafad',
                    'editor.selectionBackground': '#264f78',
                    'editor.inactiveSelectionBackground': '#3a3d41',
                    'editorWidget.background': '#252526',
                    'editorWidget.border': '#454545',
                    'editorSuggestWidget.background': '#252526',
                    'editorSuggestWidget.border': '#454545',
                    'editorSuggestWidget.selectedBackground': '#04395e'
                }
            });

            // Prevent Monaco from trying to load missing tsWorker.js in stripped extension bundle
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: true
            });
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: true
            });

            monaco.editor.defineTheme('sfarc-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
                    { token: 'keyword.type', foreground: '0000ff' },
                    { token: 'storage', foreground: '0000ff' },
                    { token: 'storage.type', foreground: '0000ff' },
                    { token: 'type', foreground: '267f99' },
                    { token: 'type.identifier', foreground: '267f99' },
                    { token: 'class', foreground: '267f99' },
                    { token: 'identifier', foreground: '001080' },
                    { token: 'variable', foreground: '001080' },
                    { token: 'variable.parameter', foreground: '001080' },
                    { token: 'function', foreground: '795e26' },
                    { token: 'member', foreground: '001080' },
                    { token: 'string', foreground: 'a31515' },
                    { token: 'number', foreground: '098658' },
                    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
                    { token: 'annotation', foreground: 'af00db' },
                    { token: 'delimiter', foreground: '000000' }
                ],
                colors: {
                    'editor.background': '#ffffff',
                    'editor.foreground': '#000000',
                    'editor.lineHighlightBackground': '#f3f3f3',
                    'editorLineNumber.foreground': '#717171',
                    'editorLineNumber.activeForeground': '#000000',
                    'editorCursor.foreground': '#000000',
                    'editor.selectionBackground': '#add6ff',
                    'editor.inactiveSelectionBackground': '#e5ebf1',
                    'editorWidget.background': '#f3f3f3',
                    'editorWidget.border': '#c8c8c8',
                    'editorSuggestWidget.background': '#f3f3f3',
                    'editorSuggestWidget.border': '#c8c8c8',
                    'editorSuggestWidget.selectedBackground': '#d0e0f0'
                }
            });

            monaco.editor.defineTheme('sfarc-amoled', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
                    { token: 'keyword.type', foreground: '38bdf8' },
                    { token: 'storage', foreground: '38bdf8' },
                    { token: 'storage.type', foreground: '38bdf8' },
                    { token: 'type', foreground: '2dd4bf' },
                    { token: 'type.identifier', foreground: '2dd4bf' },
                    { token: 'class', foreground: '2dd4bf' },
                    { token: 'identifier', foreground: 'e0f2fe' },
                    { token: 'variable', foreground: 'e0f2fe' },
                    { token: 'variable.parameter', foreground: 'e0f2fe' },
                    { token: 'function', foreground: 'facc15' },
                    { token: 'member', foreground: 'e0f2fe' },
                    { token: 'string', foreground: 'fb923c' },
                    { token: 'number', foreground: '4ade80' },
                    { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
                    { token: 'annotation', foreground: 'c084fc' },
                    { token: 'delimiter', foreground: 'f8fafc' }
                ],
                colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#f8fafc',
                    'editor.lineHighlightBackground': '#0f0f0f',
                    'editorLineNumber.foreground': '#475569',
                    'editorLineNumber.activeForeground': monacoAccent,
                    'editorCursor.foreground': monacoAccent,
                    'editor.selectionBackground': '#1e3a8a',
                    'editor.inactiveSelectionBackground': '#1e293b',
                    'editorWidget.background': '#0a0a0a',
                    'editorWidget.border': '#1e293b',
                    'editorSuggestWidget.background': '#0a0a0a',
                    'editorSuggestWidget.border': '#1e293b',
                    'editorSuggestWidget.selectedBackground': '#1e3a8a'
                }
            });

            registerSalesforceSnippets();

            // On a fresh launch (no file open yet) show the welcome screen instead of
            // a placeholder editor with a comment line. If a file/tab is restored
            // later, openFileInEditor hides the welcome and creates the real editor.
            if (activeFilePath && currentFiles[activeFilePath]) {
                createStandardEditor();
            } else {
                showEditorWelcome();
            }
            restoreAllEditorSettings(); // Re-read persisted settings now that the editor exists (race-proof)

            // Keyboard shortcut Ctrl+S / Cmd+S
            if (editorInstance) {
                editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                    saveCurrentFileToOrg();
                });
            }

            // Keyboard shortcut Ctrl+S / Cmd+S and Ctrl+H / Cmd+H
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key === 'S' || e.key === 's')) {
                    e.preventDefault();
                    e.stopPropagation();
                    saveCurrentFileToOrg();
                } else if ((e.ctrlKey || e.metaKey) && (e.key === 'H' || e.key === 'h')) {
                    e.preventDefault();
                    toggleFindReplaceDrawer(true);
                } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
                    e.preventDefault();
                    const actFindOrg = document.getElementById('act-btn-find-org');
                    if (actFindOrg && !actFindOrg.classList.contains('active')) {
                        actFindOrg.click();
                    } else {
                        const searchInput = document.getElementById('code-search-input');
                        if (searchInput) searchInput.focus();
                    }
                } else if (isEditorZoomShortcut(e) && (e.key === '+' || e.key === '=')) {
                    e.preventDefault();
                    e.stopPropagation();
                    changeFontSize(1);
                } else if (isEditorZoomShortcut(e) && (e.key === '-' || e.key === '_')) {
                    e.preventDefault();
                    e.stopPropagation();
                    changeFontSize(-1);
                } else if (isEditorZoomShortcut(e) && e.key === '0') {
                    e.preventDefault();
                    e.stopPropagation();
                    resetEditorFontSize();
                }
            });

            // Load requested file/bundle & Org Metadata
            loadInitialAsset();
        }, function (err) {
            // Monaco failed to load (blocked worker / CSP / missing bundle). Show a
            // clear message instead of leaving the editor pane silently blank.
            isMonacoReady = false;
            hideEditorLoader();
            const container = document.getElementById('monaco-container-left');
            if (container) {
                container.innerHTML =
                    '<div class="ce-editor-error">' +
                    '<div class="ce-editor-error-icon">⚡</div>' +
                    '<div class="ce-editor-error-title">Editor could not start</div>' +
                    '<div class="ce-editor-error-sub">Monaco failed to initialize. Reinstall the extension from the ZIP, or reload this tab and try again.</div>' +
                    '</div>';
            }
            console.error('Monaco failed to initialize:', err);
        });

        // If Monaco is still not ready shortly after load (network hiccup), surface
        // the error state instead of a blank pane.
        setTimeout(function () {
            if (!isMonacoReady) {
                hideEditorLoader();
                const container = document.getElementById('monaco-container-left');
                if (container && !container.querySelector('.ce-editor-error')) {
                    container.innerHTML =
                        '<div class="ce-editor-error">' +
                        '<div class="ce-editor-error-icon">⌛</div>' +
                        '<div class="ce-editor-error-title">Editor is taking long to start</div>' +
                        '<div class="ce-editor-error-sub">Reload this tab if the editor does not appear.</div>' +
                        '</div>';
                }
            }
        }, 12000);
    }

    // Feature 2: Apex Security & Code Quality Analyzer
    function analyzeApexSecurity() {
        const securityBody = document.getElementById('terminal-body-security');
        const badge = document.getElementById('security-badge');

        if (!activeFilePath || !currentFiles[activeFilePath]) {
            if (badge) badge.style.display = 'none';
            if (securityBody) {
                securityBody.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 8px;">Select an Apex class or trigger to analyze security & health.</div>';
            }
            return;
        }

        if (!activeFilePath.endsWith('.cls') && !activeFilePath.endsWith('.trigger')) {
            if (badge) badge.style.display = 'none';
            if (securityBody) {
                securityBody.innerHTML = `<div style="color: #64748b; font-style: italic; padding: 8px;">Security & Health analysis is supported for Apex classes (.cls) and triggers (.trigger). Active file: <strong>${escapeHtml(activeFilePath)}</strong></div>`;
            }
            return;
        }

        const fileObj = currentFiles[activeFilePath];
        const content = fileObj.content || '';
        const lines = content.split('\n');
        const findings = [];
        let score = 100;

        let insideLoop = false;
        let loopBraceCount = 0;

        lines.forEach((lineText, idx) => {
            const lineNum = idx + 1;
            const trimmed = lineText.trim();

            if (trimmed.match(/\b(for|while)\s*\(/)) {
                insideLoop = true;
                loopBraceCount++;
            }

            if (insideLoop) {
                if (trimmed.includes('[SELECT') || trimmed.includes('[select')) {
                    findings.push({
                        severity: 'HIGH',
                        line: lineNum,
                        title: 'SOQL Query inside Loop',
                        description: 'Governor Limit Risk: SOQL query placed inside a loop can hit the 100 SOQL queries governor limit.',
                        icon: 'fa-triangle-exclamation',
                        color: '#f87171'
                    });
                    score -= 25;
                }

                if (trimmed.match(/\b(insert|update|delete|upsert|undelete)\b\s+[\w]+;/i)) {
                    findings.push({
                        severity: 'HIGH',
                        line: lineNum,
                        title: 'DML Statement inside Loop',
                        description: 'Governor Limit Risk: DML statement inside a loop can hit the 150 DML statements governor limit.',
                        icon: 'fa-triangle-exclamation',
                        color: '#f87171'
                    });
                    score -= 25;
                }
            }

            if (trimmed.match(/['"][0-9a-zA-Z]{15,18}['"]/)) {
                const match = trimmed.match(/['"]([0-9a-zA-Z]{15,18})['"]/);
                if (match && match[1].startsWith('00')) {
                    findings.push({
                        severity: 'MEDIUM',
                        line: lineNum,
                        title: `Hardcoded Salesforce ID ('${match[1]}')`,
                        description: 'Best Practice Violation: Hardcoding Salesforce IDs causes deployments between sandbox & production to break.',
                        icon: 'fa-triangle-exclamation',
                        color: '#fbbf24'
                    });
                    score -= 15;
                }
            }

            if ((trimmed.includes('[SELECT') || trimmed.includes('[select')) && !trimmed.toLowerCase().includes('limit')) {
                findings.push({
                    severity: 'LOW',
                    line: lineNum,
                    title: 'SOQL Query without LIMIT clause',
                    description: 'Optimization Suggestion: Unbounded SOQL queries can exceed heap sizes or 50,000 query row limit.',
                    icon: 'fa-circle-info',
                    color: 'var(--sfarc-accent-glow, #38bdf8)'
                });
                score -= 5;
            }

            if (trimmed.includes('}')) loopBraceCount = Math.max(0, loopBraceCount - 1);
            if (loopBraceCount === 0) insideLoop = false;
        });

        if (activeFilePath.endsWith('.cls')) {
            const classDefLine = lines.find(l => l.includes(' class '));
            if (classDefLine && !classDefLine.includes('with sharing') && !classDefLine.includes('without sharing') && !classDefLine.includes('inherited sharing')) {
                findings.push({
                    severity: 'MEDIUM',
                    line: 1,
                    title: 'Class Declaration Missing Sharing Keyword',
                    description: 'Security Warning: Apex class lacks explicit sharing mode (with sharing, without sharing, or inherited sharing).',
                    icon: 'fa-shield-cat',
                    color: '#fbbf24'
                });
                score -= 15;
            }
        }

        // PMD Rule Engine Integration
        import('./apex-pmd-engine.js').then(({ analyzeApexPmd }) => {
            const pmdMarkers = analyzeApexPmd(content);
            pmdMarkers.forEach(m => {
                const exists = findings.some(f => f.line === m.startLineNumber && f.title.includes(m.ruleId));
                if (!exists) {
                    findings.push({
                        severity: m.severity === 'error' ? 'HIGH' : m.severity === 'warning' ? 'MEDIUM' : 'LOW',
                        line: m.startLineNumber,
                        title: `Apex PMD: ${m.ruleId}`,
                        description: m.message,
                        icon: 'fa-shield-halved',
                        color: m.severity === 'error' ? '#f87171' : m.severity === 'warning' ? '#fbbf24' : 'var(--sfarc-accent-glow, #38bdf8)'
                    });
                    score -= (m.severity === 'error' ? 20 : m.severity === 'warning' ? 10 : 5);
                }
            });
            score = Math.max(0, score);
            // Cache the audit against the exact content so switching back to an
            // already-open tab can re-render it without re-analyzing.
            if (currentFiles[activeFilePath]) {
                currentFiles[activeFilePath].audit = { score: score, findings: findings, content: content, fileName: activeFilePath };
            }
            renderSecurityFindings(findings, score);
        }).catch(() => {
            score = Math.max(0, score);
            if (currentFiles[activeFilePath]) {
                currentFiles[activeFilePath].audit = { score: score, findings: findings, content: content, fileName: activeFilePath };
            }
            renderSecurityFindings(findings, score);
        });
        return;
    }

    function renderSecurityFindings(findings, score, silent = false) {

        score = Math.max(0, score);
        const securityBody = document.getElementById('terminal-body-security');
        const badge = document.getElementById('security-badge');

        if (badge) {
            badge.innerText = `${score}/100`;
            badge.style.display = 'inline-block';
            badge.style.background = score >= 80 ? 'rgba(46, 160, 67, 0.3)' : dangerSoftBg();
            badge.style.color = score >= 80 ? 'var(--accent-green, #2ea043)' : dangerColor();
        }

        if (!securityBody) {
            logToTerminal(`Completed Security & Quality audit for ${activeFilePath}: Health Score = ${score}/100 (${findings.length} findings)`, score >= 80 ? 'success' : 'warn');
            return;
        }

        const ok = findings.length === 0;
        const scoreColor = score >= 80 ? '#2ea043' : score >= 50 ? '#fbbf24' : '#f87171';
        const fileLabel = String(activeFilePath || 'file').split(/[\\/]/).pop() || 'file';
        const sevClass = (s) => s === 'HIGH' ? 'high' : s === 'MEDIUM' ? 'medium' : 'low';

        const itemsHtml = findings.map(f => `
            <div class="sec-item" style="--sev: ${f.color || '#f87171'};" data-line="${f.line}" title="Click to jump to line ${f.line}">
                <span class="sec-line">L${f.line}</span>
                <div class="sec-item-body">
                    <div class="sec-item-head">
                        <div class="sec-item-title"><i class="fa-solid ${f.icon || 'fa-shield-halved'}"></i> ${escapeHtml(f.title)}</div>
                        <span class="sec-sev ${sevClass(f.severity)}">${f.severity}</span>
                    </div>
                    <div class="sec-item-desc">${escapeHtml(f.description || '')}</div>
                </div>
            </div>
        `).join('');

        securityBody.innerHTML = `
            <div class="sec-report">
                <div class="sec-header">
                    <div class="sec-title">
                        <i class="fa-solid fa-shield-halved"></i> Security & Health Audit
                        <span class="sec-file" title="${escapeHtml(fileLabel)}">${escapeHtml(fileLabel)}</span>
                    </div>
                    <div class="sec-score">
                        <div class="sec-ring" style="--score-val: ${score}; --sec-color: ${scoreColor};" title="Health Score: ${score}/100">
                            <span class="sec-ring-num">${score}</span>
                        </div>
                    </div>
                </div>
                <div class="sec-verdict ${ok ? '' : 'warn'}">
                    <i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                    <span><strong>${ok ? 'Excellent!' : `${findings.length} risk${findings.length === 1 ? '' : 's'} detected`}</strong> <span class="sec-muted">${ok ? 'No security risks or governor limit violations found.' : 'Click any finding to jump to its line.'}</span></span>
                </div>
                ${itemsHtml}
            </div>
        `;

        securityBody.querySelectorAll('.sec-item').forEach(item => {
            item.addEventListener('click', () => {
                const line = parseInt(item.getAttribute('data-line'), 10);
                if (editorInstance && line) {
                    editorInstance.revealPositionInCenter({ lineNumber: line, column: 1 });
                    editorInstance.setPosition({ lineNumber: line, column: 1 });
                    editorInstance.focus();
                }
            });
        });

        // silent = cached re-render on tab switch — no duplicate console line.
        if (!silent) {
            logToTerminal(`Completed Security & Quality audit for ${activeFilePath}: Health Score = ${score}/100 (${findings.length} findings)`, score >= 80 ? 'success' : 'warn');
        }
    }



    // ── Editor Loader Overlay ──
    function showEditorLoader(text) {
        const overlay = document.getElementById('sfarc-editor-loader');
        const label = document.getElementById('sfarc-loader-text');
        if (overlay) {
            if (label) label.textContent = text || 'Loading...';
            overlay.classList.add('active');
        }
    }
    function hideEditorLoader() {
        const overlay = document.getElementById('sfarc-editor-loader');
        if (overlay) overlay.classList.remove('active');
    }

    // Feature 3: Org Asset Delete Manager
    function promptDeleteAsset(id, name, type) {
        pendingDeleteTarget = { id, name, type };
        const modal = document.getElementById('delete-asset-modal');
        const msg = document.getElementById('delete-confirm-message');

        if (msg) {
            msg.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(name)}</strong> (${type.toUpperCase()}) from your Salesforce Org?<br><br><span style="color: #f87171; font-weight: 500;">⚠️ Warning: This action cannot be undone.</span>`;
        }

        if (modal) modal.style.display = 'flex';
    }

    async function executeDeleteAsset() {
        const { id, name, type } = pendingDeleteTarget;
        if (!id || !type) return;

        document.getElementById('delete-asset-modal').style.display = 'none';
        setStatus(`Deleting ${type.toUpperCase()} '${name}' from Org...`);
        logToTerminal(`Deleting ${type.toUpperCase()} '${name}' (ID: ${id}) via Tooling API...`, 'warn');

        try {
            let sobjectType = 'ApexClass';
            if (type === 'trigger') sobjectType = 'ApexTrigger';
            else if (type === 'lwc') sobjectType = 'LightningComponentBundle';
            else if (type === 'aura') sobjectType = 'AuraDefinitionBundle';
            else if (type === 'vfpage') sobjectType = 'ApexPage';
            else if (type === 'vfcomp') sobjectType = 'ApexComponent';

            const endpoint = `/services/data/v60.0/tooling/sobjects/${sobjectType}/${id}`;
            await sfApiRest(endpoint, { method: 'DELETE' });

            setStatus(`Successfully deleted ${name} from Salesforce Org!`);
            logToTerminal(`Successfully deleted ${type.toUpperCase()} '${name}' from Salesforce Org!`, 'success');

            // --- Instant removal from view ---

            // 1. Remove from orgMetadata arrays (by ID & Name)
            const id15 = id ? id.substring(0, 15) : '';
            const cleanName = name ? name.replace(/\.(cls|trigger|page|component)$/i, '') : '';

            if (type === 'apex' || type === 'class') {
                orgMetadata.apexClasses = orgMetadata.apexClasses.filter(c => c.Id !== id && c.Name !== cleanName && (!id15 || !c.Id.startsWith(id15)));
            } else if (type === 'trigger') {
                orgMetadata.apexTriggers = orgMetadata.apexTriggers.filter(t => t.Id !== id && t.Name !== cleanName && (!id15 || !t.Id.startsWith(id15)));
            } else if (type === 'lwc') {
                orgMetadata.lwcBundles = orgMetadata.lwcBundles.filter(b => b.Id !== id && b.DeveloperName !== cleanName && (!id15 || !b.Id.startsWith(id15)));
            } else if (type === 'aura') {
                orgMetadata.auraBundles = orgMetadata.auraBundles.filter(a => a.DeveloperName !== cleanName && (!id15 || !a.Id.startsWith(id15)));
            } else if (type === 'vfpage' || type === 'vf') {
                orgMetadata.vfPages = orgMetadata.vfPages.filter(p => p.Name !== cleanName && (!id15 || !p.Id.startsWith(id15)));
            } else if (type === 'vfcomp') {
                orgMetadata.vfComponents = orgMetadata.vfComponents.filter(c => c.Name !== cleanName && (!id15 || !c.Id.startsWith(id15)));
            }

            // 2. Close open tabs and remove from currentFiles for deleted asset
            const filesToRemove = [];
            for (const fName in currentFiles) {
                const f = currentFiles[fName];
                if (f.id === id || f.bundleName === name || f.name === name || fName.startsWith(`${name}.`) || (cleanName && fName.startsWith(`${cleanName}.`))) {
                    filesToRemove.push(fName);
                }
            }
            const nameVariants = [name, `${name}.cls`, `${name}.trigger`, `${name}.page`, `${name}.component`].concat(cleanName ? [`${cleanName}.cls`, `${cleanName}.trigger`] : []);
            for (const variant of nameVariants) {
                if (currentFiles[variant] && !filesToRemove.includes(variant)) {
                    filesToRemove.push(variant);
                }
            }

            filesToRemove.forEach(fName => {
                delete currentFiles[fName];
                openTabPaths = openTabPaths.filter(p => p !== fName);
                if (activeFilePath === fName) {
                    activeFilePath = null;
                }
                if (rightActiveFilePath === fName) {
                    rightActiveFilePath = null;
                }
            });

            // 3. If we deleted the current bundle, clear bundle info
            if (currentBundleInfo.id === id || currentBundleInfo.name === name || currentBundleInfo.name === cleanName) {
                currentBundleInfo = { id: null, name: null, type: null };
            }

            // 4. Switch to next open tab or clear editor
            if (activeFilePath === null) {
                if (openTabPaths.length > 0) {
                    openFileInEditor(openTabPaths[openTabPaths.length - 1]);
                } else if (editorInstance) {
                    showEditorWelcome();
                    document.getElementById('editor-title').innerText = 'Code Editor';
                }
            }

            // 5. Re-render explorer tree & tabs immediately in real-time
            renderOrgExplorerTree();
            renderTabs();

            // 6. Background sync for full consistency
            fetchAllOrgMetadata(true).catch(() => { });
        } catch (e) {
            console.error('Error deleting asset:', e);
            setStatus(`Delete Failed: ${e.message}`, true);
            logToTerminal(`Delete Error for ${name}: ${e.message}`, 'error');
            addProblemDiagnostic(name, 1, 1, e.message);
        }
    }

    // Feature: Salesforce Code Snippets & Auto-Completion
    function registerSalesforceSnippets() {
        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: function () {
                const suggestions = [
                    {
                        label: 'import LWC Base',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "import { LightningElement, api, wire, track } from 'lwc';",
                        documentation: 'Import LWC base class and decorators'
                    },
                    {
                        label: 'import ShowToastEvent',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "import { ShowToastEvent } from 'lightning/platformShowToastEvent';",
                        documentation: 'Import Toast notification event'
                    },
                    {
                        label: 'import NavigationMixin',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "import { NavigationMixin } from 'lightning/navigation';",
                        documentation: 'Import NavigationMixin for page routing'
                    },
                    {
                        label: '@wire Apex Method',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "@wire(${1:apexMethodName}, { ${2:param}: '$${3:prop}' })\n${4:wiredProperty};",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Wire Apex method to property or function'
                    },
                    {
                        label: 'showToast Success',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "this.dispatchEvent(\n    new ShowToastEvent({\n        title: '${1:Success}',\n        message: '${2:Operation completed successfully}',\n        variant: 'success'\n    })\n);",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Dispatch success toast notification'
                    }
                ];
                return { suggestions: suggestions };
            }
        });

        monaco.languages.registerCompletionItemProvider('html', {
            provideCompletionItems: function () {
                const suggestions = [
                    {
                        label: 'template if:true',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '<template if:true={${1:condition}}>\n    $0\n</template>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Conditional rendering template'
                    },
                    {
                        label: 'template for:each',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '<template for:each={${1:list}} for:item="${2:item}">\n    <div key={${2:item}.id}>$0</div>\n</template>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Loop iterator template'
                    },
                    {
                        label: 'lightning-card',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '<lightning-card title="${1:Title}" icon-name="${2:standard:account}">\n    <div class="slds-m-around_medium">\n        $0\n    </div>\n</lightning-card>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'SLDS Lightning Card container'
                    },
                    {
                        label: 'lightning-button',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '<lightning-button label="${1:Submit}" variant="${2:brand}" onclick={${3:handleClick}}></lightning-button>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Lightning button element'
                    }
                ];
                return { suggestions: suggestions };
            }
        });

        monaco.languages.registerCompletionItemProvider('java', {
            provideCompletionItems: function () {
                const suggestions = [
                    {
                        label: 'System.debug',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "System.debug('${1:DEBUG}: ' + ${2:variable});",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Print debug statement'
                    },
                    {
                        label: '@AuraEnabled(cacheable=true)',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "@AuraEnabled(cacheable=true)\npublic static ${1:List<Account>} ${2:getRecords}() {\n    return [SELECT Id, Name FROM ${3:Account} LIMIT 50];\n}",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'AuraEnabled cacheable Apex method for LWC'
                    },
                    {
                        label: 'SOQL Query',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "List<${1:Account}> ${2:records} = [SELECT Id, Name FROM ${1:Account} WHERE ${3:IsActive} = true];",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Inline SOQL Query'
                    },
                    {
                        label: 'Try-Catch AuraHandledException',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "try {\n    $0\n} catch (Exception e) {\n    throw new AuraHandledException(e.getMessage());\n}",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Try-Catch block throwing AuraHandledException'
                    }
                ];
                return { suggestions: suggestions };
            }
        });

        if (pendingDeferredFileOpen) {
            const pending = pendingDeferredFileOpen;
            pendingDeferredFileOpen = null;
            openFileInEditor(pending);
        } else if (activeFilePath && currentFiles[activeFilePath] && !editorInstance) {
            openFileInEditor(activeFilePath);
        }
    }

    function updateSaveButtonState() {
        const btnSave = document.getElementById('btn-save-org');
        if (!btnSave) return;

        if (!activeFilePath || !currentFiles[activeFilePath] || currentFiles[activeFilePath].isTool) {
            btnSave.style.display = 'none';
            return;
        }

        const fileObj = currentFiles[activeFilePath];
        const isDirty = fileObj.isDirty === true || (fileObj.savedContent !== undefined && fileObj.content !== fileObj.savedContent);

        if (isDirty) {
            btnSave.style.display = 'flex';
            btnSave.disabled = false;
            btnSave.style.opacity = '1';
            btnSave.style.background = '#2ea043';
            btnSave.style.color = '#ffffff';
            btnSave.style.cursor = 'pointer';
            btnSave.style.boxShadow = '';
        } else {
            btnSave.style.display = 'none';
        }
    }

    function clearProblemsForFile(fileName) {
        const problemsBody = document.getElementById('terminal-body-problems');
        const badge = document.getElementById('problems-count');
        if (!problemsBody) return;

        const items = Array.from(problemsBody.querySelectorAll('.problem-item'));
        items.forEach(item => {
            if (item.innerText.includes(fileName)) {
                item.remove();
            }
        });

        const remaining = problemsBody.querySelectorAll('.problem-item').length;
        if (remaining === 0) {
            problemsBody.innerHTML = '<div style="color: #64748b; font-style: italic;">No compilation problems detected.</div>';
        } else {
            updateProblemsSummary();
        }
        if (badge) {
            badge.innerText = remaining;
            badge.style.display = remaining > 0 ? 'inline-block' : 'none';
        }

        if (currentFiles[fileName]) {
            currentFiles[fileName].hasError = false;
            renderTabs();
        }
    }

    function createStandardEditor(content = '// Select or create a component file to edit', language = 'javascript') {
        const container = document.getElementById('monaco-container-left');
        if (!container) return;

        // Fast path: a normal (non-diff) editor already exists — swap its model
        // instead of disposing + recreating the whole editor. Recreating on
        // every tab/file switch was the source of the visible jitter/flicker.
        if (editorInstance && !diffEditorInstance) {
            const oldModel = editorInstance.getModel();
            if (oldModel && typeof monaco !== 'undefined' && monaco.editor && typeof monaco.editor.createModel === 'function') {
                try {
                    editorInstance.setModel(monaco.editor.createModel(content, language));
                    oldModel.dispose();
                    applyEditorSettings(true);
                    coverageDecorationIds = [];
                    coverageOverlayEl = null;
                    diffDecorationIds = [];
                    updateMonacoInlineVariableDecorations();
                    runApexPmdScan(editorInstance);
                    return;
                } catch (e) {
                    console.warn('Editor model swap failed, falling back to recreate:', e);
                }
            }
        }

        if (editorInstance) {
            editorInstance.dispose();
            editorInstance = null;
        }
        if (diffEditorInstance) {
            diffEditorInstance.dispose();
            diffEditorInstance = null;
        }
        container.innerHTML = '';
        if (container.attributes) {
            Array.from(container.attributes).forEach(attr => {
                if (attr.name.startsWith('data-') || attr.name.includes('context')) {
                    container.removeAttribute(attr.name);
                }
            });
        }

        const theme = document.getElementById('setting-theme')?.value || 'sfarc-dark';
        const fontSize = parseInt(document.getElementById('setting-font-size')?.value || 13);
        const wordWrap = document.getElementById('setting-word-wrap')?.value || 'off';
        const minimapEnabled = document.getElementById('setting-minimap')?.value === 'on';
        const bracketColorEnabled = document.getElementById('setting-bracket-color')?.value === 'on';
        const lineNumbersMode = document.getElementById('setting-line-numbers')?.value || 'on';

        if (typeof monaco === 'undefined' || !monaco.editor || !isMonacoReady) {
            console.warn('Monaco Editor not ready yet, deferring editor creation...');
            if (activeFilePath) {
                pendingDeferredFileOpen = activeFilePath;
            }
            return;
        }

        try {
            editorInstance = monaco.editor.create(container, {
                value: content,
                language: language,
                theme: theme,
                fontSize: fontSize,
                wordWrap: wordWrap,
                lineNumbers: lineNumbersMode,
                minimap: { enabled: minimapEnabled },
                'bracketPairColorization.enabled': bracketColorEnabled,
                bracketPairColorization: { enabled: bracketColorEnabled },
                guides: { bracketPairs: bracketColorEnabled },
                automaticLayout: true,
                fontFamily: "'Fira Code', 'Consolas', monospace"
            });
        } catch (err) {
            // A runtime create failure (blocked worker / CSP) must never leave a
            // silent blank pane — surface the error state immediately.
            console.error('Monaco editor creation failed:', err);
            hideEditorLoader();
            container.innerHTML =
                '<div class="ce-editor-error">' +
                '<div class="ce-editor-error-icon">⚡</div>' +
                '<div class="ce-editor-error-title">Editor could not start</div>' +
                '<div class="ce-editor-error-sub">Monaco failed to create the editor. Reload the extension or reinstall from the ZIP, then try again.</div>' +
                '</div>';
            return;
        }

        // Re-apply persisted settings (minimap on/off, colors, line numbers...) so
        // a freshly created editor always honors them instead of Monaco defaults.
        applyEditorSettings(true);

        // A new file opened — drop any stale coverage decorations/overlay.
        coverageDecorationIds = [];
        coverageOverlayEl = null;

        editorInstance.onMouseWheel(handleEditorZoomWheel);

        let editorUiFrame = 0;
        let outlineRefreshTimer = 0;
        let diffRefreshTimer = 0;
        editorInstance.onDidChangeModelContent(() => {
            if (activeFilePath && currentFiles[activeFilePath]) {
                const fileObj = currentFiles[activeFilePath];
                fileObj.content = editorInstance.getValue();
                if (fileObj.savedContent === undefined) {
                    fileObj.savedContent = fileObj.content;
                }
                fileObj.isDirty = fileObj.content !== fileObj.savedContent;
                // Coalesce repeated Monaco events into one paint, and avoid a
                // full document outline parse for every character typed.
                if (!editorUiFrame) {
                    editorUiFrame = requestAnimationFrame(() => {
                        editorUiFrame = 0;
                        updateSaveButtonState();
                        renderTabs();
                    });
                }
                clearTimeout(outlineRefreshTimer);
                outlineRefreshTimer = setTimeout(renderDocumentOutline, 180);
                if (diffHighlightOn && diffHighlightFile === activeFilePath) {
                    clearTimeout(diffRefreshTimer);
                    diffRefreshTimer = setTimeout(applyDiffHighlights, 220);
                }
                runApexPmdScan(editorInstance);
            }
        });

        updateMonacoInlineVariableDecorations();
        runApexPmdScan(editorInstance);
    }

    function toggleSplitView() {
        const leftPane = document.getElementById('monaco-container-left');
        const rightPane = document.getElementById('monaco-container-right');
        const actBtnSplit = document.getElementById('act-btn-split');
        const selectBox = document.getElementById('right-pane-file-select');

        isSplitView = !isSplitView;

        if (isSplitView) {
            leftPane.classList.add('editor-pane-split');
            rightPane.style.display = 'block';
            rightPane.classList.add('editor-pane-split');

            if (actBtnSplit) actBtnSplit.classList.add('active');

            if (selectBox) {
                selectBox.innerHTML = '';
                openTabPaths.forEach(fileName => {
                    const opt = document.createElement('option');
                    opt.value = fileName;
                    opt.innerText = fileName;
                    selectBox.appendChild(opt);
                });

                rightActiveFilePath = openTabPaths.find(f => f !== activeFilePath) || activeFilePath;
                selectBox.value = rightActiveFilePath;
            }

            const theme = document.getElementById('setting-theme')?.value || 'sfarc-dark';
            const fontSize = parseInt(document.getElementById('setting-font-size')?.value || 13);
            const wordWrap = document.getElementById('setting-word-wrap')?.value || 'off';

            const fileObj = currentFiles[rightActiveFilePath] || { content: '', language: 'plaintext' };
            let lang = fileObj.language;
            if (lang === 'apex') lang = 'java';

            if (rightEditorInstance) {
                rightEditorInstance.dispose();
                rightEditorInstance = null;
            }

            rightEditorInstance = monaco.editor.create(rightPane, {
                value: fileObj.content,
                language: lang,
                theme: theme,
                fontSize: fontSize,
                wordWrap: wordWrap,
                lineNumbers: document.getElementById('setting-line-numbers')?.value || 'on',
                minimap: { enabled: document.getElementById('setting-minimap')?.value === 'on' },
                'bracketPairColorization.enabled': document.getElementById('setting-bracket-color')?.value === 'on',
                bracketPairColorization: { enabled: document.getElementById('setting-bracket-color')?.value === 'on' },
                guides: { bracketPairs: document.getElementById('setting-bracket-color')?.value === 'on' },
                automaticLayout: true,
                fontFamily: "'Fira Code', 'Consolas', monospace"
            });

            rightEditorInstance.onMouseWheel(handleEditorZoomWheel);

            rightEditorInstance.onDidChangeModelContent(() => {
                if (rightActiveFilePath && currentFiles[rightActiveFilePath]) {
                    currentFiles[rightActiveFilePath].content = rightEditorInstance.getValue();
                }
            });

            logToTerminal(`Split View enabled: Left Pane = ${activeFilePath}, Right Pane = ${rightActiveFilePath}`, 'info');
        } else {
            leftPane.classList.remove('editor-pane-split');
            rightPane.style.display = 'none';
            rightPane.classList.remove('editor-pane-split');

            if (actBtnSplit) actBtnSplit.classList.remove('active');

            if (rightEditorInstance) {
                rightEditorInstance.dispose();
                rightEditorInstance = null;
            }
            logToTerminal(`Exited Split View mode`, 'info');
        }
    }

    function switchRightPaneFile(fileName) {
        if (!currentFiles[fileName] || !rightEditorInstance) return;
        rightActiveFilePath = fileName;
        const fileObj = currentFiles[fileName];

        let lang = fileObj.language;
        if (lang === 'apex') lang = 'java';

        const model = monaco.editor.createModel(fileObj.content, lang);
        rightEditorInstance.setModel(model);
        logToTerminal(`Right Split Pane switched to ${fileName}`, 'info');
    }

    function toggleFindReplaceDrawer(forceShow = false) {
        const drawer = document.getElementById('find-replace-drawer');
        const actBtnFind = document.getElementById('act-btn-find-replace');
        if (!drawer) return;

        if (forceShow || drawer.style.display === 'none' || !drawer.style.display) {
            drawer.style.display = 'flex';
            if (actBtnFind) actBtnFind.classList.add('active');
            const input = document.getElementById('find-input');
            if (input) {
                input.focus();
                input.select();
            }
            performFindInEditor();
        } else {
            drawer.style.display = 'none';
            if (actBtnFind) actBtnFind.classList.remove('active');
        }
    }

    function performFindInEditor() {
        if (!editorInstance) return;

        const query = document.getElementById('find-input')?.value || '';
        const matchCountEl = document.getElementById('find-match-count');
        const model = editorInstance.getModel();

        if (!query || !model) {
            if (matchCountEl) matchCountEl.innerText = '0 matches';
            return;
        }

        const matches = model.findMatches(
            query,
            false,
            findState.isRegex,
            findState.isCaseSensitive,
            findState.isWholeWord ? ' ' : null,
            true
        );

        if (matchCountEl) {
            matchCountEl.innerText = `${matches.length} matches`;
        }

        if (matches.length > 0) {
            editorInstance.setSelection(matches[0].range);
            editorInstance.revealRangeInCenter(matches[0].range);
        }
    }

    function replaceCurrentMatch() {
        if (!editorInstance) return;
        const replaceText = document.getElementById('replace-input')?.value || '';
        const selection = editorInstance.getSelection();

        if (selection) {
            editorInstance.executeEdits('find-replace', [{
                range: selection,
                text: replaceText,
                forceMoveMarkers: true
            }]);
            performFindInEditor();
        }
    }

    function replaceAllMatches() {
        if (!editorInstance) return;
        const query = document.getElementById('find-input')?.value || '';
        const replaceText = document.getElementById('replace-input')?.value || '';
        const model = editorInstance.getModel();

        if (!query || !model) return;

        const matches = model.findMatches(
            query,
            false,
            findState.isRegex,
            findState.isCaseSensitive,
            findState.isWholeWord ? ' ' : null,
            true
        );

        const edits = matches.map(m => ({
            range: m.range,
            text: replaceText,
            forceMoveMarkers: true
        }));

        editorInstance.executeEdits('find-replace-all', edits);
        performFindInEditor();
        logToTerminal(`Replaced ${matches.length} occurrences of '${query}' with '${replaceText}'`, 'success');
    }

    function renderDocumentOutline() {
        const container = document.getElementById('outline-tree');
        if (!container || !activeFilePath || !currentFiles[activeFilePath]) return;

        const content = currentFiles[activeFilePath].content || '';
        const lines = content.split('\n');
        const symbols = [];

        lines.forEach((lineText, idx) => {
            const lineNum = idx + 1;
            const trimmed = lineText.trim();

            if (activeFilePath.endsWith('.js')) {
                if (trimmed.startsWith('export default class') || trimmed.startsWith('class ')) {
                    symbols.push({ name: trimmed.split('{')[0].trim(), line: lineNum, icon: 'fa-cube', color: '#f7df1e' });
                } else if (trimmed.includes('@wire(')) {
                    symbols.push({ name: trimmed.split('{')[0].trim(), line: lineNum, icon: 'fa-bolt', color: '#ff9800' });
                } else if (trimmed.match(/^(async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/)) {
                    const match = trimmed.match(/^(async\s+)?([a-zA-Z0-9_]+)/);
                    if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[2])) {
                        symbols.push({ name: `${match[2]}()`, line: lineNum, icon: 'fa-code-branch', color: 'var(--sfarc-accent-glow, #38bdf8)' });
                    }
                }
            } else if (activeFilePath.endsWith('.cls') || activeFilePath.endsWith('.trigger')) {
                if (trimmed.includes(' class ') || trimmed.includes(' trigger ')) {
                    symbols.push({ name: trimmed.split('{')[0].trim(), line: lineNum, icon: 'fa-cube', color: 'var(--sfarc-accent-glow, #38bdf8)' });
                } else if (trimmed.includes('@AuraEnabled')) {
                    symbols.push({ name: '@AuraEnabled Method', line: lineNum, icon: 'fa-bolt', color: '#4ade80' });
                } else if (trimmed.match(/(public|private|protected)\s+(static\s+)?([\w<>]+\s+)+([a-zA-Z0-9_]+)\s*\(/)) {
                    const match = trimmed.match(/([a-zA-Z0-9_]+)\s*\(/);
                    if (match) {
                        symbols.push({ name: `${match[1]}()`, line: lineNum, icon: 'fa-code-branch', color: '#c084fc' });
                    }
                }
            }
        });

        container.innerHTML = '';
        if (symbols.length === 0) {
            container.innerHTML = '<div style="padding: 6px 12px; color: #64748b; font-style: italic; font-size: 11px;">No method symbols detected.</div>';
            return;
        }

        symbols.forEach(s => {
            const item = document.createElement('div');
            item.className = 'outline-item';
            item.innerHTML = `
                <i class="fa-solid ${s.icon}" style="color: ${s.color}; font-size: 11px;"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(s.name)}</span>
                <span style="font-size: 10px; color: #858585;">:${s.line}</span>
            `;

            item.onclick = () => {
                if (editorInstance) {
                    editorInstance.revealPositionInCenter({ lineNumber: s.line, column: 1 });
                    editorInstance.setPosition({ lineNumber: s.line, column: 1 });
                    editorInstance.focus();
                }
            };

            container.appendChild(item);
        });
    }

    function saveRevisionSnapshot() {
        if (!activeFilePath || !currentFiles[activeFilePath]) return;

        const fileObj = currentFiles[activeFilePath];
        const key = `sfarc_history_${activeFilePath}`;
        let history = JSON.parse(localStorage.getItem(key) || '[]');

        const newRevision = {
            id: Date.now(),
            timeStr: new Date().toLocaleTimeString(),
            dateStr: new Date().toLocaleDateString(),
            lineCount: (fileObj.content || '').split('\n').length,
            content: fileObj.content
        };

        history.unshift(newRevision);
        if (history.length > 10) history = history.slice(0, 10);

        localStorage.setItem(key, JSON.stringify(history));
    }

    function renderRevisionHistory() {
        const container = document.getElementById('terminal-body-revisions');
        if (!container || !activeFilePath) return;

        const key = `sfarc_history_${activeFilePath}`;
        const history = JSON.parse(localStorage.getItem(key) || '[]');

        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div style="color: #64748b; font-style: italic;">No local edit revisions saved for this file yet. Save edits to create snapshots.</div>';
            return;
        }

        history.forEach((rev, idx) => {
            const item = document.createElement('div');
            item.className = 'revision-item';
            item.innerHTML = `
                <div class="revision-head">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span><strong class="revision-title">Revision #${history.length - idx}</strong> <span class="revision-time">(${rev.timeStr} - ${rev.dateStr})</span></span>
                    <span class="revision-lines">${rev.lineCount} lines</span>
                </div>
                <button class="revision-restore">
                    <i class="fa-solid fa-rotate-left"></i> Restore This Version
                </button>
            `;

            item.querySelector('button').onclick = () => {
                if (currentFiles[activeFilePath] && editorInstance) {
                    currentFiles[activeFilePath].content = rev.content;
                    createStandardEditor(rev.content, currentFiles[activeFilePath].language);
                    logToTerminal(`Restored revision from ${rev.timeStr}`, 'success');
                }
            };

            container.appendChild(item);
        });
    }

    function generateLwcMetaXml(componentName, apiVersion = 60.0) {
        const isExposed = document.getElementById('feature-is-exposed')?.checked !== false;
        const isApp = document.getElementById('target-app')?.checked;
        const isRecord = document.getElementById('target-record')?.checked;
        const isHome = document.getElementById('target-home')?.checked;
        const isUtility = document.getElementById('target-utility')?.checked;
        const isCommunity = document.getElementById('target-community')?.checked;
        const isFlow = document.getElementById('target-flow')?.checked;
        const isQuickAction = document.getElementById('target-quick-action')?.checked;
        const isTab = document.getElementById('target-tab')?.checked;

        let targetsXml = '';
        if (isExposed) {
            if (isApp) targetsXml += '        <target>lightning__AppPage</target>\n';
            if (isRecord) targetsXml += '        <target>lightning__RecordPage</target>\n';
            if (isHome) targetsXml += '        <target>lightning__HomePage</target>\n';
            if (isUtility) targetsXml += '        <target>lightning__UtilityBar</target>\n';
            if (isCommunity) targetsXml += '        <target>lightningCommunity__Page</target>\n';
            if (isFlow) targetsXml += '        <target>lightning__FlowScreen</target>\n';
            if (isQuickAction) targetsXml += '        <target>lightning__RecordAction</target>\n';
            if (isTab) targetsXml += '        <target>lightning__Tab</target>\n';
        }

        const targetsBlock = (isExposed && targetsXml) ? `    <targets>\n${targetsXml}    </targets>\n` : '';
        const quickActionType = document.getElementById('quick-action-type')?.value || 'ScreenAction';
        const targetConfigs = isExposed && isQuickAction ? `    <targetConfigs>\n        <targetConfig targets="lightning__RecordAction">\n            <actionType>${quickActionType}</actionType>\n        </targetConfig>\n    </targetConfigs>\n` : '';
        const description = (document.getElementById('lwc-description')?.value || '').trim();
        const esc = value => String(value).replace(/[<>&'\"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));

        return `<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>${apiVersion}</apiVersion>\n    <isExposed>${isExposed}</isExposed>\n    <masterLabel>${esc(componentName)}</masterLabel>\n${description ? `    <description>${esc(description)}</description>\n` : ''}${targetsBlock}${targetConfigs}</LightningComponentBundle>`;
    }

    let currentFontSize = 13;
    let fontSizeSaveTimer = 0;

    function syncFontSizeUi() {
        const fontDisplay = document.getElementById('font-size-display');
        const settingFontSelect = document.getElementById('setting-font-size');
        if (fontDisplay) fontDisplay.innerText = `${currentFontSize}px`;
        if (settingFontSelect) {
            let option = Array.from(settingFontSelect.options).find(opt => Number(opt.value) === currentFontSize);
            if (!option) {
                option = new Option(`${currentFontSize}px`, String(currentFontSize));
                settingFontSelect.add(option);
            }
            settingFontSelect.value = String(currentFontSize);
        }
    }

    function setEditorFontSize(value, options = {}) {
        const nextSize = Math.max(8, Math.min(40, Math.round(Number(value) || 13)));
        const changed = nextSize !== currentFontSize;
        currentFontSize = nextSize;

        if (editorInstance) {
            editorInstance.updateOptions({ fontSize: currentFontSize });
        }
        if (rightEditorInstance) {
            rightEditorInstance.updateOptions({ fontSize: currentFontSize });
        }
        if (diffEditorInstance) {
            diffEditorInstance.updateOptions({ fontSize: currentFontSize });
            diffEditorInstance.getOriginalEditor()?.updateOptions({ fontSize: currentFontSize });
            diffEditorInstance.getModifiedEditor()?.updateOptions({ fontSize: currentFontSize });
        }

        syncFontSizeUi();

        if (options.persist !== false && changed) {
            clearTimeout(fontSizeSaveTimer);
            fontSizeSaveTimer = setTimeout(saveAllEditorSettings, 220);
        }
        if (options.announce !== false && changed) {
            logToTerminal(`Editor font size updated to ${currentFontSize}px`, 'info');
        }
    }

    function changeFontSize(delta) {
        setEditorFontSize(currentFontSize + delta);
    }

    function resetEditorFontSize() {
        setEditorFontSize(13);
    }

    function isEditorZoomShortcut(e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
        const diffOriginal = diffEditorInstance?.getOriginalEditor?.();
        const diffModified = diffEditorInstance?.getModifiedEditor?.();
        return !!(
            editorInstance?.hasTextFocus?.() ||
            rightEditorInstance?.hasTextFocus?.() ||
            diffOriginal?.hasTextFocus?.() ||
            diffModified?.hasTextFocus?.()
        );
    }

    let lastEditorZoomWheelAt = 0;
    function handleEditorZoomWheel(e) {
        const browserEvent = e?.browserEvent;
        if (!browserEvent || (!browserEvent.ctrlKey && !browserEvent.metaKey)) return;
        browserEvent.preventDefault();
        browserEvent.stopPropagation();

        // Trackpad pinch emits a rapid stream of Ctrl+wheel events. Throttle it
        // to readable 1px steps instead of jumping through the full zoom range.
        const now = performance.now();
        if (now - lastEditorZoomWheelAt < 45) return;
        lastEditorZoomWheelAt = now;
        changeFontSize(browserEvent.deltaY < 0 ? 1 : -1);
    }

    function saveAllEditorSettings() {
        const settingsObj = {
            theme: document.getElementById('setting-theme')?.value || 'sfarc-dark',
            fontFamily: document.getElementById('setting-font-family')?.value || "'Fira Code', 'Consolas', monospace",
            fontSize: parseInt(document.getElementById('setting-font-size')?.value || 13),
            wordWrap: document.getElementById('setting-word-wrap')?.value || 'off',
            minimap: document.getElementById('setting-minimap')?.value || 'off',
            bracketColor: document.getElementById('setting-bracket-color')?.value || 'on',
            lineNumbers: document.getElementById('setting-line-numbers')?.value || 'on',
            formatOnSave: document.getElementById('setting-format-on-save')?.value || 'on',
            launchMode: document.getElementById('setting-launch-mode')?.value || 'tab'
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarc_editor_settings: settingsObj, sfarc_editor_launch_mode: settingsObj.launchMode });
        } else {
            localStorage.setItem('sfarc_editor_settings', JSON.stringify(settingsObj));
        }
    }

    let isAutoDeployEnabled = true;

    function updateDeployModeUI() {
        const btnDeployMode = document.getElementById('status-deploy-mode');
        const iconToggle = document.getElementById('deploy-toggle-icon');
        const labelToggle = document.getElementById('deploy-mode-label');

        if (!btnDeployMode || !iconToggle || !labelToggle) return;

        if (isAutoDeployEnabled) {
            iconToggle.className = 'fa-solid fa-toggle-on';
            iconToggle.style.color = '#4ade80';
            labelToggle.textContent = 'Deploy on Save: ON';
            btnDeployMode.title = 'Deploy on Save is enabled. Cmd+S / Ctrl+S saves and deploys the current file to the connected Salesforce org. Click for local-only saves.';
        } else {
            iconToggle.className = 'fa-solid fa-toggle-off';
            iconToggle.style.color = '#94a3b8';
            labelToggle.textContent = 'Deploy on Save: OFF';
            btnDeployMode.title = 'Deploy on Save is disabled. Cmd+S / Ctrl+S keeps changes as a local draft and does not update Salesforce. Click to deploy when saving.';
        }
    }

    function toggleDeployMode() {
        isAutoDeployEnabled = !isAutoDeployEnabled;
        updateDeployModeUI();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarc_auto_deploy_enabled: isAutoDeployEnabled });
        } else {
            localStorage.setItem('sfarc_auto_deploy_enabled', String(isAutoDeployEnabled));
        }
        logToTerminal(`Auto-Deployment to Salesforce Org ${isAutoDeployEnabled ? 'ENABLED' : 'DISABLED'}`, isAutoDeployEnabled ? 'info' : 'warn');
    }

    function restoreAllEditorSettings() {
        const applySettingsObj = (s) => {
            if (!s) return;
            if (s.theme && document.getElementById('setting-theme')) document.getElementById('setting-theme').value = s.theme;
            if (s.fontFamily && document.getElementById('setting-font-family')) document.getElementById('setting-font-family').value = s.fontFamily;
            if (s.fontSize && document.getElementById('setting-font-size')) document.getElementById('setting-font-size').value = String(s.fontSize);
            if (s.wordWrap && document.getElementById('setting-word-wrap')) document.getElementById('setting-word-wrap').value = s.wordWrap;
            if (s.minimap && document.getElementById('setting-minimap')) document.getElementById('setting-minimap').value = s.minimap;
            if (s.bracketColor && document.getElementById('setting-bracket-color')) document.getElementById('setting-bracket-color').value = s.bracketColor;
            if (s.lineNumbers && document.getElementById('setting-line-numbers')) document.getElementById('setting-line-numbers').value = s.lineNumbers;
            if (s.formatOnSave && document.getElementById('setting-format-on-save')) document.getElementById('setting-format-on-save').value = s.formatOnSave;
            if (s.launchMode && document.getElementById('setting-launch-mode')) document.getElementById('setting-launch-mode').value = s.launchMode;

            applyEditorSettings(true);
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['sfarc_editor_settings', 'sfarc_auto_deploy_enabled'], (res) => {
                if (res && res.sfarc_editor_settings) {
                    applySettingsObj(res.sfarc_editor_settings);
                }
                if (res && typeof res.sfarc_auto_deploy_enabled !== 'undefined') {
                    isAutoDeployEnabled = res.sfarc_auto_deploy_enabled;
                    updateDeployModeUI();
                }
            });
        } else {
            const raw = localStorage.getItem('sfarc_editor_settings');
            if (raw) {
                try { applySettingsObj(JSON.parse(raw)); } catch (e) { }
            }
            const savedDeployMode = localStorage.getItem('sfarc_auto_deploy_enabled');
            if (savedDeployMode !== null) {
                isAutoDeployEnabled = savedDeployMode === 'true';
                updateDeployModeUI();
            }
        }
    }

    function saveSessionState() {
        try {
            if (activeFilePath && currentFiles[activeFilePath] && editorInstance && !currentFiles[activeFilePath].isTool) {
                currentFiles[activeFilePath].content = editorInstance.getValue();
            }

            const sessionObj = {
                openTabPaths: openTabPaths,
                activeFilePath: activeFilePath,
                currentFiles: currentFiles,
                toolStates: toolStates
            };

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [sessionStateKey]: sessionObj });
            } else {
                localStorage.setItem(sessionStateKey, JSON.stringify(sessionObj));
            }
        } catch (e) { }
    }

    function restoreSessionState() {
        const applySessionObj = (data) => {
            if (!data) return;
            if (data.toolStates) toolStates = { ...toolStates, ...data.toolStates };
            if (data.currentFiles && Object.keys(data.currentFiles).length > 0) {
                currentFiles = { ...currentFiles, ...data.currentFiles };
            }
            if (Array.isArray(data.openTabPaths) && data.openTabPaths.length > 0) {
                // Merge unique tab paths
                data.openTabPaths.forEach(p => {
                    if (!openTabPaths.includes(p)) openTabPaths.push(p);
                });
            }
            renderTabs();
            if (data.activeFilePath && currentFiles[data.activeFilePath]) {
                openFileInEditor(data.activeFilePath);
            } else if (openTabPaths.length > 0) {
                openFileInEditor(openTabPaths[0]);
            }
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([sessionStateKey], (res) => {
                if (res && res[sessionStateKey]) {
                    applySessionObj(res[sessionStateKey]);
                }
            });
        } else {
            const raw = localStorage.getItem(sessionStateKey);
            if (raw) {
                try { applySessionObj(JSON.parse(raw)); } catch (e) { }
            }
        }
    }

    function applyAppTheme(themeName) {
        const root = document.documentElement;
        document.body.setAttribute('data-theme', themeName);
        const iconToggle = document.getElementById('theme-toggle-icon');
        const actBtnTheme = document.getElementById('act-btn-theme');
        const selectTheme = document.getElementById('setting-theme');

        if (selectTheme) selectTheme.value = themeName;

        if (themeName === 'sfarc-light') {
            root.style.setProperty('--bg-main', '#ffffff');
            root.style.setProperty('--bg-sidebar', '#f3f3f3');
            root.style.setProperty('--bg-activity', '#f3f3f3');
            root.style.setProperty('--bg-header', '#f3f3f3');
            root.style.setProperty('--bg-tab', '#ececec');
            root.style.setProperty('--bg-tab-active', '#ffffff');
            root.style.setProperty('--bg-terminal', '#ffffff');
            root.style.setProperty('--bg-terminal-header', '#f3f3f3');
            root.style.setProperty('--bg-input', '#ffffff');
            root.style.setProperty('--border-color', '#e5e5e5');
            root.style.setProperty('--text-main', '#333333');
            root.style.setProperty('--text-muted', '#616161');
            root.style.setProperty('--text-active', '#000000');
            root.style.setProperty('--item-hover', '#e8e8e8');
            root.style.setProperty('--item-active', '#e4e6f1');
            root.style.setProperty('--icon-color', '#424242');

            // Rich dark vibrant log colors for Light Mode readability
            root.style.setProperty('--log-info-color', '#0284c7');
            root.style.setProperty('--log-success-color', '#15803d'); // Deep dark green for crisp readability on white
            root.style.setProperty('--log-warn-color', '#b45309');
            root.style.setProperty('--log-error-color', '#b91c1c');

            if (iconToggle) {
                iconToggle.className = 'fa-solid fa-sun';
                iconToggle.style.color = '#f59e0b';
            }
            if (actBtnTheme) actBtnTheme.title = 'Theme: Light (Click for AMOLED)';
        } else if (themeName === 'sfarc-amoled') {
            root.style.setProperty('--bg-main', '#000000');
            root.style.setProperty('--bg-sidebar', '#000000');
            root.style.setProperty('--bg-activity', '#000000');
            root.style.setProperty('--bg-header', '#000000');
            root.style.setProperty('--bg-tab', '#0a0a0a');
            root.style.setProperty('--bg-tab-active', '#000000');
            root.style.setProperty('--bg-terminal', '#000000');
            root.style.setProperty('--bg-terminal-header', '#0a0a0a');
            root.style.setProperty('--bg-input', '#0a0a0a');
            root.style.setProperty('--border-color', '#1a1a1a');
            root.style.setProperty('--text-main', '#e2e8f0');
            root.style.setProperty('--text-muted', '#64748b');
            root.style.setProperty('--text-active', '#ffffff');
            root.style.setProperty('--item-hover', '#121212');
            root.style.setProperty('--item-active', '#1e1e1e');
            root.style.setProperty('--icon-color', '#94a3b8');

            root.style.setProperty('--log-info-color', 'var(--sfarc-accent-glow, #38bdf8)');
            root.style.setProperty('--log-success-color', '#4ade80');
            root.style.setProperty('--log-warn-color', '#facc15');
            root.style.setProperty('--log-error-color', '#f87171');

            if (iconToggle) {
                iconToggle.className = 'fa-solid fa-circle';
                iconToggle.style.color = 'var(--sfarc-accent-glow, #38bdf8)';
            }
            if (actBtnTheme) actBtnTheme.title = 'Theme: AMOLED Pitch Black (Click for Dark)';
        } else {
            // Default Dark Theme (sfarc-dark)
            root.style.setProperty('--bg-main', '#1e1e1e');
            root.style.setProperty('--bg-sidebar', '#181818');
            root.style.setProperty('--bg-activity', '#181818');
            root.style.setProperty('--bg-header', '#181818');
            root.style.setProperty('--bg-tab', '#2d2d2d');
            root.style.setProperty('--bg-tab-active', '#1e1e1e');
            root.style.setProperty('--bg-terminal', '#181818');
            root.style.setProperty('--bg-terminal-header', '#252526');
            root.style.setProperty('--bg-input', '#2d2d2d');
            root.style.setProperty('--border-color', '#252526');
            root.style.setProperty('--text-main', '#cccccc');
            root.style.setProperty('--text-muted', '#858585');
            root.style.setProperty('--text-active', '#ffffff');
            root.style.setProperty('--item-hover', '#2a2d2e');
            root.style.setProperty('--item-active', '#37373d');
            root.style.setProperty('--icon-color', '#858585');

            root.style.setProperty('--log-info-color', 'var(--sfarc-accent-glow, #38bdf8)');
            root.style.setProperty('--log-success-color', '#4ade80');
            root.style.setProperty('--log-warn-color', '#fbbf24');
            root.style.setProperty('--log-error-color', '#f87171');

            if (iconToggle) {
                iconToggle.className = 'fa-solid fa-moon';
                iconToggle.style.color = '#cbd5e1';
            }
            if (actBtnTheme) actBtnTheme.title = 'Theme: Dark (Click for Light)';
        }

        if (typeof monaco !== 'undefined' && monaco.editor) {
            monaco.editor.setTheme(themeName);
        }
    }

    function cycleAppTheme() {
        const currentTheme = document.getElementById('setting-theme')?.value || 'sfarc-dark';
        let nextTheme = 'sfarc-light';
        if (currentTheme === 'sfarc-dark') nextTheme = 'sfarc-light';
        else if (currentTheme === 'sfarc-light') nextTheme = 'sfarc-amoled';
        else if (currentTheme === 'sfarc-amoled') nextTheme = 'sfarc-dark';

        applyAppTheme(nextTheme);
        saveAllEditorSettings();
        logToTerminal(`Switched Editor Theme to: ${nextTheme === 'sfarc-light' ? 'VS Code Light+' : nextTheme === 'sfarc-amoled' ? 'AMOLED Pitch Black' : 'VS Code Dark+'}`, 'info');
    }

    function applyEditorSettings(skipSave = false) {
        const theme = document.getElementById('setting-theme')?.value || 'sfarc-dark';
        const fontFamily = document.getElementById('setting-font-family')?.value || "'Fira Code', 'Consolas', monospace";
        const fontSize = parseInt(document.getElementById('setting-font-size')?.value || 13);
        const wordWrap = document.getElementById('setting-word-wrap')?.value || 'off';
        const minimapEnabled = document.getElementById('setting-minimap')?.value === 'on';
        const bracketColorEnabled = document.getElementById('setting-bracket-color')?.value === 'on';
        const lineNumbersMode = document.getElementById('setting-line-numbers')?.value || 'on';
        const launchMode = document.getElementById('setting-launch-mode')?.value || 'tab';

        applyAppTheme(theme);

        if (!skipSave) saveAllEditorSettings();

        currentFontSize = Math.max(8, Math.min(40, fontSize));
        syncFontSizeUi();

        if (typeof monaco !== 'undefined' && monaco.editor) {
            const opts = {
                fontSize: currentFontSize,
                fontFamily: fontFamily,
                wordWrap: wordWrap,
                lineNumbers: lineNumbersMode,
                minimap: { enabled: minimapEnabled },
                'bracketPairColorization.enabled': bracketColorEnabled,
                bracketPairColorization: { enabled: bracketColorEnabled },
                guides: { bracketPairs: bracketColorEnabled }
            };

            if (editorInstance) editorInstance.updateOptions(opts);
            if (rightEditorInstance) rightEditorInstance.updateOptions(opts);
            if (diffEditorInstance) {
                diffEditorInstance.updateOptions(opts);
                diffEditorInstance.getOriginalEditor()?.updateOptions(opts);
                diffEditorInstance.getModifiedEditor()?.updateOptions(opts);
            }
        }

    }

    async function executeAnonymousApex() {
        const code = document.getElementById('apex-code-input').value.trim();
        if (!code) {
            toast.error('Please enter Apex code to execute.');
            return;
        }

        const btnExec = document.getElementById('apex-modal-exec');
        const origBtnHtml = btnExec ? btnExec.innerHTML : '';
        if (btnExec) {
            btnExec.disabled = true;
            btnExec.innerHTML = `<span class="comet-loader-inline"></span> Executing...`;
        }

        document.getElementById('exec-apex-modal').style.display = 'none';
        logToTerminal(`Executing Anonymous Apex via Tooling API...`, 'info');

        try {
            const endpoint = `/services/data/v60.0/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`;
            const res = await sfApiRest(endpoint, { method: 'GET' });

            if (res.compiled && res.success) {
                logToTerminal(`Anonymous Apex Executed Successfully!`, 'success');
                fetchLatestDebugLogs();
            } else if (!res.compiled) {
                logToTerminal(`Compilation Failure (Line ${res.line}, Col ${res.column}): ${res.compileProblem}`, 'error');
                addProblemDiagnostic('AnonymousApex', res.line, res.column, res.compileProblem);
            } else {
                logToTerminal(`Execution Exception (Line ${res.line}): ${res.exceptionMessage}\n${res.exceptionStackTrace}`, 'error');
                addProblemDiagnostic('AnonymousApex', res.line, res.column, res.exceptionMessage);
            }

            if (btnExec) {
                btnExec.innerHTML = origBtnHtml;
                btnExec.disabled = false;
            }
        } catch (e) {
            console.error('Error executing Anonymous Apex:', e);
            logToTerminal(`Anonymous Apex Error: ${e.message}`, 'error');
            if (btnExec) {
                btnExec.innerHTML = origBtnHtml;
                btnExec.disabled = false;
            }
        }
    }

    async function fetchLatestDebugLogs() {
        try {
            const logRes = await window.sfApi.query(`SELECT Id, LogLength, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT 1`, true);
            if (!logRes || !logRes.records || !logRes.records[0]) return;

            const logId = logRes.records[0].Id;
            const endpoint = `/services/data/v60.0/tooling/sobjects/ApexLog/${logId}/Body`;
            const rawLog = await sfApiRest(endpoint, { method: 'GET' });

            if (typeof rawLog === 'string') {
                const lines = rawLog.split('\n');
                const debugLines = lines.filter(l => l.includes('|USER_DEBUG|'));

                if (debugLines.length > 0) {
                    logToTerminal(`--- Live System.debug Logs ---`, 'info');
                    debugLines.forEach(line => {
                        const parts = line.split('|USER_DEBUG|');
                        const msg = parts[1] ? parts[1].replace(/\[\d+\]\|[A-Z]+\|/, '') : line;
                        logToTerminal(`DEBUG output: ${msg}`, 'success');
                    });
                }
            }
        } catch (e) {
            console.error('Error fetching Apex logs:', e);
        }
    }

    function performGlobalSearch(query) {
        const resultsContainer = document.getElementById('global-search-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        const q = (query || '').toLowerCase().trim();

        if (!q) {
            resultsContainer.innerHTML = '<div style="color: #64748b; font-style: italic; font-size: 12px;">Type a keyword above to search Org code.</div>';
            return;
        }

        let matches = [];

        Object.keys(currentFiles).forEach(fileName => {
            const content = currentFiles[fileName].content || '';
            const lines = content.split('\n');

            lines.forEach((lineText, idx) => {
                if (lineText.toLowerCase().includes(q)) {
                    matches.push({
                        fileName: fileName,
                        lineNum: idx + 1,
                        lineContent: lineText.trim()
                    });
                }
            });
        });

        if (matches.length === 0) {
            resultsContainer.innerHTML = `<div style="color: #94a3b8; font-size: 12px;">No matches found for '<strong>${escapeHtml(query)}</strong>' in active workspace files.</div>`;
            return;
        }

        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 500; color: var(--sfarc-accent-glow, #38bdf8);">
                    <span>${getFileIconHtml(m.fileName)} ${m.fileName}</span>
                    <span style="font-size: 11px; color: #94a3b8;">Line ${m.lineNum}</span>
                </div>
                <div style="font-family: 'Fira Code', monospace; font-size: 11px; color: #cccccc; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(m.lineContent)}
                </div>
            `;

            item.onclick = () => {
                document.getElementById('global-search-modal').style.display = 'none';
                openFileInEditor(m.fileName);
                if (editorInstance) {
                    editorInstance.revealPositionInCenter({ lineNumber: m.lineNum, column: 1 });
                    editorInstance.setPosition({ lineNumber: m.lineNum, column: 1 });
                    editorInstance.focus();
                }
            };

            resultsContainer.appendChild(item);
        });
    }

    async function toggleOrgDiffMode() {
        const actBtnCompare = document.getElementById('act-btn-compare-org');
        if (!activeFilePath || !currentFiles[activeFilePath]) {
            toast.error('Please select an active file to compare with Org.');
            return;
        }

        if (isDiffMode) {
            isDiffMode = false;
            if (actBtnCompare) actBtnCompare.classList.remove('active');
            openFileInEditor(activeFilePath);
            logToTerminal(`Exited Diff view for ${activeFilePath}`, 'info');
            return;
        }

        const fileObj = currentFiles[activeFilePath];
        logToTerminal(`Fetching original Org source for ${activeFilePath}...`, 'info');

        try {
            let orgSource = '';

            if (currentBundleInfo.type === 'lwc' && fileObj.id) {
                const res = await window.sfApi.query(`SELECT Source FROM LightningComponentResource WHERE Id = '${fileObj.id}'`, true);
                if (res && res.records && res.records[0]) {
                    orgSource = res.records[0].Source || '';
                }
            } else if (currentBundleInfo.type === 'apex' && fileObj.id) {
                const res = await window.sfApi.query(`SELECT Body FROM ApexClass WHERE Id = '${fileObj.id}'`, true);
                if (res && res.records && res.records[0]) {
                    orgSource = res.records[0].Body || '';
                }
            }

            isDiffMode = true;
            if (actBtnCompare) actBtnCompare.classList.add('active');

            const container = document.getElementById('monaco-container-left');
            if (editorInstance) {
                editorInstance.dispose();
                editorInstance = null;
            }
            if (diffEditorInstance) {
                diffEditorInstance.dispose();
                diffEditorInstance = null;
            }
            container.innerHTML = '';
            if (container.attributes) {
                Array.from(container.attributes).forEach(attr => {
                    if (attr.name.startsWith('data-') || attr.name.includes('context')) {
                        container.removeAttribute(attr.name);
                    }
                });
            }

            diffEditorInstance = monaco.editor.createDiffEditor(container, {
                theme: 'sfarc-dark',
                automaticLayout: true,
                readOnly: false,
                fontSize: currentFontSize,
                fontFamily: "'Fira Code', 'Consolas', monospace"
            });

            let monacoLang = fileObj.language;
            if (monacoLang === 'apex') monacoLang = 'java';

            const originalModel = monaco.editor.createModel(orgSource, monacoLang);
            const modifiedModel = monaco.editor.createModel(fileObj.content, monacoLang);

            diffEditorInstance.setModel({
                original: originalModel,
                modified: modifiedModel
            });

            diffEditorInstance.getOriginalEditor().onMouseWheel(handleEditorZoomWheel);
            diffEditorInstance.getModifiedEditor().onMouseWheel(handleEditorZoomWheel);

            modifiedModel.onDidChangeContent(() => {
                fileObj.content = modifiedModel.getValue();
            });

            logToTerminal(`Comparing ${activeFilePath}: Left = Org Version, Right = Local Workspace Edits`, 'success');
        } catch (e) {
            console.error('Error in Diff view:', e);
            logToTerminal(`Failed to open Diff view: ${e.message}`, 'error');
        }
    }

    // ── Apex Test Run UI helpers ──
    let testRunCardEl = null;
    let testRunStartTs = 0;
    let coverageDecorationIds = [];
    let coverageOverlayEl = null;

    function getTestRunCard() {
        const outputBody = document.getElementById('terminal-body-output');
        if (!outputBody) return null;
        if (!testRunCardEl || !document.body.contains(testRunCardEl)) {
            testRunCardEl = document.createElement('div');
            testRunCardEl.className = 'testrun-card';
            outputBody.insertBefore(testRunCardEl, outputBody.firstChild);
        }
        return testRunCardEl;
    }

    function formatElapsed(ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    }

    function updateTestRunCard(opts) {
        const card = getTestRunCard();
        if (!card) return;
        card.classList.remove('done', 'failed');
        if (opts.state === 'done') card.classList.add('done');
        else if (opts.state === 'failed') card.classList.add('failed');
        card.innerHTML = `
            <div class="testrun-head">
                <div class="testrun-spinner"></div>
                <span class="testrun-title">${escapeHtml(opts.title)}</span>
                <span class="testrun-status">${escapeHtml(opts.status)}</span>
            </div>
            <div class="testrun-meta">
                ${opts.jobId ? `<span>Job: <code>${escapeHtml(opts.jobId)}</code></span>` : ''}
                <span>Elapsed: <b>${formatElapsed(opts.elapsedMs || 0)}</b></span>
            </div>
            ${opts.progress != null ? `<div class="testrun-bar"><div class="testrun-bar-fill" style="width:${Math.max(2, Math.min(100, opts.progress))}%;"></div></div>` : ''}
        `;
        const outputBody = document.getElementById('terminal-body-output');
        if (outputBody) outputBody.scrollTop = outputBody.scrollHeight;
    }

    function renderTestRunResults(results, targetClassName) {
        const card = getTestRunCard();
        if (!card) return;
        const passed = results.filter(t => t.Outcome === 'Pass').length;
        const failed = results.length - passed;
        card.classList.remove('done', 'failed');
        card.classList.add(failed === 0 ? 'done' : 'failed');
        card.innerHTML = `
            <div class="testrun-head">
                <div class="testrun-spinner"></div>
                <span class="testrun-title">Apex Test Run — ${escapeHtml(targetClassName)}</span>
                <span class="testrun-status">${failed === 0 ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="testrun-results">
                <div class="testrun-count total"><b>${results.length}</b> Tests</div>
                <div class="testrun-count pass"><b>${passed}</b> Passed</div>
                <div class="testrun-count fail"><b>${failed}</b> Failed</div>
            </div>
            ${results.length ? `<div class="testrun-list">
                ${results.map(t => {
                    const pass = t.Outcome === 'Pass';
                    const msg = pass ? '' : String(t.Message || '').split('\n')[0].slice(0, 120);
                    return `<div class="testrun-row ${pass ? 'pass' : 'fail'}" data-method="${escapeHtml(t.MethodName || '')}" title="Click to jump to ${escapeHtml(t.MethodName || '')}">
                        <i class="fa-solid ${pass ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color:${pass ? '#2ea043' : '#f87171'}; flex-shrink: 0;"></i>
                        <span class="t-name">${escapeHtml(t.MethodName || '(unnamed)')}</span>
                        ${msg ? `<span class="t-msg" title="${escapeHtml(msg)}">${escapeHtml(msg)}</span>` : ''}
                        <span class="t-outcome">${pass ? 'Pass' : 'Fail'}</span>
                    </div>`;
                }).join('')}
            </div>` : ''}
        `;
        card.querySelectorAll('.testrun-row').forEach(row => {
            row.addEventListener('click', () => jumpToTestMethod(row.getAttribute('data-method')));
        });
        const outputBody = document.getElementById('terminal-body-output');
        if (outputBody) outputBody.scrollTop = outputBody.scrollHeight;
    }

    function jumpToTestMethod(methodName) {
        if (!editorInstance || !methodName) return;
        const model = editorInstance.getModel();
        let targetLine = 1;
        if (model) {
            const lines = model.getLinesContent();
            for (let i = 0; i < lines.length; i++) {
                const text = lines[i] || '';
                if (text.includes(methodName + '(') && (/testMethod/i.test(text) || /@isTest/i.test(text) || new RegExp('\\b' + methodName + '\\s*\\(').test(text))) {
                    targetLine = i + 1;
                    break;
                }
            }
        }
        editorInstance.revealPositionInCenter({ lineNumber: targetLine, column: 1 });
        editorInstance.setPosition({ lineNumber: targetLine, column: 1 });
        editorInstance.focus();
    }

    // ── Coverage highlighting (Monaco decorations + floating badge) ──
    function clearCoverageDecorations() {
        if (editorInstance && typeof monaco !== 'undefined' && monaco.editor) {
            try {
                coverageDecorationIds = editorInstance.deltaDecorations(coverageDecorationIds, []);
            } catch (e) {
                coverageDecorationIds = [];
            }
        } else {
            coverageDecorationIds = [];
        }
        if (coverageOverlayEl && coverageOverlayEl.parentNode) {
            coverageOverlayEl.parentNode.removeChild(coverageOverlayEl);
        }
        coverageOverlayEl = null;
    }

    function showCoverageOverlay(pct, className) {
        const container = document.getElementById('monaco-container-left');
        if (!container) return;
        if (coverageOverlayEl && coverageOverlayEl.parentNode) coverageOverlayEl.parentNode.removeChild(coverageOverlayEl);
        const overlay = document.createElement('div');
        overlay.className = 'cov-overlay' + (pct < 75 ? ' warn' : '');
        overlay.innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${escapeHtml(className)} — ${pct}% covered
            <button class="cov-close" title="Hide coverage highlight"><i class="fa-solid fa-xmark"></i></button>`;
        overlay.querySelector('.cov-close').addEventListener('click', (e) => {
            e.stopPropagation();
            clearCoverageDecorations();
        });
        container.appendChild(overlay);
        coverageOverlayEl = overlay;
    }

    function applyCoverageDecorations(coveredLines, pct, className) {
        if (!editorInstance || typeof monaco === 'undefined' || !monaco.editor) return;
        const isTarget = activeFilePath && className &&
            (activeFilePath.toLowerCase().endsWith((className + '.cls').toLowerCase()) ||
             activeFilePath.toLowerCase().endsWith((className + '.trigger').toLowerCase()));
        if (!isTarget) {
            clearCoverageDecorations();
            return;
        }
        const model = editorInstance.getModel();
        if (!model) return;
        const lineCount = model.getLineCount();
        const decorations = [];
        for (let l = 1; l <= lineCount; l++) {
            if (coveredLines.has(l)) {
                decorations.push({
                    range: new monaco.Range(l, 1, l, 1000),
                    options: {
                        isWholeLine: true,
                        className: 'cov-line-covered-bg',
                        glyphMarginClassName: 'cov-glyph-covered'
                    }
                });
            } else {
                decorations.push({
                    range: new monaco.Range(l, 1, l, 1000),
                    options: {
                        isWholeLine: true,
                        className: 'cov-line-uncovered-bg',
                        glyphMarginClassName: 'cov-glyph-uncovered'
                    }
                });
            }
        }
        coverageDecorationIds = editorInstance.deltaDecorations(coverageDecorationIds, decorations);
        showCoverageOverlay(pct, className);
    }

    async function runApexTests() {
        let targetClassId = currentBundleInfo.type === 'apex' ? currentBundleInfo.id : null;
        let targetClassName = currentBundleInfo.type === 'apex' ? currentBundleInfo.name : null;

        if (!targetClassId) {
            const classNameInput = await toast.prompt('Enter Apex Test Class Name to run (e.g. AccountControllerTest):');
            if (!classNameInput || !classNameInput.trim()) return;

            targetClassName = classNameInput.trim();
            const res = await window.sfApi.query(`SELECT Id, Name FROM ApexClass WHERE Name = '${targetClassName}'`, true);
            if (res && res.records && res.records[0]) {
                targetClassId = res.records[0].Id;
            } else {
                toast.error(`Apex Class '${targetClassName}' not found in Org.`);
                return;
            }
        }

        const actBtnRun = document.getElementById('act-btn-run-tests');
        if (actBtnRun) actBtnRun.classList.add('active');

        testRunStartTs = Date.now();
        updateTestRunCard({ title: `Running tests for ${targetClassName}`, status: 'Queued', elapsedMs: 0, progress: 4 });

        logToTerminal(`Submitting Apex Test execution for '${targetClassName}' (ID: ${targetClassId})...`, 'info');

        try {
            const runRes = await sfApiRest('/services/data/v60.0/tooling/runTestsAsynchronous', {
                method: 'POST',
                body: JSON.stringify({ classids: targetClassId })
            });

            const jobId = typeof runRes === 'string' ? runRes.replace(/"/g, '') : (runRes.id || runRes);
            updateTestRunCard({ title: `Running tests for ${targetClassName}`, status: 'Queued', jobId, elapsedMs: Date.now() - testRunStartTs, progress: 8 });
            logToTerminal(`Apex Test Run queued with Job ID: ${jobId}. Polling execution status...`, 'info');

            let attempts = 0;
            let finished = false;
            let lastStatus = '';

            while (attempts < 20 && !finished) {
                await new Promise(r => setTimeout(r, 1500));
                attempts++;

                const queueRes = await window.sfApi.query(`SELECT Id, Status, ExtendedStatus FROM ApexTestQueueItem WHERE ParentJobId = '${jobId}'`, true);
                const items = queueRes.records || [];
                const status = items[0] ? items[0].Status : 'Processing';

                if (status !== lastStatus) {
                    lastStatus = status;
                    if (status !== 'Completed' && status !== 'Failed' && status !== 'Aborted') {
                        logToTerminal(`Apex Test Run status: ${status}...`, 'info');
                    }
                }

                const statusLabel = status === 'Completed' ? 'Completed' : status === 'Failed' ? 'Failed' : status === 'Aborted' ? 'Aborted' : 'Running';
                updateTestRunCard({
                    title: `Running tests for ${targetClassName}`,
                    status: statusLabel,
                    jobId,
                    elapsedMs: Date.now() - testRunStartTs,
                    progress: finished ? 100 : Math.min(90, 8 + Math.round((attempts / 20) * 82))
                });

                if (status === 'Completed' || status === 'Failed' || status === 'Aborted') {
                    finished = true;
                }
            }

            updateTestRunCard({ title: `Running tests for ${targetClassName}`, status: 'Fetching results', jobId, elapsedMs: Date.now() - testRunStartTs, progress: 95 });

            const testRes = await window.sfApi.query(`SELECT Id, ApexClass.Name, MethodName, Outcome, Message, StackTrace FROM ApexTestResult WHERE AsyncApexJobId = '${jobId}'`, true);
            const results = testRes.records || [];

            const passed = results.filter(t => t.Outcome === 'Pass').length;
            const failed = results.length - passed;

            results.forEach(t => {
                if (t.Outcome !== 'Pass') {
                    addProblemDiagnostic(`${t.ApexClass.Name}.cls`, 1, 1, `Test Failure in ${t.MethodName}: ${t.Message}`);
                }
            });

            renderTestRunResults(results, targetClassName);
            logToTerminal(`Apex Test Execution Summary for ${targetClassName}: ${passed} Passed, ${failed} Failed out of ${results.length} total tests.`, failed === 0 ? 'success' : 'error');

            fetchCodeCoverage(targetClassId, targetClassName);
            if (actBtnRun) actBtnRun.classList.remove('active');
        } catch (e) {
            console.error('Error running Apex tests:', e);
            updateTestRunCard({ title: `Test run failed for ${targetClassName}`, status: 'Error', elapsedMs: Date.now() - testRunStartTs, progress: 100, state: 'failed' });
            logToTerminal(`Apex Test Runner Error: ${e.message}`, 'error');
            if (actBtnRun) actBtnRun.classList.remove('active');
        }
    }

    async function fetchCodeCoverage(classId, className) {
        try {
            const covRes = await window.sfApi.query(`SELECT NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId = '${classId}'`, true);
            const records = covRes.records || [];

            const coverageBody = document.getElementById('terminal-body-coverage');
            const coverageBadge = document.getElementById('coverage-badge');

            if (!records[0]) {
                if (coverageBody) coverageBody.innerHTML = `<div style="color: #64748b; font-style: italic;">No code coverage data returned for ${escapeHtml(className)}.</div>`;
                return;
            }

            const rec = records[0];
            const covered = rec.NumLinesCovered || 0;
            const uncovered = rec.NumLinesUncovered || 0;
            const total = covered + uncovered;
            const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

            if (coverageBadge) {
                coverageBadge.innerText = `${pct}%`;
                coverageBadge.style.display = 'inline-block';
                coverageBadge.style.background = pct >= 75 ? 'rgba(46, 160, 67, 0.3)' : 'rgba(248, 113, 113, 0.3)';
                coverageBadge.style.color = pct >= 75 ? 'var(--accent-green, #2ea043)' : '#f87171';
            }

            if (coverageBody) {
                coverageBody.innerHTML = `
                    <div class="cov-container">
                        <div class="cov-header">
                            <div class="cov-title"><i class="fa-solid fa-chart-pie"></i> Code Coverage Summary <span class="cov-file">${escapeHtml(className)}</span></div>
                            <div class="cov-pct ${pct >= 75 ? 'ok' : 'low'}">${pct}%</div>
                        </div>
                        <div class="cov-bar"><div class="cov-bar-fill ${pct >= 75 ? 'ok' : 'low'}" style="width:${pct}%;"></div></div>
                        <div class="cov-meta">
                            <span class="cov-stat covered"><i class="fa-solid fa-circle-check"></i> ${covered} lines covered</span>
                            <span class="cov-stat missed"><i class="fa-solid fa-circle-xmark"></i> ${uncovered} lines missed</span>
                            <span class="cov-stat"><i class="fa-solid fa-layer-group"></i> ${total} total</span>
                        </div>
                    </div>
                `;
            }

            // Highlight covered/uncovered lines in the editor with a % badge
            try {
                let ranges = rec.Coverage;
                if (typeof ranges === 'string') ranges = JSON.parse(ranges || '[]');
                if (Array.isArray(ranges)) {
                    const coveredLines = new Set();
                    ranges.forEach(r => {
                        (r.positions || []).forEach(p => {
                            const start = parseInt(p.line, 10) || 1;
                            const end = parseInt(p.endLine, 10) || start;
                            for (let l = start; l <= end; l++) coveredLines.add(l);
                        });
                    });
                    applyCoverageDecorations(coveredLines, pct, className);
                } else {
                    clearCoverageDecorations();
                }
            } catch (e) {
                console.error('Coverage range parse error:', e);
                clearCoverageDecorations();
            }

            showTerminalTab('coverage');
            logToTerminal(`Code Coverage for ${className}: ${pct}% (${covered}/${total} lines covered)`, 'info');
        } catch (e) {
            console.error('Error fetching code coverage:', e);
        }
    }

    async function handleOpenAssetMsg(params) {
        if (!params) return;

        const type = (params.type || '').toLowerCase();

        // Defense in depth: never load an asset that belongs to a different org.
        // (The background routes OPEN_ASSET to the right editor tab, but if a
        // stale tab or direct message slips through, refuse the wrong-org asset.)
        if (params.host && editorOrgHost && params.host.toLowerCase() !== editorOrgHost) {
            console.warn(`[code-editor] Ignoring OPEN_ASSET for ${params.name || params.id || 'asset'} from org ${params.host} — this editor is bound to ${editorOrgHost}.`);
            setStatus(`Ignored asset from another org (${params.host}). This editor is bound to ${editorOrgHost}.`, true);
            return;
        }

        try {
            if (params.bundleId || params.bundleName || type === 'lwc') {
                await loadLwcBundle(params.bundleId, params.bundleName || params.name);
            } else if (params.auraId || params.auraName || type === 'aura') {
                await loadAuraBundle(params.auraId, params.auraName || params.name);
            } else if (params.triggerId || params.triggerName || type === 'trigger' || type === 'apextrigger') {
                await loadApexTrigger(params.triggerId, params.triggerName || params.name);
            } else if (params.pageId || params.pageName || type === 'vfpage' || type === 'apexpage') {
                await loadVfPage(params.pageId, params.pageName || params.name);
            } else if (params.compId || params.compName || type === 'vfcomponent' || type === 'apexcomponent') {
                await loadVfComponent(params.compId, params.compName || params.name);
            } else if (params.apexId || params.apexName || params.id || params.name || type === 'apex' || type === 'apexclass') {
                await loadApexAsset(params.apexId || params.id, params.apexName || params.name);
            }
        } catch (e) {
            console.error('Error handling OPEN_ASSET message in code-editor:', e);
        }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'OPEN_ASSET') {
                handleOpenAssetMsg(msg.params);
                sendResponse({ success: true });
            }
        });
    }

    async function loadInitialAsset() {
        await initSession();
        fetchAllOrgMetadata();

        if (paramBundleId || paramBundleName) {
            await loadLwcBundle(paramBundleId, paramBundleName);
        } else if (paramTriggerId || paramTriggerName) {
            await loadApexTrigger(paramTriggerId, paramTriggerName);
        } else if (paramPageId || paramPageName) {
            await loadVfPage(paramPageId, paramPageName);
        } else if (paramApexId || paramApexName) {
            await loadApexAsset(paramApexId, paramApexName);
        } else if (paramOpenTool === 'bulk-permission-wizard') {
            // The wizard lives on its own page now — never inside the editor.
            const host = window.location.hostname;
            window.location.href = 'bulk-permission-wizard.html?host=' + encodeURIComponent(host);
        } else if (paramOpenTool) {
            // Deep-link: open a tool tab directly.
            setStatus('Ready.');
            updateHeaderContextButtons();
            setTimeout(() => {
                try {
                    openToolTab(paramOpenTool);
                } catch (e) {
                    console.error('Failed to auto-open tool tab:', paramOpenTool, e);
                }
            }, 50);
        } else {
            setStatus('Ready. Select an asset from Org Explorer or click "+ New Component / Class".');
            updateHeaderContextButtons();
            // Restore previously open tabs / active file / tool states (never restored before)
            restoreSessionState();
        }
    }

    async function fetchAllOrgMetadata(forceRefresh = false) {
        return loadOrgMetadataTree(forceRefresh);
    }

    let orgMetadataLoadSequence = 0;

    function renderOrgExplorerState(type, detail) {
        const tree = document.getElementById('file-tree');
        if (!tree) return;
        if (tree.setAttribute) tree.setAttribute('aria-busy', type === 'loading' ? 'true' : 'false');
        if (type === 'loading') {
            tree.innerHTML = `
                <div class="org-explorer-state" role="status" aria-live="polite">
                    <span class="comet-loader" aria-hidden="true"></span>
                    <div class="org-explorer-state-title">Loading org assets…</div>
                    <div class="org-explorer-state-detail">${escapeHtml(detail || 'Fetching metadata from Salesforce.')}</div>
                    <div class="org-explorer-skeleton" aria-hidden="true">
                        <div class="org-explorer-skeleton-row"></div><div class="org-explorer-skeleton-row"></div>
                        <div class="org-explorer-skeleton-row"></div><div class="org-explorer-skeleton-row"></div>
                    </div>
                </div>`;
        } else if (type === 'error') {
            tree.innerHTML = `
                <div class="org-explorer-state" role="alert">
                    <span class="material-symbols-rounded" aria-hidden="true">cloud_off</span>
                    <div class="org-explorer-state-title">Couldn’t load org assets</div>
                    <div class="org-explorer-state-detail">${escapeHtml(detail || 'Check the Salesforce connection and try again.')}</div>
                    <button type="button" class="org-explorer-retry">Retry</button>
                </div>`;
            tree.querySelector('.org-explorer-retry')?.addEventListener('click', () => loadOrgMetadataTree(true));
        }
    }

    async function loadOrgMetadataTree(forceRefresh = false) {
        const loadSequence = ++orgMetadataLoadSequence;
        const btnRefreshOrg = document.getElementById('btn-refresh-org');
        if (btnRefreshOrg) btnRefreshOrg.classList.add('fa-spin');
        renderOrgExplorerState('loading', forceRefresh ? 'Refreshing metadata from Salesforce.' : 'Fetching metadata from Salesforce.');

        if (!window.sfApi && typeof initSfApi === 'function') {
            await initSfApi();
        }

        if (!window.sfApi) {
            logToTerminal('Salesforce Session API not initialized. Please connect to an active Salesforce Org.', 'warn');
            if (loadSequence === orgMetadataLoadSequence) {
                renderOrgExplorerState('error', 'No active Salesforce session was found.');
            }
            if (btnRefreshOrg) btnRefreshOrg.classList.remove('fa-spin');
            return;
        }

        if (forceRefresh) {
            invalidateOrgMetadataCache();
        }

        try {
            const results = await Promise.allSettled([
                cachedSfApiQuery(`SELECT Id, Name FROM ApexClass ORDER BY Name`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, Name, TableEnumOrId FROM ApexTrigger ORDER BY Name`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, DeveloperName FROM LightningComponentBundle ORDER BY DeveloperName`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, DeveloperName FROM AuraDefinitionBundle ORDER BY DeveloperName`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, Name FROM ApexPage ORDER BY Name`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, Name FROM ApexComponent ORDER BY Name`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, DeveloperName, MasterLabel, Description, IsExposed FROM LightningMessageChannel ORDER BY DeveloperName`, true, forceRefresh),
                cachedSfApiQuery(`SELECT Id, DeveloperName, MasterLabel, Description FROM GenAiFunction ORDER BY DeveloperName`, true, forceRefresh)
            ]);

            // A refresh can overlap the initial request. Never let the older,
            // slower response overwrite newer explorer data.
            if (loadSequence !== orgMetadataLoadSequence) return;
            const valueAt = (index) => results[index].status === 'fulfilled' ? results[index].value : { records: [] };
            const [apexRes, trigRes, lwcRes, auraRes, vfPageRes, vfCompRes, lmsRes, agentforceRes] = results.map((_, i) => valueAt(i));

            orgMetadata.apexClasses = apexRes.records || [];
            orgMetadata.apexTriggers = trigRes.records || [];
            orgMetadata.lwcBundles = lwcRes.records || [];
            orgMetadata.auraBundles = auraRes.records || [];
            orgMetadata.vfPages = vfPageRes.records || [];
            orgMetadata.vfComponents = vfCompRes.records || [];
            orgMetadata.lmsChannels = lmsRes.records || [];
            orgMetadata.agentforceTypes = agentforceRes.records || [];

            const failedCount = results.filter(result => result.status === 'rejected').length;
            if (failedCount === results.length) {
                const firstFailure = results.find(result => result.status === 'rejected');
                throw firstFailure?.reason || new Error('All metadata requests failed.');
            }
            if (failedCount) {
                logToTerminal(`Org Explorer loaded with ${failedCount} unavailable metadata ${failedCount === 1 ? 'category' : 'categories'}.`, 'warn');
            }

            cachedSfApiQuery(`SELECT QualifiedApiName FROM EntityDefinition WHERE IsQueryable = true ORDER BY QualifiedApiName`, true, forceRefresh).then(sobjRes => {
                if (sobjRes && sobjRes.records && sobjRes.records.length > 0) {
                    const datalist = document.getElementById('sobjects-datalist');
                    if (datalist) {
                        datalist.innerHTML = sobjRes.records.map(r => `<option value="${escapeHtml(r.QualifiedApiName || '')}">`).join('');
                    }
                }
            }).catch(() => { });

            renderOrgExplorerTree();
        } catch (e) {
            console.error('Error fetching org metadata:', e);
            logToTerminal(`Failed to fetch Org Explorer tree: ${e.message}`, 'error');
            if (loadSequence === orgMetadataLoadSequence) renderOrgExplorerState('error', cleanErrorMessage(e.message));
        } finally {
            if (loadSequence === orgMetadataLoadSequence && btnRefreshOrg) btnRefreshOrg.classList.remove('fa-spin');
        }
    }

    async function loadLwcBundle(bundleId, bundleName, openInSidePane = false) {
        if (focusIfBundleLoaded(bundleName, openInSidePane)) return;
        setStatus(`Loading LWC Bundle: ${bundleName || bundleId}...`);
        logToTerminal(`Fetching LightningComponentBundle '${bundleName || bundleId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading LWC: ${bundleName || bundleId}`);

        try {
            let targetId = bundleId;

            if (!targetId && bundleName) {
                const bundleRes = await cachedSfApiQuery(`SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName = '${bundleName}'`, true);
                if (bundleRes && bundleRes.records && bundleRes.records.length > 0) {
                    targetId = bundleRes.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`LightningComponentBundle '${bundleName}' not found.`);

            const res = await cachedSfApiQuery(`SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId = '${targetId}' ORDER BY FilePath`, true);
            const records = res.records || [];

            if (!openInSidePane) {
                currentBundleInfo = { id: targetId, name: bundleName, type: 'lwc' };
                document.getElementById('editor-title').innerText = `LWC: ${bundleName || targetId}`;
                updateHeaderContextButtons();
            }

            let loadedFileNames = [];
            records.forEach(r => {
                const pathParts = r.FilePath.split('/');
                const fileName = pathParts[pathParts.length - 1];

                let lang = 'plaintext';
                if (fileName.endsWith('.js')) lang = 'javascript';
                else if (fileName.endsWith('.html')) lang = 'html';
                else if (fileName.endsWith('.css')) lang = 'css';
                else if (fileName.endsWith('.svg')) lang = 'xml';
                else if (fileName.endsWith('.xml')) lang = 'xml';

                currentFiles[fileName] = {
                    id: r.Id,
                    filePath: r.FilePath,
                    content: r.Source || '',
                    language: lang,
                    bundleName: bundleName
                };

                if (!openTabPaths.includes(fileName)) {
                    openTabPaths.push(fileName);
                }
                loadedFileNames.push(fileName);
            });

            renderOrgExplorerTree();

            const primaryFile = loadedFileNames.find(f => f.endsWith('.js') || f.endsWith('.html')) || loadedFileNames[0];

            if (openInSidePane) {
                if (!isSplitView) {
                    toggleSplitView();
                }
                if (primaryFile) switchRightPaneFile(primaryFile);
                logToTerminal(`Loaded LWC '${bundleName}' into Right Split Pane (${primaryFile})`, 'success');
            } else {
                if (primaryFile) openFileInEditor(primaryFile);
                setStatus(`Loaded LWC Bundle ${bundleName || targetId} (${records.length} files)`);
                logToTerminal(`Successfully loaded LWC Bundle '${bundleName || targetId}' (${records.length} files)`, 'success');
            }
        } catch (e) {
            console.error('Error loading LWC:', e);
            setStatus(`Error loading LWC: ${e.message}`, true);
            logToTerminal(`Error loading LWC Bundle: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadAuraBundle(auraId, auraName, openInSidePane = false) {
        if (focusIfBundleLoaded(auraName, openInSidePane)) return;
        setStatus(`Loading Aura Bundle: ${auraName || auraId}...`);
        logToTerminal(`Fetching AuraDefinitionBundle '${auraName || auraId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading Aura: ${auraName || auraId}`);

        try {
            let targetId = auraId;

            if (!targetId && auraName) {
                const res = await window.sfApi.query(`SELECT Id, DeveloperName FROM AuraDefinitionBundle WHERE DeveloperName = '${auraName}'`, true);
                if (res && res.records && res.records[0]) {
                    targetId = res.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`AuraDefinitionBundle '${auraName}' not found.`);

            const defRes = await window.sfApi.query(`SELECT Id, AuraDefinitionBundleId, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${targetId}' ORDER BY DefType`, true);
            const records = defRes.records || [];

            if (!openInSidePane) {
                currentBundleInfo = { id: targetId, name: auraName, type: 'aura' };
                document.getElementById('editor-title').innerText = `Aura: ${auraName || targetId}`;
                updateHeaderContextButtons();
            }

            let loadedFileNames = [];
            records.forEach(r => {
                let ext = '.cmp';
                let lang = 'html';
                const type = (r.DefType || 'COMPONENT').toUpperCase();

                if (type === 'COMPONENT') { ext = '.cmp'; lang = 'html'; }
                else if (type === 'CONTROLLER') { ext = 'Controller.js'; lang = 'javascript'; }
                else if (type === 'HELPER') { ext = 'Helper.js'; lang = 'javascript'; }
                else if (type === 'STYLE') { ext = '.css'; lang = 'css'; }
                else if (type === 'RENDERER') { ext = 'Renderer.js'; lang = 'javascript'; }
                else if (type === 'DOCUMENTATION') { ext = '.auradoc'; lang = 'xml'; }
                else if (type === 'DESIGN') { ext = '.design'; lang = 'xml'; }
                else if (type === 'SVG') { ext = '.svg'; lang = 'xml'; }
                else if (type === 'APPLICATION') { ext = '.app'; lang = 'html'; }
                else if (type === 'EVENT') { ext = '.evt'; lang = 'html'; }
                else if (type === 'INTERFACE') { ext = '.intf'; lang = 'html'; }

                const fileName = `${auraName}${ext}`;

                currentFiles[fileName] = {
                    id: r.Id,
                    content: r.Source || '',
                    language: lang,
                    bundleName: auraName,
                    defType: r.DefType
                };

                if (!openTabPaths.includes(fileName)) {
                    openTabPaths.push(fileName);
                }
                loadedFileNames.push(fileName);
            });

            renderOrgExplorerTree();

            const primaryFile = loadedFileNames.find(f => f.endsWith('.cmp') || f.endsWith('.app') || f.endsWith('Controller.js')) || loadedFileNames[0];

            if (openInSidePane) {
                if (!isSplitView) toggleSplitView();
                if (primaryFile) switchRightPaneFile(primaryFile);
                logToTerminal(`Loaded Aura Bundle '${auraName}' into Right Split Pane (${primaryFile})`, 'success');
            } else {
                if (primaryFile) openFileInEditor(primaryFile);
                setStatus(`Loaded Aura Bundle ${auraName} (${records.length} definition files)`);
                logToTerminal(`Successfully loaded Aura Bundle '${auraName}' (${records.length} files)`, 'success');
            }
        } catch (e) {
            console.error('Error loading Aura:', e);
            setStatus(`Error loading Aura: ${e.message}`, true);
            logToTerminal(`Error loading Aura Bundle: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    // ── Already-open guards ──────────────────────────────────────────────
    // Clicking an already-open file in the explorer must focus it, never
    // re-fetch it. Re-fetching flashed the loader overlay, rebuilt the whole
    // explorer tree (a wave of fades) and spammed the terminal with duplicate
    // "Fetching …" logs — the "bounce" on every repeat click.
    function focusIfAlreadyLoaded(fileName, openInSidePane = false) {
        if (openInSidePane) return false;
        if (!fileName || !currentFiles[fileName]) return false;
        openFileInEditor(fileName);
        setStatus(`${fileName} — already open`);
        return true;
    }

    // LWC/Aura bundles own several files keyed by their bundleName. If any of
    // them are already loaded, focus the primary file instead of re-fetching.
    function findBundlePrimaryFile(bundleName) {
        if (!bundleName) return null;
        const files = Object.keys(currentFiles).filter(k => currentFiles[k] && currentFiles[k].bundleName === bundleName);
        if (!files.length) return null;
        return files.find(f => /\.(js|html|cmp)$/.test(f)) || files[0];
    }

    function focusIfBundleLoaded(bundleName, openInSidePane = false) {
        if (openInSidePane) return false;
        const primary = findBundlePrimaryFile(bundleName);
        if (!primary) return false;
        openFileInEditor(primary);
        setStatus(`${bundleName} — already open`);
        return true;
    }

    async function loadApexAsset(apexId, apexName) {
        if (focusIfAlreadyLoaded(apexName ? `${apexName}.cls` : '')) return;
        setStatus(`Loading Apex: ${apexName || apexId}...`);
        logToTerminal(`Fetching ApexClass '${apexName || apexId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading Apex: ${apexName || apexId}`);

        try {
            let targetId = apexId;

            if (!targetId && apexName) {
                const apexRes = await cachedSfApiQuery(`SELECT Id, Name FROM ApexClass WHERE Name = '${apexName}'`, true);
                if (apexRes && apexRes.records && apexRes.records.length > 0) {
                    targetId = apexRes.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`ApexClass '${apexName}' not found.`);

            const res = await cachedSfApiQuery(`SELECT Id, Name, Body FROM ApexClass WHERE Id = '${targetId}'`, true);
            const cls = res.records[0];

            currentBundleInfo = { id: targetId, name: cls.Name, type: 'apex' };
            document.getElementById('editor-title').innerText = `Apex: ${cls.Name}`;
            updateHeaderContextButtons();

            const fileName = `${cls.Name}.cls`;
            currentFiles[fileName] = {
                id: cls.Id,
                filePath: fileName,
                content: cls.Body || '',
                language: 'apex'
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }

            openFileInEditor(fileName);
            setStatus(`Loaded Apex Class ${cls.Name}`);
            logToTerminal(`Successfully loaded Apex Class '${cls.Name}'`, 'success');

            // Auto-fetch inline code coverage like Dev Console
            fetchCodeCoverage(targetId, cls.Name).catch(() => {});
        } catch (e) {
            console.error('Error loading Apex:', e);
            setStatus(`Error loading Apex: ${e.message}`, true);
            logToTerminal(`Error loading Apex Class: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadApexTrigger(triggerId, triggerName) {
        if (focusIfAlreadyLoaded(triggerName ? `${triggerName}.trigger` : '')) return;
        setStatus(`Loading Trigger: ${triggerName || triggerId}...`);
        logToTerminal(`Fetching ApexTrigger '${triggerName || triggerId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading Trigger: ${triggerName || triggerId}`);

        try {
            let targetId = triggerId;
            if (!targetId && triggerName) {
                const trigRes = await cachedSfApiQuery(`SELECT Id, Name FROM ApexTrigger WHERE Name = '${triggerName}'`, true);
                if (trigRes && trigRes.records && trigRes.records.length > 0) {
                    targetId = trigRes.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`ApexTrigger '${triggerName}' not found.`);

            const res = await cachedSfApiQuery(`SELECT Id, Name, Body, TableEnumOrId FROM ApexTrigger WHERE Id = '${targetId}'`, true);
            const trig = res.records[0];

            currentBundleInfo = { id: targetId, name: trig.Name, type: 'trigger' };
            document.getElementById('editor-title').innerText = `Trigger: ${trig.Name}`;
            updateHeaderContextButtons();

            const fileName = `${trig.Name}.trigger`;
            currentFiles[fileName] = {
                id: trig.Id,
                filePath: fileName,
                content: trig.Body || '',
                language: 'apex'
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }

            openFileInEditor(fileName);
            setStatus(`Loaded Apex Trigger ${trig.Name}`);
            logToTerminal(`Successfully loaded Apex Trigger '${trig.Name}'`, 'success');
        } catch (e) {
            console.error('Error loading Trigger:', e);
            setStatus(`Error loading Trigger: ${e.message}`, true);
            logToTerminal(`Error loading Apex Trigger: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadVfPage(pageId, pageName) {
        if (focusIfAlreadyLoaded(pageName ? `${pageName}.page` : '')) return;
        setStatus(`Loading Visualforce Page: ${pageName || pageId}...`);
        logToTerminal(`Fetching ApexPage '${pageName || pageId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading VF Page: ${pageName || pageId}`);

        try {
            let targetId = pageId;
            if (!targetId && pageName) {
                const pageRes = await cachedSfApiQuery(`SELECT Id, Name FROM ApexPage WHERE Name = '${pageName}'`, true);
                if (pageRes && pageRes.records && pageRes.records.length > 0) {
                    targetId = pageRes.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`ApexPage '${pageName}' not found.`);

            const res = await cachedSfApiQuery(`SELECT Id, Name, Markup FROM ApexPage WHERE Id = '${targetId}'`, true);
            const page = res.records[0];

            currentBundleInfo = { id: targetId, name: page.Name, type: 'vfpage' };
            document.getElementById('editor-title').innerText = `VF Page: ${page.Name}`;
            updateHeaderContextButtons();

            const fileName = `${page.Name}.page`;
            currentFiles[fileName] = {
                id: page.Id,
                filePath: fileName,
                content: page.Markup || '',
                language: 'html'
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }

            openFileInEditor(fileName);
            setStatus(`Loaded Visualforce Page ${page.Name}`);
            logToTerminal(`Successfully loaded Visualforce Page '${page.Name}'`, 'success');
        } catch (e) {
            console.error('Error loading Visualforce Page:', e);
            setStatus(`Error loading VF Page: ${e.message}`, true);
            logToTerminal(`Error loading Visualforce Page: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadVfComponent(compId, compName) {
        if (focusIfAlreadyLoaded(compName ? `${compName}.component` : '')) return;
        setStatus(`Loading Visualforce Component: ${compName || compId}...`);
        logToTerminal(`Fetching ApexComponent '${compName || compId}' via Tooling API...`, 'info');
        showEditorLoader(`Loading VF Component: ${compName || compId}`);

        try {
            let targetId = compId;
            if (!targetId && compName) {
                const compRes = await cachedSfApiQuery(`SELECT Id, Name FROM ApexComponent WHERE Name = '${compName}'`, true);
                if (compRes && compRes.records && compRes.records.length > 0) {
                    targetId = compRes.records[0].Id;
                }
            }

            if (!targetId) throw new Error(`ApexComponent '${compName}' not found.`);

            const res = await cachedSfApiQuery(`SELECT Id, Name, Markup FROM ApexComponent WHERE Id = '${targetId}'`, true);
            const comp = res.records[0];

            currentBundleInfo = { id: targetId, name: comp.Name, type: 'vfcomponent' };
            document.getElementById('editor-title').innerText = `VF Component: ${comp.Name}`;
            updateHeaderContextButtons();

            const fileName = `${comp.Name}.component`;
            currentFiles[fileName] = {
                id: comp.Id,
                filePath: fileName,
                content: comp.Markup || '',
                language: 'html'
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }

            openFileInEditor(fileName);
            setStatus(`Loaded Visualforce Component ${comp.Name}`);
            logToTerminal(`Successfully loaded Visualforce Component '${comp.Name}'`, 'success');
        } catch (e) {
            console.error('Error loading Visualforce Component:', e);
            setStatus(`Error loading VF Component: ${e.message}`, true);
            logToTerminal(`Error loading Visualforce Component: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadLmsChannel(channelId, channelName, openInSidePane = false) {
        const name = channelName || 'CustomChannel';
        const fileName = `${name}.messageChannel-meta.xml`;
        if (focusIfAlreadyLoaded(fileName, openInSidePane)) return;
        setStatus(`Loading Lightning Message Channel: ${name}...`);
        logToTerminal(`Fetching LightningMessageChannel '${name}' via Tooling API...`, 'info');
        showEditorLoader(`Loading LMS: ${name}`);

        try {
            const res = await cachedSfApiQuery(`SELECT Id, DeveloperName, MasterLabel, Description, IsExposed FROM LightningMessageChannel WHERE Id = '${channelId}' OR DeveloperName = '${name}'`, true).catch(() => null);
            const rec = res?.records?.[0];
            let xmlSource = '';
            if (rec) {
                xmlSource = `<?xml version="1.0" encoding="UTF-8"?>\n<LightningMessageChannel xmlns="http://soap.sforce.com/2006/04/metadata">\n    <masterLabel>${rec.MasterLabel || rec.DeveloperName}</masterLabel>\n    <isExposed>${rec.IsExposed !== false}</isExposed>\n    <description>${rec.Description || 'Lightning Message Channel'}</description>\n    <lightningMessageFields>\n        <fieldName>recordId</fieldName>\n        <description>Record ID parameter</description>\n    </lightningMessageFields>\n    <lightningMessageFields>\n        <fieldName>payload</fieldName>\n        <description>Event payload parameter</description>\n    </lightningMessageFields>\n</LightningMessageChannel>`;
            } else {
                xmlSource = `<?xml version="1.0" encoding="UTF-8"?>\n<LightningMessageChannel xmlns="http://soap.sforce.com/2006/04/metadata">\n    <masterLabel>${name}</masterLabel>\n    <isExposed>true</isExposed>\n    <description>Lightning Message Channel</description>\n</LightningMessageChannel>`;
            }

            currentFiles[fileName] = {
                content: xmlSource,
                savedContent: xmlSource,
                isDirty: false,
                language: 'xml',
                type: 'lms',
                id: channelId,
                name: name
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }
            openFileInEditor(fileName, openInSidePane);
            setStatus(`Loaded Lightning Message Channel ${name}`);
            logToTerminal(`Successfully loaded Lightning Message Channel '${name}'`, 'success');
        } catch (e) {
            console.error('Error loading LMS Channel:', e);
            setStatus(`Error loading LMS Channel: ${e.message}`, true);
            logToTerminal(`Error loading Lightning Message Channel: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    async function loadAgentforceType(typeId, typeName, openInSidePane = false) {
        const name = typeName || 'CustomAiFunction';
        const fileName = `${name}.genAiFunction-meta.xml`;
        if (focusIfAlreadyLoaded(fileName, openInSidePane)) return;
        setStatus(`Loading Agentforce Lightning Type: ${name}...`);
        logToTerminal(`Fetching Agentforce GenAiFunction '${name}' via Tooling API...`, 'info');
        showEditorLoader(`Loading Agentforce: ${name}`);

        try {
            const res = await cachedSfApiQuery(`SELECT Id, DeveloperName, MasterLabel, Description FROM GenAiFunction WHERE Id = '${typeId}' OR DeveloperName = '${name}'`, true).catch(() => null);
            const rec = res?.records?.[0];
            let xmlSource = '';
            if (rec) {
                xmlSource = `<?xml version="1.0" encoding="UTF-8"?>\n<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">\n    <masterLabel>${rec.MasterLabel || rec.DeveloperName}</masterLabel>\n    <developerName>${rec.DeveloperName}</developerName>\n    <description>${rec.Description || 'Agentforce AI Agent Action'}</description>\n    <invocationTarget>${rec.DeveloperName}Handler</invocationTarget>\n    <invocationTargetType>apex</invocationTargetType>\n    <isConfirmationRequired>false</isConfirmationRequired>\n</GenAiFunction>`;
            } else {
                xmlSource = `<?xml version="1.0" encoding="UTF-8"?>\n<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">\n    <masterLabel>${name}</masterLabel>\n    <developerName>${name}</developerName>\n    <description>Agentforce AI Action</description>\n    <invocationTarget>${name}Handler</invocationTarget>\n    <invocationTargetType>apex</invocationTargetType>\n</GenAiFunction>`;
            }

            currentFiles[fileName] = {
                content: xmlSource,
                savedContent: xmlSource,
                isDirty: false,
                language: 'xml',
                type: 'agentforce',
                id: typeId,
                name: name
            };

            if (!openTabPaths.includes(fileName)) {
                openTabPaths.push(fileName);
            }
            openFileInEditor(fileName, openInSidePane);
            setStatus(`Loaded Agentforce Lightning Type ${name}`);
            logToTerminal(`Successfully loaded Agentforce Lightning Type '${name}'`, 'success');
        } catch (e) {
            console.error('Error loading Agentforce Type:', e);
            setStatus(`Error loading Agentforce Type: ${e.message}`, true);
            logToTerminal(`Error loading Agentforce Type: ${e.message}`, 'error');
        } finally {
            hideEditorLoader();
        }
    }

    function showEditorWelcome() {
        const welcome = document.getElementById('editor-welcome');
        const leftPane = document.getElementById('monaco-container-left');
        const toolContainer = document.getElementById('tool-tab-container');
        if (welcome) welcome.style.display = 'flex';
        if (leftPane) leftPane.style.display = 'none';
        if (toolContainer) toolContainer.style.display = 'none';
    }

    function hideEditorWelcome() {
        const welcome = document.getElementById('editor-welcome');
        if (welcome) welcome.style.display = 'none';
    }

    const savingFilePaths = new Set();
    const persistentSaveToastIds = new Map();

    function fileHasUnsavedChanges(fileName) {
        const file = currentFiles[fileName];
        return !!(file && !file.isTool && (file.isDirty === true || (file.savedContent !== undefined && file.content !== file.savedContent)));
    }

    async function confirmCloseFiles(fileNames) {
        const saving = fileNames.filter(fileName => savingFilePaths.has(fileName));
        if (saving.length) {
            window.toast?.info(`Wait for ${saving.length === 1 ? saving[0] : `${saving.length} files`} to finish saving before closing.`);
            return false;
        }
        const dirty = fileNames.filter(fileHasUnsavedChanges);
        if (!dirty.length) return true;
        const message = dirty.length === 1
            ? `${dirty[0]} has unsaved changes. Closing it will discard those changes.`
            : `${dirty.length} files have unsaved changes. Closing them will discard all of those changes.`;
        return window.toast?.confirm
            ? !!(await window.toast.confirm(message, { title: 'Discard unsaved changes?', confirmText: 'Discard & Close', cancelText: 'Keep Editing', danger: true }))
            : window.confirm(message);
    }

    async function closeTab(fileName, e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        if (!(await confirmCloseFiles([fileName]))) return false;

        openTabPaths = openTabPaths.filter(f => f !== fileName);

        // Remove the closed tab's DOM element directly instead of rebuilding
        // the whole tab bar — a full rebuild made the bar jerk on every close.
        removeTabElement(fileName);

        if (activeFilePath === fileName) {
            if (openTabPaths.length > 0) {
                openFileInEditor(openTabPaths[openTabPaths.length - 1]);
            } else {
                activeFilePath = null;
                showEditorWelcome();
                updateTreeActiveStates();
                renderDocumentOutline();
                setStatus('All tabs closed');
            }
        } else {
            // The tree already lists every file — only the active/opacity
            // highlight needs moving. A full tree rebuild flickered the list.
            updateTreeActiveStates();
        }

        logToTerminal(`Closed tab ${fileName}`, 'info');
        return true;
    }

    function showTabContextMenu(fileName, index, x, y) {
        // Remove any existing context menus
        const existingMenu = document.getElementById('tab-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'tab-context-menu';
        menu.className = 'sfarc-editor-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            z-index: 10000000;
            min-width: 160px;
        `;

        const createMenuItem = (label, onClick) => {
            const item = document.createElement('div');
            item.className = 'tab-context-menu-item';
            item.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.15s ease, color 0.15s ease;
            `;
            item.innerText = label;
            item.onclick = (e) => {
                e.stopPropagation();
                menu.remove();
                onClick();
            };
            return item;
        };

        // 1. Close Tab
        menu.appendChild(createMenuItem('Close', () => {
            closeTab(fileName);
        }));

        // 2. Close Others
        menu.appendChild(createMenuItem('Close Others', async () => {
            const closing = openTabPaths.filter(openFile => openFile !== fileName);
            if (!(await confirmCloseFiles(closing))) return;
            openTabPaths = [fileName];
            if (activeFilePath !== fileName) {
                openFileInEditor(fileName);
            } else {
                renderOrgExplorerTree();
            }
            logToTerminal(`Closed other tabs, kept ${fileName}`, 'info');
        }));

        // 3. Close to the Right
        menu.appendChild(createMenuItem('Close to the Right', async () => {
            const idx = openTabPaths.indexOf(fileName);
            if (idx !== -1) {
                const closing = openTabPaths.slice(idx + 1);
                if (!(await confirmCloseFiles(closing))) return;
                const tabsToKeep = openTabPaths.slice(0, idx + 1);
                openTabPaths = tabsToKeep;
                if (!openTabPaths.includes(activeFilePath)) {
                    openFileInEditor(fileName);
                } else {
                    renderOrgExplorerTree();
                }
                logToTerminal(`Closed tabs to the right of ${fileName}`, 'info');
            }
        }));

        // 4. Close All
        menu.appendChild(createMenuItem('Close All', async () => {
            if (!(await confirmCloseFiles([...openTabPaths]))) return;
            openTabPaths = [];
            activeFilePath = null;
            showEditorWelcome();
            renderOrgExplorerTree();
            renderDocumentOutline();
            setStatus('All tabs closed');
            logToTerminal(`Closed all tabs`, 'info');
        }));

        document.body.appendChild(menu);

        // Close menu when clicking outside
        const removeMenu = () => {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        };
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 50);
    }

    function toggleFolder(folderId) {
        if (expandedFolders.has(folderId)) {
            expandedFolders.delete(folderId);
        } else {
            expandedFolders.add(folderId);
        }
        renderOrgExplorerTree();
    }

    // Chunked list renderer: renders only `chunk` rows at a time and appends
    // a "Show more" row so huge lists (e.g. 18,000 Apex classes) never build
    // the whole DOM in one pass — that previously froze/crashed the page.
    function sfarcRenderChunkedList(container, items, rowBuilder, opts) {
        opts = opts || {};
        const chunk = opts.chunk || 500;
        const moreTag = opts.moreTag || 'div';
        const moreColspan = opts.moreColspan || 1;
        container.innerHTML = '';
        if (!items || items.length === 0) return;
        let shown = 0;
        const label = () => `Show ${Math.min(chunk, items.length - shown)} more (${items.length - shown} remaining)`;
        const buildMore = (onClick) => {
            if (moreTag === 'tr') {
                const tr = document.createElement('tr');
                tr.className = 'sfarc-more-row';
                tr.innerHTML = `<td colspan="${moreColspan}" style="text-align:center; padding:8px; cursor:pointer; font-size:12px; font-weight:500; color:var(--sfarc-accent, #2196f3); user-select:none;">${label()}</td>`;
                tr.onclick = onClick;
                return tr;
            }
            const el = document.createElement('div');
            el.className = 'sfarc-more-row';
            el.style.cssText = 'text-align:center; padding:8px 12px; cursor:pointer; font-size:12px; font-weight:500; color:var(--sfarc-accent, #2196f3); user-select:none;';
            el.textContent = label();
            el.onclick = onClick;
            return el;
        };
        const appendNext = () => {
            const end = Math.min(shown + chunk, items.length);
            const frag = document.createDocumentFragment();
            for (let i = shown; i < end; i++) frag.appendChild(rowBuilder(items[i], i));
            shown = end;
            const prev = container.querySelector('.sfarc-more-row');
            if (prev) prev.remove();
            container.appendChild(frag);
            if (shown < items.length) container.appendChild(buildMore(appendNext));
        };
        appendNext();
    }

    function renderOrgExplorerTree(filterQuery = '') {
        const tree = document.getElementById('file-tree');
        if (!tree) return;

        tree.innerHTML = '';
        if (tree.setAttribute) tree.setAttribute('aria-busy', 'false');

        const query = (filterQuery || document.getElementById('sidebar-search-input')?.value || '').toLowerCase().trim();

        // 1. Apex Classes Folder
        const filteredApex = orgMetadata.apexClasses.filter(c => c.Name.toLowerCase().includes(query));
        if (query && filteredApex.length > 0) expandedFolders.add('folder-apex');
        const isApexOpen = expandedFolders.has('folder-apex');

        const apexFolder = document.createElement('div');
        apexFolder.className = `tree-folder ${isApexOpen ? 'open' : ''}`;
        apexFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isApexOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: var(--sfarc-accent-glow, #38bdf8);"><i class="fa-solid fa-c"></i></div>
                </div>
                <span>Apex Classes (${filteredApex.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        apexFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-apex');

        const apexChildren = apexFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(apexChildren, filteredApex, (cls) => {
            const fileName = `${cls.Name}.cls`;
            const isOpen = openTabPaths.includes(fileName);

            const item = document.createElement('div');
            item.className = `file-item ${activeFilePath === fileName ? 'active' : ''}`;
            item.style.opacity = isOpen ? '1' : '0.7';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    ${getFileIconHtml(fileName)} <span>${cls.Name}.cls</span>
                </div>
                <div class="file-item-actions">
                    <button type="button" class="file-item-menu-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            `;

            const apexAsset = { id: cls.Id, name: cls.Name, fileName: fileName, type: 'apex' };
            const leftRegion = item.querySelector('.file-item-left');
            if (leftRegion) leftRegion.onclick = () => loadApexAsset(cls.Id, cls.Name);
            item.oncontextmenu = (e) => openFileContextMenu(e, apexAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onmousedown = (e) => e.stopPropagation();
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, apexAsset);
                };
            }
            return item;
        });
        tree.appendChild(apexFolder);

        // 2. Lightning Web Components (LWC) Folder
        const filteredLwc = orgMetadata.lwcBundles.filter(b => b.DeveloperName.toLowerCase().includes(query));
        if (query && filteredLwc.length > 0) expandedFolders.add('folder-lwc');
        const isLwcOpen = expandedFolders.has('folder-lwc');

        const lwcFolder = document.createElement('div');
        lwcFolder.className = `tree-folder ${isLwcOpen ? 'open' : ''}`;
        lwcFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isLwcOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: #f7df1e;"><i class="fa-solid fa-code"></i></div>
                </div>
                <span>Lightning Web Components (${filteredLwc.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        lwcFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-lwc');

        const lwcChildren = lwcFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(lwcChildren, filteredLwc, (b) => {
            const isCurrentBundle = currentBundleInfo.id === b.Id;
            const subFolderId = `lwc-bundle-${b.Id}`;
            if (isCurrentBundle) expandedFolders.add(subFolderId);
            const isBundleOpen = expandedFolders.has(subFolderId);

            const bundleSubFolder = document.createElement('div');
            bundleSubFolder.className = `tree-folder ${isBundleOpen ? 'open' : ''}`;
            bundleSubFolder.innerHTML = `
                <div class="tree-folder-header" style="font-size: 11.5px; padding: 4px 8px; justify-content: space-between;">
                    <div class="tree-folder-header-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; cursor: pointer;">
                        <i class="fa-solid fa-chevron-right tree-folder-icon" style="font-size: 10px;"></i>
                        <div class="folder-icon-wrapper">
                            <i class="fa-regular ${isBundleOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                            <div class="folder-icon-badge" style="color: #ff9800;"><i class="fa-solid fa-box"></i></div>
                        </div>
                        <span>${b.DeveloperName}</span>
                    </div>
                    <div class="file-item-actions" style="display: flex; gap: 4px; align-items: center;">
                        <button type="button" class="add-lwc-file-btn" title="New file in ${b.DeveloperName}"><i class="fa-solid fa-file-circle-plus"></i></button>
                        <button type="button" class="file-item-menu-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                </div>
                <div class="tree-folder-children"></div>
            `;

            const lwcAsset = { id: b.Id, name: b.DeveloperName, fileName: b.DeveloperName, type: 'lwc' };
            const folderHeaderLeft = bundleSubFolder.querySelector('.tree-folder-header-left');
            if (folderHeaderLeft) {
                folderHeaderLeft.onclick = (e) => {
                    e.stopPropagation();
                    toggleFolder(subFolderId);
                    if (!isCurrentBundle) loadLwcBundle(b.Id, b.DeveloperName);
                };
            }
            const folderHeader = bundleSubFolder.querySelector('.tree-folder-header');
            if (folderHeader) {
                folderHeader.oncontextmenu = (e) => openFileContextMenu(e, lwcAsset);
            }

            const addFileBtn = bundleSubFolder.querySelector('.add-lwc-file-btn');
            if (addFileBtn) {
                const handleAddFile = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    promptAddNewFile(b.DeveloperName, b.Id);
                };
                addFileBtn.onmousedown = (e) => e.stopPropagation();
                addFileBtn.onclick = handleAddFile;
            }

            const menuBtn = bundleSubFolder.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                const handleMenu = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, lwcAsset);
                };
                menuBtn.onmousedown = (e) => e.stopPropagation();
                menuBtn.onclick = handleMenu;
            }

            const bundleFilesChildren = bundleSubFolder.querySelector('.tree-folder-children');

            const bundleFiles = Object.keys(currentFiles).filter(f => {
                const fileObj = currentFiles[f];
                return fileObj.bundleName === b.DeveloperName;
            });

            if (bundleFiles.length > 0 && bundleFilesChildren) {
                bundleFiles.forEach(fileName => {
                    const isOpen = openTabPaths.includes(fileName);
                    const fileItem = document.createElement('div');
                    fileItem.className = `file-item ${activeFilePath === fileName ? 'active' : ''}`;
                    fileItem.style.opacity = isOpen ? '1' : '0.7';
                    fileItem.dataset.filename = fileName;
                    fileItem.innerHTML = `
                        <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                            ${getFileIconHtml(fileName)} <span>${fileName}</span>
                        </div>
                        <div class="file-item-actions">
                            <button type="button" class="file-item-menu-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        </div>
                    `;

                    const fileAsset = { id: b.Id, name: b.DeveloperName, fileName: fileName, type: 'file' };
                    const fLeft = fileItem.querySelector('.file-item-left');
                    if (fLeft) fLeft.onclick = () => openFileInEditor(fileName);
                    fileItem.oncontextmenu = (e) => openFileContextMenu(e, fileAsset);

                    const fMenuBtn = fileItem.querySelector('.file-item-menu-btn');
                    if (fMenuBtn) {
                        fMenuBtn.onmousedown = (e) => e.stopPropagation();
                        fMenuBtn.onclick = (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openFileContextMenu(e, fileAsset);
                        };
                    }
                    bundleFilesChildren.appendChild(fileItem);
                });
            }

            return bundleSubFolder;
        });
        tree.appendChild(lwcFolder);

        // 3. Lightning Aura Components (Aura) Folder (Beta)
        const filteredAura = orgMetadata.auraBundles.filter(a => a.DeveloperName.toLowerCase().includes(query));
        if (query && filteredAura.length > 0) expandedFolders.add('folder-aura');
        const isAuraOpen = expandedFolders.has('folder-aura');

        const auraFolder = document.createElement('div');
        auraFolder.className = `tree-folder ${isAuraOpen ? 'open' : ''}`;
        auraFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isAuraOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: #e06c75;"><i class="fa-solid fa-bolt"></i></div>
                </div>
                <span>Aura Components (${filteredAura.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        auraFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-aura');

        const auraChildren = auraFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(auraChildren, filteredAura, (a) => {
            const fileName = `${a.DeveloperName}.cmp`;
            const item = document.createElement('div');
            item.className = 'file-item';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <i class="fa-solid fa-bolt-lightning" style="color: #e06c75;"></i> <span>${fileName}</span>
                </div>
                <div class="file-item-actions">
                    <i class="fa-solid fa-ellipsis-vertical file-item-menu-btn" title="More options" style="padding: 4px 6px; cursor: pointer;"></i>
                </div>
            `;
            const auraAsset = { id: a.Id, name: a.DeveloperName, fileName: fileName, type: 'aura' };
            const aLeft = item.querySelector('.file-item-left');
            if (aLeft) aLeft.onclick = () => loadAuraBundle(a.Id, a.DeveloperName);
            item.oncontextmenu = (e) => openFileContextMenu(e, auraAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, auraAsset);
                };
            }
            return item;
        });
        tree.appendChild(auraFolder);

        // 4. Apex Triggers Folder (Beta)
        const filteredTrig = orgMetadata.apexTriggers.filter(t => t.Name.toLowerCase().includes(query));
        if (query && filteredTrig.length > 0) expandedFolders.add('folder-triggers');
        const isTrigOpen = expandedFolders.has('folder-triggers');

        const trigFolder = document.createElement('div');
        trigFolder.className = `tree-folder ${isTrigOpen ? 'open' : ''}`;
        trigFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isTrigOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: #fbbf24;"><i class="fa-solid fa-bolt-lightning"></i></div>
                </div>
                <span>Apex Triggers (${filteredTrig.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        trigFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-triggers');

        const trigChildren = trigFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(trigChildren, filteredTrig, (t) => {
            const fileName = `${t.Name}.trigger`;
            const isOpen = openTabPaths.includes(fileName);

            const item = document.createElement('div');
            item.className = `file-item ${activeFilePath === fileName ? 'active' : ''}`;
            item.style.opacity = isOpen ? '1' : '0.7';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    ${getFileIconHtml(fileName)} <span>${t.Name}.trigger</span>
                </div>
                <div class="file-item-actions">
                    <i class="fa-solid fa-ellipsis-vertical file-item-menu-btn" title="More options" style="padding: 4px 6px; cursor: pointer;"></i>
                </div>
            `;
            const trigAsset = { id: t.Id, name: t.Name, fileName: fileName, type: 'trigger' };
            const tLeft = item.querySelector('.file-item-left');
            if (tLeft) tLeft.onclick = () => loadApexTrigger(t.Id, t.Name);
            item.oncontextmenu = (e) => openFileContextMenu(e, trigAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, trigAsset);
                };
            }
            return item;
        });
        tree.appendChild(trigFolder);

        // 5. Visualforce Pages & Components Folder
        const filteredVf = orgMetadata.vfPages.filter(p => p.Name.toLowerCase().includes(query));
        if (query && filteredVf.length > 0) expandedFolders.add('folder-vf');
        const isVfOpen = expandedFolders.has('folder-vf');

        const vfFolder = document.createElement('div');
        vfFolder.className = `tree-folder ${isVfOpen ? 'open' : ''}`;
        vfFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isVfOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: #ec4899;"><i class="fa-solid fa-v"></i></div>
                </div>
                <span>Visualforce Pages (${filteredVf.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        vfFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-vf');

        const vfChildren = vfFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(vfChildren, filteredVf, (p) => {
            const fileName = `${p.Name}.page`;
            const item = document.createElement('div');
            item.className = 'file-item';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <i class="fa-solid fa-file-code" style="color: #ec4899;"></i> <span>${p.Name}.page</span>
                </div>
                <div class="file-item-actions">
                    <i class="fa-solid fa-ellipsis-vertical file-item-menu-btn" title="More options" style="padding: 4px 6px; cursor: pointer;"></i>
                </div>
            `;
            const vfAsset = { id: p.Id, name: p.Name, fileName: fileName, type: 'vf' };
            const vLeft = item.querySelector('.file-item-left');
            if (vLeft) vLeft.onclick = () => loadVfPage(p.Id, p.Name);
            item.oncontextmenu = (e) => openFileContextMenu(e, vfAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, vfAsset);
                };
            }
            return item;
        });
        tree.appendChild(vfFolder);

        // 6. Lightning Message Channels (LMS) Folder
        const filteredLms = (orgMetadata.lmsChannels || []).filter(c => (c.DeveloperName || c.MasterLabel || '').toLowerCase().includes(query));
        if (query && filteredLms.length > 0) expandedFolders.add('folder-lms');
        const isLmsOpen = expandedFolders.has('folder-lms');

        const lmsFolder = document.createElement('div');
        lmsFolder.className = `tree-folder ${isLmsOpen ? 'open' : ''}`;
        lmsFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isLmsOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: var(--sfarc-accent-glow, #38bdf8);"><i class="fa-solid fa-tower-broadcast"></i></div>
                </div>
                <span>Lightning Message Channels (${filteredLms.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        lmsFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-lms');

        const lmsChildren = lmsFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(lmsChildren, filteredLms, (c) => {
            const name = c.DeveloperName || c.MasterLabel;
            const fileName = `${name}.messageChannel-meta.xml`;
            const isOpen = openTabPaths.includes(fileName);

            const item = document.createElement('div');
            item.className = `file-item ${activeFilePath === fileName ? 'active' : ''}`;
            item.style.opacity = isOpen ? '1' : '0.7';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <i class="fa-solid fa-tower-broadcast" style="color: var(--sfarc-accent-glow, #38bdf8); font-size: 11px;"></i> <span>${name}.messageChannel</span>
                </div>
                <div class="file-item-actions">
                    <button type="button" class="file-item-menu-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            `;
            const lmsAsset = { id: c.Id, name: name, fileName: fileName, type: 'lms' };
            const lLeft = item.querySelector('.file-item-left');
            if (lLeft) lLeft.onclick = () => loadLmsChannel(c.Id, name);
            item.oncontextmenu = (e) => openFileContextMenu(e, lmsAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onmousedown = (e) => e.stopPropagation();
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, lmsAsset);
                };
            }
            return item;
        });
        tree.appendChild(lmsFolder);

        // 7. Lightning Types (Agentforce) Folder
        const filteredAgent = (orgMetadata.agentforceTypes || []).filter(a => (a.DeveloperName || a.MasterLabel || '').toLowerCase().includes(query));
        if (query && filteredAgent.length > 0) expandedFolders.add('folder-agentforce');
        const isAgentOpen = expandedFolders.has('folder-agentforce');

        const agentFolder = document.createElement('div');
        agentFolder.className = `tree-folder ${isAgentOpen ? 'open' : ''}`;
        agentFolder.innerHTML = `
            <div class="tree-folder-header">
                <i class="fa-solid fa-chevron-right tree-folder-icon"></i>
                <div class="folder-icon-wrapper">
                    <i class="fa-regular ${isAgentOpen ? 'fa-folder-open' : 'fa-folder'} folder-icon-main"></i>
                    <div class="folder-icon-badge" style="color: #a855f7;"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                </div>
                <span>Lightning Types (Agentforce) (${filteredAgent.length})</span>
            </div>
            <div class="tree-folder-children"></div>
        `;
        agentFolder.querySelector('.tree-folder-header').onclick = () => toggleFolder('folder-agentforce');

        const agentChildren = agentFolder.querySelector('.tree-folder-children');
        sfarcRenderChunkedList(agentChildren, filteredAgent, (a) => {
            const name = a.DeveloperName || a.MasterLabel;
            const fileName = `${name}.genAiFunction-meta.xml`;
            const isOpen = openTabPaths.includes(fileName);

            const item = document.createElement('div');
            item.className = `file-item ${activeFilePath === fileName ? 'active' : ''}`;
            item.style.opacity = isOpen ? '1' : '0.7';
            item.dataset.filename = fileName;
            item.innerHTML = `
                <div class="file-item-left" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: #a855f7; font-size: 11px;"></i> <span>${name}.genAiFunction</span>
                </div>
                <div class="file-item-actions">
                    <button type="button" class="file-item-menu-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            `;
            const agentAsset = { id: a.Id, name: name, fileName: fileName, type: 'agentforce' };
            const aLeft = item.querySelector('.file-item-left');
            if (aLeft) aLeft.onclick = () => loadAgentforceType(a.Id, name);
            item.oncontextmenu = (e) => openFileContextMenu(e, agentAsset);

            const menuBtn = item.querySelector('.file-item-menu-btn');
            if (menuBtn) {
                menuBtn.onmousedown = (e) => e.stopPropagation();
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFileContextMenu(e, agentAsset);
                };
            }
            return item;
        });
        tree.appendChild(agentFolder);

        renderTabs();
    }

    function closeFileContextMenu() {
        const existing = document.getElementById('sfarc-file-context-menu-el');
        if (existing) existing.remove();
    }

    function openFileContextMenu(e, asset) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        closeFileContextMenu();

        const menu = document.createElement('div');
        menu.id = 'sfarc-file-context-menu-el';
        menu.className = 'sfarc-file-context-menu';

        const { id, name, fileName, type } = asset;
        const isLwcRelated = (type === 'lwc' || type === 'file' || currentBundleInfo.type === 'lwc');

        menu.innerHTML = `
            <div class="sfarc-file-menu-item" data-action="open">
                <i class="fa-regular fa-folder-open"></i>
                <span>Open File</span>
            </div>
            <div class="sfarc-file-menu-item" data-action="split">
                <i class="fa-solid fa-columns"></i>
                <span>Open to Side (Split View)</span>
            </div>
            ${isLwcRelated ? `
            <div class="sfarc-file-menu-divider"></div>
            <div class="sfarc-file-menu-item" data-action="add-file">
                <i class="fa-solid fa-file-circle-plus"></i>
                <span>New File in Component</span>
            </div>
            ` : ''}
            <div class="sfarc-file-menu-divider"></div>
            <div class="sfarc-file-menu-item" data-action="download">
                <i class="fa-solid fa-download"></i>
                <span>Download File</span>
            </div>
            <div class="sfarc-file-menu-item" data-action="copy-name">
                <i class="fa-regular fa-copy"></i>
                <span>Copy File Name</span>
            </div>
            <div class="sfarc-file-menu-divider"></div>
            <div class="sfarc-file-menu-item danger" data-action="delete">
                <i class="fa-regular fa-trash-can"></i>
                <span>Delete ${type === 'lwc' ? 'Bundle' : 'Asset'}</span>
            </div>
        `;

        document.body.appendChild(menu);

        let posX = e ? e.clientX : 100;
        let posY = e ? e.clientY : 100;

        if (e && e.target) {
            const targetEl = e.target.closest('.file-item-menu-btn') || e.target;
            const btnRect = targetEl.getBoundingClientRect();
            if (btnRect && btnRect.width > 0 && btnRect.left > 0) {
                posX = btnRect.left - 120;
                posY = btnRect.bottom + 4;
            }
        }

        const rect = menu.getBoundingClientRect();
        if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
        if (posY + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 10;

        menu.style.left = `${Math.max(10, posX)}px`;
        menu.style.top = `${Math.max(10, posY)}px`;

        menu.querySelectorAll('.sfarc-file-menu-item').forEach(item => {
            item.addEventListener('click', (evt) => {
                evt.stopPropagation();
                const action = item.dataset.action;
                closeFileContextMenu();

                if (action === 'open') {
                    if (type === 'apex') loadApexAsset(id, name);
                    else if (type === 'trigger') loadApexTrigger(id, name);
                    else if (type === 'vf') loadVfPage(id, name);
                    else if (type === 'lwc') loadLwcBundle(id, name);
                    else if (type === 'aura') loadAuraBundle(id, name);
                    else if (type === 'lms') loadLmsChannel(id, name);
                    else if (type === 'agentforce') loadAgentforceType(id, name);
                    else if (fileName) openFileInEditor(fileName);
                } else if (action === 'split') {
                    if (type === 'apex') loadApexAsset(id, name, true);
                    else if (type === 'trigger') loadApexTrigger(id, name, true);
                    else if (type === 'vf') loadVfPage(id, name, true);
                    else if (type === 'lwc') loadLwcBundle(id, name, true);
                    else if (type === 'aura') loadAuraBundle(id, name, true);
                    else if (type === 'lms') loadLmsChannel(id, name, true);
                    else if (type === 'agentforce') loadAgentforceType(id, name, true);
                    else if (fileName) openFileInEditor(fileName, true);
                } else if (action === 'add-file') {
                    promptAddNewFile(name, id);
                } else if (action === 'download') {
                    const content = (currentFiles[fileName] && currentFiles[fileName].content) ? currentFiles[fileName].content : '';
                    const blob = new Blob([content], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = fileName || `${name}.txt`;
                    a.click();
                    logToTerminal(`Downloaded ${fileName || name}`, 'success');
                } else if (action === 'copy-name') {
                    navigator.clipboard.writeText(fileName || name);
                    logToTerminal(`Copied file name: ${fileName || name}`, 'info');
                } else if (action === 'delete') {
                    promptDeleteAsset(id, name, type === 'file' ? 'lwc' : type);
                }
            });
        });

        const closeMenuListener = (evt) => {
            if (menu && !menu.contains(evt.target)) {
                closeFileContextMenu();
                document.removeEventListener('click', closeMenuListener);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenuListener);
        }, 50);
    }

    /* ── Tab-bar overflow — VS Code-style "⋯" menu for tabs that don't fit ── */
    let tabOverflowMenuOpen = false;

    function updateTabOverflowButton() {
        const tabsBar = document.getElementById('tabs-bar');
        const btn = document.getElementById('tab-overflow-btn');
        if (!tabsBar || !btn) return;
        const overflowing = tabsBar.scrollWidth > tabsBar.clientWidth + 2;
        btn.style.display = overflowing ? 'flex' : 'none';
    }

    function closeTabOverflowMenu() {
        const menu = document.getElementById('tab-overflow-menu');
        if (menu) menu.remove();
        document.removeEventListener('click', onTabOverflowOutsideClick);
        document.removeEventListener('keydown', onTabOverflowEsc);
        tabOverflowMenuOpen = false;
    }

    function onTabOverflowOutsideClick(e) {
        const menu = document.getElementById('tab-overflow-menu');
        const btn = document.getElementById('tab-overflow-btn');
        if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
            closeTabOverflowMenu();
        }
    }

    function onTabOverflowEsc(e) {
        if (e.key === 'Escape') closeTabOverflowMenu();
    }

    function showTabOverflowMenu() {
        closeTabOverflowMenu();
        const tabsBar = document.getElementById('tabs-bar');
        const btn = document.getElementById('tab-overflow-btn');
        if (!tabsBar || !btn) return;

        const menu = document.createElement('div');
        menu.id = 'tab-overflow-menu';
        menu.className = 'tab-overflow-menu';

        openTabPaths.forEach(fileName => {
            if (!currentFiles[fileName]) return;
            const fileObj = currentFiles[fileName];
            const iconHtml = getFileIconHtml(fileName);
            const displayTitle = fileObj.isTool ? fileObj.title : fileName;
            const row = document.createElement('div');
            row.className = 'tab-overflow-menu-item' + (fileName === activeFilePath ? ' active' : '');
            row.title = fileName;
            row.innerHTML = `<span class="tab-overflow-menu-icon">${iconHtml}</span><span class="tab-overflow-menu-label">${escapeHtml(displayTitle)}</span>`;
            row.onclick = (e) => {
                e.stopPropagation();
                closeTabOverflowMenu();
                openFileInEditor(fileName);
            };
            menu.appendChild(row);
        });

        document.body.appendChild(menu);

        const rect = btn.getBoundingClientRect();
        menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + 'px';
        menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';

        tabOverflowMenuOpen = true;
        setTimeout(() => {
            document.addEventListener('click', onTabOverflowOutsideClick);
            document.addEventListener('keydown', onTabOverflowEsc);
        }, 0);
    }

    /* ── GitHub-style diff highlight — click the green dot on a dirty tab to
       paint changed/added lines green in the editor, exactly like a PR view ── */
    let diffHighlightOn = false;
    let diffHighlightFile = null;
    let diffDecorationIds = [];

    function computeLineDiff(oldText, newText) {
        // '' .split('\n') yields a phantom [''] line — treat empty files as zero lines
        const a = oldText ? oldText.split('\n') : [];
        const b = newText ? newText.split('\n') : [];
        const n = a.length, m = b.length;
        const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
        const added = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) { i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }
            else { added.push(j); j++; }
        }
        while (j < m) added.push(j++);
        return added;
    }

    function applyDiffHighlights() {
        if (!editorInstance || !activeFilePath || !currentFiles[activeFilePath]) return;
        if (typeof monaco === 'undefined' || !monaco.Range) return;
        const fileObj = currentFiles[activeFilePath];
        const oldText = fileObj.savedContent !== undefined ? fileObj.savedContent : fileObj.content;
        const addedLines = computeLineDiff(oldText, fileObj.content);
        const decorations = addedLines.map(lineIdx => ({
            range: new monaco.Range(lineIdx + 1, 1, lineIdx + 1, 1),
            options: {
                isWholeLine: true,
                linesDecorationsClassName: 'sfarc-diff-added-glyph',
                className: 'sfarc-diff-added-line'
            }
        }));
        diffDecorationIds = editorInstance.deltaDecorations(diffDecorationIds, decorations);
    }

    function updateDiffDotState() {
        document.querySelectorAll('.tab-dot-green').forEach(dot => {
            const f = dot.dataset.filename;
            const active = diffHighlightOn && diffHighlightFile === f;
            dot.classList.toggle('is-active', active);
            dot.title = active
                ? 'Diff highlight ON — click to hide changes'
                : 'Unsaved changes in file — click to show changes like GitHub';
        });
    }

    function clearDiffHighlights() {
        if (editorInstance) {
            diffDecorationIds = editorInstance.deltaDecorations(diffDecorationIds, []);
        } else {
            diffDecorationIds = [];
        }
        diffHighlightOn = false;
        diffHighlightFile = null;
        updateDiffDotState();
    }

    function toggleDiffHighlight(fileName) {
        if (!editorInstance || !currentFiles[fileName]) return;
        const fileObj = currentFiles[fileName];

        if (diffHighlightOn && diffHighlightFile === fileName) {
            clearDiffHighlights();
            setStatus(`Diff highlight off for ${fileName}`);
            return;
        }

        if (fileObj.content === fileObj.savedContent) {
            setStatus(`${fileName} has no unsaved changes to show`, true);
            return;
        }

        if (diffHighlightOn) {
            diffDecorationIds = editorInstance.deltaDecorations(diffDecorationIds, []);
        }
        diffHighlightOn = true;
        diffHighlightFile = fileName;
        applyDiffHighlights();
        updateDiffDotState();
        const n = computeLineDiff(fileObj.savedContent, fileObj.content).length;
        setStatus(`Diff highlight ON — ${n} changed line${n === 1 ? '' : 's'} in ${fileName}`);
    }

    function createTabElement(fileName) {
        if (!currentFiles[fileName]) return null;
        const fileObj = currentFiles[fileName];
        const idx = openTabPaths.indexOf(fileName);
        const iconHtml = getFileIconHtml(fileName);
        const displayTitle = fileObj.isTool ? fileObj.title : fileName;

        if (fileObj) {
            const isDirty = !fileObj.isTool && (fileObj.isDirty === true || (fileObj.savedContent !== undefined && fileObj.content !== fileObj.savedContent));
            const hasError = !fileObj.isTool && fileObj.hasError === true;

            let dotIndicator = '';
            if (hasError) {
                dotIndicator = `<span class="tab-status-dot tab-dot-red" title="File contains compilation/syntax errors" style="color: var(--log-error-color, #ef4444); font-size: 11px; margin-left: 2px; font-weight: bold;">●</span>`;
            } else if (isDirty) {
                dotIndicator = `<span class="tab-status-dot tab-dot-green" title="Unsaved changes in file — click to show changes like GitHub" style="color: var(--log-success-color, #15803d); font-size: 11px; margin-left: 2px; font-weight: bold;">●</span>`;
            }

            const tab = document.createElement('div');
            tab.className = `tab ${activeFilePath === fileName ? 'active' : ''}`;
            tab.draggable = true;
            tab.dataset.index = idx;
            tab.dataset.filename = fileName;

            tab.innerHTML = `
                <div class="tab-click-region" style="display: flex; align-items: center; gap: 6px; flex: 1; overflow: hidden;">
                    ${iconHtml}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayTitle)}</span>
                    ${dotIndicator}
                </div>
                <div class="tab-close-btn" title="Close Tab" style="padding: 2px 4px; margin-left: 4px; cursor: pointer; display: flex; align-items: center;">
                    <i class="fa-solid fa-xmark"></i>
                </div>
            `;

            tab.onclick = () => {
                // Tapping the already-active tab must not re-run the whole open
                // pipeline (editor model swap + PMD/security audit + console
                // spam) — it used to log "Opened …" and audit repeatedly.
                if (fileName === activeFilePath && editorInstance && !diffEditorInstance) {
                    updateTabActiveStates();
                    updateTreeActiveStates();
                    return;
                }
                openFileInEditor(fileName);
            };

            const closeBtn = tab.querySelector('.tab-close-btn');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    closeTab(fileName, e);
                };
            }

            // Clicking the green unsaved-changes dot toggles GitHub-style diff highlights
            const dirtyDot = tab.querySelector('.tab-dot-green');
            if (dirtyDot) {
                dirtyDot.dataset.filename = fileName;
                dirtyDot.onclick = (e) => {
                    e.stopPropagation();
                    toggleDiffHighlight(fileName);
                };
            }

            tab.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showTabContextMenu(fileName, idx, e.clientX, e.clientY);
            });

            tab.addEventListener('dragstart', (e) => {
                draggedTabIndex = idx;
                tab.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            tab.addEventListener('dragend', () => {
                tab.classList.remove('dragging');
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
            });

            tab.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tab.classList.add('drag-over');
            });

            tab.addEventListener('dragleave', () => {
                tab.classList.remove('drag-over');
            });

            tab.addEventListener('drop', (e) => {
                e.preventDefault();
                tab.classList.remove('drag-over');

                if (draggedTabIndex !== null && draggedTabIndex !== idx) {
                    const movedItem = openTabPaths.splice(draggedTabIndex, 1)[0];
                    openTabPaths.splice(idx, 0, movedItem);
                    renderTabs();
                    logToTerminal(`Reordered tab ${movedItem}`, 'info');
                }
            });

            return tab;
        }
    }

    function bindTabBarEventsOnce() {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return;

        // Vertical wheel scrolls the tab bar horizontally (the bar's own
        // scrollbar is hidden, so this is the discoverable way to reach tabs)
        if (!tabsBar.dataset.wheelBound) {
            tabsBar.dataset.wheelBound = '1';
            tabsBar.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    tabsBar.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        // Refresh the overflow button when the window resizes
        if (!tabsBar.dataset.roBound) {
            tabsBar.dataset.roBound = '1';
            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => updateTabOverflowButton());
                ro.observe(tabsBar);
            } else {
                window.addEventListener('resize', updateTabOverflowButton);
            }
        }
    }

    function ensureTabOverflowButton() {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return null;
        let btn = document.getElementById('tab-overflow-btn');
        if (btn) return btn;
        btn = document.createElement('div');
        btn.id = 'tab-overflow-btn';
        btn.className = 'tab-overflow-btn';
        btn.title = 'More Tabs';
        btn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
        btn.onclick = (e) => {
            e.stopPropagation();
            if (tabOverflowMenuOpen) closeTabOverflowMenu();
            else showTabOverflowMenu();
        };
        tabsBar.appendChild(btn);
        return btn;
    }

    function renderTabs() {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return;
        tabsBar.innerHTML = '';
        openTabPaths.forEach(fileName => {
            const tab = createTabElement(fileName);
            if (tab) tabsBar.appendChild(tab);
        });
        ensureTabOverflowButton();
        updateTabOverflowButton();
        updateDiffDotState();
        const activeTab = tabsBar.querySelector('.tab.active');
        if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        bindTabBarEventsOnce();
    }

    function findTabElement(fileName) {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return null;
        return Array.from(tabsBar.querySelectorAll('.tab')).find(t => t.dataset.filename === fileName) || null;
    }

    function appendTab(fileName) {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return;
        if (findTabElement(fileName)) return;
        ensureTabOverflowButton();
        const tab = createTabElement(fileName);
        if (!tab) return;
        tabsBar.insertBefore(tab, document.getElementById('tab-overflow-btn') || null);
        updateTabOverflowButton();
        updateDiffDotState();
        const activeTab = tabsBar.querySelector('.tab.active');
        if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        bindTabBarEventsOnce();
    }

    function removeTabElement(fileName) {
        const tab = findTabElement(fileName);
        if (tab) tab.remove();
        updateTabOverflowButton();
        updateDiffDotState();
    }

    function openToolTab(toolType) {
        let tabName = '';
        let title = '';

        if (toolType === 'json-to-apex' || toolType.includes('JSON')) {
            toolType = 'json-to-apex';
            tabName = 'JSON-to-Apex.tool';
            title = 'JSON to Apex';
        } else if (toolType === 'soql-to-graphql' || toolType.includes('SOQL') || toolType.includes('GraphQL')) {
            toolType = 'soql-to-graphql';
            tabName = 'SOQL-to-GraphQL.tool';
            title = 'SOQL to GraphQL';
        } else if (toolType === 'metadata-backup' || toolType.includes('Backup')) {
            toolType = 'metadata-backup';
            tabName = 'Metadata-Backup.tool';
            title = 'Metadata Backup';
        } else if (toolType === 'anon-apex' || toolType.includes('Anon')) {
            toolType = 'anon-apex';
            tabName = 'Anon-Apex.tool';
            title = 'Anon Apex';
        } else if (toolType === 'api-tester' || toolType.includes('api-tester') || toolType.includes('API')) {
            toolType = 'api-tester';
            tabName = 'REST-API-Tester.tool';
            title = 'REST API Tester';
        } else if (toolType === 'bulk-permission-wizard' || toolType.includes('Permission Wizard') || toolType.includes('bulk-permission')) {
            toolType = 'bulk-permission-wizard';
            tabName = 'Bulk-Permission-Wizard.tool';
            title = 'Bulk Permission Wizard';
        }

        if (!tabName) return;

        // Clean up legacy tab path strings if present
        const legacyNames = ['📦 JSON to Apex', '🔗 SOQL to GraphQL', '💾 Metadata Backup', '⚡ Anon Apex'];
        legacyNames.forEach(legacy => {
            if (openTabPaths.includes(legacy)) {
                openTabPaths = openTabPaths.filter(t => t !== legacy);
                delete currentFiles[legacy];
            }
        });

        if (!currentFiles[tabName]) {
            currentFiles[tabName] = {
                isTool: true,
                toolType: toolType,
                title: title,
                language: 'html'
            };
        }

        if (!openTabPaths.includes(tabName)) {
            openTabPaths.push(tabName);
        }

        openFileInEditor(tabName);
        renderTabs();
    }

    let toolStates = {
        'json-to-apex': { className: 'AccountResponseWrapper', jsonInput: '{\n  "id": 101,\n  "name": "Acme Corp",\n  "active": true,\n  "billing": {\n    "city": "San Francisco"\n  }\n}', jsonOutput: '' },
        'soql-to-graphql': { soqlInput: 'SELECT Id, Name, StageName FROM Opportunity WHERE Amount > 50000 LIMIT 10', graphqlOutput: '' },
        'metadata-backup': { format: 'bundle', preview: '' },
        'anon-apex': { apexInput: "System.debug('Hello salesforce comet!');", apexOutput: '' },
        'api-tester': { apiMethod: 'GET', apiEndpoint: '/services/data/v60.0/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+5', apiReqBody: '', apiStatus: '', apiResBody: '' },
        'bulk-permission-wizard': {
            step: 1,
            permissionSetId: '',
            targetName: '',
            objectSearch: '',
            selectedObjects: [],
            allObjects: [],
            recordTypes: {},
            selectedRecordTypes: {},
            fieldPerms: {},
            crudPerms: {}
        }
    };

    function renderToolTabUI(toolType) {
        const container = document.getElementById('tool-tab-container');
        if (!container) return;

        if (container.dataset.activeTool === toolType) return;
        container.dataset.activeTool = toolType;

        const state = toolStates[toolType] || {};

        if (toolType === 'json-to-apex') {
            container.innerHTML = `
                <div class="tool-tab">
                    <div class="tool-header">
                        <div class="tool-header-title"><i class="fa-solid fa-code"></i> JSON to Apex Wrapper Class Generator</div>
                        <div class="tool-actions">
                            <button id="tab-btn-generate-apex" class="tool-btn primary"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Apex</button>
                        </div>
                    </div>

                    <div class="tool-pane">
                        <div class="tool-col">
                            <label class="tool-label" for="tab-json-class-name">Outer Apex Class Name</label>
                            <input type="text" id="tab-json-class-name" class="tool-input" value="${escapeHtml(state.className || 'AccountResponseWrapper')}" placeholder="e.g. MyPayloadWrapper">
                            <label class="tool-label" for="tab-json-input">Input JSON Payload</label>
                            <textarea id="tab-json-input" class="tool-textarea" placeholder='{ "id": 101, "name": "Acme Corp" }'>${escapeHtml(state.jsonInput || '')}</textarea>
                        </div>

                        <div class="tool-col">
                            <div class="tool-label-row">
                                <label class="tool-label" for="tab-json-output">Generated Apex Code</label>
                                <div class="tool-actions">
                                    <button id="tab-btn-copy-apex" class="tool-btn"><i class="fa-solid fa-copy"></i> Copy Code</button>
                                    <button id="tab-btn-create-apex-file" class="tool-btn"><i class="fa-solid fa-file-circle-plus"></i> Open in Editor</button>
                                </div>
                            </div>
                            <textarea id="tab-json-output" class="tool-textarea" readonly placeholder="Click 'Generate Apex' to generate Apex wrapper structure...">${escapeHtml(state.jsonOutput || '')}</textarea>
                        </div>
                    </div>
                </div>
            `;
            bindJsonToApexTabListeners();
        } else if (toolType === 'soql-to-graphql') {
            container.innerHTML = `
                <div class="tool-tab">
                    <div class="tool-header">
                        <div class="tool-header-title"><i class="fa-solid fa-network-wired"></i> SOQL to Salesforce UI API GraphQL Converter</div>
                        <div class="tool-actions">
                            <button id="tab-btn-convert-graphql" class="tool-btn primary"><i class="fa-solid fa-bolt"></i> Convert to GraphQL</button>
                        </div>
                    </div>

                    <div class="tool-col" style="flex: 1;">
                        <label class="tool-label" for="tab-soql-input">Input SOQL Query</label>
                        <textarea id="tab-soql-input" class="tool-textarea" placeholder="SELECT Id, Name, StageName FROM Opportunity WHERE Amount > 50000 LIMIT 10">${escapeHtml(state.soqlInput || '')}</textarea>
                    </div>

                    <div class="tool-col" style="flex: 1.4;">
                        <div class="tool-label-row">
                            <label class="tool-label" for="tab-graphql-output">Generated Salesforce UI API GraphQL Query</label>
                            <button id="tab-btn-copy-graphql" class="tool-btn"><i class="fa-solid fa-copy"></i> Copy Query</button>
                        </div>
                        <textarea id="tab-graphql-output" class="tool-textarea" readonly placeholder="Click 'Convert to GraphQL' to generate Salesforce GraphQL format...">${escapeHtml(state.graphqlOutput || '')}</textarea>
                    </div>
                </div>
            `;
            bindSoqlToGraphQlTabListeners();
        } else if (toolType === 'metadata-backup') {
            container.innerHTML = `
                <div class="tool-tab">
                    <div class="tool-header">
                        <div class="tool-header-title"><i class="fa-solid fa-box-archive"></i> Backup & Metadata Exporter</div>
                        <div class="tool-actions">
                            <button id="tab-btn-download-backup" class="tool-btn primary"><i class="fa-solid fa-download"></i> Download Backup</button>
                        </div>
                    </div>

                    <div class="tool-col" style="flex: 0 0 auto;">
                        <label class="tool-label" for="tab-backup-format">Export Format</label>
                        <select id="tab-backup-format" class="tool-select">
                            <option value="bundle" ${state.format === 'bundle' ? 'selected' : ''}>Active Component Bundle (ZIP / Raw Files)</option>
                            <option value="package" ${state.format === 'package' ? 'selected' : ''}>Full Org Metadata Package Manifest (package.xml)</option>
                            <option value="apex" ${state.format === 'apex' ? 'selected' : ''}>Apex Classes Backup (All Classes Manifest)</option>
                        </select>
                    </div>

                    <div class="tool-col" style="flex: 1;">
                        <div class="tool-label-row">
                            <label class="tool-label" for="tab-backup-preview">Manifest Preview / Package Content</label>
                            <button id="tab-btn-preview-backup" class="tool-btn"><i class="fa-solid fa-eye"></i> Preview Package</button>
                        </div>
                        <textarea id="tab-backup-preview" class="tool-textarea" readonly>${escapeHtml(state.preview || '')}</textarea>
                    </div>
                </div>
            `;
            bindMetadataBackupTabListeners();
        } else if (toolType === 'anon-apex') {
            container.innerHTML = `
                <div class="tool-tab">
                    <div class="tool-header">
                        <div class="tool-header-title"><i class="fa-solid fa-terminal"></i> Execute Anonymous Apex</div>
                        <div class="tool-actions">
                            <button id="tab-btn-exec-apex" class="tool-btn primary"><i class="fa-solid fa-play"></i> Execute Apex</button>
                        </div>
                    </div>

                    <div class="tool-pane">
                        <div class="tool-col">
                            <label class="tool-label" for="tab-apex-input">Apex Script</label>
                            <textarea id="tab-apex-input" class="tool-textarea" placeholder="System.debug('Hello salesforce comet!');">${escapeHtml(state.apexInput || '')}</textarea>
                        </div>

                        <div class="tool-col">
                            <label class="tool-label" for="tab-apex-output">Execution Output & Debug Log</label>
                            <textarea id="tab-apex-output" class="tool-textarea" readonly placeholder="Execution logs will appear here after clicking Execute Apex...">${escapeHtml(state.apexOutput || '')}</textarea>
                        </div>
                    </div>
                </div>
            `;
            bindAnonApexTabListeners();
        } else if (toolType === 'api-tester') {
            container.innerHTML = `
                <div class="tool-tab">
                    <div class="tool-header">
                        <div class="tool-header-title"><i class="fa-solid fa-paper-plane"></i> Salesforce REST API Tester</div>
                        <div class="tool-actions">
                            <button id="tab-api-send-btn" class="tool-btn primary"><i class="fa-solid fa-paper-plane"></i> Send Request</button>
                        </div>
                    </div>

                    <div class="tool-row">
                        <select id="tab-api-method" class="tool-select" data-custom-dropdown="off" style="width: 108px; flex-shrink: 0; font-weight: 500;">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PATCH">PATCH</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <input type="text" id="tab-api-endpoint" class="tool-input" style="flex: 1;"
                            value="${escapeHtml(state.apiEndpoint || '/services/data/v60.0/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+5')}"
                            placeholder="/services/data/v60.0/sobjects/Account/...">
                    </div>

                    <div class="tool-pane">
                        <div class="tool-col">
                            <label class="tool-label" for="tab-api-req-body">Request Body (JSON for POST/PATCH/PUT)</label>
                            <textarea id="tab-api-req-body" class="tool-textarea" placeholder='{ "Name": "Acme Corp" }'>${escapeHtml(state.apiReqBody || '')}</textarea>
                        </div>

                        <div class="tool-col">
                            <div class="tool-label-row">
                                <label class="tool-label" for="tab-api-res-body">Response</label>
                                <span id="tab-api-status-badge" class="tool-status">${escapeHtml(state.apiStatus || '')}</span>
                            </div>
                            <textarea id="tab-api-res-body" class="tool-textarea" readonly placeholder="Click 'Send' to view API response...">${escapeHtml(state.apiResBody || '')}</textarea>
                        </div>
                    </div>
                </div>
            `;
            bindApiTesterTabListeners();
        } else if (toolType === 'bulk-permission-wizard') {
            container.innerHTML = `
                <div class="tool-tab bpw-tab">
                    <!-- Wizard Header -->
                    <div class="bpw-header">
                        <div class="bpw-header-title">
                            <i class="fa-solid fa-layer-group"></i>
                            <div class="bpw-header-text">
                                <h2>Bulk Permission Wizard</h2>
                                <p>Guided setup to grant bulk permissions.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Progress Stepper -->
                    <div class="bpw-stepper">
                        <div class="bpw-step ${state.step >= 1 ? 'active' : ''}" data-bpw-step="1">
                            <div class="bpw-step-circle">1</div>
                            <div class="bpw-step-label">Target &amp; Objects</div>
                        </div>
                        <div class="bpw-step-line ${state.step >= 2 ? 'active' : ''}"></div>
                        <div class="bpw-step ${state.step >= 2 ? 'active' : ''}" data-bpw-step="2">
                            <div class="bpw-step-circle">2</div>
                            <div class="bpw-step-label">Objects &amp; Record Types</div>
                        </div>
                        <div class="bpw-step-line ${state.step >= 3 ? 'active' : ''}"></div>
                        <div class="bpw-step ${state.step >= 3 ? 'active' : ''}" data-bpw-step="3">
                            <div class="bpw-step-circle">3</div>
                            <div class="bpw-step-label">Fields &amp; Perms</div>
                        </div>
                        <div class="bpw-step-line ${state.step >= 4 ? 'active' : ''}"></div>
                        <div class="bpw-step ${state.step >= 4 ? 'active' : ''}" data-bpw-step="4">
                            <div class="bpw-step-circle">4</div>
                            <div class="bpw-step-label">Verify &amp; Execute</div>
                        </div>
                    </div>

                    <!-- Step Panels -->
                    <div class="bpw-body">
                        <!-- STEP 1: Target & Objects -->
                        <div class="bpw-panel" data-bpw-panel="1" ${state.step === 1 ? '' : 'style="display:none;"'}>
                            <div class="bpw-controls">
                                <div class="bpw-control-group">
                                    <label class="tool-label" for="bpw-permset">Permission Set</label>
                                    <div class="bpw-select-wrap">
                                        <i class="fa-solid fa-chevron-down bpw-select-chevron" aria-hidden="true"></i>
                                        <select id="bpw-permset" class="tool-select bpw-permset"><option value="">Loading permission sets...</option></select>
                                    </div>
                                </div>
                                <div class="bpw-control-group bpw-target-search">
                                    <label class="tool-label" for="bpw-target-name">Target Name</label>
                                    <div class="bpw-search-wrap">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <input type="text" id="bpw-target-name" class="tool-input" placeholder="Enter target Name (e.g. Sales_User_PS)..." value="${escapeHtml(state.targetName || '')}">
                                    </div>
                                </div>
                                <div class="bpw-control-group bpw-object-search">
                                    <label class="tool-label" for="bpw-object-search">SELECT OBJECTS</label>
                                    <div class="bpw-search-wrap">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <input type="text" id="bpw-object-search" class="tool-input" placeholder="Search objects..." value="${escapeHtml(state.objectSearch || '')}">
                                    </div>
                                </div>
                            </div>

                            <div class="bpw-list-box">
                                <div class="bpw-list-toolbar">
                                    <label class="bpw-select-all">
                                        <input type="checkbox" id="bpw-select-all">
                                        <span>Select All</span>
                                    </label>
                                    <span class="bpw-count-badge" id="bpw-count-badge">0 objects</span>
                                    <div class="bpw-selected-pills" id="bpw-selected-pills"></div>
                                </div>
                                <div class="bpw-list-head">
                                    <span class="bpw-list-check"></span>
                                    <span class="bpw-list-name">Object API Name</span>
                                    <span class="bpw-list-desc">Description</span>
                                </div>
                                <div class="bpw-list-scroll" id="bpw-object-list"></div>
                            </div>

                            <div class="bpw-footer">
                                <button class="tool-btn primary bpw-next" id="bpw-next-1"><i class="fa-solid fa-arrow-right"></i> Next</button>
                            </div>
                        </div>

                        <!-- STEP 2: Objects & Record Types -->
                        <div class="bpw-panel" data-bpw-panel="2" ${state.step === 2 ? '' : 'style="display:none;"'}>
                            <div class="bpw-list-box bpw-rt-box">
                                <div class="bpw-list-toolbar">
                                    <span class="bpw-rt-title">Select Record Types to Include</span>
                                    <label class="bpw-select-all">
                                        <input type="checkbox" id="bpw-rt-all">
                                        <span>All Record Types</span>
                                    </label>
                                </div>
                                <div class="bpw-list-scroll bpw-rt-scroll" id="bpw-rt-list"></div>
                            </div>
                            <div class="bpw-footer">
                                <button class="tool-btn bpw-back" id="bpw-back-2"><i class="fa-solid fa-arrow-left"></i> Back</button>
                                <button class="tool-btn primary bpw-next" id="bpw-next-2"><i class="fa-solid fa-arrow-right"></i> Next</button>
                            </div>
                        </div>

                        <!-- STEP 3: Fields & Perms -->
                        <div class="bpw-panel" data-bpw-panel="3" ${state.step === 3 ? '' : 'style="display:none;"'}>
                            <div class="bpw-list-box bpw-fields-box">
                                <div class="bpw-list-toolbar">
                                    <span class="bpw-rt-title">Field-Level Security — Read / Edit per selected object</span>
                                    <label class="bpw-select-all">
                                        <input type="checkbox" id="bpw-fields-all">
                                        <span>All Fields</span>
                                    </label>
                                </div>
                                <div class="bpw-list-scroll bpw-fields-scroll" id="bpw-fields-list"></div>
                            </div>
                            <div class="bpw-footer">
                                <button class="tool-btn bpw-back" id="bpw-back-3"><i class="fa-solid fa-arrow-left"></i> Back</button>
                                <button class="tool-btn primary bpw-next" id="bpw-next-3"><i class="fa-solid fa-arrow-right"></i> Next</button>
                            </div>
                        </div>

                        <!-- STEP 4: Verify & Execute -->
                        <div class="bpw-panel" data-bpw-panel="4" ${state.step === 4 ? '' : 'style="display:none;"'}>
                            <div class="bpw-list-box bpw-verify-box">
                                <div class="bpw-list-toolbar"><span class="bpw-rt-title">Review Summary</span></div>
                                <div class="bpw-verify-body" id="bpw-verify-summary"></div>
                            </div>
                            <div class="bpw-footer">
                                <button class="tool-btn bpw-back" id="bpw-back-4"><i class="fa-solid fa-arrow-left"></i> Back</button>
                                <button class="tool-btn primary bpw-execute" id="bpw-execute"><i class="fa-solid fa-bolt"></i> Execute Permissions</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            bindBulkPermissionWizardTabListeners();
        }
    }

    function bindJsonToApexTabListeners() {
        const btnGen = document.getElementById('tab-btn-generate-apex');
        const btnCopy = document.getElementById('tab-btn-copy-apex');
        const btnCreate = document.getElementById('tab-btn-create-apex-file');
        const elClassName = document.getElementById('tab-json-class-name');
        const elJsonInput = document.getElementById('tab-json-input');

        if (elClassName) {
            elClassName.addEventListener('input', (e) => {
                toolStates['json-to-apex'].className = e.target.value;
            });
        }
        if (elJsonInput) {
            elJsonInput.addEventListener('input', (e) => {
                toolStates['json-to-apex'].jsonInput = e.target.value;
            });
        }

        const doConvert = () => {
            const className = elClassName?.value || 'AccountWrapper';
            const jsonText = elJsonInput?.value || '{}';
            const outputArea = document.getElementById('tab-json-output');

            try {
                const generatedApex = jsonToApexWrapperGenerator(className, jsonText);
                if (outputArea) {
                    outputArea.value = generatedApex;
                }
                toolStates['json-to-apex'].jsonOutput = generatedApex;
                logToTerminal(`Generated Apex wrapper class '${className}'`, 'success');
            } catch (e) {
                const errorVal = `// Invalid JSON: ${e.message}`;
                if (outputArea) {
                    outputArea.value = errorVal;
                }
                toolStates['json-to-apex'].jsonOutput = errorVal;
                logToTerminal(`JSON to Apex error: ${e.message}`, 'error');
            }
        };

        if (btnGen) btnGen.onclick = doConvert;
        if (btnCopy) {
            btnCopy.onclick = () => {
                const code = document.getElementById('tab-json-output')?.value;
                if (code) {
                    navigator.clipboard.writeText(code);
                    logToTerminal('Copied generated Apex to clipboard', 'info');
                }
            };
        }
        if (btnCreate) {
            btnCreate.onclick = () => {
                const className = elClassName?.value || 'AccountWrapper';
                const code = document.getElementById('tab-json-output')?.value || '';
                const fileName = `${className}.cls`;

                currentFiles[fileName] = {
                    id: null,
                    filePath: fileName,
                    content: code,
                    language: 'apex'
                };
                if (!openTabPaths.includes(fileName)) openTabPaths.push(fileName);
                openFileInEditor(fileName);
                logToTerminal(`Created Apex Class '${fileName}' in editor tab`, 'success');
            };
        }
        doConvert();
    }

    function convertSoqlToGraphQL(soql) {
        if (!soql || !soql.trim()) return '';
        try {
            const cleaned = soql.trim().replace(/\s+/g, ' ');
            const match = cleaned.match(/SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i);

            if (!match) {
                return `# GraphQL Query\nquery {\n  uiapi {\n    query {\n      # Raw SOQL: ${soql}\n    }\n  }\n}`;
            }

            const [, fieldsStr, sObjectName, whereClause, , limitClause] = match;
            const fields = fieldsStr.split(',').map(f => f.trim()).filter(Boolean);

            let whereGql = '';
            if (whereClause) {
                const opMatch = whereClause.match(/([a-zA-Z0-9_.]+)\s*(=|>|<|!=|LIKE)\s*(.*)/i);
                if (opMatch) {
                    const [, field, op, val] = opMatch;
                    const cleanVal = val.trim().replace(/^['"]|['"]$/g, '');
                    let opGql = 'eq';
                    if (op === '>') opGql = 'gt';
                    else if (op === '<') opGql = 'lt';
                    else if (op === '!=') opGql = 'ne';
                    else if (op.toUpperCase() === 'LIKE') opGql = 'like';
                    whereGql = `\n        where: { ${field}: { ${opGql}: { value: "${cleanVal}" } } }`;
                }
            }

            const limitGql = limitClause ? `\n        first: ${limitClause}` : '';

            const fieldNodes = fields.map(f => {
                if (f.toLowerCase() === 'id') return '            Id';
                return `            ${f} {\n              value\n            }`;
            }).join('\n');

            return `query get${sObjectName}s {\n  uiapi {\n    query {\n      ${sObjectName}(${whereGql}${limitGql}\n      ) {\n        edges {\n          node {\n${fieldNodes}\n          }\n        }\n      }\n    }\n  }\n}`;
        } catch (e) {
            return `# Error parsing SOQL query: ${e.message}`;
        }
    }

    function bindSoqlToGraphQlTabListeners() {
        const btnConvert = document.getElementById('tab-btn-convert-graphql');
        const btnCopy = document.getElementById('tab-btn-copy-graphql');
        const elSoqlInput = document.getElementById('tab-soql-input');

        if (elSoqlInput) {
            elSoqlInput.addEventListener('input', (e) => {
                toolStates['soql-to-graphql'].soqlInput = e.target.value;
            });
        }

        const doConvert = () => {
            const soql = elSoqlInput?.value || '';
            const outputArea = document.getElementById('tab-graphql-output');
            if (outputArea) {
                const gql = convertSoqlToGraphQL(soql);
                outputArea.value = gql;
                toolStates['soql-to-graphql'].graphqlOutput = gql;
            }
        };

        if (btnConvert) btnConvert.onclick = doConvert;
        if (btnCopy) {
            btnCopy.onclick = () => {
                const query = document.getElementById('tab-graphql-output')?.value;
                if (query) {
                    navigator.clipboard.writeText(query);
                    logToTerminal('Copied GraphQL query to clipboard', 'info');
                }
            };
        }
        doConvert();
    }

    function bindMetadataBackupTabListeners() {
        const selectFormat = document.getElementById('tab-backup-format');
        const btnPreview = document.getElementById('tab-btn-preview-backup');
        const btnDownload = document.getElementById('tab-btn-download-backup');
        const previewArea = document.getElementById('tab-backup-preview');

        const updatePreview = () => {
            const format = selectFormat?.value || 'bundle';
            toolStates['metadata-backup'].format = format;
            if (previewArea) {
                if (format === 'bundle') {
                    const bundleName = currentBundleInfo.name || 'ComponentBundle';
                    previewArea.value = `// Component Bundle: ${bundleName}\nFiles: ${Object.keys(currentFiles).filter(f => !currentFiles[f].isTool).join(', ')}`;
                } else if (format === 'package') {
                    previewArea.value = `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n    <types>\n        <members>*</members>\n        <name>ApexClass</name>\n    </types>\n    <types>\n        <members>*</members>\n        <name>LightningComponentBundle</name>\n    </types>\n    <apiVersion>60.0</apiVersion>\n</Package>`;
                } else if (format === 'apex') {
                    previewArea.value = `// Apex Classes Backup Manifest\nTotal Org Apex Classes: ${orgMetadata.apexClasses.length}\nClasses: ${orgMetadata.apexClasses.map(c => c.Name).join(', ')}`;
                }
                toolStates['metadata-backup'].preview = previewArea.value;
            }
        };

        if (selectFormat) selectFormat.onchange = updatePreview;
        if (btnPreview) btnPreview.onclick = updatePreview;
        if (btnDownload) {
            btnDownload.onclick = () => {
                const content = previewArea?.value || '';
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `salesforce_backup_${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                logToTerminal('Downloaded backup package', 'success');
            };
        }
        updatePreview();
    }

    function bindAnonApexTabListeners() {
        const btnExec = document.getElementById('tab-btn-exec-apex');
        const elApexInput = document.getElementById('tab-apex-input');
        const outputArea = document.getElementById('tab-apex-output');

        if (elApexInput) {
            elApexInput.addEventListener('input', (e) => {
                toolStates['anon-apex'].apexInput = e.target.value;
            });
        }

        if (btnExec) {
            btnExec.onclick = async () => {
                const code = elApexInput?.value.trim();
                if (!code) return;

                const timeHeader = `\n\n───────────────── Execution [${new Date().toLocaleTimeString()}] ─────────────────\n`;
                if (outputArea) {
                    outputArea.value = (outputArea.value ? outputArea.value + timeHeader : '') + 'Executing Apex script against Salesforce Org...\n';
                    toolStates['anon-apex'].apexOutput = outputArea.value;
                }
                logToTerminal('Executing Anonymous Apex in Tab...', 'info');

                try {
                    const endpoint = `/services/data/v60.0/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`;
                    const res = await sfApiRest(endpoint, { method: 'GET' });
                    if (outputArea) {
                        outputArea.value += `Compiled: ${res.compiled}\nSuccess: ${res.success}\nLine Error: ${res.line || 'None'}\nCompile Error: ${res.compileProblem || 'None'}\nException: ${res.exceptionMessage || 'None'}\nStackTrace: ${res.exceptionStackTrace || 'None'}\n`;
                        outputArea.scrollTop = outputArea.scrollHeight;
                        toolStates['anon-apex'].apexOutput = outputArea.value;
                    }
                    logToTerminal(`Anonymous Apex Execution Result: Success=${res.success}`, res.success ? 'success' : 'error');
                } catch (e) {
                    if (outputArea) {
                        outputArea.value += `Execution Failure: ${e.message}\n`;
                        outputArea.scrollTop = outputArea.scrollHeight;
                        toolStates['anon-apex'].apexOutput = outputArea.value;
                    }
                    logToTerminal(`Anonymous Apex Execution failed: ${e.message}`, 'error');
                }
            };
        }
    }

    function bindApiTesterTabListeners() {
        const btnSend = document.getElementById('tab-api-send-btn');
        const elMethod = document.getElementById('tab-api-method');
        const elEndpoint = document.getElementById('tab-api-endpoint');
        const elReqBody = document.getElementById('tab-api-req-body');
        const statusBadge = document.getElementById('tab-api-status-badge');
        const resBody = document.getElementById('tab-api-res-body');

        // Initialize state object if empty
        if (!toolStates['api-tester']) {
            toolStates['api-tester'] = {
                apiMethod: 'GET',
                apiEndpoint: '/services/data/v60.0/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+5',
                apiReqBody: '',
                apiStatus: '',
                apiResBody: ''
            };
        }

        // Restore values
        if (elMethod) elMethod.value = toolStates['api-tester'].apiMethod || 'GET';
        if (elEndpoint) elEndpoint.value = toolStates['api-tester'].apiEndpoint || '/services/data/v60.0/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+5';
        if (elReqBody) elReqBody.value = toolStates['api-tester'].apiReqBody || '';
        if (statusBadge) statusBadge.innerText = toolStates['api-tester'].apiStatus || '';
        if (resBody) resBody.value = toolStates['api-tester'].apiResBody || '';

        // Bind input change listeners to persist states
        if (elMethod) {
            elMethod.addEventListener('change', (e) => {
                toolStates['api-tester'].apiMethod = e.target.value;
            });
        }
        if (elEndpoint) {
            elEndpoint.addEventListener('input', (e) => {
                toolStates['api-tester'].apiEndpoint = e.target.value;
            });
        }
        if (elReqBody) {
            elReqBody.addEventListener('input', (e) => {
                toolStates['api-tester'].apiReqBody = e.target.value;
            });
        }

        const doSend = async () => {
            const method = elMethod?.value || 'GET';
            const endpoint = elEndpoint?.value.trim() || '';
            const reqBodyText = elReqBody?.value.trim() || '';

            if (!endpoint) {
                toast.error('Please enter a Salesforce REST endpoint URL.');
                return;
            }

            if (btnSend) {
                btnSend.disabled = true;
                btnSend.innerHTML = `<span class="comet-loader-inline"></span> Sending...`;
            }

            if (statusBadge) {
                statusBadge.innerText = 'Executing...';
                statusBadge.classList.remove('ok', 'err');
            }
            if (resBody) resBody.value = 'Fetching API response...';

            try {
                const options = { method: method };
                if (['POST', 'PATCH', 'PUT'].includes(method) && reqBodyText) {
                    options.body = reqBodyText;
                }

                const res = await window.sfApi.fetch(endpoint, options);
                const statusText = `HTTP ${res.status} ${res.statusText || ''}`;

                toolStates['api-tester'].apiStatus = statusText;
                if (statusBadge) {
                    statusBadge.innerText = statusText;
                    statusBadge.classList.toggle('ok', !!res.ok);
                    statusBadge.classList.toggle('err', !res.ok);
                }

                const text = await res.text().catch(() => '');
                let formattedJson = text;

                try {
                    const parsed = JSON.parse(text);
                    formattedJson = JSON.stringify(parsed, null, 2);
                } catch (e) { }

                toolStates['api-tester'].apiResBody = formattedJson;
                if (resBody) resBody.value = formattedJson;
                logToTerminal(`REST API Tester: ${method} ${endpoint} -> ${statusText}`, res.ok ? 'success' : 'error');
            } catch (e) {
                console.error('API Tester Error:', e);
                const errVal = `Error: ${e.message}`;
                toolStates['api-tester'].apiStatus = 'Request Failed';
                toolStates['api-tester'].apiResBody = errVal;
                if (statusBadge) {
                    statusBadge.innerText = 'Request Failed';
                    statusBadge.classList.add('err');
                    statusBadge.classList.remove('ok');
                }
                if (resBody) resBody.value = errVal;
                logToTerminal(`REST API Tester error: ${e.message}`, 'error');
            } finally {
                if (btnSend) {
                    btnSend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Request`;
                    btnSend.disabled = false;
                }
            }
        };

        if (btnSend) btnSend.onclick = doSend;
    }

    // ── Bulk Permission Wizard ──────────────────────────────────────────────
    // 4-step guided flow: Target & Objects → Objects & Record Types →
    // Fields & Perms → Verify & Execute. Reads real org metadata via the
    // Tooling/Data APIs and writes ObjectPermissions + FieldPermissions
    // through the composite endpoint (same mechanism as bulk-field-builder).
    function bindBulkPermissionWizardTabListeners() {
        const st = toolStates['bulk-permission-wizard'];

        const permSetSelect = document.getElementById('bpw-permset');
        const targetNameInput = document.getElementById('bpw-target-name');
        const objectSearchInput = document.getElementById('bpw-object-search');
        const selectAllCb = document.getElementById('bpw-select-all');
        const countBadge = document.getElementById('bpw-count-badge');
        const selectedPills = document.getElementById('bpw-selected-pills');
        const objectList = document.getElementById('bpw-object-list');
        const rtList = document.getElementById('bpw-rt-list');
        const rtAllCb = document.getElementById('bpw-rt-all');
        const fieldsList = document.getElementById('bpw-fields-list');
        const fieldsAllCb = document.getElementById('bpw-fields-all');
        const verifySummary = document.getElementById('bpw-verify-summary');
        const executeBtn = document.getElementById('bpw-execute');

        let permissionSets = [];
        let filteredObjects = [];
        let currentObjectName = ''; // object whose fields are shown in step 3

        // ── Selection fast-path ─────────────────────────────────────────────
        // Mirror st.selectedObjects in a Set for O(1) membership (was O(n·k)
        // per full render). The array is rewritten on every change so all
        // readers (verify / execute / step 2) keep working unchanged.
        let selectedSet = new Set(st.selectedObjects || []);
        function commitSelection() {
            st.selectedObjects = Array.from(selectedSet);
        }

        // Both search fields rebuilt the whole list on every keystroke; debounce.
        let searchDebounce = null;
        function scheduleObjectListRender() {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(renderObjectList, 120);
        }

        function goToStep(n) {
            st.step = n;
            document.querySelectorAll('.bpw-panel').forEach(p => {
                p.style.display = p.dataset.bpwPanel === String(n) ? '' : 'none';
            });
            document.querySelectorAll('.bpw-step').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.bpwStep, 10) <= n);
            });
            // The 3 connector lines sit between step circles; line i connects
            // step i to step i+1, so it lights up when we've passed step i.
            document.querySelectorAll('.bpw-step-line').forEach((l, i) => {
                l.classList.toggle('active', n > i + 1);
            });
            if (n === 4) renderVerifySummary();
        }

        function renderObjectList() {
            const q = (objectSearchInput?.value || '').toLowerCase().trim();
            const tq = (targetNameInput?.value || '').toLowerCase().trim();
            // Precomputed `_key` avoids re-lowercasing every object per keystroke.
            filteredObjects = st.allObjects.filter(o => {
                const key = o._key || (o._key = o.name.toLowerCase());
                return (!q || key.includes(q)) && (!tq || key.includes(tq));
            });

            if (countBadge) countBadge.innerText = `${filteredObjects.length} object${filteredObjects.length === 1 ? '' : 's'}`;

            if (!objectList) return;
            if (filteredObjects.length === 0) {
                objectList.innerHTML = '<div class="bpw-empty">No objects found</div>';
                renderPillsAndSelectAll();
                return;
            }

            // One string build + one innerHTML parse (was: createElement +
            // querySelector + addEventListener per row). Checkbox changes are
            // handled by ONE delegated listener, so toggling never rebuilds.
            let html = '';
            for (let i = 0; i < filteredObjects.length; i++) {
                const o = filteredObjects[i];
                const selected = selectedSet.has(o.name);
                html += '<div class="bpw-object-row' + (selected ? ' selected' : '') + '" data-name="' + escapeHtml(o.name) + '">' +
                            '<label class="bpw-object-check"><input type="checkbox"' + (selected ? ' checked' : '') + '></label>' +
                            '<span class="bpw-object-name">' + escapeHtml(o.name) + '</span>' +
                            '<span class="bpw-object-desc">' + escapeHtml(o.label || '') + '</span>' +
                        '</div>';
            }
            objectList.innerHTML = html;
            renderPillsAndSelectAll();
        }

        function renderPillsAndSelectAll() {
            // Cap pills so selecting all 1000+ objects doesn't spawn 1000 chips.
            if (selectedPills) {
                const MAX_PILLS = 40;
                const names = st.selectedObjects;
                const shown = names.slice(0, MAX_PILLS);
                const extra = names.length - shown.length;
                let html = '';
                for (let i = 0; i < shown.length; i++) {
                    html += `<span class="bpw-pill" data-pill-name="${escapeHtml(shown[i])}">${escapeHtml(shown[i])} <i class="fa-solid fa-xmark" style="cursor:pointer;margin-left:4px;"></i></span>`;
                }
                if (extra > 0) html += `<span class="bpw-pill bpw-pill-more" style="opacity:0.75;">+${extra} more</span>`;
                selectedPills.innerHTML = html;
            }
            if (selectAllCb) {
                const visible = filteredObjects.length > 0;
                const allChecked = visible && filteredObjects.every(o => selectedSet.has(o.name));
                selectAllCb.checked = allChecked;
            }
        }

        // Delegated listeners: one for row checkboxes, one for pill x-buttons.
        function bindBpwDelegation() {
            if (objectList && !objectList._bpwBound) {
                objectList._bpwBound = true;
                objectList.addEventListener('change', (e) => {
                    const cb = e.target;
                    if (!cb || cb.type !== 'checkbox') return;
                    const row = cb.closest('.bpw-object-row');
                    if (!row) return;
                    const name = row.getAttribute('data-name');
                    if (!name) return;
                    if (cb.checked) {
                        selectedSet.add(name);
                        row.classList.add('selected');
                    } else {
                        selectedSet.delete(name);
                        row.classList.remove('selected');
                    }
                    commitSelection();
                    renderPillsAndSelectAll();
                });
            }
            if (selectedPills && !selectedPills._bpwBound) {
                selectedPills._bpwBound = true;
                selectedPills.addEventListener('click', (e) => {
                    const x = e.target.closest('i.fa-xmark');
                    if (!x) return;
                    const pill = x.closest('.bpw-pill');
                    if (!pill) return;
                    const name = pill.getAttribute('data-pill-name');
                    if (!name) return;
                    selectedSet.delete(name);
                    commitSelection();
                    renderObjectList();
                });
            }
        }

        async function loadPermissionSets() {
            if (!permSetSelect) return;
            permSetSelect.innerHTML = '<option value="">Loading permission sets...</option>';
            try {
                const res = await cachedSfApiQuery(`SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Label ASC LIMIT 500`, true);
                permissionSets = (res && res.records) || [];
                if (permissionSets.length === 0) {
                    permSetSelect.innerHTML = '<option value="">No permission sets found</option>';
                    return;
                }
                permSetSelect.innerHTML = permissionSets.map(ps =>
                    `<option value="${ps.Id}">${escapeHtml(ps.Label)} (${escapeHtml(ps.Name)})</option>`
                ).join('');
                if (st.permissionSetId) permSetSelect.value = st.permissionSetId;
            } catch (e) {
                permSetSelect.innerHTML = `<option value="">Error loading: ${escapeHtml(e.message)}</option>`;
                logToTerminal(`Bulk Permission Wizard: failed to load permission sets — ${e.message}`, 'error');
            }
        }

        async function loadObjects() {
            const listEl = objectList;
            if (!listEl) return;
            if (st.allObjects.length > 0) {
                renderObjectList();
                return;
            }
            listEl.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading objects...</div>';
            try {
                // Describe Global gives every object with label + queryable flag
                const res = await window.sfApi.describeGlobal();
                const sobjects = (res && res.sobjects) || [];
                // `_key` is precomputed once so per-keystroke filters never
                // re-lowercase 1000+ objects.
                st.allObjects = sobjects
                    .filter(s => s.queryable !== false && !!s.name)
                    .map(s => ({ name: s.name, label: s.label || '', _key: s.name.toLowerCase() }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                // Remove Change Events / History / Share shadow objects for a
                // cleaner picker (they are not assignable via ObjectPermissions).
                st.allObjects = st.allObjects.filter(o => {
                    if (/__ChangeEvent$|__History$|__Share$/.test(o.name)) return false;
                    if (/^[a-z0-9]+(__c)?$/.test(o.name)) return true;
                    return true;
                });
                renderObjectList();
            } catch (e) {
                listEl.innerHTML = `<div class="bpw-empty">Failed to load objects: ${escapeHtml(e.message)}</div>`;
                logToTerminal(`Bulk Permission Wizard: failed to load objects — ${e.message}`, 'error');
            }
        }

        // Renders already-fetched record types; kept separate from the fetch
        // so the "All Record Types" toggle never re-queries Salesforce.
        function renderRecordTypes() {
            if (!rtList) return;
            const names = st.selectedObjects;
            if (!st.recordTypes || Object.keys(st.recordTypes).length === 0) {
                rtList.innerHTML = '<div class="bpw-empty">No active record types found for the selected objects.</div>';
                return;
            }
            rtList.innerHTML = '';
            names.forEach(objName => {
                const rts = st.recordTypes[objName] || [];
                if (rts.length === 0) return;
                const group = document.createElement('div');
                group.className = 'bpw-rt-group';
                group.innerHTML = `<div class="bpw-rt-object">${escapeHtml(objName)}</div><div class="bpw-rt-items"></div>`;
                const items = group.querySelector('.bpw-rt-items');
                // O(1) membership per row instead of array.includes.
                const selSet = st.selectedRecordTypes[objName] ? new Set(st.selectedRecordTypes[objName]) : null;
                rts.forEach(rt => {
                    const selected = !selSet || selSet.has(rt.Id);
                    const row = document.createElement('label');
                    row.className = 'bpw-rt-row';
                    row.innerHTML = `<input type="checkbox" data-rt-id="${rt.Id}" ${selected ? 'checked' : ''}> <span>${escapeHtml(rt.Name || rt.Id)}</span>`;
                    const cb = row.querySelector('input');
                    cb.addEventListener('change', () => {
                        if (!st.selectedRecordTypes[objName]) st.selectedRecordTypes[objName] = [];
                        if (cb.checked) {
                            if (!st.selectedRecordTypes[objName].includes(rt.Id)) st.selectedRecordTypes[objName].push(rt.Id);
                        } else {
                            st.selectedRecordTypes[objName] = st.selectedRecordTypes[objName].filter(id => id !== rt.Id);
                        }
                    });
                    items.appendChild(row);
                });
                rtList.appendChild(group);
            });
        }

        async function loadRecordTypes() {
            if (!rtList) return;
            rtList.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading record types...</div>';
            try {
                const names = st.selectedObjects;
                if (names.length === 0) {
                    st.recordTypes = {};
                    renderRecordTypes();
                    return;
                }
                // A single `SobjectType IN (...)` with hundreds of objects blows
                // past SOQL's ~20k-character query limit — batch and merge.
                const CHUNK = 150;
                const queries = [];
                for (let i = 0; i < names.length; i += CHUNK) {
                    const batch = names.slice(i, i + CHUNK);
                    queries.push(cachedSfApiQuery(
                        `SELECT Id, Name, SobjectType, IsActive FROM RecordType WHERE SobjectType IN (${batch.map(n => `'${n}'`).join(',')}) AND IsActive = true`, true
                    ));
                }
                const results = await Promise.all(queries);
                st.recordTypes = {};
                results.forEach(res => {
                    const records = (res && res.records) || [];
                    records.forEach(r => {
                        if (!st.recordTypes[r.SobjectType]) st.recordTypes[r.SobjectType] = [];
                        st.recordTypes[r.SobjectType].push(r);
                    });
                });
                renderRecordTypes();
            } catch (e) {
                rtList.innerHTML = `<div class="bpw-empty">Failed to load record types: ${escapeHtml(e.message)}</div>`;
                logToTerminal(`Bulk Permission Wizard: failed to load record types — ${e.message}`, 'error');
            }
        }

        // Renders the already-described fields; the "All Fields" toggle calls
        // this directly instead of re-describing the object.
        function renderFields() {
            if (!fieldsList) return;
            const entry = st.fieldPerms[currentObjectName] || {};
            const fieldNames = Object.keys(entry);
            if (fieldNames.length === 0) {
                fieldsList.innerHTML = '<div class="bpw-empty">No fields found.</div>';
                return;
            }
            fieldsList.innerHTML = '';
            fieldNames.forEach(fName => {
                const fp = entry[fName];
                const row = document.createElement('div');
                row.className = 'bpw-field-row';
                row.innerHTML = `
                    <span class="bpw-field-name">${escapeHtml(fp.label || fName)} <span class="bpw-field-api">${escapeHtml(fName)}</span></span>
                    <span class="bpw-field-type">${escapeHtml(fp.type || '')}</span>
                    <label class="bpw-field-toggle"><input type="checkbox" data-fld="${escapeHtml(fName)}" data-perm="read" ${fp.read ? 'checked' : ''}> Read</label>
                    <label class="bpw-field-toggle"><input type="checkbox" data-fld="${escapeHtml(fName)}" data-perm="edit" ${fp.edit ? 'checked' : ''}> Edit</label>
                `;
                row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', () => {
                        const perm = cb.dataset.perm;
                        if (perm === 'edit' && cb.checked) {
                            const readCb = row.querySelector('input[data-perm="read"]');
                            if (readCb) readCb.checked = true;
                            entry[cb.dataset.fld].read = true;
                        }
                        entry[cb.dataset.fld][perm] = cb.checked;
                    });
                });
                fieldsList.appendChild(row);
            });
        }

        async function loadFields() {
            if (!fieldsList) return;
            if (!currentObjectName) return;
            fieldsList.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading fields...</div>';
            try {
                const desc = await window.sfApi.describeSObject(currentObjectName);
                const fields = (desc && desc.fields) || [];
                st.fieldPerms[currentObjectName] = {};
                const stateEntry = st.fieldPerms[currentObjectName];
                fields.forEach(f => {
                    stateEntry[f.name] = { read: true, edit: f.updateable === true && f.createable === true, label: f.label || f.name, type: f.type || '' };
                });
                renderFields();
            } catch (e) {
                fieldsList.innerHTML = `<div class="bpw-empty">Failed to load fields: ${escapeHtml(e.message)}</div>`;
                logToTerminal(`Bulk Permission Wizard: failed to load fields — ${e.message}`, 'error');
            }
        }

        function renderVerifySummary() {
            if (!verifySummary) return;
            const ps = permissionSets.find(p => p.Id === st.permissionSetId);
            let html = `
                <div class="bpw-verify-row"><span>Permission Set</span><strong>${escapeHtml(ps ? `${ps.Label} (${ps.Name})` : st.permissionSetId || '—')}</strong></div>
                <div class="bpw-verify-row"><span>Objects</span><strong>${st.selectedObjects.length}</strong></div>
            `;
            st.selectedObjects.forEach(objName => {
                const fields = st.fieldPerms[objName] || {};
                const fieldCount = Object.keys(fields).length;
                const rts = st.recordTypes[objName] || [];
                html += `
                    <div class="bpw-verify-object">
                        <div class="bpw-verify-objhead"><strong>${escapeHtml(objName)}</strong><span>${fieldCount} fields</span></div>
                        <div class="bpw-verify-sub">Record Types: ${rts.length > 0 ? rts.length : 'All'}</div>
                    </div>
                `;
            });
            verifySummary.innerHTML = html;
        }

        async function executePermissions() {
            if (!executeBtn) return;
            if (!st.permissionSetId) {
                toast.error('Please select a permission set first.');
                return;
            }
            if (st.selectedObjects.length === 0) {
                toast.error('Please select at least one object.');
                return;
            }

            executeBtn.disabled = true;
            const orig = executeBtn.innerHTML;
            executeBtn.innerHTML = `<span class="comet-loader-inline"></span> Executing...`;

            const psId = st.permissionSetId;
            let success = 0, failed = 0;
            const failures = [];

            try {
                // 1. ObjectPermissions (CRUD) per selected object
                const objPerms = st.selectedObjects.map(objName => {
                    const crud = st.crudPerms[objName] || {};
                    return {
                        attributes: { type: 'ObjectPermissions' },
                        ParentId: psId,
                        SobjectType: objName,
                        PermissionsCreate: !!crud.create,
                        PermissionsRead: !!crud.read || !Object.keys(crud).length,
                        PermissionsEdit: !!crud.edit,
                        PermissionsDelete: !!crud.delete,
                        PermissionsViewAllRecords: false,
                        PermissionsModifyAllRecords: false
                    };
                });

                for (let i = 0; i < objPerms.length; i += 25) {
                    const chunk = objPerms.slice(i, i + 25);
                    const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                        method: 'POST',
                        body: JSON.stringify({
                            allOrNone: false,
                            compositeRequest: chunk.map((p, idx) => ({
                                method: 'POST',
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions`,
                                referenceId: `obj${idx}`,
                                body: p
                            }))
                        })
                    });
                    const json = await res.json();
                    (json.compositeResponse || []).forEach((cr, idx) => {
                        if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) success++;
                        else {
                            failed++;
                            const msg = cr.body && cr.body[0] && cr.body[0].message ? cr.body[0].message : (cr.body && cr.body.message ? cr.body.message : 'Object permission failed');
                            failures.push(`${chunk[idx].SobjectType}: ${msg}`);
                        }
                    });
                }

                // 2. FieldPermissions (FLS) per selected object + field
                const fieldPerms = [];
                st.selectedObjects.forEach(objName => {
                    const fields = st.fieldPerms[objName] || {};
                    Object.keys(fields).forEach(fieldName => {
                        const fp = fields[fieldName];
                        if (fp.read || fp.edit) {
                            fieldPerms.push({
                                attributes: { type: 'FieldPermissions' },
                                ParentId: psId,
                                SobjectType: objName,
                                Field: `${objName}.${fieldName}`,
                                PermissionsRead: !!fp.read,
                                PermissionsEdit: !!fp.edit
                            });
                        }
                    });
                });

                for (let i = 0; i < fieldPerms.length; i += 25) {
                    const chunk = fieldPerms.slice(i, i + 25);
                    const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                        method: 'POST',
                        body: JSON.stringify({
                            allOrNone: false,
                            compositeRequest: chunk.map((p, idx) => ({
                                method: 'POST',
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions`,
                                referenceId: `fld${idx}`,
                                body: p
                            }))
                        })
                    });
                    const json = await res.json();
                    (json.compositeResponse || []).forEach((cr, idx) => {
                        if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) success++;
                        else {
                            failed++;
                            const msg = cr.body && cr.body[0] && cr.body[0].message ? cr.body[0].message : (cr.body && cr.body.message ? cr.body.message : 'Field permission failed');
                            failures.push(`${chunk[idx].SobjectType}.${chunk[idx].Field}: ${msg}`);
                        }
                    });
                }

                if (verifySummary) {
                    verifySummary.innerHTML = `
                        <div class="bpw-verify-result ${failed === 0 ? 'ok' : 'err'}">
                            <i class="fa-solid ${failed === 0 ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                            <div><strong>${failed === 0 ? 'All permissions granted!' : 'Completed with errors'}</strong>
                            <span>${success} succeeded, ${failed} failed</span></div>
                        </div>
                        ${failures.slice(0, 20).map(f => `<div class="bpw-verify-fail">${escapeHtml(f)}</div>`).join('')}
                    `;
                }
                logToTerminal(`Bulk Permission Wizard: ${success} permissions granted, ${failed} failed`, failed === 0 ? 'success' : 'warn');
            } catch (e) {
                console.error('Bulk Permission Wizard execute error:', e);
                toast.error('Execution failed: ' + e.message);
                if (verifySummary) {
                    verifySummary.innerHTML = `<div class="bpw-verify-result err"><i class="fa-solid fa-circle-exclamation"></i><div><strong>Execution failed</strong><span>${escapeHtml(e.message)}</span></div></div>`;
                }
            } finally {
                executeBtn.disabled = false;
                executeBtn.innerHTML = orig;
            }
        }

        // Event wiring
        bindBpwDelegation();
        if (permSetSelect) permSetSelect.addEventListener('change', () => { st.permissionSetId = permSetSelect.value; });
        if (targetNameInput) targetNameInput.addEventListener('input', scheduleObjectListRender);
        if (objectSearchInput) objectSearchInput.addEventListener('input', scheduleObjectListRender);
        if (selectAllCb) {
            selectAllCb.addEventListener('change', () => {
                if (selectAllCb.checked) {
                    filteredObjects.forEach(o => selectedSet.add(o.name));
                } else {
                    filteredObjects.forEach(o => selectedSet.delete(o.name));
                }
                commitSelection();
                renderObjectList();
            });
        }
        if (rtAllCb) {
            rtAllCb.addEventListener('change', () => {
                if (rtAllCb.checked) st.selectedRecordTypes = {};
                else {
                    st.selectedRecordTypes = {};
                    Object.keys(st.recordTypes).forEach(objName => {
                        st.selectedRecordTypes[objName] = [];
                    });
                }
                // Re-render from the fetched data — no re-query.
                renderRecordTypes();
            });
        }
        if (fieldsAllCb) {
            fieldsAllCb.addEventListener('change', () => {
                if (!currentObjectName) return;
                const entry = st.fieldPerms[currentObjectName] || {};
                Object.keys(entry).forEach(f => {
                    entry[f].read = fieldsAllCb.checked;
                    entry[f].edit = fieldsAllCb.checked;
                });
                // Re-render from the described data — no re-describe.
                renderFields();
            });
        }

        const next1 = document.getElementById('bpw-next-1');
        const next2 = document.getElementById('bpw-next-2');
        const next3 = document.getElementById('bpw-next-3');
        const back2 = document.getElementById('bpw-back-2');
        const back3 = document.getElementById('bpw-back-3');
        const back4 = document.getElementById('bpw-back-4');

        if (next1) next1.addEventListener('click', () => {
            if (!st.permissionSetId) { toast.error('Select a permission set first.'); return; }
            if (st.selectedObjects.length === 0) { toast.error('Select at least one object.'); return; }
            loadRecordTypes();
            goToStep(2);
        });
        if (next2) next2.addEventListener('click', () => {
            currentObjectName = st.selectedObjects[0] || '';
            loadFields();
            goToStep(3);
        });
        if (next3) next3.addEventListener('click', () => goToStep(4));
        if (back2) back2.addEventListener('click', () => goToStep(1));
        if (back3) back3.addEventListener('click', () => goToStep(2));
        if (back4) back4.addEventListener('click', () => goToStep(3));
        if (executeBtn) executeBtn.addEventListener('click', executePermissions);

        // Init
        loadPermissionSets();
        loadObjects();
    }

    function openFileInEditor(fileName) {
        if (!currentFiles[fileName]) return;

        hideEditorWelcome();

        if (isDiffMode) {
            isDiffMode = false;
            const actBtnCompare = document.getElementById('act-btn-compare-org');
            if (actBtnCompare) actBtnCompare.classList.remove('active');
        }

        // A tab is "already open" only if it exists in the DOM — load functions
        // (loadApexAsset / loadLwcBundle) push the file into openTabPaths BEFORE
        // calling us, so an array check alone would wrongly skip renderTabs()
        // for freshly loaded files and the new tab would never appear.
        //
        // The duplicate-guard must be the ARRAY, not the DOM: openToolTab and the
        // loaders push the file into openTabPaths before calling us, so at this
        // point no tab element exists in the DOM yet — a DOM-only check would
        // push the same file a second time and render two identical tabs.
        let tabWasAlreadyOpen = false;
        document.querySelectorAll('#tabs-bar .tab').forEach(t => {
            if (t.dataset.filename === fileName) tabWasAlreadyOpen = true;
        });
        if (!openTabPaths.includes(fileName)) {
            openTabPaths.push(fileName);
        }

        activeFilePath = fileName;
        const fileObj = currentFiles[fileName];

        const leftPane = document.getElementById('monaco-container-left');
        const toolContainer = document.getElementById('tool-tab-container');

        if (fileObj.isTool) {
            if (leftPane) leftPane.style.display = 'none';
            if (toolContainer) {
                toolContainer.style.display = 'flex';
                renderToolTabUI(fileObj.toolType);
            }
            document.getElementById('editor-title').innerText = `${fileObj.title || fileName}`;
            updateHeaderContextButtons();
            updateTreeActiveStates();
            renderDocumentOutline();
            setStatus(`Tool Tab: ${fileObj.title || fileName}`);
            return;
        }

        if (toolContainer) {
            toolContainer.style.display = 'none';
            delete toolContainer.dataset.activeTool;
        }
        if (leftPane) leftPane.style.display = 'block';

        let monacoLang = fileObj.language;
        if (monacoLang === 'apex') monacoLang = 'java';

        if (fileObj.savedContent === undefined) {
            fileObj.savedContent = fileObj.content;
        }

        // Diff highlights are per-file: reset when switching to another file
        if (diffHighlightFile !== fileName) {
            diffHighlightOn = false;
            diffHighlightFile = null;
            diffDecorationIds = [];
        }

        createStandardEditor(fileObj.content, monacoLang);

        updateHeaderContextButtons();
        // Switching between already-open tabs only needs the active highlight
        // moved — no full tree/tab rebuild (that caused the jitter). New files
        // still get the full render so the new tab/tree entry appears.
        if (tabWasAlreadyOpen) {
            // Switching between already-open tabs: only move the highlights —
            // no tree/tab rebuild, no document-outline re-parse, no audit.
            updateTabActiveStates();
            updateTreeActiveStates();
        } else {
            // New file: append just its tab and move the tree highlight — no
            // full tab-bar / explorer rebuild, which made both jerk.
            appendTab(fileName);
            updateTreeActiveStates();
            renderDocumentOutline();
            logToTerminal(`Opened ${fileName} in Monaco Editor`, 'info');
        }
        updateSaveButtonState();
        // The status bar must still name the file now in view (cheap single
        // text assignment) — that's the only status work that happens on switch.
        setStatus(`Editing ${fileName}`);
    }

    function updateTabActiveStates() {
        const tabsBar = document.getElementById('tabs-bar');
        if (!tabsBar) return;
        tabsBar.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.filename === activeFilePath);
        });
        const activeTab = tabsBar.querySelector('.tab.active');
        if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function updateTreeActiveStates() {
        const tree = document.getElementById('file-tree');
        if (!tree) return;
        tree.querySelectorAll('.file-item').forEach(el => {
            const fn = el.dataset.filename;
            if (!fn) return;
            el.classList.toggle('active', fn === activeFilePath);
            el.style.opacity = openTabPaths.includes(fn) ? '1' : '0.7';
        });
    }

    async function saveCurrentFileToOrg() {
        if (!activeFilePath || !currentFiles[activeFilePath]) return;

        const savingFilePath = activeFilePath;
        const fileObj = currentFiles[savingFilePath];
        if (savingFilePaths.has(savingFilePath)) return;
        savingFilePaths.add(savingFilePath);
        const previousToastId = persistentSaveToastIds.get(savingFilePath);
        if (previousToastId && window.toast) window.toast.dismiss(previousToastId);
        const saveToastId = window.toast?.loading(
            isAutoDeployEnabled ? `Saving and deploying ${savingFilePath}…` : `Saving ${savingFilePath} as a local draft…`,
            { duration: 0 }
        );
        if (saveToastId) persistentSaveToastIds.set(savingFilePath, saveToastId);

        const autoFormat = document.getElementById('setting-format-on-save')?.value !== 'off';
        if (autoFormat && editorInstance) {
            try {
                await editorInstance.getAction('editor.action.formatDocument')?.run();
                if (activeFilePath === savingFilePath && currentFiles[savingFilePath]) {
                    currentFiles[savingFilePath].content = editorInstance.getValue();
                }
            } catch (e) { }
        }

        const btnSave = document.getElementById('btn-save-org');
        const originalBtnHtml = btnSave ? btnSave.innerHTML : '';
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.classList.add('saving-pulse');
            btnSave.innerHTML = `<span class="comet-loader-inline"></span> Saving...`;
        }

        setStatus(`Saving ${activeFilePath} to Salesforce Org...`);
        logToTerminal(`Initiating save for ${activeFilePath} to Salesforce Org...`, 'info');

        try {
            // Auto Deploy gate: when OFF, saves stay local only and are NOT
            // deployed to the Org (matches the status-bar toggle's promise).
            if (!isAutoDeployEnabled) {
                fileObj.savedContent = fileObj.content;
                fileObj.isDirty = false;
                fileObj.hasError = false;
                clearProblemsForFile(activeFilePath);
                saveRevisionSnapshot();
                clearDiffHighlights();
                renderTabs();
                if (btnSave) {
                    btnSave.style.display = 'flex';
                    btnSave.style.background = '#2ea043';
                    btnSave.style.color = '#ffffff';
                    btnSave.style.opacity = '1';
                    btnSave.innerHTML = `<i class="fa-solid fa-check"></i> Saved (Local)`;
                    setTimeout(() => {
                        btnSave.innerHTML = originalBtnHtml;
                        updateSaveButtonState();
                    }, 2500);
                }
                setStatus(`Saved ${activeFilePath} as a local draft (Deploy on Save is OFF).`);
                logToTerminal(`Saved ${activeFilePath} as a local draft — Deploy on Save is OFF, so Salesforce was not updated.`, 'warn');
                if (window.toast) {
                    if (saveToastId) window.toast.update(saveToastId, { type: 'warning', message: `${savingFilePath} was saved as a local draft. Salesforce was not updated.`, duration: 5000 });
                    else window.toast.warning(`${savingFilePath} was saved as a local draft. Salesforce was not updated.`, { duration: 5000 });
                }
                persistentSaveToastIds.delete(savingFilePath);
                return;
            }

            if (currentBundleInfo.type === 'lwc') {
                if (fileObj.id) {
                    try {
                        const endpoint = `/services/data/v60.0/tooling/sobjects/LightningComponentResource/${fileObj.id}`;
                        await sfApiRest(endpoint, {
                            method: 'PATCH',
                            body: JSON.stringify({ Source: fileObj.content })
                        });
                    } catch (patchErr) {
                        logToTerminal(`Direct LightningComponentResource PATCH not supported (${patchErr.message}). Re-creating resource via DELETE + POST...`, 'warn');
                        try {
                            await sfApiRest(`/services/data/v60.0/tooling/sobjects/LightningComponentResource/${fileObj.id}`, {
                                method: 'DELETE'
                            });
                        } catch (delErr) {
                            console.warn('Could not delete existing resource before recreate:', delErr);
                        }

                        let format = 'js';
                        if (activeFilePath.endsWith('.html')) format = 'html';
                        else if (activeFilePath.endsWith('.css')) format = 'css';
                        else if (activeFilePath.endsWith('.svg')) format = 'svg';
                        else if (activeFilePath.endsWith('.xml')) format = 'xml';

                        const relPath = fileObj.filePath || `lwc/${currentBundleInfo.name}/${activeFilePath}`;
                        const res = await sfApiRest(`/services/data/v60.0/tooling/sobjects/LightningComponentResource`, {
                            method: 'POST',
                            body: JSON.stringify({
                                LightningComponentBundleId: currentBundleInfo.id,
                                FilePath: relPath,
                                Format: format,
                                Source: fileObj.content
                            })
                        });
                        if (res && res.id) fileObj.id = res.id;
                    }
                } else {
                    let format = 'js';
                    if (activeFilePath.endsWith('.html')) format = 'html';
                    else if (activeFilePath.endsWith('.css')) format = 'css';
                    else if (activeFilePath.endsWith('.svg')) format = 'svg';
                    else if (activeFilePath.endsWith('.xml')) format = 'xml';

                    const endpoint = `/services/data/v60.0/tooling/sobjects/LightningComponentResource`;
                    const res = await sfApiRest(endpoint, {
                        method: 'POST',
                        body: JSON.stringify({
                            LightningComponentBundleId: currentBundleInfo.id,
                            FilePath: `lwc/${currentBundleInfo.name}/${activeFilePath}`,
                            Format: format,
                            Source: fileObj.content
                        })
                    });
                    if (res && res.id) fileObj.id = res.id;
                }

                fileObj.savedContent = fileObj.content;
                fileObj.isDirty = false;
                fileObj.hasError = false;
                clearProblemsForFile(activeFilePath);
                saveRevisionSnapshot();
                clearDiffHighlights();
                renderTabs();

                if (btnSave) {
                    btnSave.style.display = 'flex';
                    btnSave.style.background = '#2ea043';
                    btnSave.style.color = '#ffffff';
                    btnSave.style.opacity = '1';
                    btnSave.innerHTML = `<i class="fa-solid fa-check"></i> Saved!`;
                    setTimeout(() => {
                        btnSave.innerHTML = originalBtnHtml;
                        updateSaveButtonState();
                    }, 2000);
                }

            } else if (currentBundleInfo.type === 'aura' && fileObj.id) {
                logToTerminal(`Deploying Aura Definition '${activeFilePath}' via Tooling API...`, 'info');
                await sfApiRest(`/services/data/v60.0/tooling/sobjects/AuraDefinition/${fileObj.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ Source: fileObj.content })
                });
            } else if (currentBundleInfo.type === 'apex' && fileObj.id) {
                logToTerminal(`Deploying ${METADATA_MEMBER_TYPES[currentBundleInfo.type].label} via standard MetadataContainer...`, 'info');
                await deployViaMetadataContainer(currentBundleInfo.type, fileObj, activeFilePath);
            } else if (METADATA_MEMBER_TYPES[currentBundleInfo.type] && fileObj.id) {
                logToTerminal(`Deploying ${METADATA_MEMBER_TYPES[currentBundleInfo.type].label} via standard MetadataContainer...`, 'info');
                await deployViaMetadataContainer(currentBundleInfo.type, fileObj, activeFilePath);
            } else if (fileObj.id) {
                // Resolve the metadata type from the file extension so saves still
                // deploy via the standard container even when the bundle info
                // wasn't populated (e.g. file opened straight from the tree).
                let extType = null;
                if (activeFilePath.endsWith('.cls')) extType = 'apex';
                else if (activeFilePath.endsWith('.trigger')) extType = 'trigger';
                else if (activeFilePath.endsWith('.page')) extType = 'vfpage';
                else if (activeFilePath.endsWith('.component')) extType = 'vfcomponent';
                if (extType && METADATA_MEMBER_TYPES[extType]) {
                    logToTerminal(`Deploying ${METADATA_MEMBER_TYPES[extType].label} via standard MetadataContainer...`, 'info');
                    await deployViaMetadataContainer(extType, fileObj, activeFilePath);
                } else {
                    throw new Error(`Standard deployment is not supported for '${activeFilePath}'.`);
                }
            } else {
                throw new Error('This file is not linked to an Org record — reopen it from the Org Explorer to deploy.');
            }

            // Shared post-deploy success handling for every supported type.
            fileObj.savedContent = fileObj.content;
            fileObj.isDirty = false;
            fileObj.hasError = false;
            clearProblemsForFile(activeFilePath);
            saveRevisionSnapshot();
            clearDiffHighlights();
            renderTabs();

            if (btnSave) {
                btnSave.style.display = 'flex';
                btnSave.style.background = '#2ea043';
                btnSave.style.color = '#ffffff';
                btnSave.style.opacity = '1';
                btnSave.innerHTML = `<i class="fa-solid fa-check"></i> Saved!`;
                setTimeout(() => {
                    btnSave.innerHTML = originalBtnHtml;
                    updateSaveButtonState();
                }, 2000);
            }

            const savedLabel = (METADATA_MEMBER_TYPES[currentBundleInfo.type] || {}).label || (currentBundleInfo.type === 'aura' ? 'Aura Definition' : currentBundleInfo.type === 'lwc' ? 'LWC Resource' : 'File');
            setStatus(`Successfully saved ${savedLabel} ${activeFilePath} to Salesforce Org at ${new Date().toLocaleTimeString()}`);
            logToTerminal(`Successfully saved ${savedLabel} ${activeFilePath} to Salesforce Org!`, 'success');
            if (window.toast) {
                if (saveToastId) window.toast.update(saveToastId, { type: 'success', message: `Saved and deployed ${savingFilePath} to Salesforce.`, duration: 5000 });
                else window.toast.success(`Saved and deployed ${savingFilePath} to Salesforce.`, { duration: 5000 });
            }
            persistentSaveToastIds.delete(savingFilePath);
        } catch (e) {
            console.error('Error saving to Org:', e);
            if (btnSave) {
                btnSave.style.display = 'flex';
                btnSave.style.background = '#f87171';
                btnSave.style.color = '#ffffff';
                btnSave.style.opacity = '1';
                btnSave.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Save Error`;
                setTimeout(() => {
                    btnSave.innerHTML = originalBtnHtml;
                    updateSaveButtonState();
                }, 3000);
            }
            setStatus(`Save Failed: ${e.message}`, true);
            logToTerminal(`Save Failure in ${activeFilePath}: ${e.message}`, 'error');
            if (window.toast) {
                const message = `Could not save ${savingFilePath}: ${cleanErrorMessage(e.message)}. Your changes are still unsaved.`;
                if (saveToastId) window.toast.update(saveToastId, { type: 'error', message, duration: 0 });
                else persistentSaveToastIds.set(savingFilePath, window.toast.error(message, { duration: 0 }));
            }

            const match = e.message.match(/([^:\s]+\.[a-z]+):(\d+),(\d+)\s*:\s*(.*)/i);
            if (match) {
                const errFile = match[1];
                const errLine = match[2];
                const errCol = match[3];
                const errText = match[4];
                addProblemDiagnostic(errFile, errLine, errCol, errText);
            } else {
                addProblemDiagnostic(activeFilePath, 1, 1, e.message);
            }
        } finally {
            savingFilePaths.delete(savingFilePath);
            if (btnSave) btnSave.classList.remove('saving-pulse');
        }
    }

    // Standard MetadataContainer deployment — the same mechanism Salesforce
    // tooling uses for Apex classes, extended to every metadata type the
    // editor edits: ApexClass / ApexTrigger / ApexPage / ApexComponent.
    const METADATA_MEMBER_TYPES = {
        'apex': { member: 'ApexClassMember', label: 'Apex Class' },
        'trigger': { member: 'ApexTriggerMember', label: 'Apex Trigger' },
        'vfpage': { member: 'ApexPageMember', label: 'Visualforce Page' },
        'vfcomponent': { member: 'ApexComponentMember', label: 'Visualforce Component' }
    };

    async function deployViaMetadataContainer(type, fileObj, fileName) {
        const meta = METADATA_MEMBER_TYPES[type];
        if (!meta || !fileObj || !fileObj.id) {
            throw new Error(`Standard deploy is not supported for this file type (${type}).`);
        }
        const containerName = `ArcSave_${Date.now()}`;
        const containerRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/MetadataContainer', {
            method: 'POST',
            body: JSON.stringify({ Name: containerName })
        });
        const containerId = containerRes.id;

        await sfApiRest(`/services/data/v60.0/tooling/sobjects/${meta.member}`, {
            method: 'POST',
            body: JSON.stringify({
                MetadataContainerId: containerId,
                ContentEntityId: fileObj.id,
                Body: fileObj.content
            })
        });

        const reqRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/ContainerAsyncRequest', {
            method: 'POST',
            body: JSON.stringify({
                MetadataContainerId: containerId,
                IsCheckOnly: false
            })
        });
        const reqId = reqRes.id;

        let finished = false;
        let attempts = 0;
        while (attempts < 20 && !finished) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
            const checkRes = await window.sfApi.query(`SELECT Id, State, ErrorMsg, DeployDetails FROM ContainerAsyncRequest WHERE Id = '${reqId}'`, true);
            const rec = checkRes.records && checkRes.records[0];
            if (!rec) continue;
            if (rec.State === 'Completed') {
                finished = true;
            } else if (rec.State === 'CompletedWithErrors' || rec.State === 'Failed' || rec.State === 'Error' || rec.State === 'Aborted' || rec.State === 'Invalidated') {
                finished = true;
                let errStr = rec.ErrorMsg || `Deployment failed with state: ${rec.State}`;
                if (rec.DeployDetails && rec.DeployDetails.componentFailures && rec.DeployDetails.componentFailures.length > 0) {
                    const fail = rec.DeployDetails.componentFailures[0];
                    errStr = `Line ${fail.lineNumber || 1}, Col ${fail.columnNumber || 1}: ${fail.problem}`;
                    addProblemDiagnostic(fileName, fail.lineNumber || 1, fail.columnNumber || 1, fail.problem);
                } else {
                    addProblemDiagnostic(fileName, 1, 1, errStr);
                }
                throw new Error(errStr);
            }
        }
        if (!finished) {
            throw new Error(`Deployment did not complete within 20s (ContainerAsyncRequest ${reqId}). Check deployment status in Salesforce.`);
        }
        return meta.label;
    }

    let currentTargetBundleForFile = { name: '', id: null };

    function promptAddNewFile(targetBundleName, targetBundleId) {
        const bundleName = targetBundleName || currentBundleInfo.name;
        const bundleId = targetBundleId || currentBundleInfo.id;

        if (!bundleName) {
            toast.error('Please select or open a Lightning Web Component bundle first.');
            return;
        }

        currentTargetBundleForFile = { name: bundleName, id: bundleId };

        const modal = document.getElementById('create-file-modal');
        const inputBundle = document.getElementById('create-file-bundle-name');
        const inputName = document.getElementById('create-file-input-name');
        const errDiv = document.getElementById('create-file-modal-error');

        if (inputBundle) inputBundle.value = bundleName;
        if (inputName) {
            inputName.value = '';
            setTimeout(() => inputName.focus(), 100);
        }
        if (errDiv) errDiv.style.display = 'none';

        if (modal) modal.style.display = 'flex';
    }

    function executeCreateNewFileInBundle() {
        const bundleName = currentTargetBundleForFile.name || currentBundleInfo.name;
        const bundleId = currentTargetBundleForFile.id || currentBundleInfo.id;
        const inputName = document.getElementById('create-file-input-name');
        const errDiv = document.getElementById('create-file-modal-error');

        if (!inputName || !inputName.value.trim()) {
            if (errDiv) {
                errDiv.innerText = 'Please enter a valid file name (e.g. helper.js or styles.css)';
                errDiv.style.display = 'block';
            }
            return;
        }

        const trimmed = inputName.value.trim();
        if (currentFiles[trimmed]) {
            if (errDiv) {
                errDiv.innerText = `File '${trimmed}' already exists in '${bundleName}'.`;
                errDiv.style.display = 'block';
            }
            return;
        }

        let defaultContent = '';
        let lang = 'plaintext';
        if (trimmed.endsWith('.svg')) {
            defaultContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <circle cx="50" cy="50" r="40" fill="#0284c7" />\n</svg>`;
            lang = 'xml';
        } else if (trimmed.endsWith('.css')) {
            defaultContent = `/* Stylesheet for ${bundleName} */\n:host {\n    display: block;\n}`;
            lang = 'css';
        } else if (trimmed.endsWith('.js')) {
            defaultContent = `// Helper JavaScript Module for ${bundleName}\nexport function helperMethod() {\n    return true;\n}`;
            lang = 'javascript';
        } else if (trimmed.endsWith('.html')) {
            defaultContent = `<template>\n    <!-- Additional Template for ${bundleName} -->\n</template>`;
            lang = 'html';
        } else if (trimmed.endsWith('.json')) {
            defaultContent = `{\n  "name": "${bundleName}"\n}`;
            lang = 'json';
        }

        currentBundleInfo = { id: bundleId || currentBundleInfo.id, name: bundleName, type: 'lwc' };
        document.getElementById('editor-title').innerText = `LWC: ${bundleName}`;

        currentFiles[trimmed] = {
            id: null,
            filePath: `lwc/${bundleName}/${trimmed}`,
            content: defaultContent,
            language: lang,
            bundleName: bundleName
        };

        if (!openTabPaths.includes(trimmed)) {
            openTabPaths.push(trimmed);
        }

        const modal = document.getElementById('create-file-modal');
        if (modal) modal.style.display = 'none';

        renderOrgExplorerTree();
        openFileInEditor(trimmed);
        setStatus(`Added file ${trimmed} to '${bundleName}'. Click "Save to Org" to deploy it!`);
        logToTerminal(`Added file ${trimmed} to LWC bundle '${bundleName}'.`, 'info');
    }

    const CREATE_ASSET_TYPES = {
        lwc: {
            group: 'lwc-targets-group',
            hint: 'Use <code>camelCase</code> (e.g. <code>myAccountViewer</code>). Creates the bundle with <code>.js</code>/<code>.html</code>/<code>.js-meta.xml</code> plus your chosen extras.',
            placeholder: 'e.g. myAccountViewer'
        },
        lms: {
            group: 'lms-targets-group',
            hint: 'Use <code>camelCase</code>. Creates a message channel with your fields and exposure.',
            placeholder: 'e.g. orderUpdates'
        },
        agentforce: {
            group: 'agentforce-targets-group',
            hint: 'Use <code>PascalCase</code>. Creates a GenAI Lightning Type exposed to Agentforce.',
            placeholder: 'e.g. OrderSummaryAgent'
        },
        apex: {
            group: 'apex-config-group',
            hint: 'Use <code>PascalCase</code> (e.g. <code>AccountController</code>).',
            placeholder: 'e.g. AccountController'
        },
        trigger: {
            group: 'trigger-object-group',
            hint: 'Use <code>PascalCase</code> (e.g. <code>AccountTrigger</code>). Pick the sObject and events.',
            placeholder: 'e.g. AccountTrigger'
        },
        vfpage: {
            group: 'vf-config-group',
            hint: 'Use <code>PascalCase</code> (e.g. <code>AccountListPage</code>).',
            placeholder: 'e.g. AccountListPage'
        },
        vfcomp: {
            group: 'vf-comp-config-group',
            hint: 'Use <code>PascalCase</code> (e.g. <code>AccountCard</code>).',
            placeholder: 'e.g. AccountCard'
        }
    };

    // API Version pickers — each .create-api-version select gets a Custom…
    // option that reveals a text input so the user can type a version that
    // isn't in the preset list (e.g. their org's newest API).
    function initApiVersionPickers() {
        document.querySelectorAll('.create-api-version select.form-control').forEach(sel => {
            const customInput = document.getElementById(sel.id + '-custom');
            if (!customInput) return;
            sel.dataset.prev = sel.value || '60.0';
            const showCustom = (show) => {
                customInput.style.display = show ? 'block' : 'none';
                if (show) customInput.focus();
            };
            sel.addEventListener('change', () => {
                if (sel.value === '__custom__') {
                    showCustom(true);
                } else {
                    sel.dataset.prev = sel.value;
                    showCustom(false);
                    customInput.value = '';
                }
            });
            customInput.addEventListener('blur', () => {
                if (!customInput.value.trim()) {
                    showCustom(false);
                    sel.value = sel.dataset.prev || '60.0';
                }
            });
        });
    }

    // Reads the effective API version for a picker, honoring a typed custom
    // version when the select is on the Custom… option. Falls back to 60.0.
    function getCreateApiVersion(selectId) {
        const sel = document.getElementById(selectId);
        if (!sel) return '60.0';
        if (sel.value === '__custom__') {
            const customInput = document.getElementById(selectId + '-custom');
            const v = customInput ? customInput.value.trim() : '';
            return /^\d{2}(\.\d)?$/.test(v) ? v : '60.0';
        }
        return sel.value || '60.0';
    }

    function renderCreateAssetForm(type) {
        const info = CREATE_ASSET_TYPES[type] || CREATE_ASSET_TYPES.lwc;
        document.querySelectorAll('#create-modal .create-config-group').forEach(g => {
            g.style.display = 'none';
        });
        const group = document.getElementById(info.group);
        if (group) group.style.display = 'flex';
        const hint = document.getElementById('create-asset-hint');
        if (hint) hint.innerHTML = info.hint;
        const nameInput = document.getElementById('modal-asset-name');
        if (nameInput) nameInput.placeholder = info.placeholder;
        const errDiv = document.getElementById('create-modal-error');
        if (errDiv) {
            errDiv.style.display = 'none';
            errDiv.innerHTML = '';
        }
        updateCreateAssetPreview();
    }

    function getCreateAssetPreview(type, name) {
        const safeName = name || ({ lwc:'componentName', lms:'channelName', agentforce:'FunctionName', apex:'ClassName', trigger:'TriggerName', vfpage:'PageName', vfcomp:'ComponentName' }[type] || 'AssetName');
        if (type === 'lwc') {
            const files = [`${safeName}.js`, `${safeName}.html`, `${safeName}.js-meta.xml`];
            if (document.getElementById('feature-css')?.checked) files.push(`${safeName}.css`);
            if (document.getElementById('feature-svg')?.checked) files.push(`${safeName}.svg`);
            return files;
        }
        if (type === 'lms') return [`${safeName}.messageChannel-meta.xml`];
        if (type === 'agentforce') return [`GenAiFunction: ${safeName}`];
        if (type === 'apex') return [`${safeName}.cls`, `${safeName}.cls-meta.xml`];
        if (type === 'trigger') return [`${safeName}.trigger`, `${safeName}.trigger-meta.xml`];
        if (type === 'vfpage') return [`${safeName}.page`, `${safeName}.page-meta.xml`];
        if (type === 'vfcomp') return [`${safeName}.component`, `${safeName}.component-meta.xml`];
        return [safeName];
    }

    function updateCreateAssetPreview() {
        const type = document.getElementById('modal-asset-type')?.value || 'lwc';
        const name = document.getElementById('modal-asset-name')?.value.trim() || '';
        const preview = document.getElementById('create-asset-preview-files');
        if (preview) preview.innerHTML = getCreateAssetPreview(type, name).map(file => `<code>${escapeHtml(file)}</code>`).join('');
        const quick = document.getElementById('quick-action-type-row');
        if (quick) quick.style.display = type === 'lwc' && document.getElementById('target-quick-action')?.checked ? 'block' : 'none';
        const missing = [];
        if (!name) missing.push('asset name');
        if (type === 'trigger' && !document.getElementById('modal-trigger-sobject')?.value.trim()) missing.push('trigger sObject');
        if (type === 'agentforce' && !document.getElementById('agent-handler')?.value.trim()) missing.push('handler class');
        const summary = document.getElementById('create-required-summary');
        if (summary) summary.textContent = missing.length ? `Missing: ${missing.join(', ')}` : 'Required fields ready';
    }

    function openCreateModal() {
        const modalOverlay = document.getElementById('create-modal');
        const errDiv = document.getElementById('create-modal-error');
        if (errDiv) {
            errDiv.style.display = 'none';
            errDiv.innerHTML = '';
        }
        if (modalOverlay) {
            modalOverlay.style.display = 'flex';
            const typeSelect = document.getElementById('modal-asset-type');
            const nameInput = document.getElementById('modal-asset-name');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
            renderCreateAssetForm(typeSelect ? typeSelect.value : 'lwc');
        }
    }

    async function createNewAsset() {
        const type = document.getElementById('modal-asset-type').value;
        const name = document.getElementById('modal-asset-name').value.trim();
        const sObj = document.getElementById('modal-trigger-sobject').value.trim();
        const errDiv = document.getElementById('create-modal-error');
        const btnCreate = document.getElementById('modal-create-btn');

        if (errDiv) {
            errDiv.style.display = 'none';
            errDiv.innerHTML = '';
        }

        if (!name) {
            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> <strong>Validation Error:</strong> Please enter a name for the asset.`;
            } else {
                toast.error('Please enter a name for the asset.');
            }
            return;
        }

        if (type === 'trigger' && !sObj) {
            if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> Select a trigger sObject. The creator will not silently default to Account.'; }
            return;
        }
        if (type === 'agentforce' && !(document.getElementById('agent-handler')?.value || '').trim()) {
            if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> Enter an existing invocation handler Apex class.'; }
            return;
        }
        if (type === 'lwc' && document.getElementById('feature-is-exposed')?.checked !== false) {
            const anyTarget = [...document.querySelectorAll('#lwc-targets-group [id^="target-"]')].some(input => input.checked);
            if (!anyTarget) {
                if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> An exposed LWC requires at least one target surface.'; }
                return;
            }
        }

        // Per-type naming rules: LWC/LMS use camelCase, everything else PascalCase
        const camelCaseTypes = ['lwc', 'lms'];
        const namePattern = camelCaseTypes.includes(type) ? /^[a-z][a-zA-Z0-9]*$/ : /^[A-Z][a-zA-Z0-9]*$/;
        if (!namePattern.test(name)) {
            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> <strong>Validation Error:</strong> ${camelCaseTypes.includes(type) ? 'LWC/LMS names must be <code>camelCase</code> (start lowercase, letters/digits only)' : 'Names for this type must be <code>PascalCase</code> (start uppercase, letters/digits only)'}.`;
            }
            return;
        }

        const apiNamePattern = /^[A-Za-z][A-Za-z0-9_]*(?:__c|__e|__mdt)?$/;
        if (type === 'trigger' && !apiNamePattern.test(sObj)) {
            if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> Enter a valid Salesforce sObject API name.'; }
            return;
        }
        const controllerInputs = type === 'vfpage'
            ? ['vfpage-controller', 'vfpage-extensions']
            : type === 'vfcomp' ? ['vfcomp-controller'] : type === 'agentforce' ? ['agent-handler'] : [];
        for (const id of controllerInputs) {
            const raw = (document.getElementById(id)?.value || '').trim();
            if (raw && !raw.split(',').every(value => /^[A-Za-z][A-Za-z0-9_.]*$/.test(value.trim()))) {
                if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> Controller and handler names may contain only Salesforce identifier characters.'; }
                return;
            }
        }
        if (type === 'lms') {
            const fields = (document.getElementById('lms-fields-input')?.value || '').split(',').map(value => value.trim()).filter(Boolean);
            if (!fields.length || fields.some(field => !/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) || new Set(fields.map(field => field.toLowerCase())).size !== fields.length) {
                if (errDiv) { errDiv.style.display = 'block'; errDiv.innerHTML = '<strong>Validation Error:</strong> Add at least one unique message field using letters, digits, and underscores.'; }
                return;
            }
        }

        const originalBtnHtml = btnCreate ? btnCreate.innerHTML : 'Create Asset';
        if (btnCreate) {
            btnCreate.disabled = true;
            btnCreate.style.opacity = '0.7';
            btnCreate.innerHTML = `<span class="comet-loader-inline"></span> Creating...`;
        }

        setStatus(`Creating ${type.toUpperCase()} '${name}'...`);
        logToTerminal(`Creating ${type.toUpperCase()} '${name}' via Tooling API...`, 'info');

        try {
            if (type === 'lwc') {
                const lwcApiVersion = parseFloat(getCreateApiVersion('lwc-api-version') || '60.0');
                const metaXmlContent = generateLwcMetaXml(name, lwcApiVersion);

                const isExposed = document.getElementById('feature-is-exposed')?.checked !== false;
                const targets = [];
                if (isExposed) {
                    if (document.getElementById('target-app')?.checked) targets.push('lightning__AppPage');
                    if (document.getElementById('target-record')?.checked) targets.push('lightning__RecordPage');
                    if (document.getElementById('target-home')?.checked) targets.push('lightning__HomePage');
                    if (document.getElementById('target-utility')?.checked) targets.push('lightning__UtilityBar');
                    if (document.getElementById('target-community')?.checked) targets.push('siteforce__CommunityPage');
                    if (document.getElementById('target-flow')?.checked) targets.push('lightning__FlowScreen');
                    if (document.getElementById('target-quick-action')?.checked) targets.push('lightning__RecordAction');
                    if (document.getElementById('target-tab')?.checked) targets.push('lightning__Tab');
                }

                const metadataObj = {
                    apiVersion: lwcApiVersion,
                    isExposed: isExposed,
                    masterLabel: name,
                    description: (document.getElementById('lwc-description')?.value || '').trim() || undefined
                };
                if (targets.length > 0) {
                    metadataObj.targets = { target: targets };
                }

                const bundleRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentBundle', {
                    method: 'POST',
                    body: JSON.stringify({
                        FullName: name,
                        Metadata: metadataObj
                    })
                });

                if (!bundleRes || !bundleRes.id) throw new Error('Failed to create LWC Bundle.');

                // Deploy main .js file
                const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
                const jsSource = `import { LightningElement } from 'lwc';\n\nexport default class ${pascalName} extends LightningElement {\n\n}\n`;
                await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentResource', {
                    method: 'POST',
                    body: JSON.stringify({
                        LightningComponentBundleId: bundleRes.id,
                        FilePath: `lwc/${name}/${name}.js`,
                        Format: 'js',
                        Source: jsSource
                    })
                });

                // Deploy main .html file
                const htmlSource = `<template>\n    \n</template>\n`;
                await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentResource', {
                    method: 'POST',
                    body: JSON.stringify({
                        LightningComponentBundleId: bundleRes.id,
                        FilePath: `lwc/${name}/${name}.html`,
                        Format: 'html',
                        Source: htmlSource
                    })
                });

                // Deploy .js-meta.xml
                await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentResource', {
                    method: 'POST',
                    body: JSON.stringify({
                        LightningComponentBundleId: bundleRes.id,
                        FilePath: `lwc/${name}/${name}.js-meta.xml`,
                        Format: 'xml',
                        Source: metaXmlContent
                    })
                });

                // Option: Deploy Custom SVG Icon file if checked
                const wantSvg = document.getElementById('feature-svg')?.checked;
                if (wantSvg) {
                    const svgSource = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <circle cx="50" cy="50" r="40" fill="var(--sfarc-accent, #2196f3)" />\n  <path d="M35 50 L45 60 L65 40" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>\n</svg>`;
                    await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentResource', {
                        method: 'POST',
                        body: JSON.stringify({
                            LightningComponentBundleId: bundleRes.id,
                            FilePath: `lwc/${name}/${name}.svg`,
                            Format: 'svg',
                            Source: svgSource
                        })
                    }).catch(e => console.warn('Could not attach SVG icon:', e));
                }

                // Option: Deploy CSS file if checked
                const wantCss = document.getElementById('feature-css')?.checked;
                if (wantCss) {
                    const cssSource = `/* Stylesheet for ${name} */\n:host {\n    display: block;\n}`;
                    await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningComponentResource', {
                        method: 'POST',
                        body: JSON.stringify({
                            LightningComponentBundleId: bundleRes.id,
                            FilePath: `lwc/${name}/${name}.css`,
                            Format: 'css',
                            Source: cssSource
                        })
                    }).catch(e => console.warn('Could not attach CSS file:', e));
                }

                invalidateOrgMetadataCache();
                await fetchAllOrgMetadata();
                await loadLwcBundle(bundleRes.id, name);
                setStatus(`Created LWC Component '${name}' with custom targets & SVG icon!`);
                logToTerminal(`Successfully created LWC Component '${name}' with visual targets & SVG icon configured!`, 'success');
            } else if (type === 'apex') {
                const apexModifier = document.getElementById('apex-modifier')?.value || 'public';
                const apexSharing = document.getElementById('apex-sharing')?.value || 'inherited sharing';
                const apexIsTest = document.getElementById('apex-istest')?.checked === true;
                const apexDesc = (document.getElementById('apex-description')?.value || '').trim();
                const apexApiVersion = parseFloat(getCreateApiVersion('apex-api-version') || '60.0');

                let body = '';
                if (apexDesc) body += `/**\n * ${apexDesc}\n */\n`;
                if (apexIsTest) {
                    body += `@isTest\nprivate class ${name} {\n    @isTest\n    static void test() {\n\n    }\n}\n`;
                } else {
                    body += `${apexModifier} ${apexSharing} class ${name} {\n    public ${name}() {\n\n    }\n}\n`;
                }
                const classRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/ApexClass', {
                    method: 'POST',
                    body: JSON.stringify({ Name: name, Body: body, ApiVersion: apexApiVersion })
                });

                if (!classRes || !classRes.id) throw new Error('Failed to create Apex Class.');

                await fetchAllOrgMetadata();
                await loadApexAsset(classRes.id, name);
                setStatus(`Created Apex Class '${name}'!`);
                logToTerminal(`Successfully created Apex Class '${name}'!`, 'success');
            } else if (type === 'trigger') {
                const triggerEvents = [];
                [
                    ['trg-before-insert', 'before insert'],
                    ['trg-before-update', 'before update'],
                    ['trg-before-delete', 'before delete'],
                    ['trg-after-insert', 'after insert'],
                    ['trg-after-update', 'after update'],
                    ['trg-after-delete', 'after delete'],
                    ['trg-after-undelete', 'after undelete']
                ].forEach(([id, ev]) => {
                    if (document.getElementById(id)?.checked) triggerEvents.push(ev);
                });
                if (triggerEvents.length === 0) {
                    if (errDiv) {
                        errDiv.style.display = 'block';
                        errDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> <strong>Validation Error:</strong> Select at least one trigger event.`;
                    }
                    if (btnCreate) {
                        btnCreate.disabled = false;
                        btnCreate.style.opacity = '1';
                        btnCreate.innerHTML = originalBtnHtml;
                    }
                    return;
                }
                const triggerDescription = (document.getElementById('trigger-description')?.value || '').trim();
                const body = `${triggerDescription ? `/** ${triggerDescription.replace(/\*\//g, '* /')} */\n` : ''}trigger ${name} on ${sObj} (${triggerEvents.join(', ')}) {\n\n}`;
                const triggerApiVersion = parseFloat(getCreateApiVersion('trigger-api-version') || '60.0');
                const triggerRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/ApexTrigger', {
                    method: 'POST',
                    body: JSON.stringify({ Name: name, TableEnumOrId: sObj, Body: body, ApiVersion: triggerApiVersion })
                });

                if (!triggerRes || !triggerRes.id) throw new Error('Failed to create Apex Trigger.');

                await fetchAllOrgMetadata();
                await loadApexTrigger(triggerRes.id, name);
                setStatus(`Created Apex Trigger '${name}'!`);
                logToTerminal(`Successfully created Apex Trigger '${name}'!`, 'success');
            } else if (type === 'vfpage') {
                const vfpageApiVersion = parseFloat(getCreateApiVersion('vfpage-api-version') || '60.0');
                const stdController = (document.getElementById('vfpage-controller')?.value || '').trim();
                const controllerAttr = stdController ? ` standardController="${stdController}"` : '';
                const extensions = (document.getElementById('vfpage-extensions')?.value || '').trim();
                const extensionsAttr = extensions ? ` extensions="${extensions}"` : '';
                const showHeader = document.getElementById('vfpage-show-header')?.checked !== false;
                const sidebar = document.getElementById('vfpage-sidebar')?.checked !== false;
                const markup = `<apex:page${controllerAttr}${extensionsAttr} showHeader="${showHeader}" sidebar="${sidebar}">\n    <!-- Visualforce Page: ${name} -->\n    <h1>${name}</h1>\n</apex:page>`;
                const pageRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/ApexPage', {
                    method: 'POST',
                    body: JSON.stringify({ Name: name, MasterLabel: name, ApiVersion: vfpageApiVersion, Markup: markup })
                });

                if (!pageRes || !pageRes.id) throw new Error('Failed to create Visualforce Page.');

                await fetchAllOrgMetadata();
                await loadVfPage(pageRes.id, name);
                setStatus(`Created Visualforce Page '${name}'!`);
                logToTerminal(`Successfully created Visualforce Page '${name}'!`, 'success');
            } else if (type === 'vfcomp') {
                const vfcompApiVersion = parseFloat(getCreateApiVersion('vfcomp-api-version') || '60.0');
                const vfcompController = (document.getElementById('vfcomp-controller')?.value || '').trim();
                const vfcompAccess = document.getElementById('vfcomp-access')?.value || 'public';
                const markup = `<apex:component access="${vfcompAccess}"${vfcompController ? ` controller="${vfcompController}"` : ''}>\n    <!-- Visualforce Component: ${name} -->\n    <p>${name}</p>\n</apex:component>`;
                const compRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/ApexComponent', {
                    method: 'POST',
                    body: JSON.stringify({ Name: name, MasterLabel: name, ApiVersion: vfcompApiVersion, Markup: markup })
                });

                if (!compRes || !compRes.id) throw new Error('Failed to create Visualforce Component.');

                await fetchAllOrgMetadata();
                await loadVfComponent(compRes.id, name);
                setStatus(`Created Visualforce Component '${name}'!`);
                logToTerminal(`Successfully created Visualforce Component '${name}'!`, 'success');
            } else if (type === 'lms') {
                let lmsRes;
                try {
                    const lmsExposedObj = document.getElementById('lms-is-exposed');
                    const isExposed = lmsExposedObj ? lmsExposedObj.checked : true;
                    const lmsMasterLabel = (document.getElementById('lms-master-label')?.value || '').trim() || name;
                    const lmsDesc = (document.getElementById('lms-description')?.value || '').trim() || 'Lightning Message Channel created via Salesforce Comet';
                    const fieldsRaw = document.getElementById('lms-fields-input') ? document.getElementById('lms-fields-input').value : 'recordId, payload';
                    const fieldsList = fieldsRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    
                    const lightningMessageFields = fieldsList.map(f => ({
                        fieldName: f,
                        description: `Payload field: ${f}`
                    }));

                    lmsRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/LightningMessageChannel', {
                        method: 'POST',
                        body: JSON.stringify({
                            FullName: name,
                            Metadata: {
                                masterLabel: lmsMasterLabel,
                                isExposed: isExposed,
                                description: lmsDesc,
                                lightningMessageFields: lightningMessageFields
                            }
                        })
                    });
                } catch (lmsErr) { throw new Error(`Lightning Message Channel creation failed: ${lmsErr.message}`); }

                if (!lmsRes?.id) throw new Error('Salesforce did not confirm Lightning Message Channel creation.');

                invalidateOrgMetadataCache();
                await fetchAllOrgMetadata();
                await loadLmsChannel(lmsRes.id, name);
                setStatus(`Created Lightning Message Channel '${name}'!`);
                logToTerminal(`Successfully created Lightning Message Channel '${name}'!`, 'success');
            } else if (type === 'agentforce') {
                let agentRes;
                try {
                    const agentIsExposed = document.getElementById('agent-is-exposed')?.checked !== false;
                    const agentDesc = (document.getElementById('agent-description')?.value || '').trim() || 'Agentforce AI Agent Action created via Salesforce Comet';
                    const agentHandler = (document.getElementById('agent-handler')?.value || '').trim() || `${name}Handler`;
                    agentRes = await sfApiRest('/services/data/v60.0/tooling/sobjects/GenAiFunction', {
                        method: 'POST',
                        body: JSON.stringify({
                            FullName: name,
                            Metadata: {
                                masterLabel: name,
                                developerName: name,
                                description: agentDesc,
                                isExposed: agentIsExposed,
                                invocationTarget: agentHandler,
                                invocationTargetType: 'apex'
                            }
                        })
                    });
                } catch (agentErr) { throw new Error(`GenAI Function creation failed or is unsupported in this org: ${agentErr.message}`); }

                if (!agentRes?.id) throw new Error('Salesforce did not confirm GenAI Function creation. Check Agentforce licensing and API support.');

                invalidateOrgMetadataCache();
                await fetchAllOrgMetadata();
                await loadAgentforceType(agentRes.id, name);
                setStatus(`Created Agentforce Lightning Type '${name}'!`);
                logToTerminal(`Successfully created Agentforce Lightning Type (beta) '${name}'!`, 'success');
            }

            if (btnCreate) {
                btnCreate.disabled = false;
                btnCreate.style.opacity = '1';
                btnCreate.innerHTML = originalBtnHtml;
            }
            document.getElementById('create-modal').style.display = 'none';
        } catch (e) {
            console.error('Error creating asset:', e);
            const cleanedMsg = cleanErrorMessage(e.message);
            if (btnCreate) {
                btnCreate.disabled = false;
                btnCreate.style.opacity = '1';
                btnCreate.innerHTML = originalBtnHtml;
            }
            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> <strong>Error:</strong> ${escapeHtml(cleanedMsg)}`;
            }
            setStatus(`Creation Failed: ${cleanedMsg}`, true);
            logToTerminal(`Error creating asset: ${cleanedMsg}`, 'error');
            addProblemDiagnostic(name, 1, 1, cleanedMsg);
        }
    }

    function initDragResizers() {
        const sidebarResizer = document.getElementById('sidebar-resizer');
        const sidebarPanel = document.getElementById('sidebar-panel');
        const sidebarSearchPanel = document.getElementById('sidebar-search-panel');
        const activityBar = document.querySelector('.activity-bar');

        const terminalResizer = document.getElementById('terminal-resizer');
        const terminalPanel = document.getElementById('terminal-panel');

        // Returns the sidebar panel that is currently visible (explorer or search),
        // falling back to the explorer panel. Both share the same flex row, so
        // resizing the visible one keeps the drag handle in sync.
        function getVisibleSidebarPanel() {
            if (sidebarSearchPanel && sidebarSearchPanel.style.display === 'flex') {
                return sidebarSearchPanel;
            }
            return sidebarPanel;
        }

        // ====== Sidebar Horizontal Resizing ======
        if (sidebarResizer && sidebarPanel) {
            let isResizingSidebar = false;
            let resizingPanel = null;

            sidebarResizer.addEventListener('mousedown', (e) => {
                isResizingSidebar = true;
                resizingPanel = getVisibleSidebarPanel();
                sidebarResizer.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizingSidebar) return;
                const actWidth = activityBar ? activityBar.offsetWidth : 48;
                let newWidth = e.clientX - actWidth;
                if (newWidth < 160) newWidth = 160;
                if (newWidth > 700) newWidth = 700;

                if (resizingPanel) {
                    resizingPanel.style.width = newWidth + 'px';
                }
                if (editorInstance) editorInstance.layout();
                if (rightEditorInstance) rightEditorInstance.layout();
            });

            document.addEventListener('mouseup', () => {
                if (isResizingSidebar) {
                    isResizingSidebar = false;
                    resizingPanel = null;
                    sidebarResizer.classList.remove('resizing');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (editorInstance) editorInstance.layout();
                    if (rightEditorInstance) rightEditorInstance.layout();
                }
            });
        }

        // ====== Terminal Vertical Resizing ======
        if (terminalResizer && terminalPanel) {
            let isResizingTerminal = false;

            terminalResizer.addEventListener('mousedown', (e) => {
                isResizingTerminal = true;
                terminalResizer.classList.add('resizing');
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizingTerminal) return;
                const statusBar = document.querySelector('.status-bar');
                const statusHeight = statusBar ? statusBar.offsetHeight : 24;
                let newHeight = window.innerHeight - e.clientY - statusHeight;

                if (newHeight < 28) newHeight = 28;
                if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;

                terminalPanel.classList.remove('collapsed');
                terminalPanel.classList.remove('maximized');
                terminalPanel.style.height = newHeight + 'px';

                if (editorInstance) editorInstance.layout();
                if (rightEditorInstance) rightEditorInstance.layout();
            });

            document.addEventListener('mouseup', () => {
                if (isResizingTerminal) {
                    isResizingTerminal = false;
                    terminalResizer.classList.remove('resizing');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (editorInstance) editorInstance.layout();
                    if (rightEditorInstance) rightEditorInstance.layout();
                }
            });
        }

        // ====== Outline Vertical Resizing (drag the grip handle) ======
        const outlineResizer = document.getElementById('outline-resizer');
        const outlineSection = document.querySelector('.outline-section');
        if (outlineResizer && outlineSection) {
            let isResizingOutline = false;
            let startY = 0;
            let startHeight = 0;
            let moved = false;

            outlineResizer.addEventListener('pointerdown', (e) => {
                isResizingOutline = true;
                moved = false;
                outlineResizer.classList.add('resizing');
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
                startY = e.clientY;
                startHeight = outlineSection.offsetHeight;
                outlineResizer.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            outlineResizer.addEventListener('pointermove', (e) => {
                if (!isResizingOutline) return;
                const deltaY = e.clientY - startY;
                if (!moved && Math.abs(deltaY) < 3) return; // ignore accidental micro-moves
                moved = true;
                let newHeight = startHeight - deltaY; // dragging upwards increases height

                if (newHeight < 60) newHeight = 60;
                const maxAllowed = Math.round(window.innerHeight * 0.7);
                if (newHeight > maxAllowed) newHeight = maxAllowed;

                outlineSection.style.height = newHeight + 'px';
                outlineSection.style.maxHeight = newHeight + 'px'; // override initial max-height constraints
            });

            const endOutlineResize = (e) => {
                if (!isResizingOutline) return;
                isResizingOutline = false;
                outlineResizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (e && e.pointerId != null && outlineResizer.hasPointerCapture && outlineResizer.hasPointerCapture(e.pointerId)) {
                    try { outlineResizer.releasePointerCapture(e.pointerId); } catch (err) { }
                }
                if (moved) {
                    localStorage.setItem('sfarc-outline-height', outlineSection.style.height);
                }
            };
            outlineResizer.addEventListener('pointerup', endOutlineResize);
            outlineResizer.addEventListener('pointercancel', endOutlineResize);

            // Double-click resets the outline section to its default height
            outlineResizer.addEventListener('dblclick', () => {
                outlineSection.style.height = '180px';
                outlineSection.style.maxHeight = '180px';
                localStorage.setItem('sfarc-outline-height', '180px');
            });

            // Restore previous saved height
            const savedHeight = localStorage.getItem('sfarc-outline-height');
            if (savedHeight) {
                const parsed = parseInt(savedHeight, 10);
                if (parsed && parsed >= 60 && parsed <= window.innerHeight * 0.7) {
                    outlineSection.style.height = parsed + 'px';
                    outlineSection.style.maxHeight = parsed + 'px';
                }
            }
        }
    }

    function initEditor() {
        initMonaco();
        restoreAllEditorSettings();
        initDragResizers();

        const btnSave = document.getElementById('btn-save-org');
        const rightPaneFileSelect = document.getElementById('right-pane-file-select');

        // Activity Bar Icon Buttons
        const actExplorer = document.getElementById('act-btn-explorer');
        const actFindOrg = document.getElementById('act-btn-find-org');
        const actFindReplace = document.getElementById('act-btn-find-replace');
        const actJsonApex = document.getElementById('act-btn-json-apex');
        const actSoqlGraphql = document.getElementById('act-btn-soql-graphql');
        const actBackup = document.getElementById('act-btn-backup');
        const actExecApex = document.getElementById('act-btn-exec-apex');
        const actApiTester = document.getElementById('act-btn-api-tester');
        const actSecurity = document.getElementById('act-btn-security');
        const actCompareOrg = document.getElementById('act-btn-compare-org');
        const actRunTests = document.getElementById('act-btn-run-tests');
        const actSplit = document.getElementById('act-btn-split');
        const actNewAsset = document.getElementById('act-btn-new-asset');
        const actSaveOrg = document.getElementById('act-btn-save-org');
        const actSettings = document.getElementById('act-btn-settings');

        const jsonApexModal = document.getElementById('json-to-apex-modal');
        const btnConvertJsonApex = document.getElementById('btn-convert-json-apex');
        const btnInsertApexEditor = document.getElementById('btn-insert-apex-editor');
        const jsonApexClose = document.getElementById('json-apex-close');

        const soqlGraphqlModal = document.getElementById('soql-to-graphql-modal');
        const btnConvertSoqlGraphql = document.getElementById('btn-convert-soql-graphql');
        const btnCopyGraphql = document.getElementById('btn-copy-graphql');
        const soqlGraphqlClose = document.getElementById('soql-graphql-close');

        const backupExportModal = document.getElementById('backup-export-modal');
        const btnGenBackupPreview = document.getElementById('btn-generate-backup-preview');
        const btnDownloadBackup = document.getElementById('btn-download-backup-file');
        const backupExportClose = document.getElementById('backup-export-close');

        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');
        const btnFindNext = document.getElementById('btn-find-next');
        const btnReplaceOne = document.getElementById('btn-replace-one');
        const btnReplaceAll = document.getElementById('btn-replace-all');
        const btnCloseFind = document.getElementById('btn-close-find');

        const btnMatchCase = document.getElementById('find-toggle-match-case');
        const btnWholeWord = document.getElementById('find-toggle-whole-word');
        const btnRegex = document.getElementById('find-toggle-regex');

        const btnAddFile = document.getElementById('btn-add-file');
        const btnRefreshOrg = document.getElementById('btn-refresh-org');
        const searchInput = document.getElementById('sidebar-search-input');

        const modalOverlay = document.getElementById('create-modal');
        const modalCancel = document.getElementById('modal-cancel-btn');
        const modalCreate = document.getElementById('modal-create-btn');

        const deleteModal = document.getElementById('delete-asset-modal');
        const deleteCancelBtn = document.getElementById('delete-modal-cancel');
        const deleteConfirmBtn = document.getElementById('delete-modal-confirm');

        const execApexModal = document.getElementById('exec-apex-modal');
        const apexCancel = document.getElementById('apex-modal-cancel');
        const apexExec = document.getElementById('apex-modal-exec');

        const globalSearchModal = document.getElementById('global-search-modal');
        const globalSearchInput = document.getElementById('global-search-input');
        const globalSearchCancel = document.getElementById('global-search-cancel');

        const settingsModal = document.getElementById('settings-modal');
        const settingsCancel = document.getElementById('settings-cancel-btn');
        const settingTheme = document.getElementById('setting-theme');
        const settingFontSize = document.getElementById('setting-font-size');
        const settingWordWrap = document.getElementById('setting-word-wrap');

        const assetTypeSelect = document.getElementById('modal-asset-type');

        const btnCreateModal = document.getElementById('btn-create-modal');
        if (btnSave) btnSave.addEventListener('click', saveCurrentFileToOrg);
        if (btnCreateModal) btnCreateModal.addEventListener('click', openCreateModal);
        initApiVersionPickers();

        // Integrated Terminal Tabs & Controls Wiring
        const termTabsContainer = document.querySelector('.terminal-tabs');
        if (termTabsContainer) {
            termTabsContainer.addEventListener('click', (e) => {
                const tabEl = e.target.closest('.terminal-tab');
                if (!tabEl || !tabEl.id) return;
                const id = tabEl.id;
                if (id === 'terminal-tab-logs') showTerminalTab('logs');
                else if (id === 'terminal-tab-output') showTerminalTab('output');
                else if (id === 'terminal-tab-problems') showTerminalTab('problems');
                else if (id === 'terminal-tab-security') showTerminalTab('security');
                else if (id === 'terminal-tab-coverage') showTerminalTab('coverage');
                else if (id === 'terminal-tab-revisions') showTerminalTab('revisions');
            });
        }

        const btnClearTerm = document.getElementById('btn-clear-terminal');
        const btnMaximizeTerm = document.getElementById('btn-maximize-terminal');
        const btnToggleTerm = document.getElementById('btn-toggle-terminal');
        const btnToggleLogTailer = document.getElementById('btn-toggle-log-tailer');
        const btnRefreshLogsManual = document.getElementById('btn-refresh-logs-manual');
        const termHeader = document.querySelector('.terminal-header');

        if (btnClearTerm) {
            btnClearTerm.addEventListener('click', (e) => {
                e.stopPropagation();
                clearTerminal();
            });
        }

        if (btnMaximizeTerm) {
            btnMaximizeTerm.addEventListener('click', (e) => {
                e.stopPropagation();
                const termPanel = document.getElementById('terminal-panel');
                if (termPanel) {
                    termPanel.classList.remove('collapsed');
                    const isMax = termPanel.classList.toggle('maximized');
                    const iconExpand = btnMaximizeTerm.querySelector('.icon-expand');
                    const iconCompress = btnMaximizeTerm.querySelector('.icon-compress');
                    if (iconExpand && iconCompress) {
                        iconExpand.style.display = isMax ? 'none' : 'block';
                        iconCompress.style.display = isMax ? 'block' : 'none';
                    } else {
                        btnMaximizeTerm.className = isMax ? 'fa-solid fa-compress term-control-btn' : 'fa-solid fa-expand term-control-btn';
                    }
                    btnMaximizeTerm.title = isMax ? 'Restore Terminal' : 'Maximize Terminal';

                    // Sync the toggle term icon to down/normal since maximized
                    if (btnToggleTerm) {
                        const iconDown = btnToggleTerm.querySelector('.icon-down');
                        const iconUp = btnToggleTerm.querySelector('.icon-up');
                        if (iconDown && iconUp) {
                            iconDown.style.display = 'block';
                            iconUp.style.display = 'none';
                        }
                    }

                    if (editorInstance) editorInstance.layout();
                }
            });
        }

        if (btnToggleTerm) {
            btnToggleTerm.addEventListener('click', (e) => {
                e.stopPropagation();
                const termPanel = document.getElementById('terminal-panel');
                if (termPanel) {
                    termPanel.classList.remove('maximized');
                    const isCollapsed = termPanel.classList.toggle('collapsed');
                    const iconDown = btnToggleTerm.querySelector('.icon-down');
                    const iconUp = btnToggleTerm.querySelector('.icon-up');
                    if (iconDown && iconUp) {
                        iconDown.style.display = isCollapsed ? 'none' : 'block';
                        iconUp.style.display = isCollapsed ? 'block' : 'none';
                    } else {
                        btnToggleTerm.className = isCollapsed ? 'fa-solid fa-chevron-up term-control-btn' : 'fa-solid fa-chevron-down term-control-btn';
                    }
                    btnToggleTerm.title = isCollapsed ? 'Expand Terminal' : 'Collapse Terminal';

                    // Sync the maximize icon to normal/expand since collapsed
                    if (btnMaximizeTerm) {
                        const iconExpand = btnMaximizeTerm.querySelector('.icon-expand');
                        const iconCompress = btnMaximizeTerm.querySelector('.icon-compress');
                        if (iconExpand && iconCompress) {
                            iconExpand.style.display = 'block';
                            iconCompress.style.display = 'none';
                        }
                    }

                    if (editorInstance) editorInstance.layout();
                }
            });
        }

        if (btnToggleLogTailer) {
            btnToggleLogTailer.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLogTailer();
            });
            // Initial OFF styling should match the theme (dark red in light mode).
            if (!isLogTailerActive) {
                btnToggleLogTailer.style.color = dangerColor();
            }
        }

        if (btnRefreshLogsManual) {
            btnRefreshLogsManual.addEventListener('click', (e) => {
                e.stopPropagation();
                lastSeenLogId = null;
                pollLatestDebugLogs(true);
            });
        }

        if (termHeader) {
            termHeader.addEventListener('dblclick', (e) => {
                if (e.target.closest('.terminal-controls') || e.target.closest('.terminal-tab')) return;
                const termPanel = document.getElementById('terminal-panel');
                if (termPanel) {
                    termPanel.classList.remove('collapsed');
                    const isMax = termPanel.classList.toggle('maximized');
                    if (btnMaximizeTerm) {
                        const iconExpand = btnMaximizeTerm.querySelector('.icon-expand');
                        const iconCompress = btnMaximizeTerm.querySelector('.icon-compress');
                        if (iconExpand && iconCompress) {
                            iconExpand.style.display = isMax ? 'none' : 'block';
                            iconCompress.style.display = isMax ? 'block' : 'none';
                        } else {
                            btnMaximizeTerm.className = isMax ? 'fa-solid fa-compress term-control-btn' : 'fa-solid fa-expand term-control-btn';
                        }
                    }
                    if (btnToggleTerm) {
                        const iconDown = btnToggleTerm.querySelector('.icon-down');
                        const iconUp = btnToggleTerm.querySelector('.icon-up');
                        if (iconDown && iconUp) {
                            iconDown.style.display = 'block';
                            iconUp.style.display = 'none';
                        }
                    }
                    if (editorInstance) editorInstance.layout();
                }
            });
        }

        const sidebarSearch = document.getElementById('sidebar-search-panel');
        const sidebarOrg = document.getElementById('sidebar-panel');
        const codeSearchInput = document.getElementById('code-search-input');

        if (actExplorer) {
            actExplorer.addEventListener('click', () => {
                if (sidebarSearch.style.display === 'flex') {
                    // Back to explorer — inherit the search panel's width
                    if (sidebarOrg.style.width !== sidebarSearch.style.width) {
                        sidebarOrg.style.width = sidebarSearch.style.width || sidebarOrg.style.width;
                    }
                    sidebarSearch.style.display = 'none';
                    sidebarOrg.style.display = 'flex';
                    actFindOrg.classList.remove('active');
                    actExplorer.classList.add('active');
                } else {
                    sidebarOrg.classList.toggle('collapsed');
                    actExplorer.classList.toggle('active', !sidebarOrg.classList.contains('collapsed'));
                }
            });
        }
        if (actFindOrg) {
            actFindOrg.addEventListener('click', () => {
                if (sidebarSearch.style.display === 'flex') {
                    // Close search, revert to explorer
                    sidebarSearch.style.display = 'none';
                    sidebarOrg.style.display = 'flex';
                    actFindOrg.classList.remove('active');
                    actExplorer.classList.toggle('active', !sidebarOrg.classList.contains('collapsed'));
                } else {
                    // Open search — inherit the explorer panel's current width
                    if (sidebarSearch.style.width !== sidebarOrg.style.width) {
                        sidebarSearch.style.width = sidebarOrg.style.width || sidebarSearch.style.width;
                    }
                    sidebarOrg.style.display = 'none';
                    sidebarSearch.style.display = 'flex';
                    sidebarSearch.style.flexDirection = 'column';
                    actExplorer.classList.remove('active');
                    actFindOrg.classList.add('active');
                    if (codeSearchInput) codeSearchInput.focus();
                }
            });
        }
        // ── Sidebar Code Search (VS Code style find-in-org) ───────────────
        const searchResultsTree = document.getElementById('search-results-tree');
        const searchResultsSummary = document.getElementById('search-results-summary');
        const codeReplaceInput = document.getElementById('code-replace-input');
        const toggleReplaceBtn = document.getElementById('toggle-replace-btn');
        const replaceInputGroup = document.getElementById('replace-input-group');
        const btnSearchRefresh = document.getElementById('btn-search-refresh');
        const btnSearchClear = document.getElementById('btn-search-clear');
        const btnSearchNew = document.getElementById('btn-search-new');
        const btnSearchCollapse = document.getElementById('btn-search-collapse');
        const btnSearchReplaceAll = document.getElementById('btn-search-replace-all');
        const searchOptCase = document.getElementById('search-opt-case');
        const searchOptWord = document.getElementById('search-opt-word');
        const searchOptRegex = document.getElementById('search-opt-regex');
        const searchOptPreserveCase = document.getElementById('search-opt-preserve-case');

        const codeSearch = {
            term: '',
            caseSensitive: false,
            wholeWord: false,
            useRegex: false,
            preserveCase: false,
            history: [],
            histIdx: -1,
            bodyCache: null,          // [{type,name,id,bundleId,fileName,content}]
            fileResults: [],          // last rendered file groups
            expanded: new Set(),
            seq: 0,
            replaceOpen: false
        };
        let csDebounce;

        function codeSearchPattern(term) {
            let src = term;
            if (!codeSearch.useRegex) src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (codeSearch.wholeWord) src = '\\b' + src + '\\b';
            try {
                return new RegExp(src, codeSearch.caseSensitive ? 'g' : 'gi');
            } catch (e) {
                return null;
            }
        }

        function collectMatches(text, regex) {
            if (!text) return [];
            const lines = text.split('\n');
            const out = [];
            for (let i = 0; i < lines.length && out.length < 30; i++) {
                regex.lastIndex = 0;
                if (regex.test(lines[i])) out.push({ line: i + 1, text: lines[i] });
            }
            return out;
        }

        function codeSearchTypeIcon(type) {
            const icons = {
                ApexClass: 'fa-file-code', ApexTrigger: 'fa-bolt-lightning',
                ApexPage: 'fa-globe', ApexComponent: 'fa-puzzle-piece',
                LWC: 'fa-bolt', Aura: 'fa-wand-magic-sparkles',
                LightningMessageChannel: 'fa-broadcast-tower', AgentforceType: 'fa-robot'
            };
            return icons[type] || 'fa-file';
        }

        // Name-only matches (instant, uses the already-loaded org metadata)
        function codeSearchNameMatches(term) {
            const re = codeSearchPattern(term);
            if (!re) return [];
            const out = [];
            const push = (type, name, id) => {
                re.lastIndex = 0;
                if (re.test(name)) out.push({ type, name, id });
            };
            (orgMetadata.apexClasses || []).forEach(c => push('ApexClass', c.Name, c.Id));
            (orgMetadata.apexTriggers || []).forEach(t => push('ApexTrigger', t.Name, t.Id));
            (orgMetadata.lwcBundles || []).forEach(b => push('LWC', b.DeveloperName, b.Id));
            (orgMetadata.auraBundles || []).forEach(a => push('Aura', a.DeveloperName, a.Id));
            (orgMetadata.vfPages || []).forEach(p => push('ApexPage', p.Name, p.Id));
            (orgMetadata.vfComponents || []).forEach(c => push('ApexComponent', c.Name, c.Id));
            (orgMetadata.lmsChannels || []).forEach(c => push('LightningMessageChannel', c.DeveloperName || c.MasterLabel, c.Id));
            (orgMetadata.agentforceTypes || []).forEach(a => push('AgentforceType', a.DeveloperName || a.MasterLabel, a.Id));
            return out;
        }

        // Fetch file bodies once per session (cached). Refresh re-fetches.
        async function fetchCodeSearchBodyCache(force) {
            if (codeSearch.bodyCache && !force) return codeSearch.bodyCache;
            const queries = [
                ['ApexClass', `SELECT Id, Name, Body FROM ApexClass LIMIT 2000`],
                ['ApexTrigger', `SELECT Id, Name, Body FROM ApexTrigger LIMIT 2000`],
                ['ApexPage', `SELECT Id, Name, Markup FROM ApexPage LIMIT 2000`],
                ['ApexComponent', `SELECT Id, Name, Markup FROM ApexComponent LIMIT 2000`],
                ['LightningComponentResource', `SELECT Id, LightningComponentBundle.DeveloperName, LightningComponentBundleId, FilePath, Source FROM LightningComponentResource LIMIT 3000`],
                ['AuraDefinition', `SELECT Id, AuraDefinitionBundle.DeveloperName, AuraDefinitionBundleId, DefType, Source FROM AuraDefinition LIMIT 3000`]
            ];
            const cache = [];
            const results = await Promise.all(queries.map(([type, soql]) =>
                window.sfApi.query(soql, true)
                    .then(r => ({ type, records: (r && r.records) || [] }))
                    .catch(() => ({ type, records: [] }))
            ));
            results.forEach(({ type, records }) => {
                if (type === 'LightningComponentResource') {
                    records.forEach(r => cache.push({
                        type: 'LWC', name: r.DeveloperName, id: r.Id, bundleId: r.LightningComponentBundleId,
                        fileName: (r.FilePath || '').split('/').pop() || r.DeveloperName,
                        content: r.Source || ''
                    }));
                } else if (type === 'AuraDefinition') {
                    records.forEach(r => cache.push({
                        type: 'Aura', name: r.DeveloperName, id: r.Id, bundleId: r.AuraDefinitionBundleId,
                        fileName: `${r.DeveloperName} (${(r.DefType || 'COMPONENT').toLowerCase()})`,
                        content: r.Source || ''
                    }));
                } else {
                    const field = type === 'ApexPage' || type === 'ApexComponent' ? 'Markup' : 'Body';
                    records.forEach(r => cache.push({
                        type, name: r.Name, id: r.Id, bundleId: null,
                        fileName: type === 'ApexClass' ? `${r.Name}.cls` : type === 'ApexTrigger' ? `${r.Name}.trigger` : type === 'ApexPage' ? `${r.Name}.page` : `${r.Name}.component`,
                        content: r[field] || ''
                    }));
                }
            });
            codeSearch.bodyCache = cache;
            return cache;
        }

        function renderSidebarSearchResults() {
            const files = codeSearch.fileResults;
            const summary = searchResultsSummary;
            const tree = searchResultsTree;
            if (!tree) return;
            if (summary) {
                if (files.length === 0) {
                    summary.style.display = 'none';
                } else {
                    summary.style.display = 'block';
                    const total = files.reduce((n, f) => n + (f.lines ? f.lines.length : 1), 0);
                    summary.innerHTML = `<b>${total}</b> result${total !== 1 ? 's' : ''} in <b>${files.length}</b> file${files.length !== 1 ? 's' : ''}`;
                }
            }
            if (files.length === 0) {
                tree.innerHTML = '<div class="cs-empty">No results found.</div>';
                return;
            }
            tree.innerHTML = files.map(f => {
                const key = f.key || (f.type + ':' + (f.name || f.id));
                const isOpen = codeSearch.expanded.has(key) || codeSearch.expanded.size === 0;
                const lines = f.lines && f.lines.length ? f.lines : [{ line: 1, text: f.name }];
                return `<div class="cs-file-group" data-key="${escapeHtml(key)}">` +
                    `<div class="cs-file-header ${isOpen ? 'open' : ''}" data-open="${key}">` +
                    `<i class="cs-chev fa-solid fa-chevron-right"></i>` +
                    `<i class="fa-solid ${codeSearchTypeIcon(f.type)}" style="font-size:11px; color:var(--text-muted);"></i>` +
                    `<span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.name)}</span>` +
                    `<span class="cs-file-count">${f.lines && f.lines.length ? f.lines.length : 1}</span></div>` +
                    (isOpen ? lines.map(m =>
                        `<div class="cs-match-line" data-file="${key}" data-line="${m.line}" title="Open ${escapeHtml(f.name)} at line ${m.line}">` +
                        `<span class="cs-line-num">${m.line}</span>` +
                        `<span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.text.trim() || ' ')}</span></div>`
                    ).join('') : '') +
                    `</div>`;
            }).join('');

            // Store keyed metadata for opening files
            codeSearch._fileByKey = {};
            files.forEach(f => { codeSearch._fileByKey[f.key || (f.type + ':' + (f.name || f.id))] = f; });
        }

        async function executeSidebarSearch() {
            const term = (codeSearchInput ? codeSearchInput.value : '').trim();
            const mySeq = ++codeSearch.seq;
            if (typeof syncSearchClearBtn === 'function') syncSearchClearBtn();
            codeSearch.term = term;
            if (term.length < 2) {
                codeSearch.fileResults = [];
                renderSidebarSearchResults();
                if (searchResultsTree) {
                    searchResultsTree.innerHTML = '<div class="cs-empty">Type at least 2 characters to search org code.</div>';
                }
                return;
            }
            const regex = codeSearchPattern(term);
            if (!regex) {
                codeSearch.fileResults = [];
                renderSidebarSearchResults();
                if (searchResultsTree) searchResultsTree.innerHTML = '<div class="cs-error">Invalid regular expression.</div>';
                return;
            }
            if (searchResultsTree) searchResultsTree.innerHTML = '<div class="cs-info"><span class="comet-loader-inline"></span> Searching org code...</div>';

            const nameFiles = codeSearchNameMatches(term);
            const byKey = new Map();
            nameFiles.forEach(n => {
                const key = n.type + ':' + n.name;
                byKey.set(key, { key, type: n.type, name: n.name, id: n.id, lines: null });
            });

            // Content pass (bodies fetched once, cached)
            try {
                const cache = await fetchCodeSearchBodyCache(false);
                if (mySeq !== codeSearch.seq) return; // superseded by a newer keystroke
                cache.forEach(entry => {
                    regex.lastIndex = 0;
                    if (!regex.test(entry.content)) return;
                    const key = entry.type + ':' + entry.name;
                    const lines = collectMatches(entry.content, regex);
                    if (byKey.has(key)) {
                        const existing = byKey.get(key);
                        if (existing.lines === null) existing.lines = [];
                        lines.forEach(l => {
                            if (existing.lines.length < 30) existing.lines.push(l);
                        });
                    } else {
                        byKey.set(key, { key, type: entry.type, name: entry.name, id: entry.id, bundleId: entry.bundleId, fileName: entry.fileName, lines });
                    }
                });
            } catch (e) {
                console.error('Content search failed:', e);
            }
            if (mySeq !== codeSearch.seq) return;

            // Also scan already-open workspace files (no API needed)
            Object.keys(currentFiles).forEach(fileName => {
                const fo = currentFiles[fileName];
                if (!fo || !fo.content) return;
                regex.lastIndex = 0;
                if (!regex.test(fo.content)) return;
                const key = 'open:' + fileName;
                if (byKey.has(key)) return;
                byKey.set(key, { key, type: fo.bundleName ? 'LWC' : 'ApexClass', name: fileName, id: fo.id, fileName, lines: collectMatches(fo.content, regex) });
            });

            const files = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
            codeSearch.fileResults = files;
            if (codeSearch.expanded.size === 0) {
                files.forEach(f => codeSearch.expanded.add(f.key));
            }
            renderSidebarSearchResults();
        }

        async function openCodeSearchFile(f) {
            if (!f) return;
            try {
                if (f.type === 'LWC') await loadLwcBundle(f.bundleId || f.id, f.name);
                else if (f.type === 'Aura') await loadAuraBundle(f.bundleId || f.id, f.name);
                else if (f.type === 'ApexClass') await loadApexAsset(f.id, f.name);
                else if (f.type === 'ApexTrigger') await loadApexTrigger(f.id, f.name);
                else if (f.type === 'ApexPage') await loadVfPage(f.id, f.name);
                else if (f.type === 'ApexComponent') await loadVfComponent(f.id, f.name);
                else if (f.type === 'LightningMessageChannel') await loadLmsChannel(f.id, f.name);
                else if (f.type === 'AgentforceType') await loadAgentforceType(f.id, f.name);
                const fileName = f.fileName || (f.name && !f.name.includes('.') ? null : f.name);
                if (fileName && currentFiles[fileName]) openFileInEditor(fileName);
            } catch (e) {
                console.error('Open search result failed:', e);
                if (typeof logToTerminal === 'function') logToTerminal(`Failed to open ${f.name}: ${e.message}`, 'error');
            }
        }

        // Result click handling (delegation)
        if (searchResultsTree) {
            searchResultsTree.addEventListener('click', async (e) => {
                const lineEl = e.target.closest('.cs-match-line');
                if (lineEl) {
                    const f = codeSearch._fileByKey && codeSearch._fileByKey[lineEl.dataset.file];
                    if (f) {
                        await openCodeSearchFile(f);
                        const line = parseInt(lineEl.dataset.line, 10) || 1;
                        if (editorInstance) {
                            editorInstance.revealLineInCenter(line);
                            editorInstance.setPosition({ lineNumber: line, column: 1 });
                            editorInstance.focus();
                        }
                    }
                    return;
                }
                const hdr = e.target.closest('.cs-file-header');
                if (hdr) {
                    const key = hdr.dataset.open;
                    const wasOpen = codeSearch.expanded.has(key);
                    if (wasOpen) codeSearch.expanded.delete(key); else codeSearch.expanded.add(key);
                    hdr.classList.toggle('open', !wasOpen);
                    const group = hdr.closest('.cs-file-group');
                    const matches = group.querySelectorAll('.cs-match-line');
                    matches.forEach(m => { m.style.display = wasOpen ? 'none' : ''; });
                }
            });
        }

        // Input: debounced live search + Enter + ↑/↓ history
        if (codeSearchInput) {
            codeSearchInput.addEventListener('input', () => {
                clearTimeout(csDebounce);
                csDebounce = setTimeout(executeSidebarSearch, 300);
            });
            codeSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(csDebounce);
                    const term = codeSearchInput.value.trim();
                    if (term && codeSearch.history[codeSearch.history.length - 1] !== term) {
                        codeSearch.history.push(term);
                        if (codeSearch.history.length > 10) codeSearch.history.shift();
                    }
                    codeSearch.histIdx = -1;
                    executeSidebarSearch();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    if (codeSearch.history.length === 0) return;
                    e.preventDefault();
                    if (e.key === 'ArrowUp') {
                        codeSearch.histIdx = codeSearch.histIdx < 0 ? codeSearch.history.length - 1 : Math.max(0, codeSearch.histIdx - 1);
                    } else {
                        codeSearch.histIdx = codeSearch.histIdx >= codeSearch.history.length - 1 ? -1 : codeSearch.histIdx + 1;
                    }
                    codeSearchInput.value = codeSearch.histIdx === -1 ? '' : codeSearch.history[codeSearch.histIdx];
                } else if (e.key === 'Escape') {
                    codeSearchInput.value = '';
                    executeSidebarSearch();
                }
            });
        }

        // Match option toggles (Aa / ab / .* / AB)
        const csToggle = (el, prop) => {
            if (!el) return;
            el.addEventListener('click', () => {
                el.classList.toggle('active');
                codeSearch[prop] = el.classList.contains('active');
                clearTimeout(csDebounce);
                executeSidebarSearch();
            });
        };
        csToggle(searchOptCase, 'caseSensitive');
        csToggle(searchOptWord, 'wholeWord');
        csToggle(searchOptRegex, 'useRegex');
        csToggle(searchOptPreserveCase, 'preserveCase');

        // Replace row toggle (chevron)
        if (toggleReplaceBtn && replaceInputGroup) {
            toggleReplaceBtn.addEventListener('click', () => {
                codeSearch.replaceOpen = !codeSearch.replaceOpen;
                replaceInputGroup.style.display = codeSearch.replaceOpen ? 'flex' : 'none';
                const chev = toggleReplaceBtn.querySelector('i');
                if (chev) chev.style.transform = codeSearch.replaceOpen ? 'rotate(90deg)' : '';
                if (codeSearch.replaceOpen && codeReplaceInput) codeReplaceInput.focus();
            });
        }

        // Replace All across current results (loads files, updates local content, user saves)
        if (btnSearchReplaceAll) {
            btnSearchReplaceAll.addEventListener('click', async () => {
                const files = codeSearch.fileResults;
                const term = codeSearch.term;
                const repl = codeReplaceInput ? codeReplaceInput.value : '';
                if (files.length === 0 || term.length < 2) {
                    if (typeof logToTerminal === 'function') logToTerminal('Nothing to replace — run a search first.', 'warning');
                    return;
                }
                if (repl === '' && !(await toast.confirm('Replace with empty string? This deletes the matched text.', {danger: true}))) return;
                if (!(await toast.confirm(`Replace "${term}" (${files.length} file${files.length !== 1 ? 's' : ''})? Modified files stay local — review and Save to push to org.`))) return;
                try {
                    const cache = await fetchCodeSearchBodyCache(false);
                    const pattern = codeSearchPattern(term);
                    if (!pattern) return;
                    let replacedCount = 0;
                    let changedFiles = 0;
                    for (const f of files) {
                        let entry = null;
                        if (f.key && f.key.startsWith('open:')) {
                            const fo = currentFiles[f.name];
                            if (fo) entry = { type: f.type, name: f.name, id: fo.id, fileName: f.name, content: fo.content };
                        } else {
                            entry = cache.find(c => c.type === f.type && c.name === f.name) || null;
                        }
                        if (!entry) continue;
                        pattern.lastIndex = 0;
                        const before = entry.content || '';
                        const after = before.replace(pattern, () => repl);
                        if (after === before) continue;
                        const matched = (before.match(pattern) || []).length;
                        replacedCount += matched;
                        // Load into the workspace (if not already open) and update content (dirty = unsaved)
                        const fileName = entry.fileName || entry.name;
                        if (!currentFiles[fileName]) {
                            await openCodeSearchFile({ type: f.type, id: f.id, bundleId: f.bundleId, name: f.name });
                        }
                        if (currentFiles[fileName]) {
                            const fo = currentFiles[fileName];
                            if (fo.savedContent === undefined) fo.savedContent = fo.content;
                            fo.content = after;
                            changedFiles++;
                        }
                    }
                    if (typeof logToTerminal === 'function') {
                        logToTerminal(`Replace All: ${replacedCount} occurrence${replacedCount !== 1 ? 's' : ''} replaced across ${changedFiles} file${changedFiles !== 1 ? 's' : ''}. Review and Save to push to org.`, changedFiles ? 'success' : 'warning');
                    }
                    if (activeFilePath && currentFiles[activeFilePath] && editorInstance) {
                        openFileInEditor(activeFilePath);
                    }
                    if (typeof updateSaveButtonState === 'function') updateSaveButtonState();
                    executeSidebarSearch();
                } catch (err) {
                    console.error('Replace All failed:', err);
                    if (typeof logToTerminal === 'function') logToTerminal(`Replace All failed: ${err.message}`, 'error');
                }
            });
        }

        // Header actions: refresh (re-fetch bodies + rerun), clear, collapse
        if (btnSearchRefresh) {
            btnSearchRefresh.addEventListener('click', async () => {
                codeSearch.bodyCache = null;
                if (searchResultsTree) searchResultsTree.innerHTML = '<div class="cs-info"><span class="comet-loader-inline"></span> Refreshing org code index...</div>';
                await fetchCodeSearchBodyCache(true);
                executeSidebarSearch();
            });
        }
        if (btnSearchClear) {
            btnSearchClear.addEventListener('click', () => {
                if (codeSearchInput) codeSearchInput.value = '';
                codeSearch.term = '';
                codeSearch.fileResults = [];
                codeSearch.expanded.clear();
                if (searchResultsSummary) searchResultsSummary.style.display = 'none';
                if (searchResultsTree) searchResultsTree.innerHTML = '<div class="cs-empty">Type to search org metadata</div>';
            });
        }
        if (btnSearchCollapse) {
            btnSearchCollapse.addEventListener('click', () => {
                codeSearch.fileResults.forEach(f => codeSearch.expanded.delete(f.key));
                if (searchResultsTree) searchResultsTree.querySelectorAll('.cs-file-header').forEach(h => h.classList.remove('open'));
                if (searchResultsTree) searchResultsTree.querySelectorAll('.cs-match-line').forEach(m => { m.style.display = 'none'; });
            });
        }
        if (btnSearchNew) {
            btnSearchNew.addEventListener('click', () => {
                if (codeSearchInput) codeSearchInput.value = '';
                codeSearch.term = '';
                codeSearch.fileResults = [];
                codeSearch.expanded.clear();
                if (searchResultsSummary) searchResultsSummary.style.display = 'none';
                if (searchResultsTree) searchResultsTree.innerHTML = '<div class="cs-empty">Type to search org metadata</div>';
                if (codeSearchInput) codeSearchInput.focus();
            });
        }

        // Inline clear (×) inside the search box — shows once there is text
        const codeSearchClear = document.getElementById('code-search-clear');
        const syncSearchClearBtn = () => {
            if (codeSearchClear) codeSearchClear.hidden = !(codeSearchInput && codeSearchInput.value !== '');
        };
        if (codeSearchInput && codeSearchClear) {
            codeSearchInput.addEventListener('input', syncSearchClearBtn);
            codeSearchClear.addEventListener('click', () => {
                codeSearchInput.value = '';
                syncSearchClearBtn();
                codeSearchInput.focus();
                executeSidebarSearch();
            });
            syncSearchClearBtn();
        }

        // More-options (…) dropdown menu
        const searchMoreBtn = document.getElementById('search-more-btn');
        const searchMoreMenu = document.getElementById('search-more-menu');
        function updateSearchMenuChecks() {
            const setCheck = (id, on) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('checked', !!on);
            };
            setCheck('cs-more-case', codeSearch.caseSensitive);
            setCheck('cs-more-word', codeSearch.wholeWord);
            setCheck('cs-more-regex', codeSearch.useRegex);
            setCheck('cs-more-replace', codeSearch.replaceOpen);
        }
        if (searchMoreBtn && searchMoreMenu) {
            searchMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = searchMoreMenu.style.display === 'block';
                searchMoreMenu.style.display = open ? 'none' : 'block';
                if (!open) updateSearchMenuChecks();
            });
            document.addEventListener('click', (e) => {
                if (searchMoreMenu.style.display === 'block'
                    && !searchMoreMenu.contains(e.target)
                    && e.target !== searchMoreBtn
                    && !searchMoreBtn.contains(e.target)) {
                    searchMoreMenu.style.display = 'none';
                }
            });
            const menuAction = (id, fn) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', () => {
                    searchMoreMenu.style.display = 'none';
                    fn();
                });
            };
            menuAction('cs-more-case', () => { if (searchOptCase) searchOptCase.click(); });
            menuAction('cs-more-word', () => { if (searchOptWord) searchOptWord.click(); });
            menuAction('cs-more-regex', () => { if (searchOptRegex) searchOptRegex.click(); });
            menuAction('cs-more-replace', () => { if (toggleReplaceBtn) toggleReplaceBtn.click(); });
            menuAction('cs-more-clear', () => { if (btnSearchClear) btnSearchClear.click(); });
            menuAction('cs-more-refresh', () => { if (btnSearchRefresh) btnSearchRefresh.click(); });
            menuAction('cs-more-collapse', () => { if (btnSearchCollapse) btnSearchCollapse.click(); });
        }

        if (actFindReplace) actFindReplace.addEventListener('click', () => toggleFindReplaceDrawer());
        if (actJsonApex) actJsonApex.addEventListener('click', () => openToolTab('json-to-apex'));
        if (actSoqlGraphql) actSoqlGraphql.addEventListener('click', () => openToolTab('soql-to-graphql'));
        if (actBackup) actBackup.addEventListener('click', () => openToolTab('metadata-backup'));
        if (actExecApex) actExecApex.addEventListener('click', () => openToolTab('anon-apex'));
        const hdrRunTests = document.getElementById('hdr-btn-run-tests');
        const hdrSecurity = document.getElementById('hdr-btn-security');
        const hdrExecApex = document.getElementById('hdr-btn-exec-apex');

        if (hdrRunTests) hdrRunTests.addEventListener('click', runApexTests);
        if (hdrSecurity) hdrSecurity.addEventListener('click', () => {
            showTerminalTab('security');
            analyzeApexSecurity();
        });
        if (hdrExecApex) hdrExecApex.addEventListener('click', () => openToolTab('anon-apex'));

        if (actApiTester) actApiTester.addEventListener('click', () => openToolTab('api-tester'));

        const actBulkPerm = document.getElementById('act-btn-bulk-perm');
        if (actBulkPerm) actBulkPerm.addEventListener('click', () => {
            // The wizard is a standalone page in its own browser tab.
            const host = window.location.hostname;
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'openExtensionPage',
                    page: 'bulk-permission-wizard',
                    params: { host: host }
                });
            } else {
                window.open('bulk-permission-wizard.html?host=' + encodeURIComponent(host), '_blank');
            }
        });

        if (actSecurity) actSecurity.addEventListener('click', () => {
            showTerminalTab('security');
            analyzeApexSecurity();
        });
        if (actCompareOrg) actCompareOrg.addEventListener('click', toggleOrgDiffMode);
        if (actRunTests) actRunTests.addEventListener('click', runApexTests);
        if (actSplit) actSplit.addEventListener('click', toggleSplitView);
        if (actNewAsset) actNewAsset.addEventListener('click', openCreateModal);
        if (actSaveOrg) actSaveOrg.addEventListener('click', saveCurrentFileToOrg);
        const actBtnTheme = document.getElementById('act-btn-theme');
        if (actBtnTheme) actBtnTheme.addEventListener('click', () => {
            const pickerModal = document.getElementById('color-theme-picker-modal');
            if (pickerModal) pickerModal.style.display = 'flex';
        });

        function updateMenuToggleCheckmarks() {
            const wordWrapVal = document.getElementById('setting-word-wrap')?.value === 'on';
            const minimapVal = document.getElementById('setting-minimap')?.value === 'on';
            const bracketVal = document.getElementById('setting-bracket-color')?.value === 'on';
            const formatVal = document.getElementById('setting-format-on-save')?.value !== 'off';

            const chkWordWrap = document.getElementById('check-word-wrap');
            const chkMinimap = document.getElementById('check-minimap');
            const chkBracket = document.getElementById('check-bracket-color');
            const chkFormat = document.getElementById('check-format-save');

            if (chkWordWrap) chkWordWrap.style.display = wordWrapVal ? 'inline-block' : 'none';
            if (chkMinimap) chkMinimap.style.display = minimapVal ? 'inline-block' : 'none';
            if (chkBracket) chkBracket.style.display = bracketVal ? 'inline-block' : 'none';
            if (chkFormat) chkFormat.style.display = formatVal ? 'inline-block' : 'none';
        }

        const settingsMenu = document.getElementById('vscode-settings-menu');
        if (actSettings) {
            actSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                if (settingsMenu) {
                    const isVisible = settingsMenu.style.display === 'flex';
                    settingsMenu.style.display = isVisible ? 'none' : 'flex';
                    if (!isVisible) updateMenuToggleCheckmarks();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (settingsMenu && !settingsMenu.contains(e.target) && e.target !== actSettings) {
                settingsMenu.style.display = 'none';
            }
        });

        const menuCmdPalette = document.getElementById('menu-opt-cmd-palette');
        const menuSettings = document.getElementById('menu-opt-settings');
        const menuColorTheme = document.getElementById('menu-opt-color-theme');
        const menuBackup = document.getElementById('menu-opt-backup');
        const themePickerModal = document.getElementById('color-theme-picker-modal');
        const themePickerClose = document.getElementById('theme-picker-close-btn');

        const menuToggleWordWrap = document.getElementById('menu-toggle-word-wrap');
        const menuToggleMinimap = document.getElementById('menu-toggle-minimap');
        const menuToggleBracketColor = document.getElementById('menu-toggle-bracket-color');
        const menuToggleFormatSave = document.getElementById('menu-toggle-format-save');

        if (menuToggleWordWrap) {
            menuToggleWordWrap.addEventListener('click', () => {
                const el = document.getElementById('setting-word-wrap');
                if (el) {
                    el.value = el.value === 'on' ? 'off' : 'on';
                    applyEditorSettings();
                    updateMenuToggleCheckmarks();
                }
            });
        }
        if (menuToggleMinimap) {
            menuToggleMinimap.addEventListener('click', () => {
                const el = document.getElementById('setting-minimap');
                if (el) {
                    el.value = el.value === 'on' ? 'off' : 'on';
                    applyEditorSettings();
                    updateMenuToggleCheckmarks();
                }
            });
        }
        if (menuToggleBracketColor) {
            menuToggleBracketColor.addEventListener('click', () => {
                const el = document.getElementById('setting-bracket-color');
                if (el) {
                    el.value = el.value === 'on' ? 'off' : 'on';
                    applyEditorSettings();
                    updateMenuToggleCheckmarks();
                }
            });
        }
        if (menuToggleFormatSave) {
            menuToggleFormatSave.addEventListener('click', () => {
                const el = document.getElementById('setting-format-on-save');
                if (el) {
                    el.value = el.value === 'on' ? 'off' : 'on';
                    applyEditorSettings();
                    updateMenuToggleCheckmarks();
                }
            });
        }

        if (menuCmdPalette) {
            menuCmdPalette.addEventListener('click', () => {
                if (settingsMenu) settingsMenu.style.display = 'none';
                if (globalSearchModal) {
                    globalSearchModal.style.display = 'flex';
                    if (globalSearchInput) globalSearchInput.focus();
                }
            });
        }
        if (menuSettings) {
            menuSettings.addEventListener('click', () => {
                if (settingsMenu) settingsMenu.style.display = 'none';
                if (settingsModal) settingsModal.style.display = 'flex';
            });
        }
        if (menuColorTheme) {
            menuColorTheme.addEventListener('click', () => {
                if (settingsMenu) settingsMenu.style.display = 'none';
                if (themePickerModal) themePickerModal.style.display = 'flex';
            });
        }
        if (menuBackup) {
            menuBackup.addEventListener('click', () => {
                if (settingsMenu) settingsMenu.style.display = 'none';
                openToolTab('metadata-backup');
            });
        }
        if (themePickerClose && themePickerModal) {
            themePickerClose.addEventListener('click', () => themePickerModal.style.display = 'none');
        }

        const themeOptions = document.querySelectorAll('.theme-picker-option');
        themeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const selectedTheme = opt.getAttribute('data-theme');
                if (selectedTheme) {
                    applyAppTheme(selectedTheme);
                    saveAllEditorSettings();
                    logToTerminal(`Applied Color Theme: ${selectedTheme}`, 'info');

                    themeOptions.forEach(o => {
                        const check = o.querySelector('.theme-check-icon');
                        if (check) check.style.display = o === opt ? 'inline-block' : 'none';
                        o.style.background = o === opt ? 'var(--item-hover)' : 'transparent';
                        o.style.color = o === opt ? 'var(--text-active)' : 'var(--text-main)';
                    });

                    if (themePickerModal) themePickerModal.style.display = 'none';
                }
            });
        });

        if (settingTheme) settingTheme.addEventListener('change', () => applyEditorSettings());

        ['setting-font-family', 'setting-font-size', 'setting-word-wrap', 'setting-minimap', 
         'setting-bracket-color', 'setting-line-numbers', 'setting-format-on-save', 'setting-launch-mode'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => applyEditorSettings());
        });

        if (btnConvertJsonApex) btnConvertJsonApex.addEventListener('click', convertJsonToApexClass);
        if (btnInsertApexEditor) {
            btnInsertApexEditor.addEventListener('click', () => {
                const apexCode = document.getElementById('json-apex-result')?.value;
                const className = document.getElementById('json-apex-class-name')?.value || 'AccountWrapper';
                if (apexCode && editorInstance) {
                    const fileName = `${className}.cls`;
                    currentFiles[fileName] = {
                        id: null,
                        filePath: fileName,
                        content: apexCode,
                        language: 'apex'
                    };
                    if (!openTabPaths.includes(fileName)) openTabPaths.push(fileName);
                    openFileInEditor(fileName);
                    jsonApexModal.style.display = 'none';
                }
            });
        }
        if (jsonApexClose) jsonApexClose.addEventListener('click', () => jsonApexModal.style.display = 'none');

        if (btnConvertSoqlGraphql) btnConvertSoqlGraphql.addEventListener('click', convertSoqlToGraphQl);
        if (btnCopyGraphql) {
            btnCopyGraphql.addEventListener('click', () => {
                const q = document.getElementById('graphql-result-query')?.value;
                if (q) {
                    navigator.clipboard.writeText(q);
                    toast.success('GraphQL Query copied to clipboard!');
                }
            });
        }
        if (soqlGraphqlClose) soqlGraphqlClose.addEventListener('click', () => soqlGraphqlModal.style.display = 'none');

        if (btnGenBackupPreview) btnGenBackupPreview.addEventListener('click', renderBackupPreview);
        if (btnDownloadBackup) btnDownloadBackup.addEventListener('click', downloadBackupPackage);
        if (backupExportClose) backupExportClose.addEventListener('click', () => backupExportModal.style.display = 'none');



        if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', () => deleteModal.style.display = 'none');
        if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', executeDeleteAsset);

        const createFileModalCancel = document.getElementById('create-file-modal-cancel-btn');
        if (createFileModalCancel) {
            createFileModalCancel.addEventListener('click', () => {
                const modal = document.getElementById('create-file-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        const createFileModalConfirm = document.getElementById('create-file-modal-confirm-btn');
        if (createFileModalConfirm) {
            createFileModalConfirm.addEventListener('click', executeCreateNewFileInBundle);
        }

        const createFileInputName = document.getElementById('create-file-input-name');
        if (createFileInputName) {
            createFileInputName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    executeCreateNewFileInBundle();
                }
            });
        }

        if (rightPaneFileSelect) {
            rightPaneFileSelect.addEventListener('change', (e) => switchRightPaneFile(e.target.value));
        }

        if (findInput) {
            findInput.addEventListener('input', () => performFindInEditor());
            findInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') performFindInEditor();
            });
        }
        if (btnFindNext) btnFindNext.addEventListener('click', () => performFindInEditor());
        if (btnReplaceOne) btnReplaceOne.addEventListener('click', replaceCurrentMatch);
        if (btnReplaceAll) btnReplaceAll.addEventListener('click', replaceAllMatches);
        if (btnCloseFind) btnCloseFind.addEventListener('click', () => toggleFindReplaceDrawer(false));

        if (btnMatchCase) {
            btnMatchCase.addEventListener('click', () => {
                findState.isCaseSensitive = !findState.isCaseSensitive;
                btnMatchCase.classList.toggle('active', findState.isCaseSensitive);
                performFindInEditor();
            });
        }
        if (btnWholeWord) {
            btnWholeWord.addEventListener('click', () => {
                findState.isWholeWord = !findState.isWholeWord;
                btnWholeWord.classList.toggle('active', findState.isWholeWord);
                performFindInEditor();
            });
        }
        if (btnRegex) {
            btnRegex.addEventListener('click', () => {
                findState.isRegex = !findState.isRegex;
                btnRegex.classList.toggle('active', findState.isRegex);
                performFindInEditor();
            });
        }

        const btnSidebarNewAsset = document.getElementById('btn-sidebar-new-asset');
        const btnSidebarCollapseAll = document.getElementById('btn-sidebar-collapse-all');

        if (btnAddFile) {
            btnAddFile.addEventListener('click', (e) => {
                e.stopPropagation();
                promptAddNewFile();
            });
        }
        if (btnSidebarNewAsset) {
            btnSidebarNewAsset.addEventListener('click', (e) => {
                e.stopPropagation();
                openCreateModal();
            });
        }
        const btnStatusDeployMode = document.getElementById('status-deploy-mode');
        if (btnStatusDeployMode) {
            btnStatusDeployMode.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDeployMode();
            });
        }

        if (btnRefreshOrg) {
            btnRefreshOrg.addEventListener('click', (e) => {
                e.stopPropagation();
                loadOrgMetadataTree(true);
            });
        }
        if (btnSidebarCollapseAll) {
            btnSidebarCollapseAll.addEventListener('click', (e) => {
                e.stopPropagation();
                expandedFolders.clear();
                renderOrgExplorerTree();
                logToTerminal('Collapsed all Org Explorer folders', 'info');
            });
        }

        let explorerSearchTimer = 0;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                clearTimeout(explorerSearchTimer);
                explorerSearchTimer = setTimeout(() => renderOrgExplorerTree(query), 140);
            });
        }

        // Clear button for the Org Explorer search bar (VS Code style)
        const sidebarSearchClear = document.getElementById('sidebar-search-clear');
        if (searchInput && sidebarSearchClear) {
            const updateSearchClear = () => { sidebarSearchClear.hidden = !searchInput.value; };
            searchInput.addEventListener('input', updateSearchClear);
            sidebarSearchClear.addEventListener('click', () => {
                clearTimeout(explorerSearchTimer);
                searchInput.value = '';
                updateSearchClear();
                renderOrgExplorerTree('');
                searchInput.focus();
            });
        }

        if (modalCancel) modalCancel.addEventListener('click', () => modalOverlay.style.display = 'none');
        if (modalCreate) modalCreate.addEventListener('click', createNewAsset);

        if (apexCancel) apexCancel.addEventListener('click', () => execApexModal.style.display = 'none');
        if (apexExec) apexExec.addEventListener('click', executeAnonymousApex);

        if (globalSearchCancel) globalSearchCancel.addEventListener('click', () => globalSearchModal.style.display = 'none');
        if (globalSearchInput) {
            globalSearchInput.addEventListener('input', (e) => {
                performGlobalSearch(e.target.value);
            });
        }

        const btnFontPlus = document.getElementById('btn-font-plus');
        const btnFontMinus = document.getElementById('btn-font-minus');
        const btnModalFontPlus = document.getElementById('btn-modal-font-plus');
        const btnModalFontMinus = document.getElementById('btn-modal-font-minus');

        if (btnFontPlus) btnFontPlus.addEventListener('click', () => changeFontSize(1));
        if (btnFontMinus) btnFontMinus.addEventListener('click', () => changeFontSize(-1));
        if (btnModalFontPlus) btnModalFontPlus.addEventListener('click', () => changeFontSize(1));
        if (btnModalFontMinus) btnModalFontMinus.addEventListener('click', () => changeFontSize(-1));
        const fontSizeDisplay = document.getElementById('font-size-display');
        if (fontSizeDisplay) {
            fontSizeDisplay.addEventListener('click', resetEditorFontSize);
            fontSizeDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    resetEditorFontSize();
                }
            });
        }

        // Dismiss all modal popups when clicking outside the modal content card
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });

        const settingLaunchMode = document.getElementById('setting-launch-mode');
        const btnPopoutApp = document.getElementById('btn-popout-app');

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['sfarc_editor_launch_mode'], (res) => {
                if (res && res.sfarc_editor_launch_mode && settingLaunchMode) {
                    settingLaunchMode.value = res.sfarc_editor_launch_mode;
                }
            });
        }

        if (settingLaunchMode) settingLaunchMode.addEventListener('change', applyEditorSettings);

        if (btnPopoutApp) {
            btnPopoutApp.addEventListener('click', () => {
                if (typeof chrome !== 'undefined' && chrome.windows) {
                    const currentUrl = window.location.href;
                    chrome.windows.getCurrent((win) => {
                        if (win && win.type === 'popup') {
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                const idx = (tabs && tabs[0]) ? tabs[0].index + 1 : undefined;
                                chrome.tabs.create({ url: currentUrl, active: true, index: idx }, () => {
                                    window.close();
                                });
                            });
                        } else {
                            chrome.windows.create({ url: currentUrl, type: 'popup', width: 1400, height: 900, focused: true }, () => {
                                window.close();
                            });
                        }
                    });
                } else {
                    toast.info('App Window popout is available in Chrome extension mode.');
                }
            });
        }

        // Download file button
        const btnDownloadFile = document.getElementById('btn-download-file');
        if (btnDownloadFile) {
            btnDownloadFile.addEventListener('click', () => {
                if (!activeFilePath || !currentFiles[activeFilePath]) {
                    toast.info('No file is currently open to download.');
                    return;
                }
                const fileData = currentFiles[activeFilePath];
                const content = fileData.content || '';
                const fileName = activeFilePath.split('/').pop();
                
                // Create download blob
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('Downloaded ' + fileName);
            });
        }

        if (settingsCancel) settingsCancel.addEventListener('click', () => settingsModal.style.display = 'none');

        const btnSettingsReset = document.getElementById('btn-settings-reset');
        if (btnSettingsReset) {
            btnSettingsReset.addEventListener('click', () => {
                const defaults = {
                    'setting-theme': 'sfarc-dark',
                    'setting-font-family': "'Fira Code', 'Consolas', monospace",
                    'setting-font-size': '13',
                    'setting-word-wrap': 'off',
                    'setting-minimap': 'off',
                    'setting-bracket-color': 'on',
                    'setting-line-numbers': 'on',
                    'setting-format-on-save': 'on',
                    'setting-launch-mode': 'tab'
                };
                Object.keys(defaults).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = defaults[id];
                });
                applyEditorSettings();
                logToTerminal('Editor settings reset to defaults', 'info');
            });
        }

        const btnSettingsClose = document.getElementById('btn-settings-close');
        if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => { if (settingsModal) settingsModal.style.display = 'none'; });
        if (settingTheme) settingTheme.addEventListener('change', applyEditorSettings);
        if (settingFontSize) settingFontSize.addEventListener('change', applyEditorSettings);
        if (settingWordWrap) settingWordWrap.addEventListener('change', applyEditorSettings);



        if (assetTypeSelect) {
            assetTypeSelect.addEventListener('change', (e) => {
                renderCreateAssetForm(e.target.value);
            });
        }

        const createNameInput = document.getElementById('modal-asset-name');
        if (createNameInput) {
            createNameInput.addEventListener('input', updateCreateAssetPreview);
            createNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    createNewAsset();
                }
            });
        }
        document.getElementById('create-modal')?.addEventListener('change', updateCreateAssetPreview);
        document.getElementById('create-modal')?.addEventListener('input', (event) => {
            if (event.target !== createNameInput) updateCreateAssetPreview();
        });

        updateHeaderContextButtons();

        // Global Draggable Modal Listener
        document.addEventListener('mousedown', function(e) {
            const handle = e.target.closest('.modal-title, .modal-header, .sfir-modal-header, .sfarc-modal-header, .sfir-modal-header-left');
            if (!handle) return;
            if (e.target.closest('button, input, select, textarea, a, i.fa-xmark, .modal-close-btn, .sfir-modal-close-btn')) return;

            const card = handle.closest('.modal-card, .sfir-modal-card, .sfarc-modal-card, .slds-modal__container');
            if (!card) return;

            handle.style.cursor = 'move';
            let startX = e.clientX;
            let startY = e.clientY;
            const rect = card.getBoundingClientRect();
            let initialLeft = rect.left;
            let initialTop = rect.top;

            card.style.position = 'fixed';
            card.style.left = initialLeft + 'px';
            card.style.top = initialTop + 'px';
            card.style.margin = '0';

            function onMouseMove(moveEvent) {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                card.style.left = (initialLeft + dx) + 'px';
                card.style.top = (initialTop + dy) + 'px';
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        window.loadApexAsset = loadApexAsset;
        window.loadApexTrigger = loadApexTrigger;
        window.loadLwcBundle = loadLwcBundle;

        window.addEventListener('beforeunload', saveSessionState);
        window.addEventListener('pagehide', saveSessionState);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditor);
    } else {
        initEditor();
    }
})();
