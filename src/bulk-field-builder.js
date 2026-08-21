// bulk-field-builder.js

(function() {
    let initialized = false;
    let activeExtraCols = [];
    let sessionCreatedFields = [];
    let cachedPermissionSets = [];
    let activeOptionsRow = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    window.initBulkFieldBuilder = async function() {
        if (initialized) return;
        
        // Cache permission sets upfront for row-level assignment
        if (cachedPermissionSets.length === 0 && window.sfApi) {
            try {
                if (window.sfApi.isDemoMode) {
                    cachedPermissionSets = [
                        { Id: '0PS0000001', Name: 'Sales_User_Access', Label: 'Sales User Access' },
                        { Id: '0PS0000002', Name: 'Service_Cloud_Core', Label: 'Service Cloud Core' },
                        { Id: '0PS0000003', Name: 'Marketing_Operations', Label: 'Marketing Operations' }
                    ];
                } else if (window.sfApi.sessionId || window.sfApi.instanceUrl) {
                    const res = await window.sfApi.query(`SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Label ASC LIMIT 500`);
                    if (res && res.records) cachedPermissionSets = res.records;
                }
            } catch(e) { 
                console.warn("Permission sets query skipped or offline:", e.message || e); 
            }
        }

        const container = document.getElementById('sfarc-bulk-field-container');
        if (!container) return;

        try {
            const html = `
<style>
@keyframes sfarc-slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
}
@keyframes sfarc-slide-in-left {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
}
</style>
<div class="sfarc-bulk-field-wrapper" style="display: flex; flex-direction: column; height: 100%; width: 100%;">
    <!-- Header & Toolbar Container -->
    <div style="background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); display: flex; flex-direction: column;">
        <!-- Top Bar: Title & Object Selector + Primary Build Button -->
        <div style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--sfarc-border-light);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid rgba(16, 185, 129, 0.25); flex-shrink: 0;">
                    <i class="fa-solid fa-table-columns"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 500; color: var(--sfarc-text); letter-spacing: -0.01em;">Bulk Field Builder</h3>
                    <p style="font-size: 12px; color: var(--sfarc-secondary-text); margin: 2px 0 0 0; font-weight: 400;">Rapidly design and deploy custom fields to any Salesforce Object.</p>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; align-items: center;">
                <select id="sfarc-bulk-object-select" class="sfarc-input" style="padding: 0 24px 0 10px !important; border-radius: 8px !important; font-size: 12px; min-width: 200px; height: 32px; font-weight: 500; cursor: pointer; border: none !important; background: rgba(0,0,0,0.05); color: var(--sfarc-text);">
                    <option value="">Loading objects...</option>
                </select>
                <button id="sfarc-bulk-build-btn" class="sfarc-btn sfarc-btn-primary" style="padding: 0 16px; font-size: 12.5px; font-weight: 500; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; border-radius: 8px; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease; cursor: pointer;">
                    <i class="fa-solid fa-hammer"></i> Build Fields
                </button>
            </div>
        </div>

        <!-- Action Toolbar Row -->
        <div style="padding: 8px 20px; background: var(--sfarc-table-header-bg); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <!-- Data Tools Group -->
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 500; color: var(--sfarc-secondary-text); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px;">Tools:</span>
                <select id="sfarc-bulk-presets-select" class="sfarc-input" style="padding: 0 24px 0 10px; border-radius: 6px; font-size: 11.5px; height: 28px; background: transparent; cursor: pointer; color: var(--sfarc-text); font-weight: 500; border: 1px solid var(--sfarc-border);">
                    <option value="" disabled selected>📦 Templates / Bundles</option>
                    <option value="address">📍 Address Bundle (Street, City, State, Zip, Country)</option>
                    <option value="contact">📞 Contact Info (Phone, Mobile, Email, Alt Email)</option>
                    <option value="financial">💰 Financial & Deal (ARR, MRR, Discount %, Payment Terms)</option>
                    <option value="audit">🔍 Audit & Integration (External ID, Legacy ID, Sync Date)</option>
                    <option value="feedback">⭐ NPS & Survey (NPS Score, Rating, Notes, Follow-up)</option>
                    <option value="social">🌐 Web & Social (LinkedIn, Website, Twitter)</option>
                </select>
                <button id="sfarc-bulk-quick-prompt-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 0 10px; font-size: 11.5px; font-weight: 500; height: 28px; border-radius: 6px; display: flex; align-items: center; gap: 5px;" title="Type multiple field names comma-separated to auto-generate rows">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary-color, #10b981);"></i> Quick Add
                </button>
                <button id="sfarc-bulk-sample-csv-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 0 10px; font-size: 11.5px; font-weight: 500; height: 28px; border-radius: 6px; display: flex; align-items: center; gap: 5px;" title="Download sample CSV template with column headers and 2 sample rows">
                    <i class="fa-solid fa-download" style="color: var(--sfarc-secondary-text, #64748b);"></i> Sample CSV
                </button>
                <button id="sfarc-bulk-infer-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 0 10px; font-size: 11.5px; font-weight: 500; height: 28px; border-radius: 6px; display: flex; align-items: center; gap: 5px;" title="Infer fields from raw pasted data">
                    <i class="fa-regular fa-lightbulb" style="color: var(--sfarc-secondary-text, #64748b);"></i> Infer from Data
                </button>
                <button id="sfarc-bulk-csv-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 0 10px; font-size: 11.5px; font-weight: 500; height: 28px; border-radius: 6px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-regular fa-clipboard" style="color: var(--sfarc-secondary-text, #64748b);"></i> Paste CSV
                </button>

                <div style="height: 18px; width: 1px; background: var(--sfarc-border); margin: 0 4px;"></div>

                <select id="sfarc-bulk-add-col-select" class="sfarc-input" style="padding: 0 26px 0 10px; border-radius: 9999px; font-size: 11.5px; height: 28px; background-color: transparent; background-repeat: no-repeat !important; background-position: right 8px center !important; background-size: 10px 10px !important; border: 1px dashed var(--primary-color); cursor: pointer; color: var(--primary-color); font-weight: 500; transition: all 0.2s;">
                    <option value="" disabled selected>+ Add Field Attribute</option>
                    <option value="description">Description</option>
                    <option value="inlineHelpText">Help Text</option>
                    <option value="defaultValue">Default Value</option>
                </select>
            </div>

            <!-- History & Undo Group -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <button id="sfarc-bulk-undo-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 0 12px; font-size: 11.5px; font-weight: 500; height: 28px; border-radius: 6px; display: none; align-items: center; gap: 5px; border: 1px solid #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); transition: all 0.2s;">
                    <i class="fa-solid fa-rotate-left"></i> Undo Build
                </button>
            </div>
        </div>
        <div class="sfarc-builder-guide" aria-live="polite">
            <div class="sfarc-builder-guide-step" id="sfarc-guide-object"><span>1</span><strong>Choose an object</strong></div>
            <i class="fa-solid fa-chevron-right"></i>
            <div class="sfarc-builder-guide-step" id="sfarc-guide-fields"><span>2</span><strong>Add field labels</strong></div>
            <i class="fa-solid fa-chevron-right"></i>
            <div class="sfarc-builder-guide-step" id="sfarc-guide-build"><span>3</span><strong>Review and build</strong></div>
            <div class="sfarc-builder-readiness" id="sfarc-builder-readiness">Select an object to begin</div>
        </div>
    </div>

    <!-- Data Grid Area -->
    <div style="flex: 1; overflow: auto; background: var(--sfarc-body-bg); padding: 20px;">
        <table class="sfarc-bulk-table" style="width: 100%; min-width: 980px; table-layout: fixed; border-collapse: collapse; background: transparent;">
            <thead>
                <tr>
                    <th id="sfarc-bulk-actions-th" style="width: 70px; text-align: center;">Actions</th>
                    <th style="width: 50px; text-align: center;" title="Permission Sets"><i class="fa-solid fa-user-shield"></i></th>
                    <th style="width: 250px;">Label</th>
                    <th style="width: 250px;">API Name (__c)</th>
                    <th style="width: 140px;">Type</th>
                    <th style="width: 170px;">Properties</th>
                </tr>
            </thead>
            <tbody id="sfarc-bulk-table-body">
                <!-- Rows injected dynamically -->
            </tbody>
        </table>
        
        <button id="sfarc-bulk-add-row-btn" class="sfarc-btn" style="margin-top: 15px; padding: 6px 12px; font-size: 12px; border: 1px dashed var(--sfarc-border); background: transparent; color: var(--primary-color); display: flex; align-items: center; gap: 6px; border-radius: 6px; transition: all 0.2s;">
            <i class="fa-solid fa-plus"></i> Add Row
        </button>
    </div>
</div>
<!-- FLS Wrapper (Hidden by default) -->
<div id="sfarc-bulk-fls-wrapper" style="display: none; flex-direction: column; height: 100%; width: 100%;">
    <div style="padding: 12px 20px; background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between;">
        <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 500; color: var(--sfarc-text);">Assign Field-Level Security</h3>
            <p style="font-size: 12px; color: var(--sfarc-secondary-text); margin: 2px 0 0 0;">Bulk assign access to Permission Sets for the fields you just created.</p>
        </div>
        <div style="display: flex; gap: 8px;">
            <button id="sfarc-bulk-fls-back-btn" class="sfarc-btn sfarc-btn-secondary" style="padding: 4px 12px; font-size: 11px; height: 26px;">Back to Builder</button>
            <button id="sfarc-bulk-fls-save-btn" class="sfarc-btn sfarc-btn-primary" style="padding: 4px 12px; font-size: 11px; background: #2e7d32; border: 1px solid #2e7d32; height: 26px;">Save Permissions</button>
        </div>
    </div>
    <div style="flex: 1; overflow-y: auto; background: var(--sfarc-body-bg); padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; background: var(--sfarc-bg); border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead style="background: var(--sfarc-header-bg); border-bottom: 1px solid var(--sfarc-border);">
                <tr>
                    <th style="padding: 10px 15px; text-align: left; font-size: 12px; font-weight: 500; color: var(--sfarc-secondary-text);">Permission Set Name</th>
                    <th style="padding: 10px 15px; text-align: center; font-size: 12px; font-weight: 500; color: var(--sfarc-secondary-text); width: 80px;">Read</th>
                    <th style="padding: 10px 15px; text-align: center; font-size: 12px; font-weight: 500; color: var(--sfarc-secondary-text); width: 80px;">Edit</th>
                </tr>
            </thead>
        <tbody id="sfarc-bulk-fls-body"></tbody>
    </table>
    </div>
</div>

<!-- Row Permission Set Modal (Left Drawer) -->
<div id="sfarc-bulk-row-ps-modal" class="sfarc-ps-modal" style="display: none;">
    <div class="sfarc-ps-drawer">
        <div class="sfarc-ps-drawer-header">
            <div>
                <h3>Permission Sets</h3>
                <p>Choose field access for this row.</p>
            </div>
            <button id="sfarc-bulk-row-ps-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: #999;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sfarc-ps-search-area">
            <div class="sfarc-ps-search-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="search" id="sfarc-bulk-row-ps-search" class="sfarc-input" placeholder="Search by label or API name..." autocomplete="off">
            </div>
        </div>
        <div class="sfarc-ps-list-head">
            <span>Permission Set</span>
            <label title="Toggle Read for all visible permission sets"><input type="checkbox" id="sfarc-ps-read-all"> Read</label>
            <label title="Toggle Edit for all visible permission sets"><input type="checkbox" id="sfarc-ps-edit-all"> Edit</label>
        </div>
        <div id="sfarc-bulk-row-ps-list" class="sfarc-ps-list">
            <!-- Dynamic list of PS -->
        </div>
        <div class="sfarc-ps-drawer-footer">
            <div>
                <strong id="sfarc-ps-selection-count">0 selected</strong>
                <button id="sfarc-bulk-row-ps-apply-all" class="sfarc-btn sfarc-ps-apply-all">Apply selection to every field</button>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="sfarc-bulk-row-ps-cancel" class="sfarc-btn sfarc-btn-secondary" style="padding: 6px 12px; font-size: 12px;">Cancel</button>
                <button id="sfarc-bulk-row-ps-save" class="sfarc-btn sfarc-btn-primary sfarc-ps-save">Save selection</button>
            </div>
        </div>
    </div>
</div>
<!-- Detailed Execution Results Modal -->
<div id="sfarc-bulk-results-modal" style="display: none; position: absolute; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2147483647; align-items: center; justify-content: center; padding: 20px;">
    <div style="background: var(--sfarc-bg); width: 100%; max-width: 680px; max-height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1px solid var(--sfarc-border); animation: sfarc-slide-in-right 0.2s ease-out;">
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between; background: var(--sfarc-bg);">
            <h3 style="margin: 0; font-size: 15px; font-weight: 500; color: var(--sfarc-text);" id="sfarc-bulk-results-title">Execution Results</h3>
            <button id="sfarc-bulk-results-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--sfarc-secondary-text);"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="padding: 12px 24px; border-bottom: 1px solid var(--sfarc-border); display: flex; gap: 12px; align-items: center; justify-content: space-between; background: var(--sfarc-bg);">
            <div style="display: flex; gap: 8px;">
                <span id="sfarc-results-badge-success" style="background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; font-size: 11px; padding: 4px 12px; border-radius: 9999px; font-weight: 500;">✓ 0 Successful</span>
                <span id="sfarc-results-badge-failed" style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; font-size: 11px; padding: 4px 12px; border-radius: 9999px; font-weight: 500;">❌ 0 Failed</span>
            </div>
            <div style="display: flex; gap: 4px;" id="sfarc-results-filter-tabs">
                <button class="sfarc-btn sfarc-btn-secondary active" data-filter="all" style="padding: 4px 10px; font-size: 11px; border-radius: 9999px;">All</button>
                <button class="sfarc-btn sfarc-btn-secondary" data-filter="success" style="padding: 4px 10px; font-size: 11px; border-radius: 9999px;">✓ Success</button>
                <button class="sfarc-btn sfarc-btn-secondary" data-filter="failed" style="padding: 4px 10px; font-size: 11px; border-radius: 9999px;">❌ Failed</button>
            </div>
        </div>
        <div id="sfarc-bulk-results-body" style="flex: 1; min-height: 0; overflow-y: auto; padding: 16px 24px; background: var(--sfarc-body-bg);">
            <!-- Results table -->
        </div>
        <div style="padding: 12px 24px; border-top: 1px solid var(--sfarc-border); background: var(--sfarc-bg); display: flex; justify-content: flex-end;">
            <button id="sfarc-bulk-results-done-btn" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 20px; font-size: 12px; border-radius: 9999px;">Done</button>
        </div>
    </div>
</div>

<!-- Row Field Options Side Drawer (Slide-Over Left Panel) -->
<div id="sfarc-bulk-field-options-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(3px); z-index: 2147483647; justify-content: flex-start; align-items: stretch;">
    <div style="background: var(--sfarc-bg, #18181b); width: 100%; max-width: 360px; height: 100%; border-right: 1px solid var(--sfarc-border, #27272a); display: flex; flex-direction: column; overflow: hidden; box-shadow: 10px 0 30px rgba(0,0,0,0.5); animation: sfarc-slide-in-left 0.25s cubic-bezier(0.16, 1, 0.3, 1); margin: 3px 0 3px 3px; border-radius: 0 12px 12px 0;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between; background: var(--sfarc-bg); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-sliders" style="color: var(--primary-color); font-size: 15px;"></i>
                <h3 style="margin: 0; font-size: 14px; font-weight: 500; color: var(--sfarc-text);" id="sfarc-options-modal-title">Field Options</h3>
            </div>
            <button id="sfarc-bulk-options-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--sfarc-secondary-text); padding: 4px; border-radius: 4px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; background: var(--sfarc-body-bg); overflow-y: auto; flex: 1;">
            <div>
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Length</label>
                <input type="text" id="sfarc-opt-length" class="sfarc-input" value="255" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
            </div>
            <div>
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Description</label>
                <textarea id="sfarc-opt-description" class="sfarc-input" rows="3" placeholder="Optional description..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12px; min-height: 60px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text); resize: vertical; font-family: inherit;"></textarea>
            </div>
            <div>
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Help Text</label>
                <textarea id="sfarc-opt-helptext" class="sfarc-input" rows="3" placeholder="Optional help text..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12px; min-height: 60px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text); resize: vertical; font-family: inherit;"></textarea>
            </div>
            <!-- Relationship Specific Settings (Lookup / MasterDetail) -->
            <div id="sfarc-opt-relationship-group" style="display: none; flex-direction: column; gap: 12px; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.03); border: 1px solid var(--sfarc-border);">
                <div style="font-size: 11.5px; font-weight: 500; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-link"></i> Relationship Settings
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Target Object (Reference To)</label>
                    <input type="text" id="sfarc-opt-referenceto" list="sfarc-bulk-objects-datalist" class="sfarc-input" placeholder="e.g. Account, Contact, Project__c..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Child Relationship Name</label>
                    <input type="text" id="sfarc-opt-relationshipname" class="sfarc-input" placeholder="e.g. Accounts, Projects..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Related List Label</label>
                    <input type="text" id="sfarc-opt-relationshiplabel" class="sfarc-input" placeholder="e.g. Accounts, Projects..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
                </div>
                <div id="sfarc-opt-delete-constraint-row">
                    <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">When the related record is deleted</label>
                    <select id="sfarc-opt-delete-constraint" class="sfarc-input" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
                        <option value="SetNull">Clear this field</option>
                        <option value="Restrict">Prevent deletion of the related record</option>
                    </select>
                </div>
                <label id="sfarc-opt-reparentable-row" style="display: none; align-items: center; gap: 10px; font-size: 12px; font-weight: 500; color: var(--sfarc-text); cursor: pointer;">
                    <input type="checkbox" id="sfarc-opt-reparentable" style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;"> Allow Reparenting (Master-Detail)
                </label>
                <label id="sfarc-opt-master-read-row" style="display: none; align-items: center; gap: 10px; font-size: 12px; font-weight: 500; color: var(--sfarc-text); cursor: pointer;">
                    <input type="checkbox" id="sfarc-opt-master-read" style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;"> Require parent read access to create or edit detail records
                </label>
                <div id="sfarc-opt-relationship-order-row" style="display: none;">
                    <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text); margin-bottom: 6px;">Master-Detail order</label>
                    <select id="sfarc-opt-relationship-order" class="sfarc-input" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text);">
                        <option value="0">Primary master (first relationship)</option>
                        <option value="1">Secondary master (second relationship)</option>
                    </select>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--sfarc-border);">
                <label style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 500; color: var(--sfarc-text); cursor: pointer;">
                    <input type="checkbox" id="sfarc-opt-required" style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;"> Required
                </label>
                <label style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 500; color: var(--sfarc-text); cursor: pointer;">
                    <input type="checkbox" id="sfarc-opt-unique" style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;"> Unique
                </label>
                <label style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 500; color: var(--sfarc-text); cursor: pointer;">
                    <input type="checkbox" id="sfarc-opt-externalid" style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;"> External ID
                </label>
            </div>
        </div>
        <div style="padding: 14px 20px; border-top: 1px solid var(--sfarc-border); background: var(--sfarc-bg); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
            <button id="sfarc-bulk-options-cancel" class="sfarc-btn sfarc-btn-secondary" style="padding: 6px 16px; font-size: 12px; border-radius: 6px;">Cancel</button>
            <button id="sfarc-bulk-options-save" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 18px; font-size: 12px; border-radius: 6px;">Save</button>
        </div>
    </div>
</div>

<datalist id="sfarc-bulk-objects-datalist"></datalist>

<!-- Quick Add Modal -->
<div id="sfarc-bulk-quick-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2147483647; align-items: center; justify-content: center; padding: 20px;">
    <div style="background: var(--sfarc-bg, #ffffff); width: 100%; max-width: 520px; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.25); border: 1px solid var(--sfarc-border); animation: sfarc-slide-in-right 0.2s ease-out;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="color: #10b981; font-size: 15px;"></i>
                <h3 style="margin: 0; font-size: 14px; font-weight: 500; color: var(--sfarc-text);">Quick Add Fields</h3>
            </div>
            <button id="sfarc-bulk-quick-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--sfarc-secondary-text);"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; background: var(--sfarc-body-bg);">
            <p style="font-size: 12px; color: var(--sfarc-secondary-text); margin: 0;">
                Type or paste field names separated by commas or new lines. Data types and API names are inferred automatically (e.g. <i>Due Date</i> → <b>Date</b>, <i>Total Revenue</i> → <b>Currency</b>, <i>Is Active</i> → <b>Checkbox</b>).
            </p>
            <textarea id="sfarc-bulk-quick-input" class="sfarc-input" rows="5" placeholder="e.g. Due Date, Total Budget, Is Key Account, Customer Notes, Contact Email" style="width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border); background: var(--sfarc-bg); color: var(--sfarc-text); resize: vertical; font-family: inherit;"></textarea>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid var(--sfarc-border); background: var(--sfarc-bg); display: flex; justify-content: flex-end; gap: 8px;">
            <button id="sfarc-bulk-quick-cancel" class="sfarc-btn sfarc-btn-secondary" style="padding: 6px 14px; font-size: 12px; border-radius: 6px;">Cancel</button>
            <button id="sfarc-bulk-quick-submit" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 16px; font-size: 12px; border-radius: 6px; background: #10b981; border: 1px solid #10b981;">Generate Fields</button>
        </div>
    </div>
</div>
`;
            container.innerHTML = html;
        } catch (e) {
            console.error("Failed to load Bulk Field Builder HTML", e);
            container.innerHTML = `<div style="padding:20px;color:red;">Error loading Bulk Field Builder UI.</div>`;
            return;
        }

        // Initialize logic
        if (document.body.classList.contains('sfarc-dark-theme') || 
            document.documentElement.getAttribute('data-theme') === 'dark' ||
            document.body.getAttribute('data-theme') === 'dark') {
            container.classList.add('sfarc-dark-theme');
            container.classList.remove('sfarc-light-theme');
        } else {
            container.classList.add('sfarc-light-theme');
            container.classList.remove('sfarc-dark-theme');
        }
        await populateObjects();
        bindEvents();
        
        const restored = restoreBulkFieldState();
        if (!restored) {
            addRow(); // Start with one empty row if no state restored
        }
        updateBuilderReadiness();

        initialized = true;
    };

    async function populateObjects() {
        const select = document.getElementById('sfarc-bulk-object-select');
        const datalist = document.getElementById('sfarc-bulk-objects-datalist');
        if (!select) return;

        const standardObjects = [
            'Account', 'Contact', 'Opportunity', 'Lead', 'Case', 'Campaign', 'Task', 'Event', 'User', 'Product2', 'Asset', 'Order', 'Contract'
        ];

        let optionsHtml = '<option value="">-- Select Object --</option>';
        let dlHtml = '';
        
        optionsHtml += '<optgroup label="Standard Objects">';
        for (const obj of standardObjects) {
            optionsHtml += `<option value="${obj}">${obj}</option>`;
            dlHtml += `<option value="${obj}">${obj}</option>`;
        }
        optionsHtml += '</optgroup>';

        let customOptions = '';
        let customDl = '';

        try {
            if (window.sfApi) {
                if (window.sfApi.isDemoMode) {
                    const mockCustom = [
                        { fullName: 'Project__c' },
                        { fullName: 'Invoice__c' },
                        { fullName: 'Subscription__c' }
                    ];
                    mockCustom.forEach(m => {
                        customOptions += `<option value="${m.fullName}">${m.fullName}</option>`;
                        customDl += `<option value="${m.fullName}">${m.fullName}</option>`;
                    });
                } else if (window.sfApi.sessionId || window.sfApi.instanceUrl) {
                    const res = await window.sfApi.query("SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject", true);
                    
                    let includeManaged = false;
                    try {
                        const rawSettings = localStorage.getItem('sfiSettings');
                        if (rawSettings) {
                            const parsed = JSON.parse(rawSettings);
                            includeManaged = !!parsed.fieldIncludeManaged;
                        }
                    } catch(err){}

                    if (res && res.records) {
                        res.records.sort((a, b) => (a.DeveloperName || '').localeCompare(b.DeveloperName || ''));
                        for (const record of res.records) {
                            if (!includeManaged && record.NamespacePrefix) continue;
                            const suffix = record.QualifiedApiName && record.QualifiedApiName.endsWith('__e') ? '__e' : '__c';
                            const fullName = (record.NamespacePrefix ? record.NamespacePrefix + '__' : '') + record.DeveloperName + suffix;
                            customOptions += `<option value="${fullName}">${fullName}</option>`;
                            customDl += `<option value="${fullName}">${fullName}</option>`;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("CustomObject tooling query offline or skipped:", e.message || e);
        }

        if (customOptions) {
            optionsHtml += '<optgroup label="Custom Objects & Platform Events">' + customOptions + '</optgroup>';
            dlHtml += customDl;
        }

        select.innerHTML = optionsHtml;
        if (datalist) {
            datalist.innerHTML = dlHtml;
        }

        // Update any existing relational rows in the grid with the loaded options
        document.querySelectorAll('#sfarc-bulk-table-body tr').forEach(tr => {
            const type = tr.querySelector('.sfarc-field-type-select')?.value;
            if (['Lookup', 'MasterDetail'].includes(type)) {
                const targetObjSelect = tr.querySelector('.sfarc-field-target-obj');
                if (targetObjSelect) {
                    const currentVal = targetObjSelect.value;
                    targetObjSelect.innerHTML = optionsHtml;
                    if (currentVal && targetObjSelect.querySelector(`option[value="${currentVal}"]`)) {
                        targetObjSelect.value = currentVal;
                    } else if (currentVal) {
                        targetObjSelect.innerHTML += `<option value="${currentVal}">${currentVal}</option>`;
                        targetObjSelect.value = currentVal;
                    }
                }
            }
        });
    }

    function updateLengthCell(tr, type, currentLengthOrTargetObj, currentChildRelName) {
        const td = tr.querySelector('.sfarc-length-td');
        if (!td) return;
        
        if (['Lookup', 'MasterDetail'].includes(type)) {
            // Relational layout
            const selectOptions = document.getElementById('sfarc-bulk-object-select') 
                ? document.getElementById('sfarc-bulk-object-select').innerHTML 
                : '<option value="Account">Account</option>';
            
            const targetVal = currentLengthOrTargetObj || 'Account';
            const relName = currentChildRelName || (tr.dataset.relationshipName || '');
            
            td.innerHTML = `
                <div class="sfarc-relational-settings" style="display: flex; gap: 4px; align-items: center;">
                    <select class="sfarc-bulk-table-input sfarc-field-target-obj" style="height: 24px; padding: 2px 6px; font-size: 11px; border-radius: 3px; flex: 1; min-width: 0;" title="Related To (Target Object)">
                        ${selectOptions}
                    </select>
                    <input type="text" class="sfarc-bulk-table-input sfarc-field-rel-name" placeholder="Child Rel Name" value="${relName}" style="height: 24px; font-size: 11px; padding: 2px 6px; flex: 1; min-width: 0;" title="Child Relationship Name">
                </div>
            `;
            
            const sel = td.querySelector('.sfarc-field-target-obj');
            if (sel.querySelector(`option[value="${targetVal}"]`)) {
                sel.value = targetVal;
            } else {
                sel.innerHTML += `<option value="${targetVal}">${targetVal}</option>`;
                sel.value = targetVal;
            }
            tr.dataset.referenceTo = sel.value;

            sel.addEventListener('change', (e) => { 
                tr.dataset.referenceTo = e.target.value; 
                tr.dispatchEvent(new Event('input', { bubbles: true })); // Trigger persistence
            });
            const relInp = td.querySelector('.sfarc-field-rel-name');
            relInp.addEventListener('input', (e) => { 
                tr.dataset.relationshipName = e.target.value; 
            });

        } else if (['Number', 'Currency', 'Percent'].includes(type)) {
            let prec = '18';
            let scale = '0';
            if (currentLengthOrTargetObj && currentLengthOrTargetObj.includes(',')) {
                const parts = currentLengthOrTargetObj.split(',');
                prec = parts[0].trim();
                scale = parts[1].trim();
            } else if (currentLengthOrTargetObj) {
                prec = currentLengthOrTargetObj;
            }
            td.innerHTML = `
                <div style="display: flex; gap: 4px; align-items: center;">
                    <input type="number" class="sfarc-bulk-table-input sfarc-field-precision" placeholder="Precision (18)" value="${prec}" style="flex: 1; min-width: 0;" title="Precision (total digits)">
                    <input type="number" class="sfarc-bulk-table-input sfarc-field-scale" placeholder="Scale (0)" value="${scale}" style="flex: 1; min-width: 0;" title="Scale (decimal places)">
                </div>
            `;
        } else if (type === 'Checkbox') {
            const isChecked = currentLengthOrTargetObj === 'true' || tr.dataset.defaultValue === 'true';
            td.innerHTML = `
                <select class="sfarc-bulk-table-input sfarc-field-default" style="height: 24px; padding: 2px 6px; font-size: 11px; border-radius: 3px; width: 100%;">
                    <option value="false" ${!isChecked ? 'selected' : ''}>Unchecked</option>
                    <option value="true" ${isChecked ? 'selected' : ''}>Checked</option>
                </select>
            `;
        } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
            const val = currentLengthOrTargetObj || '';
            td.innerHTML = `<input type="text" class="sfarc-bulk-table-input sfarc-field-values" placeholder="Values (comma separated)" value="${val}" title="Enter picklist values separated by commas">`;
        } else if (['Date', 'DateTime', 'Email', 'Phone', 'Url', 'Time'].includes(type)) {
            td.innerHTML = `<span style="display: block; text-align: center; color: var(--sfarc-secondary-text, #94a3b8); font-size: 11px; line-height: 24px;">No properties</span>`;
        } else if (type === 'Formula') {
            const retType = tr.dataset.formulaReturnType || 'Text';
            const formBody = currentLengthOrTargetObj || '';
            td.innerHTML = `
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select class="sfarc-bulk-table-input sfarc-field-formula-return" style="height: 24px; padding: 2px 6px; font-size: 11px; border-radius: 3px; flex: 0 0 90px;" title="Return Type">
                        <option value="Text" ${retType==='Text'?'selected':''}>Text</option>
                        <option value="Number" ${retType==='Number'?'selected':''}>Number</option>
                        <option value="Currency" ${retType==='Currency'?'selected':''}>Currency</option>
                        <option value="Percent" ${retType==='Percent'?'selected':''}>Percent</option>
                        <option value="Checkbox" ${retType==='Checkbox'?'selected':''}>Checkbox</option>
                        <option value="Date" ${retType==='Date'?'selected':''}>Date</option>
                        <option value="DateTime" ${retType==='DateTime'?'selected':''}>DateTime</option>
                        <option value="Time" ${retType==='Time'?'selected':''}>Time</option>
                    </select>
                    <input type="text" class="sfarc-bulk-table-input sfarc-field-formula" placeholder="Formula body..." value="${formBody}" style="height: 24px; font-size: 11px; padding: 2px 6px; flex: 1; min-width: 0;" title="Formula string">
                </div>
            `;
            td.querySelector('.sfarc-field-formula-return').addEventListener('change', (e) => { 
                tr.dataset.formulaReturnType = e.target.value; 
                tr.dispatchEvent(new Event('input', { bubbles: true })); 
            });
        } else {
            // Text, LongTextArea, Html
            const val = currentLengthOrTargetObj || (type === 'LongTextArea' || type === 'Html' ? '32768' : '255');
            td.innerHTML = `<input type="number" class="sfarc-bulk-table-input sfarc-field-length" placeholder="Length" value="${val}">`;
        }
    }

    function openFieldOptionsModal(tr) {
        if (!tr) return;
        // Close Permission Sets modal to ensure only one drawer/modal is visible at a time
        const psModal = document.getElementById('sfarc-bulk-row-ps-modal');
        if (psModal) psModal.style.display = 'none';

        activeOptionsRow = tr;
        const modal = document.getElementById('sfarc-bulk-field-options-modal');
        if (!modal) return;

        // Ensure modal is attached directly to document.body so position:fixed is relative to root viewport and never clipped
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }

        const labelVal = tr.querySelector('.sfarc-field-label')?.value.trim() || 'New Field';
        const type = tr.querySelector('.sfarc-field-type-select')?.value || 'Text';
        const isRel = ['Lookup', 'MasterDetail'].includes(type);

        const titleEl = document.getElementById('sfarc-options-modal-title');
        if (titleEl) titleEl.textContent = `Field Options - ${labelVal} (${type})`;

        const relGroup = document.getElementById('sfarc-opt-relationship-group');
        const reparentRow = document.getElementById('sfarc-opt-reparentable-row');
        const masterReadRow = document.getElementById('sfarc-opt-master-read-row');
        const deleteConstraintRow = document.getElementById('sfarc-opt-delete-constraint-row');
        const relationshipOrderRow = document.getElementById('sfarc-opt-relationship-order-row');
        const lenContainer = document.getElementById('sfarc-opt-length')?.parentElement;

        if (relGroup) relGroup.style.display = isRel ? 'flex' : 'none';
        if (reparentRow) reparentRow.style.display = type === 'MasterDetail' ? 'flex' : 'none';
        if (masterReadRow) masterReadRow.style.display = type === 'MasterDetail' ? 'flex' : 'none';
        if (deleteConstraintRow) deleteConstraintRow.style.display = type === 'Lookup' ? 'block' : 'none';
        if (relationshipOrderRow) relationshipOrderRow.style.display = type === 'MasterDetail' ? 'block' : 'none';
        if (lenContainer) lenContainer.style.display = ['Text', 'LongTextArea', 'Html', 'Number', 'Currency', 'Percent', 'Picklist', 'MultiselectPicklist', 'Checkbox'].includes(type) ? 'block' : 'none';

        const refToEl = document.getElementById('sfarc-opt-referenceto');
        if (refToEl) refToEl.value = tr.dataset.referenceTo || (isRel ? (tr.querySelector('.sfarc-field-target-obj')?.value || 'Account') : 'Account');

        const relNameEl = document.getElementById('sfarc-opt-relationshipname');
        if (relNameEl) relNameEl.value = tr.dataset.relationshipName || tr.querySelector('.sfarc-field-rel-name')?.value || '';

        const relLabelEl = document.getElementById('sfarc-opt-relationshiplabel');
        if (relLabelEl) relLabelEl.value = tr.dataset.relationshipLabel || '';

        const reparentEl = document.getElementById('sfarc-opt-reparentable');
        if (reparentEl) reparentEl.checked = tr.dataset.reparentableMasterDetail === 'true';
        const masterReadEl = document.getElementById('sfarc-opt-master-read');
        if (masterReadEl) masterReadEl.checked = tr.dataset.writeRequiresMasterRead === 'true';
        const deleteConstraintEl = document.getElementById('sfarc-opt-delete-constraint');
        if (deleteConstraintEl) deleteConstraintEl.value = tr.dataset.deleteConstraint || 'SetNull';
        const relationshipOrderEl = document.getElementById('sfarc-opt-relationship-order');
        if (relationshipOrderEl) relationshipOrderEl.value = tr.dataset.relationshipOrder || '0';

        let lengthFallback = '255';
        if (['Number', 'Currency', 'Percent'].includes(type)) {
            lengthFallback = (tr.querySelector('.sfarc-field-precision')?.value || '18') + ',' + (tr.querySelector('.sfarc-field-scale')?.value || '0');
        } else if (type === 'Checkbox') {
            lengthFallback = tr.querySelector('.sfarc-field-default')?.value || 'false';
        } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
            lengthFallback = tr.querySelector('.sfarc-field-values')?.value || '';
        } else if (['Text', 'Html', 'LongTextArea'].includes(type)) {
            lengthFallback = tr.querySelector('.sfarc-field-length')?.value || '255';
        }

        const lenEl = document.getElementById('sfarc-opt-length');
        if (lenEl) lenEl.value = tr.dataset.length || lengthFallback;

        const descEl = document.getElementById('sfarc-opt-description');
        if (descEl) descEl.value = tr.dataset.description || '';

        const helpEl = document.getElementById('sfarc-opt-helptext');
        if (helpEl) helpEl.value = tr.dataset.helpText || '';

        const reqEl = document.getElementById('sfarc-opt-required');
        if (reqEl) reqEl.checked = tr.dataset.required === 'true';

        const uniqEl = document.getElementById('sfarc-opt-unique');
        if (uniqEl) uniqEl.checked = tr.dataset.unique === 'true';

        const extIdEl = document.getElementById('sfarc-opt-externalid');
        if (extIdEl) extIdEl.checked = tr.dataset.externalId === 'true';

        const requiredAllowed = !['Formula', 'MasterDetail'].includes(type);
        const uniqueExternalAllowed = ['Text', 'Number', 'Email'].includes(type);
        if (reqEl) {
            reqEl.disabled = !requiredAllowed;
            reqEl.closest('label').style.opacity = requiredAllowed ? '1' : '0.45';
        }
        [uniqEl, extIdEl].forEach(el => {
            if (!el) return;
            el.disabled = !uniqueExternalAllowed;
            el.closest('label').style.opacity = uniqueExternalAllowed ? '1' : '0.45';
        });

        modal.style.setProperty('display', 'flex', 'important');
    }

    function saveBulkFieldState() {
        const objectSelect = document.getElementById('sfarc-bulk-object-select');
        const rows = Array.from(document.querySelectorAll('#sfarc-bulk-table-body tr'));

        const rowData = rows.map(tr => {
            const psBtn = tr.querySelector('.sfarc-field-ext-permissionSets');
            const type = tr.querySelector('.sfarc-field-type-select')?.value || 'Text';
            let lengthProp = '255';
            
            if (['Text', 'Html', 'LongTextArea'].includes(type)) {
                lengthProp = tr.querySelector('.sfarc-field-length')?.value || '255';
            } else if (['Number', 'Currency', 'Percent'].includes(type)) {
                lengthProp = (tr.querySelector('.sfarc-field-precision')?.value || '18') + ',' + (tr.querySelector('.sfarc-field-scale')?.value || '0');
            } else if (type === 'Checkbox') {
                lengthProp = tr.querySelector('.sfarc-field-default')?.value || 'false';
            } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
                lengthProp = tr.querySelector('.sfarc-field-values')?.value || '';
            } else if (['Lookup', 'MasterDetail'].includes(type)) {
                lengthProp = tr.dataset.referenceTo || tr.querySelector('.sfarc-field-target-obj')?.value || 'Account';
            } else if (type === 'Formula') {
                lengthProp = tr.querySelector('.sfarc-field-formula')?.value || '';
            } else {
                lengthProp = '';
            }

            return {
                label: tr.querySelector('.sfarc-field-label')?.value || '',
                name: tr.querySelector('.sfarc-field-name')?.value || '',
                type: type,
                length: tr.dataset.length || lengthProp,
                description: tr.dataset.description || '',
                helpText: tr.dataset.helpText || '',
                required: tr.dataset.required === 'true',
                unique: tr.dataset.unique === 'true',
                externalId: tr.dataset.externalId === 'true',
                referenceTo: tr.dataset.referenceTo || tr.querySelector('.sfarc-field-target-obj')?.value || '',
                relationshipName: tr.dataset.relationshipName || tr.querySelector('.sfarc-field-rel-name')?.value || '',
                relationshipLabel: tr.dataset.relationshipLabel || '',
                reparentableMasterDetail: tr.dataset.reparentableMasterDetail === 'true',
                writeRequiresMasterRead: tr.dataset.writeRequiresMasterRead === 'true',
                deleteConstraint: tr.dataset.deleteConstraint || 'SetNull',
                relationshipOrder: tr.dataset.relationshipOrder || '0',
                formulaReturnType: tr.dataset.formulaReturnType || 'Text',
                permissionSets: psBtn ? (psBtn.dataset.selectedPs || '[]') : '[]'
            };
        });

        const state = {
            selectedObject: objectSelect ? objectSelect.value : '',
            rows: rowData,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem('sfarc_bulk_field_state', JSON.stringify(state));
        } catch(e) {
            console.error("Failed to save state to localStorage", e);
        }

        return state;
    }

    function restoreBulkFieldState() {
        let stateRaw = null;
        try {
            stateRaw = localStorage.getItem('sfarc_bulk_field_state');
        } catch(e){}

        if (!stateRaw) return false;

        try {
            const state = JSON.parse(stateRaw);
            if (!state || !Array.isArray(state.rows) || state.rows.length === 0) return false;

            if (state.selectedObject) {
                const select = document.getElementById('sfarc-bulk-object-select');
                if (select) select.value = state.selectedObject;
            }

            const tbody = document.getElementById('sfarc-bulk-table-body');
            if (tbody) tbody.innerHTML = '';

            state.rows.forEach(r => {
                const isRel = ['Lookup', 'MasterDetail'].includes(r.type);
                const displayVal = isRel ? (r.referenceTo || r.length || 'Account') : (r.length || '255');
                const tr = addRow(r.label, r.name, r.type, displayVal);
                tr.dataset.length = r.length || '255';
                tr.dataset.description = r.description || '';
                tr.dataset.helpText = r.helpText || '';
                tr.dataset.required = r.required ? 'true' : 'false';
                tr.dataset.unique = r.unique ? 'true' : 'false';
                tr.dataset.externalId = r.externalId ? 'true' : 'false';
                tr.dataset.referenceTo = r.referenceTo || (isRel ? displayVal : '');
                tr.dataset.relationshipName = r.relationshipName || '';
                tr.dataset.relationshipLabel = r.relationshipLabel || '';
                tr.dataset.reparentableMasterDetail = r.reparentableMasterDetail ? 'true' : 'false';
                tr.dataset.writeRequiresMasterRead = r.writeRequiresMasterRead ? 'true' : 'false';
                tr.dataset.deleteConstraint = r.deleteConstraint || 'SetNull';
                tr.dataset.relationshipOrder = r.relationshipOrder || '0';
                tr.dataset.formulaReturnType = r.formulaReturnType || 'Text';

                const optBtn = tr.querySelector('.sfarc-action-btn-options');
                if (optBtn && (r.description || r.helpText || r.required || r.unique || r.externalId || isRel)) {
                    optBtn.style.color = '#10b981';
                }

                const psBtn = tr.querySelector('.sfarc-field-ext-permissionSets');
                if (psBtn && r.permissionSets) {
                    psBtn.dataset.selectedPs = r.permissionSets;
                    try {
                        const arr = JSON.parse(r.permissionSets);
                        psBtn.title = `${arr.length} Selected`;
                        if (arr.length > 0) psBtn.style.color = '#10b981';
                    } catch(e){}
                }
            });

            return true;
        } catch(e) {
            console.error("Failed to restore bulk field state", e);
            return false;
        }
    }

    function bindEvents() {
        document.getElementById('sfarc-bulk-add-row-btn').addEventListener('click', () => {
            addRow();
            saveBulkFieldState();
        });

        const objSelect = document.getElementById('sfarc-bulk-object-select');
        if (objSelect) {
            objSelect.addEventListener('change', () => {
                saveBulkFieldState();
                updateBuilderReadiness();
            });
        }

        const tbodyEl = document.getElementById('sfarc-bulk-table-body');
        if (tbodyEl) {
            tbodyEl.addEventListener('input', () => {
                saveBulkFieldState();
                updateBuilderReadiness();
            });
            tbodyEl.addEventListener('change', () => {
                saveBulkFieldState();
                updateBuilderReadiness();
            });
        }

        const optClose = document.getElementById('sfarc-bulk-options-close');
        const optCancel = document.getElementById('sfarc-bulk-options-cancel');
        const optSave = document.getElementById('sfarc-bulk-options-save');

        if (optClose) {
            optClose.addEventListener('click', () => {
                const modal = document.getElementById('sfarc-bulk-field-options-modal');
                if (modal) modal.style.display = 'none';
                activeOptionsRow = null;
            });
        }
        const optionsModal = document.getElementById('sfarc-bulk-field-options-modal');
        if (optionsModal) {
            optionsModal.addEventListener('click', (e) => {
                if (e.target === optionsModal) {
                    optionsModal.style.display = 'none';
                    activeOptionsRow = null;
                }
            });
        }
        if (optCancel) {
            optCancel.addEventListener('click', () => {
                const modal = document.getElementById('sfarc-bulk-field-options-modal');
                if (modal) modal.style.display = 'none';
                activeOptionsRow = null;
            });
        }
        if (optSave) {
            optSave.addEventListener('click', () => {
                if (activeOptionsRow) {
                    const type = activeOptionsRow.querySelector('.sfarc-field-type-select')?.value || 'Text';
                    const isRel = ['Lookup', 'MasterDetail'].includes(type);

                    const len = document.getElementById('sfarc-opt-length').value.trim();
                    const desc = document.getElementById('sfarc-opt-description').value.trim();
                    const help = document.getElementById('sfarc-opt-helptext').value.trim();
                    const req = document.getElementById('sfarc-opt-required').checked;
                    const uniq = document.getElementById('sfarc-opt-unique').checked;
                    const extId = document.getElementById('sfarc-opt-externalid').checked;

                    if (isRel) {
                        const refTo = document.getElementById('sfarc-opt-referenceto').value.trim() || 'Account';
                        const relName = document.getElementById('sfarc-opt-relationshipname').value.trim();
                        const relLabel = document.getElementById('sfarc-opt-relationshiplabel').value.trim();
                        const reparent = document.getElementById('sfarc-opt-reparentable').checked;
                        const masterRead = document.getElementById('sfarc-opt-master-read').checked;
                        const deleteConstraint = document.getElementById('sfarc-opt-delete-constraint').value;
                        const relationshipOrder = document.getElementById('sfarc-opt-relationship-order').value;

                        activeOptionsRow.dataset.referenceTo = refTo;
                        activeOptionsRow.dataset.relationshipName = relName;
                        activeOptionsRow.dataset.relationshipLabel = relLabel;
                        activeOptionsRow.dataset.reparentableMasterDetail = reparent ? 'true' : 'false';
                        activeOptionsRow.dataset.writeRequiresMasterRead = masterRead ? 'true' : 'false';
                        activeOptionsRow.dataset.deleteConstraint = deleteConstraint;
                        activeOptionsRow.dataset.relationshipOrder = relationshipOrder;

                        const targetObjSelect = activeOptionsRow.querySelector('.sfarc-field-target-obj');
                        if (targetObjSelect) targetObjSelect.value = refTo;
                        const relNameInput = activeOptionsRow.querySelector('.sfarc-field-rel-name');
                        if (relNameInput) relNameInput.value = relName;
                    } else {
                        activeOptionsRow.dataset.length = len;
                        if (['Number', 'Currency', 'Percent'].includes(type)) {
                            const precInput = activeOptionsRow.querySelector('.sfarc-field-precision');
                            const scaleInput = activeOptionsRow.querySelector('.sfarc-field-scale');
                            if (len.includes(',')) {
                                const parts = len.split(',');
                                if (precInput) precInput.value = parts[0].trim();
                                if (scaleInput) scaleInput.value = parts[1].trim();
                            } else {
                                if (precInput) precInput.value = len;
                            }
                        } else if (type === 'Checkbox') {
                            const defSelect = activeOptionsRow.querySelector('.sfarc-field-default');
                            if (defSelect) defSelect.value = len === 'true' || len === 'Checked' ? 'true' : 'false';
                        } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
                            const valInput = activeOptionsRow.querySelector('.sfarc-field-values');
                            if (valInput) valInput.value = len;
                        } else if (['Text', 'Html', 'LongTextArea'].includes(type)) {
                            const lenInput = activeOptionsRow.querySelector('.sfarc-field-length');
                            if (lenInput) lenInput.value = len;
                        }
                    }

                    activeOptionsRow.dataset.description = desc;
                    activeOptionsRow.dataset.helpText = help;
                    activeOptionsRow.dataset.required = req && !['Formula', 'MasterDetail'].includes(type) ? 'true' : 'false';
                    activeOptionsRow.dataset.unique = uniq && ['Text', 'Number', 'Email'].includes(type) ? 'true' : 'false';
                    activeOptionsRow.dataset.externalId = extId && ['Text', 'Number', 'Email'].includes(type) ? 'true' : 'false';

                    const optBtn = activeOptionsRow.querySelector('.sfarc-action-btn-options');
                    if (optBtn) {
                        if (desc || help || req || uniq || extId || isRel) {
                            optBtn.style.color = '#10b981';
                        } else {
                            optBtn.style.color = '';
                        }
                    }
                }
                saveBulkFieldState();
                const modal = document.getElementById('sfarc-bulk-field-options-modal');
                if (modal) modal.style.display = 'none';
                activeOptionsRow = null;
            });
        }

        document.getElementById('sfarc-bulk-table-body').addEventListener('click', (e) => {
            const btn = e.target.closest('.sfarc-action-btn');
            if (!btn) return;
            
            const tr = btn.closest('tr');
            if (!tr) return;

            if (btn.classList.contains('sfarc-action-btn-delete')) {
                tr.remove();
                if (!document.querySelector('#sfarc-bulk-table-body tr')) addRow();
                updateBuilderReadiness();
            } else if (btn.classList.contains('sfarc-action-btn-options')) {
                openFieldOptionsModal(tr);
            } else if (btn.classList.contains('sfarc-action-btn-clone')) {
                const label = tr.querySelector('.sfarc-field-label').value;
                const name = tr.querySelector('.sfarc-field-name').value;
                const type = tr.querySelector('.sfarc-field-type-select').value;
                const length = tr.querySelector('.sfarc-field-length').value;
                
                const newTr = addRow(label + ' Copy', name + '_Copy', type, length);
                newTr.dataset.length = tr.dataset.length || length;
                newTr.dataset.description = tr.dataset.description || '';
                newTr.dataset.helpText = tr.dataset.helpText || '';
                newTr.dataset.required = tr.dataset.required || 'false';
                newTr.dataset.unique = tr.dataset.unique || 'false';
                newTr.dataset.externalId = tr.dataset.externalId || 'false';

                const oldOptBtn = tr.querySelector('.sfarc-action-btn-options');
                const newOptBtn = newTr.querySelector('.sfarc-action-btn-options');
                if (oldOptBtn && newOptBtn) {
                    newOptBtn.style.color = oldOptBtn.style.color;
                }
                
                // Copy PS explicitly
                const oldPsBtn = tr.querySelector('.sfarc-field-ext-permissionSets');
                const newPsBtn = newTr.querySelector('.sfarc-field-ext-permissionSets');
                if (oldPsBtn && newPsBtn) {
                    newPsBtn.dataset.selectedPs = oldPsBtn.dataset.selectedPs || '[]';
                    newPsBtn.title = oldPsBtn.title;
                    newPsBtn.style.color = oldPsBtn.style.color;
                }
                
                activeExtraCols.forEach(col => {
                    const oldInput = tr.querySelector(`.sfarc-field-ext-${col}`);
                    const newInput = newTr.querySelector(`.sfarc-field-ext-${col}`);
                    if (oldInput && newInput) {
                        newInput.value = oldInput.value;
                    }
                });
            }
        });

        function inferTypeFromLabel(label) {
            if (!label) return null;
            const l = label.trim().toLowerCase();
            
            // Checkbox
            if (/^(is|has|can|should|do|does|will|enable|allow|use|show|hide|active|verified|completed|approved|flag|opt_in|optin)\b/i.test(l) || /\b(flag|boolean|checkbox|opted\s*in|opted\s*out)\b/i.test(l)) {
                return { type: 'Checkbox', length: '' };
            }
            // Master-Detail
            if (/\b(master\s*detail|master-detail|parent\s*detail)\b/i.test(l)) {
                return { type: 'MasterDetail', length: 'Account' };
            }
            // Lookup
            if (/\b(lookup|parent\s*account|assigned\s*user|account|contact|opportunity|lead|case|user|manager|assignee|project)\b/i.test(l) && !/\b(email|phone|notes|name|id|number|score|date|revenue)\b/i.test(l)) {
                let target = 'Account';
                if (/contact/i.test(l)) target = 'Contact';
                else if (/opportunity/i.test(l)) target = 'Opportunity';
                else if (/lead/i.test(l)) target = 'Lead';
                else if (/case/i.test(l)) target = 'Case';
                else if (/user|manager|assignee/i.test(l)) target = 'User';
                return { type: 'Lookup', length: target };
            }
            // DateTime
            if (/\b(datetime|timestamp|created\s*at|updated\s*at|closed\s*at|scheduled\s*at|event\s*time)\b/i.test(l)) {
                return { type: 'DateTime', length: '' };
            }
            // Date
            if (/\b(date|birthday|birthdate|due\s*date|close\s*date|start\s*date|end\s*date|expiry|expiration)\b/i.test(l)) {
                return { type: 'Date', length: '' };
            }
            // Currency
            if (/\b(amount|price|cost|fee|salary|revenue|budget|arr|mrr|rate|subtotal|total\s*price|balance|credit|deposit|val|value)\b/i.test(l) && !/\b(rate\s*%|percentage)\b/i.test(l)) {
                return { type: 'Currency', length: '18,2' };
            }
            // Percent
            if (/\b(percent|percentage|pct|discount|margin|probability|ratio|tax\s*rate|commission)\b/i.test(l) || /%/.test(l)) {
                return { type: 'Percent', length: '5,2' };
            }
            // Number
            if (/\b(count|quantity|qty|number|score|age|rank|size|index|points|duration|days|hours|minutes|seconds|priority\s*num|order\s*num|seq|sequence)\b/i.test(l)) {
                return { type: 'Number', length: '18,0' };
            }
            // Email
            if (/\b(email|e-mail|mail)\b/i.test(l)) {
                return { type: 'Email', length: '' };
            }
            // Phone
            if (/\b(phone|mobile|telephone|cell|fax|tel|contact\s*number)\b/i.test(l)) {
                return { type: 'Phone', length: '' };
            }
            // URL
            if (/\b(url|website|link|webpage|domain|uri|href)\b/i.test(l)) {
                return { type: 'Url', length: '' };
            }
            // Rich Text / Long Text Area
            if (/\b(html|rich\s*text|formatted\s*notes)\b/i.test(l)) {
                return { type: 'Html', length: '32768' };
            }
            if (/\b(description|details|notes|comments|summary|body|feedback|bio|biography|log|remarks|transcript)\b/i.test(l)) {
                return { type: 'LongTextArea', length: '32768' };
            }
            
            return null;
        }

        document.getElementById('sfarc-bulk-table-body').addEventListener('input', (e) => {
            if (e.target.classList.contains('sfarc-field-label')) {
                const tr = e.target.closest('tr');
                const nameInput = tr.querySelector('.sfarc-field-name');
                const typeSelect = tr.querySelector('.sfarc-field-type-select');
                const lenInput = tr.querySelector('.sfarc-field-length');

                // 1. Auto-generate API Name
                let autoApiName = true;
                try {
                    const parsed = JSON.parse(localStorage.getItem('sfiSettings') || '{}');
                    autoApiName = parsed.fieldAutoApiName !== false;
                } catch (err) {}
                if (autoApiName && !nameInput.dataset.manuallyEdited) {
                    let val = e.target.value;
                    val = val.replace(/[^a-zA-Z0-9\s_]/g, '');
                    
                    let convention = 'PascalCase';
                    try {
                        const rawSettings = localStorage.getItem('sfiSettings');
                        if (rawSettings) {
                            const parsed = JSON.parse(rawSettings);
                            if (parsed.fieldNamingConvention) convention = parsed.fieldNamingConvention;
                        }
                    } catch(err){}

                    let words = val.trim().split(/\s+/).filter(Boolean);
                    if (words.length > 0) {
                        if (convention === 'PascalCase') {
                            val = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                        } else if (convention === 'camelCase') {
                            val = words.map((w, idx) => idx === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)).join('');
                        } else if (convention === 'snake_case') {
                            val = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
                        } else if (convention === 'UPPERCASE') {
                            val = words.map(w => w.toUpperCase()).join('_');
                        } else {
                            val = words.join('_');
                        }
                        val = val + '__c';
                    } else {
                        val = '';
                    }
                    nameInput.value = val;
                }

                // 2. Smart Auto-Type Inference (if user hasn't explicitly changed type)
                if (!typeSelect.dataset.manuallyEdited) {
                    const inferred = inferTypeFromLabel(e.target.value);
                    if (inferred) {
                        typeSelect.value = inferred.type;
                        const lenInput = tr.querySelector('.sfarc-field-length');
                        if (['Text', 'Html', 'LongTextArea', 'Number', 'Currency', 'Percent'].includes(inferred.type)) {
                            updateLengthCell(tr, inferred.type, inferred.length || (inferred.type === 'Text' ? '255' : '32768'));
                        } else if (['Lookup', 'MasterDetail'].includes(inferred.type)) {
                            updateLengthCell(tr, inferred.type, inferred.length || 'Account', tr.dataset.relationshipName);
                        } else {
                            updateLengthCell(tr, inferred.type, '');
                        }
                    }
                }
            } else if (e.target.classList.contains('sfarc-field-name')) {
                e.target.dataset.manuallyEdited = "true";
            } else if (e.target.classList.contains('sfarc-field-type-select')) {
                e.target.dataset.manuallyEdited = "true";
                const tr = e.target.closest('tr');
                const lenInput = tr.querySelector('.sfarc-field-length');
                const type = e.target.value;
                if (['Text', 'Html', 'LongTextArea'].includes(type)) {
                    let curVal = lenInput ? lenInput.value : '';
                    if (!curVal || curVal.includes('Account')) curVal = (type === 'Text') ? '255' : '32768';
                    updateLengthCell(tr, type, curVal);
                } else if (['Number', 'Currency', 'Percent'].includes(type)) {
                    let curVal = lenInput ? lenInput.value : '';
                    if (!curVal || curVal.includes('Account')) {
                        let configuredPrecision = type === 'Number' ? '18,0' : (type === 'Currency' ? '18,2' : '5,2');
                        try {
                            const parsed = JSON.parse(localStorage.getItem('sfiSettings') || '{}');
                            if (parsed.fieldDefaultPrecision) configuredPrecision = parsed.fieldDefaultPrecision;
                        } catch (err) {}
                        curVal = configuredPrecision;
                    }
                    updateLengthCell(tr, type, curVal);
                } else if (['Lookup', 'MasterDetail'].includes(type)) {
                    let curVal = lenInput ? lenInput.value : 'Account';
                    if (!curVal || !isNaN(curVal)) curVal = 'Account';
                    updateLengthCell(tr, type, curVal, tr.dataset.relationshipName);
                } else {
                    updateLengthCell(tr, type, '');
                }
            } else if (e.target.classList.contains('sfarc-field-length') && !e.target.classList.contains('sfarc-field-target-obj')) {
                const tr = e.target.closest('tr');
                const type = tr.querySelector('.sfarc-field-type-select')?.value || 'Text';
                if (['Lookup', 'MasterDetail'].includes(type)) {
                    tr.dataset.referenceTo = e.target.value.trim();
                }
            }
        });

        // Track manual type changes
        document.getElementById('sfarc-bulk-table-body').addEventListener('change', (e) => {
            if (e.target.classList.contains('sfarc-field-type-select')) {
                e.target.dataset.manuallyEdited = "true";
            }
        });

        // Multi-line spreadsheet paste into label column
        document.getElementById('sfarc-bulk-table-body').addEventListener('paste', (e) => {
            if (e.target.classList.contains('sfarc-field-label')) {
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                if (pastedText && (pastedText.includes('\n') || pastedText.includes('\t'))) {
                    e.preventDefault();
                    const rawLines = pastedText.split(/\r?\n/).filter(line => line.trim() !== '');
                    if (rawLines.length > 0) {
                        const firstLower = rawLines[0].toLowerCase();
                        const startIndex = (firstLower.includes('label') || firstLower.includes('api name') || firstLower.includes('type')) ? 1 : 0;
                        const dataLines = rawLines.slice(startIndex);
                        
                        const currentTr = e.target.closest('tr');
                        dataLines.forEach((line, idx) => {
                            const cols = line.split(/\t|,/);
                            const label = cols[0] ? cols[0].trim() : '';
                            if (!label) return;
                            const name = cols[1] ? cols[1].trim() : '';
                            const type = cols[2] ? cols[2].trim() : '';
                            const length = cols[3] ? cols[3].trim() : '';
                            
                            if (idx === 0) {
                                e.target.value = label;
                                e.target.dispatchEvent(new Event('input', { bubbles: true }));
                                if (name) {
                                    const nInp = currentTr.querySelector('.sfarc-field-name');
                                    if (nInp) { nInp.value = name; nInp.dataset.manuallyEdited = "true"; }
                                }
                                if (type) {
                                    const tSel = currentTr.querySelector('.sfarc-field-type-select');
                                    if (tSel) { 
                                        tSel.value = type; 
                                        tSel.dataset.manuallyEdited = "true";
                                        tSel.dispatchEvent(new Event('change', { bubbles: true })); 
                                    }
                                }
                                if (length) {
                                    if (['Number', 'Currency', 'Percent'].includes(type)) {
                                        const precInput = currentTr.querySelector('.sfarc-field-precision');
                                        const scaleInput = currentTr.querySelector('.sfarc-field-scale');
                                        if (length.includes(',')) {
                                            const parts = length.split(',');
                                            if (precInput) precInput.value = parts[0].trim();
                                            if (scaleInput) scaleInput.value = parts[1].trim();
                                        } else {
                                            if (precInput) precInput.value = length;
                                        }
                                    } else if (type === 'Checkbox') {
                                        const defSelect = currentTr.querySelector('.sfarc-field-default');
                                        if (defSelect) defSelect.value = length === 'true' || length === 'Checked' ? 'true' : 'false';
                                    } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
                                        const valInput = currentTr.querySelector('.sfarc-field-values');
                                        if (valInput) valInput.value = length;
                                    } else if (['Lookup', 'MasterDetail'].includes(type)) {
                                        const targetObjSelect = currentTr.querySelector('.sfarc-field-target-obj');
                                        if (targetObjSelect) targetObjSelect.value = length;
                                        currentTr.dataset.referenceTo = length;
                                    } else if (['Text', 'Html', 'LongTextArea'].includes(type)) {
                                        const lenInput = currentTr.querySelector('.sfarc-field-length');
                                        if (lenInput) lenInput.value = length;
                                    }
                                    currentTr.dataset.length = length;
                                }
                            } else {
                                const newTr = addRow(label, name, type || 'Text', length || '255');
                                if (['Lookup', 'MasterDetail'].includes(type) && length) {
                                    newTr.dataset.referenceTo = length;
                                }
                            }
                        });
                        saveBulkFieldState();
                    }
                }
            }
        });

        // Spreadsheet keyboard shortcuts
        document.getElementById('sfarc-bulk-table-body').addEventListener('keydown', (e) => {
            const tr = e.target.closest('tr');
            if (!tr) return;

            // Enter on any input -> if on last row, add new row and focus label
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                const isLastRow = tr === tr.parentElement.lastElementChild;
                if (isLastRow) {
                    e.preventDefault();
                    const newTr = addRow();
                    saveBulkFieldState();
                    const nextLabel = newTr.querySelector('.sfarc-field-label');
                    if (nextLabel) nextLabel.focus();
                } else {
                    const nextTr = tr.nextElementSibling;
                    if (nextTr) {
                        const targetClass = Array.from(e.target.classList).find(c => c.startsWith('sfarc-field-'));
                        if (targetClass) {
                            const nextInput = nextTr.querySelector(`.${targetClass}`);
                            if (nextInput) {
                                e.preventDefault();
                                nextInput.focus();
                            }
                        }
                    }
                }
            }

            // Duplicate row: Ctrl+D or Cmd+D
            if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                const cloneBtn = tr.querySelector('.sfarc-action-btn-clone');
                if (cloneBtn) cloneBtn.click();
            }

            // Quick delete empty row on Backspace
            if (e.key === 'Backspace' && e.target.classList.contains('sfarc-field-label') && !e.target.value) {
                const allRows = document.querySelectorAll('#sfarc-bulk-table-body tr');
                if (allRows.length > 1) {
                    e.preventDefault();
                    const prevTr = tr.previousElementSibling;
                    tr.remove();
                    saveBulkFieldState();
                    if (prevTr) {
                        const prevLabel = prevTr.querySelector('.sfarc-field-label');
                        if (prevLabel) prevLabel.focus();
                    }
                }
            }
        });

        // Global Build shortcut: Cmd+Enter or Ctrl+Enter
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const buildBtn = document.getElementById('sfarc-bulk-build-btn');
                if (buildBtn && !buildBtn.disabled) {
                    e.preventDefault();
                    buildBtn.click();
                }
            }
        });

        document.getElementById('sfarc-bulk-table-body').addEventListener('click', async (e) => {
            const psBtn = e.target.closest('.sfarc-field-ext-permissionSets');
            if (psBtn) {
                // Close Field Options drawer to ensure only one modal/drawer is open
                const optModal = document.getElementById('sfarc-bulk-field-options-modal');
                if (optModal) optModal.style.display = 'none';

                const btn = psBtn;
                const modal = document.getElementById('sfarc-bulk-row-ps-modal');
                if (modal && modal.parentElement !== document.body) {
                    document.body.appendChild(modal);
                }
                const list = document.getElementById('sfarc-bulk-row-ps-list');
                const searchInput = document.getElementById('sfarc-bulk-row-ps-search');
                
                // Ensure cachedPermissionSets is populated if empty
                if (cachedPermissionSets.length === 0) {
                    try {
                        list.innerHTML = '<div style="padding: 20px; text-align: center;"><span class="comet-loader-inline"></span> Loading Permission Sets...</div>';
                        modal.style.display = 'flex';
                        const res = await window.sfApi.query(`SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Label ASC LIMIT 500`);
                        if (res.records) cachedPermissionSets = res.records;
                    } catch(err) {
                        console.error("Error fetching permission sets", err);
                    }
                }

                let selectedMap = {};
                try { 
                    const arr = JSON.parse(btn.dataset.selectedPs || '[]');
                    arr.forEach(item => {
                        if (typeof item === 'string') selectedMap[item] = {read: true, edit: true};
                        else if (item && item.id) selectedMap[item.id] = {read: !!item.read, edit: !!item.edit};
                    });
                } catch(err){}

                let visiblePermissionSetIds = [];

                function syncPermissionSetDrawerState() {
                    const count = Object.values(selectedMap).filter(item => item && (item.read || item.edit)).length;
                    const countEl = document.getElementById('sfarc-ps-selection-count');
                    if (countEl) countEl.textContent = `${count} selected`;

                    const visibleStates = visiblePermissionSetIds.map(id => selectedMap[id] || { read: false, edit: false });
                    const readAll = document.getElementById('sfarc-ps-read-all');
                    const editAll = document.getElementById('sfarc-ps-edit-all');
                    if (readAll) {
                        readAll.checked = visibleStates.length > 0 && visibleStates.every(s => s.read);
                        readAll.indeterminate = visibleStates.some(s => s.read) && !readAll.checked;
                    }
                    if (editAll) {
                        editAll.checked = visibleStates.length > 0 && visibleStates.every(s => s.edit);
                        editAll.indeterminate = visibleStates.some(s => s.edit) && !editAll.checked;
                    }
                }
                
                function renderList(filter = '') {
                    list.innerHTML = '';
                    if (cachedPermissionSets.length === 0) {
                        visiblePermissionSetIds = [];
                        list.innerHTML = '<div style="padding: 10px; text-align: center;">No Permission Sets found.</div>';
                        syncPermissionSetDrawerState();
                        return;
                    }
                    
                    const filtered = cachedPermissionSets.filter(ps => 
                        ps.Label.toLowerCase().includes(filter.toLowerCase()) || 
                        ps.Name.toLowerCase().includes(filter.toLowerCase())
                    );
                    
                    if (filtered.length === 0) {
                        visiblePermissionSetIds = [];
                        list.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--sfarc-secondary-text);">No matching Permission Sets found.</div>';
                        syncPermissionSetDrawerState();
                        return;
                    }

                    visiblePermissionSetIds = filtered.map(ps => ps.Id);

                    filtered.forEach(ps => {
                        const s = selectedMap[ps.Id] || {read: false, edit: false};
                        const readChecked = s.read ? 'checked' : '';
                        const editChecked = s.edit ? 'checked' : '';
                        
                        const row = document.createElement('div');
                        row.className = 'sfarc-ps-row';
                        row.dataset.id = ps.Id;
                        row.innerHTML = `
                            <div class="sfarc-ps-name" title="${escapeHtml(ps.Label)} (${escapeHtml(ps.Name)})"><strong>${escapeHtml(ps.Label)}</strong><span>${escapeHtml(ps.Name)}</span></div>
                            <label class="sfarc-ps-check"><input type="checkbox" class="sfarc-ps-read-cb" ${readChecked}><span class="sr-only">Read</span></label>
                            <label class="sfarc-ps-check"><input type="checkbox" class="sfarc-ps-edit-cb" ${editChecked}><span class="sr-only">Edit</span></label>
                        `;
                        list.appendChild(row);
                    });
                    syncPermissionSetDrawerState();
                }
                
                renderList();
                searchInput.value = '';
                searchInput.oninput = (e) => renderList(e.target.value);
                
                // Synchronize selectedMap on checkbox changes (via event delegation)
                list.onchange = (ev) => {
                    const row = ev.target.closest('.sfarc-ps-row');
                    if (!row) return;
                    const psId = row.dataset.id;
                    const readCb = row.querySelector('.sfarc-ps-read-cb');
                    const editCb = row.querySelector('.sfarc-ps-edit-cb');
                    
                    if (ev.target.classList.contains('sfarc-ps-edit-cb') && ev.target.checked) {
                        if (readCb) readCb.checked = true;
                    }
                    if (ev.target.classList.contains('sfarc-ps-read-cb') && !ev.target.checked) {
                        if (editCb) editCb.checked = false;
                    }
                    
                    const readVal = readCb ? readCb.checked : false;
                    const editVal = editCb ? editCb.checked : false;
                    
                    if (readVal || editVal) {
                        selectedMap[psId] = { read: readVal, edit: editVal };
                    } else {
                        delete selectedMap[psId];
                    }
                    syncPermissionSetDrawerState();
                };

                const readAllCb = document.getElementById('sfarc-ps-read-all');
                const editAllCb = document.getElementById('sfarc-ps-edit-all');
                readAllCb.onchange = () => {
                    visiblePermissionSetIds.forEach(id => {
                        const current = selectedMap[id] || { read: false, edit: false };
                        current.read = readAllCb.checked;
                        if (!readAllCb.checked) current.edit = false;
                        if (current.read || current.edit) selectedMap[id] = current;
                        else delete selectedMap[id];
                    });
                    renderList(searchInput.value);
                };
                editAllCb.onchange = () => {
                    visiblePermissionSetIds.forEach(id => {
                        const current = selectedMap[id] || { read: false, edit: false };
                        current.edit = editAllCb.checked;
                        if (editAllCb.checked) current.read = true;
                        if (current.read || current.edit) selectedMap[id] = current;
                        else delete selectedMap[id];
                    });
                    renderList(searchInput.value);
                };

                modal.style.display = 'flex';
                
                function getSelections() {
                    const results = [];
                    Object.keys(selectedMap).forEach(id => {
                        const item = selectedMap[id];
                        if (item && (item.read || item.edit)) {
                            results.push({ id: id, read: item.read, edit: item.edit });
                        }
                    });
                    return results;
                }

                // Bind save button
                document.getElementById('sfarc-bulk-row-ps-save').onclick = () => {
                    const selections = getSelections();
                    btn.dataset.selectedPs = JSON.stringify(selections);
                    btn.title = selections.length > 0 ? (selections.length + ' Selected') : 'Permission Sets';
                    btn.style.color = selections.length > 0 ? '#2e7d32' : 'var(--primary-color)';
                    modal.style.display = 'none';
                };
                
                // Bind apply to all button
                document.getElementById('sfarc-bulk-row-ps-apply-all').onclick = () => {
                    const selections = getSelections();
                    const str = JSON.stringify(selections);
                    const txt = selections.length > 0 ? (selections.length + ' Selected') : 'Permission Sets';
                    const col = selections.length > 0 ? '#2e7d32' : 'var(--primary-color)';
                    document.querySelectorAll('.sfarc-field-ext-permissionSets').forEach(b => {
                        b.dataset.selectedPs = str;
                        b.title = txt;
                        b.style.color = col;
                    });
                    modal.style.display = 'none';
                };
            }
        });

        document.getElementById('sfarc-bulk-row-ps-close').onclick = () => {
            document.getElementById('sfarc-bulk-row-ps-modal').style.display = 'none';
        };
        document.getElementById('sfarc-bulk-row-ps-cancel').onclick = () => {
            document.getElementById('sfarc-bulk-row-ps-modal').style.display = 'none';
        };
        document.getElementById('sfarc-bulk-row-ps-modal').onclick = (e) => {
            if (e.target.id === 'sfarc-bulk-row-ps-modal') {
                document.getElementById('sfarc-bulk-row-ps-modal').style.display = 'none';
            }
        };

        const FIELD_PRESETS = {
            address: [
                { label: 'Street Address', type: 'Text', length: '255' },
                { label: 'City', type: 'Text', length: '100' },
                { label: 'State / Province', type: 'Text', length: '100' },
                { label: 'Postal Code', type: 'Text', length: '20' },
                { label: 'Country', type: 'Text', length: '100' }
            ],
            contact: [
                { label: 'Direct Phone', type: 'Phone', length: '' },
                { label: 'Mobile Phone', type: 'Phone', length: '' },
                { label: 'Work Email', type: 'Email', length: '' },
                { label: 'Secondary Email', type: 'Email', length: '' }
            ],
            financial: [
                { label: 'Annual Recurring Revenue', type: 'Currency', length: '18,2' },
                { label: 'Monthly Recurring Revenue', type: 'Currency', length: '18,2' },
                { label: 'Contract Total Value', type: 'Currency', length: '18,2' },
                { label: 'Discount Percentage', type: 'Percent', length: '5,2' },
                { label: 'Billing Frequency', type: 'Text', length: '50' }
            ],
            audit: [
                { label: 'External System ID', type: 'Text', length: '100', externalId: true },
                { label: 'Legacy Record ID', type: 'Text', length: '100' },
                { label: 'Last Sync Timestamp', type: 'DateTime', length: '' },
                { label: 'Integration Status', type: 'Text', length: '50' }
            ],
            feedback: [
                { label: 'NPS Score', type: 'Number', length: '2,0' },
                { label: 'Satisfaction Rating', type: 'Number', length: '2,0' },
                { label: 'Feedback Notes', type: 'LongTextArea', length: '32768' },
                { label: 'Follow-up Required', type: 'Checkbox', length: '' }
            ],
            social: [
                { label: 'LinkedIn Profile', type: 'Url', length: '' },
                { label: 'Twitter Handle', type: 'Text', length: '50' },
                { label: 'Company Website', type: 'Url', length: '' }
            ]
        };

        const presetsSelect = document.getElementById('sfarc-bulk-presets-select');
        if (presetsSelect) {
            presetsSelect.addEventListener('change', (e) => {
                const presetKey = e.target.value;
                const items = FIELD_PRESETS[presetKey];
                if (items && items.length > 0) {
                    const existingRows = document.querySelectorAll('#sfarc-bulk-table-body tr');
                    if (existingRows.length === 1 && !existingRows[0].querySelector('.sfarc-field-label').value.trim()) {
                        existingRows[0].remove();
                    }

                    items.forEach(item => {
                        let name = item.label.replace(/[^a-zA-Z0-9\s_]/g, '').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + '__c';
                        const tr = addRow(item.label, name, item.type, item.length);
                        if (item.externalId) tr.dataset.externalId = 'true';
                    });
                    saveBulkFieldState();
                    toast.success(`Added ${items.length} fields from template!`);
                }
                e.target.value = '';
            });
        }

        function openQuickAddModal() {
            const modal = document.getElementById('sfarc-bulk-quick-modal');
            if (!modal) return;
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.style.setProperty('display', 'flex', 'important');
            const input = document.getElementById('sfarc-bulk-quick-input');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 60);
            }
        }

        function closeQuickAddModal() {
            const modal = document.getElementById('sfarc-bulk-quick-modal');
            if (modal) modal.style.display = 'none';
        }

        const quickPromptBtn = document.getElementById('sfarc-bulk-quick-prompt-btn');
        if (quickPromptBtn) {
            quickPromptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openQuickAddModal();
            });
        }

        const quickModal = document.getElementById('sfarc-bulk-quick-modal');
        if (quickModal) {
            quickModal.addEventListener('click', (e) => {
                if (e.target === quickModal) closeQuickAddModal();
            });
        }

        const quickClose = document.getElementById('sfarc-bulk-quick-close');
        if (quickClose) quickClose.addEventListener('click', closeQuickAddModal);

        const quickCancel = document.getElementById('sfarc-bulk-quick-cancel');
        if (quickCancel) quickCancel.addEventListener('click', closeQuickAddModal);

        const quickSubmit = document.getElementById('sfarc-bulk-quick-submit');
        const quickInput = document.getElementById('sfarc-bulk-quick-input');

        if (quickInput) {
            quickInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (quickSubmit) quickSubmit.click();
                }
            });
        }

        if (quickSubmit && quickInput) {
            quickSubmit.addEventListener('click', () => {
                const raw = quickInput.value.trim();
                if (!raw) {
                    closeQuickAddModal();
                    return;
                }

                const tokens = raw.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
                if (tokens.length > 0) {
                    const existingRows = document.querySelectorAll('#sfarc-bulk-table-body tr');
                    if (existingRows.length === 1 && !existingRows[0].querySelector('.sfarc-field-label').value.trim()) {
                        existingRows[0].remove();
                    }

                    tokens.forEach(token => {
                        const inferred = inferTypeFromLabel(token);
                        const type = inferred ? inferred.type : 'Text';
                        const length = inferred ? inferred.length : (type === 'Text' ? '255' : '32768');
                        let name = token.replace(/[^a-zA-Z0-9\s_]/g, '').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + '__c';
                        addRow(token, name, type, length);
                    });

                    saveBulkFieldState();
                    closeQuickAddModal();
                    if (window.toast) window.toast.success(`Generated ${tokens.length} custom fields!`);
                }
            });
        }

        document.getElementById('sfarc-bulk-add-col-select').addEventListener('change', (e) => {
            const col = e.target.value;
            if (!col || activeExtraCols.includes(col)) return;
            activeExtraCols.push(col);
            e.target.value = ''; 
            
            const theadRow = document.querySelector('.sfarc-bulk-table thead tr');
            const th = document.createElement('th');
            th.textContent = col === 'description' ? 'Description' : (col === 'inlineHelpText' ? 'Help Text' : 'Default Value');
            th.style.width = '200px';
            theadRow.appendChild(th);
            
            const table = document.querySelector('.sfarc-bulk-table');
            const currentMin = parseInt(getComputedStyle(table).minWidth) || 800;
            table.style.minWidth = (currentMin + 200) + 'px';
            
            const rows = document.querySelectorAll('#sfarc-bulk-table-body tr');
            rows.forEach(tr => {
                const td = document.createElement('td');
                td.innerHTML = `<input type="text" class="sfarc-bulk-table-input sfarc-field-ext-${col}" placeholder="${th.textContent}">`;
                tr.appendChild(td);
            });
        });

        document.getElementById('sfarc-bulk-sample-csv-btn').addEventListener('click', () => {
            const csvRows = [
                ['Label', 'API Name', 'Type', 'Length / Target Object', 'Description', 'Help Text'],
                ['Total Revenue', 'Total_Revenue__c', 'Currency', '18,2', 'Annual gross revenue', 'Enter projected total revenue'],
                ['Parent Account', 'Parent_Account__c', 'Lookup', 'Account', 'Related parent account', 'Lookup to primary account record']
            ];
            
            const csvString = csvRows.map(row => 
                row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
            ).join('\r\n');

            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'bulk_field_builder_template.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            if (window.toast) toast.success("Sample CSV template downloaded!");
        });

        document.getElementById('sfarc-bulk-csv-btn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text) {
                    toast.info("Clipboard is empty.");
                    return;
                }
                const rawLines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (rawLines.length > 0) {
                    const firstLower = rawLines[0].toLowerCase();
                    const startIndex = (firstLower.includes('label') || firstLower.includes('api name') || firstLower.includes('type')) ? 1 : 0;
                    const dataLines = rawLines.slice(startIndex);

                    if (dataLines.length === 0) {
                        toast.info("No data rows found in clipboard.");
                        return;
                    }

                    document.getElementById('sfarc-bulk-table-body').innerHTML = '';
                    dataLines.forEach(line => {
                        const cols = line.match(/(".*?"|[^",;\t]+)(?=\s*[,;\t]|\s*$)/g) || line.split(/[,;\t]/);
                        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

                        if (cleanCols.length >= 1 && cleanCols[0]) {
                            const label = cleanCols[0];
                            const name = cleanCols[1] || '';
                            const type = cleanCols[2] || 'Text';
                            const lengthOrTarget = cleanCols[3] || '';
                            const desc = cleanCols[4] || '';
                            const help = cleanCols[5] || '';

                            const tr = addRow(label, name, type, lengthOrTarget || (['Lookup', 'MasterDetail'].includes(type) ? 'Account' : '255'));
                            if (desc) tr.dataset.description = desc;
                            if (help) tr.dataset.helpText = help;
                            if (['Lookup', 'MasterDetail'].includes(type) && lengthOrTarget) {
                                tr.dataset.referenceTo = lengthOrTarget;
                            }
                        }
                    });
                    saveBulkFieldState();
                    toast.success(`Imported ${dataLines.length} fields from CSV!`);
                }
            } catch (e) {
                toast.error("Could not read from clipboard. Please allow clipboard permissions.");
            }
        });

        document.getElementById('sfarc-bulk-infer-btn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text) return toast.info("Clipboard is empty.");
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length === 0) return;
                
                document.getElementById('sfarc-bulk-table-body').innerHTML = '';
                
                const headers = lines[0].split(/\t|,/).map(h => h.trim());
                const dataRow = lines.length > 1 ? lines[1].split(/\t|,/).map(d => d.trim()) : [];
                
                headers.forEach((header, index) => {
                    if (!header) return;
                    const sample = dataRow[index] || '';
                    let inferredType = 'Text';
                    let inferredLength = '255';

                    if (/^(true|false|yes|no|1|0)$/i.test(sample)) {
                        inferredType = 'Checkbox';
                        inferredLength = '';
                    } else if (/^\$[\d,]+(\.\d{2})?$/.test(sample) || /^\d+(\.\d{2})?$/.test(sample) && sample.includes('.')) {
                        inferredType = 'Currency';
                        inferredLength = '18,0';
                    } else if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(sample)) {
                        inferredType = 'Email';
                        inferredLength = '';
                    } else if (/^\+?[\d\s-]{10,}$/.test(sample)) {
                        inferredType = 'Phone';
                        inferredLength = '';
                    } else if (/^https?:\/\//.test(sample)) {
                        inferredType = 'Url';
                        inferredLength = '';
                    } else if (/^\d+$/.test(sample)) {
                        inferredType = 'Number';
                        inferredLength = '18,0';
                    } else if (sample.length > 255) {
                        inferredType = 'LongTextArea';
                        inferredLength = '32768';
                    }

                    let apiName = header.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '__c';
                    addRow(header, apiName, inferredType, inferredLength);
                });
            } catch (e) {
                toast.error("Could not read from clipboard.");
            }
        });

        document.getElementById('sfarc-bulk-undo-btn').addEventListener('click', async () => {
            if (sessionCreatedFields.length === 0) return;
            const btn = document.getElementById('sfarc-bulk-undo-btn');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="comet-loader-inline"></span> Undoing...`;
            try {
                const results = await window.sfApi.deleteMetadata('CustomField', sessionCreatedFields);
                const fails = results.filter(r => !r.success);
                if (fails.length > 0) {
                    toast.error(`Failed to delete some fields: ${fails.map(f => f.fullName).join(', ')}`);
                } else {
                    toast.success('Successfully rolled back last build!');
                    sessionCreatedFields = [];
                    btn.style.display = 'none';
                }
            } catch (err) {
                toast.error('Error rolling back: ' + err.message);
            }
            btn.disabled = false;
            btn.innerHTML = origHtml;
        });

        document.getElementById('sfarc-bulk-build-btn').addEventListener('click', buildFields);
    }

    function addRow(label = '', name = '', type = 'Text', length = null) {
        if (length == null) {
            try {
                const parsed = JSON.parse(localStorage.getItem('sfiSettings') || '{}');
                length = String(Math.max(1, Math.min(255, Number(parsed.fieldDefaultLength) || 255)));
            } catch (err) {
                length = '255';
            }
        }
        const tbody = document.getElementById('sfarc-bulk-table-body');
        const tr = document.createElement('tr');
        
        const typeOptions = ['Text', 'Number', 'Currency', 'Percent', 'Checkbox', 'Date', 'DateTime', 'Time', 'Email', 'Phone', 'Url', 'Lookup', 'MasterDetail', 'Picklist', 'Html', 'LongTextArea', 'TextArea', 'Formula'];
        let selectedType = typeOptions.find(t => t.toLowerCase() === type.toLowerCase()) || 'Text';
        let typeSelectHtml = `<select class="sfarc-bulk-table-input sfarc-field-type-select">`;
        typeOptions.forEach(opt => {
            typeSelectHtml += `<option value="${opt}" ${opt === selectedType ? 'selected' : ''}>${opt}</option>`;
        });
        typeSelectHtml += `</select>`;

        let extraColsHtml = '';
        activeExtraCols.forEach(col => {
            let placeholder = col === 'description' ? 'Description' : (col === 'inlineHelpText' ? 'Help Text' : 'Default Value');
            extraColsHtml += `<td><input type="text" class="sfarc-bulk-table-input sfarc-field-ext-${col}" placeholder="${placeholder}"></td>`;
        });

        const isRel = ['Lookup', 'MasterDetail'].includes(selectedType);

        tr.innerHTML = `
            <td>
                <div class="sfarc-bulk-actions-td">
                    <button class="sfarc-action-btn sfarc-action-btn-options" title="Field Options (Length, Target Object, Description, Help Text, Required, Unique, External ID)"><i class="fa-solid fa-sliders"></i></button>
                    <button class="sfarc-action-btn sfarc-action-btn-clone" title="Clone Row"><i class="fa-regular fa-copy"></i></button>
                    <button class="sfarc-action-btn sfarc-action-btn-delete" title="Delete Row"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
            <td style="text-align: center; vertical-align: middle;"><button class="sfarc-field-ext-permissionSets" data-selected-ps="[]" title="0 Selected" style="background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 14px; padding: 4px 6px; border-radius: 4px;"><i class="fa-regular fa-user"></i></button></td>
            <td><input type="text" class="sfarc-bulk-table-input sfarc-field-label" placeholder="Field label..." value="${label}"></td>
            <td><input type="text" class="sfarc-bulk-table-input sfarc-field-name" placeholder="Field name..." value="${name}"></td>
            <td>${typeSelectHtml}</td>
            <td class="sfarc-length-td"></td>
            ${extraColsHtml}
        `;
        
        if (isRel) {
            tr.dataset.referenceTo = length || 'Account';
        }
        
        updateLengthCell(tr, selectedType, length);

        const optBtn = tr.querySelector('.sfarc-action-btn-options');
        if (optBtn) {
            optBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openFieldOptionsModal(tr);
            });
        }

        tbody.appendChild(tr);
        updateBuilderReadiness();
        return tr;
    }

    function updateBuilderReadiness() {
        const objectName = document.getElementById('sfarc-bulk-object-select')?.value || '';
        const rows = Array.from(document.querySelectorAll('#sfarc-bulk-table-body tr'));
        const startedRows = rows.filter(row => row.querySelector('.sfarc-field-label')?.value.trim() || row.querySelector('.sfarc-field-name')?.value.trim());
        const validRows = rows.filter(row => row.querySelector('.sfarc-field-label')?.value.trim() && row.querySelector('.sfarc-field-name')?.value.trim());
        const incomplete = startedRows.length - validRows.length;
        const buildBtn = document.getElementById('sfarc-bulk-build-btn');
        const readiness = document.getElementById('sfarc-builder-readiness');

        document.getElementById('sfarc-guide-object')?.classList.toggle('complete', !!objectName);
        document.getElementById('sfarc-guide-fields')?.classList.toggle('complete', validRows.length > 0 && incomplete === 0);
        document.getElementById('sfarc-guide-build')?.classList.toggle('complete', !!objectName && validRows.length > 0 && incomplete === 0);

        if (readiness) {
            readiness.classList.toggle('ready', !!objectName && validRows.length > 0 && incomplete === 0);
            if (!objectName) readiness.textContent = 'Select an object to begin';
            else if (validRows.length === 0) readiness.textContent = 'Add a field label — API name and type are generated automatically';
            else if (incomplete > 0) readiness.textContent = `${incomplete} incomplete field${incomplete === 1 ? '' : 's'} to fix`;
            else readiness.textContent = `${validRows.length} field${validRows.length === 1 ? '' : 's'} ready to build`;
        }

        if (buildBtn && !buildBtn.dataset.building) {
            const ready = !!objectName && validRows.length > 0 && incomplete === 0;
            buildBtn.disabled = !ready;
            buildBtn.innerHTML = `<i class="fa-solid fa-hammer"></i> ${ready ? `Build ${validRows.length} Field${validRows.length === 1 ? '' : 's'}` : 'Build Fields'}`;
            buildBtn.title = ready ? `Create ${validRows.length} field${validRows.length === 1 ? '' : 's'} on ${objectName}` : 'Choose an object and complete at least one field';
        }
    }

    function validateFieldRows(rows, objectName) {
        const errors = [];
        const seenNames = new Set();
        const masterDetailOrders = new Set();
        const addError = (row, message, control) => {
            row.classList.add('sfarc-row-invalid');
            row.dataset.validationError = message;
            row.title = message;
            errors.push({ row, message, control });
        };

        rows.forEach(row => {
            row.classList.remove('sfarc-row-invalid');
            delete row.dataset.validationError;
            row.removeAttribute('title');

            const labelInput = row.querySelector('.sfarc-field-label');
            const nameInput = row.querySelector('.sfarc-field-name');
            const typeSelect = row.querySelector('.sfarc-field-type-select');
            const label = labelInput?.value.trim() || '';
            const name = nameInput?.value.trim() || '';
            const type = typeSelect?.value || 'Text';
            if (!label && !name) return;
            if (!label) return addError(row, 'Field label is required.', labelInput);
            if (!name) return addError(row, 'Field API name is required.', nameInput);
            if (!/^[A-Za-z][A-Za-z0-9_]*__c$/.test(name)) {
                return addError(row, 'API name must start with a letter, contain only letters, numbers or underscores, and end with __c.', nameInput);
            }
            if (name.length > 43) return addError(row, 'Custom field API name cannot exceed 40 characters before the __c suffix.', nameInput);
            const normalizedName = name.toLowerCase();
            if (seenNames.has(normalizedName)) return addError(row, `Duplicate API name: ${name}`, nameInput);
            seenNames.add(normalizedName);

            if (type === 'Text') {
                const length = Number(row.querySelector('.sfarc-field-length')?.value);
                if (!Number.isInteger(length) || length < 1 || length > 255) addError(row, 'Text length must be a whole number from 1 to 255.', row.querySelector('.sfarc-field-length'));
            }
            if (type === 'LongTextArea' || type === 'Html') {
                const length = Number(row.querySelector('.sfarc-field-length')?.value);
                if (!Number.isInteger(length) || length < 256 || length > 131072) addError(row, `${type === 'Html' ? 'Rich Text Area' : 'Long Text Area'} length must be from 256 to 131,072.`, row.querySelector('.sfarc-field-length'));
            }
            if (['Number', 'Currency', 'Percent'].includes(type)) {
                const precisionInput = row.querySelector('.sfarc-field-precision');
                const scaleInput = row.querySelector('.sfarc-field-scale');
                const precision = Number(precisionInput?.value);
                const scale = Number(scaleInput?.value);
                if (!Number.isInteger(precision) || precision < 1 || precision > 18) addError(row, `${type} precision must be a whole number from 1 to 18.`, precisionInput);
                else if (!Number.isInteger(scale) || scale < 0 || scale > precision) addError(row, `${type} decimal places must be between 0 and its precision (${precision}).`, scaleInput);
            }
            if (type === 'Picklist' || type === 'MultiselectPicklist') {
                const valuesInput = row.querySelector('.sfarc-field-values');
                const values = (valuesInput?.value || '').split(',').map(value => value.trim()).filter(Boolean);
                if (values.length === 0) addError(row, `${type === 'Picklist' ? 'Picklist' : 'Multi-Select Picklist'} requires at least one value.`, valuesInput);
                else if (new Set(values.map(value => value.toLowerCase())).size !== values.length) addError(row, 'Picklist values must be unique.', valuesInput);
            }
            if (type === 'Formula') {
                const formulaInput = row.querySelector('.sfarc-field-formula');
                if (!formulaInput?.value.trim()) addError(row, 'Formula expression is required.', formulaInput);
            }
            if (type === 'Lookup' || type === 'MasterDetail') {
                const targetInput = row.querySelector('.sfarc-field-target-obj');
                const target = row.dataset.referenceTo || targetInput?.value || '';
                if (!target) addError(row, 'A related target object is required.', targetInput);
                if (type === 'MasterDetail' && objectName && !objectName.endsWith('__c')) {
                    addError(row, 'Master-Detail fields can only be created on a custom detail object.', typeSelect);
                }
                if (type === 'MasterDetail') {
                    const order = String(row.dataset.relationshipOrder || '0');
                    if (masterDetailOrders.has(order)) addError(row, `Only one ${order === '0' ? 'primary' : 'secondary'} Master-Detail relationship can be created in this batch.`, typeSelect);
                    masterDetailOrders.add(order);
                }
            }

            const supportsUniqueOrExternalId = ['Text', 'Number', 'Email'].includes(type);
            if (!supportsUniqueOrExternalId && (row.dataset.unique === 'true' || row.dataset.externalId === 'true')) {
                addError(row, `Unique and External ID aren’t supported for ${type} fields.`, typeSelect);
            }
            if (['Formula', 'MasterDetail'].includes(type) && row.dataset.required === 'true') {
                addError(row, `${type === 'Formula' ? 'Formula' : 'Master-Detail'} fields don’t use the Required option.`, typeSelect);
            }
        });
        return errors;
    }

    async function buildFields() {
        const objectSelect = document.getElementById('sfarc-bulk-object-select');
        const objectName = objectSelect.value;
        if (!objectName) {
            toast.error("Please select a target object.");
            return;
        }

        const rows = Array.from(document.querySelectorAll('#sfarc-bulk-table-body tr'));
        const validationErrors = validateFieldRows(rows, objectName);
        if (validationErrors.length > 0) {
            const first = validationErrors[0];
            if (window.toast) toast.error(`${first.message}${validationErrors.length > 1 ? ` (+${validationErrors.length - 1} more)` : ''}`);
            first.control?.focus();
            first.row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }

        const btn = document.getElementById('sfarc-bulk-build-btn');
        btn.dataset.building = 'true';
        btn.disabled = true;
        btn.innerHTML = `<span class="comet-loader-inline"></span> Building...`;

        const metadataObjects = [];
        const rowPermissionSets = []; // Store permissions separately from metadata payloads

        for (const row of rows) {
            const label = row.querySelector('.sfarc-field-label').value.trim();
            const name = row.querySelector('.sfarc-field-name').value.trim();
            const type = row.querySelector('.sfarc-field-type-select').value;
            const description = row.dataset.description || '';
            const helpText = row.dataset.helpText || '';
            const isRequired = row.dataset.required === 'true';
            const isUnique = row.dataset.unique === 'true';
            const isExternalId = row.dataset.externalId === 'true';

            if (!label || !name) continue;

            const fullName = `${objectName}.${name}`;
            
            const fieldMeta = {
                fullName: fullName,
                label: label,
                type: type,
            };

            if (['Text', 'Html', 'LongTextArea'].includes(type)) {
                const lenInput = row.querySelector('.sfarc-field-length');
                fieldMeta.length = lenInput ? lenInput.value.trim() : (row.dataset.length || '255');
            } else if (['Number', 'Currency', 'Percent'].includes(type)) {
                const precInput = row.querySelector('.sfarc-field-precision');
                const scaleInput = row.querySelector('.sfarc-field-scale');
                fieldMeta.precision = precInput ? precInput.value.trim() : '18';
                fieldMeta.scale = scaleInput ? scaleInput.value.trim() : '0';
            } else if (type === 'Checkbox') {
                const defSelect = row.querySelector('.sfarc-field-default');
                fieldMeta.defaultValue = defSelect ? defSelect.value : 'false';
            } else if (['Picklist', 'MultiselectPicklist'].includes(type)) {
                const valInput = row.querySelector('.sfarc-field-values');
                const rawVals = valInput ? valInput.value.trim() : '';
                if (rawVals) {
                    const valArray = rawVals.split(',').map(v => v.trim()).filter(Boolean);
                    fieldMeta.valueSet = {
                        valueSetDefinition: {
                            sorted: false,
                            value: valArray.map(v => ({ fullName: v, default: false, label: v }))
                        }
                    };
                }
                if (type === 'MultiselectPicklist') {
                    fieldMeta.visibleLines = '4';
                }
            } else if (['Lookup', 'MasterDetail'].includes(type)) {
                const targetObj = row.dataset.referenceTo || 'Account';
                fieldMeta.referenceTo = targetObj;
                
                let relName = row.dataset.relationshipName || '';
                if (!relName) {
                    const relInput = row.querySelector('.sfarc-field-rel-name');
                    if (relInput && relInput.value.trim()) {
                        relName = relInput.value.trim();
                    } else {
                        relName = name.replace(/__c$/, '');
                        if (!relName.endsWith('s')) relName += 's';
                    }
                }
                fieldMeta.relationshipName = relName;
                
                let relLabel = row.dataset.relationshipLabel || '';
                if (!relLabel) {
                    relLabel = label;
                    if (!relLabel.endsWith('s')) relLabel += 's';
                }
                fieldMeta.relationshipLabel = relLabel;
                
                if (type === 'MasterDetail') {
                    fieldMeta.relationshipOrder = Number(row.dataset.relationshipOrder || 0);
                    fieldMeta.writeRequiresMasterRead = row.dataset.writeRequiresMasterRead === 'true';
                    fieldMeta.reparentableMasterDetail = row.dataset.reparentableMasterDetail === 'true';
                } else {
                    fieldMeta.deleteConstraint = isRequired ? 'Restrict' : (row.dataset.deleteConstraint || 'SetNull');
                }
            } else if (type === 'Formula') {
                const retType = row.dataset.formulaReturnType || row.querySelector('.sfarc-field-formula-return')?.value || 'Text';
                const formulaInput = row.querySelector('.sfarc-field-formula');
                fieldMeta.type = retType;
                fieldMeta.formula = formulaInput ? formulaInput.value.trim() : '';
                
                if (['Number', 'Currency', 'Percent'].includes(retType)) {
                    fieldMeta.precision = '18';
                    fieldMeta.scale = '2';
                    fieldMeta.formulaTreatBlanksAs = 'BlankAsZero';
                } else if (retType === 'Text') {
                    fieldMeta.length = '255';
                }
            }

            if (type === 'Html' || type === 'LongTextArea') {
                fieldMeta.visibleLines = '3';
            }

            if (description) fieldMeta.description = description;
            if (helpText) fieldMeta.inlineHelpText = helpText;
            if (isRequired) fieldMeta.required = true;
            if (isUnique) fieldMeta.unique = true;
            if (isExternalId) fieldMeta.externalId = true;

            let psList = [];
            const psBtn = row.querySelector('.sfarc-field-ext-permissionSets');
            if (psBtn) {
                try { psList = JSON.parse(psBtn.dataset.selectedPs || '[]'); } catch(e){}
            }
            rowPermissionSets.push(psList);

            activeExtraCols.forEach(col => {
                const inputEl = row.querySelector(`.sfarc-field-ext-${col}`);
                if (inputEl) {
                    const extVal = inputEl.value.trim();
                    if (extVal) {
                        fieldMeta[col] = extVal;
                    }
                }
            });

            metadataObjects.push(fieldMeta);
        }

        if (metadataObjects.length === 0) {
            toast.error("Please add at least one valid field to build.");
            delete btn.dataset.building;
            updateBuilderReadiness();
            return;
        }

        try {
            const results = await window.sfApi.createMetadata('CustomField', metadataObjects);
            
            let successCount = 0;
            let errorCount = 0;
            let fieldPermissionsToCreate = [];
            let detailedResults = [];

            results.forEach((r, idx) => {
                const targetFullName = r.fullName || metadataObjects[idx]?.fullName || "CustomField";
                if (r.success) {
                    successCount++;
                    sessionCreatedFields.push(r.fullName);
                    detailedResults.push({
                        status: "success",
                        item: r.fullName,
                        action: "Create CustomField",
                        message: "Field created successfully in Salesforce."
                    });
                    
                    const rowPS = rowPermissionSets[idx] || [];
                    rowPS.forEach(ps => {
                        const psId = typeof ps === 'string' ? ps : ps.id;
                        const pRead = typeof ps === 'string' ? true : ps.read;
                        const pEdit = typeof ps === 'string' ? true : ps.edit;
                        
                        fieldPermissionsToCreate.push({
                            attributes: { type: 'FieldPermissions' },
                            ParentId: psId,
                            SobjectType: objectName,
                            Field: r.fullName,
                            PermissionsRead: pRead,
                            PermissionsEdit: pEdit
                        });
                    });
                } else {
                    errorCount++;
                    let errMsg = "Field creation failed";
                    if (r.errors) {
                        if (Array.isArray(r.errors)) {
                            errMsg = r.errors.map(e => typeof e === 'object' ? `[${e.statusCode || 'ERROR'}] ${e.message}` : String(e)).join(', ');
                        } else if (typeof r.errors === 'object') {
                            errMsg = `[${r.errors.statusCode || 'ERROR'}] ${r.errors.message || JSON.stringify(r.errors)}`;
                        } else {
                            errMsg = String(r.errors);
                        }
                    }
                    detailedResults.push({
                        status: "failed",
                        item: targetFullName,
                        action: "Create CustomField",
                        message: errMsg
                    });
                }
            });

            if (sessionCreatedFields.length > 0) {
                document.getElementById('sfarc-bulk-undo-btn').style.display = 'flex';
            }

            // Insert row-level permission sets if any exist
            if (fieldPermissionsToCreate.length > 0) {
                try {
                    btn.innerHTML = `<span class="comet-loader-inline"></span> Saving FLS...`;
                    for (let i = 0; i < fieldPermissionsToCreate.length; i += 25) {
                        const chunk = fieldPermissionsToCreate.slice(i, i + 25);
                        const compositeReq = {
                            allOrNone: false,
                            compositeRequest: chunk.map((p, idx) => ({
                                method: 'POST',
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions`,
                                referenceId: `ref${idx}`,
                                body: p
                            }))
                        };
                        const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                            method: 'POST',
                            body: JSON.stringify(compositeReq)
                        });

                        const json = await res.json();
                        if (json.compositeResponse) {
                            json.compositeResponse.forEach((cr, idx) => {
                                const itemInfo = chunk[idx];
                                const psObj = cachedPermissionSets.find(p => p.Id === itemInfo.ParentId);
                                const psLabel = psObj ? `${psObj.Label}` : itemInfo.ParentId;
                                const itemLabel = `${itemInfo.Field} → ${psLabel}`;
                                const accessRights = [itemInfo.PermissionsRead ? 'Read' : '', itemInfo.PermissionsEdit ? 'Edit' : ''].filter(Boolean).join('/');

                                if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) {
                                    detailedResults.push({
                                        status: "success",
                                        item: itemLabel,
                                        action: `FieldPermissions (${accessRights})`,
                                        message: "Permission assigned successfully."
                                    });
                                } else {
                                    let errMsg = "Failed to assign permission";
                                    if (cr.body && Array.isArray(cr.body) && cr.body.length > 0) {
                                        errMsg = cr.body.map(e => `[${e.errorCode || 'ERROR'}] ${e.message}`).join(', ');
                                    } else if (cr.body && cr.body.message) {
                                        errMsg = `[${cr.body.errorCode || 'ERROR'}] ${cr.body.message}`;
                                    }
                                    detailedResults.push({
                                        status: "failed",
                                        item: itemLabel,
                                        action: `FieldPermissions (${accessRights})`,
                                        message: errMsg
                                    });
                                }
                            });
                        }
                    }
                } catch(e) {
                    console.error("Error saving row-level FLS", e);
                }
            }

            showDetailedResultsModal("Field Creation & Initial Permissions Results", detailedResults);

            if (errorCount === 0) {
                document.getElementById('sfarc-bulk-table-body').innerHTML = '';
                loadFLSScreen();
            }

        } catch (e) {
            console.error("Build Fields Error:", e);
            toast.error("Error creating fields: " + e.message);
        } finally {
            delete btn.dataset.building;
            updateBuilderReadiness();
        }
    }

    async function loadFLSScreen() {
        document.querySelector('.sfarc-bulk-field-wrapper').style.display = 'none';
        document.getElementById('sfarc-bulk-fls-wrapper').style.display = 'flex';
        
        const tbody = document.getElementById('sfarc-bulk-fls-body');
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;"><span class="comet-loader-inline"></span> Loading Permission Sets...</td></tr>`;
        
        try {
            const res = await window.sfApi.query(`SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Label ASC LIMIT 500`);
            tbody.innerHTML = '';
            
            if (res.records && res.records.length > 0) {
                res.records.forEach(ps => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid var(--sfarc-border)';
                    tr.innerHTML = `
                        <td style="padding: 10px 15px; font-size: 13px; color: var(--sfarc-text);">${ps.Label} <span style="color: var(--sfarc-secondary-text); font-size: 11px;">(${ps.Name})</span></td>
                        <td style="padding: 10px 15px; text-align: center;"><input type="checkbox" class="fls-read-cb" data-id="${ps.Id}"></td>
                        <td style="padding: 10px 15px; text-align: center;"><input type="checkbox" class="fls-edit-cb" data-id="${ps.Id}"></td>
                    `;
                    tbody.appendChild(tr);
                    
                    const readCb = tr.querySelector('.fls-read-cb');
                    const editCb = tr.querySelector('.fls-edit-cb');
                    editCb.addEventListener('change', () => {
                        if (editCb.checked) readCb.checked = true;
                    });
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;">No Permission Sets found.</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: red;">Failed to load: ${e.message}</td></tr>`;
        }
        
        document.getElementById('sfarc-bulk-fls-save-btn').onclick = async function() {
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = `<span class="comet-loader-inline"></span> Saving...`;
            
            try {
                const permsToCreate = [];
                const rows = document.querySelectorAll('#sfarc-bulk-fls-body tr');
                
                rows.forEach(row => {
                    const readCb = row.querySelector('.fls-read-cb');
                    const editCb = row.querySelector('.fls-edit-cb');
                    
                    if (readCb && (readCb.checked || editCb.checked)) {
                        const psId = readCb.getAttribute('data-id');
                        
                        sessionCreatedFields.forEach(field => {
                            permsToCreate.push({
                                attributes: { type: 'FieldPermissions' },
                                ParentId: psId,
                                SobjectType: field.split('.')[0],
                                Field: field,
                                PermissionsRead: readCb.checked,
                                PermissionsEdit: editCb.checked
                            });
                        });
                    }
                });
                
                if (permsToCreate.length === 0) {
                    toast.info("No permissions selected to save.");
                    btn.disabled = false;
                    btn.innerHTML = `Save Permissions`;
                    return;
                }
                
                let detailedResults = [];
                
                for (let i = 0; i < permsToCreate.length; i += 25) {
                    const chunk = permsToCreate.slice(i, i + 25);
                    const compositeReq = {
                        allOrNone: false,
                        compositeRequest: chunk.map((p, idx) => ({
                            method: 'POST',
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions`,
                            referenceId: `ref${idx}`,
                            body: p
                        }))
                    };
                    
                    const res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/composite`, {
                        method: 'POST',
                        body: JSON.stringify(compositeReq)
                    });
                    
                    const json = await res.json();
                    if (json.compositeResponse) {
                        json.compositeResponse.forEach((cr, idx) => {
                            const itemInfo = chunk[idx];
                            const psObj = cachedPermissionSets.find(p => p.Id === itemInfo.ParentId);
                            const psLabel = psObj ? `${psObj.Label}` : itemInfo.ParentId;
                            const itemLabel = `${itemInfo.Field} → ${psLabel}`;
                            const accessRights = [itemInfo.PermissionsRead ? 'Read' : '', itemInfo.PermissionsEdit ? 'Edit' : ''].filter(Boolean).join('/');

                            if (cr.httpStatusCode === 201 || cr.httpStatusCode === 200) {
                                detailedResults.push({
                                    status: "success",
                                    item: itemLabel,
                                    action: `FieldPermissions (${accessRights})`,
                                    message: "Permission assigned successfully."
                                });
                            } else {
                                let errMsg = "Failed to assign permission";
                                if (cr.body && Array.isArray(cr.body) && cr.body.length > 0) {
                                    errMsg = cr.body.map(e => `[${e.errorCode || 'ERROR'}] ${e.message}`).join(', ');
                                } else if (cr.body && cr.body.message) {
                                    errMsg = `[${cr.body.errorCode || 'ERROR'}] ${cr.body.message}`;
                                }
                                detailedResults.push({
                                    status: "failed",
                                    item: itemLabel,
                                    action: `FieldPermissions (${accessRights})`,
                                    message: errMsg
                                });
                            }
                        });
                    }
                }
                
                showDetailedResultsModal("Field Permissions Assignment Results", detailedResults);
                
                document.getElementById('sfarc-bulk-fls-wrapper').style.display = 'none';
                document.querySelector('.sfarc-bulk-field-wrapper').style.display = 'flex';
                
            } catch (err) {
                toast.error("Failed to save permissions: " + err.message);
            }
            
            btn.disabled = false;
            btn.innerHTML = `Save Permissions`;
        };

    function showDetailedResultsModal(title, results) {
        const modal = document.getElementById('sfarc-bulk-results-modal');
        if (!modal) return;
        
        document.getElementById('sfarc-bulk-results-title').textContent = title;
        const bodyEl = document.getElementById('sfarc-bulk-results-body');
        const badgeSuccess = document.getElementById('sfarc-results-badge-success');
        const badgeFailed = document.getElementById('sfarc-results-badge-failed');
        
        const successItems = results.filter(r => r.status === 'success');
        const failedItems = results.filter(r => r.status === 'failed');

        badgeSuccess.textContent = `✓ ${successItems.length} Successful`;
        badgeFailed.textContent = `❌ ${failedItems.length} Failed`;

        function renderTable(filter = 'all') {
            let items = results;
            if (filter === 'success') items = successItems;
            else if (filter === 'failed') items = failedItems;

            if (items.length === 0) {
                bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--sfarc-secondary-text);">No ${filter} items found.</div>`;
                return;
            }

            let tableHtml = `
                <table class="sfarc-results-table" style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid var(--sfarc-border); border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); color: var(--sfarc-text); text-align: left;">
                            <th style="padding: 10px 12px; width: 95px;">Status</th>
                            <th style="padding: 10px 12px;">Target Item</th>
                            <th style="padding: 10px 12px; width: 140px;">Action</th>
                            <th style="padding: 10px 12px;">Details / Response Message</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            items.forEach(res => {
                const isSuccess = res.status === 'success';
                tableHtml += `
                    <tr style="border-bottom: 1px solid var(--sfarc-border); background: ${isSuccess ? 'var(--sfarc-bg)' : 'rgba(239, 68, 68, 0.05)'};">
                        <td style="padding: 10px 12px;">
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 500; background: ${isSuccess ? '#ecfdf5' : '#fee2e2'}; color: ${isSuccess ? '#047857' : '#b91c1c'}; border: 1px solid ${isSuccess ? '#a7f3d0' : '#fca5a5'};">
                                ${isSuccess ? '✓ Success' : '❌ Failed'}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; font-weight: 500; color: var(--sfarc-text); word-break: break-word;">${res.item}</td>
                        <td style="padding: 10px 12px; color: var(--sfarc-secondary-text); font-size: 11px;">${res.action}</td>
                        <td style="padding: 10px 12px; color: ${isSuccess ? '#047857' : '#dc2626'}; font-size: 11px; word-break: break-word;">${res.message}</td>
                    </tr>
                `;
            });

            tableHtml += `</tbody></table>`;
            bodyEl.innerHTML = tableHtml;
        }

        renderTable('all');

        // Filter tab clicks
        const tabBtns = document.querySelectorAll('#sfarc-results-filter-tabs button');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTable(btn.dataset.filter);
            };
        });

        modal.style.display = 'flex';

        document.getElementById('sfarc-bulk-results-close').onclick = () => modal.style.display = 'none';
        document.getElementById('sfarc-bulk-results-done-btn').onclick = () => modal.style.display = 'none';
    }
        
        document.getElementById('sfarc-bulk-fls-back-btn').onclick = () => {
            document.getElementById('sfarc-bulk-fls-wrapper').style.display = 'none';
            document.querySelector('.sfarc-bulk-field-wrapper').style.display = 'flex';
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof window.initBulkFieldBuilder === 'function') window.initBulkFieldBuilder();
        });
    } else {
        if (typeof window.initBulkFieldBuilder === 'function') window.initBulkFieldBuilder();
    }
})();
