/* ============================================================================
   close-on-outside.js — universal "tap outside to close" for every drawer
   and modal in the extension.

   Load this script on every extension page (and in the injected panel via
   background.js) so ALL overlays behave consistently: a tap/click outside the
   dialog's content card closes it, everywhere, with no per-page wiring.

   Two patterns are handled by one delegated click listener:
     1. Backdrop overlays — the element itself is the full-screen backdrop, so
        clicking anywhere outside the content card means the overlay element
        itself received the click (e.target === overlay). Covered: .sfarc-modal,
        .sfarc-drawer-modal, .sfarc-modal-backdrop, .modal-overlay,
        .sfarc-modal-overlay, .modal, .drawer-overlay,
        .sfarc-glass-modal-overlay, .sfarc-code-drawer-overlay.
     2. Overlay-less drawers — slide-in panels with NO backdrop (the page stays
        interactive). Clicking anywhere outside the panel closes it. Covered:
        #history-drawer (Anonymous Apex).

   close() is mechanism-aware and idempotent — it removes the .open class,
   re-adds the .hidden class, or clears the inline display, whichever the
   element actually uses — so it can never get stuck hidden or double-fire.
   Esc also closes the topmost open overlay/drawer.
   ========================================================================== */
(function () {
    'use strict';
    if (window.__sfarcCloseOnOutside) return;
    window.__sfarcCloseOnOutside = true;

    const BACKDROP_SELECTOR = [
        '.sfarc-modal',
        '.sfarc-drawer-modal',
        '.sfarc-modal-backdrop',
        '.modal-overlay',
        '.sfarc-modal-overlay',
        '.modal',
        '.drawer-overlay',
        '.sfarc-glass-modal-overlay',
        '.sfarc-code-drawer-overlay'
    ].join(', ');

    // Slide-in drawers with no backdrop — close on any click outside them.
    const NAKED_DRAWER_SELECTOR = '#history-drawer';

    function close(el) {
        if (!el || !el.isConnected) return;
        // .open-class based (CSS toggles display, e.g. anonymous-apex .modal)
        if (el.classList.contains('open')) { el.classList.remove('open'); return; }
        // .hidden-class based (popup-style): already closed → nothing to do
        if (el.classList.contains('hidden')) return;
        // inline-display based (panel drawers, modal overlays)
        if (el.style && el.style.display && el.style.display !== 'none') {
            el.style.display = 'none';
            return;
        }
        // Fallback for unknown mechanisms — never gets permanently stuck
        // because reopening always removes the .hidden class.
        el.classList.add('hidden');
    }

    function isVisible(el) {
        return el && el.isConnected && !el.hidden &&
            getComputedStyle(el).display !== 'none';
    }

    document.addEventListener('click', (e) => {
        const t = e.target;

        // 1) Naked drawers: close when the click lands outside the panel.
        const naked = document.querySelector(NAKED_DRAWER_SELECTOR);
        if (naked && naked.classList.contains('open') && !naked.contains(t)) {
            close(naked);
        }

        // 2) Backdrop overlays: close the one whose backdrop element itself
        //    received the click (i.e. outside its content card). Only the
        //    topmost overlay can receive the click, so stacked modals never
        //    close together.
        if (t instanceof Element && t.matches && t.matches(BACKDROP_SELECTOR) && isVisible(t)) {
            close(t);
        }
    }, false);

    // Esc closes the topmost open overlay/drawer.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const all = document.querySelectorAll(BACKDROP_SELECTOR);
        for (let i = all.length - 1; i >= 0; i--) {
            const el = all[i];
            if (isVisible(el)) { close(el); return; }
        }
        const naked = document.querySelector(NAKED_DRAWER_SELECTOR);
        if (naked && naked.classList.contains('open')) close(naked);
    }, false);
})();
