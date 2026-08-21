(function () {
    if (window.__sfarcDynamicFaviconLoaded) return;
    window.__sfarcDynamicFaviconLoaded = true;

    function getIconPath(isDark, sizeAttr) {
        const base = document.querySelector('base') ? (new URL(document.querySelector('base').href, location.href)).pathname.replace(/\/?[^\/]*$/, '') : '';
        const relPrefix = (location.pathname.includes('/src/') || document.currentScript?.src?.includes('/src/')) ? '../icons/' : (base ? (base + '/icons/') : 'icons/');
        const name = isDark ? 'icon-white-48.png' : 'icon-black-48.png';
        return relPrefix + name;
    }

    function resolveBase(possibleBase) {
        try {
            const u = new URL(possibleBase, location.href);
            if (u.pathname.endsWith('.html')) {
                const parts = u.pathname.split('/');
                parts.pop();
                u.pathname = parts.join('/');
            }
            return u.toString().replace(/\/$/, '');
        } catch (e) {
            return '';
        }
    }

    function detectDarkScheme() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            return false;
        }
    }

    function getCorrectIconUrl() {
        const isDark = detectDarkScheme();
        let scriptDirBase = '';
        if (document.currentScript && document.currentScript.src) {
            scriptDirBase = resolveBase(document.currentScript.src);
        }
        const tryBases = [];
        if (scriptDirBase) tryBases.push(scriptDirBase + '/../icons/');
        const path = location.pathname;
        if (/\/src\/[^\/]+\.html?$/.test(path)) {
            tryBases.unshift('../icons/');
        }
        if (/^\//.test(path)) {
            tryBases.push('icons/');
        }
        const rootOrigin = location.origin + (chrome?.runtime?.getURL ? chrome.runtime.getURL('icons/').replace(location.origin, '') : '/icons/');
        tryBases.push(rootOrigin);

        const filename = 'icon-48.png';
        const existing = document.querySelector("link[rel*='icon']");
        const existingHref = existing && existing.href ? existing.href : '';
        if (/icon-(white|black)?-?48\.png/.test(existingHref)) {
            return existingHref.replace(/icon-(white|black)?-?48\.png/, 'icon-48.png');
        }
        for (const b of tryBases) {
            const testUrl = b + filename;
            try {
                new URL(testUrl, location.href);
                return testUrl;
            } catch (e) {}
        }
        return filename;
    }

    function applyDynamicFavicon() {
        const href = getCorrectIconUrl();
        if (!href) return;
        let link = document.getElementById('sfarc-dynamic-favicon');
        if (!link) {
            link = document.createElement('link');
            link.id = 'sfarc-dynamic-favicon';
            link.rel = 'icon';
            link.type = 'image/png';
            document.head.appendChild(link);
        }
        const currentLinks = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
        currentLinks.forEach(other => {
            if (other !== link && other.id !== 'sfarc-colored-favicon' && other.id !== 'sfarc-custom-favicon') {
                other.setAttribute('rel', 'icon-superseded');
                other.remove();
            }
        });
        if (link.href !== href) {
            link.href = href;
        }
    }

    window.__sfarcApplyDynamicFavicon = applyDynamicFavicon;

    applyDynamicFavicon();

    try {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        if (mql.addEventListener) {
            mql.addEventListener('change', applyDynamicFavicon);
        } else if (mql.addListener) {
            mql.addListener(applyDynamicFavicon);
        }
    } catch (e) {}
})();
