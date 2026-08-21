// Global Search - Flows, LWC, and Apex
let globalSearchCache = {
    flows: [],
    lwc: [],
    apex: [],
    lastUpdate: null
};

// Add global search capabilities to main search
async function enhancedGlobalSearch(query, options = { isCaseSensitive: false, isWholeWord: false, isRegex: false }) {
    if (!query || query.length < 2) return [];

    const results = {
        flows: [],
        lwc: [],
        apex: []
    };

    try {
        // Search Flows
        results.flows = await searchFlows(query, options);

        // Search LWC
        results.lwc = await searchLWC(query, options);

        // Search Apex (enhanced)
        results.apex = await searchApexCode(query, options);
    } catch (error) {
        console.error('Global search error:', error);
    }

    return results;
}

// Search Flows
async function searchFlows(query, options) {
    try {
        const lowerQuery = query.toLowerCase();

        // Query FlowDefinition for all flows
        const flowQuery = `
            SELECT Id, DeveloperName, MasterLabel, Description, ProcessType, 
                   ActiveVersionId, LatestVersionId, IsActive, NamespacePrefix
            FROM FlowDefinition
            WHERE DeveloperName LIKE '%${query}%' 
               OR MasterLabel LIKE '%${query}%'
            ORDER BY MasterLabel
            LIMIT 50
        `;

        const result = await window.sfApi.query(flowQuery, true); // Tooling API

        return (result.records || []).map(flow => ({
            id: flow.Id,
            name: flow.DeveloperName,
            label: flow.MasterLabel,
            description: flow.Description,
            type: flow.ProcessType,
            isActive: flow.IsActive,
            activeVersionId: flow.ActiveVersionId,
            namespace: flow.NamespacePrefix,
            category: 'Flow',
            url: `${window.location.origin}/lightning/setup/Flows/page?address=%2F${flow.ActiveVersionId || flow.LatestVersionId}`
        }));
    } catch (error) {
        console.error('Flow search error:', error);
        return [];
    }
}

// Search LWC
async function searchLWC(query, options) {
    try {
        const lowerQuery = query.toLowerCase();

        // Query LightningComponentBundle
        const lwcQuery = `
            SELECT Id, DeveloperName, Description, NamespacePrefix, ApiVersion,
                   IsExposed, MasterLabel
            FROM LightningComponentBundle
            WHERE DeveloperName LIKE '%${query}%' 
               OR MasterLabel LIKE '%${query}%'
            ORDER BY DeveloperName
            LIMIT 50
        `;

        const result = await window.sfApi.query(lwcQuery, true); // Tooling API

        return (result.records || []).map(lwc => ({
            id: lwc.Id,
            name: lwc.DeveloperName,
            label: lwc.MasterLabel || lwc.DeveloperName,
            description: lwc.Description,
            namespace: lwc.NamespacePrefix,
            apiVersion: lwc.ApiVersion,
            isExposed: lwc.IsExposed,
            category: 'LWC',
            url: `${window.location.origin}/lightning/setup/LightningComponentBundles/page?address=%2F${lwc.Id}`
        }));
    } catch (error) {
        console.error('LWC search error:', error);
        return [];
    }
}

// Enhanced Apex code search (full-text)
async function searchApexCode(query, options) {
    try {
        let results = [];

        // Escape SOSL query search term: ? & | ! [ ] { } ^ ~ * : \ " ' + - / ( )
        const escapedQuery = query.replace(/([\?\&\|!\(\)\[\]\{\}\^~\*\:\\\+'"\-\:\/])/g, '\\$1');
        
        // SOSL Query to find the query in all fields of ApexClass and ApexTrigger
        const sosl = `FIND {${escapedQuery}} IN ALL FIELDS RETURNING ApexClass(Id, Name, Body, ApiVersion, LengthWithoutComments), ApexTrigger(Id, Name, Body, ApiVersion, TableEnumOrId)`;
        
        const searchUrl = `/services/data/v60.0/tooling/search/?q=${encodeURIComponent(sosl)}`;
        const res = await window.sfApi.fetch(searchUrl);
        const searchResult = res ? await res.json() : null;

        if (searchResult && searchResult.searchRecords) {
            searchResult.searchRecords.forEach(record => {
                const isClass = record.attributes.type === 'ApexClass';
                const body = record.Body || '';
                const name = record.Name;
                const id = record.Id;
                
                // Find matching lines client-side in the retrieved body
                const lines = body.split('\n');
                const matchingLines = [];
                let regexFlags = options.isCaseSensitive ? 'g' : 'gi';
                let regexPattern = query;
                
                if (!options.isRegex) {
                    regexPattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }
                if (options.isWholeWord) {
                    regexPattern = `\\b${regexPattern}\\b`;
                }
                
                let searchRegex;
                try {
                    searchRegex = new RegExp(regexPattern, regexFlags);
                } catch (e) {
                    searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                }

                lines.forEach((line, index) => {
                    searchRegex.lastIndex = 0;
                    if (searchRegex.test(line)) {
                        matchingLines.push({
                            type: 'code',
                            line: index + 1,
                            content: line.trim().substring(0, 100)
                        });
                    }
                });

                if (matchingLines.length > 0) {
                    results.push({
                        id: id,
                        name: name,
                        type: isClass ? 'Class' : 'Trigger',
                        body: body,
                        matches: matchingLines.slice(0, 5), // Top 5 matches
                        category: 'Apex',
                        url: `${window.location.origin}/lightning/setup/${isClass ? 'ApexClasses' : 'ApexTriggers'}/page?address=%2F${id}`
                    });
                } else {
                    // Fallback to name match or a generic match line if body split was empty but SOSL returned a hit
                    results.push({
                        id: id,
                        name: name,
                        type: isClass ? 'Class' : 'Trigger',
                        body: body,
                        matches: [{ type: 'code', line: 1, content: 'Metadata match found in file header/definition' }],
                        category: 'Apex',
                        url: `${window.location.origin}/lightning/setup/${isClass ? 'ApexClasses' : 'ApexTriggers'}/page?address=%2F${id}`
                    });
                }
            });
        }

        // If SOSL is empty or fails, fall back to simple Name query
        if (results.length === 0) {
            let safeNameQuery = options.isRegex ? query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : query;
            const nameQuery = `
                SELECT Id, Name, Body, ApiVersion, LengthWithoutComments
                FROM ApexClass
                WHERE Name LIKE '%${safeNameQuery}%'
                ORDER BY Name
                LIMIT 15
            `;
            const classResult = await window.sfApi.query(nameQuery, true);
            (classResult.records || []).forEach(cls => {
                results.push({
                    id: cls.Id,
                    name: cls.Name,
                    type: 'Class',
                    body: cls.Body,
                    apiVersion: cls.ApiVersion,
                    lines: cls.LengthWithoutComments,
                    category: 'Apex',
                    matches: [{ type: 'code', line: 1, content: 'Class name matches search term' }],
                    url: `${window.location.origin}/lightning/setup/ApexClasses/page?address=%2F${cls.Id}`
                });
            });
        }

        return results;
    } catch (error) {
        console.error('Apex search error:', error);
        return [];
    }
}

// Render global search results in the sidebar
function renderGlobalSearchResults(results) {
    const tree = document.getElementById('search-results-tree');
    if (!tree) return;

    let html = '';
    let totalResults = 0;

    const createCategoryNode = (title, items, iconHtml) => {
        if (!items || items.length === 0) return '';
        totalResults += items.length;
        
        let categoryHtml = `
            <div class="tree-node" style="padding-left: 10px;">
                <i class="fa-solid fa-chevron-down tree-chevron"></i>
                <span style="font-weight: 500; color: #cccccc; font-size: 11px; text-transform: uppercase;">${title} (${items.length})</span>
            </div>
            <div class="tree-children" style="display: block;">
        `;

        items.forEach(item => {
            const hasMatches = item.matches && item.matches.some(m => m.type === 'code');
            const matchCount = hasMatches ? item.matches.filter(m => m.type === 'code').length : 0;
            
            categoryHtml += `
                <div class="tree-node search-result-node" data-id="${item.id}" data-type="${item.type || item.category || ''}" data-name="${item.name || item.label}" style="padding-left: 24px; color: #cccccc; font-size: 12.5px;">
                    ${iconHtml}
                    <span class="node-label" style="margin-left: 6px;">${escapeHtml(item.name || item.label)}</span>
                    ${matchCount > 0 ? `<span style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.2); color: var(--sfarc-accent-glow, #38bdf8); padding: 1px 6px; border-radius: 9px; font-size: 9px; margin-left: 6px;">${matchCount}</span>` : ''}
                </div>
            `;

            if (hasMatches) {
                categoryHtml += `<div style="padding-left: 42px; margin-bottom: 6px;">`;
                item.matches.filter(m => m.type === 'code').slice(0, 3).forEach(m => {
                    categoryHtml += `
                        <div class="search-match-line" style="font-family: 'Fira Code', monospace; font-size: 11px; color: #858585; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; padding: 2px 4px; border-radius: 3px;" data-id="${item.id}" data-type="${item.type}" data-name="${item.name || item.label || ''}" data-line="${m.line}">
                            <span style="color: #4ade80;">${m.line}:</span> ${escapeHtml(m.content)}
                        </div>
                    `;
                });
                categoryHtml += `</div>`;
            }
        });

        categoryHtml += `</div>`;
        return categoryHtml;
    };

    html += createCategoryNode('Apex Code', results.apex, '<i class="fa-solid fa-code" style="color: var(--sfarc-accent-glow, #38bdf8);"></i>');
    html += createCategoryNode('Lightning Web Components', results.lwc, '<i class="fa-brands fa-salesforce" style="color: #00a1e0;"></i>');
    html += createCategoryNode('Flows', results.flows, '<i class="fa-solid fa-project-diagram" style="color: #facc15;"></i>');

    if (totalResults === 0) {
        html = '<div style="padding: 10px; color: #858585; font-size: 12px; font-style: italic; text-align: center;">No results found.</div>';
    }

    tree.innerHTML = html;

    // Attach click listeners for file opening
    tree.querySelectorAll('.search-result-node').forEach(node => {
        node.addEventListener('click', () => {
            const id = node.dataset.id;
            const type = (node.dataset.type || '').toLowerCase();
            const name = node.dataset.name;
            
            // Expand/Collapse children if it has match lines
            const nextSib = node.nextElementSibling;
            if (nextSib && nextSib.tagName === 'DIV' && !nextSib.classList.contains('tree-node')) {
                nextSib.style.display = nextSib.style.display === 'none' ? 'block' : 'none';
            }

            if (type === 'class') {
                if (typeof window.loadApexAsset === 'function') window.loadApexAsset(id, name);
            } else if (type === 'trigger') {
                if (typeof window.loadApexTrigger === 'function') window.loadApexTrigger(id, name);
            } else if (type === 'lwc') {
                if (typeof window.loadLwcBundle === 'function') window.loadLwcBundle(id, name);
            }
        });
    });

    tree.querySelectorAll('.search-match-line').forEach(line => {
        line.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = line.dataset.id;
            const type = (line.dataset.type || '').toLowerCase();
            const name = line.dataset.name;
            const lineNum = parseInt(line.dataset.line);

            let openPromise = null;
            if (type === 'class') {
                if (typeof window.loadApexAsset === 'function') openPromise = window.loadApexAsset(id, name);
            } else if (type === 'trigger') {
                if (typeof window.loadApexTrigger === 'function') openPromise = window.loadApexTrigger(id, name);
            }

            if (openPromise && typeof openPromise.then === 'function') {
                openPromise.then(() => {
                    // Jump to line if editor is ready
                    setTimeout(() => {
                        if (window.editorInstance && window.monaco) {
                            window.editorInstance.revealLineInCenter(lineNum);
                            window.editorInstance.setPosition({ lineNumber: lineNum, column: 1 });
                            window.editorInstance.focus();
                        }
                    }, 500);
                });
            }
        });
        
        line.addEventListener('mouseenter', () => line.style.background = 'rgba(255,255,255,0.05)');
        line.addEventListener('mouseleave', () => line.style.background = 'transparent');
    });
}

// Hook up sidebar search input
function initCodeSearch() {
    const searchInput = document.getElementById('code-search-input');
    const searchTree = document.getElementById('search-results-tree');
    let debounceTimer;

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                if (searchTree) searchTree.innerHTML = '<div style="padding: 10px; color: #858585; font-size: 12px; font-style: italic; text-align: center;">Type to search org metadata</div>';
                return;
            }

            if (searchTree) searchTree.innerHTML = '<div style="padding: 10px; color: #858585; font-size: 12px; font-style: italic; text-align: center;"><span class="comet-loader-inline"></span> Searching...</div>';

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const optCase = document.getElementById('search-opt-case');
                const optWord = document.getElementById('search-opt-word');
                const optRegex = document.getElementById('search-opt-regex');
                
                const options = {
                    isCaseSensitive: optCase ? optCase.classList.contains('active') : false,
                    isWholeWord: optWord ? optWord.classList.contains('active') : false,
                    isRegex: optRegex ? optRegex.classList.contains('active') : false
                };

                const results = await enhancedGlobalSearch(query, options);
                renderGlobalSearchResults(results);
            }, 600);
        });
    }

    // Toggle options
    ['search-opt-case', 'search-opt-word', 'search-opt-regex'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                el.classList.toggle('active');
                if (searchInput && searchInput.value.length >= 2) {
                    searchInput.dispatchEvent(new Event('input'));
                }
            });
        }
    });

    // Toggle Replace Input
    const toggleReplaceBtn = document.getElementById('toggle-replace-btn');
    const replaceInputGroup = document.getElementById('replace-input-group');
    if (toggleReplaceBtn && replaceInputGroup) {
        toggleReplaceBtn.addEventListener('click', () => {
            const icon = toggleReplaceBtn.querySelector('i');
            if (replaceInputGroup.style.display === 'none') {
                replaceInputGroup.style.display = 'flex';
                icon.style.transform = 'rotate(90deg)';
            } else {
                replaceInputGroup.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeSearch);
} else {
    initCodeSearch();
}

// Add to global scope
window.enhancedGlobalSearch = enhancedGlobalSearch;
window.renderGlobalSearchResults = renderGlobalSearchResults;
