/**
 * Test Data Generator Logic
 * Handles object metadata fetching, card rendering, and Apex code generation.
 */
if (typeof window !== 'undefined' && !window.TestDataBuilder) {
class TestDataBuilder {
    constructor() {
        this.container = null;
        this.cardsContainer = null;
        this.codeContainer = null;
        this.objects = new Map(); // Map<string, ObjectData>
        this.relationships = []; // Array<{from: string, to: string, field: string}>
        this.rootObject = null;
        this.scale = 1; // Correctly initialize scale
        this.ZOOM_STEP = 0.1;
        this.MIN_ZOOM = 0.2;
        this.MAX_ZOOM = 3.0;

        // Pan State
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
    }

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Ensure API is initialized
        if (window.sfApi) {
            await window.sfApi.init();
        }

        this.renderLayout();
        this.loadTheme();
        this.loadObjectList();

        // Listen for theme changes from the main extension popup
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.sfiSettings) {
                this.loadTheme();
            }
        });
    }

    async loadTheme() {
        try {
            const result = await chrome.storage.sync.get('sfiSettings');
            const settings = result.sfiSettings || {};

            const theme = settings.theme || 'system';

            if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.body.classList.add('sfarc-dark-theme');
            } else {
                document.body.classList.remove('sfarc-dark-theme');
            }
        } catch (e) {
            console.error('Error loading theme:', e);
        }
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="sfarc-builder-layout">
                <div class="sfarc-builder-sidebar" id="sfarc-builder-sidebar">
                    <div class="sfarc-builder-sidebar-header">
                        <h3>Generated Apex Code</h3>
                        <div style="display:flex; gap: 8px;">
                            <button id="sfarc-builder-copy-btn" class="sfarc-builder-icon-btn" title="Copy Code">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                            <button id="sfarc-builder-sidebar-close" class="sfarc-builder-sidebar-close">&times;</button>
                        </div>
                    </div>
                    <div id="sfarc-builder-code" class="sfarc-builder-code">
                        // Code will appear here
                    </div>
                </div>

                <div class="sfarc-builder-main">
                    <!-- Left Panel: Details -->
                    <div class="sfarc-details-panel">
                        <div class="sfarc-details-header">
                            <input type="text" id="sfarc-builder-object-select" list="sfarc-object-list" class="sfarc-builder-select" placeholder="Select Context Object...">
                            <datalist id="sfarc-object-list"></datalist>
                            <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
                                <button id="sfarc-builder-reset" class="sfarc-btn-icon" title="Reset">
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                                </button>
                                <button id="sfarc-builder-generate" class="sfarc-btn-gradient" title="Generate Apex Code">
                                    <span class="sfarc-gradient-icon"></span>
                                    <span class="sfarc-btn-gradient-content">Generate Apex</span>
                                </button>
                            </div>
                        </div>
                        <div id="sfarc-details-body" class="sfarc-details-body">
                            <div class="sfarc-empty-state-builder">
                                <p>Select a node to view details.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Right Panel: Canvas -->
                    <div class="sfarc-canvas-panel" id="sfarc-canvas-panel">
                        <div id="sfarc-canvas-content" class="sfarc-canvas-content">
                            <svg id="sfarc-builder-connections" class="sfarc-builder-connections"></svg>
                            <!-- Nodes will be added here -->
                        </div>
                        
                        <!-- Zoom Controls -->
                        <div class="sfarc-zoom-controls">
                            <button id="sfarc-zoom-in" class="sfarc-zoom-btn" title="Zoom In">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <button id="sfarc-zoom-out" class="sfarc-zoom-btn" title="Zoom Out">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('sfarc-builder-object-select').addEventListener('change', (e) => {
            if (e.target.value) this.addRootObject(e.target.value);
        });

        document.getElementById('sfarc-builder-reset').addEventListener('click', () => this.reset());

        document.getElementById('sfarc-builder-generate').addEventListener('click', () => this.generateCode());

        // Zoom & Pan Listeners
        const zoomInBtn = document.getElementById('sfarc-zoom-in');
        const zoomOutBtn = document.getElementById('sfarc-zoom-out');

        if (zoomInBtn) zoomInBtn.addEventListener('click', (e) => { e.stopPropagation(); this.zoomIn(); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', (e) => { e.stopPropagation(); this.zoomOut(); });

        // Sidebar Actions
        const closeSidebarBtn = document.getElementById('sfarc-builder-sidebar-close');
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => this.toggleSidebar(false));
        }

        const copyCodeBtn = document.getElementById('sfarc-builder-copy-btn');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', () => this.copyCode());
        }

        const canvasPanel = document.getElementById('sfarc-canvas-panel');

        // Panning Logic
        canvasPanel.addEventListener('mousedown', (e) => {
            // Only left click and not on a node (if nodes block) - actually nodes move with it so usually ok
            // But prevent if clicking a button inside
            if (e.target.closest('button')) return;

            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            canvasPanel.style.cursor = 'grabbing';
            e.preventDefault(); // Prevent text selection
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.updateTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvasPanel.style.cursor = 'grab';
            }
        });

        // Wheel Zoom (Pinch Support)
        canvasPanel.addEventListener('wheel', (e) => {
            // Check for pinch gesture (ctrlKey on trackpad often triggered) or just standard wheel if user prefers
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                // Smooth zoom calculation
                const delta = -e.deltaY;
                const zoomFactor = 0.01;
                let newScale = this.scale + (delta * zoomFactor);

                // Clamp
                this.scale = Math.min(Math.max(newScale, this.MIN_ZOOM), this.MAX_ZOOM);
                this.updateTransform();
            }
        }, { passive: false });


        // Update connections on resize logic
        window.addEventListener('resize', () => {
            this.updateLayout();
            this.drawConnections();
        });
    }

    updateTransform() {
        const content = document.getElementById('sfarc-canvas-content');
        const panel = document.getElementById('sfarc-canvas-panel');

        if (content) {
            content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        }

        // Sync Grid Position
        if (panel) {
            panel.style.setProperty('--grid-x', `${this.panX}px`);
            panel.style.setProperty('--grid-y', `${this.panY}px`);
        }
    }

    zoomIn() {
        this.scale = Math.min(this.scale + 0.1, 3);
        this.updateTransform();
    }

    zoomOut() {
        this.scale = Math.max(this.scale - 0.1, 0.2);
        this.updateTransform();
    }


    async loadObjectList() {
        try {
            const query = "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE IsCustomizable = true ORDER BY Label";
            const result = await window.sfApi.query(query, true); // Use Tooling API for EntityDefinition

            const dataList = document.getElementById('sfarc-object-list'); // Use datalist
            if (result.records) {
                result.records.forEach(obj => {
                    const option = document.createElement('option');
                    option.value = obj.QualifiedApiName;
                    option.textContent = `${obj.Label} (${obj.QualifiedApiName})`; // Shows in suggestion
                    dataList.appendChild(option);
                });
            }
        } catch (e) {
            console.error('Error loading object list:', e);
        }
    }

    async copyCode() {
        const codeElement = document.getElementById('sfarc-builder-code');
        if (!codeElement) return;

        // Get text content (removing HTML tags if any, though innerText is usually safer for copy)
        const code = codeElement.innerText || codeElement.textContent;

        try {
            await navigator.clipboard.writeText(code);
            // Show Notification
            this.showToast('Code Copied!');
        } catch (err) {
            console.error('Failed to copy class code: ', err);
            this.showToast('Failed to copy', true);
        }
    }

    showToast(message, isError = false) {
        let toast = document.getElementById('sfarc-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sfarc-toast';
            toast.className = 'sfarc-toast';
            // Icon
            const icon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            toast.innerHTML = `<span id="sfarc-toast-icon" style="display:flex;align-items:center;"></span><span id="sfarc-toast-msg"></span>`;
            this.container.appendChild(toast);
        }

        const msgSpan = document.getElementById('sfarc-toast-msg');
        if (msgSpan) msgSpan.textContent = message;
        const iconEl = document.getElementById('sfarc-toast-icon');
        if (iconEl) iconEl.innerHTML = isError
            ? '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        toast.style.background = isError ? '#ef4444' : '#333';
        toast.classList.add('sfarc-show');

        // Hide after 2 seconds
        if (this._toastTimeout) clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.remove('sfarc-show');
        }, 2000);
    }


    async addRootObject(objectName) {
        if (!objectName) return;
        this.reset();
        this.rootObject = objectName;

        await this.addObjectCard(objectName, null, null, 0);
    }

    async addObjectCard(objectName, parentCardId, relationshipField, depth = 0) {
        const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 1. Fetch Metadata
        const metadata = await this.fetchObjectMetadata(objectName);
        if (!metadata) return;

        // 2. Store Data
        this.objects.set(cardId, {
            id: cardId,
            name: objectName,
            metadata: metadata,
            fields: new Set(), // Selected fields
            lookups: new Map(), // fieldName -> childCardId
            depth: depth,
            parentCardId: parentCardId, // Will be set if not root
            parentField: relationshipField,
            children: [] // Array of child cardIds
        });

        // Add to parent's children list
        if (parentCardId) {
            const parentObj = this.objects.get(parentCardId);
            if (parentObj) {
                parentObj.children.push(cardId);
            }
        }

        // 3. Render Node
        this.renderNode(cardId);

        // 4. Select the new node
        this.selectNode(cardId);

        // 5. Update Layout
        this.updateLayout();

        return cardId;
    }

    renderNode(cardId) {
        const obj = this.objects.get(cardId);
        const container = document.getElementById('sfarc-canvas-content');

        const node = document.createElement('div');
        node.className = `sfarc-node sfarc-node-depth-${(obj.depth || 0) % 5}`;
        node.id = `node-${cardId}`;

        // Vertical layout for compactness
        let content = `<div class="sfarc-node-icon" style="flex-shrink: 0;">${obj.depth || 0}</div>
        <div style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; width: 100%; overflow: hidden;">
            <span style="font-size: 12px; font-weight: 500;" title="${window.escapeHtml(obj.metadata.label)}">${window.escapeHtml(obj.metadata.label)}</span>`;

        if (obj.parentField) {
            content += `<span class="sfarc-node-badge" title="${window.escapeHtml(obj.parentField)}" style="margin-left: 0; margin-top: 2px; font-size: 9px; opacity: 0.9;">${window.escapeHtml(obj.parentField)}</span>`;
        }

        content += `</div>`;

        node.innerHTML = content;

        node.addEventListener('click', () => this.selectNode(cardId));

        container.appendChild(node);
    }

    selectNode(cardId) {
        // Update sfarc-active state
        document.querySelectorAll('.sfarc-node').forEach(n => n.classList.remove('sfarc-active'));
        const node = document.getElementById(`node-${cardId}`);
        if (node) node.classList.add('sfarc-active');

        this.renderDetails(cardId);
    }

    renderDetails(cardId) {
        const obj = this.objects.get(cardId);
        const container = document.getElementById('sfarc-details-body');
        container.innerHTML = '';

        // Get color class based on depth for styling
        const colorClass = `sfarc-node-depth-${(obj.depth || 0) % 5}`;

        // Create Sticky Wrapper
        const stickyWrapper = document.createElement('div');
        stickyWrapper.className = 'sfarc-details-sticky-header';
        container.appendChild(stickyWrapper);

        const header = document.createElement('div');
        header.className = 'sfarc-builder-card-header';
        header.innerHTML = `
        <div class="sfarc-details-header-content">
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1px;">
                <h3 class="${colorClass}" style="margin: 0; font-size: 15px; font-weight: 500; line-height:1.2;">${window.escapeHtml(obj.metadata.label)}</h3>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 13px; opacity: 0.7; font-weight: 400;">${window.escapeHtml(obj.metadata.name)}</span>
                    ${obj.parentCardId ? `<span class="sfarc-node-badge" style="margin-left:0;">Ref: ${window.escapeHtml(obj.parentField)}</span>` : `<span class="sfarc-builder-card-badge primary">Primary Object</span>`}
                </div>
            </div>
            <button class="sfarc-builder-card-close" data-card-id="${cardId}">&times;</button>
        </div>
    `;
        stickyWrapper.appendChild(header);

        // Add close listener
        header.querySelector('.sfarc-builder-card-close').addEventListener('click', (e) => {
            const targetCardId = e.target.dataset.cardId;
            this.removeCard(targetCardId);
        });

        // Tab Header
        const tabs = document.createElement('div');
        tabs.className = 'sfarc-details-tabs';
        tabs.innerHTML = `
        <button class="sfarc-details-tab" data-tab="required">Required</button>
        <button class="sfarc-details-tab" data-tab="optional">All Fields</button>
        <button class="sfarc-details-tab sfarc-active" data-tab="relations">Related</button>
    `;
        stickyWrapper.appendChild(tabs);

        // Field Search Input
        const searchContainer = document.createElement('div');
        searchContainer.style.padding = '0'; // Let CSS handle margins
        searchContainer.innerHTML = `
            <input type="text" class="sfarc-field-search-input" placeholder="Search fields...">
        `;
        stickyWrapper.appendChild(searchContainer);

        // Search Logic
        searchContainer.querySelector('input').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const fields = container.querySelectorAll('.sfarc-builder-field-item');
            fields.forEach(f => {
                const text = f.textContent.toLowerCase();
                // We use toggle(force) instead of style.display to play nice with other logic if any?
                // Actually style.display is safest here.
                f.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });

        // Render Field Containers
        const createTabContent = (id, className) => {
            const content = document.createElement('div');
            content.id = id;
            content.className = `sfarc-tab-content ${className} sfarc-builder-field-list`;
            if (id === 'tab-relations') content.classList.add('sfarc-active'); // Default to Related
            container.appendChild(content);
            return content;
        };

        const reqContainer = createTabContent('tab-required', 'required-fields');
        const optContainer = createTabContent('tab-optional', 'optional-fields');
        const relContainer = createTabContent('tab-relations', 'relationship-fields');

        // Tab Logic
        tabs.querySelectorAll('.sfarc-details-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Reset
                tabs.querySelectorAll('.sfarc-details-tab').forEach(t => t.classList.remove('sfarc-active'));
                container.querySelectorAll('.sfarc-tab-content').forEach(c => c.classList.remove('sfarc-active'));

                // Activate
                tab.classList.add('sfarc-active');
                const targetId = `tab-${tab.dataset.tab}`;
                document.getElementById(targetId).classList.add('sfarc-active');
            });
        });

        this.populateFields(cardId, obj.metadata, reqContainer, optContainer, relContainer);
    }

    async fetchObjectMetadata(objectName) {
        try {
            // Use Describe API
            const response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/sobjects/${objectName}/describe`);

            // Parse JSON from response
            const result = await response.json();

            // Log the result to see what we're getting
            console.debug('Metadata result for', objectName, ':', result);

            // Check if result has fields
            if (!result || !result.fields) {
                console.error('Metadata missing fields array:', result);
                throw new Error('Invalid metadata response - missing fields array');
            }

            return result;
        } catch (e) {
            console.error(`Error describing ${objectName}:`, e);
            toast.error(`Failed to fetch metadata for ${objectName}: ${e.message}`);
            return null;
        }
    }

    populateFields(cardId, metadata, reqContainer, optContainer, relContainer) {
        const objectData = this.objects.get(cardId);

        // Add null check for metadata and fields
        if (!metadata || !metadata.fields || !Array.isArray(metadata.fields)) {
            console.error('Invalid metadata or missing fields array:', metadata);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'sfarc-empty-state-builder';
            errorDiv.innerHTML = '<p>Error loading fields. Please try again.</p>';
            reqContainer.appendChild(errorDiv);
            return;
        }

        metadata.fields.forEach(field => {
            // Skip system fields
            if (!field.createable) return;

            const isRequired = !field.nillable && !field.defaultedOnCreate;
            const isLookup = field.type === 'reference';

            const div = document.createElement('div');
            div.className = 'sfarc-builder-field-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${cardId}-${field.name}`;
            checkbox.value = field.name;
            checkbox.dataset.type = field.type;

            // Check if already selected
            if (objectData.fields.has(field.name) || (isRequired && !objectData.fields.has(field.name))) {
                if (isRequired) {
                    checkbox.checked = true;
                    checkbox.disabled = true;
                    objectData.fields.add(field.name);
                } else if (objectData.fields.has(field.name)) {
                    checkbox.checked = true;
                }
            }

            const label = document.createElement('label');
            label.htmlFor = `${cardId}-${field.name}`;
            label.textContent = `${field.label} (${field.name})`;
            label.style.flex = '1';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';

            // Add expand icon for lookups
            if (isLookup) {
                const icon = document.createElement('span');
                icon.innerHTML = ' &#x2197;'; // Arrow
                icon.style.cursor = 'pointer';
                icon.title = 'Expand Node';
                label.appendChild(icon);
            }

            // Type Icon Logic (SVG)
            const getTypeIcon = (t) => {
                const lower = t.toLowerCase();
                // SVGs (24x24 viewBox, will shrink to fit)
                const textIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`; // Type T
                const numIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>`; // Hash
                const boolIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`; // Check
                const dateIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; // Calendar
                const refIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`; // Link
                const pickIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`; // List

                if (lower === 'boolean') return boolIcon;
                if (['double', 'int', 'currency', 'percent', 'integer'].includes(lower)) return numIcon;
                if (['date', 'datetime', 'time'].includes(lower)) return dateIcon;
                if (['reference', 'id'].includes(lower)) return refIcon;
                if (['picklist', 'multipicklist'].includes(lower)) return pickIcon;
                return textIcon; // Default
            };

            const typeBadge = document.createElement('span');
            typeBadge.className = 'sfarc-field-type-badge';
            typeBadge.innerHTML = getTypeIcon(field.type);
            typeBadge.title = field.type;

            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(typeBadge);

            if (isLookup) {
                relContainer.appendChild(div);

                // Handle Lookup Selection
                checkbox.addEventListener('change', async (e) => {
                    if (e.target.checked) {
                        objectData.fields.add(field.name);
                        // Add child card
                        if (field.referenceTo && field.referenceTo.length > 0) {
                            const targetObject = field.referenceTo[0]; // Take first for now
                            // Use Relationship Name if available, otherwise Field Name
                            const relationshipLabel = field.relationshipName || field.name;
                            const childCardId = await this.addObjectCard(targetObject, cardId, relationshipLabel, (objectData.depth || 0) + 1);
                            if (childCardId) {
                                objectData.lookups.set(field.name, childCardId);
                                this.updateLayout();
                                this.drawConnections();
                            }
                        }
                    } else {
                        objectData.fields.delete(field.name);
                        const childCardId = objectData.lookups.get(field.name);
                        if (childCardId) {
                            this.removeCard(childCardId);
                            objectData.lookups.delete(field.name);
                        }
                    }
                });
            } else if (isRequired) {
                reqContainer.appendChild(div);
            } else {
                optContainer.appendChild(div);
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) objectData.fields.add(field.name);
                    else objectData.fields.delete(field.name);
                });
            }
        });
    }

    removeCard(cardId) {
        // Remove Node from canvas
        const node = document.getElementById(`node-${cardId}`);
        if (node) node.remove();

        // Remove children recursively
        const obj = this.objects.get(cardId);
        if (obj) {
            // Remove from parent's children list
            if (obj.parentCardId) {
                const parentObj = this.objects.get(obj.parentCardId);
                if (parentObj) {
                    parentObj.children = parentObj.children.filter(childId => childId !== cardId);
                    // Also remove from parent's lookups map
                    for (const [fieldName, childLookupId] of parentObj.lookups.entries()) {
                        if (childLookupId === cardId) {
                            parentObj.lookups.delete(fieldName);
                            // Uncheck the corresponding checkbox in the parent's details panel
                            const parentCheckbox = document.getElementById(`${obj.parentCardId}-${obj.parentField}`);
                            if (parentCheckbox) {
                                parentCheckbox.checked = false;
                            }
                            break;
                        }
                    }
                }
            }

            // Recursively remove children
            obj.children.forEach(childId => this.removeCard(childId));
        }

        this.objects.delete(cardId);

        // If this was the selected node, clear details
        const detailsHeader = document.querySelector('.sfarc-details-header-content h3');
        if (detailsHeader && detailsHeader.textContent.includes(obj?.name)) {
            document.getElementById('sfarc-details-body').innerHTML = '<div class="sfarc-empty-state-builder"><p>Select a node to view details.</p></div>';
        }

        this.updateLayout();
        this.drawConnections();
    }

    reset() {
        this.objects.clear();
        this.rootObject = null;
        document.getElementById('sfarc-canvas-content').innerHTML = `
            <svg id="sfarc-builder-connections" class="sfarc-builder-connections"></svg>
        `;
        document.getElementById('sfarc-details-body').innerHTML = `
            <div class="sfarc-empty-state-builder">
                <p>Select an object to start building your test data graph.</p>
            </div>
        `;
        document.getElementById('sfarc-builder-code').textContent = '// Code will appear here';
        this.toggleSidebar(false);
        this.updateLayout(); // Clear layout
        this.drawConnections(); // Clear connections
    }

    generateCode() {
        if (this.objects.size === 0) {
            this.showToast('Please select an object to generate the code.', true);
            return;
        }

        let code = '';

        // Process cards in reverse DOM order (Children first)
        // Since we don't have DOM cards anymore, we need to traverse the tree post-order

        const visited = new Set();
        this.varCounters = {}; // Reset counters for new generation run
        const generate = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const obj = this.objects.get(nodeId);
            if (!obj) return;

            // Process children first
            // Process children first
            obj.lookups.forEach(childId => generate(childId));

            // Variable Naming Strategy
            const prefixes = {
                'Account': 'acc',
                'Contact': 'con',
                'Opportunity': 'opp',
                'Lead': 'lead',
                'Case': 'case',
                'Task': 'task',
                'Event': 'evt',
                'User': 'u',
                'Product2': 'prod',
                'Pricebook2': 'pb',
                'Order': 'ord',
                'Quote': 'quote',
                'Contract': 'contr',
                'Campaign': 'camp',
                'Asset': 'asset'
            };

            const prefix = prefixes[obj.name] || obj.name.toLowerCase().substring(0, 3).replace('__c', '');

            // Ensure unique variable name
            if (!this.varCounters) this.varCounters = {};
            if (!this.varCounters[prefix]) this.varCounters[prefix] = 0;
            this.varCounters[prefix]++;

            const count = this.varCounters[prefix];
            const suffix = count > 1 ? count : '';
            const varName = `${prefix}Test${suffix}`;

            obj.varName = varName;

            code += `${obj.name} ${varName} = new ${obj.name}(\n`;

            const assignments = [];
            obj.fields.forEach(fieldName => {
                const field = obj.metadata.fields.find(f => f.name === fieldName);
                let value = 'null';

                if (obj.lookups.has(fieldName)) {
                    const childId = obj.lookups.get(fieldName);
                    const childObj = this.objects.get(childId);
                    if (childObj && childObj.varName) {
                        value = `${childObj.varName}.Id`;
                    }
                } else if (field.type === 'string' || field.type === 'textarea') value = `'Test ${fieldName}'`;
                else if (field.type === 'email') value = `'test@example.com'`;
                else if (field.type === 'boolean') value = 'false';
                else if (field.type === 'integer' || field.type === 'double') value = '1';
                else if (field.type === 'date') value = 'Date.today()';
                else if (field.type === 'datetime') value = 'DateTime.now()';
                else if (field.type === 'picklist') value = `'${field.picklistValues[0]?.value || ''}'`;

                assignments.push(`    ${fieldName} = ${value}`);
            });

            code += assignments.join(',\n');
            code += `\n);\ninsert ${varName};\n\n`;
        };

        // Find roots
        const roots = Array.from(this.objects.values()).filter(o => !o.parentCardId);
        roots.forEach(root => generate(root.id));

        // Split code into lines for animation
        const lines = code.split('\n');
        const animatedHtml = lines.map((line, index) => {
            // Calculate delay: Consistent 30ms per line for "streaming" type effect
            // Removed cap to ensure full top-to-bottom flow
            const delay = index * 0.03;
            // Syntax Highlight (and Escape)
            // Pass raw line to highlighter, which will handle escaping content while adding span tags
            const highlighted = this.highlightSyntax(line);
            // Use non-breaking space for empty lines to maintain height
            const content = highlighted || '&nbsp;';
            return `<div class="sfarc-code-line" style="animation-delay: ${delay}s">${content}</div>`;
        }).join('');

        const codeContainer = document.getElementById('sfarc-builder-code');
        codeContainer.innerHTML = animatedHtml;

        // Reset scroll to top
        codeContainer.scrollTop = 0;
        this.toggleSidebar(true);
    }

    highlightSyntax(line) {
        if (!line) return '';

        // Helper to escape HTML chars
        const escapeHtml = (text) => {
            return text.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        let s = line;

        // 1. Protect Strings
        const strings = [];
        s = s.replace(/'[^']*'/g, (match) => {
            strings.push(match); // Push raw string including quotes
            return `__STR${strings.length - 1}__`;
        });

        // 2. Escape the remaining code structure (keywords/types/punctuation) 
        // We escape NOW so that when we add <span class="..."> later, we don't escape the span tags.
        s = escapeHtml(s);

        // 3. Highlight Keywords
        s = s.replace(/\b(new|insert|null|false|true)\b/g, '<span class="sfarc-code-keyword">$1</span>');

        // 4. Highlight Numbers
        s = s.replace(/\b\d+\b/g, '<span class="sfarc-code-number">$&</span>');

        // 5. Highlight Types (Capitalized words)
        // Only if they aren't followed by something weird (basic heuristic)
        // Since we already escaped, matching [A-Z] is safe for our basic types
        s = s.replace(/\b[A-Z]\w*\b/g, '<span class="sfarc-code-type">$&</span>');

        // 6. Restore Strings and Highlight them + Escape their content
        s = s.replace(/__STR(\d+)__/g, (match, i) => {
            const rawString = strings[i];
            const escapedStringContent = escapeHtml(rawString);
            return `<span class="sfarc-code-string">${escapedStringContent}</span>`;
        });

        return s;
    }

    toggleSidebar(show) {
        const sidebar = document.getElementById('sfarc-builder-sidebar');
        if (show) sidebar.classList.add('open');
        else sidebar.classList.remove('open');
    }

    updateLayout() {
        // Simple Tree Layout
        // 1. Build Hierarchy Tree
        // We have a flat map of objects. We need to traverse from root.
        if (this.objects.size === 0) {
            // Clear canvas content if no objects
            document.getElementById('sfarc-canvas-content').innerHTML = `
                <svg id="sfarc-builder-connections" class="sfarc-builder-connections"></svg>
                <div class="sfarc-empty-state-builder">
                    <p>Select an object to start building your test data graph.</p>
                </div>
            `;
            return;
        }

        // Find root card(s) - usually just one
        const roots = Array.from(this.objects.values()).filter(o => !o.parentCardId);

        // Remove empty state if it exists
        const emptyState = document.querySelector('#sfarc-canvas-content .sfarc-empty-state-builder');
        if (emptyState) {
            emptyState.remove();
        }

        // Calculate positions
        const levelHeight = 100;
        const siblingGap = 20; // Tight gap
        const nodeWidth = 140; // match CSS width (120) + gap buffer for safety
        const nodeHeight = 60; // Approx fixed height

        let maxCanvasWidth = 0;
        let maxCanvasHeight = 0;

        const layoutNode = (nodeId, level, startX) => {
            const obj = this.objects.get(nodeId);
            const children = obj.children.map(childId => this.objects.get(childId)).filter(Boolean);

            let myWidth = nodeWidth;
            let childrenWidth = 0;

            const childPositions = [];
            let currentX = startX;

            children.forEach(childObj => {
                const childResult = layoutNode(childObj.id, level + 1, currentX);
                childPositions.push(childResult);
                currentX += childResult.width + siblingGap;
                childrenWidth += childResult.width + siblingGap;
            });

            if (childrenWidth > 0) childrenWidth -= siblingGap; // Remove last gap
            myWidth = Math.max(nodeWidth, childrenWidth);

            // My X is centered over children, or just startX if no children
            let centerPoint = 0;
            if (children.length > 0) {
                const firstChild = childPositions[0];
                const lastChild = childPositions[childPositions.length - 1];
                // firstChild.x is the center of the first child
                // lastChild.x is the center of the last child
                centerPoint = (firstChild.x + lastChild.x) / 2;
            } else {
                // If no children, center it within its allocated width
                // startX is the left edge of the allocated space
                // myWidth is the allocated width
                centerPoint = startX + (myWidth / 2);
            }

            // Apply position
            const nodeEl = document.getElementById(`node-${nodeId}`);
            if (nodeEl) {
                const top = level * levelHeight + 50;
                nodeEl.style.top = `${top}px`;
                nodeEl.style.left = `${centerPoint}px`; // Center it (transform handles -50%)

                // Store layout info for connections
                const obj = this.objects.get(nodeId);
                if (obj) {
                    obj._layout = { x: centerPoint, y: top };
                }

                maxCanvasWidth = Math.max(maxCanvasWidth, centerPoint + (nodeWidth / 2) + 50); // Add padding
                maxCanvasHeight = Math.max(maxCanvasHeight, top + nodeHeight + 50); // Add padding
            }

            // Return the center position for parent calculations
            // We return 'x' as the center point now
            return { id: nodeId, width: myWidth, x: centerPoint };
        };

        let currentRootX = 50;
        roots.forEach(root => {
            const res = layoutNode(root.id, 0, currentRootX);
            currentRootX += res.width + siblingGap;
        });

        // Update canvas content size
        const content = document.getElementById('sfarc-canvas-content');
        content.style.width = `${Math.max(content.offsetWidth, maxCanvasWidth)}px`;
        content.style.height = `${Math.max(content.offsetHeight, maxCanvasHeight)}px`;

        // Wait for DOM update
        requestAnimationFrame(() => {
            this.drawConnections();
        });
    }

    drawConnections() {
        const svg = document.getElementById('sfarc-builder-connections');
        const container = document.getElementById('sfarc-canvas-content');
        if (!svg || !container) return;

        // Clear existing lines
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }

        // Clear existing HTML labels
        const existingLabels = container.querySelectorAll('.sfarc-connection-label');
        existingLabels.forEach(el => el.remove());

        this.objects.forEach(obj => {
            if (!obj.parentCardId) return;

            const childObj = this.objects.get(obj.id);
            const parentObj = this.objects.get(obj.parentCardId);

            if (!childObj || !parentObj || !childObj._layout || !parentObj._layout) return;

            const childNode = document.getElementById(`node-${obj.id}`);
            const parentNode = document.getElementById(`node-${obj.parentCardId}`);

            // Use stored layout coordinates (Source of Truth)
            // These are relative to the container content (0,0)

            // Start: Child Node Top Center
            const startX = childObj._layout.x;
            const startY = childObj._layout.y;

            // End: Parent Node Bottom Center
            const endX = parentObj._layout.x;
            // For bottom, we add the actual rendered height
            const endY = parentObj._layout.y + (parentNode ? parentNode.offsetHeight : 60);

            // Draw Curve
            const cp1x = startX;
            const cp1y = startY - 40;
            const cp2x = endX;
            const cp2y = endY + 40;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            path.setAttribute('d', d);
            path.setAttribute('class', `sfarc-connection-line sfarc-connection-depth-${(obj.depth - 1) % 6}`);

            svg.appendChild(path);

            // Add Relationship Label (HTML)
            // Position near the CHILD node (t=0.2)
            // Bezier cubic formula: B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
            // P0=(startX, startY), P1=(cp1x, cp1y), P2=(cp2x, cp2y), P3=(endX, endY)
            const t = 0.2;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = t * t;
            const t3 = t2 * t;

            const labelX = (mt3 * startX) + (3 * mt2 * t * cp1x) + (3 * mt * t2 * cp2x) + (t3 * endX);
            const labelY = (mt3 * startY) + (3 * mt2 * t * cp1y) + (3 * mt * t2 * cp2y) + (t3 * endY);

            const labelDiv = document.createElement('div');
            labelDiv.className = `sfarc-connection-label sfarc-connection-depth-${(obj.depth - 1) % 6}`;
            labelDiv.textContent = obj.parentField;
            labelDiv.style.left = `${labelX}px`;
            labelDiv.style.top = `${labelY}px`;

            container.appendChild(labelDiv);
        });

        // Update SVG size
        svg.style.height = `${container.scrollHeight}px`;
        svg.style.width = `${container.scrollWidth}px`;
    }
}
window.TestDataBuilder = TestDataBuilder;
} // end idempotency guard

// Initialize if on standalone page
if (document.getElementById('sfarc-data-builder-container') && window.TestDataBuilder) {
    window.testDataBuilder = new window.TestDataBuilder();
    window.testDataBuilder.init('sfarc-data-builder-container');
}
