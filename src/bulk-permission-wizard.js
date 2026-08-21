// bulk-permission-wizard.js — standalone page (own browser tab).
// 5-step guided flow: Target & Objects → Objects & Record Types →
// Object Permissions → Field Permissions → Verify & Execute. Reads real org metadata via the
// Tooling/Data APIs and writes ObjectPermissions + FieldPermissions
// through the composite endpoint (same mechanism as bulk-field-builder).
(function () {
    if (window.__bpwLoaded) return;
    window.__bpwLoaded = true;

    const st = {
        step: 1,
        permissionSetId: '',
        targetName: '',
        objectSearch: '',
        selectedObjects: [],
        allObjects: [],
        recordTypes: {},
        selectedRecordTypes: {},
        fieldPerms: {},
        crudPerms: {}
    };

    // ── Small query cache + request coalescing (mirrors code-editor) ──
    const sfQueryCache = new Map();
    const inFlightQueryMap = new Map();

    async function cachedSfApiQuery(soql, isTooling = true) {
        if (!window.sfApi) throw new Error('Salesforce API session unavailable.');
        const cacheKey = `${isTooling ? 'tooling:' : 'data:'}${soql}`;
        if (inFlightQueryMap.has(cacheKey)) {
            return inFlightQueryMap.get(cacheKey);
        }
        if (sfQueryCache.has(cacheKey)) {
            return sfQueryCache.get(cacheKey);
        }
        const requestPromise = (async () => {
            try {
                const res = await window.sfApi.query(soql, isTooling);
                if (res && res.records) sfQueryCache.set(cacheKey, res);
                return res;
            } finally {
                inFlightQueryMap.delete(cacheKey);
            }
        })();
        inFlightQueryMap.set(cacheKey, requestPromise);
        return requestPromise;
    }

    // ── Markup (matches the code editor's wizard view) ──
    function wizardMarkup() {
        return `
            <div class="bpw-root">
                <div class="bpw-header">
                    <div class="bpw-header-title">
                        <i class="fa-solid fa-layer-group"></i>
                        <div class="bpw-header-text">
                            <h2>Bulk Permission Wizard</h2>
                            <p>Guided setup to grant bulk permissions.</p>
                        </div>
                    </div>
                </div>

                <div class="bpw-stepper">
                    <div class="bpw-step ${st.step >= 1 ? 'active' : ''}" data-bpw-step="1">
                        <div class="bpw-step-circle">1</div>
                        <div class="bpw-step-label">Target &amp; Objects</div>
                    </div>
                    <div class="bpw-step-line ${st.step >= 2 ? 'active' : ''}"></div>
                    <div class="bpw-step ${st.step >= 2 ? 'active' : ''}" data-bpw-step="2">
                        <div class="bpw-step-circle">2</div>
                        <div class="bpw-step-label">Objects &amp; Record Types</div>
                    </div>
                    <div class="bpw-step-line ${st.step >= 3 ? 'active' : ''}"></div>
                    <div class="bpw-step ${st.step >= 3 ? 'active' : ''}" data-bpw-step="3">
                        <div class="bpw-step-circle">3</div>
                        <div class="bpw-step-label">Object Permissions</div>
                    </div>
                    <div class="bpw-step-line ${st.step >= 4 ? 'active' : ''}"></div>
                    <div class="bpw-step ${st.step >= 4 ? 'active' : ''}" data-bpw-step="4">
                        <div class="bpw-step-circle">4</div>
                        <div class="bpw-step-label">Field Permissions</div>
                    </div>
                    <div class="bpw-step-line ${st.step >= 5 ? 'active' : ''}"></div>
                    <div class="bpw-step ${st.step >= 5 ? 'active' : ''}" data-bpw-step="5">
                        <div class="bpw-step-circle">5</div>
                        <div class="bpw-step-label">Verify &amp; Execute</div>
                    </div>
                </div>

                <div class="bpw-body">
                    <div class="bpw-panel" data-bpw-panel="1" ${st.step === 1 ? '' : 'style="display:none;"'}>
                        <div class="bpw-controls">
                            <div class="bpw-control-group">
                                <label class="tool-label" for="bpw-permset">Permission Set</label>
                                <div class="bpw-select-wrap">
                                    <svg class="bpw-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    <select id="bpw-permset" class="tool-select bpw-permset" data-search-placeholder="Search permission sets..."><option value="">Loading permission sets...</option></select>
                                </div>
                            </div>
                            <div class="bpw-control-group bpw-target-search">
                                <label class="tool-label" for="bpw-target-name">Target Name</label>
                                <div class="bpw-search-wrap">
                                    <svg class="bpw-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    <input type="text" id="bpw-target-name" class="tool-input" placeholder="Enter target Name (e.g. Sales_User_PS)..." value="${escapeHtml(st.targetName || '')}" autocomplete="off" spellcheck="false">
                                </div>
                            </div>
                            <div class="bpw-control-group bpw-object-search">
                                <label class="tool-label" for="bpw-object-search">Select Objects</label>
                                <div class="bpw-search-wrap">
                                    <svg class="bpw-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    <input type="text" id="bpw-object-search" class="tool-input" placeholder="Search objects..." value="${escapeHtml(st.objectSearch || '')}" autocomplete="off" spellcheck="false">
                                </div>
                            </div>
                        </div>

                        <div class="bpw-list-box">
                            <div class="bpw-list-toolbar">
                                <label class="bpw-select-all">
                                    <input type="checkbox" id="bpw-select-all">
                                    <span>Select All</span>
                                </label>
                                <span class="bpw-count-badge" id="bpw-count-badge">0 objects</span>
                            </div>
                            <div class="bpw-list-head">
                                <span class="bpw-list-check"></span>
                                <span class="bpw-list-name">Object API Name</span>
                                <span class="bpw-list-desc">Description</span>
                            </div>
                            <div class="bpw-list-scroll" id="bpw-object-list"></div>
                        </div>

                        <div class="bpw-footer">
                            <button class="tool-btn primary bpw-next" id="bpw-next-1"><i class="fa-solid fa-arrow-right"></i> Next</button>
                        </div>
                    </div>

                    <div class="bpw-panel" data-bpw-panel="2" ${st.step === 2 ? '' : 'style="display:none;"'}>
                        <div class="bpw-list-box bpw-rt-box">
                            <div class="bpw-list-toolbar">
                                <span class="bpw-rt-title">Select Record Types to Include</span>
                                <label class="bpw-select-all">
                                    <input type="checkbox" id="bpw-rt-all">
                                    <span>All Record Types</span>
                                </label>
                            </div>
                            <div class="bpw-list-scroll bpw-rt-scroll" id="bpw-rt-list"></div>
                        </div>
                        <div class="bpw-footer">
                            <button class="tool-btn bpw-back" id="bpw-back-2"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button class="tool-btn primary bpw-next" id="bpw-next-2"><i class="fa-solid fa-arrow-right"></i> Next</button>
                        </div>
                    </div>

                    <div class="bpw-panel" data-bpw-panel="3" ${st.step === 3 ? '' : 'style="display:none;"'}>
                        <div class="bpw-list-box bpw-crud-box">
                            <div class="bpw-list-toolbar">
                                <span class="bpw-rt-title">Object-Level Security</span>
                                <span class="bpw-toolbar-note">Apply to all objects:</span>
                                <div class="bpw-crud-bulk" id="bpw-crud-bulk"></div>
                            </div>
                            <div class="bpw-crud-scroll" id="bpw-crud-list"></div>
                        </div>
                        <div class="bpw-footer">
                            <button class="tool-btn bpw-back" id="bpw-back-3"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button class="tool-btn primary bpw-next" id="bpw-next-3"><i class="fa-solid fa-arrow-right"></i> Next</button>
                        </div>
                    </div>

                    <div class="bpw-panel" data-bpw-panel="4" ${st.step === 4 ? '' : 'style="display:none;"'}>
                        <div class="bpw-list-box bpw-fields-box">
                            <div class="bpw-list-toolbar">
                                <span class="bpw-rt-title">Field-Level Security — Read / Edit per selected object</span>
                                <select id="bpw-fields-object" class="tool-select bpw-fields-object" aria-label="Object whose fields are shown"></select>
                                <label class="bpw-select-all">
                                    <input type="checkbox" id="bpw-fields-read-all">
                                    <span>All Read</span>
                                </label>
                                <label class="bpw-select-all">
                                    <input type="checkbox" id="bpw-fields-edit-all">
                                    <span>All Edit</span>
                                </label>
                            </div>
                            <div class="bpw-list-scroll bpw-fields-scroll" id="bpw-fields-list"></div>
                        </div>
                        <div class="bpw-footer">
                            <button class="tool-btn bpw-back" id="bpw-back-4"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button class="tool-btn primary bpw-next" id="bpw-next-4"><i class="fa-solid fa-arrow-right"></i> Next</button>
                        </div>
                    </div>

                    <div class="bpw-panel" data-bpw-panel="5" ${st.step === 5 ? '' : 'style="display:none;"'}>
                        <div class="bpw-list-box bpw-verify-box">
                            <div class="bpw-list-toolbar"><span class="bpw-rt-title">Review Summary</span></div>
                            <div class="bpw-verify-body" id="bpw-verify-summary"></div>
                        </div>
                        <div class="bpw-footer">
                            <button class="tool-btn bpw-back" id="bpw-back-5"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button class="tool-btn primary bpw-execute" id="bpw-execute"><i class="fa-solid fa-bolt"></i> Execute Permissions</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Logic (adapted from code-editor.js's bindBulkPermissionWizardTabListeners) ──
    function bindBulkPermissionWizardListeners() {
        const permSetSelect = document.getElementById('bpw-permset');
        const targetNameInput = document.getElementById('bpw-target-name');
        const objectSearchInput = document.getElementById('bpw-object-search');
        const selectAllCb = document.getElementById('bpw-select-all');
        const countBadge = document.getElementById('bpw-count-badge');
        const objectList = document.getElementById('bpw-object-list');
        const rtList = document.getElementById('bpw-rt-list');
        const rtAllCb = document.getElementById('bpw-rt-all');
        const crudList = document.getElementById('bpw-crud-list');
        const crudBulk = document.getElementById('bpw-crud-bulk');
        const fieldsList = document.getElementById('bpw-fields-list');
        const fieldsObjectSelect = document.getElementById('bpw-fields-object');
        const fieldsReadAllCb = document.getElementById('bpw-fields-read-all');
        const fieldsEditAllCb = document.getElementById('bpw-fields-edit-all');
        const verifySummary = document.getElementById('bpw-verify-summary');
        const executeBtn = document.getElementById('bpw-execute');

        let permissionSets = [];
        let filteredObjects = [];
        let currentObjectName = ''; // object whose fields are shown in step 3

        // ── Selection fast-path ─────────────────────────────────────────────
        // st.selectedObjects (the serializable state array) is mirrored in a
        // Set so membership checks are O(1) instead of O(n) per row (previously
        // O(n·k) per full list render). The array is rewritten on every change
        // so all readers (verify / execute / step 2) keep working unchanged.
        let selectedSet = new Set(st.selectedObjects || []);
        function commitSelection() {
            st.selectedObjects = Array.from(selectedSet);
        }

        // ── Debounce ────────────────────────────────────────────────────────
        // Both search fields used to filter + rebuild the whole list on every
        // keystroke. Debounce keeps typing smooth; the render itself is now a
        // single innerHTML build with one delegated change listener.
        let searchDebounce = null;
        function scheduleObjectListRender() {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(renderObjectList, 120);
        }

        function goToStep(n) {
            st.step = n;
            document.querySelectorAll('.bpw-panel').forEach(p => {
                p.style.display = p.dataset.bpwPanel === String(n) ? '' : 'none';
            });
            document.querySelectorAll('.bpw-step').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.bpwStep, 10) <= n);
            });
            document.querySelectorAll('.bpw-step-line').forEach((l, i) => {
                l.classList.toggle('active', n > i + 1);
            });
            if (n === 5) renderVerifySummary();
        }

        function renderObjectList() {
            const q = (objectSearchInput?.value || '').toLowerCase().trim();
            const tq = (targetNameInput?.value || '').toLowerCase().trim();
            // Precomputed `_key` (lowercased name) avoids re-lowercasing every
            // object on every keystroke; lazily backfills stale state.
            filteredObjects = st.allObjects.filter(o => {
                const key = o._key || (o._key = o.name.toLowerCase());
                return (!q || key.includes(q)) && (!tq || key.includes(tq));
            });

            if (countBadge) countBadge.innerText = `${filteredObjects.length} object${filteredObjects.length === 1 ? '' : 's'}`;

            if (!objectList) return;
            if (filteredObjects.length === 0) {
                objectList.innerHTML = '<div class="bpw-empty">No objects found</div>';
                renderPillsAndSelectAll();
                return;
            }

            // One string build + one innerHTML parse (was: createElement +
            // querySelector + addEventListener per row, 1169× per render).
            // Checkbox state comes from the Set; the change event is handled by
            // ONE delegated listener on the container, so toggling a box never
            // rebuilds the list.
            let html = '';
            for (let i = 0; i < filteredObjects.length; i++) {
                const o = filteredObjects[i];
                const selected = selectedSet.has(o.name);
                html += '<div class="bpw-object-row' + (selected ? ' selected' : '') + '" data-name="' + escapeHtml(o.name) + '">' +
                            '<label class="bpw-object-check"><input type="checkbox"' + (selected ? ' checked' : '') + '></label>' +
                            '<span class="bpw-object-name">' + escapeHtml(o.name) + '</span>' +
                            '<span class="bpw-object-desc">' + escapeHtml(o.label || '') + '</span>' +
                        '</div>';
            }
            objectList.innerHTML = html;
            renderPillsAndSelectAll();
        }

        function renderPillsAndSelectAll() {
            // Selected-object pills were removed by design; keep the select-all
            // checkbox state in sync with the currently visible objects.
            if (selectAllCb) {
                const visible = filteredObjects.length > 0;
                const allChecked = visible && filteredObjects.every(o => selectedSet.has(o.name));
                selectAllCb.checked = allChecked;
            }
        }

        // Single delegated listener: toggling any row's checkbox updates the Set
        // (O(1)), the row's highlight, and the select-all state — no rebuild.
        function bindObjectListDelegation() {
            if (!objectList || objectList._bpwBound) return;
            objectList._bpwBound = true;
            objectList.addEventListener('change', (e) => {
                const cb = e.target;
                if (!cb || cb.type !== 'checkbox') return;
                const row = cb.closest('.bpw-object-row');
                if (!row) return;
                const name = row.getAttribute('data-name');
                if (!name) return;
                if (cb.checked) {
                    selectedSet.add(name);
                    row.classList.add('selected');
                } else {
                    selectedSet.delete(name);
                    row.classList.remove('selected');
                }
                commitSelection();
                renderPillsAndSelectAll();
            });
        }

        async function loadPermissionSets() {
            if (!permSetSelect) return;
            permSetSelect.innerHTML = '<option value="">Loading permission sets...</option>';
            try {
                const res = await cachedSfApiQuery(`SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Label ASC LIMIT 500`, true);
                permissionSets = (res && res.records) || [];
                if (permissionSets.length === 0) {
                    permSetSelect.innerHTML = '<option value="">No permission sets found</option>';
                    return;
                }
                permSetSelect.innerHTML = permissionSets.map(ps =>
                    `<option value="${ps.Id}">${escapeHtml(ps.Label)} (${escapeHtml(ps.Name)})</option>`
                ).join('');
                if (st.permissionSetId) permSetSelect.value = st.permissionSetId;
            } catch (e) {
                permSetSelect.innerHTML = `<option value="">Error loading: ${escapeHtml(e.message)}</option>`;
                if (window.toast) toast.error('Bulk Permission Wizard: failed to load permission sets — ' + e.message);
            }
        }

        async function loadObjects() {
            const listEl = objectList;
            if (!listEl) return;
            if (st.allObjects.length > 0) {
                renderObjectList();
                return;
            }
            listEl.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading objects...</div>';
            try {
                const res = await window.sfApi.describeGlobal();
                const sobjects = (res && res.sobjects) || [];
                // `_key` is the lowercased name, precomputed once so the
                // per-keystroke filter never re-lowercases 1000+ objects.
                st.allObjects = sobjects
                    .filter(s => s.queryable !== false && !!s.name)
                    .map(s => ({ name: s.name, label: s.label || '', _key: s.name.toLowerCase() }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                st.allObjects = st.allObjects.filter(o => {
                    if (/__ChangeEvent$|__History$|__Share$/.test(o.name)) return false;
                    return true;
                });
                renderObjectList();
            } catch (e) {
                listEl.innerHTML = `<div class="bpw-empty">Failed to load objects: ${escapeHtml(e.message)}</div>`;
                if (window.toast) toast.error('Bulk Permission Wizard: failed to load objects — ' + e.message);
            }
        }

        // Renders the already-fetched record types. Kept separate from the
        // fetch so the "All Record Types" toggle never re-queries Salesforce.
        function renderRecordTypes() {
            if (!rtList) return;
            const names = st.selectedObjects;
            if (!st.recordTypes || Object.keys(st.recordTypes).length === 0) {
                rtList.innerHTML = '<div class="bpw-empty">No active record types found for the selected objects.</div>';
                return;
            }
            rtList.innerHTML = '';
            names.forEach(objName => {
                const rts = st.recordTypes[objName] || [];
                if (rts.length === 0) return;
                const group = document.createElement('div');
                group.className = 'bpw-rt-group';
                group.innerHTML = `<div class="bpw-rt-object">${escapeHtml(objName)}</div><div class="bpw-rt-items"></div>`;
                const items = group.querySelector('.bpw-rt-items');
                // O(1) membership per row instead of array.includes.
                const selSet = st.selectedRecordTypes[objName] ? new Set(st.selectedRecordTypes[objName]) : null;
                rts.forEach(rt => {
                    const selected = !selSet || selSet.has(rt.Id);
                    const row = document.createElement('label');
                    row.className = 'bpw-rt-row';
                    row.innerHTML = `<input type="checkbox" data-rt-id="${rt.Id}" ${selected ? 'checked' : ''}> <span>${escapeHtml(rt.Name || rt.DeveloperName || rt.Id)}</span>`;
                    const cb = row.querySelector('input');
                    cb.addEventListener('change', () => {
                        if (!st.selectedRecordTypes[objName]) st.selectedRecordTypes[objName] = [];
                        if (cb.checked) {
                            if (!st.selectedRecordTypes[objName].includes(rt.Id)) st.selectedRecordTypes[objName].push(rt.Id);
                        } else {
                            st.selectedRecordTypes[objName] = st.selectedRecordTypes[objName].filter(id => id !== rt.Id);
                        }
                    });
                    items.appendChild(row);
                });
                rtList.appendChild(group);
            });
        }

        async function loadRecordTypes() {
            if (!rtList) return;
            rtList.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading record types...</div>';
            try {
                const names = st.selectedObjects;
                if (names.length === 0) {
                    st.recordTypes = {};
                    renderRecordTypes();
                    return;
                }
                // A single `SobjectType IN (...)` with hundreds of objects blows
                // past SOQL's ~20k-character query limit, so batch the IN list
                // (~150 names per query) and merge the results.
                const CHUNK = 150;
                const queries = [];
                for (let i = 0; i < names.length; i += CHUNK) {
                    const batch = names.slice(i, i + CHUNK);
                    queries.push(cachedSfApiQuery(
                        `SELECT Id, Name, SobjectType, IsActive FROM RecordType WHERE SobjectType IN (${batch.map(n => `'${n}'`).join(',')}) AND IsActive = true`, true
                    ));
                }
                const results = await Promise.all(queries);
                st.recordTypes = {};
                results.forEach(res => {
                    const records = (res && res.records) || [];
                    records.forEach(r => {
                        if (!st.recordTypes[r.SobjectType]) st.recordTypes[r.SobjectType] = [];
                        st.recordTypes[r.SobjectType].push(r);
                    });
                });
                renderRecordTypes();
            } catch (e) {
                rtList.innerHTML = `<div class="bpw-empty">Failed to load record types: ${escapeHtml(e.message)}</div>`;
                if (window.toast) toast.error('Bulk Permission Wizard: failed to load record types — ' + e.message);
            }
        }

        const CRUD_PERMISSIONS = [
            ['read', 'Read'],
            ['create', 'Create'],
            ['edit', 'Edit'],
            ['delete', 'Delete'],
            ['viewAll', 'View All Records'],
            ['modifyAll', 'Modify All Records']
        ];

        function ensureCrudState(objName) {
            if (!st.crudPerms[objName]) {
                st.crudPerms[objName] = {
                    read: true,
                    create: false,
                    edit: false,
                    delete: false,
                    viewAll: false,
                    modifyAll: false
                };
            }
            return st.crudPerms[objName];
        }

        function normalizeCrudState(crud, changedPerm, checked) {
            crud[changedPerm] = checked;
            if (checked && ['edit', 'delete', 'viewAll', 'modifyAll'].includes(changedPerm)) crud.read = true;
            if (checked && changedPerm === 'modifyAll') {
                crud.edit = true;
                crud.delete = true;
                crud.viewAll = true;
            }
            if (!checked && changedPerm === 'read') {
                crud.edit = false;
                crud.delete = false;
                crud.viewAll = false;
                crud.modifyAll = false;
            }
            if (!checked && ['edit', 'delete', 'viewAll'].includes(changedPerm)) crud.modifyAll = false;
        }

        function renderCrudPermissions() {
            if (!crudList) return;
            if (st.selectedObjects.length === 0) {
                crudList.innerHTML = '<div class="bpw-empty">No objects selected.</div>';
                return;
            }
            crudList.innerHTML = st.selectedObjects.map(objName => {
                const crud = ensureCrudState(objName);
                const toggles = CRUD_PERMISSIONS.map(([key, label]) => `
                    <label class="bpw-crud-toggle">
                        <input type="checkbox" data-object="${escapeHtml(objName)}" data-perm="${key}" ${crud[key] ? 'checked' : ''}>
                        <span>${label}</span>
                    </label>
                `).join('');
                return `
                    <div class="bpw-crud-row">
                        <span class="bpw-crud-object">${escapeHtml(objName)}</span>
                        <div class="bpw-crud-permissions">${toggles}</div>
                    </div>
                `;
            }).join('');
            renderCrudBulkControls();
        }

        function renderCrudBulkControls() {
            if (!crudBulk) return;
            crudBulk.innerHTML = CRUD_PERMISSIONS.map(([key, label]) => {
                const values = st.selectedObjects.map(name => !!ensureCrudState(name)[key]);
                const checked = values.length > 0 && values.every(Boolean);
                return `<label class="bpw-crud-toggle bpw-crud-bulk-toggle"><input type="checkbox" data-bulk-perm="${key}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
            }).join('');
            CRUD_PERMISSIONS.forEach(([key]) => {
                const cb = crudBulk.querySelector(`input[data-bulk-perm="${key}"]`);
                const values = st.selectedObjects.map(name => !!ensureCrudState(name)[key]);
                if (cb) cb.indeterminate = values.some(Boolean) && !values.every(Boolean);
            });
        }

        // Renders the already-described fields; the "All Fields" toggle calls
        // this directly instead of re-describing the object.
        function renderFields() {
            if (!fieldsList) return;
            const entry = st.fieldPerms[currentObjectName] || {};
            const fieldNames = Object.keys(entry);
            if (fieldNames.length === 0) {
                fieldsList.innerHTML = '<div class="bpw-empty">No fields found.</div>';
                return;
            }
            fieldsList.innerHTML = '';
            fieldNames.forEach(fName => {
                const fp = entry[fName];
                const row = document.createElement('div');
                row.className = 'bpw-field-row';
                row.innerHTML = `
                    <span class="bpw-field-name">${escapeHtml(fp.label || fName)} <span class="bpw-field-api">${escapeHtml(fName)}</span></span>
                    <span class="bpw-field-type">${escapeHtml(fp.type || '')}</span>
                    <label class="bpw-field-toggle"><input type="checkbox" data-fld="${escapeHtml(fName)}" data-perm="read" ${fp.read ? 'checked' : ''}> Read</label>
                    <label class="bpw-field-toggle"><input type="checkbox" data-fld="${escapeHtml(fName)}" data-perm="edit" ${fp.edit ? 'checked' : ''} ${fp.editable === false ? 'disabled' : ''}> Edit</label>
                `;
                row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', () => {
                        const perm = cb.dataset.perm;
                        if (perm === 'edit' && cb.checked) {
                            const readCb = row.querySelector('input[data-perm="read"]');
                            if (readCb) readCb.checked = true;
                            entry[cb.dataset.fld].read = true;
                        }
                        if (perm === 'read' && !cb.checked) {
                            const editCb = row.querySelector('input[data-perm="edit"]');
                            if (editCb) editCb.checked = false;
                            entry[cb.dataset.fld].edit = false;
                        }
                        entry[cb.dataset.fld][perm] = cb.checked;
                        syncFieldBulkControls();
                    });
                });
                fieldsList.appendChild(row);
            });
            syncFieldBulkControls();
        }

        function syncFieldBulkControls() {
            const entry = st.fieldPerms[currentObjectName] || {};
            const fields = Object.values(entry);
            if (fieldsReadAllCb) {
                fieldsReadAllCb.checked = fields.length > 0 && fields.every(fp => fp.read);
                fieldsReadAllCb.indeterminate = fields.some(fp => fp.read) && !fieldsReadAllCb.checked;
            }
            if (fieldsEditAllCb) {
                const editable = fields.filter(fp => fp.editable !== false);
                fieldsEditAllCb.checked = editable.length > 0 && editable.every(fp => fp.edit);
                fieldsEditAllCb.indeterminate = editable.some(fp => fp.edit) && !fieldsEditAllCb.checked;
            }
        }

        async function loadFields() {
            if (!fieldsList) return;
            if (!currentObjectName) return;
            if (st.fieldPerms[currentObjectName] && Object.keys(st.fieldPerms[currentObjectName]).length > 0) {
                renderFields();
                return;
            }
            fieldsList.innerHTML = '<div class="bpw-empty"><span class="comet-loader-inline"></span> Loading fields...</div>';
            try {
                const desc = await window.sfApi.describeSObject(currentObjectName);
                const fields = (desc && desc.fields) || [];
                st.fieldPerms[currentObjectName] = {};
                const stateEntry = st.fieldPerms[currentObjectName];
                fields.forEach(f => {
                    const editable = f.updateable === true && f.createable === true;
                    stateEntry[f.name] = { read: true, edit: editable, editable, label: f.label || f.name, type: f.type || '' };
                });
                renderFields();
            } catch (e) {
                fieldsList.innerHTML = `<div class="bpw-empty">Failed to load fields: ${escapeHtml(e.message)}</div>`;
                if (window.toast) toast.error('Bulk Permission Wizard: failed to load fields — ' + e.message);
            }
        }

        function renderVerifySummary() {
            if (!verifySummary) return;
            const ps = permissionSets.find(p => p.Id === st.permissionSetId);
            let html = `
                <div class="bpw-verify-row"><span>Permission Set</span><strong>${escapeHtml(ps ? `${ps.Label} (${ps.Name})` : st.permissionSetId || '—')}</strong></div>
                <div class="bpw-verify-row"><span>Objects</span><strong>${st.selectedObjects.length}</strong></div>
            `;
            st.selectedObjects.forEach(objName => {
                const fields = st.fieldPerms[objName] || {};
                const fieldCount = Object.keys(fields).length;
                const rts = st.recordTypes[objName] || [];
                const crud = ensureCrudState(objName);
                const objectPermissions = CRUD_PERMISSIONS.filter(([key]) => crud[key]).map(([, label]) => label);
                html += `
                    <div class="bpw-verify-object">
                        <div class="bpw-verify-objhead"><strong>${escapeHtml(objName)}</strong><span>${fieldCount} fields</span></div>
                        <div class="bpw-verify-sub">Object permissions: ${escapeHtml(objectPermissions.join(', ') || 'None')}</div>
                        <div class="bpw-verify-sub">Record Types: ${rts.length > 0 ? rts.length : 'All'}</div>
                    </div>
                `;
            });
            verifySummary.innerHTML = html;
        }

        async function executePermissions() {
            if (!executeBtn) return;
            if (!st.permissionSetId) {
                if (window.toast) toast.error('Please select a permission set first.');
                return;
            }
            if (st.selectedObjects.length === 0) {
                if (window.toast) toast.error('Please select at least one object.');
                return;
            }

            executeBtn.disabled = true;
            const orig = executeBtn.innerHTML;
            executeBtn.innerHTML = `<span class="comet-loader-inline"></span> Executing...`;

            const psId = st.permissionSetId;
            let success = 0, failed = 0;
            const failures = [];

            try {
                // 1. ObjectPermissions (CRUD) per selected object
                const objPerms = st.selectedObjects.map(objName => {
                    const crud = st.crudPerms[objName] || {};
                    return {
                        attributes: { type: 'ObjectPermissions' },
                        ParentId: psId,
                        SobjectType: objName,
                        PermissionsCreate: !!crud.create,
                        PermissionsRead: !!crud.read || !Object.keys(crud).length,
                        PermissionsEdit: !!crud.edit,
                        PermissionsDelete: !!crud.delete,
                        PermissionsViewAllRecords: !!crud.viewAll,
                        PermissionsModifyAllRecords: !!crud.modifyAll
                    };
                });

                for (let i = 0; i < objPerms.length; i += 25) {
                    const chunk = objPerms.slice(i, i + 25);
                    const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                        method: 'POST',
                        body: JSON.stringify({
                            allOrNone: false,
                            compositeRequest: chunk.map((p, idx) => ({
                                method: 'POST',
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions`,
                                referenceId: `obj${idx}`,
                                body: p
                            }))
                        })
                    });
                    const json = await res.json();
                    (json.compositeResponse || []).forEach((cr, idx) => {
                        if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) success++;
                        else {
                            failed++;
                            const msg = cr.body && cr.body[0] && cr.body[0].message ? cr.body[0].message : (cr.body && cr.body.message ? cr.body.message : 'Object permission failed');
                            failures.push(`${chunk[idx].SobjectType}: ${msg}`);
                        }
                    });
                }

                // 2. FieldPermissions (FLS) per selected object + field
                const fieldPerms = [];
                st.selectedObjects.forEach(objName => {
                    const fields = st.fieldPerms[objName] || {};
                    Object.keys(fields).forEach(fieldName => {
                        const fp = fields[fieldName];
                        if (fp.read || fp.edit) {
                            fieldPerms.push({
                                attributes: { type: 'FieldPermissions' },
                                ParentId: psId,
                                SobjectType: objName,
                                Field: `${objName}.${fieldName}`,
                                PermissionsRead: !!fp.read,
                                PermissionsEdit: !!fp.edit
                            });
                        }
                    });
                });

                for (let i = 0; i < fieldPerms.length; i += 25) {
                    const chunk = fieldPerms.slice(i, i + 25);
                    const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                        method: 'POST',
                        body: JSON.stringify({
                            allOrNone: false,
                            compositeRequest: chunk.map((p, idx) => ({
                                method: 'POST',
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions`,
                                referenceId: `fld${idx}`,
                                body: p
                            }))
                        })
                    });
                    const json = await res.json();
                    (json.compositeResponse || []).forEach((cr, idx) => {
                        if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) success++;
                        else {
                            failed++;
                            const msg = cr.body && cr.body[0] && cr.body[0].message ? cr.body[0].message : (cr.body && cr.body.message ? cr.body.message : 'Field permission failed');
                            failures.push(`${chunk[idx].SobjectType}.${chunk[idx].Field}: ${msg}`);
                        }
                    });
                }

                if (verifySummary) {
                    verifySummary.innerHTML = `
                        <div class="bpw-verify-result ${failed === 0 ? 'ok' : 'err'}">
                            <i class="fa-solid ${failed === 0 ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                            <div><strong>${failed === 0 ? 'All permissions granted!' : 'Completed with errors'}</strong>
                            <span>${success} succeeded, ${failed} failed</span></div>
                        </div>
                        ${failures.slice(0, 20).map(f => `<div class="bpw-verify-fail">${escapeHtml(f)}</div>`).join('')}
                    `;
                }
                if (window.toast) toast.success(`Bulk Permission Wizard: ${success} permissions granted, ${failed} failed`);
            } catch (e) {
                console.error('Bulk Permission Wizard execute error:', e);
                if (window.toast) toast.error('Execution failed: ' + e.message);
                if (verifySummary) {
                    verifySummary.innerHTML = `<div class="bpw-verify-result err"><i class="fa-solid fa-circle-exclamation"></i><div><strong>Execution failed</strong><span>${escapeHtml(e.message)}</span></div></div>`;
                }
            } finally {
                executeBtn.disabled = false;
                executeBtn.innerHTML = orig;
            }
        }

        // ── Clear buttons inside both search bars (UX) ──
        function addClearButton(wrap, input, onClear) {
            if (!wrap) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bpw-search-clear';
            btn.setAttribute('aria-label', 'Clear search');
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            wrap.appendChild(btn);
            const update = () => wrap.classList.toggle('has-text', input.value.length > 0);
            input.addEventListener('input', update);
            btn.addEventListener('click', () => {
                input.value = '';
                wrap.classList.remove('has-text');
                if (onClear) onClear();
                input.focus();
            });
            update();
        }

        const targetWrap = targetNameInput ? targetNameInput.closest('.bpw-search-wrap') : null;
        const objectWrap = objectSearchInput ? objectSearchInput.closest('.bpw-search-wrap') : null;
        addClearButton(targetWrap, targetNameInput, renderObjectList);
        addClearButton(objectWrap, objectSearchInput, renderObjectList);

        // ── Event wiring ──
        bindObjectListDelegation();
        if (permSetSelect) permSetSelect.addEventListener('change', () => { st.permissionSetId = permSetSelect.value; });
        if (targetNameInput) targetNameInput.addEventListener('input', scheduleObjectListRender);
        if (objectSearchInput) objectSearchInput.addEventListener('input', scheduleObjectListRender);
        if (selectAllCb) {
            selectAllCb.addEventListener('change', () => {
                if (selectAllCb.checked) {
                    filteredObjects.forEach(o => selectedSet.add(o.name));
                } else {
                    filteredObjects.forEach(o => selectedSet.delete(o.name));
                }
                commitSelection();
                renderObjectList();
            });
        }
        if (rtAllCb) {
            rtAllCb.addEventListener('change', () => {
                if (rtAllCb.checked) st.selectedRecordTypes = {};
                else {
                    st.selectedRecordTypes = {};
                    Object.keys(st.recordTypes).forEach(objName => {
                        st.selectedRecordTypes[objName] = [];
                    });
                }
                // Re-render from the fetched data — no re-query.
                renderRecordTypes();
            });
        }
        if (crudList) {
            crudList.addEventListener('change', (e) => {
                const cb = e.target;
                if (!cb || cb.type !== 'checkbox') return;
                const objName = cb.dataset.object;
                const perm = cb.dataset.perm;
                if (!objName || !perm) return;
                normalizeCrudState(ensureCrudState(objName), perm, cb.checked);
                renderCrudPermissions();
            });
        }
        if (crudBulk) {
            crudBulk.addEventListener('change', (e) => {
                const cb = e.target;
                if (!cb || cb.type !== 'checkbox' || !cb.dataset.bulkPerm) return;
                st.selectedObjects.forEach(objName => normalizeCrudState(ensureCrudState(objName), cb.dataset.bulkPerm, cb.checked));
                renderCrudPermissions();
            });
        }
        if (fieldsReadAllCb) {
            fieldsReadAllCb.addEventListener('change', () => {
                if (!currentObjectName) return;
                const entry = st.fieldPerms[currentObjectName] || {};
                Object.keys(entry).forEach(f => {
                    entry[f].read = fieldsReadAllCb.checked;
                    if (!fieldsReadAllCb.checked) entry[f].edit = false;
                });
                renderFields();
            });
        }
        if (fieldsEditAllCb) {
            fieldsEditAllCb.addEventListener('change', () => {
                if (!currentObjectName) return;
                const entry = st.fieldPerms[currentObjectName] || {};
                Object.keys(entry).forEach(f => {
                    if (entry[f].editable === false) return;
                    entry[f].edit = fieldsEditAllCb.checked;
                    if (fieldsEditAllCb.checked) entry[f].read = true;
                });
                renderFields();
            });
        }
        if (fieldsObjectSelect) {
            fieldsObjectSelect.addEventListener('change', () => {
                currentObjectName = fieldsObjectSelect.value;
                loadFields();
            });
        }

        const next1 = document.getElementById('bpw-next-1');
        const next2 = document.getElementById('bpw-next-2');
        const next3 = document.getElementById('bpw-next-3');
        const next4 = document.getElementById('bpw-next-4');
        const back2 = document.getElementById('bpw-back-2');
        const back3 = document.getElementById('bpw-back-3');
        const back4 = document.getElementById('bpw-back-4');
        const back5 = document.getElementById('bpw-back-5');

        if (next1) next1.addEventListener('click', () => {
            if (!st.permissionSetId) { if (window.toast) toast.error('Select a permission set first.'); return; }
            if (st.selectedObjects.length === 0) { if (window.toast) toast.error('Select at least one object.'); return; }
            loadRecordTypes();
            goToStep(2);
        });
        if (next2) next2.addEventListener('click', () => {
            renderCrudPermissions();
            goToStep(3);
        });
        if (next3) next3.addEventListener('click', () => {
            currentObjectName = st.selectedObjects[0] || '';
            if (fieldsObjectSelect) {
                fieldsObjectSelect.innerHTML = st.selectedObjects.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
                fieldsObjectSelect.value = currentObjectName;
            }
            loadFields();
            goToStep(4);
        });
        if (next4) next4.addEventListener('click', () => goToStep(5));
        if (back2) back2.addEventListener('click', () => goToStep(1));
        if (back3) back3.addEventListener('click', () => goToStep(2));
        if (back4) back4.addEventListener('click', () => goToStep(3));
        if (back5) back5.addEventListener('click', () => goToStep(4));
        if (executeBtn) executeBtn.addEventListener('click', executePermissions);

        // Init
        loadPermissionSets();
        loadObjects();
    }

    // ── Boot ──
    async function init() {
        const root = document.getElementById('bpw-root');
        if (!root) return;
        root.innerHTML = wizardMarkup();

        // Establish a Salesforce session first so API calls have credentials.
        try {
            if (window.sfApi && !window.sfApi.sessionId) {
                await window.sfApi.init();
            }
        } catch (e) {
            console.error('Bulk Permission Wizard: session init failed', e);
            const listEl = document.getElementById('bpw-object-list');
            if (listEl) listEl.innerHTML = `<div class="bpw-empty">Session unavailable: ${escapeHtml(e.message)}</div>`;
        }

        bindBulkPermissionWizardListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
