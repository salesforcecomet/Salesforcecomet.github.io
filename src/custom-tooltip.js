/**
 * Salesforce Comet - Global Instant Custom Tooltip System
 * Replaces standard browser title tooltips with instant, multi-directional (top, bottom, left, right)
 * modern dark tooltips auto-positioned based on available viewport space.
 */
(function initCometCustomTooltipSystem() {
    if (window.__sfarcCustomTooltipInitialized) return;
    window.__sfarcCustomTooltipInitialized = true;

    // This script runs BOTH in the extension's own pages (popup, panel, code
    // editor, ...) and as a content script injected into every Salesforce page.
    // On extension pages every element is ours, so any [title]/[data-tooltip]
    // may show a custom tooltip. On Salesforce pages we must ONLY intercept
    // the extension's own UI and never hijack Salesforce's native tooltips.
    const isExtensionPage = /^(chrome|moz|edge)-extension:/.test(location.protocol);

    // True when the element belongs to the extension's injected UI:
    // explicit data-tooltip opt-in, or an ancestor that is the main panel
    // (#sfarc-panel), the flow scanner (#fs-panel / #fs-trigger-btn), or any
    // element carrying our sfarc-/fs- prefixed id or class.
    function isExtensionOwned(el) {
        let node = el;
        while (node && node.nodeType === 1 && node !== document.documentElement) {
            if (node.hasAttribute('data-tooltip')) return true;
            const id = node.id || '';
            const cls = typeof node.className === 'string' ? node.className : '';
            if (id === 'sfarc-panel' || id === 'fs-panel' || id === 'fs-trigger-btn' || id === 'fs-backdrop') return true;
            if (id.indexOf('sfarc-') === 0 || id.indexOf('fs-') === 0) return true;
            if (cls.indexOf('sfarc-') !== -1 || cls.indexOf('fs-') !== -1) return true;
            node = node.parentElement;
        }
        return false;
    }

    let tooltipEl = null;
    let arrowEl = null;
    let activeTarget = null;
    let hideTimer = null;
    let currentIsDark = false;

    // Chosen tooltip side per target element, so repeated hovers on the same
    // element NEVER flip the tooltip between sides. The auto-direction logic
    // below picks sides on a razor-thin threshold (spaceTop < height + gap),
    // so without this cache a top-bar button can show its tooltip above on
    // one hover and below on the next (or vice-versa) as the viewport or
    // scroll position changes by a few pixels. First hover decides; later
    // hovers reuse that side while it still has room.
    const sideCache = new WeakMap();

    function sideHasRoom(side, rect, tipRect) {
        const gap = 8;
        const spaceTop = rect.top;
        const spaceBottom = window.innerHeight - rect.bottom;
        const spaceLeft = rect.left;
        const spaceRight = window.innerWidth - rect.right;
        if (side === 'top') return spaceTop >= tipRect.height + gap;
        if (side === 'bottom') return spaceBottom >= tipRect.height + gap;
        if (side === 'left') return spaceLeft >= tipRect.width + gap;
        if (side === 'right') return spaceRight >= tipRect.width + gap;
        return false;
    }

    function resolveIsDark() {
        return !!(document.body && (document.body.classList.contains('sfarc-dark-theme') || !!document.querySelector('#sfarc-panel.sfarc-dark-theme')));
    }

    // One border treatment for the whole tooltip family: the box and the arrow
    // share the same 1px border color so every tooltip reads identically.
    function themeBorder() {
        return currentIsDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.14)';
    }

    function applyTooltipTheme() {
        if (!tooltipEl) return;
        currentIsDark = resolveIsDark();
        const border = themeBorder();
        const boxFill = currentIsDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.82)';
        // NOTE: must use setProperty with an explicit priority — assigning
        // `style.border = '1px solid x !important'` is silently dropped by the
        // CSSOM in Chrome (the old value stays), which made theme switches
        // leave a stale border/background behind.
        tooltipEl.style.setProperty('background', boxFill, 'important');
        tooltipEl.style.setProperty('color', currentIsDark ? '#f8fafc' : '#0f172a', 'important');
        tooltipEl.style.setProperty('border', '1px solid ' + border, 'important');
        // Uniform hairline on ALL four sides: no inset top highlight, so every
        // tooltip reads the same border on every edge (box and arrow share it).
        tooltipEl.style.setProperty('box-shadow', currentIsDark ? '0 16px 40px rgba(0, 0, 0, 0.5)' : '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)', 'important');
        if (arrowEl) {
            // Arrow fill must match the box fill EXACTLY (same value) so the
            // border seam where the arrow meets the box is invisible.
            arrowEl.style.setProperty('background', boxFill, 'important');
            arrowEl.style.setProperty('border', '1px solid ' + border, 'important');
        }
    }

    function createTooltipElement() {
        if (tooltipEl) return tooltipEl;

        tooltipEl = document.createElement('div');
        tooltipEl.id = 'sfarc-instant-tooltip';
        tooltipEl.className = 'sfarc-custom-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        currentIsDark = resolveIsDark();
        const border = themeBorder();
        const isDark = currentIsDark;

        tooltipEl.style.cssText = `
            position: fixed;
            z-index: 999999999;
            pointer-events: none;
            background: ${isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.82)'} !important;
            backdrop-filter: blur(20px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(20px) saturate(200%) !important;
            color: ${isDark ? '#f8fafc' : '#0f172a'} !important;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11.5px !important;
            font-weight: 500 !important;
            line-height: 1.35;
            padding: 6px 12px !important;
            border-radius: 8px !important;
            border: 1px solid ${border} !important;
            box-shadow: ${isDark ? '0 16px 40px rgba(0, 0, 0, 0.5)' : '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)'} !important;
            white-space: nowrap;
            opacity: 0;
            transform: scale(0.94);
            transition: opacity 0.1s cubic-bezier(0.16, 1, 0.3, 1), transform 0.1s cubic-bezier(0.16, 1, 0.3, 1);
            display: none;
            letter-spacing: 0.15px;
        `;

        arrowEl = document.createElement('div');
        arrowEl.className = 'sfarc-tooltip-arrow';
        arrowEl.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: ${isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.82)'} !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid ${border} !important;
            transform: rotate(45deg);
            pointer-events: none;
        `;
        tooltipEl.appendChild(arrowEl);

        const parent = document.body || document.documentElement;
        parent.appendChild(tooltipEl);
        return tooltipEl;
    }

    function positionTooltip(target, text) {
        clearTimeout(hideTimer);
        const el = createTooltipElement();
        applyTooltipTheme();

        // Update text node while retaining arrow element
        let textNode = el.querySelector('.sfarc-tooltip-text');
        if (!textNode) {
            textNode = document.createElement('span');
            textNode.className = 'sfarc-tooltip-text';
            el.appendChild(textNode);
        }
        textNode.textContent = text;

        el.style.display = 'block';

        const rect = target.getBoundingClientRect();
        const tipRect = el.getBoundingClientRect();
        const gap = 8;

        const spaceTop = rect.top;
        const spaceBottom = window.innerHeight - rect.bottom;
        const spaceLeft = rect.left;
        const spaceRight = window.innerWidth - rect.right;

        // Side selection, in priority order:
        //   1. The element's own data-tooltip-side (explicit opt-in, e.g. the
        //      shell's top-bar buttons which pin 'bottom' so their tooltips
        //      never clip out of the top of the viewport).
        //   2. The side chosen by a previous hover on this same element
        //      (sideCache) — while it still has room, keep it so the tooltip
        //      never flips sides between hovers.
        //   3. Auto direction calculation based on available space.
        let side = target.getAttribute('data-tooltip-side');
        if (side) {
            if (!sideHasRoom(side, rect, tipRect)) {
                // Explicit side can't fit this hover (target moved / viewport
                // shrank): fall back to the auto logic WITHOUT updating the
                // cache, so a transient change doesn't permanently flip it.
                side = null;
            }
        } else {
            const cached = sideCache.get(target);
            if (cached && sideHasRoom(cached, rect, tipRect)) {
                side = cached;
            }
        }

        if (!side) {
            side = 'top';
            if (side === 'top' && spaceTop < tipRect.height + gap) {
                side = spaceBottom >= tipRect.height + gap ? 'bottom' : (spaceRight >= tipRect.width + gap ? 'right' : 'left');
            } else if (side === 'bottom' && spaceBottom < tipRect.height + gap) {
                side = spaceTop >= tipRect.height + gap ? 'top' : (spaceRight >= tipRect.width + gap ? 'right' : 'left');
            } else if (side === 'left' && spaceLeft < tipRect.width + gap) {
                side = spaceRight >= tipRect.width + gap ? 'right' : (spaceTop >= tipRect.height + gap ? 'top' : 'bottom');
            } else if (side === 'right' && spaceRight < tipRect.width + gap) {
                side = spaceLeft >= tipRect.width + gap ? 'left' : (spaceTop >= tipRect.height + gap ? 'top' : 'bottom');
            }
            sideCache.set(target, side);
        }

        let top = 0;
        let left = 0;

        // Position tooltip box
        if (side === 'top') {
            top = rect.top - tipRect.height - gap;
            left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        } else if (side === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        } else if (side === 'left') {
            top = rect.top + (rect.height / 2) - (tipRect.height / 2);
            left = rect.left - tipRect.width - gap;
        } else if (side === 'right') {
            top = rect.top + (rect.height / 2) - (tipRect.height / 2);
            left = rect.right + gap;
        }

        // Clamp inside viewport
        left = Math.max(6, Math.min(window.innerWidth - tipRect.width - 6, left));
        top = Math.max(6, Math.min(window.innerHeight - tipRect.height - 6, top));

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;

        // Position arrow
        const border = themeBorder();
        arrowEl.style.borderTop = 'none';
        arrowEl.style.borderLeft = 'none';
        arrowEl.style.borderRight = 'none';
        arrowEl.style.borderBottom = 'none';

        if (side === 'top') {
            arrowEl.style.top = 'auto';
            arrowEl.style.bottom = '-4px';
            arrowEl.style.left = `${Math.min(tipRect.width - 12, Math.max(8, rect.left + rect.width / 2 - left - 4))}px`;
            arrowEl.style.borderRight = `1px solid ${border}`;
            arrowEl.style.borderBottom = `1px solid ${border}`;
        } else if (side === 'bottom') {
            arrowEl.style.bottom = 'auto';
            arrowEl.style.top = '-4px';
            arrowEl.style.left = `${Math.min(tipRect.width - 12, Math.max(8, rect.left + rect.width / 2 - left - 4))}px`;
            arrowEl.style.borderLeft = `1px solid ${border}`;
            arrowEl.style.borderTop = `1px solid ${border}`;
        } else if (side === 'left') {
            arrowEl.style.left = 'auto';
            arrowEl.style.right = '-4px';
            arrowEl.style.top = `${Math.min(tipRect.height - 12, Math.max(6, rect.top + rect.height / 2 - top - 4))}px`;
            arrowEl.style.borderTop = `1px solid ${border}`;
            arrowEl.style.borderRight = `1px solid ${border}`;
        } else if (side === 'right') {
            arrowEl.style.right = 'auto';
            arrowEl.style.left = '-4px';
            arrowEl.style.top = `${Math.min(tipRect.height - 12, Math.max(6, rect.top + rect.height / 2 - top - 4))}px`;
            arrowEl.style.borderLeft = `1px solid ${border}`;
            arrowEl.style.borderBottom = `1px solid ${border}`;
        }

        // Instant entrance
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transform = 'scale(0.94)';
            hideTimer = setTimeout(() => {
                if (tooltipEl && tooltipEl.style.opacity === '0') {
                    tooltipEl.style.display = 'none';
                }
            }, 80);
        }
        if (activeTarget && activeTarget.hasAttribute('data-sfarc-title')) {
            activeTarget.setAttribute('title', activeTarget.getAttribute('data-sfarc-title'));
            activeTarget.removeAttribute('data-sfarc-title');
        }
        activeTarget = null;
    }

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[title], [data-tooltip]');
        if (!target) return;

        // Never show custom tooltips over elements that aren't the extension's
        // own UI when running inside a Salesforce page (the content-script
        // context). Salesforce's native title tooltips stay untouched there.
        if (!isExtensionPage && !isExtensionOwned(target)) {
            return;
        }

        let text = target.getAttribute('data-tooltip');
        if (!text && target.hasAttribute('title')) {
            text = target.getAttribute('title');
            if (text) {
                target.setAttribute('data-sfarc-title', text);
                target.removeAttribute('title'); // Instantly suppress native slow OS tooltip
            }
        }

        if (!text || !text.trim()) return;

        activeTarget = target;
        positionTooltip(target, text.trim());
    }, true);

    document.addEventListener('mouseout', (e) => {
        if (activeTarget) {
            if (!e.relatedTarget || (activeTarget !== e.relatedTarget && !activeTarget.contains(e.relatedTarget))) {
                hideTooltip();
            }
        }
    }, true);

    document.addEventListener('mousedown', hideTooltip, true);
    document.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('resize', hideTooltip, true);

    // Public API so feature code can pin a tooltip on demand (e.g. clicking a
    // datatype icon). Reuses the exact same renderer + styling as hover.
    window.__sfarcTooltip = {
        show: (target, text) => {
            if (!target) return;
            activeTarget = target;
            positionTooltip(target, String(text));
        },
        hide: hideTooltip
    };
})();
