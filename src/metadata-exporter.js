// Initialize API
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const instanceUrl = urlParams.get('instanceUrl');
const pageHost = urlParams.get('host') || urlParams.get('sfHost') || '';

// Embedded in sfir-shell.html: the shell's bar owns a Refresh button and
// forwards clicks here, re-running the metadata-types load (like the page's
// own "Fetching Metadata Types..." first paint).
window.addEventListener('message', (e) => {
    if (e.origin && e.origin !== window.location.origin) return;
    const msg = e.data;
    if (!msg || typeof msg !== 'object' || msg.source !== 'sfir-shell' || msg.type !== 'sfirUtilsAction') return;
    if (msg.action === 'refresh') loadMetadataTypes();
});

// Per-org cache for the metadata-types list (describeMetadata): switching back
// to this tab renders the list instantly from the last fetch instead of
// re-fetching (and flashing "Fetching Metadata Types...") on every page load.
const TYPES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const typesCacheKey = 'sfir_org_metadata_types_' + (pageHost || 'unknown');

function getCachedTypes() {
    try {
        const raw = localStorage.getItem(typesCacheKey);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !cached.data || Date.now() - cached.ts > TYPES_CACHE_TTL) return null;
        return cached.data;
    } catch (e) {
        return null;
    }
}

function cacheTypes(types) {
    try {
        localStorage.setItem(typesCacheKey, JSON.stringify({ ts: Date.now(), data: types }));
    } catch (e) { /* storage full / unavailable — ignore */ }
}

let metadataTypes = [];
let currentType = null;
let typeMembers = {}; // Cache: { TypeName: [members] }
let selectedTypes = new Set(); // Types that have at least one member selected (or all)
let selectedMembers = {}; // { TypeName: Set(MemberNames) }
let collapsedSelectionGroups = new Set();

// Null-safe DOM helpers — drawer/panel elements may not exist yet while the
// page is initializing; an unguarded getElementById(...).innerHTML was the
// source of repeated "Cannot set properties of null" errors.
function mdEl(id) { return document.getElementById(id); }
function mdSetHtml(id, html) { const el = mdEl(id); if (el) el.innerHTML = html; }
function mdSetText(id, text) { const el = mdEl(id); if (el) el.textContent = text; }
function mdAddClass(id, cls) { const el = mdEl(id); if (el) el.classList.add(cls); }
function mdRemoveClass(id, cls) { const el = mdEl(id); if (el) el.classList.remove(cls); }

function setupHeader() {
    // Check if embedded in shell - if so, hide the page's own header
    const isEmbedded = document.documentElement.classList.contains('sfir-embedded') || 
                       window.location.search.includes('sfirEmbed=1') ||
                       (window.parent !== window);
    
    if (isEmbedded) {
        // Hide the page's header when embedded in shell
        const headerContainer = document.querySelector('.slds-builder-header_container');
        if (headerContainer) {
            headerContainer.style.display = 'none';
        }
        // Remove top margin from app-container
        const appEl = document.querySelector('.app-container');
        if (appEl) {
            appEl.style.marginTop = '0';
        }
        return; // Skip header setup when embedded
    }
    
    // The shared top header is position: fixed and auto-sizes (it can wrap to
    // more than one row on narrow windows). Push the page content below it with
    // a 5px gap using the REAL measured height instead of a hardcoded 48px.
    const syncHeaderOffset = () => {
        const headerEl = document.querySelector('.slds-builder-header_container');
        const appEl = document.querySelector('.app-container');
        if (headerEl && appEl) {
            const h = headerEl.getBoundingClientRect().height || 48;
            appEl.style.marginTop = (h + 5) + 'px';
        }
    };
    syncHeaderOffset();
    // Re-measure once the layout/fonts settle (header can reflow to a taller
    // height while web fonts load), then on every resize.
    requestAnimationFrame(() => requestAnimationFrame(syncHeaderOffset));
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncHeaderOffset).catch(() => {});
    }
    window.addEventListener('resize', syncHeaderOffset);

    const host = urlParams.get('host') || urlParams.get('sfHost') || '';
    const hostArg = host ? 'host=' + encodeURIComponent(host) : '';
    const navOrg = document.getElementById('sfarc-nav-org');
    if (navOrg) navOrg.textContent = host;
    const homeLink = document.getElementById('sfarc-home-link');
    if (homeLink && host) homeLink.href = 'https://' + host;

    const logo = document.getElementById('sfarc-comet-logo');
    if (logo) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            logo.src = chrome.runtime.getURL('icons/icon-48.png');
        } else {
            logo.src = '../icons/icon-48.png';
        }
    }

    const pages = {
        export: 'data-export.html?' + hostArg,
        import: 'data-import.html?' + hostArg,
        limits: 'org-limits.html?' + hostArg,
        metadata: 'metadata-exporter.html?' + hostArg
    };

    document.querySelectorAll('.slds-builder-header__item-action').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page && pages[page]) window.location.href = pages[page];
        });
        link.style.cursor = 'pointer';
    });

    if (window.sfUserPermissions) {
        window.sfUserPermissions.applyNavGating();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    setupHeader();
    await init();
});

async function init() {
    try {
        await window.sfApi.init();

        if (sessionId && instanceUrl) {
            window.sfApi.sessionId = sessionId;
            window.sfApi.instanceUrl = instanceUrl;
        }

        if (!window.sfApi.sessionId) {
            mdSetHtml('types-list', '<div class="loading">Waiting for Salesforce session...</div>');
            return;
        }

        setupEventListeners();
        initExplorerSearch();
        initPackageXmlImport(); // Initialize package.xml import for selective loading
        loadMetadataTypes();

    } catch (e) {
        console.error('Init Error', e);
        mdSetHtml('types-list', `<div class="loading">Error: ${window.escapeHtml(e.message)}</div>`);
    }
}

function setupEventListeners() {
    // Type Search
    document.getElementById('type-search').addEventListener('input', (e) => {
        renderTypesList(e.target.value);
    });

    // Member Search
    document.getElementById('member-search').addEventListener('input', () => {
        renderMembersList();
    });

    // Sort Members
    document.getElementById('sort-members').addEventListener('change', () => {
        renderMembersList();
    });

    // Filter User
    document.getElementById('filter-user').addEventListener('input', () => {
        renderMembersList();
    });

    // Date Filter
    const dateStart = document.getElementById('filter-date-start');
    const dateEnd = document.getElementById('filter-date-end');
    const clearDateBtn = document.getElementById('clear-date-filter');
    
    if (dateStart) {
        dateStart.addEventListener('change', () => {
            renderMembersList();
            updateClearDateBtn();
        });
    }
    if (dateEnd) {
        dateEnd.addEventListener('change', () => {
            renderMembersList();
            updateClearDateBtn();
        });
    }
    if (clearDateBtn) {
        clearDateBtn.addEventListener('click', () => {
            if (dateStart) dateStart.value = '';
            if (dateEnd) dateEnd.value = '';
            renderMembersList();
            updateClearDateBtn();
        });
    }
    
    function updateClearDateBtn() {
        const hasDateFilter = (dateStart && dateStart.value) || (dateEnd && dateEnd.value);
        if (clearDateBtn) clearDateBtn.style.display = hasDateFilter ? 'flex' : 'none';
    }

    // Select All Types
    document.getElementById('select-all-types').addEventListener('click', () => {
        const filter = document.getElementById('type-search').value.toLowerCase();
        const visibleTypes = metadataTypes
            .filter(t => t.xmlName.toLowerCase().includes(filter))
            .map(t => t.xmlName);

        visibleTypes.forEach(typeName => {
            selectedTypes.add(typeName);
            if (selectedMembers[typeName] && selectedMembers[typeName].size === 0) {
                delete selectedMembers[typeName];
            }
        });

        renderTypesList(document.getElementById('type-search').value);
        if (currentType) renderMembersList();
        updatePackageXmlButton();
    });

    document.getElementById('clear-all-types').addEventListener('click', () => {
        selectedTypes.clear();
        selectedMembers = {};
        renderTypesList(document.getElementById('type-search').value);
        if (currentType) renderMembersList();
        updatePackageXmlButton();
    });

    function getFilteredMembersInExporter() {
        if (!currentType || !typeMembers[currentType]) return [];
        const nameFilter = (document.getElementById('member-search')?.value || '').toLowerCase();
        const userFilter = (document.getElementById('filter-user')?.value || '').toLowerCase();
        const dateStart = document.getElementById('filter-date-start')?.value;
        const dateEnd = document.getElementById('filter-date-end')?.value;
        
        return typeMembers[currentType].filter(m => {
            const matchesName = m.fullName.toLowerCase().includes(nameFilter);
            const matchesUser = !userFilter || (m.lastModifiedByName && m.lastModifiedByName.toLowerCase().includes(userFilter));
            
            // Date range filter
            let matchesDate = true;
            if (dateStart || dateEnd) {
                const modDate = m.lastModifiedDate ? new Date(m.lastModifiedDate) : null;
                if (modDate) {
                    if (dateStart) {
                        const startDate = new Date(dateStart);
                        startDate.setHours(0, 0, 0, 0);
                        if (modDate < startDate) matchesDate = false;
                    }
                    if (dateEnd) {
                        const endDate = new Date(dateEnd);
                        endDate.setHours(23, 59, 59, 999);
                        if (modDate > endDate) matchesDate = false;
                    }
                } else {
                    matchesDate = false;
                }
            }
            
            return matchesName && matchesUser && matchesDate;
        });
    }

    // Select All Members (Current Type)
    document.getElementById('select-all-members').addEventListener('click', () => {
        if (!currentType) return;
        if (!selectedMembers[currentType]) selectedMembers[currentType] = new Set();

        const visibleMembers = getFilteredMembersInExporter();
        visibleMembers.forEach(m => selectedMembers[currentType].add(m.fullName));

        if (selectedMembers[currentType].size > 0) {
            selectedTypes.add(currentType);
        }
        renderTypesList(document.getElementById('type-search').value); // Update checkmark on type
        renderMembersList();
        updatePackageXmlButton();
    });

    document.getElementById('clear-all-members').addEventListener('click', () => {
        if (!currentType) return;
        const visibleMembers = getFilteredMembersInExporter();
        if (selectedMembers[currentType]) {
            visibleMembers.forEach(m => selectedMembers[currentType].delete(m.fullName));
            if (selectedMembers[currentType].size === 0) {
                delete selectedMembers[currentType];
                selectedTypes.delete(currentType);
            }
        }
        renderTypesList(document.getElementById('type-search').value);
        renderMembersList();
        updatePackageXmlButton();
    });

    // Update Package XML
    document.getElementById('update-pkg-btn').addEventListener('click', openDrawer);
    const nextBtn = document.getElementById('next-action-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const tab = document.querySelector('.nav-tab[data-view="retrieve-viewer-view"]');
            if (tab) tab.click();
            startRetrieveFlow();
        });
    }
    const retrieveBtn = document.getElementById('retrieve-pkg-btn');
    if (retrieveBtn) {
        retrieveBtn.addEventListener('click', startRetrieveFlow);
    }

    // Copy to Clipboard (Header)
    document.getElementById('copy-btn').addEventListener('click', () => copyToClipboard(generatePackageXml(), 'copy-btn'));

    const clearSelBtn = document.getElementById('clear-selection-btn');
    if (clearSelBtn) {
        clearSelBtn.addEventListener('click', () => {
            selectedMembers = {};
            selectedTypes.clear();
            renderTypesList(document.getElementById('type-search').value);
            if (currentType) renderMembersList();
            renderSelectionPane();
        });
    }

    // Drawer Controls
    document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
    document.getElementById('retrieve-pkg-btn').addEventListener('click', startRetrieveFlow);
    
    // Compare target select logic
    const compareSelect = document.getElementById('compare-target-select');
    if (compareSelect) {
        compareSelect.addEventListener('change', async (e) => {
            const val = e.target.value;
            if (val === 'none') {
                comparisonMode = 'none';
                if (isDiffMode) document.getElementById('toggle-diff-btn').click(); // toggle off
            } else if (val === 'local') {
                comparisonMode = 'local';
                await selectLocalProjectFolder();
            } else if (val === 'local_zip' || val.startsWith('pipeline_')) {
                comparisonMode = 'local';
                const selectedOption = e.target.options[e.target.selectedIndex];
                await selectLocalProjectZip(selectedOption ? selectedOption.textContent : 'Pipeline Artifact', val);
            } else if (val.startsWith('org_')) {
                comparisonMode = 'dest_org';
                const parts = val.split('_');
                destinationSessionId = parts[1];
                destinationInstanceUrl = parts.slice(2).join('_');
                await retrieveFromDestinationOrg();
            }
            if (val !== 'none' && !isDiffMode) {
                document.getElementById('toggle-diff-btn').click(); // toggle on
            }
            if (currentSelectedFilePath !== null) showFileContent(currentSelectedFilePath, currentSelectedFileIsLocal);
            
            const syncBtn = document.getElementById('sync-local-btn');
            if (syncBtn && isDiffMode) syncBtn.style.display = (comparisonMode === 'local') ? 'flex' : 'none';
        });
        
        // Populate the dropdown with open Salesforce tabs
        populateCompareTargets();
    }
    document.getElementById('open-org-transfer-btn')?.addEventListener('click', openOrgTransfer);
    document.getElementById('close-org-transfer-btn')?.addEventListener('click', () => { document.getElementById('org-transfer-modal').hidden = true; });
    document.getElementById('org-transfer-modal')?.addEventListener('click', event => {
        if (event.target.id === 'org-transfer-modal') event.currentTarget.hidden = true;
    });
    document.getElementById('org-transfer-filter')?.addEventListener('input', renderOrgTransferList);
    document.getElementById('org-transfer-select-all')?.addEventListener('change', event => {
        orgTransferChanges.forEach(change => { if (change.deployable !== false) change.selected = event.target.checked; });
        orgTransferValidatedSignature = null;
        document.getElementById('org-transfer-deploy-btn').disabled = true;
        renderOrgTransferList();
    });
    document.getElementById('org-transfer-backup-btn')?.addEventListener('click', () => downloadDestinationBackup(selectedTransferFiles()));
    document.getElementById('org-transfer-validate-btn')?.addEventListener('click', validateOrgTransfer);
    document.getElementById('org-transfer-deploy-btn')?.addEventListener('click', deployOrgTransfer);
    const overlayEl = mdEl('drawer-overlay');
    if (overlayEl) overlayEl.addEventListener('click', closeDrawer);

    // Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('sfarc-active'));
            document.querySelectorAll('.view-container').forEach(v => {
                v.classList.remove('sfarc-active');
                v.style.display = 'none';
            });

            tab.classList.add('sfarc-active');
            const viewId = tab.dataset.view;
            const view = document.getElementById(viewId);
            view.classList.add('sfarc-active');
            view.style.display = 'flex';

            if (viewId === 'code-coverage-view' && !coverageLoaded) {
                loadCodeCoverage();
            }
        });
    });

    // Coverage Search
    const covSearch = document.getElementById('coverage-search');
    if (covSearch) {
        covSearch.addEventListener('input', (e) => {
            renderCoverageList(e.target.value);
        });
    }

    const refCovBtn = document.getElementById('refresh-coverage-btn');
    if (refCovBtn) {
        refCovBtn.addEventListener('click', loadCodeCoverage);
    }

    const bugBtn = document.getElementById('report-bugs-btn');
    if (bugBtn) {
        bugBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSc4V3_SP9XdosnLhEq7064nFe1UwgpOhdlYcqu9zvxy63gicg/viewform?usp=publish-editor', '_blank');
        });
    }
}

let coverageData = [];
let coverageLoaded = false;

async function loadCodeCoverage() {
    const refCovBtn = document.getElementById('refresh-coverage-btn');
    let iconEl = null;
    if (refCovBtn) {
        iconEl = refCovBtn.querySelector('.fa-rotate, svg');
        if (iconEl) iconEl.classList.add('fa-spin', 'rotating');
    }
    const tbody = document.getElementById('coverage-list');
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Fetching Code Coverage...</td></tr>';

    try {
        const query = 'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE NumLinesCovered > 0 OR NumLinesUncovered > 0';
        const result = await window.sfApi.query(query, true); // Use Tooling API

        coverageData = (result.records || []).map(r => {
            const covered = r.NumLinesCovered || 0;
            const uncovered = r.NumLinesUncovered || 0;
            const total = covered + uncovered;
            const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
            return {
                name: r.ApexClassOrTrigger.Name,
                percent: percent,
                covered: covered,
                uncovered: uncovered
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        coverageLoaded = true;
        renderCoverageList();
        updateAvgCoverage();

    } catch (e) {
        console.error('Coverage Error', e);
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error: ${window.escapeHtml(e.message)}</td></tr>`;
    } finally {
        if (iconEl) {
            setTimeout(() => {
                iconEl.classList.remove('fa-spin', 'rotating');
            }, 600);
        }
    }
}

function renderCoverageList(filter = '') {
    const tbody = document.getElementById('coverage-list');
    tbody.innerHTML = '';

    const term = filter.toLowerCase();
    const filtered = coverageData.filter(item => item.name.toLowerCase().includes(term));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No classes found</td></tr>';
        return;
    }

    sfarcRenderChunkedList(tbody, filtered, (item) => {
        const tr = document.createElement('tr');

        let colorClass = 'high';
        if (item.percent < 75) colorClass = 'medium';
        if (item.percent < 50) colorClass = 'low';

        tr.innerHTML = `
            <td>${window.escapeHtml(item.name)}</td>
            <td>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${colorClass}" style="width: ${item.percent}%"></div>
                </div>
                ${item.percent}%
            </td>
            <td>${item.covered}</td>
            <td>${item.uncovered}</td>
        `;
        return tr;
    }, { moreTag: 'tr', moreColspan: 4 });
}

function updateAvgCoverage() {
    if (coverageData.length === 0) return;
    const totalPercent = coverageData.reduce((sum, item) => sum + item.percent, 0);
    const avg = Math.round(totalPercent / coverageData.length);
    document.getElementById('avg-coverage').textContent = `${avg}%`;
}

async function loadMetadataTypes() {
    const container = document.getElementById('types-list');
    if (!container) return;
    container.innerHTML = '<div class="loading">Fetching Metadata Types...</div>';

    if (window.sfUserPermissions) {
        const perms = await window.sfUserPermissions.getPermissions();
        if (!perms.canViewSetup) {
            container.innerHTML = `
                <div style="padding: 24px; text-align: center; color: #f4f4f5;">
                    <div style="font-size: 20px; margin-bottom: 8px;">🔒</div>
                    <div style="font-size: 13.5px; font-weight: 500; margin-bottom: 6px;">Setup Access Required</div>
                    <div style="font-size: 11.5px; color: #a1a1aa;">
                        Metadata Exporter requires View Setup or Modify All Data permission.
                    </div>
                </div>`;
            return;
        }
    }

    // Fresh per-org cache → render instantly, no describeMetadata round-trip.
    const cached = getCachedTypes();
    if (cached && cached.length) {
        metadataTypes = cached;
        renderTypesList();
        return;
    }

    try {
        const types = await window.sfApi.describeMetadata();
        metadataTypes = types.sort((a, b) => a.xmlName.localeCompare(b.xmlName));
        cacheTypes(metadataTypes);
        renderTypesList();
    } catch (e) {
        console.error('Load Types Error', e);
        container.innerHTML = `<div class="loading">Error: ${window.escapeHtml(e.message)}</div>`;
    }
}

// Chunked list renderer: renders only `chunk` rows at a time and appends a
// "Show more" row so huge lists (e.g. 18,000 Apex classes) never build the
// whole DOM in one pass — that previously froze/crashed the page.
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

// Metadata type icons - removed per user preference
function getTypeIcon(typeName) {
    return '';
}

// Workflow step updater
function updateWorkflowStep(step) {
    const steps = document.querySelectorAll('.workflow-steps .step');
    steps.forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i + 1 < step) s.classList.add('completed');
        else if (i + 1 === step) s.classList.add('active');
    });
}

// Update member count badge
function updateMemberCount(count) {
    const badge = document.getElementById('member-count-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

// Update selection empty state
function updateSelectionEmptyState() {
    const emptyState = document.getElementById('selection-empty-state');
    const selectionList = document.getElementById('selection-list');
    if (!emptyState || !selectionList) return;
    
    const hasSelection = Object.keys(selectedMembers).some(k => selectedMembers[k] && selectedMembers[k].size > 0);
    emptyState.style.display = hasSelection ? 'none' : 'flex';
}

function renderTypesList(filter = '') {
    const container = document.getElementById('types-list');
    if (!container) return;
    container.innerHTML = '';

    const term = filter.toLowerCase();
    const filtered = metadataTypes.filter(t => t.xmlName.toLowerCase().includes(term));

    // Create table layout
    const table = document.createElement('table');
    table.className = 'types-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';
    
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="border-bottom: 1px solid #27272a;">
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; width: 22px;"></th>
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">TYPE NAME</th>
            <th style="padding: 2px 4px; text-align: right; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; width: 22px;"></th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    filtered.forEach(type => {
        const tr = document.createElement('tr');
        tr.className = currentType === type.xmlName ? 'selected' : '';
        tr.style.cssText = 'border-bottom: 1px solid #1f1f23; transition: background 0.1s; cursor: pointer; line-height: 1.1;';
        tr.onmouseover = () => tr.style.background = 'rgba(255, 255, 255, 0.03)';
        tr.onmouseout = () => tr.style.background = currentType === type.xmlName ? 'rgba(255, 255, 255, 0.05)' : 'transparent';
        tr.onclick = (e) => {
            if (e.target.classList.contains('item-checkbox')) return;
            selectType(type.xmlName);
        };

        const isSelected = selectedTypes.has(type.xmlName);

        tr.innerHTML = `
            <td style="padding: 2px 4px;">
                <input type="checkbox" class="item-checkbox" ${isSelected ? 'checked' : ''}>
            </td>
            <td style="padding: 2px 4px; color: #e4e4e7; font-weight: 400;">${getTypeIcon(type.xmlName)}${window.escapeHtml(type.xmlName)}</td>
            <td style="padding: 2px 4px; text-align: right;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #52525b;"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </td>
        `;

        const checkbox = tr.querySelector('.item-checkbox');
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                selectedTypes.add(type.xmlName);
            } else {
                selectedTypes.delete(type.xmlName);
                if (selectedMembers[type.xmlName]) delete selectedMembers[type.xmlName];
            }
        };

        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

async function selectType(typeName) {
    currentType = typeName;
    document.getElementById('selected-type-name').textContent = typeName;
    renderTypesList(document.getElementById('type-search').value); // Re-render to highlight selected
    
    // Update workflow step
    updateWorkflowStep(2);

    const container = document.getElementById('members-list');

    if (typeMembers[typeName]) {
        updateMemberCount(typeMembers[typeName].length);
        renderMembersList();
    } else {
        container.innerHTML = '<div class="loading">Fetching members...</div>';
        try {
            const members = await window.sfApi.listMetadata(typeName);
            typeMembers[typeName] = members.sort((a, b) => a.fullName.localeCompare(b.fullName));
            updateMemberCount(members.length);
            renderMembersList();
        } catch (e) {
            console.error('Load Members Error', e);
            container.innerHTML = `<div class="loading">Error: ${window.escapeHtml(e.message)}</div>`;
        }
    }
}

function renderMembersList() {
    const container = document.getElementById('members-list');
    const footer = document.getElementById('members-list-footer');
    const showingCount = document.getElementById('showing-count');
    container.innerHTML = '';

    if (!currentType || !typeMembers[currentType]) {
        if (footer) footer.style.display = 'none';
        return;
    }

    const nameFilter = document.getElementById('member-search').value.toLowerCase();
    const userFilter = document.getElementById('filter-user').value.toLowerCase();
    const sortMode = document.getElementById('sort-members').value;
    const dateStart = document.getElementById('filter-date-start')?.value;
    const dateEnd = document.getElementById('filter-date-end')?.value;

    let filtered = typeMembers[currentType].filter(m => {
        const matchesName = m.fullName.toLowerCase().includes(nameFilter);
        const matchesUser = !userFilter || (m.lastModifiedByName && m.lastModifiedByName.toLowerCase().includes(userFilter));
        
        // Date range filter
        let matchesDate = true;
        if (dateStart || dateEnd) {
            const modDate = m.lastModifiedDate ? new Date(m.lastModifiedDate) : null;
            if (modDate) {
                if (dateStart) {
                    const startDate = new Date(dateStart);
                    startDate.setHours(0, 0, 0, 0);
                    if (modDate < startDate) matchesDate = false;
                }
                if (dateEnd) {
                    const endDate = new Date(dateEnd);
                    endDate.setHours(23, 59, 59, 999);
                    if (modDate > endDate) matchesDate = false;
                }
            } else {
                matchesDate = false; // No date = filter out when date filter is active
            }
        }
        
        return matchesName && matchesUser && matchesDate;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortMode === 'name') {
            return a.fullName.localeCompare(b.fullName);
        } else if (sortMode === 'date-desc') {
            return new Date(b.lastModifiedDate) - new Date(a.lastModifiedDate);
        } else if (sortMode === 'date-asc') {
            return new Date(a.lastModifiedDate) - new Date(b.lastModifiedDate);
        } else if (sortMode === 'user') {
            return (a.lastModifiedByName || '').localeCompare(b.lastModifiedByName || '');
        }
        return 0;
    });

    const selectedSet = selectedMembers[currentType] || new Set();

    // Create table layout
    const table = document.createElement('table');
    table.className = 'members-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';
    
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="border-bottom: 1px solid #27272a;">
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; width: 22px;"></th>
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">NAME</th>
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">TYPE</th>
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">MODIFIED BY</th>
            <th style="padding: 2px 4px; text-align: left; font-weight: 500; color: #71717a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">MODIFIED DATE</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    // Keep this table bounded for metadata types with many members. Rendering
    // every row at once can lock up the extension for large orgs.
    sfarcRenderChunkedList(tbody, filtered, (member) => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid #1f1f23; transition: background 0.1s; line-height: 1.1;';
        tr.onmouseover = () => tr.style.background = 'rgba(255, 255, 255, 0.03)';
        tr.onmouseout = () => tr.style.background = 'transparent';
        
        const isChecked = selectedSet.has(member.fullName);
        const dateStr = member.lastModifiedDate ? new Date(member.lastModifiedDate).toLocaleDateString() : '-';
        const userStr = member.lastModifiedByName || '-';
        const typeStr = currentType || '-';
        
        tr.innerHTML = `
            <td style="padding: 2px 4px;">
                <input type="checkbox" class="item-checkbox" ${isChecked ? 'checked' : ''}>
            </td>
            <td style="padding: 2px 4px; color: #e4e4e7; font-weight: 400;">${window.escapeHtml(member.fullName)}</td>
            <td style="padding: 2px 4px; color: #71717a;">${window.escapeHtml(typeStr)}</td>
            <td style="padding: 2px 4px; color: #10b981;">${window.escapeHtml(userStr)}</td>
            <td style="padding: 2px 4px; color: #a1a1aa;">${window.escapeHtml(dateStr)}</td>
        `;
        
        const checkbox = tr.querySelector('.item-checkbox');
        checkbox.onchange = (e) => {
            if (!selectedMembers[currentType]) selectedMembers[currentType] = new Set();

            if (e.target.checked) {
                selectedMembers[currentType].add(member.fullName);
                selectedTypes.add(currentType);
            } else {
                selectedMembers[currentType].delete(member.fullName);
                if (selectedMembers[currentType].size === 0) {
                    delete selectedMembers[currentType];
                    selectedTypes.delete(currentType);
                }
            }
            renderTypesList(document.getElementById('type-search').value);
            renderSelectionPane();
        };
        
        return tr;
    }, { moreTag: 'tr', moreColspan: 5 });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Update footer with count
    if (footer && showingCount) {
        footer.style.display = 'block';
        showingCount.textContent = `Showing ${filtered.length} of ${typeMembers[currentType].length}`;
    }
}

function updatePackageXmlButton() {
    renderSelectionPane();
}

function renderSelectionPane() {
    const list = document.getElementById('selection-list');
    const countBadge = document.getElementById('selection-count-badge');
    if (!list || !countBadge) return;

    let html = '';
    let totalCount = 0;

    const sortedTypes = Array.from(selectedTypes).sort();
    sortedTypes.forEach(type => {
        const members = selectedMembers[type];
        if (!members || members.size === 0) return;

        totalCount += members.size;
        
        let badgeText = type.toUpperCase();
        if (badgeText.startsWith('APEX')) badgeText = badgeText.substring(4);
        if (badgeText.length > 5) badgeText = badgeText.substring(0, 5);

        const isCollapsed = collapsedSelectionGroups.has(type);
        const collapseStyle = isCollapsed ? 'display: none;' : '';
        const chevronTransform = isCollapsed ? 'transform: rotate(-90deg);' : '';

        // Group Card
        html += `
            <div class="selection-group-card">
                <div class="selection-group-header" data-group-type="${window.escapeHtml(type)}" style="cursor: pointer; user-select: none;">
                    <div style="display: flex; align-items: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="selection-chevron" style="margin-right: 6px; transition: transform 0.2s; ${chevronTransform}">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span class="selection-group-badge">${window.escapeHtml(badgeText)}</span>
                        <span>${window.escapeHtml(type)}</span>
                    </div>
                    <span class="selection-count-pill">${members.size}</span>
                </div>
                <div class="selection-group-items" style="${collapseStyle}">
        `;

        // Members
        Array.from(members).sort().forEach(m => {
            html += `
                    <div class="selection-item">
                        <span class="selection-item-main">
                            <svg class="selection-item-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m8 13 2 2-2 2"></path><path d="m16 13-2 2 2 2"></path></svg>
                            <span class="selection-item-name" title="${window.escapeHtml(m)}">${window.escapeHtml(m)}</span>
                        </span>
                        <button type="button" class="selection-remove-btn" data-type="${window.escapeHtml(type)}" data-member="${window.escapeHtml(m)}" title="Remove ${window.escapeHtml(m)} from package.xml" aria-label="Remove ${window.escapeHtml(m)} from package.xml">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path><path d="M9 6V4h6v2"></path></svg>
                        </button>
                    </div>
            `;
        });
        html += `   </div>
            </div>`;
    });

    // Add empty state if no selections
    if (totalCount === 0) {
        html = `
            <div class="empty-state" id="selection-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #3f3f46; margin-bottom: 8px;">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <div style="color: #52525b; font-size: 11px;">Select components to add them here</div>
            </div>
        `;
    }
    
    list.innerHTML = html;
    countBadge.textContent = totalCount;
    
    // Update workflow step based on selection
    if (totalCount > 0) {
        updateWorkflowStep(3);
    } else if (currentType) {
        updateWorkflowStep(2);
    } else {
        updateWorkflowStep(1);
    }

    // Attach event listeners for expanding/collapsing
    list.querySelectorAll('.selection-group-header').forEach(header => {
        header.onclick = (e) => {
            const t = header.dataset.groupType;
            if (collapsedSelectionGroups.has(t)) {
                collapsedSelectionGroups.delete(t);
            } else {
                collapsedSelectionGroups.add(t);
            }
            renderSelectionPane();
        };
    });

    // Attach event listeners to remove buttons
    list.querySelectorAll('.selection-remove-btn').forEach(btn => {
        btn.onclick = (e) => {
            const t = btn.dataset.type;
            const m = btn.dataset.member;
            if (selectedMembers[t]) {
                selectedMembers[t].delete(m);
                if (selectedMembers[t].size === 0) {
                    delete selectedMembers[t];
                    selectedTypes.delete(t);
                }
            }
            renderSelectionPane();
            renderTypesList(document.getElementById('type-search').value);
            if (currentType === t) renderMembersList();
        };
    });
}

function escapePackageXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generatePackageXml() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';

    const sortedTypes = Array.from(selectedTypes).sort();

    sortedTypes.forEach(type => {
        const members = selectedMembers[type];
        if (members && members.size > 0) {
            xml += '    <types>\n';
            Array.from(members).sort().forEach(m => {
                xml += `        <members>${escapePackageXml(m)}</members>\n`;
            });
            xml += `        <name>${escapePackageXml(type)}</name>\n`;
            xml += '    </types>\n';
        } else {
            // Wildcard if type selected but no members?
            // Or maybe user just clicked type checkbox but didn't select members.
            // Let's assume wildcard `*` if type is checked but no specific members.
            xml += '    <types>\n';
            xml += `        <members>*</members>\n`;
            xml += `        <name>${escapePackageXml(type)}</name>\n`;
            xml += '    </types>\n';
        }
    });

    xml += '    <version>58.0</version>\n';
    xml += '</Package>';

    return xml;
}

function openDrawer() {
    mdSetText('drawer-title', 'Package.xml');
    
    // Reset UI for Package.xml
    const select = document.getElementById('drawer-file-select');
    if (select) select.style.display = 'none';
    
    const downloadBtn = document.getElementById('drawer-download-btn');
    if (downloadBtn) downloadBtn.onclick = downloadPackageXml;
    
    const copyBtn = document.getElementById('drawer-copy-btn');
    copyBtn.onclick = () => copyToClipboard(generatePackageXml(), 'drawer-copy-btn');

    // Show a lightweight loading indicator to keep UI responsive
    mdSetHtml('xml-code', '<div class="loading-xml" style="padding: 20px; color: #888; font-style: italic;">Generating formatted XML...</div>');

    // Start transition immediately - use inline styles for reliable show/hide
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('xml-drawer');
    if (overlay) {
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
    }
    if (drawer) {
        drawer.style.left = '0';
    }

    // Defer heavy DOM parsing and syntax highlighting until the animation gets a chance to start
    setTimeout(() => {
        const xml = generatePackageXml();
        const formattedHtml = formatXml(xml);
        mdSetHtml('xml-code', formattedHtml);
    }, 150);
}

function closeDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('xml-drawer');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
    }
    if (drawer) {
        drawer.style.left = '-100%';
    }
}

async function openSourceDrawer(typeName, memberName) {
    mdSetText('drawer-title', `${memberName}.xml`);
    mdSetHtml('xml-code', '<div class="loading-xml" style="padding: 20px; color: #888; font-style: italic;">Fetching XML from Salesforce...</div>');

    // Use inline styles for reliable show/hide
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('xml-drawer');
    if (overlay) {
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
    }
    if (drawer) {
        drawer.style.left = '0';
    }

    try {
        const results = await window.sfApi.readMetadata(typeName, memberName);
        if (results && results.length > 0) {
            const formattedHtml = formatXml(results[0]);
            mdSetHtml('xml-code', formattedHtml);
        } else {
            mdSetHtml('xml-code', '<div style="color: red; padding: 20px;">Could not fetch metadata XML.</div>');
        }
    } catch (e) {
        mdSetHtml('xml-code', `<div style="color: red; padding: 20px;">Error: ${window.escapeHtml(e.message)}</div>`);
    }
}

function formatXml(xml) {
    // Simple syntax highlighter
    const escaped = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/(&lt;\/?)(\w+)(.*?)(\/?&gt;)/g, (match, p1, p2, p3, p4) => {
        return `<span class="code-tag">${p1}${p2}</span>${p3}<span class="code-tag">${p4}</span>`;
    });
}

function downloadPackageXml() {
    const xml = generatePackageXml();
    const blob = new Blob([xml], { type: 'text/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'package.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function copyToClipboard(text, btnId) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(btnId);
        const span = btn.querySelector('span') || btn;
        const original = span.textContent;
        span.textContent = 'Copied!';
        setTimeout(() => span.textContent = original, 2000);
    });
}

// Theme Synchronization — handled by theme-manager.js (shared across all
// extension pages). No local initThemeSync needed.

// Retrieve Flow
async function startRetrieveFlow() {
    if (selectedTypes.size === 0) {
        window.toast.error('Please select metadata components to retrieve.');
        return;
    }
    
    try {
        const btn = document.getElementById('retrieve-pkg-btn');
        const span = btn.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Starting...';
        btn.disabled = true;

        const nextBtn = document.getElementById('next-action-btn');
        if (nextBtn) nextBtn.disabled = true;

        const fileTree = document.getElementById('file-tree-container');
        if (fileTree) {
            fileTree.innerHTML = '<div style="padding: 20px; text-align: center; color: #a1a1aa;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite; margin-bottom: 8px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><br><span id="retrieve-status-text">Retrieving Source...</span></div>';
            // ensure there is a keyframes spin in css if not already, or use inline
            if (!document.getElementById('spin-style')) {
                const style = document.createElement('style');
                style.id = 'spin-style';
                style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }
        }

        const pkgXml = generatePackageXml();
        
        const processId = await window.sfApi.retrieveMetadata(pkgXml);
        
        await waitForRetrieve(processId, btn, span, originalText);
    } catch (e) {
        console.error('Retrieve Start Error', e);
        let msg = e.message;
        if (e.faultCode && e.faultCode.indexOf('INVALID_TYPE') > -1) {
            // describeMetadata lists types the API version knows about, but the
            // org itself may not support them (newer-than-org types, or types
            // gated behind a feature/license this edition doesn't have). Name
            // the selected types so the user knows what to uncheck.
            const names = Array.from(selectedTypes).sort().map(n => `<code>${window.escapeHtml ? window.escapeHtml(n) : n}</code>`).join(', ');
            msg = `One or more selected types aren't available in this org (${names}). This usually means the type is newer than your org's API version, or is gated behind a feature or license your edition doesn't include. Uncheck ${selectedTypes.size > 1 ? 'the unsupported ones' : 'it'} and retry. (${msg})`;
        }
        window.toast.error(`Error: ${window.escapeHtml ? window.escapeHtml(msg) : msg}`);
        const btn = document.getElementById('retrieve-pkg-btn');
        btn.disabled = false;
        if (btn.querySelector('span')) btn.querySelector('span').textContent = 'Retrieve Source';
        const nextBtn = document.getElementById('next-action-btn');
        if (nextBtn) nextBtn.disabled = false;
    }
}

async function waitForRetrieve(processId, btn, span, originalText) {
    let attempts = 0;
    const maxAttempts = 60; // 1.5s * 60 = 90 seconds
    
    while (attempts < maxAttempts) {
        attempts++;
        try {
            const xml = await window.sfApi.checkRetrieveStatus(processId);
            const doc = new DOMParser().parseFromString(xml, "text/xml");
            
            const stateNode = doc.getElementsByTagNameNS("*", "status")[0] || doc.getElementsByTagNameNS("*", "state")[0];
            const state = stateNode ? stateNode.textContent : 'Pending';
            
            span.textContent = `Polling (${state})...`;
            
            const statusText = document.getElementById('retrieve-status-text');
            if (statusText) statusText.textContent = `Retrieving Source (${state})...`;
            
            if (state === 'Succeeded') {
                await extractAndShowInDrawer(doc);
                btn.disabled = false;
                span.textContent = originalText;
                const nextBtn = document.getElementById('next-action-btn');
                if (nextBtn) nextBtn.disabled = false;
                return;
            }
            
            if (state === 'Failed') {
                const errorNode = doc.getElementsByTagNameNS("*", "errorMessage")[0];
                const errorMsg = errorNode ? errorNode.textContent : 'Unknown Error';
                throw new Error(errorMsg);
            }
            
        } catch (e) {
            window.toast.error(`Retrieve Failed: ${window.escapeHtml ? window.escapeHtml(e.message) : e.message}`);
            btn.disabled = false;
            span.textContent = originalText;
            const nextBtn = document.getElementById('next-action-btn');
            if (nextBtn) nextBtn.disabled = false;
            return;
        }
        
        // Wait 1.5 seconds
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    window.toast.error('Retrieve timed out after 90 seconds.');
    btn.disabled = false;
    span.textContent = originalText;
    const nextBtn = document.getElementById('next-action-btn');
    if (nextBtn) nextBtn.disabled = false;
}

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

let isDiffMode = false;
let currentSelectedFilePath = null;
let currentFileOriginalContent = '';
let currentFileIsXml = false;
let currentSelectedFileIsLocal = false;
let currentRetrievedZip = null;
let currentExtractedFiles = [];
let localFileHandles = {};
let localFiles = {};
let localFilesByKey = new Map();

function normalizeProjectPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
}

function projectPathKey(path) {
    return normalizeProjectPath(path).toLocaleLowerCase('en-US');
}

function setLocalFile(path, content, handle) {
    const normalized = normalizeProjectPath(path);
    localFiles[normalized] = content;
    localFilesByKey.set(projectPathKey(normalized), content);
    if (handle) localFileHandles[normalized] = handle;
}

function getLocalFile(path) {
    const normalized = normalizeProjectPath(path);
    if (Object.prototype.hasOwnProperty.call(localFiles, normalized)) return localFiles[normalized];
    return localFilesByKey.get(projectPathKey(normalized));
}

function normalizeComparisonContent(content) {
    return String(content == null ? '' : content).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
let currentExplorerTreeRoot = null;

// Multi-source diffing state
let comparisonMode = 'none'; // 'none', 'local', 'dest_org'
let destinationSessionId = null;
let destinationInstanceUrl = null;
let destinationExtractedFiles = [];
let destinationRetrieving = false;
let orgTransferChanges = [];
let orgTransferValidatedSignature = null;

// ---------------------------------------------------------------------------
// XML validation (Validate XML button on the diff toolbar)
// ---------------------------------------------------------------------------

function isXmlFile(filePath) {
    if (!filePath) return false;
    const p = filePath.toLowerCase();
    return p.endsWith('.xml') || p.endsWith('.page') || p.endsWith('.component') ||
        p.endsWith('.app') || p.endsWith('.auradoc') || p.endsWith('.design') ||
        p.endsWith('.cmp') || p.endsWith('.evt') || p.endsWith('.intf') ||
        p.endsWith('.tokens') || p.endsWith('.svg');
}

function getModifiedContent() {
    if (window.monacoDiffEditor && window.monacoDiffEditor.getModel() &&
        window.monacoDiffEditor.getModel().modified) {
        return window.monacoDiffEditor.getModel().modified.getValue();
    }
    if (window.monacoEditor) return window.monacoEditor.getValue();
    return '';
}

// Show the Validate XML button only when the current file is XML AND the
// user has actually edited it (content differs from the opened version).
function updateValidateXmlButton() {
    const btn = document.getElementById('validate-xml-btn');
    if (!btn) return;
    if (!currentFileIsXml || getModifiedContent() === currentFileOriginalContent) {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = 'inline-flex';
}

// Lightweight tag-mismatch scanner that reports a precise line number.
// Comments and CDATA are stripped first so their content can't confuse the stack.
function scanXmlTags(content) {
    const text = content
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    const stack = [];
    const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^"'<>])*?)(\/?)>/g;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
        if (m[0].startsWith('<?') || m[0].startsWith('<!')) continue; // PI / doctype
        const line = text.slice(0, m.index).split('\n').length;
        const isClosing = m[1] === '/';
        const isSelfClose = m[4] === '/';
        if (isClosing) {
            if (stack.length === 0) {
                return { message: `Unexpected closing tag </${m[2]}>`, line };
            }
            const top = stack[stack.length - 1];
            if (top.tag !== m[2]) {
                return {
                    message: `Mismatched closing tag </${m[2]}> — expected </${top.tag}> (opened on line ${top.line})`,
                    line
                };
            }
            stack.pop();
        } else if (!isSelfClose) {
            stack.push({ tag: m[2], line });
        }
    }
    if (stack.length > 0) {
        const open = stack[stack.length - 1];
        return { message: `Unclosed tag <${open.tag}> (opened on line ${open.line})`, line: open.line };
    }
    return null;
}

function reportXmlError(err, model) {
    if (model && window.monaco && monaco.editor) {
        monaco.editor.setModelMarkers(model, 'xml-validator', [{
            severity: monaco.MarkerSeverity.Error,
            message: err.message,
            startLineNumber: err.line,
            startColumn: 1,
            endLineNumber: err.line,
            endColumn: Number.MAX_SAFE_INTEGER
        }]);
        if (window.monacoDiffEditor) {
            window.monacoDiffEditor.revealLineInCenter(err.line);
        } else if (window.monacoEditor) {
            window.monacoEditor.revealLineInCenter(err.line);
        }
    }
    window.toast.error(`XML Error (line ${err.line}): ${err.message}`);
}

function clearXmlMarkers(model) {
    if (model && window.monaco && monaco.editor) {
        monaco.editor.setModelMarkers(model, 'xml-validator', []);
    }
}

function validateCurrentXml() {
    const content = getModifiedContent();
    if (!content || !content.trim()) {
        window.toast.warning('The file is empty — nothing to validate.');
        return;
    }

    const model = (window.monacoDiffEditor && window.monacoDiffEditor.getModel() &&
        window.monacoDiffEditor.getModel().modified) ||
        (window.monacoEditor ? window.monacoEditor.getModel() : null);
    clearXmlMarkers(model);

    // 1) Real XML parser check
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    const parseError = doc.getElementsByTagName('parsererror')[0];

    if (parseError) {
        const raw = parseError.textContent || 'XML parse error';
        const lineMatch = raw.match(/[Ll]ine\s*(\d+)/);
        reportXmlError({
            message: raw.replace(/\s+/g, ' ').trim(),
            line: lineMatch ? parseInt(lineMatch[1], 10) : 1
        }, model);
        return;
    }

    // 2) Tag-stack check for a precise line number on mismatches
    const err = scanXmlTags(content);
    if (err) {
        reportXmlError(err, model);
        return;
    }

    window.toast.success('XML is valid');
}

// ---------------------------------------------------------------------------
// Language-aware Validate (Validate button in the file header)
// Validates XML / HTML tag balance and Apex / JS / CSS code structure, so
// users can check a file before saving it. Reuses scanXmlTags for XML.
// ---------------------------------------------------------------------------

function getFileLanguage(filePath) {
    const p = (filePath || '').toLowerCase();
    if (p.endsWith('.cls') || p.endsWith('.trigger')) return 'apex';
    if (p.endsWith('.js') || p.endsWith('.mjs')) return 'javascript';
    if (p.endsWith('.css')) return 'css';
    if (p.endsWith('.html') || p.endsWith('.htm')) return 'html';
    if (isXmlFile(p)) return 'xml';
    return null;
}

function getLanguageLabel(lang) {
    return { apex: 'Apex', javascript: 'JavaScript', css: 'CSS', html: 'HTML', xml: 'XML' }[lang] || lang;
}

// Void (self-closing) elements that never need a closing tag in HTML.
const VOID_HTML_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr'
]);

// Tag-stack scanner for HTML-ish files: skips comments/doctype/PI and strips
// <script>/<style> bodies (their contents may legally contain < and >), then
// reports the first mismatched or unclosed tag with its line number.
function scanHtmlTags(content) {
    const text = content
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!doctype[^>]*>/gi, '')
        .replace(/<\?[\s\S]*?\?>/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');
    const stack = [];
    const tagRe = /<\s*(\/?)\s*([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^"'<>])*?)(\s*\/?)\s*>/g;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
        if (m[0].startsWith('<?') || m[0].startsWith('<!')) continue;
        const line = text.slice(0, m.index).split('\n').length;
        const name = m[2].toLowerCase();
        const isClosing = m[1] === '/';
        const isSelfClose = /\/\s*$/.test(m[3] + m[4]);
        if (isClosing) {
            if (stack.length === 0) {
                return { message: `Unexpected closing tag </${name}>`, line };
            }
            const top = stack[stack.length - 1];
            if (top.tag !== name) {
                return {
                    message: `Mismatched closing tag </${name}> — expected </${top.tag}> (opened on line ${top.line})`,
                    line
                };
            }
            stack.pop();
        } else if (!isSelfClose && !VOID_HTML_TAGS.has(name)) {
            stack.push({ tag: name, line });
        }
    }
    if (stack.length > 0) {
        const open = stack[stack.length - 1];
        return { message: `Unclosed tag <${open.tag}> (opened on line ${open.line})`, line: open.line };
    }
    return null;
}

// Character scanner for Apex / JavaScript / CSS: walks the source once,
// skipping comments and string literals, and balances (), [], {}. Reports the
// first mismatch / unclosed bracket with its line number.
function scanCodeStructure(content) {
    const stack = []; // { ch, line }
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const closingFor = { '(': ')', '[': ']', '{': '}' };
    let i = 0, line = 1;
    const n = content.length;
    while (i < n) {
        const c = content[i];
        if (c === '\n') { line++; i++; continue; }
        // String literals: '...' "..." `...` with \-escapes
        if (c === "'" || c === '"' || c === '`') {
            const quote = c;
            i++;
            while (i < n) {
                if (content[i] === '\\') { i += 2; continue; }
                if (content[i] === '\n') { line++; i++; continue; }
                if (content[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        // Line comment //
        if (c === '/' && content[i + 1] === '/') {
            while (i < n && content[i] !== '\n') i++;
            continue;
        }
        // Block comment /* */
        if (c === '/' && content[i + 1] === '*') {
            i += 2;
            while (i < n && !(content[i] === '*' && content[i + 1] === '/')) {
                if (content[i] === '\n') line++;
                i++;
            }
            i = Math.min(i + 2, n);
            continue;
        }
        if (c === '{' || c === '(' || c === '[') {
            stack.push({ ch: c, line });
        } else if (c === '}' || c === ')' || c === ']') {
            if (stack.length === 0) {
                return { message: `Unexpected '${c}'`, line };
            }
            const top = stack[stack.length - 1];
            if (top.ch !== pairs[c]) {
                return {
                    message: `Mismatched '${c}' — expected '${closingFor[top.ch]}' (opened on line ${top.line})`,
                    line
                };
            }
            stack.pop();
        }
        i++;
    }
    if (stack.length > 0) {
        const open = stack[stack.length - 1];
        return { message: `Unclosed '${open.ch}' (opened on line ${open.line})`, line: open.line };
    }
    return null;
}

function reportValidateError(err, model, owner, label) {
    if (model && window.monaco && monaco.editor) {
        monaco.editor.setModelMarkers(model, owner, [{
            severity: monaco.MarkerSeverity.Error,
            message: err.message,
            startLineNumber: err.line,
            startColumn: 1,
            endLineNumber: err.line,
            endColumn: Number.MAX_SAFE_INTEGER
        }]);
        try {
            if (window.monacoDiffEditor) window.monacoDiffEditor.revealLineInCenter(err.line);
            else if (window.monacoEditor) window.monacoEditor.revealLineInCenter(err.line);
        } catch (e) { /* editor may be mid-switch */ }
    }
    window.toast.error(`${label} Error (line ${err.line}): ${err.message}`);
}

function clearFileValidationMarkers(model) {
    if (model && window.monaco && monaco.editor) {
        ['file-validator', 'xml-validator'].forEach(owner => {
            monaco.editor.setModelMarkers(model, owner, []);
        });
    }
}

// Validate the currently open file (standard or diff editor) by language.
// Returns the first error ({ message, line }) or null when valid.
function validateCurrentFile() {
    const filePath = currentSelectedFilePath;
    const lang = getFileLanguage(filePath);
    const content = getModifiedContent();
    if (!content || !content.trim()) {
        window.toast.warning('The file is empty — nothing to validate.');
        return null;
    }

    const model = (isDiffMode && window.monacoDiffEditor && window.monacoDiffEditor.getModel() &&
        window.monacoDiffEditor.getModel().modified) ||
        (window.monacoEditor ? window.monacoEditor.getModel() : null);
    clearFileValidationMarkers(model);

    let err = null;
    let owner = 'file-validator';
    let label = null;

    if (lang === 'xml') {
        label = 'XML';
        owner = 'xml-validator';
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const parseError = doc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            const raw = parseError.textContent || 'XML parse error';
            const lineMatch = raw.match(/[Ll]ine\s*(\d+)/);
            err = { message: raw.replace(/\s+/g, ' ').trim(), line: lineMatch ? parseInt(lineMatch[1], 10) : 1 };
        } else {
            err = scanXmlTags(content);
        }
    } else if (lang === 'html') {
        label = 'HTML';
        err = scanHtmlTags(content);
    } else if (lang === 'apex' || lang === 'javascript' || lang === 'css') {
        label = getLanguageLabel(lang);
        err = scanCodeStructure(content);
    } else {
        window.toast.info('No tag validator for this file type.');
        return null;
    }

    if (err) {
        reportValidateError(err, model, owner, label);
        return err;
    }
    window.toast.success(`${label} is valid`);
    return null;
}

async function populateCompareTargets() {
    const select = document.getElementById('compare-target-select');
    if (!select) return;
    
    try {
        const tabs = await chrome.tabs.query({});
        const sfTabs = tabs.filter(t => t.url && (t.url.includes('.salesforce.com') || t.url.includes('.force.com')));
        
        const addedOrgs = new Set();
        
        for (const tab of sfTabs) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SESSION_INFO' });
                if (response && response.sessionId && response.instanceUrl) {
                    const cleanUrl = response.instanceUrl.split('://')[1].split('/')[0];
                    if (!addedOrgs.has(cleanUrl)) {
                        addedOrgs.add(cleanUrl);
                        const opt = document.createElement('option');
                        opt.value = `org_${response.sessionId}_${response.instanceUrl}`;
                        opt.textContent = `☁️ ${cleanUrl}`;
                        select.appendChild(opt);
                    }
                }
            } catch (e) {
                // Content script might not be injected or ready
            }
        }
    } catch (e) {
        console.error('Failed to populate compare targets', e);
    }
}

async function retrieveFromDestinationOrg() {
    if (!destinationSessionId || !destinationInstanceUrl || !currentRetrievedZip) return;
    
    window.toast.success('Retrieving metadata from Destination Org...');
    destinationRetrieving = true;
    destinationExtractedFiles = [];
    
    try {
        const destApi = new SalesforceAPI();
        destApi.sessionId = destinationSessionId;
        destApi.instanceUrl = destinationInstanceUrl;
        
        const pkgXml = generatePackageXml();
        const processId = await destApi.retrieveMetadata(pkgXml);
        
        // Wait for retrieve
        let attempts = 0;
        let xmlDoc = null;
        while (attempts < 60) {
            attempts++;
            const xml = await destApi.checkRetrieveStatus(processId);
            const doc = new DOMParser().parseFromString(xml, "text/xml");
            
            const stateNode = doc.getElementsByTagNameNS("*", "status")[0] || doc.getElementsByTagNameNS("*", "state")[0];
            const state = stateNode ? stateNode.textContent : 'Pending';
            
            if (state === 'Succeeded') {
                xmlDoc = doc;
                break;
            } else if (state === 'Failed') {
                throw new Error('Destination Retrieve Failed');
            }
            await new Promise(r => setTimeout(r, 1500));
        }
        
        if (xmlDoc) {
            const zipFileNode = xmlDoc.getElementsByTagNameNS("*", "zipFile")[0];
            if (zipFileNode) {
                const zipBase64 = zipFileNode.textContent;
                const binaryString = atob(zipBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const newZip = await JSZip.loadAsync(bytes.buffer);
                const extractedFiles = [];
                for (let relativePath in newZip.files) {
                    if (!newZip.files[relativePath].dir) {
                        const content = await newZip.files[relativePath].async('string');
                        extractedFiles.push({
                            path: relativePath.substring(relativePath.indexOf('/') + 1), // remove 'unpackaged/'
                            content: content
                        });
                    }
                }
                destinationExtractedFiles = extractedFiles;
                orgTransferChanges = calculateOrgTransferChanges();
                orgTransferValidatedSignature = null;
                const transferBtn = document.getElementById('open-org-transfer-btn');
                if (transferBtn) transferBtn.style.display = 'inline-flex';
                window.toast.success('Destination Org Metadata Ready!');
            }
        }
    } catch (e) {
        window.toast.error('Failed to retrieve from destination org: ' + e.message);
    } finally {
        destinationRetrieving = false;
    }
}

function canonicalMetadataPath(path) {
    return normalizeProjectPath(path).replace(/^(?:unpackaged\/|force-app\/main\/default\/|src\/)/i, '');
}

function filesByCanonicalPath(files) {
    const map = new Map();
    (files || []).forEach(file => {
        const path = canonicalMetadataPath(file.path);
        if (path && !/(^|\/)package\.xml$/i.test(path)) map.set(projectPathKey(path), { ...file, canonicalPath: path });
    });
    return map;
}

function calculateOrgTransferChanges() {
    const source = filesByCanonicalPath(currentExtractedFiles);
    const destination = filesByCanonicalPath(destinationExtractedFiles);
    const changes = [];
    source.forEach((file, key) => {
        const target = destination.get(key);
        const status = !target ? 'Added' : normalizeComparisonContent(file.content) !== normalizeComparisonContent(target.content) ? 'Modified' : null;
        if (status) changes.push({ key, path: file.canonicalPath, status, source: file, destination: target, selected: true });
    });
    destination.forEach((file, key) => {
        if (!source.has(key)) changes.push({ key, path: file.canonicalPath, status: 'Destination only', destination: file, selected: false, deployable: false });
    });
    return changes.sort((a, b) => a.path.localeCompare(b.path));
}

function metadataMappingForTransfer(path) {
    const clean = canonicalMetadataPath(path);
    return mapPathToMetadata(clean) || (/-meta\.xml$/i.test(clean) ? mapPathToMetadata(clean.replace(/-meta\.xml$/i, '')) : null);
}

function selectedTransferChanges() {
    return orgTransferChanges.filter(change => change.selected && change.deployable !== false);
}

function selectedTransferFiles() {
    const source = filesByCanonicalPath(currentExtractedFiles);
    const selected = new Map();
    selectedTransferChanges().forEach(change => {
        const mapping = metadataMappingForTransfer(change.path);
        const path = canonicalMetadataPath(change.path);
        const parts = path.split('/');
        const bundleType = mapping && (mapping.type === 'AuraDefinitionBundle' || mapping.type === 'LightningComponentBundle');
        const bundlePrefix = bundleType ? parts.slice(0, -1).join('/') + '/' : null;
        source.forEach((file, key) => {
            const companion = file.canonicalPath === path || file.canonicalPath === `${path}-meta.xml` ||
                path === `${file.canonicalPath}-meta.xml` || (bundlePrefix && file.canonicalPath.startsWith(bundlePrefix));
            if (companion) selected.set(key, file);
        });
    });
    return [...selected.values()];
}

function buildTransferPackageXml(files) {
    const grouped = new Map();
    files.forEach(file => {
        const mapping = metadataMappingForTransfer(file.canonicalPath);
        if (!mapping) return;
        if (!grouped.has(mapping.type)) grouped.set(mapping.type, new Set());
        grouped.get(mapping.type).add(mapping.member);
    });
    if (!grouped.size) throw new Error('No deployable Salesforce metadata components are selected.');
    const escape = value => String(value).replace(/[<>&'\"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
    const types = [...grouped.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([type, members]) =>
        `  <types>\n${[...members].sort().map(member => `    <members>${escape(member)}</members>`).join('\n')}\n    <name>${escape(type)}</name>\n  </types>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n${types}\n  <version>60.0</version>\n</Package>`;
}

async function buildTransferZip(files) {
    const zip = new JSZip();
    // singlePackage deployments require package.xml and metadata directories at
    // the ZIP root (the "unpackaged/" wrapper is a retrieve-response detail).
    files.forEach(file => zip.file(canonicalMetadataPath(file.canonicalPath || file.path), file.content));
    zip.file('package.xml', buildTransferPackageXml(files));
    return zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function transferSignature(files) {
    return files.map(file => `${projectPathKey(file.canonicalPath)}:${normalizeComparisonContent(file.content).length}:${normalizeComparisonContent(file.content)}`).sort().join('|');
}

function setTransferProgress(label, percent) {
    const box = document.getElementById('org-transfer-progress');
    box.hidden = false;
    document.getElementById('org-transfer-progress-label').textContent = label;
    document.getElementById('org-transfer-progress-value').textContent = `${percent}%`;
    document.getElementById('org-transfer-progress-bar').value = percent;
}

function parseDeployStatus(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const get = name => doc.getElementsByTagNameNS('*', name)[0]?.textContent || '';
    const errors = [...doc.getElementsByTagNameNS('*', 'componentFailures')].map(node => {
        const field = name => node.getElementsByTagNameNS('*', name)[0]?.textContent || '';
        return `${field('fullName') || field('fileName')}: ${field('problem') || 'Deployment failed'}`;
    });
    return { status: get('status'), done: get('done') === 'true', success: get('success') === 'true', errors };
}

async function waitForDeploy(api, jobId, label) {
    for (let attempt = 0; attempt < 120; attempt++) {
        const parsed = parseDeployStatus(await api.checkDeployStatus(jobId, true));
        setTransferProgress(`${label}: ${parsed.status || 'Pending'}`, Math.min(95, 10 + Math.round(attempt * .75)));
        if (parsed.done) return parsed;
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error(`${label} timed out. The Salesforce job may still be running.`);
}

function renderOrgTransferList() {
    const filter = (document.getElementById('org-transfer-filter')?.value || '').toLowerCase();
    const list = document.getElementById('org-transfer-list');
    const visible = orgTransferChanges.filter(change => change.path.toLowerCase().includes(filter));
    list.innerHTML = visible.length ? visible.map(change => `<label class="org-transfer-row ${change.deployable === false ? 'destination-only' : ''}">
        <input type="checkbox" data-transfer-key="${change.key}" ${change.selected ? 'checked' : ''} ${change.deployable === false ? 'disabled' : ''}>
        <span class="org-transfer-badge">${change.status}</span><code title="${change.path}">${change.path}</code></label>`).join('') : '<div class="empty-state">No matching changes.</div>';
    const counts = orgTransferChanges.reduce((out, change) => (out[change.status] = (out[change.status] || 0) + 1, out), {});
    document.getElementById('org-transfer-counts').textContent = `${counts.Added || 0} added · ${counts.Modified || 0} modified · ${counts['Destination only'] || 0} destination-only`;
    list.querySelectorAll('[data-transfer-key]').forEach(input => input.addEventListener('change', event => {
        const change = orgTransferChanges.find(item => item.key === event.target.dataset.transferKey);
        if (change) change.selected = event.target.checked;
        orgTransferValidatedSignature = null;
        document.getElementById('org-transfer-deploy-btn').disabled = true;
    }));
}

function openOrgTransfer() {
    orgTransferChanges = calculateOrgTransferChanges();
    orgTransferValidatedSignature = null;
    document.getElementById('org-transfer-route').textContent = `Current org → ${destinationInstanceUrl || 'destination org'}`;
    document.getElementById('org-transfer-modal').hidden = false;
    document.getElementById('org-transfer-deploy-btn').disabled = true;
    document.getElementById('org-transfer-result').hidden = true;
    renderOrgTransferList();
}

async function downloadDestinationBackup(files, automatic = false) {
    const destination = filesByCanonicalPath(destinationExtractedFiles);
    const backupFiles = files.map(file => destination.get(projectPathKey(file.canonicalPath))).filter(Boolean);
    if (!backupFiles.length) {
        if (!automatic) window.toast.info('No existing destination files need backup. Added components are new.');
        return;
    }
    const base64 = await buildTransferZip(backupFiles);
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${base64}`;
    link.download = `destination-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    link.click();
}

async function validateOrgTransfer() {
    const files = selectedTransferFiles();
    if (!files.length) return window.toast.warning('Select at least one deployable change.');
    const api = new SalesforceAPI(); api.sessionId = destinationSessionId; api.instanceUrl = destinationInstanceUrl;
    const validateBtn = document.getElementById('org-transfer-validate-btn');
    validateBtn.disabled = true;
    try {
        setTransferProgress('Building validation package', 5);
        const jobId = await api.deployMetadata(await buildTransferZip(files), { checkOnly: true, testLevel: 'NoTestRun' });
        const result = await waitForDeploy(api, jobId, 'Validating');
        const output = document.getElementById('org-transfer-result'); output.hidden = false;
        output.textContent = result.success ? `Validation succeeded. Job ${jobId}` : `Validation failed.\n${result.errors.join('\n') || result.status}`;
        if (!result.success) throw new Error(result.errors[0] || `Validation ${result.status}`);
        orgTransferValidatedSignature = transferSignature(files);
        document.getElementById('org-transfer-deploy-btn').disabled = false;
        setTransferProgress('Validation succeeded', 100);
        window.toast.success('Destination validation succeeded. Deployment is now enabled.');
    } catch (error) {
        orgTransferValidatedSignature = null;
        document.getElementById('org-transfer-deploy-btn').disabled = true;
        window.toast.error(error.message);
    } finally { validateBtn.disabled = false; }
}

async function deployOrgTransfer() {
    const files = selectedTransferFiles();
    if (!orgTransferValidatedSignature || orgTransferValidatedSignature !== transferSignature(files)) {
        document.getElementById('org-transfer-deploy-btn').disabled = true;
        return window.toast.warning('The selection changed. Validate it again before deployment.');
    }
    if (!window.confirm(`Deploy ${selectedTransferChanges().length} selected change(s) to ${destinationInstanceUrl}? Salesforce rollback-on-error is enabled and no destination-only files will be deleted.`)) return;
    const button = document.getElementById('org-transfer-deploy-btn'); button.disabled = true;
    try {
        await downloadDestinationBackup(files, true);
        const api = new SalesforceAPI(); api.sessionId = destinationSessionId; api.instanceUrl = destinationInstanceUrl;
        setTransferProgress('Uploading validated package', 5);
        const jobId = await api.deployMetadata(await buildTransferZip(files), { checkOnly: false, testLevel: 'NoTestRun' });
        const result = await waitForDeploy(api, jobId, 'Deploying');
        const output = document.getElementById('org-transfer-result'); output.hidden = false;
        output.textContent = result.success ? `Deployment succeeded. Job ${jobId}` : `Deployment failed and was rolled back.\n${result.errors.join('\n') || result.status}`;
        setTransferProgress(result.success ? 'Deployment succeeded' : 'Deployment rolled back', 100);
        if (!result.success) throw new Error(result.errors[0] || `Deployment ${result.status}`);
        orgTransferValidatedSignature = null;
        window.toast.success('Selected metadata changes were deployed successfully.');
    } catch (error) { window.toast.error(error.message); }
}

function buildTreeFromJsonPaths(filesArray) {
    const fileTree = {};
    filesArray.forEach((file) => {
        const parts = file.path.split('/');
        let currentLevel = fileTree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                currentLevel[part] = { _type: 'file', name: part, path: file.path, isLocal: file.isLocal };
            } else {
                if (!currentLevel[part]) {
                    currentLevel[part] = { _type: 'folder', name: part, children: {} };
                }
                currentLevel = currentLevel[part].children;
            }
        }
    });
    return fileTree;
}

async function extractAndShowInDrawer(doc) {
    try {
        const zipFileNode = doc.getElementsByTagNameNS("*", "zipFile")[0];
        if (!zipFileNode) {
            throw new Error("No zipFile found in retrieve result.");
        }
        
        const zipBase64 = zipFileNode.textContent;
        const zipBytes = base64ToUint8Array(zipBase64);
        
        const zip = await JSZip.loadAsync(zipBytes);
        const newZip = new JSZip();
        const extractedFiles = [];
        
        for (const [path, entry] of Object.entries(zip.files)) {
            if (!entry.dir) {
                const parts = path.split('/');
                if (parts.length > 1) {
                    parts.shift(); // remove "unpackaged"
                }
                const newPath = parts.join('/');
                
                if (newPath !== 'package.xml') {
                    const content = await entry.async("string");
                    extractedFiles.push({ path: newPath, content: content });
                }
                
                const contentBuf = await entry.async("arraybuffer");
                newZip.file(newPath, contentBuf);
            }
        }
        
        if (extractedFiles.length === 0) {
            window.toast.warning('Retrieved Source is empty.');
            return;
        }
        
        currentRetrievedZip = newZip;
        currentExtractedFiles = extractedFiles;
        
        // Build file tree JSON
        const fileTree = buildTreeFromJsonPaths(extractedFiles);
        renderExplorerTree(fileTree, false);
        
        // Setup download button
        const dlBtn = document.getElementById('download-full-retrieve-btn');
        dlBtn.style.display = 'flex';
        dlBtn.onclick = async () => {
            const blob = await currentRetrievedZip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Salesforce_Source_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.toast.success('ZIP Downloaded successfully!');
        };
        
        // Clear right pane. IMPORTANT: never wipe retrieve-file-title-container's
        // innerHTML — it is the parent of #title-left / #title-right, which
        // showFileContent() reads. Setting innerHTML destroys those nodes and the
        // next file click throws "Cannot set properties of null (innerHTML)".
        const fileTitle = document.getElementById('retrieve-file-title-container') || document.getElementById('retrieve-file-title');
        if (fileTitle) {
            const titleLeft = fileTitle.querySelector('#title-left');
            const titleRight = fileTitle.querySelector('#title-right');
            if (titleLeft) titleLeft.innerHTML = '&nbsp;';
            if (titleRight) titleRight.style.display = 'none';
        }
        if (window.monacoEditor) {
            window.monacoEditor.setValue('/* Select a file from the Explorer to view its source */');
        }
        if (window.monacoDiffEditor) {
            window.monacoDiffEditor.setModel(null);
        }
        const copyBtn = document.getElementById('copy-retrieve-file-btn');
        if (copyBtn) copyBtn.style.display = 'none';
        const downloadBtn = document.getElementById('download-retrieve-file-btn');
        if (downloadBtn) downloadBtn.style.display = 'none';
        const validateBtn = document.getElementById('validate-retrieve-file-btn');
        if (validateBtn) validateBtn.style.display = 'none';
        const diffBtn = document.getElementById('toggle-diff-btn');
        if (diffBtn) diffBtn.style.display = 'none';
        
        // Switch to Retrieve Viewer tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('sfarc-active'));
        document.querySelectorAll('.view-container').forEach(v => {
            v.classList.remove('sfarc-active');
            v.style.display = 'none';
        });
        const retrieveTab = document.querySelector('.nav-tab[data-view="retrieve-viewer-view"]');
        if (retrieveTab) retrieveTab.classList.add('sfarc-active');
        const retrieveView = document.getElementById('retrieve-viewer-view');
        if (retrieveView) {
            retrieveView.classList.add('sfarc-active');
            retrieveView.style.display = 'flex';
        }
        
        window.toast.success(`Successfully retrieved ${extractedFiles.length} files!`);
        
    } catch (e) {
        console.error('Extract ZIP Error', e);
        window.toast.error(`Error processing retrieve: ${e.message}`);
    }
}

// ── Explorer File Search ────────────────────────────────────────────────
// Renders the current explorer tree (org or local repo) into the left pane and
// keeps the search bar in sync. forceOpen expands every folder (used while a
// search filter is active so matches are always visible).
function renderExplorerTree(root, forceOpen) {
    const input = document.getElementById('explorer-search-input');
    const q = (input && input.value || '').trim();
    // A real (unfiltered) tree just loaded while a search is active — re-apply
    // the filter so the new tree stays filtered.
    if (q && !forceOpen && root) {
        currentExplorerTreeRoot = root;
        applyExplorerSearch();
        return;
    }
    currentExplorerTreeRoot = root || null;
    const container = document.getElementById('file-tree-container');
    if (!container) return;
    container.innerHTML = '<ul class="file-tree"></ul>';
    renderTreeLevel(root || {}, container.querySelector('ul'), !!forceOpen);
    if (forceOpen) {
        container.querySelectorAll('.tree-folder').forEach(li => li.classList.add('open'));
    }
    const wrapper = document.getElementById('explorer-search-wrapper');
    if (wrapper) wrapper.style.display = 'flex';
}

// Returns a copy of the tree containing only nodes whose name/path includes the
// query. Folders are kept when any descendant matches.
function filterExplorerTree(node, query) {
    const q = query.toLowerCase();
    const out = {};
    for (const key of Object.keys(node || {}).filter(k => !['_type', 'index', 'name', 'path', 'children'].includes(k))) {
        const child = node[key];
        if (!child) continue;
        if (child._type === 'file') {
            const name = (child.name || '').toLowerCase();
            const path = (child.path || '').toLowerCase();
            if (name.includes(q) || path.includes(q)) out[key] = child;
        } else if (child._type === 'folder') {
            const filtered = filterExplorerTree(child.children || {}, query);
            if (Object.keys(filtered).length > 0) {
                out[key] = { _type: 'folder', name: child.name, children: filtered };
            }
        }
    }
    return out;
}

function applyExplorerSearch() {
    const input = document.getElementById('explorer-search-input');
    const clear = document.getElementById('explorer-search-clear');
    const q = (input && input.value || '').trim();
    if (clear) clear.style.display = q ? 'flex' : 'none';
    if (!currentExplorerTreeRoot) return;
    if (!q) {
        renderExplorerTree(currentExplorerTreeRoot, false);
        return;
    }
    const filtered = filterExplorerTree(currentExplorerTreeRoot, q);
    renderExplorerTree(filtered, true);
    const container = document.getElementById('file-tree-container');
    if (container && Object.keys(filtered).length === 0) {
        container.innerHTML = `<div style="padding: 16px; font-size: 12px; color: #71717a; text-align: center;">No files match '<strong>${escapeHtml(q)}</strong>'</div>`;
    }
}

function initExplorerSearch() {
    const input = document.getElementById('explorer-search-input');
    const clear = document.getElementById('explorer-search-clear');
    if (!input) return;
    input.addEventListener('input', applyExplorerSearch);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            applyExplorerSearch();
            input.blur();
        }
    });
    if (clear) {
        clear.addEventListener('click', () => {
            input.value = '';
            applyExplorerSearch();
            input.focus();
        });
    }
}

// Pre-built SVG icons for tree (reused to avoid recreating)
const TREE_CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
const TREE_FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

function renderTreeLevel(treeNode, ulElement, forceOpen = false) {
    // Use document fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    // Sort folders first, then files
    const keys = Object.keys(treeNode).filter(k => k !== '_type' && k !== 'index' && k !== 'name' && k !== 'path' && k !== 'children');
    keys.sort((a, b) => {
        const isFolderA = treeNode[a]._type === 'folder';
        const isFolderB = treeNode[b]._type === 'folder';
        if (isFolderA && !isFolderB) return -1;
        if (!isFolderA && isFolderB) return 1;
        return a.localeCompare(b);
    });
    
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const node = treeNode[key];
        const li = document.createElement('li');
        const row = document.createElement('div');
        row.className = 'tree-item-row';
        
        const caret = document.createElement('span');
        caret.className = 'tree-caret';
        
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = node.name;
        
        if (node._type === 'folder') {
            li.className = 'tree-folder';
            caret.innerHTML = TREE_CHEVRON_SVG;
            icon.innerHTML = TREE_FOLDER_SVG;
            
            row.appendChild(caret);
            row.appendChild(icon);
            row.appendChild(label);
            li.appendChild(row);
            
            // Lazy render children only when folder is opened
            const childUl = document.createElement('ul');
            let childrenRendered = false;
            li.appendChild(childUl);
            if (forceOpen && node.children && Object.keys(node.children).length > 0) {
                childrenRendered = true;
                renderTreeLevel(node.children, childUl, true);
                li.classList.add('open');
            }
            
            row.onclick = () => {
                if (!childrenRendered && node.children && Object.keys(node.children).length > 0) {
                    childrenRendered = true;
                    renderTreeLevel(node.children, childUl);
                }
                li.classList.toggle('open');
            };
        } else {
            li.className = 'tree-file';
            icon.textContent = ''; // empty for alignment
            
            row.appendChild(caret);
            row.appendChild(icon);
            row.appendChild(label);
            li.appendChild(row);
            
            // Capture path in closure for click handler
            const nodePath = node.path;
            const nodeIsLocal = node.isLocal;
            row.onclick = () => {
                document.querySelectorAll('.tree-item-row.selected').forEach(el => el.classList.remove('selected'));
                row.classList.add('selected');
                showFileContent(nodePath, nodeIsLocal);
            };
        }
        
        fragment.appendChild(li);
    }
    
    // Single DOM insertion for all children
    ulElement.appendChild(fragment);
}


// ---------------------------------------------------------------------------
// Live org fetching — when the user clicks a file that isn't in the retrieved
// package (e.g. they loaded a Local Project without retrieving the org first),
// fetch that one file straight from Salesforce so the diff still works.
// ---------------------------------------------------------------------------

// Maps a file path to a metadata { type, member, path } so the org API knows
// what to fetch. Handles SFDX (force-app/main/default/...) and MDAPI (src/...)
// layouts plus flattened org paths (classes/X.cls).
function mapPathToMetadata(filePath) {
    if (!filePath) return null;
    // Normalize path for Windows compatibility
    const p = filePath.replace(/\\/g, '/');
    const norm = p.replace(/^(force-app\/main\/default\/|src\/)/, '');
    const parts = norm.split('/');
    const fileName = parts[parts.length - 1];
    const dir = parts.length > 1 ? parts[parts.length - 2] : '';
    const base = fileName.replace(/\.[^.]+$/, '');
    const member = base.replace(/(?:\.|-)?meta$/i, '');

    // Apex / Visualforce / Aura / LWC source files
    if (/\.cls$/i.test(fileName)) return { type: 'ApexClass', member: member.replace(/\.cls$/i, ''), path: 'classes/' + fileName };
    if (/\.trigger$/i.test(fileName)) return { type: 'ApexTrigger', member: member.replace(/\.trigger$/i, ''), path: 'triggers/' + fileName };
    if (/\.page$/i.test(fileName)) return { type: 'ApexPage', member: member.replace(/\.page$/i, ''), path: 'pages/' + fileName };

    const auraIdx = parts.indexOf('aura');
    if (/\.(cmp|evt|intf|app|auradoc|design)$/i.test(fileName)) {
        if (auraIdx !== -1 && parts.length >= 3) {
            const bundle = parts[parts.length - 2];
            return { type: 'AuraDefinitionBundle', member: bundle, path: 'aura/' + bundle + '/' + fileName };
        }
        return { type: 'AuraDefinitionBundle', member: member.replace(/\.(cmp|evt|intf|app|auradoc|design)$/i, ''), path: 'components/' + fileName };
    }

    const lwcIdx = parts.indexOf('lwc');
    if (lwcIdx !== -1 && lwcIdx === parts.length - 3) {
        const bundle = parts[parts.length - 2];
        return { type: 'LightningComponentBundle', member: bundle, path: 'lwc/' + bundle + '/' + fileName };
    }

    // Child metadata under an object folder (fields, record types, list views, ...)
    const objChildTypes = {
        'fields': 'CustomField',
        'recordTypes': 'RecordType',
        'listViews': 'ListView',
        'compactLayouts': 'CompactLayout',
        'webLinks': 'WebLink',
        'validationRules': 'ValidationRule',
        'businessProcesses': 'BusinessProcess'
    };
    const objIdx = parts.indexOf('objects');
    if (objIdx !== -1 && parts[objIdx + 1]) {
        const obj = parts[objIdx + 1];
        if (/\.object$/i.test(fileName)) return { type: 'CustomObject', member: obj, path: norm };
        if (objChildTypes[dir] && dir !== obj) {
            // child meta files end with the type suffix (Name.field-meta.xml -> Name)
            const childMember = member.replace(/\.[^.]+$/i, '');
            return { type: objChildTypes[dir], member: obj + '.' + childMember, path: norm };
        }
    }

    // Common metadata folders
    const dirMap = {
        'layouts': ['Layout', member],
        'profiles': ['Profile', member],
        'permissionsets': ['PermissionSet', member],
        'workflows': ['Workflow', member],
        'tabs': ['CustomTab', member],
        'staticresources': ['StaticResource', member],
        'classes': ['ApexClass', member.replace(/\.cls$/i, '')],
        'triggers': ['ApexTrigger', member.replace(/\.trigger$/i, '')],
        'pages': ['ApexPage', member.replace(/\.page$/i, '')],
        'emails': ['EmailTemplate', member],
        'reports': ['Report', member],
        'dashboards': ['Dashboard', member],
        'components': ['AuraDefinitionBundle', member.replace(/\.(cmp|evt|intf|app)$/i, '')],
        'labels': ['CustomLabels', 'CustomLabels'],
        'globalValueSets': ['GlobalValueSet', member],
        'certs': ['Certificate', member]
    };
    if (dir && dirMap[dir]) {
        return { type: dirMap[dir][0], member: dirMap[dir][1], path: norm };
    }

    return null;
}

// Targeted retrieve of a single metadata member — the reliable fallback that
// works for every metadata type (XML included).
async function retrieveOrgFileLive(mapping) {
    if (!mapping) return null;
    const pkgXml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
        '  <types>\n' +
        `    <members>${mapping.member}</members>\n` +
        `    <name>${mapping.type}</name>\n` +
        '  </types>\n' +
        '  <version>58.0</version>\n' +
        '</Package>';

    const processId = await window.sfApi.retrieveMetadata(pkgXml);
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const xml = await window.sfApi.checkRetrieveStatus(processId);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const stateNode = doc.getElementsByTagNameNS('*', 'status')[0] || doc.getElementsByTagNameNS('*', 'state')[0];
        const state = stateNode ? stateNode.textContent : 'Pending';
        if (state === 'Succeeded') {
            const zipFileNode = doc.getElementsByTagNameNS('*', 'zipFile')[0];
            if (!zipFileNode) return null;
            const zip = await JSZip.loadAsync(base64ToUint8Array(zipFileNode.textContent));
            for (const relPath in zip.files) {
                if (zip.files[relPath].dir) continue;
                const normPath = relPath.replace(/^unpackaged\//, '');
                const target = mapping.path.replace(/^force-app\/main\/default\//, '').replace(/^src\//, '');
                if (normPath === target || normPath.endsWith('/' + target) || normPath.endsWith(target)) {
                    const content = await zip.files[relPath].async('string');
                    return { content: content, path: normPath };
                }
            }
            return null;
        }
        if (state === 'Failed') {
            const errNode = doc.getElementsByTagNameNS('*', 'errorMessage')[0];
            throw new Error(errNode ? errNode.textContent : 'Retrieve failed');
        }
    }
    return null;
}

// Fast source fetch via the Tooling API for the code file types, with a
// targeted retrieve as the universal fallback. Returns { content, path } or null.
async function fetchOrgFileLive(filePath) {
    if (!window.sfApi || !window.sfApi.sessionId) return null;
    const mapping = mapPathToMetadata(filePath);
    if (!mapping) return null;
    const safe = (s) => String(s).replace(/'/g, "\\'");

    try {
        const q1 = async (soql) => {
            const res = await window.sfApi.query(soql, true);
            return (res && res.records && res.records.length > 0) ? res.records[0] : null;
        };

        if (mapping.type === 'ApexClass') {
            const r = await q1(`SELECT Id, Name, Body FROM ApexClass WHERE Name = '${safe(mapping.member)}' LIMIT 1`);
            if (r && r.Body != null) return { content: r.Body, path: mapping.path };
        } else if (mapping.type === 'ApexTrigger') {
            const r = await q1(`SELECT Id, Name, Body FROM ApexTrigger WHERE Name = '${safe(mapping.member)}' LIMIT 1`);
            if (r && r.Body != null) return { content: r.Body, path: mapping.path };
        } else if (mapping.type === 'ApexPage') {
            const r = await q1(`SELECT Id, Name, Markup FROM ApexPage WHERE Name = '${safe(mapping.member)}' LIMIT 1`);
            if (r && r.Markup != null) return { content: r.Markup, path: mapping.path };
        } else if (mapping.type === 'AuraDefinitionBundle') {
            const ext = mapping.path.split('.').pop().toLowerCase();
            const defTypes = { cmp: 'COMPONENT', evt: 'EVENT', intf: 'INTERFACE', app: 'APPLICATION', auradoc: 'DOCUMENTATION', design: 'DESIGN' };
            const r = await q1(`SELECT Id, Source, DefType FROM AuraDefinition WHERE AuraDefinitionBundle.DeveloperName = '${safe(mapping.member)}' AND DefType = '${defTypes[ext] || 'COMPONENT'}' LIMIT 1`);
            if (r && r.Source != null) return { content: r.Source, path: mapping.path };
        } else if (mapping.type === 'LightningComponentBundle') {
            const fileName = mapping.path.split('/').pop();
            const r = await q1(`SELECT Id, Source, FilePath FROM LightningComponentResource WHERE LightningComponentBundle.DeveloperName = '${safe(mapping.member)}' AND FilePath LIKE '%/${safe(fileName)}' LIMIT 1`);
            if (r && r.Source != null) return { content: r.Source, path: mapping.path };
        } else {
            return await retrieveOrgFileLive(mapping);
        }
    } catch (e) {
        console.warn('salesforce comet: live org fetch failed for ' + filePath, e);
    }

    // Source types whose Tooling query failed — try the targeted retrieve once
    try {
        return await retrieveOrgFileLive(mapping);
    } catch (e) {
        console.warn('salesforce comet: targeted retrieve failed for ' + filePath, e);
    }
    return null;
}

function showFileContent(filePath, isLocalNode = false) {
    const emptyState = document.getElementById('retrieve-viewer-empty-state');
    if (emptyState) emptyState.style.display = 'none';
    currentSelectedFilePath = filePath;
    currentSelectedFileIsLocal = isLocalNode;
    
    // Normalize path for Windows compatibility
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Original (Source Org) content
    let originalContent = '// Not found in Source Org';
    // Match org files which have paths like 'classes/MyClass.cls' against potentially full local paths
    // Also handle flattened paths (e.g., 'classes/MyClass.cls')
    const orgFile = currentExtractedFiles.find(f => {
        const fPath = projectPathKey(f.path);
        const selectedPath = projectPathKey(normalizedPath);
        return selectedPath.endsWith(fPath) || fPath.endsWith(selectedPath);
    });
    if (orgFile) {
        originalContent = orgFile.content;
    } else {
        // The org version isn't in the retrieved package (e.g. the user loaded a
        // Local Project without retrieving the org first). Fetch just this file
        // live from Salesforce so the diff still shows the real org source.
        const fetchFileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        originalContent = `// Fetching ${fetchFileName} from the org...`;
        fetchOrgFileLive(filePath).then(fetched => {
            if (currentSelectedFilePath !== filePath) return; // user clicked another file meanwhile
            const diffModel = (window.monacoDiffEditor && window.monacoDiffEditor.getModel())
                ? window.monacoDiffEditor.getModel().original
                : null;
            if (!diffModel) return;
            if (fetched && fetched.content != null) {
                if (!currentExtractedFiles.some(f => f.path === fetched.path)) {
                    currentExtractedFiles.push({ path: fetched.path, content: fetched.content });
                }
                diffModel.setValue(normalizeComparisonContent(fetched.content));
                // Also refresh the standard (non-diff) editor when it's showing this org file
                if (!isDiffMode && window.monacoEditor && !currentSelectedFileIsLocal) {
                    const stdModel = window.monacoEditor.getModel();
                    if (stdModel) stdModel.setValue(fetched.content);
                }
            } else {
                const msg = currentExtractedFiles.length === 0
                    ? '// The org has not been retrieved yet and this file could not be fetched live.\n// Run "Retrieve Source" to pull the whole org, or select components and retrieve to compare.'
                    : '// This file could not be fetched from the org.\n// Make sure it exists in the org, or run "Retrieve Source" to include it in the comparison.';
                diffModel.setValue(msg);
                if (!isDiffMode && window.monacoEditor && !currentSelectedFileIsLocal) {
                    const stdModel = window.monacoEditor.getModel();
                    if (stdModel) stdModel.setValue(msg);
                }
            }
        }).catch(() => { });
    }
    
    // If it's NOT diff mode, just show the file they clicked (Org or Local)
    let editorContent = originalContent;
    if (isLocalNode) {
        // Try both original and normalized path for Windows compatibility
        editorContent = getLocalFile(normalizedPath) ?? '// Local file content unavailable';
    }
    
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    const leftTitle = document.getElementById('title-left');
    const rightTitle = document.getElementById('title-right');
    
    if (isDiffMode) {
        if (leftTitle) leftTitle.innerHTML = `☁️ Current Org (Retrieved) <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
        if (comparisonMode === 'local') {
            if (rightTitle) rightTitle.innerHTML = `📁 Local Project <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
        } else if (comparisonMode === 'dest_org') {
            if (rightTitle) rightTitle.innerHTML = `☁️ Destination Org <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
        } else {
            // When no comparison mode is set but diff is active, show appropriate default
            if (rightTitle) {
                // Check if we have local files available
                const hasLocalFiles = localFilesByKey.size > 0;
                if (hasLocalFiles) {
                    // Try to find the file in local files using normalized path
                    const localContent = getLocalFile(normalizedPath);
                    if (localContent !== undefined) {
                        rightTitle.innerHTML = `📁 Local Project <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
                        // Set comparison mode to local since we found the file
                        comparisonMode = 'local';
                    } else {
                        rightTitle.innerHTML = `📄 Compared Code <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
                    }
                } else {
                    rightTitle.innerHTML = `📄 Compared Code <span style="color:#71717a; margin-left: 4px;">— ${escapeHtml(fileName)}</span>`;
                }
            }
        }
    } else if (leftTitle) {
        leftTitle.textContent = `📄 ${filePath}`;
    }
    
    let lang = 'xml';
    if (filePath.endsWith('.cls') || filePath.endsWith('.trigger')) lang = 'apex';
    else if (filePath.endsWith('.js')) lang = 'javascript';
    else if (filePath.endsWith('.css')) lang = 'css';
    else if (filePath.endsWith('.html')) lang = 'html';
    
    // Use lightweight viewer if Monaco not loaded yet
    if (!isMonacoReady && !window.monacoEditor && !window.monacoDiffEditor) {
        const stdContainer = document.getElementById('monaco-standard-editor');
        if (stdContainer && window.sfarcLightweightViewer) {
            window.sfarcLightweightViewer.create(stdContainer, editorContent, lang);
            // Start loading Monaco in background for future use
            loadMonacoEditor().then(() => {
                // Monaco loaded - if user is still viewing this file, upgrade to Monaco
                if (currentSelectedFilePath === filePath) {
                    showFileContent(filePath, isLocalNode);
                }
            }).catch(() => {});
        }
    } else if (window.monacoEditor) {
        if (window.monacoEditor.getModel()) window.monacoEditor.getModel().dispose();
        const model = monaco.editor.createModel(editorContent, lang);
        window.monacoEditor.setModel(model);
    }
    
    if (window.monacoDiffEditor) {
        const models = window.monacoDiffEditor.getModel();
        if (models) {
            if (models.original) models.original.dispose();
            if (models.modified) models.modified.dispose();
        }
        
        const originalModel = monaco.editor.createModel(normalizeComparisonContent(originalContent), lang);
        let modifiedContent = isDiffMode ? '' : editorContent;
        
        if (isDiffMode && comparisonMode === 'local') {
            // Try both original and normalized path for Windows compatibility
            modifiedContent = getLocalFile(normalizedPath) ?? ('// File not found in Local Project: ' + filePath);
        } else if (isDiffMode && comparisonMode === 'dest_org') {
            // Find destination file
            const selectedKey = projectPathKey(filePath);
            const destFile = destinationExtractedFiles.find(f => selectedKey.endsWith(projectPathKey(f.path)) || projectPathKey(f.path).endsWith(selectedKey));
            if (destFile) {
                modifiedContent = destFile.content;
            } else {
                modifiedContent = '// File not found in Destination Org: ' + filePath;
            }
        }
        
        // Track the initial (unmodified) content of the editable side so the
        // Validate XML button only appears after the user actually edits the file.
        currentFileOriginalContent = modifiedContent;
        currentFileIsXml = isXmlFile(filePath);
        
        const modifiedModel = monaco.editor.createModel(normalizeComparisonContent(modifiedContent), lang);
        window.monacoDiffEditor.setModel({
            original: originalModel,
            modified: modifiedModel
        });
        
        try {
            modifiedModel.onDidChangeContent(() => {
                updateValidateXmlButton();
                clearXmlMarkers(modifiedModel);
            });
        } catch (e) { }
        updateValidateXmlButton();
    } else if (isDiffMode) {
        // Diff mode requested but Monaco not loaded yet - show lightweight diff
        loadMonacoEditor().then(() => {
            if (currentSelectedFilePath === filePath && isDiffMode) {
                showFileContent(filePath, isLocalNode);
            }
        }).catch(() => {});
        // Show loading state
        const diffWrapper = document.getElementById('monaco-diff-wrapper');
        if (diffWrapper) {
            diffWrapper.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #71717a; font-size: 13px;">Loading diff editor...</div>';
        }
    }
    
    const copyBtn = document.getElementById('copy-retrieve-file-btn');
    if (copyBtn) {
        copyBtn.style.display = 'flex';
        copyBtn.onclick = () => {
            const text = isDiffMode && window.monacoDiffEditor
                ? window.monacoDiffEditor.getModel().modified.getValue()
                : (window.monacoEditor ? window.monacoEditor.getValue() : originalContent);
            copyToClipboard(text, 'copy-retrieve-file-btn');
        };
    }

    // Download the currently displayed file (same content source as Copy).
    const downloadBtn = document.getElementById('download-retrieve-file-btn');
    if (downloadBtn) {
        downloadBtn.style.display = 'flex';
        downloadBtn.onclick = () => {
            const text = isDiffMode && window.monacoDiffEditor
                ? window.monacoDiffEditor.getModel().modified.getValue()
                : (window.monacoEditor ? window.monacoEditor.getValue() : originalContent);
            try {
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                window.toast.success(`Downloaded ${fileName}`);
            } catch (e) {
                console.error('Download Error', e);
                window.toast.error('Error downloading file: ' + e.message);
            }
        };
    }

    // Validate the current file (XML / HTML / Apex / JS / CSS) before saving.
    // Hidden in diff mode — the diff bar has its own "Validate XML" button.
    const validateBtn = document.getElementById('validate-retrieve-file-btn');
    if (validateBtn) {
        validateBtn.style.display = isDiffMode ? 'none' : 'flex';
        validateBtn.onclick = validateCurrentFile;
    }
    
    const diffToggleBtn = document.getElementById('toggle-diff-btn');
    if (diffToggleBtn) diffToggleBtn.style.display = 'flex';
}



// Monaco Editor - Lazy loaded when first needed
let monacoLoadPromise = null;

function loadMonacoEditor() {
    if (monacoLoadPromise) return monacoLoadPromise;
    
    monacoLoadPromise = new Promise((resolve, reject) => {
        // Dynamically load Monaco loader if not already loaded
        if (!window.require || !window.require.config) {
            const script = document.createElement('script');
            script.src = '../lib/monaco-editor/min/vs/loader.js';
            script.onload = () => {
                require.config({ paths: { 'vs': '../lib/monaco-editor/min/vs' } });
                initMonaco(resolve);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        } else {
            require.config({ paths: { 'vs': '../lib/monaco-editor/min/vs' } });
            initMonaco(resolve);
        }
    });
    
    return monacoLoadPromise;
}

function initMonaco(resolve) {
    require(['vs/editor/editor.main'], function () {
        isMonacoReady = true;

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

        const stdContainer = document.getElementById('monaco-standard-editor');
        if (stdContainer) {
            window.monacoEditor = monaco.editor.create(stdContainer, {
                value: '/* Select a file from the Explorer to view its source */',
                language: 'apex',
                theme: 'vs-dark',
                automaticLayout: true,
                readOnly: true
            });
        }
        
        const diffContainer = document.getElementById('monaco-diff-editor');
        if (diffContainer) {
            window.monacoDiffEditor = monaco.editor.createDiffEditor(diffContainer, {
                theme: 'vs-dark',
                automaticLayout: true,
                renderMarginRevertIcon: true,
                enableSplitViewResizing: true,
                renderSideBySide: true,
                originalEditable: false,
                readOnly: false,
                glyphMargin: true,
                renderIndicators: true,
                useInlineViewWhenSpaceIsLimited: false
            });
        }
        
        resolve();
    });
}

// Diff Mode Listeners

let localExtractedFiles = [];

// Package.xml components filter for selective loading
let packageXmlComponents = null; // { ApexClass: ['AccountBatch', ...], ... }
let packageXmlFilterEnabled = false;

// Parse package.xml to extract component list
function parsePackageXml(xmlContent) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');
        
        const parseError = doc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            throw new Error('Invalid XML format');
        }
        
        const components = {};
        const types = doc.getElementsByTagName('types');
        
        for (let i = 0; i < types.length; i++) {
            const typeNode = types[i];
            const nameNode = typeNode.getElementsByTagName('name')[0];
            if (!nameNode) continue;
            
            const typeName = nameNode.textContent.trim();
            const members = [];
            const memberNodes = typeNode.getElementsByTagName('members');
            
            for (let j = 0; j < memberNodes.length; j++) {
                const memberName = memberNodes[j].textContent.trim();
                if (memberName && memberName !== '*') {
                    members.push(memberName);
                }
            }
            
            if (members.length > 0) {
                components[typeName] = members;
            }
        }
        
        return components;
    } catch (e) {
        console.error('Failed to parse package.xml:', e);
        return null;
    }
}

// Check if a file matches the package.xml filter. Compare case-insensitively
// because Windows project paths do not preserve a meaningful case contract.
function matchesPackageXmlFilter(filePath, typeName) {
    if (!packageXmlFilterEnabled || !packageXmlComponents) return true;
    
    const members = packageXmlComponents[typeName];
    if (!members) return false; // Type not in package.xml
    
    // Check if any member matches the file path
    const normalizedPath = normalizeProjectPath(filePath);
    const fileName = normalizedPath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase(); // Remove extension
    return members.some(member => {
        const normalizedMember = normalizeProjectPath(member).toLowerCase();
        const memberFileName = normalizedMember.split('/').pop();
        return fileName === memberFileName || normalizedPath.toLowerCase().includes(normalizedMember);
    });
}

// Initialize package.xml import handlers
function initPackageXmlImport() {
    const importBtn = document.getElementById('import-package-xml-btn');
    const pasteBtn = document.getElementById('paste-package-xml-btn');
    const fileInput = document.getElementById('package-xml-file-input');
    const statusDiv = document.getElementById('package-xml-status');
    const container = document.getElementById('package-xml-import-container');
    const pasteModal = document.getElementById('paste-xml-modal');
    const pasteTextarea = document.getElementById('paste-xml-textarea');
    const closePasteModal = document.getElementById('close-paste-xml-modal');
    const cancelPasteBtn = document.getElementById('cancel-paste-xml-btn');
    const applyPasteBtn = document.getElementById('apply-paste-xml-btn');
    
    if (!importBtn || !fileInput) return;
    
    // Show import container when local project is selected
    const compareSelect = document.getElementById('compare-target-select');
    if (compareSelect) {
        compareSelect.addEventListener('change', (e) => {
            if ((e.target.value === 'local' || e.target.value === 'local_zip' || e.target.value.startsWith('pipeline_')) && container) {
                container.style.display = 'block';
            } else if (container) {
                container.style.display = 'none';
            }
        });
    }
    
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const content = await file.text();
            await applyPackageXmlFilter(content);
        } catch (e) {
            window.toast.error('Failed to read package.xml: ' + e.message);
            console.error(e);
        }
        
        // Reset file input
        fileInput.value = '';
    });
    
    // Paste package.xml modal handlers
    if (pasteBtn && pasteModal) {
        pasteBtn.addEventListener('click', () => {
            pasteModal.style.display = 'flex';
            if (pasteTextarea) {
                pasteTextarea.value = '';
                pasteTextarea.focus();
            }
        });
        
        const closeModal = () => {
            pasteModal.style.display = 'none';
        };
        
        if (closePasteModal) closePasteModal.addEventListener('click', closeModal);
        if (cancelPasteBtn) cancelPasteBtn.addEventListener('click', closeModal);
        
        // Close on overlay click
        pasteModal.addEventListener('click', (e) => {
            if (e.target === pasteModal) closeModal();
        });
        
        if (applyPasteBtn && pasteTextarea) {
            applyPasteBtn.addEventListener('click', async () => {
                const content = pasteTextarea.value.trim();
                if (!content) {
                    window.toast.warning('Please paste package.xml content');
                    return;
                }
                closeModal();
                await applyPackageXmlFilter(content);
            });
            
            // Ctrl+Enter to apply
            pasteTextarea.addEventListener('keydown', async (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    applyPasteBtn.click();
                }
            });
        }
    }
}

// Apply package.xml filter from content string
async function applyPackageXmlFilter(content) {
    const statusDiv = document.getElementById('package-xml-status');
    
    const components = parsePackageXml(content);
    
    if (components && Object.keys(components).length > 0) {
        packageXmlComponents = components;
        packageXmlFilterEnabled = true;
        
        const totalComponents = Object.values(components).reduce((sum, arr) => sum + arr.length, 0);
        const totalTypes = Object.keys(components).length;
        
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `<span style="color: #10b981;">\u2713</span> Loaded: ${totalTypes} types, ${totalComponents} components`;
        }
        
        window.toast.success(`Package.xml loaded: ${totalTypes} types, ${totalComponents} components will be filtered`);
        
        // Re-scan local folder with filter
        if (comparisonMode === 'local') {
            await rescanLocalWithFilter();
        }
    } else {
        window.toast.warning('No components found in package.xml');
    }
}

// Re-scan local folder with package.xml filter
async function rescanLocalWithFilter() {
    // Clear old local state
    for (const key in localFileHandles) delete localFileHandles[key];
    for (const key in localFiles) delete localFiles[key];
    localFilesByKey.clear();
    localExtractedFiles = [];
    
    // Re-scan with filter applied
    if (window.currentLocalDirHandle) {
        await scanLocalDirectory(window.currentDirHandle || window.currentLocalDirHandle);
        
        const localFileTree = buildTreeFromJsonPaths(localExtractedFiles);
        renderExplorerTree(localFileTree, false);
        
        window.toast.success(`Filtered to ${localExtractedFiles.length} matching files`);
    }
}

// Map metadata type names to folder names
const TYPE_TO_FOLDER = {
    'ApexClass': 'classes',
    'ApexTrigger': 'triggers',
    'ApexPage': 'pages',
    'ApexComponent': 'components',
    'LightningComponentBundle': 'lwc',
    'AuraDefinitionBundle': 'aura',
    'CustomObject': 'objects',
    'CustomField': 'objects',
    'Layout': 'layouts',
    'PermissionSet': 'permissionsets',
    'Profile': 'profiles',
    'CustomTab': 'tabs',
    'Flow': 'flows',
    'ValidationRule': 'objects',
    'Workflow': 'workflows',
    'CustomMetadata': 'customMetadata',
    'EmailTemplate': 'email',
    'StaticResource': 'staticresources',
    'ApexTestSuite': 'testSuites'
};

async function selectLocalProjectFolder() {
    try {
        if (typeof window.showDirectoryPicker !== 'function') {
            await selectLocalProjectFolderFallback();
            return;
        }
        const dirHandle = await window.showDirectoryPicker({
            mode: 'read'
        });
        
        // Store directory handle for re-scanning
        window.currentLocalDirHandle = dirHandle;
        
        // Clear old local state
        for (const key in localFileHandles) delete localFileHandles[key];
        for (const key in localFiles) delete localFiles[key];
        localFilesByKey.clear();
        localExtractedFiles = [];
        
        await scanLocalDirectory(dirHandle);
        
        const localFileTree = buildTreeFromJsonPaths(localExtractedFiles);
        renderExplorerTree(localFileTree, false);
        
        window.toast.success(`Local project mapped: ${localExtractedFiles.length} files`);
        
        const localOption = document.querySelector('#compare-target-select option[value="local"]');
        if (localOption) {
            localOption.textContent = `Local: ${dirHandle.name}`;
            const valueSpan = document.querySelector('#compare-target-select').parentNode.querySelector('.sfarc-custom-dropdown-value');
            if (valueSpan) valueSpan.textContent = `Local: ${dirHandle.name}`;
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            window.toast.error('Failed to select local folder: ' + e.message);
            console.error(e);
        }
        // Reset the dropdown
        document.getElementById('compare-target-select').value = 'none';
        comparisonMode = 'none';
        
        // Restore Org Tree
        const orgFileTree = buildTreeFromJsonPaths(currentExtractedFiles);
        renderExplorerTree(orgFileTree, false);
    }
}

async function selectLocalProjectFolderFallback() {
    const input = document.getElementById('local-project-folder-input');
    if (!input) throw new Error('Folder selection is unavailable. Use Azure DevOps / Project ZIP instead.');
    input.value = '';
    const files = await new Promise(resolve => {
        input.onchange = () => resolve(Array.from(input.files || []));
        input.click();
    });
    if (!files.length) return;
    resetLocalProjectState();
    const accepted = files.filter(file => {
        const path = file.webkitRelativePath || file.name;
        return !shouldIgnoreProjectPath(path) && passesPackageFilter(path);
    });
    const batchSize = 24;
    for (let start = 0; start < accepted.length; start += batchSize) {
        const batch = accepted.slice(start, start + batchSize);
        const loaded = await Promise.all(batch.map(async file => ({file, content: await file.text()})));
        loaded.forEach(({file, content}) => registerLocalProjectFile(file.webkitRelativePath || file.name, content));
        updateLocalImportProgress('Reading Windows project files…', Math.min(start + batch.length, accepted.length), accepted.length);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    renderExplorerTree(buildTreeFromJsonPaths(localExtractedFiles), false);
    updateLocalImportProgress('', accepted.length, accepted.length);
    window.toast.success(`Local project mapped: ${accepted.length.toLocaleString()} files (read-only browser fallback)`);
}

function updateLocalImportProgress(label, done = 0, total = 0) {
    const panel = document.getElementById('local-import-progress');
    const labelEl = document.getElementById('local-import-progress-label');
    const countEl = document.getElementById('local-import-progress-count');
    const bar = document.getElementById('local-import-progress-bar');
    if (!panel) return;
    panel.style.display = label ? 'block' : 'none';
    if (labelEl) labelEl.textContent = label || '';
    const percent = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
    if (countEl) countEl.textContent = total > 0 ? `${done.toLocaleString()} / ${total.toLocaleString()} · ${percent}%` : '';
    if (bar) bar.style.width = `${percent}%`;
}

function resetLocalProjectState() {
    for (const key in localFileHandles) delete localFileHandles[key];
    for (const key in localFiles) delete localFiles[key];
    localFilesByKey.clear();
    localExtractedFiles = [];
}

function shouldIgnoreProjectPath(path) {
    const segments = normalizeProjectPath(path).toLowerCase().split('/');
    return segments.some(part => ['.git', 'node_modules', '.sfdx', '.sf', '.vscode'].includes(part));
}

function projectRelativePath(fullPath) {
    const parts = normalizeProjectPath(fullPath).split('/');
    const lower = parts.map(part => part.toLowerCase());
    const defaultIndex = lower.indexOf('default');
    const srcIndex = lower.indexOf('src');
    if (defaultIndex !== -1) return parts.slice(defaultIndex + 1).join('/');
    if (srcIndex !== -1) return parts.slice(srcIndex + 1).join('/');
    const validDirs = ['classes', 'objects', 'triggers', 'lwc', 'aura', 'pages', 'components', 'tabs', 'profiles', 'permissionsets', 'flows', 'layouts'];
    const dirIndex = lower.findIndex(part => validDirs.includes(part));
    return dirIndex !== -1 ? parts.slice(dirIndex).join('/') : null;
}

function passesPackageFilter(path) {
    if (!packageXmlFilterEnabled || !packageXmlComponents) return true;
    const parts = normalizeProjectPath(path).split('/');
    const lower = parts.map(part => part.toLowerCase());
    const folderName = Object.values(TYPE_TO_FOLDER).find(folder => lower.includes(folder.toLowerCase()));
    const typeName = Object.keys(TYPE_TO_FOLDER).find(type => TYPE_TO_FOLDER[type].toLowerCase() === String(folderName || '').toLowerCase());
    return !typeName || matchesPackageXmlFilter(path, typeName);
}

function registerLocalProjectFile(path, content, handle = null) {
    const normalized = normalizeProjectPath(path);
    setLocalFile(normalized, content, handle);
    const relative = projectRelativePath(normalized);
    if (relative) setLocalFile(relative, content, handle);
    localExtractedFiles.push({path: normalized, content, isLocal: true});
}

async function collectDirectoryFiles(dirHandle, pathPrefix, output) {
    for await (const entry of dirHandle.values()) {
        const fullPath = normalizeProjectPath(pathPrefix + entry.name);
        if (shouldIgnoreProjectPath(fullPath)) continue;
        if (entry.kind === 'file') {
            if (passesPackageFilter(fullPath)) output.push({path: fullPath, handle: entry});
        } else if (entry.kind === 'directory') {
            await collectDirectoryFiles(entry, fullPath + '/', output);
        }
        if (output.length && output.length % 250 === 0) {
            updateLocalImportProgress(`Scanning project… ${output.length.toLocaleString()} files found`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}

async function scanLocalDirectory(dirHandle) {
    const pending = [];
    updateLocalImportProgress('Scanning project folders…');
    await collectDirectoryFiles(dirHandle, '', pending);
    const batchSize = 24;
    for (let start = 0; start < pending.length; start += batchSize) {
        const batch = pending.slice(start, start + batchSize);
        const loaded = await Promise.all(batch.map(async item => {
            const file = await item.handle.getFile();
            return {item, content: await file.text()};
        }));
        loaded.forEach(({item, content}) => registerLocalProjectFile(item.path, content, item.handle));
        updateLocalImportProgress('Reading and indexing project files…', Math.min(start + batch.length, pending.length), pending.length);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    updateLocalImportProgress('', pending.length, pending.length);
}

async function selectLocalProjectZip(providerLabel = 'Pipeline Artifact', optionValue = 'local_zip') {
    const input = document.getElementById('local-project-zip-input');
    if (!input) return;
    input.value = '';
    const file = await new Promise(resolve => {
        input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
        input.click();
    });
    if (!file) return;
    try {
        resetLocalProjectState();
        updateLocalImportProgress(`Opening ${providerLabel}…`);
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(entry => !entry.dir && !shouldIgnoreProjectPath(entry.name) && passesPackageFilter(entry.name));
        const batchSize = 20;
        for (let start = 0; start < entries.length; start += batchSize) {
            const batch = entries.slice(start, start + batchSize);
            const loaded = await Promise.all(batch.map(async entry => ({entry, content: await entry.async('string')})));
            loaded.forEach(({entry, content}) => registerLocalProjectFile(entry.name, content));
            updateLocalImportProgress(`Extracting ${providerLabel}…`, Math.min(start + batch.length, entries.length), entries.length);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        renderExplorerTree(buildTreeFromJsonPaths(localExtractedFiles), false);
        updateLocalImportProgress('', entries.length, entries.length);
        window.toast.success(`${providerLabel} mapped: ${entries.length.toLocaleString()} files`);
        const option = document.querySelector(`#compare-target-select option[value="${optionValue}"]`);
        if (option) option.textContent = `${providerLabel.replace(/\s+Artifact ZIP$/i, '')}: ${file.name}`;
    } catch (error) {
        updateLocalImportProgress('');
        window.toast.error('Failed to import project ZIP: ' + error.message);
        comparisonMode = 'none';
    }
}

document.getElementById('hide-explorer-btn').addEventListener('click', () => {
    document.querySelector('#retrieve-viewer-view .left-pane').style.display = 'none';
    const resizer = document.getElementById('explorer-resizer');
    if (resizer) resizer.style.display = 'none';
    document.getElementById('show-explorer-btn').style.display = 'flex';
});

document.getElementById('show-explorer-btn').addEventListener('click', () => {
    document.querySelector('#retrieve-viewer-view .left-pane').style.display = 'flex';
    const resizer = document.getElementById('explorer-resizer');
    if (resizer) resizer.style.display = 'block';
    document.getElementById('show-explorer-btn').style.display = 'none';
});

document.getElementById('toggle-diff-btn').addEventListener('click', async (e) => {
    isDiffMode = !isDiffMode;
    const btn = e.currentTarget;
    if (isDiffMode) {
        btn.classList.add('sfarc-active');
        btn.style.background = getComputedStyle(document.documentElement).getPropertyValue('--sfarc-accent').trim() || '#2196f3';
        btn.style.color = '#fff';
        const stdEditor = document.getElementById('monaco-standard-editor');
        const diffWrapper = document.getElementById('monaco-diff-wrapper');
        const titleRight = document.getElementById('title-right');
        if (stdEditor) stdEditor.style.display = 'none';
        if (diffWrapper) diffWrapper.style.display = 'flex';
        btn.classList.add('sfarc-active');
        if (titleRight) titleRight.style.display = 'flex';
        
        if (currentSelectedFilePath !== null) showFileContent(currentSelectedFilePath, currentSelectedFileIsLocal);
        
        const syncBtn = document.getElementById('sync-local-btn');
        if (syncBtn) syncBtn.style.display = (comparisonMode === 'local') ? 'flex' : 'none';
        // Diff mode has its own "Validate XML" button in the diff bar — hide
        // the top-header Validate so the two don't stack into two rows.
        const topValidate = document.getElementById('validate-retrieve-file-btn');
        if (topValidate) topValidate.style.display = 'none';
    } else {
        btn.classList.remove('sfarc-active');
        btn.style.background = '';
        btn.style.color = '';
        const stdEditor = document.getElementById('monaco-standard-editor');
        const diffWrapper = document.getElementById('monaco-diff-wrapper');
        const titleRight = document.getElementById('title-right');
        if (stdEditor) stdEditor.style.display = 'block';
        if (diffWrapper) diffWrapper.style.display = 'none';
        btn.classList.remove('sfarc-active');
        if (titleRight) titleRight.style.display = 'none';
        
        if (currentSelectedFilePath !== null) showFileContent(currentSelectedFilePath, currentSelectedFileIsLocal);
        
        const syncBtn = document.getElementById('sync-local-btn');
        if (syncBtn) syncBtn.style.display = 'none';
        // Back to standard mode: restore the top-header Validate button.
        const topValidate = document.getElementById('validate-retrieve-file-btn');
        if (topValidate && currentSelectedFilePath !== null) topValidate.style.display = 'flex';
    }
});

const validateXmlBtn = document.getElementById('validate-xml-btn');
if (validateXmlBtn) {
    validateXmlBtn.addEventListener('click', validateCurrentXml);
}

const validateRetrieveBtn = document.getElementById('validate-retrieve-file-btn');
if (validateRetrieveBtn) {
    validateRetrieveBtn.addEventListener('click', validateCurrentFile);
}

document.getElementById('sync-local-btn').addEventListener('click', async () => {
    // Validate before saving: if the file has tag/structure errors, ask the
    // user whether to fix them first or save anyway.
    const preSaveError = validateCurrentFile();
    if (preSaveError) {
        const proceed = window.confirm(
            `Validation found an error in ${getLanguageLabel(getFileLanguage(currentSelectedFilePath))}:\n\n` +
            `${preSaveError.message} (line ${preSaveError.line})\n\n` +
            'Save anyway?'
        );
        if (!proceed) return;
    }
    if (!window.monacoDiffEditor || !isDiffMode) return;
    let fileContent = '';
    if (currentSelectedFileIsLocal) {
        fileContent = getLocalFile(currentSelectedFilePath) || '';
    } else {
        const file = currentExtractedFiles.find(f => f.path === currentSelectedFilePath);
        fileContent = file ? file.content : '';
    }
    
    if (!fileContent) return;
    
    // Attempt to find handle using either the direct path or the flattened path if needed
    let handle = localFileHandles[currentSelectedFilePath];
    if (!handle && !currentSelectedFileIsLocal) {
        // If they selected from the Org tree, the path is flattened (e.g. classes/A.cls)
        // Find the matching full path in localFileHandles
        const selectedKey = projectPathKey(currentSelectedFilePath);
        const fullPathKey = Object.keys(localFileHandles).find(k => projectPathKey(k).endsWith(selectedKey));
        if (fullPathKey) handle = localFileHandles[fullPathKey];
    }
    if (!handle) {
        window.toast.error('No matching local file found to save to!');
        return;
    }
    
    try {
        const writable = await handle.createWritable();
        const content = window.monacoDiffEditor.getModel().modified.getValue();
        await writable.write(content);
        await writable.close();
        
        setLocalFile(currentSelectedFilePath, content, handle);
        
        const btn = document.getElementById('sync-local-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span style="color: #22c55e;">Saved!</span>`;
        btn.style.borderColor = '#22c55e';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.borderColor = '';
        }, 2000);
        
        window.toast.success('Code saved successfully to local file!');
    } catch (err) {
        console.error(err);
        window.toast.error('Failed to sync to local: ' + err.message);
    }
});

// Explorer pane resizer logic (VS Code style — visible divider + centered grip)
const resizer = document.getElementById('explorer-resizer');
const leftPane = document.querySelector('#retrieve-viewer-view .left-pane');
let isResizing = false;

const RESIZE_STORAGE_KEY = 'sfarc-explorer-pane-width';
const applyExplorerWidth = (width) => {
    leftPane.style.flex = `0 0 ${width}px`;
    leftPane.style.width = `${width}px`;
    try { localStorage.setItem(RESIZE_STORAGE_KEY, String(width)); } catch (e) { /* ignore */ }
    // Notify Monaco that the container size changed so it redraws
    if (window.monacoEditor) { window.monacoEditor.layout(); }
    if (window.monacoDiffEditor) { window.monacoDiffEditor.layout(); }
};

if (resizer && leftPane) {
    // Restore persisted width (default 250)
    let savedWidth = 250;
    try {
        const stored = localStorage.getItem(RESIZE_STORAGE_KEY);
        if (stored) {
            const num = parseInt(stored, 10);
            if (!isNaN(num) && num >= 150 && num <= 600) savedWidth = num;
        }
    } catch (e) { /* ignore */ }
    applyExplorerWidth(savedWidth);

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('is-resizing');
        document.body.classList.add('is-resizing');
        e.preventDefault(); // prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Calculate new width based on mouse position relative to the window
        const containerRect = leftPane.parentElement.getBoundingClientRect();
        let newWidth = e.clientX - containerRect.left;

        // Apply constraints
        if (newWidth < 150) newWidth = 150;
        if (newWidth > 600) newWidth = 600;

        applyExplorerWidth(newWidth);
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('is-resizing');
            document.body.classList.remove('is-resizing');
        }
    });

    // Double-click resets the pane to its default width
    resizer.addEventListener('dblclick', () => {
        applyExplorerWidth(250);
    });
}
