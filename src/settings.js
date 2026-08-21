// settings.js - macOS System Settings Manager
const defaultSettings = {
    // General
    iconVisible: true,
    iconPosition: 'left',
    iconOffset: 50,
    autoOpenPanel: false,
    defaultTab: 'search',
    panelPosition: 'right',
    // Launcher: 'both' | 'sidebar' | 'shortcut'
    launcherMethod: 'both',

    // Appearance
    theme: 'system',
    accentColor: '#2196f3',
    editorFont: 'Fira Code',
    editorFontSize: 14,
    uiFontSize: 13,
    compactMode: false,
    performanceMode: false,
    autoPerformanceMode: true, // Auto-detect and enable performance mode
    lazyLoad: true,
    headerIcons: {
        sessionCopy: true,
        fieldApi: true,
        lwcViewer: true,
        flowViewer: true
    },

    // Anonymous Apex
    apexTimeout: 30,
    apexFormatOnRun: false,
    apexLineNumbers: true,
    apexHistoryLimit: 50,
    apexIntelliSense: true,

    // Bulk Field Creator
    fieldNamingConvention: 'PascalCase',
    fieldIncludeManaged: false,
    fieldDefaultLength: '255',
    fieldDefaultPrecision: '18,0',
    fieldAutoApiName: true,

    // Bulk Data Tools
    csvDelimiter: ',',
    batchSize: '200',
    maxQueryRecords: 10000,
    queryAllRows: false,
    importEmptyAsNull: true,
    exportApiMode: 'auto',

    // Flow Scanner Rules
    flowScannerRules: {},

    // Debug Logs & Trace
    logType: 'USER_DEBUG',
    logRefresh: '0',
    logRetention: 100,

    // Access & Security
    secInactive: false,
    secShowUnassigned: true,

    // API & Limits
    apiVersion: '60.0',
    requestTimeout: 30000,

    // Right-click context menu
    contextMenu: {
        enabled: true,
        tools: ['data-export', 'comet-launcher', 'code-editor'],
        custom: []
    }
};

let currentSettings = { ...defaultSettings };
let saveTimeout = null;

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeSettings(input = {}) {
    const settings = {
        ...defaultSettings,
        ...input,
        headerIcons: { ...defaultSettings.headerIcons, ...(input.headerIcons || {}) },
        contextMenu: { ...defaultSettings.contextMenu, ...(input.contextMenu || {}) }
    };
    settings.editorFontSize = clampNumber(settings.editorFontSize, 10, 28, 14);
    settings.uiFontSize = clampNumber(settings.uiFontSize, 11, 18, 13);
    settings.apexTimeout = clampNumber(settings.apexTimeout, 5, 120, 30);
    settings.apexHistoryLimit = clampNumber(settings.apexHistoryLimit, 10, 200, 50);
    settings.fieldDefaultLength = String(clampNumber(settings.fieldDefaultLength, 1, 255, 255));
    const precisionMatch = String(settings.fieldDefaultPrecision).match(/^(\d{1,2})\s*,\s*(\d{1,2})$/);
    const precision = precisionMatch ? clampNumber(precisionMatch[1], 1, 18, 18) : 18;
    const scale = precisionMatch ? clampNumber(precisionMatch[2], 0, precision, 0) : 0;
    settings.fieldDefaultPrecision = `${precision},${scale}`;
    settings.batchSize = ['25', '50', '200', '2000'].includes(String(settings.batchSize)) ? String(settings.batchSize) : '200';
    settings.maxQueryRecords = clampNumber(settings.maxQueryRecords, 100, 50000, 10000);
    settings.logRetention = clampNumber(settings.logRetention, 20, 500, 100);
    settings.requestTimeout = clampNumber(settings.requestTimeout, 5000, 120000, 30000);
    settings.csvDelimiter = [',', ';', '\t', '|'].includes(settings.csvDelimiter) ? settings.csvDelimiter : ',';
    settings.exportApiMode = ['auto', 'rest', 'bulk'].includes(settings.exportApiMode) ? settings.exportApiMode : 'auto';
    return settings;
}

function syncToolPreferences(settings) {
    try {
        localStorage.setItem('csvSeparator', settings.csvDelimiter);
        localStorage.setItem('defaultBatchSize', settings.batchSize);
        localStorage.setItem('sfarcDefaultQueryAll', String(settings.queryAllRows));
        localStorage.setItem('sfarcMaxQueryRecords', String(settings.maxQueryRecords));
        localStorage.setItem('sfarcImportEmptyAsNull', String(settings.importEmptyAsNull));
        localStorage.setItem('sfarcExportApiMode', settings.exportApiMode);
        localStorage.setItem('sfarcLogType', settings.logType);
        localStorage.setItem('sfarcLogRefresh', settings.logRefresh);
        localStorage.setItem('sfarcLogRetention', String(settings.logRetention));
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    await initSettings();
    setupNavigation();
    setupSearchFilter();
    setupInputs();
    setupContextMenuInputs();
    setupActionButtons();
    fetchUserInfo();
});

async function initSettings() {
    return new Promise((resolve) => {
        if (window.chrome && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['sfiSettings'], (result) => {
                if (result.sfiSettings) {
                    currentSettings = normalizeSettings(result.sfiSettings);
                } else {
                    try {
                        const localRaw = localStorage.getItem('sfiSettings');
                        if (localRaw) currentSettings = normalizeSettings(JSON.parse(localRaw));
                    } catch(e){}
                }
                currentSettings = normalizeSettings(currentSettings);
                syncToolPreferences(currentSettings);
                populateUI();
                applyTheme(currentSettings.theme);
                resolve();
            });
        } else {
            try {
                const localRaw = localStorage.getItem('sfiSettings');
                if (localRaw) currentSettings = normalizeSettings(JSON.parse(localRaw));
            } catch(e){}
            syncToolPreferences(currentSettings);
            populateUI();
            applyTheme(currentSettings.theme);
            resolve();
        }
    });
}

function populateUI() {
    // Appearance
    setSegmented('appearance', 'theme', currentSettings.theme || 'system');
    setSegmented('shortcuts', 'launcher', currentSettings.launcherMethod || 'both');
    const colorVal = currentSettings.accentColor || '#2196f3';
    setValue('sfarc-accent-color-input', colorVal === 'org' ? '#2196f3' : colorVal);
    const swatches = document.querySelectorAll('.mac-swatch-btn');
    swatches.forEach(s => {
        if (String(s.dataset.color).toLowerCase() === String(colorVal).toLowerCase()) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
    setValue('sfarc-editor-font', currentSettings.editorFont || 'Fira Code');
    setSlider('sfarc-editor-fontsize', 'sfarc-editor-fontsize-val', currentSettings.editorFontSize || 14, 'px');
    setSlider('sfarc-ui-fontsize', 'sfarc-ui-fontsize-val', currentSettings.uiFontSize || 13, 'px');
    setCheckbox('sfarc-compact-mode', currentSettings.compactMode);
    setCheckbox('sfarc-performance-mode', currentSettings.performanceMode);
    setCheckbox('sfarc-auto-performance', currentSettings.autoPerformanceMode !== false);
    setCheckbox('sfarc-lazy-load', currentSettings.lazyLoad !== false);

    const headerIcons = { ...defaultSettings.headerIcons, ...(currentSettings.headerIcons || {}) };
    setCheckbox('sfarc-header-session-copy', headerIcons.sessionCopy);
    setCheckbox('sfarc-header-field-api', headerIcons.fieldApi);
    setCheckbox('sfarc-header-lwc-viewer', headerIcons.lwcViewer);
    setCheckbox('sfarc-header-flow-viewer', headerIcons.flowViewer);

    // Anonymous Apex
    setValue('sfarc-apex-timeout', currentSettings.apexTimeout || 30);
    setCheckbox('sfarc-apex-format-run', currentSettings.apexFormatOnRun);
    setCheckbox('sfarc-apex-linenumbers', currentSettings.apexLineNumbers !== false);
    setSlider('sfarc-apex-history-limit', 'sfarc-apex-history-val', currentSettings.apexHistoryLimit || 50, '');
    setCheckbox('sfarc-apex-intellisense', currentSettings.apexIntelliSense !== false);

    // Bulk Field Creator
    setValue('sfarc-field-naming-convention', currentSettings.fieldNamingConvention || 'PascalCase');
    setCheckbox('sfarc-field-include-managed', currentSettings.fieldIncludeManaged);
    setValue('sfarc-field-default-length', currentSettings.fieldDefaultLength || '255');
    setValue('sfarc-field-default-precision', currentSettings.fieldDefaultPrecision || '18,0');
    setCheckbox('sfarc-field-auto-apiname', currentSettings.fieldAutoApiName !== false);

    // Bulk Data Tools
    setValue('sfarc-csv-delimiter', currentSettings.csvDelimiter || ',');
    setValue('sfarc-batch-size', currentSettings.batchSize || '200');
    setValue('sfarc-max-records', currentSettings.maxQueryRecords || 10000);
    setCheckbox('sfarc-query-all-rows', currentSettings.queryAllRows);
    setCheckbox('sfarc-import-empty-null', currentSettings.importEmptyAsNull !== false);
    setValue('sfarc-export-api-mode', currentSettings.exportApiMode || 'auto');

    // Debug Logs & Trace
    setValue('sfarc-log-type', currentSettings.logType || 'USER_DEBUG');
    setValue('sfarc-log-refresh', currentSettings.logRefresh || '0');
    setSlider('sfarc-log-retention', 'sfarc-log-retention-val', currentSettings.logRetention || 100, '');

    // Access & Security
    setCheckbox('sfarc-sec-inactive', currentSettings.secInactive);
    setCheckbox('sfarc-sec-show-unassigned', currentSettings.secShowUnassigned !== false);

    // API & Limits
    setValue('sfarc-api-version', currentSettings.apiVersion || '60.0');
    setValue('sfarc-request-timeout', currentSettings.requestTimeout || 30000);

    // Right-click context menu
    if (!currentSettings.contextMenu) currentSettings.contextMenu = { ...defaultSettings.contextMenu };
    setCheckbox('sfarc-cm-enabled', currentSettings.contextMenu.enabled !== false);
    renderContextMenuTools();
    renderContextMenuCustom();

    // Flow Scanner Rules
    renderFlowScannerRules();

    if (window.chrome && chrome.runtime && chrome.runtime.id) {
        const extIdEl = document.getElementById('sfarc-extension-id');
        if (extIdEl) extIdEl.textContent = chrome.runtime.id;
    }

    if (window.chrome && chrome.runtime && chrome.runtime.getManifest) {
        const versionEl = document.getElementById('sfarc-extension-version');
        if (versionEl) versionEl.textContent = 'v' + (chrome.runtime.getManifest().version || '?');
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.mac-nav-item');
    const sections = document.querySelectorAll('.mac-settings-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });
}

function setupSearchFilter() {
    const searchInput = document.getElementById('sfarc-settings-search');
    if (!searchInput) return;

    const navItems = document.querySelectorAll('.mac-nav-item');
    const sections = document.querySelectorAll('.mac-settings-section');

    const clearFilter = () => {
        navItems.forEach(n => n.style.display = 'flex');
        sections.forEach(s => {
            s.querySelectorAll('.mac-setting-row').forEach(r => r.style.display = 'flex');
        });
        const empty = document.getElementById('sfarc-search-empty');
        if (empty) empty.style.display = 'none';
    };

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        clearFilter();

        if (!query) return;

        let matchedSectionId = null;
        navItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const targetId = item.dataset.target;
            const section = document.getElementById(targetId);
            const sectionText = section ? section.textContent.toLowerCase() : '';

            if (text.includes(query) || sectionText.includes(query)) {
                item.style.display = 'flex';
                if (!matchedSectionId) matchedSectionId = targetId;
            } else {
                item.style.display = 'none';
            }
        });

        // macOS-style: auto-activate the first matching section and filter its rows
        if (matchedSectionId) {
            const matched = document.getElementById(matchedSectionId);
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            navItems.forEach(n => {
                if (n.dataset.target === matchedSectionId) n.classList.add('active');
            });
            if (matched) matched.classList.add('active');

            if (matched) {
                matched.querySelectorAll('.mac-setting-row').forEach(r => {
                    const rowText = r.textContent.toLowerCase();
                    r.style.display = rowText.includes(query) ? 'flex' : 'none';
                });
            }
        } else {
            // No match: show a clear empty state by hiding all sections
            sections.forEach(s => s.classList.remove('active'));
            const allHidden = document.getElementById('sfarc-search-empty');
            if (allHidden) allHidden.style.display = 'block';
        }
    });
}

function setupInputs() {
    // Shortcuts: Comet Launcher Method Segmented
    const launcherBtns = document.querySelectorAll('#launcher-method-seg .mac-segment-btn');
    launcherBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            launcherBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSettings.launcherMethod = btn.dataset.launcher;
            autoSave();
        });
    });

    // Appearance Theme Segmented
    const themeBtns = document.querySelectorAll('#appearance .mac-segment-btn');
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            currentSettings.theme = theme;
            applyTheme(theme);
            autoSave();
        });
    });

    // Appearance Accent / Asset Color Picker & Swatches
    const swatchBtns = document.querySelectorAll('.mac-swatch-btn');
    const colorPickerInput = document.getElementById('sfarc-accent-color-input');
    const applyAccent = (color) => {
        currentSettings.accentColor = color;
        if (colorPickerInput) {
            // The <input type=color> only shows hex — 'org' mode keeps its last hex value.
            colorPickerInput.value = (color === 'org') ? '#2196f3' : color;
        }
        swatchBtns.forEach(s => {
            if (String(s.dataset.color).toLowerCase() === String(color).toLowerCase()) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
        if (window.applyAccentColor) window.applyAccentColor(color);
        autoSave();
    };

    swatchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            applyAccent(btn.dataset.color);
        });
    });

    if (colorPickerInput) {
        colorPickerInput.addEventListener('input', (e) => {
            applyAccent(e.target.value);
        });
    }

    bindValue('sfarc-editor-font', 'editorFont');
    bindSlider('sfarc-editor-fontsize', 'sfarc-editor-fontsize-val', 'editorFontSize', 'px');
    bindSlider('sfarc-ui-fontsize', 'sfarc-ui-fontsize-val', 'uiFontSize', 'px');
    bindCheckbox('sfarc-compact-mode', 'compactMode');
    bindCheckbox('sfarc-performance-mode', 'performanceMode');
    bindCheckbox('sfarc-auto-performance', 'autoPerformanceMode');
    bindCheckbox('sfarc-lazy-load', 'lazyLoad');

    bindHeaderIconToggle('sfarc-header-session-copy', 'sessionCopy');
    bindHeaderIconToggle('sfarc-header-field-api', 'fieldApi');
    bindHeaderIconToggle('sfarc-header-lwc-viewer', 'lwcViewer');
    bindHeaderIconToggle('sfarc-header-flow-viewer', 'flowViewer');

    // Anonymous Apex
    bindValue('sfarc-apex-timeout', 'apexTimeout', true);
    bindCheckbox('sfarc-apex-format-run', 'apexFormatOnRun');
    bindCheckbox('sfarc-apex-linenumbers', 'apexLineNumbers');
    bindSlider('sfarc-apex-history-limit', 'sfarc-apex-history-val', 'apexHistoryLimit', '');
    bindCheckbox('sfarc-apex-intellisense', 'apexIntelliSense');

    // Bulk Field Creator
    bindValue('sfarc-field-naming-convention', 'fieldNamingConvention');
    bindCheckbox('sfarc-field-include-managed', 'fieldIncludeManaged');
    bindValue('sfarc-field-default-length', 'fieldDefaultLength');
    bindValue('sfarc-field-default-precision', 'fieldDefaultPrecision');
    bindCheckbox('sfarc-field-auto-apiname', 'fieldAutoApiName');

    // Bulk Data Tools
    bindValue('sfarc-csv-delimiter', 'csvDelimiter');
    bindValue('sfarc-batch-size', 'batchSize');
    bindValue('sfarc-max-records', 'maxQueryRecords', true);
    bindCheckbox('sfarc-query-all-rows', 'queryAllRows');
    bindCheckbox('sfarc-import-empty-null', 'importEmptyAsNull');
    bindValue('sfarc-export-api-mode', 'exportApiMode');

    // Debug Logs & Trace
    bindValue('sfarc-log-type', 'logType');
    bindValue('sfarc-log-refresh', 'logRefresh');
    bindSlider('sfarc-log-retention', 'sfarc-log-retention-val', 'logRetention', '');

    // Access & Security
    bindCheckbox('sfarc-sec-inactive', 'secInactive');
    bindCheckbox('sfarc-sec-show-unassigned', 'secShowUnassigned');

    // API & Limits
    bindValue('sfarc-api-version', 'apiVersion');
    bindValue('sfarc-request-timeout', 'requestTimeout', true);
}

// -------------------------------------------------------------
// Right-click context menu settings
// -------------------------------------------------------------
const CONTEXT_MENU_TOOLS = [
    // Font Awesome icons chosen to match each tool's purpose exactly
    // (the native right-click menu itself can only show text glyphs, but this
    // checklist — a real DOM page — uses proper FA icons).
    { id: 'data-export',      label: 'Data Export',            desc: 'Run SOQL queries & export records', icon: 'fa-download' },
    { id: 'comet-launcher',   label: 'Comet Launcher',         desc: 'Open the Comet panel on this org', icon: 'fa-rocket' },
    { id: 'code-editor',      label: 'Code Editor',            desc: 'Open the Apex code editor', icon: 'fa-code' },
    { id: 'org-limits',       label: 'Org Limits',             desc: 'View API limits & usage', icon: 'fa-gauge' },
    { id: 'metadata-exporter',label: 'Metadata Exporter',      desc: 'Retrieve & export metadata', icon: 'fa-cube' },
    { id: 'anonymous-apex',   label: 'Execute Anonymous Apex', desc: 'Run Apex snippets', icon: 'fa-bolt' },
    { id: 'log-viewer',       label: 'Debug Logs',             desc: 'Browse trace flags & logs', icon: 'fa-bug' },
    { id: 'event-monitor',    label: 'Event Monitor',          desc: 'Streaming events, CDC, replays', icon: 'fa-tower-broadcast' },
    { id: 'code-coverage',    label: 'Code Coverage',          desc: 'Apex test coverage analysis', icon: 'fa-flask-vial' },
    { id: 'rest-explorer',    label: 'REST Explorer',          desc: 'Test REST endpoints', icon: 'fa-paper-plane' },
    { id: 'graphql-explorer', label: 'GraphQL Explorer',       desc: 'Run GraphQL queries', icon: 'fa-diagram-project' },
    { id: 'record-clone',     label: 'Record Clone',           desc: 'Clone records between orgs', icon: 'fa-copy' },
    { id: 'bulk-permission-wizard', label: 'Bulk Permission Wizard', desc: 'Assign/revoke permissions', icon: 'fa-user-shield' },
    { id: 'bulk-field-builder', label: 'Bulk Field Builder',   desc: 'Create fields in bulk', icon: 'fa-table-columns' },
    { id: 'data-builder',     label: 'Data Builder',           desc: 'Build & map data records', icon: 'fa-database' },
    { id: 'data-import',      label: 'Data Import',            desc: 'Import records from CSV', icon: 'fa-file-import' },
    { id: 'diff-checker',     label: 'Diff Checker',           desc: 'Compare files & metadata', icon: 'fa-code-compare' },
    { id: 'api-statistics',   label: 'API Statistics',         desc: 'Monitor REST API usage', icon: 'fa-chart-line' },
    { id: 'automation-cascade', label: 'Automation Cascade',   desc: 'Trace automation triggers', icon: 'fa-sitemap' }
];

function getContextMenuCfg() {
    if (!currentSettings.contextMenu) currentSettings.contextMenu = { ...defaultSettings.contextMenu };
    if (!Array.isArray(currentSettings.contextMenu.tools)) currentSettings.contextMenu.tools = [...defaultSettings.contextMenu.tools];
    if (!Array.isArray(currentSettings.contextMenu.custom)) currentSettings.contextMenu.custom = [];
    return currentSettings.contextMenu;
}

function renderContextMenuTools() {
    const list = document.getElementById('sfarc-cm-tools');
    if (!list) return;
    const cfg = getContextMenuCfg();
    list.innerHTML = '';
    CONTEXT_MENU_TOOLS.forEach(tool => {
        const row = document.createElement('label');
        row.className = 'mac-check-row';
        row.innerHTML = `
            <input type="checkbox" data-tool="${tool.id}" ${cfg.tools.includes(tool.id) ? 'checked' : ''}>
            <span class="mac-check-icon"><i class="fa-solid ${tool.icon}"></i></span>
            <span class="mac-check-info">
                <span class="mac-check-label">${tool.label}</span>
                <span class="mac-check-desc">${tool.desc}</span>
            </span>
        `;
        const cb = row.querySelector('input');
        cb.addEventListener('change', () => {
            const tools = getContextMenuCfg().tools;
            const idx = tools.indexOf(tool.id);
            if (cb.checked && idx === -1) tools.push(tool.id);
            if (!cb.checked && idx !== -1) tools.splice(idx, 1);
            autoSave();
        });
        list.appendChild(row);
    });
}

function renderContextMenuCustom() {
    const list = document.getElementById('sfarc-cm-custom-list');
    if (!list) return;
    const cfg = getContextMenuCfg();
    list.innerHTML = '';
    if (!cfg.custom.length) {
        list.innerHTML = '<div class="mac-cm-empty">No custom entries yet. Add one below — it will appear in the right-click menu.</div>';
        return;
    }
    cfg.custom.forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'mac-cm-item';
        row.innerHTML = `
            <span class="mac-cm-item-icon"><i class="fa-solid fa-link"></i></span>
            <span class="mac-cm-item-info">
                <span class="mac-cm-item-name">${escapeHtml(entry.name || 'Untitled')}</span>
                <span class="mac-cm-item-target">${escapeHtml(entry.url || '')}</span>
            </span>
            <button type="button" class="mac-cm-item-del" title="Remove entry" data-i="${i}"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('.mac-cm-item-del').addEventListener('click', () => {
            getContextMenuCfg().custom.splice(i, 1);
            renderContextMenuCustom();
            autoSave();
        });
        list.appendChild(row);
    });
}

function setupContextMenuInputs() {
    const enabled = document.getElementById('sfarc-cm-enabled');
    if (enabled) {
        enabled.addEventListener('change', (e) => {
            getContextMenuCfg().enabled = e.target.checked;
            autoSave();
        });
    }
    const addBtn = document.getElementById('sfarc-cm-custom-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const nameEl = document.getElementById('sfarc-cm-custom-name');
            const urlEl = document.getElementById('sfarc-cm-custom-url');
            const name = (nameEl ? nameEl.value : '').trim();
            const url = (urlEl ? urlEl.value : '').trim();
            if (!name || !url) return;
            getContextMenuCfg().custom.push({ name, url });
            if (nameEl) nameEl.value = '';
            if (urlEl) urlEl.value = '';
            renderContextMenuCustom();
            autoSave();
        });
    }
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function bindCheckbox(elementId, settingKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('change', (e) => {
        currentSettings[settingKey] = e.target.checked;
        autoSave();
    });
}

function bindValue(elementId, settingKey, isNumber = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const evt = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(evt, (e) => {
        const val = e.target.value;
        currentSettings[settingKey] = isNumber ? Number(val) : val;
        autoSave();
    });
}

function updateSliderPct(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    slider.style.setProperty('--slider-pct', pct + '%');
}

function bindSlider(elementId, valId, settingKey, unit = '') {
    const slider = document.getElementById(elementId);
    const valSpan = document.getElementById(valId);
    if (!slider) return;

    slider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (valSpan) valSpan.textContent = `${val}${unit}`;
        updateSliderPct(e.target);
        currentSettings[settingKey] = Number(val);
        autoSave();
    });
}

function bindHeaderIconToggle(elementId, iconKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('change', (e) => {
        if (!currentSettings.headerIcons) currentSettings.headerIcons = { ...defaultSettings.headerIcons };
        currentSettings.headerIcons[iconKey] = e.target.checked;
        autoSave();
    });
}

function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        currentSettings = normalizeSettings(currentSettings);
        syncToolPreferences(currentSettings);
        if (window.chrome && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ sfiSettings: currentSettings }, () => {
                showToast('Settings saved');
            });
        }
        try {
            localStorage.setItem('sfiSettings', JSON.stringify(currentSettings));
            showToast('Settings saved');
        } catch(e){}
    }, 250);
}

function showToast(msg) {
    const toast = document.getElementById('sfarc-toast');
    const msgEl = document.getElementById('sfarc-toast-msg');
    if (!toast) return;
    if (msgEl) msgEl.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function setCheckbox(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function setSlider(sliderId, valId, val, unit = '') {
    const slider = document.getElementById(sliderId);
    const valSpan = document.getElementById(valId);
    if (slider) {
        slider.value = val;
        updateSliderPct(slider);
    }
    if (valSpan) valSpan.textContent = `${val}${unit}`;
}

function setSegmented(sectionId, attr, val) {
    const btns = document.querySelectorAll(`#${sectionId} .mac-segment-btn`);
    btns.forEach(b => {
        if (b.dataset[attr] === val) b.classList.add('active');
        else b.classList.remove('active');
    });
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('sfarc-dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        document.body.classList.remove('sfarc-dark-theme');
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            document.body.classList.add('sfarc-dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.body.classList.remove('sfarc-dark-theme');
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }
}

function setupActionButtons() {
    const resetBtn = document.getElementById('sfarc-reset-defaults');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (await toast.confirm('Are you sure you want to reset all settings to default values?', {danger: true})) {
                currentSettings = { ...defaultSettings };
                populateUI();
                applyTheme('system');
                autoSave();
                showToast('All settings reset to defaults');
            }
        });
    }

    const clearCacheBtn = document.getElementById('sfarc-clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            try {
                localStorage.removeItem('sfarc_org_schema');
                localStorage.removeItem('sfarc_bulk_field_state');
                localStorage.removeItem('sfarc_recent_commands');
                showToast('Extension local cache cleared');
            } catch(e){}
        });
    }

    const updatesBtn = document.getElementById('sfarc-check-updates-btn');
    if (updatesBtn) {
        updatesBtn.addEventListener('click', () => checkForUpdates(updatesBtn));
    }
}

async function checkForUpdates(updatesBtn) {
    const statusEl = document.getElementById('sfarc-update-status');
    const installed = (window.chrome && chrome.runtime && chrome.runtime.getManifest)
        ? (chrome.runtime.getManifest().version || '0')
        : '0';
    const setStatus = (msg, color) => {
        if (!statusEl) return;
        if (msg) {
            statusEl.style.display = '';
            statusEl.textContent = msg;
            statusEl.style.color = color || 'inherit';
        } else {
            statusEl.style.display = 'none';
            statusEl.textContent = '';
        }
    };
    const setBtn = (label, disabled) => {
        if (!updatesBtn) return;
        updatesBtn.disabled = disabled;
        updatesBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> ' + label;
    };

    setStatus('');
    setStatus('Chrome updates Salesforce Comet automatically. Installed version: ' + installed + '.', '#10b981');
    setBtn('Managed by Chrome', true);
    showToast('Chrome manages extension updates automatically');
}

async function fetchUserInfo() {
    const nameEl = document.getElementById('sfarc-user-name');
    const subEl = document.getElementById('sfarc-user-subtitle');
    if (!nameEl) return;

    function applyUserData(user) {
        if (!user) return;
        let displayName = user.name || user.userName;
        if (!displayName || displayName === 'Salesforce Comet' || displayName === 'Salesforce Developer') {
            if (user.username) {
                const parts = user.username.split('@')[0].split('.');
                displayName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            } else {
                displayName = 'Salesforce Developer';
            }
        }
        nameEl.textContent = displayName;
        if (user.username || user.orgId) {
            subEl.textContent = user.username ? user.username : `Salesforce Org: ${user.orgId}`;
        }
        const avatarEl = document.querySelector('.mac-avatar');
        if (avatarEl && user.photoUrl) {
            const avatarImg = document.createElement('img');
            avatarImg.src = user.photoUrl;
            avatarImg.alt = 'User profile';
            avatarImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            avatarImg.addEventListener('error', () => {
                avatarEl.replaceChildren();
                const fallback = document.createElement('i');
                fallback.className = 'fa-solid fa-user-gear';
                avatarEl.appendChild(fallback);
            }, { once: true });
            avatarEl.replaceChildren(avatarImg);

            if (!user.photoUrl.startsWith('data:image')) {
                fetch(user.photoUrl)
                    .then(r => r.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            if (reader.result && reader.result.startsWith('data:image')) {
                                avatarEl.innerHTML = `<img src="${window.escapeHtml(reader.result)}" alt="DP" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                                user.photoUrl = reader.result;
                                if (window.chrome && chrome.storage && chrome.storage.local) {
                                    chrome.storage.local.set({ sfarcLoggedInUser: user });
                                }
                            }
                        };
                        reader.readAsDataURL(blob);
                    })
                    .catch(() => {});
            }
        }
    }

    if (window.sfApi && window.sfApi.userInfo && window.sfApi.userInfo.name) {
        applyUserData(window.sfApi.userInfo);
        return;
    }

    if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfarcLoggedInUser'], (res) => {
            if (res && res.sfarcLoggedInUser && res.sfarcLoggedInUser.name) {
                applyUserData(res.sfarcLoggedInUser);
            } else {
                fallbackFromLocalStorage();
            }
        });
    } else {
        fallbackFromLocalStorage();
    }

    function fallbackFromLocalStorage() {
        try {
            const raw = localStorage.getItem('sfarc_logged_in_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.name) applyUserData(parsed);
            }
        } catch(e){}
    }
}

// Flow Scanner Rules Catalog & Renderer
const defaultFlowScannerRules = [
    { id: "action-in-loop", name: "Action Call In A Loop", desc: "Repeatedly invoking Apex actions inside a loop is a performance bottleneck.", severity: "warning", enabled: true },
    { id: "dml-in-loop", name: "DML Statement In A Loop", desc: "Executing DML operations (insert, update, delete) inside a loop is a high-risk anti-pattern.", severity: "error", enabled: true },
    { id: "duplicate-dml", name: "Duplicate DML Operation", desc: "When a Flow performs database operations on the same record multiple times.", severity: "warning", enabled: true },
    { id: "cyclomatic-complexity", name: "Excessive Cyclomatic Complexity", desc: "High complexity makes Flow maintenance and debugging difficult.", severity: "info", enabled: true, hasThreshold: true, threshold: 25 },
    { id: "flow-naming", name: "Flow Naming Convention", desc: "Using clear and consistent Flow naming conventions (Domain_Description).", severity: "error", enabled: true },
    { id: "get-record-all-fields", name: "Get Record All Fields", desc: "Avoid using Get Records to retrieve all fields unnecessarily.", severity: "warning", enabled: true },
    { id: "hardcoded-id", name: "Hardcoded Salesforce Id", desc: "Avoid hard-coding record IDs, as they are unique to a specific org.", severity: "error", enabled: true },
    { id: "hardcoded-url", name: "Hardcoded Salesforce Url", desc: "Avoid hard-coding URLs, as they may change across environments.", severity: "error", enabled: true },
    { id: "inactive-flow", name: "Inactive Flow", desc: "Inactive Flows should be deleted or archived to reduce clutter.", severity: "warning", enabled: true },
    { id: "hardcoded-secret", name: "Hardcoded Secret / Token", desc: "Hardcoding sensitive passwords or API tokens inside Flow elements.", severity: "error", enabled: true },
    { id: "soql-in-loop", name: "SOQL Query In Loop", desc: "Executing Get Records queries inside a loop risks hitting SOQL governor limits.", severity: "error", enabled: true },
    { id: "unsafe-context", name: "Unsafe Running Context", desc: "Running Flows in System Mode Without Sharing bypasses object security.", severity: "warning", enabled: true },
    { id: "missing-fault-path", name: "Missing Fault Path", desc: "DML and Apex action elements must specify a fault execution path.", severity: "warning", enabled: true },
    { id: "missing-null-handler", name: "Missing Null Handler", desc: "Always verify that Get Records returns a non-null object before referencing.", severity: "error", enabled: true },
    { id: "api-version", name: "API Version Outdated", desc: "Ensure Flow uses a supported and up-to-date Salesforce API version.", severity: "warning", enabled: true },
    { id: "missing-filter-trigger", name: "Missing Filter Record Trigger", desc: "Record-triggered flows should define entry criteria filters.", severity: "warning", enabled: true },
    { id: "same-record-updates", name: "Same Record Field Updates", desc: "Use Before-Save triggers instead of After-Save for same record updates.", severity: "warning", enabled: true },
    { id: "cognitive-complexity", name: "Excessive Cognitive Complexity", desc: "Measures structural flow complexity and nested decision depth.", severity: "info", enabled: true, hasThreshold: true, threshold: 15 },
    { id: "unused-variable", name: "Unused Variable", desc: "Unused Flow variables or resources add unnecessary memory overhead.", severity: "note", enabled: true },
    { id: "flow-description", name: "Missing Flow Description", desc: "Flow descriptions are essential for documentation and maintainability.", severity: "note", enabled: true }
];

function renderFlowScannerRules() {
    const container = document.getElementById('sfarc-flow-rules-list');
    if (!container) return;

    if (!currentSettings.flowScannerRules) currentSettings.flowScannerRules = {};

    let html = '';
    defaultFlowScannerRules.forEach(rule => {
        const stored = currentSettings.flowScannerRules[rule.id] || {};
        const enabled = stored.enabled !== undefined ? stored.enabled : rule.enabled;
        const severity = stored.severity || rule.severity;
        const threshold = stored.threshold !== undefined ? stored.threshold : rule.threshold;

        const sevClass = `sev-${severity.toLowerCase()}`;

        html += `
            <div class="mac-setting-row ${enabled ? '' : 'disabled-rule'}" id="flow-rule-row-${rule.id}">
                <div class="mac-setting-info">
                    <label for="flow-rule-enable-${rule.id}">${rule.name}</label>
                    <span class="desc">${rule.desc}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    ${rule.hasThreshold ? `<input type="number" id="flow-rule-thresh-${rule.id}" value="${threshold}" min="1" max="100" class="mac-input" style="width: 65px; font-weight: 500;">` : ''}
                    <select id="flow-rule-sev-${rule.id}" class="sfarc-sev-select ${sevClass}" data-rule-id="${rule.id}">
                        <option value="error" ${severity.toLowerCase() === 'error' ? 'selected' : ''}>Error</option>
                        <option value="warning" ${severity.toLowerCase() === 'warning' ? 'selected' : ''}>Warning</option>
                        <option value="info" ${severity.toLowerCase() === 'info' ? 'selected' : ''}>Info</option>
                        <option value="note" ${severity.toLowerCase() === 'note' ? 'selected' : ''}>Note</option>
                    </select>
                    <div class="mac-toggle-switch">
                        <input type="checkbox" id="flow-rule-enable-${rule.id}" data-rule-id="${rule.id}" ${enabled ? 'checked' : ''}>
                        <label for="flow-rule-enable-${rule.id}"></label>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Attach listeners
    defaultFlowScannerRules.forEach(rule => {
        const toggle = document.getElementById(`flow-rule-enable-${rule.id}`);
        const sevSelect = document.getElementById(`flow-rule-sev-${rule.id}`);
        const threshInput = document.getElementById(`flow-rule-thresh-${rule.id}`);
        const row = document.getElementById(`flow-rule-row-${rule.id}`);

        if (!currentSettings.flowScannerRules[rule.id]) {
            currentSettings.flowScannerRules[rule.id] = { enabled: rule.enabled, severity: rule.severity, threshold: rule.threshold };
        }

        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                currentSettings.flowScannerRules[rule.id].enabled = isChecked;
                if (row) {
                    if (isChecked) row.classList.remove('disabled-rule');
                    else row.classList.add('disabled-rule');
                }
                autoSave();
            });
        }

        if (sevSelect) {
            sevSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                currentSettings.flowScannerRules[rule.id].severity = val;
                sevSelect.className = `sfarc-sev-select sev-${val.toLowerCase()}`;
                autoSave();
            });
        }

        if (threshInput) {
            threshInput.addEventListener('input', (e) => {
                currentSettings.flowScannerRules[rule.id].threshold = Number(e.target.value);
                autoSave();
            });
        }
    });
}
