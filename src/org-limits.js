// Org Limits Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const limitsGrid = document.getElementById('limits-grid');
    const refreshBtn = document.getElementById('refresh-btn');
    const loading = document.getElementById('loading');
    const searchInput = document.getElementById('limits-search');
    const totalBadge = document.getElementById('limits-total-count');

    const api = window.sfApi;
    let limitsData = [];

    // Per-org cache: switching back to this tab should render instantly from
    // the last fetch instead of re-fetching /limits (and flashing the spinner)
    // on every page load. Refreshed by the toolbar's refresh button (force).
    const LIMITS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const limitsCacheKey = () => 'sfir_org_limits_' + (host || 'unknown');

    function getCachedLimits() {
        try {
            const raw = localStorage.getItem(limitsCacheKey());
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (!cached || !cached.data || Date.now() - cached.ts > LIMITS_CACHE_TTL) return null;
            return cached.data;
        } catch (e) {
            return null;
        }
    }

    function cacheLimits(data) {
        try {
            localStorage.setItem(limitsCacheKey(), JSON.stringify({ ts: Date.now(), data }));
        } catch (e) { /* storage full / unavailable — ignore */ }
    }

    // Header setup
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host') || params.get('sfHost') || '';
    const hostArg = host ? 'host=' + encodeURIComponent(host) : '';
    const navOrg = document.getElementById('sfarc-nav-org');
    if (navOrg) navOrg.textContent = host || '';
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

    // Tell the shell's bar (when embedded) whether the refresh is spinning.
    function sfirPushState(refreshing) {
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({ source: 'sfir-embed', tab: 'limits', type: 'sfirUtilsState', state: { refreshing: !!refreshing } }, '*');
            } catch (e) { /* ignore */ }
        }
    }

    async function loadLimits(force) {
        const iconEl = refreshBtn ? refreshBtn.querySelector('.fa-rotate') : null;
        if (iconEl) iconEl.classList.add('rotating');
        sfirPushState(true);

        // Fresh per-org cache → render immediately, no fetch, no spinner.
        const cached = force ? null : getCachedLimits();
        if (cached) {
            limitsData = cached;
            renderLimits();
            loading.style.display = 'none';
            if (iconEl) iconEl.classList.remove('rotating');
            sfirPushState(false);
            return;
        }

        loading.style.display = 'flex';
        limitsGrid.innerHTML = '';

        if (window.sfUserPermissions) {
            const perms = await window.sfUserPermissions.getPermissions();
            if (!perms.canViewSetup) {
                loading.style.display = 'none';
                limitsGrid.innerHTML = `
                    <div style="grid-column: 1/-1; background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 40px; text-align: center; color: #f4f4f5;">
                        <div style="font-size: 24px; margin-bottom: 12px;">🔒</div>
                        <div style="font-size: 15px; font-weight: 500; margin-bottom: 8px;">Setup Access Required</div>
                        <div style="font-size: 13px; color: #a1a1aa; max-width: 460px; margin: 0 auto 16px;">
                            Your Salesforce User Profile (${perms.profileName || 'Standard'}) does not have permission to view Setup or Org Limits.
                        </div>
                        <span style="display: inline-block; font-size: 11px; color: var(--sfarc-accent-glow, #38bdf8); background: rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.1); padding: 6px 14px; border-radius: 9999px; border: 1px solid rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.2);">
                            Required Permission: View Setup and Configuration
                        </span>
                    </div>`;
                if (totalBadge) totalBadge.textContent = 'Total Limits: 0 (Restricted)';
                if (iconEl) iconEl.classList.remove('rotating');
                sfirPushState(false);
                return;
            }
        }

        try {
            const res = await api.fetch('/services/data/v60.0/limits');
            const limits = await res.json();

            const sortedKeys = Object.keys(limits).sort();
            limitsData = sortedKeys.map(name => {
                const limit = limits[name] || {};
                const max = limit.Max || 0;
                const remaining = limit.Remaining || 0;
                const used = max > 0 ? (max - remaining) : 0;
                const percent = max > 0 ? Math.round((used / max) * 100) : 0;
                return { name, limit, max, remaining, used, percent };
            });

            cacheLimits(limitsData);
            renderLimits();
        } catch (error) {
            console.error('Limits Load Error:', error);
            limitsGrid.innerHTML = `<div style="grid-column: 1/-1; color: #f44336; padding: 20px;">Failed to load limits: ${window.escapeHtml(error.message)}</div>`;
            if (totalBadge) totalBadge.textContent = 'Total Limits: 0';
        } finally {
            loading.style.display = 'none';
            if (iconEl) iconEl.classList.remove('rotating');
            sfirPushState(false);
        }
    }

    function renderLimits() {
        limitsGrid.innerHTML = '';
        const filter = (searchInput?.value || '').toLowerCase().trim();
        const filtered = limitsData.filter(item => item.name.toLowerCase().includes(filter));

        if (totalBadge) {
            totalBadge.textContent = `Total Limits: ${filtered.length}${filtered.length !== limitsData.length ? ` of ${limitsData.length}` : ''}`;
        }

        if (filtered.length === 0) {
            limitsGrid.innerHTML = `<div style="grid-column: 1/-1; color: #a1a1aa; padding: 40px; text-align: center; font-size: 13px;">No org limits found matching "${window.escapeHtml(filter)}"</div>`;
            return;
        }

        filtered.forEach(item => {
            let color = 'var(--sfarc-accent)'; // Accent color
            if (item.percent > 70) color = '#ffc107'; // Yellow
            if (item.percent > 90) color = '#f44336'; // Red

            const card = document.createElement('div');
            card.className = 'limit-card';

            const percentLabel = item.max > 0 ? `${item.percent}% Used` : 'N/A';

            card.innerHTML = `
                <div class="limit-header">
                    <div class="limit-name" title="${item.name}">${item.name}</div>
                    <div style="font-size: 10px; color: ${color}; font-weight: 500;">${percentLabel}</div>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${item.max > 0 ? item.percent : 0}%; background: ${color};"></div>
                </div>
                <div class="limit-stats">
                    <div>Used: <span class="stat-value">${item.used.toLocaleString()}</span></div>
                    <div>Remaining: <span class="stat-value">${item.max > 0 ? item.remaining.toLocaleString() : 'N/A'}</span></div>
                    <div>Max: <span class="stat-value">${item.max > 0 ? item.max.toLocaleString() : 'Unlimited'}</span></div>
                </div>
            `;
            limitsGrid.appendChild(card);
        });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', () => loadLimits(true));
    if (searchInput) searchInput.addEventListener('input', renderLimits);

    // Embedded in sfir-shell.html: the shell's bar owns the Refresh button;
    // it forwards the click here so the page's own data load runs.
    if (window.parent && window.parent !== window) {
        window.addEventListener('message', (e) => {
            if (e.origin && e.origin !== window.location.origin) return;
            const msg = e.data;
            if (!msg || typeof msg !== 'object' || msg.source !== 'sfir-shell' || msg.type !== 'sfirUtilsAction') return;
            if (msg.action === 'refresh') loadLimits(true);
        });
    }

    await loadLimits();
});
