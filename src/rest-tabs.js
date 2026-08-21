/* ── New Tab Management for REST Console ─────────────────────────── */
(function () {
    let tabCounter = 1;
    const tabsBar = document.getElementById('rest-tabs-bar');
    const addTabBtn = document.getElementById('btn-add-tab');
    if (!tabsBar || !addTabBtn) return;

    /* Store tab data keyed by id */
    const tabs = new Map();
    tabs.set(1, {
        method: 'GET',
        endpoint: '/services/data/v60.0/',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: ''
    });

    /* ── Switch ────────────────────────────────────────────────────── */
    function switchTab(tabId) {
        tabsBar.querySelectorAll('.rest-top-tab:not(.add-tab)').forEach(function (t) {
            t.classList.toggle('active', t.dataset.tabId === String(tabId));
        });
        var data = tabs.get(Number(tabId));
        if (data) {
            var ms = document.getElementById('method-select');
            var ei = document.getElementById('endpoint-input');
            if (ms) ms.value = data.method;
            if (ei) ei.value = data.endpoint;
        }
    }

    /* ── Create ────────────────────────────────────────────────────── */
    function createTab() {
        tabCounter++;
        var id = tabCounter;

        tabs.set(id, {
            method: 'GET',
            endpoint: '/services/data/v60.0/',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: ''
        });

        var tab = document.createElement('div');
        tab.className = 'rest-top-tab';
        tab.dataset.tabId = id;
        tab.innerHTML =
            '<span class="tab-label">New Request ' + id + '</span>' +
            '<i class="fa-solid fa-xmark close-tab"></i>';

        tabsBar.insertBefore(tab, addTabBtn);
        switchTab(id);
    }

    /* ── Close ─────────────────────────────────────────────────────── */
    function closeTab(tabId) {
        var tab = tabsBar.querySelector('[data-tab-id="' + tabId + '"]');
        if (!tab) return;

        /* never close the last tab */
        var allTabs = tabsBar.querySelectorAll('.rest-top-tab:not(.add-tab)');
        if (allTabs.length <= 1) return;

        /* if the active tab is being closed, switch to an adjacent one first */
        if (tab.classList.contains('active')) {
            var prev = tab.previousElementSibling;
            var next = tab.nextElementSibling;
            var target = null;
            if (prev && !prev.classList.contains('add-tab')) {
                target = prev;
            } else if (next && !next.classList.contains('add-tab')) {
                target = next;
            }
            if (target) switchTab(target.dataset.tabId);
        }

        tab.remove();
        tabs.delete(Number(tabId));
    }

    /* ── Event delegation on the whole tabs bar ────────────────────── */
    tabsBar.addEventListener('click', function (e) {
        var target = e.target;

        /* 1. Close button (or anything inside it) */
        if (target.closest && target.closest('.close-tab')) {
            e.stopPropagation();
            var closeBtn = target.closest('.close-tab');
            var tabEl = closeBtn.closest('.rest-top-tab');
            if (tabEl) closeTab(tabEl.dataset.tabId);
            return;
        }

        /* 2. Add-tab button */
        if (target.closest && target.closest('#btn-add-tab')) {
            createTab();
            return;
        }

        /* 3. Click on a regular tab → switch */
        var tabEl = target.closest('.rest-top-tab:not(.add-tab)');
        if (tabEl) {
            switchTab(tabEl.dataset.tabId);
        }
    });

    /* ── Persist tab state on user edits ───────────────────────────── */
    var endpointInput = document.getElementById('endpoint-input');
    var methodSelect = document.getElementById('method-select');

    if (endpointInput) {
        endpointInput.addEventListener('input', function () {
            var activeTab = tabsBar.querySelector('.rest-top-tab.active:not(.add-tab)');
            if (!activeTab) return;
            var id = Number(activeTab.dataset.tabId);
            var ep = endpointInput.value;
            var parts = ep.split('/').filter(Boolean);
            var label = activeTab.querySelector('.tab-label');
            if (label) label.textContent = parts.length ? parts[parts.length - 1] : 'New Request';
            if (tabs.has(id)) tabs.get(id).endpoint = ep;
        });
    }

    if (methodSelect) {
        methodSelect.addEventListener('change', function () {
            var activeTab = tabsBar.querySelector('.rest-top-tab.active:not(.add-tab)');
            if (!activeTab) return;
            var id = Number(activeTab.dataset.tabId);
            if (tabs.has(id)) tabs.get(id).method = methodSelect.value;
        });
    }
})();
