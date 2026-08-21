/* ── Save / Collections / History for REST Console ──────────────── */
(function () {
    var STORAGE_KEY = 'sfarc_rest_requests';
    var HISTORY_KEY = 'sfarc_rest_history';

    /* ── Helpers ───────────────────────────────────────────────────── */
    function loadStore(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
    }
    function saveStore(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    function $(id) { return document.getElementById(id); }

    /* ── Save Modal ────────────────────────────────────────────────── */
    var saveOverlay = $('save-modal-overlay');
    var saveModal = $('save-modal');
    var saveNameInput = $('save-name-input');
    var saveCollectionSelect = $('save-collection-select');
    var savePreviewMethod = $('save-preview-method');
    var savePreviewEndpoint = $('save-preview-endpoint');
    var btnSave = $('btn-save');

    function openSaveModal() {
        var ms = $('method-select');
        var ei = $('endpoint-input');
        if (!ms || !ei) return;
        savePreviewMethod.textContent = ms.value;
        savePreviewEndpoint.textContent = ei.value || '/';
        saveNameInput.value = '';
        refreshCollectionSelect();
        saveOverlay.style.display = 'flex';
        saveNameInput.focus();
    }

    function closeSaveModal() {
        saveOverlay.style.display = 'none';
    }

    function refreshCollectionSelect() {
        var store = loadStore(STORAGE_KEY);
        var collections = [];
        store.forEach(function (r) {
            if (r.collection && collections.indexOf(r.collection) === -1) {
                collections.push(r.collection);
            }
        });
        saveCollectionSelect.innerHTML = '<option value="">No Collection</option>';
        collections.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            saveCollectionSelect.appendChild(opt);
        });
    }

    function confirmSave() {
        var name = saveNameInput.value.trim();
        if (!name) { saveNameInput.focus(); return; }
        var ms = $('method-select');
        var ei = $('endpoint-input');
        // Gather headers
        var headers = [];
        var keyInputs = document.querySelectorAll('#req-headers-grid .header-key');
        var valInputs = document.querySelectorAll('#req-headers-grid .header-val');
        for (var i = 0; i < keyInputs.length; i++) {
            if (keyInputs[i].value) {
                headers.push({ key: keyInputs[i].value, value: valInputs[i] ? valInputs[i].value : '' });
            }
        }
        // Get body
        var bodyEditor = window.monaco && window.monaco.editor.getModels().length > 1
            ? window.monaco.editor.getModels()[1] : null;
        var body = bodyEditor ? bodyEditor.getValue() : '';

        var request = {
            id: Date.now(),
            name: name,
            collection: saveCollectionSelect.value || '',
            method: ms.value,
            endpoint: ei.value,
            headers: headers,
            body: body,
            createdAt: new Date().toISOString()
        };
        var store = loadStore(STORAGE_KEY);
        store.push(request);
        saveStore(STORAGE_KEY, store);
        closeSaveModal();
        if (typeof glassToast === 'function') glassToast('Request saved', 'success');
    }

    if (btnSave) btnSave.addEventListener('click', openSaveModal);
    if ($('save-modal-close')) $('save-modal-close').addEventListener('click', closeSaveModal);
    if ($('save-modal-cancel')) $('save-modal-cancel').addEventListener('click', closeSaveModal);
    if ($('save-modal-confirm')) $('save-modal-confirm').addEventListener('click', confirmSave);
    if (saveOverlay) saveOverlay.addEventListener('click', function (e) { if (e.target === saveOverlay) closeSaveModal(); });
    if (saveNameInput) saveNameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmSave(); });

    /* ── Collections Drawer ────────────────────────────────────────── */
    var collOverlay = $('collections-overlay');
    var collDrawer = $('collections-drawer');
    var collList = $('collections-list');

    function openCollections() {
        renderCollections();
        collOverlay.style.display = 'block';
        collDrawer.style.display = 'flex';
    }
    function closeCollections() {
        collOverlay.style.display = 'none';
        collDrawer.style.display = 'none';
    }

    function renderCollections() {
        var store = loadStore(STORAGE_KEY);
        var groups = {};
        var ungrouped = [];
        store.forEach(function (r) {
            if (r.collection) {
                if (!groups[r.collection]) groups[r.collection] = [];
                groups[r.collection].push(r);
            } else {
                ungrouped.push(r);
            }
        });

        var html = '';

        // Collections with their saved requests
        Object.keys(groups).sort().forEach(function (colName) {
            var items = groups[colName];
            html += '<div class="rest-collection-item" data-collection="' + esc(colName) + '">';
            html += '<i class="fa-solid fa-folder" style="color:var(--sf-orange);font-size:11px"></i>';
            html += '<span class="rest-collection-name">' + esc(colName) + '</span>';
            html += '<span class="rest-collection-count">' + items.length + '</span>';
            html += '<div class="rest-collection-actions">';
            html += '<button class="rest-coll-action-btn delete" data-delete-col="' + esc(colName) + '" title="Delete Collection"><i class="fa-solid fa-trash"></i></button>';
            html += '</div>';
            html += '</div>';
            items.forEach(function (r) {
                html += '<div class="rest-saved-item" data-load-id="' + r.id + '">';
                html += '<span class="rest-method-badge">' + esc(r.method) + '</span>';
                html += '<span class="rest-saved-item-name">' + esc(r.name) + '</span>';
                html += '<button class="rest-saved-item-delete" data-delete-id="' + r.id + '" title="Delete"><i class="fa-solid fa-xmark"></i></button>';
                html += '</div>';
            });
        });

        // Ungrouped saved requests
        if (ungrouped.length) {
            html += '<div class="rest-collection-item" style="opacity:0.6">';
            html += '<i class="fa-solid fa-bookmark" style="font-size:11px"></i>';
            html += '<span class="rest-collection-name">Saved (no collection)</span>';
            html += '<span class="rest-collection-count">' + ungrouped.length + '</span>';
            html += '</div>';
            ungrouped.forEach(function (r) {
                html += '<div class="rest-saved-item" data-load-id="' + r.id + '">';
                html += '<span class="rest-method-badge">' + esc(r.method) + '</span>';
                html += '<span class="rest-saved-item-name">' + esc(r.name) + '</span>';
                html += '<button class="rest-saved-item-delete" data-delete-id="' + r.id + '" title="Delete"><i class="fa-solid fa-xmark"></i></button>';
                html += '</div>';
            });
        }

        if (!store.length) {
            html = '<div class="rest-drawer-empty"><i class="fa-solid fa-folder-open"></i>No saved requests yet.<br>Click Save to store a request.</div>';
        }

        collList.innerHTML = html;
        bindCollectionEvents();
    }

    function bindCollectionEvents() {
        // Load a saved request
        collList.querySelectorAll('[data-load-id]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('.rest-saved-item-delete')) return;
                var id = parseInt(el.dataset.loadId);
                loadSavedRequest(id);
                closeCollections();
            });
        });
        // Delete a saved request
        collList.querySelectorAll('[data-delete-id]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteSavedRequest(parseInt(el.dataset.deleteId));
            });
        });
        // Delete a collection
        collList.querySelectorAll('[data-delete-col]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteCollection(el.dataset.deleteCol);
            });
        });
    }

    function loadSavedRequest(id) {
        var store = loadStore(STORAGE_KEY);
        var req = store.find(function (r) { return r.id === id; });
        if (!req) return;
        var ms = $('method-select');
        var ei = $('endpoint-input');
        if (ms) ms.value = req.method;
        if (ei) ei.value = req.endpoint;
        // Restore headers
        var grid = $('req-headers-grid');
        if (grid) {
            grid.innerHTML = '';
            (req.headers || []).forEach(function (h) {
                addHeaderRow(grid, h.key, h.value);
            });
            if (!req.headers || !req.headers.length) {
                addHeaderRow(grid, 'Content-Type', 'application/json');
            }
        }
        // Restore body
        if (req.body) {
            var models = window.monaco ? window.monaco.editor.getModels() : [];
            if (models.length > 1) models[1].setValue(req.body);
        }
    }

    function deleteSavedRequest(id) {
        var store = loadStore(STORAGE_KEY).filter(function (r) { return r.id !== id; });
        saveStore(STORAGE_KEY, store);
        renderCollections();
    }

    function deleteCollection(name) {
        if (!confirm('Delete collection "' + name + '" and all its requests?')) return;
        var store = loadStore(STORAGE_KEY).filter(function (r) { return r.collection !== name; });
        saveStore(STORAGE_KEY, store);
        renderCollections();
    }

    // New collection via prompt
    var newCollBtn = $('new-collection-btn');
    if (newCollBtn) newCollBtn.addEventListener('click', function () {
        var name = prompt('Collection name:');
        if (name && name.trim()) {
            // Create a placeholder saved request so the collection appears
            var store = loadStore(STORAGE_KEY);
            store.push({
                id: Date.now(),
                name: '(empty)',
                collection: name.trim(),
                method: 'GET',
                endpoint: '/',
                headers: [],
                body: '',
                createdAt: new Date().toISOString()
            });
            saveStore(STORAGE_KEY, store);
            renderCollections();
        }
    });

    if ($('collections-close')) $('collections-close').addEventListener('click', closeCollections);
    if (collOverlay) collOverlay.addEventListener('click', closeCollections);

    // Collections button
    var btnCollections = $('btn-collections');
    if (btnCollections) btnCollections.addEventListener('click', openCollections);

    /* ── History Drawer ────────────────────────────────────────────── */
    var histOverlay = $('history-overlay');
    var histDrawer = $('history-drawer');
    var histList = $('history-list');

    function openHistory() {
        renderHistory();
        histOverlay.style.display = 'block';
        histDrawer.style.display = 'flex';
    }
    function closeHistory() {
        histOverlay.style.display = 'none';
        histDrawer.style.display = 'none';
    }

    function renderHistory() {
        var history = loadStore(HISTORY_KEY);
        if (!history.length) {
            histList.innerHTML = '<div class="rest-drawer-empty"><i class="fa-solid fa-clock-rotate-left"></i>No history yet.<br>Send a request to start tracking.</div>';
            return;
        }
        var html = '';
        history.slice().reverse().forEach(function (h) {
            html += '<div class="rest-history-item" data-load-history="' + h.id + '">';
            html += '<span class="rest-method-badge">' + esc(h.method) + '</span>';
            html += '<div class="rest-history-meta">';
            html += '<span class="rest-history-endpoint">' + esc(h.endpoint) + '</span>';
            html += '<span class="rest-history-time">' + esc(h.status || '') + ' &middot; ' + timeAgo(h.timestamp) + '</span>';
            html += '</div>';
            html += '<button class="rest-history-delete" data-delete-history="' + h.id + '"><i class="fa-solid fa-xmark"></i></button>';
            html += '</div>';
        });
        histList.innerHTML = html;

        // Load from history
        histList.querySelectorAll('[data-load-history]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('.rest-history-delete')) return;
                var id = parseInt(el.dataset.loadHistory);
                var entry = history.find(function (h) { return h.id === id; });
                if (entry) {
                    var ms = $('method-select');
                    var ei = $('endpoint-input');
                    if (ms) ms.value = entry.method;
                    if (ei) ei.value = entry.endpoint;
                    closeHistory();
                }
            });
        });

        // Delete from history
        histList.querySelectorAll('[data-delete-history]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = parseInt(el.dataset.deleteHistory);
                var h = loadStore(HISTORY_KEY).filter(function (x) { return x.id !== id; });
                saveStore(HISTORY_KEY, h);
                renderHistory();
            });
        });
    }

    function addHistoryEntry(method, endpoint, status) {
        var store = loadStore(HISTORY_KEY);
        // Avoid duplicate consecutive entries
        var last = store[store.length - 1];
        if (last && last.method === method && last.endpoint === endpoint && last.status === status) return;
        store.push({
            id: Date.now(),
            method: method,
            endpoint: endpoint,
            status: status || '',
            timestamp: Date.now()
        });
        // Keep last 100
        if (store.length > 100) store = store.slice(-100);
        saveStore(HISTORY_KEY, store);
    }

    if ($('history-close')) $('history-close').addEventListener('click', closeHistory);
    if (histOverlay) histOverlay.addEventListener('click', closeHistory);
    var clearHistBtn = $('clear-history-btn');
    if (clearHistBtn) clearHistBtn.addEventListener('click', function () {
        saveStore(HISTORY_KEY, []);
        renderHistory();
    });

    // History button
    var btnHistory = $('btn-history');
    if (btnHistory) btnHistory.addEventListener('click', openHistory);

    /* ── Hook into send response to record history ─────────────────── */
    var origFetch = window.fetch;
    window.fetch = function () {
        return origFetch.apply(this, arguments).then(function (response) {
            // Only log Salesforce API calls
            var url = arguments[0];
            if (typeof url === 'string' && url.indexOf('/services/') !== -1) {
                var ms = $('method-select');
                var method = ms ? ms.value : 'GET';
                addHistoryEntry(method, url, response.status);
            }
            return response;
        });
    };

    /* ── Utility ───────────────────────────────────────────────────── */
    function esc(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
    function timeAgo(ts) {
        var diff = Date.now() - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return Math.floor(diff / 86400000) + 'd ago';
    }

    /* ── Helper: add header row ────────────────────────────────────── */
    function addHeaderRow(grid, key, value) {
        var row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML =
            '<input type="text" class="header-input header-key" value="' + esc(key || '') + '" placeholder="Key">' +
            '<input type="text" class="header-input header-val" value="' + esc(value || '') + '" placeholder="Value">' +
            '<button class="header-remove"><i class="fa-solid fa-trash"></i></button>';
        row.querySelector('.header-remove').addEventListener('click', function () { row.remove(); });
        grid.appendChild(row);
    }
})();
