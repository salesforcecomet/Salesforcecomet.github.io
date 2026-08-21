class SalesforceAPI {
    constructor() {
        this.sessionId = null;
        this.instanceUrl = null;
        this.apiVersion = 'v60.0';
        this.initPromise = null;
        this.lastInvalidSessionId = null;
        this.sessionBlacklist = new Set();
        this.retryCount = 0;
        this.maxRetries = 1;
        this.recoveryPromise = null;

        this._cache = new Map();
        this._cacheTTL = {
            describeGlobal: 10 * 60 * 1000,
            describeSObject: 10 * 60 * 1000,
            query: 30 * 1000,
            limits: 15 * 1000
        };
        this._cacheMaxSize = 200;
        this._inflight = new Map();
    }

    _cacheKey(prefix, ...parts) {
        return prefix + '|' + (this.instanceUrl || '') + '|' + parts.map(p => String(p ?? '')).join('||');
    }

    _cacheGet(key) {
        const entry = this._cache.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.ts > entry.ttl) {
            this._cache.delete(key);
            return undefined;
        }
        return entry.value;
    }

    _cacheSet(key, value, ttl) {
        if (this._cache.size >= this._cacheMaxSize) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        this._cache.set(key, { value, ts: Date.now(), ttl });
    }

    _cacheInvalidatePattern(prefix) {
        for (const key of this._cache.keys()) {
            if (key.startsWith(prefix + '|')) {
                this._cache.delete(key);
            }
        }
    }

    _sessionUnavailable(operation = 'Salesforce API request') {
        const error = new Error(`${operation} requires an active Salesforce session. Open the target org, sign in, and retry.`);
        error.name = 'SalesforceSessionUnavailableError';
        error.code = 'SESSION_UNAVAILABLE';
        return error;
    }

    normalizeInstanceUrl(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            let origin = parsed.origin;
            if (origin.includes('.lightning.force.com')) {
                origin = origin.replace('.lightning.force.com', '.my.salesforce.com');
            }
            // Trailblazer (dev org) setup hosts are xxx.trailblaze.my.salesforce-setup.com.
            // Handle the trailblaze form before the generic one so the replace never
            // doubles .my. into a non-resolvable xxx.trailblaze.my.my.salesforce.com.
            if (origin.includes('.trailblaze.my.salesforce-setup.com')) {
                origin = origin.replace('.trailblaze.my.salesforce-setup.com', '.trailblaze.my.salesforce.com');
            }
            if (origin.includes('.my.salesforce-setup.com')) {
                origin = origin.replace('.my.salesforce-setup.com', '.my.salesforce.com');
            }
            // Collapse any already-doubled .my. (older stored sessions).
            origin = origin.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
            return origin;
        } catch (e) {
            return null;
        }
    }

    getCurrentContextInstanceUrl() {
        if (typeof window === 'undefined' || window.location.protocol === 'chrome-extension:') {
            return null;
        }
        if (!/salesforce|force\.com/.test(window.location.hostname)) {
            return null;
        }
        return this.normalizeInstanceUrl(window.location.origin);
    }

    isSalesforceTabUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

            const hostname = parsed.hostname.toLowerCase();
            return ['salesforce.com', 'force.com', 'salesforce-setup.com'].some(domain =>
                hostname === domain || hostname.endsWith(`.${domain}`)
            );
        } catch (e) {
            return false;
        }
    }

    shouldRefreshForCurrentContext() {
        const contextInstanceUrl = this.getCurrentContextInstanceUrl();
        if (!contextInstanceUrl || !this.instanceUrl) return false;
        return this.normalizeInstanceUrl(this.instanceUrl) !== contextInstanceUrl;
    }

    async init(forceRefresh = false) {
        // If forceRefresh is true, clear the cached promise to force re-initialization
        if (forceRefresh) {
            this.initPromise = null;
        }

        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            // Silently initialize session
            const oldSessionId = this.sessionId;
            this.sessionId = null;
            this.instanceUrl = null;

            // Check if we're on an extension page (data-export.html, etc.)
            const isExtensionPage = window.location.protocol === 'chrome-extension:';

            // An extension page may carry a host pin (?host=...). When it does,
            // EVERY session source must belong to that org — with multiple orgs
            // signed in, an unrelated cached/active-tab session would leak the
            // wrong org's data, files and errors into this page.
            const urlParams = isExtensionPage ? new URLSearchParams(window.location.search) : null;
            const pageHost = urlParams ? (urlParams.get('host') || urlParams.get('sfHost') || '').toLowerCase() : '';
            const pageInstanceUrl = pageHost ? this.normalizeInstanceUrl(`https://${pageHost}`) : null;

            // 0. PRE-CACHED SESSION: Background.js stores the session right before opening
            //    a new extension tab (e.g. log-viewer). By the time the new tab calls init(),
            //    the tab itself IS the active tab, so getSessionFromActiveTab() would fail.
            //    We check the pre-cached session first to avoid this race condition.
            if (isExtensionPage && typeof chrome !== 'undefined' && chrome.storage) {
                try {
                    const stored = await new Promise(resolve => chrome.storage.session.get(['sfarc_cached_session', 'sessionInfo'], resolve));
                    const cached = (stored && stored.sfarc_cached_session) || (stored && stored.sessionInfo);
                    const SESSION_CACHE_TTL_MS = 600000; // 10 minute TTL for extension pages
                    if (cached && cached.sessionId && cached.instanceUrl && !cached.instanceUrl.startsWith('chrome-extension:') &&
                        Number.isFinite(cached.timestamp) && cached.timestamp > 0 &&
                        (Date.now() - cached.timestamp) >= 0 &&
                        (Date.now() - cached.timestamp) < SESSION_CACHE_TTL_MS) {
                        // The pre-cached session may belong to a different org —
                        // only use it when this page has no host pin or it matches.
                        const cachedMatchesPage = !pageInstanceUrl || this.normalizeInstanceUrl(cached.instanceUrl) === pageInstanceUrl;
                        if (cachedMatchesPage) {
                            this.sessionId = cached.sessionId;
                            // Sanitize a stored URL that may carry an old doubled .my.
                            // (xxx.trailblaze.my.my.salesforce.com) so fetches target a
                            // real, resolvable host instead of failing at the network layer.
                            this.instanceUrl = this.normalizeInstanceUrl(cached.instanceUrl) || cached.instanceUrl;
                            console.debug('salesforce comet: Loaded stored session for extension page:', this.instanceUrl);
                        } else {
                            console.warn('salesforce comet: Ignoring cached session for a different org than', pageHost);
                        }
                    }
                } catch (e) {
                    console.warn('salesforce comet: Could not read cached session', e);
                }
            }

            // 1. Try to get session from Active Tab (Message Passing) — only if not already found
            if (isExtensionPage && !this.sessionId) {
                try {
                    const sessionInfo = await this.getSessionFromActiveTab();
                    if (sessionInfo && sessionInfo.sessionId) {
                        // The active tab may belong to another org — only accept
                        // its session when it matches this page's host pin.
                        const sessionMatchesPage = !pageInstanceUrl ||
                            (sessionInfo.instanceUrl && this.normalizeInstanceUrl(sessionInfo.instanceUrl) === pageInstanceUrl);
                        if (sessionMatchesPage) {
                            this.sessionId = sessionInfo.sessionId;
                            this.instanceUrl = sessionInfo.instanceUrl;
                            // Session re-acquired from active tab
                        } else {
                            console.warn('salesforce comet: Ignoring active-tab session from a different org context than', pageHost);
                        }
                    }
                } catch (e) {
                    // Silent — expected when the Salesforce org is offline or session not yet initialized
                }
            } else if (!isExtensionPage) {
                // Context: Salesforce Page (Injected)
                // Try global variable
                if (typeof window.__SF_SESSION_INFO__ !== 'undefined' && window.__SF_SESSION_INFO__.sessionId) {
                    const contextInstanceUrl = this.getCurrentContextInstanceUrl();
                    const sessionInstanceUrl = this.normalizeInstanceUrl(window.__SF_SESSION_INFO__.serverUrl || window.location.origin);
                    if (!contextInstanceUrl || contextInstanceUrl === sessionInstanceUrl) {
                        this.sessionId = window.__SF_SESSION_INFO__.sessionId;
                        this.instanceUrl = sessionInstanceUrl || window.location.origin;
                        // Session found from global __SF_SESSION_INFO__
                    } else {
                        console.warn('salesforce comet: Ignoring session info from a different org context.');
                    }
                }
            }

            // 2. Fallback: Try to get from cookies via Background Script
            if (!this.sessionId && typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    if (chrome.tabs && chrome.tabs.query) {
                        const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
                        const urlParams = isExtensionPage ? new URLSearchParams(window.location.search) : null;
                        const targetHost = urlParams?.get('host') || urlParams?.get('sfHost');
                        const targetInstanceUrl = targetHost ? this.normalizeInstanceUrl(`https://${targetHost}`) : null;
                        const sfTab = tabs.find(t =>
                            targetInstanceUrl && this.normalizeInstanceUrl(t.url) === targetInstanceUrl
                        ) || (targetInstanceUrl ? null : tabs.find(t => this.isSalesforceTabUrl(t.url)));

                        if (sfTab) {
                            const urlObj = new URL(sfTab.url);
                            this.instanceUrl = urlObj.origin;

                            let cookieDomain = urlObj.hostname;
                            if (this.instanceUrl.includes('.lightning.force.com')) {
                                this.instanceUrl = this.instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
                                cookieDomain = new URL(this.instanceUrl).hostname;
                            }

                            const allCookies = await this.getAllCookies(cookieDomain);
                            const sessionCookieNames = ['sid', 'sid_Client', '__Host-sid'];
                            for (const cookieName of sessionCookieNames) {
                                const cookie = allCookies.find(c => c.name === cookieName);
                                if (cookie && cookie.value) {
                                    this.sessionId = decodeURIComponent(cookie.value);
                                    // Session found from background cookies
                                    break;
                                }
                            }
                        }
                    }

                    // With a host pin (?host=...), never fall back to an unrelated
                    // org's cookie — the page must stay bound to its own org.
                    if (!this.sessionId && !pageInstanceUrl) {
                        const sessionCookie = await this.getCookie('sid');
                        if (sessionCookie) {
                            this.sessionId = decodeURIComponent(sessionCookie.value);
                            const contextInstanceUrl = this.getCurrentContextInstanceUrl();
                            if (contextInstanceUrl) {
                                this.instanceUrl = contextInstanceUrl;
                            } else {
                                let domain = sessionCookie.domain;
                                if (domain.startsWith('.')) domain = domain.substring(1);
                                this.instanceUrl = `https://${domain}`;
                            }
                            // Session found from generic cookie fetch
                        }
                    }
                } catch (e) {
                    console.warn('salesforce comet: Could not get cookie from background', e);
                }
            }

            // 3. Last Resort: document.cookie (Only works in Content Script context)
            if (!this.sessionId && !isExtensionPage) {
                const cookies = document.cookie.split(';');
                for (let cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === 'sid') {
                        const decodedValue = decodeURIComponent(value);
                        // Check if this session is blacklisted
                        if (!this.sessionBlacklist.has(decodedValue)) {
                            this.sessionId = decodedValue;
                            this.instanceUrl = this.getCurrentContextInstanceUrl() || window.location.origin;
                            // Session found from document.cookie
                            break;
                        } else {
                            console.debug('salesforce comet: Skipping a blacklisted session from document.cookie.');
                        }
                    }
                }
            }

            if (this.instanceUrl && this.instanceUrl.includes('.lightning.force.com')) {
                this.instanceUrl = this.instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
            }

            if (this.sessionId && this.instanceUrl) {
                const urlObj = new URL(this.instanceUrl);
                const domain = urlObj.hostname;
                // Basic check: at least one of them should contain the other or be subdomains
                const isMatch = domain.includes('salesforce.com') || domain.includes('force.com');
                if (!isMatch) {
                    console.warn('salesforce comet: Session domain mismatch detected. Instance URL:', this.instanceUrl);
                }
            }

            if (this.sessionId === oldSessionId && oldSessionId !== null) {
                // Silent — same session ID returned is routine during recovery; not an error
            }
        })();

        // Clear the promise cache after it resolves so next forceRefresh call works
        this.initPromise.finally(() => {
            this.initPromise = null;
        });

        return this.initPromise;
    }

    async getSessionFromActiveTab() {
        // This method only works in extension pages (not content scripts)
        if (!chrome.tabs || !chrome.tabs.query) {
            console.warn('salesforce comet: chrome.tabs not available in this context');
            return null;
        }

        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || tabs.length === 0) {
                    resolve(null);
                    return;
                }

                const activeTab = tabs[0];
                
                // Check if it's a Salesforce tab
                if (!activeTab.url || !this.isSalesforceTabUrl(activeTab.url)) {
                    // Try to find any Salesforce tab
                    chrome.tabs.query({}, (allTabs) => {
                        let sfTabs = allTabs.filter(tab => tab.url && this.isSalesforceTabUrl(tab.url));
                        const urlParams = new URLSearchParams(window.location.search);
                        const targetHost = urlParams.get('host') || urlParams.get('sfHost');
                        const targetInstanceUrl = targetHost ? this.normalizeInstanceUrl(`https://${targetHost}`) : null;

                        // An extension page can be opened for a specific org.
                        // Prefer that org instead of an unrelated Salesforce tab.
                        if (targetInstanceUrl) {
                            const matchingTabs = sfTabs.filter(tab =>
                                this.normalizeInstanceUrl(tab.url) === targetInstanceUrl
                            );
                            if (matchingTabs.length > 0) sfTabs = matchingTabs;
                        }

                        if (sfTabs.length > 0) {
                            // Priority Sort: Prefer "standard" UI pages over Developer Console/Setup/etc
                            sfTabs.sort((a, b) => {
                                const score = (url) => {
                                    if (url.includes('/lightning/')) return 3; // Best: Lightning App
                                    if (url.includes('/one/one.app')) return 3;
                                    if (url.includes('/home/home.jsp')) return 2; // Classic Home
                                    if (url.includes('ApexCSIPage')) return -1; // Worst: Dev Console (often tricky)
                                    return 1; // Standard
                                };
                                return score(b.url) - score(a.url);
                            });

                            const bestTab = sfTabs[0];
                            this.requestSessionFromTab(bestTab.id, resolve);
                        } else {
                            resolve(null);
                        }
                    });
                    return;
                }

                this.requestSessionFromTab(activeTab.id, resolve);
            });
        });
    }


    requestSessionFromTab(tabId, resolve, retryCount = 0) {
        // Send message to content script to get session
        chrome.tabs.sendMessage(tabId, { action: 'getSession' }, (response) => {
            const lastError = chrome.runtime.lastError;

            // Success Path
            if (!lastError && response && response.sessionId) {
                resolve(response);
                return;
            }

            // Failure Path - Logic to retry or fallback
            if (lastError) {
                const isConnectionError = lastError.message.includes('Receiving end does not exist');
                if (isConnectionError && retryCount < 2) {
                    // Try injecting content script first
                    console.log(`Content script not responding, attempting to inject... (attempt ${retryCount + 1}/2)`);

                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['src/content.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Failed to inject content script:', chrome.runtime.lastError.message);
                            // Wait a bit and retry
                            setTimeout(() => {
                                this.requestSessionFromTab(tabId, resolve, retryCount + 1);
                            }, 500);
                        } else {
                            console.log('Content script injected, retrying message...');
                            // Wait for content script to initialize
                            setTimeout(() => {
                                this.requestSessionFromTab(tabId, resolve, retryCount + 1);
                            }, 1000);
                        }
                    });
                    return;
                }
                console.warn('Messaging failed:', lastError.message);
            } else {
                console.warn('Messaging succeeded but returned no session.');
            }

            console.log('Attempting direct script injection fallback...');

            // FALLBACK: Direct script injection to extract session
            if (chrome.scripting) {
                try {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: () => {
                            try {
                                // Try multiple methods to get session
                                if (window.__SF_SESSION_INFO__) {
                                    return {
                                        sessionId: window.__SF_SESSION_INFO__.sessionId,
                                        instanceUrl: window.__SF_SESSION_INFO__.serverUrl || window.location.origin
                                    };
                                }

                                // Try cookie
                                if (document.cookie) {
                                    const match = document.cookie.match(/(^|;\s*)sid=([^;]*)/);
                                    if (match) {
                                        return {
                                            sessionId: decodeURIComponent(match[2]),
                                            instanceUrl: window.location.origin
                                        };
                                    }
                                }

                            } catch (e) {
                                return { error: e.message };
                            }
                            return null;
                        }
                    }, (results) => {
                        if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
                            console.warn('Script injection failed or found nothing.');
                            console.warn('⚠️ Please refresh the Salesforce tab to enable the extension.');
                            resolve(null);
                        } else {
                            const result = results[0].result;
                            if (result && result.error) {
                                console.error('Injection error:', result.error);
                                resolve(null);
                            } else {
                                console.log('Successfully retrieved session via injection!', result);
                                resolve(result);
                            }
                        }
                    });
                } catch (e) {
                    console.error('Injection error:', e);
                    resolve(null);
                }
            } else {
                console.warn('chrome.scripting API not available');
                resolve(null);
            }
        });
    }


    async getCookie(name) {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            return null;
        }
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({
                    action: 'getCookie',
                    name: name,
                    blacklist: Array.from(this.sessionBlacklist)
                }, (response) => {
                    resolve(response);
                });
            } catch (e) {
                resolve(null);
            }
        });
    }

    async getAllCookies(domain) {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            return [];
        }
        return new Promise((resolve) => {
            try {
                chrome.cookies.getAll({ domain: domain }, (cookies) => {
                    if (!cookies) {
                        resolve([]);
                        return;
                    }
                    // Apply blacklist
                    const filteredCookies = cookies.filter(c => !this.sessionBlacklist.has(c.value));
                    resolve(filteredCookies);
                });
            } catch (e) {
                console.error('Error getting all cookies:', e);
                resolve([]);
            }
        });
    }

    async query(soql, useToolingApi = false, options = {}) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Query');
        }

        const cacheKey = this._cacheKey('query', useToolingApi ? '1' : '0', soql);
        const cached = options.noCache ? undefined : this._cacheGet(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const inflightKey = 'Q|' + cacheKey;
        const inflight = options.noCache ? null : this._inflight.get(inflightKey);
        if (inflight) return inflight;

        const apiType = useToolingApi ? 'tooling/' : '';
        let url = `${this.instanceUrl}/services/data/${this.apiVersion}/${apiType}query?q=${encodeURIComponent(soql)}`;

        const promise = (async () => {
            try {
                const res = await this.fetch(url);
                let result = await res.json();

                while (result && !result.done && result.nextRecordsUrl) {
                    const nextUrl = `${this.instanceUrl}${result.nextRecordsUrl}`;
                    const nextRes = await this.fetch(nextUrl);
                    const nextResult = await nextRes.json();
                    result.records = [...result.records, ...nextResult.records];
                    result.done = nextResult.done;
                    result.nextRecordsUrl = nextResult.nextRecordsUrl;
                }

                if (!options.noCache) this._cacheSet(cacheKey, result, this._cacheTTL.query);
                return result;
            } finally {
                this._inflight.delete(inflightKey);
            }
        })();

        if (!options.noCache) this._inflight.set(inflightKey, promise);
        return promise;
    }

    async create(sobject, data, useToolingApi = false) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Create');
        }
        const apiType = useToolingApi ? 'tooling/' : '';
        const url = `${this.instanceUrl}/services/data/${this.apiVersion}/${apiType}sobjects/${sobject}`;
        const response = await this.fetch(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (response && !response.ok) {
            const text = await response.text().catch(() => '');
            let errObj = text;
            try { errObj = JSON.parse(text); } catch (e) { }
            throw errObj;
        }
        this._cacheInvalidatePattern('query');
        this._cacheInvalidatePattern('describeSObject');
        this._cacheInvalidatePattern('describeGlobal');
        return response.json();
    }

    async update(sobject, id, data) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Update');
        }
        const url = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/${sobject}/${id}`;
        const response = await this.fetch(url, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        if (response && !response.ok) {
            const text = await response.text().catch(() => '');
            let errObj = text;
            try { errObj = JSON.parse(text); } catch (e) { }
            throw errObj;
        }
        this._cacheInvalidatePattern('query');
        this._cacheInvalidatePattern('describeSObject');
        return response;
    }

    async retrieve(sobject, id) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Retrieve');
        }
        const url = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/${sobject}/${id}`;
        const res = await this.fetch(url);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            let errObj = text;
            try { errObj = JSON.parse(text); } catch (e) { }
            throw errObj;
        }
        return res.json();
    }

    async delete(sobject, id, useToolingApi = false) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Delete');
        }
        const apiType = useToolingApi ? 'tooling/' : '';
        const url = `${this.instanceUrl}/services/data/${this.apiVersion}/${apiType}sobjects/${sobject}/${id}`;
        const res = await this.fetch(url, { method: 'DELETE' });
        if (res && res.ok) {
            this._cacheInvalidatePattern('query');
            this._cacheInvalidatePattern('describeSObject');
            this._cacheInvalidatePattern('describeGlobal');
        }
        return res;
    }

    // Alias for delete to match usage in content.js
    async deleteRecord(sobject, id, useToolingApi = false) {
        return this.delete(sobject, id, useToolingApi);
    }


    async composite(method, sobject, records, allOrNone = false, extraHeaders = {}) {
        // method: POST (Insert), PATCH (Update), DELETE
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw this._sessionUnavailable('Composite request');
        }

        let url = `${this.instanceUrl}/services/data/${this.apiVersion}/composite/sobjects`;
        let response;

        if (method === 'DELETE') {
            const ids = records.map(r => (typeof r === 'string' ? r : (r.Id || r.id))).join(',');
            url += `?ids=${ids}&allOrNone=${allOrNone}`;
            response = await this.fetch(url, {
                method: 'DELETE',
                headers: extraHeaders
            });
        } else {
            const payload = {
                allOrNone: allOrNone,
                records: records.map(r => {
                    const rec = { ...r };
                    if (!rec.attributes) {
                        rec.attributes = { type: sobject };
                    }
                    return rec;
                })
            };

            response = await this.fetch(url, {
                method: method,
                body: JSON.stringify(payload),
                headers: extraHeaders
            });
        }

        if (response && response.ok) {
            this._cacheInvalidatePattern('query');
            this._cacheInvalidatePattern('describeSObject');
            this._cacheInvalidatePattern('describeGlobal');
        }
        return response;
    }


    getMockQueryData(soql) {
        // Mock EntityDefinition for Object List
        if (soql.includes('EntityDefinition')) {
            return {
                totalSize: 4,
                done: true,
                records: [
                    { QualifiedApiName: 'Account', Label: 'Account' },
                    { QualifiedApiName: 'Contact', Label: 'Contact' },
                    { QualifiedApiName: 'Opportunity', Label: 'Opportunity' },
                    { QualifiedApiName: 'Case', Label: 'Case' }
                ]
            };
        }

        return {
            totalSize: 2,
            done: true,
            records: [
                { Id: '001000000000001AAA', Name: 'Acme Corp (Demo)', Type: 'Customer - Direct' },
                { Id: '001000000000002AAA', Name: 'Global Media (Demo)', Type: 'Prospect' }
            ]
        };
    }


    getMockRecordData(sobject, id) {
        return {
            Id: id || '001000000000001AAA',
            Name: 'Acme Corp (Demo)',
            Type: 'Customer - Direct',
            Industry: 'Technology',
            AnnualRevenue: 500000000,
            CreatedDate: '2023-01-01T12:00:00Z'
        };
    }


    getMockMetadata(sobject) {
        return {
            name: sobject || 'Account',
            label: sobject || 'Account',
            fields: [
                { name: 'Id', label: 'Record ID', type: 'id', createable: false },
                { name: 'Name', label: 'Name', type: 'string', createable: true, nillable: false },
                { name: 'AccountNumber', label: 'Account Number', type: 'string', createable: true },
                { name: 'Type', label: 'Account Type', type: 'picklist', createable: true, picklistValues: [{ value: 'Customer' }, { value: 'Partner' }] },
                { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', createable: true },
                { name: 'CreatedDate', label: 'Created Date', type: 'datetime', createable: false },
                { name: 'OwnerId', label: 'Owner ID', type: 'reference', createable: true, referenceTo: ['User'] }
            ]
        };
    }

    async rest(url, options = {}) {
        const res = await this.fetch(url, options);
        if (!res) throw new Error('No response received from Salesforce API.');
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            let errMsg = `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
            try {
                const errJson = JSON.parse(text);
                if (Array.isArray(errJson) && errJson[0]) {
                    errMsg = errJson[0].message || errJson[0].errorCode || errMsg;
                } else if (errJson.message) {
                    errMsg = errJson.message;
                }
            } catch (e) { }
            throw new Error(errMsg);
        }
        const text = await res.text().catch(() => '');
        if (!text || text.trim() === '') return {};
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    }

    async fetch(url, options = {}) {
        if (this.shouldRefreshForCurrentContext()) {
            await this.init(true);
        } else if (!this.sessionId) {
            await this.init();
        }

        // Normalize URL: If it starts with /, prepend instanceUrl
        let requestUrl = url;
        if (url.startsWith('/') && this.instanceUrl) {
            requestUrl = `${this.instanceUrl}${url}`;
        } else {
            const contextInstanceUrl = this.getCurrentContextInstanceUrl();
            if (contextInstanceUrl) {
                try {
                    const parsedRequestUrl = new URL(requestUrl);
                    const isSalesforceUrl = /salesforce|force\.com/.test(parsedRequestUrl.hostname);
                    const requestInstanceUrl = this.normalizeInstanceUrl(parsedRequestUrl.origin);
                    if (isSalesforceUrl && requestInstanceUrl !== contextInstanceUrl) {
                        requestUrl = `${contextInstanceUrl}${parsedRequestUrl.pathname}${parsedRequestUrl.search}${parsedRequestUrl.hash}`;
                    }
                } catch (e) {
                    // Keep the original request URL if it is not parseable.
                }
            }
        }

        if (!this.sessionId) {
            throw this._sessionUnavailable('API request');
        }

        // Guard against broken URLs caused by null instanceUrl at call time
        if (requestUrl.startsWith('null/') || requestUrl === 'null') {
            throw new Error('Session not ready. The Salesforce instance URL has not been loaded yet. Please wait a moment and retry.');
        }

        const headers = {
            'Authorization': `Bearer ${this.sessionId}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Build clean fetch options — only include valid HTTP fetch fields.
        // 'credentials' is stripped; the service worker authenticates via the
        // Authorization header. 'responseType' is honored on the response in
        // _applyResponseType(), it is not sent to the server.
        const fetchOptions = {
            method: options.method || 'GET',
            headers,
        };
        if (options.body !== undefined && options.body !== null) {
            fetchOptions.body = typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;
        }

        const isExtensionPageCtx = (typeof window !== 'undefined' && window.location && window.location.protocol === 'chrome-extension:');

        /**
         * Send one fetch request through the background proxy.
         * Returns a promise that resolves with a response-like object or rejects.
         */
        const sendProxyFetch = (fetchUrl, optionsInfo) => new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage({ action: 'fetch', url: fetchUrl, options: optionsInfo }, (response) => {
                    if (chrome.runtime.lastError) {
                        const msg = chrome.runtime.lastError.message || 'Service worker unavailable';
                        const transient = !msg.includes('Extension context invalidated');
                        reject(Object.assign(new Error(msg), { isProxyError: true, isTransientProxyError: transient, isContextInvalidated: msg.includes('Extension context invalidated') }));
                        return;
                    }
                    if (!response) {
                        reject(Object.assign(new Error('Background proxy returned empty response'), { isProxyError: true, isTransientProxyError: true }));
                        return;
                    }
                    if (response.error) {
                        const msg = response.error;
                        const transient = !(msg.includes('Invalid URL') || msg.includes('null') || msg.includes('undefined') || msg.includes('Session not ready'));
                        reject(Object.assign(new Error(response.error), { isProxyError: true, isTransientProxyError: transient }));
                        return;
                    }
                    resolve({
                        ok: !!response.ok,
                        status: response.status || 0,
                        statusText: response.statusText || '',
                        headers: new Headers(response.headers || {}),
                        text: () => Promise.resolve(response.text || ''),
                        json: () => {
                            try { return Promise.resolve(JSON.parse(response.text || '{}')); }
                            catch (e) { return Promise.reject(new Error('Failed to parse JSON response from proxy')); }
                        }
                    });
                });
            } catch (err) {
                const msg = err.message || String(err);
                reject(Object.assign(err, { isProxyError: true, isTransientProxyError: !msg.includes('Extension context invalidated'), isContextInvalidated: msg.includes('Extension context invalidated') }));
            }
        });

        const performFetch = async (fetchUrl, optionsInfo) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                const MAX_PROXY_RETRIES = 2;
                const RETRY_DELAY_MS = 600;
                let lastProxyError;

                for (let attempt = 1; attempt <= MAX_PROXY_RETRIES; attempt++) {
                    try {
                        return await sendProxyFetch(fetchUrl, optionsInfo);
                    } catch (err) {
                        lastProxyError = err;

                        if (err.isContextInvalidated) {
                            throw new Error('Extension context invalidated. Please refresh the Salesforce page.');
                        }

                        if (!err.isProxyError) {
                            if (isExtensionPageCtx) {
                                throw err;
                            }
                            break;
                        }

                        if (!err.isTransientProxyError) {
                            break;
                        }

                        if (attempt < MAX_PROXY_RETRIES) {
                            console.warn(`salesforce comet: Background proxy attempt ${attempt}/${MAX_PROXY_RETRIES} failed (${err.message}). Retrying in ${RETRY_DELAY_MS}ms...`);
                            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                        }
                    }
                }

                // All proxy retries exhausted — on extension pages CORS blocks window.fetch, so throw.
                if (isExtensionPageCtx) {
                    console.error('salesforce comet: All background proxy retries failed. Cannot use direct fetch from extension page (CORS).');
                    throw new Error('Failed to fetch — the Salesforce Comet background service worker is unavailable. Please reload the extension or the Salesforce tab.');
                }

                // Non-extension page (content script): fall back to direct fetch (silent — expected offline behaviour)
                const res = await window.fetch(fetchUrl, optionsInfo);
                const text = await res.text();
                return {
                    ok: res.ok,
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    text: () => Promise.resolve(text),
                    json: () => {
                        try { return Promise.resolve(JSON.parse(text)); }
                        catch (e) { return Promise.reject(new Error('Failed to parse JSON response')); }
                    }
                };
            } else {
                // Direct Fetch (Normal Web Context — no Chrome APIs)
                const res = await window.fetch(fetchUrl, optionsInfo);
                const text = await res.text();
                return {
                    ok: res.ok,
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    text: () => Promise.resolve(text),
                    json: () => {
                        try { return Promise.resolve(JSON.parse(text)); }
                        catch (e) { return Promise.reject(new Error('Failed to parse JSON response')); }
                    }
                };
            }
        };

        const response = await performFetch(requestUrl, fetchOptions);

        if (response.status === 401) {
            // If a recovery is already in progress, wait for it
            if (this.recoveryPromise) {
                console.log('salesforce comet: 401 - Recovery already in progress, waiting...');
                try {
                    await this.recoveryPromise;
                    // After recovery completes, retry the original request if we have a valid session
                    if (this.sessionId && !this.sessionBlacklist.has(this.sessionId)) {
                        console.log('salesforce comet: Retrying request after recovery completion...');
                        const retryHeaders = { ...headers, 'Authorization': `Bearer ${this.sessionId}` };
                        const retryResponse = await performFetch(requestUrl, { ...options, headers: retryHeaders });
                        if (retryResponse.ok) {
                            return await this._applyResponseType(retryResponse, options.responseType);
                        }
                    }
                } catch (e) {
                    // Recovery failed, propagate error
                }
                throw new Error('Session expired. Please refresh the Salesforce page to re-authenticate.');
            }

            // Check if we've already tried to recover too many times
            if (this.retryCount >= this.maxRetries) {
                console.error('salesforce comet: 401 Recovery - Maximum retry attempts exceeded.');
                this.retryCount = 0; // Reset for next time
                this.showSessionExpiredNotification();
                throw new Error('Session expired. Please refresh the Salesforce page to re-authenticate.');
            }

            // IMMEDIATELY set recovery promise to claim the lock (prevents race condition)
            let resolveRecovery, rejectRecovery;
            this.recoveryPromise = new Promise((resolve, reject) => {
                resolveRecovery = resolve;
                rejectRecovery = reject;
            });
            // The initiating request throws its own error below. Attach a
            // handler here so a failed recovery lock is not reported as a
            // second, unhandled promise rejection.
            this.recoveryPromise.catch(() => { });

            // Now do the actual recovery work
            try {
                // Session might be expired or invalid, try to re-init
                console.warn('salesforce comet: 401 Unauthorized detected.');
                console.log(`salesforce comet: 401 Diagnostics - Instance: ${this.instanceUrl}, Session present: ${Boolean(this.sessionId)}, Retry: ${this.retryCount + 1}/${this.maxRetries}`);

                this.retryCount++;
                const failedSessionId = this.sessionId;
                this.lastInvalidSessionId = failedSessionId;
                if (failedSessionId) {
                    this.sessionBlacklist.add(failedSessionId);
                    console.log('salesforce comet: Blacklisted expired session.');
                }
                this.sessionId = null; // Clear invalid session

                // Try multiple times with exponential backoff
                let recoveryAttempt = 0;
                const maxRecoveryAttempts = 3;
                let recoverySuccess = false;

                while (recoveryAttempt < maxRecoveryAttempts && !recoverySuccess) {
                    recoveryAttempt++;

                    // Add delay with exponential backoff (0ms, 500ms, 1000ms)
                    if (recoveryAttempt > 1) {
                        const delay = (recoveryAttempt - 1) * 500;
                        console.log(`salesforce comet: Waiting ${delay}ms before retry attempt ${recoveryAttempt}/${maxRecoveryAttempts}...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    console.log(`salesforce comet: Recovery attempt ${recoveryAttempt}/${maxRecoveryAttempts}...`);
                    await this.init(true); // Try to get a fresh session (Force Refresh)

                    // Validate the new session
                    if (this.sessionId &&
                        this.sessionId !== failedSessionId &&
                        !this.sessionBlacklist.has(this.sessionId) &&
                        this.sessionId.length > 10) { // Basic validation

                        console.log(`salesforce comet: 401 Recovery - Successfully acquired new session on attempt ${recoveryAttempt}. Retrying request...`);

                        // Retry the request with new session
                        const retryHeaders = { ...headers, 'Authorization': `Bearer ${this.sessionId}` };
                        const retryResponse = await performFetch(requestUrl, { ...options, headers: retryHeaders });

                        if (retryResponse.ok) {
                            console.log('salesforce comet: 401 Recovery - Retry succeeded!');
                            this.retryCount = 0; // Reset retry counter on success
                            this.recoveryPromise = null; // Clear recovery lock
                            resolveRecovery(retryResponse);
                            return await this._applyResponseType(retryResponse, options.responseType);
                        } else {
                            console.warn(`salesforce comet: 401 Recovery - Retry failed with status: ${retryResponse.status}`);
                            // Blacklist this session too if it failed
                            if (retryResponse.status === 401 && this.sessionId) {
                                this.sessionBlacklist.add(this.sessionId);
                                this.sessionId = null;
                            }
                        }
                    } else if (this.sessionId === failedSessionId) {
                        console.warn('salesforce comet: 401 Recovery - Re-acquired the SAME invalid session ID. Trying cookie API fallback...');

                        // Try getting session directly from cookies as last resort
                        if (this.instanceUrl && recoveryAttempt === maxRecoveryAttempts) {
                            try {
                                const urlObj = new URL(this.instanceUrl);
                                const domain = urlObj.hostname;
                                const cookies = await this.getAllCookies(domain);

                                // Look for sid cookie
                                const sidCookie = cookies.find(c => c.name === 'sid');
                                if (sidCookie && sidCookie.value && sidCookie.value !== failedSessionId) {
                                    console.log('salesforce comet: Found session cookie via cookie API, trying it...');
                                    this.sessionId = sidCookie.value;

                                    // Try one more time with cookie-based session and credentials included
                                    const cookieHeaders = { ...headers, 'Authorization': `Bearer ${this.sessionId}` };
                                    const cookieResponse = await performFetch(requestUrl, {
                                        ...options,
                                        headers: cookieHeaders,
                                        credentials: 'include' // Explicitly include cookies for session to work
                                    });

                                    if (cookieResponse.ok) {
                                        console.log('salesforce comet: Cookie API fallback succeeded!');
                                        this.retryCount = 0;
                                        this.recoveryPromise = null;
                                        resolveRecovery(cookieResponse);
                                        return await this._applyResponseType(cookieResponse, options.responseType);
                                    } else {
                                        console.warn('salesforce comet: Cookie API fallback also failed with status:', cookieResponse.status);
                                    }
                                }
                            } catch (cookieError) {
                                console.warn('salesforce comet: Cookie API fallback error:', cookieError);
                            }
                        }
                    } else if (this.sessionBlacklist.has(this.sessionId)) {
                        console.warn('salesforce comet: 401 Recovery - Acquired session is blacklisted (previously failed).');
                    } else {
                        console.warn('salesforce comet: 401 Recovery - FAILED to acquire any valid session ID.');
                    }
                }

                this.retryCount = 0; // Reset retry counter
                this.recoveryPromise = null; // Clear recovery lock

                // Show user-friendly notification with refresh button
                this.showSessionExpiredNotification();

                const error = new Error('Session expired or invalid. Please refresh the Salesforce page or re-login.');
                rejectRecovery(error);
                throw error;
            } catch (error) {
                this.recoveryPromise = null; // Clear recovery lock on error
                rejectRecovery(error);
                throw error;
            }
        }

        // Reset retry counter on successful response
        if (response.ok) {
            this.retryCount = 0;
        }

        if (!response.ok) {
            let errorMessage = '';
            try {
                const errorBody = await response.json();
                if (Array.isArray(errorBody) && errorBody.length > 0 && errorBody[0].message) {
                    errorMessage = errorBody[0].message;
                } else if (errorBody && errorBody.message) {
                    errorMessage = errorBody.message;
                } else if (Array.isArray(errorBody) && errorBody.length > 0) {
                    errorMessage = JSON.stringify(errorBody);
                }
            } catch (e) {
                if (response.text) errorMessage = response.text;
            }
            if (!errorMessage) {
                errorMessage = `Salesforce API Error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        if (response.status === 204) {
            // Reconstruct a 204 response that acts like a real one
            return {
                ok: true,
                status: 204,
                statusText: 'No Content',
                json: () => Promise.resolve(null),
                text: () => Promise.resolve('')
            };
        }

        return await this._applyResponseType(response, options.responseType);
    }

    // Apply the caller's requested responseType to a fetch result, mirroring the
    // single return contract of fetch() across normal, retry, and recovery paths.
    async _applyResponseType(response, responseType) {
        if (responseType === 'text') return await response.text();
        if (responseType === 'json') return await response.json();
        return response;
    }

    async describeGlobal() {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw new Error('Session not initialized');
        }

        const cacheKey = this._cacheKey('describeGlobal');
        const cached = this._cacheGet(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const inflightKey = 'DG|' + cacheKey;
        const inflight = this._inflight.get(inflightKey);
        if (inflight) return inflight;

        const promise = (async () => {
            try {
                const url = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects`;
                const res = await this.fetch(url);
                const result = await res.json();
                this._cacheSet(cacheKey, result, this._cacheTTL.describeGlobal);
                return result;
            } finally {
                this._inflight.delete(inflightKey);
            }
        })();

        this._inflight.set(inflightKey, promise);
        return promise;
    }

    async describeSObject(sobjectName) {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            throw new Error('Session not initialized');
        }

        const cacheKey = this._cacheKey('describeSObject', sobjectName);
        const cached = this._cacheGet(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const inflightKey = 'DS|' + cacheKey;
        const inflight = this._inflight.get(inflightKey);
        if (inflight) return inflight;

        const promise = (async () => {
            try {
                const url = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/${sobjectName}/describe`;
                const res = await this.fetch(url);
                const result = await res.json();
                this._cacheSet(cacheKey, result, this._cacheTTL.describeSObject);
                return result;
            } finally {
                this._inflight.delete(inflightKey);
            }
        })();

        this._inflight.set(inflightKey, promise);
        return promise;
    }

    // Alias for describeSObject to match usage in content.js
    async describe(sobjectName) {
        return this.describeSObject(sobjectName);
    }
    // Pull faultcode/faultstring out of a SOAP fault envelope so callers see
    // "SOAP API Error: INVALID_TYPE: ..." instead of a giant raw XML dump.
    parseSoapFault(text) {
        if (!text || (text.indexOf('<faultcode>') === -1 && text.indexOf('faultstring') === -1)) return null;
        const codeMatch = text.match(/<faultcode>([\s\S]*?)<\/faultcode>/);
        const strMatch = text.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        if (!codeMatch && !strMatch) return null;
        const strip = (s) => s ? s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim() : '';
        const code = strip(codeMatch && codeMatch[1]);
        let str = strip(strMatch && strMatch[1]);
        if (!code && !str) return null;
        // Salesforce prefixes faultstrings with the code ("INVALID_TYPE: ...")
        // — drop the duplicate so toasts read "sf:INVALID_TYPE: ..." once.
        const codeTail = code.split(':').pop() + ': ';
        if (str.indexOf(codeTail) === 0) str = str.slice(codeTail.length);
        return { code, message: str };
    }
    async soapRequest(method, body) {
        if (!this.sessionId) await this.init();
        const url = `${this.instanceUrl}/services/Soap/m/${this.apiVersion.substring(1)}`;

        const soapBody = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                <soapenv:Header>
                    <met:SessionHeader>
                        <met:sessionId>${this.sessionId}</met:sessionId>
                    </met:SessionHeader>
                </soapenv:Header>
                <soapenv:Body>
                    ${body}
                </soapenv:Body>
            </soapenv:Envelope>
        `;

        const soapOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml', 'SOAPAction': '""' },
            body: null // will be set per call
        };

        const isExtensionPageCtxSoap = (typeof window !== 'undefined' && window.location && window.location.protocol === 'chrome-extension:');

        const performSoapRequest = async (fetchUrl, fetchBody) => {
            const reqOptions = { ...soapOptions, body: fetchBody };

            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                const MAX_RETRIES = 2;
                const RETRY_DELAY_MS = 600;
                let lastErr;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    const result = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({ action: 'fetch', url: fetchUrl, options: reqOptions }, (response) => {
                            if (chrome.runtime.lastError) {
                                const msg = chrome.runtime.lastError.message || 'Service worker unavailable';
                                const transient = !msg.includes('Extension context invalidated');
                                reject(Object.assign(new Error(msg), { isProxyError: true, isTransientProxyError: transient }));
                                return;
                            }
                            if (response && response.error) {
                                const msg = response.error;
                                const transient = !(msg.includes('Invalid URL') || msg.includes('null') || msg.includes('undefined'));
                                reject(Object.assign(new Error(response.error), { isProxyError: true, isTransientProxyError: transient }));
                                return;
                            }
                            resolve(response ? { ok: response.ok, status: response.status, statusText: response.statusText, text: response.text } : null);
                        });
                    }).catch(err => ({ _proxyErr: err }));

                    if (result && !result._proxyErr) return result;

                    lastErr = result._proxyErr;
                    if (!lastErr || !lastErr.isProxyError) throw lastErr || new Error('Unknown proxy error');
                    if (!lastErr.isTransientProxyError) break;
                    if (attempt < MAX_RETRIES) {
                        console.warn(`salesforce comet: SOAP proxy attempt ${attempt}/${MAX_RETRIES} failed (${lastErr.message}). Retrying in ${RETRY_DELAY_MS}ms...`);
                        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    }
                }

                if (isExtensionPageCtxSoap) {
                    throw new Error('Failed to fetch (SOAP) — background service worker unavailable. Please reload the extension.');
                }

                console.warn('salesforce comet: SOAP proxy unavailable, falling back to direct fetch:', lastErr.message);
                const res = await window.fetch(fetchUrl, reqOptions);
                const text = await res.text();
                return { ok: res.ok, status: res.status, statusText: res.statusText, text };
            } else {
                const res = await window.fetch(fetchUrl, reqOptions);
                const text = await res.text();
                return { ok: res.ok, status: res.status, statusText: res.statusText, text };
            }
        };

        const response = await performSoapRequest(url, soapBody);

        if (!response.ok) {
            // A SOAP fault comes back as HTTP 500 with a readable fault envelope;
            // surface the fault itself rather than dumping raw XML.
            const fault = this.parseSoapFault(response.text);
            if (fault) {
                const err = new Error(`SOAP API Error: ${fault.code ? fault.code + ': ' : ''}${fault.message}`);
                err.rawText = response.text;
                err.faultCode = fault.code;
                throw err;
            }
            throw new Error(`SOAP API Error: ${response.status} ${response.statusText} - ${response.text}`);
        }

        return response.text;
    }

    async createMetadata(metadataType, metadataObjects) {
        if (!this.sessionId) await this.init();
        if (this.isDemoMode) {
            console.debug('Mock createMetadata for', metadataObjects);
            return metadataObjects.map(() => ({ success: true }));
        }

        const results = [];
        // Max 10 items per createMetadata call
        for (let i = 0; i < metadataObjects.length; i += 10) {
            const chunk = metadataObjects.slice(i, i + 10);

            const serializeMetadataElement = (key, value) => {
                if (value === null || value === undefined || value === '') return '';
                if (Array.isArray(value)) {
                    return value.map(item => serializeMetadataElement(key, item)).join('');
                }
                if (typeof value === 'object') {
                    const children = Object.entries(value)
                        .map(([childKey, childValue]) => serializeMetadataElement(childKey, childValue))
                        .join('');
                    return children ? `<met:${key}>${children}</met:${key}>` : '';
                }
                return `<met:${key}>${this.escapeXml(value)}</met:${key}>`;
            };

            let metadataXml = '';
            for (const meta of chunk) {
                let fieldsXml = '';
                for (const [key, value] of Object.entries(meta)) {
                    if (key !== 'fullName' && value !== null && value !== undefined && value !== '') {
                        fieldsXml += serializeMetadataElement(key, value);
                    }
                }

                metadataXml += `
                    <met:metadata xsi:type="met:${metadataType}">
                        <met:fullName>${this.escapeXml(meta.fullName)}</met:fullName>
                        ${fieldsXml}
                    </met:metadata>
                `;
            }

            const body = `
                <met:createMetadata>
                    ${metadataXml}
                </met:createMetadata>
            `;

            try {
                const xml = await this.soapRequest('createMetadata', body);

                // Parse XML response
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, "text/xml");

                const errors = doc.querySelectorAll('errors');
                if (errors.length > 0) {
                    const errorMsg = Array.from(errors).map(e => e.textContent).join(', ');
                    throw new Error(errorMsg);
                }

                const resultNodes = doc.querySelectorAll('result');
                resultNodes.forEach(node => {
                    results.push({
                        success: node.querySelector('success')?.textContent === 'true',
                        fullName: node.querySelector('fullName')?.textContent,
                        errors: Array.from(node.querySelectorAll('errors')).map(e => e.textContent)
                    });
                });
            } catch (err) {
                console.error("createMetadata batch failed:", err);
                throw err;
            }
        }

        return results;
    }

    async deleteMetadata(metadataType, fullNames) {
        if (!this.sessionId) await this.init();
        if (this.isDemoMode) {
            console.debug('Mock deleteMetadata for', fullNames);
            return fullNames.map(f => ({ success: true, fullName: f }));
        }

        const results = [];
        // Max 10 items per deleteMetadata call
        for (let i = 0; i < fullNames.length; i += 10) {
            const chunk = fullNames.slice(i, i + 10);

            const fullNameXml = chunk.map(name => `<met:fullNames>${this.escapeXml(name)}</met:fullNames>`).join('');

            const body = `
                <met:deleteMetadata>
                    <met:type>${metadataType}</met:type>
                    ${fullNameXml}
                </met:deleteMetadata>
            `;

            try {
                const xml = await this.soapRequest('deleteMetadata', body);

                // Parse XML response
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, "text/xml");

                const resultNodes = doc.querySelectorAll('result');
                resultNodes.forEach(node => {
                    results.push({
                        success: node.querySelector('success')?.textContent === 'true',
                        fullName: node.querySelector('fullName')?.textContent,
                        errors: Array.from(node.querySelectorAll('errors')).map(e => e.textContent)
                    });
                });
            } catch (err) {
                console.error("deleteMetadata batch failed:", err);
                throw err;
            }
        }

        return results;
    }

    escapeXml(unsafe) {
        return (unsafe || '').toString().replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    async describeMetadata() {
        const body = `<met:describeMetadata><met:asOfVersion>${this.apiVersion.substring(1)}</met:asOfVersion></met:describeMetadata>`;
        const xml = await this.soapRequest('describeMetadata', body);

        // Simple XML parsing (browser has DOMParser)
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const metadataObjects = Array.from(doc.querySelectorAll('metadataObjects'));

        const results = [];
        metadataObjects.forEach(node => {
            const xmlName = node.querySelector('xmlName').textContent;
            results.push({
                xmlName: xmlName,
                directoryName: node.querySelector('directoryName').textContent,
                inFolder: node.querySelector('inFolder').textContent === 'true',
                metaFile: node.querySelector('metaFile').textContent === 'true',
                suffix: node.querySelector('suffix')?.textContent
            });

            // Extract all children (like CustomField under CustomObject)
            const children = node.querySelectorAll('childXmlNames');
            children.forEach(child => {
                results.push({
                    xmlName: child.textContent,
                    directoryName: node.querySelector('directoryName').textContent,
                    inFolder: false, // Children generally don't reside in folders
                    metaFile: false,
                    isChild: true,
                    parentXmlName: xmlName
                });
            });
        });

        return results;
    }

    async listMetadata(type, folder = null) {
        if (type === 'CustomField') {
            try {
                // Tooling API workaround for CustomField since SOAP listMetadata doesn't support it
                const objQuery = "SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject";
                const objRes = await this.query(objQuery, true);
                const objMap = {};
                objRes.records.forEach(o => {
                    const prefix = o.NamespacePrefix ? `${o.NamespacePrefix}__` : '';
                    objMap[o.Id] = `${prefix}${o.DeveloperName}__c`;
                });

                const fieldQuery = "SELECT Id, DeveloperName, TableEnumOrId, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM CustomField";
                const fieldRes = await this.query(fieldQuery, true);

                return fieldRes.records.map(r => {
                    const objName = objMap[r.TableEnumOrId] || r.TableEnumOrId;
                    const prefix = r.NamespacePrefix ? `${r.NamespacePrefix}__` : '';
                    return {
                        fullName: `${objName}.${prefix}${r.DeveloperName}__c`,
                        type: 'CustomField',
                        lastModifiedDate: r.LastModifiedDate,
                        lastModifiedByName: r.LastModifiedBy?.Name || ''
                    };
                });
            } catch (e) {
                console.error('CustomField workaround failed', e);
                return [];
            }
        }

        const folderTag = folder ? `<met:folder>${folder}</met:folder>` : '';
        const body = `
            <met:listMetadata>
                <met:queries>
                    <met:type>${type}</met:type>
                    ${folderTag}
                </met:queries>
                <met:asOfVersion>${this.apiVersion.substring(1)}</met:asOfVersion>
            </met:listMetadata>
        `;

        try {
            const xml = await this.soapRequest('listMetadata', body);
            // console.log('listMetadata RAW XML:', xml); // Uncomment for deep debugging if needed

            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const result = Array.from(doc.querySelectorAll('result'));

            return result.map((node, index) => {
                const fullName = node.querySelector('fullName')?.textContent || '';
                const type = node.querySelector('type')?.textContent || '';
                const lastModifiedDate = node.querySelector('lastModifiedDate')?.textContent || null;
                const lastModifiedByName = node.querySelector('lastModifiedByName')?.textContent || '';
                const id = node.querySelector('id')?.textContent || '';

                return {
                    fullName,
                    type,
                    lastModifiedDate,
                    lastModifiedByName,
                    id
                };
            });
        } catch (e) {
            console.warn(`salesforce comet: listMetadata failed for ${type}. This metadata type may not be supported directly (e.g. child types).`, e);
        }
    }

    async readMetadata(type, fullNames) {
        const names = Array.isArray(fullNames) ? fullNames : [fullNames];
        const namesXml = names.map(n => `<met:fullNames>${n}</met:fullNames>`).join('');
        const body = `
            <met:readMetadata>
                <met:type>${type}</met:type>
                ${namesXml}
            </met:readMetadata>
        `;

        try {
            const xml = await this.soapRequest('readMetadata', body);
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');

            // Check for faults
            const fault = doc.querySelector('faultstring');
            if (fault) {
                throw new Error(fault.textContent);
            }

            const records = Array.from(doc.querySelectorAll('records'));

            return records.map(record => {
                const serializer = new XMLSerializer();
                let innerXml = '';
                Array.from(record.childNodes).forEach(node => {
                    innerXml += serializer.serializeToString(node);
                });

                // Extremely basic pretty-print by adding newlines before tags
                // Real pretty-printing in browser without library is tricky, 
                // but we can just return it as a structured string.
                const formatted = innerXml.replace(/></g, '>\\n    <');

                return `<?xml version="1.0" encoding="UTF-8"?>\n<${type} xmlns="http://soap.sforce.com/2006/04/metadata">\n    ${formatted}\n</${type}>`;
            });
        } catch (e) {
            console.error('salesforce comet: readMetadata failed', e);
            throw e;
        }
    }

    async retrieveMetadata(packageXml) {
        const unpackagedBody = packageXml
            .replace(/^<\?xml[^>]*>\s*/, "")
            .replace(/<Package[^>]*>/, "")
            .replace("</Package>", "")
            .replaceAll("<types>", "<met:types>")
            .replaceAll("</types>", "</met:types>")
            .replaceAll("<members>", "<met:members>")
            .replaceAll("</members>", "</met:members>")
            .replaceAll("<name>", "<met:name>")
            .replaceAll("</name>", "</met:name>")
            .replaceAll("<version>", "<met:version>")
            .replaceAll("</version>", "</met:version>");

        const body = `
            <met:retrieve>
                <met:retrieveRequest>
                    <met:apiVersion>${this.apiVersion.substring(1)}</met:apiVersion>
                    <met:singlePackage>true</met:singlePackage>
                    <met:unpackaged>
                        ${unpackagedBody}
                    </met:unpackaged>
                </met:retrieveRequest>
            </met:retrieve>
        `;

        const xml = await this.soapRequest('retrieve', body);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const idNode = doc.querySelector('id');
        if (!idNode) {
            throw new Error('Retrieve job ID not returned.');
        }
        return idNode.textContent;
    }

    async checkRetrieveStatus(asyncProcessId) {
        const body = `
            <met:checkRetrieveStatus>
                <met:asyncProcessId>${asyncProcessId}</met:asyncProcessId>
                <met:includeZip>true</met:includeZip>
            </met:checkRetrieveStatus>
        `;
        const xml = await this.soapRequest('checkRetrieveStatus', body);
        return xml;
    }

    async deployMetadata(zipBase64, options = {}) {
        const checkOnly = options.checkOnly === true;
        const testLevel = options.testLevel || 'NoTestRun';
        const body = `
            <met:deploy>
                <met:ZipFile>${zipBase64}</met:ZipFile>
                <met:DeployOptions>
                    <met:allowMissingFiles>false</met:allowMissingFiles>
                    <met:autoUpdatePackage>false</met:autoUpdatePackage>
                    <met:checkOnly>${checkOnly}</met:checkOnly>
                    <met:ignoreWarnings>false</met:ignoreWarnings>
                    <met:performRetrieve>false</met:performRetrieve>
                    <met:purgeOnDelete>false</met:purgeOnDelete>
                    <met:rollbackOnError>true</met:rollbackOnError>
                    <met:singlePackage>true</met:singlePackage>
                    <met:testLevel>${this.escapeXml(testLevel)}</met:testLevel>
                </met:DeployOptions>
            </met:deploy>`;
        const xml = await this.soapRequest('deploy', body);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const id = doc.getElementsByTagNameNS('*', 'id')[0]?.textContent;
        if (!id) throw new Error('Salesforce did not return a deployment job ID.');
        return id;
    }

    async checkDeployStatus(asyncProcessId, includeDetails = true) {
        const body = `
            <met:checkDeployStatus>
                <met:asyncProcessId>${this.escapeXml(asyncProcessId)}</met:asyncProcessId>
                <met:includeDetails>${includeDetails === true}</met:includeDetails>
            </met:checkDeployStatus>`;
        return this.soapRequest('checkDeployStatus', body);
    }

    async getCurrentUser() {
        if (!this.sessionId) await this.init();
        if (!this.sessionId) {
            return {
                id: '005000000000001AAA',
                username: 'demo@example.com',
                firstName: 'Demo',
                lastName: 'User',
                name: 'Demo User',
                smallPhotoUrl: 'https://www.lightningdesignsystem.com/assets/images/avatar1.jpg'
            };
        }

        const url = `${this.instanceUrl}/services/data/${this.apiVersion}/chatter/users/me`;
        const res = await this.fetch(url);
        return res.json();
    }

    showSessionExpiredNotification() {
        // Only show notification once
        if (document.getElementById('sf-inspector-session-expired-banner')) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'sf-inspector-session-expired-banner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: white;
            padding: 6px 16px;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 12px;
            animation: slideDown 0.3s ease-out;
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span style="font-weight: 500;">Salesforce Session Expired:</span>
                <span style="opacity: 0.85; font-size: 11px;">
                    Session recovery failed after 3 attempts.
                </span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button id="sf-refresh-btn" style="
                    background: var(--sfarc-accent, #2196f3);
                    color: white;
                    border: none;
                    padding: 3px 10px;
                    border-radius: 9999px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 11px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                    </svg>
                    Refresh Salesforce
                </button>
                <button id="sf-dismiss-btn" style="
                    background: transparent;
                    color: #94a3b8;
                    border: none;
                    padding: 2px 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                ">
                    ✕
                </button>
            </div>
        `;

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            #sf-refresh-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            #sf-dismiss-btn:hover {
                background: rgba(255,255,255,0.3);
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(banner);

        // Add event listeners
        document.getElementById('sf-refresh-btn').addEventListener('click', async () => {
            const refreshBtn = document.getElementById('sf-refresh-btn');
            refreshBtn.textContent = '⏳ Refreshing...';
            refreshBtn.disabled = true;
            refreshBtn.style.opacity = '0.7';

            // Try to find and refresh Salesforce tabs
            if (chrome.tabs && chrome.tabs.query) {
                try {
                    const tabs = await chrome.tabs.query({});
                    const sfTabs = tabs.filter(tab => tab.url && /salesforce|force\.com/.test(tab.url));

                    if (sfTabs.length > 0) {
                        // Refresh all Salesforce tabs
                        for (const tab of sfTabs) {
                            await chrome.tabs.reload(tab.id);
                        }

                        // Wait a bit then close notification
                        setTimeout(() => {
                            banner.style.animation = 'slideDown 0.3s ease-out reverse';
                            setTimeout(() => banner.remove(), 300);
                        }, 1000);
                        return;
                    }
                } catch (error) {
                    console.error('Failed to refresh tabs:', error);
                }
            }

            // Fallback: reload current page
            window.location.reload();
        });

        document.getElementById('sf-dismiss-btn').addEventListener('click', () => {
            banner.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => banner.remove(), 300);
        });
    }
}

window.sfApi = new SalesforceAPI();

window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
        switch(match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return match;
        }
    });
};
