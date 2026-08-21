(function() {
    if (window.__sfarcThemeManagerLoaded) return;
    window.__sfarcThemeManagerLoaded = true;

    // Build stamp: lets you verify the loaded extension is the latest build.
    // Read it from any page console: window.__SFARC_BUILD. If this value is
    // older than the one in src/theme-manager.js, Chrome is serving a stale
    // copy — reload the extension at chrome://extensions and hard-refresh.
    try {
        window.__SFARC_BUILD = '2026-08-17 10:52 (src)';
        if (document.documentElement) document.documentElement.dataset.sfarcBuild = window.__SFARC_BUILD;
    } catch (e) {}

    const isDarkOnlyPage = window.location.pathname.includes('graphql-explorer.html') ||
                           window.location.pathname.includes('diff-checker.html');

    // Hosted inside sfir-shell.html (?sfirEmbed=1): the shell renders the ONE
    // top bar, so the page hides its own header and renders body-only. This
    // MUST live in an external script — MV3 extension pages block inline
    // scripts (CSP script-src 'self'), so a <script> tag in the page body
    // never executes and the page's own header stays visible (which is also
    // how the Limits iframe could be navigated to the Data Import page by
    // clicking the visible header's Import pill).
    const sfirEmbedded = new URLSearchParams(window.location.search).get('sfirEmbed') === '1';
    if (sfirEmbedded) {
        // html class applies immediately at head time (no flash of the page's
        // own header); the body class is added as soon as it exists for any
        // CSS/JS that keys off the body.
        if (document.documentElement) document.documentElement.classList.add('sfir-embedded');
        const applyEmbed = () => {
            if (document.body) document.body.classList.add('sfir-embedded');
        };
        if (document.body) applyEmbed();
        else document.addEventListener('DOMContentLoaded', applyEmbed);
    }

    function getPrefix() {
        const path = location.pathname;
        if (/\/src\/[^\/]+\.html?$/.test(path)) {
            return '../icons/';
        }
        if (/\/dist\/src\/[^\/]+\.html?$/.test(path)) {
            return '../../icons/';
        }
        return 'icons/';
    }

    // Dark-only pages (org-limits, metadata-exporter, graphql-explorer, etc.)
    // hard-code a dark body background and MUST never lose their dark theme
    // class, even if the user's saved theme resolves to light — otherwise the
    // header nav + components fall back to light styling on a dark page.
    function updateIconsAndFavicon(isDark) {
        // 1. Update body / document element class for theme
        if (isDark || isDarkOnlyPage) {
            document.documentElement.classList.add('sfarc-dark-theme');
            if (document.body) {
                document.body.classList.add('sfarc-dark-theme');
                document.body.classList.remove('light-theme');
            }
        } else {
            document.documentElement.classList.remove('sfarc-dark-theme');
            if (document.body) {
                document.body.classList.remove('sfarc-dark-theme');
                document.body.classList.add('light-theme');
            }
        }

        // 2. Update Favicon
        const favicon = document.querySelector("link[rel*='icon']");
        const expectedFavicon = 'icon-48.png';
        const prefix = getPrefix();
        const expectedHref = prefix + expectedFavicon;

        if (favicon) {
            const currentHref = favicon.getAttribute('href') || '';
            // Leave comet-managed favicons alone (id-based, since their href is a
            // base64 data URI): colored-favicon.js owns those and re-asserts them.
            const isCometFavicon = favicon.id === 'sfarc-colored-favicon' ||
                                   favicon.id === 'sfarc-custom-favicon' ||
                                   currentHref.includes('sfarc-colored-favicon');
            if (currentHref !== expectedHref && !isCometFavicon) {
                favicon.setAttribute('href', expectedHref);
            }
        } else {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = expectedHref;
            document.head.appendChild(link);
        }

        // 3. Update inner <img> logos if needed
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && /icon-(black|white|color)?-?(\d+)\.png/i.test(src)) {
                const newSrc = src.replace(/icon-(black|white|color)?-?(\d+)\.png/i, (match, type, size) => `icon-${size}.png`);
                if (img.getAttribute('src') !== newSrc) {
                    img.setAttribute('src', newSrc);
                }
            }
        });
    }

    function hexToRgb(hex) {
        if (!hex) return '33, 150, 243';
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        return isNaN(num) ? '33, 150, 243' : `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    }

    function hexToRgbArr(hex) {
        const str = hexToRgb(hex);
        return str.split(',').map(s => parseInt(s, 10));
    }

    function mixHex(hex, other, weight) {
        // weight = fraction of `other` to mix in (0..1)
        const a = hexToRgbArr(hex);
        const b = hexToRgbArr(other);
        const c = a.map((v, i) => Math.round(v + (b[i] - v) * weight));
        return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    }

    function deriveAccentShades(color) {
        // Build the full accent family from a single base color:
        //   light = tint for text/icons on dark backgrounds (was #5eb4ff/#38bdf8)
        //   dark  = shade for solid fills that carry white text (was #1976d2)
        //   glow  = brighter partner for gradients/glows (was #38bdf8 in gradients)
        const light = mixHex(color, '#ffffff', 0.45);
        const dark = mixHex(color, '#000000', 0.35);
        const glow = mixHex(color, '#ffffff', 0.22);
        const soft = mixHex(color, '#ffffff', 0.9);
        return { light, dark, glow, soft };
    }

    // "Match org favicon" accent: derive a vibrant accent from the org's
    // subdomain — the same DJB2-hashed hue family colored-favicon.js uses for
    // the tab favicon, so the extension accent and the org favicon share a hue.
    function sfarcOrgAccentColor() {
        try {
            let sub = '';
            const host = window.location.hostname.toLowerCase();
            if (host && (host.includes('salesforce') || host.includes('force.com'))) {
                sub = (host.split('.')[0] || '').replace(/--c$/, '');
            }
            if (!sub) {
                const params = new URLSearchParams(window.location.search);
                const hostParam = params.get('host');
                if (hostParam) sub = (hostParam.split('.')[0] || '').replace(/--c$/, '');
            }
            if (!sub) {
                const raw = localStorage.getItem('sfarc_logged_in_user');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.username && parsed.username.includes('@')) {
                        sub = parsed.username.split('@')[1].split('.')[0];
                    }
                }
            }
            sub = sub || 'salesforce';
            let hash = 5381;
            for (let i = 0; i < sub.length; i++) hash = ((hash << 5) + hash) + sub.charCodeAt(i);
            const hue = Math.abs(hash) % 360;
            // Theme-aware: dark mode uses the vibrant bright shade, light mode
            // uses a DARK shade of the org hue so accents stay visible on
            // white (updateIconsAndFavicon applies the theme class before we
            // run).
            const isDark =
                (document.documentElement && document.documentElement.classList.contains('sfarc-dark-theme')) ||
                (document.body && document.body.classList.contains('sfarc-dark-theme')) ||
                (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
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

    // Pick the readable text color for solid accent fills (active nav pill
    // etc.): a DARK shade of the asset color when the accent is light
    // (white-on-lime is unreadable), white when the accent is dark. Uses the
    // gamma-corrected WCAG relative-luminance so mid blues still get white.
    function accentContrastColor(color) {
        const lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        const [r, g, b] = hexToRgbArr(color).map(v => lin(v / 255));
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > 0.5) return mixHex(color, '#000000', 0.5); // dark shade of the asset color
        return '#ffffff';
    }

    function applyAccentColor(color) {
        if (color === 'org') color = sfarcOrgAccentColor();
        if (!color) color = '#2196f3';
        const rgb = hexToRgb(color);
        const shades = deriveAccentShades(color);
        const root = document.documentElement;
        root.style.setProperty('--sfarc-accent-contrast', accentContrastColor(color));

        root.style.setProperty('--primary', color);
        root.style.setProperty('--primary-color', color);
        root.style.setProperty('--primary-dark', color);
        root.style.setProperty('--primary-light', `rgba(${rgb}, 0.15)`);
        root.style.setProperty('--primary-color-rgb', rgb);
        root.style.setProperty('--primary-light-bg', `rgba(${rgb}, 0.12)`);
        root.style.setProperty('--sfarc-primary', color);
        root.style.setProperty('--sfarc-accent', color);
        root.style.setProperty('--sfarc-accent-rgb', rgb);
        root.style.setProperty('--sfarc-accent-light', shades.light);
        root.style.setProperty('--sfarc-accent-dark', shades.dark);
        root.style.setProperty('--sfarc-accent-dark-rgb', hexToRgb(shades.dark));
        root.style.setProperty('--sfarc-accent-glow', shades.glow);
        root.style.setProperty('--sfarc-accent-glow-rgb', hexToRgb(shades.glow));
        root.style.setProperty('--sfarc-accent-light-rgb', hexToRgb(shades.light));
        root.style.setProperty('--sfarc-accent-soft', shades.soft);
        root.style.setProperty('--mac-active-blue', color);
        root.style.setProperty('--clone-brand', color);
        root.style.setProperty('--sfir-btn-border-active', color);
        root.style.setProperty('--sfarc-input-focus-border', color);
    }
    window.applyAccentColor = applyAccentColor;

    function injectScrollbarStyles() {
        if (document.getElementById('sfarc-global-scrollbars')) return;
        const style = document.createElement('style');
        style.id = 'sfarc-global-scrollbars';
        style.textContent = `
            ::-webkit-scrollbar {
                width: 6px !important;
                height: 6px !important;
                background: transparent !important;
            }
            ::-webkit-scrollbar-track {
                background: transparent !important;
            }
            ::-webkit-scrollbar-thumb {
                background: transparent !important;
                border-radius: 6px !important;
            }
            *:hover::-webkit-scrollbar-thumb {
                background: rgba(150, 150, 150, 0.35) !important;
            }
            *:hover::-webkit-scrollbar-thumb:hover {
                background: rgba(150, 150, 150, 0.6) !important;
            }
        `;
        if (document.head) document.head.appendChild(style);
    }

    function initThemeSync() {
        chrome.storage.sync.get(['sfiSettings'], (result) => {
            const settings = result.sfiSettings || {};
            const theme = settings.theme || 'system';
            const isDark = isDarkOnlyPage || theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            updateIconsAndFavicon(isDark);
            applyAccentColor(settings.accentColor);
            injectScrollbarStyles();
        });
    }

    // Run immediately and on DOMContentLoaded
    initThemeSync();
    injectScrollbarStyles();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initThemeSync();
            injectScrollbarStyles();
        });
    } else {
        // Also do a quick run if DOM is already loaded
        setTimeout(initThemeSync, 0);
    }

    // Set up MutationObserver to handle dynamically added images or attributes
    const observer = new MutationObserver(() => {
        chrome.storage.sync.get(['sfiSettings'], (result) => {
            const settings = result.sfiSettings || {};
            const theme = settings.theme || 'system';
            const isDark = isDarkOnlyPage || theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            updateIconsAndFavicon(isDark);
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sfiSettings) {
            const settings = changes.sfiSettings.newValue || {};
            const theme = settings.theme || 'system';
            const isDark = isDarkOnlyPage || theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            updateIconsAndFavicon(isDark);
            applyAccentColor(settings.accentColor);
        }
    });

    // Listen for system preference changes
    try {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            chrome.storage.sync.get(['sfiSettings'], (result) => {
                const settings = result.sfiSettings || {};
                const theme = settings.theme || 'system';
                const isDark = isDarkOnlyPage || theme === 'dark' || (theme === 'system' && mql.matches);
                updateIconsAndFavicon(isDark);
                // Re-derive the org accent too, so the shade follows the OS
                // scheme live when the theme is 'system'.
                applyAccentColor(settings.accentColor);
            });
        };
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
        } else if (mql.addListener) {
            mql.addListener(handler);
        }
    } catch (e) {}

    // ── Header-nav active indicator ──────────────────────────────────────────
    // The active tab gets a static pill behind it. (It used to physically slide
    // across the header on every switch, but users read the cross-page slide as
    // a horizontal slider and it replayed on every page load — so the pill now
    // just sits under the active tab with no motion.)
    // React pages (Export/Import) render `.sfir-nav-slider` themselves via
    // PageHeader; static pages (Limits/Metadata) get it injected here.
    function navTabItems(listEl) {
        return Array.prototype.slice.call(listEl.querySelectorAll(':scope > li')).filter(li => !li.classList.contains('sfir-nav-slider'));
    }

    function navActiveIndex(listEl) {
        const items = navTabItems(listEl);
        for (let i = 0; i < items.length; i++) {
            const a = items[i].querySelector('a, button');
            if (a && (a.classList.contains('sfir-nav-active') || a.classList.contains('active') || a.getAttribute('aria-current') === 'page')) {
                return i;
            }
        }
        return -1;
    }

    function navSliderEl(listEl) {
        let slider = listEl.querySelector(':scope > .sfir-nav-slider');
        if (!slider) {
        slider = document.createElement('li');
        slider.className = 'sfir-nav-slider sfir-nav-slider-init';
            slider.setAttribute('aria-hidden', 'true');
            listEl.insertBefore(slider, listEl.firstChild);
        }
        return slider;
    }

    function placeNavSlider(listEl, slider, index) {
        const items = navTabItems(listEl);
        const item = items[index];
        if (!item) return;
        slider.style.width = item.getBoundingClientRect().width + 'px';
        slider.style.transform = 'translateX(' + navTranslateX(listEl, item) + 'px) scaleX(1)';
    }

    // Compute the pill's translateX for a given tab index.
    function navTranslateX(listEl, item) {
        const lr = listEl.getBoundingClientRect();
        const ir = item.getBoundingClientRect();
        const borderLeft = parseFloat(getComputedStyle(listEl).borderLeftWidth) || 0;
        return ir.left - lr.left - borderLeft - 3;
    }

    // Position the pill statically under the active tab. The `fromIndex`
    // parameter is ignored — the cross-page slide was removed.
    function positionNavSlider(listEl, fromIndex) {
        const items = navTabItems(listEl);
        const active = navActiveIndex(listEl);
        if (active < 0 || active >= items.length) return;
        const slider = navSliderEl(listEl);
        const target = items[active];
        const targetX = navTranslateX(listEl, target);
        const targetW = target.getBoundingClientRect().width;
        slider.style.width = targetW + 'px';
        slider.style.transform = 'translateX(' + targetX + 'px) scaleX(1)';
        // Fresh sliders (just created by React / injected here) sit at the CSS
        // default (left edge, zero width) and the transform transition would
        // animate from there on the very first position. Commit the resting
        // transform with transitions suppressed, force a synchronous reflow so
        // the new value is committed, then re-enable transitions.
        if (slider.classList.contains('sfir-nav-slider-init')) {
            void slider.offsetWidth;
            slider.classList.remove('sfir-nav-slider-init');
        }
        slider.style.animation = '';
    }

    function bindNavSlider(listEl) {
        // The sliding nav pill was removed (it read as a horizontal slider);
        // the static pill is positioned in initHeaderNavSliders / PageHeader.
        if (listEl.__sfarcNavSliderBound) return;
        listEl.__sfarcNavSliderBound = true;
    }

    function initHeaderNavSliders() {
        document.querySelectorAll('.slds-builder-header__nav-list').forEach(listEl => {
            // React pages (Export/Import) render and position their own pill
            // in PageHeader before DOMContentLoaded; only inject/position for
            // the static pages (Limits/Metadata) here.
            if (!listEl.querySelector(':scope > .sfir-nav-slider')) {
                navSliderEl(listEl);
                positionNavSlider(listEl, -1);
            }
            bindNavSlider(listEl);
        });
    }

    window.__sfarcNavSlide = {
        position: positionNavSlider,
        bind: bindNavSlider
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderNavSliders);
    } else {
        setTimeout(initHeaderNavSliders, 0);
    }
})();
