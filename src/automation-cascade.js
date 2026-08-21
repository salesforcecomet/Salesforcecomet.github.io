(function () {
    let currentMetadata = {
        triggers: [],
        beforeFlows: [],
        afterFlows: [],
        validations: [],
        workflows: []
    };

    async function initSession() {
        if (window.sfApi) {
            try {
                if (!window.sfApi.sessionId) await window.sfApi.init();
            } catch (e) {
                console.error('Session init error:', e);
            }
        }
    }

    async function fetchObjectAutomations(objectName) {
        await initSession();

        const timelineContainer = document.getElementById('timeline-container');
        if (timelineContainer) {
            timelineContainer.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 13px;">
                    <span class="comet-loader-inline" style="margin: 0 auto 8px;"></span>
                    <div>Fetching automations for ${objectName}...</div>
                </div>`;
        }

        try {
            // 1. Query Apex Triggers
            const triggerQuery = `SELECT Id, Name, TableEnumOrId, UsageBeforeInsert, UsageBeforeUpdate, UsageAfterInsert, UsageAfterUpdate, Status FROM ApexTrigger WHERE TableEnumOrId = '${objectName}' AND Status = 'Active'`;
            const triggerRes = await window.sfApi.query(triggerQuery, true).catch(() => ({ records: [] }));

            // 2. Query Validation Rules
            const valQuery = `SELECT Id, ValidationName, ErrorMessage, Formula FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = '${objectName}' AND Active = true`;
            const valRes = await window.sfApi.query(valQuery, true).catch(() => ({ records: [] }));

            // 3. Query Active Flows
            const flowQuery = `SELECT Id, MasterLabel, DeveloperName, ProcessType, TriggerType FROM FlowDefinitionView WHERE TriggerObjectOrEvent.QualifiedApiName = '${objectName}' AND IsActive = true`;
            const flowRes = await window.sfApi.query(flowQuery, true).catch(() => ({ records: [] }));

            // 4. Query Workflow Rules
            const wfQuery = `SELECT Id, Name, TableEnumOrId FROM WorkflowRule WHERE TableEnumOrId = '${objectName}'`;
            const wfRes = await window.sfApi.query(wfQuery, true).catch(() => ({ records: [] }));

            const triggers = triggerRes.records || [];
            const validations = valRes.records || [];
            const flows = flowRes.records || [];
            const workflows = wfRes.records || [];

            const beforeFlows = flows.filter(f => f.TriggerType === 'RecordBeforeSave' || f.TriggerType === 'BeforeSave');
            const afterFlows = flows.filter(f => f.TriggerType !== 'RecordBeforeSave' && f.TriggerType !== 'BeforeSave');

            currentMetadata = {
                triggers,
                beforeFlows,
                afterFlows,
                validations,
                workflows
            };

            updateMetrics();
            renderTimeline();
        } catch (error) {
            console.error('Error fetching automations:', error);
            if (timelineContainer) {
                timelineContainer.innerHTML = `
                    <div style="text-align: center; color: #f87171; padding: 40px; font-size: 13px;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 8px;"></i>
                        <div>Error querying metadata: ${error.message}</div>
                    </div>`;
            }
        }
    }

    function updateMetrics() {
        document.getElementById('count-before-flows').innerText = currentMetadata.beforeFlows.length;
        document.getElementById('count-triggers').innerText = currentMetadata.triggers.length;
        document.getElementById('count-validations').innerText = currentMetadata.validations.length;
        document.getElementById('count-after-flows').innerText = currentMetadata.afterFlows.length;
        
        // Simple conflict detector if both Triggers and Flows exist on before/after
        const conflicts = (currentMetadata.beforeFlows.length > 0 && currentMetadata.triggers.length > 0) ? 1 : 0;
        document.getElementById('count-conflicts').innerText = conflicts;

        const conflictsBox = document.getElementById('conflicts-container');
        if (conflictsBox) {
            if (conflicts > 0) {
                conflictsBox.style.display = 'flex';
                conflictsBox.innerHTML = `
                    <div class="conflict-warning">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 16px;"></i>
                        <div>
                            <strong>Potential Execution Order Conflict Detected:</strong>
                            Both Record-Triggered Before-Save Flows and Apex Before Triggers exist. Before-Save Flows execute in Step 2, while Apex Triggers execute in Step 3. Verify field updates do not overwrite each other.
                        </div>
                    </div>`;
            } else {
                conflictsBox.style.display = 'none';
            }
        }
    }

    function renderTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        const steps = [
            {
                number: 1,
                title: 'System Validation & Initial Load',
                icon: 'fa-check-double',
                items: [{ name: 'Standard Field Lengths, Required Fields, System Format Validation', subtext: 'Built-in Salesforce Engine' }]
            },
            {
                number: 2,
                title: 'Before-Save Flows (Fast Field Updates)',
                icon: 'fa-bolt',
                items: currentMetadata.beforeFlows.map(f => ({ name: f.MasterLabel || f.DeveloperName, subtext: `Flow API: ${f.DeveloperName}` }))
            },
            {
                number: 3,
                title: 'Apex Before Triggers',
                icon: 'fa-code',
                items: currentMetadata.triggers.filter(t => t.UsageBeforeInsert || t.UsageBeforeUpdate).map(t => ({ name: `${t.Name}.trigger`, subtext: `Status: ${t.Status}` }))
            },
            {
                number: 4,
                title: 'Custom Validation Rules',
                icon: 'fa-shield-halved',
                items: currentMetadata.validations.map(v => ({ name: v.ValidationName, subtext: v.ErrorMessage || v.Formula || 'Active Validation' }))
            },
            {
                number: 5,
                title: 'Duplicate Rules Verification',
                icon: 'fa-clone',
                items: [{ name: 'Matching & Duplicate Rules Check', subtext: 'Standard / Custom Duplicate Rules' }]
            },
            {
                number: 6,
                title: 'Initial Database Save',
                icon: 'fa-database',
                items: [{ name: 'Record saved to database (Not yet committed)', subtext: 'Uncommitted DML Transaction' }]
            },
            {
                number: 7,
                title: 'Apex After Triggers',
                icon: 'fa-code',
                items: currentMetadata.triggers.filter(t => t.UsageAfterInsert || t.UsageAfterUpdate).map(t => ({ name: `${t.Name}.trigger`, subtext: `Status: ${t.Status}` }))
            },
            {
                number: 8,
                title: 'Workflow Rules & Field Updates',
                icon: 'fa-gears',
                items: currentMetadata.workflows.map(w => ({ name: w.Name, subtext: 'Workflow Rule' }))
            },
            {
                number: 9,
                title: 'After-Save Flows (Actions & Related Updates)',
                icon: 'fa-layer-group',
                items: currentMetadata.afterFlows.map(f => ({ name: f.MasterLabel || f.DeveloperName, subtext: `Flow API: ${f.DeveloperName}` }))
            },
            {
                number: 10,
                title: 'Parent Roll-Up Summaries & Commits',
                icon: 'fa-chart-line',
                items: [{ name: 'Roll-Up Summary Field Recalculations & Transaction Commit', subtext: 'Final Database Commit' }]
            }
        ];

        let html = '';
        steps.forEach(step => {
            const hasItems = step.items && step.items.length > 0;
            const badgeCount = hasItems ? step.items.length : 0;
            const stepClass = hasItems ? 'timeline-step active' : 'timeline-step empty';

            html += `
                <div class="${stepClass}">
                    <div class="step-dot"></div>
                    <div class="step-header">
                        <div class="step-title">
                            <span class="step-number">STEP ${step.number}</span>
                            <i class="fa-solid ${step.icon} step-icon"></i>
                            <span class="step-title-text">${step.title}</span>
                        </div>
                        <span class="step-count-badge">${badgeCount} Active</span>
                    </div>
                    <div class="item-list">
                        ${hasItems ? step.items.map(item => `
                            <div class="item-row">
                                <div class="item-name">
                                    <i class="fa-solid fa-angle-right item-arrow"></i>
                                    <span>${item.name}</span>
                                </div>
                                <div class="item-subtext">${item.subtext}</div>
                            </div>
                        `).join('') : `
                            <div class="step-empty-msg">
                                No active ${step.title.toLowerCase()} configured on this object.
                            </div>
                        `}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }

    async function fetchAllObjects() {
        await initSession();
        const objectSelect = document.getElementById('object-select');
        if (!objectSelect) return;

        try {
            // Use describeGlobal which is reliable and returns all objects
            const describeResult = await window.sfApi.describeGlobal().catch(() => ({ sobjects: [] }));
            const sobjects = (describeResult.sobjects || [])
                .filter(s => s.customizable !== false)
                .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));

            objectSelect.innerHTML = '';
            sobjects.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.label || s.name;
                objectSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to fetch objects:', e);
            // Fallback: hardcoded list
            const fallback = ['Account', 'Contact', 'Opportunity', 'Case', 'Lead', 'Task', 'Event', 'Campaign', 'Product2', 'Contract'];
            objectSelect.innerHTML = '';
            fallback.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                objectSelect.appendChild(opt);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const analyzeBtn = document.getElementById('analyze-btn');
        const objectSelect = document.getElementById('object-select');

        if (analyzeBtn && objectSelect) {
            analyzeBtn.addEventListener('click', () => {
                const selectedObj = objectSelect.value;
                if (selectedObj) fetchObjectAutomations(selectedObj);
            });

            // Fetch all objects dynamically
            fetchAllObjects();
        }
    });
})();
