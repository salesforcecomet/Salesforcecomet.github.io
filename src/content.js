// Salesforce Comet - Minimal Bootstrapper
let mainLoaded = false;
let toggleObserver = null;
let launchMethod = 'both'; // 'both' | 'sidebar' | 'shortcut' — user's launcher choice

// Request the background to inject the suppressor into the active tab
// (the background resolves the real tabId — content scripts can't inject
// into the MAIN world themselves with a valid target)
if (chrome.runtime?.id) {
    chrome.runtime.sendMessage({ action: 'inject-console-suppressor' }, () => {
        // Ignore response / connection errors
        if (chrome.runtime.lastError) { /* suppress */ }
    });
}

// ---------------------------------------------------------
// Per-org subdomain registry — stable favicon-color source.
// Every Salesforce org page records its org subdomain under its own
// hostname key (hostname -> { subdomain, lastSeen }). Extension tool pages
// (Settings, Data Export, ...) read this registry to color their favicon
// like the org page, replacing the shared sfarcLoggedInUser blob that every
// org overwrites — which flipped the color on each refresh and hashed the
// email domain instead of the org subdomain. Lives in chrome.storage.local
// because it must be readable from both content scripts and extension pages
// (they don't share localStorage).
// ---------------------------------------------------------
const SFARC_GENERIC_HOSTS = ['www', 'login', 'test', 'help', 'trailhead', 'status', 'trust', 'developer', 'force', 'salesforce'];

function sfarcOrgSubdomainFromHost(host) {
    const h = String(host || '').toLowerCase();
    if (!h || (!h.includes('salesforce') && !h.includes('force.com'))) return null;
    const parts = h.split('.');
    const first = parts[0];
    if (parts.length < 2 || !first || SFARC_GENERIC_HOSTS.includes(first)) return null;
    return first.replace(/--c$/, '');
}

function sfarcRecordOrgSubdomain() {
    const host = (window.location.hostname || '').toLowerCase();
    const subdomain = sfarcOrgSubdomainFromHost(host);
    if (!subdomain) return;
    if (!(window.chrome && chrome.storage && chrome.storage.local)) return;
    const entry = { subdomain, lastSeen: Date.now() };
    chrome.storage.local.get(['sfarcOrgSubdomains'], (res) => {
        if (chrome.runtime && chrome.runtime.lastError) return;
        const map = (res && res.sfarcOrgSubdomains) || {};
        map[host] = entry;
        chrome.storage.local.set({ sfarcOrgSubdomains: map });
    });
}

sfarcRecordOrgSubdomain();

function normalizeInstanceUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        let origin = parsed.origin;
        if (origin.includes('.lightning.force.com')) {
            origin = origin.replace('.lightning.force.com', '.my.salesforce.com');
        }
        // Trailblazer (dev org) setup hosts are xxx.trailblaze.my.salesforce-setup.com.
        // A naive .salesforce-setup.com -> .my.salesforce.com replace would produce
        // xxx.trailblaze.my.my.salesforce.com, which does not resolve — every API
        // fetch then fails. Handle the trailblaze form before the generic one, and
        // collapse any already-doubled .my.my. from older stored sessions.
        if (origin.includes('.trailblaze.my.salesforce-setup.com')) {
            origin = origin.replace('.trailblaze.my.salesforce-setup.com', '.trailblaze.my.salesforce.com');
        }
        if (origin.includes('.my.salesforce-setup.com')) {
            origin = origin.replace('.my.salesforce-setup.com', '.my.salesforce.com');
        }
        if (origin.includes('.salesforce-setup.com')) {
            origin = origin.replace('.salesforce-setup.com', '.my.salesforce.com');
        }
        origin = origin.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
        return origin;
    } catch (e) {
        return null;
    }
}

function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function getCookieFromBackground() {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: window.location.href }, (cookie) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                resolve(cookie || null);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

async function getSessionInfo() {
    const instanceUrl = normalizeInstanceUrl(window.location.origin) || window.location.origin;

    if (window.sfApi) {
        try {
            await window.sfApi.init();
            if (window.sfApi.sessionId) {
                return {
                    sessionId: window.sfApi.sessionId,
                    instanceUrl: window.sfApi.instanceUrl || instanceUrl
                };
            }
        } catch (e) {
            console.warn('salesforce comet: API session init failed in content bootstrap.', e);
        }
    }

    const backgroundCookie = await getCookieFromBackground();
    if (backgroundCookie && backgroundCookie.value) {
        return {
            sessionId: backgroundCookie.value,
            instanceUrl
        };
    }

    const sid = readCookie('sid');
    return {
        sessionId: sid,
        instanceUrl
    };
}

async function getUserInfo() {
    const sessionInfo = await getSessionInfo();
    const fallback = {
        userId: window.currentUserId || null,
        userName: window.currentUserName || null,
        username: window.sfApi?.userInfo?.username || null,
        orgId: window.sfApi?.userInfo?.orgId || null,
        instanceUrl: sessionInfo.instanceUrl
    };

    if (!window.sfApi || !sessionInfo.sessionId || !sessionInfo.instanceUrl) {
        return fallback;
    }

    if (!window.sfApi.sessionId) {
        window.sfApi.sessionId = sessionInfo.sessionId;
    }
    if (!window.sfApi.instanceUrl) {
        window.sfApi.instanceUrl = sessionInfo.instanceUrl;
    }

    try {
        const response = await window.sfApi.fetch(`${sessionInfo.instanceUrl}/services/data/${window.sfApi.apiVersion}/chatter/users/me`);
        if (!response || !response.ok) return fallback;

        const user = await response.json();
        window.currentUserId = user.id;
        window.currentUserName = user.displayName || user.name || user.username || fallback.userName;
        let photoUrl = user.photo?.fullPhotoUrl || user.photo?.smallPhotoUrl || '';

        try {
            const userQuery = await window.sfApi.query(`SELECT Id, Name, FullPhotoUrl FROM User WHERE Id = '${user.id}'`);
            if (userQuery && userQuery.records && userQuery.records.length > 0 && userQuery.records[0].FullPhotoUrl) {
                photoUrl = userQuery.records[0].FullPhotoUrl;
            }
        } catch (e) { }

        if (photoUrl && !photoUrl.startsWith('http') && sessionInfo.instanceUrl) {
            photoUrl = sessionInfo.instanceUrl + photoUrl;
        }
        let photoBase64 = '';
        if (photoUrl && window.sfApi && typeof window.sfApi.fetch === 'function') {
            try {
                const imgRes = await window.sfApi.fetch(photoUrl);
                if (imgRes && imgRes.ok) {
                    const blob = await imgRes.blob();
                    photoBase64 = await new Promise(r => {
                        const reader = new FileReader();
                        reader.onloadend = () => r(reader.result || '');
                        reader.onerror = () => r('');
                        reader.readAsDataURL(blob);
                    });
                }
            } catch (e) { }
        }
        const finalPhotoUrl = photoBase64 || photoUrl;

        window.sfApi.userInfo = {
            ...(window.sfApi.userInfo || {}),
            id: user.id,
            username: user.username || user.email || fallback.username,
            orgId: user.organizationId || user.organization?.id || fallback.orgId,
            name: window.currentUserName,
            photoUrl: finalPhotoUrl
        };

        const loggedUser = {
            name: window.currentUserName,
            username: window.sfApi.userInfo.username,
            orgId: window.sfApi.userInfo.orgId,
            photoUrl: finalPhotoUrl
        };
        if (window.chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarcLoggedInUser: loggedUser });
        }
        try { localStorage.setItem('sfarc_logged_in_user', JSON.stringify(loggedUser)); } catch (err) { }

        return {
            userId: window.currentUserId,
            userName: window.currentUserName,
            username: window.sfApi.userInfo.username,
            orgId: window.sfApi.userInfo.orgId,
            photoUrl: photoUrl,
            instanceUrl: sessionInfo.instanceUrl
        };
    } catch (e) {
        // Silent — expected when the Salesforce org is offline or session not yet initialized
        return fallback;
    }
}

// ---------------------------------------------------------
// Accent color sync for injected UIs (glass-toast, flow-scanner
// overlay, custom-dropdown). These run on Salesforce pages where
// theme-manager.js is NOT loaded, so we mirror applyAccentColor
// here: read sfiSettings.accentColor and set the --sfarc-accent*
// variables on the document root so injected CSS var() rules pick
// up the user's chosen accent instead of the #2196f3 fallback.
// ---------------------------------------------------------
function sfarcHexToRgbArr(hex) {
    let h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return [33, 150, 243];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sfarcMixHex(hex, other, weight) {
    const a = sfarcHexToRgbArr(hex);
    const b = sfarcHexToRgbArr(other);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * weight));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// The Comet theme setting ('light' | 'dark' | 'system') — drives both the
// panel theme and the accent shade so they always agree.
let sfarcCurrentTheme = 'system';
// Last accent setting applied, so we can re-derive the org shade live when
// the OS color scheme flips while the theme is 'system'.
let sfarcLastAccentColor = null;

// "Match org favicon" accent: derive a vibrant accent from the org's
// subdomain (same DJB2-hashed hue family as the tab favicon in
// colored-favicon.js). Runs on real Salesforce pages where the hostname IS
// the org, so each org gets its own accent automatically. Theme-aware: light
// mode uses a DARK shade of the org hue (bright accents are invisible on
// white), dark mode uses the vibrant bright shade — mirroring the favicon's
// own light/dark behavior.
function sfarcOrgAccentColor() {
    try {
        let sub = '';
        const host = window.location.hostname.toLowerCase();
        if (host && (host.includes('salesforce') || host.includes('force.com'))) {
            sub = (host.split('.')[0] || '').replace(/--c$/, '');
        }
        sub = sub || 'salesforce';
        let hash = 5381;
        for (let i = 0; i < sub.length; i++) hash = ((hash << 5) + hash) + sub.charCodeAt(i);
        const hue = Math.abs(hash) % 360;
        const isDark = sfarcCurrentTheme === 'dark' ||
            (sfarcCurrentTheme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const h = hue / 360, s = 0.8, l = isDark ? 0.62 : 0.42;
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = Math.round(255 * hue2rgb(p, q, h + 1 / 3));
        const g = Math.round(255 * hue2rgb(p, q, h));
        const b = Math.round(255 * hue2rgb(p, q, h - 1 / 3));
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return '#38bdf8';
    }
}

function sfarcApplyAccentToPage(color) {
    sfarcLastAccentColor = color;
    if (color === 'org') color = sfarcOrgAccentColor();
    if (!color) color = '#2196f3';
    const rgb = sfarcHexToRgbArr(color).join(', ');
    const light = sfarcMixHex(color, '#ffffff', 0.45);
    const dark = sfarcMixHex(color, '#000000', 0.35);
    const glow = sfarcMixHex(color, '#ffffff', 0.22);
    const soft = sfarcMixHex(color, '#ffffff', 0.9);
    const root = document.documentElement;
    if (!root) return;

    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--primary-dark', color);
    root.style.setProperty('--primary-light', `rgba(${rgb}, 0.15)`);
    root.style.setProperty('--primary-color-rgb', rgb);
    root.style.setProperty('--primary-light-bg', `rgba(${rgb}, 0.12)`);
    root.style.setProperty('--sfarc-primary', color);
    root.style.setProperty('--sfarc-accent', color);
    root.style.setProperty('--sfarc-accent-rgb', rgb);
    root.style.setProperty('--sfarc-accent-light', light);
    root.style.setProperty('--sfarc-accent-dark', dark);
    root.style.setProperty('--sfarc-accent-dark-rgb', sfarcHexToRgbArr(dark).join(', '));
    root.style.setProperty('--sfarc-accent-glow', glow);
    root.style.setProperty('--sfarc-accent-glow-rgb', sfarcHexToRgbArr(glow).join(', '));
    root.style.setProperty('--sfarc-accent-light-rgb', sfarcHexToRgbArr(light).join(', '));
    root.style.setProperty('--sfarc-accent-soft', soft);
    root.style.setProperty('--mac-active-blue', color);
    root.style.setProperty('--clone-brand', color);
    root.style.setProperty('--sfir-btn-border-active', color);
    root.style.setProperty('--sfarc-input-focus-border', color);
}

function sfarcInitAccentSync() {
    if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
    const applyFromSettings = (settings) => {
        settings = settings || {};
        sfarcCurrentTheme = settings.theme || 'system';
        sfarcApplyAccentToPage(settings.accentColor);
        launchMethod = settings.launcherMethod || 'both';
    };
    chrome.storage.sync.get(['sfiSettings'], (result) => {
        applyFromSettings((result && result.sfiSettings) || {});
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sfiSettings) {
            applyFromSettings(changes.sfiSettings.newValue || {});
        }
    });

    // When the theme is 'system', the accent shade must follow the OS color
    // scheme live (the favicon already re-applies itself on this event).
    try {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (sfarcCurrentTheme === 'system' && sfarcLastAccentColor != null) {
                sfarcApplyAccentToPage(sfarcLastAccentColor);
            }
        };
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
        } else if (mql.addListener) {
            mql.addListener(handler);
        }
    } catch (e) { }
}

function waitForPanelReady(timeoutMs = 3000) {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
            const panel = document.getElementById('sfarc-panel');
            if (panel && typeof window.togglePanel === 'function') {
                resolve(true);
                return;
            }
            // If main.js was loaded but its DOM is gone (Lightning SPA
            // navigations can drop body-level nodes), re-inject instead of
            // waiting out the full timeout — otherwise the launcher appears to
            // "launch after a while" and then do nothing.
            if (mainLoaded && !panel && chrome.runtime?.id) {
                mainLoaded = false;
                chrome.runtime.sendMessage({ action: 'loadMain' }, (response) => {
                    if (!chrome.runtime.lastError && response && response.success) {
                        mainLoaded = true;
                    }
                });
            }
            if (Date.now() - startedAt >= timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(check, 50);
        };
        check();
    });
}

// Keep the injected panel alive across Salesforce SPA navigations. If
// Lightning re-renders the page and drops #sfarc-panel, the side launcher and
// Shift+Space toggle would silently die (mainLoaded stays true, so nothing
// ever re-injects). Cheap getElementById check every 2s.
function ensurePanelPresent() {
    if (!chrome.runtime?.id || !mainLoaded) return;
    if (document.getElementById('sfarc-panel')) return;
    // Panel removed by SPA navigation — try to recreate it via
    // injectUI() without re-injecting scripts (which would fail
    // on let/const/class redeclaration errors).
    if (typeof injectUI === 'function') {
        try { injectUI(); } catch (e) { /* fall through */ }
        if (document.getElementById('sfarc-panel')) return;
    }
    // Fallback: full re-inject if injectUI didn't help
    mainLoaded = false;
    chrome.runtime.sendMessage({ action: 'loadMain' }, (response) => {
        if (!chrome.runtime.lastError && response && response.success) {
            mainLoaded = true;
        }
    });
}
setInterval(ensurePanelPresent, 2000);

// Keep-alive: periodically ping the background service worker to prevent
// the content script from becoming stale after long idle periods.
// This fixes the issue where popup clicks stop working after 20-30 minutes.
let sfarcKeepAliveInterval = null;
function startKeepAlive() {
    if (sfarcKeepAliveInterval) return;
    sfarcKeepAliveInterval = setInterval(() => {
        if (!chrome.runtime?.id) {
            stopKeepAlive();
            return;
        }
        try {
            chrome.runtime.sendMessage({ action: 'keepAlive' }, () => {
                if (chrome.runtime.lastError) {
                    // Extension context invalidated — stop trying
                    stopKeepAlive();
                }
            });
        } catch (e) {
            stopKeepAlive();
        }
    }, 25000); // Ping every 25 seconds to stay under Chrome's 30s timeout
}
function stopKeepAlive() {
    if (sfarcKeepAliveInterval) {
        clearInterval(sfarcKeepAliveInterval);
        sfarcKeepAliveInterval = null;
    }
}

// Start keep-alive when the page loads
startKeepAlive();

function isLoginPage() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();
    if (host === 'login.salesforce.com' || host === 'test.salesforce.com') return true;
    if (path.includes('/login.jsp') || path.endsWith('/login') || href.includes('unauthenticated')) return true;
    if (document.querySelector('#login_form, #Login, form[name="login"], input[name="username"][name="pw"]')) return true;
    return false;
}

function init() {
    // Only inject in top-level window to avoid duplicate toggles in sub-frames/drawers
    if (window.self !== window.top) {
        return;
    }

    // Push the user's accent color to injected UI CSS variables
    sfarcInitAccentSync();
    
    // Initialize performance monitoring (auto-detects low-end devices)
    if (window.SFARC_Perf) {
        console.log('[SFARC] Performance module initialized');
    }
    
    // Skip on login pages to avoid unnecessary errors and overhead
    if (isLoginPage()) {
        return;
    }

    // ---------------------------------------------------------
    // Global Keyboard Shortcut to load/trigger the Command Palette
    // ---------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        // Shift+Space (skipped when the user chose Sidebar-only launch)
        if (e.shiftKey && (e.code === 'Space' || e.key === ' ') && launchMethod !== 'sidebar') {
            // Only handle it here if main.js isn't loaded yet
            if (!mainLoaded && chrome.runtime?.id) {
                e.preventDefault();
                e.stopPropagation();
                chrome.runtime.sendMessage({ action: 'loadMain' }, (response) => {
                    if (!chrome.runtime.lastError && response && response.success) {
                        mainLoaded = true;
                        waitForPanelReady().then((ready) => {
                            if (ready && typeof window.togglePanel === 'function') {
                                window.togglePanel();
                            }
                        });
                    }
                });
            }
            // If mainLoaded is true, main.js has its own listener that will handle it
        }
    });

    // Clean up any legacy environment banner if present
    const existingBanner = document.getElementById('sfarc-env-banner');
    if (existingBanner) existingBanner.remove();
    const existingBar = document.getElementById('sfarc-org-color-bar');
    if (existingBar) existingBar.remove();

    // Auto-load main.js on all Salesforce pages so header action icons and command palette shortcuts work immediately
    if (chrome.runtime?.id && !mainLoaded) {
        chrome.runtime.sendMessage({ action: 'loadMain' }, (response) => {
            if (!chrome.runtime.lastError && response && response.success) {
                mainLoaded = true;
            }
        });
    }
}

// Initial check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Intercept messages for the main logic if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Used by the service worker during extension upgrades to avoid injecting
    // this bootstrapper a second time into an already-open tab.
    if (request.action === 'sfarc-bootstrap-status') {
        sendResponse({ ready: true, mainLoaded });
        return;
    }

    // Launch Comet: load the main logic (idempotent) then open the panel.
    if (request.action === 'sfarc-launch-comet') {
        const launch = () => {
            chrome.runtime.sendMessage({ action: 'loadMain' }, (response) => {
                if (!chrome.runtime.lastError && response && response.success) {
                    mainLoaded = true;
                }
                waitForPanelReady().then((ready) => {
                    if (ready && typeof window.togglePanel === 'function') {
                        // Ensure the panel is open (toggle only if hidden)
                        const panel = document.getElementById('sfarc-panel');
                        if (panel && panel.classList.contains('sfarc-hidden')) {
                            window.togglePanel();
                        }
                    }
                    sendResponse({ success: ready });
                });
            });
        };
        if (mainLoaded) {
            waitForPanelReady().then((ready) => {
                if (ready && typeof window.togglePanel === 'function') {
                    const panel = document.getElementById('sfarc-panel');
                    if (panel && panel.classList.contains('sfarc-hidden')) {
                        window.togglePanel();
                    }
                }
                sendResponse({ success: ready });
            });
        } else {
            launch();
        }
        return true; // async
    }

    if (request.action === 'getSession') {
        getSessionInfo()
            .then(sendResponse)
            .catch((error) => {
                console.warn('salesforce comet: Failed to provide session info.', error);
                sendResponse({
                    sessionId: null,
                    instanceUrl: normalizeInstanceUrl(window.location.origin) || window.location.origin
                });
            });
        return true;
    }

    if (request.action === 'get-user-info') {
        getUserInfo()
            .then(sendResponse)
            .catch((error) => {
                console.warn('salesforce comet: Failed to provide user info.', error);
                sendResponse({
                    userId: null,
                    userName: null,
                    username: null,
                    orgId: null,
                    instanceUrl: normalizeInstanceUrl(window.location.origin) || window.location.origin
                });
            });
        return true;
    }
});
