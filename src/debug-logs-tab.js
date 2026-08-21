/* ── Debug Logs Tab — Full Page Log Reader ──────────────────────── */
(function () {
    'use strict';

    /* ── State ────────────────────────────────────────────────────── */
    let allLogs = [];
    let filteredLogs = [];
    let allTraceFlags = [];
    let currentPage = 1;
    const PAGE_SIZE = 50;
        let searchTimeout = null;

    /* ── DOM refs ─────────────────────────────────────────────────── */
    const $ = (id) => document.getElementById(id);
    const logList = $('log-list');
    const logCount = $('log-count');
    const searchInput = $('search-input');
    const userFilter = $('user-filter');
    const statusFilter = $('status-filter');
    const pageInfo = $('page-info');
    const btnPrev = $('btn-prev');
    const btnNext = $('btn-next');
    const btnRefresh = $('btn-refresh');
    const traceList = $('trace-list');
    const traceCount = $('trace-count');

    /* ── Init ─────────────────────────────────────────────────────── */
    async function init() {
        try {
            await window.sfApi.init();
        } catch (e) {
            console.error('Session init failed:', e);
            // The API logic will throw the session not ready error if it fails
        }
        populateUserFilter();
        await Promise.all([fetchTraceFlags(), fetchLogs()]);
        bindEvents();
        setupModals();
        
        setInterval(updateTraceCountdowns, 1000);
    }

    function bindEvents() {
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                const icon = btnRefresh.querySelector('svg, i');
                if (icon) icon.classList.add('refresh-spin');
                btnRefresh.style.opacity = '0.7';
                await fetchLogs();
                if (icon) icon.classList.remove('refresh-spin');
                btnRefresh.style.opacity = '1';
            });
        }

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 200);
        });

        userFilter.addEventListener('change', applyFilters);
        statusFilter.addEventListener('change', applyFilters);

        btnPrev.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; renderList(); }
        });

        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
            if (currentPage < totalPages) { currentPage++; renderList(); }
        });

        // Trace flags
        const btnAddTrace = $('btn-add-trace');
        const btnNewTrace = $('btn-new-trace');
        
        // Modal wiring will be handled in setupModals()

        const btnRefreshTraces = $('btn-refresh-traces');
        if (btnRefreshTraces) {
            btnRefreshTraces.addEventListener('click', async () => {
                const icon = btnRefreshTraces.querySelector('svg, i');
                if (icon) icon.classList.add('refresh-spin');
                await fetchTraceFlags();
                if (icon) icon.classList.remove('refresh-spin');
            });
        }

        const btnDeleteSelectedTraces = $('btn-delete-selected-traces');
        if (btnDeleteSelectedTraces) {
            btnDeleteSelectedTraces.addEventListener('click', async () => {
                const checked = Array.from(document.querySelectorAll('.trace-cb:checked')).map(cb => cb.value);
                if (checked.length === 0) {
                    toast.info('Please select at least one trace flag.');
                    return;
                }
                if (!confirm(`Delete ${checked.length} trace flag(s)?`)) return;
                
                const originalHtml = btnDeleteSelectedTraces.innerHTML;
                btnDeleteSelectedTraces.innerHTML = '<i class="fa-solid fa-circle-notch refresh-spin"></i>';
                btnDeleteSelectedTraces.disabled = true;
                
                try {
                    for (const id of checked) {
                        await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/TraceFlag/${id}`, { method: 'DELETE' });
                    }
                    toast.success(`Deleted ${checked.length} trace flag(s)`);
                    fetchTraceFlags();
                } catch(e) {
                    toast.error('Bulk delete failed: ' + e.message);
                }
                
                btnDeleteSelectedTraces.innerHTML = originalHtml;
                btnDeleteSelectedTraces.disabled = false;
            });
        }
        
        const traceFilterSelect = $('trace-filter-select');
        if (traceFilterSelect) {
            traceFilterSelect.addEventListener('change', () => {
                renderTraceFlags();
            });
        }

        // Sidebar collapse/expand
        const sidebar = document.querySelector('.sidebar');
        const btnToggleSidebar = $('btn-toggle-sidebar');
        const btnExpandSidebar = $('btn-expand-sidebar');
        const sidebarToggleIcon = $('sidebar-toggle-icon');
        if (btnToggleSidebar && sidebar) {
            btnToggleSidebar.addEventListener('click', () => {
                sidebar.classList.add('collapsed');
                if (sidebarToggleIcon) {
                    sidebarToggleIcon.className = 'fa-solid fa-angles-right';
                }
            });
        }
        if (btnExpandSidebar && sidebar) {
            btnExpandSidebar.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
                if (sidebarToggleIcon) {
                    sidebarToggleIcon.className = 'fa-solid fa-angles-left';
                }
            });
        }
        
        const btnMyLogs = $('btn-my-logs');
        if (btnMyLogs) {
            btnMyLogs.addEventListener('click', () => {
                const currentUserId = window.sfApi.sessionInfo?.userId;
                if (currentUserId && userFilter) {
                    // Match 15 char id or 18 char id
                    const options = Array.from(userFilter.options);
                    const opt = options.find(o => o.value.startsWith(currentUserId.substring(0, 15)));
                    if (opt) {
                        userFilter.value = opt.value;
                        applyFilters();
                    }
                }
            });
        }

        const btnImportLog = $('btn-import-log');
        if (btnImportLog) {
            btnImportLog.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: 'openExtensionPage',
                    page: 'log-viewer',
                    params: {}
                });
            });
        }

        // Bulk Delete Logs
        const selectAllCb = $('select-all-logs');
        const btnDeleteSelected = $('btn-delete-selected');
        const deleteCount = $('delete-count');
        
        if (selectAllCb) {
            selectAllCb.addEventListener('change', () => {
                const cbs = document.querySelectorAll('.log-cb');
                cbs.forEach(cb => cb.checked = selectAllCb.checked);
                updateBulkDeleteBtn();
            });
        }

        logList.addEventListener('change', (e) => {
            if (e.target.classList.contains('log-cb')) updateBulkDeleteBtn();
        });

        if (btnDeleteSelected) {
            btnDeleteSelected.addEventListener('click', async () => {
                const checked = Array.from(document.querySelectorAll('.log-cb:checked')).map(cb => cb.value);
                if (checked.length === 0) return;
                if (!confirm(`Delete ${checked.length} selected logs?`)) return;
                
                btnDeleteSelected.disabled = true;
                btnDeleteSelected.innerHTML = '<i class="fa-solid fa-circle-notch refresh-spin"></i> Deleting...';
                
                try {
                    for (const id of checked) {
                        await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${id}`, { method: 'DELETE' });
                    }
                    toast.success(`Deleted ${checked.length} logs`);
                    fetchLogs();
                } catch(e) {
                    toast.error('Bulk delete failed: ' + e.message);
                }
                
                btnDeleteSelected.disabled = false;
                btnDeleteSelected.innerHTML = '<i class="fa-solid fa-trash"></i> Delete (<span id="delete-count">0</span>)';
                if (selectAllCb) selectAllCb.checked = false;
                btnDeleteSelected.style.display = 'none';
            });
        }
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    function updateBulkDeleteBtn() {
        const checked = document.querySelectorAll('.log-cb:checked').length;
        const btnGroup = $('bulk-delete-group');
        const countSpan = $('delete-count');
        if (btnGroup && countSpan) {
            countSpan.textContent = checked;
            btnGroup.style.display = checked > 0 ? 'inline-flex' : 'none';
        }
    }

    /* ── Fetch Logs ───────────────────────────────────────────────── */
    async function fetchLogs() {
        logList.innerHTML = '<tr><td colspan="8" style="padding:20px"><div class="skeleton-line" style="width:100%"></div></td></tr>';

        try {
            if (!window.sfApi.sessionId) await window.sfApi.init();
            if (!window.sfApi.sessionId) {
                logList.innerHTML = '<tr><td colspan="8" style="padding:20px;text-align:center;color:#f87171;font-size:12px">No session. Please refresh the Salesforce page.</td></tr>';
                return;
            }

            const query = "SELECT Id, LogUser.Name, LogUser.Id, Operation, Status, DurationMilliseconds, LogLength, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT 200";
            const res = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            allLogs = data.records || [];
            populateUserFilter();
            applyFilters();
        } catch (e) {
            console.error('Fetch logs error:', e);
            logList.innerHTML = `<tr><td colspan="8" style="padding:20px;text-align:center;color:#f87171;font-size:12px">Error: ${escapeHtml(e.message)}</td></tr>`;
        }
    }

    function populateUserFilter() {
        const users = new Map();
        allLogs.forEach(log => {
            if (log.LogUser) users.set(log.LogUser.Id, log.LogUser.Name);
        });
        const current = userFilter.value;
        userFilter.innerHTML = '<option value="">All Users</option>';
        users.forEach((name, id) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            userFilter.appendChild(opt);
        });
        if (current && users.has(current)) userFilter.value = current;
    }

    /* ── Filter & Sort ────────────────────────────────────────────── */
    let contentSearchCache = {};
    let contentSearchPending = null;
    let lastSearchTerm = '';

    async function applyFilters() {
        const term = (searchInput.value || '').toLowerCase().trim();
        const userId = userFilter.value;
        const status = statusFilter.value;
        
        // Clear content cache if search term changed
        if (term !== lastSearchTerm) {
            contentSearchCache = {};
            lastSearchTerm = term;
        }

        // First pass: metadata-only filter
        filteredLogs = allLogs.filter(log => {
            if (userId && log.LogUser && log.LogUser.Id !== userId) return false;
            if (status && log.Status !== status) return false;
            if (!term) return true;
            // Match against metadata fields
            if (log.Operation && log.Operation.toLowerCase().includes(term)) return true;
            if (log.Status && log.Status.toLowerCase().includes(term)) return true;
            if (log.LogUser && log.LogUser.Name.toLowerCase().includes(term)) return true;
            // Also check the log body content if cached
            if (contentSearchCache[log.Id] !== undefined) {
                return contentSearchCache[log.Id];
            }
            return false;
        });

        currentPage = 1;
        logCount.textContent = filteredLogs.length;
        renderList();

        // If we have a search term and metadata didn't match enough, fetch log content
        if (term && filteredLogs.length === 0 && allLogs.length > 0) {
            await searchInsideLogContent(term);
        } else if (term && filteredLogs.length > 0) {
            // Also check content for additional matches not found in metadata
            await searchInsideLogContent(term);
        }
    }

    async function searchInsideLogContent(term) {
        if (contentSearchPending) clearTimeout(contentSearchPending);
        
        contentSearchPending = setTimeout(async () => {
            const userId = userFilter.value;
            const status = statusFilter.value;
            
            // Show searching indicator
            const searchingHtml = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-sub);font-size:12px"><i class="fa-solid fa-spinner fa-spin"></i> Searching inside log content...</td></tr>';
            if (filteredLogs.length === 0) logList.innerHTML = searchingHtml;
            
            // Filter logs that haven't been cached yet for this term
            const uncachedLogs = allLogs.filter(log => {
                if (userId && log.LogUser && log.LogUser.Id !== userId) return false;
                if (status && log.Status !== status) return false;
                if (contentSearchCache[log.Id] !== undefined) return false;
                return true;
            });

            // Fetch content for uncached logs (batch of 10 at a time)
            const batchSize = 10;
            for (let i = 0; i < Math.min(uncachedLogs.length, 50); i += batchSize) {
                const batch = uncachedLogs.slice(i, i + batchSize);
                await Promise.all(batch.map(async (log) => {
                    try {
                        const res = await window.sfApi.fetch(
                            `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${log.Id}/Body`
                        );
                        const body = await res.text();
                        contentSearchCache[log.Id] = body.toLowerCase().includes(term);
                    } catch (e) {
                        contentSearchCache[log.Id] = false;
                    }
                }));

                // Re-apply filters with updated cache
                const newFiltered = allLogs.filter(log => {
                    if (userId && log.LogUser && log.LogUser.Id !== userId) return false;
                    if (status && log.Status !== status) return false;
                    if (log.Operation && log.Operation.toLowerCase().includes(term)) return true;
                    if (log.Status && log.Status.toLowerCase().includes(term)) return true;
                    if (log.LogUser && log.LogUser.Name.toLowerCase().includes(term)) return true;
                    if (contentSearchCache[log.Id] !== undefined) {
                        return contentSearchCache[log.Id];
                    }
                    return false;
                });

                if (newFiltered.length !== filteredLogs.length) {
                    filteredLogs = newFiltered;
                    currentPage = 1;
                    logCount.textContent = filteredLogs.length;
                    renderList();
                }
            }
        }, 300);
    }

    /* ── Render Log List ──────────────────────────────────────────── */
    function renderList() {
        const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE) || 1;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageLogs = filteredLogs.slice(start, start + PAGE_SIZE);

        if (pageLogs.length === 0) {
            logList.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-sub)">No logs found</td></tr>';
        } else {
            logList.innerHTML = '';
            pageLogs.forEach((log) => {
                logList.appendChild(createLogItem(log));
            });
        }

        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = currentPage >= totalPages;
    }

    function createLogItem(log) {
        const tr = document.createElement('tr');
        tr.dataset.id = log.Id;
        
        const startTime = new Date(log.StartTime).toLocaleString();
        const sizeKB = (log.LogLength / 1024).toFixed(2) + ' KB';
        const duration = log.DurationMilliseconds < 1000 ? log.DurationMilliseconds + ' ms' : (log.DurationMilliseconds / 1000).toFixed(2) + ' s';
        const statusClass = log.Status === 'Success' ? 'success' : 'failed';
        
        const term = (searchInput.value || '').toLowerCase();
        const highlight = (text) => {
            if (!term || !text) return escapeHtml(text || '');
            return escapeHtml(text).replace(new RegExp(`(${escapeHtml(term)})`, 'gi'), '<mark style="background:rgba(251,191,36,0.3)">$1</mark>');
        };

        tr.innerHTML = `
            <td style="text-align: center; width: 40px;"><input type="checkbox" class="log-cb" value="${log.Id}"></td>
            <td style="width: 80px;">
                <div class="action-group">
                    <button class="action-btn-tbl" data-action="open" title="Open"><i class="fa-solid fa-up-right-from-square"></i></button>
                    <button class="action-btn-tbl" data-action="download" title="Download"><i class="fa-solid fa-download"></i></button>
                    <button class="action-btn-tbl delete" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
            <td style="color:var(--accent);font-weight:500;">${highlight(log.LogUser?.Name || 'Unknown')}</td>
            <td style="font-size:11px;">${highlight(log.Operation)}</td>
            <td style="color:var(--text-sub);font-size:11px;white-space:nowrap;">${startTime}</td>
            <td style="text-align:right;font-size:11px;white-space:nowrap;">${duration}</td>
            <td style="text-align:right;font-size:11px;white-space:nowrap;">${sizeKB}</td>
            <td class="status-cell ${statusClass}" title="${log.Status.replace(/"/g, '&quot;')}">${highlight(log.Status)}</td>
        `;

        // Click actions on buttons
        tr.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'open') openInFullViewer(log.Id);
                if (action === 'download') downloadLog(log.Id);
                if (action === 'delete') deleteLog(log.Id);
            });
        });

        // Click action on row itself opens log viewer
        tr.addEventListener('click', (e) => {
            if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) {
                return;
            }
            openInFullViewer(log.Id);
        });

        return tr;
    }

    /* ── TraceFlags ────────────────────────────────────────────────── */
    async function fetchTraceFlags() {
        traceList.innerHTML = '<div style="padding:20px"><div class="skeleton-line" style="width:100%"></div></div>';
        try {
            const query = "SELECT Id, TracedEntityId, TracedEntity.Name, CreatedBy.Name, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName FROM TraceFlag WHERE LogType = 'USER_DEBUG' ORDER BY ExpirationDate DESC";
            const res = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            allTraceFlags = data.records || [];
            renderTraceFlags();
        } catch (e) {
            traceList.innerHTML = `<div style="padding:16px;color:#f87171">Error: ${escapeHtml(e.message)}</div>`;
        }
    }

    function renderTraceFlags() {
        const now = new Date();
        const filterVal = $('trace-filter-select')?.value || 'active';
        
        let displayFlags = allTraceFlags;
        if (filterVal === 'active') {
            displayFlags = allTraceFlags.filter(f => new Date(f.ExpirationDate) > now);
        }
        
        traceCount.textContent = displayFlags.length;
        
        if (displayFlags.length === 0) {
            traceList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shield"></i><p>No trace flags found</p></div>';
            return;
        }

        traceList.innerHTML = '';
        displayFlags.forEach(tf => {
            const exp = new Date(tf.ExpirationDate);
            const isActive = exp > now;
            const div = document.createElement('div');
            div.className = 'trace-card';
            if (!isActive) div.style.opacity = '0.6';
            
            div.innerHTML = `
                <div class="trace-left" title="Requested by: ${escapeHtml(tf.CreatedBy?.Name || '')}">
                    <input type="checkbox" class="trace-cb" value="${tf.Id}" style="margin: 0; flex-shrink: 0;">
                    <i class="fa-solid fa-user" style="color: var(--sf-orange); font-size: 11px; flex-shrink: 0;"></i>
                    <span class="trace-user">${escapeHtml(tf.TracedEntity?.Name || 'Unknown')}</span>
                    <span class="trace-level-badge" title="Debug Level: ${escapeHtml(tf.DebugLevel?.DeveloperName || '')}">${escapeHtml(tf.DebugLevel?.DeveloperName || 'Default')}</span>
                </div>
                <div class="trace-right">
                    <span class="trace-time" data-exp="${exp.getTime()}">
                        Calculating...
                    </span>
                    <button class="log-action-btn delete" data-action="delete-trace" data-id="${tf.Id}" title="Delete Trace" style="background: transparent; border: none; color: var(--text-sub); cursor: pointer; padding: 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; transition: color 0.15s;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            
            div.querySelector('button').addEventListener('click', async (e) => {
                if(!confirm('Delete this TraceFlag?')) return;
                try {
                    await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/TraceFlag/${tf.Id}`, { method: 'DELETE' });
                    fetchTraceFlags();
                } catch(err) {
                    toast.error('Failed to delete trace: ' + err.message);
                }
            });
            traceList.appendChild(div);
        });
        updateTraceCountdowns();
    }

    function updateTraceCountdowns() {
        const now = Date.now();
        document.querySelectorAll('.trace-time').forEach(el => {
            const exp = parseInt(el.dataset.exp, 10);
            const diff = exp - now;
            if (diff <= 0) {
                el.textContent = 'Expired';
                el.style.color = '#f87171';
            } else {
                const mins = Math.ceil(diff / 60000);
                el.textContent = `${mins}m`;
                el.style.color = diff < 300000 ? '#fbbf24' : 'var(--sf-orange)';
            }
        });
    }

    /* ── Actions ──────────────────────────────────────────────────── */
    function openInFullViewer(logId) {
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'log-viewer',
            params: { id: logId }
        });
    }

    async function downloadLog(logId) {
        try {
            const res = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}/Body`);
            const raw = typeof res.text === 'function' ? await res.text() : res;
            const blob = new Blob([raw], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `apex_log_${logId}.log`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error('Download failed: ' + e.message);
        }
    }

    async function deleteLog(logId) {
        if (!confirm('Delete this debug log?')) return;
        try {
            await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}`, { method: 'DELETE' });
            allLogs = allLogs.filter(l => l.Id !== logId);
            applyFilters();
            if (selectedLogId === logId) {
                selectedLogId = null;
                viewerContent.innerHTML = '<div class="empty-state"><i class="fa-solid fa-file-lines"></i><p>Select a debug log to view</p></div>';
            }
            toast.success('Log deleted');
        } catch (e) {
            toast.error('Delete failed: ' + e.message);
        }
    }

    /* ── Utilities ────────────────────────────────────────────────── */
    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function generateSkeletons(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `<div class="skeleton-item">
                <div class="skeleton-line" style="width:60%;height:10px;margin-bottom:6px;animation-delay:${i * 0.05}s"></div>
                <div class="skeleton-line" style="width:90%;height:8px;margin-bottom:4px;animation-delay:${i * 0.05 + 0.1}s"></div>
                <div class="skeleton-line" style="width:40%;height:8px;animation-delay:${i * 0.05 + 0.15}s"></div>
            </div>`;
        }
        return html;
    }

    /* ── Boot ─────────────────────────────────────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function setupModals() {
    const traceModal = $('sfarc-trace-modal');
    const levelModal = $('sfarc-level-modal');
    const userSearchInput = $('sfarc-trace-user-search');
    const userResults = $('sfarc-user-results');
    const createTraceBtn = $('sfarc-create-trace-btn');
    const newLevelBtn = $('sfarc-new-level-btn');
    const saveLevelBtn = $('sfarc-save-level-btn');
    const levelRowsContainer = $('sfarc-level-rows');
    const levelNameInput = $('sfarc-level-name');

    // Close Modals
    if (levelModal) {
        levelModal.querySelectorAll('.sfarc-modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                levelModal.style.display = 'none';
            });
        });
    }

    if (traceModal) {
        traceModal.querySelectorAll('.sfarc-modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (levelModal && levelModal.contains(e.target)) return;
                traceModal.style.display = 'none';
            });
        });
    }

    // Load Debug Levels
    async function loadDebugLevels(forceReload = false) {
        const levelSelect = $('sfarc-trace-level');
        if (!levelSelect) return;

        if (forceReload || levelSelect.options.length <= 1) {
            try {
                levelSelect.innerHTML = '<option value="" disabled selected hidden>Loading debug levels...</option>';
                levelSelect.disabled = true;

                const query = "SELECT Id, DeveloperName FROM DebugLevel ORDER BY DeveloperName";
                const response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
                const result = await response.json();

                levelSelect.innerHTML = '<option value="" disabled selected hidden>-- Select Debug Level --</option>';
                levelSelect.disabled = false;

                if (result.records && result.records.length > 0) {
                    result.records.forEach(level => {
                        const option = document.createElement('option');
                        option.value = level.Id;
                        option.textContent = level.DeveloperName;
                        levelSelect.appendChild(option);
                    });
                } else {
                    levelSelect.innerHTML = '<option value="">No debug levels found</option>';
                }
            } catch (e) {
                console.error('Error loading debug levels:', e);
                levelSelect.innerHTML = '<option value="">Error loading levels</option>';
                levelSelect.disabled = false;
                toast.error('Failed to load debug levels.');
            }
        }
    }

    // Bind Add Current User button to open Trace Modal
    const btnAddTrace = $('btn-add-trace');
    if (btnAddTrace) {
        const cloneAdd = btnAddTrace.cloneNode(true);
        btnAddTrace.parentNode.replaceChild(cloneAdd, btnAddTrace);
        cloneAdd.addEventListener('click', async () => {
            const originalHtml = cloneAdd.innerHTML;
            cloneAdd.innerHTML = '<i class="fa-solid fa-circle-notch refresh-spin"></i>';
            cloneAdd.disabled = true;

            try {
                // Get current user to prefill via Chatter API
                const res = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/chatter/users/me`);
                const user = await res.json();
                
                if (user && userSearchInput) {
                    userSearchInput.value = user.name || user.username;
                    userSearchInput.dataset.userId = user.id;
                }
            } catch(e) {
                console.error('Failed to fetch current user', e);
            }

            // Prefill date
            const now = new Date();
            const localIsoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            if($('sfarc-trace-start')) $('sfarc-trace-start').value = localIsoString;

            await loadDebugLevels();
            traceModal.style.display = 'flex';
            
            cloneAdd.innerHTML = originalHtml;
            cloneAdd.disabled = false;
        });
    }

    // Bind [+] button to open Level Modal
    const btnNewTrace = $('btn-new-trace');
    if (btnNewTrace) {
        // Remove old listener and add new one
        const clone = btnNewTrace.cloneNode(true);
        btnNewTrace.parentNode.replaceChild(clone, btnNewTrace);
        
        clone.addEventListener('click', () => {
            openLogLevelModal();
        });
    }

    // User Search Debounce
    let userSearchTimeout;
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            clearTimeout(userSearchTimeout);
            const term = userSearchInput.value;
            if (term.length < 2) {
                userResults.style.display = 'none';
                return;
            }

            userSearchTimeout = setTimeout(async () => {
                try {
                    const query = `SELECT Id, Name, Username FROM User WHERE Name LIKE '%${term}%' LIMIT 5`;
                    const response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/query/?q=${encodeURIComponent(query)}`);
                    const result = await response.json();
                    
                    userResults.innerHTML = '';
                    if (result.records && result.records.length > 0) {
                        result.records.forEach(user => {
                            const div = document.createElement('div');
                            div.className = 'sfarc-dropdown-item';
                            div.textContent = `${user.Name} (${user.Username})`;
                            div.style.padding = '8px';
                            div.style.cursor = 'pointer';
                            div.style.borderBottom = '1px solid var(--border-color)';
                            div.onmouseover = () => div.style.background = 'var(--bg-hover)';
                            div.onmouseout = () => div.style.background = 'transparent';
                            div.onclick = () => {
                                userSearchInput.value = user.Name;
                                userSearchInput.dataset.userId = user.Id;
                                userResults.style.display = 'none';
                            };
                            userResults.appendChild(div);
                        });
                        userResults.style.display = 'block';
                    } else {
                        userResults.style.display = 'none';
                    }
                } catch (e) {
                    console.error('User search error', e);
                }
            }, 300);
        });
    }

    // Save Trace Flag
    if (createTraceBtn) {
        createTraceBtn.addEventListener('click', async () => {
            const userId = userSearchInput.dataset.userId;
            const debugLevelId = $('sfarc-trace-level').value;
            const expirationMinutes = parseInt($('sfarc-trace-expiration').value);

            if (!userId || !debugLevelId) {
                toast.error('Please select a User and a Debug Level.');
                return;
            }

            const startDate = new Date();
            const expirationDate = new Date(startDate.getTime() + expirationMinutes * 60000);

            const traceFlag = {
                TracedEntityId: userId,
                DebugLevelId: debugLevelId,
                StartDate: startDate.toISOString(),
                ExpirationDate: expirationDate.toISOString(),
                LogType: 'USER_DEBUG'
            };

            const originalBtnContent = createTraceBtn.innerHTML;
            createTraceBtn.innerHTML = '<i class="fa-solid fa-circle-notch refresh-spin"></i> Saving...';
            createTraceBtn.disabled = true;

            try {
                const response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/TraceFlag`, {
                    method: 'POST',
                    body: JSON.stringify(traceFlag)
                });
                const result = await response.json();

                if (result.id || result.success) {
                    traceModal.style.display = 'none';
                    toast.success('Trace Flag created successfully');
                    fetchTraceFlags();
                } else {
                    toast.error('Failed to create Trace Flag: ' + JSON.stringify(result));
                }
            } catch (e) {
                toast.error('Error creating Trace Flag: ' + e.message);
            }
            
            createTraceBtn.innerHTML = originalBtnContent;
            createTraceBtn.disabled = false;
        });
    }

    // New Level Modal Logic
    const categories = [
        { key: 'Database', label: 'Database' },
        { key: 'Workflow', label: 'Workflow' },
        { key: 'Validation', label: 'Validation' },
        { key: 'Callout', label: 'Callout' },
        { key: 'ApexCode', label: 'Apex Code' },
        { key: 'ApexProfiling', label: 'Apex Profiling' },
        { key: 'Visualforce', label: 'Visualforce' },
        { key: 'System', label: 'System' }
    ];
    const logLevels = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

    function openLogLevelModal() {
        if (levelNameInput) levelNameInput.value = '';
        if (levelRowsContainer) {
            levelRowsContainer.innerHTML = '';
            categories.forEach(cat => {
                const tr = document.createElement('tr');
                tr.dataset.category = cat.key;
                let colsHtml = `<td style="font-weight: 500; text-align: left; padding: 8px;">${cat.label}</td>`;
                logLevels.forEach(level => {
                    const isChecked = level === 'DEBUG' ? 'checked' : '';
                    colsHtml += `
                        <td style="text-align: center; padding: 8px;">
                            <input type="radio" name="sfarc-level-${cat.key}" value="${level}" ${isChecked}>
                        </td>
                    `;
                });
                tr.innerHTML = colsHtml;
                levelRowsContainer.appendChild(tr);
            });
        }
        if (levelModal) levelModal.style.display = 'flex';
    }

    if (newLevelBtn) {
        newLevelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLogLevelModal();
        });
    }

    if (saveLevelBtn) {
        saveLevelBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const rawName = levelNameInput ? levelNameInput.value.trim() : '';
            if (!rawName) {
                toast.error('Please enter a Debug Level Name.');
                return;
            }

            let devName = rawName.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
            if (!/^[a-zA-Z]/.test(devName)) {
                toast.error('Debug Level Name must start with a letter.');
                return;
            }

            const levels = {};
            const rows = levelRowsContainer ? levelRowsContainer.querySelectorAll('tr') : [];
            rows.forEach(row => {
                const cat = row.dataset.category;
                const checkedInput = row.querySelector(`input[name="sfarc-level-${cat}"]:checked`);
                if (cat && checkedInput) levels[cat] = checkedInput.value;
            });

            const payload = {
                DeveloperName: devName,
                MasterLabel: rawName,
                ...levels
            };

            const originalBtnContent = saveLevelBtn.innerHTML;
            saveLevelBtn.innerHTML = '<i class="fa-solid fa-circle-notch refresh-spin"></i> Saving...';
            saveLevelBtn.disabled = true;

            try {
                const response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/DebugLevel`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.success || (result.id && !result.errors?.length)) {
                    const newId = result.id || result.Id;
                    if (levelModal) levelModal.style.display = 'none';
                    await loadDebugLevels(true);
                    
                    const levelSelect = $('sfarc-trace-level');
                    if (levelSelect && newId) {
                        levelSelect.value = newId;
                    }
                    toast.success('Debug Level created successfully!');
                } else {
                    toast.error('Failed to save Debug Level: ' + (result.errors?.[0]?.message || 'Unknown error'));
                }
            } catch (err) {
                toast.error('Error saving Debug Level: ' + err.message);
            }
            saveLevelBtn.innerHTML = originalBtnContent;
            saveLevelBtn.disabled = false;
        });
    }
}
})();
