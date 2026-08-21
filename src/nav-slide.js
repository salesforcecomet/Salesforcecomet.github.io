/**
 * Cross-page slide transition for the sfir tab pages
 * (Export / Import / Limits / Metadata).
 *
 * The four tabs are separate documents, so switching tabs is a real
 * navigation. This module makes it feel like a carousel:
 *   - Entrance: when this page loads and the PREVIOUS page is known (we got
 *     here by clicking a nav tab), the page slides in from the right when
 *     moving forward in tab order, or from the left when moving backward.
 *   - Exit: clicking a nav tab slides the current page out in the direction
 *     of travel, then navigates.
 *
 * Direction is derived from the tab order in PAGE_ORDER plus the previously
 * visited page stored in sessionStorage. Direct opens (menu, bookmarks) have
 * no previous page, so no animation plays. prefers-reduced-motion disables
 * everything.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var PAGE_ORDER = ['data-export', 'data-import', 'org-limits', 'metadata-exporter'];
  var PAGE_MAP = {
    export: 'data-export.html',
    import: 'data-import.html',
    limits: 'org-limits.html',
    metadata: 'metadata-exporter.html'
  };
  var STORAGE_KEY = 'sfir_nav_prev_page';
  var EXIT_MS = 210; // must match the CSS animation duration
  var NAV_SELECTOR = '.slds-builder-header__item-action';

  var reduceMotion = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var navigating = false;

  function currentPage() {
    var m = (window.location.pathname || '').match(/([^/]+)\.html$/);
    return m ? m[1] : null;
  }

  function readPrev() {
    try { return window.sessionStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function storePrev(page) {
    try { window.sessionStorage.setItem(STORAGE_KEY, page || ''); } catch (e) { /* ignore */ }
  }

  // ── Entrance: slide in from the side the previous page was on ─────────
  function applyEntrance() {
    var cur = currentPage();
    var prev = readPrev();
    if (!cur) return;
    storePrev(cur);
    if (!prev || prev === cur || reduceMotion) return;
    var ci = PAGE_ORDER.indexOf(cur);
    var pi = PAGE_ORDER.indexOf(prev);
    if (ci < 0 || pi < 0) return;
    // Moving forward in tab order -> the new page enters from the right.
    // Double rAF: let the first paint (fonts, layout, async content kickoff)
    // settle before the slide starts, so it doesn't fight the initial render.
    var raf = window.requestAnimationFrame || function (cb) { return window.setTimeout(cb, 0); };
    var cls = ci > pi ? 'sfir-page-enter-right' : 'sfir-page-enter-left';
    raf(function () {
      raf(function () {
        if (!navigating) document.documentElement.classList.add(cls);
      });
    });
  }

  // Resolve the destination page key + href for a nav element. Returns null
  // for non-tab links (e.g. org badge, help).
  function resolveTarget(a) {
    var href = a.getAttribute('href');
    var page = a.getAttribute('data-page');
    var file = null;

    if (href) {
      var m = href.match(/([^/?#]+)\.html/);
      if (m) file = m[1];
    } else if (page && PAGE_MAP[page]) {
      file = PAGE_MAP[page].replace('.html', '');
      href = PAGE_MAP[page] + '?' + (window.location.search || '').replace(/^\?/, '');
    }
    if (!file || PAGE_ORDER.indexOf(file) < 0) return null;
    if (!href) {
      href = file + '.html?' + (window.location.search || '').replace(/^\?/, '');
    }
    return { file: file, href: href };
  }

  // ── Exit: slide out toward the destination, then navigate ─────────────
  function go(href, fromRight) {
    if (navigating) return;
    navigating = true;
    if (reduceMotion || !href) {
      window.location.href = href;
      return;
    }
    var root = document.documentElement;
    root.classList.add(fromRight ? 'sfir-page-exit-left' : 'sfir-page-exit-right');
    window.setTimeout(function () {
      window.location.href = href;
    }, EXIT_MS + 30);
  }

  function onDocClick(e) {
    if (navigating) return;
    // New-tab gestures keep native behavior (no slide).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!e.target || typeof e.target.closest !== 'function') return;
    var a = e.target.closest(NAV_SELECTOR);
    if (!a || !(a.tagName === 'A' || a.tagName === 'BUTTON')) return;

    var cur = currentPage();
    if (!cur) return;
    var target = resolveTarget(a);
    if (!target) return;

    // Capture phase: intercept before the page's own nav handlers run so the
    // exit animation can play first.
    e.preventDefault();
    e.stopPropagation();

    // Clicking the tab you're already on must NOT reload the page — swallow
    // it here, otherwise the anchor's default navigation (or the page's own
    // location.href handler) reloads the same URL.
    if (target.file === cur) return;

    storePrev(cur);
    go(target.href, PAGE_ORDER.indexOf(target.file) >= PAGE_ORDER.indexOf(cur));
  }

  function init() {
    applyEntrance();
    document.addEventListener('click', onDocClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed for tests (distinct from theme-manager's __sfirNavSlide pill helper).
  window.__sfirNavSlideTransition = { currentPage: currentPage, resolveTarget: resolveTarget };
})();
