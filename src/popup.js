document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Main
    const accountList = document.getElementById('account-list');

    // ── Quick Launch menu: Data Export / Data Import / Launch Comet ──────────
    // Resolve the host of the active tab so the tools open pre-connected to the
    // org the user is currently viewing.
    function getActiveTabHost(cb) {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            let host = '';
            const tab = tabs && tabs[0];
            if (tab && tab.url) {
                try {
                    const url = new URL(tab.url);
                    if (url.hostname.includes('salesforce.com') || url.hostname.includes('force.com')) {
                        host = url.hostname;
                    }
                } catch (e) { }
            }
            cb(host);
        });
    }

    function openExtensionTool(page) {
        getActiveTabHost((host) => {
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page,
                params: { host }
            });
        });
    }

    function launchCometPanel() {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) return;
            const isSf = tab.url && (tab.url.includes('salesforce.com') || tab.url.includes('force.com'));
            if (!isSf) {
                // No Salesforce tab open — the Comet panel lives on the org page.
                // Fall back to the code editor so the user still lands somewhere useful.
                openExtensionTool('code-editor');
                return;
            }
            // Load the Comet main logic into the org tab (idempotent), then toggle
            // the panel open. loadMain needs a sender tab, so tell the background
            // which tab to inject into via the active-tab message below.
            chrome.tabs.sendMessage(tab.id, { action: 'sfarc-launch-comet' }, () => {
                if (chrome.runtime.lastError) {
                    // Content script not present yet — inject the bootstrap.
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content.js']
                    }).then(() => {
                        chrome.tabs.sendMessage(tab.id, { action: 'sfarc-launch-comet' });
                    }).catch(() => { });
                }
            });
        });
    }

    const launchExportBtn = document.getElementById('launch-data-export');

    if (launchExportBtn) launchExportBtn.addEventListener('click', () => openExtensionTool('data-export'));
    const addAccountBtn = document.getElementById('add-account-btn');
    const modal = document.getElementById('add-account-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveAccountBtn = document.getElementById('save-account');
    const togglePasswordBtn = document.getElementById('toggle-password-visibility');

    // State
    let groups = [];
    let accounts = []; // Flat list for search and compatibility
    let editingIndex = -1; // Index of account being edited
    let editingGroupId = null; // ID of group being edited
    let draggedItem = null;
    let draggedType = null; // 'account' or 'group'
    let autoExpandTimer = null;

    // Vault state (passwords are encrypted at rest; the key lives in memory)
    let vaultMeta = null; // chrome.storage.local: { version, iterations, salt, verifier }
    let vaultKey = null; // CryptoKey, unlocked for this browser session
    let vaultMode = null; // 'create' | 'unlock'
    let pendingAfterUnlock = null; // callback to run once the vault is available

    // DOM Elements - Inputs
    const searchInput = document.getElementById('account-search');
    const importBtn = document.getElementById('import-accounts-btn');
    const importInput = document.getElementById('import-file-input');
    const nameInput = document.getElementById('acc-name');
    const usernameInput = document.getElementById('acc-username');
    const passwordInput = document.getElementById('acc-password');
    const loginUrlSelect = document.getElementById('acc-login-url');
    const customUrlInput = document.getElementById('acc-custom-url');
    const colorInput = document.getElementById('acc-color');

    // DOM Elements - Group Modal
    const groupModal = document.getElementById('group-modal');
    const groupNameInput = document.getElementById('group-name-input');
    const saveGroupBtn = document.getElementById('save-group');
    const closeGroupModalBtn = document.getElementById('close-group-modal');
    const addGroupBtnHeader = document.getElementById('add-group-btn-header');

    // DOM Elements - Clone Record & Code Editor
    const cloneRecordToolBtn = document.getElementById('clone-record-tool-btn');
    const cloneRecordHeaderBtn = document.getElementById('clone-record-btn-header');
    const anonymousApexHeaderBtn = document.getElementById('anonymous-apex-btn-header');

    const openCloneTool = () => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            let activeTab = tabs && tabs[0];
            let targetHost = "";
            if (activeTab && activeTab.url) {
                try {
                    let url = new URL(activeTab.url);
                    if (url.hostname.includes('salesforce.com') || url.hostname.includes('force.com')) {
                        targetHost = url.hostname;
                    }
                } catch (e) { }
            }
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'record-clone',
                params: { host: targetHost }
            });
        });
    };

    const openAnonymousApexTool = () => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            let activeTab = tabs && tabs[0];
            let targetHost = "";
            if (activeTab && activeTab.url) {
                try {
                    let url = new URL(activeTab.url);
                    if (url.hostname.includes('salesforce.com') || url.hostname.includes('force.com')) {
                        targetHost = url.hostname;
                    }
                } catch (e) { }
            }
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'anonymous-apex',
                params: { host: targetHost }
            });
        });
    };

    if (cloneRecordToolBtn) cloneRecordToolBtn.addEventListener('click', openCloneTool);
    if (cloneRecordHeaderBtn) cloneRecordHeaderBtn.addEventListener('click', openCloneTool);
    if (anonymousApexHeaderBtn) anonymousApexHeaderBtn.addEventListener('click', openAnonymousApexTool);

    let currentLoggedInUser = null;

    // Capture Session on Load
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url && (tab.url.includes('salesforce.com') || tab.url.includes('force.com'))) {
            // Request user info from content script
            chrome.tabs.sendMessage(tab.id, { action: 'get-user-info' }, (response) => {
                if (chrome.runtime.lastError || !response) return; // Ignore errors (e.g. content script not ready)

                const { userId, userName, username, orgId, instanceUrl } = response;

                chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: tab.url }, (cookie) => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                    if (cookie && cookie.value) {
                        currentLoggedInUser = {
                            username: username || userName,
                            userName,
                            userId,
                            sessionId: cookie.value,
                            instanceUrl,
                            orgId
                        };
                        updateAccountSession(currentLoggedInUser);
                        
                        // Populate Active Session Panel
                        document.getElementById('active-session-panel').classList.remove('hidden');
                        document.getElementById('active-org-username').textContent = username || userName || 'Unknown User';
                        document.getElementById('active-org-url').textContent = instanceUrl || tab.url;

                        // Event Listeners for Session Actions
                        document.getElementById('btn-copy-session').onclick = () => {
                            navigator.clipboard.writeText(decodeURIComponent(cookie.value)).then(() => {
                                const btn = document.getElementById('btn-copy-session');
                                const originalHtml = btn.innerHTML;
                                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                                setTimeout(() => btn.innerHTML = originalHtml, 2000);
                            });
                        };

                        document.getElementById('btn-copy-frontdoor').onclick = () => {
                            const classicDomainUrl = (instanceUrl || tab.url).replace('.lightning.force.com', '.my.salesforce.com');
                            const sessionUrl = `${classicDomainUrl}/secur/frontdoor.jsp?sid=${decodeURIComponent(cookie.value)}`;
                            navigator.clipboard.writeText(sessionUrl).then(() => {
                                const btn = document.getElementById('btn-copy-frontdoor');
                                const originalHtml = btn.innerHTML;
                                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                                setTimeout(() => btn.innerHTML = originalHtml, 2000);
                            });
                        };


                    }
                });
            });
        }
    });

    // Flow Scanner Button Toggle Handler
    const toggleFlowScannerBtn = document.getElementById('toggle-flow-scanner-btn');
    if (toggleFlowScannerBtn) {
        chrome.storage.local.get(['fs_hide_floating_btn'], (res) => {
            toggleFlowScannerBtn.checked = !res.fs_hide_floating_btn;
        });
        toggleFlowScannerBtn.addEventListener('change', () => {
            const hideBtn = !toggleFlowScannerBtn.checked;
            chrome.storage.local.set({ fs_hide_floating_btn: hideBtn });
        });
    }

    // Event Listeners
    addAccountBtn.addEventListener('click', () => {
        resetForm();
        if (currentLoggedInUser) {
            // Auto-fill logged-in user details so user only has to enter password
            if (currentLoggedInUser.userName || currentLoggedInUser.username) {
                nameInput.value = currentLoggedInUser.userName || currentLoggedInUser.username.split('@')[0];
            }
            if (currentLoggedInUser.username) {
                usernameInput.value = currentLoggedInUser.username;
            }
            if (currentLoggedInUser.instanceUrl) {
                const normUrl = normalizeOrgUrl(currentLoggedInUser.instanceUrl) || currentLoggedInUser.instanceUrl;
                if (normUrl.includes('test.salesforce.com') || normUrl.includes('.sandbox.')) {
                    loginUrlSelect.value = 'https://test.salesforce.com';
                    customUrlInput.value = normUrl;
                    customUrlInput.classList.add('hidden');
                } else if (normUrl.includes('login.salesforce.com')) {
                    loginUrlSelect.value = 'https://login.salesforce.com';
                    customUrlInput.value = normUrl;
                    customUrlInput.classList.add('hidden');
                } else {
                    loginUrlSelect.value = 'custom';
                    customUrlInput.value = normUrl;
                    customUrlInput.classList.remove('hidden');
                }
            }
            // Auto-focus password input so user can quickly type password and save
            setTimeout(() => passwordInput.focus(), 100);
        }
        modal.classList.add('visible');
        modal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    saveAccountBtn.addEventListener('click', saveAccount);


    loginUrlSelect.addEventListener('change', () => {
        if (loginUrlSelect.value === 'custom') {
            customUrlInput.classList.remove('hidden');
        } else {
            customUrlInput.classList.add('hidden');
        }
    });
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    searchInput.addEventListener('input', () => {
        renderAccounts();
    });

    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', handleImport);

    // Group Listeners
    addGroupBtnHeader.addEventListener('click', () => openGroupModal());
    closeGroupModalBtn.addEventListener('click', closeGroupModal);
    saveGroupBtn.addEventListener('click', saveGroup);

    groupModal.addEventListener('click', (e) => {
        if (e.target === groupModal) closeGroupModal();
    });

    // Paste JSON Listeners
    closePasteModalBtn.addEventListener('click', closePasteModal);
    confirmPasteBtn.addEventListener('click', confirmPaste);
    pasteModal.addEventListener('click', (e) => {
        if (e.target === pasteModal) closePasteModal();
    });

    // Functions
    function loadAccounts() {
        chrome.storage.local.get(['sfiGroups', 'sfiAccounts', 'sfiVaultMeta'], async (result) => {
            vaultMeta = result.sfiVaultMeta || null;

            if (result.sfiGroups) {
                groups = result.sfiGroups;
            } else if (result.sfiAccounts) {
                // Migrate flat list to General group
                groups = [{
                    id: 'general-' + Date.now(),
                    name: 'General',
                    isOpen: true,
                    accounts: result.sfiAccounts
                }];
                saveGroups();
            } else {
                // Initialize with an empty General group
                groups = [{
                    id: 'general-' + Date.now(),
                    name: 'General',
                    isOpen: true,
                    accounts: []
                }];
                saveGroups();
            }

            if (vaultMeta) {
                // Existing vault: unlock (the key may already be cached for this session)
                const key = await getVaultKey();
                if (!key) {
                    showVaultModal('unlock');
                    return;
                }
                renderAccounts();
                return;
            }

            // No vault yet — if any saved account has a plaintext password,
            // prompt to set up encryption (migration).
            const hasPlaintext = groups.some(g =>
                g.accounts.some(a => typeof a.password === 'string' && a.password.length > 0)
            );
            if (hasPlaintext) {
                showVaultModal('create');
                return;
            }
            renderAccounts();
        });
    }

    function saveGroups() {
        chrome.storage.local.set({ sfiGroups: groups }, renderAccounts);
    }

    function openGroupModal(id = null, name = '') {
        editingGroupId = id;
        groupNameInput.value = name;
        document.getElementById('group-modal-title').textContent = id ? 'Edit Group' : 'Add Group';
        groupModal.classList.add('visible');
        groupModal.classList.remove('hidden');
        groupNameInput.focus();
    }

    function closeGroupModal() {
        groupModal.classList.remove('visible');
        setTimeout(() => groupModal.classList.add('hidden'), 300);
    }

    function openPasteModal() {
        jsonPasteArea.value = '';
        pasteModal.classList.add('visible');
        pasteModal.classList.remove('hidden');
        jsonPasteArea.focus();
    }

    function closePasteModal() {
        pasteModal.classList.remove('visible');
        setTimeout(() => pasteModal.classList.add('hidden'), 300);
    }

    async function confirmPaste() {
        const jsonText = jsonPasteArea.value.trim();
        if (!jsonText) return;

        try {
            const data = JSON.parse(jsonText);
            await processImportData(data);
            closePasteModal();
        } catch (err) {
            toast.error('Invalid JSON format. Please check your input.');
        }
    }

    // ---------- Vault (encrypted password storage) ----------
    function getSessionKey() {
        return new Promise((resolve) => {
            if (typeof chrome.storage === 'undefined' || !chrome.storage.session) {
                resolve(null);
                return;
            }
            chrome.storage.session.get(['sfiVaultSessionKey'], (res) => {
                if (chrome.runtime.lastError) { resolve(null); return; }
                resolve(res && res.sfiVaultSessionKey ? res.sfiVaultSessionKey : null);
            });
        });
    }

    function setSessionKey(b64) {
        return new Promise((resolve) => {
            if (typeof chrome.storage === 'undefined' || !chrome.storage.session) { resolve(); return; }
            chrome.storage.session.set({ sfiVaultSessionKey: b64 }, () => resolve());
        });
    }

    async function getVaultKey() {
        if (vaultKey) return vaultKey;
        try {
            const cached = await getSessionKey();
            if (cached) {
                vaultKey = await VaultCrypto.importKeyBytes(cached);
                return vaultKey;
            }
        } catch (e) { /* fall through to unlock */ }
        return null;
    }

    async function decryptPassword(payload) {
        if (!payload) return '';
        const key = vaultKey || await getVaultKey();
        if (!key) return '';
        try {
            return await VaultCrypto.decrypt(key, payload);
        } catch (e) {
            return '';
        }
    }

    async function createVaultWithPassphrase(passphrase) {
        const { meta, key } = await VaultCrypto.create(passphrase);
        vaultMeta = meta;
        vaultKey = key;
        await new Promise((resolve) => chrome.storage.local.set({ sfiVaultMeta: meta }, resolve));
        const b64 = await VaultCrypto.exportKeyBytes(key);
        await setSessionKey(b64);
        return true;
    }

    async function unlockVaultWithPassphrase(passphrase) {
        const key = await VaultCrypto.unlock(passphrase, vaultMeta);
        if (!key) return false;
        vaultKey = key;
        const b64 = await VaultCrypto.exportKeyBytes(key);
        await setSessionKey(b64);
        return true;
    }

    async function migratePlaintextPasswords() {
        let changed = false;
        for (const group of groups) {
            for (const acc of group.accounts) {
                if (typeof acc.password === 'string' && !acc.passwordEnc) {
                    acc.passwordEnc = await VaultCrypto.encrypt(vaultKey, acc.password);
                    delete acc.password;
                    changed = true;
                }
            }
        }
        if (changed) saveGroups();
    }

    // Vault modal
    const vaultModal = document.getElementById('vault-modal');
    const vaultModalTitle = document.getElementById('vault-modal-title');
    const vaultModalLabel = document.getElementById('vault-modal-label');
    const vaultModalHint = document.getElementById('vault-modal-hint');
    const vaultPassphrase = document.getElementById('vault-passphrase');
    const vaultModalSubmit = document.getElementById('vault-modal-submit');
    const vaultModalClose = document.getElementById('vault-modal-close');
    const toggleVaultPassword = document.getElementById('toggle-vault-password');

    function showVaultModal(mode) {
        vaultMode = mode;
        vaultPassphrase.value = '';
        if (mode === 'create') {
            vaultModalTitle.textContent = 'Create Master Passphrase';
            vaultModalLabel.textContent = 'Set a master passphrase to encrypt saved passwords';
            vaultModalHint.textContent = 'This passphrase encrypts your saved account passwords (AES-256 via PBKDF2). It is never stored — if you forget it, saved passwords cannot be recovered and must be re-entered.';
        } else {
            vaultModalTitle.textContent = 'Unlock Vault';
            vaultModalLabel.textContent = 'Enter your master passphrase to unlock';
            vaultModalHint.textContent = 'Saved passwords are encrypted. You need to unlock once per browser session.';
        }
        vaultModal.classList.add('visible');
        vaultModal.classList.remove('hidden');
        setTimeout(() => vaultPassphrase.focus(), 50);
    }

    function closeVaultModal() {
        vaultModal.classList.remove('visible');
        setTimeout(() => vaultModal.classList.add('hidden'), 300);
    }

    async function handleVaultSubmit() {
        const pass = vaultPassphrase.value;
        if (!pass) {
            toast.error('Please enter a passphrase.');
            return;
        }
        if (vaultMode === 'create') {
            try {
                await createVaultWithPassphrase(pass);
            } catch (e) {
                toast.error('Could not create the vault: ' + (e && e.message ? e.message : e));
                return;
            }
            await migratePlaintextPasswords();
        } else {
            const ok = await unlockVaultWithPassphrase(pass);
            if (!ok) {
                toast.warning('Incorrect passphrase. Please try again.');
                vaultPassphrase.value = '';
                vaultPassphrase.focus();
                return;
            }
        }
        closeVaultModal();
        if (pendingAfterUnlock) {
            const cb = pendingAfterUnlock;
            pendingAfterUnlock = null;
            cb();
        } else {
            renderAccounts();
        }
    }

    vaultModalSubmit.addEventListener('click', handleVaultSubmit);
    vaultModalClose.addEventListener('click', () => {
        closeVaultModal();
        if (!vaultKey && vaultMeta) {
            // Still locked: keep the list empty so passwords stay hidden
            accountList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888; font-size: 12px;">Vault locked. Open the popup again to unlock.</div>';
        }
    });
    vaultModal.addEventListener('click', (e) => {
        if (e.target === vaultModal) vaultModalClose.click();
    });
    vaultPassphrase.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleVaultSubmit();
    });
    toggleVaultPassword.addEventListener('click', () => {
        vaultPassphrase.type = vaultPassphrase.type === 'password' ? 'text' : 'password';
    });

    function saveGroup() {
        const name = groupNameInput.value.trim();
        if (!name) return;

        if (editingGroupId) {
            const group = groups.find(g => g.id === editingGroupId);
            if (group) group.name = name;
        } else {
            groups.push({
                id: 'group-' + Date.now(),
                name: name,
                isOpen: true,
                accounts: []
            });
        }
        saveGroups();
        closeGroupModal();
    }

    async function deleteGroup(id) {
        const groupIndex = groups.findIndex(g => g.id === id);
        if (groupIndex === -1) return;

        const group = groups[groupIndex];
        if (group.accounts.length > 0) {
            if (!(await toast.confirm(`This group contains ${group.accounts.length} accounts. Delete everything?`, {danger: true}))) {
                return;
            }
        }
        groups.splice(groupIndex, 1);
        saveGroups();
    }

    function toggleGroup(id) {
        const group = groups.find(g => g.id === id);
        if (group) {
            group.isOpen = !group.isOpen;
            saveGroups();
        }
    }

    function renderAccounts() {
        accountList.innerHTML = '';
        const query = searchInput.value.toLowerCase().trim();

        // Calculate total accounts (including search)
        let totalAccounts = 0;
        groups.forEach(g => {
            totalAccounts += g.accounts.length;
        });

        if (groups.length === 0 || (totalAccounts === 0 && !query)) {
            accountList.innerHTML = `
                <div class="empty-state centered-import">
                    <div class="empty-icon">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <h2>Welcome to Comet Passkeys</h2>
                    <p>Start by importing your Salesforce accounts</p>
                    <div class="empty-actions">
                        <button id="empty-file-btn" class="primary-btn">
                            <i class="fa-solid fa-file-code"></i> Choose JSON File
                        </button>
                        <button id="empty-paste-btn" class="secondary-btn">
                            <i class="fa-solid fa-paste"></i> Paste JSON String
                        </button>
                    </div>
                    <p class="empty-hint">Or click the <b>+</b> in the header to add manually</p>
                </div>
            `;
            const emptyFileBtn = document.getElementById('empty-file-btn');
            const emptyPasteBtn = document.getElementById('empty-paste-btn');

            if (emptyFileBtn) emptyFileBtn.addEventListener('click', () => importInput.click());
            if (emptyPasteBtn) emptyPasteBtn.addEventListener('click', openPasteModal);
            return;
        }

        if (query) {
            // Check if ANY account matches search across all groups
            const anyMatch = groups.some(group =>
                group.accounts.some(acc =>
                    acc.name.toLowerCase().includes(query) ||
                    acc.username.toLowerCase().includes(query)
                ) || group.name.toLowerCase().includes(query)
            );

            if (!anyMatch) {
                accountList.innerHTML = `
                    <div class="empty-state">
                        <p>No accounts match "<b>${escapeHtml(query)}</b>"</p>
                    </div>
                `;
                return;
            }
        }

        groups.forEach((group, groupIndex) => {
            const groupEl = document.createElement('div');
            groupEl.className = `account-group ${group.isOpen ? '' : 'collapsed'}`;
            groupEl.draggable = true;
            groupEl.dataset.id = group.id;

            // Filter accounts within the group if searching
            const filteredAccounts = group.accounts.filter(acc =>
                acc.name.toLowerCase().includes(query) ||
                acc.username.toLowerCase().includes(query)
            );

            // Hide group if no accounts match search (unless group name matches)
            if (query && filteredAccounts.length === 0 && !group.name.toLowerCase().includes(query)) {
                return;
            }

            groupEl.innerHTML = `
                <div class="group-header" data-id="${group.id}">
                    <div class="drag-handle group-handle">
                        <i class="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div class="group-icon">
                        <i class="fa-solid ${group.isOpen ? 'fa-folder-open' : 'fa-folder'}"></i>
                    </div>
                    <div class="group-title">${escapeHtml(group.name)}</div>
                    <div class="group-actions">
                        <span class="account-count">${group.accounts.length}</span>
                        <div class="more-actions-container">
                            <button class="icon-btn group-more-btn" data-id="${group.id}" title="Group Options">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                            <div id="group-menu-${group.id}" class="more-menu hidden">
                                <button class="menu-item edit-group" data-id="${group.id}"><i class="fa-solid fa-pencil"></i> Rename</button>
                                <button class="menu-item delete-group" data-id="${group.id}" style="color: #d32f2f;"><i class="fa-solid fa-trash"></i> Delete</button>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-up toggle-icon"></i>
                    </div>
                </div>
                <div class="group-accounts" data-group-id="${group.id}">
                    ${filteredAccounts.map((acc, accIdx) => {
                const trueAccIdx = group.accounts.indexOf(acc);
                return `
                        <div class="account-card" draggable="true" data-group-id="${group.id}" data-index="${trueAccIdx}" style="--org-color: ${safeColor(acc.color)}; animation-delay: ${accIdx * 0.05}s">
                            <div class="drag-handle card-handle">
                                <i class="fa-solid fa-grip-vertical"></i>
                            </div>
                            <div class="account-info">
                                <div class="account-name">
                                    <div class="color-indicator" style="background: ${safeColor(acc.color)}" title="Org Color"></div>
                                    <span title="${escapeHtml(acc.name)}">${escapeHtml(acc.name)}</span>
                                </div>
                                <div class="account-username" title="${escapeHtml(acc.username)}">${escapeHtml(acc.username)}</div>
                            </div>
                            <div class="card-actions">
                                ${acc.sessionId ? `
                                <button class="login-icon-btn session-btn" title="Direct Login (Session)" data-group-id="${group.id}" data-index="${trueAccIdx}">
                                    <i class="fa-solid fa-bolt"></i>
                                </button>
                                ` : ''}
                                <button class="login-icon-btn login-tab" title="Login in New Tab" data-group-id="${group.id}" data-index="${trueAccIdx}">
                                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                                </button>
                                <button class="login-icon-btn login-incognito" title="Login in Incognito" data-group-id="${group.id}" data-index="${trueAccIdx}">
                                    <i class="fa-solid fa-user-secret"></i>
                                </button>
                                <button class="login-icon-btn login-window" title="Login in New Window" data-group-id="${group.id}" data-index="${trueAccIdx}">
                                    <i class="fa-regular fa-window-restore"></i>
                                </button>
                                <div class="more-actions-container">
                                     <button class="action-btn card-more-btn" title="More Actions" data-group-id="${group.id}" data-index="${trueAccIdx}">
                                        <i class="fa-solid fa-ellipsis-vertical"></i>
                                    </button>
                                    <div id="card-menu-${group.id}-${trueAccIdx}" class="more-menu hidden">
                                        <button class="menu-item edit-acc" data-group-id="${group.id}" data-index="${trueAccIdx}"><i class="fa-solid fa-pencil"></i> Edit Account</button>
                                        <button class="menu-item copy-user" data-group-id="${group.id}" data-index="${trueAccIdx}"><i class="fa-solid fa-user"></i> Copy Username</button>
                                        <button class="menu-item copy-pass" data-group-id="${group.id}" data-index="${trueAccIdx}"><i class="fa-solid fa-key"></i> Copy Password</button>
                                        <button class="menu-item delete-acc" data-group-id="${group.id}" data-index="${trueAccIdx}" style="color: #d32f2f;"><i class="fa-solid fa-trash"></i> Delete Account</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('')}
                    ${filteredAccounts.length === 0 && !query ? '<div style="padding: 10px; font-size: 12px; color: #94a3b8; text-align: center;">Empty group. Drag accounts here.</div>' : ''}
                </div>
            `;
            accountList.appendChild(groupEl);
        });

        setupInteractionListeners();
        setupDragAndDrop();
    }

    function setupInteractionListeners() {
        // Toggle Group
        document.querySelectorAll('.group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.group-more-btn') || e.target.closest('.more-menu')) return;
                toggleGroup(header.dataset.id);
            });
        });

        // Group More Options
        document.querySelectorAll('.group-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const menu = document.getElementById(`group-menu-${id}`);
                const isHidden = menu.classList.contains('hidden');
                closeAllMenus();
                if (isHidden) {
                    menu.classList.remove('hidden');
                    btn.closest('.account-group').classList.add('active-group');
                }
            });
        });

        // Add Listeners for Group Actions
        document.querySelectorAll('.edit-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const group = groups.find(g => g.id === id);
                if (group) openGroupModal(id, group.name);
                closeAllMenus();
            });
        });

        document.querySelectorAll('.delete-group').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteGroup(btn.dataset.id);
                closeAllMenus();
            });
        });

        // Card More Options
        document.querySelectorAll('.card-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gId = btn.dataset.groupId;
                const idx = btn.dataset.index;
                const menu = document.getElementById(`card-menu-${gId}-${idx}`);
                const isHidden = menu.classList.contains('hidden');
                closeAllMenus();
                if (isHidden) {
                    menu.classList.remove('hidden');
                    btn.closest('.account-group').classList.add('active-group');
                }
            });
        });

        // Card Actions
        document.querySelectorAll('.edit-acc').forEach(btn => {
            btn.addEventListener('click', () => {
                editAccount(btn.dataset.groupId, btn.dataset.index);
                closeAllMenus();
            });
        });

        document.querySelectorAll('.copy-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = groups.find(g => g.id === btn.dataset.groupId);
                copyToClipboard(group.accounts[btn.dataset.index].username);
                closeAllMenus();
            });
        });

        document.querySelectorAll('.copy-pass').forEach(btn => {
            btn.addEventListener('click', async () => {
                const group = groups.find(g => g.id === btn.dataset.groupId);
                const acc = group.accounts[btn.dataset.index];
                let pw = acc.password || '';
                if (acc.passwordEnc) {
                    pw = await decryptPassword(acc.passwordEnc);
                }
                copyToClipboard(pw);
                closeAllMenus();
            });
        });

        document.querySelectorAll('.delete-acc').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteAccount(btn.dataset.groupId, btn.dataset.index);
                closeAllMenus();
            });
        });

        document.querySelectorAll('.login-icon-btn').forEach(btn => {
            const group = groups.find(g => g.id === btn.dataset.groupId);
            const acc = group.accounts[btn.dataset.index];

            if (btn.classList.contains('session-btn')) {
                btn.addEventListener('click', () => loginViaSession(acc, 'tab'));
            } else if (btn.classList.contains('login-window')) {
                btn.addEventListener('click', () => login(acc, 'window'));
            } else if (btn.classList.contains('login-incognito')) {
                btn.addEventListener('click', () => login(acc, 'incognito'));
            } else if (btn.classList.contains('login-tab')) {
                btn.addEventListener('click', () => login(acc, 'tab'));
            }
        });

        document.querySelectorAll('.account-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.drag-handle, .card-actions, .more-menu')) return;

                const group = groups.find(g => g.id === card.dataset.groupId);
                const acc = group?.accounts[card.dataset.index];
                if (!acc) return;

                switchToAccount(acc);
            });
        });

        document.addEventListener('click', closeAllMenus);
    }

    function setupDragAndDrop() {
        // Handle Groups
        document.querySelectorAll('.account-group').forEach(groupEl => {
            groupEl.addEventListener('dragstart', (e) => {
                // Only allow dragging by the group handle
                if (!e.target.closest('.group-handle')) {
                    e.preventDefault();
                    return;
                }
                draggedItem = groupEl.dataset.id;
                draggedType = 'group';
                groupEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
            });

            groupEl.addEventListener('dragend', () => {
                groupEl.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
                clearTimeout(autoExpandTimer);
            });

            groupEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedType === 'group') {
                    const draggingEl = document.querySelector('.account-group.dragging');
                    if (draggingEl && draggingEl !== groupEl) {
                        const rect = groupEl.getBoundingClientRect();
                        const midpoint = rect.top + rect.height / 2;

                        groupEl.classList.remove('drag-over-top', 'drag-over-bottom');
                        if (e.clientY < midpoint) {
                            groupEl.classList.add('drag-over-top');
                        } else {
                            groupEl.classList.add('drag-over-bottom');
                        }
                    }
                }
            });

            groupEl.addEventListener('dragleave', () => {
                groupEl.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            groupEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedType === 'group') {
                    const draggingEl = document.querySelector('.account-group.dragging');
                    if (draggingEl && draggingEl !== groupEl) {
                        const isTop = groupEl.classList.contains('drag-over-top');
                        groupEl.classList.remove('drag-over-top', 'drag-over-bottom');

                        if (isTop) {
                            accountList.insertBefore(draggingEl, groupEl);
                        } else {
                            accountList.insertBefore(draggingEl, groupEl.nextSibling);
                        }

                        // Sync groups array order
                        const allGroupEls = Array.from(accountList.querySelectorAll('.account-group'));
                        const newGroupsOrder = allGroupEls.map(el => groups.find(g => g.id === el.dataset.id));
                        groups = newGroupsOrder;
                        chrome.storage.local.set({ sfiGroups: groups });
                    }
                } else if (draggedType === 'account') {
                    if (!e.target.closest('.group-accounts')) {
                        moveAccountToGroup(draggedItem.groupId, draggedItem.index, groupEl.dataset.id);
                    }
                }
            });

            // Auto-expand on drag-over for accounts
            const header = groupEl.querySelector('.group-header');
            header.addEventListener('dragover', (e) => {
                if (draggedType === 'account' && groupEl.classList.contains('collapsed')) {
                    if (!autoExpandTimer) {
                        autoExpandTimer = setTimeout(() => {
                            groupEl.classList.remove('collapsed');
                            const group = groups.find(g => g.id === groupEl.dataset.id);
                            if (group) group.isOpen = true;
                            autoExpandTimer = null;
                        }, 600);
                    }
                }
            });
            header.addEventListener('dragleave', () => {
                clearTimeout(autoExpandTimer);
                autoExpandTimer = null;
            });
        });

        // Handle Accounts
        document.querySelectorAll('.account-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                // Only allow dragging by the card handle within the card
                // but usually cards don't have many other clickable areas besides the icons
                // we'll check if we're not clicking an action button
                if (e.target.closest('.card-actions')) {
                    e.preventDefault();
                    return;
                }
                draggedItem = { groupId: card.dataset.groupId, index: parseInt(card.dataset.index) };
                draggedType = 'account';
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
            });

            card.addEventListener('dragend', () => card.classList.remove('dragging'));

            card.addEventListener('dragover', (e) => {
                if (draggedType === 'account') {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const draggingEl = document.querySelector('.account-card.dragging');
                    if (draggingEl && draggingEl !== card) {
                        const container = card.parentNode;
                        const rect = card.getBoundingClientRect();
                        const midpoint = rect.top + rect.height / 2;

                        if (e.clientY < midpoint) {
                            container.insertBefore(draggingEl, card);
                        } else {
                            container.insertBefore(draggingEl, card.nextSibling);
                        }

                        // Update target group ID on the element during drag
                        draggingEl.dataset.groupId = container.dataset.groupId;
                    }
                }
            });
        });

        document.querySelectorAll('.group-accounts').forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedType === 'account') {
                    container.classList.add('drag-over');
                }
            });

            container.addEventListener('dragleave', () => container.classList.remove('drag-over'));

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.classList.remove('drag-over');
                if (draggedType === 'account') {
                    const targetGroupId = container.dataset.groupId;
                    const draggingEl = document.querySelector('.account-card.dragging');
                    const allCards = Array.from(container.querySelectorAll('.account-card'));
                    const targetIndex = allCards.indexOf(draggingEl);

                    // If we couldn't find the targetIndex (draggingEl not in slice), 
                    // it means it was dropped on the container but not strictly over another card
                    moveAccountToGroup(draggedItem.groupId, draggedItem.index, targetGroupId, targetIndex);
                }
            });
        });
    }

    function moveAccountToGroup(sourceGroupId, sourceIndex, targetGroupId, targetIndex = -1) {
        const sourceGroup = groups.find(g => g.id === sourceGroupId);
        const targetGroup = groups.find(g => g.id === targetGroupId);
        if (!sourceGroup || !targetGroup) return;

        // If same group reordering, and index didn't change (e.g. dropped back on itself)
        if (sourceGroupId === targetGroupId && targetIndex !== -1 && sourceIndex === targetIndex) return;

        const [account] = sourceGroup.accounts.splice(sourceIndex, 1);
        if (targetIndex !== -1) {
            targetGroup.accounts.splice(targetIndex, 0, account);
        } else {
            targetGroup.accounts.push(account);
        }
        saveGroups();
    }

    async function editAccount(groupId, index) {
        const group = groups.find(g => g.id === groupId);
        const acc = group.accounts[index];
        editingIndex = parseInt(index);
        editingGroupId = groupId;

        // Populate form
        nameInput.value = acc.name;
        usernameInput.value = acc.username;
        passwordInput.value = acc.passwordEnc
            ? await decryptPassword(acc.passwordEnc)
            : (acc.password || '');

        // Set Login URL
        if (['https://login.salesforce.com', 'https://test.salesforce.com'].includes(acc.loginUrl)) {
            loginUrlSelect.value = acc.loginUrl;
            customUrlInput.classList.add('hidden');
        } else {
            loginUrlSelect.value = 'custom';
            customUrlInput.value = acc.loginUrl;
            customUrlInput.classList.remove('hidden');
        }

        // Set color
        colorInput.value = acc.color || '#2196f3';

        // Update modal title/button if desired, but simple reuse is fine
        modal.classList.add('visible');
        modal.classList.remove('hidden');
    }

    async function saveAccount() {
        const name = nameInput.value.trim();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        let loginUrl = loginUrlSelect.value;

        if (loginUrl === 'custom') {
            loginUrl = customUrlInput.value.trim();
        }

        if (!name || !username || !loginUrl) {
            toast.warning('Please fill in required fields (Name, Username, Login URL)');
            return;
        }

        // Encrypt the password with the vault. If no vault exists yet (or it is
        // locked), prompt for the master passphrase first, then retry the save.
        let passwordEnc = null;
        if (password) {
            if (!vaultMeta) {
                pendingAfterUnlock = saveAccount;
                showVaultModal('create');
                return;
            }
            const key = vaultKey || await getVaultKey();
            if (!key) {
                pendingAfterUnlock = saveAccount;
                showVaultModal('unlock');
                return;
            }
            passwordEnc = await VaultCrypto.encrypt(key, password);
        }

        const accountData = {
            name,
            username,
            passwordEnc,
            loginUrl,
            color: colorInput.value,
            addedAt: new Date().toISOString()
        };

        if (editingIndex >= 0 && editingGroupId) {
            const group = groups.find(g => g.id === editingGroupId);
            if (group) {
                group.accounts[editingIndex] = {
                    ...group.accounts[editingIndex],
                    ...accountData
                };
            }
        } else {
            // Add to the first group or 'General' if exists
            let targetGroup = groups[0];
            if (!targetGroup) {
                targetGroup = { id: 'group-' + Date.now(), name: 'General', isOpen: true, accounts: [] };
                groups.push(targetGroup);
            }
            targetGroup.accounts.push(accountData);
        }

        saveGroups();
        closeModal();
        resetForm();
    }

    async function deleteAccount(groupId, index) {
        if (await toast.confirm('Are you sure you want to delete this account?', {danger: true})) {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                group.accounts.splice(index, 1);
                saveGroups();
            }
        }
    }

    function closeModal() {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // Match transition duration
    }

    function resetForm() {
        nameInput.value = '';
        usernameInput.value = '';
        passwordInput.value = '';
        loginUrlSelect.value = 'https://login.salesforce.com';
        customUrlInput.value = '';
        customUrlInput.classList.add('hidden');
        colorInput.value = '#2196f3';
        editingIndex = -1;
        editingGroupId = null;
    }



    function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                processImportData(data);
            } catch (err) {
                console.error('Import failed', err);
                toast.error('Failed to parse JSON. Please ensure the file is valid.');
            }
            importInput.value = ''; // Reset input
        };
        reader.readAsText(file);
    }

    async function processImportData(data) {
        if (data.groups && Array.isArray(data.groups)) {
            let importedCount = 0;
            for (const importedGroup of data.groups) {
                // Find or create group
                let targetGroup = groups.find(g => g.name === importedGroup.name);
                if (!targetGroup) {
                    targetGroup = {
                        id: 'group-' + Date.now() + Math.random().toString(36).substr(2, 5),
                        name: importedGroup.name || 'Imported Group',
                        isOpen: true,
                        accounts: []
                    };
                    groups.push(targetGroup);
                }

                if (importedGroup.credentials && Array.isArray(importedGroup.credentials)) {
                    for (const cred of importedGroup.credentials) {
                        const rawPassword = cred.Password || '';
                        let passwordEnc = null;
                        if (rawPassword) {
                            const key = vaultKey || await getVaultKey();
                            if (!key) {
                                toast.info('Unlock the vault first to import accounts with passwords.');
                                return;
                            }
                            passwordEnc = await VaultCrypto.encrypt(key, rawPassword);
                        }
                        const newAccount = {
                            name: cred.Name || 'Unnamed Org',
                            username: cred.SfName || '',
                            passwordEnc,
                            loginUrl: cred.Type?.Domain || 'https://login.salesforce.com',
                            color: cred.color || '#2196f3',
                            addedAt: new Date().toISOString()
                        };
                        targetGroup.accounts.push(newAccount);
                        importedCount++;
                    }
                }
            }

            if (importedCount > 0) {
                saveGroups();
                toast.success(`Successfully imported ${importedCount} accounts.`);
            } else {
                toast.info('No valid accounts found in the JSON data.');
            }
        } else {
            toast.error('Invalid JSON structure. Expecting { "groups": [...] }');
        }
    }

    function normalizeOrgUrl(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            let origin = parsed.origin;
            if (origin.includes('.lightning.force.com')) {
                origin = origin.replace('.lightning.force.com', '.my.salesforce.com');
            }
            // Collapse any already-doubled .my. (older stored sessions on
            // Trailblazer orgs where setup hosts were mis-normalized).
            origin = origin.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
            return origin;
        } catch (e) {
            return null;
        }
    }

    function updateAccountSession({ username, userId, sessionId, instanceUrl, orgId }) {
        chrome.storage.local.get(['sfiGroups'], (result) => {
            if (result.sfiGroups) {
                let updated = false;
                const normalizedInstanceUrl = normalizeOrgUrl(instanceUrl);
                const newGroups = result.sfiGroups.map(group => {
                    const newAccounts = group.accounts.map(acc => {
                        const sameUser = username && acc.username === username;
                        const sameOrg = orgId && acc.orgId === orgId;
                        const sameInstance = normalizedInstanceUrl && normalizeOrgUrl(acc.instanceUrl || acc.loginUrl) === normalizedInstanceUrl;
                        if (sameUser || sameOrg || sameInstance) {
                            updated = true;
                            return { ...acc, userId, sessionId, instanceUrl: normalizedInstanceUrl || instanceUrl, orgId, lastSessionCaptured: Date.now() };
                        }
                        return acc;
                    });
                    return { ...group, accounts: newAccounts };
                });

                if (updated) {
                    groups = newGroups;
                    chrome.storage.local.set({ sfiGroups: newGroups }, renderAccounts);
                }
            }
        });
    }

    function loginViaSession(account, mode = 'tab') {
        if (!account.sessionId || !account.instanceUrl) {
            toast.success('No saved session found. Please log in normally first to capture the session.');
            return;
        }
        openWithSession(account, mode);
    }

    // Log into an org with a captured session WITHOUT putting the raw session
    // ID in the URL: set the sid cookie via the extension's cookies permission,
    // then navigate to the instance URL. Keeps the token out of browser history
    // and server access logs. Falls back to the legacy frontdoor URL if the
    // cookie cannot be set (e.g. missing host permission).
    function openWithSession(account, mode) {
        const frontdoorFallback = () => {
            openUrl(`${account.instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(account.sessionId)}`, mode);
        };
        try {
            const urlObj = new URL(account.instanceUrl);
            const host = urlObj.hostname.replace(/^\./, '');
            chrome.cookies.set({
                url: account.instanceUrl + '/',
                name: 'sid',
                value: account.sessionId,
                domain: '.' + host,
                secure: true,
                httpOnly: true,
                path: '/'
            }, (cookie) => {
                if (chrome.runtime.lastError || !cookie) {
                    frontdoorFallback();
                    return;
                }
                openUrl(account.instanceUrl, mode);
            });
        } catch (e) {
            frontdoorFallback();
        }
    }

    async function login(account, mode = 'tab') {
        // Store credentials for the injector to pick up
        let password = account.password || '';
        if (account.passwordEnc) {
            password = await decryptPassword(account.passwordEnc);
        }
        const loginData = {
            username: account.username,
            password,
            url: account.loginUrl,
            timestamp: Date.now()
        };

        // Watchdog: wipe these transient credentials shortly after, even if the
        // login page never opened. The alarm lives in the service worker, so it
        // survives the popup closing.
        try {
            chrome.alarms.create('sfiAutoLoginCleanup', { when: Date.now() + 40000 });
        } catch (e) { /* alarms unavailable — login-injector still clears on read */ }

        chrome.storage.local.set({ sfiAutoLogin: loginData }, () => {
            let url = account.loginUrl;
            // Basic cleanup
            if (!url.startsWith('http')) url = 'https://' + url;

            // Append username if standard salesforce url (as backup/standard behavior)
            const cleanUrl = new URL(url);
            cleanUrl.searchParams.set('un', account.username);

            openUrl(cleanUrl.toString(), mode);
        });
    }

    function switchToAccount(account) {
        if (account.sessionId && account.instanceUrl) {
            openWithSession(account, 'current');
            return;
        }

        login(account, 'current');
    }

    function openUrl(url, mode) {
        if (mode === 'incognito') {
            chrome.windows.create({ url, incognito: true });
        } else if (mode === 'window') {
            chrome.windows.create({ url, focused: true });
        } else if (mode === 'current') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs && tabs[0];
                if (activeTab?.id) {
                    chrome.tabs.update(activeTab.id, { url, active: true });
                } else {
                    chrome.tabs.create({ url, active: true, index: activeTab ? activeTab.index + 1 : undefined });
                }
            });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs && tabs[0];
                chrome.tabs.create({ url, active: true, index: activeTab ? activeTab.index + 1 : undefined });
            });
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function safeColor(color) {
        return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#2196f3';
    }

    function closeAllMenus() {
        document.querySelectorAll('.more-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.account-group').forEach(g => g.classList.remove('active-group'));
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Optional: Show some feedback
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    }

    // Close menus on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-actions-container')) {
            closeAllMenus();
        }
    });

    // Load accounts from storage on popup open
    loadAccounts();

    // Auto-focus search input
    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 50);
});
