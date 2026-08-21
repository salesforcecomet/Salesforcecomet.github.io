// FlowMonitor - Real-time Flow Automation Monitoring
let flowPollingInterval = null;
let flowCache = {
    interviews: [],
    lastUpdate: null,
    errorCount: 0
};

// Load Flows content
async function loadFlowsContent() {
    const content = document.getElementById('sfarc-content');

    content.innerHTML = `
        <div class="sfarc-flows-container">
            <!-- Header with Controls -->
            <div class="sfarc-flows-header">
                <div class="sfarc-flows-controls">
                    <button class="sfarc-flow-refresh-btn" id="flow-refresh-btn" title="Refresh Now">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <span class="sfarc-flow-last-update" id="flow-last-update">Never</span>
                    <label class="sfarc-flow-auto-refresh">
                        <input type="checkbox" id="flow-auto-refresh" checked>
                        <span>Auto-refresh</span>
                    </label>
                </div>
                <div class="sfarc-flows-actions">
                    <button class="sfarc-flow-export-btn" id="flow-export-btn" title="Export Flow Data">
                        <i class="fa-solid fa-download"></i>
                        Export
                    </button>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="sfarc-flows-filters">
                <input type="text" id="flow-search" class="sfarc-flow-search" placeholder="Search flows...">
                <select id="flow-status-filter" class="sfarc-flow-filter">
                    <option value="all">All Status</option>
                    <option value="Started">Running</option>
                    <option value="Paused">Paused</option>
                    <option value="Error">Failed</option>
                    <option value="Finished">Completed</option>
                </select>
            </div>

            <!-- Stats Summary -->
            <div class="sfarc-flows-stats">
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Total</span>
                    <span class="sfarc-flow-stat-value" id="flow-stat-total">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Running</span>
                    <span class="sfarc-flow-stat-value sfarc-status-running" id="flow-stat-running">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Paused</span>
                    <span class="sfarc-flow-stat-value sfarc-status-paused" id="flow-stat-paused">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Failed</span>
                    <span class="sfarc-flow-stat-value sfarc-status-failed" id="flow-stat-failed">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Completed</span>
                    <span class="sfarc-flow-stat-value sfarc-status-completed" id="flow-stat-completed">0</span>
                </div>
            </div>

            <!-- Flow List -->
            <div class="sfarc-flows-list" id="flows-list">
                <div class="sfarc-loading">Loading flows...</div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('flow-refresh-btn').addEventListener('click', () => refreshFlowData(true));
    document.getElementById('flow-auto-refresh').addEventListener('change', toggleAutoRefresh);
    document.getElementById('flow-search').addEventListener('input', filterFlows);
    document.getElementById('flow-status-filter').addEventListener('change', filterFlows);
    document.getElementById('flow-export-btn').addEventListener('click', exportFlowData);

    // Event delegation for dynamic items
    content.addEventListener('click', (e) => {
        const flowBtn = e.target.closest('.sfarc-view-flow-details');
        if (flowBtn) {
            const id = flowBtn.dataset.id;
            if (window.viewFlowDetails) window.viewFlowDetails(id);
        }
    });

    // Initial load
    await refreshFlowData(true);

    // Start auto-refresh
    startFlowPolling();
}

// Fetch flow interview data
async function fetchFlowInterviews() {
    try {
        // Query FlowInterview for recent runs (last 24 hours)
        const query = `
            SELECT Id, CurrentElement, FlowVersionView.Label, FlowVersionViewId,
                   InterviewStatus, PauseLabel, CreatedDate, CreatedBy.Name
            FROM FlowInterview 
            WHERE CreatedDate >= LAST_N_HOURS:24
            ORDER BY CreatedDate DESC
            LIMIT 100
        `;

        const result = await window.sfApi.query(query, true); // Use Tooling API
        return result.records || [];
    } catch (error) {
        console.error('Error fetching flow interviews:', error);
        return [];
    }
}

// Refresh flow data
async function refreshFlowData(showLoading = false) {
    const btnRefresh = document.getElementById('flow-refresh-btn');
    let iconEl = null;
    if (btnRefresh) {
        iconEl = btnRefresh.querySelector('.fa-arrows-rotate');
        if (iconEl) iconEl.classList.add('fa-spin');
    }
    try {
        if (showLoading) {
            const list = document.getElementById('flows-list');
            if (list) list.innerHTML = '<div class="sfarc-loading">Loading flows...</div>';
        }

        const interviews = await fetchFlowInterviews();
        flowCache.interviews = interviews;
        flowCache.lastUpdate = new Date();

        // Calculate stats
        const stats = {
            total: interviews.length,
            running: interviews.filter(i => i.InterviewStatus === 'Started').length,
            paused: interviews.filter(i => i.InterviewStatus === 'Paused').length,
            failed: interviews.filter(i => i.InterviewStatus === 'Error').length,
            completed: interviews.filter(i => i.InterviewStatus === 'Finished').length
        };

        flowCache.errorCount = stats.failed;

        // Update UI
        updateFlowStats(stats);
        renderFlowList(interviews);
        updateLastRefreshTime();
        updateErrorBadge();
    } finally {
        if (iconEl) {
            setTimeout(() => {
                iconEl.classList.remove('fa-spin');
            }, 600);
        }
    }
}

// Update stats display
function updateFlowStats(stats) {
    document.getElementById('flow-stat-total').textContent = stats.total;
    document.getElementById('flow-stat-running').textContent = stats.running;
    document.getElementById('flow-stat-paused').textContent = stats.paused;
    document.getElementById('flow-stat-failed').textContent = stats.failed;
    document.getElementById('flow-stat-completed').textContent = stats.completed;
}

// Render flow list
function renderFlowList(interviews) {
    const list = document.getElementById('flows-list');

    if (!interviews || interviews.length === 0) {
        list.innerHTML = '<div class="sfarc-empty-state">No flow interviews found in the last 24 hours.</div>';
        return;
    }

    list.innerHTML = interviews.map(interview => `
        <div class="sfarc-flow-item sfarc-flow-status-${interview.InterviewStatus.toLowerCase()}" data-id="${interview.Id}">
            <div class="sfarc-flow-item-header">
                <div class="sfarc-flow-name">
                    <span class="sfarc-flow-status-indicator"></span>
                    ${escapeHtml(interview.FlowVersionView?.Label || 'Unknown Flow')}
                </div>
                <div class="sfarc-flow-status-text">${escapeHtml(interview.InterviewStatus)}</div>
            </div>
            <div class="sfarc-flow-item-details">
                <div class="sfarc-flow-detail">
                    <span class="sfarc-flow-detail-label">Started:</span>
                    <span class="sfarc-flow-detail-value">${formatDateTime(interview.CreatedDate)}</span>
                </div>
                <div class="sfarc-flow-detail">
                    <span class="sfarc-flow-detail-label">User:</span>
                    <span class="sfarc-flow-detail-value">${escapeHtml(interview.CreatedBy?.Name || 'Unknown')}</span>
                </div>
                ${interview.PauseLabel ? `
                    <div class="sfarc-flow-detail">
                        <span class="sfarc-flow-detail-label">Pause:</span>
                        <span class="sfarc-flow-detail-value">${escapeHtml(interview.PauseLabel)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="sfarc-flow-item-actions">
                <button class="sfarc-flow-action-btn sfarc-view-flow-details" data-id="${interview.Id}" title="View Details">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 4V7L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    Details
                </button>
                <a href="${window.location.origin}/lightning/setup/FlowEditView/home?flowId=${interview.FlowVersionViewId}" target="_blank" class="sfarc-flow-action-btn" title="Edit Flow">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 1L13 4L4 13H1V10L10 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Edit
                </a>
            </div>
        </div>
    `).join('');
}

// Filter flows
function filterFlows() {
    const searchTerm = document.getElementById('flow-search').value.toLowerCase();
    const statusFilter = document.getElementById('flow-status-filter').value;

    let filtered = flowCache.interviews;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(i =>
            (i.FlowVersionView?.Label || '').toLowerCase().includes(searchTerm) ||
            (i.CreatedBy?.Name || '').toLowerCase().includes(searchTerm)
        );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
        filtered = filtered.filter(i => i.InterviewStatus === statusFilter);
    }

    renderFlowList(filtered);
}

// Format date/time
function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return 'Just now';

    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Format as date
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update last refresh time
function updateLastRefreshTime() {
    const elem = document.getElementById('flow-last-update');
    if (elem && flowCache.lastUpdate) {
        elem.textContent = formatDateTime(flowCache.lastUpdate.toISOString());
    }
}

// Update error badge
function updateErrorBadge() {
    const badge = document.getElementById('flow-error-badge');
    if (badge) {
        if (flowCache.errorCount > 0) {
            badge.textContent = flowCache.errorCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Start polling
function startFlowPolling() {
    stopFlowPolling();

    const autoRefresh = document.getElementById('flow-auto-refresh');
    if (autoRefresh && autoRefresh.checked) {
        flowPollingInterval = setInterval(() => {
            if (currentTab === 'flows' && document.visibilityState === 'visible') {
                refreshFlowData(false);
            }
        }, 60000); // 60 seconds
    }
}

// Stop polling
function stopFlowPolling() {
    if (flowPollingInterval) {
        clearInterval(flowPollingInterval);
        flowPollingInterval = null;
    }
}

// Toggle auto-refresh
function toggleAutoRefresh(e) {
    if (e.target.checked) {
        startFlowPolling();
    } else {
        stopFlowPolling();
    }
}

// Export flow data
function exportFlowData() {
    const data = {
        exported: new Date().toISOString(),
        totalFlows: flowCache.interviews.length,
        errorCount: flowCache.errorCount,
        flows: flowCache.interviews.map(i => ({
            id: i.Id,
            flowName: i.FlowVersionView?.Label,
            status: i.InterviewStatus,
            startedDate: i.CreatedDate,
            startedBy: i.CreatedBy?.Name,
            pauseReason: i.PauseLabel
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-monitor-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// View flow details (placeholder for future implementation)
function viewFlowDetails(interviewId) {
    alert(`Flow details viewer coming soon!\n\nInterview ID: ${interviewId}\n\nThis will sfarc-show:\n- Variable values\n- Execution timeline\n- Error details\n- Debug logs`);
}

// Make viewFlowDetails globally accessible
window.viewFlowDetails = viewFlowDetails;
