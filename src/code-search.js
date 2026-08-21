// code-search.js
window.initCodeSearch = function() {
    // Only initialize once
    const container = document.getElementById('sfarc-code-search-container');
    if (!container) return;
    if (container.innerHTML !== '') return;
    
    // Inject HTML
    container.innerHTML = `
        <style>
            .sfarc-code-file-item:hover { background: rgba(0, 0, 0, 0.02); }
            body[data-theme="dark"] .sfarc-code-file-item:hover { background: rgba(255, 255, 255, 0.02); }
            .sfarc-code-match-item:hover,
            body[data-theme="dark"] .sfarc-code-match-item:hover { background: #2d2d2d !important; }
            .sfarc-view-code-btn:hover { background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1) !important; }
            
            .sfarc-code-drawer-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 2147483647 !important;
                display: none;
                align-items: flex-end;
                justify-content: center;
                backdrop-filter: blur(2px);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .sfarc-code-drawer {
                width: 80%;
                height: 90%;
                background: #1e1e1e;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .sfarc-code-drawer.open {
                transform: translateY(0);
            }
            .sfarc-code-drawer-overlay.open {
                opacity: 1;
            }
        </style>
        <div style="display: flex; height: 100%; min-height: 0; width: 100%; max-width: 100%; box-sizing: border-box; position: relative; overflow: hidden;">
            <!-- Main Pane -->
            <div style="flex: 1; min-width: 0; width: 100%; max-width: 100%; display: flex; flex-direction: column; background: var(--sfarc-body-bg); min-height: 0; box-sizing: border-box; overflow: hidden;">
                <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--sfarc-border); background: var(--sfarc-bg); flex-shrink: 0;">
                    <i class="fa-solid fa-magnifying-glass" style="color: var(--primary-color, var(--sfarc-accent, #2196f3)); font-size: 12px;"></i>
                    <span style="font-weight: 500; font-size: 13px; color: var(--sfarc-text, #1e293b);">Code Search Results</span>
                    <span id="sfarc-code-search-count" style="display: none; background: rgba(var(--primary-color-rgb, 33, 150, 243), 0.1); color: var(--primary-color, var(--sfarc-accent, #2196f3)); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap;"></span>
                </div>
                <div id="sfarc-code-search-results" style="flex: 1; min-width: 0; width: 100%; max-width: 100%; overflow-y: auto; overflow-x: hidden; padding: 10px 0; min-height: 0; box-sizing: border-box;">
                    <div style="color: var(--sfarc-secondary-text); text-align: center; margin-top: 20px; padding: 0 20px;">
                        Type a keyword in the global search above and hit Enter.
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append Drawer to document.body to ensure it takes up the full browser screen and breaks out of modal constraints
    if (!document.getElementById('sfarc-code-drawer-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sfarc-code-drawer-overlay';
        overlay.className = 'sfarc-code-drawer-overlay';
        overlay.onclick = function() { window.closeCodeSearchDrawer(); };
        overlay.innerHTML = `
            <div class="sfarc-code-drawer" tabindex="-1">
                <!-- Header -->
                <div id="sfarc-code-drawer-header" style="padding: 12px 20px; background: #252526; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                        <div id="sfarc-code-drawer-title" style="color: #fff; font-weight: 500; font-size: 14px; min-width: max-content;"></div>
                        <!-- In-Drawer Search -->
                        <div style="position: relative; max-width: 300px; width: 100%;">
                            <i class="fa-solid fa-search" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #858585; font-size: 11px;"></i>
                            <input type="text" id="sfarc-drawer-search-input" placeholder="Search in file (Cmd+F)..." style="width: 100%; background: #3c3c3c; border: 1px solid #3c3c3c; color: #cccccc; padding: 4px 8px 4px 26px; border-radius: 4px; font-size: 12px; outline: none;">
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button id="sfarc-code-drawer-copy-btn" title="Copy Code" style="background: transparent; border: 1px solid #4daafc; color: #4daafc; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                        <button id="sfarc-code-drawer-download-btn" title="Download File" style="background: transparent; border: 1px solid #4daafc; color: #4daafc; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-download"></i> Download
                        </button>
                        <button id="sfarc-code-drawer-editor-btn" title="Open this file in the Comet Code Editor" style="background: transparent; border: 1px solid #4daafc; color: #4daafc; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-code"></i> Open in Editor
                        </button>
                        <button class="sfarc-code-close-btn" style="background: transparent; border: none; color: #a9a9a9; cursor: pointer; font-size: 16px; padding: 4px; display: flex; align-items: center; justify-content: center; margin-left: 8px;">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
                <!-- Viewer -->
                <div id="sfarc-code-search-viewer" style="flex: 1; overflow-y: auto; overflow-x: auto; padding: 10px 0; background: #1e1e1e; color: #d4d4d4; font-family: 'SF Mono', Consolas, 'Courier New', monospace; font-size: 13px; line-height: 20px; white-space: pre; min-height: 0;">
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.sfarc-code-close-btn').onclick = function() {
            if (typeof window.closeCodeSearchDrawer === 'function') {
                window.closeCodeSearchDrawer();
            }
        };

        const drawerElement = overlay.querySelector('.sfarc-code-drawer');
        if (drawerElement) {
            drawerElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
        
        // Copy Button
        document.getElementById('sfarc-code-drawer-copy-btn').onclick = function() {
            if (window.sfarcCurrentCodeFile && window.sfarcCurrentCodeFile.body) {
                navigator.clipboard.writeText(window.sfarcCurrentCodeFile.body);
                const btn = this;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                btn.style.color = '#4ec9b0';
                btn.style.borderColor = '#4ec9b0';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.color = '#4daafc';
                    btn.style.borderColor = '#4daafc';
                }, 2000);
            }
        };
        
        // Download Button
        document.getElementById('sfarc-code-drawer-download-btn').onclick = function() {
            if (window.sfarcCurrentCodeFile && window.sfarcCurrentCodeFile.body) {
                const ext = window.sfarcCurrentCodeFile.type === 'ApexClass' ? '.cls' : window.sfarcCurrentCodeFile.type === 'ApexTrigger' ? '.trigger' : '.page';
                const blob = new Blob([window.sfarcCurrentCodeFile.body], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = window.sfarcCurrentCodeFile.name + ext;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        };

        // Open in Code Editor: deep-links the file into the Comet code editor
        // (replaces the old "Setup" link, which just navigated to the matching
        // Salesforce Setup record page).
        document.getElementById('sfarc-code-drawer-editor-btn').onclick = async function() {
            const file = window.sfarcCurrentCodeFile;
            if (!file) return;
            const params = sfarcCodeDrawerEditorParams(file);
            if (!params) return;
            // Make sure the editor can authenticate before the new tab opens.
            try {
                if (typeof window.storeSessionForEditor === 'function') {
                    await window.storeSessionForEditor();
                }
            } catch (e) {
                console.warn('Could not pre-store session for code editor:', e);
            }
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'code-editor', params: params });
        };
        
        // In-Drawer Search (Debounced)
        let searchTimeout;
        const searchInput = document.getElementById('sfarc-drawer-search-input');
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (window.sfarcCurrentCodeIndex !== undefined) {
                    window.renderCodeSearchViewer(window.sfarcCurrentCodeIndex, this.value, null, true);
                }
            }, 300);
        });
        
        // Cmd+F shortcut inside drawer
        overlay.querySelector('.sfarc-code-drawer').addEventListener('keydown', function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('sfarc-drawer-search-input').focus();
            }
            if (e.key === 'Escape') {
                window.closeCodeSearchDrawer();
            }
        });
    }

    window.openCodeSearchDrawer = function() {
        const overlay = document.getElementById('sfarc-code-drawer-overlay');
        const drawer = overlay.querySelector('.sfarc-code-drawer');
        overlay.style.display = 'flex';
        // force reflow
        void overlay.offsetWidth;
        overlay.classList.add('open');
        drawer.classList.add('open');
        drawer.focus(); // Focus the drawer so it can catch keyboard events
    };
    
    window.closeCodeSearchDrawer = function() {
        const overlay = document.getElementById('sfarc-code-drawer-overlay');
        const drawer = overlay.querySelector('.sfarc-code-drawer');
        overlay.classList.remove('open');
        drawer.classList.remove('open');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    };

    // Add event delegation for click handlers instead of inline onclick to prevent CSP errors
    const resultsContainer = document.getElementById('sfarc-code-search-results');
    resultsContainer.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action="view-code"]');
        if (target) {
            const index = target.getAttribute('data-index');
            const line = target.getAttribute('data-line');
            const keyword = window.sfarcLastCodeSearchKeyword || '';
            if (index !== null) {
                window.renderCodeSearchViewer(parseInt(index), keyword, line ? parseInt(line) : null);
            }
            e.stopPropagation();
        }
    });
};

function updateCodeSearchCount(files, totalMatches) {
    const badge = document.getElementById('sfarc-code-search-count');
    if (!badge) return;
    if (!files || files.length === 0) {
        badge.style.display = 'none';
        return;
    }
    const m = totalMatches !== undefined ? ` \u00b7 ${totalMatches} match${totalMatches !== 1 ? 'es' : ''}` : '';
    badge.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}${m}`;
    badge.style.display = 'inline-block';
}

window.executeCodeSearch = async function(keyword) {
    window.sfarcLastCodeSearchKeyword = keyword;
    if (!keyword || keyword.length < 2) return;
    updateCodeSearchCount(null);
    const resultsContainer = document.getElementById('sfarc-code-search-results');
    resultsContainer.innerHTML = '<div style="text-align:center; margin-top: 20px;"><span class="comet-loader-inline"></span> Searching Org...</div>';
    
    try {
        // Step 1: SOSL Search & LWC Tooling Search
        const safeKeyword = keyword.replace(/'/g, "\\'");
        const sosl = `FIND {${safeKeyword}} IN ALL FIELDS RETURNING ApexClass(Id, Name), ApexTrigger(Id, Name), ApexPage(Id, Name)`;
        const lwcSoql = `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName LIKE '%${safeKeyword}%' OR MasterLabel LIKE '%${safeKeyword}%'`;
        
        const [searchResult, lwcResult] = await Promise.all([
            window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/v60.0/search?q=${encodeURIComponent(sosl)}`).then(r => r.json()),
            window.sfApi.query(lwcSoql, true)
        ]);
        
        const records = searchResult?.searchRecords || [];
        const lwcBundles = lwcResult?.records || [];
        
        if (records.length === 0 && lwcBundles.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align:center; margin-top: 20px; color: var(--sfarc-secondary-text);">No matches found.</div>';
            updateCodeSearchCount(null);
            return;
        }

        const grouped = { ApexClass: [], ApexTrigger: [], ApexPage: [] };
        
        records.forEach(r => {
            if (grouped[r.attributes.type]) {
                grouped[r.attributes.type].push(r);
            }
        });
        
        let allMatches = [];
        resultsContainer.innerHTML = '<div style="text-align:center; margin-top: 20px;"><span class="comet-loader-inline"></span> Fetching matched files...</div>';
        
        // Step 2: Fetch Bodies
        const fetchBodies = async (type, field) => {
            if (grouped[type].length > 0) {
                const ids = grouped[type].map(r => `'${r.Id}'`).join(',');
                const q = `SELECT Id, Name, ${field} FROM ${type} WHERE Id IN (${ids})`;
                const res = await window.sfApi.query(q, true);
                if (res && res.records) {
                    res.records.forEach(r => {
                        const matches = findMatchesInText(r[field], keyword);
                        if (matches.length > 0) {
                            allMatches.push({ type: type, name: r.Name, id: r.Id, body: r[field], matches });
                        }
                    });
                }
            }
        };

        await Promise.all([
            fetchBodies('ApexClass', 'Body'),
            fetchBodies('ApexTrigger', 'Body'),
            fetchBodies('ApexPage', 'Markup')
        ]);
        
        if (lwcBundles.length > 0) {
            const bundleIds = lwcBundles.map(b => `'${b.Id}'`).join(',');
            const lwcResourceSoql = `SELECT Id, FilePath, Source, LightningComponentBundle.DeveloperName FROM LightningComponentResource WHERE LightningComponentBundleId IN (${bundleIds})`;
            const lwcResourcesRes = await window.sfApi.query(lwcResourceSoql, true);
            if (lwcResourcesRes && lwcResourcesRes.records) {
                lwcResourcesRes.records.forEach(r => {
                    if (r.Source) {
                        let matches = findMatchesInText(r.Source, keyword);
                        if (matches.length === 0) {
                            // If the bundle name matched but the source doesn't contain the keyword, show line 1 so the user can still open the file
                            matches = [{ lineNumber: 1, content: (r.Source ? r.Source.split('\n')[0] : "") }];
                        }
                        const fileName = r.FilePath ? r.FilePath.split('/').pop() : r.Id;
                        allMatches.push({
                            type: 'LightningComponentResource',
                            name: `${r.LightningComponentBundle.DeveloperName} / ${fileName}`,
                            id: r.Id,
                            bundleId: r.LightningComponentBundleId,
                            body: r.Source,
                            matches: matches
                        });
                    }
                });
            }
        }
        
        // Step 3: Render Results
        window.sfarcCodeSearchMatches = allMatches;
        
        if (allMatches.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align:center; margin-top: 20px; color: var(--sfarc-secondary-text);">No exact code matches found in matched files.</div>';
            updateCodeSearchCount(null);
            return;
        }
        
        updateCodeSearchCount(allMatches, allMatches.reduce((n, f) => n + (f.matches ? f.matches.length : 0), 0));
        
        let html = '';
        allMatches.forEach((file, index) => {
            let icon = 'fa-file-code';
            if (file.type === 'ApexClass') icon = 'fa-file-code';
            if (file.type === 'ApexTrigger') icon = 'fa-bolt';
            if (file.type === 'ApexPage') icon = 'fa-file-lines';
            if (file.type === 'LightningComponentResource') icon = 'fa-cubes';
            
            let typeLabel = file.type;
            if (file.type === 'ApexClass') typeLabel = 'Apex Class';
            else if (file.type === 'ApexTrigger') typeLabel = 'Apex Trigger';
            else if (file.type === 'ApexPage') typeLabel = 'Visualforce Page';
            else if (file.type === 'LightningComponentResource') typeLabel = 'Lightning Web Component';

            let matchesHtml = '';
            file.matches.forEach(match => {
                let rawContent = match.content !== undefined ? match.content : (match.text !== undefined ? match.text : "");
                let snippet = String(rawContent || "").replace(/\r/g, ""); 
                
                // Trim leading whitespace for cleaner display
                snippet = snippet.trimStart();
                
                // Escape HTML first to prevent XSS and rendering issues
                snippet = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // VS Code Style Syntax Highlighting
                // 1. Strings: '...'
                snippet = snippet.replace(/('[^']*')/g, '<span style="color: #ce9178;">$1</span>');
                // 2. Comments: // ...
                snippet = snippet.replace(/(\/\/.*)/g, '<span style="color: #6a9955;">$1</span>');
                // 3. Keywords
                const keywords = ['public', 'private', 'protected', 'global', 'class', 'static', 'final', 'void', 'return', 'if', 'else', 'for', 'while', 'new', 'try', 'catch', 'throw', 'throws', 'interface', 'extends', 'implements', 'this', 'super', 'null', 'true', 'false', 'trigger', 'after', 'before', 'insert', 'update', 'delete', 'undelete', 'import', 'export', 'default', 'const', 'let', 'var', 'async', 'await', 'function', 'constructor', 'from', 'get', 'set'];
                const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b(?![^<]*>)`, 'g');
                snippet = snippet.replace(keywordRegex, '<span style="color: #569cd6;">$1</span>');
                // 4. Types (Words starting with Uppercase)
                const typeRegex = /\b([A-Z][a-zA-Z0-9_]*)\b(?![^<]*>)/g;
                snippet = snippet.replace(typeRegex, '<span style="color: #4ec9b0;">$1</span>');
                // 5. Method calls
                const methodRegex = /\b([a-z][a-zA-Z0-9_]*)(?=\s*\()(?![^<]*>)/g;
                snippet = snippet.replace(methodRegex, '<span style="color: #dcdcaa;">$1</span>');
                // 6. Numbers
                const numRegex = /\b(\d+)\b(?![^<]*>)/g;
                snippet = snippet.replace(numRegex, '<span style="color: #b5cea8;">$1</span>');
                
                // Highlight search keyword
                let escapedKeyword = keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                let highlightRegex = new RegExp(`(${escapedKeyword})(?![^<]*>)`, 'gi');
                snippet = snippet.replace(highlightRegex, '<span class="sfarc-code-search-highlight">$1</span>');

                matchesHtml += `<div class="sfarc-code-match-item" data-action="view-code" data-index="${index}" data-line="${match.lineNumber}"><span class="sfarc-code-line-number">${match.lineNumber}</span><span class="sfarc-code-match-text">${snippet}</span></div>`;
            });

            html += `
                <div class="sfarc-code-file-item" data-action="view-code" data-index="${index}" style="padding: 10px 16px; border-bottom: 1px solid var(--sfarc-border); cursor: pointer; box-sizing: border-box; width: 100%; max-width: 100%; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; width: 100%; box-sizing: border-box;">
                        <!-- Left: icon + name + type -->
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; overflow: hidden;">
                            <i class="fa-solid ${icon}" style="color: var(--primary-color); font-size: 13px; width: 14px; text-align: center; flex-shrink: 0;"></i>
                            <div style="min-width: 0; flex: 1; overflow: hidden;">
                                <div style="font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--sfarc-text, #1e293b);">${sfarcEscapeHtml(file.name)}</div>
                                <div style="font-size: 11px; color: var(--sfarc-secondary-text, #64748b); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${typeLabel}</div>
                            </div>
                        </div>
                        <!-- Right: match count badge + view button -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto;">
                            <span style="font-size: 11px; font-weight: 500; color: var(--primary-color, var(--sfarc-accent, #2196f3)); background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.12); padding: 3px 8px; border-radius: 10px; white-space: nowrap; display: inline-block;">${file.matches.length} match${file.matches.length !== 1 ? 'es' : ''}</span>
                            <button type="button" class="sfarc-view-code-btn" data-action="view-code" data-index="${index}" style="background: transparent; border: 1px solid var(--sfarc-border, #cbd5e1); color: var(--primary-color, var(--sfarc-accent, #2196f3)); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px 10px; border-radius: 4px; font-size: 11px; gap: 4px; white-space: nowrap; font-weight: 500;" title="View Full Code">
                                <i class="fa-solid fa-expand"></i> View
                            </button>
                        </div>
                    </div>
                    <!-- Code match lines with horizontal scroll -->
                    <div style="display: block; max-height: 160px; overflow-y: auto; overflow-x: auto; width: 100%; max-width: 100%; border-radius: 6px; box-sizing: border-box;">
                        ${matchesHtml}
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML = `<div style="text-align:center; margin-top: 20px; color: #ff5b5b;">Search failed: ${window.escapeHtml(e.message)}</div>`;
    }
};

function findMatchesInText(text, keyword) {
    if (!text || typeof text !== "string") return [];
    const cleanText = text.replace(/\r/g, ""); // Fix carriage returns
    const lines = cleanText.split("\n");
    const matches = [];
    const lowerKeyword = (keyword || "").toLowerCase();
    
    lines.forEach((line, index) => {
        if (lowerKeyword && line.toLowerCase().includes(lowerKeyword)) {
            matches.push({
                lineNumber: index + 1,
                content: line
            });
        }
    });
    return matches;
}

// ---------------------------------------------------------------------------
// Code viewer rendering helpers (hoisted out of renderCodeSearchViewer — the
// old per-line closure re-created the tokenizer regex and escape helper for
// every line of every render; a 10k-line file recompiled them 10k+ times).
// ---------------------------------------------------------------------------
const SFARC_CODE_TOKENIZER_RE = /('[^']*')|(\/\/.*)|([a-zA-Z_]\w*(?=\s*\())|\b(return|if|else|for|while|do|try|catch|finally|throw|break|continue)\b|\b(public|private|protected|global|class|interface|enum|static|void|with|without|sharing|override|virtual|abstract|new|this|super|null|true|false)\b|\b([A-Z][a-zA-Z0-9_]*)\b|\b(\d+)\b/g;
const SFARC_CODE_CHUNK = 2000;

function sfarcEscapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sfarcEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sfarcTokenizePart(part) {
    if (!part || part.charAt(0) === '<') return part;
    return part.replace(SFARC_CODE_TOKENIZER_RE, (match, str, comment, method, control, kw, type, number) => {
        if (str) return `<span style="color: #ce9178;">${str}</span>`;
        if (comment) return `<span style="color: #6a9955;">${comment}</span>`;
        if (method) return `<span style="color: #dcdcaa;">${method}</span>`;
        if (control) return `<span style="color: #c586c0;">${control}</span>`;
        if (kw) return `<span style="color: #569cd6;">${kw}</span>`;
        if (type) return `<span style="color: #4ec9b0;">${type}</span>`;
        if (number) return `<span style="color: #b5cea8;">${number}</span>`;
        return match;
    });
}

function sfarcBuildCodeLineHtml(line, lineNum, keyword, keywordRegex) {
    let displayLine = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isMatch = keyword && displayLine.toLowerCase().includes(keyword.toLowerCase());

    // 1. Highlight the actual search keyword!
    if (isMatch && keywordRegex) {
        displayLine = displayLine.replace(keywordRegex, '<mark style="background: rgba(255, 215, 0, 0.4); color: #fff; padding: 2px 0; border-radius: 2px; box-shadow: 0 0 0 1px rgba(255, 215, 0, 0.5);">$1</mark>');
    }

    // 2. VS Code style syntax highlighting via tokenizer (only on non-tag parts)
    const parts = displayLine.split(/(<[^>]+>)/g);
    displayLine = parts.map(part => sfarcTokenizePart(part)).join('');

    // Use string concatenation here instead of template literal to avoid inserting physical newlines and tabs!
    return '<div id="sfarc-code-line-' + lineNum + '" style="display: flex; ' + (isMatch ? 'background: rgba(255,255,255,0.08); border-left: 3px solid #4daafc; padding-left: 7px;' : 'padding-left: 10px;') + ' margin: 0; min-height: 20px;">' +
                '<div style="width: 45px; text-align: right; padding-right: 15px; color: #6e7681; user-select: none;">' + lineNum + '</div>' +
                '<div style="flex: 1;">' + displayLine + '</div>' +
            '</div>';
}

function sfarcCodeMoreRowHtml(label) {
    return '<div class="sfarc-code-more" style="text-align:center; padding:8px 12px; cursor:pointer; font-size:12px; font-weight:500; color:#4daafc; user-select:none;">' + label + '</div>';
}

// Resolves the code-editor deep-link params for a code-search result file.
// ApexClass → Apex, ApexTrigger → Trigger, ApexPage → Visualforce page,
// LightningComponentResource → its LWC bundle. Returns null for unknown types.
function sfarcCodeDrawerEditorParams(file) {
    if (!file) return null;
    if (file.type === 'ApexClass') return { apexId: file.id, apexName: file.name, type: 'apex' };
    if (file.type === 'ApexTrigger') return { triggerId: file.id, triggerName: file.name, type: 'trigger' };
    if (file.type === 'ApexPage') return { pageId: file.id, pageName: file.name, type: 'vfpage' };
    if (file.type === 'LightningComponentResource') {
        // file.name is "DeveloperName / fileName" — the bundle name is the part before " / ".
        const bundleName = String(file.name || '').split(' / ')[0] || file.name;
        return { bundleId: file.bundleId, bundleName: bundleName, type: 'lwc' };
    }
    return null;
}
window.sfarcCodeDrawerEditorParams = sfarcCodeDrawerEditorParams;

// State for the chunked full-file view. Only SFARC_CODE_CHUNK lines live in the
// DOM at once; a "Show more" row appends the next chunk.
var sfarcCodeFullState = null;

function sfarcCodeAppendChunk() {
    const st = sfarcCodeFullState;
    if (!st) return;
    const end = Math.min(st.shown + SFARC_CODE_CHUNK, st.total);
    let html = '';
    for (let i = st.shown; i < end; i++) {
        html += sfarcBuildCodeLineHtml(st.lines[i], i + 1, st.keyword, st.keywordRegex);
    }
    st.shown = end;
    // Never leave a stale "Show more" row behind.
    const prevMore = st.viewer.querySelector('.sfarc-code-more');
    if (prevMore) prevMore.remove();
    st.viewer.insertAdjacentHTML('beforeend', html);
    if (st.shown < st.total) {
        const remaining = st.total - st.shown;
        st.viewer.insertAdjacentHTML('beforeend', sfarcCodeMoreRowHtml(`Show ${Math.min(SFARC_CODE_CHUNK, remaining)} more lines (${remaining} remaining)`));
        const more = st.viewer.querySelector('.sfarc-code-more');
        if (more) more.onclick = () => sfarcCodeAppendChunk();
    }
}

function sfarcCodeRenderFullChunked(viewer, lines, keyword, keywordRegex, neededLine) {
    viewer.innerHTML = '';
    sfarcCodeFullState = { viewer, lines, keyword, keywordRegex, shown: 0, total: lines.length, needed: neededLine || 0 };
    // Render enough chunks that scroll targets (jump line / first match) exist.
    while (sfarcCodeFullState.shown < sfarcCodeFullState.needed && sfarcCodeFullState.shown < sfarcCodeFullState.total) {
        sfarcCodeAppendChunk();
    }
    if (sfarcCodeFullState.shown === 0) sfarcCodeAppendChunk();
}

window.renderCodeSearchViewer = function(fileIndex, keyword, targetLine = null, isLocalSearch = false) {
    const file = window.sfarcCodeSearchMatches[fileIndex];
    const viewer = document.getElementById('sfarc-code-search-viewer');
    
    if (!file) return;
    
    // Store globally for buttons
    window.sfarcCurrentCodeFile = file;
    window.sfarcCurrentCodeIndex = fileIndex;
    
    // Don't update the global search keyword if this is just an in-drawer search!
    if (!isLocalSearch && keyword) {
        const searchInput = document.getElementById('sfarc-drawer-search-input');
        if (searchInput) searchInput.value = keyword;
    }
    
    if (!file) return;
    
    // Update Header (the Open-in-Editor button resolves params from the file
    // on click, so there is no static URL to maintain here).
    document.getElementById('sfarc-code-drawer-title').textContent = file.name;
    
    const keywordRegex = keyword ? new RegExp(`(${sfarcEscapeRegExp(keyword)})`, 'gi') : null;
    const lines = file.body.replace(/\r/g, '').split('\n');

    // Which lines must be visible? Known match lines (file.matches + any line
    // that contains the in-drawer keyword) plus an explicit jump target.
    const priority = new Set();
    if (file.matches) {
        file.matches.forEach(m => priority.add(m.lineNumber));
    }
    if (targetLine) priority.add(targetLine);
    if (keyword) {
        const lower = keyword.toLowerCase();
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lower)) priority.add(i + 1);
        }
    }

    // Sparse matches → render only context windows around them (jump-to-match)
    // with a "Show all" fallback. Dense matches / no keyword → full file,
    // rendered in bounded chunks so a 10k-line file never builds 10k DOM rows.
    const sparse = priority.size > 0 && priority.size * 7 < lines.length;

    if (sparse) {
        const windowLines = new Set();
        priority.forEach(ln => {
            const start = Math.max(1, ln - 2);
            const endLine = Math.min(lines.length, ln + 2);
            for (let i = start; i <= endLine; i++) windowLines.add(i);
        });
        let html = '';
        for (let i = 1; i <= lines.length; i++) {
            if (windowLines.has(i)) html += sfarcBuildCodeLineHtml(lines[i - 1], i, keyword, keywordRegex);
        }
        const omitted = lines.length - windowLines.size;
        if (omitted > 0) {
            html += sfarcCodeMoreRowHtml(`Show all ${lines.length} lines (${omitted} omitted)`);
        }
        viewer.innerHTML = html;
        const more = viewer.querySelector('.sfarc-code-more');
        if (more) more.onclick = () => sfarcCodeRenderFullChunked(viewer, lines, keyword, keywordRegex);
    } else {
        let neededLine = 0;
        if (targetLine) neededLine = Math.max(neededLine, targetLine);
        if (file.matches && file.matches[0]) neededLine = Math.max(neededLine, file.matches[0].lineNumber);
        sfarcCodeRenderFullChunked(viewer, lines, keyword, keywordRegex, neededLine);
    }
    
    // Open drawer only if not local search
    if (!isLocalSearch) {
        window.openCodeSearchDrawer();
    }
    
    if (targetLine) {
        setTimeout(() => {
            const el = document.getElementById(`sfarc-code-line-${targetLine}`);
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
        }, 100);
    } else if (isLocalSearch && keyword && keyword.length >= 2) {
        // Scroll to the first local match
        setTimeout(() => {
            const firstMark = viewer.querySelector('mark');
            if (firstMark) {
                firstMark.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }, 100);
    } else if (!isLocalSearch && file.matches && file.matches.length > 0) {
        setTimeout(() => {
            const firstMatchEl = document.getElementById(`sfarc-code-line-${file.matches[0].lineNumber}`);
            if (firstMatchEl) {
                firstMatchEl.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }, 100);
    }
};
