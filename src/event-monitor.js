/**
 * Salesforce Comet - Event Monitor Engine
 * Handles Bayeux CometD long-polling for Platform Events & CDC, entity discovery, and limits monitoring.
 */

(function () {
    'use strict';

    // State Management
    let sessionId = null;
    let instanceUrl = null;
    let clientId = null;
    let isConnected = false;
    let isConnecting = false;
    let isPaused = false;
    let longPollTimer = null;
    let activeSubscriptions = new Map(); // channel -> replayId
    let pendingSubscriptions = new Set();
    let pendingUnsubscriptions = new Set();
    let consecutivePollFailures = 0;
    let sessionRefreshAttempted = false;
    let isShuttingDown = false;
    const MAX_POLL_FAILURES = 5;
    let eventLog = [];
    let selectedEventId = null;
    let currentTab = 'streaming';

    // DOM Elements
    const elements = {
        connectionStatus: document.getElementById('connection-status'),
        connectionText: document.getElementById('connection-text'),
        platformEventsSelect: document.getElementById('select-platform-events'),
        cdcEventsSelect: document.getElementById('select-cdc-events'),
        customChannelInput: document.getElementById('input-custom-channel'),
        replaySelect: document.getElementById('select-replay'),
        customReplayField: document.getElementById('custom-replay-field'),
        customReplayInput: document.getElementById('input-custom-replay-id'),
        subscribeBtn: document.getElementById('btn-subscribe'),
        activeSubsContainer: document.getElementById('active-subscriptions-chips'),
        emptySubsMsg: document.getElementById('empty-subs-msg'),
        feedSearchInput: document.getElementById('feed-search-input'),
        feedCounter: document.getElementById('feed-counter'),
        eventFeedList: document.getElementById('event-feed-list'),
        eventDetailCode: document.getElementById('event-detail-code'),
        pauseBtn: document.getElementById('btn-pause'),
        lblPause: document.getElementById('lbl-pause'),
        clearBtn: document.getElementById('btn-clear'),
        exportBtn: document.getElementById('btn-export'),
        copyJsonBtn: document.getElementById('btn-copy-json'),
        refreshLimitsBtn: document.getElementById('btn-refresh-limits'),
        limitsGrid: document.getElementById('event-limits-grid'),
        navTabBtns: document.querySelectorAll('.nav-tab-btn'),
        tabPages: {
            streaming: document.getElementById('page-streaming'),
            limits: document.getElementById('page-limits')
        }
    };

    // Initialize Page
    async function init() {
        if (window.chrome && chrome.runtime && chrome.runtime.getURL) {
            const logoEl = document.getElementById('app-logo-img');
            if (logoEl) logoEl.src = chrome.runtime.getURL('icons/icon-48.png');
        }
        setupEventListeners();
        const authenticated = await resolveSalesforceSession();
        if (!authenticated) return;
        await loadEntitySuggestions();
        await loadEventLimits();
    }

    // Helper: Resolve Salesforce Session & Instance URL
    async function resolveSalesforceSession() {
        setConnectionState('connecting', 'Authenticating...');

        const params = new URLSearchParams(window.location.search);
        const pinnedHost = (params.get('host') || params.get('sfHost') || '').toLowerCase();
        const pinnedApiHost = pinnedHost ? normalizeHost(`https://${pinnedHost}`) : '';
        const pinnedUrl = pinnedApiHost ? `https://${pinnedApiHost}` : null;

        return new Promise((resolve) => {
            if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: pinnedUrl }, async (cookie) => {
                    if (cookie && cookie.value) {
                        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                        if (pinnedApiHost && !cookieMatchesHost(domain, pinnedApiHost)) {
                            setConnectionState('disconnected', 'Wrong Org Session');
                            resolve(false);
                            return;
                        }
                        sessionId = decodeURIComponent(cookie.value);
                        instanceUrl = pinnedUrl || `https://${domain}`;
                        resolve(await verifySession());
                    } else {
                        // Fallback check
                        chrome.storage.session.get(['sfarc_cached_session'], async (res) => {
                            const cached = res && res.sfarc_cached_session;
                            const fresh = cached && Number.isFinite(cached.timestamp) && (Date.now() - cached.timestamp) >= 0 && (Date.now() - cached.timestamp) < 600000;
                            if (fresh && cached.sessionId &&
                                (!pinnedHost || normalizeHost(cached.instanceUrl) === normalizeHost(pinnedUrl))) {
                                sessionId = cached.sessionId;
                                // Sanitize a stored URL that may carry an old doubled
                                // .my. (xxx.trailblaze.my.my.salesforce.com).
                                instanceUrl = (cached.instanceUrl || '').replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
                                if (pinnedUrl) instanceUrl = pinnedUrl;
                                resolve(await verifySession());
                            } else {
                                setConnectionState('disconnected', 'Session Missing');
                                resolve(false);
                            }
                        });
                    }
                });
            } else {
                setConnectionState('disconnected', 'No Extension API');
                resolve(false);
            }
        });
    }

    function normalizeHost(url) {
        try {
            return new URL(url).hostname.toLowerCase()
                .replace('.lightning.force.com', '.my.salesforce.com')
                .replace('.trailblaze.my.salesforce-setup.com', '.trailblaze.my.salesforce.com')
                .replace('.my.salesforce-setup.com', '.my.salesforce.com')
                .replace('.salesforce-setup.com', '.my.salesforce.com')
                .replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
        } catch (e) { return ''; }
    }

    function cookieMatchesHost(cookieDomain, pinnedHost) {
        const cookieBase = String(cookieDomain || '').replace(/^\./, '').split('.')[0];
        const pinnedBase = String(pinnedHost || '').split('.')[0];
        return !!cookieBase && cookieBase === pinnedBase;
    }

    async function verifySession() {
        try {
            setConnectionState('connecting', 'Verifying Session...');
            await makeRestFetch(`${instanceUrl}/services/data/v60.0/limits`);
            setConnectionState('connected', 'Ready');
            return true;
        } catch (error) {
            sessionId = null;
            clientId = null;
            isConnected = false;
            setConnectionState('disconnected', error.status === 401 ? 'Session Expired' : 'Authentication Failed');
            return false;
        }
    }

    // Connection UI State Helper
    function setConnectionState(state, text) {
        if (!elements.connectionStatus || !elements.connectionText) return;
        elements.connectionStatus.className = `status-pill ${state}`;
        elements.connectionText.textContent = text;
    }

    // Event Listeners Setup
    function setupEventListeners() {
        window.addEventListener('pagehide', shutdownCometD, { once: true });
        window.addEventListener('beforeunload', shutdownCometD, { once: true });
        // Tab Navigation
        elements.navTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                elements.navTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                Object.keys(elements.tabPages).forEach(tab => {
                    if (tab === targetTab) {
                        elements.tabPages[tab].classList.remove('hidden');
                    } else {
                        elements.tabPages[tab].classList.add('hidden');
                    }
                });

                currentTab = targetTab;
                if (targetTab === 'limits') {
                    loadEventLimits();
                }
            });
        });

        // Replay Option Toggle
        if (elements.replaySelect) {
            elements.replaySelect.addEventListener('change', () => {
                if (elements.replaySelect.value === 'custom') {
                    elements.customReplayField.style.display = 'flex';
                } else {
                    elements.customReplayField.style.display = 'none';
                }
            });
        }

        // Subscribe Button
        if (elements.subscribeBtn) {
            elements.subscribeBtn.addEventListener('click', handleSubscribe);
        }

        // Search Filter Input
        if (elements.feedSearchInput) {
            elements.feedSearchInput.addEventListener('input', renderFeedList);
        }

        // Pause/Resume Stream
        if (elements.pauseBtn) {
            elements.pauseBtn.addEventListener('click', () => {
                isPaused = !isPaused;
                if (isPaused) {
                    elements.pauseBtn.style.background = 'rgba(251, 146, 60, 0.2)';
                    elements.pauseBtn.style.borderColor = 'rgba(251, 146, 60, 0.4)';
                    elements.lblPause.textContent = 'Resume';
                } else {
                    elements.pauseBtn.style.background = '';
                    elements.pauseBtn.style.borderColor = '';
                    elements.lblPause.textContent = 'Pause';
                    if (!selectedEventId && eventLog.length) selectedEventId = eventLog[0].id;
                    renderFeedList();
                    if (selectedEventId) renderEventDetails(eventLog.find(item => item.id === selectedEventId) || null);
                }
            });
        }

        // Clear Feed
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', () => {
                eventLog = [];
                selectedEventId = null;
                renderFeedList();
                renderEventDetails(null);
            });
        }

        // Export Payload JSON
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportEventLog);
        }

        // Copy JSON Button
        if (elements.copyJsonBtn) {
            elements.copyJsonBtn.addEventListener('click', () => {
                if (elements.eventDetailCode) {
                    navigator.clipboard.writeText(elements.eventDetailCode.textContent);
                    showToast('Copied JSON payload to clipboard!');
                }
            });
        }

        // Refresh Limits Button
        if (elements.refreshLimitsBtn) {
            elements.refreshLimitsBtn.addEventListener('click', loadEventLimits);
        }
    }

    // Handle Subscription Request
    async function handleSubscribe() {
        let channel = elements.customChannelInput.value.trim();

        if (!channel && elements.platformEventsSelect.value) {
            channel = elements.platformEventsSelect.value;
        }
        if (!channel && elements.cdcEventsSelect.value) {
            channel = elements.cdcEventsSelect.value;
        }

        if (!channel) {
            toast.error('Please select or enter an event channel/topic to subscribe (e.g. /event/Order_Event__e or /data/ChangeEvents)');
            return;
        }

        if (!channel.startsWith('/')) {
            channel = '/' + channel;
        }

        let replayId = -1;
        if (elements.replaySelect.value === '-2') {
            replayId = -2;
        } else if (elements.replaySelect.value === 'custom') {
            const parsedReplayId = Number.parseInt(elements.customReplayInput.value, 10);
            if (!Number.isInteger(parsedReplayId) || parsedReplayId < 0) {
                toast.error('Enter a valid replay ID of 0 or greater.');
                return;
            }
            replayId = parsedReplayId;
        }

        if (activeSubscriptions.has(channel) || pendingSubscriptions.has(channel)) {
            showToast(`Already subscribed to ${channel}`);
            return;
        }

        pendingSubscriptions.add(channel);
        elements.subscribeBtn.disabled = true;
        try {
            if (!isConnected) {
                const connected = await startCometDHandshake();
                if (!connected) throw new Error('CometD handshake failed');
            }
            const subscribed = await sendBayeuxSubscribe(channel, replayId);
            if (!subscribed) throw new Error(`Salesforce rejected subscription to ${channel}`);
            activeSubscriptions.set(channel, replayId);
            renderActiveSubscriptions();
        } catch (error) {
            showToast(`Subscription failed: ${error.message}`);
        } finally {
            pendingSubscriptions.delete(channel);
            elements.subscribeBtn.disabled = false;
        }
    }

    // Render Active Subscription Chips
    function renderActiveSubscriptions() {
        if (!elements.activeSubsContainer) return;
        elements.activeSubsContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-sub);">Active Channels:</span>';

        if (activeSubscriptions.size === 0) {
            elements.activeSubsContainer.appendChild(elements.emptySubsMsg);
            return;
        }

        activeSubscriptions.forEach((replayId, channel) => {
            const chip = document.createElement('div');
            chip.className = 'sub-chip';
            chip.innerHTML = `
                <span>${escapeHtml(channel)} (${replayId})</span>
                <i class="fa-solid fa-xmark remove-btn" title="Unsubscribe"></i>
            `;
            chip.querySelector('.remove-btn').addEventListener('click', () => handleUnsubscribe(channel));
            elements.activeSubsContainer.appendChild(chip);
        });
    }

    // Handle Unsubscribe
    async function handleUnsubscribe(channel) {
        if (pendingUnsubscriptions.has(channel)) return;
        pendingUnsubscriptions.add(channel);
        try {
            if (isConnected && clientId) {
                const acknowledged = await sendBayeuxUnsubscribe(channel);
                if (!acknowledged) throw new Error('Salesforce rejected the unsubscribe request');
            }
            activeSubscriptions.delete(channel);
            renderActiveSubscriptions();
        } catch (error) {
            showToast(`Unsubscribe failed: ${error.message}`);
        } finally {
            pendingUnsubscriptions.delete(channel);
        }
    }

    // Bayeux CometD Handshake
    async function startCometDHandshake() {
        if (isConnecting) {
            for (let i = 0; i < 100 && isConnecting; i++) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return isConnected;
        }
        if (!sessionId || !instanceUrl) {
            setConnectionState('disconnected', 'Session Missing');
            return false;
        }

        isConnecting = true;
        setConnectionState('connecting', 'Handshaking...');

        const endpoint = `${instanceUrl}/cometd/60.0`;
        const body = [{
            channel: '/meta/handshake',
            version: '1.0',
            minimumVersion: '1.0',
            supportedConnectionTypes: ['long-polling'],
            ext: { replay: true }
        }];

        try {
            const res = await makeBayeuxRequest(endpoint, body);
            if (res && res[0] && res[0].successful) {
                clientId = res[0].clientId;
                isConnected = true;
                isConnecting = false;
                setConnectionState('connected', 'Connected');

                // Re-establish only subscriptions Salesforce acknowledges.
                for (const [channel, replayId] of [...activeSubscriptions.entries()]) {
                    const acknowledged = await sendBayeuxSubscribe(channel, replayId);
                    if (!acknowledged) activeSubscriptions.delete(channel);
                }
                renderActiveSubscriptions();

                // Start Long-Polling Loop
                consecutivePollFailures = 0;
                sessionRefreshAttempted = false;
                startLongPolling();
                return true;
            } else {
                const errMsg = res && res[0] && res[0].error ? res[0].error : 'Handshake failed';
                setConnectionState('disconnected', errMsg);
                isConnecting = false;
                return false;
            }
        } catch (e) {
            console.error('Bayeux Handshake Error:', e);
            setConnectionState('disconnected', e.message);
            isConnecting = false;
            return false;
        }
    }

    // Bayeux Subscribe Message
    async function sendBayeuxSubscribe(channel, replayId) {
        if (!clientId || !isConnected) return false;
        const endpoint = `${instanceUrl}/cometd/60.0`;

        const extReplay = {};
        extReplay[channel] = replayId;

        const body = [{
            channel: '/meta/subscribe',
            clientId: clientId,
            subscription: channel,
            ext: { replay: extReplay }
        }];

        try {
            const res = await makeBayeuxRequest(endpoint, body);
            if (res && res[0] && res[0].successful) {
                showToast(`Subscribed to ${channel}`);
                return true;
            } else {
                throw new Error(res && res[0] && res[0].error ? res[0].error : 'Subscription failed');
            }
        } catch (e) {
            console.error('Subscribe Error:', e);
            return false;
        }
    }

    // Bayeux Unsubscribe Message
    async function sendBayeuxUnsubscribe(channel) {
        if (!clientId || !isConnected) return false;
        const endpoint = `${instanceUrl}/cometd/60.0`;

        const body = [{
            channel: '/meta/unsubscribe',
            clientId: clientId,
            subscription: channel
        }];

        try {
            const res = await makeBayeuxRequest(endpoint, body);
            if (!res || !res[0] || !res[0].successful) throw new Error(res && res[0] && res[0].error ? res[0].error : 'Unsubscribe failed');
            showToast(`Unsubscribed from ${channel}`);
            return true;
        } catch (e) {
            console.error('Unsubscribe Error:', e);
            return false;
        }
    }

    // Bayeux Long Polling Loop
    async function startLongPolling() {
        if (!isConnected || !clientId || isShuttingDown) return;

        const endpoint = `${instanceUrl}/cometd/60.0`;
        const body = [{
            channel: '/meta/connect',
            clientId: clientId,
            connectionType: 'long-polling'
        }];

        try {
            const res = await makeBayeuxRequest(endpoint, body);
            if (res && Array.isArray(res)) {
                res.forEach(msg => {
                    if (msg.channel && !msg.channel.startsWith('/meta/')) {
                        // Data Message Received
                        processIncomingEvent(msg);
                    }
                });

                // Check connect response status
                const connectMeta = res.find(m => m.channel === '/meta/connect');
                if (connectMeta && connectMeta.successful) {
                    consecutivePollFailures = 0;
                    // Continue long polling loop immediately
                    if (isConnected) {
                        longPollTimer = setTimeout(startLongPolling, 0);
                    }
                } else if (connectMeta && connectMeta.advice && connectMeta.advice.reconnect === 'handshake') {
                    // Re-handshake requested by server
                    clientId = null;
                    isConnected = false;
                    longPollTimer = setTimeout(startCometDHandshake, 1000);
                } else if (connectMeta && connectMeta.advice && connectMeta.advice.reconnect === 'none') {
                    isConnected = false;
                    clientId = null;
                    clearTimeout(longPollTimer);
                    setConnectionState('disconnected', connectMeta.error || 'Server Disconnected');
                } else {
                    await handlePollFailure(new Error(connectMeta && connectMeta.error ? connectMeta.error : 'Connect rejected'));
                }
            }
        } catch (e) {
            console.warn('Long polling connection issue:', e);
            await handlePollFailure(e);
        }
    }

    async function handlePollFailure(error) {
        if (isShuttingDown || !isConnected) return;
        consecutivePollFailures++;
        const isAuthFailure = error && (error.status === 401 || /401|invalid.*session|authentication/i.test(error.message || ''));
        if (isAuthFailure && !sessionRefreshAttempted) {
            sessionRefreshAttempted = true;
            isConnected = false;
            clientId = null;
            const refreshed = await resolveSalesforceSession();
            if (refreshed && !isShuttingDown) {
                longPollTimer = setTimeout(startCometDHandshake, 500);
                return;
            }
        }
        if (consecutivePollFailures >= MAX_POLL_FAILURES || isAuthFailure) {
            isConnected = false;
            clientId = null;
            clearTimeout(longPollTimer);
            setConnectionState('disconnected', isAuthFailure ? 'Authentication Failed' : 'Connection Failed');
            showToast('Event stream stopped after repeated connection failures. Reconnect by subscribing again.');
            return;
        }
        const delay = Math.min(1000 * (2 ** (consecutivePollFailures - 1)), 15000);
        setConnectionState('connecting', `Retrying (${consecutivePollFailures}/${MAX_POLL_FAILURES})...`);
        longPollTimer = setTimeout(startLongPolling, delay);
    }

    // Process Received Bayeux Event
    function processIncomingEvent(msg) {
        const payloadData = msg.data || {};
        const eventMeta = payloadData.event || {};
        const replayId = eventMeta.replayId ?? 'N/A';
        const eventTime = eventMeta.eventCreationTime ? new Date(eventMeta.eventCreationTime).toLocaleTimeString() : new Date().toLocaleTimeString();

        // Determine Change Type for CDC
        let changeType = null;
        if (payloadData.payload && payloadData.payload.ChangeEventHeader) {
            changeType = payloadData.payload.ChangeEventHeader.changeType;
        }

        const eventItem = {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            channel: msg.channel,
            replayId: replayId,
            timestamp: eventTime,
            changeType: changeType,
            schema: payloadData.schema || 'N/A',
            raw: msg
        };

        eventLog.unshift(eventItem);
        if (eventLog.length > 500) {
            eventLog.pop(); // Keep max 500 events in buffer
        }

        // Pause freezes display, not collection. Buffered events appear on resume.
        if (!isPaused && !selectedEventId) {
            selectedEventId = eventItem.id;
            renderEventDetails(eventItem);
        }

        if (!isPaused) renderFeedList();
    }

    // Render Event Feed List
    function renderFeedList() {
        if (!elements.eventFeedList) return;

        const searchQuery = (elements.feedSearchInput?.value || '').toLowerCase().trim();
        const filteredEvents = eventLog.filter(item => {
            if (!searchQuery) return true;
            const str = JSON.stringify(item).toLowerCase();
            return str.includes(searchQuery);
        });

        if (elements.feedCounter) {
            elements.feedCounter.textContent = `${filteredEvents.length} events`;
        }

        if (filteredEvents.length === 0) {
            elements.eventFeedList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-satellite"></i>
                    <div>${eventLog.length === 0 ? 'No events received yet.' : 'No matching events.'}</div>
                </div>
            `;
            return;
        }

        elements.eventFeedList.innerHTML = '';
        filteredEvents.forEach(item => {
            const isCdc = item.channel.startsWith('/data/');
            const card = document.createElement('div');
            card.className = `event-card ${item.id === selectedEventId ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="event-card-header">
                    <span class="event-topic ${isCdc ? 'cdc' : ''}">${escapeHtml(item.channel)}</span>
                    ${item.changeType ? `<span class="event-badge ${item.changeType}">${item.changeType}</span>` : ''}
                </div>
                <div class="event-card-meta">
                    <span>Replay ID: ${item.replayId}</span>
                    <span>Time: ${item.timestamp}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                selectedEventId = item.id;
                renderFeedList();
                renderEventDetails(item);
            });

            elements.eventFeedList.appendChild(card);
        });
    }

    // Render Event JSON Details
    function renderEventDetails(item) {
        if (!elements.eventDetailCode) return;
        if (!item) {
            elements.eventDetailCode.textContent = 'Select an event from the feed list to view its raw payload and metadata details.';
            return;
        }
        elements.eventDetailCode.textContent = JSON.stringify(item.raw, null, 2);
    }

    // Load Platform Events & CDC Entities
    async function loadEntitySuggestions() {
        if (!sessionId || !instanceUrl) return;

        try {
            // Query Platform Events (%__e)
            const peQuery = `SELECT QualifiedApiName, MasterLabel FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e'`;
            const peRes = await makeRestQuery(peQuery);
            if (peRes && peRes.records) {
                elements.platformEventsSelect.innerHTML = '<option value="">Select Platform Event...</option>';
                peRes.records.forEach(rec => {
                    const opt = document.createElement('option');
                    opt.value = `/event/${rec.QualifiedApiName}`;
                    opt.textContent = `${rec.MasterLabel} (/event/${rec.QualifiedApiName})`;
                    elements.platformEventsSelect.appendChild(opt);
                });
            }

            // Query CDC Objects
            const cdcQuery = `SELECT QualifiedApiName, MasterLabel FROM EntityDefinition WHERE IsChangeDataCaptureEnabled = true`;
            const cdcRes = await makeRestQuery(cdcQuery);
            if (cdcRes && cdcRes.records) {
                elements.cdcEventsSelect.innerHTML = `
                    <option value="">Select CDC Object...</option>
                    <option value="/data/ChangeEvents">All Change Events (/data/ChangeEvents)</option>
                `;
                cdcRes.records.forEach(rec => {
                    const cdcChannel = rec.QualifiedApiName.endsWith('__c')
                        ? `/data/${rec.QualifiedApiName.replace('__c', '__ChangeEvent')}`
                        : `/data/${rec.QualifiedApiName}ChangeEvent`;
                    const opt = document.createElement('option');
                    opt.value = cdcChannel;
                    opt.textContent = `${rec.MasterLabel} (${cdcChannel})`;
                    elements.cdcEventsSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('Entity discovery warning:', e);
        }
    }

    // Load Event & Streaming Limits Dashboard
    async function loadEventLimits() {
        if (!elements.limitsGrid) return;

        const refreshIcon = elements.refreshLimitsBtn ? elements.refreshLimitsBtn.querySelector('.fa-rotate-right') : null;
        const stopSpin = () => { if (refreshIcon) refreshIcon.classList.remove('rotating'); };
        if (refreshIcon) refreshIcon.classList.add('rotating');

        if (!sessionId || !instanceUrl) {
            elements.limitsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">Salesforce session not available.</div>`;
            stopSpin();
            return;
        }

        elements.limitsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <span class="comet-loader-inline"></span>
                <div>Querying Org Streaming Governor Limits...</div>
            </div>
        `;

        try {
            const url = `${instanceUrl}/services/data/v60.0/limits`;
            const limits = await makeRestFetch(url);

            if (!limits || typeof limits !== 'object') {
                throw new Error('Failed to retrieve limit allocations.');
            }

            // Filter Event & Streaming related limits
            const eventKeys = [
                'DailyDurableStreamingApiEvents',
                'DailyStandardVolumePlatformEvents',
                'StreamingApiConcurrentClients',
                'DailyGenericStreamingApiEvents',
                'HourlyPublishedPlatformEvents',
                'HourlyPublishedCustomEvents',
                'DailyDeliveredPlatformEvents'
            ];

            const foundKeys = Object.keys(limits).filter(k => eventKeys.includes(k) || k.toLowerCase().includes('event') || k.toLowerCase().includes('streaming'));

            elements.limitsGrid.innerHTML = '';
            if (foundKeys.length === 0) {
                elements.limitsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No streaming event limits returned for this Salesforce Org edition.</div>`;
                return;
            }

            foundKeys.forEach(key => {
                const item = limits[key];
                const max = item.Max || 0;
                const remaining = item.Remaining || 0;
                const used = max - remaining;
                const pct = max > 0 ? Math.min(Math.round((used / max) * 100), 100) : 0;

                let badgeClass = 'good';
                let badgeText = 'Normal';
                let progressClass = '';

                if (pct >= 90) {
                    badgeClass = 'danger';
                    badgeText = 'Critical';
                    progressClass = 'danger';
                } else if (pct >= 70) {
                    badgeClass = 'warning';
                    badgeText = 'High';
                    progressClass = 'warning';
                }

                const card = document.createElement('div');
                card.className = 'limit-card';
                card.innerHTML = `
                    <div class="limit-card-header">
                        <span class="limit-card-title">${escapeHtml(key)}</span>
                        <span class="limit-card-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="limit-stat-row">
                        <span class="limit-val-main">${used.toLocaleString()}</span>
                        <span class="limit-val-sub">of ${max.toLocaleString()} max</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${progressClass}" style="width: ${pct}%;"></div>
                    </div>
                    <div style="font-size: 11px; color: var(--text-sub); display: flex; justify-content: space-between;">
                        <span>${pct}% used</span>
                        <span>${remaining.toLocaleString()} remaining</span>
                    </div>
                `;
                elements.limitsGrid.appendChild(card);
            });
        } catch (e) {
            console.error('Failed to load event limits:', e);
            elements.limitsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; color: var(--accent-red);">Failed to load limits: ${escapeHtml(e.message)}</div>`;
        } finally {
            stopSpin();
        }
    }

    // Export Event Log to JSON
    function exportEventLog() {
        if (eventLog.length === 0) {
            showToast('No events in buffer to export.');
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(eventLog, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `comet_event_stream_${Date.now()}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();
        showToast('Exported event log file.');
    }

    // Helper: Bayeux HTTP POST
    async function makeBayeuxRequest(endpoint, body) {
        return makeRestFetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionId}`
            },
            body: JSON.stringify(body)
        });
    }

    // Helper: REST SOQL Query
    async function makeRestQuery(soql) {
        const url = `${instanceUrl}/services/data/v60.0/query/?q=${encodeURIComponent(soql)}`;
        return makeRestFetch(url);
    }

    // Helper: Generic REST Fetch
    async function makeRestFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        if (!options.headers['Authorization']) {
            options.headers['Authorization'] = `Bearer ${sessionId}`;
        }

        if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'fetch',
                    url: url,
                    options: options
                }, (res) => {
                    if (res && res.ok) {
                        try {
                            const data = JSON.parse(res.text);
                            resolve(data);
                        } catch (e) {
                            resolve(res.text);
                        }
                    } else {
                        const error = new Error(res?.error || res?.statusText || `HTTP ${res?.status || 0}`);
                        error.status = res?.status || 0;
                        error.statusText = res?.statusText || '';
                        reject(error);
                    }
                });
            });
        } else {
            const res = await fetch(url, options);
            if (!res.ok) {
                const error = new Error(`HTTP ${res.status}`);
                error.status = res.status;
                throw error;
            }
            return res.json();
        }
    }

    function shutdownCometD() {
        if (isShuttingDown) return;
        isShuttingDown = true;
        clearTimeout(longPollTimer);
        longPollTimer = null;
        const disconnectClientId = clientId;
        isConnected = false;
        isConnecting = false;
        clientId = null;
        if (!disconnectClientId || !sessionId || !instanceUrl) return;
        // The background proxy can finish this acknowledgement after the page
        // begins unloading; no UI mutation is performed by the promise.
        makeBayeuxRequest(`${instanceUrl}/cometd/60.0`, [{
            channel: '/meta/disconnect',
            clientId: disconnectClientId
        }]).catch(() => {});
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Simple Toast Notification
    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1f2937;
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #374151;
            font-size: 12px;
            font-weight: 500;
            z-index: 9999;
            box-shadow: 0 4px 14px rgba(0,0,0,0.4);
            animation: fadeIn 0.2s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // Boot Event Monitor
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
