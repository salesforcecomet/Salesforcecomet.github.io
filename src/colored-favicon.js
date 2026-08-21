(function () {
    if (window.__sfarcColoredFaviconLoaded) return;
    window.__sfarcColoredFaviconLoaded = true;

    // DJB2 Hash Algorithm for high-entropy hashing
    function djb2Hash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return Math.abs(hash);
    }

    let cachedSubdomain = null;
    let cachedHost = null; // org hostname used as the registry key ('' when unknown)
    let reliableSource = false;

    // Resolved favicon hues per subdomain, loaded from the org registry
    // (chrome.storage.local.sfarcOrgSubdomains). When two orgs' base colors
    // collide, the earlier org keeps its hue and later orgs shift to a free
    // hue (golden-angle steps) via syncResolvedColor(); the assignment is
    // persisted as resolvedHue on the registry entry so it stays stable
    // across refreshes and matches between org pages and tool pages.
    const resolvedHues = {};

    // Extract unique org subdomain prefix.
    // Two reliable sources: (1) the page hostname on Salesforce pages,
    // (2) the ?host= query param on extension pages. When neither is
    // available (e.g. a tool page opened from a non-Salesforce tab) the
    // per-org subdomain registry in chrome.storage (sfarcOrgSubdomains,
    // written by content.js, keyed per hostname) supplies the last-active
    // org's subdomain and its resolved hue — see initColoredFavicon().
    function getOrgSubdomain() {
        if (cachedSubdomain) return cachedSubdomain;
        const host = window.location.hostname.toLowerCase();
        if (host && (host.includes('salesforce') || host.includes('force.com'))) {
            const parts = host.split('.');
            let sub = parts[0] || 'salesforce';
            cachedSubdomain = sub.replace(/--c$/, '');
            cachedHost = host;
            reliableSource = true;
            return cachedSubdomain;
        }

        try {
            const params = new URLSearchParams(window.location.search);
            const hostParam = params.get('host');
            if (hostParam) {
                const parts = hostParam.split('.');
                cachedSubdomain = parts[0].replace(/--c$/, '');
                cachedHost = hostParam.toLowerCase();
                reliableSource = true;
                return cachedSubdomain;
            }
        } catch (e) { }

        // No reliable source available — return a default but DON'T cache
        // so the async registry lookup can still set it. If we cached
        // 'salesforce' here, the registry callback would be skipped and we'd
        // be stuck on the wrong color.
        return 'salesforce';
    }

    // From the per-org subdomain registry, pick the org the user was most
    // recently active in (highest lastSeen). Returns the registry key (host)
    // and the entry so callers can also read its resolvedHue. The registry
    // is keyed per hostname, so a different org's write never overwrites
    // ours — we just follow whichever org the user was last working in.
    function pickLatestRegistryEntry(registry) {
        if (!registry || typeof registry !== 'object') return null;
        let bestHost = null;
        let bestEntry = null;
        let bestTs = -1;
        for (const host in registry) {
            const entry = registry[host];
            if (entry && entry.subdomain && typeof entry.lastSeen === 'number' && entry.lastSeen > bestTs) {
                bestHost = host;
                bestEntry = entry;
                bestTs = entry.lastSeen;
            }
        }
        return bestEntry ? { host: bestHost, entry: bestEntry } : null;
    }

    // Base hue/saturation an org would get from its subdomain alone (before
    // any collision resolution). Used both for this page's color and to map
    // other registry entries to the colors they currently claim.
    function baseHueFor(sub) {
        return djb2Hash(sub) % 360;
    }

    function baseSatFor(sub) {
        const hash = djb2Hash(sub);
        return 45 + Math.floor(hash / 360) % 6 * 10; // 45, 55, 65, 75, 85, 95
    }

    function colorKey(hue, sat) {
        return hue + ':' + sat;
    }

    // Find any registry entry belonging to a subdomain (orgs may have several
    // host keys: lightning, my.salesforce.com, setup, classic).
    function findRegistryEntry(registry, sub) {
        if (!registry || typeof registry !== 'object') return null;
        for (const host in registry) {
            const entry = registry[host];
            if (entry && entry.subdomain === sub) return entry;
        }
        return null;
    }

    // Colors currently claimed by OTHER orgs in the registry (their resolved
    // hue if persisted, otherwise their base hue).
    function usedColorKeys(registry, selfSub) {
        const used = {};
        if (!registry || typeof registry !== 'object') return used;
        for (const host in registry) {
            const entry = registry[host];
            if (!entry || !entry.subdomain || entry.subdomain === selfSub) continue;
            const hue = entry.resolvedHue != null ? entry.resolvedHue : baseHueFor(entry.subdomain);
            used[colorKey(hue, baseSatFor(entry.subdomain))] = true;
        }
        return used;
    }

    // Shift a colliding hue away in golden-angle steps (137.5°) until it
    // lands on a free color at the same saturation.
    function shiftHueUntilFree(baseHue, sat, used) {
        let hue = baseHue;
        for (let step = 1; step <= 360; step++) {
            hue = Math.round((hue + 137.5) % 360);
            if (!used[colorKey(hue, sat)]) return hue;
        }
        return baseHue; // all 360 hues taken at this saturation — accept collision
    }

    // Resolve this page's org color against the registry and persist it.
    // Reuses a persisted resolvedHue when present; otherwise keeps the base
    // hue if free, or shifts to a free hue on collision. Runs on pages where
    // the org hostname is known (org pages and ?host= tool pages) so the
    // entry can be stored under the org's own registry key.
    function syncResolvedColor() {
        const sub = getOrgSubdomain();
        const host = cachedHost;
        if (!sub || !host || !(window.chrome && chrome.storage && chrome.storage.local)) return;
        chrome.storage.local.get(['sfarcOrgSubdomains'], (res) => {
            if (chrome.runtime && chrome.runtime.lastError) return;
            const registry = (res && res.sfarcOrgSubdomains) || {};
            const selfEntry = findRegistryEntry(registry, sub);
            const sat = baseSatFor(sub);
            const used = usedColorKeys(registry, sub);

            let hue;
            if (selfEntry && selfEntry.resolvedHue != null) {
                hue = selfEntry.resolvedHue;
            } else {
                const baseHue = baseHueFor(sub);
                hue = used[colorKey(baseHue, sat)] ? shiftHueUntilFree(baseHue, sat, used) : baseHue;
            }

            // Persist: own host key + every other host key of the same
            // subdomain, so all entry points of the org agree on the hue.
            registry[host] = { subdomain: sub, lastSeen: Date.now(), resolvedHue: hue };
            for (const k in registry) {
                const entry = registry[k];
                if (entry && entry.subdomain === sub) {
                    if (entry.resolvedHue !== hue) entry.resolvedHue = hue;
                    if (!entry.lastSeen) entry.lastSeen = Date.now();
                }
            }
            chrome.storage.local.set({ sfarcOrgSubdomains: registry });

            if (hue !== (resolvedHues[sub] != null ? resolvedHues[sub] : baseHueFor(sub))) {
                resolvedHues[sub] = hue;
                applyFavicon();
            }
        });
    }

    function detectDarkScheme() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            return false;
        }
    }

    function hslToRgb(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
    }

    function getLuminance({ r, g, b }) {
        const toLin = c => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    }

    function contrastRatio(l1, l2) {
        const L1 = Math.max(l1, l2);
        const L2 = Math.min(l1, l2);
        return (L1 + 0.05) / (L2 + 0.05);
    }

    function getOrgColor() {
        const sub = getOrgSubdomain();
        const hash = djb2Hash(sub);
        // Hue is only 360 buckets, so unrelated orgs collide on the same hue
        // (e.g. 'vishugrade-dev-ed' and 'accenturecomcpq58-dev-ed' both hit
        // hue 65). Saturation comes from a different slice of the same hash
        // (hash/360 % 6), and orgs that still collide are shifted to a free
        // hue against the registry (syncResolvedColor) — so every org the
        // user visits ends up with its own persisted hue.
        const hue = resolvedHues[sub] != null ? resolvedHues[sub] : hash % 360;

        const isDarkBg = detectDarkScheme();

        let sat = 45 + Math.floor(hash / 360) % 6 * 10; // 45, 55, 65, 75, 85, 95
        let light = isDarkBg ? 62 : 48;

        let attempts = 0;
        while (attempts++ < 20) {
            const bgRgb = hslToRgb(hue, sat, light);
            const bgLum = getLuminance(bgRgb);
            const fgRgb = isDarkBg ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
            const fgLum = getLuminance(fgRgb);
            const chromeTabRgb = isDarkBg ? { r: 41, g: 42, b: 47 } : { r: 230, g: 232, b: 234 };
            const chromeLum = getLuminance(chromeTabRgb);

            const vsChrome = contrastRatio(bgLum, chromeLum);
            const vsFg = contrastRatio(bgLum, fgLum);

            if (vsChrome >= 1.6 && vsFg >= 3.2) {
                break;
            }

            if (vsChrome < 1.6) {
                light = isDarkBg ? Math.min(85, light + 3) : Math.max(15, light - 3);
            }
            if (vsFg < 3.2) {
                sat = Math.max(40, sat - 2);
                light = isDarkBg ? Math.min(85, light + 2) : Math.max(15, light - 2);
            }
        }

        return `hsl(${hue}, ${sat}%, ${light}%)`;
    }

    // The official Salesforce cloud mark (the cloud-only logo, no wordmark),
    // traced verbatim from Salesforce's published cloud SVG. It's the classic
    // wide cloud with a two-lobe top — filled with the org color, transparent
    // background. No text anywhere: just the cloud + the comet sparkle below.
    const COMET_CLOUD_PATH =
        'M416.224 76.763c32.219-33.57 77.074-54.391 126.682-54.391 65.946 0 123.48 36.772 154.12 91.361 26.626-11.896 56.098-18.514 87.106-18.514 118.94 0 215.368 97.268 215.368 217.247 0 119.993-96.428 217.261-215.368 217.261a213.735 213.735 0 0 1-42.422-4.227c-26.981 48.128-78.397 80.646-137.412 80.646-24.705 0-48.072-5.706-68.877-15.853-27.352 64.337-91.077 109.448-165.348 109.448-77.344 0-143.261-48.939-168.563-117.574-11.057 2.348-22.513 3.572-34.268 3.572C75.155 585.74.5 510.317.5 417.262c0-62.359 33.542-116.807 83.378-145.937-10.26-23.608-15.967-49.665-15.967-77.06C67.911 87.25 154.79.5 261.948.5c62.914 0 118.827 29.913 154.276 76.263';

    // Salesforce Comet favicon as an SVG data URI: no background, just the
    // official cloud mark filled with the org color. No text, no sparkle, no
    // white dots — the cloud alone, like the reference logo.
    // A page can opt into a different glyph by setting
    // window.__sfarcFaviconPaths (array of SVG path d strings, stroked in the
    // org color) before this script runs — e.g. Data Export shows a download
    // arrow, the Code Editor shows its code-brackets mark. Each new-tab tool
    // page gets its own matching glyph, still org-colored.
    function createColoredFaviconDataUrl(color, withGreenDot) {
        const dot = withGreenDot
            ? '<circle cx="819.6" cy="603.2" r="70" fill="#ffffff"/><circle cx="819.6" cy="603.2" r="50" fill="#22c55e"/>'
            : '';
        let custom = window.__sfarcFaviconPaths;
        if (!custom && window.__sfarcFaviconStrokePath) {
            custom = [window.__sfarcFaviconStrokePath];
        }
        // Font Awesome glyph: exact same icon the launcher popup shows for this
        // tool, filled with the org color. Paths are the FA solid 512x512 path
        // data (extracted from the bundled FA library), so the browser-tab
        // favicon is pixel-identical to the popup row icon.
        const fillPaths = window.__sfarcFaviconFill;
        let svg;
        if (fillPaths && fillPaths.length) {
            const paths = fillPaths.map(d => `<path d="${d}" fill="${color}"/>`).join('');
            svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16">${paths}</svg>`;
        } else if (custom && custom.length) {
            const paths = custom.map(d =>
                `<path d="${d}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
            ).join('');
            svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">${paths}</svg>`;
        } else {
            svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 999.5 699.74" width="16" height="16"><path d="${COMET_CLOUD_PATH}" fill="${color}"/>${dot}</svg>`;
        }
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    let isApplying = false;
    let panelIndicatorActive = false;

    function applyFavicon() {
        if (isApplying) return;
        isApplying = true;

        try {
            const color = getOrgColor();
            // Expose the org color so in-page icons (e.g. the Comet header's
            // Code Editor icon) can match the favicon tint.
            try {
                document.documentElement.style.setProperty('--sfarc-org-color', color);
            } catch (e) { }
            const dataUrl = createColoredFaviconDataUrl(color, panelIndicatorActive);

            const head = document.head || document.getElementsByTagName('head')[0];
            if (!head) return;

            let favicons = head.querySelectorAll("link[rel*='icon']");
            let targetLink = document.getElementById('sfarc-colored-favicon');

            if (!targetLink) {
                targetLink = document.createElement('link');
                targetLink.id = 'sfarc-colored-favicon';
                targetLink.rel = 'shortcut icon';
                targetLink.type = 'image/svg+xml';
                head.appendChild(targetLink);
            } else {
                targetLink.type = 'image/svg+xml';
            }

            targetLink.href = dataUrl;

            // Remove standard default favicons so ours takes priority
            favicons.forEach(link => {
                if (link !== targetLink && link.id !== 'sfarc-colored-favicon' && link.id !== 'sfarc-custom-favicon') {
                    link.remove();
                }
            });
        } catch (e) {
            console.error('[salesforce comet] Colored Favicon error:', e);
        } finally {
            isApplying = false;
        }
    }

    // Exposed globally so main.js can toggle the green dot on panel open/close
    window.__sfarcSetPanelIndicator = function (show) {
        const newState = !!show;
        if (panelIndicatorActive === newState) return;
        panelIndicatorActive = newState;
        applyFavicon();
    };

    function initColoredFavicon() {
        const host = window.location.hostname.toLowerCase();
        if (host === 'login.salesforce.com' || host === 'test.salesforce.com') return;

        applyFavicon();

        if (window.chrome && chrome.storage && chrome.storage.local) {
            if (reliableSource) {
                // Org known from the URL: resolve its color against the
                // registry (collision shift + persistence) and re-apply if
                // it changed from the base hash color.
                syncResolvedColor();
            } else {
                // Fallback only when we couldn't determine the org from the
                // URL (hostname or ?host= param). Read the per-org subdomain
                // registry instead of the shared sfarcLoggedInUser: each org
                // owns its own key, so the settled color is stable across
                // refreshes (it follows the org the user was last active in)
                // and hashes the same subdomain the org page uses, so tool
                // pages match their org's color.
                chrome.storage.local.get(['sfarcOrgSubdomains'], (res) => {
                    const picked = pickLatestRegistryEntry(res && res.sfarcOrgSubdomains);
                    if (picked && picked.entry.subdomain !== cachedSubdomain) {
                        cachedSubdomain = picked.entry.subdomain;
                        cachedHost = picked.host;
                        if (picked.entry.resolvedHue != null) {
                            resolvedHues[picked.entry.subdomain] = picked.entry.resolvedHue;
                        }
                        applyFavicon();
                    }
                });
            }
        }

        try {
            const mql = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyFavicon();
            if (mql.addEventListener) {
                mql.addEventListener('change', handler);
            } else if (mql.addListener) {
                mql.addListener(handler);
            }
        } catch (e) { }

        // Observe document.head to re-apply if Salesforce Lightning SPA overwrites
        // favicon, or if another extension (e.g. Salesforce Inspector) injects or
        // replaces a favicon link AFTER us. Re-assert ours whenever our link is
        // missing OR any foreign favicon link exists.
        const targetHead = document.head || document.getElementsByTagName('head')[0];
        if (targetHead) {
            const observer = new MutationObserver(() => {
                const ourLink = document.getElementById('sfarc-colored-favicon');
                const foreign = Array.from(document.querySelectorAll("link[rel*='icon']")).filter(l =>
                    l !== ourLink && l.id !== 'sfarc-colored-favicon' && l.id !== 'sfarc-custom-favicon' && document.head.contains(l));
                if (!ourLink || !document.head.contains(ourLink) || foreign.length) {
                    applyFavicon();
                }
            });

            observer.observe(targetHead, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initColoredFavicon);
    } else {
        initColoredFavicon();
    }
})();
