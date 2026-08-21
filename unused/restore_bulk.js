const fs = require('fs');

const completeFunction = `
function bindBulkUpdaterEvents() {
    const targetTypeInput = document.getElementById('sfarc-bulk-target-type');
    const targetNameInput = document.getElementById('sfarc-bulk-target-name');
    const suggestionsBox = document.getElementById('sfarc-bulk-target-suggestions');
    const objSearch = document.getElementById('sfarc-bulk-obj-search');
    const objList = document.getElementById('sfarc-bulk-obj-list');
    const objSelectAll = document.getElementById('sfarc-bulk-obj-selectall');
    
    const next1Btn = document.getElementById('sfarc-bulk-next1-btn');
    const back1Btn = document.getElementById('sfarc-bulk-back1-btn');
    const next1bBtn = document.getElementById('sfarc-bulk-next1b-btn');

    const back2Btn = document.getElementById('sfarc-bulk-back2-btn');
    const next2Btn = document.getElementById('sfarc-bulk-next2-btn');
    
    const fldSearch = document.getElementById('sfarc-bulk-fld-search');
    const fldList = document.getElementById('sfarc-bulk-fld-list');
    const fldSelectAll = document.getElementById('sfarc-bulk-fld-selectall');
    
    const chkRead = document.getElementById('sfarc-bulk-chk-Read');
    const chkEdit = document.getElementById('sfarc-bulk-chk-Edit');

    const step1 = document.getElementById('sfarc-bulk-step1');
    const step2 = document.getElementById('sfarc-bulk-step2');
    const step3 = document.getElementById('sfarc-bulk-step3');
    const step4 = document.getElementById('sfarc-bulk-step4');
    
    const ind1 = document.getElementById('sfarc-wiz-ind-1');
    const ind2 = document.getElementById('sfarc-wiz-ind-2');
    const ind3 = document.getElementById('sfarc-wiz-ind-3');
    const ind4 = document.getElementById('sfarc-wiz-ind-4');

    const back4Btn = document.getElementById('sfarc-bulk-back4-btn');
    const executeBtn = document.getElementById('sfarc-bulk-execute-btn');
    const abortBtn = document.getElementById('sfarc-bulk-abort-btn');
    const rollbackBtn = document.getElementById('sfarc-bulk-rollback-btn');

    let allObjects = [];
    let selectedObjects = [];
    let allFields = [];
    let selectedFields = [];
    let selectedObjectPerms = {};
    let selectedRecordTypes = [];
    let parentId = null;

    let fieldPermsToApply = {};

    let debounceTimer;

    targetNameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = e.target.value.trim();
        if (!val || val.length < 2) {
            suggestionsBox.style.display = 'none';
            parentId = null;
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            const type = targetTypeInput.value;
            let q = '';
            if (type === 'PermissionSet') {
                q = \`SELECT Id, Name, Label FROM PermissionSet WHERE Name LIKE '%\${val}%' OR Label LIKE '%\${val}%' LIMIT 10\`;
            } else {
                q = \`SELECT Id, Name FROM Profile WHERE Name LIKE '%\${val}%' LIMIT 10\`;
            }
            
            try {
                const res = await window.sfApi.query(q);
                if (res && res.records && res.records.length > 0) {
                    suggestionsBox.innerHTML = res.records.map(r => \`<div class="sfarc-suggestion-item" data-id="\${r.Id}" data-name="\${window.escapeHtml(r.Name || r.Label)}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--sfarc-border);" onmouseover="this.style.background='var(--sfarc-hover)'" onmouseout="this.style.background='transparent'">\${window.escapeHtml(r.Name || r.Label)}</div>\`).join('');
                    suggestionsBox.style.display = 'block';
                    
                    document.querySelectorAll('.sfarc-suggestion-item').forEach(item => {
                        item.addEventListener('click', async (evt) => {
                            targetNameInput.value = evt.target.dataset.name;
                            let targetId = evt.target.dataset.id;
                            suggestionsBox.style.display = 'none';
                            
                            if (type === 'Profile') {
                                try {
                                    const psRes = await window.sfApi.query(\`SELECT Id FROM PermissionSet WHERE ProfileId = '\${targetId}' LIMIT 1\`);
                                    if (psRes && psRes.records && psRes.records.length > 0) {
                                        parentId = psRes.records[0].Id;
                                    } else {
                                        alert('Could not find associated Permission Set for this Profile.');
                                        parentId = null;
                                    }
                                } catch (err) {
                                    console.error('Failed to resolve Profile to Permission Set', err);
                                    parentId = null;
                                }
                            } else {
                                parentId = targetId;
                            }
                        });
                    });
                } else {
                    suggestionsBox.innerHTML = \`<div style="padding: 8px 12px; color: var(--sfarc-secondary-text);">No matches found</div>\`;
                    suggestionsBox.style.display = 'block';
                }
            } catch (e) {
                console.error('Failed to fetch suggestions', e);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!suggestionsBox.contains(e.target) && e.target !== targetNameInput) {
            suggestionsBox.style.display = 'none';
        }
    });

    const loadObjects = async () => {
        try {
            const res = await window.sfApi.fetch(\`/services/data/\${window.sfApi.apiVersion}/sobjects\`);
            const json = await res.json();
            if (json && json.sobjects) {
                allObjects = json.sobjects.map(o => ({
                    name: o.name,
                    label: o.label
                })).sort((a,b) => a.name.localeCompare(b.name));
                renderObjects();
            }
        } catch (e) {
            objList.innerHTML = \`<div style="color: red; text-align: center; margin-top: 20px;">Failed to load objects: \${window.escapeHtml(e.message)}</div>\`;
        }
    };

    const renderObjects = () => {
        const term = objSearch.value.toLowerCase();
        const filtered = allObjects.filter(o => o.name.toLowerCase().includes(term) || o.label.toLowerCase().includes(term));
        
        objList.innerHTML = filtered.map(o => \`
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px;">
                <input type="checkbox" class="sfarc-obj-chk" value="\${window.escapeHtml(o.name)}">
                <strong>\${window.escapeHtml(o.name)}</strong> <span style="color: var(--sfarc-secondary-text);">(\${window.escapeHtml(o.label)})</span>
            </label>
        \`).join('');
        
        objSelectAll.checked = false;
        objSelectAll.onchange = (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.sfarc-obj-chk').forEach(chk => {
                chk.checked = isChecked;
            });
        };
    };

    objSearch.addEventListener('input', renderObjects);

    const setStep = (stepNum) => {
        step1.style.display = stepNum === 1 ? 'flex' : 'none';
        step2.style.display = stepNum === 2 ? 'flex' : 'none';
        step3.style.display = stepNum === 3 ? 'flex' : 'none';
        step4.style.display = stepNum === 4 ? 'flex' : 'none';
        
        ind1.style.color = stepNum >= 1 ? 'var(--primary-color)' : 'var(--sfarc-secondary-text)';
        ind1.style.fontWeight = stepNum === 1 ? 'bold' : 'normal';
        ind2.style.color = stepNum >= 2 ? 'var(--primary-color)' : 'var(--sfarc-secondary-text)';
        ind2.style.fontWeight = stepNum === 2 ? 'bold' : 'normal';
        ind3.style.color = stepNum >= 3 ? 'var(--primary-color)' : 'var(--sfarc-secondary-text)';
        ind3.style.fontWeight = stepNum === 3 ? 'bold' : 'normal';
        ind4.style.color = stepNum === 4 ? 'var(--primary-color)' : 'var(--sfarc-secondary-text)';
        ind4.style.fontWeight = stepNum === 4 ? 'bold' : 'normal';
    };

    next1Btn.addEventListener('click', async () => {
        if (!targetNameInput.value.trim() || !parentId) {
            alert('Please select a Target Profile or Permission Set from the dropdown suggestions.');
            return;
        }
        
        selectedObjects = Array.from(document.querySelectorAll('.sfarc-obj-chk:checked')).map(chk => chk.value);
        if (selectedObjects.length === 0) {
            alert('Please select at least one object.');
            return;
        }
        
        setStep(2);
        const permsList = document.getElementById('sfarc-bulk-obj-perms-list');
        permsList.innerHTML = \`<div style="color: var(--sfarc-secondary-text); text-align: center; margin-top: 20px;">Loading Object & Record Type settings...</div>\`;
        
        let html = \`<div style="margin-bottom: 10px; font-weight: bold;">Object Permissions</div>\`;
        selectedObjects.forEach(obj => {
            html += \`
            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid var(--sfarc-border); border-radius: 4px;">
                <div style="font-weight: 600; margin-bottom: 5px;">\${window.escapeHtml(obj)}</div>
                <div style="display: flex; gap: 15px; font-size: 13px;">
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsRead"> Read</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsCreate"> Create</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsEdit"> Edit</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsDelete"> Delete</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsViewAllRecords"> View All</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="\${window.escapeHtml(obj)}" value="PermissionsModifyAllRecords"> Modify All</label>
                </div>
            </div>\`;
        });

        permsList.innerHTML = html;
        try {
            const rtIn = selectedObjects.map(o => \`'\${o}'\`).join(',');
            const rtQuery = \`SELECT Id, Name, DeveloperName, SobjectType FROM RecordType WHERE SobjectType IN (\${rtIn}) AND IsActive = true\`;
            const rtRes = await window.sfApi.query(rtQuery);
            if (rtRes && rtRes.records && rtRes.records.length > 0) {
                let rtHtml = \`<div style="margin-top: 20px; margin-bottom: 10px; font-weight: bold;">Record Type Access</div>\`;
                rtRes.records.forEach(rt => {
                    rtHtml += \`
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; border-bottom: 1px solid var(--sfarc-border);" class="sfarc-hover-row">
                        <div>
                            <strong>\${window.escapeHtml(rt.Name)}</strong> <span style="font-size:11px; color:var(--sfarc-secondary-text);">(\${window.escapeHtml(rt.SobjectType)})</span>
                        </div>
                        <label><input type="checkbox" class="sfarc-rt-chk" value="\${rt.Id}"> Grant Access</label>
                    </div>\`;
                });
                permsList.innerHTML += rtHtml;
            }
        } catch (e) {
            console.warn('Failed to fetch RecordTypes:', e);
        }
    });

    back1Btn.addEventListener('click', () => setStep(1));
    
    next1bBtn.addEventListener('click', async () => {
        selectedObjectPerms = {};
        document.querySelectorAll('.sfarc-obj-perm-chk:checked').forEach(chk => {
            const obj = chk.dataset.obj;
            const perm = chk.value;
            if (!selectedObjectPerms[obj]) selectedObjectPerms[obj] = {};
            selectedObjectPerms[obj][perm] = true;
        });

        selectedRecordTypes = Array.from(document.querySelectorAll('.sfarc-rt-chk:checked')).map(chk => chk.value);

        setStep(3);
        fldList.innerHTML = \`<div style="color: var(--sfarc-secondary-text); text-align: center; margin-top: 20px;">Fetching fields for \${selectedObjects.length} objects...</div>\`;
        
        try {
            allFields = [];
            for (const objName of selectedObjects) {
                try {
                    const res = await window.sfApi.describeSObject(objName);
                    if (res && res.fields) {
                        res.fields.forEach(f => {
                            allFields.push({
                                objName: objName,
                                name: f.name,
                                label: f.label,
                                apiName: \`\${objName}.\${f.name}\`
                            });
                        });
                    }
                } catch (err) {
                    console.warn(\`Failed to describe \${objName}:\`, err);
                }
            }
            allFields.sort((a, b) => a.apiName.localeCompare(b.apiName));
            renderFields();
        } catch (e) {
            fldList.innerHTML = \`<div style="color: red; text-align: center;">Error loading fields: \${window.escapeHtml(e.message)}</div>\`;
        }
    });

    const renderFields = () => {
        const term = fldSearch.value.toLowerCase();
        const filtered = allFields.filter(f => f.apiName.toLowerCase().includes(term) || f.label.toLowerCase().includes(term));
        
        fldList.innerHTML = filtered.map(f => \`
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid var(--sfarc-border);" class="sfarc-hover-row">
                <div>
                    <strong>\${window.escapeHtml(f.apiName)}</strong> <span style="color: var(--sfarc-secondary-text); font-size: 11px;">(\${window.escapeHtml(f.label)})</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <label style="font-size: 12px;"><input type="checkbox" class="sfarc-fld-chk-read" data-api="\${window.escapeHtml(f.apiName)}"> Read</label>
                    <label style="font-size: 12px;"><input type="checkbox" class="sfarc-fld-chk-edit" data-api="\${window.escapeHtml(f.apiName)}"> Edit</label>
                </div>
            </div>
        \`).join('');

        // Master toggle logic
        fldSelectAll.checked = false;
        fldSelectAll.onchange = (e) => {
            const isChecked = e.target.checked;
            const applyRead = chkRead.checked;
            const applyEdit = chkEdit.checked;
            
            document.querySelectorAll('.sfarc-fld-chk-read').forEach(chk => chk.checked = isChecked && applyRead);
            document.querySelectorAll('.sfarc-fld-chk-edit').forEach(chk => chk.checked = isChecked && applyEdit);
        };
    };

    fldSearch.addEventListener('input', renderFields);

    back2Btn.addEventListener('click', () => setStep(2));

    next2Btn.addEventListener('click', () => {
        fieldPermsToApply = {};
        let readCount = 0;
        let editCount = 0;

        document.querySelectorAll('.sfarc-fld-chk-read').forEach(chk => {
            if (chk.checked) {
                const api = chk.dataset.api;
                if (!fieldPermsToApply[api]) fieldPermsToApply[api] = {};
                fieldPermsToApply[api].Read = true;
                readCount++;
            }
        });
        document.querySelectorAll('.sfarc-fld-chk-edit').forEach(chk => {
            if (chk.checked) {
                const api = chk.dataset.api;
                if (!fieldPermsToApply[api]) fieldPermsToApply[api] = {};
                fieldPermsToApply[api].Edit = true;
                editCount++;
            }
        });

        selectedFields = Object.keys(fieldPermsToApply);

        setStep(4);
        window._sfarcFieldPermsToApply = fieldPermsToApply;
        
        document.getElementById('sfarc-bulk-summary-text').innerHTML = \`
            You are about to grant access to <strong>\${window.escapeHtml(targetNameInput.value)}</strong>:<br>
            <span style="font-size:13px; color:var(--sfarc-secondary-text);">
            \${Object.keys(selectedObjectPerms).length} Objects, \${selectedRecordTypes.length} Record Types, \${selectedFields.length} Fields (\${readCount} Read, \${editCount} Edit)
            </span>
        \`;
    });

    back4Btn.addEventListener('click', () => setStep(3));

    executeBtn.addEventListener('click', async () => {
        executeBtn.style.display = 'none';
        back4Btn.style.display = 'none';
        rollbackBtn.style.display = 'none';
        abortBtn.style.display = 'block';
        
        window._sfarcAbortSignal = false;
        window._sfarcOriginalFieldPerms = new Map();

        const progressContainer = document.getElementById('sfarc-bulk-progress-container');
        const progressBar = document.getElementById('sfarc-bulk-progress-bar');
        const progressText = document.getElementById('sfarc-bulk-progress-text');
        const resultsList = document.getElementById('sfarc-bulk-results-list');
        
        progressContainer.style.display = 'block';
        resultsList.style.display = 'block';
        resultsList.innerHTML = \`<div style="text-align: center; color: var(--sfarc-secondary-text);">Starting updates...</div>\`;
        progressBar.style.width = '0%';
        progressText.innerText = '0%';

        const fieldPerms = window._sfarcFieldPermsToApply || {};

        try {
            const compositeRequests = [];
            
            // =========================
            // 1. OBJECT PERMISSIONS
            // =========================
            const objApiNames = Object.keys(selectedObjectPerms);
            if (objApiNames.length > 0) {
                objApiNames.forEach(f => window._sfarcOriginalFieldPerms.set('OBJ_'+f, { exists: false }));
                const objChunkSize = 30;
                const existingObjMap = new Map();
                
                for (let i = 0; i < objApiNames.length; i += objChunkSize) {
                    const chunk = objApiNames.slice(i, i + objChunkSize);
                    const inClause = chunk.map(n => \`'\${n}'\`).join(',');
                    const existingQuery = \`SELECT Id, SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '\${parentId}' AND SobjectType IN (\${inClause})\`;
                    const existingRes = await window.sfApi.query(existingQuery);
                    if (existingRes && existingRes.records) {
                        existingRes.records.forEach(r => {
                            existingObjMap.set(r.SobjectType, r.Id);
                            window._sfarcOriginalFieldPerms.set('OBJ_'+r.SobjectType, {
                                Id: r.Id,
                                PermissionsRead: r.PermissionsRead, PermissionsCreate: r.PermissionsCreate,
                                PermissionsEdit: r.PermissionsEdit, PermissionsDelete: r.PermissionsDelete,
                                PermissionsViewAllRecords: r.PermissionsViewAllRecords, PermissionsModifyAllRecords: r.PermissionsModifyAllRecords,
                                exists: true, type: 'ObjectPermissions'
                            });
                        });
                    }
                }
                
                objApiNames.forEach((apiName, index) => {
                    const record = { attributes: { type: 'ObjectPermissions' } };
                    const perms = selectedObjectPerms[apiName];
                    if (perms.PermissionsRead) record.PermissionsRead = true;
                    if (perms.PermissionsCreate) record.PermissionsCreate = true;
                    if (perms.PermissionsEdit) record.PermissionsEdit = true;
                    if (perms.PermissionsDelete) record.PermissionsDelete = true;
                    if (perms.PermissionsViewAllRecords) record.PermissionsViewAllRecords = true;
                    if (perms.PermissionsModifyAllRecords) record.PermissionsModifyAllRecords = true;
                    
                    if (existingObjMap.has(apiName)) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/ObjectPermissions/\${existingObjMap.get(apiName)}\`,
                            referenceId: \`objreq_\${index}\`,
                            body: record
                        });
                    } else {
                        record.ParentId = parentId;
                        record.SobjectType = apiName;
                        compositeRequests.push({
                            method: "POST",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/ObjectPermissions/\`,
                            referenceId: \`objreq_\${index}\`,
                            body: record
                        });
                    }
                });
            }

            // =========================
            // 2. RECORD TYPE PERMISSIONS
            // =========================
            if (selectedRecordTypes.length > 0) {
                selectedRecordTypes.forEach(f => window._sfarcOriginalFieldPerms.set('RT_'+f, { exists: false }));
                const rtChunkSize = 50;
                const existingRtMap = new Map();
                
                for (let i = 0; i < selectedRecordTypes.length; i += rtChunkSize) {
                    const chunk = selectedRecordTypes.slice(i, i + rtChunkSize);
                    const inClause = chunk.map(n => \`'\${n}'\`).join(',');
                    const existingQuery = \`SELECT Id, SetupEntityId FROM SetupEntityAccess WHERE ParentId = '\${parentId}' AND SetupEntityId IN (\${inClause})\`;
                    const existingRes = await window.sfApi.query(existingQuery);
                    if (existingRes && existingRes.records) {
                        existingRes.records.forEach(r => {
                            existingRtMap.set(r.SetupEntityId, r.Id);
                            window._sfarcOriginalFieldPerms.set('RT_'+r.SetupEntityId, {
                                Id: r.Id, exists: true, type: 'SetupEntityAccess'
                            });
                        });
                    }
                }
                
                selectedRecordTypes.forEach((rtId, index) => {
                    if (!existingRtMap.has(rtId)) {
                        compositeRequests.push({
                            method: "POST",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/SetupEntityAccess/\`,
                            referenceId: \`rtreq_\${index}\`,
                            body: { attributes: { type: 'SetupEntityAccess' }, ParentId: parentId, SetupEntityId: rtId }
                        });
                    }
                });
            }

            // =========================
            // 3. FIELD PERMISSIONS
            // =========================
            const existingMap = new Map();
            const queryChunkSize = 30;
            
            selectedFields.forEach(f => window._sfarcOriginalFieldPerms.set('FLD_'+f, { exists: false }));

            for (let i = 0; i < selectedFields.length; i += queryChunkSize) {
                const chunk = selectedFields.slice(i, i + queryChunkSize);
                const inClause = chunk.map(n => \`'\${n}'\`).join(',');
                const existingQuery = \`SELECT Id, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '\${parentId}' AND Field IN (\${inClause})\`;
                const existingRes = await window.sfApi.query(existingQuery);
                if (existingRes && existingRes.records) {
                    existingRes.records.forEach(r => {
                        existingMap.set(r.Field, r.Id);
                        window._sfarcOriginalFieldPerms.set('FLD_'+r.Field, {
                            Id: r.Id, PermissionsRead: r.PermissionsRead, PermissionsEdit: r.PermissionsEdit,
                            exists: true, type: 'FieldPermissions'
                        });
                    });
                }
            }

            selectedFields.forEach((apiName, index) => {
                const record = { attributes: { type: 'FieldPermissions' } };
                if (fieldPerms[apiName].Read) record.PermissionsRead = true;
                if (fieldPerms[apiName].Edit) record.PermissionsEdit = true;
                
                if (existingMap.has(apiName)) {
                    compositeRequests.push({
                        method: "PATCH",
                        url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/FieldPermissions/\${existingMap.get(apiName)}\`,
                        referenceId: \`req_\${index}\`,
                        body: record
                    });
                } else {
                    record.ParentId = parentId;
                    record.Field = apiName;
                    record.SobjectType = apiName.split('.')[0];
                    compositeRequests.push({
                        method: "POST",
                        url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/FieldPermissions/\`,
                        referenceId: \`req_\${index}\`,
                        body: record
                    });
                }
            });

            // =========================
            // EXECUTE COMPOSITE BATCHES
            // =========================
            if (compositeRequests.length === 0) {
                resultsList.innerHTML = \`<div style="color: green; text-align: center; font-weight: bold; margin-top: 15px;">No changes selected to apply.</div>\`;
                abortBtn.style.display = 'none';
                back4Btn.style.display = 'block';
                return;
            }

            const results = [];
            const chunkSize = 25;
            for (let i = 0; i < compositeRequests.length; i += chunkSize) {
                if (window._sfarcAbortSignal) {
                    resultsList.innerHTML += \`<div style="color: red; text-align: center; margin-top: 10px; font-weight: bold;">Execution Aborted!</div>\`;
                    break;
                }

                const chunk = compositeRequests.slice(i, i + chunkSize);
                const payload = { allOrNone: false, compositeRequest: chunk };
                const compositeUrl = \`/services/data/\${window.sfApi.apiVersion}/composite\`;
                
                let response;
                try {
                    response = await window.sfApi.fetch(compositeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch (err) {
                    throw new Error(\`Composite Request Failed: \${err.message}\`);
                }
                
                if (!response.ok) throw new Error(\`Composite API returned \${response.status}: \${await response.text()}\`);

                const jsonRes = await response.json();
                if (jsonRes.compositeResponse) {
                    results.push(...jsonRes.compositeResponse);
                } else {
                    throw new Error("Invalid response format from Composite API");
                }
                
                const pct = Math.round(((i + chunk.length) / compositeRequests.length) * 100);
                progressBar.style.width = \`\${pct}%\`;
                progressText.innerText = \`\${pct}%\`;
            }

            let successCount = 0;
            let errorCount = 0;
            
            results.forEach((res, index) => {
                if (res.httpStatusCode >= 200 && res.httpStatusCode < 300) {
                    successCount++;
                } else {
                    errorCount++;
                }
            });
            
            resultsList.innerHTML = \`
                <div style="display: flex; gap: 20px; margin-bottom: 15px; padding: 15px; background: var(--sfarc-bg); border: 1px solid var(--sfarc-border);">
                    <div>Total Processed: \${results.length}</div>
                    <div style="color: green;">Success: \${successCount}</div>
                    <div style="color: red;">Errors: \${errorCount}</div>
                </div>
            \`;
            if (errorCount > 0) resultsList.innerHTML += \`<div style="color:red;font-size:12px;margin-bottom:10px;">Check developer console for specific error payloads, or Rollback to undo.</div>\`;
            
            abortBtn.style.display = 'none';
            back4Btn.style.display = 'block';
            rollbackBtn.style.display = 'block';

        } catch (e) {
            resultsList.innerHTML = \`<div style="color: red; text-align: center;">Error: \${window.escapeHtml(e.message)}</div>\`;
            abortBtn.style.display = 'none';
            back4Btn.style.display = 'block';
            rollbackBtn.style.display = 'block';
        }
    });

    abortBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to abort? Some changes may have already been applied.')) {
            window._sfarcAbortSignal = true;
            abortBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 5px;"></i> Aborting...';
            abortBtn.disabled = true;
        }
    });

    rollbackBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to rollback all modified permissions?')) {
            return;
        }
        
        rollbackBtn.style.display = 'none';
        back4Btn.style.display = 'none';

        const progressContainer = document.getElementById('sfarc-bulk-progress-container');
        const progressBar = document.getElementById('sfarc-bulk-progress-bar');
        const progressText = document.getElementById('sfarc-bulk-progress-text');
        const resultsList = document.getElementById('sfarc-bulk-results-list');
        
        progressContainer.style.display = 'block';
        resultsList.style.display = 'block';
        resultsList.innerHTML = \`<div style="text-align: center; color: var(--sfarc-secondary-text);">Starting Rollback...</div>\`;
        progressBar.style.width = '0%';
        progressText.innerText = '0%';

        try {
            const compositeRequests = [];
            
            for (let [key, original] of window._sfarcOriginalFieldPerms.entries()) {
                const isObj = key.startsWith('OBJ_');
                const isRt = key.startsWith('RT_');
                const isFld = key.startsWith('FLD_');
                const apiName = key.substring(4);
                
                let currentId = null;
                let q = '';
                if (isObj) q = \`SELECT Id FROM ObjectPermissions WHERE ParentId = '\${parentId}' AND SobjectType = '\${apiName}'\`;
                if (isRt) q = \`SELECT Id FROM SetupEntityAccess WHERE ParentId = '\${parentId}' AND SetupEntityId = '\${apiName}'\`;
                if (isFld) q = \`SELECT Id FROM FieldPermissions WHERE ParentId = '\${parentId}' AND Field = '\${apiName}'\`;
                
                const res = await window.sfApi.query(q);
                if (res && res.records && res.records.length > 0) {
                    currentId = res.records[0].Id;
                }
                
                if (original.exists) {
                    if (currentId && isObj) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/ObjectPermissions/\${currentId}\`,
                            referenceId: \`rb_\${key}\`,
                            body: {
                                PermissionsRead: original.PermissionsRead, PermissionsCreate: original.PermissionsCreate,
                                PermissionsEdit: original.PermissionsEdit, PermissionsDelete: original.PermissionsDelete,
                                PermissionsViewAllRecords: original.PermissionsViewAllRecords, PermissionsModifyAllRecords: original.PermissionsModifyAllRecords
                            }
                        });
                    }
                    if (currentId && isFld) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/FieldPermissions/\${currentId}\`,
                            referenceId: \`rb_\${key}\`,
                            body: { PermissionsRead: original.PermissionsRead, PermissionsEdit: original.PermissionsEdit }
                        });
                    }
                } else {
                    if (currentId) {
                        const sobjType = isObj ? 'ObjectPermissions' : (isRt ? 'SetupEntityAccess' : 'FieldPermissions');
                        compositeRequests.push({
                            method: "DELETE",
                            url: \`/services/data/\${window.sfApi.apiVersion}/sobjects/\${sobjType}/\${currentId}\`,
                            referenceId: \`rb_\${key}\`
                        });
                    }
                }
            }

            if (compositeRequests.length === 0) {
                resultsList.innerHTML = \`<div style="color: green; text-align: center; font-weight: bold; margin-top: 15px;">Nothing to rollback!</div>\`;
                back4Btn.style.display = 'block';
                return;
            }

            const results = [];
            const chunkSize = 25;
            for (let i = 0; i < compositeRequests.length; i += chunkSize) {
                const chunk = compositeRequests.slice(i, i + chunkSize);
                const payload = { allOrNone: false, compositeRequest: chunk };
                const compositeUrl = \`/services/data/\${window.sfApi.apiVersion}/composite\`;
                const response = await window.sfApi.fetch(compositeUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                const jsonRes = await response.json();
                if (jsonRes.compositeResponse) results.push(...jsonRes.compositeResponse);
                
                const pct = Math.round(((i + chunk.length) / compositeRequests.length) * 100);
                progressBar.style.width = \`\${pct}%\`;
                progressText.innerText = \`\${pct}%\`;
            }

            resultsList.innerHTML = \`<div style="color: green; text-align: center; margin-top: 15px; font-weight:bold;">Rollback Completed (\${results.length} records processed).</div>\`;
            back4Btn.style.display = 'block';
        } catch (e) {
            resultsList.innerHTML += \`<div style="color: red; text-align: center; margin-top: 10px;">Rollback Error: \${window.escapeHtml(e.message)}</div>\`;
            back4Btn.style.display = 'block';
        }
    });
    loadObjects();
}
`;

const fileContent = fs.readFileSync('main.js', 'utf8');

// Find the start of function bindBulkUpdaterEvents()
const startIdx = fileContent.indexOf('function bindBulkUpdaterEvents() {');
if (startIdx === -1) {
    console.error('Could not find function start');
    process.exit(1);
}

// Find the end of it (it is the last function in main.js, ending with 'loadObjects(); }')
const lastMatchStr = '    loadObjects();\n}';
let endIdx = fileContent.lastIndexOf(lastMatchStr);
if (endIdx === -1) {
    endIdx = fileContent.length; // just take the rest of the file
} else {
    endIdx += lastMatchStr.length;
}

const before = fileContent.substring(0, startIdx);
const after = fileContent.substring(endIdx);

fs.writeFileSync('main.js', before + completeFunction + after);
console.log('Restored complete bindBulkUpdaterEvents successfully!');
