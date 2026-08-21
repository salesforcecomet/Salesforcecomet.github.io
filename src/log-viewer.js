// Initialize API
// We rely on api.js being loaded before this script
// Since this is an extension page, we need to handle session initialization carefully.

const urlParams = new URLSearchParams(window.location.search);
const logId = urlParams.get('id');
const initialSearchTerm = urlParams.get('search') ? urlParams.get('search').trim() : '';

// Enable Dark Theme by default
document.body.classList.add('sfarc-dark-theme');

function updateScrubberPct(scrubber) {
    if (!scrubber) return;
    const min = parseFloat(scrubber.min) || 0;
    const max = parseFloat(scrubber.max) || 0;
    const val = parseFloat(scrubber.value) || 0;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    scrubber.style.setProperty('--vt-scrub-pct', pct + '%');
}

function init() {
    if (!logId) {
        // Show Drop Zone
        document.getElementById('log-container').style.display = 'none';
        document.getElementById('drop-zone').style.display = 'flex';
        document.getElementById('legend-container').style.display = 'none';

        setupDropZone();
    } else {
        initViewer();
    }
}

let currentLogBody = '';
let currentLogMeta = null;
let currentMatchIndex = -1;
let logMatches = [];

// ---------------------------------------------------------------------------
// Shared log-line cache + chunked raw-log renderer.
//
// Every render pass used to call `text.split('\n')` on the same string, so a
// 200k-line log was re-parsed 13+ times per load. The cache below splits once
// and reuses the array (all renderers treat it as read-only).
// ---------------------------------------------------------------------------
let cachedLogText = null;
let cachedLogLines = null;

function getLogLines(text) {
    if (cachedLogText !== text || !cachedLogLines) {
        cachedLogText = text;
        cachedLogLines = text.split('\n');
    }
    return cachedLogLines;
}

// Chunked rendering state for #log-container: only `SFARC_LOG_CHUNK` lines are
// in the DOM at once, with a "Show more" row appending the next chunk.
const SFARC_LOG_CHUNK = 2000;
let sfarcLogContainer = null;
let sfarcLogLinesRef = null;
let sfarcLogRendered = 0;
let sfarcLogTotal = 0;
let sfarcLogFullyRendered = false;

// ---------------------------------------------------------------------------
// Cooperative rendering primitives.
//
// An 18MB debug log is 200k+ lines; the analysis passes and the big tab views
// (Flow Analysis, Execution Order, Raw Tree) used to build their DOM
// synchronously, freezing the main thread for seconds and tripping Chrome's
// "Pages Unresponsive" dialog. These helpers split DOM work into slices and
// yield to the event loop between slices, and a generation token aborts a
// stale render the moment a newer one (or a tab switch) starts.
// ---------------------------------------------------------------------------
function sfarcYield() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

let sfarcRenderGen = 0;
function sfarcRenderToken() {
    return ++sfarcRenderGen;
}

// Insert row HTML in slices, yielding between slices. Returns false early if a
// newer render superseded this one or the container left the document.
async function sfarcRenderRowsChunked(container, rowHtmls, gen, chunkSize = 600) {
    if (!container) return false;
    for (let i = 0; i < rowHtmls.length; i += chunkSize) {
        if (gen !== sfarcRenderGen || !container.isConnected) return false;
        container.insertAdjacentHTML('beforeend', rowHtmls.slice(i, i + chunkSize).join(''));
        await sfarcYield();
    }
    return gen === sfarcRenderGen;
}

function sfarcLogAppendChunk() {
    const container = sfarcLogContainer;
    if (!container) return;
    // Never leave a stale "Show more" row behind (expandTo loops can append
    // several chunks in a row, and the button path removes itself).
    const prevMore = container.querySelector('.sfarc-log-more');
    if (prevMore) prevMore.remove();
    const lines = sfarcLogLinesRef;
    const end = Math.min(sfarcLogRendered + SFARC_LOG_CHUNK, sfarcLogTotal);
    const fragment = document.createDocumentFragment();

    for (let i = sfarcLogRendered; i < end; i++) {
        const line = lines[i];
        const div = document.createElement('div');
        div.className = 'log-line';

        let formattedLine = escapeHtml(line);

        if (line.includes('|USER_DEBUG|')) {
            div.classList.add('log-event-user-debug');
        } else if (line.includes('|SOQL_EXECUTE_BEGIN') || line.includes('|SOQL_EXECUTE_END')) {
            div.classList.add('log-event-query');
        } else if (line.includes('|VALIDATION_')) {
            div.classList.add('log-event-validation');
            div.classList.add('highlight-validation');
        } else if (line.includes('|METHOD_ENTRY') || line.includes('|CODE_UNIT_STARTED')) {
            div.classList.add('log-event-method');
        } else if (line.includes('|EXCEPTION_') || line.includes('|FATAL_ERROR')) {
            div.classList.add('log-event-error');
        } else if (line.includes('|CALLOUT_')) {
            div.classList.add('log-event-callout');
        }

        div.innerHTML = formattedLine;
        fragment.appendChild(div);
    }

    sfarcLogRendered = end;
    container.appendChild(fragment);

    if (sfarcLogRendered >= sfarcLogTotal) {
        sfarcLogFullyRendered = true;
    } else {
        const el = document.createElement('div');
        el.className = 'sfarc-log-more';
        const remaining = sfarcLogTotal - sfarcLogRendered;
        el.textContent = `Show ${Math.min(SFARC_LOG_CHUNK, remaining)} more lines (${remaining} remaining)`;
        el.onclick = () => { el.remove(); sfarcLogAppendChunk(); };
        container.appendChild(el);
    }
}

// Renders lines up to (and including) `lineCount` (1-based intent; the DOM is
// 0-based but the expansion target is exclusive). Used by jump/search/legend
// features that need lines beyond the currently rendered chunk.
function sfarcLogExpandTo(lineCount) {
    const container = sfarcLogContainer;
    if (!container || sfarcLogFullyRendered || sfarcLogTotal === 0) return;
    const target = Math.min(lineCount, sfarcLogTotal);
    while (sfarcLogRendered < target && !sfarcLogFullyRendered) {
        sfarcLogAppendChunk();
    }
}

function sfarcLogRenderAll() {
    sfarcLogExpandTo(Infinity);
}

function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dropContent = dropZone.querySelector('.drop-content');

    dropContent.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        currentLogBody = text;

        // Mock Metadata
        currentLogMeta = {
            LogUser: { Name: 'Imported User' },
            StartTime: new Date().toISOString(),
            Status: 'Imported',
            Application: 'File Upload',
            Request: 'Manual',
            Operation: file.name,
            DurationMilliseconds: 0,
            LogLength: file.size
        };

        // Try to calculate duration from log content
        try {
            const lines = text.trim().split('\n');
            if (lines.length > 0) {
                const firstLine = lines[0];
                const lastLine = lines[lines.length - 1];

                // Extract timestamps (assuming standard format HH:mm:ss.SSS or similar at start)
                // Standard format: 37.0 APEX_CODE,DEBUG;LoggingLevel;TIMESTAMP
                // Actually usually: 15:47:33.435 (37435123432)|...

                const timeRegex = /([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3})/;
                const startMatch = firstLine.match(timeRegex);
                const endMatch = lastLine.match(timeRegex);

                if (startMatch && endMatch) {
                    const d1 = new Date('1970-01-01T' + startMatch[1] + 'Z');
                    const d2 = new Date('1970-01-01T' + endMatch[1] + 'Z');
                    let diff = d2 - d1;
                    if (diff < 0) diff += 24 * 60 * 60 * 1000; // Handle midnight crossing
                    currentLogMeta.DurationMilliseconds = diff;
                }
            }
        } catch (e) {
            console.error('Error calculating duration', e);
        }

        // Hide Drop Zone, Show Log
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('content-log').style.display = 'flex';
        document.getElementById('log-container').style.display = 'block';
        document.getElementById('legend-container').style.display = 'flex';

        // Render ONLY the log explorer here (chunked). Every analysis view
        // (queries, security, DML, limits, order, flows, debug, …) runs lazily
        // the first time its tab is opened (see activateSubTab / setupTabs), so
        // an 18MB+ log loads fast and never freezes or crashes the page — the
        // old eager 10-pass render did both.
        updateSummaryHeader(text);
        renderLogDetails();
        renderLog(text);
        await sfarcYield();
        updateLegendCounts(text);

        setupActions();
        setupTabs();
        hideLoadOverlay();
        setFooterVisible(true);
    };
    reader.readAsText(file);
}

// Progress bar helpers
function setLoadProgress(pct, status) {
    const bar = document.getElementById('sfarc-load-bar');
    const pctEl = document.getElementById('sfarc-load-pct');
    const statusEl = document.getElementById('sfarc-load-status');
    if (bar) bar.style.width = `${Math.min(pct, 100)}%`;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    if (status && statusEl) statusEl.textContent = status;
}

// Footer actions (download/delete/report) are only meaningful once a log is
// actually loaded — keep them hidden during the loading screen.
function setFooterVisible(visible) {
    const footer = document.getElementById('viewer-footer');
    if (footer) footer.classList.toggle('lv-footer-hidden', !visible);
}

function hideLoadOverlay() {
    const overlay = document.getElementById('sfarc-log-loading-overlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 320);
    }
}

async function initViewer() {
    try {
        setLoadProgress(5, 'Initializing session...');

        await window.sfApi.init();

        if (!window.sfApi.sessionId) {
            hideLoadOverlay();
            document.getElementById('log-container').innerHTML = '<div class="loading">Could not retrieve Salesforce session. Please ensure a Salesforce tab is open.</div>';
            return;
        }

        setLoadProgress(20, 'Session established. Fetching log metadata...');

        // Fetch Metadata AND Body in parallel, with progress tracking
        await Promise.all([
            fetchLogMetadata().then(() => setLoadProgress(45, 'Metadata loaded. Downloading log body...')),
            fetchLogContent()
        ]);

        setLoadProgress(100, 'Done!');
        setFooterVisible(true);
        setTimeout(() => hideLoadOverlay(), 200);

        setupActions();
        setupTabs();

        const initialTab = urlParams.get('tab');
        if (initialTab) {
            const tabEl = document.querySelector(`.viewer-tab[data-target="${initialTab}"]`);
            if (tabEl) {
                tabEl.click();
            } else {
                // Legacy deep-link to a sub-view (e.g. ?tab=flow or ?tab=queries):
                // open its parent group first, then the matching sub-tab.
                const subTabEl = document.querySelector(`.viewer-subtab[data-subtarget="${initialTab}"]`);
                if (subTabEl) {
                    const group = subTabEl.closest('.tab-content');
                    const groupTab = group ? document.querySelector(`.viewer-tab[data-target="${group.id.replace('content-', '')}"]`) : null;
                    if (groupTab) groupTab.click();
                    activateSubTab(subTabEl);
                }
            }
        }

        if (initialSearchTerm) {
            const searchInput = document.getElementById('viewer-search-input');
            if (searchInput) {
                searchInput.value = initialSearchTerm;
                performLogViewerSearch();
            }
        }

    } catch (e) {
        console.error('Viewer Init Error', e);
        hideLoadOverlay();
        document.getElementById('log-container').innerHTML = `<div class="loading">Error initializing viewer: ${e.message}</div>`;
    }
}


async function fetchLogMetadata() {
    try {
        const query = `SELECT Id, LogUser.Name, LogUser.Id, Operation, Status, DurationMilliseconds, LogLength, StartTime, Application, Request, Location FROM ApexLog WHERE Id = '${logId}'`;
        // Use the query() helper (returns parsed JSON records) — a raw
        // fetch() response has no .records, which previously left
        // currentLogMeta null and the Details tab stuck on "Loading details...".
        const res = await window.sfApi.query(query, true);
        if (res && res.records && res.records.length > 0) {
            currentLogMeta = res.records[0];
            renderLogDetails();
            updateSummaryHeader(currentLogBody || '');
        } else {
            console.warn('salesforce comet: No ApexLog metadata found for', logId);
        }
    } catch (e) {
        console.error('Error fetching metadata', e);
    }
}

async function fetchLogContent() {
    try {
        const url = `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}/Body`;

        setLoadProgress(50, 'Downloading log body...');
        const response = await window.sfApi.fetch(url, { responseType: 'text' });
        
        if (!response) {
            throw new Error('No response from Salesforce. Please ensure you are logged in.');
        }

        let text = '';
        if (typeof response === 'string') {
            text = response;
        } else if (response.text && typeof response.text === 'function') {
            text = await response.text();
        } else if (response.text !== undefined) {
            text = response.text;
        } else {
            text = typeof response === 'object' ? JSON.stringify(response) : String(response);
        }

        if (!text || text === 'null' || text === 'undefined') {
            throw new Error('Log body is empty or invalid.');
        }

        currentLogBody = text;

        // Only the log explorer renders here (chunked); every analysis view
        // runs lazily on first tab open (activateSubTab / setupTabs). A big log
        // used to run ~10 full scans on load and crash the page — now loading
        // is one chunked pass plus cheap legend/summary counters.
        setLoadProgress(60, 'Rendering log explorer...');
        renderLog(text);
        await sfarcYield();

        setLoadProgress(90, 'Finalizing...');
        updateSummaryHeader(text);
        renderLogDetails();
        updateLegendCounts(text);

    } catch (e) {
        hideLoadOverlay();
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            logContainer.innerHTML = `<div class="loading">Error fetching log: ${escapeHtml(e.message)}</div>`;
        }
    }

}

function updateLegendCounts(text) {
    const categories = {
        'user-debug': /\|USER_DEBUG/g,
        'query': /\|SOQL_EXECUTE/g,
        'validation': /\|VALIDATION_/g,
        'method': /\|METHOD_ENTRY/g,
        'error': /\|(EXCEPTION_THROWN|FATAL_ERROR)/g,
        'callout': /\|CALLOUT_/g
    };

    for (const [key, regex] of Object.entries(categories)) {
        const count = (text.match(regex) || []).length;
        const el = document.getElementById(`count-${key}`);
        if (el) {
            el.dataset.currentIndex = '0'; // Reset index on new log load
            el.textContent = count;
            // Optionally fade if 0
            el.parentElement.style.opacity = count > 0 ? '1' : '0.4';
        }
    }
}

function updateSummaryHeader(text) {
    if (!currentLogMeta) return;

    const sizeMB = (currentLogMeta.LogLength / (1024 * 1024)).toFixed(2) + ' MB';
    const duration = (currentLogMeta.DurationMilliseconds / 1000).toFixed(3) + ' s';

    // Count issues (Exceptions, Fatal Errors)
    const issueCount = (text.match(/\|(EXCEPTION_|FATAL_ERROR)/g) || []).length;

    const summaryContainer = document.getElementById('log-summary');
    summaryContainer.innerHTML = `
        <div class="summary-item" title="Log Size">${sizeMB}</div>
        <div class="summary-item" title="Duration">${duration}</div>
        <div class="summary-item ${issueCount > 0 ? 'error' : ''}" id="issues-badge" title="Click to view first issue" style="${issueCount > 0 ? 'cursor: pointer;' : ''}">${issueCount} issues</div>
    `;

    // Add click handler for navigation
    if (issueCount > 0) {
        document.getElementById('issues-badge').addEventListener('click', () => {
            // Switch to Log Tab
            const logTab = document.querySelector('.viewer-tab[data-target="log"]');
            if (logTab) logTab.click();

            // Errors can live in any chunk; render the full log first (no-op
            // once fully rendered) so the first error is reachable.
            sfarcLogRenderAll();

            // Find first error
            const firstError = document.querySelector('.log-event-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: Flash effect
                firstError.style.transition = 'background-color 0.5s';
                const originalBg = firstError.style.backgroundColor;
                firstError.style.backgroundColor = '#ffeb3b'; // Flash yellow
                setTimeout(() => {
                    firstError.style.backgroundColor = originalBg;
                }, 1000);
            }
        });
    }
}




function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setupActions() {
    document.getElementById('download-btn').addEventListener('click', () => {
        downloadLog();
    });

    document.getElementById('delete-btn').addEventListener('click', async () => {
        if (await toast.confirm('Delete this log?')) {
            try {
                const url = `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}`;
                await window.sfApi.fetch(url, { method: 'DELETE' });
                window.close();
            } catch (e) {
                toast.error('Error deleting log: ' + e.message);
            }
        }
    });

    const reportBugsBtn = document.getElementById('report-bugs-btn');
    if (reportBugsBtn) {
        reportBugsBtn.addEventListener('click', () => {
            window.open('https://github.com/salesforcecomet/Salesforcecomet.github.io/issues', '_blank');
        });
    }



    const searchInput = document.getElementById('viewer-search-input');
    const clearBtn = document.getElementById('viewer-search-clear');
    const prevBtn = document.getElementById('viewer-search-prev');
    const nextBtn = document.getElementById('viewer-search-next');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            performLogViewerSearch();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (logMatches.length === 0) return;
                if (e.shiftKey) {
                    currentMatchIndex = (currentMatchIndex - 1 + logMatches.length) % logMatches.length;
                } else {
                    currentMatchIndex = (currentMatchIndex + 1) % logMatches.length;
                }
                scrollToMatch(currentMatchIndex);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                performLogViewerSearch();
                searchInput.focus();
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (logMatches.length === 0) return;
            currentMatchIndex = (currentMatchIndex - 1 + logMatches.length) % logMatches.length;
            scrollToMatch(currentMatchIndex);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (logMatches.length === 0) return;
            currentMatchIndex = (currentMatchIndex + 1) % logMatches.length;
            scrollToMatch(currentMatchIndex);
        });
    }
}

function renderExecutionSummary(rows) {
    const summaryContainer = document.getElementById('order-summary-table');
    if (!summaryContainer) return;

    const components = new Map(); // Name -> { type, count }

    // Count unique components from STARTED rows
    rows.forEach(row => {
        if (row.status !== 'STARTED') return;
        const type = row.type;
        const name = row.name;
        if (type && name) {
            const key = `${type}:${name}`;
            if (components.has(key)) {
                components.get(key).count++;
            } else {
                components.set(key, { type, name, count: 1 });
            }
        }
    });

    if (components.size === 0) {
        summaryContainer.innerHTML = '<div class="loading-sidebar">No components detected</div>';
        return;
    }

    // Sort by Salesforce execution order
    const executionOrder = {
        'Trigger': 1,
        'Validation': 2,
        'Workflow': 3,
        'Flow': 4,
        'Class': 5,
        'Method': 6
    };
    const sortedComps = Array.from(components.values()).sort((a, b) => {
        const orderA = executionOrder[a.type] || 99;
        const orderB = executionOrder[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });

    // Group components by type first, then sort within each group
    const grouped = new Map();
    sortedComps.forEach(comp => {
        if (!grouped.has(comp.type)) grouped.set(comp.type, []);
        grouped.get(comp.type).push(comp);
    });

    const typeOrder = ['Flow', 'Trigger', 'Validation', 'Workflow', 'Class', 'Method'];
    const orderedTypes = typeOrder.filter(t => grouped.has(t));
    grouped.forEach((_, k) => { if (!orderedTypes.includes(k)) orderedTypes.push(k); });

    const typeIcon = {
        'Trigger': 'fa-bolt', 'Validation': 'fa-shield-halved', 'Workflow': 'fa-arrows-spin',
        'Flow': 'fa-sitemap', 'Class': 'fa-cube', 'Method': 'fa-code'
    };

    // Build table HTML
    let html = `<table class="summary-table">
        <thead>
            <tr>
                <th class="col-type">Type</th>
                <th class="col-name">Name</th>
                <th class="col-runs">Runs</th>
            </tr>
        </thead>
        <tbody>`;
    
    orderedTypes.forEach(type => {
        const comps = grouped.get(type);
        comps.forEach(comp => {
            const runText = comp.count === 1 ? 'run' : 'runs';
            const typeClass = `type-${type.toLowerCase()}`;
            html += `<tr>
                <td><span class="type-badge ${typeClass}">${type}</span></td>
                <td class="comp-name" title="${escapeHtml(comp.name)}">${escapeHtml(comp.name)}</td>
                <td class="comp-runs">${comp.count} ${runText}</td>
            </tr>`;
        });
    });
    
    html += '</tbody></table>';

    summaryContainer.innerHTML = html;
}

let currentStepIndex = 0;

function resetAnimation() {
    currentStepIndex = 0;
    const rows = document.querySelectorAll('.exec-order-table tbody tr');
    const btn = document.getElementById('animate-order-btn');
    if (btn) btn.disabled = false;

    rows.forEach(row => {
        row.classList.remove('show-anim');
        row.classList.add('animating');
    });

    const container = document.getElementById('order-container');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
}

function showNextStep() {
    const rows = document.querySelectorAll('.exec-order-table tbody tr');
    if (currentStepIndex < rows.length) {
        const row = rows[currentStepIndex];
        row.classList.remove('animating');
        row.classList.add('show-anim');

        // Auto-scroll
        const container = document.getElementById('order-container');
        const rowTop = row.offsetTop;
        container.scrollTo({ top: rowTop - 150, behavior: 'smooth' });

        currentStepIndex++;
    }
}

function animateExecutionTree() {
    resetAnimation();
    const rows = document.querySelectorAll('.exec-order-table tbody tr');
    const btn = document.getElementById('animate-order-btn');

    if (rows.length === 0) return;
    if (btn) btn.disabled = true;

    let index = 0;
    const interval = 80;

    function revealNext() {
        if (index < rows.length) {
            showNextStep();
            index++;
            setTimeout(revealNext, interval);
        } else {
            if (btn) btn.disabled = false;
        }
    }

    setTimeout(revealNext, 200);
}

async function downloadLog() {
    try {
        const blob = new Blob([currentLogBody], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${logId}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        toast.error('Error downloading log: ' + e.message);
    }
}

// Activates a sub-tab (secondary tab inside a grouped primary tab) and shows
// its content. Pass the sub-tab <button> element.
function activateSubTab(subTab) {
    if (!subTab) return;
    const group = subTab.closest('.tab-content');
    if (!group) return;
    const subtarget = subTab.dataset.subtarget;
    // Deactivate sibling sub-tabs within the group
    group.querySelectorAll('.viewer-subtab').forEach(s => s.classList.remove('sfarc-active'));
    subTab.classList.add('sfarc-active');
    // Hide sibling sub contents, show the target
    group.querySelectorAll('.sub-tab-content').forEach(c => c.style.display = 'none');
    const targetContent = document.getElementById(`content-${subtarget}`);
    if (targetContent) {
        targetContent.style.display = 'flex';
    }
    // (Re)render on-demand views so data is always fresh when switching
    if (subtarget === 'field-impact') {
        FieldImpactAnalyzer.parseLog(currentLogBody);
    } else if (subtarget === 'order' && currentLogBody) {
        renderOrder(currentLogBody).catch(() => {});
    } else if (subtarget === 'flow' && currentLogBody) {
        renderFlowAnalysis(currentLogBody).catch(() => {});
    } else if (subtarget === 'queries' && currentLogBody) {
        renderQueries(currentLogBody);
    } else if (subtarget === 'dml' && currentLogBody) {
        renderDML(currentLogBody);
    } else if (subtarget === 'security' && currentLogBody) {
        renderSecurityAnalysis(currentLogBody);
    }
}

function setupTabs() {
    // Sub-tabs inside grouped tabs
    document.querySelectorAll('.viewer-subtab').forEach(subTab => {
        subTab.addEventListener('click', () => {
            activateSubTab(subTab);
            performLogViewerSearch();
        });
    });

    const tabs = document.querySelectorAll('.viewer-tab');
    tabs.forEach(tab => {
        tab.classList.remove('disabled'); // Enable all tabs
        tab.addEventListener('click', () => {
            // Deactivate all
            document.querySelectorAll('.viewer-tab').forEach(t => t.classList.remove('sfarc-active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

            // Activate clicked
            tab.classList.add('sfarc-active');
            const targetId = tab.dataset.target;
            const targetContent = document.getElementById(`content-${targetId}`);
            if (targetContent) {
                targetContent.style.display = 'flex'; // or block depending on layout
                if (targetId === 'details') targetContent.style.display = 'block'; // Grid needs block container usually
            }

            // (Re)render on-demand views so data is always fresh when switching
            if (targetId === 'details') {
                // Always re-render (renderLogDetails handles a missing meta
                // with an explicit empty state, so it can never sit on the
                // static "Loading details..." placeholder).
                renderLogDetails();
            } else if (targetId === 'user-debug' && currentLogBody) {
                renderUserDebug(currentLogBody);
            } else if (targetId === 'gov-limits' && currentLogBody) {
                renderGovLimits(currentLogBody);
            } else if (targetId === 'data-ops' && currentLogBody) {
                renderQueries(currentLogBody);
            } else if (targetId === 'dml' && currentLogBody) {
                renderDML(currentLogBody);
            } else if (targetId === 'execution' && currentLogBody) {
                renderOrder(currentLogBody);
            }

            // Grouped tabs: show the default (first) sub-tab
            if (targetContent && targetContent.querySelector('.viewer-subtab')) {
                const first = targetContent.querySelector('.viewer-subtab');
                activateSubTab(first);
            }

            // Toggle legend visibility (only for main log)
            const legend = document.getElementById('legend-container');
            if (targetId === 'log') {
                legend.style.display = 'flex';
            } else {
                legend.style.display = 'none';
            }

            performLogViewerSearch();
        });
    });
}

// Jumps the Log Explorer to a specific 1-based line number (used by
// Field Impact cards). Switches to the log tab, scrolls, and flashes.
function jumpToLogLine(lineNum) {
    const logTab = document.querySelector('.viewer-tab[data-target="log"]');
    if (logTab) logTab.click();

    const container = document.getElementById('log-container');
    if (!container) return;

    // Make sure the target line is actually in the DOM before looking for it
    sfarcLogExpandTo(lineNum);

    const lines = container.querySelectorAll('.log-line');
    const target = lines[lineNum - 1];
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('jump-flash');
    setTimeout(() => target.classList.remove('jump-flash'), 1600);
}

function renderLogDetails() {
    const container = document.getElementById('details-container');
    if (!container) return;
    if (!currentLogMeta) {
        container.innerHTML = '<div class="detail-empty">Details unavailable — log metadata could not be loaded.</div>';
        return;
    }
    const meta = currentLogMeta;
    const startTime = new Date(meta.StartTime).toLocaleString();
    const sizeKB = (meta.LogLength / 1024).toFixed(2) + ' KB';
    const duration = meta.DurationMilliseconds < 1000 
        ? meta.DurationMilliseconds + ' ms' 
        : (meta.DurationMilliseconds / 1000).toFixed(2) + ' s';
    const statusClass = meta.Status === 'Success' ? 'success' : 'failed';
    
    container.innerHTML = `
        <div class="dl-details">
            <!-- Status Banner -->
            <div class="dl-details-banner dl-details-banner-${statusClass}">
                <div class="dl-details-banner-icon">
                    <i class="fa-solid ${statusClass === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                </div>
                <div class="dl-details-banner-text">
                    <span class="dl-details-banner-title">${meta.Status}</span>
                    <span class="dl-details-banner-sub">${meta.Operation}</span>
                </div>
            </div>
            
            <!-- Info Grid -->
            <div class="dl-details-grid">
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-user"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">User</span>
                        <span class="dl-details-item-value">${meta.LogUser?.Name || 'Unknown'}</span>
                    </div>
                </div>
                
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-calendar"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">Date</span>
                        <span class="dl-details-item-value">${startTime}</span>
                    </div>
                </div>
                
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-clock"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">Duration</span>
                        <span class="dl-details-item-value">${duration}</span>
                    </div>
                </div>
                
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-hard-drive"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">Log Size</span>
                        <span class="dl-details-item-value">${sizeKB}</span>
                    </div>
                </div>
                
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-server"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">Request Type</span>
                        <span class="dl-details-item-value">${meta.Request || 'Unknown'}</span>
                    </div>
                </div>
                
                <div class="dl-details-item">
                    <div class="dl-details-item-icon"><i class="fa-solid fa-window-maximize"></i></div>
                    <div class="dl-details-item-content">
                        <span class="dl-details-item-label">Application</span>
                        <span class="dl-details-item-value">${meta.Application || 'Unknown'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Error Details (if failed) -->
            ${statusClass === 'failed' && meta.StatusMessage ? `
                <div class="dl-details-error">
                    <div class="dl-details-error-header">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Error Details</span>
                    </div>
                    <div class="dl-details-error-body">${escapeHtml(meta.StatusMessage)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderSecurityAnalysis(text) {
    const container = document.getElementById('security-container');
    if (!container) return;
    container.innerHTML = '';

    const lines = getLogLines(text);
    const issues = [];
    const objectsAffected = new Set();
    const fieldsAffected = new Set();

    let currentSource = 'Unknown';
    let currentSourceType = 'unknown';

    // 3-char prefix map for common Salesforce objects
    const prefixMap = {
        '001': 'Account',
        '003': 'Contact',
        '006': 'Opportunity',
        '00Q': 'Lead',
        '005': 'User',
        '500': 'Case',
        '701': 'Campaign',
        '01t': 'Product2',
        '801': 'Order',
        '00k': 'OpportunityLineItem',
        '015': 'Document',
        '00b': 'WebLink',
        '01s': 'Pricebook2',
        '01u': 'PricebookEntry',
        '02i': 'Asset',
        'a0': 'Custom Object (Prefix a0)',
        'a1': 'Custom Object (Prefix a1)',
        'a2': 'Custom Object (Prefix a2)',
        'a3': 'Custom Object (Prefix a3)',
        'a4': 'Custom Object (Prefix a4)',
        'a5': 'Custom Object (Prefix a5)',
    };

    lines.forEach(line => {
        // Track execution context to attribute security issues
        if (line.includes('|CODE_UNIT_STARTED')) {
            const parts = line.split('|');
            const unitName = parts[parts.length - 1] || parts[3] || '';
            if (unitName.toLowerCase().includes('flow')) {
                currentSource = unitName;
                currentSourceType = 'flow';
            } else if (unitName.toLowerCase().includes('trigger')) {
                currentSource = unitName;
                currentSourceType = 'trigger';
            } else if (unitName.toLowerCase().includes('process')) {
                currentSource = unitName;
                currentSourceType = 'process';
            } else {
                currentSource = unitName;
                currentSourceType = 'apex';
            }
        }

        if (line.includes('|EXCEPTION_THROWN|')) {
            const parts = line.split('|');
            const exceptionMsg = parts[parts.length - 1] || '';
            const lineNo = parts[2] || '';
            const timestamp = parts[0] || '';

            let matched = false;
            let category = 'Apex Access / General';
            let description = 'Security exception thrown during execution.';
            let explanation = 'An Apex security exception was thrown. Please check running user permissions.';
            let suggestedFix = 'Ensure the user has correct Profile permissions or active Permission Sets granting class access.';
            let targetObj = '';
            let targetField = '';

            // 1. INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY
            if (exceptionMsg.includes('INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY')) {
                matched = true;
                category = 'Record Sharing / OLS';
                description = 'Insufficient Access on Record (Cross-Reference ID)';
                explanation = 'The DML or query referenced a record or relationship ID that the running user lacks sharing permissions to access or edit.';
                suggestedFix = 'Verify record ownership and check Organization-Wide Defaults (OWD), Sharing Rules, Role Hierarchy, or Permission Sets on lookup objects.';
                
                // Try to extract record ID and map prefix
                const idMatch = exceptionMsg.match(/id:\s*([a-zA-Z0-9]{15,18})/);
                if (idMatch && idMatch[1]) {
                    const recId = idMatch[1];
                    const prefix = recId.substring(0, 3);
                    targetObj = prefixMap[prefix] || prefixMap[prefix.substring(0, 2)] || `SObject (Prefix: ${prefix})`;
                    objectsAffected.add(targetObj);
                }
            }
            // 2. INSUFFICIENT_ACCESS_OR_READONLY
            else if (exceptionMsg.includes('INSUFFICIENT_ACCESS_OR_READONLY')) {
                matched = true;
                category = 'Object / Field Write Permissions';
                description = 'Read-Only / Insufficient Write Access';
                explanation = 'The DML operation failed because the user does not have edit or create access on this object or record. Alternatively, the record is locked (e.g., in an active Approval Process).';
                suggestedFix = 'Verify Object Permissions (Create/Edit) on the user\'s Profile or Permission Sets. If the record is locked, verify if the user should be allowed to bypass or approve.';
            }
            // 3. SECURE_QUERY_EXCEPTION / Secure query exception
            else if (exceptionMsg.toLowerCase().includes('secure query exception') || exceptionMsg.includes('SECURE_QUERY_EXCEPTION')) {
                matched = true;
                category = 'Field-Level Security (FLS)';
                description = 'FLS / Object-Level Security Query Violation';
                explanation = 'A query executed with USER_MODE or WITH SECURITY_ENFORCED failed because the running user lacks Read permissions on one or more queried fields or the SObject itself.';
                suggestedFix = 'Create or assign a Permission Set to the user that grants **Read** access on the identified SObject and its queried fields.';

                // Try to extract field and object
                const fieldMatch = exceptionMsg.match(/field '([^']+)'/i) || exceptionMsg.match(/field\s+([a-zA-Z0-9_]+)/i);
                const objMatch = exceptionMsg.match(/object '([^']+)'/i) || exceptionMsg.match(/sobject '([^']+)'/i) || exceptionMsg.match(/object\s+([a-zA-Z0-9_]+)/i);
                
                if (fieldMatch) {
                    targetField = fieldMatch[1];
                    fieldsAffected.add(targetField);
                }
                if (objMatch) {
                    targetObj = objMatch[1];
                    objectsAffected.add(targetObj);
                }
            }
            // 4. NoAccessException
            else if (exceptionMsg.includes('System.NoAccessException')) {
                matched = true;
                category = 'Setup / Class Access';
                description = 'Apex / Component Access Denied';
                explanation = 'Access was denied to the requested class, Visualforce page, custom setting, or setup resource.';
                suggestedFix = 'Grant **Apex Class Access** or **Visualforce Page Access** on the user Profile or via a Permission Set.';
            }
            // 5. REQUIRED_FIELD_MISSING
            else if (exceptionMsg.includes('REQUIRED_FIELD_MISSING')) {
                matched = true;
                category = 'FLS / Validation';
                description = 'Required Field Missing';
                explanation = 'The DML insert or update failed because a system-required or layout-required field value was not populated.';
                suggestedFix = 'Verify if FLS hides the required field from the running user, or update the DML transaction to explicitly populate the required field.';
            }

            if (matched || exceptionMsg.toLowerCase().includes('security') || exceptionMsg.toLowerCase().includes('access')) {
                issues.push({
                    timestamp,
                    line: lineNo,
                    category,
                    description,
                    exception: exceptionMsg.split(':')[0] || 'SecurityException',
                    message: exceptionMsg,
                    explanation,
                    suggestedFix,
                    object: targetObj,
                    field: targetField,
                    source: currentSource,
                    sourceType: currentSourceType
                });
            }
        }
    });

    // Update the Security Tab count badge
    const tab = document.querySelector('.viewer-subtab[data-subtarget="security"] span');
    if (tab) {
        tab.textContent = `Security Analysis (${issues.length})`;
    }

    if (issues.length === 0) {
        container.innerHTML = `
            <div class="security-empty-state">
                <div class="security-empty-icon">
                    <i class="fa-solid fa-check"></i>
                </div>
                <h3 class="security-empty-title">No Security Issues Identified</h3>
                <p class="security-empty-text">
                    We didn't detect any FLS violations, record sharing errors, or setup access exceptions in this debug log. Everything looks secure!
                </p>
            </div>
        `;
        return;
    }

    // Build the Summary Cards
    let summaryHtml = `
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
            <div class="summary-card" style="flex: 1; background: #2c3e50; border-radius: 8px; padding: 16px; color: white; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: rgba(231,76,60,0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #e74c3c;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; line-height: 1.2;">${issues.length}</div>
                    <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">Security Issues Found</div>
                </div>
            </div>
            <div class="summary-card" style="flex: 1; background: #2c3e50; border-radius: 8px; padding: 16px; color: white; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: rgba(52,152,219,0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #3498db;">
                    <i class="fa-solid fa-cube"></i>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; line-height: 1.2;">${objectsAffected.size}</div>
                    <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">Objects Identified</div>
                </div>
            </div>
            <div class="summary-card" style="flex: 1; background: #2c3e50; border-radius: 8px; padding: 16px; color: white; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: rgba(241,196,15,0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #f1c40f;">
                    <i class="fa-solid fa-key"></i>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; line-height: 1.2;">${fieldsAffected.size}</div>
                    <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">FLS Fields Affected</div>
                </div>
            </div>
        </div>
    `;

    // Build the Detailed Issues Table
    let tableHtml = `
        <table class="data-table">
            <thead>
                <tr>
                    <th class="col-timestamp">Timestamp</th>
                    <th class="col-line">Line</th>
                    <th class="col-source">Source / Object</th>
                    <th style="min-width:120px;">Category</th>
                    <th style="min-width:150px;">Security Issue Details</th>
                    <th style="min-width:200px;">Actionable Fix Suggestion</th>
                </tr>
            </thead>
            <tbody>
    `;

    issues.forEach((issue, idx) => {
        let sourceIcon = '';
        if (issue.sourceType === 'apex') {
            sourceIcon = '<i class="fa-solid fa-code" style="color: #3498DB;"></i>';
        } else if (issue.sourceType === 'flow') {
            sourceIcon = '<i class="fa-solid fa-sitemap" style="color: #9B59B6;"></i>';
        } else if (issue.sourceType === 'trigger') {
            sourceIcon = '<i class="fa-solid fa-bolt" style="color: #F1C40F;"></i>';
        } else {
            sourceIcon = '<i class="fa-solid fa-shield-halved" style="color: #E74C3C;"></i>';
        }

        const objFieldBadge = issue.object || issue.field
            ? `<div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
                 ${issue.object ? `<span style="background: rgba(52,152,219,0.15); color: #3498db; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 500;">Object: ${escapeHtml(issue.object)}</span>` : ''}
                 ${issue.field ? `<span style="background: rgba(241,196,15,0.15); color: #f39c12; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 500;">Field: ${escapeHtml(issue.field)}</span>` : ''}
               </div>`
            : '';

        tableHtml += `
            <tr class="soql-failed" style="background: rgba(231,76,60,0.02);">
                <td>${escapeHtml(issue.timestamp)}</td>
                <td>${escapeHtml(issue.line)}</td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span class="dml-type-cell" style="gap: 6px;">
                            ${sourceIcon}
                            <span class="soql-source-name">${escapeHtml(issue.source)}</span>
                        </span>
                    </div>
                </td>
                <td>
                    <span style="background: rgba(231,76,60,0.15); color: #e74c3c; font-size: 11px; padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block;">
                        ${escapeHtml(issue.category)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <strong style="color: #2c3e50; font-size: 13px;">${escapeHtml(issue.description)}</strong>
                        <span style="font-family: monospace; font-size: 11px; color: #c0392b; background: rgba(192,57,43,0.05); padding: 4px 8px; border-radius: 4px; border-left: 3px solid #c0392b; margin-top: 4px; line-height: 1.4;">
                            ${escapeHtml(issue.message)}
                        </span>
                        ${objFieldBadge}
                    </div>
                </td>
                <td>
                    <div style="background: rgba(46,204,113,0.06); padding: 8px; border-radius: 6px; border-left: 3px solid #2ecc71; font-size: 12px; color: #27ae60; line-height: 1.4;">
                        <strong>💡 How to Fix:</strong><br>
                        ${escapeHtml(issue.suggestedFix)}
                    </div>
                </td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = summaryHtml + tableHtml;
}

function renderQueries(text) {
    const container = document.getElementById('queries-container');
    if (!container) return;
    const lines = getLogLines(text);
    const queries = [];

    // Track current execution context and SOQL results
    let currentSource = 'Unknown';
    let currentSourceType = 'unknown';
    const soqlResults = new Map(); // Map SOQL index to row count
    let soqlIndex = 0;

    lines.forEach(line => {
        // Track execution context
        if (line.includes('|CODE_UNIT_STARTED')) {
            const parts = line.split('|');
            const unitName = parts[parts.length - 1] || parts[3] || '';

            if (unitName.toLowerCase().includes('flow')) {
                currentSource = unitName;
                currentSourceType = 'flow';
            } else if (unitName.toLowerCase().includes('trigger')) {
                currentSource = unitName;
                currentSourceType = 'trigger';
            } else if (unitName.toLowerCase().includes('process')) {
                currentSource = unitName;
                currentSourceType = 'process';
            } else {
                currentSource = unitName;
                currentSourceType = 'apex';
            }
        }

        // Track SOQL queries
        if (line.includes('|SOQL_EXECUTE_BEGIN|')) {
            soqlIndex++;
            const parts = line.split('|');
            const query = parts[parts.length - 1];
            queries.push({
                index: soqlIndex,
                line: parts[2] || '',
                query: query,
                timestamp: parts[0],
                source: currentSource,
                sourceType: currentSourceType,
                rowCount: null,
                failed: false
            });
        }

        // Track SOQL results
        if (line.includes('|SOQL_EXECUTE_END|')) {
            const parts = line.split('|');
            // Row count is typically in position 3
            const rowCount = parts[3] ? parts[3].trim() : '0';
            soqlResults.set(soqlIndex, rowCount);
        }

        // Track SOQL exceptions
        if (line.includes('|EXCEPTION_THROWN|') && line.includes('SOQL')) {
            // Mark the most recent query as failed
            if (queries.length > 0) {
                queries[queries.length - 1].failed = true;
            }
        }
    });

    // Match queries with their results
    queries.forEach(q => {
        q.rowCount = soqlResults.get(q.index) || '0';
    });

    if (queries.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No SOQL found</div>';
        // Update View Tab with Count 0
        const tab = document.querySelector('.viewer-subtab[data-subtarget="queries"] span');
        if (tab) tab.textContent = `SOQL Analysis (0)`;
        return;
    }

    // Update View Tab with Count
    const tab = document.querySelector('.viewer-subtab[data-subtarget="queries"] span');
    if (tab) tab.textContent = `SOQL Analysis (${queries.length})`;

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th class="col-timestamp">Timestamp</th>
                    <th class="col-line">Line</th>
                    <th class="col-source">Source</th>
                    <th class="col-query">Query (${queries.length})</th>
                    <th class="col-rows">Rows</th>
                    <th class="col-status">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    queries.forEach(q => {
        // Determine source icon
        let sourceIcon = '';
        if (q.sourceType === 'apex') {
            sourceIcon = '<i class="fa-solid fa-code" style="color: #3498DB;"></i>';
        } else if (q.sourceType === 'flow') {
            sourceIcon = '<i class="fa-solid fa-sitemap" style="color: #9B59B6;"></i>';
        } else if (q.sourceType === 'trigger') {
            sourceIcon = '<i class="fa-solid fa-bolt" style="color: #F1C40F;"></i>';
        } else if (q.sourceType === 'process') {
            sourceIcon = '<i class="fa-solid fa-gears" style="color: #E67E22;"></i>';
        } else {
            sourceIcon = '<i class="fa-solid fa-question-circle" style="color: #95A5A6;"></i>';
        }

        const rowClass = q.failed ? 'soql-failed' : '';
        const statusBadge = q.failed
            ? '<span class="status-badge status-failed">Failed</span>'
            : '<span class="status-badge status-success">Success</span>';

        html += `
            <tr class="${rowClass}">
                <td class="col-timestamp">${escapeHtml(q.timestamp)}</td>
                <td class="col-line">${escapeHtml(q.line)}</td>
                <td class="col-source">
                    <span class="dml-type-cell" title="${q.sourceType}">
                        ${sourceIcon}
                        <span class="soql-source-name">${escapeHtml(q.source)}</span>
                    </span>
                </td>
                <td class="col-query query-soql">${escapeHtml(q.query)}</td>
                <td class="col-rows soql-row-count">${q.rowCount}</td>
                <td class="col-status">${statusBadge}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderUserDebug(text) {
    const container = document.getElementById('user-debug-container');
    if (!container) return;
    const lines = getLogLines(text);
    const debugLines = lines.filter(l => l.includes('|USER_DEBUG|'));

    if (debugLines.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No debug found</div>';
        return;
    }

    let html = '';
    debugLines.forEach(line => {
        // Extract the debug content after USER_DEBUG|line|level|message
        const parts = line.split('|');
        let debugContent = line;
        if (parts.length >= 4) {
            debugContent = parts.slice(3).join('|').trim();
        }
        html += `<div class="log-line log-event-user-debug"><i class="fa-solid fa-bug" style="margin-right:8px;font-size:12px;opacity:0.7;"></i><span class="log-line-content">${escapeHtml(debugContent)}</span></div>`;
    });

    container.innerHTML = html;
}

function renderDML(text) {
    const container = document.getElementById('dml-container');
    if (!container) return;
    const lines = getLogLines(text);
    const dmlOps = [];

    // Track current execution context to determine source
    let currentSource = 'Unknown';
    let currentSourceType = 'unknown';

    lines.forEach(line => {
        // Track execution context
        if (line.includes('|CODE_UNIT_STARTED')) {
            const parts = line.split('|');
            const unitName = parts[parts.length - 1] || parts[3] || '';

            if (unitName.toLowerCase().includes('flow')) {
                currentSource = unitName;
                currentSourceType = 'flow';
            } else if (unitName.toLowerCase().includes('trigger')) {
                currentSource = unitName;
                currentSourceType = 'trigger';
            } else if (unitName.toLowerCase().includes('process')) {
                currentSource = unitName;
                currentSourceType = 'process';
            } else {
                currentSource = unitName;
                currentSourceType = 'apex';
            }
        }

        if (line.includes('|DML_BEGIN|')) {
            const parts = line.split('|');
            if (parts.length >= 6) {
                dmlOps.push({
                    timestamp: parts[0],
                    line: parts[2],
                    op: parts[3],
                    type: parts[4],
                    rows: parts[5],
                    source: currentSource,
                    sourceType: currentSourceType
                });
            }
        }
    });

    if (dmlOps.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No DML operations found</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th style="text-align:center;">Line</th>
                    <th>Operation</th>
                    <th>Source</th>
                    <th>Object Type</th>
                    <th style="text-align:right;">Rows</th>
                </tr>
            </thead>
            <tbody>
    `;

    dmlOps.forEach(op => {
        // Determine icon based on operation type
        let icon = '';
        let operationClass = '';
        let tooltip = '';

        const opType = op.op.toLowerCase();

        if (opType.includes('insert')) {
            icon = '<i class="fa-solid fa-plus" style="color: #48C774;"></i>';
            operationClass = 'dml-insert';
            tooltip = 'Insert Operation';
        } else if (opType.includes('update')) {
            icon = '<i class="fa-solid fa-pen" style="color: #2E86C1;"></i>';
            operationClass = 'dml-update';
            tooltip = 'Update Operation';
        } else if (opType.includes('delete')) {
            icon = '<i class="fa-solid fa-trash" style="color: #E74C3C;"></i>';
            operationClass = 'dml-delete';
            tooltip = 'Delete Operation';
        } else if (opType.includes('undelete')) {
            icon = '<i class="fa-solid fa-trash-arrow-up" style="color: #F39C12;"></i>';
            operationClass = 'dml-undelete';
            tooltip = 'Undelete Operation';
        } else if (opType.includes('upsert')) {
            icon = '<i class="fa-solid fa-arrows-rotate" style="color: #9B59B6;"></i>';
            operationClass = 'dml-upsert';
            tooltip = 'Upsert Operation';
        } else {
            icon = '<i class="fa-solid fa-database" style="color: #95A5A6;"></i>';
            operationClass = 'dml-other';
            tooltip = 'DML Operation';
        }

        // Determine source icon
        let sourceIcon = '';
        let sourceTooltip = '';

        if (op.sourceType === 'apex') {
            sourceIcon = '<i class="fa-solid fa-code" style="color: #3498DB;"></i>';
            sourceTooltip = 'Apex Class';
        } else if (op.sourceType === 'flow') {
            sourceIcon = '<i class="fa-solid fa-sitemap" style="color: #9B59B6;"></i>';
            sourceTooltip = 'Flow';
        } else if (op.sourceType === 'trigger') {
            sourceIcon = '<i class="fa-solid fa-bolt" style="color: #F1C40F;"></i>';
            sourceTooltip = 'Trigger';
        } else if (op.sourceType === 'process') {
            sourceIcon = '<i class="fa-solid fa-gears" style="color: #E67E22;"></i>';
            sourceTooltip = 'Process Builder';
        } else {
            sourceIcon = '<i class="fa-solid fa-question-circle" style="color: #95A5A6;"></i>';
            sourceTooltip = 'Unknown Source';
        }

        html += `
            <tr class="${operationClass}">
                <td>${escapeHtml(op.timestamp)}</td>
                <td>${escapeHtml(op.line)}</td>
                <td>
                    <span class="dml-operation-cell" title="${tooltip}">
                        ${icon}
                        <span>${escapeHtml(op.op)}</span>
                    </span>
                </td>
                <td>
                    <span class="dml-type-cell" title="${sourceTooltip}">
                        ${sourceIcon}
                        <span class="dml-source-name">${escapeHtml(op.source)}</span>
                    </span>
                </td>
                <td><span class="dml-object-type">${escapeHtml(op.type)}</span></td>
                <td><span class="dml-row-count">${escapeHtml(op.rows)}</span></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderGovLimits(text) {
    const container = document.getElementById('gov-limits-container');
    if (!container) return;

    const lines = getLogLines(text);
    
    // Performance Variables
    let totalDurationNs = 0;
    let soqlDurationNs = 0;
    let dmlDurationNs = 0;
    let flowDurationNs = 0;
    let validationDurationNs = 0;
    let methodDurationNs = 0;
    let dmlCount = 0;
    let validationCount = 0;

    const queries = [];
    const methods = [];

    // Capture first/last timestamps to compute total duration
    let firstNs = null;
    let lastNs = null;

    // Track active timers to avoid overlapping or double-counting
    const methodStack = [];
    const flowStack = [];

    let currentSource = 'Unknown';
    let currentSourceType = 'unknown';

    // 3-char prefix map for common Salesforce objects
    const prefixMap = {
        '001': 'Account',
        '003': 'Contact',
        '006': 'Opportunity',
        '00Q': 'Lead',
        '005': 'User',
        '500': 'Case',
        '701': 'Campaign',
        '01t': 'Product2',
        '801': 'Order',
        '00k': 'OpportunityLineItem',
        '015': 'Document',
        '00b': 'WebLink',
        '01s': 'Pricebook2',
        '01u': 'PricebookEntry',
        '02i': 'Asset',
        'a0': 'Custom Object (Prefix a0)',
        'a1': 'Custom Object (Prefix a1)',
        'a2': 'Custom Object (Prefix a2)',
        'a3': 'Custom Object (Prefix a3)',
        'a4': 'Custom Object (Prefix a4)',
        'a5': 'Custom Object (Prefix a5)',
    };

    lines.forEach((line, index) => {
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) \((\d+)\)\|/);
        if (!timeMatch) return;
        
        const timestamp = parseInt(timeMatch[2]);
        if (firstNs === null) firstNs = timestamp;
        lastNs = timestamp;

        // Context tracking
        if (line.includes('|CODE_UNIT_STARTED')) {
            const parts = line.split('|');
            const unitName = parts[parts.length - 1] || parts[3] || '';
            if (unitName.toLowerCase().includes('flow')) {
                currentSource = unitName;
                currentSourceType = 'flow';
            } else if (unitName.toLowerCase().includes('trigger')) {
                currentSource = unitName;
                currentSourceType = 'trigger';
            } else if (unitName.toLowerCase().includes('process')) {
                currentSource = unitName;
                currentSourceType = 'process';
            } else {
                currentSource = unitName;
                currentSourceType = 'apex';
            }
        }

        // --- DATABASE TIMING ---
        if (line.includes('|SOQL_EXECUTE_BEGIN|')) {
            const parts = line.split('|');
            const queryText = parts[parts.length - 1] || 'Unknown Query';
            queries.push({
                query: queryText,
                start: timestamp,
                line: parts[2] || '?',
                source: currentSource,
                duration: 0
            });
        }
        else if (line.includes('|SOQL_EXECUTE_END|')) {
            if (queries.length > 0) {
                const latest = queries[queries.length - 1];
                if (latest.start) {
                    const diff = timestamp - latest.start;
                    latest.duration = diff;
                    soqlDurationNs += diff;
                }
            }
        }
        else if (line.includes('|DML_BEGIN|')) {
            dmlCount++;
            methodStack.push({ type: 'DML', start: timestamp });
        }
        else if (line.includes('|DML_END|')) {
            const idx = methodStack.map(s => s.type).lastIndexOf('DML');
            if (idx !== -1) {
                const dmlItem = methodStack.splice(idx, 1)[0];
                const diff = timestamp - dmlItem.start;
                dmlDurationNs += diff;
            }
        }

        // --- METHOD / APEX TIMING ---
        else if (line.includes('|METHOD_ENTRY|')) {
            const parts = line.split('|');
            const methodName = parts[parts.length - 1] || 'Method';
            methodStack.push({
                type: 'METHOD',
                name: methodName,
                start: timestamp,
                source: currentSource
            });
        }
        else if (line.includes('|METHOD_EXIT|')) {
            const idx = methodStack.map(s => s.type).lastIndexOf('METHOD');
            if (idx !== -1) {
                const methodItem = methodStack.splice(idx, 1)[0];
                const diff = timestamp - methodItem.start;
                methodDurationNs += diff;
                
                methods.push({
                    name: methodItem.name,
                    source: methodItem.source,
                    duration: diff
                });
            }
        }

        // --- FLOW / PROCESS TIMING ---
        else if (line.includes('|FLOW_START|') || line.includes('|FLOW_ELEMENT_BEGIN|')) {
            flowStack.push({ start: timestamp });
        }
        else if (line.includes('|FLOW_ELEMENT_END|')) {
            if (flowStack.length > 0) {
                const item = flowStack.pop();
                flowDurationNs += (timestamp - item.start);
            }
        }

        // --- VALIDATION RULE TIMING ---
        else if (line.includes('|VALIDATION_RULE|')) {
            validationCount++;
            validationDurationNs += 1000000; // Approx 1 ms in nanoseconds
        }
    });

    if (firstNs !== null && lastNs !== null) {
        totalDurationNs = lastNs - firstNs;
    }

    if (totalDurationNs === 0) totalDurationNs = 1;

    // Convert nanoseconds to milliseconds
    const totalMs = totalDurationNs / 1000000;
    const soqlMs = soqlDurationNs / 1000000;
    const dmlMs = dmlDurationNs / 1000000;
    const dbMs = soqlMs + dmlMs;
    const flowMs = flowDurationNs / 1000000;
    const validationMs = validationDurationNs / 1000000;
    const methodMs = methodDurationNs / 1000000;
    
    // Remaining time is system overhead
    const otherMs = Math.max(0, totalMs - (dbMs + flowMs + validationMs + methodMs));

    // Calculate Percentages
    const dbPercent = Math.min(100, Math.round((dbMs / totalMs) * 100)) || 0;
    const flowPercent = Math.min(100, Math.round((flowMs / totalMs) * 100)) || 0;
    const validationPercent = Math.min(100, Math.round((validationMs / totalMs) * 100)) || 0;
    const methodPercent = Math.min(100, Math.round((methodMs / totalMs) * 100)) || 0;
    
    let otherPercent = 100 - (dbPercent + flowPercent + validationPercent + methodPercent);
    if (otherPercent < 0) otherPercent = 0;

    // Sort and ranking of bottlenecks
    const slowestQueries = queries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(q => {
            const repeats = queries.filter(allQ => allQ.query === q.query).length;
            const queryUpper = q.query.toUpperCase();
            const sourceLower = q.source ? q.source.toLowerCase() : '';
            const isTrigger = sourceLower.includes('trigger') || sourceLower.includes('__sfdc_trigger');
            const isAggregate = queryUpper.includes('SUM(') || queryUpper.includes('COUNT(') || queryUpper.includes('AVG(') || queryUpper.includes('GROUP BY');
            
            let reason = '';
            if (repeats > 1) {
                reason = `Repeated ${repeats}x in transaction. Consider caching or bulkifying query results to avoid redundant roundtrips.`;
            } else if (isTrigger && isAggregate) {
                reason = "Aggregate rollup calculation inside a trigger context. Compounds trigger block latency.";
            } else if (isAggregate) {
                reason = "Aggregate functions (SUM/GROUP BY) require extra database compute and full table scans.";
            } else if (isTrigger) {
                reason = "Executed in a trigger context. Sequential loop evaluation inside triggers blocks threads.";
            } else if (!queryUpper.includes('WHERE')) {
                reason = "Unfiltered query (missing WHERE clause). Triggers full-table scans which degrade performance.";
            } else if (!queryUpper.includes('LIMIT')) {
                reason = "No row limit specified. Consider adding a LIMIT clause to safeguard heap memory.";
            } else {
                reason = "Standard database retrieve latency. Ensure filters are indexed and selective.";
            }

            return {
                name: q.query,
                meta: `Line ${q.line} • ${q.source}`,
                duration: (q.duration / 1000000).toFixed(2),
                reason: reason
            };
        });

    // Aggregate duplicate methods and sort
    const methodMap = new Map();
    methods.forEach(m => {
        const key = `${m.source}.${m.name}`;
        if (methodMap.has(key)) {
            methodMap.get(key).duration += m.duration;
            methodMap.get(key).count++;
        } else {
            methodMap.set(key, { ...m, count: 1 });
        }
    });

    const slowestMethods = Array.from(methodMap.values())
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(m => {
            const isTrigger = m.source && m.source.toLowerCase().includes('trigger');
            const isLoop = m.count > 3;
            const durationMs = m.duration / 1000000;
            
            let reason = '';
            if (isLoop) {
                reason = `Called ${m.count} times. High call frequency compounds CPU usage. Optimize loops or cache results.`;
            } else if (isTrigger) {
                reason = "Trigger context invocation. Includes platform routing and DML state check overhead.";
            } else if (durationMs > 100) {
                reason = "Heavy synchronous processing. Inspect for nested iterations, heavy sorting, or complex parsing.";
            } else {
                reason = "Synchronous execution duration. Review inner loop efficiency and reference caching.";
            }

            return {
                name: m.name,
                meta: `${m.source} (${m.count} call${m.count > 1 ? 's' : ''})`,
                duration: durationMs.toFixed(2),
                reason: reason
            };
        });

    // --- GOVERNOR LIMITS PARSING ---
    let startIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('|CUMULATIVE_LIMIT_USAGE')) {
            startIndex = i;
            break;
        }
    }

    const limitLines = [];
    if (startIndex !== -1) {
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Number of') || line.includes('Maximum')) {
                limitLines.push(line);
            }
            if (line.includes('|CUMULATIVE_LIMIT_USAGE_END')) break;
        }
    }

    if (limitLines.length === 0) {
        lines.forEach(line => {
            if (line.match(/Number of .* out of \d+/)) {
                limitLines.push(line);
            }
        });
    }

    const resourceMap = new Map();
    limitLines.forEach(line => {
        const match = line.match(/(Number of .*|Maximum .*):\s*(\d+)\s*out of\s*(\d+)/);
        if (match) {
            const resource = match[1];
            const used = parseInt(match[2]);
            const limit = parseInt(match[3]);
            if (!resourceMap.has(resource) || resourceMap.get(resource).used < used) {
                resourceMap.set(resource, { resource, used, limit });
            }
        }
    });

    const sortedLimits = Array.from(resourceMap.values()).sort((a, b) => {
        const percentA = a.limit > 0 ? (a.used / a.limit) * 100 : 0;
        const percentB = b.limit > 0 ? (b.used / b.limit) * 100 : 0;
        return percentB - percentA;
    });

    // --- COMPUTE DASHBOARD PERFORMANCE WARNING ALERTS ---
    const alerts = [];
    
    // Check total transaction time
    if (totalMs > 1000) {
        alerts.push({
            type: 'warning',
            text: `High Transaction Time: This transaction took ${totalMs.toFixed(1)} ms. Inspect SOQL latency and CPU hotspots.`
        });
    }

    // Check query counts
    if (queries.length > 25) {
        alerts.push({
            type: 'danger',
            text: `Potential SOQL Limit Risk: ${queries.length} queries executed. This is approaching the synchronous governor limit of 100 queries. Caching might be needed.`
        });
    } else if (queries.length > 10) {
        alerts.push({
            type: 'warning',
            text: `${queries.length} SOQL queries executed. Look into bulkification to consolidate database roundtrips.`
        });
    }

    // Check repetitive queries
    const queryCounts = {};
    queries.forEach(q => {
        queryCounts[q.query] = (queryCounts[q.query] || 0) + 1;
    });
    let hasRepetitive = false;
    Object.keys(queryCounts).forEach(qText => {
        if (queryCounts[qText] > 2) {
            hasRepetitive = true;
        }
    });
    if (hasRepetitive) {
        alerts.push({
            type: 'warning',
            text: `Repetitive Queries: One or more SOQL queries are executed multiple times. Consider caching or moving queries out of loops.`
        });
    }

    // Check governor limits warnings
    sortedLimits.forEach(lim => {
        const pct = lim.limit > 0 ? Math.round((lim.used / lim.limit) * 100) : 0;
        if (pct >= 85) {
            alerts.push({
                type: 'danger',
                text: `Governor Limit Breach Risk: ${lim.resource} is at ${pct}% usage (${lim.used} out of ${lim.limit}).`
            });
        } else if (pct >= 50) {
            alerts.push({
                type: 'warning',
                text: `High Resource Usage: ${lim.resource} is at ${pct}% usage (${lim.used} out of ${lim.limit}).`
            });
        }
    });

    if (alerts.length === 0) {
        alerts.push({
            type: 'info',
            text: "No performance warnings or limit breaches detected. Transaction looks healthy!"
        });
    }

    // --- RENDER HTML TEMPLATE ---
    let html = `
        <div class="dl-dashboard">
            <!-- UNIFIED: KPI strip + CPU Breakdown in one card -->
            <div class="dl-card" style="margin-bottom: 16px;">
                <div class="dl-perf-body">
                    <!-- Left: KPI metrics -->
                    <div class="dl-perf-kpis">
                        <div class="dl-perf-kpi">
                            <div class="dl-perf-kpi-ring" style="--ring-color:var(--sfarc-accent, #f97316)">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--sfarc-accent, #f97316)" stroke-width="3" stroke-dasharray="${Math.min(dbPercent, 100)} ${100 - Math.min(dbPercent, 100)}" stroke-dashoffset="25" stroke-linecap="round"/>
                                </svg>
                                <span class="dl-perf-kpi-pct">${dbPercent}%</span>
                            </div>
                            <div class="dl-perf-kpi-info">
                                <span class="dl-perf-kpi-num">${totalMs.toFixed(0)}<small>ms</small></span>
                                <span class="dl-perf-kpi-lbl">Transaction</span>
                            </div>
                        </div>
                        <div class="dl-perf-kpi">
                            <div class="dl-perf-kpi-ring" style="--ring-color:var(--sfarc-accent, #f97316)">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--sfarc-accent, #f97316)" stroke-width="3" stroke-dasharray="${Math.min(dbPercent, 100)} ${100 - Math.min(dbPercent, 100)}" stroke-dashoffset="25" stroke-linecap="round"/>
                                </svg>
                                <span class="dl-perf-kpi-pct">${dbPercent}%</span>
                            </div>
                            <div class="dl-perf-kpi-info">
                                <span class="dl-perf-kpi-num">${dbMs.toFixed(0)}<small>ms</small></span>
                                <span class="dl-perf-kpi-lbl">Database</span>
                            </div>
                        </div>
                        <div class="dl-perf-kpi">
                            <div class="dl-perf-kpi-ring" style="--ring-color:var(--sfarc-accent, #f97316)">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--sfarc-accent, #f97316)" stroke-width="3" stroke-dasharray="${Math.min(queries.length, 100)} ${100 - Math.min(queries.length, 100)}" stroke-dashoffset="25" stroke-linecap="round"/>
                                </svg>
                                <span class="dl-perf-kpi-pct">${queries.length}</span>
                            </div>
                            <div class="dl-perf-kpi-info">
                                <span class="dl-perf-kpi-num">${queries.length}<small>/100</small></span>
                                <span class="dl-perf-kpi-lbl">SOQL Queries</span>
                            </div>
                        </div>
                        <div class="dl-perf-kpi">
                            <div class="dl-perf-kpi-ring" style="--ring-color:var(--sfarc-accent, #f97316)">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--sfarc-accent, #f97316)" stroke-width="3" stroke-dasharray="${Math.min(dmlCount * 5, 100)} ${100 - Math.min(dmlCount * 5, 100)}" stroke-dashoffset="25" stroke-linecap="round"/>
                                </svg>
                                <span class="dl-perf-kpi-pct">${dmlCount}</span>
                            </div>
                            <div class="dl-perf-kpi-info">
                                <span class="dl-perf-kpi-num">${dmlCount}</span>
                                <span class="dl-perf-kpi-lbl">DML</span>
                            </div>
                        </div>
                        <div class="dl-perf-kpi">
                            <div class="dl-perf-kpi-ring" style="--ring-color:var(--sfarc-accent, #f97316)">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--sfarc-accent, #f97316)" stroke-width="3" stroke-dasharray="${Math.min(validationCount, 100)} ${100 - Math.min(validationCount, 100)}" stroke-dashoffset="25" stroke-linecap="round"/>
                                </svg>
                                <span class="dl-perf-kpi-pct">${validationCount}</span>
                            </div>
                            <div class="dl-perf-kpi-info">
                                <span class="dl-perf-kpi-num">${validationCount}</span>
                                <span class="dl-perf-kpi-lbl">Validations</span>
                            </div>
                        </div>
                    </div>

                    <!-- Separator -->
                    <div class="dl-perf-sep"></div>

                    <!-- Right: CPU breakdown donut -->
                    <div class="dl-perf-cpu">
                        <div class="dl-perf-donut">
                            <svg viewBox="0 0 42 42" class="dl-donut">
                                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
                                ${methodPercent > 0 ? `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--sfarc-accent, #f97316)" stroke-width="6" stroke-dasharray="${methodPercent} ${100 - methodPercent}" stroke-dashoffset="25" stroke-linecap="round" title="Apex: ${methodPercent}%"/>` : ''}
                                ${dbPercent > 0 ? `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ef4444" stroke-width="6" stroke-dasharray="${dbPercent} ${100 - dbPercent}" stroke-dashoffset="${25 - methodPercent}" stroke-linecap="round" title="DB: ${dbPercent}%"/>` : ''}
                                ${flowPercent > 0 ? `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#a855f7" stroke-width="6" stroke-dasharray="${flowPercent} ${100 - flowPercent}" stroke-dashoffset="${25 - methodPercent - dbPercent}" stroke-linecap="round" title="Flows: ${flowPercent}%"/>` : ''}
                                ${validationPercent > 0 ? `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f59e0b" stroke-width="6" stroke-dasharray="${validationPercent} ${100 - validationPercent}" stroke-dashoffset="${25 - methodPercent - dbPercent - flowPercent}" stroke-linecap="round" title="Validation: ${validationPercent}%"/>` : ''}
                                ${otherPercent > 0 ? `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#94a3b8" stroke-width="6" stroke-dasharray="${otherPercent} ${100 - otherPercent}" stroke-dashoffset="${25 - methodPercent - dbPercent - flowPercent - validationPercent}" stroke-linecap="round" title="Overhead: ${otherPercent}%"/>` : ''}
                            </svg>
                            <div class="dl-donut-center">
                                <span class="dl-donut-ms">${Math.round(totalMs)}</span>
                                <span class="dl-donut-unit">ms</span>
                            </div>
                        </div>
                        <div class="dl-perf-legend">
                            <div class="dl-perf-legend-item">
                                <span class="dl-perf-dot" style="background:var(--sfarc-accent, #f97316)"></span>
                                <span class="dl-perf-legend-name">Apex Code</span>
                                <span class="dl-perf-legend-val">${methodPercent}% <small>(${methodMs.toFixed(0)} ms)</small></span>
                            </div>
                            <div class="dl-perf-legend-item">
                                <span class="dl-perf-dot" style="background:#ef4444"></span>
                                <span class="dl-perf-legend-name">DB / SOQL</span>
                                <span class="dl-perf-legend-val">${dbPercent}% <small>(${dbMs.toFixed(0)} ms)</small></span>
                            </div>
                            <div class="dl-perf-legend-item">
                                <span class="dl-perf-dot" style="background:#a855f7"></span>
                                <span class="dl-perf-legend-name">Flows</span>
                                <span class="dl-perf-legend-val">${flowPercent}% <small>(${flowMs.toFixed(0)} ms)</small></span>
                            </div>
                            <div class="dl-perf-legend-item">
                                <span class="dl-perf-dot" style="background:#f59e0b"></span>
                                <span class="dl-perf-legend-name">Validation</span>
                                <span class="dl-perf-legend-val">${validationPercent}% <small>(${validationMs.toFixed(0)} ms)</small></span>
                            </div>
                            <div class="dl-perf-legend-item">
                                <span class="dl-perf-dot" style="background:#94a3b8"></span>
                                <span class="dl-perf-legend-name">Overhead</span>
                                <span class="dl-perf-legend-val">${otherPercent}% <small>(${otherMs.toFixed(0)} ms)</small></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

                <div class="dl-card dl-card-insights">
                    <div class="dl-card-header">
                        <i class="fa-solid fa-lightbulb" style="color: #f59e0b;"></i>
                        <span>Performance Insights</span>
                    </div>
                    <div class="dl-insights-list">
                        ${alerts.map(a => `
                            <div class="dl-alert dl-alert-${a.type}">
                                <i class="fa-solid ${a.type === 'danger' ? 'fa-circle-exclamation' : a.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
                                <span>${escapeHtml(a.text)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- ROW 3: Database Latency + CPU Operations -->
            <div class="dl-row-3">
                <div class="dl-card dl-card-queries">
                    <div class="dl-card-header">
                        <i class="fa-solid fa-database" style="color: #ef4444;"></i>
                        <span>Database Query Latency</span>
                        <span class="dl-badge dl-badge-red">${slowestQueries.length}</span>
                    </div>
                    ${slowestQueries.length === 0 ? '<div class="dl-empty"><i class="fa-solid fa-database"></i> No SOQL queries</div>' : `
                        <div class="dl-query-list">
                            ${slowestQueries.map((q, i) => `
                                <div class="dl-query-row">
                                    <span class="dl-query-rank">${i + 1}</span>
                                    <div class="dl-query-info">
                                        <span class="dl-query-sql">${escapeHtml(q.name.length > 60 ? q.name.substring(0, 57) + '...' : q.name)}</span>
                                        <span class="dl-query-meta">${escapeHtml(q.meta)}</span>
                                        ${q.reason ? `<span class="dl-query-warn">${escapeHtml(q.reason)}</span>` : ''}
                                    </div>
                                    <span class="dl-query-ms">${q.duration}<small>ms</small></span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div class="dl-card dl-card-cpu-ops">
                    <div class="dl-card-header">
                        <i class="fa-solid fa-bolt" style="color: #f59e0b;"></i>
                        <span>Top CPU Operations</span>
                        <span class="dl-badge dl-badge-yellow">${slowestMethods.length}</span>
                    </div>
                    ${slowestMethods.length === 0 ? '<div class="dl-empty"><i class="fa-solid fa-bolt"></i> No slow methods</div>' : `
                        <div class="dl-query-list">
                            ${slowestMethods.map((m, i) => `
                                <div class="dl-query-row">
                                    <span class="dl-query-rank">${i + 1}</span>
                                    <div class="dl-query-info">
                                        <span class="dl-query-sql">${escapeHtml(m.name.length > 60 ? m.name.substring(0, 57) + '...' : m.name)}</span>
                                        <span class="dl-query-meta">${escapeHtml(m.meta)}</span>
                                        ${m.reason ? `<span class="dl-query-warn">${escapeHtml(m.reason)}</span>` : ''}
                                    </div>
                                    <span class="dl-query-ms">${m.duration}<small>ms</small></span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- ROW 4: Governor Limits Table (full width) -->
            <div class="dl-card dl-card-limits">
                <div class="dl-card-header">
                    <i class="fa-solid fa-chart-pie" style="color: #10b981;"></i>
                    <span>Governor Limits Usage</span>
                </div>
                ${sortedLimits.length === 0 ? '<div class="dl-empty"><i class="fa-solid fa-chart-pie"></i> No governor limits data found</div>' : `
                    <table class="dl-limits-table">
                        <thead>
                            <tr>
                                <th style="width:40%">Description</th>
                                <th style="width:15%;text-align:right">Usage</th>
                                <th style="width:15%;text-align:right">Limit</th>
                                <th style="width:30%">Usage %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedLimits.map(lim => {
                                const pct = lim.limit > 0 ? Math.round((lim.used / lim.limit) * 100) : 0;
                                let color = '#10b981';
                                if (pct >= 90) color = '#ef4444';
                                else if (pct >= 70) color = '#f59e0b';
                                else if (pct >= 50) color = '#f97316';
                                return `
                                    <tr>
                                        <td class="dl-limit-name">${escapeHtml(lim.resource)}</td>
                                        <td class="dl-limit-usage">${lim.used.toLocaleString()}</td>
                                        <td class="dl-limit-max">${lim.limit.toLocaleString()}</td>
                                        <td class="dl-limit-pct-cell">
                                            <div class="dl-limit-bar">
                                                <div class="dl-limit-fill" style="width:${pct}%;background:${color}"></div>
                                            </div>
                                            <span class="dl-limit-pct" style="color:${color}">${pct}%</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

async function renderOrder(text) {
    const container = document.getElementById('order-container');
    if (!container) return;
    const lines = getLogLines(text);

    // Build flat execution rows from log entries
    const rows = [];

    lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split('|');
        if (parts.length < 2) return;
        const timestamp = parts[0] || '';
        const cleanTimestamp = timestamp.replace(/\s*\(\d+\)$/, '');
        let status = '';
        let type = '';
        let name = '';

        if (line.includes('|CODE_UNIT_STARTED')) {
            status = 'STARTED';
            type = 'Code Unit';
            name = parts[parts.length - 1] || parts[3] || 'Code Unit';
        } else if (line.includes('|CODE_UNIT_FINISHED')) {
            status = 'FINISHED';
            type = 'Code Unit';
            name = parts[parts.length - 1] || parts[3] || 'Code Unit';
        } else if (line.includes('|METHOD_ENTRY')) {
            status = 'STARTED';
            type = 'Method';
            name = parts[parts.length - 1] || 'Method';
        } else if (line.includes('|METHOD_EXIT')) {
            status = 'FINISHED';
            type = 'Method';
            name = parts[parts.length - 1] || 'Method';
        } else if (line.includes('|CONSTRUCTOR_ENTRY')) {
            status = 'STARTED';
            type = 'Constructor';
            name = parts[parts.length - 1] || 'Constructor';
        } else if (line.includes('|CONSTRUCTOR_EXIT')) {
            status = 'FINISHED';
            type = 'Constructor';
            name = parts[parts.length - 1] || 'Constructor';
        } else if (line.includes('|SOQL_EXECUTE_BEGIN')) {
            status = 'STARTED';
            type = 'SOQL Query';
            name = parts[parts.length - 1] || 'SOQL Query';
        } else if (line.includes('|SOQL_EXECUTE_END')) {
            status = 'FINISHED';
            type = 'SOQL Query';
            name = parts[parts.length - 1] || 'SOQL Query';
        } else if (line.includes('|DML_BEGIN')) {
            status = 'STARTED';
            type = 'DML';
            const operation = (parts[3] || '').replace(/^Op:/, '');
            const objectType = (parts[4] || '').replace(/^Type:/, '').trim();
            name = objectType ? operation + ' ' + objectType : operation || 'DML';
        } else if (line.includes('|DML_END')) {
            status = 'FINISHED';
            type = 'DML';
            const operation = (parts[3] || '').replace(/^Op:/, '');
            const objectType = (parts[4] || '').replace(/^Type:/, '').trim();
            name = objectType ? operation + ' ' + objectType : operation || 'DML';
        } else if (line.includes('|FLOW_START_INTERVIEW_BEGIN')) {
            status = 'STARTED';
            type = 'Flow';
            name = parts[3] || 'Flow';
        } else if (line.includes('|FLOW_START_INTERVIEW_END')) {
            status = 'FINISHED';
            type = 'Flow';
            name = parts[3] || 'Flow';
        } else if (line.includes('|VALIDATION_RULE')) {
            status = 'STARTED';
            type = 'Validation Rule';
            name = parts[parts.length - 1] || 'Validation';
        } else if (line.includes('|VALIDATION_RULE_END')) {
            status = 'FINISHED';
            type = 'Validation Rule';
            name = parts[parts.length - 1] || 'Validation';
        }

        if (status) {
            // Clean up trigger names
            if (name.indexOf('__sfdc_trigger/') === 0) {
                name = name.slice(14);
            }
            rows.push({ status, type, name, timestamp: cleanTimestamp });
        }
    });

    if (rows.length === 0) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:13px;">No execution order found</div>';
        return;
    }

    // Build table HTML
    const MAX_ROWS = 500;
    const displayRows = rows.slice(0, MAX_ROWS);

    let html = '<table class="exec-order-table">';
    html += '<thead><tr>';
    html += '<th style="width:120px;">Status</th>';
    html += '<th style="width:150px;">Type</th>';
    html += '<th>Name</th>';
    html += '<th style="width:130px;">Time</th>';
    html += '</tr></thead><tbody>';

    displayRows.forEach(row => {
        const statusClass = row.status === 'STARTED' ? 'exec-status-started' : 'exec-status-finished';
        const nameDisplay = row.name.length > 80 ? row.name.substring(0, 77) + '...' : row.name;
        html += `<tr>`;
        html += `<td><span class="exec-status-badge ${statusClass}">${row.status}</span></td>`;
        html += `<td class="exec-type-cell">${escapeHtml(row.type)}</td>`;
        html += `<td class="exec-name-cell" title="${escapeHtml(row.name)}">${escapeHtml(nameDisplay)}</td>`;
        html += `<td class="exec-time-cell">${escapeHtml(row.timestamp)}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';

    if (rows.length > MAX_ROWS) {
        html += `<div style="padding:10px;text-align:center;color:#64748b;font-size:11px;">Showing ${MAX_ROWS} of ${rows.length} entries</div>`;
    }

    container.innerHTML = html;

    renderExecutionSummary(rows);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearHighlights(element) {
    if (!element) return;
    const highlights = element.querySelectorAll('mark.sfarc-search-highlight');
    highlights.forEach(mark => {
        const textNode = document.createTextNode(mark.textContent);
        mark.parentNode.replaceChild(textNode, mark);
    });
    element.normalize();
}

function highlightTerm(element, term) {
    if (!element || !term) return;
    const escapedTerm = escapeRegExp(term);
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    
    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const val = node.nodeValue;
            if (val.toLowerCase().includes(term.toLowerCase())) {
                const parent = node.parentNode;
                if (parent.tagName === 'MARK' && parent.classList.contains('sfarc-search-highlight')) {
                    return;
                }
                if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) {
                    return;
                }
                
                const span = document.createElement('span');
                span.innerHTML = escapeHtml(val).replace(regex, '<mark class="sfarc-search-highlight">$1</mark>');
                
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, node);
                }
                parent.removeChild(node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'MARK' && node.classList.contains('sfarc-search-highlight')) {
                return;
            }
            const children = Array.from(node.childNodes);
            for (const child of children) {
                traverse(child);
            }
        }
    }
    traverse(element);
}

function performLogViewerSearch() {
    const activeTab = document.querySelector('.viewer-tab.sfarc-active');
    if (!activeTab) return;
    const targetId = activeTab.dataset.target;
    
    let container = document.getElementById(`content-${targetId}`);
    if (!container) return;

    document.querySelectorAll('.tab-content').forEach(content => {
        clearHighlights(content);
    });

    const searchInput = document.getElementById('viewer-search-input');
    const counter = document.getElementById('viewer-search-counter');
    const clearBtn = document.getElementById('viewer-search-clear');
    const prevBtn = document.getElementById('viewer-search-prev');
    const nextBtn = document.getElementById('viewer-search-next');
    const searchIcon = document.getElementById('viewer-search-icon');

    if (!searchInput) return;
    const term = searchInput.value.trim();

    if (!term) {
        currentMatchIndex = -1;
        logMatches = [];
        if (counter) counter.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (searchIcon) searchIcon.style.display = 'block';
        return;
    }

    if (counter) counter.style.display = 'inline';
    if (clearBtn) clearBtn.style.display = 'inline';
    if (prevBtn) prevBtn.style.display = 'inline';
    if (nextBtn) nextBtn.style.display = 'inline';
    if (searchIcon) searchIcon.style.display = 'none';

    // Search needs the whole log, so expand any remaining chunks first
    // (no-op once fully rendered).
    if (targetId === 'log') sfarcLogRenderAll();

    // Skip highlighting for execution order to preserve table structure
    if (targetId !== 'execution') {
        highlightTerm(container, term);
    }

    logMatches = Array.from(container.querySelectorAll('mark.sfarc-search-highlight'));
    
    if (logMatches.length > 0) {
        currentMatchIndex = 0;
        scrollToMatch(0);
    } else {
        currentMatchIndex = -1;
        if (counter) {
            counter.textContent = '0/0';
            counter.style.color = '#ff6b6b';
        }
    }
}

function scrollToMatch(index) {
    if (logMatches.length === 0) return;
    
    logMatches.forEach(m => m.classList.remove('sfarc-current-highlight'));
    
    const match = logMatches[index];
    if (match) {
        match.classList.add('sfarc-current-highlight');
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const counter = document.getElementById('viewer-search-counter');
        if (counter) {
            counter.textContent = `${index + 1}/${logMatches.length}`;
            counter.style.color = '#aaa';
        }
    }
}

function renderLog(text) {
    const container = document.getElementById('log-container');
    if (!container) return;
    container.innerHTML = '';

    if (!text || typeof text !== 'string') {
        container.innerHTML = '<div class="loading">No valid log content to display.</div>';
        sfarcLogContainer = null;
        sfarcLogLinesRef = null;
        sfarcLogRendered = 0;
        sfarcLogTotal = 0;
        sfarcLogFullyRendered = true;
        return;
    }

    const lines = getLogLines(text);
    sfarcLogContainer = container;
    sfarcLogLinesRef = lines;
    sfarcLogTotal = lines.length;
    sfarcLogRendered = 0;
    sfarcLogFullyRendered = false;
    sfarcLogAppendChunk();
}

async function renderFlowAnalysis(text) {
    const container = document.getElementById('flow-container');
    if (!container) return;
    const lines = getLogLines(text);
    const flowEvents = [];

    // Track flow stack to handle nested flows/elements
    const stack = [];

    lines.forEach(line => {
        if (line.includes('|FLOW_')) {
            const parts = line.split('|');
            const timestamp = parts[0];
            const eventType = parts[1];

            // Basic parsing for common flow events
            if (eventType === 'FLOW_START_INTERVIEW_BEGIN') {
                const flowName = parts[3];
                flowEvents.push({
                    type: 'START',
                    name: flowName,
                    timestamp: timestamp,
                    details: 'Flow Interview Started'
                });
            } else if (eventType === 'FLOW_ELEMENT_BEGIN') {
                const elementId = parts[3];
                const elementType = parts[4];
                flowEvents.push({
                    type: 'ELEMENT',
                    name: elementId,
                    elementType: elementType,
                    timestamp: timestamp,
                    details: `Element ${elementType} Started`
                });
            } else if (eventType === 'FLOW_ELEMENT_ERROR') {
                const elementId = parts[3];
                const errorMsg = parts[4];
                flowEvents.push({
                    type: 'ERROR',
                    name: elementId,
                    timestamp: timestamp,
                    details: errorMsg,
                    isError: true
                });
            } else if (eventType === 'FLOW_BULK_ELEMENT_BEGIN') {
                const elementId = parts[3];
                const elementType = parts[4];
                flowEvents.push({
                    type: 'BULK_ELEMENT',
                    name: elementId,
                    elementType: elementType,
                    timestamp: timestamp,
                    details: `Bulk Element ${elementType} Started`
                });
            }
        }
    });

    const gen = sfarcRenderToken();
    if (gen !== sfarcRenderGen) return;

    if (flowEvents.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No flow events found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 120px;">Timestamp</th>
                    <th style="width: 100px;">Type</th>
                    <th>Name</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
    const tbody = container.querySelector('tbody');

    // Build row HTML once (fast), then insert in chunks with yields so a log
    // with tens of thousands of flow events doesn't freeze the page.
    const rowHtmls = flowEvents.map(event => {
        const rowClass = event.isError ? 'error-row' : '';
        const typeClass = event.type === 'START' ? 'flow-start' : '';
        return `<tr class="${rowClass}"><td>${escapeHtml(event.timestamp)}</td><td><span class="flow-badge ${typeClass}">${escapeHtml(event.type)}</span></td><td>${escapeHtml(event.name)}</td><td>${escapeHtml(event.details)}</td></tr>`;
    });
    await sfarcRenderRowsChunked(tbody, rowHtmls, gen);
}

// Debug Line Container View
let isContainerView = false;

function setupDebugViewToggle() {
    const toggleBtn = document.getElementById('toggle-debug-view');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        isContainerView = !isContainerView;
        const rawContainer = document.getElementById('user-debug-container');
        const linesContainer = document.getElementById('debug-lines-container');

        if (isContainerView) {
            rawContainer.style.display = 'none';
            linesContainer.style.display = 'block';
            toggleBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                Raw View
            `;
            renderDebugLineContainers();
        } else {
            rawContainer.style.display = 'block';
            linesContainer.style.display = 'none';
            toggleBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor"/>
                    <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor"/>
                    <rect x="2" y="11" width="12" height="2" rx="1" fill="currentColor"/>
                </svg>
                Container View
            `;
        }
    });
}

function parseDebugLines() {
    const lines = currentLogBody.split(/\r?\n/);
    const debugLines = [];

    lines.forEach((line, index) => {
        if (!line.trim()) return;

        // Extract timestamp
        const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)/);
        const timestamp = timestampMatch ? timestampMatch[1] : '';

        // Determine line type
        let type = 'default';
        let content = line;

        if (line.includes('USER_DEBUG')) {
            type = 'user-debug';
            content = line.substring(line.indexOf('USER_DEBUG') + 10).trim();
        } else if (line.includes('SOQL_EXECUTE')) {
            type = 'soql';
        } else if (line.includes('DML_BEGIN') || line.includes('DML_END')) {
            type = 'dml';
        } else if (line.includes('METHOD_ENTRY') || line.includes('METHOD_EXIT')) {
            type = 'method';
        } else if (line.includes('EXCEPTION_THROWN') || line.includes('FATAL_ERROR')) {
            type = 'error';
        } else if (line.includes('CALLOUT')) {
            type = 'callout';
        } else if (line.includes('VALIDATION')) {
            type = 'validation';
        } else if (line.includes('FLOW_')) {
            type = 'flow';
        }

        debugLines.push({
            index: index + 1,
            timestamp,
            type,
            content,
            raw: line
        });
    });

    return debugLines;
}

function renderDebugLineContainers() {
    const container = document.getElementById('debug-lines-container');
    if (!container) return;

    const lines = parseDebugLines();
    container.innerHTML = '';

    if (lines.length === 0) {
        container.innerHTML = '<div class="no-debug">No debug lines found</div>';
        return;
    }

    lines.forEach(line => {
        const lineDiv = document.createElement('div');
        lineDiv.className = `debug-line-container debug-line-${line.type}`;

        lineDiv.innerHTML = `
            <div class="debug-line-header">
                <span class="debug-line-number">#${line.index}</span>
                ${line.timestamp ? `<span class="debug-line-timestamp">${line.timestamp}</span>` : ''}
                <span class="debug-line-type">${line.type.toUpperCase().replace('-', ' ')}</span>
            </div>
            <div class="debug-line-content">${escapeHtml(line.content)}</div>
        `;

        container.appendChild(lineDiv);
    });
}



// Initialize toggle on load

function setupLegendNavigation() {
    const categories = {
        'user-debug': '.log-event-user-debug',
        'query': '.log-event-query',
        'validation': '.log-event-validation',
        'method': '.log-event-method',
        'error': '.log-event-error',
        'callout': '.log-event-callout'
    };

    for (const [key, selector] of Object.entries(categories)) {
        const el = document.getElementById(`count-${key}`);
        if (el && el.parentElement) {
            el.parentElement.style.cursor = 'pointer';
            el.parentElement.title = 'Click to jump to next occurrence';
            
            // Allow clicking anywhere on the legend item
            el.parentElement.addEventListener('click', () => {
                // Switch to Log Tab first if not active
                const logTab = document.querySelector('.viewer-tab[data-target="log"]');
                if (logTab && !logTab.classList.contains('active')) {
                    logTab.click();
                }

                // Legend jumps can target lines anywhere in the log, so render
                // the remaining chunks first (no-op once fully rendered).
                sfarcLogRenderAll();

                // Find all matches
                const matches = document.querySelectorAll(selector);
                if (matches.length > 0) {
                    // Get current index from dataset, default 0
                    let idx = parseInt(el.dataset.currentIndex || '0');
                    if (idx >= matches.length) {
                        idx = 0; // Wrap around
                    }
                    
                    const targetEl = matches[idx];
                    
                    // Scroll into view
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Flash effect
                    targetEl.style.transition = 'background-color 0.5s';
                    const originalBg = targetEl.style.backgroundColor || '';
                    targetEl.style.backgroundColor = '#ffeb3b'; // Flash yellow
                    targetEl.style.color = '#000'; // Ensure text is visible
                    setTimeout(() => {
                        targetEl.style.backgroundColor = originalBg;
                        targetEl.style.color = '';
                        targetEl.style.transition = '';
                    }, 1000);
                    
                    // Update index and text
                    el.dataset.currentIndex = idx + 1;
                    el.textContent = `${idx + 1} / ${matches.length}`;
                }
            });
        }
    }
}

// ─── Field Impact & Mutation Analyzer Module ──────────────────────────────
const FieldImpactAnalyzer = {
    fieldUpdates: [],
    
    initControls() {
        const searchInput = document.getElementById('sfarc-fi-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.render());
        }
    },
    
    parseLog(rawLog) {
        if (!rawLog) return;
        this.fieldUpdates = [];
        const lines = rawLog.split('\n');
        
        let currentStack = [];
        let currentFlow = null;
        let currentElement = null;
        let currentWorkflow = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            // Track Code Unit / Trigger / Method Stack
            if (line.includes('|CODE_UNIT_STARTED|')) {
                const parts = line.split('|');
                const unit = parts[parts.length - 1] || parts[3] || '';
                currentStack.push({ type: 'Apex', name: unit, lineNum });
            } else if (line.includes('|CODE_UNIT_FINISHED|')) {
                currentStack.pop();
            } else if (line.includes('|METHOD_ENTRY|')) {
                const parts = line.split('|');
                const method = parts[parts.length - 1] || parts[4] || '';
                currentStack.push({ type: 'ApexMethod', name: method, lineNum });
            } else if (line.includes('|METHOD_EXIT|')) {
                currentStack.pop();
            }
            
            // Flow Events
            if (line.includes('|FLOW_CREATE_INTERVIEW_BEGIN|') || line.includes('|FLOW_START_INTERVIEW_BEGIN|')) {
                const parts = line.split('|');
                currentFlow = parts[3] || parts[parts.length - 1] || 'Flow';
            } else if (line.includes('|FLOW_ELEMENT_BEGIN|')) {
                const parts = line.split('|');
                const elType = parts[3] || '';
                const elName = parts[4] || parts[parts.length - 1] || '';
                currentElement = `${elType}: ${elName}`;
            } else if (line.includes('|FLOW_VALUE_ASSIGNMENT|')) {
                const parts = line.split('|');
                const target = parts[3] || '';
                const val = parts[4] || parts[parts.length - 1] || '';
                
                if (target && target.includes('.')) {
                    this.fieldUpdates.push({
                        lineNum,
                        componentType: 'Flow',
                        componentName: currentFlow || 'Salesforce Flow',
                        elementName: currentElement || parts[2] || 'Flow Assignment',
                        targetField: target,
                        newValue: val,
                        rawLine: line
                    });
                }
            }
            
            // Workflow Field Updates
            if (line.includes('|WF_FIELD_UPDATE|')) {
                const parts = line.split('|');
                let fieldStr = '', valStr = '', ruleStr = '';
                parts.forEach(p => {
                    if (p.startsWith('Field:')) fieldStr = p.replace('Field:', '').trim();
                    if (p.startsWith('Value:')) valStr = p.replace('Value:', '').trim();
                    if (p.startsWith('Rule:')) ruleStr = p.replace('Rule:', '').trim();
                });
                
                this.fieldUpdates.push({
                    lineNum,
                    componentType: 'Workflow Rule',
                    componentName: ruleStr || currentWorkflow || 'Workflow Rule',
                    elementName: 'Field Update',
                    targetField: fieldStr || 'Record Field',
                    newValue: valStr,
                    rawLine: line
                });
            }
            
            // Apex Variable / Field Assignments & DML
            // Format: timestamp|VARIABLE_ASSIGNMENT|[line]|varName|value
            if (line.includes('|VARIABLE_ASSIGNMENT|')) {
                const parts = line.split('|');
                const varTarget = parts[3] || '';
                const varVal = parts[4] !== undefined ? parts[4] : '';
                const varLine = parts[2] || lineNum;
                
                if (varTarget.includes('.') && !varTarget.startsWith('System.')) {
                    const topContext = currentStack[currentStack.length - 1] || { type: 'Apex Class', name: 'Apex Method' };
                    this.fieldUpdates.push({
                        lineNum,
                        componentType: 'Apex',
                        componentName: topContext.name,
                        elementName: `Line ${varLine}`,
                        targetField: varTarget,
                        newValue: varVal,
                        rawLine: line
                    });
                }
            }
        }
        
        this.render();
    },
    
    render() {
        const container = document.getElementById('sfarc-fi-cards-container');
        const badge = document.getElementById('sfarc-fi-count-badge');
        const searchInput = document.getElementById('sfarc-fi-search');
        if (!container) return;
        
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filtered = this.fieldUpdates.filter(u => {
            if (!query) return true;
            return u.targetField.toLowerCase().includes(query) ||
                   u.componentName.toLowerCase().includes(query) ||
                   u.newValue.toLowerCase().includes(query);
        });
        
        if (badge) badge.innerText = `${filtered.length} Updates`;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 13px; background: rgba(15,23,42,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;">
                    <i class="fa-solid fa-circle-info" style="font-size: 24px; color: var(--sfarc-accent-glow, #38bdf8); margin-bottom: 8px;"></i>
                    <div>${query ? `No field updates found matching "${query}"` : 'No field assignments or updates detected in this log stream.'}</div>
                </div>`;
            return;
        }
        
        let html = '';
        filtered.forEach((item) => {
            let icon = 'fa-code';
            let color = '#a78bfa';
            let bg = 'rgba(167, 139, 250, 0.15)';
            
            if (item.componentType === 'Flow') {
                icon = 'fa-bolt';
                color = 'var(--sfarc-accent-glow, #38bdf8)';
                bg = 'rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.15)';
            } else if (item.componentType === 'Workflow Rule') {
                icon = 'fa-gears';
                color = '#fbbf24';
                bg = 'rgba(251, 191, 36, 0.15)';
            }
            
            html += `
                <div class="sfarc-fi-card" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; transition: border-color 0.2s;">
                    <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
                        <div style="width: 38px; height: 38px; border-radius: 8px; background: ${bg}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 13px; font-weight: 500; color: #f8fafc; font-family: monospace;">${item.targetField}</span>
                                <span style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: ${bg}; color: ${color}; text-transform: uppercase;">${item.componentType}</span>
                            </div>
                            <div style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                                <span>Updated by <strong>${item.componentName}</strong></span>
                                <span style="color: #64748b;">•</span>
                                <span style="color: #94a3b8;">${item.elementName}</span>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;">
                                New Value: <span style="color: #4ade80; font-weight: 500;">${item.newValue || '(null)'}</span>
                            </div>
                        </div>
                    </div>
                    <button class="sfarc-log-jump-btn" data-line-num="${item.lineNum}" style="background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s ease;">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i> Line ${item.lineNum}
                    </button>
                </div>`;
        });
        
        container.innerHTML = html;
        container.querySelectorAll('.sfarc-log-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lineNum = parseInt(btn.dataset.lineNum, 10);
                if (typeof jumpToLogLine === 'function') jumpToLogLine(lineNum);
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setupDebugViewToggle();
    setupLegendNavigation();
    FieldImpactAnalyzer.initControls();
    init();
});
