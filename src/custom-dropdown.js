// custom-dropdown.js

(function() {
    // Prevent multiple injections
    if (window.sfarcCustomDropdownsInitialized) return;
    window.sfarcCustomDropdownsInitialized = true;

    const CHECKMARK_SVG = `<svg class="sfarc-custom-dropdown-checkmark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const CHEVRON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    const SEARCH_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    function closeAllDropdowns() {
        document.querySelectorAll('.sfarc-custom-dropdown-container.sfarc-open').forEach(el => {
            el.classList.remove('sfarc-open');
        });
        document.querySelectorAll('.sfarc-custom-dropdown-menu.sfarc-menu-open').forEach(m => {
            m.classList.remove('sfarc-menu-open');
            m.style.opacity = '0';
            // Let the liquid shrink-back transition play before hiding the node.
            setTimeout(() => {
                if (!m.classList.contains('sfarc-menu-open')) {
                    m.style.display = 'none';
                    m.style.visibility = 'hidden';
                    m.style.pointerEvents = 'none';
                }
            }, 200);
        });
    }

    // Close all open dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target;
        // Guard: target might be an SVG element or Text node without .closest()
        if (typeof target.closest !== 'function') return;
        if (!target.closest('.sfarc-custom-dropdown-container') && !target.closest('.sfarc-custom-dropdown-menu')) {
            closeAllDropdowns();
        }
    });

    // Dropdown menus are teleported to document.body to escape overflow
    // clipping, which detaches them from the host page's theme scope (e.g.
    // #sfarc-panel.sfarc-dark-theme). Copy the dark-theme class onto the menu
    // itself so the .sfarc-dark-theme overrides in custom-dropdown.css keep
    // menus dark in dark mode regardless of where the menu lives in the DOM.
    function syncMenuTheme(menu, hostEl) {
        const themedAncestor = hostEl.closest ? hostEl.closest('.sfarc-dark-theme') : null;
        menu.classList.toggle('sfarc-dark-theme', !!themedAncestor);
    }

    function enhanceSelect(selectEl) {
        if (selectEl.hasAttribute('multiple')) return; // Skip multi-select for now
        // Opt-out: hosts that already style the native select mark it with data-custom-dropdown="off"
        if (selectEl.dataset.customDropdown === 'off') return;

        // If already processed and custom dropdown container is present right next to it, skip
        if (selectEl.classList.contains('sfarc-custom-processed') &&
            selectEl.nextElementSibling &&
            selectEl.nextElementSibling.classList.contains('sfarc-custom-dropdown-container')) {
            return;
        }

        // Remove any orphaned or existing custom dropdown containers in the same field wrapper
        if (selectEl.parentNode) {
            Array.from(selectEl.parentNode.children).forEach(child => {
                if (child.classList.contains('sfarc-custom-dropdown-container')) {
                    child.remove();
                }
            });
        }

        selectEl.classList.add('sfarc-custom-processed');
        selectEl.classList.add('sfarc-custom-dropdown-hidden-select');

        // Create Container
        const container = document.createElement('div');
        container.className = 'sfarc-custom-dropdown-container';
        
        // Inherit inline styles that affect layout
        if (selectEl.style.width) container.style.width = selectEl.style.width;
        if (selectEl.style.flex) container.style.flex = selectEl.style.flex;
        if (selectEl.style.flexShrink) container.style.flexShrink = selectEl.style.flexShrink;
        if (selectEl.style.flexGrow) container.style.flexGrow = selectEl.style.flexGrow;
        if (selectEl.style.minWidth) container.style.minWidth = selectEl.style.minWidth;
        if (selectEl.style.maxWidth) container.style.maxWidth = selectEl.style.maxWidth;

        // Copy classes from the select (except the hidden one) to the container to inherit positioning/margin
        Array.from(selectEl.classList).forEach(cls => {
            if (cls !== 'sfarc-custom-processed' && cls !== 'sfarc-custom-dropdown-hidden-select') {
                container.classList.add(cls);
            }
        });

        // Trigger Button
        const trigger = document.createElement('div');
        trigger.className = 'sfarc-custom-dropdown-trigger';
        if (selectEl.disabled) trigger.setAttribute('data-disabled', 'true');
        
        // Inherit height/padding if explicitly set
        if (selectEl.style.height) trigger.style.height = selectEl.style.height;
        if (selectEl.style.padding) trigger.style.padding = selectEl.style.padding;
        if (selectEl.style.fontSize) trigger.style.fontSize = selectEl.style.fontSize;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'sfarc-custom-dropdown-value';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'sfarc-custom-dropdown-icon';
        iconSpan.innerHTML = CHEVRON_SVG;

        trigger.appendChild(valueSpan);
        trigger.appendChild(iconSpan);

        // Menu
        const menu = document.createElement('div');
        menu.className = 'sfarc-custom-dropdown-menu';
        // Keep the menu's theme in sync with the host select's themed scope.
        syncMenuTheme(menu, selectEl);
        // Wide menus (e.g. data-export Templates) get a marker class so the
        // teleported menu keeps its widened size after it moves to <body>.
        if (selectEl.classList.contains('sfir-header-select')) {
            menu.classList.add('sfarc-custom-dropdown-menu-wide');
        }

        container.appendChild(trigger);

        // Insert container right after the select in the DOM
        selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

        let searchInput = null;

        function updateMenuPosition() {
            if (!container.classList.contains('sfarc-open')) return;

            const rect = trigger.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

            // Teleport menu to document.body to guarantee no parent overflow:hidden clips it
            if (menu.parentNode !== document.body) {
                document.body.appendChild(menu);
            }

            // Re-sync the theme class every open — the menu lives at <body>
            // level, so it must carry the page's dark-theme scope itself.
            syncMenuTheme(menu, selectEl);

            menu.style.position = 'fixed';
            menu.style.zIndex = '2147483647';
            const isWide = menu.classList.contains('sfarc-custom-dropdown-menu-wide');
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            let menuWidth = Math.max(rect.width, isWide ? 480 : 220);
            if (isWide) {
                // Size the menu to fit the widest option so long queries (e.g.
                // the data-export Templates list) don't need a horizontal
                // scrollbar. Text is measured with the option's real font so the
                // result is accurate even if the menu hasn't laid out yet.
                // Clamp to the viewport so it never overflows the screen.
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let widest = 0;
                menu.querySelectorAll('.sfarc-custom-dropdown-option').forEach(opt => {
                    const cs = getComputedStyle(opt);
                    ctx.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
                    const textEl = opt.querySelector('span');
                    const text = (textEl ? textEl.textContent : opt.textContent) || '';
                    // 13px checkmark + 28px left padding + 10px right padding + 6px breathing room
                    const w = ctx.measureText(text).width + 13 + 28 + 10 + 6;
                    if (w > widest) widest = w;
                });
                if (widest > 0) {
                    menuWidth = Math.max(menuWidth, widest + 16); // + menu padding (8px each side)
                }
                menuWidth = Math.min(menuWidth, viewportWidth - 16);
            }
            menu.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8))}px`;
            menu.style.width = `${menuWidth}px`;

            // Render the menu (kept invisible) so its REAL height can be
            // measured. scrollHeight is 0 while the menu is display:none, and
            // the old `|| 340` fallback over-estimated short menus — a 6-option
            // menu (~205px) was treated as 340px, so the pop-above check fired
            // too eagerly and the menu floated far up the viewport instead of
            // hugging the trigger. The hidden state is never painted (the open
            // class is applied after a forced reflow by the caller), so the
            // liquid-open transition still starts from the closed state.
            menu.style.display = 'flex';
            menu.style.flexDirection = 'column';
            menu.style.visibility = 'hidden';
            menu.style.opacity = '0';
            menu.style.pointerEvents = 'none';
            const menuHeight = Math.min(420, menu.scrollHeight || 340);

            // Check if popping down exceeds bottom of viewport
            if (rect.bottom + menuHeight + 8 > viewportHeight && rect.top > menuHeight + 8) {
                // Pop UP above the trigger — the liquid grows down from the trigger edge
                menu.style.top = `${Math.max(8, rect.top - menuHeight - 4)}px`;
                menu.style.transformOrigin = 'bottom center';
            } else {
                // Pop DOWN below the trigger — the liquid grows up from the trigger edge
                menu.style.top = `${rect.bottom + 4}px`;
                menu.style.transformOrigin = 'top center';
            }

            // Reveal the menu (same frame — the open transition is driven by
            // the .sfarc-menu-open class added right after this call).
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.pointerEvents = 'all';
        }

        function closeThisMenu() {
            container.classList.remove('sfarc-open');
            menu.classList.remove('sfarc-menu-open');
            menu.style.opacity = '0';
            // Let the liquid shrink-back transition play before hiding the node.
            setTimeout(() => {
                if (!container.classList.contains('sfarc-open')) {
                    menu.style.display = 'none';
                    menu.style.visibility = 'hidden';
                    menu.style.pointerEvents = 'none';
                }
            }, 200);
        }

        // Function to rebuild options
        const rebuildMenu = () => {
            menu.innerHTML = '';
            
            const isSearchable = selectEl.dataset.searchable === 'true' || selectEl.options.length > 8;
            
            if (isSearchable) {
                const searchWrap = document.createElement('div');
                searchWrap.className = 'sfarc-custom-dropdown-search';
                
                const searchIcon = document.createElement('span');
                searchIcon.className = 'sfarc-custom-dropdown-search-icon';
                searchIcon.innerHTML = SEARCH_SVG;
                
                searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.className = 'sfarc-custom-dropdown-search-input';
                searchInput.placeholder = selectEl.dataset.searchPlaceholder || 'Search...';
                
                searchWrap.appendChild(searchIcon);
                searchWrap.appendChild(searchInput);
                menu.appendChild(searchWrap);

                searchInput.addEventListener('input', (e) => {
                    renderOptions(e.target.value.toLowerCase());
                    updateMenuPosition();
                });
                
                searchInput.addEventListener('click', (e) => e.stopPropagation());
            } else {
                searchInput = null;
            }

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'sfarc-custom-dropdown-options';
            menu.appendChild(optionsContainer);

            const renderOptions = (filterText = '') => {
                optionsContainer.innerHTML = '';
                let selectedText = '';
                let shown = 0;

                Array.from(selectEl.options).forEach((opt) => {
                    const text = opt.text;
                    const val = opt.value;
                    const isSelected = opt.selected;

                    if (isSelected) {
                        selectedText = text;
                    }

                    if (opt.hidden) return; // Skip placeholders/hidden options

                    if (filterText && !text.toLowerCase().includes(filterText) && !val.toLowerCase().includes(filterText)) {
                        return;
                    }

                    shown++;
                    const optDiv = document.createElement('div');
                    optDiv.className = 'sfarc-custom-dropdown-option';
                    if (isSelected) optDiv.classList.add('sfarc-selected');

                    optDiv.innerHTML = `${CHECKMARK_SVG}<span>${text}</span>`;

                    optDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectEl.value = val;
                        
                        // Dispatch native events
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                        selectEl.dispatchEvent(new Event('input', { bubbles: true }));

                        closeThisMenu();

                        // Update UI
                        rebuildMenu();
                    });
                    
                    optionsContainer.appendChild(optDiv);
                });

                if (shown === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'sfarc-custom-dropdown-empty';
                    empty.textContent = 'No matches found';
                    optionsContainer.appendChild(empty);
                }

                // Update trigger text
                valueSpan.textContent = selectedText || (selectEl.options[0] ? selectEl.options[0].text : '');
            };

            renderOptions('');
            
            // Sync disabled state
            if (selectEl.disabled) {
                trigger.setAttribute('data-disabled', 'true');
            } else {
                trigger.removeAttribute('data-disabled');
            }
        };

        rebuildMenu();

        // Trigger Click Event
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectEl.disabled) return;
            
            const wasOpen = container.classList.contains('sfarc-open');
            closeAllDropdowns();

            if (!wasOpen) {
                container.classList.add('sfarc-open');
                updateMenuPosition();
                // Show the menu (display:flex) and force a reflow so the closed
                // liquid state is committed BEFORE the open class flips on —
                // otherwise the transition can start while the menu is still
                // display:none and the liquid motion is skipped.
                void menu.offsetHeight;
                menu.classList.add('sfarc-menu-open');
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 0);
                }
            }
        });

        // Reposition on scroll/resize
        window.addEventListener('scroll', () => {
            if (container.classList.contains('sfarc-open')) {
                updateMenuPosition();
            }
        }, true);

        window.addEventListener('resize', () => {
            if (container.classList.contains('sfarc-open')) {
                updateMenuPosition();
            }
        });

        // Watch for changes to the original select (e.g., options injected dynamically or value changed via JS)
        const observer = new MutationObserver((mutations) => {
            let needsRebuild = false;
            mutations.forEach(m => {
                if (m.type === 'childList' || (m.type === 'attributes' && (m.attributeName === 'disabled' || m.attributeName === 'value'))) {
                    needsRebuild = true;
                }
            });
            if (needsRebuild) rebuildMenu();
        });

        observer.observe(selectEl, { childList: true, attributes: true, subtree: true });
        
        // Also listen to 'change' event on original select in case it's changed by code without attributes mutating
        selectEl.addEventListener('change', () => {
            rebuildMenu();
        });
    }

    // Initialize all existing selects
    function initAll() {
        document.querySelectorAll('select').forEach(enhanceSelect);
    }

    // Watch for new selects added to the DOM dynamically
    const domObserver = new MutationObserver((mutations) => {
        let hasNewNodes = false;
        mutations.forEach(m => {
            if (m.addedNodes.length > 0) hasNewNodes = true;
        });
        
        if (hasNewNodes) {
            document.querySelectorAll('select:not(.sfarc-custom-processed)').forEach(enhanceSelect);
        }
    });

    // Start observing DOM when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAll();
            domObserver.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        initAll();
        domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Public API for hosts that inject selects after startup (e.g. the panel
    // injected by main.js). Idempotent — already-processed selects are skipped.
    window.sfarcEnhanceAllSelects = initAll;
    window.sfarcEnhanceSelect = enhanceSelect;

})();
