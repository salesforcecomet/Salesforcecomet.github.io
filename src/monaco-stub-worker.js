// Minimal stub worker for Monaco Editor inside a Chrome extension.
//
// MV3 extension pages cannot spawn blob: workers (blob: is not a valid
// script-src value), and chrome-extension:// origins cannot spawn workers
// that reference chrome-extension:// URLs from within a blob. Monaco only
// needs this worker for language services, which we don't use — all
// Apex/JS/HTML highlighting is client-side. This file is bundled with the
// extension and loaded via chrome.runtime.getURL(), so its origin is 'self'
// and the extension CSP allows it.
'use strict';

self.onmessage = function () {
    self.postMessage({});
};
