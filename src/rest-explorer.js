// REST Console JavaScript
document.addEventListener('DOMContentLoaded', () => {
    if (typeof require !== 'undefined' && require.config) {
        const vsPath = '../lib/monaco-editor/min/vs';
        require.config({ paths: { 'vs': vsPath } });
    }

    // We must wait for Monaco to be loaded
    require(['vs/editor/editor.main'], async function () {
        if (monaco.languages && monaco.languages.typescript) {
            if (monaco.languages.typescript.javascriptDefaults) {
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                    noSuggestionDiagnostics: true
                });
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                    noLib: true,
                    allowNonTsExtensions: true
                });
            }
            if (monaco.languages.typescript.typescriptDefaults) {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                    noSuggestionDiagnostics: true
                });
                monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    noLib: true,
                    allowNonTsExtensions: true
                });
            }
        }

        // --- Elements ---
        const methodSelect = document.getElementById('method-select');
        const endpointInput = document.getElementById('endpoint-input');
        const instanceUrlPrefix = document.getElementById('instance-url-prefix');
        const btnSend = document.getElementById('btn-send');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        const resMeta = document.getElementById('res-meta');
        const resStatus = document.getElementById('res-status');
        const resHeadersGrid = document.getElementById('res-headers-grid');
        const reqHeadersGrid = document.getElementById('req-headers-grid');
        const btnAddHeader = document.getElementById('btn-add-header');
        
        const formatReqBtn = document.getElementById('format-req-btn');
        const copyResBtn = document.getElementById('copy-res-btn');

        const isDark = document.body.classList.contains('sfarc-dark-theme');

        // --- Monaco Editors ---
        const reqEditor = monaco.editor.create(document.getElementById('req-body-editor'), {
            value: "{\n    \n}",
            language: 'json',
            theme: isDark ? 'vs-dark' : 'vs',
            minimap: { enabled: false },
            automaticLayout: true,
            fontSize: 13,
            formatOnPaste: true
        });

        const resEditor = monaco.editor.create(document.getElementById('res-body-editor'), {
            value: "",
            language: 'json',
            theme: isDark ? 'vs-dark' : 'vs',
            minimap: { enabled: false },
            automaticLayout: true,
            fontSize: 13,
            readOnly: true
        });

        const changeFontSize = (delta) => {
            const currentFontSize = reqEditor.getOption(monaco.editor.EditorOption.fontSize);
            const newFontSize = Math.max(9, Math.min(36, currentFontSize + delta));
            reqEditor.updateOptions({ fontSize: newFontSize });
            resEditor.updateOptions({ fontSize: newFontSize });
        };

        reqEditor.onMouseWheel((e) => {
            if (e.browserEvent && e.browserEvent.ctrlKey) {
                e.browserEvent.preventDefault();
                e.browserEvent.stopPropagation();
                const delta = e.browserEvent.deltaY < 0 ? 1 : -1;
                changeFontSize(delta);
            }
        });

        resEditor.onMouseWheel((e) => {
            if (e.browserEvent && e.browserEvent.ctrlKey) {
                e.browserEvent.preventDefault();
                e.browserEvent.stopPropagation();
                const delta = e.browserEvent.deltaY < 0 ? 1 : -1;
                changeFontSize(delta);
            }
        });

        // --- Font toggle: monospace stack ⇄ Helvetica (persisted) ---
        const restMonoStack = "'Cascadia Code', Consolas, 'Courier New', monospace";
        let helveticaMode = false;
        try { helveticaMode = localStorage.getItem('sfarc_rest_font') === 'helvetica'; } catch (e) {}
        const applyRestFont = () => {
            const fam = helveticaMode ? 'Helvetica, Arial, sans-serif' : restMonoStack;
            reqEditor.updateOptions({ fontFamily: fam });
            resEditor.updateOptions({ fontFamily: fam });
        };
        const fontToggleBtn = document.getElementById('btn-font-toggle');
        if (fontToggleBtn) {
            fontToggleBtn.classList.toggle('sf-font-active', helveticaMode);
            fontToggleBtn.title = helveticaMode ? 'Editor font: Helvetica (click for Mono)' : 'Editor font: Mono (click for Helvetica)';
            fontToggleBtn.addEventListener('click', () => {
                helveticaMode = !helveticaMode;
                try { localStorage.setItem('sfarc_rest_font', helveticaMode ? 'helvetica' : 'mono'); } catch (e) {}
                fontToggleBtn.classList.toggle('sf-font-active', helveticaMode);
                fontToggleBtn.title = helveticaMode ? 'Editor font: Helvetica (click for Mono)' : 'Editor font: Mono (click for Helvetica)';
                applyRestFont();
            });
        }
        applyRestFont();

        // --- Tabs Logic ---
        document.querySelectorAll('.pane-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetId = tab.getAttribute('data-target');
                if (!targetId) return;

                // Remove active from siblings
                const parent = tab.closest('.pane-tabs');
                parent.querySelectorAll('.pane-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Hide all sections in this pane
                const contentPane = tab.closest('.split-pane').querySelector('.pane-content');
                contentPane.querySelectorAll('.pane-section').forEach(s => s.classList.remove('active'));
                
                // Show target
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
            });
        });

        // --- Headers Logic ---
        function createHeaderRow(key = '', val = '') {
            const row = document.createElement('div');
            row.className = 'header-row';
            row.innerHTML = `
                <input type="text" class="header-input header-key" value="${key}" placeholder="Key">
                <input type="text" class="header-input header-val" value="${val}" placeholder="Value">
                <button class="header-remove"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.header-remove').addEventListener('click', () => {
                row.remove();
            });
            return row;
        }

        btnAddHeader.addEventListener('click', () => {
            reqHeadersGrid.appendChild(createHeaderRow());
        });

        // Bind existing remove buttons
        document.querySelectorAll('.header-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.currentTarget.closest('.header-row').remove();
            });
        });

        function getCustomHeaders() {
            const headers = {};
            reqHeadersGrid.querySelectorAll('.header-row').forEach(row => {
                const key = row.querySelector('.header-key').value.trim();
                const val = row.querySelector('.header-val').value.trim();
                if (key) {
                    headers[key] = val;
                }
            });
            return headers;
        }

        // --- API Setup ---
        const api = window.sfApi;
        try {
            const session = await api.init();
            if (session && session.instanceUrl) {
                instanceUrlPrefix.textContent = session.instanceUrl;
            }
        } catch (e) {
            console.error('API Init failed', e);
            instanceUrlPrefix.textContent = "Salesforce Disconnected";
        }

        // --- Send Request ---
        async function sendRequest() {
            const method = methodSelect.value;
            let endpoint = endpointInput.value.trim();
            let body = null;
            let rawBody = reqEditor.getValue().trim();

            if (['POST', 'PATCH', 'PUT'].includes(method)) {
                if (rawBody && rawBody !== '{}' && rawBody !== '{\n    \n}') {
                    try {
                        body = JSON.parse(rawBody);
                    } catch (e) {
                        toast.error('Invalid JSON in request body');
                        return;
                    }
                }
            }

            loading.style.display = 'flex';
            emptyState.style.display = 'none';
            resMeta.style.display = 'none';
            resEditor.setValue('Executing request...');
            resHeadersGrid.innerHTML = '<div style="color: #888;">Fetching...</div>';

            // Switch response tab to body automatically
            document.querySelector('.pane-tab[data-target="res-body"]').click();

            try {
                const customHeaders = getCustomHeaders();
                
                // If the endpoint doesn't start with / and isn't a full URL, add /
                if (!endpoint.startsWith('/') && !endpoint.startsWith('http')) {
                    endpoint = '/' + endpoint;
                }

                const res = await api.fetch(endpoint, {
                    method: method,
                    headers: customHeaders,
                    body: body ? JSON.stringify(body) : undefined
                });

                // Update Status Badge
                const statusClass = res.ok ? 'status-success' : 'status-error';
                resStatus.className = `status-badge ${statusClass}`;
                resStatus.textContent = `${res.status} ${res.statusText}`;
                resMeta.style.display = 'flex';

                // Populate Response Headers
                resHeadersGrid.innerHTML = '';
                for (let [key, value] of res.headers.entries()) {
                    const row = document.createElement('div');
                    row.className = 'header-row';
                    row.innerHTML = `
                        <input type="text" class="header-input" value="${key}" readonly style="background: transparent; border-color: transparent;">
                        <input type="text" class="header-input" value="${value}" readonly>
                    `;
                    resHeadersGrid.appendChild(row);
                }

                // Populate Response Body
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    resEditor.setValue(JSON.stringify(json, null, 4));
                } catch (e) {
                    resEditor.setValue(text);
                }
            } catch (error) {
                resStatus.className = 'status-badge status-error';
                resStatus.textContent = 'Error';
                resMeta.style.display = 'flex';
                resEditor.setValue(error.message);
            } finally {
                loading.style.display = 'none';
            }
        }

        btnSend.addEventListener('click', sendRequest);

        // --- Shortcuts ---
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                sendRequest();
            }
        });

        formatReqBtn.addEventListener('click', () => {
            try {
                const json = JSON.parse(reqEditor.getValue());
                reqEditor.setValue(JSON.stringify(json, null, 4));
            } catch (e) {
                toast.error('Cannot format invalid JSON');
            }
        });

        copyResBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(resEditor.getValue()).then(() => {
                const icon = copyResBtn.querySelector('i');
                icon.className = 'fa-solid fa-check';
                setTimeout(() => {
                    icon.className = 'fa-solid fa-copy';
                }, 2000);
            });
        });
    });
});
