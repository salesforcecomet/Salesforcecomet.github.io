import {sfConn} from "./inspector.js";

// Initialize Salesforce Session
const urlParams = new URLSearchParams(location.search);
let sfHost = urlParams.get("host");
if (sfHost) {
    sfConn.getSession(sfHost).catch(err => console.error("Failed to fetch Salesforce session:", err));
} else {
    chrome.runtime.sendMessage({ action: 'getCookie' }, (cookie) => {
        if (cookie && cookie.domain) {
            sfConn.getSession(cookie.domain.replace(/^\./, '')).catch(err => console.error(err));
        } else {
            chrome.storage.session.get(['sfarc_cached_session', 'sessionInfo'], (res) => {
                const sess = res.sfarc_cached_session || res.sessionInfo;
                const fresh = sess && Number.isFinite(sess.timestamp) && (Date.now() - sess.timestamp) >= 0 && (Date.now() - sess.timestamp) < 600000;
                if (fresh && sess.instanceUrl && sess.sessionId) {
                    try {
                        const host = new URL(sess.instanceUrl).hostname;
                        sfConn.sessionId = sess.sessionId;
                        sfConn.instanceHostname = host;
                    } catch (e) { }
                }
            });
        }
    });
}

// DOM Elements
const editorContainer = document.getElementById('editor-container');
const outputContainer = document.getElementById('output-container');
const btnRun = document.getElementById('btn-run');
const btnClear = document.getElementById('btn-clear');
const btnFormat = document.getElementById('btn-format');
const btnCopy = document.getElementById('btn-copy');
const btnHistory = document.getElementById('btn-history');
const btnHelp = document.getElementById('btn-help');
const resizer = document.getElementById('resizer');
const leftPane = document.querySelector('.editor-pane');
const btnSwapPanes = document.getElementById('btn-swap-panes');
const splitLayout = document.querySelector('.split-layout');

// Drawer & Modal Elements
const historyDrawer = document.getElementById('history-drawer');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyList = document.getElementById('history-list');
const historySearch = document.getElementById('history-search');

const helpModal = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

// State
let editor = null;
let isExecuting = false;
let history = JSON.parse(localStorage.getItem('sfarc-standalone-anon-history') || '[]');
function getAnonymousApexSettings() {
    try { return JSON.parse(localStorage.getItem('sfiSettings') || '{}'); } catch (e) { return {}; }
}

// --- Swap Panes ---
// Restore saved swap preference
if (localStorage.getItem('sfarc-anon-panes-swapped') === 'true') {
    splitLayout.classList.add('swapped');
    if (btnSwapPanes) btnSwapPanes.classList.add('active');
}

if (btnSwapPanes) {
    btnSwapPanes.addEventListener('click', () => {
        const isSwapped = splitLayout.classList.toggle('swapped');
        btnSwapPanes.classList.toggle('active', isSwapped);
        localStorage.setItem('sfarc-anon-panes-swapped', isSwapped);
        // Update tooltip to reflect current state
        btnSwapPanes.title = isSwapped ? 'Restore Original Layout' : 'Swap Editor & Output Positions';
    });
}

// DOM References for Tabs
const realtimeDebugChk = document.getElementById('realtime-debug-chk');
const tabsBar = document.getElementById('tabs-bar');
const tabDebug = document.getElementById('tab-debug');
const tabSummary = document.getElementById('tab-summary');
const tabRaw = document.getElementById('tab-raw');

let anonExecutionResultState = {
    activeTab: 'debug',
    debugContent: '',
    summaryContent: '',
    rawLogContent: ''
};

function setActiveTab(tabName) {
    anonExecutionResultState.activeTab = tabName;
    [tabDebug, tabSummary, tabRaw].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    if (tabName === 'debug' && tabDebug) {
        tabDebug.classList.add('active');
        outputContainer.innerHTML = anonExecutionResultState.debugContent || '<div style="color:#aaa;">No System.debug logs available.</div>';
    } else if (tabName === 'summary' && tabSummary) {
        tabSummary.classList.add('active');
        outputContainer.innerHTML = anonExecutionResultState.summaryContent || '<div style="color:#aaa;">No summary available.</div>';
    } else if (tabName === 'raw' && tabRaw) {
        tabRaw.classList.add('active');
        outputContainer.innerHTML = anonExecutionResultState.rawLogContent ?
            `<pre style="margin: 0; white-space: pre-wrap; word-break: break-all; color: #d4d4d4; font-family: inherit; font-size: 11px;">${escapeHtml(anonExecutionResultState.rawLogContent)}</pre>` :
            '<div style="color:#aaa;">No raw log available.</div>';
    }
}

if (tabDebug) tabDebug.addEventListener('click', () => setActiveTab('debug'));
if (tabSummary) tabSummary.addEventListener('click', () => setActiveTab('summary'));
if (tabRaw) tabRaw.addEventListener('click', () => setActiveTab('raw'));

// Initialize Monaco Editor
const vsPath = '../lib/monaco-editor/min/vs';
require.config({ paths: { 'vs': vsPath }});
require(['vs/editor/editor.main'], function() {
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

    const apexSettings = getAnonymousApexSettings();
    editor = monaco.editor.create(editorContainer, {
        value: "for (Integer i = 1; i <= 10; i++) {\n    System.debug('hello ' + i);\n}",
        language: 'apex',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: Number(apexSettings.editorFontSize) || 13,
        fontFamily: apexSettings.editorFont || "'Consolas', 'Courier New', monospace",
        lineNumbers: apexSettings.apexLineNumbers === false ? 'off' : 'on',
        quickSuggestions: apexSettings.apexIntelliSense !== false,
        suggestOnTriggerCharacters: apexSettings.apexIntelliSense !== false
    });
    
    // Check if apex language exists, if not fallback to java
    if (!monaco.languages.getLanguages().some(l => l.id === 'apex')) {
        monaco.editor.setModelLanguage(editor.getModel(), 'java');
    }

    // Pinch Zoom to Change Font Size
    editor.onMouseWheel((e) => {
        if (e.browserEvent && e.browserEvent.ctrlKey) {
            e.browserEvent.preventDefault();
            e.browserEvent.stopPropagation();
            const delta = e.browserEvent.deltaY < 0 ? 1 : -1;
            const currentFontSize = editor.getOption(monaco.editor.EditorOption.fontSize);
            const newFontSize = Math.max(9, Math.min(36, currentFontSize + delta));
            editor.updateOptions({ fontSize: newFontSize });
            syncFontSizeUI(newFontSize);
        }
    });

    // Keyboard Shortcuts inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
        executeApex();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, function() {
        formatCode();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, function() {
        toggleHistoryDrawer();
    });

    // --- Font Size Control ---
    const btnFontSize = document.getElementById('btn-font-size');
    const fontSizeDropdown = document.getElementById('font-size-dropdown');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const fontSizePresets = document.querySelectorAll('.font-size-preset');

    // Restore saved font size
    const savedFontSize = parseInt(localStorage.getItem('sfarc-anon-font-size'), 10);
    if (savedFontSize && savedFontSize >= 9 && savedFontSize <= 36) {
        editor.updateOptions({ fontSize: savedFontSize });
        syncFontSizeUI(savedFontSize);
    }

    function syncFontSizeUI(size) {
        if (fontSizeSlider) fontSizeSlider.value = size;
        if (fontSizeValue) fontSizeValue.textContent = size + 'px';
        updateSliderTrack(size);
        updatePresetHighlight(size);
        localStorage.setItem('sfarc-anon-font-size', size);
    }

    function updateSliderTrack(size) {
        if (!fontSizeSlider) return;
        const min = parseInt(fontSizeSlider.min);
        const max = parseInt(fontSizeSlider.max);
        const pct = ((size - min) / (max - min)) * 100;
        fontSizeSlider.style.setProperty('--slider-pct', pct + '%');
    }

    function updatePresetHighlight(size) {
        fontSizePresets.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
        });
    }

    // Toggle dropdown
    if (btnFontSize) {
        btnFontSize.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = fontSizeDropdown.classList.toggle('open');
            btnFontSize.classList.toggle('active', isOpen);
            if (isOpen) {
                const currentSize = editor.getOption(monaco.editor.EditorOption.fontSize);
                syncFontSizeUI(currentSize);
            }
        });
    }

    // Slider input
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            editor.updateOptions({ fontSize: size });
            syncFontSizeUI(size);
        });
    }

    // Preset clicks
    fontSizePresets.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = parseInt(btn.dataset.size);
            editor.updateOptions({ fontSize: size });
            syncFontSizeUI(size);
        });
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const control = document.getElementById('font-size-control');
        if (control && !control.contains(e.target)) {
            fontSizeDropdown.classList.remove('open');
            if (btnFontSize) btnFontSize.classList.remove('active');
        }
    });

    // Initialize slider track
    updateSliderTrack(savedFontSize || 13);
});

// Resizer Logic
let isResizing = false;
resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const minWidth = 200;
    const maxWidth = window.innerWidth - 200;
    let newWidth = e.clientX;
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    leftPane.style.flex = '0 0 ' + newWidth + 'px';
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = 'default';
    }
});

// Helpers for Output Console
function appendLog(text, className = '') {
    const div = document.createElement('div');
    div.className = 'log-line ' + className;
    div.textContent = text;
    outputContainer.appendChild(div);
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

function clearLog() {
    outputContainer.innerHTML = '';
}

// Per-row copy button for debug log output (event delegation)
function setupLogCopy() {
    if (!outputContainer) return;
    const copyIcon = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const checkIcon = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    outputContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.debug-copy');
        if (!btn || !outputContainer.contains(btn)) return;
        const row = btn.closest('.debug-row');
        if (!row) return;
        const text = row.querySelector('.debug-msg').textContent.trim();
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            btn.classList.add('copied');
            btn.innerHTML = checkIcon;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = copyIcon;
            }, 1200);
        } catch (err) {
            // Clipboard unavailable — ignore
        }
    });
}

setupLogCopy();

// History Drawer Logic
function saveToHistory(code) {
    if (!code || !code.trim()) return;
    const trimmed = code.trim();
    // Avoid duplicate at top
    history = history.filter(item => item.code.trim() !== trimmed);
    history.unshift({
        code: trimmed,
        date: new Date().toISOString()
    });
    const historyLimit = Math.max(10, Math.min(200, Number(getAnonymousApexSettings().apexHistoryLimit) || 50));
    if (history.length > historyLimit) history.length = historyLimit;
    localStorage.setItem('sfarc-standalone-anon-history', JSON.stringify(history));
    renderHistory();
}

function renderHistory(filterText = '') {
    historyList.innerHTML = '';
    const filtered = history.filter(item => item.code.toLowerCase().includes(filterText.toLowerCase()));
    
    if (filtered.length === 0) {
        historyList.innerHTML = '<div style="padding: 24px 16px; color: #8b949e; font-size: 12px; text-align: center;"><i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No history items found.</div>';
        return;
    }
    
    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const dateStr = new Date(item.date).toLocaleString();
        div.innerHTML = `
            <div class="history-item-date">
                <i class="fa-regular fa-clock"></i>
                <span>${dateStr}</span>
            </div>
            <div class="history-item-code">${item.code.replace(/</g, '&lt;')}</div>
        `;
        div.addEventListener('click', () => {
            if (editor) {
                editor.setValue(item.code);
            }
            closeHistoryDrawer();
        });
        historyList.appendChild(div);
    });
}

function toggleHistoryDrawer() {
    if (historyDrawer.classList.contains('open')) {
        closeHistoryDrawer();
    } else {
        openHistoryDrawer();
    }
}

function openHistoryDrawer() {
    renderHistory();
    historyDrawer.classList.add('open');
}

function closeHistoryDrawer() {
    historyDrawer.classList.remove('open');
}

// Help Modal Logic
function openHelpModal() {
    helpModal.classList.add('open');
}

function closeHelpModal() {
    helpModal.classList.remove('open');
}

// Format & Copy Actions
function formatCode() {
    if (editor) {
        editor.getAction('editor.action.formatDocument').run();
    }
}

function copyCode() {
    if (editor) {
        navigator.clipboard.writeText(editor.getValue());
        const originalSvg = btnCopy.innerHTML;
        btnCopy.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => { btnCopy.innerHTML = originalSvg; }, 1500);
    }
}

// Execute Anonymous Apex
async function executeApex() {
    if (!editor || isExecuting) return;
    
    let code = editor.getValue().trim();
    if (!code) return;
    const apexSettings = getAnonymousApexSettings();
    if (apexSettings.apexFormatOnRun) {
        await formatCode();
        code = editor.getValue().trim();
    }
    
    // Save to history drawer
    saveToHistory(code);

    isExecuting = true;
    btnRun.disabled = true;
    btnRun.innerHTML = '<span class="comet-loader-inline"></span> Running...';
    
    if (tabsBar) tabsBar.style.display = 'none';
    outputContainer.innerHTML = '';
    
    const isRealtimeDebug = realtimeDebugChk ? realtimeDebugChk.checked : true;
    
    // Get current user ID to query their latest log
    let userId = null;
    if (isRealtimeDebug) {
        appendLog('Verifying Debug TraceFlag & Executing Apex...', 'log-system');
        try {
            const userInfoRes = await sfConn.rest('/services/oauth2/userinfo');
            if (userInfoRes && userInfoRes.user_id) {
                userId = userInfoRes.user_id;
            }
        } catch(e) {
            console.warn('Could not fetch user info', e);
        }

        // Ensure active TraceFlag on Org so Salesforce captures USER_DEBUG logs
        if (userId) {
            await ensureTraceFlagForUser(userId);
        }
    } else {
        appendLog('Executing Anonymous Apex...', 'log-system');
    }
    
    try {
        const executionStartTime = new Date(Date.now() - 3000);
        
        // Execute code via Tooling API
        const executeUrl = '/services/data/v60.0/tooling/executeAnonymous/?anonymousBody=' + encodeURIComponent(code);
        const timeoutMs = Math.max(5, Math.min(120, Number(apexSettings.apexTimeout) || 30)) * 1000;
        const execRes = await Promise.race([
            sfConn.rest(executeUrl, { method: 'GET' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs / 1000} seconds.`)), timeoutMs))
        ]);
        
        let summaryHtml = '';
        let isSuccess = false;
        
        if (execRes.success) {
            isSuccess = true;
            summaryHtml = '<div style="color: #a5d6a7;"><i class="fa-solid fa-check-circle" style="color: #4caf50; margin-right: 6px;"></i>Execution completed successfully.</div>';
        } else if (execRes.compiled === false) {
            summaryHtml = `<div style="color: #ef9a9a;"><strong>Compile Error at Line ${execRes.line}, Column ${execRes.column}:</strong>\n${escapeHtml(execRes.compileProblem)}</div>`;
        } else {
            summaryHtml = `<div style="color: #ef9a9a;"><strong>Runtime Exception:</strong>\n${escapeHtml(execRes.exceptionMessage)}\n\n<strong>Stack Trace:</strong>\n${escapeHtml(execRes.exceptionStackTrace)}</div>`;
        }

        anonExecutionResultState.summaryContent = summaryHtml;
        anonExecutionResultState.rawLogContent = '';
        
        let debugEntries = [];
        let fetchedRawLog = '';

        if (isRealtimeDebug && userId && execRes.compiled !== false) {
            appendLog('Fetching debug logs...', 'log-system');
            
            // Wait briefly for log to be flushed to DB
            await new Promise(r => setTimeout(r, 600));
            
            // Fetch the latest ApexLog for the user
            const formattedStartTime = executionStartTime.toISOString();
            let queryUrl = `/services/data/v60.0/tooling/query/?q=SELECT+Id,Status+FROM+ApexLog+WHERE+LogUserId='${userId}'+AND+StartTime+>=+${formattedStartTime}+ORDER+BY+StartTime+DESC+LIMIT+1`;
            
            let logRes = await sfConn.rest(queryUrl);
            if (!logRes || !logRes.records || logRes.records.length === 0) {
                // Fallback query without StartTime/LogUserId filters
                logRes = await sfConn.rest(`/services/data/v60.0/tooling/query/?q=SELECT+Id,Status+FROM+ApexLog+ORDER+BY+StartTime+DESC+LIMIT+1`);
            }

            if (logRes && logRes.records && logRes.records.length > 0) {
                const logId = logRes.records[0].Id;
                const bodyRes = await sfConn.rest(`/services/data/v60.0/tooling/sobjects/ApexLog/${logId}/Body`, {
                    responseType: 'text',
                    headers: { 'Accept': 'text/plain, */*' }
                });
                
                fetchedRawLog = typeof bodyRes === 'string' ? bodyRes : (bodyRes && bodyRes.text ? bodyRes.text : String(bodyRes));
                debugEntries = parseUserDebugLogs(fetchedRawLog);
            }
        }

        anonExecutionResultState.rawLogContent = fetchedRawLog;

        let debugHtml = '';
        if (debugEntries.length > 0) {
            debugHtml = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div class="debug-subheader">
                    <span><i class="fa-solid fa-terminal" style="color: var(--sfarc-accent-light, #5eb4ff); margin-right: 4px;"></i><strong>System.debug Outputs (${debugEntries.length})</strong></span>
                    <span class="debug-captured"><i class="fa-solid fa-circle"></i>Live Log Captured</span>
                </div>
                ${debugEntries.map(entry => {
                    const level = (entry.level || 'DEBUG').toUpperCase();
                    const levelClass = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : level === 'INFO' ? 'info' : 'debug';
                    return `
                    <div class="debug-row" title="${escapeHtml(entry.message)}">
                        <span class="debug-time">${escapeHtml(entry.timestamp)}</span>
                        <span class="debug-line">[Line ${escapeHtml(entry.lineNum)}]</span>
                        <span class="debug-badge ${levelClass}">${escapeHtml(level)}</span>
                        <span class="debug-msg">${escapeHtml(entry.message)}</span>
                        <button type="button" class="debug-copy" title="Copy message">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>`;
                }).join('')}
            </div>`;
        } else if (isRealtimeDebug && isSuccess) {
            debugHtml = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="color: #a5d6a7; padding: 6px 0;">
                    <i class="fa-solid fa-check-circle" style="color: #4caf50; margin-right: 6px;"></i>
                    Execution completed successfully.
                </div>
                <div style="color: #888; font-size: 11px; font-style: italic; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 4px; border: 1px dashed #333;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 4px; color: #4fc1ff;"></i>
                    No <code>System.debug(...)</code> statements were executed in this Apex script.
                </div>
            </div>`;
        } else {
            debugHtml = summaryHtml;
        }

        anonExecutionResultState.debugContent = debugHtml;

        if (tabsBar) tabsBar.style.display = 'flex';

        if (isRealtimeDebug && debugEntries.length > 0) {
            setActiveTab('debug');
        } else if (!isSuccess || !isRealtimeDebug) {
            setActiveTab('summary');
        } else {
            setActiveTab('debug');
        }

    } catch (err) {
        outputContainer.innerHTML = `<div style="color: #ffcc80;">Network or API Error: ${window.escapeHtml(err.message)}</div>`;
        if (tabsBar) tabsBar.style.display = 'none';
    } finally {
        isExecuting = false;
        btnRun.disabled = false;
        btnRun.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseUserDebugLogs(logBody) {
    if (!logBody) return [];
    const lines = logBody.split(/\r?\n/);
    const debugEntries = [];
    let currentEntry = null;

    const userDebugRegex = /^(\d{2}:\d{2}:\d{2}\.\d+)\s*\([^)]*\)\|USER_DEBUG\|(?:\[(\d+)\]\|)?(?:([A-Z]+)\|)?(.*)$/;
    const logLineStartRegex = /^\d{2}:\d{2}:\d{2}\.\d+\s*\([^)]*\)\|/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(userDebugRegex);
        if (match) {
            if (currentEntry) {
                debugEntries.push(currentEntry);
            }
            currentEntry = {
                timestamp: match[1],
                lineNum: match[2] || '?',
                level: match[3] || 'DEBUG',
                message: match[4] || ''
            };
        } else if (currentEntry) {
            if (logLineStartRegex.test(line)) {
                debugEntries.push(currentEntry);
                currentEntry = null;
            } else {
                currentEntry.message += '\n' + line;
            }
        }
    }
    if (currentEntry) {
        debugEntries.push(currentEntry);
    }
    return debugEntries;
}

function appendRichLog(html) {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.innerHTML = html;
    outputContainer.appendChild(div);
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

async function ensureTraceFlagForUser(userId) {
    if (!userId) return;
    try {
        let debugLevelId = null;
        const dlRes = await sfConn.rest(`/services/data/v60.0/tooling/query/?q=SELECT+Id+FROM+DebugLevel+WHERE+DeveloperName='SFComet'`);
        if (dlRes && dlRes.records && dlRes.records.length > 0) {
            debugLevelId = dlRes.records[0].Id;
        } else {
            const dlCreate = await sfConn.rest(`/services/data/v60.0/tooling/sobjects/DebugLevel`, {
                method: 'POST',
                body: {
                    DeveloperName: 'SFComet',
                    MasterLabel: 'SFComet',
                    ApexCode: 'FINEST',
                    Visualforce: 'NONE',
                    System: 'NONE',
                    Database: 'NONE',
                    Callout: 'NONE',
                    Validation: 'NONE',
                    Workflow: 'NONE',
                    ApexProfiling: 'NONE'
                }
            });
            if (dlCreate && dlCreate.id) debugLevelId = dlCreate.id;
        }

        if (!debugLevelId) return;

        const tfRes = await sfConn.rest(`/services/data/v60.0/tooling/query/?q=SELECT+Id,ExpirationDate+FROM+TraceFlag+WHERE+TracedEntityId='${userId}'+ORDER+BY+ExpirationDate+DESC+LIMIT+1`);
        const now = new Date();
        const expDate = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

        if (tfRes && tfRes.records && tfRes.records.length > 0) {
            const tf = tfRes.records[0];
            if (new Date(tf.ExpirationDate) <= now) {
                await sfConn.rest(`/services/data/v60.0/tooling/sobjects/TraceFlag/${tf.Id}`, {
                    method: 'PATCH',
                    body: {
                        StartDate: now.toISOString(),
                        ExpirationDate: expDate,
                        DebugLevelId: debugLevelId
                    }
                });
            }
        } else {
            await sfConn.rest(`/services/data/v60.0/tooling/sobjects/TraceFlag`, {
                method: 'POST',
                body: {
                    TracedEntityId: userId,
                    LogType: 'USER_DEBUG',
                    StartDate: now.toISOString(),
                    ExpirationDate: expDate,
                    DebugLevelId: debugLevelId
                }
            });
        }
    } catch (e) {
        console.warn('TraceFlag setup notice:', e);
    }
}

// Event Listeners
btnRun.addEventListener('click', executeApex);
btnClear.addEventListener('click', clearLog);
btnFormat.addEventListener('click', formatCode);
btnCopy.addEventListener('click', copyCode);

btnHistory.addEventListener('click', toggleHistoryDrawer);
btnCloseHistory.addEventListener('click', closeHistoryDrawer);
btnClearHistory.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('sfarc-standalone-anon-history');
    renderHistory();
});
historySearch.addEventListener('input', (e) => renderHistory(e.target.value));

btnHelp.addEventListener('click', openHelpModal);
btnCloseHelp.addEventListener('click', closeHelpModal);
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelpModal();
});

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        toggleHistoryDrawer();
    }
});
