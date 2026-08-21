// DevTools - In-Browser Apex/LWC Development
let devToolsCache = {
    apexClasses: [],
    apexTriggers: [],
    selectedCode: null,
    lastUpdate: null
};

// Load DevTools content
async function loadDevToolsContent() {
    const content = document.getElementById('sfarc-content');

    content.innerHTML = `
        <div class="sfarc-devtools-container">
            <!-- DevTools Tabs -->
            <div class="sfarc-devtools-tabs">
                <button class="sfarc-devtools-tab sfarc-active" data-devtab="apex">Apex Code</button>
                <button class="sfarc-devtools-tab" data-devtab="tests">Apex Tests</button>
                <button class="sfarc-devtools-tab" data-devtab="lwc">LWC</button>
            </div>

            <!-- Apex Code Tab -->
            <div class="sfarc-devtools-content" id="devtools-apex" style="display: block;">
                <div class="sfarc-devtools-header">
                    <div class="sfarc-devtools-search-bar">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <input type="text" id="apex-search" placeholder="Search Apex classes and triggers..." />
                    </div>
                    <div class="sfarc-devtools-filters">
                        <select id="apex-type-filter">
                            <option value="all">All Types</option>
                            <option value="class">Classes Only</option>
                            <option value="trigger">Triggers Only</option>
                        </select>
                        <button id="apex-refresh-btn" title="Refresh">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                    </div>
                </div>

                <div class="sfarc-devtools-main">
                    <!-- Code List -->
                    <div class="sfarc-code-list" id="apex-code-list">
                        <div class="sfarc-loading">Loading Apex code...</div>
                    </div>

                    <!-- Code Viewer -->
                    <div class="sfarc-code-viewer" id="apex-code-viewer">
                        <div class="sfarc-code-viewer-empty">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 18L9 24L15 30M33 18L39 24L33 30M27 12L21 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <p>Select a class or trigger to view code</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tests Tab -->
            <div class="sfarc-devtools-content" id="devtools-tests" style="display: none;">
                <div class="sfarc-empty-state">
                    <p>Test runner coming soon!</p>
                    <small>Will support running tests and viewing code coverage</small>
                </div>
            </div>

            <!-- LWC Tab -->
            <!-- LWC Tab -->
            <div class="sfarc-devtools-content" id="devtools-lwc" style="display: none;">
                <div class="sfarc-devtools-header">
                     <div class="sfarc-control-group" style="display:flex; gap: 10px; align-items: center;">
                        <button class="sfarc-code-action-btn" style="width: 32px; height: 32px; padding: 0; justify-content: center; border-radius: 50%;" title="Refresh">
                             <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                     </div>
                </div>
                <div class="sfarc-empty-state">
                    <p>LWC Manager coming soon!</p>
                    <small>External builders are available above.</small>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.querySelectorAll('.sfarc-devtools-tab').forEach(tab => {
        tab.addEventListener('click', handleDevToolsTabClick);
    });

    document.getElementById('apex-search').addEventListener('input', filterApexCode);
    document.getElementById('apex-type-filter').addEventListener('change', filterApexCode);

    // Event delegation for dynamic items
    content.addEventListener('click', (e) => {
        // View Code
        const codeItem = e.target.closest('.sfarc-view-apex-code');
        if (codeItem) {
            const id = codeItem.dataset.id;
            const type = codeItem.dataset.type;
            if (window.viewApexCode) window.viewApexCode(id, type);
            return;
        }

        // Copy Code
        const copyBtn = e.target.closest('.sfarc-copy-apex-code');
        if (copyBtn) {
            if (window.copyApexCode) window.copyApexCode();
            return;
        }

        // Tab click handled by direct listener above
    });
    document.getElementById('apex-refresh-btn').addEventListener('click', () => loadApexCode(true));

    // Spin LWC refresh placeholder button
    const lwcRefreshBtn = content.querySelector('#devtools-lwc .sfarc-code-action-btn');
    if (lwcRefreshBtn) {
        lwcRefreshBtn.addEventListener('click', () => {
            const icon = lwcRefreshBtn.querySelector('.fa-arrows-rotate');
            if (icon) {
                icon.classList.add('fa-spin');
                setTimeout(() => icon.classList.remove('fa-spin'), 600);
            }
        });
    }

    // Initial load
    await loadApexCode(true);
}

// Handle DevTools tab switching
function handleDevToolsTabClick(e) {
    const tab = e.currentTarget.dataset.devtab;

    // Update tab states
    document.querySelectorAll('.sfarc-devtools-tab').forEach(t => t.classList.remove('sfarc-active'));
    e.currentTarget.classList.add('sfarc-active');

    // Show/hide content
    document.querySelectorAll('.sfarc-devtools-content').forEach(c => c.style.display = 'none');
    document.getElementById(`devtools-${tab}`).style.display = 'block';
}

// Load Apex code from org
async function loadApexCode(showLoading = false) {
    const btnRefresh = document.getElementById('apex-refresh-btn');
    let iconEl = null;
    if (btnRefresh) {
        iconEl = btnRefresh.querySelector('.fa-arrows-rotate');
        if (iconEl) iconEl.classList.add('fa-spin');
    }
    if (showLoading) {
        const list = document.getElementById('apex-code-list');
        if (list) list.innerHTML = '<div class="sfarc-loading">Loading Apex code...</div>';
    }

    try {
        // Query Apex Classes
        const classQuery = `
            SELECT Id, Name, Body, ApiVersion, Status, LengthWithoutComments,
                   LastModifiedDate, LastModifiedBy.Name, CreatedDate, CreatedBy.Name
            FROM ApexClass
            ORDER BY Name
        `;
        const classResult = await window.sfApi.query(classQuery, true); // Use Tooling API

        // Query Apex Triggers
        const triggerQuery = `
            SELECT Id, Name, Body, ApiVersion, Status, TableEnumOrId,
                   LastModifiedDate, LastModifiedBy.Name, CreatedDate, CreatedBy.Name
            FROM ApexTrigger
            ORDER BY Name
        `;
        const triggerResult = await window.sfApi.query(triggerQuery, true);

        // Combine and cache
        devToolsCache.apexClasses = (classResult.records || []).map(r => ({ ...r, type: 'class' }));
        devToolsCache.apexTriggers = (triggerResult.records || []).map(r => ({ ...r, type: 'trigger' }));
        devToolsCache.lastUpdate = new Date();

        // Render
        renderApexCodeList([...devToolsCache.apexClasses, ...devToolsCache.apexTriggers]);
    } catch (error) {
        console.error('Error loading Apex code:', error);
        const list = document.getElementById('apex-code-list');
        if (list) list.innerHTML = '<div class="sfarc-error-state">Failed to load Apex code. Please try again.</div>';
    } finally {
        if (iconEl) {
            setTimeout(() => {
                iconEl.classList.remove('fa-spin');
            }, 600);
        }
    }
}

// Render Apex code list
function renderApexCodeList(items) {
    const list = document.getElementById('apex-code-list');

    if (!items || items.length === 0) {
        list.innerHTML = '<div class="sfarc-empty-state">No Apex code found.</div>';
        return;
    }

    list.innerHTML = items.map(item => `
        <div class="sfarc-code-item sfarc-view-apex-code" data-id="${item.Id}" data-type="${item.type}">
            <div class="sfarc-code-item-header">
                <span class="sfarc-code-item-icon ${item.type === 'class' ? 'sfarc-icon-class' : 'sfarc-icon-trigger'}">
                    ${item.type === 'class' ? 'C' : 'T'}
                </span>
                <span class="sfarc-code-item-name">${escapeHtml(item.Name)}</span>
                ${item.Status === 'Inactive' ? '<span class="sfarc-code-status-inactive">Inactive</span>' : ''}
            </div>
            <div class="sfarc-code-item-meta">
                <span class="sfarc-code-meta-item">
                    ${item.LengthWithoutComments ? item.LengthWithoutComments + ' lines' : (item.type === 'trigger' ? 'Trigger' : 'Class')}
                </span>
                ${item.TableEnumOrId ? `<span class="sfarc-code-meta-item">On: ${item.TableEnumOrId}</span>` : ''}
                <span class="sfarc-code-meta-item">v${item.ApiVersion}</span>
            </div>
            <div class="sfarc-code-item-modified">
                Modified ${formatDateTime(item.LastModifiedDate)} by ${escapeHtml(item.LastModifiedBy?.Name || 'Unknown')}
            </div>
        </div>
    `).join('');
}

// Filter Apex code
function filterApexCode() {
    const searchTerm = document.getElementById('apex-search').value.toLowerCase();
    const typeFilter = document.getElementById('apex-type-filter').value;

    let items = [...devToolsCache.apexClasses, ...devToolsCache.apexTriggers];

    // Apply type filter
    if (typeFilter !== 'all') {
        items = items.filter(i => i.type === typeFilter);
    }

    // Apply search filter
    if (searchTerm) {
        items = items.filter(i =>
            i.Name.toLowerCase().includes(searchTerm) ||
            (i.TableEnumOrId && i.TableEnumOrId.toLowerCase().includes(searchTerm)) ||
            (i.LastModifiedBy?.Name && i.LastModifiedBy.Name.toLowerCase().includes(searchTerm))
        );
    }

    renderApexCodeList(items);
}

// View Apex code
async function viewApexCode(id, type) {
    const viewer = document.getElementById('apex-code-viewer');
    viewer.innerHTML = '<div class="sfarc-loading">Loading code...</div>';

    try {
        // Find the item in cache
        const allItems = [...devToolsCache.apexClasses, ...devToolsCache.apexTriggers];
        const item = allItems.find(i => i.Id === id);

        if (!item) {
            viewer.innerHTML = '<div class="sfarc-error-state">Code not found.</div>';
            return;
        }

        devToolsCache.selectedCode = item;

        // Render code viewer
        viewer.innerHTML = `
            <div class="sfarc-code-viewer-header">
                <div class="sfarc-code-viewer-title">
                    <span class="sfarc-code-item-icon ${type === 'class' ? 'sfarc-icon-class' : 'sfarc-icon-trigger'}">
                        ${type === 'class' ? 'C' : 'T'}
                    </span>
                    <h3>${escapeHtml(item.Name)}</h3>
                    ${item.Status === 'Inactive' ? '<span class="sfarc-code-status-inactive">Inactive</span>' : ''}
                </div>
                <div class="sfarc-code-viewer-actions">
                    <a href="${window.location.origin}/lightning/setup/${type === 'class' ? 'ApexClasses' : 'ApexTriggers'}/page?address=%2F${item.Id}" target="_blank" class="sfarc-code-action-btn" title="Open in Setup">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 1H13V4M13 1L7 7M6 1H2C1.44772 1 1 1.44772 1 2V12C1 12.5523 1.44772 13 2 13H12C12.5523 13 13 12.5523 13 12V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Open in Setup
                    </a>
                    <button class="sfarc-code-action-btn sfarc-copy-apex-code" title="Copy Code">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M3 10H2C1.44772 10 1 9.55228 1 9V2C1 1.44772 1.44772 1 2 1H9C9.55228 1 10 1.44772 10 2V3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        Copy
                    </button>
                </div>
            </div>
            <div class="sfarc-code-viewer-info">
                ${type === 'trigger' && item.TableEnumOrId ? `<span>On: <strong>${item.TableEnumOrId}</strong></span>` : ''}
                <span>API Version: <strong>${item.ApiVersion}</strong></span>
                <span>Created: <strong>${formatDateTime(item.CreatedDate)}</strong> by ${escapeHtml(item.CreatedBy?.Name || 'Unknown')}</span>
                <span>Modified: <strong>${formatDateTime(item.LastModifiedDate)}</strong> by ${escapeHtml(item.LastModifiedBy?.Name || 'Unknown')}</span>
            </div>
            <div class="sfarc-code-viewer-body">
                <pre><code class="language-apex">${escapeHtml(item.Body || '// No code available')}</code></pre>
            </div>
        `;

        // Highlight selected item in list
        document.querySelectorAll('.sfarc-code-item').forEach(el => el.classList.remove('selected'));
        document.querySelector(`.sfarc-code-item[data-id="${id}"]`)?.classList.add('selected');
    } catch (error) {
        console.error('Error viewing code:', error);
        viewer.innerHTML = '<div class="sfarc-error-state">Failed to load code.</div>';
    }
}

// Copy code to clipboard
function copyApexCode() {
    if (!devToolsCache.selectedCode) return;

    const code = devToolsCache.selectedCode.Body;
    navigator.clipboard.writeText(code).then(() => {
        alert('Code copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Make functions globally accessible
window.viewApexCode = viewApexCode;
window.copyApexCode = copyApexCode;
