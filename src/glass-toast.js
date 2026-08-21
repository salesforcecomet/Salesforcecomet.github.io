
(function (global) {
  'use strict';

  const SVG_ICONS = {
    success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    loading: '<svg viewBox="0 0 24 24" class="toast-icon-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>',
    custom: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>',
    close: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  const TYPE_ACCENTS = {
    success: { accent: '#10b981', soft: 'rgba(16, 185, 129, 0.25)' },
    error: { accent: '#ef4444', soft: 'rgba(239, 68, 68, 0.25)' },
    info: { accent: '#3b82f6', soft: 'rgba(59, 130, 246, 0.25)' },
    warning: { accent: '#f59e0b', soft: 'rgba(245, 158, 11, 0.25)' },
    loading: { accent: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.25)' },
    custom: { accent: '#ffffff', soft: 'rgba(255, 255, 255, 0.25)' }
  };

  const POSITIONS = [
    'top-right', 'top-left', 'top-center',
    'bottom-right', 'bottom-left', 'bottom-center'
  ];

  const regions = {};
  const toasts = new Map();
  let toastCounter = 0;

  function ensureRegion(position) {
    if (regions[position]) return regions[position];
    let div = document.getElementById('toast-region-' + position);
    if (!div) {
      div = document.createElement('div');
      div.id = 'toast-region-' + position;
      div.className = 'toast-region toast-region--' + position;
      document.body.appendChild(div);
    }
    regions[position] = div;
    return div;
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createToastEl(id, message, opts) {
    const type = opts.type || 'custom';
    const accents = TYPE_ACCENTS[type] || TYPE_ACCENTS.custom;
    const accent = opts.accentColor || accents.accent;
    const soft = opts.backgroundColor
      ? 'rgba(255,255,255,0.18)'
      : accents.soft;

    const card = document.createElement('div');
    card.className = 'toast-card';
    card.dataset.phase = 'entering';
    card.dataset.gradient = opts.gradient ? 'true' : 'false';
    card.dataset.withIcon = (opts.withIcon !== false) ? 'true' : 'false';
    card.dataset.singleLine = 'true';

    if (opts.backgroundColor) {
      card.style.setProperty('--toast-surface-bg', opts.backgroundColor);
    }
    if (opts.textColor) {
      card.style.setProperty('--toast-text-primary', opts.textColor);
    }
    card.style.setProperty('--toast-accent', accent);
    card.style.setProperty('--toast-accent-soft', soft);

    const withIcon = opts.withIcon !== false;
    const showClose = opts.dismissible !== false;
    const showAction = !!opts.action;

    const iconHtml = withIcon
      ? `<div class="toast-icon-shell">${opts.icon ? opts.icon : SVG_ICONS[type] || SVG_ICONS.custom}</div>`
      : '';

    const actionsHtml = [];
    if (showAction) {
      actionsHtml.push(
        `<button type="button" class="toast-action" data-action="1">${escapeHtml(opts.action.label)}</button>`
      );
    }
    if (showClose) {
      actionsHtml.push(
        `<button type="button" class="toast-close" data-close="1" aria-label="Close">${SVG_ICONS.close}</button>`
      );
    }

    const progressHtml = opts.withProgressLine
      ? `<div class="toast-progress-track"><div class="toast-progress-bar" data-progress></div></div>`
      : '';

    card.innerHTML =
      `<div class="toast-glow"></div>` +
      `<div class="toast-main">` +
        iconHtml +
        `<div class="toast-copy"><p class="toast-message">${escapeHtml(message)}</p></div>` +
        `<div class="toast-side-actions">${actionsHtml.join('')}</div>` +
      `</div>` +
      progressHtml;

    return card;
  }

  function stackScale(region, indexFromTop, totalCount) {
    const maxStack = Math.min(totalCount, 4);
    const offset = Math.min(indexFromTop, maxStack - 1);
    const scale = 1 - offset * 0.05;
    const translateY = offset * 8;
    return { scale, translateY };
  }

  function updateStacking(position) {
    const region = regions[position];
    if (!region) return;
    const items = Array.from(region.querySelectorAll('.toast-card'));
    const total = items.length;
    const isBottom = position.startsWith('bottom');
    const ordered = isBottom ? [...items].reverse() : items;
    ordered.forEach((el, i) => {
      const { scale, translateY } = stackScale(region, i, total);
      const y = isBottom ? -translateY : translateY;
      el.style.setProperty('--stack-scale', scale);
      if (!el.dataset.dragging) {
        const transformMatch = el.style.transform.match(/translate3d\(([^,]+),/);
        const dragX = transformMatch ? transformMatch[1] : 'calc(var(--drag-x) + var(--swipe-exit-x))';
        el.style.transform = `translate3d(${dragX}, ${y}px, 0) scale(var(--stack-scale))`;
      }
    });
  }

  function destroyToast(id) {
    const entry = toasts.get(id);
    if (!entry) return;
    toasts.delete(id);
    if (entry._progressTimer) clearInterval(entry._progressTimer);
    if (entry._timer) clearTimeout(entry._timer);
    const { card, opts } = entry;
    card.dataset.phase = 'exiting';
    updateStacking(opts.position);
    setTimeout(() => {
      if (card.parentNode) card.parentNode.removeChild(card);
      const pos = opts.position;
      const reg = regions[pos];
      if (reg && reg.children.length === 0) {
        if (reg.parentNode) reg.parentNode.removeChild(reg);
        delete regions[pos];
      }
    }, 300);
  }

  function startProgress(entry, duration) {
    if (!entry.opts.withProgressLine) return;
    const bar = entry.card.querySelector('[data-progress]');
    if (!bar) return;
    if (entry.opts.type === 'loading' || duration === 0) {
      bar.classList.add('is-indeterminate');
      return;
    }
    bar.classList.remove('is-indeterminate');
    const start = Date.now();
    entry._progressTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 1 - elapsed / duration);
      bar.style.transform = `scaleX(${pct})`;
      if (pct <= 0) clearInterval(entry._progressTimer);
    }, 30);
  }

  function scheduleDismiss(entry) {
    const opts = entry.opts;
    if (opts.type === 'loading') return;
    const duration = typeof opts.duration === 'number' ? opts.duration : 5000;
    if (duration === 0) return;
    startProgress(entry, duration);
    entry._timer = setTimeout(() => {
      destroyToast(entry.id);
    }, duration);
  }

  function pauseToast(entry) {
    if (entry._timer) {
      clearTimeout(entry._timer);
      entry._timer = null;
      entry._remaining = Math.max(0, (entry._remaining ?? (typeof entry.opts.duration === 'number' ? entry.opts.duration : 5000))
        - (Date.now() - (entry._startedAt || entry._createdAt)));
    }
    if (entry._progressTimer) {
      clearInterval(entry._progressTimer);
      entry._progressTimer = null;
    }
  }

  function resumeToast(entry) {
    if (entry.opts.type === 'loading') return;
    const remaining = typeof entry._remaining === 'number' ? entry._remaining
      : (typeof entry.opts.duration === 'number' ? entry.opts.duration : 5000);
    if (remaining <= 0) { destroyToast(entry.id); return; }
    entry._startedAt = Date.now();
    startProgress(entry, remaining);
    entry._timer = setTimeout(() => destroyToast(entry.id), remaining);
  }

  function addSwipe(card, entry) {
    let startX = null;
    let currentX = 0;
    const DRAG_THRESHOLD = 120;

    const onStart = (e) => {
      pauseToast(entry);
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      currentX = 0;
      card.dataset.dragging = '1';
      card.style.transition = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };
    const onMove = (e) => {
      if (startX == null) return;
      const pt = e.touches ? e.touches[0] : e;
      currentX = pt.clientX - startX;
      card.style.setProperty('--drag-x', currentX + 'px');
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      delete card.dataset.dragging;
      card.style.transition = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (Math.abs(currentX) > DRAG_THRESHOLD) {
        card.style.setProperty('--swipe-exit-x', (currentX > 0 ? 320 : -320) + 'px');
        destroyToast(entry.id);
      } else {
        card.style.setProperty('--drag-x', '0px');
        resumeToast(entry);
      }
      startX = null;
      currentX = 0;
    };

    card.addEventListener('mousedown', onStart);
    card.addEventListener('touchstart', onStart, { passive: true });

    card.addEventListener('mouseenter', () => pauseToast(entry));
    card.addEventListener('mouseleave', () => resumeToast(entry));
  }

  function showMessage(message, userOpts) {
    if (typeof document === 'undefined' || !document.body) {
      console.warn('[toast] document.body not available:', message);
      return null;
    }
    const opts = Object.assign({
      type: 'custom',
      position: 'top-right',
      duration: 5000,
      gradient: true,
      dismissible: true,
      withIcon: true,
      withProgressLine: true
    }, userOpts || {});

    if (!POSITIONS.includes(opts.position)) {
      opts.position = 'top-right';
    }

    const id = opts.id || ('toast_' + (++toastCounter) + '_' + Date.now());

    if (toasts.has(id) && opts.id) {
      updateToast(id, Object.assign({}, userOpts, { message }));
      return id;
    }

    const region = ensureRegion(opts.position);
    const card = createToastEl(id, message, opts);
    const entry = { id, card, opts, _createdAt: Date.now(), _startedAt: Date.now() };
    toasts.set(id, entry);

    const isBottom = opts.position.startsWith('bottom');
    if (isBottom) region.insertBefore(card, region.firstChild);
    else region.appendChild(card);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.dataset.phase = 'visible';
      });
    });

    const closeBtn = card.querySelector('[data-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => destroyToast(id));
    }
    const actionBtn = card.querySelector('[data-action]');
    if (actionBtn && opts.action && typeof opts.action.onClick === 'function') {
      actionBtn.addEventListener('click', (e) => {
        try { opts.action.onClick(e); } catch (_) {}
        if (opts.dismissible !== false) destroyToast(id);
      });
    }

    addSwipe(card, entry);
    updateStacking(opts.position);
    scheduleDismiss(entry);
    return id;
  }

  function updateToast(id, updates) {
    const entry = toasts.get(id);
    if (!entry) return;
    const opts = Object.assign({}, entry.opts, updates || {});
    entry.opts = opts;

    if (updates.message != null) {
      const msg = entry.card.querySelector('.toast-message');
      if (msg) msg.textContent = String(updates.message);
    }

    if (updates.type) {
      const accents = TYPE_ACCENTS[updates.type] || TYPE_ACCENTS.custom;
      const accent = opts.accentColor || accents.accent;
      entry.card.style.setProperty('--toast-accent', accent);
      entry.card.style.setProperty('--toast-accent-soft', opts.backgroundColor
        ? 'rgba(255,255,255,0.18)' : accents.soft);
      const iconEl = entry.card.querySelector('.toast-icon-shell');
      if (iconEl && !opts.icon) {
        iconEl.innerHTML = SVG_ICONS[updates.type] || SVG_ICONS.custom;
      }
    }

    if (opts.icon) {
      const iconEl = entry.card.querySelector('.toast-icon-shell');
      if (iconEl) iconEl.innerHTML = opts.icon;
    }

    if (entry._timer) { clearTimeout(entry._timer); entry._timer = null; }
    if (entry._progressTimer) { clearInterval(entry._progressTimer); entry._progressTimer = null; }
    entry._remaining = null;
    entry._startedAt = Date.now();
    scheduleDismiss(entry);
  }

  function dismissToast(id) {
    if (!id) {
      const all = Array.from(toasts.keys());
      all.forEach(k => destroyToast(k));
      return;
    }
    destroyToast(id);
  }

  function pauseToastById(id) {
    const e = toasts.get(id);
    if (e) pauseToast(e);
  }
  function resumeToastById(id) {
    const e = toasts.get(id);
    if (e) resumeToast(e);
  }

  function toastPromise(promise, msgs, userOpts) {
    const opts = Object.assign({ position: 'top-right' }, userOpts || {});
    const id = showMessage(msgs.loading || 'Loading...', Object.assign({}, opts, {
      type: 'loading',
      duration: 0,
      withProgressLine: true
    }));
    return Promise.resolve(promise).then(
      (result) => {
        const msg = typeof msgs.success === 'function' ? msgs.success(result) : msgs.success;
        updateToast(id, { type: 'success', message: msg || 'Success', duration: opts.duration || 5000 });
        return result;
      },
      (err) => {
        const msg = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error;
        updateToast(id, {
          type: 'error',
          message: msg || (err && err.message ? err.message : String(err || 'Error')),
          duration: opts.duration || 6000
        });
        throw err;
      }
    );
  }

  const toast = function (message, opts) {
    return showMessage(message, opts);
  };

  toast.success = (m, o) => showMessage(m, Object.assign({ type: 'success', duration: 5000 }, o || {}));
  toast.error = (m, o) => showMessage(m, Object.assign({ type: 'error', duration: 7000 }, o || {}));
  toast.info = (m, o) => showMessage(m, Object.assign({ type: 'info', duration: 5500 }, o || {}));
  toast.warning = (m, o) => showMessage(m, Object.assign({ type: 'warning', duration: 6000 }, o || {}));
  toast.loading = (m, o) => showMessage(m, Object.assign({ type: 'loading', duration: 0 }, o || {}));
  toast.custom = (m, o) => showMessage(m, Object.assign({ type: 'custom' }, o || {}));
  toast.update = updateToast;
  toast.dismiss = dismissToast;
  toast.pause = pauseToastById;
  toast.resume = resumeToastById;
  toast.promise = toastPromise;

  // ── In-app confirm / prompt modal (replaces native confirm()/prompt(),
  // which Chrome renders inconsistently from extension pages and are flagged
  // in CWS reviews). Resolves a boolean (confirm) or string|null (prompt).
  let glassModalCssInjected = false;
  function injectGlassModalCss() {
    if (glassModalCssInjected) return;
    glassModalCssInjected = true;
    const css = [
      '.sfarc-glass-modal-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:sfarcModalFade .18s ease both;padding:16px}',
      '.sfarc-glass-modal-card{width:min(400px,100%);background:rgba(255,255,255,.96);border:1px solid rgba(15,23,42,.12);border-radius:14px;box-shadow:0 24px 64px rgba(15,23,42,.28);padding:18px 18px 14px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;animation:sfarcModalPop .2s cubic-bezier(.16,1,.3,1) both}',
      'body.sfarc-dark-theme .sfarc-glass-modal-card,body.dark-theme .sfarc-glass-modal-card{background:rgba(24,27,34,.97);border-color:rgba(255,255,255,.12)}',
      '.sfarc-glass-modal-title{font-size:14px;font-weight: 500;color:#0f172a;margin:0 0 8px;display:flex;align-items:center;gap:8px}',
      'body.sfarc-dark-theme .sfarc-glass-modal-title,body.dark-theme .sfarc-glass-modal-title{color:#f1f5f9}',
      '.sfarc-glass-modal-title svg{flex-shrink:0}',
      '.sfarc-glass-modal-msg{font-size:12.5px;line-height:1.5;color:#475569;margin:0 0 14px}',
      'body.sfarc-dark-theme .sfarc-glass-modal-msg,body.dark-theme .sfarc-glass-modal-msg{color:#cbd5e1}',
      '.sfarc-glass-modal-input{width:100%;box-sizing:border-box;padding:8px 10px;font-size:12.5px;color:#0f172a;background:#f8fafc;border:1px solid #d6dde6;border-radius:8px;outline:none;margin-bottom:14px}',
      '.sfarc-glass-modal-input:focus{border-color:var(--sfarc-accent, #2196f3);box-shadow:0 0 0 3px rgba(var(--sfarc-accent-rgb, 33, 150, 243), .14)}',
      'body.sfarc-dark-theme .sfarc-glass-modal-input,body.dark-theme .sfarc-glass-modal-input{background:#0e0f12;color:#e6e9ef;border-color:#30323a}',
      '.sfarc-glass-modal-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.sfarc-glass-modal-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 14px;font-size:12px;font-weight:500;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:all .15s ease}',
      '.sfarc-glass-modal-cancel{background:transparent;color:#64748b;border-color:#d0d7e0}',
      'body.sfarc-dark-theme .sfarc-glass-modal-cancel,body.dark-theme .sfarc-glass-modal-cancel{color:#cbd5e1;border-color:#3a3d44}',
      '.sfarc-glass-modal-cancel:hover{background:rgba(15,23,42,.06)}',
      '.sfarc-glass-modal-ok{background:var(--sfarc-accent, #2196f3);color:#fff}',
      '.sfarc-glass-modal-ok:hover{background:var(--sfarc-accent-dark, #1976d2)}',
      '.sfarc-glass-modal-danger{background:#dc2626;color:#fff}',
      '.sfarc-glass-modal-danger:hover{background:#b91c1c}',
      '@keyframes sfarcModalFade{from{opacity:0}to{opacity:1}}',
      '@keyframes sfarcModalPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}'
    ].join('');
    const style = document.createElement('style');
    style.id = 'sfarc-glass-modal-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showGlassModal(opts) {
    return new Promise((resolve) => {
      const isDark = document.body && (document.body.classList.contains('sfarc-dark-theme') || document.body.classList.contains('dark-theme'));
      injectGlassModalCss();
      const overlay = document.createElement('div');
      overlay.className = 'sfarc-glass-modal-overlay';
      const icon = opts.danger
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sfarc-accent, #2196f3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      overlay.innerHTML =
        '<div class="sfarc-glass-modal-card" role="dialog" aria-modal="true">' +
        '<h3 class="sfarc-glass-modal-title">' + icon + '<span></span></h3>' +
        '<p class="sfarc-glass-modal-msg"></p>' +
        (opts.input ? '<input class="sfarc-glass-modal-input" type="text" autocomplete="off">' : '') +
        '<div class="sfarc-glass-modal-actions">' +
        '<button type="button" class="sfarc-glass-modal-btn sfarc-glass-modal-cancel"></button>' +
        '<button type="button" class="sfarc-glass-modal-btn ' + (opts.danger ? 'sfarc-glass-modal-danger' : 'sfarc-glass-modal-ok') + '"></button>' +
        '</div></div>';
      document.body.appendChild(overlay);
      const titleEl = overlay.querySelector('.sfarc-glass-modal-title span');
      const msgEl = overlay.querySelector('.sfarc-glass-modal-msg');
      const inputEl = overlay.querySelector('.sfarc-glass-modal-input');
      const cancelBtn = overlay.querySelector('.sfarc-glass-modal-cancel');
      const okBtn = overlay.querySelector('.sfarc-glass-modal-actions .sfarc-glass-modal-btn:last-child');
      titleEl.textContent = opts.title || (opts.input ? 'Input required' : 'Confirm');
      msgEl.textContent = opts.message || '';
      cancelBtn.textContent = opts.cancelText || 'Cancel';
      okBtn.textContent = opts.confirmText || (opts.input ? 'OK' : 'Confirm');
      const done = (result) => {
        if (!overlay.parentNode) return;
        overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey, true);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && document.activeElement !== cancelBtn) { e.stopPropagation(); done(opts.input ? (inputEl.value || '') : true); }
      };
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) done(null); });
      cancelBtn.addEventListener('click', () => done(null));
      okBtn.addEventListener('click', () => done(opts.input ? (inputEl.value || '') : true));
      document.addEventListener('keydown', onKey, true);
      (opts.input ? inputEl : okBtn).focus();
    });
  }

  toast.confirm = (message, opts) => showGlassModal(Object.assign({ message }, opts || {}));
  toast.prompt = (message, opts) => showGlassModal(Object.assign({ message, input: true }, opts || {}));

  global.toast = toast;
  global.SFArcToast = toast;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = toast;
    module.exports.toast = toast;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
