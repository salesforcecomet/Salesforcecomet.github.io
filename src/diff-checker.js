// Cross-platform Diff Checker powered by the bundled Monaco Editor.
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const container = $('diff-editor-container');
    const loading = $('diff-loading');
    const stats = $('diff-stats');
    const controls = Array.from(document.querySelectorAll('.toolbar button, .toolbar select, .toolbar input'));
    let diffEditor = null;
    let originalModel = null;
    let modifiedModel = null;
    let saveTimer = 0;
    let isSideBySide = true;

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const normalizeWindowsText = (value) => String(value || '').replace(/\r\n?/g, '\n');
    const setReady = (ready) => controls.forEach(control => { control.disabled = !ready; });
    const showError = (message) => {
        if (loading) loading.innerHTML = `<div class="diff-error"><strong>Diff editor could not start.</strong><br>${escapeHtml(message)}<br>Reload the extension and try again.</div>`;
        stats.textContent = 'Editor unavailable';
    };

    // Use an extension-origin worker. Relative and blob worker URLs are a common
    // source of blank Monaco panes on Windows Chrome and managed browsers.
    try {
        const workerUrl = new URL('monaco-stub-worker.js', document.baseURI).href;
        window.MonacoEnvironment = { getWorker: () => new Worker(workerUrl) };
    } catch (_) { /* Plaintext rendering can continue without language workers. */ }

    const updateStats = () => {
        if (!diffEditor) return;
        const changes = diffEditor.getLineChanges() || [];
        let added = 0;
        let removed = 0;
        changes.forEach(change => {
            if (change.modifiedEndLineNumber > 0) added += change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
            if (change.originalEndLineNumber > 0) removed += change.originalEndLineNumber - change.originalStartLineNumber + 1;
        });
        stats.innerHTML = `<span class="added">+${added}</span> <span class="removed">−${removed}</span> · ${changes.length} changed ${changes.length === 1 ? 'block' : 'blocks'}`;
    };

    const saveDraft = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem('sfarc_diff_checker_draft', JSON.stringify({
                    original: originalModel?.getValue() || '',
                    modified: modifiedModel?.getValue() || '',
                    language: $('language-select').value,
                    ignoreTrimWhitespace: $('ignore-whitespace').checked
                }));
            } catch (_) { /* Storage can be unavailable in managed browsers. */ }
        }, 250);
    };
    const restoreDraft = () => {
        try { return JSON.parse(localStorage.getItem('sfarc_diff_checker_draft') || '{}'); }
        catch (_) { return {}; }
    };
    const applyLanguage = () => {
        if (!originalModel || !modifiedModel) return;
        const language = $('language-select').value || 'plaintext';
        monaco.editor.setModelLanguage(originalModel, language);
        monaco.editor.setModelLanguage(modifiedModel, language);
        saveDraft();
    };
    const readFileInto = (input, model) => {
        const file = input.files?.[0];
        if (!file || !model) return;
        const reader = new FileReader();
        reader.onload = () => {
            model.setValue(normalizeWindowsText(reader.result));
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const languages = { cls: 'java', trigger: 'java', js: 'javascript', json: 'json', html: 'html', htm: 'html', xml: 'xml', css: 'css', txt: 'plaintext', md: 'plaintext' };
            if (languages[ext]) {
                $('language-select').value = languages[ext];
                applyLanguage();
            }
            input.value = '';
        };
        reader.onerror = () => { stats.textContent = `Could not read ${file.name}`; };
        reader.readAsText(file);
    };

    // Keep AMD modules on the document's own extension origin. Using
    // chrome.runtime.getURL here can produce a stale/different UUID after an
    // unpacked-extension reload, which violates script-src 'self'.
    const vsPath = '../lib/monaco-editor/min/vs';
    if (!window.require || !window.require.config) {
        showError('The bundled Monaco loader was not found.');
        return;
    }
    require.config({ paths: { vs: vsPath } });
    require(['vs/editor/editor.main'], () => {
        try {
            monaco.editor.defineTheme('sfarc-dark', {
                base: 'vs-dark', inherit: true, rules: [], colors: {
                    'editor.background': '#1e1e1e',
                    'diffEditor.insertedTextBackground': '#2ea04326',
                    'diffEditor.removedTextBackground': '#f8514926'
                }
            });
            const draft = restoreDraft();
            $('language-select').value = draft.language || 'plaintext';
            $('ignore-whitespace').checked = draft.ignoreTrimWhitespace !== false;
            originalModel = monaco.editor.createModel(normalizeWindowsText(draft.original), $('language-select').value);
            modifiedModel = monaco.editor.createModel(normalizeWindowsText(draft.modified), $('language-select').value);
            diffEditor = monaco.editor.createDiffEditor(container, {
                theme: 'sfarc-dark', automaticLayout: true, originalEditable: true,
                renderSideBySide: true, ignoreTrimWhitespace: $('ignore-whitespace').checked,
                renderIndicators: true, renderOverviewRuler: true, enableSplitViewResizing: true,
                minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on',
                scrollbar: { vertical: 'visible', horizontal: 'visible', alwaysConsumeMouseWheel: false }
            });
            diffEditor.setModel({ original: originalModel, modified: modifiedModel });
            originalModel.onDidChangeContent(saveDraft);
            modifiedModel.onDidChangeContent(saveDraft);
            diffEditor.onDidUpdateDiff?.(updateStats);
            loading?.remove();
            setReady(true);
            updateStats();
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => diffEditor?.layout());
                resizeObserver.observe(container);
            }
        } catch (error) { showError(error?.message || String(error)); }
    }, error => showError(error?.message || 'Monaco modules failed to load.'));

    $('compare-btn').addEventListener('click', () => { diffEditor?.layout(); updateStats(); diffEditor?.getModifiedEditor().focus(); });
    $('view-btn').addEventListener('click', () => {
        if (!diffEditor) return;
        isSideBySide = !isSideBySide;
        diffEditor.updateOptions({ renderSideBySide: isSideBySide });
        $('view-btn').textContent = isSideBySide ? 'INLINE VIEW' : 'SIDE BY SIDE';
    });
    $('clear-btn').addEventListener('click', () => { originalModel?.setValue(''); modifiedModel?.setValue(''); });
    $('swap-btn').addEventListener('click', () => {
        if (!originalModel || !modifiedModel) return;
        const left = originalModel.getValue();
        originalModel.setValue(modifiedModel.getValue());
        modifiedModel.setValue(left);
    });
    $('copy-left-right-btn').addEventListener('click', () => modifiedModel?.setValue(originalModel?.getValue() || ''));
    $('copy-right-left-btn').addEventListener('click', () => originalModel?.setValue(modifiedModel?.getValue() || ''));
    $('load-left-btn').addEventListener('click', () => $('left-file-input').click());
    $('load-right-btn').addEventListener('click', () => $('right-file-input').click());
    $('left-file-input').addEventListener('change', () => readFileInto($('left-file-input'), originalModel));
    $('right-file-input').addEventListener('change', () => readFileInto($('right-file-input'), modifiedModel));
    $('language-select').addEventListener('change', applyLanguage);
    $('ignore-whitespace').addEventListener('change', () => {
        diffEditor?.updateOptions({ ignoreTrimWhitespace: $('ignore-whitespace').checked });
        saveDraft();
    });
    $('prev-change-btn').addEventListener('click', () => diffEditor?.goToDiff?.('previous'));
    $('next-change-btn').addEventListener('click', () => diffEditor?.goToDiff?.('next'));
    document.addEventListener('keydown', event => {
        if (event.key === 'F7') { event.preventDefault(); diffEditor?.goToDiff?.(event.shiftKey ? 'previous' : 'next'); }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('compare-btn').click(); }
    });
    window.addEventListener('resize', () => diffEditor?.layout());
});
