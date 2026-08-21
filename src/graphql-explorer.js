// GraphQL Explorer JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const queryEditor = document.getElementById('query-editor');
    const variablesEditor = document.getElementById('variables-editor');
    const sendBtn = document.getElementById('send-btn');
    const responseViewer = document.getElementById('response-viewer');
    const statusContainer = document.getElementById('status-container');
    const loading = document.getElementById('loading');

    // Initialize API
    const api = window.sfApi;

    // Font toggle: monospace stack ⇄ Helvetica (persisted). The three code
    // surfaces must share the family so layout stays consistent.
    const gqlFontEls = [queryEditor, variablesEditor, responseViewer].filter(Boolean);
    let gqlHelvetica = false;
    try { gqlHelvetica = localStorage.getItem('sfarc_gql_font') === 'helvetica'; } catch (e) {}
    const applyGqlFont = () => {
        const fam = gqlHelvetica ? 'Helvetica, Arial, sans-serif' : "'Cascadia Code', Consolas, monospace";
        gqlFontEls.forEach(el => { el.style.fontFamily = fam; });
    };
    const gqlFontBtn = document.getElementById('btn-gql-font-toggle');
    if (gqlFontBtn) {
        gqlFontBtn.classList.toggle('sf-font-active', gqlHelvetica);
        gqlFontBtn.title = gqlHelvetica ? 'Editor font: Helvetica (click for Mono)' : 'Editor font: Mono (click for Helvetica)';
        gqlFontBtn.addEventListener('click', () => {
            gqlHelvetica = !gqlHelvetica;
            try { localStorage.setItem('sfarc_gql_font', gqlHelvetica ? 'helvetica' : 'mono'); } catch (e) {}
            gqlFontBtn.classList.toggle('sf-font-active', gqlHelvetica);
            gqlFontBtn.title = gqlHelvetica ? 'Editor font: Helvetica (click for Mono)' : 'Editor font: Mono (click for Helvetica)';
            applyGqlFont();
        });
    }
    applyGqlFont();

    sendBtn.addEventListener('click', async () => {
        const query = queryEditor.value.trim();
        let variables = {};

        if (!query) {
            toast.error('Please enter a GraphQL query');
            return;
        }

        try {
            const rawVars = variablesEditor.value.trim();
            if (rawVars) variables = JSON.parse(rawVars);
        } catch (e) {
            toast.error('Invalid JSON in variables');
            return;
        }

        loading.style.display = 'flex';
        responseViewer.innerHTML = '<div style="color: #888;">Executing query...</div>';
        statusContainer.innerHTML = '';

        try {
            const res = await api.fetch('/services/data/v60.0/graphql', {
                method: 'POST',
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            const statusClass = res.ok ? 'status-success' : 'status-error';
            statusContainer.innerHTML = `<span class="status-badge ${statusClass}">${res.status} ${window.escapeHtml(res.statusText)}</span>`;

            const text = await res.text();
            try {
                const json = JSON.parse(text);
                responseViewer.innerHTML = `<pre style="color: #9cdcfe;">${JSON.stringify(json, null, 4)}</pre>`;
            } catch (e) {
                responseViewer.innerHTML = `<pre style="color: #ce9178;">${escapeHtml(text)}</pre>`;
            }
        } catch (error) {
            statusContainer.innerHTML = `<span class="status-badge status-error">Error</span>`;
            responseViewer.innerHTML = `<div style="color: #f44336;">${window.escapeHtml(error.message)}</div>`;
        } finally {
            loading.style.display = 'none';
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
