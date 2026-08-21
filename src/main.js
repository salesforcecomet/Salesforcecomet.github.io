
// Extension context health check. Use `var` for these script-level health
// values so an older/open tab that receives the bootstrap twice cannot fail
// during parsing with a lexical redeclaration error. The background loader is
// also atomic, but this remains a final defensive layer for upgraded tabs.
var sfarcLastContextCheck = Date.now();
var sfarcContextHealthy = true;
var sfarcContextWarningShown = false;

function sfarcCheckContext() {
    try {
        if (chrome.runtime && chrome.runtime.id) {
            sfarcContextHealthy = true;
            sfarcLastContextCheck = Date.now();
            sfarcContextWarningShown = false;
            return true;
        }
    } catch (e) {
        sfarcContextHealthy = false;
        return false;
    }
    return false;
}

// Periodically check if extension context is still valid (every 5 minutes)
setInterval(() => {
    if (!sfarcCheckContext() && !sfarcContextWarningShown) {
        sfarcContextWarningShown = true;
        // Only show warning once, not repeatedly
        console.log('Salesforce Comet: Extension context may be stale. Try clicking the extension icon to refresh.');
    }
}, 300000); // Check every 5 minutes

// Initial check on load
sfarcCheckContext();

// Check for Salesforce login page
function isLoginPage() {
    var host = window.location.hostname.toLowerCase();
    var path = window.location.pathname.toLowerCase();
    var href = window.location.href.toLowerCase();
    if (host === 'login.salesforce.com' || host === 'test.salesforce.com') return true;
    if (path.includes('/login.jsp') || path.endsWith('/login') || href.includes('unauthenticated')) return true;
    if (document.querySelector('#login_form, #Login, form[name="login"], input[name="username"][name="pw"]')) return true;
    return false;
}

window.sfarcLogs = window.sfarcLogs || [];
function logToParent(type, ...args) {
    window.sfarcLogs.push({ type, args, time: new Date().toLocaleTimeString() });
}


// Helper to get Material Icons (Filled) SVG icons instead of solid FontAwesome
var SFARC_ICON_TABLE = [
    ["fa-user", ["gear","shield","lock","astronaut"], ["M12 12c2.67 0 8-1.34 8-4s-5.33-4-8-4-8 1.34-8 4 5.33 4 8 4zm0 2c-2.33 0-8-1.17-8-4V5c0-.28.22-.5.5-.5.1 0 .2.03.3.08 2.63 1.13 5.3.66 7.85-.85.28-.15.5-.41.5-.71 0-.28-.22-.5-.5-.5C7.03 4.03 3.5 5.35 3.5 7.5v2c0 2.33 5.67 4 8.5 4s5.5-1.67 8.5-4v-2c0-2.15-3.53-3.47-6.5-3.47-1.08 0-2.15.2-3.19.57-.1.04-.16.1-.17.2-.01.11-.03.21-.03.32 0 2.63 2.37 4.74 5.37 4.74 1 .0 1.96-.04 2.91-.16.26-.03.48-.27.48-.54 0-.28-.23-.5-.5-.5-.26.01-.5.05-.7.28-2.63 1.13-5.3.66-7.85-.85-.28-.15-.5-.41-.5-.71 0-.28-.22-.5-.5-.5C7.03 4.03 3.5 5.35 3.5 7.5v2c0 2.33 5.67 4 8.5 4s5.5-1.67 8.5-4v-2c0-2.15-3.53-3.47-6.5-3.47z"], []],
    ["fa-users", [], ["M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"], []],
    ["fa-database", [], ["M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zM6 17v-1.29c1.34.92 3.48 1.56 6 1.56s4.66-.64 6-1.56V17c0 .5-2.13 2-6 2s-6-1.5-6-2zm0-4v-1.29c1.34.92 3.48 1.56 6 1.56s4.66-.64 6-1.56V13c0 .5-2.13 2-6 2s-6-1.5-6-2z"], []],
    ["fa-cubes", [], ["M11.49 4.49L5.5 8.27v7.46l5.49 3.78 6.02-4.05V7.31L11.49 4.49zM18 8.27l-6 4.05v7.46l6-4.05V8.27zM12 2L2 8.5v7L12 21l10-5.5V8.5L12 2z"], [[12,12,10]]],
    ["fa-cube", [], ["M11.49 4.49L5.5 8.27v7.46l5.49 3.78 6.02-4.05V7.31L11.49 4.49zM18 8.27l-6 4.05v7.46l6-4.05V8.27zM12 2L2 8.5v7L12 21l10-5.5V8.5L12 2z"], [[12,12,10]]],
    ["fa-code", ["branch"], ["M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"], []],
    ["fa-building", ["user"], ["M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"], []],
    ["fa-server", [], ["M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"], []],
    ["fa-search", [], ["M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"], []],
    ["fa-magnifying-glass", [], ["M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"], []],
    ["fa-bug", [], ["M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M6 13c0 1.66 1.34 3 3 3M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17 13c1.66 0 3-1.34 3-3"], []],
    ["fa-eye", [], ["M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"], [[12,12,10]]],
    ["fa-eye-slash", [], ["M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"], []],
    ["fa-lightbulb", [], ["M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.2 4.5 3 5.71V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.29C17.8 13.5 19 11.38 19 9 19 5.14 15.86 2 12 2z"], []],
    ["fa-bolt", ["lightning"], ["M7 2v11h3v9l7-12h-4l4-8z"], []],
    ["fa-shield", [], ["M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"], []],
    ["fa-rotate-left", [], ["M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"], []],
    ["fa-rotate-right", [], ["M15.55 5.55 11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11a7.906 7.906 0 0 0-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42 1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"], []],
    ["fa-arrows-rotate", [], ["M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"], []],
    ["fa-sync", [], ["M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"], []],
    ["fa-rotate", [], ["M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"], []],
    ["fa-layer-group", [], ["M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"], []],
    ["fa-table-columns", [], ["M12 13.5l8-4.5v-2.15l-8 4.5-8-4.5V9l8 4.5z"], []],
    ["fa-columns", [], ["M12 13.5l8-4.5v-2.15l-8 4.5-8-4.5V9l8 4.5z"], []],
    ["fa-table-list", [], ["M12 13.5l8-4.5v-2.15l-8 4.5-8-4.5V9l8 4.5z"], []],
    ["fa-key", [], ["M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"], []],
    ["fa-list-check", [], ["M21 6v2H7V6h14zm0 5v2H7v-2h14zm0 5v2H7v-2h14zM4 6h2v12H4V6z"], []],
    ["fa-list", [], ["M21 6v2H7V6h14zm0 5v2H7v-2h14zm0 5v2H7v-2h14zM4 6h2v12H4V6z"], []],
    ["fa-sitemap", [], ["M11 7.05V4a2 2 0 10-4 0v3.05C4.74 8.11 3 10.31 3 13c0 2.21 1.79 4 4 4h2c2.21 0 4-1.79 4-4 0-2.69-1.74-4.89-4-5.95zm-2 11H5c-1.1 0-2-.9-2-2 0-1.55 1.29-3.15 3-3.54V14c0 1.1.9 2 2 2v2.05zm6-6.05V4a2 2 0 114 0v3.05c2.26 1.06 4 3.26 4 5.95 0 2.21-1.79 4-4 4h-2c-2.21 0-4-1.79-4-4 0-2.69 1.74-4.89 4-5.95zm2 4.95h2c1.1 0 2-.9 2-2 0-1.55-1.29-3.15-3-3.54V10c-1.1 0-2 .9-2 2v1.9z"], []],
    ["fa-envelope", ["open"], ["M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"], []],
    ["fa-envelope-open", [], ["M18.5 6l-6.5 5-6.5-5H2v12h3.5V11l6.5 5 6.5-5v7H22V6h-3.5z"], []],
    ["fa-at", [], ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"], []],
    ["fa-diagram-project", [], ["M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"], []],
    ["fa-diagram-successor", [], ["M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"], []],
    ["fa-clock", ["rotate"], ["M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z", "M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"], []],
    ["fa-gears", [], ["M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.61 3.61 0 0 1 12 15.6z"], []],
    ["fa-gear", [], ["M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.61 3.61 0 0 1 12 15.6z"], []],
    ["fa-flask", ["vial"], ["M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"], []],
    ["fa-lock", ["user"], ["M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"], []],
    ["fa-user-shield", [], ["M17 11c.34 0 .67.04 1 .09V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55-.69-.98-1.1-2.17-1.1-3.45 0-3.31 2.69-6 6-6z", "M17 13c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 1.38c.62 0 1.12.51 1.12 1.12s-.51 1.12-1.12 1.12-1.12-.51-1.12-1.12.5-1.12 1.12-1.12zm0 5.37c-.93 0-1.74-.46-2.24-1.17.05-.72 1.51-1.08 2.24-1.08s2.19.36 2.24 1.08c-.5.71-1.31 1.17-2.24 1.17z"], []],
    ["fa-user-gear", [], ["M17 11c.34 0 .67.04 1 .09V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55-.69-.98-1.1-2.17-1.1-3.45 0-3.31 2.69-6 6-6z", "M17 13c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 1.38c.62 0 1.12.51 1.12 1.12s-.51 1.12-1.12 1.12-1.12-.51-1.12-1.12.5-1.12 1.12-1.12zm0 5.37c-.93 0-1.74-.46-2.24-1.17.05-.72 1.51-1.08 2.24-1.08s2.19.36 2.24 1.08c-.5.71-1.31 1.17-2.24 1.17z"], []],
    ["fa-wrench", [], ["M10.67 13.02c-.22-.01-.44-.02-.67-.02-2.42 0-4.68.67-6.61 1.82-.88.52-1.39 1.5-1.39 2.53V20h9.26a6.963 6.963 0 0 1-.59-6.98zM20.75 16c0-.22-.03-.42-.06-.63l1.14-1.01-1-1.73-1.45.49c-.32-.27-.68-.48-1.08-.63L18 11h-2l-.3 1.49c-.4.15-.76.36-1.08.63l-1.45-.49-1 1.73 1.14 1.01c-.03.21-.06.41-.06.63s.03.42.06.63l-1.14 1.01 1 1.73 1.45-.49c.32.27.68.48 1.08.63L16 21h2l.3-1.49c.4-.15.76-.36 1.08-.63l1.45.49 1-1.73-1.14-1.01c.03-.21.06-.41.06-.63zM17 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"], [[10,8,4]]],
    ["fa-hammer", [], ["m13.783 15.172 2.121-2.121 5.996 5.996-2.121 2.121zM17.5 10c1.93 0 3.5-1.57 3.5-3.5 0-.58-.16-1.12-.41-1.6l-2.7 2.7-1.49-1.49 2.7-2.7c-.48-.25-1.02-.41-1.6-.41C15.57 3 14 4.57 14 6.5c0 .41.08.8.21 1.16l-1.85 1.85-1.78-1.78.71-.71-1.41-1.41L12 3.49a3 3 0 0 0-4.24 0L4.22 7.03l1.41 1.41H2.81l-.71.71 3.54 3.54.71-.71V9.15l1.41 1.41.71-.71 1.78 1.78-7.41 7.41 2.12 2.12L16.34 9.79c.36.13.75.21 1.16.21z"], []],
    ["fa-plug", [], ["M16.01 7L16 3h-2v4h-4V3H8v4h-.01C7 6.99 6 7.99 6 8.99v5.49L9.5 18v3h5v-3l3.5-3.51v-5.5c0-1-1-2-1.99-1.99z"], []],
    ["fa-paper-plane", [], ["M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"], []],
    ["fa-file-code", [], ["M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"], []],
    ["fa-file-lines", [], ["M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"], []],
    ["fa-puzzle-piece", [], ["M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"], []],
    ["fa-box", ["archive"], ["M11.49 4.49L5.5 8.27v7.46l5.49 3.78 6.02-4.05V7.31L11.49 4.49zM18 8.27l-6 4.05v7.46l6-4.05V8.27zM12 2L2 8.5v7L12 21l10-5.5V8.5L12 2z"], [[12,12,10]]],
    ["fa-tag", [], ["M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"], []],
    ["fa-route", [], ["M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"], []],
    ["fa-palette", [], ["M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"], []],
    ["fa-desktop", [], ["M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"], []],
    ["fa-globe", [], ["M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"], []],
    ["fa-hammer", [], ["m13.783 15.172 2.121-2.121 5.996 5.996-2.121 2.121zM17.5 10c1.93 0 3.5-1.57 3.5-3.5 0-.58-.16-1.12-.41-1.6l-2.7 2.7-1.49-1.49 2.7-2.7c-.48-.25-1.02-.41-1.6-.41C15.57 3 14 4.57 14 6.5c0 .41.08.8.21 1.16l-1.85 1.85-1.78-1.78.71-.71-1.41-1.41L12 3.49a3 3 0 0 0-4.24 0L4.22 7.03l1.41 1.41H2.81l-.71.71 3.54 3.54.71-.71V9.15l1.41 1.41.71-.71 1.78 1.78-7.41 7.41 2.12 2.12L16.34 9.79c.36.13.75.21 1.16.21z"], []],
    ["fa-book", [], ["M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"], []],
    ["fa-memory", [], ["M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"], []],
    ["fa-tower-broadcast", [], ["m20.2 5.9.8-.8C19.6 3.7 17.8 3 16 3s-3.6.7-5 2.1l.8.8C13 4.8 14.5 4.2 16 4.2s3 .6 4.2 1.7zm-.9.8c-.9-.9-2.1-1.4-3.3-1.4s-2.4.5-3.3 1.4l.8.8c.7-.7 1.6-1 2.5-1 .9 0 1.8.3 2.5 1l.8-.8zM19 13h-2V9h-2v4H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM8 18H6v-2h2v2zm3.5 0h-2v-2h2v2zm3.5 0h-2v-2h2v2z"], []],
    ["fa-table-cells", [], ["M3 3h8v8H3V3zm0 10h8v8H3v-8zM13 3h8v8h-8V3zm0 10h8v8h-8v-8z"], []],
    ["fa-sliders", [], ["M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"], []],
    ["fa-hourglass", [], ["m18 22-.01-6L14 12l3.99-4.01L18 2H6v6l4 4-4 3.99V22h12zM8 7.5V4h8v3.5l-4 4-4-4z"], []],
    ["fa-scroll", [], ["M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"], []],
    ["fa-language", [], ["m12.87 15.07-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z"], []],
    ["fa-cloud-arrow-up", [], ["M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"], []],
    ["fa-cloud-upload", [], ["M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"], []],
    ["fa-arrow-right-arrow-left", [], ["M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"], []],
    ["fa-right-left", [], ["M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"], []],
    ["fa-clone", [], ["M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"], []],
    ["fa-trash", [], ["M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"], []],
    ["fa-trash-can", [], ["M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"], []],
    ["fa-table", [], ["M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"], []],
    ["fa-paint-roller", [], ["M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z"], []],
    ["fa-satellite-dish", [], ["M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 4.99h3C8 6.65 6.66 8 5 8V4.99zM5 12v-2c2.76 0 5-2.25 5-5.01h2C12 8.86 8.87 12 5 12zm0 6 3.5-4.5 2.5 3.01L14.5 12l4.5 6H5z"], []],
    ["fa-envelope-open", [], ["M18.5 6l-6.5 5-6.5-5H2v12h3.5V11l6.5 5 6.5-5v7H22V6h-3.5z"], []],
    ["fa-bell", [], ["M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"], []],
    ["fa-comment", [], ["M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"], []],
    ["fa-id-badge", [], ["M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"], []],
    ["fa-right-to-bracket", [], ["M11 7L9.59 8.41 12.17 11H2v2h10.17l-2.58 2.59L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"], []],
    ["fa-heart-pulse", [], ["M15.11 12.45 14 10.24l-3.11 6.21c-.16.34-.51.55-.89.55s-.73-.21-.89-.55L7.38 13H2v5c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-5h-6c-.38 0-.73-.21-.89-.55z", "M20 4H4c-1.1 0-2 .9-2 2v5h6c.38 0 .73.21.89.55L10 13.76l3.11-6.21c.34-.68 1.45-.68 1.79 0L16.62 11H22V6c0-1.1-.9-2-2-2z"], []],
    ["fa-fingerprint", [], ["M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67a.49.49 0 0 1-.44.28zM3.5 9.72a.499.499 0 0 1-.41-.79c.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25a.5.5 0 0 1-.12.7c-.23.16-.54.11-.7-.12a9.388 9.388 0 0 0-3.39-2.94c-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07a.47.47 0 0 1-.35-.15c-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-4.91-1.31-7.78-6.47-6.48-11.37.02-.07.06-.13.11-.17.05-.04.12-.06.18-.04.07.02.12.08.14.15.01.03.01.06.01.09 0 .03-.02.06-.03.09-1.2 4.54 1.51 9.24 6.02 10.57.25.07.33.35.26.61-.05.23-.27.38-.49.38z"], []],
    ["fa-chart-pie", [], ["M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z"], []],
    ["fa-chart-line", [], ["m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"], []],
    ["fa-code-branch", [], ["M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7z"], []],
    ["fa-truck-fast", [], ["M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"], []],
    ["fa-circle-plus", [], ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"], []],
    ["fa-pen", ["edit"], ["M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"], []],
    ["fa-pause", [], ["M6 19h4V5H6v14zm8-14v14h4V5h-4z"], []],
    ["fa-stamp", [], ["M12 22a9 9 0 0 0 9-9 9 9 0 0 0-9 9zM5.6 10.25a2.5 2.5 0 0 0 3.92 2.06l-.02.19a2.5 2.5 0 0 0 5 0l-.02-.19c.4.28.89.44 1.42.44a2.5 2.5 0 0 0 2.5-2.5c0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25a2.5 2.5 0 0 0-3.92-2.06l.02-.19a2.5 2.5 0 0 0-5 0l.02.19c-.4-.28-.89-.44-1.42-.44a2.5 2.5 0 0 0-2.5 2.5c0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25zM12 5.5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM3 13a9 9 0 0 0 9 9 9 9 0 0 0-9-9z"], []],
    ["fa-wand-magic-sparkles", [], ["m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"], []],
    ["fa-cubes-stacked", [], ["M21 16.5V7.5L12 3 3 7.5v9l9 4.5 9-4.5zM12 5.2L19 8.7v6.6l-7 3.5-7-3.5V8.7l7-3.5z"], []],
    ["fa-grid-2", [], ["M21 16.5V7.5L12 3 3 7.5v9l9 4.5 9-4.5zM12 5.2L19 8.7v6.6l-7 3.5-7-3.5V8.7l7-3.5z"], []],
    ["fa-hard-drive", [], ["M20 16h2v-2h-2v2zm0-9v5h2V7h-2zM10 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"], []],
    ["fa-file-export", [], ["M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5 11 17.5l-6-6 1.41-1.41L11 12.67V3h2v9.67z"], []],
    ["fa-file-import", [], ["M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"], []],
    ["fa-file-download", [], ["M5 20h14v-2H5v2zm8-5l-5-5h2.55c0-1.24.9-2.29 2.15-2.92L12 4l4.3 3.08c1.25.63 2.15 1.68 2.15 2.92H13l5 5h-3l-2 2-2-2z"], []],
    ["fa-file-upload", [], ["M5 20h14v-2H5v2zm8-10l5 5h-3v6h-4v-6H7l5-5zm0-4h2v6h-2V6zm-2 6h2v6h-2V6h2z"], []],
    ["fa-user-check", [], ["M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"], []],
    ["fa-user-secret", [], ["M13 8.57a1.43 1.43 0 1 0 0 2.86 1.43 1.43 0 0 0 0-2.86z", "M13 3C9.25 3 6.2 5.94 6.02 9.64L4.1 12.2a.5.5 0 0 0 .4.8H6v3c0 1.1.9 2 2 2h1v3h7v-4.68A6.999 6.999 0 0 0 13 3zm3 7c0 .13-.01.26-.02.39l.83.66c.08.06.1.16.05.25l-.8 1.39c-.05.09-.16.12-.24.09l-.99-.4c-.21.16-.43.29-.67.39L14 13.83c-.01.1-.1.17-.2.17h-1.6c-.1 0-.18-.07-.2-.17l-.15-1.06c-.25-.1-.47-.23-.68-.39l-.99.4c-.09.03-.2 0-.25-.09l-.8-1.39a.19.19 0 0 1 .05-.25l.84-.66c-.01-.13-.02-.26-.02-.39s.02-.27.04-.39l-.85-.66c-.08-.06-.1-.16-.05-.26l.8-1.38c.05-.09.15-.12.24-.09l1 .4c.2-.15.43-.29.67-.39L12 6.17c.02-.1.1-.17.2-.17h1.6c.1 0 .18.07.2.17l.15 1.06c.24.1.46.23.67.39l1-.4c.09-.03.2 0 .24.09l.8 1.38a.2.2 0 0 1-.05.26l-.85.66c.03.12.04.25.04.39z"], []],
    ["fa-network-wired", [], ["M19 3H5c-1.1 0-2 .9-2 2v3.55c0 .28.22.5.5.5.14 0 .28-.06.37-.17l1.49-1.49c.38-.38 1-.59 1.61-.59H17c.55 0 1-.45 1-1V5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v3.55c0 .28.22.5.5.5.14 0 .28-.06.37-.17l1.49-1.49c.38-.38 1-.59 1.61-.59.6 0 1.22.21 1.61.59l1.49 1.49c.09.11.17.25.17.4v-2.41c0-1.1-.9-2-2-2zm-3.94 6.06c-.2.2-.5.2-.7.0L13 7.3V4.5h-.5C11.67 4.5 11 5.17 11 6.04V7.3L8.63 9.06c-.2.2-.5.2-.7 0L7 8.5V5.5c0-1.66 1.34-3 3-3h5c1.66 0 3 1.34 3 3v3.56zM5 10.5v5c0 .28.22.5.5.5H8v-6H5.5c-.28 0-.5.22-.5.5zm7 9v3.5c0 .28.22.5.5.5h5c1.66 0 3-1.34 3-3V15h-6v3.5c0 .39-.17.76-.44 1.03l-.6 1.6c-.05.14-.07.28-.07.42 0 .13.03.26.09.38a1.98 1.98 0 0 1-1.5.74c-.39 0-.76-.15-1.03-.42l-.6-1.6A1.99 1.99 0 0 0 13.5 15.5V12h-6v5c0 1.66 1.34 3 3 3v-2.5c0-.55-.45-1-1-1H7v-2h2v3.5c0 .28.22.5.5.5h6c.28 0 .5-.22.5-.5V12h2v3.5c0 1.66 1.34 3 3 3v-3.5h2v3.5c0 1.66-1.34 3-3 3v-2.5c0-.28-.22-.5-.5-.5h-5c-.28 0-.5.22-.5.5z"], []],
    ["fa-circle", [], [], [[12,12,10]]],
];

function getIconHtml(iconClass, styleStr = '') {
    for (var i = 0; i < SFARC_ICON_TABLE.length; i++) {
        var entry = SFARC_ICON_TABLE[i];
        if (iconClass.includes(entry[0])) {
            var excludes = entry[1];
            var excluded = false;
            for (var j = 0; j < excludes.length; j++) {
                if (iconClass.includes(excludes[j])) { excluded = true; break; }
            }
            if (!excluded) {
                var paths = entry[2];
                var circles = entry[3] || [];
                var svg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="' + styleStr + '">';
                for (var k = 0; k < paths.length; k++) {
                    svg += '<path d="' + paths[k] + '"/>';
                }
                for (var m = 0; m < circles.length; m++) {
                    svg += '<circle cx="' + circles[m][0] + '" cy="' + circles[m][1] + '" r="' + circles[m][2] + '"/>';
                }
                svg += '</svg>';
                return svg;
            }
        }
    }
    // Safe fallback: use fa-solid instead of fa-regular to prevent FontAwesome question marks on missing outline icons
    var solidIcon = iconClass;
    if (!solidIcon.includes('fa-solid') && !solidIcon.includes('fa-regular')) {
        solidIcon = 'fa-solid ' + solidIcon;
    } else {
        solidIcon = solidIcon.replace('fa-regular', 'fa-solid');
    }
    return '<i class="' + solidIcon + '" style="' + styleStr + '"></i>';
}


// Global state
var urlCheckInterval = urlCheckInterval || null;
var searchCache = typeof searchCache !== 'undefined' ? searchCache : {
    objects: null,
    shortcuts: null,
    orgData: null
};
var devToolsCache = {
    apexClasses: [],
    apexTriggers: [],
    selectedCode: null,
    lastUpdate: null
};
var settings = {
    iconVisible: false,
    iconPosition: 'right', // left, right, top, bottom
    iconOffset: 50, // percentage
    iconAutoHide: false,
    launcherMethod: 'both', // 'both' | 'sidebar' | 'shortcut'
    panelPosition: 'left', // left, right, top, bottom
    panelHeight: 80, // percentage (for top/bottom)
    panelWidth: 60, // percentage (for left/right)
    theme: 'system', // light, dark, system
    apiVersion: '60.0',
    debugType: 'USER_DEBUG',
    defaultDebugLevelId: '',
    headerIcons: {
        sessionCopy: true,
        fieldApi: true,
        lwcViewer: true,
        flowViewer: true
    }
};
var currentTab = 'objects';
var lastIndicatorLeft = 0;
var currentRecordContext = null;

var currentUserIdPromise = null;
var isFetchingTraceFlags = false;

var getInitials = (str) => {
    if (!str) return '?';
    var words = str.split(' ').filter(req => req.length > 0);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * Convert raw fetch/network errors into readable UI messages.
 * Returns an HTML string suitable for inserting into a container.
 */
function friendlyFetchError(err, retryFn) {
    var msg = err && err.message ? err.message : String(err);
    var title = 'Something went wrong';
    var detail = msg;
    var icon = 'fa-circle-exclamation';

    if (msg.includes('Extension context invalidated') || msg.includes('refresh the Salesforce page')) {
        title = 'Extension updated';
        detail = 'The extension was updated or reloaded in the background. Please refresh this page to continue using salesforce comet.';
    } else if (
        msg === 'Failed to fetch' ||
        msg.includes('ERR_NAME_NOT_RESOLVED') ||
        msg.includes('ERR_INTERNET_DISCONNECTED') ||
        msg.includes('NetworkError') ||
        msg.includes('network') ||
        msg.includes('offline')
    ) {
        title = 'Unable to connect to Salesforce';
        detail = 'Check your internet connection or VPN. The Salesforce org may be temporarily unavailable.';
        icon = 'fa-wifi';
    } else if (msg.includes('401') || msg.includes('Session expired') || msg.includes('INVALID_SESSION_ID')) {
        title = 'Session expired';
        detail = 'Your Salesforce session has expired. Please refresh this page to re-authenticate.';
        icon = 'fa-lock';
    } else if (msg.includes('403') || msg.includes('INSUFFICIENT_ACCESS')) {
        title = 'Access denied';
        detail = 'You do not have permission to access this resource in Salesforce.';
        icon = 'fa-ban';
    } else if (msg.includes('service worker') || msg.includes('background') || msg.includes('proxy')) {
        title = 'Extension service unavailable';
        detail = 'The Salesforce Comet background service is not responding. Try reloading the extension or the page.';
        icon = 'fa-plug-circle-exclamation';
    }

    var retryBtn = retryFn
        ? `<button class="sfarc-error-retry-btn" style="margin-top:10px;padding:5px 14px;font-size:12px;border-radius:6px;border:none;background:var(--primary-color,var(--sfarc-accent, var(--sfarc-accent, #2196f3)));color:var(--sfarc-accent-contrast, #fff);cursor:pointer;font-weight:500;">Retry</button>`
        : '';

    return `<div class="sfarc-error" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px 16px;text-align:center;color:var(--sfarc-text-muted,#6b7280);">
        <i class="fa-solid ${icon}" style="font-size:28px;color:var(--primary-color,var(--sfarc-accent, var(--sfarc-accent, #2196f3)));opacity:0.7;"></i>
        <div style="font-size:13px;font-weight:500;color:var(--sfarc-text,#374151);">${title}</div>
        <div style="font-size:12px;max-width:280px;line-height:1.5;">${escapeHtml(detail)}</div>
        ${retryBtn}
    </div>`;
}




// User Recents State
var userRecents = [];
var objectRecents = [];

function loadUserRecents() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfiUserRecents', 'sfiObjectRecents'], (result) => {
            if (result.sfiUserRecents) userRecents = result.sfiUserRecents;
            if (result.sfiObjectRecents) objectRecents = result.sfiObjectRecents;
        });
    }
}
// Call on init (safe to call early)
try { loadUserRecents(); } catch (e) { }

function addToUserRecents(user) {
    // Remove if exists
    userRecents = userRecents.filter(u => u.Id !== user.Id);
    // Add to top
    userRecents.unshift(user);
    // Limit to 12
    if (userRecents.length > 12) userRecents.pop();

    // Save
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sfiUserRecents: userRecents });
    }

    // Re-render if visible
    var container = document.getElementById('sfarc-recent-users-grid');
    // renderRecentUsers removed from init
}

function addToObjectRecents(obj) {
    // Remove if exists
    objectRecents = objectRecents.filter(o => o.name !== obj.name);
    // Add to top
    objectRecents.unshift(obj);
    // Limit to 12
    if (objectRecents.length > 12) objectRecents.pop();

    // Save
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sfiObjectRecents: objectRecents });
    }

    // Re-render if visible
    var container = document.getElementById('sfarc-recent-objects-grid');
    // renderRecentObjects removed from init
}

// renderRecentUsers removed

// renderRecentObjects removed



// Detect current record context from URL
function detectRecordContext() {
    var url = window.location.pathname;

    // Match Lightning record page pattern: /lightning/r/{ObjectType}/{RecordId}/view
    var recordMatch = url.match(/\/lightning\/r\/([^\/]+)\/([^\/]+)\/view/);

    if (recordMatch) {
        return {
            objectType: recordMatch[1],
            recordId: recordMatch[2],
            isRecordPage: true
        };
    }

    return {
        objectType: null,
        recordId: null,
        isRecordPage: false
    };
}

// Detect full page context including list views for smart SOQL auto-fill
function detectPageContext() {
    var url = window.location.pathname;

    // Match Lightning record page: /lightning/r/{ObjectType}/{RecordId}/view
    var recordMatch = url.match(/\/lightning\/r\/([^\/]+)\/([^\/]+)\/view/);
    if (recordMatch) {
        return { objectType: recordMatch[1], recordId: recordMatch[2], pageType: 'record' };
    }

    // Match Lightning list view: /lightning/o/{ObjectType}/list
    var listMatch = url.match(/\/lightning\/o\/([^\/]+)\/list/);
    if (listMatch) {
        return { objectType: listMatch[1], recordId: null, pageType: 'list' };
    }

    // Match Lightning object home: /lightning/o/{ObjectType}/home
    var homeMatch = url.match(/\/lightning\/o\/([^\/]+)\/home/);
    if (homeMatch) {
        return { objectType: homeMatch[1], recordId: null, pageType: 'home' };
    }

    // Match Lightning related list: /lightning/r/{ObjectType}/{RecordId}/related/{ChildObject}/view
    var relatedMatch = url.match(/\/lightning\/r\/([^\/]+)\/([^\/]+)\/related\/([^\/]+)/);
    if (relatedMatch) {
        return { objectType: relatedMatch[1], recordId: relatedMatch[2], pageType: 'related', childObject: relatedMatch[3] };
    }

    return { objectType: null, recordId: null, pageType: null };
}

// Build a smart SOQL query based on the current page context
function buildSmartQuery() {
    var ctx = detectPageContext();
    if (!ctx.objectType) return '';

    var obj = ctx.objectType;

    if (ctx.pageType === 'record' && ctx.recordId) {
        return `SELECT Id, Name, CreatedDate, LastModifiedDate FROM ${obj} WHERE Id = '${ctx.recordId}'`;
    }

    if (ctx.pageType === 'related' && ctx.childObject) {
        // e.g. on Account's related Contacts list
        var child = ctx.childObject;
        // Common parent lookup field naming convention
        return `SELECT Id, Name, CreatedDate FROM ${child} WHERE ${obj}Id = '${ctx.recordId}' ORDER BY CreatedDate DESC`;
    }

    if (ctx.pageType === 'list' || ctx.pageType === 'home') {
        return `SELECT Id, Name, CreatedDate, LastModifiedDate FROM ${obj} ORDER BY LastModifiedDate DESC`;
    }

    return `SELECT Id, Name FROM ${obj}`;
}


// Update context and button state
function updateRecordContext() {
    currentRecordContext = detectRecordContext();

    // Toggle header button visibility
    var showAllLi = document.getElementById('sfarc-header-show-all-li');
    if (showAllLi) {
        if (currentRecordContext && currentRecordContext.isRecordPage) {
            showAllLi.style.display = '';
            var btn = document.getElementById('sfarc-header-show-all-btn');
            if (btn) btn.title = `Show all data for ${currentRecordContext.objectType} record`;
        } else {
            showAllLi.style.display = 'none';
        }
    }

    // Toggle API Names button visibility (eye icon)
    var apiLi = document.getElementById('sfarc-header-api-li');
    if (apiLi) {
        if (currentRecordContext && currentRecordContext.isRecordPage) {
            apiLi.style.display = '';
        } else {
            apiLi.style.display = 'none';
            // Also clean up state if it was active
            if (document.body.classList.contains('sfarc-show-api-names-active')) {
                document.body.classList.remove('sfarc-show-api-names-active');
                hideApiNames();
                var hBtn = document.getElementById('sfarc-header-api-btn');
                if (hBtn) hBtn.classList.remove('sfarc-header-btn-active', 'slds-is-selected');
                var badge = document.getElementById('sfarc-api-badge');
                if (badge) {
                    badge.textContent = '0';
                    badge.setAttribute('data-count', '0');
                }
                var sidebarBtn = document.getElementById('sfarc-show-api-names');
                if (sidebarBtn) sidebarBtn.classList.remove('active');
            }
        }
    }

    // Toggle LWC and Flow expose buttons visibility
    var isLightningPage = window.location.pathname.includes('/lightning/');
    var isSetupPage = window.location.pathname.includes('/lightning/setup/');
    var isExposeAppropriate = isLightningPage && !isSetupPage;

    var lwcLi = document.getElementById('sfarc-header-lwc-li');
    if (lwcLi) {
        if (isExposeAppropriate) {
            lwcLi.style.display = '';
        } else {
            lwcLi.style.display = 'none';
            // Also clean up state if it was active
            if (document.body.classList.contains('sfarc-expose-lwc-active')) {
                document.body.classList.remove('sfarc-expose-lwc-active');
                hideLwcNames();
                var hBtn = document.getElementById('sfarc-header-lwc-btn');
                if (hBtn) hBtn.classList.remove('sfarc-header-btn-active', 'slds-is-selected');
                var badge = document.getElementById('sfarc-lwc-badge');
                if (badge) {
                    badge.textContent = '0';
                    badge.setAttribute('data-count', '0');
                }
                var sidebarBtn = document.getElementById('sfarc-expose-lwc');
                if (sidebarBtn) sidebarBtn.classList.remove('active');
            }
        }
    }

    var flowLi = document.getElementById('sfarc-header-flow-li');
    if (flowLi) {
        if (isExposeAppropriate) {
            flowLi.style.display = '';
        } else {
            flowLi.style.display = 'none';
            // Also clean up state if it was active
            if (document.body.classList.contains('sfarc-expose-flow-active')) {
                document.body.classList.remove('sfarc-expose-flow-active');
                hideFlowNames();
                var hBtn = document.getElementById('sfarc-header-flow-btn');
                if (hBtn) hBtn.classList.remove('sfarc-header-btn-active', 'slds-is-selected');
                var badge = document.getElementById('sfarc-flow-badge');
                if (badge) {
                    badge.textContent = '0';
                    badge.setAttribute('data-count', '0');
                }
            }
        }
    }
}

var uiInjected = false;

function setupInputInfoIcons() {
    return;
}

// Initialize the extension
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    initSettings().then(() => {
        initTableColumnSettings();
        injectUI();
        initTableResizing();
        checkAndShowOnboarding();
        applyStrictCleanModePermissions();
    });

    // Initialize API
    if (window.sfApi) window.sfApi.init();

    suppressInstrumentationLogs();

    // Fetch current user ID for trace highlighting
    fetchCurrentUserId();
}

async function applyStrictCleanModePermissions() {
    if (!window.sfUserPermissions) return;
    try {
        var perms = await window.sfUserPermissions.getPermissions();
        if (!perms.canViewSetup) {
            // Strict Clean Mode: Automatically hide admin-only feature tabs for non-admins
            var adminTabs = [
                'metadata',
                'devtools',
                'debug-logs',
                'bulk-updater',
                'security',
                'org-limits',
                'data-import',
                'anon-apex',
                'trace-flags'
            ];

            adminTabs.forEach(tabName => {
                var selectors = [
                    `[data-tab="${tabName}"]`,
                    `.sfarc-tab-btn[data-tab="${tabName}"]`,
                    `[data-page="${tabName}"]`,
                    `#sfarc-tab-${tabName}`,
                    `[data-action="${tabName}"]`
                ];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.style.setProperty('display', 'none', 'important');
                    });
                });
            });
        }
    } catch (e) {
        console.warn('Strict Clean Mode permission filtering warning:', e);
    }
}

function suppressInstrumentationLogs() {
    if (window.sfiLogsSuppressed) return;
    window.sfiLogsSuppressed = true;

    // NOTE: the previous 'unload' → 'pagehide' remap on EventTarget.prototype
    // was removed: content-script worlds each have their own realm, so the patch
    // could never affect Salesforce's page-world listeners, and globally altering
    // the prototype for the extension's own listeners was risky for no benefit.

    var originalMethods = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    var suppressionStrings = [
        'O11Y',
        'ComponentProfiler',
        'empApi setting initialized',
        '<lightning-spinner>',
        'InstrumentationResult',
        'O11yInstrumentationResult',
        "Chatter API's hourly request limit",
        'Permissions policy violation',
        'unload is not allowed',
        'Failed to create durable storage'
    ];

    // Internal Salesforce Comet messages that are expected/harmless — suppress to reduce noise
    var internalSilencedStrings = [
        'Background proxy failed or unavailable, falling back to direct fetch',
        'Session initialization returned the same potentially stale ID',
        'Failed to fetch current user ID',
        'Could not get session from sfarc-active tab'
    ];

    var suppressionNamespaces = new Set(['sf.instrumentation']);
    var suppressionMetricNames = new Set(['FID', 'LCP', 'CLS', 'INP']);
    var suppressionLoggerNames = new Set(['Network', 'network']);

    function shouldSuppress(args) {
        if (!args || args.length === 0) return false;

        for (let i = 0; i < args.length; i++) {
            var arg = args[i];
            var type = typeof arg;

            if (type === 'string') {
                for (let j = 0; j < suppressionStrings.length; j++) {
                    if (arg.includes(suppressionStrings[j])) return true;
                }
            } else if (type === 'object' && arg !== null) {
                if (suppressionNamespaces.has(arg.userPayload?.schema?.namespace)) return true;
                if (suppressionMetricNames.has(arg.name)) return true;
                if (suppressionLoggerNames.has(arg.loggerName || arg.name)) return true;
                if ('InstrumentationResult' in arg || 'O11yInstrumentationResult' in arg) return true;
                if (arg.message && typeof arg.message === 'string' && arg.message.includes("Chatter API's hourly request limit")) return true;
            }
        }
        return false;
    }

    function isSilencedInternalLog(args) {
        if (args.length === 0 || typeof args[0] !== 'string') return false;
        var str = args[0];
        if (!str.includes('salesforce comet')) return false;
        for (let i = 0; i < internalSilencedStrings.length; i++) {
            if (str.includes(internalSilencedStrings[i])) return true;
        }
        return false;
    }

    var createSuppressedMethod = (methodName) => {
        var originalMethod = originalMethods[methodName];
        return function (...args) {
            var message = args.length > 0 ? args[0] : null;
            var isString = typeof message === 'string';

            // Suppress the specific FlowScanner API error
            if (isString && message.includes('[FlowScanner]') && message.includes('Tooling API')) {
                return;
            }

            // Pass-through extension logs UNLESS they're known-noisy internal messages
            if (isString && message.includes('salesforce comet')) {
                if (!isSilencedInternalLog(args)) {
                    originalMethod.apply(console, args);
                }
                return;
            }
            if (shouldSuppress(args)) return;
            originalMethod.apply(console, args);
        };
    };

    console.log = createSuppressedMethod('log');
    console.warn = createSuppressedMethod('warn');
    console.error = createSuppressedMethod('error');
    console.info = createSuppressedMethod('info');
    console.debug = createSuppressedMethod('debug');
}


// Fetch current user details
function fetchCurrentUserId() {
    // Immediate sync fallback check from window context
    if (!window.currentUserName) {
        if (window.UserContext && (window.UserContext.userFullName || window.UserContext.userName)) {
            window.currentUserName = window.UserContext.userFullName || window.UserContext.userName;
        } else if (window.$A && typeof window.$A.get === 'function') {
            try {
                window.currentUserName = window.$A.get("$SObjectType.CurrentUser.Name") || window.$A.get("$SObjectType.CurrentUser.Username");
            } catch (e) { }
        }
    }
    if (!window.currentUserId && window.UserContext && window.UserContext.userId) {
        window.currentUserId = window.UserContext.userId;
    }
    updateFooter();

    if (window.currentUserId && window.currentUserName) {
        return Promise.resolve({ id: window.currentUserId, name: window.currentUserName });
    }
    if (currentUserIdPromise) return currentUserIdPromise;

    currentUserIdPromise = new Promise((resolve) => {
        var attempts = 0;
        var checkApi = setInterval(async () => {
            updateFooter();
            if (window.sfApi && (window.sfApi.instanceUrl || window.sfApi.sessionId)) {
                clearInterval(checkApi);
                try {
                    var userInfo = null;
                    var instanceUrl = window.sfApi.instanceUrl || window.location.origin;

                    // 1. Try OAuth UserInfo endpoint (Fast & works across all org types)
                    try {
                        var infoRes = await window.sfApi.fetch(`${instanceUrl}/services/oauth2/userinfo`);
                        if (infoRes && infoRes.ok) {
                            userInfo = await infoRes.json();
                        }
                    } catch (e) { }

                    // 2. Fallback to Chatter API
                    if (!userInfo) {
                        try {
                            var chatterRes = await window.sfApi.fetch(`${instanceUrl}/services/data/${window.sfApi.apiVersion}/chatter/users/me`);
                            if (chatterRes && chatterRes.ok) {
                                userInfo = await chatterRes.json();
                            }
                        } catch (e) { }
                    }

                    var targetUserId = window.currentUserId || (window.UserContext && window.UserContext.userId);
                    if (targetUserId) {
                        try {
                            var queryRes = await window.sfApi.query(`SELECT Id, Name, Username, FullPhotoUrl FROM User WHERE Id = '${targetUserId}'`);
                            if (queryRes && queryRes.records && queryRes.records.length > 0) {
                                var rec = queryRes.records[0];
                                userInfo = {
                                    ...(userInfo || {}),
                                    id: rec.Id,
                                    name: rec.Name,
                                    displayName: rec.Name,
                                    username: rec.Username,
                                    FullPhotoUrl: rec.FullPhotoUrl
                                };
                            }
                        } catch (e) { }
                    }

                    var orgName = '';
                    try {
                        var orgQueryRes = await window.sfApi.query(`SELECT Name FROM Organization LIMIT 1`);
                        if (orgQueryRes && orgQueryRes.records && orgQueryRes.records.length > 0) {
                            orgName = orgQueryRes.records[0].Name;
                        }
                    } catch (e) { }

                    if (userInfo) {
                        window.currentUserId = userInfo.user_id || userInfo.id || window.currentUserId;
                        window.currentUserName = userInfo.name || userInfo.displayName || userInfo.preferred_username || userInfo.username || window.currentUserName;
                        var photoUrl = userInfo.FullPhotoUrl || userInfo.photo?.fullPhotoUrl || userInfo.photo?.smallPhotoUrl || userInfo.SmallPhotoUrl || '';
                        if (photoUrl && !photoUrl.startsWith('http') && window.location?.origin) {
                            photoUrl = window.location.origin + photoUrl;
                        }
                        var photoBase64 = '';
                        if (photoUrl && window.sfApi && typeof window.sfApi.fetch === 'function') {
                            try {
                                var imgRes = await window.sfApi.fetch(photoUrl);
                                if (imgRes && imgRes.ok) {
                                    var blob = await imgRes.blob();
                                    photoBase64 = await new Promise(r => {
                                        var reader = new FileReader();
                                        reader.onloadend = () => r(reader.result || '');
                                        reader.onerror = () => r('');
                                        reader.readAsDataURL(blob);
                                    });
                                }
                            } catch (e) { }
                        }
                        var finalPhotoUrl = photoBase64 || photoUrl;

                        if (window.sfApi) {
                            window.sfApi.userInfo = {
                                ...(window.sfApi.userInfo || {}),
                                id: window.currentUserId,
                                username: userInfo.preferred_username || userInfo.username || userInfo.email,
                                orgId: userInfo.organization_id || userInfo.organizationId || userInfo.organization?.id,
                                orgName: orgName,
                                name: window.currentUserName,
                                photoUrl: finalPhotoUrl
                            };
                        }
                        var loggedUser = {
                            name: window.currentUserName,
                            username: userInfo.preferred_username || userInfo.username || userInfo.email || '',
                            orgId: userInfo.organization_id || userInfo.organizationId || userInfo.organization?.id || '',
                            orgName: orgName,
                            photoUrl: finalPhotoUrl
                        };
                        if (window.chrome && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ sfarcLoggedInUser: loggedUser });
                        }
                        try { localStorage.setItem('sfarc_logged_in_user', JSON.stringify(loggedUser)); } catch (err) { }
                    }
                    updateFooter();
                    resolve({ id: window.currentUserId, name: window.currentUserName });
                } catch (e) {
                    console.warn('salesforce comet: Failed to fetch user info:', e.message);
                    updateFooter();
                    resolve(null);
                }
            } else if (attempts > 10) {
                clearInterval(checkApi);
                updateFooter();
                resolve(null);
            }
            attempts++;
        }, 300);
    }).finally(() => {
        currentUserIdPromise = null;
    });
    return currentUserIdPromise;
}

function updateFooter() {
    var instanceEl = document.getElementById('sfarc-footer-instance');

    if (instanceEl) {
        var orgId = '';
        var orgName = '';

        // Try from cache first
        try {
            var cachedStr = localStorage.getItem('sfarc_logged_in_user');
            if (cachedStr) {
                var cached = JSON.parse(cachedStr);
                if (cached && cached.orgName) orgName = cached.orgName;
                if (cached && cached.orgId) orgId = cached.orgId;
            }
        } catch (e) {}

        if (window.sfApi && window.sfApi.userInfo && window.sfApi.userInfo.orgId) {
            orgId = window.sfApi.userInfo.orgId;
        }
        if (!orgId && window.UserContext && window.UserContext.orgId) {
            orgId = window.UserContext.orgId;
        }
        if (!orgId && searchCache && searchCache.orgData && searchCache.orgData.orgId) {
            orgId = searchCache.orgData.orgId;
        }

        if (window.sfApi && window.sfApi.userInfo && window.sfApi.userInfo.orgName) {
            orgName = window.sfApi.userInfo.orgName;
        }
        if (!orgName && searchCache && searchCache.orgData && searchCache.orgData.name) {
            orgName = searchCache.orgData.name;
        }

        if (orgName && orgName !== 'Unknown') {
            instanceEl.textContent = orgName;
        } else if (orgId && orgId !== 'Unknown') {
            instanceEl.textContent = orgId;
        } else {
            // Fallback to hostname until org ID is available
            var instance = '';
            if (window.sfApi && window.sfApi.instanceUrl) {
                try {
                    instance = new URL(window.sfApi.instanceUrl).hostname;
                } catch (e) {
                    instance = window.sfApi.instanceUrl;
                }
            }
            if (!instance && window.location && window.location.hostname) {
                instance = window.location.hostname;
            }
            if (instance && instance !== 'Unknown') {
                instanceEl.textContent = instance;
            }
        }
    }
}

function setupOrgHoverCard() {
    var orgItem = document.getElementById('sfarc-footer-org-item');
    var hoverCard = document.getElementById('sfarc-org-hover-card');
    if (!orgItem || !hoverCard) return;

    var isFetching = false;
    var hoverTimeout = null;

    async function loadOrgHoverData() {
        if (window.sfarcOrgHoverDetails) {
            updateHoverCardUI(window.sfarcOrgHoverDetails);
            return;
        }

        if (isFetching) return;
        isFetching = true;

        try {
            var orgQuery = "SELECT Id, Name, InstanceName, OrganizationType, IsSandbox, TrialExpirationDate FROM Organization LIMIT 1";
            var orgResult = await window.sfApi.query(orgQuery);
            var org = (orgResult && orgResult.records && orgResult.records.length > 0) ? orgResult.records[0] : {};
            
            if (window.sfApi && window.sfApi.userInfo && org.Name) {
                window.sfApi.userInfo.orgName = org.Name;
            }
            updateFooter();

            var instanceUrl = (window.sfApi && window.sfApi.instanceUrl) ? window.sfApi.instanceUrl : window.location.origin;
            var instanceName = org.InstanceName;
            if (!instanceName && instanceUrl.includes('//')) {
                var hostPart = instanceUrl.split('//')[1].split('.')[0].toUpperCase();
                instanceName = hostPart;
            }
            if (!instanceName) instanceName = 'SWE126';

            // Region/Location heuristic based on InstanceName
            var location = 'EMEA';
            var instUpper = instanceName.toUpperCase();
            if (instUpper.startsWith('NA') || instUpper.startsWith('USA')) {
                location = 'NA';
            } else if (instUpper.startsWith('AP') || instUpper.startsWith('AUS') || instUpper.startsWith('IND') || instUpper.startsWith('JPN')) {
                location = 'APAC';
            } else if (instUpper.startsWith('EU') || instUpper.startsWith('SWE') || instUpper.startsWith('UK')) {
                location = 'EMEA';
            }

            var rawOrgId = org.Id || (window.sfApi && window.sfApi.userInfo ? window.sfApi.userInfo.orgId : '00Dd200000RwoZZEAZ');
            var displayOrgId = rawOrgId.length > 15 ? rawOrgId.substring(0, 15) : rawOrgId;

            var apiVers = (window.sfApi && window.sfApi.apiVersion) ? window.sfApi.apiVersion.replace('v', '') : '67';

            var orgType = org.OrganizationType || (org.IsSandbox ? 'Developer Sandbox' : 'Developer Edition');

            var maintText = org.TrialExpirationDate
                ? `Expires ${new Date(org.TrialExpirationDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                : "Winter '27 on Sat Oct 03 2026";

            var releaseText = `Summer '26 Patch 13.3 / 262.13.3`;

            var details = {
                orgId: displayOrgId,
                instance: instanceName,
                type: orgType,
                status: 'OK',
                release: releaseText,
                location: location,
                apiVers: apiVers,
                maint: maintText,
                url: instanceUrl
            };

            window.sfarcOrgHoverDetails = details;
            updateHoverCardUI(details);
        } catch (err) {
            console.error('Failed to load org hover details:', err);
            var fallbackOrgId = (window.sfApi && window.sfApi.userInfo ? window.sfApi.userInfo.orgId : '00Dd200000RwoZZEAZ');
            var fallback = {
                orgId: fallbackOrgId.length > 15 ? fallbackOrgId.substring(0, 15) : fallbackOrgId,
                instance: 'SWE126',
                type: 'Developer Edition',
                status: 'OK',
                release: "Summer '26 Patch 13.3 / 262.13.3",
                location: 'EMEA',
                apiVers: '67',
                maint: "Winter '27 on Sat Oct 03 2026",
                url: (window.sfApi && window.sfApi.instanceUrl) ? window.sfApi.instanceUrl : window.location.origin
            };
            updateHoverCardUI(fallback);
        } finally {
            isFetching = false;
        }
    }

    function updateHoverCardUI(data) {
        var setTxt = (id, val) => {
            var el = document.getElementById(id);
            if (el) el.textContent = val || '-';
        };

        setTxt('sfarc-hover-orgid', data.orgId);
        setTxt('sfarc-hover-instance', data.instance);
        setTxt('sfarc-hover-type', data.type);
        setTxt('sfarc-hover-status', data.status);
        setTxt('sfarc-hover-release', data.release);
        setTxt('sfarc-hover-location', data.location);
        setTxt('sfarc-hover-apivers', data.apiVers);
        setTxt('sfarc-hover-maint', data.maint);

        var urlEl = document.getElementById('sfarc-hover-url');
        if (urlEl && data.url) {
            // Never interpolate an org-provided URL into markup. Besides
            // preventing HTML injection, URL parsing lets us restrict this
            // convenience link to normal web protocols.
            urlEl.textContent = '';
            try {
                var parsedUrl = new URL(data.url, window.location.origin);
                if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return;
                var orgLink = document.createElement('a');
                orgLink.href = parsedUrl.href;
                orgLink.target = '_blank';
                orgLink.rel = 'noopener noreferrer';
                orgLink.style.cssText = 'color: var(--primary-color, #0ea5e9); text-decoration: none; font-weight: 500;';
                orgLink.textContent = parsedUrl.href;
                urlEl.appendChild(orgLink);
            } catch (e) { /* invalid URL — leave the field empty */ }
        }
    }

    orgItem.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        loadOrgHoverData();
        hoverCard.style.display = 'block';
        requestAnimationFrame(() => {
            hoverCard.style.opacity = '1';
            hoverCard.style.transform = 'translateY(0)';
        });
    });

    orgItem.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            hoverCard.style.opacity = '0';
            hoverCard.style.transform = 'translateY(6px)';
            setTimeout(() => {
                if (hoverCard.style.opacity === '0') {
                    hoverCard.style.display = 'none';
                }
            }, 200);
        }, 150);
    });

    hoverCard.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        hoverCard.style.display = 'block';
        hoverCard.style.opacity = '1';
        hoverCard.style.transform = 'translateY(0)';
    });

    hoverCard.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            hoverCard.style.opacity = '0';
            hoverCard.style.transform = 'translateY(6px)';
            setTimeout(() => {
                if (hoverCard.style.opacity === '0') {
                    hoverCard.style.display = 'none';
                }
            }, 200);
        }, 150);
    });
}

function initTableResizing() {
    var tables = document.querySelectorAll('.sfarc-log-table');
    tables.forEach(table => {
        var cols = table.querySelectorAll('th');
        cols.forEach(col => {
            // Don't add resizer to the first column (checkbox)
            if (col.querySelector('input[type="checkbox"]')) return;

            var resizer = document.createElement('div');
            resizer.classList.add('sfarc-col-resizer');
            col.appendChild(resizer);

            createResizableColumn(col, resizer);
        });
    });
}

function createResizableColumn(col, resizer) {
    var x = 0;
    var w = 0;

    var mouseDownHandler = function (e) {
        x = e.clientX;
        var styles = window.getComputedStyle(col);
        w = parseInt(styles.width, 10);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        resizer.classList.add('resizing');
    };

    var mouseMoveHandler = function (e) {
        var dx = e.clientX - x;
        col.style.width = `${w + dx}px`;
    };

    var mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        resizer.classList.remove('resizing');
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

function initSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['sfiSettings'], (result) => {
            if (result.sfiSettings) {
                settings = { ...settings, ...result.sfiSettings };
            }
            applySettings();
            resolve();
        });
    });
}

// --- Table Field / Column Chooser Device Storage Persistence ---
var sfarcTableColumnSettings = {};

function initTableColumnSettings() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            var storageArea = chrome.storage.sync || chrome.storage.local;
            storageArea.get(['sfarcTableColumnSettings'], (res) => {
                sfarcTableColumnSettings = res.sfarcTableColumnSettings || {};
                resolve(sfarcTableColumnSettings);
            });
        } else {
            resolve(sfarcTableColumnSettings);
        }
    });
}

function getSavedTableColumns(tableKey, defaultColumns) {
    var saved = sfarcTableColumnSettings[tableKey];
    if (Array.isArray(saved) && saved.length > 0) {
        var validSaved = saved.filter(c => defaultColumns.includes(c));
        if (validSaved.length > 0) return validSaved;
    }
    return defaultColumns;
}

function saveTableColumns(tableKey, selectedColumns) {
    sfarcTableColumnSettings[tableKey] = selectedColumns;
    if (typeof chrome !== 'undefined' && chrome.storage) {
        var storageArea = chrome.storage.sync || chrome.storage.local;
        storageArea.set({ sfarcTableColumnSettings: sfarcTableColumnSettings });
    }
}

// --- Dynamic sObject Field Discovery ---
var sfarcObjectFieldsCache = {};

function extractSObjectNameFromQuery(queryStr) {
    if (!queryStr) return null;
    var match = queryStr.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (match && match[1]) return match[1];
    return null;
}

async function fetchObjectDescribeFields(sObjectName) {
    if (!sObjectName || !window.sfApi) return [];
    if (sfarcObjectFieldsCache[sObjectName]) return sfarcObjectFieldsCache[sObjectName];

    try {
        var url = `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion || 'v60.0'}/sobjects/${sObjectName}/describe`;
        var res = await window.sfApi.fetch(url);
        if (res.ok) {
            var data = await res.json();
            if (data && data.fields) {
                var fields = data.fields.map(f => f.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                sfarcObjectFieldsCache[sObjectName] = fields;
                return fields;
            }
        }
    } catch (err) {
        console.warn('salesforce comet: Object describe failed for ' + sObjectName, err);
    }
    return [];
}

// Listen for settings changes from other tabs/pages
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.sfiSettings) {
        settings = { ...settings, ...changes.sfiSettings.newValue };
        applySettings();
        refreshHeaderButtons();
    }
});

function saveSettings() {
    chrome.storage.sync.set({ sfiSettings: settings }, () => {
        applySettings();
    });
}

function applySettings() {
    // Apply Theme to sfarc-panel container only (never document.body to prevent dark mode leaking to native Salesforce pages)
    var panel = document.getElementById('sfarc-panel');
    var isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (panel) {
        if (isDark) {
            panel.classList.add('sfarc-dark-theme');
        } else {
            panel.classList.remove('sfarc-dark-theme');
        }
        // Apply Performance Mode
        const performanceModeActive = settings.performanceMode || 
            (settings.autoPerformanceMode && window.SFARC_Perf?.systemInfo?.performanceModeActive);
        if (performanceModeActive) {
            panel.classList.add('sfarc-performance-mode');
        } else {
            panel.classList.remove('sfarc-performance-mode');
        }
    }

    // Apply UI Font Size
    if (panel && settings.uiFontSize) {
        panel.style.setProperty('--sfarc-ui-font-size', settings.uiFontSize + 'px');
    }

    // Apply Icon Settings
    applyIconSettings();

    // Apply Panel Settings
    applyPanelSettings();

    // Update theme colors for current active tab group
    var activeTab = document.querySelector('.sfarc-tab.active')?.dataset.tab || 'objects';
    if (typeof updateThemeColors === 'function') {
        updateThemeColors(activeTab);
    }

    // Update API Version in API class if needed (not directly accessible here, but we can set it on window.sfApi if exposed)
    if (window.sfApi) {
        window.sfApi.apiVersion = 'v' + settings.apiVersion;
    }

    // Update Header Icons Toggle UI
    updateHeaderIconsToggleUI();

    // Refresh header action buttons in Salesforce navigation bar
    refreshHeaderButtons();
}

function updateHeaderIconsToggleUI() {
    var toggleBtn = document.getElementById('sfarc-header-icons-toggle');
    if (!toggleBtn) return;

    var headerIcons = getHeaderIconSettings();
    var anyVisible = headerIcons.sessionCopy || headerIcons.fieldApi || headerIcons.lwcViewer || headerIcons.flowViewer || headerIcons.showAllData;

    var iconEl = toggleBtn.querySelector('i');
    var textEl = toggleBtn.querySelector('span');

    if (anyVisible) {
        if (iconEl) iconEl.innerHTML = getIconHtml('fa-eye');
        if (textEl) textEl.textContent = 'Hide Icons';
        toggleBtn.title = 'Hide Icons';
        toggleBtn.classList.add('active');
    } else {
        if (iconEl) iconEl.innerHTML = getIconHtml('fa-eye-slash');
        if (textEl) textEl.textContent = 'Show Icons';
        toggleBtn.title = 'Show Icons';
        toggleBtn.classList.remove('active');
    }
}

function applyIconSettings() {
    var container = document.getElementById('sfarc-toggle-container');
    if (!container) return;

    if (!settings.iconVisible || settings.launcherMethod === 'shortcut') {
        container.style.setProperty('display', 'none', 'important');
        return;
    }

    container.style.setProperty('display', 'flex', 'important');
    container.dataset.position = settings.iconPosition;

    // Reset container positioning styles
    container.style.removeProperty('top');
    container.style.removeProperty('bottom');
    container.style.removeProperty('left');
    container.style.removeProperty('right');
    container.style.removeProperty('transform');

    var offset = settings.iconOffset + '%';
    var buttons = container.querySelectorAll('.sfarc-side-toggle-btn');

    if (settings.iconPosition === 'right') {
        container.style.setProperty('top', offset, 'important');
        container.style.setProperty('right', '0', 'important');
    } else if (settings.iconPosition === 'left') {
        container.style.setProperty('top', offset, 'important');
        container.style.setProperty('left', '0', 'important');
    } else if (settings.iconPosition === 'bottom') {
        container.style.setProperty('left', offset, 'important');
        container.style.setProperty('bottom', '0', 'important');
    } else if (settings.iconPosition === 'top') {
        container.style.setProperty('left', offset, 'important');
        container.style.setProperty('top', '0', 'important');
    }

    if (settings.iconAutoHide) {
        container.dataset.autohide = "true";
    } else {
        container.dataset.autohide = "false";
    }



    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('z-index', '2147483647', 'important');
    container.style.setProperty('display', 'flex', 'important');
}

function applyPanelSettings() {
    var panel = document.getElementById('sfarc-panel');
    if (!panel) return;

    // Remove existing position classes
    panel.classList.remove('sfarc-panel-left', 'sfarc-panel-right', 'sfarc-panel-top', 'sfarc-panel-bottom');

    // Add new position class
    panel.classList.add(`sfarc-panel-${settings.panelPosition}`);

    var container = panel.querySelector('.sfarc-popup-container');
    if (container) {
        // Reset height/width styles that might have been set
        container.style.height = '';
        container.style.width = '';

        if (settings.panelPosition === 'top' || settings.panelPosition === 'bottom') {
            // Keep CSS classes responsible for height and width
        } else {
            // Keep CSS classes responsible for height and width
        }
    }
}

function injectUI() {

    // Check if already injected and panel still exists in DOM
    if (document.getElementById('sfarc-panel')) {
        return;
    }

    // Set flag to prevent duplicate injection
    uiInjected = true;

    // Load Material Symbols Outlined font for icons
    if (!document.getElementById('sfarc-material-symbols-css')) {
        var link = document.createElement('link');
        link.id = 'sfarc-material-symbols-css';
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('src/local-fonts.css');
        document.head.appendChild(link);
    }

    // Toggle buttons are already created by content.js bootstrapper
    var toggleContainer = document.getElementById('sfarc-toggle-container');
    if (toggleContainer) {
        applyIconSettings();
    }


    // Create popup panel
    var panel = document.createElement('div');
    panel.id = 'sfarc-panel';
    panel.className = 'sfarc-hidden';
    panel.innerHTML = `
        <div class="sfarc-popup-container" style="transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.5s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);">
            <div class="sfarc-header">
                <div class="sfarc-title" style="display: flex; align-items: center; gap: 8px;">
                    <img id="sfarc-palette-logo" src="${(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icons/icon-48.png') : 'icons/icon-48.png'}" alt="Logo" style="width: 26px; height: 26px; object-fit: contain;">
                    Salesforce Comet 
                </div>
                <div class="sfarc-header-controls-left">
                    <!-- Left controls if any -->
                </div>
                <div class="sfarc-header-controls">
                    <!-- Header Icons Toggle -->
                    <!-- Import Button -->
                    <button class="sfarc-header-btn" id="sfarc-data-import" style="display: flex; align-items: center; gap: 7px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-text); font-size: 14px; font-weight: 500; transition: color 0.2s;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 11V3M8 11L5 8M8 11L11 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="sfarc-header-btn-label">Import</span>
                    </button>

                    <!-- Export Button -->
                    <button class="sfarc-header-btn" id="sfarc-data-export" style="display: flex; align-items: center; gap: 7px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-text); font-size: 14px; font-weight: 500; transition: color 0.2s;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 3V11M8 3L5 6M8 3L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="sfarc-header-btn-label">Export</span>
                    </button>

                    <!-- Metadata Button -->
                    <button class="sfarc-header-btn" id="sfarc-metadata" style="display: flex; align-items: center; gap: 7px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-text); font-size: 14px; font-weight: 500; transition: color 0.2s;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span class="sfarc-header-btn-label">Metadata</span>
                    </button>

                    <!-- Code Editor Button (icon tinted with the org favicon color) -->
                    <button class="sfarc-header-btn" id="sfarc-code-editor" style="display: flex; align-items: center; gap: 7px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-text); font-size: 14px; font-weight: 500; transition: color 0.2s;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                            <path d="M22 9H2M14 17.5L16.5 15L14 12.5M10 12.5L7.5 15L10 17.5M2 7.8L2 16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27977 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3L6.8 3C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="sfarc-header-btn-label">Code Editor</span>
                    </button>

                    <!-- Theme Toggle (Hidden) -->
                    <button id="sfarc-theme-toggle" class="sfarc-header-btn" style="display:none;">
                        <!-- Moon: filled crescent, more substantial than a thin outline -->
                        <svg class="sfarc-moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:inline-block;transition:opacity 0.2s ease;opacity:1;">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill-rule="evenodd"></path>
                        </svg>
                        <!-- Sun: larger center circle + long rays that reach the edges -->
                        <svg class="sfarc-sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;transition:opacity 0.2s ease;opacity:0;">
                            <circle cx="12" cy="12" r="4.5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="2.5" y1="2.5" x2="3.7" y2="3.7"></line>
                            <line x1="20.3" y1="20.3" x2="21.5" y2="21.5"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="2.5" y1="21.5" x2="3.7" y2="20.3"></line>
                            <line x1="20.3" y1="3.7" x2="21.5" y2="2.5"></line>
                        </svg>
                    </button>

                </div>
            </div>
            
            <!-- Global Command Search -->
            <div class="sfarc-global-search-container" style="display: flex; align-items: center; padding: 5px; border-bottom: 1px solid var(--sfarc-border); flex-shrink: 0; position: relative; z-index: 1000;">
                <!-- Toggle Mode: Column Popover Menu -->
                <div id="sfarc-search-mode-toggle" style="display: flex; align-items: center; gap: 4px; margin-right: 5px; flex-shrink: 0; position: relative; z-index: 1001;">
                    <button id="sfarc-search-mode-btn" type="button" style="display: inline-flex; align-items: center; gap: 5px; background: var(--sfarc-card-bg, #ffffff); color: var(--sfarc-text, #111827); border: 1px solid var(--sfarc-border, #e5e7eb); border-radius: 6px; padding: 4px 9px; font-size: 11px; font-weight: 500; cursor: pointer; outline: none; transition: all 0.15s ease; height: 26px; line-height: 1;">
                        <span id="sfarc-search-mode-label">All Modes</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <button id="sfarc-add-custom-shortcut-btn"  style="display: none; border: 1px dashed var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); background: transparent; color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); border-radius: 6px; padding: 3px 7px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-size: 11px; align-items: center; gap: 3px; line-height: 1.2; height: 26px;"><i class="fa-solid fa-plus" style="font-size: 9.5px;"></i> Custom</button>

                    <!-- Floating Popover Column Menu (Glassmorphism) -->
                    <div id="sfarc-search-mode-popover" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; padding: 4px; min-width: 150px; z-index: 10000000;">
                        <div class="sfarc-mode-option active" data-mode="all" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; color: #ffffff; background: rgba(255, 255, 255, 0.14); cursor: pointer; transition: all 0.12s ease; user-select: none;">
                            <span class="sfarc-mode-check" style="width: 14px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; color: #ffffff; font-size: 12px; opacity: 1;">✓</span>
                            <span>All Modes</span>
                        </div>
                        <div class="sfarc-mode-option" data-mode="features" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; color: #9ca3af; background: transparent; cursor: pointer; transition: all 0.12s ease; user-select: none;">
                            <span class="sfarc-mode-check" style="width: 14px; display: inline-flex; align-items: center; justify-content: center; opacity: 0; font-size: 12px;">✓</span>
                            <span>Tools</span>
                        </div>
                        <div class="sfarc-mode-option" data-mode="shortcuts" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; color: #9ca3af; background: transparent; cursor: pointer; transition: all 0.12s ease; user-select: none;">
                            <span class="sfarc-mode-check" style="width: 14px; display: inline-flex; align-items: center; justify-content: center; opacity: 0; font-size: 12px;">✓</span>
                            <span>Shortcuts</span>
                        </div>
                    </div>
                </div>

                <div id="sfarc-global-context-pills" style="display: flex; gap: 6px; margin-right: 8px;"></div>

                <input type="text" id="sfarc-global-search" class="sfarc-raycast-search" placeholder="Search for commands, objects, users, metadata..." autocomplete="off" style="flex: 1; font-size: 18px; color: var(--sfarc-text); font-weight: 400; border: none !important; background: transparent !important; outline: none !important; padding: 4px 0 4px 10px;">

                <div class="sfarc-search-keyboard-hints" aria-hidden="true">
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>↵</kbd> Open</span>
                    <span><kbd>Esc</kbd> Close</span>
                </div>

                <button id="sfarc-smart-filter-btn"  style="display: none; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--sfarc-text-primary); padding: 4px; border-radius: 4px; margin-left: 8px; position: relative;">
                    <span id="sfarc-smart-filter-icon" style="display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </span>
                    <span id="sfarc-smart-filter-badge" style="display: none; position: absolute; top: 0; right: 0; background: var(--primary-color); color: var(--sfarc-accent-contrast, white); border-radius: 50%; font-size: 9px; width: 14px; height: 14px; align-items: center; justify-content: center; transform: translate(25%, -25%); font-weight: bold;"></span>
                </button>
            </div>


            <!-- Smart Filters Modal (centered dialog) -->
            <div id="sfarc-smart-filter-backdrop" class="sfarc-modal-backdrop" style="display: none;">
                <div id="sfarc-smart-filter-popup" class="sfarc-smart-filter-modal" role="dialog" aria-modal="true" aria-labelledby="sfarc-smart-filter-title">
                    <div class="sfarc-smart-filter-modal-header">
                        <span id="sfarc-smart-filter-title" class="sfarc-smart-filter-modal-title">Smart Filters</span>
                        <button id="sfarc-smart-filter-close" class="sfarc-smart-filter-modal-close" >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="sfarc-smart-filter-modal-body">
                        <div class="sfarc-smart-filter-hint">Filter search results by User fields. Each condition is combined with the previous one.</div>
                        <div id="sfarc-smart-filter-rows" class="sfarc-smart-filter-rows">
                            <!-- Filter rows will go here -->
                        </div>
                        <button id="sfarc-smart-filter-add-btn"><i class="fa-solid fa-plus"></i> Add Condition</button>
                    </div>
                    <div class="sfarc-smart-filter-modal-footer">
                        <button id="sfarc-smart-filter-clear-btn" class="sfarc-smart-filter-clear">Clear</button>
                        <button id="sfarc-smart-filter-apply-btn" class="sfarc-smart-filter-apply">Apply Filters</button>
                    </div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="sfarc-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">

                <!-- Home View (Commands List) -->
                <div id="sfarc-home-view" class="sfarc-tab-content-container" style="display: flex; flex-direction: column; height: 100%; overflow-y: auto;">
                    <!-- Tiny Non-Blocking Feedback & Review Banner -->
                    <div id="sfarc-review-banner" class="sfarc-rb-banner" style="display: none;">
                        <button id="sfarc-rb-dismiss-btn" class="sfarc-rb-dismiss" type="button" title="Hide this prompt" aria-label="Hide feedback prompt"><i class="fa-solid fa-xmark"></i></button>
                        <!-- Step 1: Initial Question -->
                        <div id="sfarc-rb-step-1" class="sfarc-rb-step sfarc-rb-row" style="display: flex;">
                            <div class="sfarc-rb-message">
                                <span class="sfarc-rb-icon sfarc-rb-icon-sparkle"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg></span>
                                <span class="sfarc-rb-text">Has <strong>salesforce comet</strong> been helpful for your dev work?</span>
                            </div>
                            <div class="sfarc-rb-actions">
                                <button id="sfarc-rb-yes-btn" class="sfarc-rb-btn sfarc-rb-btn-primary">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
                                    Yes, useful
                                </button>
                                <button id="sfarc-rb-feedback-btn" class="sfarc-rb-btn sfarc-rb-btn-ghost">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                    Feedback
                                </button>
                            </div>
                        </div>

                        <!-- Step 2: Review Prompt -->
                        <div id="sfarc-rb-step-2" class="sfarc-rb-step sfarc-rb-row" style="display: none;">
                            <div class="sfarc-rb-message">
                                <span class="sfarc-rb-icon sfarc-rb-icon-star"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>
                                <span class="sfarc-rb-text">Awesome! An honest Chrome Web Store review would mean the world to us.</span>
                            </div>
                            <div class="sfarc-rb-actions">
                                <a id="sfarc-rb-rate-link" class="sfarc-rb-btn sfarc-rb-btn-success" href="https://chromewebstore.google.com/detail/pigmbghmkdaalhebdhfoeldcekhiemhi?utm_source=item-share-cb" target="_blank">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    Leave Review
                                </a>
                            </div>
                        </div>

                    </div>
                    <div id="sfarc-command-list" class="sfarc-command-list" style="padding: 12px 0;">
                        <!-- Commands will be rendered here dynamically -->
                    </div>
                </div>

                <!-- Suggestions Container (Used by Split Views: Objects, Users, Shortcuts, etc.) -->
                <div id="sfarc-suggestions-container" class="sfarc-section" style="display: none; flex: 1; min-height: 0; flex-direction: column;">
                    <div class="sfarc-suggestions" id="sfarc-suggestions" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto;">
                        <!-- Content loaded dynamically -->
                    </div>
                </div>

                <!-- Flow Monitor Container (Hidden by default) -->
                <div id="sfarc-flow-monitor" style="display: none;"></div>

                <!-- DevTools Container (Hidden by default) -->
                <div id="sfarc-devtools-container" style="display: none;"></div>

                <!-- Bulk Field Container -->
                <div id="sfarc-bulk-field-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column; background: var(--sfarc-body-bg); position: relative;"></div>

                <!-- Code Search Container -->
                <div id="sfarc-code-search-container" class="sfarc-tab-content-container" style="display: none; flex: 1; min-height: 0; height: 100%; flex-direction: column; background: var(--sfarc-body-bg);"></div>

                <!-- Create Custom Shortcut Modal -->
                <div id="sfarc-custom-shortcut-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(3px); z-index: 2147483647; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
                    <div style="background: var(--sfarc-bg, #ffffff); width: 100%; max-width: 420px; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid var(--sfarc-border, #e5e7eb); color: var(--sfarc-text, #111827); animation: sfarc-fade-in 0.2s ease-out;">
                        <div style="padding: 14px 18px; border-bottom: 1px solid var(--sfarc-border, #e5e7eb); display: flex; align-items: center; justify-content: space-between; background: var(--sfarc-bg, #ffffff);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-bookmark" style="color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)));"></i>
                                <h3 style="margin: 0; font-size: 14px; font-weight: 500; color: var(--sfarc-text, #111827);">Create Custom Shortcut</h3>
                            </div>
                            <button id="sfarc-custom-shortcut-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--sfarc-secondary-text, #6b7280);"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; background: var(--sfarc-body-bg, #f9fafb);">
                            <div>
                                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text, #374151); margin-bottom: 4px;">Shortcut Name / Label</label>
                                <input type="text" id="sfarc-cs-label" class="sfarc-input" placeholder="e.g. Accounts List or Setup Flow" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-text, #111827);">
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text, #374151); margin-bottom: 4px;">Target URL / Path</label>
                                <input type="text" id="sfarc-cs-url" class="sfarc-input" placeholder="e.g. /lightning/o/Account/list or /lightning/setup/Flows/home" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-text, #111827);">
                                <span style="display: block; font-size: 11px; color: var(--sfarc-secondary-text, #6b7280); margin-top: 4px;">Supports relative Lightning paths or full URLs.</span>
                                <span id="sfarc-cs-url-preview" style="display: none; font-size: 11px; margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all;"></span>
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text, #374151); margin-bottom: 6px;">Select Icon</label>
                                <div id="sfarc-cs-icon-picker" style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" class="sfarc-icon-opt active" data-icon="fa-bookmark" style="width: 32px; height: 32px; border-radius: 6px; border: 2px solid var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1); color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-bookmark"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-star" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-star"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-bolt" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-bolt"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-database" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;">${getIconHtml('fa-database')}</button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-cubes" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-cubes"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-chart-pie" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-chart-pie"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-envelope" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-envelope"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-user" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-user"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-shield-halved" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-shield-halved"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-diagram-project" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-diagram-project"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-code" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;"><i class="fa-solid fa-code"></i></button>
                                    <button type="button" class="sfarc-icon-opt" data-icon="fa-gear" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-secondary-text, #6b7280); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;">${getIconHtml('fa-gear')}</button>
                                </div>
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--sfarc-text, #374151); margin-bottom: 4px;">Category (Optional)</label>
                                <input type="text" id="sfarc-cs-category" class="sfarc-input" value="Custom Shortcuts" placeholder="e.g. Data, Administration, Setup" style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--sfarc-border, #d1d5db); background: var(--sfarc-bg, #ffffff); color: var(--sfarc-text, #111827);">
                            </div>
                        </div>
                        <div style="padding: 12px 18px; border-top: 1px solid var(--sfarc-border, #e5e7eb); background: var(--sfarc-bg, #ffffff); display: flex; justify-content: flex-end; gap: 10px;">
                            <button id="sfarc-custom-shortcut-cancel" class="sfarc-btn sfarc-btn-secondary" style="padding: 6px 16px; font-size: 12px; border-radius: 6px;">Cancel</button>
                            <button id="sfarc-custom-shortcut-save" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 18px; font-size: 12px; border-radius: 6px;">Save Shortcut</button>
                        </div>
                    </div>
                </div>

                <!-- LWC Container -->
                <div id="sfarc-lwc-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column; background: var(--sfarc-body-bg);"></div>

                <!-- Anonymous Apex Container -->
                <div id="sfarc-anon-apex-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column; background: var(--sfarc-body-bg); padding: 5px !important;">
                    <div style="padding: 5px 8px; background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between; border-radius: 6px 6px 0 0;">
                        <div>
                            <h3 style="margin: 0; font-size: 15px; font-weight: 500; color: var(--sfarc-text);">Anonymous Apex Scratchpad</h3>
                            <p style="font-size: 12px; color: var(--sfarc-secondary-text); margin: 2px 0 0 0;">Write and execute Apex code with real-time VS Code syntax highlighting.</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="sfarc-anon-explorer-btn" class="sfarc-btn" style="padding: 6px 12px; font-size: 12px; color: var(--primary-color); border-color: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.3);"><i class="fa-solid fa-code"></i> Class Explorer</button>
                            <button id="sfarc-anon-history-btn" class="sfarc-btn" style="padding: 6px 12px; font-size: 12px;"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
                            <button id="sfarc-anon-execute-btn" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 16px; font-size: 12px; background: #2e7d32; border: 1px solid #2e7d32;"><i class="fa-solid fa-bolt" style="margin-right: 5px;"></i> Run Code</button>
                            <button id="sfarc-anon-new-tab-btn" class="sfarc-btn" style="padding: 6px 12px; font-size: 12px; background: transparent;" ><i class="fa-solid fa-external-link-alt"></i></button>
                        </div>
                    </div>
                    <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 5px 0 0 0; gap: 5px; position: relative;">
                        <!-- Compact Apex Explorer Toolbar -->
                        <div id="sfarc-anon-explorer-toolbar" style="display: none; padding: 10px; background: var(--sfarc-bg); border: 1px solid var(--sfarc-border); border-radius: 6px; align-items: center; gap: 10px; box-sizing: border-box; width: 100%; z-index: 10; position: relative;">
                            <i class="fa-solid fa-code" style="color: var(--primary-color);"></i>
                            <select id="sfarc-explorer-class-select" class="sfarc-input" style="flex: 1; min-width: 0; width: 0; border-radius: 4px; padding: 6px; font-size: 13px; text-overflow: ellipsis;">
                                <option value="">Loading classes...</option>
                            </select>
                            <select id="sfarc-explorer-method-select" class="sfarc-input" style="flex: 1; min-width: 0; width: 0; border-radius: 4px; padding: 6px; font-size: 13px; text-overflow: ellipsis;" disabled>
                                <option value="">Select a class first</option>
                            </select>
                            <button id="sfarc-explorer-insert-btn" class="sfarc-btn sfarc-btn-primary" style="padding: 6px 12px; font-size: 13px; white-space: nowrap;" disabled>Insert Code</button>
                            <i class="fa-solid fa-times" id="sfarc-anon-explorer-close" style="cursor: pointer; color: var(--sfarc-secondary-text); padding: 0 5px;" ></i>
                        </div>

                        <!-- History Panel (Absolute) -->
                        <div id="sfarc-anon-history-panel" style="display: none; position: absolute; top: 12px; right: 12px; bottom: 12px; width: 340px; background: #1e1e1e; border: 1px solid #333333; border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); z-index: 50; flex-direction: column; overflow: hidden;">
                            <div style="padding: 10px 14px; border-bottom: 1px solid #2d2d2d; font-weight: 500; font-size: 13px; color: #f0f6fc; display: flex; justify-content: space-between; align-items: center; background: #252526;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid fa-clock-rotate-left" style="color: #4fc1ff;"></i>
                                    <span>Recent Scripts</span>
                                </div>
                                <i class="fa-solid fa-xmark" id="sfarc-anon-history-close" style="cursor: pointer; color: #8b949e; font-size: 14px; padding: 4px; transition: color 0.2s;" ></i>
                            </div>
                            <div id="sfarc-anon-history-list" style="flex: 1; min-height: 0; overflow-y: auto; padding: 0; display: flex; flex-direction: column; background: #1e1e1e;"></div>
                        </div>
                        
                        <!-- VS Code-Style Colorful Code Writer -->
                        <div class="sfarc-vscode-editor-box" style="flex: 1; min-height: 220px; display: flex; flex-direction: column; border: 1px solid #2d2d2d; border-radius: 8px; background: #1e1e1e; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
                            <!-- Editor Window Header -->
                            <div style="background: #252526; border-bottom: 1px solid #2d2d2d; padding: 6px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; user-select: none;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #cccccc; font-weight: 500;">
                                    <i class="fa-solid fa-file-code" style="color: var(--sfarc-accent, var(--sfarc-accent, #2196f3)); font-size: 13px;"></i>
                                    <span>AnonymousScript.apex</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px; color: #858585;">
                                    <span style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.15); color: #4fc1ff; padding: 2px 6px; border-radius: 4px; font-weight: 500;">Apex</span>
                                    <span>UTF-8</span>
                                </div>
                            </div>

                            <!-- Dual-Layer Editor Workspace -->
                            <div style="flex: 1; display: flex; position: relative; overflow: hidden; background: #1e1e1e;">
                                <!-- Line Numbers Gutter -->
                                <div id="sfarc-anon-line-numbers" style="width: 44px; background: #161616; border-right: 1px solid #2d2d2d; color: #5a5a5a; padding: 12px 8px 12px 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.6; text-align: right; user-select: none; flex-shrink: 0; box-sizing: border-box; overflow: hidden;">1</div>
                                
                                <!-- Code Workspace with Scroll Sync -->
                                <div id="sfarc-anon-workspace" style="flex: 1; position: relative; min-width: 0; height: 100%; overflow: hidden;">
                                    <!-- Syntax Highlight Layer (Underneath) -->
                                    <pre id="sfarc-anon-highlight" style="margin: 0; padding: 12px 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.6; color: #d4d4d4; white-space: pre; pointer-events: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; word-wrap: normal; text-transform: none;"></pre>
                                    
                                    <!-- Interactive Transparent Input Textarea -->
                                    <textarea id="sfarc-anon-apex-editor" spellcheck="false" placeholder="// Write Anonymous Apex here...&#10;System.debug('Hello World!');" style="margin: 0; padding: 12px 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.6; border: none; background: transparent; color: transparent; caret-color: #569cd6; resize: none; outline: none; white-space: pre; position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box; overflow: auto; z-index: 2; word-wrap: normal;"></textarea>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Output Panel -->
                        <div id="sfarc-anon-output-panel" style="height: 140px; border: 1px solid #333; border-radius: 6px; background: #1e1e1e; color: #d4d4d4; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                            <div style="padding: 5px 10px; background: #252526; font-size: 11px; font-weight: 500; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; flex-wrap: wrap; gap: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span id="sfarc-anon-output-title" style="color: #4fc1ff;">Execution Result</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: #4fc1ff; font-size: 10.5px; font-weight: 500; user-select: none;" >
                                        <input type="checkbox" id="sfarc-anon-realtime-debug-chk" checked style="accent-color: var(--sfarc-accent, var(--sfarc-accent, #2196f3)); cursor: pointer;">
                                        <span>Real-Time System.debug</span>
                                    </label>
                                    <div id="sfarc-anon-tabs-bar" style="display: none; align-items: center; gap: 4px;">
                                        <button id="sfarc-anon-tab-debug" style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25); border: 1px solid var(--sfarc-accent, var(--sfarc-accent, #2196f3)); color: #4fc1ff; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-family: inherit;"><i class="fa-solid fa-terminal" style="margin-right: 3px;"></i>System.debug</button>
                                        <button id="sfarc-anon-tab-summary" style="background: transparent; border: 1px solid #444; color: #aaa; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-family: inherit;"><i class="fa-solid fa-list-check" style="margin-right: 3px;"></i>Summary</button>
                                        <button id="sfarc-anon-tab-raw" style="background: transparent; border: 1px solid #444; color: #aaa; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-family: inherit;"><i class="fa-solid fa-file-code" style="margin-right: 3px;"></i>Raw Log</button>
                                    </div>
                                    <i class="fa-solid fa-times" id="sfarc-anon-output-close" style="cursor: pointer; color: #aaa; font-size: 12px; margin-left: 2px;"></i>
                                </div>
                            </div>
                            <div id="sfarc-anon-output-content" style="flex: 1; min-height: 0; overflow-y: auto; padding: 6px 10px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 11.5px; white-space: pre-wrap; word-break: break-all;"></div>
                        </div>
                    </div>
                </div>

            <!-- Security & Access Container -->
            <div id="sfarc-security-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column; background: var(--sfarc-body-bg);">
                <div style="padding: 10px 16px; background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="min-width: 200px; flex-shrink: 1;">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 500; color: var(--sfarc-text); display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-shield-halved" style="font-size: 14px; color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));"></i>
                            Access & Security Analyzer
                        </h3>
                        <p style="font-size: 11px; color: var(--sfarc-secondary-text); margin: 2px 0 0 0;">Audit grant definitions and assignment coverage. Record sharing is reported separately.</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <select id="sfarc-sec-type" class="sfarc-input" style="width: 150px; height: 26px; font-size: 11.5px; border-radius: 8px !important; border: none !important; background: rgba(0,0,0,0.05); color: var(--sfarc-text); cursor: pointer; padding: 0 24px 0 8px; background-repeat: no-repeat; background-position: right 6px center; background-size: 10px;">
                            <option value="ApexClass">Apex Class</option>
                            <option value="ApexPage">Visualforce Page</option>
                            <option value="CustomField">Field (e.g. Account.Industry)</option>
                            <option value="CustomObject">Object (e.g. Account)</option>
                            <option value="CustomPermission">Custom Permission</option>
                            <option value="FlowDefinition">Flow</option>
                        </select>
                        <div style="width: 240px; position: relative;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--sfarc-secondary-text); font-size: 11px; pointer-events: none; z-index: 2;"></i>
                            <input type="text" id="sfarc-sec-name" class="sfarc-input" placeholder="Enter API Name..." style="width: 100%; padding-left: 26px !important; padding-right: 10px !important; border-radius: 8px !important; border: none !important; height: 26px !important; font-size: 11.5px !important; background-color: rgba(0,0,0,0.05) !important; background-image: none !important; box-sizing: border-box !important; outline: none !important; box-shadow: none !important;" autocomplete="off">
                            <div id="sfarc-sec-suggestions" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--sfarc-bg); border: 1px solid var(--sfarc-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; max-height: 250px; overflow-y: auto;"></div>
                        </div>
                        <button id="sfarc-sec-search" class="sfarc-button sfarc-button-primary" type="button" style="height: 26px; padding: 0 12px; border-radius: 7px; font-size: 11.5px;"><i class="fa-solid fa-magnifying-glass" style="margin-right: 5px;"></i>Search</button>
                    </div>
                </div>
                <div id="sfarc-sec-results" style="flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; overflow-y: auto; padding: 12px 16px;">
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--sfarc-secondary-text); text-align: center; padding: 40px 20px;">
                        <i class="fa-solid fa-shield-halved" style="font-size: 36px; opacity: 0.25; margin-bottom: 12px; color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));"></i>
                        <span style="font-size: 13px; font-weight: 500;">Enter an API name and click Search to inspect grant sources and assignments.</span>
                    </div>
                </div>
            </div>

            <!-- Bulk Updater Container -->
            <div id="sfarc-bulk-updater-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column; background: var(--sfarc-body-bg);">
                <div class="sfarc-bw-header">
                    <div class="sfarc-bw-title-wrap">
                        <h3 class="sfarc-bw-title"><i class="fa-solid fa-layer-group"></i> Bulk Permission Wizard</h3>
                        <p class="sfarc-bw-subtitle">Guided setup to grant bulk permissions.</p>
                    </div>
                    <div class="sfarc-bw-stepper">
                        <span id="sfarc-wiz-ind-1" class="sfarc-wiz-step active"><span class="sfarc-wiz-num">1</span><span class="sfarc-wiz-label">Target &amp; Objects</span></span>
                        <span id="sfarc-wiz-ind-2" class="sfarc-wiz-step upcoming"><span class="sfarc-wiz-num">2</span><span class="sfarc-wiz-label">Objects &amp; Record Types</span></span>
                        <span id="sfarc-wiz-ind-3" class="sfarc-wiz-step upcoming"><span class="sfarc-wiz-num">3</span><span class="sfarc-wiz-label">Fields &amp; Perms</span></span>
                        <span id="sfarc-wiz-ind-4" class="sfarc-wiz-step upcoming"><span class="sfarc-wiz-num">4</span><span class="sfarc-wiz-label">Verify &amp; Execute</span></span>
                    </div>
                </div>

                <div class="sfarc-bw-body">
                    <!-- STEP 1 -->
                    <div id="sfarc-bulk-step1" class="sfarc-bw-step-pane">
                        <div class="sfarc-bw-toolbar">
                            <select id="sfarc-bulk-target-type" class="sfarc-input sfarc-bw-target-type">
                                <option value="PermissionSet">Permission Set</option>
                                <option value="Profile">Profile</option>
                            </select>

                            <div class="sfarc-bw-search sfarc-bw-search-grow">
                                <i class="fa-solid fa-magnifying-glass sfarc-bw-search-icon"></i>
                                <input type="text" id="sfarc-bulk-target-name" class="sfarc-input" placeholder="Enter target Name (e.g. Sales_User_PS)..." autocomplete="off" spellcheck="false">
                                <div id="sfarc-bulk-target-suggestions" class="sfarc-bw-suggest"></div>
                            </div>

                            <div class="sfarc-bw-label">Select Objects</div>

                            <div class="sfarc-bw-search sfarc-bw-search-fixed">
                                <i class="fa-solid fa-magnifying-glass sfarc-bw-search-icon"></i>
                                <input type="text" id="sfarc-bulk-obj-search" class="sfarc-input" placeholder="Search objects..." autocomplete="off" spellcheck="false">
                            </div>
                        </div>

                        <div class="sfarc-bw-card">
                            <div class="sfarc-bw-card-head">
                                <label class="sfarc-bw-selectall"><input type="checkbox" id="sfarc-bulk-obj-selectall"> <strong>Select All</strong> <span id="sfarc-bulk-obj-count" class="sfarc-bw-count-badge"></span></label>
                            </div>
                            <div id="sfarc-bulk-obj-list" class="sfarc-bw-list">
                                <div class="sfarc-bw-empty">Loading objects...</div>
                            </div>
                        </div>

                        <div class="sfarc-bw-footer">
                            <button id="sfarc-bulk-next1-btn" class="sfarc-btn sfarc-btn-primary sfarc-bw-next">Next <i class="fa-solid fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 2 -->
                    <div id="sfarc-bulk-step2" class="sfarc-bw-step-pane" style="display: none;">
                        <div class="sfarc-bw-section-title">Select Object Permissions &amp; Record Types</div>
                        <div id="sfarc-bulk-obj-perms-list" class="sfarc-bw-card sfarc-bw-perms-card">
                            <div class="sfarc-bw-empty">Loading...</div>
                        </div>
                        <div class="sfarc-bw-footer sfarc-bw-footer-between">
                            <button id="sfarc-bulk-back1-btn" class="sfarc-btn sfarc-btn-secondary sfarc-bw-btn"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button id="sfarc-bulk-next1b-btn" class="sfarc-btn sfarc-btn-primary sfarc-bw-next">Next <i class="fa-solid fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 3: Fields -->
                    <div id="sfarc-bulk-step3" class="sfarc-bw-step-pane" style="display: none;">
                        <div class="sfarc-bw-toolbar sfarc-bw-toolbar-stretch">
                            <div class="sfarc-bw-section-title sfarc-bw-section-title-nowrap">Select Fields &amp; Permissions</div>
                            <div class="sfarc-bw-toolbar-right">
                                <div class="sfarc-bw-search sfarc-bw-search-fixed">
                                    <i class="fa-solid fa-magnifying-glass sfarc-bw-search-icon"></i>
                                    <input type="text" id="sfarc-bulk-fld-search" class="sfarc-input" placeholder="Search fields..." autocomplete="off" spellcheck="false">
                                </div>
                            </div>
                        </div>

                        <div class="sfarc-bw-card">
                            <div class="sfarc-bw-card-head sfarc-bw-card-head-wrap">
                                <label class="sfarc-bw-selectall"><input type="checkbox" id="sfarc-bulk-fld-selectall"> <strong>Select All Visible Fields</strong></label>
                                <div class="sfarc-bw-perm-actions">
                                    <span class="sfarc-bw-label">Action</span>
                                    <select id="sfarc-bulk-action-mode" class="sfarc-input sfarc-bw-action-mode">
                                        <option value="grant">Grant Access</option>
                                        <option value="revoke">Revoke Access</option>
                                    </select>
                                    <label class="sfarc-bw-chk"><input type="checkbox" id="sfarc-bulk-chk-Read" value="PermissionsRead" checked> Read</label>
                                    <label class="sfarc-bw-chk"><input type="checkbox" id="sfarc-bulk-chk-Edit" value="PermissionsEdit"> Edit</label>
                                </div>
                            </div>
                            <div id="sfarc-bulk-fld-list" class="sfarc-bw-list sfarc-bw-list-fields"></div>
                        </div>
                        <div class="sfarc-bw-footer sfarc-bw-footer-between">
                            <button id="sfarc-bulk-back2-btn" class="sfarc-btn sfarc-btn-secondary sfarc-bw-btn"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <button id="sfarc-bulk-next2-btn" class="sfarc-btn sfarc-btn-primary sfarc-bw-next">Next <i class="fa-solid fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 4: Verify -->
                    <div id="sfarc-bulk-step4" class="sfarc-bw-step-pane sfarc-bw-step-verify" style="display: none;">
                        <div class="sfarc-bw-verify">
                            <div class="sfarc-bw-verify-icon"><i class="fa-solid fa-clipboard-check"></i></div>
                            <h2 class="sfarc-bw-verify-title">Verify Execution</h2>
                            <p id="sfarc-bulk-summary-text" class="sfarc-bw-verify-sub">You are about to grant Read, Edit to 50 fields on Target.</p>
                        </div>

                        <div id="sfarc-bulk-progress-container" class="sfarc-bw-progress" style="display: none;">
                            <div class="sfarc-bw-progress-head"><span>Progress</span><span id="sfarc-bulk-progress-text">0%</span></div>
                            <div class="sfarc-bw-progress-track"><div id="sfarc-bulk-progress-bar" class="sfarc-bw-progress-fill"></div></div>
                        </div>

                        <div id="sfarc-bulk-results-list" class="sfarc-bw-results" style="display: none;"></div>

                        <div class="sfarc-bw-footer sfarc-bw-footer-between">
                            <button id="sfarc-bulk-back4-btn" class="sfarc-btn sfarc-btn-secondary sfarc-bw-btn"><i class="fa-solid fa-arrow-left"></i> Back</button>
                            <div class="sfarc-bw-actions">
                                <button id="sfarc-bulk-abort-btn" class="sfarc-btn sfarc-bw-abort" style="display: none;"><i class="fa-solid fa-stop"></i> Abort</button>
                                <button id="sfarc-bulk-rollback-btn" class="sfarc-btn sfarc-bw-rollback" style="display: none;"><i class="fa-solid fa-rotate-left"></i> Rollback</button>
                                <button id="sfarc-bulk-execute-btn" class="sfarc-btn sfarc-bw-execute"><i class="fa-solid fa-bolt"></i> Apply Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Metadata Tools Container -->
            <div id="sfarc-metadata-container" class="sfarc-tab-content-container" style="display: none; height: 100%; flex-direction: column;">
                    
                    <!-- View: Package.xml Generator -->
                    <div id="sfarc-meta-view-pkg" class="sfarc-metadata-panes" style="display: flex; margin-top: 5px;">
                        <!-- Left Pane: Metadata Types -->
                        <div class="sfarc-metadata-pane left-pane">
                            <div class="sfarc-metadata-pane-header">
                                <h3>Metadata Types</h3>
                                <div class="sfarc-metadata-actions" style="margin-left: auto; display: flex; align-items: center; gap: 4px;">
                                    <!-- Actions -->
                                    <button id="sfarc-meta-update-pkg" class="sfarc-icon-btn" >
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                    
                                    <span style="width:1px; height:16px; background:#444; margin:0 4px;"></span>

                                    <span id="sfarc-meta-clear-types" class="sfarc-metadata-action-btn" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </span>
                                </div>
                            </div>
                            <div class="sfarc-metadata-search">
                                <input type="text" id="sfarc-meta-type-search" placeholder="Filter Types..." class="sfarc-unique-metadata-input">
                            </div>
                            <div id="sfarc-meta-types-list" class="sfarc-metadata-list">
                                <div class="sfarc-loading">Loading types...</div>
                            </div>
                        </div>

                        <!-- Right Pane: Members -->
                        <div class="sfarc-metadata-pane right-pane">
                            <div class="sfarc-metadata-pane-header">
                                <h3 id="sfarc-meta-selected-type-name">Select Type</h3>
                                <div class="sfarc-metadata-actions">
                                    <span id="sfarc-meta-select-all-members" class="sfarc-metadata-action-btn" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline></svg>
                                    </span>
                                    <span id="sfarc-meta-clear-members" class="sfarc-metadata-action-btn" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </span>
                                </div>
                            </div>
                            <div class="sfarc-metadata-filter-bar" style="padding: 0 8px 5px; display: flex; gap: 5px; margin-top: 10px; margin-bottom: 5px;">
                                <select id="sfarc-meta-filter-user" class="sfarc-unique-metadata-input" style="flex:1;" >
                                    <option value="">All Users</option>
                                </select>
                                <input type="date" id="sfarc-meta-filter-date" class="sfarc-unique-metadata-input" style="flex:1;"  autocomplete="off" data-lpignore="true">
                            </div>
                            <div class="sfarc-metadata-search" style="padding-bottom: 5px; margin-bottom: 5px;">
                                <input type="text" id="sfarc-meta-member-search" placeholder="Filter Members..." class="sfarc-unique-metadata-input">
                            </div>
                            <div id="sfarc-meta-members-list" class="sfarc-metadata-list">
                                <div class="sfarc-empty-state-builder" style="padding:20px;text-align:center;color:#888;">Select a metadata type</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- XML Preview Modal -->
                <div id="sfarc-xml-modal" class="sfarc-xml-modal">
                    <div class="sfarc-metadata-pane-header">
                        <h3>Package.xml</h3>
                        <div class="sfarc-metadata-actions" style="display: flex; align-items: center; gap: 8px;">
                            <button id="sfarc-xml-copy-btn" class="sfarc-btn sfarc-btn-primary" style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span style="color: #ffffff;">Copy</span>
                            </button>
                            <button id="sfarc-xml-download-btn" class="sfarc-btn sfarc-btn-secondary" style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; border: 1px solid rgba(0,0,0,0.15); background: var(--sfarc-card-bg, #ffffff); color: var(--sfarc-text, #333333); cursor: pointer;" >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Download</span>
                            </button>
                            <span id="sfarc-xml-close-btn" class="sfarc-metadata-action-btn"  style="cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </span>
                        </div>
                    </div>
                    <pre class="sfarc-xml-content"><code id="sfarc-xml-code"></code></pre>
            </div>
            <!-- Debug Logs Container -->
            <div id="sfarc-debug-logs-view" style="display: none; height: 100%; overflow: hidden; flex-direction: column;">
                    <div class="sfarc-debug-section">
                        <div class="sfarc-debug-toolbar">
                            <div class="sfarc-debug-panel-title">
                                <span class="sfarc-debug-panel-icon">${getIconHtml('fa-bug')}</span>
                                <span class="sfarc-debug-panel-name">Active TraceFlags</span>
                                <span id="sfarc-trace-count-badge" class="sfarc-count-badge">0</span>
                                <!-- Timer Badge -->
                                <div id="sfarc-trace-timer-badge" class="sfarc-trace-timer-badge" style="display: none;">
                                    <span class="sfarc-timer-icon"></span>
                                    <span id="sfarc-trace-timer-text">--:--</span>
                                </div>
                            </div>
                            <div class="sfarc-debug-controls-right">
                                <select class="sfarc-debug-select" id="sfarc-trace-filter">
                                    <option value="active">Active TraceFlag</option>
                                    <option value="all">All TraceFlags</option>
                                </select>
                                <div class="sfarc-debug-btn-group">
                                    <button class="sfarc-dropdown-plus-btn" id="sfarc-new-trace" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                    <button class="sfarc-debug-icon-btn" id="sfarc-refresh-trace" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                    </button>
                                </div>
                                <button class="sfarc-debug-btn primary" id="sfarc-add-current-user">Add Current User</button>
                                <div class="sfarc-debug-btn-group sfarc-danger">
                                    <button class="sfarc-debug-icon-btn" id="sfarc-delete-selected-traces" >
                                        <i class="fa-regular fa-trash-can"></i>
                                    </button>
                                </div>
                                <button class="sfarc-debug-icon-btn" id="sfarc-minimize-trace" >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                            </div>
                        </div>
                        <div id="sfarc-trace-flags-container" class="sfarc-table-container sfarc-trace-maximized">
                            <table class="sfarc-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;"><input type="checkbox" id="sfarc-select-all-trace"></th>
                                        <th>User</th>
                                        <th>Requested By</th>
                                        <th>Start Date</th>
                                        <th>Expiration Date</th>
                                        <th>Remaining</th>
                                        <th>Debug Level</th>
                                    </tr>
                                </thead>
                                <tbody id="sfarc-trace-flags-body">
                                    <!-- Rows loaded dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="sfarc-debug-section sfarc-debug-section-logs">
                        <div class="sfarc-debug-section-header">
                            <div class="sfarc-debug-panel-title">
                                <span class="sfarc-debug-panel-icon"><i class="fa-regular fa-file-lines"></i></span>
                                <span class="sfarc-debug-panel-name">Debug Logs</span>
                                <span id="sfarc-log-count-badge" class="sfarc-count-badge">0</span>
                            </div>
                            <div class="sfarc-debug-controls-right">
                                <div class="sfarc-debug-search-wrapper" style="width: 220px;">
                                    <input type="text" id="sfarc-log-search" placeholder="Search inside logs..." class="sfarc-debug-search-input">
                                    <div class="sfarc-search-actions">
                                        <span id="sfarc-log-search-clear" class="sfarc-search-clear" style="display: none;" >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                        </span>
                                        <button id="sfarc-log-search-btn" class="sfarc-debug-search-btn" title="Search inside log bodies">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </button>
                                    </div>
                                </div>
                                <select id="sfarc-log-user-filter" class="sfarc-debug-select sfarc-meta-filter-user" style="max-width: 130px;">
                                    <option value="">All Users</option>
                                </select>
                                <div class="sfarc-debug-btn-group">
                                    <button class="sfarc-debug-icon-btn" id="sfarc-my-logs-btn" >
                                        <i class="fa-regular fa-user"></i>
                                    </button>
                                    <button class="sfarc-debug-icon-btn" id="sfarc-import-log" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    </button>
                                    <button class="sfarc-debug-icon-btn" id="sfarc-refresh-logs" >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                    </button>
                                    <button class="sfarc-debug-icon-btn" id="sfarc-open-full-logs" title="Open in Full Tab">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </button>
                                </div>
                                <div class="sfarc-debug-btn-group sfarc-danger">
                                    <button class="sfarc-debug-icon-btn" id="sfarc-delete-all-logs" title="Delete All Logs">
                                        <i class="fa-regular fa-trash-can"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="sfarc-table-container sfarc-logs-container">
                            <table class="sfarc-table sfarc-log-table">
                                <thead>
                                    <tr>
                                        <th style="width: 36px; min-width: 36px;"><input type="checkbox" id="sfarc-select-all-logs" ></th>
                                        <th style="width: 115px; min-width: 115px;">Action</th>
                                        <th style="width: 130px; min-width: 110px;" data-sort-key="User" >User <span class="sfarc-log-sort">▲</span></th>
                                        <th style="width: 110px; min-width: 90px;" data-sort-key="Operation" >Operation <span class="sfarc-log-sort">▲</span></th>
                                        <th style="min-width: 180px;" data-sort-key="Status" >Status <span class="sfarc-log-sort">▲</span></th>
                                        <th style="width: 85px; min-width: 75px;" data-sort-key="Duration" >Duration <span class="sfarc-log-sort">▲</span></th>
                                        <th style="width: 80px; min-width: 70px; text-align: right;" data-sort-key="Size" >Size <span class="sfarc-log-sort">▲</span></th>
                                        <th style="width: 165px; min-width: 150px;" data-sort-key="StartTime" >Start Time <span class="sfarc-log-sort">▲</span></th>
                                    </tr>
                                </thead>
                                <tbody id="sfarc-debug-logs-body">
                                    <!-- Rows loaded dynamically -->
                                </tbody>
                            </table>
                        </div>
                        <div class="sfarc-pagination-container" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; margin-top: auto;">
                            <div class="sfarc-rows-per-page">
                                <select id="sfarc-log-rows" class="sfarc-debug-select sfarc-meta-filter-user">
                                    <option value="15">15</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                            <div class="sfarc-pagination-controls" style="display: flex; align-items: center; gap: 8px;">
                                <div class="sfarc-debug-btn-group">
                                    <button class="sfarc-debug-icon-btn" id="sfarc-log-prev" disabled>
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1L3 5L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </button>
                                </div>
                                <span id="sfarc-log-page-info" class="sfarc-log-page-info-text" style="font-size: 12px;">Page 1 of 1</span>
                                <div class="sfarc-debug-btn-group">
                                    <button class="sfarc-debug-icon-btn" id="sfarc-log-next" disabled>
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1L7 5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- New Trace Flag Modal -->
                <div id="sfarc-trace-modal" class="sfarc-modal sfarc-drawer-modal" style="display: none;">
                    <div class="sfarc-modal-content sfarc-modal-large">
                        <div class="sfarc-modal-header">
                            <h3 id="sfarc-trace-modal-title">New Trace Flag</h3>
                            <div class="sfarc-modal-header-actions">
                                <button class="sfarc-btn-primary" id="sfarc-create-trace-btn" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 5px 13px; border-radius: 8px; font-size: 12px; font-weight: 500;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0;">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                        <polyline points="7 3 7 8 15 8"></polyline>
                                    </svg>
                                    <span id="sfarc-create-trace-text">Save Trace</span>
                                </button>
                                <button class="sfarc-modal-close" style="display: inline-flex; align-items: center; justify-content: center;">&times;</button>
                            </div>
                        </div>
                        <div class="sfarc-modal-body">
                            <div class="sfarc-form-group">
                                <label>Select User</label>
                                <div class="sfarc-search-input-wrapper">
                                    <input type="text" id="sfarc-trace-user-search" placeholder="Type User Name...">
                                    <div id="sfarc-user-results" class="sfarc-dropdown-results"></div>
                                </div>
                            </div>
                            <div class="sfarc-form-row">
                                <div class="sfarc-form-group">
                                    <label>Start Date</label>
                                    <input type="datetime-local" id="sfarc-trace-start">
                                </div>
                                <div class="sfarc-form-group">
                                    <label>Expiration Hours</label>
                                    <select id="sfarc-trace-expiration">
                                        <option value="15">15 Minutes</option>
                                        <option value="30">30 Minutes</option>
                                        <option value="60" selected>1 hour</option>
                                        <option value="120">2 hours</option>
                                        <option value="240">4 hours</option>
                                        <option value="600">10 hours</option>
                                        <option value="720">12 hours</option>
                                        <option value="1440">24 hours</option>
                                    </select>
                                </div>
                            </div>
                            <div class="sfarc-form-group">
                                <label>Select Debug Level</label>
                                <select id="sfarc-trace-level" style="width: 100%;">
                                    <option value="">-- Select Debug Level --</option>
                                </select>
                            </div>
                        </div>
                        <div class="sfarc-modal-footer" style="display: flex; justify-content: flex-start; align-items: center;">
                            <button class="sfarc-btn-secondary" id="sfarc-new-level-btn" style="display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-plus"></i> New Level
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Create Log Level Modal -->
                <div id="sfarc-level-modal" class="sfarc-modal sfarc-drawer-modal" style="display: none;">
                    <div class="sfarc-modal-content sfarc-modal-large">
                        <div class="sfarc-modal-header">
                            <h3>Create Log Level</h3>
                            <div class="sfarc-modal-header-actions">
                                <button class="sfarc-btn-primary" id="sfarc-save-level-btn" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 5px 13px; border-radius: 8px; font-size: 12px; font-weight: 500;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                        <polyline points="7 3 7 8 15 8"></polyline>
                                    </svg>
                                    Save Log Level
                                </button>
                                <button class="sfarc-modal-close">&times;</button>
                            </div>
                        </div>
                        <div class="sfarc-modal-body">
                            <div class="sfarc-form-group">
                                <label class="required">Name</label>
                                <input type="text" id="sfarc-level-name">
                            </div>
                            <table class="sfarc-level-table">
                                <thead>
                                    <tr>
                                        <th style="text-align: left;">Category</th>
                                        <th style="text-align: center;">NONE</th>
                                        <th style="text-align: center;">ERROR</th>
                                        <th style="text-align: center;">WARN</th>
                                        <th style="text-align: center;">INFO</th>
                                        <th style="text-align: center;">DEBUG</th>
                                        <th style="text-align: center;">FINE</th>
                                        <th style="text-align: center;">FINER</th>
                                        <th style="text-align: center;">FINEST</th>
                                    </tr>
                                </thead>
                                <tbody id="sfarc-level-rows">
                                    <!-- Rows for Database, Workflow, etc. -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Recent -->
                <div class="sfarc-section" id="sfarc-recent-section" style="display:none;">
                    <h3 class="sfarc-section-title">Recent</h3>
                    <div class="sfarc-recent" id="sfarc-recent">
                        <!-- Recent items loaded dynamically -->
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="sfarc-footer">
                <div class="sfarc-footer-item" id="sfarc-footer-org-item" style="position: relative; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                     ${getIconHtml('fa-database')}
                     <span id="sfarc-footer-instance">Unknown</span>
                     <!-- Org Details Hover Quick Card -->
                     <div id="sfarc-org-hover-card">
                         <div id="sfarc-org-hover-grid">
                             <span class="label">Org Id</span><span class="val" id="sfarc-hover-orgid">-</span>
                             <span class="label">Instance</span><span class="val" id="sfarc-hover-instance">-</span>
                             <span class="label">Type</span><span class="val" id="sfarc-hover-type">-</span>
                             <span class="label">Status</span><span class="val" id="sfarc-hover-status" style="color: #16a34a; font-weight: 500;">OK</span>
                             <span class="label">Release</span><span class="val" id="sfarc-hover-release">-</span>
                             <span class="label">Location</span><span class="val" id="sfarc-hover-location">-</span>
                             <span class="label">API vers.</span><span class="val" id="sfarc-hover-apivers">-</span>
                             <span class="label maint-link">Maint.</span><span class="val" id="sfarc-hover-maint">-</span>
                             <span class="label">Org URL</span><span class="val" id="sfarc-hover-url" style="word-break: break-all; white-space: normal;">-</span>
                         </div>
                     </div>
                </div>
                <div class="sfarc-footer-actions" style="margin-left: auto; display: flex; align-items: center; gap: 4px;">
                    <!-- Hide Icons Toggle (moved from header) -->
                    <button class="sfarc-footer-icon-btn" id="sfarc-header-icons-toggle" style="display: inline-flex; align-items: center; gap: 5px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 11px; font-weight: 500; transition: color 0.2s; padding: 3px 6px; border-radius: 6px; line-height: 1;">
                        <span class="sfarc-header-btn-label" style="font-size: 11px;">Hide Icons</span>
                        <div class="sfarc-apple-switch" style="position: relative; width: 28px; height: 16px; background-color: #e9e9ea; border-radius: 8px; transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; pointer-events: none; flex-shrink: 0;">
                            <div class="sfarc-apple-switch-handle" style="position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background-color: #ffffff; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.15); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                        </div>
                    </button>

                    <div style="width: 1px; height: 14px; background: rgba(128,128,128,0.3); margin: 0 2px;"></div>

                    <!-- Support Link -->
                    <a class="sfarc-footer-icon-btn sfarc-footer-link" id="sfarc-buy-me-a-coffee-link" href="https://buymeacoffee.com/ytsalesforu?new=1" target="_blank" rel="noopener noreferrer" title="Support Salesforce Comet on Buy Me a Coffee" aria-label="Buy me a coffee" style="display: flex; align-items: center; gap: 4px; background: transparent; color: var(--sfarc-secondary-text); font-size: 11px; transition: all 0.2s; padding: 2px 6px; border-radius: 4px; text-decoration: none;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Z"></path>
                            <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"></path>
                            <path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"></path>
                            <path d="M4 21h14"></path>
                        </svg>
                        <span>Buy me a coffee</span>
                    </a>

                    <div style="width: 1px; height: 14px; background: rgba(128,128,128,0.3); margin: 0 2px;"></div>

                    <!-- Report Bugs Icon Button -->
                    <button class="sfarc-footer-icon-btn" id="sfarc-report-bugs-btn" style="display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 11px; transition: all 0.2s; padding: 2px 6px; border-radius: 4px;">
                        <span id="sfarc-report-bugs-icon" style="display: flex; align-items: center;">${getIconHtml('fa-comment')}</span>
                        <span>Report Bugs</span>
                    </button>

                    <!-- Settings Icon Button -->
                    <button class="sfarc-footer-icon-btn" id="sfarc-settings-btn" style="display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 11px; transition: all 0.2s; padding: 2px 6px; border-radius: 4px;">
                        ${getIconHtml('fa-gear')}
                        <span>Settings</span>
                    </button>
                </div>
            </div>
        </div>
    `;


    document.body.appendChild(panel);

    // Ensure the shared custom-dropdown enhancer processes this panel's selects
    // (rows-per-page, trace filter, user filter). The global observer can miss
    // a large innerHTML batch, leaving native selects whose popups don't open
    // inside the overflow/backdrop-filter panel context.
    if (typeof window.sfarcEnhanceAllSelects === 'function') {
        try {
            window.sfarcEnhanceAllSelects();
        } catch (e) {
            console.warn('Custom dropdown enhancement failed:', e);
        }
    }

    // Apply settings and panel settings now that the panel exists
    applySettings();
    applyPanelSettings();

    // Scroll-to-hide: hide search bar on scroll down, show on scroll up
    (function() {
        var homeView = document.getElementById('sfarc-home-view');
        var searchContainer = document.getElementById('sfarc-global-search-container');
        if (!homeView || !searchContainer) return;
        var lastScrollTop = 0;
        var ticking = false;
        searchContainer.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        homeView.addEventListener('scroll', function() {
            if (!ticking) {
                requestAnimationFrame(function() {
                    var st = homeView.scrollTop;
                    if (st > lastScrollTop && st > 10) {
                        // Scrolling down — hide search
                        searchContainer.style.transform = 'translateY(-100%)';
                        searchContainer.style.opacity = '0';
                        searchContainer.style.pointerEvents = 'none';
                    } else {
                        // Scrolling up — show search
                        searchContainer.style.transform = 'translateY(0)';
                        searchContainer.style.opacity = '1';
                        searchContainer.style.pointerEvents = 'auto';
                    }
                    lastScrollTop = st <= 0 ? 0 : st;
                    ticking = false;
                });
                ticking = true;
            }
        });
    })();

    // Event Listeners
    if (document.getElementById('sfarc-close-panel')) {
        document.getElementById('sfarc-close-panel').addEventListener('click', () => {
            document.getElementById('sfarc-panel').classList.add('sfarc-hidden');
            // Also hide any floating icon active state if we had one
        });
    }

    var settingsBtn = document.getElementById('sfarc-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }

    // Keep-alive: periodically verify panel responsiveness and re-bind critical handlers
    // This fixes the issue where popup clicks stop working after prolonged idle periods
    let sfarcPanelKeepAlive = setInterval(() => {
        var panel = document.getElementById('sfarc-panel');
        if (!panel) return;
        // Verify togglePanel is still accessible
        if (typeof window.togglePanel !== 'function') {
            window.togglePanel = togglePanel;
        }
        // Verify critical buttons still have handlers by checking a data attribute
        var closeBtn = document.getElementById('sfarc-panel-close-btn');
        if (closeBtn && !closeBtn.dataset.sfarcBound) {
            closeBtn.addEventListener('click', togglePanel);
            closeBtn.dataset.sfarcBound = 'true';
        }
        var reportBtn = document.getElementById('sfarc-report-bugs-btn');
        if (reportBtn && !reportBtn.dataset.sfarcBound) {
            reportBtn.addEventListener('click', () => {
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSc4V3_SP9XdosnLhEq7064nFe1UwgpOhdlYcqu9zvxy63gicg/viewform?usp=publish-editor', '_blank');
            });
            reportBtn.dataset.sfarcBound = 'true';
        }
        var settingsBtnInner = document.getElementById('sfarc-settings-btn');
        if (settingsBtnInner && !settingsBtnInner.dataset.sfarcBound) {
            settingsBtnInner.addEventListener('click', openSettings);
            settingsBtnInner.dataset.sfarcBound = 'true';
        }
    }, 30000); // Check every 30 seconds

    var headerIconsToggleBtn = document.getElementById('sfarc-header-icons-toggle');
    if (headerIconsToggleBtn) {
        headerIconsToggleBtn.addEventListener('click', () => {
            var headerIcons = getHeaderIconSettings();
            var anyVisible = headerIcons.sessionCopy || headerIcons.fieldApi || headerIcons.lwcViewer || headerIcons.flowViewer || headerIcons.showAllData;
            var newValue = !anyVisible;

            settings.headerIcons = {
                sessionCopy: newValue,
                fieldApi: newValue,
                lwcViewer: newValue,
                flowViewer: newValue,
                showAllData: newValue
            };

            saveSettings();
        });
    }

    // Minimize Trace Logic - Main Panel
    var traceContainer = document.getElementById('sfarc-trace-flags-container');
    var minimizeBtn = document.getElementById('sfarc-minimize-trace');
    if (traceContainer && minimizeBtn) {
        var isMinimized = localStorage.getItem('sfiTraceSectionMinimized') === 'true';
        if (isMinimized) {
            traceContainer.classList.add('sfarc-minimized');
            minimizeBtn.classList.add('sfarc-rotate-180');
        }

        minimizeBtn.addEventListener('click', () => {
            var minimized = traceContainer.classList.toggle('sfarc-minimized');
            minimizeBtn.classList.toggle('sfarc-rotate-180', minimized);
            localStorage.setItem('sfiTraceSectionMinimized', minimized);
        });
    }



    // ... (rest of listeners)
    // Close button
    var closeBtn = document.getElementById('sfarc-panel-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', togglePanel);
    }

    var reportBugsBtn = document.getElementById('sfarc-report-bugs-btn');
    if (reportBugsBtn) {
        reportBugsBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSc4V3_SP9XdosnLhEq7064nFe1UwgpOhdlYcqu9zvxy63gicg/viewform?usp=publish-editor', '_blank');
        });

        // Alternating text: Report Bug <-> Suggest Feature
        var bugText = document.getElementById('sfarc-report-bugs-text');
        var bugIcon = document.getElementById('sfarc-report-bugs-icon');
        if (bugText && bugIcon) {
            bugText.style.transition = 'opacity 0.3s ease';
            bugIcon.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            var isBug = true;
            setInterval(() => {
                bugText.style.opacity = '0';
                bugIcon.style.opacity = '0';
                bugIcon.style.transform = 'scale(0.8)';

                setTimeout(() => {
                    isBug = !isBug;
                    bugText.textContent = isBug ? 'Report Bug' : 'Suggest Feature';
                    bugIcon.innerHTML = isBug ? getIconHtml('fa-comment') : getIconHtml('fa-lightbulb');

                    bugText.style.opacity = '1';
                    bugIcon.style.opacity = '1';
                    bugIcon.style.transform = 'scale(1)';
                }, 300); // 300ms matches the CSS transition duration
            }, 4000); // Switch every 4 seconds
        }
    }

    // Close panel when clicking outside
    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            togglePanel();
        }

        // --- Event Delegation for Dynamic Actions ---

        // View Flow Details
        var flowBtn = e.target.closest('.sfarc-view-flow-details');
        if (flowBtn) {
            e.preventDefault();
            var id = flowBtn.dataset.id;
            if (window.viewFlowDetails) window.viewFlowDetails(id);
        }

        // View Apex Code
        var apexBtn = e.target.closest('.sfarc-view-apex-code');
        if (apexBtn) {
            e.preventDefault();
            var id = apexBtn.dataset.id;
            var type = apexBtn.dataset.type;
            if (window.viewApexCode) window.viewApexCode(id, type);
        }

        // Copy Apex Code
        var copyBtn = e.target.closest('.sfarc-copy-apex-code');
        if (copyBtn) {
            e.preventDefault();
            if (window.copyApexCode) window.copyApexCode();
        }

        // Suggestion Item Toggle
        var suggestionItem = e.target.closest('.sfarc-suggestion-item-toggle');
        if (suggestionItem && !e.target.closest('.sfarc-open-link')) {
            suggestionItem.classList.toggle('expanded');
        }
    });

    // Initialize Global Command Search
    if (typeof setupGlobalSearch === 'function') {
        setupGlobalSearch();
    }

    if (typeof setupOrgHoverCard === 'function') {
        setupOrgHoverCard();
    }

    if (typeof setupSmartFilters === 'function') {
        setupSmartFilters();
    }

    // Update context on initial load
    setTimeout(updateRecordContext, 500);

    // Monitor URL changes for SPA navigation
    var lastUrl = window.location.href;
    if (urlCheckInterval) clearInterval(urlCheckInterval);
    // Monitor URL changes for SPA navigation using Navigation API if available
    if (window.navigation) {
        window.navigation.addEventListener('navigate', (event) => {
            setTimeout(updateRecordContext, 100);
        });
    } else {
        // Fallback for older browsers
        window.addEventListener('popstate', updateRecordContext);

        // BUG 11 FIX: Guard history patches to avoid double-wrapping
        if (!history.__sfarc_patched__) {
            history.__sfarc_patched__ = true;
            var originalPushState = history.pushState;
            history.pushState = function () {
                originalPushState.apply(this, arguments);
                updateRecordContext();
            };
            var originalReplaceState = history.replaceState;
            history.replaceState = function () {
                originalReplaceState.apply(this, arguments);
                updateRecordContext();
            };
        }
    }

    // Debug Logs tab click handled by generic tab listener

    // Theme toggle
    document.getElementById('sfarc-theme-toggle').addEventListener('click', toggleTheme);

    // Search functionality handled by global search
    // (sfarc-search removed)

    // New Feature Listeners
    var apiNamesBtn = document.getElementById('sfarc-show-api-names');
    if (apiNamesBtn) apiNamesBtn.addEventListener('click', toggleApiNames);

    var lwcBtn = document.getElementById('sfarc-expose-lwc');
    if (lwcBtn) lwcBtn.addEventListener('click', toggleLwcNames);

    // Top Bar Import/Export Listeners
    var importTopBtn = document.getElementById('sfarc-data-import');
    if (importTopBtn) {
        importTopBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'data-import' });
        });
    }

    var exportTopBtn = document.getElementById('sfarc-data-export');
    if (exportTopBtn) {
        exportTopBtn.addEventListener('click', () => {
            var smartQuery = buildSmartQuery();
            var params = smartQuery ? { query: smartQuery } : {};
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'data-export', params });
        });
    }

    var codeEditorTopBtn = document.getElementById('sfarc-code-editor');
    if (codeEditorTopBtn) {
        codeEditorTopBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'code-editor' });
        });
    }

    var metadataTopBtn = document.getElementById('sfarc-metadata');
    if (metadataTopBtn) {
        metadataTopBtn.addEventListener('click', () => {
            var smartQuery = buildSmartQuery();
            var params = smartQuery ? { query: smartQuery } : {};
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'metadata', params });
        });
    }

    var restConsoleTopBtn = document.getElementById('sfarc-rest-console');
    if (restConsoleTopBtn) {
        restConsoleTopBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'rest-explorer' });
        });
    }

    // Initial load: show the global search command list
    if (window.clearGlobalSearchContext) {
        window.clearGlobalSearchContext();
    }

    // Initialize Creation Menu
    initCreationMenu();
}

window.sfarcShortcuts = [
    // Setup Home
    { label: 'Setup Home', url: '/lightning/setup/SetupOneHome/home', category: 'Setup Home' },
    { label: 'Salesforce Go', url: '/lightning/setup/SalesforceGo/home', category: 'Setup Home' },
    { label: 'Lightning Usage', url: '/lightning/setup/LightningUsageApp/home', category: 'Setup Home' },
    { label: 'Optimizer', url: '/lightning/setup/SalesforceOptimizer/home', category: 'Setup Home' },

    // Administration - Users
    { label: 'Users', url: '/lightning/setup/ManageUsers/home', category: 'Administration', liveQuery: "SELECT Id, Name, Email, Profile.Name, UserRole.Name, Profile.UserLicense.Name, IsActive, Username FROM User ORDER BY LastLoginDate DESC LIMIT 100" },
    { label: 'Permission Set Groups', url: '/lightning/setup/PermSetGroups/home', category: 'Administration', liveQuery: "SELECT Id, DeveloperName, MasterLabel, Status FROM PermissionSetGroup ORDER BY MasterLabel" },
    { label: 'Permission Sets', url: '/lightning/setup/PermSets/home', category: 'Administration', liveQuery: "SELECT Id, Name, Label, IsOwnedByProfile FROM PermissionSet WHERE IsOwnedByProfile=false ORDER BY Label" },
    { label: 'Profiles', url: '/lightning/setup/EnhancedProfiles/home', category: 'Administration', liveQuery: "SELECT Id, Name, UserType FROM Profile ORDER BY Name" },
    { label: 'Public Groups', url: '/lightning/setup/PublicGroups/home', category: 'Administration', liveQuery: "SELECT Id, Name, DeveloperName FROM Group WHERE Type='Regular' ORDER BY Name" },
    { label: 'Queues', url: '/lightning/setup/Queues/home', category: 'Administration', liveQuery: "SELECT Id, Name, DeveloperName FROM Group WHERE Type='Queue' ORDER BY Name" },
    { label: 'Roles', url: '/lightning/setup/Roles/home', category: 'Administration', liveQuery: "SELECT Id, Name, DeveloperName FROM UserRole ORDER BY Name" },
    { label: 'User Management Settings', url: '/lightning/setup/UserManagementSettings/home', category: 'Administration' },

    // Data
    { label: 'Data Export', url: '/lightning/setup/DataManagementExport/home', category: 'Data' },
    { label: 'Data Import Wizard', url: '/lightning/setup/DataManagementDataImporter/home', category: 'Data' },
    { label: 'Data Loader', url: '/lightning/setup/DataManagementDataLoader/home', category: 'Data' },
    { label: 'Duplicate Management', url: '/lightning/setup/DuplicateManagement/home', category: 'Data' },
    { label: 'Duplicate Rules', url: '/lightning/setup/DuplicateRules/home', category: 'Data' },
    { label: 'Matching Rules', url: '/lightning/setup/MatchingRules/home', category: 'Data' },
    { label: 'Mass Delete Records', url: '/lightning/setup/DataManagementMassDelete/home', category: 'Data' },
    { label: 'Mass Transfer Records', url: '/lightning/setup/DataManagementMassTransfer/home', category: 'Data' },
    { label: 'State and Country Picklists', url: '/lightning/setup/AddressCleanerOverview/home', category: 'Data' },
    { label: 'Storage Usage', url: '/lightning/setup/CompanyResourceDisk/home', category: 'Data' },
    { label: 'Big Objects', url: '/lightning/setup/BigObjects/home', category: 'Data' },

    // Email
    { label: 'Deliverability', url: '/lightning/setup/OrgEmailSettings/home', category: 'Email' },
    { label: 'Email Administration', url: '/lightning/setup/EmailAdministration/home', category: 'Email' },
    { label: 'Classic Email Templates', url: '/lightning/setup/CommunicationTemplatesEmail/home', category: 'Email', liveQuery: "SELECT Id, Name, FolderId, IsActive FROM EmailTemplate ORDER BY Name" },
    { label: 'Lightning Email Templates', url: '/lightning/o/EmailTemplate/home', category: 'Email' },
    { label: 'Classic Letterheads', url: '/lightning/setup/CommunicationTemplatesLetterheads/home', category: 'Email' },
    { label: 'Organization-Wide Addresses', url: '/lightning/setup/OrgWideEmailAddresses/home', category: 'Email', liveQuery: "SELECT Id, Address, DisplayName FROM OrgWideEmailAddress" },
    { label: 'DKIM Keys', url: '/lightning/setup/DkimKeys/home', category: 'Email' },
    { label: 'Email to Salesforce', url: '/lightning/setup/EmailToSalesforceOverview/home', category: 'Email' },
    { label: 'Enhanced Email', url: '/lightning/setup/EnhancedEmail/home', category: 'Email' },
    { label: 'Gmail Integration', url: '/lightning/setup/GmailIntegrationAndSync/home', category: 'Email' },
    { label: 'Outlook Integration', url: '/lightning/setup/ExchangeIntegrationAndSync/home', category: 'Email' },

    // Objects and Fields
    { label: 'Object Manager', url: '/lightning/setup/ObjectManager/home', category: 'Objects' },
    { label: 'Picklist Value Sets', url: '/lightning/setup/Picklists/home', category: 'Objects' },
    { label: 'Schema Builder', url: '/lightning/setup/SchemaBuilder/home', category: 'Objects' },

    // Events
    { label: 'Event Manager', url: '/lightning/setup/EventManager/home', category: 'Events' },
    { label: 'Platform Events', url: '/lightning/setup/EventObjects/home', category: 'Events' },

    // Process Automation
    { label: 'Flows', url: '/lightning/setup/Flows/home', category: 'Automation', liveQuery: "SELECT Id, DurableId, Label, TriggerType, ActiveVersionId FROM FlowDefinitionView ORDER BY Label" },
    { label: 'Process Builder', url: '/lightning/setup/ProcessAutomation/home', category: 'Automation', liveQuery: "SELECT Id, DurableId, Label, TriggerType, ActiveVersionId FROM FlowDefinitionView WHERE ProcessType = 'Workflow' ORDER BY Label" },
    { label: 'Workflow Rules', url: '/lightning/setup/WorkflowRules/home', category: 'Automation', liveQuery: "SELECT Id, Name, TableEnumOrId FROM WorkflowRule ORDER BY Name", useToolingApi: true },
    { label: 'Approval Processes', url: '/lightning/setup/ApprovalProcesses/home', category: 'Automation', liveQuery: "SELECT Id, Name, DeveloperName, TableEnumOrId, State FROM ProcessDefinition WHERE Type='Approval' ORDER BY Name" },
    { label: 'Workflow Actions', url: '/lightning/setup/WorkflowActions/home', category: 'Automation', liveQuery: "SELECT Id, Name, SourceTableEnumOrId FROM WorkflowFieldUpdate ORDER BY Name", useToolingApi: true },
    { label: 'Email Alerts', url: '/lightning/setup/WorkflowEmails/home', category: 'Automation', liveQuery: "SELECT Id, DeveloperName, TemplateId, EntityDefinitionId FROM WorkflowAlert ORDER BY DeveloperName", useToolingApi: true },
    { label: 'Next Best Action', url: '/lightning/setup/NextBestAction/home', category: 'Automation' },
    { label: 'Paused Flow Interviews', url: '/lightning/setup/PausedFlowInterviews/home', category: 'Automation' },

    // Inspector Tools
    { label: 'Data Export (Inspector)', url: 'sfi:data-export', category: 'Inspector Tools', isShortcut: true },
    { label: 'Download Metadata (Inspector)', url: 'sfi:metadata', category: 'Inspector Tools', isShortcut: true },

    // User Interface
    { label: 'App Menu', url: '/lightning/setup/AppMenu/home', category: 'User Interface' },
    { label: 'Custom Labels', url: '/lightning/setup/ExternalStrings/home', category: 'User Interface' },
    { label: 'Tabs', url: '/lightning/setup/CustomTabs/home', category: 'User Interface' },
    { label: 'Lightning App Builder', url: '/lightning/setup/FlexiPageList/home', category: 'User Interface' },
    { label: 'Global Actions', url: '/lightning/setup/GlobalActions/home', category: 'User Interface' },
    { label: 'Path Settings', url: '/lightning/setup/PathAssistantSetupHome/home', category: 'User Interface' },
    { label: 'Quick Text', url: '/lightning/setup/QuickTextSettings/home', category: 'User Interface' },
    { label: 'Rename Tabs and Labels', url: '/lightning/setup/RenameTab/home', category: 'User Interface' },
    { label: 'Themes and Branding', url: '/lightning/setup/ThemingAndBranding/home', category: 'User Interface' },
    { label: 'Density Settings', url: '/lightning/setup/DensitySetup/home', category: 'User Interface' },

    // Sites and Domains
    { label: 'My Domain', url: '/lightning/setup/OrgDomain/home', category: 'Sites & Domains' },
    { label: 'Domains', url: '/lightning/setup/DomainSites/home', category: 'Sites & Domains', liveQuery: "SELECT Id, Domain, DomainType FROM Domain" },
    { label: 'Sites', url: '/lightning/setup/CustomDomain/home', category: 'Sites & Domains' },

    // Translation Workbench
    { label: 'Translation Workbench', url: '/lightning/setup/LabelWorkbench/home', category: 'Translation' },
    { label: 'Translation Settings', url: '/lightning/setup/LanguageSettings/home', category: 'Translation' },

    // Custom Code
    { label: 'Apex Classes', url: '/lightning/setup/ApexClasses/home', category: 'Custom Code', liveQuery: "SELECT Id, Name, ApiVersion, Status, LastModifiedDate FROM ApexClass ORDER BY Name" },
    { label: 'Apex Triggers', url: '/lightning/setup/ApexTriggers/home', category: 'Custom Code', liveQuery: "SELECT Id, Name, TableEnumOrId, Status FROM ApexTrigger ORDER BY Name" },
    { label: 'Apex Settings', url: '/lightning/setup/ApexSettings/home', category: 'Custom Code' },
    { label: 'Visualforce Pages', url: '/lightning/setup/ApexPages/home', category: 'Custom Code', liveQuery: "SELECT Id, Name, MasterLabel FROM ApexPage ORDER BY Name" },
    { label: 'Visualforce Components', url: '/lightning/setup/ApexComponents/home', category: 'Custom Code', liveQuery: "SELECT Id, Name, MasterLabel FROM ApexComponent ORDER BY Name" },
    { label: 'Lightning Components', url: '/lightning/setup/LightningComponentBundles/home', category: 'Custom Code' },
    { label: 'Static Resources', url: '/lightning/setup/StaticResources/home', category: 'Custom Code', liveQuery: "SELECT Id, Name, ContentType, BodyLength FROM StaticResource ORDER BY Name" },
    { label: 'Custom Metadata Types', url: '/lightning/setup/CustomMetadata/home', category: 'Custom Code', liveQuery: "SELECT Id, DeveloperName, MasterLabel, NamespacePrefix FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt' ORDER BY MasterLabel" },
    { label: 'Custom Settings', url: '/lightning/setup/CustomSettings/home', category: 'Custom Code', liveQuery: "SELECT Id, DeveloperName, MasterLabel, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = true ORDER BY MasterLabel" },
    { label: 'Custom Permissions', url: '/lightning/setup/CustomPermissions/home', category: 'Custom Code', liveQuery: "SELECT Id, DeveloperName, MasterLabel FROM CustomPermission ORDER BY MasterLabel" },
    { label: 'Email Services', url: '/lightning/setup/EmailToApexFunction/home', category: 'Custom Code' },
    { label: 'Platform Cache', url: '/lightning/setup/PlatformCache/home', category: 'Custom Code' },

    // Development
    { label: 'Dev Hub', url: '/lightning/setup/DevHub/home', category: 'Development' },
    { label: 'DevOps Center', url: '/lightning/setup/DevOpsCenter/home', category: 'Development' },
    { label: 'Scratch Orgs', url: '/lightning/setup/ActiveScratchOrgs/home', category: 'Development' },

    // Environments - Deploy
    { label: 'Deployment Status', url: '/lightning/setup/DeployStatus/home', category: 'Deploy' },
    { label: 'Deployment Settings', url: '/lightning/setup/DeploymentSettings/home', category: 'Deploy' },
    { label: 'Sandboxes', url: '/lightning/setup/DataManagementCreateTestInstance/home', category: 'Deploy', liveQuery: "SELECT Id, SandboxName, LicenseType, AutoActivate FROM SandboxInfo" },
    { label: 'Change Sets', url: '/lightning/setup/OutboundChangeSet/home', category: 'Deploy' },

    // Jobs
    { label: 'Apex Jobs', url: '/lightning/setup/AsyncApexJobs/home', category: 'Jobs', liveQuery: "SELECT Id, JobType, Status, ApexClass.Name, CreatedDate FROM AsyncApexJob ORDER BY CreatedDate DESC LIMIT 50" },
    { label: 'Apex Flex Queue', url: '/lightning/setup/ApexFlexQueue/home', category: 'Jobs' },
    { label: 'Scheduled Jobs', url: '/lightning/setup/ScheduledJobs/home', category: 'Jobs', liveQuery: "SELECT Id, CronJobDetail.Name, State, NextFireTime FROM CronTrigger ORDER BY NextFireTime" },
    { label: 'Bulk Data Load Jobs', url: '/lightning/setup/AsyncApiJobStatus/home', category: 'Jobs' },
    { label: 'Background Jobs', url: '/lightning/setup/ParallelJobsStatus/home', category: 'Jobs' },

    // Logs
    { label: 'Debug Logs', url: '/lightning/setup/ApexDebugLogs/home', category: 'Logs' },
    { label: 'Email Log Files', url: '/lightning/setup/EmailLogFiles/home', category: 'Logs' },

    // Monitoring
    { label: 'Time-Based Workflow', url: '/lightning/setup/MonitoringTimedWorkflow/home', category: 'Monitoring' },
    { label: 'Outbound Messages', url: '/lightning/setup/MonitoringOutboundMessages/home', category: 'Monitoring' },
    { label: 'System Overview', url: '/lightning/setup/SystemOverview/home', category: 'Monitoring' },

    // Integrations
    { label: 'API', url: '/lightning/setup/CompanyAPIUsage/home', category: 'Integrations' },
    { label: 'Change Data Capture', url: '/lightning/setup/CdcObjectEnablement/home', category: 'Integrations' },
    { label: 'External Data Sources', url: '/lightning/setup/ExternalDataSource/home', category: 'Integrations' },
    { label: 'External Objects', url: '/lightning/setup/ExternalObjects/home', category: 'Integrations' },
    { label: 'External Services', url: '/lightning/setup/ExternalServices/home', category: 'Integrations' },

    // Notification Builder
    { label: 'Custom Notifications', url: '/lightning/setup/CustomNotifications/home', category: 'Notifications' },
    { label: 'Notification Delivery Settings', url: '/lightning/setup/NotificationDeliverySettings/home', category: 'Notifications' },

    // Company Settings
    { label: 'Company Information', url: '/lightning/setup/CompanyProfileInfo/home', category: 'Company' },
    { label: 'Business Hours', url: '/lightning/setup/BusinessHours/home', category: 'Company' },
    { label: 'Fiscal Year', url: '/lightning/setup/ForecastingSettings/home', category: 'Company' },
    { label: 'Holidays', url: '/lightning/setup/Holiday/home', category: 'Company' },
    { label: 'Language Settings', url: '/lightning/setup/LanguageSettings/home', category: 'Company' },
    { label: 'Manage Currencies', url: '/lightning/setup/CurrencySetup/home', category: 'Company' },

    // Data Classification
    { label: 'Data Classification', url: '/lightning/setup/DataClassification/home', category: 'Privacy' },
    { label: 'Privacy Center', url: '/lightning/setup/PrivacyRTBF/home', category: 'Privacy' },

    // Identity
    { label: 'Auth. Providers', url: '/lightning/setup/AuthProviders/home', category: 'Identity' },
    { label: 'Identity Provider', url: '/lightning/setup/IdpPage/home', category: 'Identity' },
    { label: 'Single Sign-On Settings', url: '/lightning/setup/SingleSignOn/home', category: 'Identity' },
    { label: 'Login History', url: '/lightning/setup/LoginHistory/home', category: 'Identity' },
    { label: 'Identity Verification', url: '/lightning/setup/IdentityVerification/home', category: 'Identity' },

    // Security
    { label: 'Health Check', url: '/lightning/setup/HealthCheck/home', category: 'Security' },
    { label: 'Session Settings', url: '/lightning/setup/SessionSettings/home', category: 'Security' },
    { label: 'Session Management', url: '/lightning/setup/SessionManagement/home', category: 'Security' },
    { label: 'Login Access Policies', url: '/lightning/setup/LoginAccessPolicies/home', category: 'Security' },
    { label: 'Password Policies', url: '/lightning/setup/SecurityPasswordPolicies/home', category: 'Security' },
    { label: 'Expire All Passwords', url: '/lightning/setup/SecurityExpirePasswords/home', category: 'Security' },
    { label: 'Network Access', url: '/lightning/setup/SecurityNetworkAccess/home', category: 'Security' },
    { label: 'Remote Site Settings', url: '/lightning/setup/SecurityRemoteProxy/home', category: 'Security' },
    { label: 'Named Credentials', url: '/lightning/setup/NamedCredential/home', category: 'Security' },
    { label: 'CORS', url: '/lightning/setup/CorsWhitelistEntry/home', category: 'Security' },
    { label: 'Certificate and Key Management', url: '/lightning/setup/CertificatesAndKeysManagement/home', category: 'Security' },
    { label: 'Delegated Administration', url: '/lightning/setup/DelegateGroups/home', category: 'Security' },
    { label: 'Sharing Settings', url: '/lightning/setup/SecuritySharing/home', category: 'Security' },
    { label: 'Field Accessibility', url: '/lightning/setup/FieldAccessibility/home', category: 'Security' },
    { label: 'Platform Encryption', url: '/lightning/setup/PlatformEncryption/home', category: 'Security' },
    { label: 'Event Monitoring', url: '/lightning/setup/EventManager/home', category: 'Security' },
    { label: 'Setup Audit Trail', url: '/lightning/setup/SecuritySetupAuditTrail/home', category: 'Security' },
    { label: 'Trusted URLs', url: '/lightning/setup/SecurityTrustedURLs/home', category: 'Security' },
    { label: 'File Upload and Download Security', url: '/lightning/setup/FileTypeSettings/home', category: 'Security' }
];

window.sfarcCommands = [
    { id: 'objects', name: 'Search Objects', icon: 'fa-database', features: 'Data, Fields, Schema' },
    { id: 'users', name: 'Search Users', icon: 'fa-user', features: 'Permissions, Profile, Login As' },
    { id: 'metadata', name: 'Search Metadata', icon: 'fa-server', features: 'Flows, Apex, Custom Fields' },
    { id: 'code-search', name: 'Global Code Search', icon: 'fa-search', category: 'Developer Tools', features: 'Apex, LWC, Search' },
    { id: 'lwc', name: 'Lightning Web Components', icon: 'fa-cubes', category: 'Developer Tools', features: 'LWC, JS, XML' },
    { id: 'anon-apex', name: 'Execute Anonymous Apex', icon: 'fa-bolt', features: 'Run Apex, Query, Scripts' },
    { id: 'rest-explorer', name: 'Salesforce REST API Tester', icon: 'fa-paper-plane', category: 'Developer Tools', features: 'REST, Endpoints, JSON, API', isShortcut: true, url: 'sfi:rest-explorer' },
    { id: 'graphql-explorer', name: 'GraphQL Explorer', icon: 'fa-diagram-project', category: 'Developer Tools', features: 'GraphQL, Queries, Schema', isShortcut: true, url: 'sfi:graphql-explorer' },
    { id: 'security', name: 'Access & Security Analyzer', icon: 'fa-shield-halved', features: 'FLS, CRUD, Profiles' },
    { id: 'record-clone', name: 'Record Clone Between Orgs', icon: 'fa-arrows-rotate', features: 'Data Migrator, Copy, Sync' },
    { id: 'bulk-updater', name: 'Bulk Permission Wizard', icon: 'fa-layer-group', features: 'Assign, Revoke, Mute' },
    { id: 'bulk-field', name: 'Bulk Field Builder', icon: 'fa-table-columns', features: 'Create, Update, Schema', isShortcut: true, url: 'sfi:bulk-field-builder' },
    { id: 'data-builder', name: 'Test Data Builder', icon: 'fa-database', features: 'Generate, Test Data, Records', isShortcut: true, url: 'sfi:data-builder' },
    { id: 'data-import', name: 'Data Import', icon: 'fa-file-import', features: 'CSV, Import, Upsert, Insert', isShortcut: true, url: 'sfi:data-import' },
    { id: 'diff-checker', name: 'Diff Checker', icon: 'fa-code-compare', features: 'Compare, Files, Metadata, Diff', isShortcut: true, url: 'sfi:diff-checker' },
    { id: 'automation-cascade', name: 'Automation Order of Execution Map', icon: 'fa-sitemap', category: 'Automation', features: 'Triggers, Flows, Validation Rules, Order', isShortcut: true, url: 'sfi:automation-cascade' },
    { id: 'org', name: 'Org Details', icon: 'fa-building', features: 'Limits, Version, Namespace' },
    { id: 'debug-logs', name: 'Debug Logs', icon: 'fa-bug', features: 'Trace, Errors, Logs' },
    { id: 'event-monitor', name: 'Event Monitor', icon: 'fa-satellite-dish', category: 'Developer Tools', features: 'Platform Events, CDC, Streaming, Replay' },
    { id: 'code-coverage', name: 'Code Coverage', icon: 'fa-vial', category: 'Developer Tools', features: 'Apex, Test, Coverage, Lines' },
    { id: 'devtools', name: 'Developer Tools', icon: 'fa-terminal', features: 'REST, GraphQL, SOQL' }
];

function getShortcutIcon(name, category) {
    if (!name) return 'fa-list';
    var l = name.toLowerCase();

    // ── Unique filled icons per command ──────────────────────────────────
    // Code & Development
    if (l.includes('scheduled job') || l.includes('scheduled jobs')) return 'fa-calendar-check';
    if (l.includes('apex job') || l.includes('apex jobs')) return 'fa-hammer';
    if (l.includes('flex queue') || l.includes('background job')) return 'fa-layer-group';
    if (l.includes('deploy') || l.includes('deployment')) return 'fa-cloud-arrow-up';
    if (l.includes('audit trail')) return 'fa-book';
    if (l.includes('login history')) return 'fa-clock';
    if (l.includes('apex class') || l.includes('apex classes')) return 'fa-file-code';
    if (l.includes('apex trigger') || l.includes('apex triggers')) return 'fa-bolt';
    if (l.includes('apex setting') || l.includes('apex settings')) return 'fa-sliders';
    if (l.includes('visualforce page') || l.includes('visualforce pages')) return 'fa-file-lines';
    if (l.includes('visualforce component') || l.includes('visualforce components')) return 'fa-puzzle-piece';
    if (l.includes('static resource') || l.includes('static resources')) return 'fa-box';
    if (l.includes('custom metadata')) return 'fa-table-cells';
    if (l.includes('custom setting') || l.includes('custom settings')) return 'fa-sliders';
    if (l.includes('custom permission') || l.includes('custom permissions')) return 'fa-lock';
    if (l.includes('sandbox') || l.includes('sandboxes')) return 'fa-flask';
    if (l.includes('domain') || l.includes('domains') || l.includes('site')) return 'fa-globe';
    if (l.includes('email service')) return 'fa-envelope';
    if (l.includes('platform cache')) return 'fa-memory';

    // Integration & Apps
    if (l.includes('named credential') || l.includes('credentials')) return 'fa-key';
    if (l.includes('remote site')) return 'fa-tower-broadcast';
    if (l.includes('connected app')) return 'fa-plug';
    if (l.includes('lightning component') || l.includes('lwc')) return 'fa-cube';
    if (l.includes('api') && !l.includes('class')) return 'fa-code';

    // Administration / Users & Access
    if (l.includes('permission set group')) return 'fa-shield-halved';
    if (l.includes('permission set')) return 'fa-key';
    if (l.includes('profile')) return 'fa-user-shield';
    if (l.includes('public group')) return 'fa-users';
    if (l.includes('queue')) return 'fa-layer-group';
    if (l.includes('role')) return 'fa-sitemap';
    if (l.includes('user management')) return 'fa-users-gear';
    if (l.includes('user')) return 'fa-user';

    // Email
    if (l.includes('classic email template') || l.includes('lightning email template') || l.includes('email template')) return 'fa-file-lines';
    if (l.includes('letterhead')) return 'fa-heading';
    if (l.includes('organization-wide address') || l.includes('org-wide email')) return 'fa-at';
    if (l.includes('dkim')) return 'fa-shield';
    if (l.includes('deliverability') || l.includes('email')) return 'fa-paper-plane';

    // Automation & Process
    if (l.includes('flow')) return 'fa-diagram-project';
    if (l.includes('process builder')) return 'fa-cubes';
    if (l.includes('workflow rule') || l.includes('workflow')) return 'fa-gears';
    if (l.includes('approval process')) return 'fa-stamp';
    if (l.includes('next best action')) return 'fa-wand-magic-sparkles';
    if (l.includes('paused flow')) return 'fa-pause';
    if (l.includes('global action')) return 'fa-bolt';
    if (l.includes('path setting')) return 'fa-route';
    if (l.includes('quick text')) return 'fa-comment';

    // Settings & Company
    if (l.includes('organization setting') || l.includes('company information') || l.includes('company profile')) return 'fa-building';
    if (l.includes('storage usage')) return 'fa-hard-drive';
    if (l.includes('big object')) return 'fa-database';
    if (l.includes('business hours')) return 'fa-clock';
    if (l.includes('fiscal year') || l.includes('forecast')) return 'fa-chart-line';

    // Data
    if (l.includes('data export') || l.includes('export')) return 'fa-file-export';
    if (l.includes('data import') || l.includes('import')) return 'fa-file-import';
    if (l.includes('duplicate rule') || l.includes('matching rule') || l.includes('duplicate management')) return 'fa-clone';
    if (l.includes('mass delete')) return 'fa-trash';
    if (l.includes('mass transfer')) return 'fa-right-left';
    if (l.includes('picklist')) return 'fa-list';
    if (l.includes('custom label')) return 'fa-tag';

    // Objects & Events
    if (l.includes('object manager') || l.includes('objects')) return 'fa-cubes';
    if (l.includes('schema builder')) return 'fa-diagram-successor';
    if (l.includes('platform event') || l.includes('event')) return 'fa-bolt-lightning';
    if (l.includes('change data capture')) return 'fa-satellite-dish';

    // UI
    if (l.includes('app menu')) return 'fa-grid-2';
    if (l.includes('tab')) return 'fa-table-columns';
    if (l.includes('lightning app builder')) return 'fa-paint-roller';
    if (l.includes('theme') || l.includes('branding')) return 'fa-palette';
    if (l.includes('density')) return 'fa-arrows-down-to-line';
    if (l.includes('rename tab')) return 'fa-pen';
    if (l.includes('global action')) return 'fa-circle-plus';
    if (l.includes('quick text')) return 'fa-comment';
    if (l.includes('path setting')) return 'fa-route';

    // Monitoring
    if (l.includes('time-based workflow')) return 'fa-hourglass-half';
    if (l.includes('outbound message')) return 'fa-paper-plane';
    if (l.includes('system overview')) return 'fa-chart-pie';
    if (l.includes('debug log')) return 'fa-scroll';
    if (l.includes('email log')) return 'fa-envelope-open';
    if (l.includes('translation')) return 'fa-language';

    // Deploy
    if (l.includes('change set')) return 'fa-arrow-right-arrow-left';
    if (l.includes('dev hub')) return 'fa-code-branch';
    if (l.includes('devops')) return 'fa-code-branch';
    if (l.includes('scratch org')) return 'fa-flask-vial';
    if (l.includes('sandbox')) return 'fa-flask';

    // Jobs & Async
    if (l.includes('bulk')) return 'fa-truck-fast';
    if (l.includes('background job')) return 'fa-layer-group';
    if (l.includes('scheduled job')) return 'fa-calendar-check';
    if (l.includes('notification')) return 'fa-bell';

    // Security
    if (l.includes('access') && l.includes('security')) return 'fa-shield';
    if (l.includes('session')) return 'fa-id-badge';
    if (l.includes('login')) return 'fa-right-to-bracket';
    if (l.includes('password')) return 'fa-lock';
    if (l.includes('auth')) return 'fa-fingerprint';
    if (l.includes('health')) return 'fa-heart-pulse';

    // Default fallbacks by category
    if (category === 'Custom Code' || category === 'Development') return 'fa-code';
    if (category === 'Email') return 'fa-envelope';
    if (category === 'Automation') return 'fa-diagram-project';
    if (category === 'Administration') return 'fa-user-shield';
    if (category === 'Data') return 'fa-database';
    if (category === 'Objects') return 'fa-cubes';
    if (category === 'User Interface') return 'fa-desktop';
    if (category === 'Sites & Domains') return 'fa-globe';
    if (category === 'Jobs') return 'fa-hammer';
    if (category === 'Logs') return 'fa-scroll';
    if (category === 'Monitoring') return 'fa-chart-pie';
    if (category === 'Integrations') return 'fa-plug';
    if (category === 'Notifications') return 'fa-bell';
    if (category === 'Company') return 'fa-building';
    if (category === 'Deploy') return 'fa-cloud-arrow-up';
    if (category === 'Translation') return 'fa-language';
    if (category === 'Inspector Tools') return 'fa-magnifying-glass';
    if (category === 'Shortcuts') return 'fa-bolt';

    return 'fa-circle';
}

window.sfarcShortcuts.forEach(shortcut => {
    if (shortcut.label === 'Users') return;

    if (shortcut.liveQuery) {
        window.sfarcCommands.push({
            id: `shortcut_live_${shortcut.label}`,
            name: shortcut.label,
            icon: shortcut.icon || getShortcutIcon(shortcut.label, shortcut.category),
            category: shortcut.category,
            features: `${shortcut.category || 'Shortcut'}, Setup`,
            isShortcut: true,
            liveQuery: shortcut.liveQuery,
            useToolingApi: shortcut.useToolingApi,
            url: shortcut.url
        });
    } else if (shortcut.url) {
        window.sfarcCommands.push({
            id: `shortcut_nav_${shortcut.label}`,
            name: shortcut.label,
            icon: shortcut.icon || getShortcutIcon(shortcut.label, shortcut.category),
            category: shortcut.category,
            features: `${shortcut.category || 'Shortcut'}, Setup`,
            isShortcut: true,
            url: shortcut.url
        });
    }
});

// Sort initial built-in commands & shortcuts A-Z
window.sfarcShortcuts.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
window.sfarcCommands.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

// Precompute a lowercased search key per command ONCE (name + category +
// features combined). The palette filters with a single .includes() on this
// key on every keystroke, instead of lowercasing all three fields of every
// command per keystroke. Call again after sfarcCommands is rebuilt/sorted.
function sfarcRefreshCommandSearchKeys() {
    for (const c of window.sfarcCommands) {
        c._searchKey = `${c.name || ''} ${c.category || ''} ${c.features || ''}`.toLowerCase();
    }
}
sfarcRefreshCommandSearchKeys();

// --- Custom Shortcuts Storage & Registration ---
var customShortcuts = [];

function loadCustomShortcuts() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfarcCustomShortcuts'], (res) => {
            if (res.sfarcCustomShortcuts && Array.isArray(res.sfarcCustomShortcuts)) {
                customShortcuts = res.sfarcCustomShortcuts;
                registerCustomShortcuts();
            }
        });
    }
}

function registerCustomShortcuts() {
    // Remove existing custom shortcuts
    window.sfarcShortcuts = window.sfarcShortcuts.filter(s => !s.isCustom);
    window.sfarcCommands = window.sfarcCommands.filter(c => !c.isCustom);

    customShortcuts.forEach(sc => {
        var item = {
            label: sc.label,
            url: sc.url,
            category: sc.category || 'Custom Shortcuts',
            icon: sc.icon || 'fa-bookmark',
            isCustom: true,
            id: sc.id || ('custom_' + Date.now() + Math.random())
        };
        window.sfarcShortcuts.push(item);
        window.sfarcCommands.push({
            id: item.id,
            name: item.label,
            icon: item.icon,
            category: item.category,
            features: 'Custom Shortcut',
            isShortcut: true,
            isCustom: true,
            url: item.url
        });
    });

    // Sort A-Z
    window.sfarcShortcuts.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
    window.sfarcCommands.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    sfarcRefreshCommandSearchKeys(); // re-key after custom shortcuts re-sort

    if (window.searchCache) {
        window.searchCache.shortcuts = window.sfarcShortcuts;
    }
}

var editingCustomShortcutId = null;

// ── Smart shortcut helpers ────────────────────────────────────────────────
function sfarcHumanizeShortcutUrl(url) {
    try {
        var path = String(url || '').trim();
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) {
            try { path = new URL(path).pathname; } catch (e) { path = path.split('?')[0]; }
        }
        path = path.split('?')[0].split('#')[0].replace(/\/+$/, '');
        var segs = path.split('/').filter(Boolean);
        // Drop trailing view/list/home/detail words
        if (segs.length && /^(view|list|home|detail)$/i.test(segs[segs.length - 1])) segs.pop();
        // /lightning/o/<Object>/... and /lightning/setup/... → drop boilerplate
        if (segs[0] === 'lightning') segs = segs.slice(1);
        if (segs[0] === 'o' || segs[0] === 'setup') segs = segs.slice(1);
        if (segs[0] === 'r') segs = segs.slice(1); // record id segment
        var label = segs
            .map(s => s.replace(/[-_]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim())
            .filter(Boolean)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
        if (!label) return '';
        if (label.length > 40) label = label.slice(0, 40).trim() + '…';
        return label;
    } catch (e) { return ''; }
}

function sfarcSuggestIconForUrl(url) {
    var u = String(url || '').toLowerCase();
    if (/\/r\//.test(u)) return 'fa-bookmark';
    if (/reports|dashboards/.test(u)) return 'fa-chart-pie';
    if (/users|profile|permissionsets?/.test(u)) return 'fa-user';
    if (/email|template/.test(u)) return 'fa-envelope';
    if (/setup|admin|settings/.test(u)) return 'fa-gear';
    if (/flows?\//.test(u) || /flows?$/.test(u) || /flow/.test(u)) return 'fa-bolt';
    if (/objects|schema/.test(u)) return 'fa-cubes';
    if (/code|classes|triggers|vf|aura|apex/.test(u)) return 'fa-code';
    if (/\/o\/|list|sobjects/.test(u)) return 'fa-database';
    if (/projects?/.test(u)) return 'fa-diagram-project';
    return 'fa-bookmark';
}

function sfarcValidateShortcutUrl(url) {
    var u = String(url || '').trim();
    if (!u) return { ok: false, msg: 'Target URL is required.' };
    if (/\s/.test(u)) return { ok: false, msg: 'URL cannot contain spaces.' };
    if (/^https?:\/\//i.test(u)) {
        try { new URL(u); } catch (e) { return { ok: false, msg: 'That full URL does not look valid.' }; }
    } else if (!u.startsWith('/')) {
        return { ok: false, msg: 'Paths should start with "/" — e.g. /lightning/o/Account/list.' };
    }
    return { ok: true, msg: '' };
}

function openCustomShortcutModal(scToEdit = null) {
    var csModal = document.getElementById('sfarc-custom-shortcut-modal');
    if (!csModal) return;

    // Keep the modal INSIDE #sfarc-panel (don't move it to document.body):
    // the panel is full-screen and carries the theme scope (--sfarc-* vars
    // are defined on #sfarc-panel.sfarc-dark-theme). Moving the modal to
    // <body> stripped the dark variables, so it rendered light in dark mode.

    var titleEl = csModal.querySelector('h3');
    var labelInput = document.getElementById('sfarc-cs-label');
    var urlInput = document.getElementById('sfarc-cs-url');
    var categoryInput = document.getElementById('sfarc-cs-category');
    var iconPicker = document.getElementById('sfarc-cs-icon-picker');

    // Reset smart-autofill flags each time the modal opens.
    window.sfarcCustomIconChosen = false;
    window.sfarcShortcutDupConfirmed = false;
    if (labelInput) labelInput.dataset.autoFilled = '';
    if (labelInput) labelInput.dataset.userTyped = '';

    if (scToEdit) {
        editingCustomShortcutId = scToEdit.id;
        if (titleEl) titleEl.textContent = 'Edit Custom Shortcut';
        if (labelInput) labelInput.value = scToEdit.label || '';
        if (urlInput) urlInput.value = scToEdit.url || '';
        if (categoryInput) categoryInput.value = scToEdit.category || 'Custom Shortcuts';

        var activeIcon = scToEdit.icon || 'fa-bookmark';
        if (iconPicker) {
            iconPicker.querySelectorAll('.sfarc-icon-opt').forEach(btn => {
                var isActive = btn.dataset.icon === activeIcon;
                btn.classList.toggle('active', isActive);
                btn.style.borderColor = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-border, #d1d5db)';
                btn.style.background = isActive ? 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1)' : 'var(--sfarc-bg, #ffffff)';
                btn.style.color = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-secondary-text, #6b7280)';
            });
        }
    } else {
        editingCustomShortcutId = null;
        if (titleEl) titleEl.textContent = 'Create Custom Shortcut';
        if (labelInput) labelInput.value = '';
        if (urlInput) urlInput.value = '';
        if (categoryInput) categoryInput.value = 'Custom Shortcuts';

        // Smart prefill — bookmark the current Salesforce page if there is one,
        // so creating a shortcut for "this page" is one click away.
        var smartUrl = '';
        try {
            if (window.location && window.location.pathname && window.location.pathname !== '/' && !window.location.pathname.startsWith('/s/')) {
                smartUrl = window.location.pathname + window.location.search;
            }
        } catch (e) { }
        if (urlInput) urlInput.value = smartUrl;

        if (iconPicker) {
            iconPicker.querySelectorAll('.sfarc-icon-opt').forEach(btn => {
                var isActive = btn.dataset.icon === 'fa-bookmark';
                btn.classList.toggle('active', isActive);
                btn.style.borderColor = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-border, #d1d5db)';
                btn.style.background = isActive ? 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1)' : 'var(--sfarc-bg, #ffffff)';
                btn.style.color = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-secondary-text, #6b7280)';
            });
        }
    }

    // Refresh the live label suggestion / icon suggestion / URL preview.
    if (typeof window.sfarcRefreshShortcutSmartness === 'function') {
        window.sfarcRefreshShortcutSmartness();
    }

    // Mount the modal as a top-level fixed layer on <body>. Inside #sfarc-panel,
    // transforms on the Salesforce page can trap position:fixed and break the dim
    // backdrop (the z-index/stacking-context issue). On <body> the backdrop always
    // covers the viewport. Carry the dark-theme class so the --sfarc-* variables
    // (dark bg, text, borders) keep resolving on the card and its inputs.
    var sfarcPanel = document.getElementById('sfarc-panel');
    if (csModal.parentElement !== document.body) {
        document.body.appendChild(csModal);
        csModal.classList.toggle('sfarc-dark-theme', !!(sfarcPanel && sfarcPanel.classList.contains('sfarc-dark-theme')));
    }

    csModal.style.display = 'flex';
    setTimeout(() => {
        if (labelInput) labelInput.focus();
    }, 50);
}

function saveCustomShortcut(label, url, category, icon) {
    if (!label || !url) return false;
    var formattedUrl = url.trim();
    if (!formattedUrl.startsWith('/') && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = '/' + formattedUrl;
    }

    if (editingCustomShortcutId) {
        var existing = customShortcuts.find(sc => sc.id === editingCustomShortcutId);
        if (existing) {
            existing.label = label.trim();
            existing.url = formattedUrl;
            existing.category = (category || 'Custom Shortcuts').trim();
            existing.icon = icon || 'fa-bookmark';
        }
        editingCustomShortcutId = null;
    } else {
        var newSc = {
            id: 'custom_' + Date.now(),
            label: label.trim(),
            url: formattedUrl,
            category: (category || 'Custom Shortcuts').trim(),
            icon: icon || 'fa-bookmark',
            isCustom: true
        };
        customShortcuts.unshift(newSc);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sfarcCustomShortcuts: customShortcuts });
    }
    registerCustomShortcuts();
    if (currentSearchMode === 'shortcuts') {
        renderSuggestions(window.sfarcShortcuts, 'shortcuts');
    }
    var searchInput = document.getElementById('sfarc-global-search');
    if (searchInput && typeof window.renderGlobalCommands === 'function') {
        window.renderGlobalCommands(searchInput.value || '');
    }
    return true;
}

window.openCustomShortcutModal = openCustomShortcutModal;

function deleteCustomShortcut(id) {
    customShortcuts = customShortcuts.filter(sc => sc.id !== id);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sfarcCustomShortcuts: customShortcuts });
    }
    registerCustomShortcuts();
    if (currentSearchMode === 'shortcuts') {
        renderSuggestions(window.sfarcShortcuts, 'shortcuts');
    }
    var searchInput = document.getElementById('sfarc-global-search');
    if (searchInput && typeof window.renderGlobalCommands === 'function') {
        window.renderGlobalCommands(searchInput.value || '');
    }
}
window.loadCustomShortcuts = loadCustomShortcuts;
window.saveCustomShortcut = saveCustomShortcut;
window.deleteCustomShortcut = deleteCustomShortcut;
var commandSelectedIndex = 0;

// Renders the loaded Font Awesome path as a filled SVG so every command icon
// inherits the same configured accent color. Falls back to the solid glyph
// when the icon definition is unavailable during early boot.
function sfarcOutlineIconHtml(iconClass, sizePx) {
    var size = sizePx || 15;
    var name = String(iconClass || '').replace(/^fa-/, '').trim();
    try {
        var fa = window.FontAwesome;
        var def = fa && typeof fa.findIconDefinition === 'function'
            ? fa.findIconDefinition({ prefix: 'fas', iconName: name })
            : null;
        if (def && Array.isArray(def.icon) && def.icon.length >= 5) {
            var w = def.icon[0];
            var h = def.icon[1];
            var d = def.icon[4];
            if (typeof d === 'string' && d.length > 0) {
                // Filled icon: use fill instead of stroke
                return `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false" style="flex-shrink: 0; display: block; color: inherit;"><path d="${d}" fill="currentColor"/></svg>`;
            }
        }
    } catch (e) { /* fall through to the solid glyph */ }
    return `<i class="fa-solid ${String(iconClass || 'fa-circle-question')}" aria-hidden="true"></i>`;
}
window.sfarcOutlineIconHtml = sfarcOutlineIconHtml;

window.setupGlobalSearch = function () {
    var input = document.getElementById('sfarc-global-search');
    var commandList = document.getElementById('sfarc-command-list');

    // Search mode state: 'all' | 'features' | 'shortcuts'
    var currentSearchMode = 'all';
    var pinnedCommandIds = new Set();
    try {
        pinnedCommandIds = new Set(JSON.parse(localStorage.getItem('sfarcPinnedCommands') || '[]'));
    } catch (e) { pinnedCommandIds = new Set(); }

    function togglePinnedCommand(commandId) {
        if (!commandId) return;
        if (pinnedCommandIds.has(commandId)) pinnedCommandIds.delete(commandId);
        else pinnedCommandIds.add(commandId);
        localStorage.setItem('sfarcPinnedCommands', JSON.stringify([...pinnedCommandIds]));
        commandSelectedIndex = 0;
        renderCommands(input.value || '');
    }

    const hexToRgba = (hex, alpha) => {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(33, 150, 243, ${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Initialize Smart Suggestions
    if (window.SmartSuggestions) {
        window.SmartSuggestions.init();
        // Record current page visit
        window.SmartSuggestions.recordActivity('page-visit', { page: window.location.href });
    }

    // Initial Render of commands
    renderCommands('');
    window.renderGlobalCommands = renderCommands;

    // Remove legacy searchContainer if it exists
    var legacySearch = document.querySelector('.sfarc-search-container');
    if (legacySearch) legacySearch.style.display = 'none';

    input.addEventListener('keydown', (e) => {
        if (window.globalSearchContext) {
            if (e.key === 'Backspace' && input.value === '') {
                e.preventDefault();
                window.clearGlobalSearchContext();
            } else if (e.key === 'Enter') {
                routeSearchQuery(input.value, true);
            }
        } else {
            var visibleCommands = getVisibleCommands(input.value);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                // Move the selection WITHOUT re-rendering the whole list: the
                // old path called renderCommands(), which rebuilt every item
                // and replayed their staggered pop-in animations on each key
                // press, making keyboard navigation look janky. Just toggle
                // the selected state and keep the item in view instead.
                var commandItems = commandList.querySelectorAll('.sfarc-command-item');
                if (commandItems.length > 0) {
                    var delta = e.key === 'ArrowDown' ? 1 : -1;
                    commandSelectedIndex = (commandSelectedIndex + delta + commandItems.length) % commandItems.length;
                    commandItems.forEach((item, i) => {
                        var isSelected = i === commandSelectedIndex;
                        item.classList.toggle('selected', isSelected);
                        item.style.background = isSelected ? 'rgba(var(--primary-color-rgb), 0.2)' : '';
                    });
                    var selected = commandItems[commandSelectedIndex];
                    if (selected && typeof selected.scrollIntoView === 'function') {
                        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // A pasted record ID is handled live by renderCommands — don't
                // try to select a command for it.
                if (sfarcExtractRecordId(input.value)) return;
                if (visibleCommands.length > 0) {
                    window.setGlobalSearchContext(visibleCommands[commandSelectedIndex]);
                }
            }
        }
    });

    input.addEventListener('input', (e) => {
        if (window.globalSearchContext) {
            routeSearchQuery(e.target.value, false);
        } else {
            commandSelectedIndex = 0;
            renderCommands(e.target.value);
        }
    });

    // Handle smart suggestion clicks — direct launch
    function handleSmartSuggestion(suggestionId) {
        // Find the suggestion by id and call its launch function
        if (window.SmartSuggestions) {
            var suggestions = window.SmartSuggestions.getFormattedSuggestions();
            var suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion && typeof suggestion.launch === 'function') {
                // Record the activity
                window.SmartSuggestions.recordActivity('suggestion-launch', { id: suggestionId, label: suggestion.label });
                // Launch directly
                suggestion.launch();
                // Close the popup by dispatching click outside
                setTimeout(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })), 50);
                return;
            }
        }
        // Fallback: map action to command name and search
        var actionMap = {
            'object-manager': 'Object Manager',
            'apex-classes': 'Apex Classes',
            'apex-triggers': 'Apex Triggers',
            'flows': 'Flows',
            'debug-logs': 'Debug Logs',
            'data-export': 'Data Export (Inspector)',
            'data-import': 'Data Import (Inspector)',
            'field-info': 'Field Info',
            'show-all-data': 'Show All Data',
            'anonymous-apex': 'Anonymous Apex',
            'code-coverage': 'Code Coverage'
        };
        var commandName = actionMap[suggestionId] || suggestionId;
        var searchInput = document.getElementById('sfarc-global-search');
        if (searchInput) {
            searchInput.value = commandName;
            renderCommands(commandName);
        }
    }

    function renderCommands(query = '') {
        // Pasting a record ID (or a record URL) instantly shows every field
        // and value of that record instead of the command list. The object name
        // from a /lightning/r/<Obj>/<id>/view URL is passed as a hint so the
        // inspector resolves the record type instantly (no org-wide probe).
        var recordInfo = sfarcExtractRecordInfo(query);
        if (recordInfo) {
            // Make sure the home view is visible so the inspector is on screen.
            var homeView = document.getElementById('sfarc-home-view');
            if (homeView && homeView.style.display === 'none') {
                ['sfarc-suggestions-container', 'sfarc-devtools-container', 'sfarc-debug-logs-view', 'sfarc-metadata-container', 'sfarc-security-container', 'sfarc-bulk-updater-container', 'sfarc-anon-apex-container', 'sfarc-code-search-container', 'sfarc-bulk-field-container', 'sfarc-lwc-container'].forEach(id => {
                    var el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                homeView.style.display = 'flex';
            }
            renderRecordInspector(commandList, recordInfo.id, recordInfo.objectType);
            return;
        }

        var visibleCommands = getVisibleCommands(query);

        // Ensure home view is visible and others are hidden when searching commands
        var homeView = document.getElementById('sfarc-home-view');
        if (homeView && homeView.style.display === 'none') {
            ['sfarc-suggestions-container', 'sfarc-devtools-container', 'sfarc-debug-logs-view', 'sfarc-metadata-container', 'sfarc-security-container', 'sfarc-bulk-updater-container', 'sfarc-anon-apex-container', 'sfarc-code-search-container', 'sfarc-bulk-field-container', 'sfarc-lwc-container'].forEach(id => {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            homeView.style.display = 'flex';
        }

        commandList.innerHTML = '';
        
        // Show smart suggestions when no query is entered
        if (!query && window.SmartSuggestions) {
            var smartSuggestions = window.SmartSuggestions.getFormattedSuggestions();
            if (smartSuggestions.length > 0) {
                var smartSection = document.createElement('div');
                smartSection.className = 'sfarc-smart-suggestions';

                smartSection.innerHTML = `
                    <div style="width: 100%;">
                    <div style="padding: 6px 12px 2px; font-size: 11px; font-weight: 500; color: var(--sfarc-secondary-text, #9ca3af);">
                        Recent
                    </div>
                    <div class="sfarc-smart-suggestions-grid" style="display: flex; flex-direction: column; padding: 0 4px;">
                        ${smartSuggestions.slice(0, 5).map((s, si) => {
                            var sDesc = s.desc || '';
                            return `
                            <div class="sfarc-smart-chip sfarc-suggestion-row" data-suggestion-id="${s.id}">
                                <span class="sfarc-suggestion-icon sfarc-command-icon">${sfarcOutlineIconHtml(s.icon, 16)}</span>
                                <span style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden;">
                                    <span style="font-weight: 400; font-size: 13px; color: var(--sfarc-text, #1e293b); white-space: nowrap;">${s.label}</span>
                                    ${sDesc ? `<span style="font-weight: 400; font-size: 12px; color: var(--sfarc-secondary-text, #9ca3af); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sDesc}</span>` : ""}
                                </span>
                                <span class="sfarc-suggestion-category" style="font-size: 11px; font-weight: 500; color: var(--sfarc-secondary-text, #9ca3af); white-space: nowrap; flex-shrink: 0; padding-right: 4px;">
                                    ${s.category || 'Shortcut'}
                                </span>
                            </div>
                            `;
                        }).join('')}
                    </div>
                    </div>
                `;
                commandList.appendChild(smartSection);
                
                // Add click handlers for smart chips
                smartSection.querySelectorAll('.sfarc-smart-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        var suggestionId = chip.dataset.suggestionId;
                        handleSmartSuggestion(suggestionId);
                    });
                });

            }
        }
        
        if (visibleCommands.length === 0) {
            commandList.innerHTML += '<div style="padding: 16px; color: var(--sfarc-secondary-text); text-align: center;">No matching commands found.</div>';
            return;
        }

        var lastWasPinned = null;
        visibleCommands.forEach((cmd, idx) => {
            var isPinned = pinnedCommandIds.has(cmd.id);
            if (!query && isPinned !== lastWasPinned) {
                var sectionHeader = document.createElement('div');
                sectionHeader.className = 'sfarc-command-section-title';
                sectionHeader.innerHTML = isPinned
                    ? '<span><i class="fa-solid fa-thumbtack"></i> Pinned</span><span class="sfarc-section-count">' + visibleCommands.filter(c => pinnedCommandIds.has(c.id)).length + '</span>'
                    : '<span>All commands</span><span class="sfarc-section-count">' + visibleCommands.filter(c => !pinnedCommandIds.has(c.id)).length + '</span>';
                commandList.appendChild(sectionHeader);
                lastWasPinned = isPinned;
            }
            var el = document.createElement('div');
            var isSelected = idx === commandSelectedIndex;
            el.className = `sfarc-command-item ${isSelected ? 'selected' : ''}`;
            var delay = Math.min(idx * 0.012, 0.12);
            el.style = `opacity: 0; animation: sfiItemEnter 0.18s ease-out forwards ${delay}s;`;

            var featuresText = cmd.features || (cmd.category ? (
                cmd.category.toLowerCase().includes('automation') ? 'Flow, Process, Approval' :
                    cmd.category.toLowerCase().includes('admin') ? 'Security, Admin, Org' :
                        cmd.category.toLowerCase().includes('data') ? 'Database, Storage, Import' :
                            cmd.category.toLowerCase().includes('email') ? 'Org Email, Templates' :
                                cmd.category.toLowerCase().includes('objects') ? 'Schema, Custom Fields' :
                                    cmd.category.toLowerCase().includes('code') || cmd.category.toLowerCase().includes('dev') ? 'Apex, VF, Custom Code' :
                                        cmd.category.toLowerCase().includes('event') ? 'Streaming, Platform Event' :
                                            cmd.category.toLowerCase().includes('ui') || cmd.category.toLowerCase().includes('interface') ? 'UI, Layout, Label' :
                                                cmd.category
            ) : (cmd.isShortcut ? 'Shortcut, Setup' : ''));

            var customActionsHtml = cmd.isCustom ? `
                <div style="display: flex; align-items: center; gap: 4px; margin-left: 10px;">
                    <button class="sfarc-cmd-edit-btn" data-custom-id="${cmd.id}"  style="background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.3); color: inherit; cursor: pointer; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="sfarc-cmd-delete-btn" data-custom-id="${cmd.id}"  style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; cursor: pointer; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;"><i class="fa-solid fa-xmark"></i> Delete</button>
                </div>
            ` : '';

            var cmdDesc = cmd.category || '';

            el.innerHTML = `
                <span class="sfarc-suggestion-icon sfarc-command-icon">${sfarcOutlineIconHtml(cmd.icon, 16)}</span>
                <span style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <span style="font-weight: 500; font-size: 13px; color: var(--sfarc-text, #1e293b); white-space: nowrap;">${window.escapeHtml(cmd.name)}</span>
                    ${cmdDesc ? `<span style="font-weight: 400; font-size: 12px; color: var(--sfarc-secondary-text, #9ca3af); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cmdDesc}</span>` : ''}
                </span>
                <span class="sfarc-suggestion-category" style="font-size: 11px; font-weight: 500; color: var(--sfarc-secondary-text, #9ca3af); white-space: nowrap; flex-shrink: 0; padding-right: 4px; display: flex; align-items: center;">
                    <span>${featuresText}</span>
                    ${customActionsHtml}
                </span>
                <button class="sfarc-command-pin ${isPinned ? 'is-pinned' : ''}" type="button" title="${isPinned ? 'Unpin command' : 'Pin command'}" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${window.escapeHtml(cmd.name)}"><i class="fa-solid fa-thumbtack"></i></button>
                <span class="sfarc-command-enter-hint">↵</span>
            `;

            var pinBtn = el.querySelector('.sfarc-command-pin');
            if (pinBtn) pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePinnedCommand(cmd.id);
            });

            var editBtn = el.querySelector('.sfarc-cmd-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    var scToEdit = window.sfarcShortcuts.find(sc => sc.id === cmd.id);
                    if (scToEdit && typeof openCustomShortcutModal === 'function') {
                        openCustomShortcutModal(scToEdit);
                    }
                });
            }

            var deleteBtn = el.querySelector('.sfarc-cmd-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteCustomShortcut(cmd.id);
                });
            }

            el.addEventListener('click', (e) => {
                if (e.target.closest('.sfarc-cmd-edit-btn') || e.target.closest('.sfarc-cmd-delete-btn') || e.target.closest('.sfarc-command-pin')) {
                    return;
                }
                window.setGlobalSearchContext(cmd);
            });

            commandList.appendChild(el);
        });
    }

    // Search mode popover toggle & event listeners
    var modeBtn = document.getElementById('sfarc-search-mode-btn');
    var modePopover = document.getElementById('sfarc-search-mode-popover');
    var modeLabel = document.getElementById('sfarc-search-mode-label');
    var modeOptions = document.querySelectorAll('#sfarc-search-mode-popover .sfarc-mode-option');

    function setSearchMode(mode) {
        currentSearchMode = mode;
        var modeNames = { 'all': 'All Modes', 'features': 'Tools', 'shortcuts': 'Shortcuts' };
        if (modeLabel) modeLabel.textContent = modeNames[mode] || 'All Modes';

        var addCsBtn = document.getElementById('sfarc-add-custom-shortcut-btn');
        if (addCsBtn) {
            addCsBtn.style.display = (mode === 'shortcuts') ? 'inline-flex' : 'none';
        }

        modeOptions.forEach(opt => {
            var check = opt.querySelector('.sfarc-mode-check');
            if (opt.dataset.mode === mode) {
                opt.classList.add('active');
                opt.style.color = '#ffffff';
                opt.style.background = 'rgba(255, 255, 255, 0.1)';
                if (check) { check.style.opacity = '1'; check.style.color = '#ffffff'; }
            } else {
                opt.classList.remove('active');
                opt.style.color = '#9ca3af';
                opt.style.background = 'transparent';
                if (check) { check.style.opacity = '0'; }
            }
        });

        if (window.globalSearchContext && typeof window.clearGlobalSearchContext === 'function') {
            window.clearGlobalSearchContext();
        } else {
            var homeView = document.getElementById('sfarc-home-view');
            if (homeView) homeView.style.display = 'flex';
            ['sfarc-suggestions-container', 'sfarc-devtools-container', 'sfarc-debug-logs-view', 'sfarc-metadata-container', 'sfarc-security-container', 'sfarc-bulk-updater-container', 'sfarc-anon-apex-container', 'sfarc-code-search-container', 'sfarc-bulk-field-container', 'sfarc-lwc-container'].forEach(id => {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        commandSelectedIndex = 0;
        var searchInput = document.getElementById('sfarc-global-search');
        if (searchInput) renderCommands(searchInput.value || '');
    }

    if (modeBtn && modePopover) {
        var modeToggle = document.getElementById('sfarc-search-mode-toggle');
        var modeHoverTimeout = null;

        // Click still works as a toggle
        modeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            var isOpen = modePopover.style.display === 'block';
            modePopover.style.display = isOpen ? 'none' : 'block';
        });

        // Auto-open on hover with short delay to prevent flicker
        if (modeToggle) {
            modeToggle.addEventListener('mouseenter', () => {
                clearTimeout(modeHoverTimeout);
                modeHoverTimeout = setTimeout(() => {
                    modePopover.style.display = 'block';
                }, 150);
            });
            modeToggle.addEventListener('mouseleave', () => {
                clearTimeout(modeHoverTimeout);
                modeHoverTimeout = setTimeout(() => {
                    modePopover.style.display = 'none';
                }, 200);
            });
        }

        document.addEventListener('click', (e) => {
            if (modePopover && !modePopover.contains(e.target) && e.target !== modeBtn) {
                modePopover.style.display = 'none';
            }
        });

        modeOptions.forEach(opt => {
            opt.addEventListener('mouseenter', () => {
                if (!opt.classList.contains('active')) {
                    opt.style.background = 'rgba(255, 255, 255, 0.06)';
                    opt.style.color = '#e5e7eb';
                }
            });
            opt.addEventListener('mouseleave', () => {
                if (!opt.classList.contains('active')) {
                    opt.style.background = 'transparent';
                    opt.style.color = '#9ca3af';
                }
            });
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                setSearchMode(opt.dataset.mode);
                modePopover.style.display = 'none';
            });
        });
    }

    // Initialize custom shortcuts from storage
    loadCustomShortcuts();

    // Create Custom Shortcut modal event listeners
    var addCsBtn = document.getElementById('sfarc-add-custom-shortcut-btn');
    var csModal = document.getElementById('sfarc-custom-shortcut-modal');
    var csClose = document.getElementById('sfarc-custom-shortcut-close');
    var csCancel = document.getElementById('sfarc-custom-shortcut-cancel');
    var csSave = document.getElementById('sfarc-custom-shortcut-save');

    if (addCsBtn) {
        addCsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCustomShortcutModal(null);
        });
    }

    var selectedCustomIcon = 'fa-bookmark';
    var iconPicker = document.getElementById('sfarc-cs-icon-picker');

    // Apply an icon to the picker (shared by click + smart suggestion).
    window.sfarcApplyCustomShortcutIcon = function (iconName) {
        if (!iconPicker) return;
        selectedCustomIcon = iconName || 'fa-bookmark';
        iconPicker.querySelectorAll('.sfarc-icon-opt').forEach(b => {
            var isActive = b.dataset.icon === selectedCustomIcon;
            b.classList.toggle('active', isActive);
            b.style.borderColor = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-border, #d1d5db)';
            b.style.background = isActive ? 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1)' : 'var(--sfarc-bg, #ffffff)';
            b.style.color = isActive ? 'var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)))' : 'var(--sfarc-secondary-text, #6b7280)';
        });
    };

    if (iconPicker) {
        iconPicker.addEventListener('click', (e) => {
            var btn = e.target.closest('.sfarc-icon-opt');
            if (!btn) return;
            // A manual pick stops the smart auto-suggestion from overriding it.
            window.sfarcCustomIconChosen = true;
            window.sfarcApplyCustomShortcutIcon(btn.dataset.icon || 'fa-bookmark');
        });
    }

    // Live smart helpers: label suggestion, icon suggestion, URL preview/validation.
    var csLabelInput = document.getElementById('sfarc-cs-label');
    var csUrlInput = document.getElementById('sfarc-cs-url');
    var csUrlPreview = document.getElementById('sfarc-cs-url-preview');

    if (!csModal.dataset.smartWired) {
        csModal.dataset.smartWired = '1';

        window.sfarcRefreshShortcutSmartness = function () {
            if (!csUrlInput) return;
            var url = csUrlInput.value;
            var trimmed = url.trim();

            // 1. Smart label — fill from the URL unless the user typed one.
            if (csLabelInput && (!csLabelInput.value || csLabelInput.dataset.autoFilled === '1')) {
                var suggested = sfarcHumanizeShortcutUrl(trimmed);
                if (suggested) {
                    csLabelInput.value = suggested;
                    csLabelInput.dataset.autoFilled = '1';
                }
            }

            // 2. Smart icon — pick a fitting icon unless the user chose one.
            if (!window.sfarcCustomIconChosen && trimmed) {
                var icon = sfarcSuggestIconForUrl(trimmed);
                if (typeof window.sfarcApplyCustomShortcutIcon === 'function') {
                    window.sfarcApplyCustomShortcutIcon(icon);
                }
            }

            // 3. Live URL preview + validation.
            if (csUrlPreview) {
                if (!trimmed) {
                    csUrlPreview.style.display = 'none';
                } else {
                    var check = sfarcValidateShortcutUrl(trimmed);
                    csUrlPreview.style.display = 'block';
                    if (check.ok) {
                        var host = (window.sfApi && window.sfApi.instanceUrl) ? window.sfApi.instanceUrl.replace(/\/$/, '') : (window.location.origin || '');
                        csUrlPreview.textContent = '→ opens at ' + host + (trimmed.startsWith('http') ? '' : trimmed);
                        csUrlPreview.style.color = 'var(--sfarc-secondary-text, #8b949e)';
                        csUrlInput.style.borderColor = 'var(--sfarc-border, #d1d5db)';
                    } else {
                        csUrlPreview.textContent = '⚠ ' + check.msg;
                        csUrlPreview.style.color = '#dc2626';
                        csUrlInput.style.borderColor = '#dc2626';
                    }
                }
            }
        };

        if (csUrlInput) {
            csUrlInput.addEventListener('input', () => {
                window.sfarcShortcutDupConfirmed = false;
                if (typeof window.sfarcRefreshShortcutSmartness === 'function') {
                    window.sfarcRefreshShortcutSmartness();
                }
            });
        }

        if (csLabelInput) {
            csLabelInput.addEventListener('input', () => {
                csLabelInput.dataset.userTyped = '1';
                csLabelInput.dataset.autoFilled = '';
            });
        }

        // Enter saves, Esc closes.
        csModal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (csSave) csSave.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                csModal.style.display = 'none';
            }
        });
    }

    if (csClose && csModal) {
        csClose.addEventListener('click', () => csModal.style.display = 'none');
    }
    if (csCancel && csModal) {
        csCancel.addEventListener('click', () => csModal.style.display = 'none');
    }
    if (csSave && csModal) {
        csSave.addEventListener('click', () => {
            var labelInput2 = document.getElementById('sfarc-cs-label');
            var urlInput2 = document.getElementById('sfarc-cs-url');
            var label = labelInput2?.value || '';
            var url = urlInput2?.value || '';
            var category = document.getElementById('sfarc-cs-category')?.value || 'Custom Shortcuts';
            var urlCheck = sfarcValidateShortcutUrl(url);

            // Inline validation — no blocking toast.info().
            if (!label.trim()) {
                if (csUrlPreview) {
                    csUrlPreview.style.display = 'block';
                    csUrlPreview.textContent = '⚠ Please enter a Shortcut Name.';
                    csUrlPreview.style.color = '#dc2626';
                }
                if (labelInput2) labelInput2.focus();
                return;
            }
            if (!urlCheck.ok) {
                if (csUrlPreview) {
                    csUrlPreview.style.display = 'block';
                    csUrlPreview.textContent = '⚠ ' + urlCheck.msg;
                    csUrlPreview.style.color = '#dc2626';
                }
                if (urlInput2) urlInput2.focus();
                return;
            }

            // Two-step duplicate guard — warn inline, save on the second click.
            var normalized = url.trim().toLowerCase();
            var dup = (window.sfarcShortcuts || []).find(sc =>
                (sc.url || '').trim().toLowerCase() === normalized && sc.id !== editingCustomShortcutId
            );
            if (dup && !window.sfarcShortcutDupConfirmed) {
                window.sfarcShortcutDupConfirmed = true;
                if (csUrlPreview) {
                    csUrlPreview.style.display = 'block';
                    csUrlPreview.textContent = '⚠ A shortcut to this URL already exists (' + (dup.name || dup.label || '?') + '). Click Save again to add it anyway.';
                    csUrlPreview.style.color = '#d97706';
                }
                return;
            }
            window.sfarcShortcutDupConfirmed = false;

            saveCustomShortcut(label, url, category, selectedCustomIcon);
            csModal.style.display = 'none';
            if (labelInput2) labelInput2.value = '';
            if (urlInput2) urlInput2.value = '';
            if (csUrlPreview) csUrlPreview.style.display = 'none';

            // Switch to shortcuts mode
            setSearchMode('shortcuts');
        });
    }

    function getVisibleCommands(query) {
        var commands = window.sfarcCommands || [];
        if (currentSearchMode === 'features') {
            // Tools mode: show all internal extension tools (sfi: URLs are extension pages)
            commands = commands.filter(c => !c.url || c.url.startsWith('sfi:'));
        } else if (currentSearchMode === 'shortcuts') {
            // Shortcuts mode: show Salesforce Setup links only
            commands = commands.filter(c => c.url && !c.url.startsWith('sfi:'));
        }

        if (query) {
            var q = query.toLowerCase();
            // Filter against the precomputed lowercased key. `filter` is stable
            // and sfarcCommands is already sorted A-Z, so no re-sort needed.
            commands = commands.filter(c => c._searchKey.includes(q));
        }

        var result = [...commands];
        if (!query) {
            result.sort((a, b) => Number(pinnedCommandIds.has(b.id)) - Number(pinnedCommandIds.has(a.id)));
        }
        return result;
    }

    // Initialize Review & Feedback system
    sfarcInitReviewAndFeedbackSystem();
};

function sfarcInitReviewAndFeedbackSystem() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    var banner = document.getElementById('sfarc-review-banner');
    var step1 = document.getElementById('sfarc-rb-step-1');
    var step2 = document.getElementById('sfarc-rb-step-2');
    var yesBtn = document.getElementById('sfarc-rb-yes-btn');
    var feedbackBtn = document.getElementById('sfarc-rb-feedback-btn');
    var rateLink = document.getElementById('sfarc-rb-rate-link');
    var dismissBtn = document.getElementById('sfarc-rb-dismiss-btn');
    var headerFeedbackBtn = document.getElementById('sfarc-header-feedback-btn');


    var headerRateLink = document.getElementById('sfarc-header-rate-link');

    chrome.storage.local.get(['sfarcInstallDate', 'sfarcMeaningfulActionsCount', 'sfarcReviewPromptDone', 'sfarcReviewPromptSnoozedUntil'], (res) => {
        var now = Date.now();
        var installDate = res.sfarcInstallDate || now;
        if (!res.sfarcInstallDate) {
            chrome.storage.local.set({ sfarcInstallDate: now });
        }
        var actionCount = res.sfarcMeaningfulActionsCount || 0;
        var isDone = res.sfarcReviewPromptDone || false;
        var snoozedUntil = res.sfarcReviewPromptSnoozedUntil || 0;

        var threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        var isEligible = !isDone && (now - installDate >= threeDaysMs || actionCount >= 5) && now > snoozedUntil;

        if (isEligible && banner) {
            banner.style.display = 'block';
        }


    });

    if (dismissBtn && banner) {
        dismissBtn.addEventListener('click', () => {
            banner.style.display = 'none';
            chrome.storage.local.set({sfarcReviewPromptSnoozedUntil: Date.now() + 30 * 24 * 60 * 60 * 1000});
        });
    }

    if (headerRateLink) {
        headerRateLink.addEventListener('click', () => {
            chrome.storage.local.set({ sfarcReviewPromptDone: true });
            if (headerRateContainer) {
                headerRateContainer.style.display = 'none';
            }
            if (banner) banner.style.display = 'none';
        });
    }

    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'flex';
        });
    }

    if (rateLink) {
        rateLink.addEventListener('click', () => {
            chrome.storage.local.set({ sfarcReviewPromptDone: true });
            if (banner) banner.style.display = 'none';
        });
    }

    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            if (banner) banner.style.display = 'none';
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSc4V3_SP9XdosnLhEq7064nFe1UwgpOhdlYcqu9zvxy63gicg/viewform?usp=publish-editor', '_blank');
        });
    }

    if (headerFeedbackBtn) {
        headerFeedbackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSc4V3_SP9XdosnLhEq7064nFe1UwgpOhdlYcqu9zvxy63gicg/viewform?usp=publish-editor', '_blank');
        });
    }

}

function sfarcTrackMeaningfulAction(actionName) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['sfarcInstallDate', 'sfarcMeaningfulActionsCount', 'sfarcReviewPromptDone', 'sfarcReviewPromptSnoozedUntil'], (res) => {
        var now = Date.now();
        var installDate = res.sfarcInstallDate || now;
        var actionCount = (res.sfarcMeaningfulActionsCount || 0) + 1;
        var isDone = res.sfarcReviewPromptDone || false;

        if (!res.sfarcInstallDate) {
            chrome.storage.local.set({ sfarcInstallDate: now });
        }
        chrome.storage.local.set({ sfarcMeaningfulActionsCount: actionCount });

        var threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        var snoozedUntil = res.sfarcReviewPromptSnoozedUntil || 0;

        if (!isDone && (now - installDate >= threeDaysMs || actionCount >= 5) && now > snoozedUntil) {
            var banner = document.getElementById('sfarc-review-banner');
            if (banner && banner.style.display === 'none') {
                banner.style.display = 'block';
            }
        }
    });
}
window.sfarcTrackMeaningfulAction = sfarcTrackMeaningfulAction;

window.setGlobalSearchContext = function (cmd) {
    if (!cmd) return;
    var cmdName = cmd.name || cmd.label || '';
    if (typeof sfarcTrackMeaningfulAction === 'function') {
        sfarcTrackMeaningfulAction('command_' + (cmdName || 'exec'));
    }
    if (cmd.url && !cmd.liveQuery) {
        if (typeof addToRecents === 'function') {
            addToRecents({ label: cmdName, url: cmd.url, category: cmd.category, icon: cmd.icon });
        }
        if (cmd.url.startsWith('sfi:')) {
            var feature = cmd.url.replace('sfi:', '');
            var params = {};
            
            // Extract and parse query parameters if present
            if (feature.includes('?')) {
                var parts = feature.split('?');
                feature = parts[0];
                var searchParams = new URLSearchParams(parts[1]);
                params = Object.fromEntries(searchParams.entries());
            }

            // Keep the existing auto-fill smart SOQL logic for data-export if no query was passed
            if (feature === 'data-export' && !params.query) {
                var q = buildSmartQuery();
                if (q) params.query = q;
            }
            
            if (Object.keys(params).length === 0) params = undefined;
            if (typeof openInNewTab === 'function') openInNewTab(feature, params);
        } else {
            var instanceUrl = (window.sfApi && window.sfApi.instanceUrl) ? window.sfApi.instanceUrl : window.location.origin;
            window.open(`${instanceUrl}${cmd.url}`, '_blank');
        }
        return;
    }

    if (!cmd.id) {
        if (typeof window.clearGlobalSearchContext === 'function') {
            window.clearGlobalSearchContext();
        }
        return;
    }

    window.globalSearchContext = cmd;
    var input = document.getElementById('sfarc-global-search');
    var pillsContainer = document.getElementById('sfarc-global-context-pills');
    var homeView = document.getElementById('sfarc-home-view');

    input.value = '';
    input.placeholder = `Search ${cmdName.replace('Search ', '')}...`;

    var iconHtml = cmd.icon ? `<i class="fa-solid ${cmd.icon}"></i>` : '<i class="fa-solid fa-cube"></i>';
    pillsContainer.innerHTML = `
        <div style="background: rgba(var(--primary-color-rgb, 33, 150, 243), 0.1); color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; user-select: none;">
            ${iconHtml}
            <span>${cmdName.replace('Search ', '')}</span>
            <i class="fa-solid fa-xmark sfarc-clear-context-btn" style="cursor: pointer; margin-left: 4px; opacity: 0.75; font-size: 11px;" ></i>
        </div>
    `;

    homeView.style.display = 'none';

    var filterBtn = document.getElementById('sfarc-smart-filter-btn');
    if (filterBtn) {
        if (cmd.id === 'users') {
            filterBtn.style.display = 'flex';
        } else {
            filterBtn.style.display = 'none';
        }
    }

    loadTabContent(cmd.id);

    input.focus();
};

// Event delegation for the filter chip's X button — survives any re-render of
// the pills. Wired at DOCUMENT level (not on the container) because the panel
// and #sfarc-global-context-pills are created later by injectUI() inside
// initSettings().then(); wiring here at load time found nothing, so the X
// silently did nothing. Scoped to the pills container so it can't interfere
// anywhere else on the page.
if (!window.__sfarcPillsClearWired) {
    window.__sfarcPillsClearWired = true;
    document.addEventListener('click', (e) => {
        var target = e.target;
        // Guard: target might be an SVG element or Text node without .closest()
        if (typeof target.closest !== 'function') return;
        var clearBtn = target.closest('.sfarc-clear-context-btn');
        if (!clearBtn) return;
        var pillsContainer = document.getElementById('sfarc-global-context-pills');
        if (!pillsContainer || !pillsContainer.contains(clearBtn)) return;
        e.stopPropagation();
        e.preventDefault();
        if (typeof window.clearGlobalSearchContext === 'function') {
            window.clearGlobalSearchContext();
        }
    });
}

// Wire animated search container padding compression on blur/focus
var globalSearchInputEl = document.getElementById('sfarc-global-search');
if (globalSearchInputEl && !globalSearchInputEl.dataset.compressionWired) {
    globalSearchInputEl.dataset.compressionWired = 'true';
    globalSearchInputEl.addEventListener('blur', () => {
        var container = document.querySelector('.sfarc-global-search-container');
        if (container) container.classList.add('sfarc-search-compressed');
    });
    globalSearchInputEl.addEventListener('focus', () => {
        var container = document.querySelector('.sfarc-global-search-container');
        if (container) container.classList.remove('sfarc-search-compressed');
    });
}

window.clearGlobalSearchContext = function () {
    window.globalSearchContext = null;
    currentTab = 'objects';
    var input = document.getElementById('sfarc-global-search');
    var pillsContainer = document.getElementById('sfarc-global-context-pills');
    var homeView = document.getElementById('sfarc-home-view');

    if (input) {
        input.value = '';
        input.placeholder = 'Search for commands, objects, users, metadata...';
    }
    if (pillsContainer) pillsContainer.innerHTML = '';

    if (homeView) homeView.style.display = 'flex';

    var hideAll = () => {
        ['sfarc-suggestions-container', 'sfarc-devtools-container', 'sfarc-debug-logs-view', 'sfarc-metadata-container', 'sfarc-security-container', 'sfarc-bulk-updater-container', 'sfarc-anon-apex-container', 'sfarc-code-search-container', 'sfarc-bulk-field-container', 'sfarc-lwc-container'].forEach(id => {
            var el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Restore/minimize popup size if it was expanded. Surgical restore:
        // remove exactly the properties the expansion paths set — including
        // min-width, which the old code skipped, so visiting DevTools once
        // left the popup stuck at its 780px minimum on every other tab. Never
        // rewrite the whole inline cssText (that would also drop the
        // width/height transition from the panel markup).
        var popupContainer = document.querySelector('.sfarc-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('sfarc-code-search-expanded');
            if (popupContainer.dataset.expanded === 'true') {
                if (popupContainer.dataset.originalCssText) {
                    popupContainer.style.cssText = popupContainer.dataset.originalCssText;
                }
                ['width', 'max-width', 'min-width', 'height', 'min-height', 'max-height'].forEach(prop => {
                    popupContainer.style.removeProperty(prop);
                });
                popupContainer.dataset.expanded = 'false';
            }
        }
    };
    hideAll();

    var filterBtn = document.getElementById('sfarc-smart-filter-btn');
    if (filterBtn) filterBtn.style.display = 'none';
    var backdrop = document.getElementById('sfarc-smart-filter-backdrop');
    if (backdrop) backdrop.style.display = 'none';
};

window.sfarcSmartFilters = [];
window.sfarcSmartFilterFields = [];

window.setupSmartFilters = function () {
    var btn = document.getElementById('sfarc-smart-filter-btn');
    var backdrop = document.getElementById('sfarc-smart-filter-backdrop');
    var popup = document.getElementById('sfarc-smart-filter-popup');
    var closeBtn = document.getElementById('sfarc-smart-filter-close');
    var addBtn = document.getElementById('sfarc-smart-filter-add-btn');
    var clearBtn = document.getElementById('sfarc-smart-filter-clear-btn');
    var applyBtn = document.getElementById('sfarc-smart-filter-apply-btn');
    var rowsContainer = document.getElementById('sfarc-smart-filter-rows');

    if (!btn || !backdrop || !popup) return;

    var openModal = () => { backdrop.style.display = 'flex'; };
    var closeModal = () => { backdrop.style.display = 'none'; };

    btn.addEventListener('click', async () => {
        var opening = backdrop.style.display !== 'flex';
        if (opening) openModal(); else closeModal();
        if (opening) {
            // Load fields if not loaded
            if (window.sfarcSmartFilterFields.length === 0) {
                try {
                    var desc = await window.sfApi.describeSObject('User');
                    window.sfarcSmartFilterFields = desc.fields.filter(f => f.filterable).sort((a, b) => a.label.localeCompare(b.label));
                } catch (e) {
                    console.error('Failed to describe User for smart filters', e);
                }
            }
            if (window.sfarcSmartFilters.length === 0) {
                renderFilterRows();
                addFilterRow();
            } else {
                renderFilterRows();
            }
        }
    });

    closeBtn.addEventListener('click', closeModal);

    // Clicking the dark backdrop (outside the dialog) dismisses the modal.
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closeModal();
    });

    // Esc closes the modal
    if (!window.__sfarcSmartFilterEscWired) {
        window.__sfarcSmartFilterEscWired = true;
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && backdrop.style.display === 'flex') closeModal();
        });
    }

    function renderFilterRows() {
        rowsContainer.innerHTML = '';
        window.sfarcSmartFilters.forEach((f, idx) => {
            var row = document.createElement('div');
            row.className = 'sfarc-filter-row';

            var logicHtml = '';
            if (idx > 0) {
                logicHtml = `<select class="sfarc-filter-select sfarc-filter-logic" style="width: 60px; flex-shrink: 0;"><option value="AND" ${f.logicType === 'AND' ? 'selected' : ''}>AND</option><option value="OR" ${f.logicType === 'OR' ? 'selected' : ''}>OR</option></select>`;
            } else {
                logicHtml = `<div style="width: 60px; flex-shrink: 0;"></div>`;
            }

            var fieldHtml = `<select class="sfarc-filter-select sfarc-filter-field" style="flex: 1; min-width: 0;"><option value="">Select Field...</option>`;
            window.sfarcSmartFilterFields.forEach(field => {
                fieldHtml += `<option value="${field.name}" data-type="${field.type}" ${f.field === field.name ? 'selected' : ''}>${field.label}</option>`;
            });
            fieldHtml += `</select>`;

            var opHtml = `<select class="sfarc-filter-select sfarc-filter-op" style="width: 80px; flex-shrink: 0;">
                <option value="=" ${f.operator === '=' ? 'selected' : ''}>Equals</option>
                <option value="!=" ${f.operator === '!=' ? 'selected' : ''}>Not Equals</option>
                <option value="LIKE" ${f.operator === 'LIKE' ? 'selected' : ''}>Contains</option>
            </select>`;

            var valHtml = `<input type="text" class="sfarc-filter-input sfarc-filter-val" value="${f.value || ''}" style="flex: 1; min-width: 0;" placeholder="Value...">`;
            if (f.field) {
                var fieldMeta = window.sfarcSmartFilterFields.find(x => x.name === f.field);
                if (fieldMeta) {
                    if (fieldMeta.type === 'boolean') {
                        valHtml = `<select class="sfarc-filter-select sfarc-filter-val" style="flex: 1; min-width: 0;">
                            <option value="true" ${f.value === 'true' ? 'selected' : ''}>True</option>
                            <option value="false" ${f.value === 'false' ? 'selected' : ''}>False</option>
                        </select>`;
                    } else if (fieldMeta.type === 'picklist') {
                        valHtml = `<select class="sfarc-filter-select sfarc-filter-val" style="flex: 1; min-width: 0;"><option value="">Select Value...</option>`;
                        fieldMeta.picklistValues.forEach(pv => {
                            if (pv.active) valHtml += `<option value="${pv.value}" ${f.value === pv.value ? 'selected' : ''}>${pv.label}</option>`;
                        });
                        valHtml += `</select>`;
                    }
                }
            }

            row.innerHTML = `
                ${logicHtml}
                ${fieldHtml}
                ${opHtml}
                ${valHtml}
                <button class="sfarc-filter-del" ><i class="fa-regular fa-trash-can"></i></button>
            `;

            // Events
            var fieldSel = row.querySelector('.sfarc-filter-field');
            fieldSel.addEventListener('change', (e) => {
                f.field = e.target.value;
                var fieldMeta = window.sfarcSmartFilterFields.find(x => x.name === f.field);
                f.type = fieldMeta ? fieldMeta.type : 'string';
                f.value = ''; // reset value on field change
                renderFilterRows();
            });

            row.querySelector('.sfarc-filter-del').addEventListener('click', () => {
                window.sfarcSmartFilters.splice(idx, 1);
                renderFilterRows();
            });

            var valInput = row.querySelector('.sfarc-filter-val');
            if (valInput) {
                // Immediately sync the current (pre-selected) value so apply works without user interaction
                if (f.value === '' || f.value === undefined) {
                    f.value = valInput.value;
                }
                valInput.addEventListener('change', (e) => f.value = e.target.value);
            }

            var opInput = row.querySelector('.sfarc-filter-op');
            if (opInput) opInput.addEventListener('change', (e) => f.operator = e.target.value);

            var logicInput = row.querySelector('.sfarc-filter-logic');
            if (logicInput) logicInput.addEventListener('change', (e) => f.logicType = e.target.value);

            rowsContainer.appendChild(row);
        });
    }

    function addFilterRow() {
        window.sfarcSmartFilters.push({ field: '', operator: '=', value: '', logicType: 'AND', type: 'string' });
        renderFilterRows();
    }

    addBtn.addEventListener('click', addFilterRow);

    clearBtn.addEventListener('click', () => {
        window.sfarcSmartFilters = [];
        renderFilterRows();
        applyFilters();
    });

    applyBtn.addEventListener('click', () => {
        closeModal();
        applyFilters();
    });

    function applyFilters() {
        // filter out empty rows
        window.sfarcSmartFilters = window.sfarcSmartFilters.filter(f => f.field && (f.value !== '' || f.type === 'boolean'));

        // Update badge and icon color
        var badge = document.getElementById('sfarc-smart-filter-badge');
        var iconBtn = document.getElementById('sfarc-smart-filter-btn');
        if (badge && iconBtn) {
            var count = window.sfarcSmartFilters.length;
            if (count > 0) {
                badge.style.display = 'flex';
                badge.innerText = count;
                iconBtn.style.color = 'var(--primary-color)';
            } else {
                badge.style.display = 'none';
                iconBtn.style.color = 'var(--sfarc-text-primary)';
            }
        }

        // trigger search
        var query = document.getElementById('sfarc-global-search').value.trim().toLowerCase();
        if (window.executeSplitViewSearch) {
            window.executeSplitViewSearch(query);
        }
    }
};

function routeSearchQuery(query, isEnter) {
    if (!window.globalSearchContext) return;
    var tab = window.globalSearchContext.id;

    if (tab === 'objects') {
        if (window.sfarcObjectTabState) window.sfarcObjectTabState.query = query;
        if (window.executeObjectSearch) window.executeObjectSearch(query);
    } else if (tab === 'users' || tab === 'shortcuts' || tab === 'flows') {
        if (window.executeSplitViewSearch) {
            window.executeSplitViewSearch(query);
        }
    } else if (tab === 'lwc') {
        if (window.filterLwcList) window.filterLwcList(query);
    } else if (tab === 'metadata') {
        var typeInput = document.getElementById('sfarc-meta-type-search');
        if (typeInput) {
            typeInput.value = query;
            typeInput.dispatchEvent(new Event('input'));
        }
    } else if (tab === 'security') {
        var secInput = document.getElementById('sfarc-sec-name');
        if (secInput) {
            secInput.value = query;
            if (isEnter) {
                var searchBtn = document.getElementById('sfarc-sec-search-btn');
                if (searchBtn) searchBtn.click();
            }
        }
    } else if (tab.startsWith('shortcut_live_')) {
        var liveInput = document.getElementById('sfarc-live-search');
        if (liveInput) {
            liveInput.value = query;
            liveInput.dispatchEvent(new Event('input'));
        }
    } else if (tab === 'code-search') {
        if (isEnter) {
            if (window.executeCodeSearch) window.executeCodeSearch(query);
        }
    }
}



// Expansion paths (DevTools, Debug Logs, Org) widen the popup by setting
// inline !important width/min-width/max-width. They share one state machine so
// rapid tab switching can't desync the captured original cssText, and the
// restore in hideAllContainers() removes exactly what they set.
function sfarcExpandPopupContainer(props) {
    var popupContainer = document.querySelector('.sfarc-popup-container');
    if (!popupContainer) return;
    if (popupContainer.dataset.expanded !== 'true') {
        popupContainer.dataset.originalCssText = popupContainer.style.cssText || '';
        popupContainer.dataset.expanded = 'true';
    }
    Object.entries(props).forEach(([prop, value]) => {
        popupContainer.style.setProperty(prop, value, 'important');
    });
}

async function loadTabContent(tab, preserveSearch = false) {
    currentTab = tab;
    if (logAutoRefreshTimer) {
        clearInterval(logAutoRefreshTimer);
        logAutoRefreshTimer = null;
    }
    var suggestions = document.getElementById('sfarc-suggestions');
    var recent = document.getElementById('sfarc-recent');
    var searchInput = document.getElementById('sfarc-search');
    var searchContainer = document.querySelector('.sfarc-search-container');

    // Toggle Containers
    var suggestionsContainer = document.getElementById('sfarc-suggestions-container');
    var flowContainer = document.getElementById('sfarc-flow-monitor');
    var devToolsContainer = document.getElementById('sfarc-devtools-container');
    var debugLogsContainer = document.getElementById('sfarc-debug-logs-view');
    var metadataContainer = document.getElementById('sfarc-metadata-container');
    var securityContainer = document.getElementById('sfarc-security-container');

    // Helper to hide all specific containers
    var hideAllContainers = () => {
        if (suggestionsContainer) suggestionsContainer.style.display = 'none';
        if (flowContainer) flowContainer.style.display = 'none';
        if (devToolsContainer) devToolsContainer.style.display = 'none';
        if (debugLogsContainer) debugLogsContainer.style.display = 'none';
        if (metadataContainer) metadataContainer.style.display = 'none';
        if (securityContainer) securityContainer.style.display = 'none';
        var bulkContainer = document.getElementById('sfarc-bulk-updater-container');
        if (bulkContainer) bulkContainer.style.display = 'none';
        var codeSearchContainer = document.getElementById('sfarc-code-search-container');
        if (codeSearchContainer) codeSearchContainer.style.display = 'none';
        var bulkFieldContainer = document.getElementById('sfarc-bulk-field-container');
        if (bulkFieldContainer) bulkFieldContainer.style.display = 'none';
        var homeView = document.getElementById('sfarc-home-view');
        if (homeView) homeView.style.display = 'none';
        var lwcContainer = document.getElementById('sfarc-lwc-container');
        if (lwcContainer) lwcContainer.style.display = 'none';

        // Restore/minimize popup size if it was expanded. Surgical restore:
        // remove exactly the properties the expansion paths set — including
        // min-width, which the old code skipped, so visiting DevTools once
        // left the popup stuck at its 780px minimum on every other tab. Never
        // rewrite the whole inline cssText (that would also drop the
        // width/height transition from the panel markup).
        var popupContainer = document.querySelector('.sfarc-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('sfarc-code-search-expanded');
            if (popupContainer.dataset.expanded === 'true') {
                if (popupContainer.dataset.originalCssText) {
                    popupContainer.style.cssText = popupContainer.dataset.originalCssText;
                }
                ['width', 'max-width', 'min-width', 'height', 'min-height', 'max-height'].forEach(prop => {
                    popupContainer.style.removeProperty(prop);
                });
                popupContainer.dataset.expanded = 'false';
            }
        }
    };


    // if (tab === 'flows') removed to use standard split view
    if (tab === 'devtools') {
        hideAllContainers();
        if (devToolsContainer) devToolsContainer.style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'none';

        // Set dynamic width for Developer Tools as per data on table
        sfarcExpandPopupContainer({ width: 'max-content', 'min-width': '780px', 'max-width': '92vw' });

        await loadDevToolsContent();
        return;
    } else if (tab === 'debug-logs') {
        hideAllContainers();
        if (debugLogsContainer) debugLogsContainer.style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'none';

        // Expand width for Debug Logs for better data table viewing.
        // Use a FIXED width (not fit-content) so the popup never resizes when
        // the table re-renders (refresh, page switch, row count change).
        sfarcExpandPopupContainer({ width: 'clamp(760px, 80vw, 1180px)', 'max-width': 'calc(100vw - 60px)', 'min-width': 'auto' });

        await loadDebugLogsContent();
        var refreshSeconds = Number(settings.logRefresh) || 0;
        if (refreshSeconds > 0) {
            logAutoRefreshTimer = setInterval(() => {
                if (currentTab === 'debug-logs' && !document.hidden) fetchDebugLogs();
            }, Math.max(5, refreshSeconds) * 1000);
        }
        return;
    } else if (tab === 'metadata') {
        hideAllContainers();
        if (metadataContainer) metadataContainer.style.display = 'flex'; // It's flex column
        if (searchContainer) searchContainer.style.display = 'none';
        await window.loadMetadataContent();
        return;
    } else if (tab === 'security') {
        hideAllContainers();
        if (securityContainer) securityContainer.style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'none';
        if (!window.securityEventsBound) {
            bindSecurityEvents();
            window.securityEventsBound = true;
        }
        return;
    } else if (tab === 'bulk-updater') {
        // Bulk Permission Wizard always opens in its own browser tab as a
        // standalone page — never inside the code editor or the Salesforce-
        // page panel (the wizard needs full width to be usable).
        var host = window.location.hostname;
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'bulk-permission-wizard',
            params: { host: host }
        });
        return;
    } else if (tab === 'bulk-field' || tab === 'bulk-field-builder') {
        var host = window.location.hostname;
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'bulk-field-builder',
            params: { host: host }
        });
        return;
    } else if (tab === 'record-clone') {
        var host = window.location.hostname;
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'record-clone',
            params: { host: host }
        });
        return;
    } else if (tab === 'event-monitor') {
        var host = window.location.hostname;
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'event-monitor',
            params: { host: host }
        });
        return;
    } else if (tab === 'code-coverage') {
        var host = window.location.hostname;
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'code-coverage',
            params: { host: host }
        });
        return;
    } else if (tab === 'anon-apex') {
        hideAllContainers();
        var anonContainer = document.getElementById('sfarc-anon-apex-container');
        if (anonContainer) anonContainer.style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'none';

        // Expand popup for Anonymous Apex
        var popupContainerAnon = document.querySelector('.sfarc-popup-container');
        if (popupContainerAnon) popupContainerAnon.classList.add('sfarc-code-search-expanded');

        if (!window.anonApexEventsBound) {
            bindAnonApexEvents();
            window.anonApexEventsBound = true;
        }
    } else if (tab === 'code-search') {
        hideAllContainers();
        var codeSearchContainer = document.getElementById('sfarc-code-search-container');
        if (codeSearchContainer) codeSearchContainer.style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'none';
        // Expand popup width for code search
        var popupContainerCs = document.querySelector('.sfarc-popup-container');
        if (popupContainerCs) popupContainerCs.classList.add('sfarc-code-search-expanded');
        if (!window.codeSearchEventsBound) {
            if (window.initCodeSearch) window.initCodeSearch();
            window.codeSearchEventsBound = true;
        }
        return;
    } else if (tab === 'lwc') {
        hideAllContainers();
        var lwcContainer = document.getElementById('sfarc-lwc-container');
        if (lwcContainer) lwcContainer.style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'none';

        await loadLwcContent();

        return;
    } else {
        // Standard tabs (Objects, Users, Shortcuts, Org)
        hideAllContainers();
        if (suggestionsContainer) suggestionsContainer.style.display = 'flex';
    }

    // Clear current view
    // Show loader
    suggestions.innerHTML = getLoaderHtml();

    // Deactivate previous
    document.querySelector('.sfarc-tab-btn.active')?.classList.remove('active');
    if (recent) recent.style.display = 'none';

    var isSplitView = ['objects', 'users', 'shortcuts', 'flows'].includes(tab);

    if (isSplitView) {
        suggestions.classList.add('sfarc-split-view-container');
        suggestions.style.padding = '0'; // Remove padding from container to let split view fill
    } else {
        suggestions.classList.remove('sfarc-split-view-container');
        suggestions.style.padding = ''; // Restore
    }


    if (!preserveSearch && searchInput) {
        searchInput.value = '';
    }

    try {
        var items = [];

        if (tab === 'objects') {
            initObjectNavigator(suggestions);
            return;
        } else if (tab === 'users') {

            // For users, we'll load recent/active users initially
            // Added extra fields for the new UI (Role, License, Photo, etc.)
            var query = "SELECT Id, Name, Username, Email, Profile.Name, Profile.UserLicense.Name, UserRole.Name, IsActive, SmallPhotoUrl FROM User WHERE IsActive = true ORDER BY LastLoginDate DESC NULLS LAST LIMIT 20";
            var result = await window.sfApi.query(query);

            items = result.records;
            renderSplitView(items, 'users');
            return;
        } else if (tab === 'flows') {
            items = await fetchFlowInterviews();
            renderSplitView(items, 'flows');
            return;
        } else if (tab === 'devtools') {
            await loadDevToolsContent();
            return;
        } else if (tab === 'metadata') {
            openInNewTab('metadata-exporter');
            return;
        } else if (tab.startsWith('shortcut_live_')) {
            var label = tab.replace('shortcut_live_', '');
            var shortcut = window.sfarcShortcuts.find(s => s.label === label);
            if (shortcut) {
                suggestions.innerHTML = '<div id="sfarc-split-detail-container" style="height: 100%; width: 100%;"></div>';
                suggestions.classList.add('sfarc-split-view-container');
                suggestions.style.padding = '0';
                renderSplitDetails(shortcut, 'shortcuts-live');
            }
            return;
        } else if (tab === 'org') {
            // Expand popup width for better readability of org info
            sfarcExpandPopupContainer({ width: '90vw', 'max-width': '90vw' });
            // Fetch real org data
            if (!searchCache.orgData) {
                try {
                    // Fetch organization info
                    var orgQuery = "SELECT Id, Name, InstanceName, OrganizationType, IsSandbox, TrialExpirationDate FROM Organization LIMIT 1";
                    var orgResult = await window.sfApi.query(orgQuery);
                    var org = orgResult.records[0];

                    // Get API version from the instance
                    var instanceUrl = window.location.origin;
                    var apiVersion = '65.0'; // Default, can be detected from API responses

                    searchCache.orgData = {
                        orgId: org.Id,
                        orgName: org.Name,
                        instance: org.InstanceName || instanceUrl.split('.')[0].split('//')[1],
                        type: org.IsSandbox ? 'Sandbox' : (org.OrganizationType || 'Production'),
                        status: org.TrialExpirationDate ? 'Trial' : 'Active',
                        apiVersion: apiVersion,
                        instanceUrl: instanceUrl
                    };
                } catch (err) {
                    console.error('Error fetching org data:', err);
                    searchCache.orgData = null;
                }
            }

            // Display org info as a single card
            if (searchCache.orgData) {
                renderOrgInfo(searchCache.orgData);
                return;
            } else {
                suggestions.innerHTML = friendlyFetchError(new Error('Unable to load org information'), null);
                return;
            }
        } else if (tab === 'shortcuts') {
            // Define comprehensive Salesforce shortcuts/quick links
            // Definitions moved to window.sfarcShortcuts globally
            searchCache.shortcuts = window.sfarcShortcuts;
            items = searchCache.shortcuts;
            renderSplitView(items, 'shortcuts');
            return;
        }

        renderSuggestions(items, tab);
    } catch (err) {
        suggestions.innerHTML = friendlyFetchError(err, null);
    }
}

async function handleSearch(e) {
    var query = e.target.value.trim();
    var lowerQuery = query.toLowerCase();
    var suggestions = document.getElementById('sfarc-suggestions');

    if (!query && currentTab === 'objects') {
        renderSuggestions(searchCache.objects || [], currentTab);
        return;
    }

    suggestions.innerHTML = '<div class="sfarc-loading">Searching...</div>';

    try {
        var results = [];

        // Check for special search prefixes
        if (lowerQuery.startsWith('apex:')) {
            var searchTerm = query.substring(5).trim();
            if (searchTerm.length >= 2) {
                var apexResults = await searchApexCode(searchTerm);
                renderGlobalSearchResults({ flows: [], lwc: [], apex: apexResults });
                return;
            }
        } else if (lowerQuery.startsWith('flow:')) {
            var searchTerm = query.substring(5).trim();
            if (searchTerm.length >= 2) {
                var flowResults = await searchFlows(searchTerm);
                renderGlobalSearchResults({ flows: flowResults, lwc: [], apex: [] });
                return;
            }
        } else if (lowerQuery.startsWith('lwc:')) {
            var searchTerm = query.substring(4).trim();
            if (searchTerm.length >= 2) {
                var lwcResults = await searchLWC(searchTerm);
                renderGlobalSearchResults({ flows: [], lwc: lwcResults, apex: [] });
                return;
            }
        } else if (lowerQuery.startsWith('all:')) {
            // Search all code types
            var searchTerm = query.substring(4).trim();
            if (searchTerm.length >= 2) {
                var globalResults = await enhancedGlobalSearch(searchTerm);
                renderGlobalSearchResults(globalResults);
                return;
            }
        }

        if (currentTab === 'objects') {
            // Filter cached objects
            if (searchCache.objects) {
                results = searchCache.objects.filter(obj =>
                    obj.name.toLowerCase().includes(lowerQuery) ||
                    obj.label.toLowerCase().includes(lowerQuery)
                );
            }
        } else if (currentTab === 'users') {
            if (query.length < 2) {
                // Show default list if query is too short
                loadTabContent('users', true);
                return;
            }
            // Real-time SOQL for users
            var soql = `SELECT Id, Name, Username, Email, Profile.Name, Alias, LanguageLocaleKey, IsActive FROM User WHERE Name LIKE '%${query}%' OR Username LIKE '%${query}%' LIMIT 20`;
            var data = await window.sfApi.query(soql);
            results = data.records;
        } else if (currentTab === 'shortcuts') {
            // Filter shortcuts by label or category
            results = searchCache.shortcuts.filter(shortcut =>
                shortcut.label.toLowerCase().includes(lowerQuery) ||
                shortcut.category.toLowerCase().includes(lowerQuery)
            );
        }

        renderSuggestions(results, currentTab);
    } catch (err) {
        suggestions.innerHTML = friendlyFetchError(err, null);
    }
}

function renderOrgInfo(orgData) {
    var container = document.getElementById('sfarc-suggestions');

    container.innerHTML = `
        <div class="sfarc-org-container" style="padding: 5px; display: flex; flex-direction: column; gap: 8px; height: 100%; box-sizing: border-box; min-height: 0;">
            <div class="sfarc-org-header" style="background: var(--bg-panel); padding: 5px; border-radius: 8px; border: none; box-shadow: none; flex-shrink: 0;">
                <h3 class="sfarc-org-title" style="margin-top: 0; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                    <i class="fa-solid fa-building-columns" style="color: var(--primary-color);"></i>
                    Organization Information
                </h3>
                
                <div class="sfarc-org-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                    ${renderDetailItem('Org Id', orgData.orgId, true)}
                    ${renderDetailItem('Instance', orgData.instance)}
                    ${renderDetailItem('Type', orgData.type)}
                    ${renderDetailItem('Status', orgData.status, false, true)}
                    ${renderDetailItem('API Version', orgData.apiVersion)}
                    ${renderDetailItem('Name', orgData.orgName)}
                </div>

                <div class="sfarc-org-tabs">
                    <a class="sfarc-org-tab active" href="${orgData.instanceUrl}/lightning/setup/CompanyProfileInfo/home" target="_blank">Company Info</a>
                    <a class="sfarc-org-tab" href="${orgData.instanceUrl}/lightning/setup/SecurityHealth/home" target="_blank">Security Health</a>
                    <a class="sfarc-org-tab" href="${orgData.instanceUrl}/lightning/setup/SystemOverview/home" target="_blank">System Overview</a>
                </div>
            </div>

            <div class="sfarc-org-limits-section" style="background: var(--bg-panel); padding: 5px; border-radius: 8px; border: none; box-shadow: none; flex: 1; min-height: 0; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                    <h4 style="margin: 0; font-size: 13.5px; color: var(--text-color); display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-gauge-high" style="color: var(--sfarc-accent, #2196f3);"></i>
                        Organization Limits
                    </h4>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="position: relative; width: 180px;">
                            <input type="text" id="sfarc-limits-search" class="sfarc-org-search" placeholder="Search limits..." autocomplete="off">
                        </div>
                        <button id="sfarc-refresh-limits" class="sfarc-org-refresh">
                            <i class="fa-solid fa-rotate"></i> Refresh
                        </button>
                    </div>
                </div>
                <div id="sfarc-org-limits-list" style="flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; padding-right: 5px;">
                    <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-gray);">
                        <span class="comet-loader-inline"></span>
                        <p style="margin-top: 10px;">Loading organization limits...</p>
                    </div>
                <div class="sfarc-footer-actions" style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                    <button class="sfarc-footer-btn" id="sfarc-data-import"  style="display: flex; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 12px; font-weight: 500; transition: color 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 11V3M8 11L5 8M8 11L11 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="sfarc-header-btn-label">Import</span>
                    </button>
                    <button class="sfarc-footer-btn" id="sfarc-data-export"  style="display: flex; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer; color: var(--sfarc-secondary-text); font-size: 12px; font-weight: 500; transition: color 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 3V11M8 3L5 6M8 3L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="sfarc-header-btn-label">Export</span>
                    </button>
                </div>
                </div>
            </div>
        </div>
    `;

    function renderDetailItem(label, value, isMonospace = false, isStatus = false) {
        var content = escapeHtml(value);

        if (isStatus) {
            var statusClass = (value || 'active').toLowerCase();
            return `
                <div class="sfarc-org-item">
                    <span class="sfarc-org-label">${label}</span>
                    <span class="sfarc-status-pill ${statusClass}">${content}</span>
                </div>
            `;
        }

        return `
            <div class="sfarc-org-item" title="${content}">
                <span class="sfarc-org-label">${label}</span>
                <span class="sfarc-org-value${isMonospace ? ' mono' : ''}">${content}</span>
            </div>
        `;
    }

    // Attach search listener
    var searchInput = document.getElementById('sfarc-limits-search');
    if (searchInput && !searchInput.dataset.listenerBound) {
        searchInput.dataset.listenerBound = 'true';
        searchInput.addEventListener('input', (e) => {
            var term = e.target.value.toLowerCase().trim();
            var cards = document.querySelectorAll('#sfarc-org-limits-list .sfarc-limit-card');
            cards.forEach(card => {
                var name = card.dataset.limitName || '';
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    }

    // Attach refresh listener
    var refreshBtn = document.getElementById('sfarc-refresh-limits');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadOrgLimits);
    }

    // Initial load
    loadOrgLimits();
}

async function loadOrgLimits() {
    var list = document.getElementById('sfarc-org-limits-list');
    if (!list) return;

    // Show loading if not first time
    if (list.childElementCount > 1) {
        list.style.opacity = '0.7';
    }

    try {
        var res = await window.sfApi.fetch(`/services/data/v${settings.apiVersion || '60.0'}/limits`);
        var limits = await res.json();
        var sortedKeys = Object.keys(limits).sort();

        list.style.opacity = '1';
        list.innerHTML = '';
        var searchVal = document.getElementById('sfarc-limits-search')?.value.toLowerCase().trim() || '';

        sortedKeys.forEach(name => {
            var limit = limits[name];
            var used = limit.Max - limit.Remaining;
            var percent = Math.round((used / limit.Max) * 100) || 0;

            var color = '#10b981'; // Green (Standard SF Green)
            if (percent > 70) color = '#f59e0b'; // Amber
            if (percent > 90) color = '#ef4444'; // Red
            var neutral = percent === 0;

            var card = document.createElement('div');
            card.className = 'sfarc-limit-card';
            card.dataset.limitName = name.toLowerCase();
            card.style.display = (searchVal && !name.toLowerCase().includes(searchVal)) ? 'none' : 'flex';
            card.innerHTML = `
                <div class="sfarc-limit-head">
                    <span class="sfarc-limit-name" title="${name}">${name}</span>
                    <span class="sfarc-limit-pct${neutral ? ' neutral' : ''}" style="${neutral ? '' : `color: ${color};`}">${percent}%</span>
                </div>
                <div class="sfarc-limit-bar">
                    <div class="sfarc-limit-fill" style="width: ${percent}%; background: ${color};"></div>
                </div>
                <div class="sfarc-limit-vals">
                    <span>${used.toLocaleString()} / ${limit.Max.toLocaleString()}</span>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        list.style.opacity = '1';
        list.innerHTML = friendlyFetchError(e, null);
    }
}

// Fetch complete record data
async function fetchCompleteRecordData(objectType, recordId) {
    try {
        // Use sfApi to describe the object
        var describe = await window.sfApi.describeSObject(objectType);

        // Build SOQL with all fields
        var fields = describe.fields.map(f => f.name).join(',');
        var query = `SELECT ${fields} FROM ${objectType} WHERE Id = '${recordId}'`;

        // Query the record
        var result = await window.sfApi.query(query);

        if (!result.records || result.records.length === 0) {
            throw new Error('Record not found');
        }

        return {
            objectType: objectType,
            objectLabel: describe.label,
            recordId: recordId,
            fields: describe.fields,
            record: result.records[0],
            updateable: describe.updateable,
            createable: describe.createable,
            instanceUrl: window.location.origin
        };
    } catch (error) {
        console.error('Error fetching record data:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────
// PASTE-A-RECORD-ID INSPECTOR — pasting any record ID into the
// global search bar instantly shows every field + its value.
// ─────────────────────────────────────────────────────────────
window.sfarcIdPrefixMap = window.sfarcIdPrefixMap || {};

// Seed the well-known standard ID prefixes so the most common record lookups
// (Account 001…, Contact 003…, User 005…, etc.) resolve instantly without
// probing every object in the org. Existing persisted entries are kept.
(function seedSfarcIdPrefixMap() {
    var standard = {
        '001': 'Account',
        '003': 'Contact',
        '005': 'User',
        '006': 'Opportunity',
        '00Q': 'Lead',
        '00T': 'Task',
        '00U': 'Event',
        '00D': 'Organization',
        '012': 'RecordType',
        '500': 'Case',
        '701': 'Campaign',
        'a00': 'Idea',
        '01t': 'Product2',
        '01s': 'Pricebook2',
        '01p': 'PricebookEntry'
    };
    for (const p in standard) {
        if (!(p in window.sfarcIdPrefixMap)) window.sfarcIdPrefixMap[p] = standard[p];
    }
})();

var sfarcSobjectsCache = null;
var sfarcSobjectsCacheTime = 0;
var sfarcRecordInspectorToken = 0;

// Load the persisted ID-prefix → object map (first 3 chars of a
// 15-char ID identify the object). Repeat lookups are instant.
try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfarcIdPrefixMap'], (res) => {
            if (res && res.sfarcIdPrefixMap) window.sfarcIdPrefixMap = res.sfarcIdPrefixMap;
        });
    }
} catch (e) { }

function sfarcPersistPrefixMap() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarcIdPrefixMap: window.sfarcIdPrefixMap });
        }
    } catch (e) { }
}

// Extract a Salesforce record ID (and the object name, when the pasted text is
// a /lightning/r/<Obj>/<id>/view URL) from pasted text.
function sfarcExtractRecordInfo(text) {
    if (!text) return null;
    var trimmed = text.trim();
    if (/^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/.test(trimmed)) {
        return { id: trimmed, objectType: null };
    }
    var urlMatch = trimmed.match(/\/lightning\/r\/([A-Za-z0-9_]+)\/([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)\/view/);
    if (urlMatch) {
        return { id: urlMatch[2], objectType: urlMatch[1] };
    }
    var idMatch = trimmed.match(/\b([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)\b/);
    return idMatch ? { id: idMatch[1], objectType: null } : null;
}

// Backward-compatible: just the record ID.
function sfarcExtractRecordId(text) {
    var info = sfarcExtractRecordInfo(text);
    return info ? info.id : null;
}

// Cached global list of queryable objects.
async function sfarcGetSobjects() {
    var now = Date.now();
    if (sfarcSobjectsCache && now - sfarcSobjectsCacheTime < 5 * 60 * 1000) return sfarcSobjectsCache;
    try {
        var res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/sobjects`);
        var json = await res.json();
        var list = (json && json.sobjects) ? json.sobjects.filter(o => o && o.queryable && o.name) : [];
        sfarcSobjectsCache = list;
        sfarcSobjectsCacheTime = now;
        return list;
    } catch (e) {
        return sfarcSobjectsCache || [];
    }
}

// Determine which object a record ID belongs to. Persisted-prefix
// cache for instant repeats; on a miss it probes queryable objects
// through composite batches (custom objects first, 4 parallel) and
// stops at the first object that answers with the record.
async function sfarcResolveObjectForId(id, hint) {
    var id15 = (id || '').slice(0, 15);
    if (id15.length !== 15) return null;
    var prefix = id15.slice(0, 3);
    if (window.sfarcIdPrefixMap[prefix]) return window.sfarcIdPrefixMap[prefix];

    // URL hint (e.g. /lightning/r/Account/<id>/view) — verify it in one cheap
    // query instead of probing every object in the org.
    if (hint && /^[A-Za-z_]\w*$/.test(hint)) {
        var v = window.sfApi && window.sfApi.apiVersion;
        if (v) {
            try {
                var res = await window.sfApi.fetch(`/services/data/${v}/query?q=${encodeURIComponent(`SELECT Id FROM ${hint} WHERE Id = '${id15}' LIMIT 1`)}`);
                if (res && res.ok) {
                    var json = await res.json();
                    if (json && json.totalSize > 0 && json.records && json.records.length > 0) {
                        window.sfarcIdPrefixMap[prefix] = hint;
                        sfarcPersistPrefixMap();
                        return hint;
                    }
                }
            } catch (e) { }
        }
    }

    var sobjects = await sfarcGetSobjects();
    var candidates = sobjects
        .map(o => o.name)
        .sort((a, b) => ((b.endsWith('__c') ? 1 : 0) - (a.endsWith('__c') ? 1 : 0)));

    var v = window.sfApi.apiVersion;
    var chunks = [];
    for (let i = 0; i < candidates.length; i += 25) chunks.push(candidates.slice(i, i + 25));

    var found = null;

    async function tryBatch(objects) {
        if (found) return;
        var reqs = objects.map(name => ({
            method: 'GET',
            url: `/services/data/${v}/query?q=${encodeURIComponent(`SELECT Id FROM ${name} WHERE Id = '${id}' LIMIT 1`)}`
        }));
        try {
            var res = await window.sfApi.fetch(`/services/data/${v}/composite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allOrNone: false, compositeRequest: reqs })
            });
            if (!res || !res.ok) return;
            var json = await res.json();
            var list = (json && json.compositeResponse) || [];
            for (let i = 0; i < list.length; i++) {
                var r = list[i];
                if (r.httpStatusCode >= 200 && r.httpStatusCode < 300 && r.body && r.body.records && r.body.records.length > 0) {
                    found = objects[i];
                    window.sfarcIdPrefixMap[prefix] = found;
                    sfarcPersistPrefixMap();
                    return;
                }
            }
        } catch (e) { }
    }

    var workers = [];
    for (let w = 0; w < 4; w++) {
        workers.push((async () => {
            for (let i = w; i < chunks.length; i += 4) {
                if (found) break;
                await tryBatch(chunks[i]);
            }
        })());
    }
    await Promise.all(workers);
    return found;
}

// Format a field value for the inspector table.
function sfarcFormatFieldValue(field, value, instanceUrl) {
    if (value === null || value === undefined || value === '') {
        return '<span style="color: var(--sfarc-secondary-text, #94a3b8);">—</span>';
    }
    if (typeof value === 'boolean') {
        return value
            ? '<span style="color: #16a34a; font-weight: 500;">✓ true</span>'
            : '<span style="color: #dc2626; font-weight: 500;">✗ false</span>';
    }
    if (field.type === 'reference' && field.referenceTo && field.referenceTo.length && typeof value === 'string') {
        var target = field.referenceTo[0];
        return `<a href="${instanceUrl}/lightning/r/${target}/${value}/view" target="_blank" rel="noopener" style="color: var(--primary-color, var(--sfarc-accent-glow, var(--sfarc-accent-glow, #38bdf8))); text-decoration: none; font-weight: 500;">${escapeHtml(value)}</a>`;
    }
    if ((field.type === 'date' || field.type === 'datetime') && typeof value === 'string') {
        var d = new Date(value);
        if (!isNaN(d.getTime())) return escapeHtml(d.toLocaleString());
    }
    if (typeof value === 'object') {
        try { return escapeHtml(JSON.stringify(value)); } catch (e) { return String(value); }
    }
    return escapeHtml(String(value));
}

// Render the record inspector (all fields + values) into a container.
function renderRecordInspector(container, id, objectTypeHint) {
    var token = ++sfarcRecordInspectorToken;

    container.innerHTML = `
        <div style="padding: 10px 12px; font-size: 12px; color: var(--sfarc-secondary-text, #888); display: flex; align-items: center; gap: 8px;">
            <span class="comet-loader-inline"></span>
            <span>Resolving object type for <strong style="color: var(--text-color); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(id)}</strong>…</span>
        </div>`;

    (async () => {
        if (token !== sfarcRecordInspectorToken) return;
        var objectType = null;
        try {
            objectType = await sfarcResolveObjectForId(id, objectTypeHint);
        } catch (e) {
            objectType = null;
        }
        if (token !== sfarcRecordInspectorToken) return;

        if (!objectType) {
            container.innerHTML = `
                <div style="padding: 32px 16px; text-align: center;">
                    <div style="width: 44px; height: 44px; margin: 0 auto 12px; border-radius: 50%; background: var(--sfarc-muted-bg, rgba(148, 163, 184, 0.12)); display: flex; align-items: center; justify-content: center; color: var(--sfarc-secondary-text, #94a3b8);">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 18px;"></i>
                    </div>
                    <div style="font-size: 13px; font-weight: 500; color: var(--text-color);">No record found</div>
                    <div style="font-size: 12px; color: var(--sfarc-secondary-text, #888); margin-top: 4px; max-width: 300px; margin-left: auto; margin-right: auto; line-height: 1.5;">Could not find any object containing the ID <code style="font-family: ui-monospace, Menlo, monospace; word-break: break-all;">${escapeHtml(id)}</code>.</div>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="padding: 10px 12px; font-size: 12px; color: var(--sfarc-secondary-text, #888); display: flex; align-items: center; gap: 8px;">
                <span class="comet-loader-inline"></span>
                <span>Fetching all fields for <strong style="color: var(--text-color);">${escapeHtml(objectType)}</strong>…</span>
            </div>`;

        var data = null;
        try {
            data = await fetchCompleteRecordData(objectType, id);
        } catch (e) {
            data = null;
        }
        if (token !== sfarcRecordInspectorToken) return;

        if (!data) {
            container.innerHTML = `
                <div style="padding: 32px 16px; text-align: center;">
                    <div style="width: 44px; height: 44px; margin: 0 auto 12px; border-radius: 50%; background: rgba(245, 158, 11, 0.12); display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 18px;"></i>
                    </div>
                    <div style="font-size: 13px; font-weight: 500; color: var(--text-color);">Record unavailable</div>
                    <div style="font-size: 12px; color: var(--sfarc-secondary-text, #888); margin-top: 4px; max-width: 300px; margin-left: auto; margin-right: auto; line-height: 1.5;">The ${escapeHtml(objectType)} record <code style="font-family: ui-monospace, Menlo, monospace; word-break: break-all;">${escapeHtml(id)}</code> could not be retrieved — it may have been deleted or you may lack access.</div>
                </div>`;
            return;
        }

        var record = data.record || {};
        var name = (record.Name !== undefined && record.Name !== null) ? String(record.Name) : '';
        var rows = data.fields.map(f => {
            var val = record[f.name];
            return `
                <tr>
                    <td style="padding: 4px 10px; border-bottom: 1px solid var(--sfarc-border, #27272a); vertical-align: top; width: 200px;">
                        <div style="font-size: 12px; color: var(--text-color); font-weight: 500;">${escapeHtml(f.label || f.name)}</div>
                        <div style="font-size: 10.5px; color: var(--sfarc-secondary-text, #888); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(f.name)}</div>
                    </td>
                    <td style="padding: 4px 10px; border-bottom: 1px solid var(--sfarc-border, #27272a); vertical-align: top; width: 88px;">
                        <span style="display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 10px; font-weight: 500; background: rgba(var(--primary-color-rgb, 56, 189, 248), 0.12); color: var(--primary-color, var(--sfarc-accent-glow, var(--sfarc-accent-glow, #38bdf8))); text-transform: lowercase;">${escapeHtml(f.type)}</span>
                    </td>
                    <td style="padding: 4px 10px; border-bottom: 1px solid var(--sfarc-border, #27272a); vertical-align: top; font-size: 12px; color: var(--text-color); white-space: pre-wrap; word-break: break-all;">${sfarcFormatFieldValue(f, val, data.instanceUrl)}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="padding: 10px 12px; border-bottom: 1px solid var(--sfarc-border, #27272a); display: flex; align-items: center; gap: 10px;">
                <div style="width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: rgba(var(--primary-color-rgb, 56, 189, 248), 0.12); color: var(--primary-color, var(--sfarc-accent-glow, var(--sfarc-accent-glow, #38bdf8))); flex-shrink: 0;">
                    ${getIconHtml('fa-database')}
                </div>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 13px; font-weight: 500; color: var(--text-color); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${escapeHtml(data.objectLabel || objectType)}</span>
                        <span style="font-size: 10.5px; color: var(--sfarc-secondary-text, #888); font-family: ui-monospace, Menlo, monospace;">${escapeHtml(id)}</span>
                    </div>
                    <div style="font-size: 11.5px; color: var(--sfarc-secondary-text, #888); margin-top: 1px;">${escapeHtml(name)} · ${data.fields.length} fields</div>
                </div>
                <button data-sfarc-open-viewer="1"  style="background: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); color: var(--sfarc-accent-contrast, #fff); border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 500; cursor: pointer; flex-shrink: 0;">Open full viewer</button>
            </div>
            <div style="max-height: 320px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        var openBtn = container.querySelector('[data-sfarc-open-viewer]');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'record-viewer', params: { id: id, object: objectType } });
                    }
                } catch (e) { }
            });
        }
    })();
}

// Get Salesforce access token (kept for potential future use)
async function getSalesforceToken() {
    // Try to get from cookie
    var cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'sid') {
            return value;
        }
    }

    // Try to get from session storage
    var sessionId = sessionStorage.getItem('SalesforceId') ||
        sessionStorage.getItem('sid');
    if (sessionId) {
        return sessionId;
    }

    throw new Error('Unable to find Salesforce access token');
}
function escapeHtml(unsafe) {
    if (!unsafe || typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getEmptyStateHtml(message) {
    return `
        <div class="sfarc-empty-state-illustration" style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; min-height: 200px; padding: 24px 16px; text-align: center; color: var(--text-gray); font-family: var(--sfarc-font-family, sans-serif);">
            <div style="font-size: 13px; font-weight: 500; color: #64748b;">${escapeHtml(message)}</div>
        </div>
    `;
}

// Ensure init is only called once
var isInitialized = false;


function renderSuggestions(items, type) {
    var container = document.getElementById('sfarc-suggestions');

    if (!items || items.length === 0) {
        container.innerHTML = getEmptyStateHtml('No results found');
        return;
    }

    // Sort items A-Z
    items = [...items].sort((a, b) => {
        var nameA = a.label || a.name || '';
        var nameB = b.label || b.name || '';
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

    // Update container class for shortcuts layout
    container.className = type === 'shortcuts' ? 'sfarc-shortcuts-cloud' : '';

    container.innerHTML = items.slice(0, 50).map(item => {
        var label = item.label || item.Name;
        var subLabel = item.name || item.Username || '';
        var id = item.Id || '';

        if (type === 'users') {
            // ... (keep existing user card code) ...
            var profileName = item.Profile ? item.Profile.Name : 'Unknown Profile';
            var email = item.Email || '';
            var language = item.LanguageLocaleKey || '';
            var flag = getFlag(language);

            return `
                <div class="sfarc-suggestion-item sfarc-user-card"
                    data-id="${id}"
                    data-type="${type}"
                    data-api-name="${item.name || ''}">
                    <div class="sfarc-card-main">
                        <div class="sfarc-item-main">${escapeHtml(label)} <span style="font-weight:normal; color:#666">(${escapeHtml(item.Alias || '')})</span></div>
                        <div class="sfarc-item-sub">${escapeHtml(subLabel)}</div>
                    </div>

                    <div class="sfarc-card-details">
                        <div class="sfarc-detail-row">
                            <span class="sfarc-label">E-mail:</span>
                            <a href="mailto:${escapeHtml(email)}" class="sfarc-value-link">${escapeHtml(email)}</a>
                        </div>
                        <div class="sfarc-detail-row">
                            <span class="sfarc-label">Profile:</span>
                            <span class="sfarc-value">${escapeHtml(profileName)}</span>
                        </div>
                        <div class="sfarc-detail-row">
                            <span class="sfarc-label">Language:</span>
                            <span class="sfarc-value">${flag} ${escapeHtml(language)}</span>
                        </div>

                            <div class="sfarc-card-actions">
                                <span class="sfarc-action-chip" data-action="login-as" data-user-id="${item.Id}" data-user-name="${escapeHtml(label)}">Login as User</span>
                                <span class="sfarc-action-chip" data-action="login-incognito" data-user-id="${item.Id}" data-user-name="${escapeHtml(label)}">Login in Incognito</span>
                                <a class="sfarc-action-chip" href="${window.location.origin}/lightning/setup/ManageUsers/page?address=%2F${item.Id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1" target="_blank">Manage User</a>
                                <a class="sfarc-action-chip" href="${window.location.origin}/lightning/setup/ManageUsers/page?address=%2F${item.Id}%2Fsummary" target="_blank">View Summary</a>
                                <span class="sfarc-action-chip" data-action="pset" data-user-id="${item.Id}">PS Assign</span>
                                <span class="sfarc-action-chip" data-action="psetg" data-user-id="${item.Id}">PSG Assign</span>
                                <span class="sfarc-action-chip" data-action="enable-logs" data-user-id="${item.Id}" data-user-name="${escapeHtml(label)}">Enable Debug Logs</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // For objects, create expandable card
        if (type === 'objects') {
            var apiName = item.name || '';
            var objectLabel = item.label || '';
            var keyPrefix = item.keyPrefix || '';

            return `
                <div class="sfarc-suggestion-item sfarc-object-card"
                    data-id="${id}"
                    data-type="${type}"
                    data-api-name="${apiName}">
                    <div class="sfarc-card-main">
                        <div class="sfarc-item-main">${escapeHtml(objectLabel)}</div>
                        <div class="sfarc-item-sub">${escapeHtml(apiName)}</div>
                    </div>
                    
                    <div class="sfarc-card-details">
                        <div class="sfarc-details-split">
                            <!-- Left Column: Metadata -->
                            <div class="sfarc-details-left">
                                <div class="sfarc-detail-row">
                                    <span class="sfarc-label">Name:</span>
                                    <span class="sfarc-value">${escapeHtml(apiName)}</span>
                                </div>
                                <div class="sfarc-detail-row">
                                    <span class="sfarc-label">Label:</span>
                                    <span class="sfarc-value">${escapeHtml(objectLabel)}</span>
                                </div>
                                ${keyPrefix ? `
                                <div class="sfarc-detail-row">
                                    <span class="sfarc-label">Id:</span>
                                    <span class="sfarc-value">${escapeHtml(keyPrefix)}</span>
                                </div>
                                ` : ''}
                            </div>

                            <!-- Right Column: Quick Links -->
                            <div class="sfarc-details-right">
                                <div class="sfarc-label" style="margin-bottom: 8px;">Links:</div>
                                <div class="sfarc-links-grid">
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/FieldsAndRelationships/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #3498db;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                        <span>Fields</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/PageLayouts/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #2ecc71;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                        <span>Page Layouts</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/FlowTriggers/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #1abc9c;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                        <span>Flows</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/Triggers/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #e67e22;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                        <span>Triggers</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/ValidationRules/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #9b59b6;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                                        <span>Validation Rules</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/RecordTypes/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #e74c3c;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                        <span>Record Types</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/ButtonsLinksActions/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #f1c40f;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <span>Buttons</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                    <a href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/LightningPages/view" target="_blank" class="sfarc-value-link">
                                        <svg class="sfarc-link-icon-start" style="color: #34495e;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                        <span>Lightning Pages</span>
                                        <svg class="sfarc-link-icon-end" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <div class="sfarc-card-actions">
                            <a class="sfarc-action-chip" href="${window.location.origin}/lightning/o/${apiName}/list" target="_blank">Show all data</a>
                            <a class="sfarc-action-chip" href="${window.location.origin}/lightning/setup/ObjectManager/${apiName}/FieldsAndRelationships/view" target="_blank">Fields</a>
                            <span class="sfarc-action-chip">New ${escapeHtml(objectLabel)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // For shortcuts, create cloud badge layout
        if (type === 'shortcuts') {
            // Generate random color
            var colors = ['var(--sfarc-accent, #3b82f6)'];

            // SVG Icons
            var icons = [
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 12 9-12h-9l1-12z"/></svg>', // Bolt
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M15.6 8.4a1.6 1.6 0 0 0 .4-1.8l-1.6-3.7a1.6 1.6 0 0 0-2.2-.6l-1.3.6a1.6 1.6 0 0 1-1.8-.8l-.3-1.4a1.6 1.6 0 0 0-1.6-1.3H8.8a1.6 1.6 0 0 0-1.6 1.3l-.3 1.4a1.6 1.6 0 0 1-1.8.8l-1.3-.6a1.6 1.6 0 0 0-2.2.6L.4 6.6a1.6 1.6 0 0 0 .4 1.8l1.2 1a1.6 1.6 0 0 1 0 2.2l-1.2 1a1.6 1.6 0 0 0-.4 1.8l1.6 3.7a1.6 1.6 0 0 0 2.2.6l1.3-.6a1.6 1.6 0 0 1 1.8.8l.3 1.4a1.6 1.6 0 0 0 1.6 1.3h1.6a1.6 1.6 0 0 0 1.6-1.3l.3-1.4a1.6 1.6 0 0 1 1.8-.8l1.3.6a1.6 1.6 0 0 0 2.2-.6l1.6-3.7a1.6 1.6 0 0 0-.4-1.8l-1.2-1a1.6 1.6 0 0 1 0-2.2l1.2-1z"/></svg>', // Settings
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5"/><path d="M15 15l-3.5-3.5"/></svg>', // Search
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M2 10l4-4 4 4 4-4"/></svg>', // Chart/Activity
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 14v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="5" r="4"/></svg>', // User
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="12" height="9" rx="2" ry="2"/><path d="M5 9V5a3 3 0 0 1 6 0v4"/></svg>', // Lock/Key
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.7 2.3a2.8 2.8 0 1 1 4 4l-9 9-4 1 1-4 9-9z"/><path d="M10 5l4 4"/></svg>', // Edit/Tool
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="8" height="12" rx="2"/><path d="M8 11h.01"/></svg>' // Mobile/Device
            ];

            // Use hash of label to ensure consistent color/icon for same item
            var hash = 0;
            for (let i = 0; i < item.label.length; i++) {
                hash = item.label.charCodeAt(i) + ((hash << 5) - hash);
            }

            var color = colors[Math.abs(hash) % colors.length];
            var icon = icons[Math.abs(hash) % icons.length];

            // Fixed border radius as requested (decreased from random large values)
            var borderRadius = '6px';

            var targetUrl = item.url.startsWith('http') ? item.url : (window.location.origin + item.url);
            return `
                <a href="${targetUrl}" target="_blank" class="sfarc-shortcut-badge" style="background-color: transparent; border: 1px solid ${color}; color: ${color}; border-radius: ${borderRadius}; position: relative; display: inline-flex; align-items: center; gap: 6px;">
                    <span class="sfarc-shortcut-icon">${icon}</span>
                    <span class="sfarc-shortcut-label">${escapeHtml(item.label)}</span>
                    ${item.isCustom ? `
                        <div class="sfarc-custom-actions" style="display: inline-flex; align-items: center; gap: 3px; margin-left: 4px;">
                            <button class="sfarc-edit-custom-shortcut-btn" data-custom-id="${item.id}"  style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.15); border: none; color: var(--sfarc-accent, var(--sfarc-accent, #2196f3)); cursor: pointer; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px;"><i class="fa-solid fa-pen"></i></button>
                            <button class="sfarc-delete-custom-shortcut-btn" data-custom-id="${item.id}"  style="background: rgba(239, 68, 68, 0.15); border: none; color: #ef4444; cursor: pointer; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    ` : ''}
                </a>
            `;
        }

        // Determine icon and category for Raycast-style layout
        var iconColor = 'var(--sfarc-accent, #2196f3)';

        // Icon: use the item's icon if available, otherwise pick a context-appropriate one
        var itemIcon = '';
        if (item.icon) {
            itemIcon = `<i class="fa-solid ${item.icon}" style="font-size: 13px;"></i>`;
        } else if (type === 'objects') {
            itemIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h12v10H2z"/><path d="M2 6h12"/></svg>';
        } else if (type === 'users') {
            itemIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 14v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="5" r="4"/></svg>';
        } else {
            itemIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 12 9-12h-9l1-12z"/></svg>';
        }

        // Category label on the right
        var categoryLabel = item.category || (type === 'objects' ? 'Object' : type === 'users' ? 'User' : 'Shortcut');

        return `
            <button class="sfarc-suggestion-item sfarc-suggestion-row"
                data-id="${id}"
                data-type="${type}"
                data-api-name="${item.name || ''}">
                <span class="sfarc-suggestion-icon" style="background: var(--sfarc-accent, #f97316); color: #ffffff; border: 1px solid transparent;">${itemIcon}</span>
                <span class="sfarc-suggestion-text">
                    <span class="sfarc-suggestion-title">${escapeHtml(label)}</span>
                    ${subLabel && subLabel !== label ? `<span class="sfarc-suggestion-sub">${escapeHtml(subLabel)}</span>` : ''}
                </span>
                <span class="sfarc-suggestion-category">${escapeHtml(categoryLabel)}</span>
            </button>
        `;
    }).join('');

    // Add click listeners for custom shortcut actions (edit & delete)
    container.querySelectorAll('.sfarc-edit-custom-shortcut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            var customId = btn.dataset.customId;
            var scToEdit = window.sfarcShortcuts.find(sc => sc.id === customId);
            if (scToEdit && typeof openCustomShortcutModal === 'function') {
                openCustomShortcutModal(scToEdit);
            }
        });
    });

    container.querySelectorAll('.sfarc-delete-custom-shortcut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            var customId = btn.dataset.customId;
            if (customId) {
                deleteCustomShortcut(customId);
            }
        });
    });

    // Add click listeners
    container.querySelectorAll('.sfarc-suggestion-item').forEach(el => {
        // For user and object cards, toggle expansion on click
        if (el.classList.contains('sfarc-user-card') || el.classList.contains('sfarc-object-card')) {
            el.addEventListener('click', (e) => {
                // Prevent expansion if clicking on a link or button
                if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.sfarc-action-chip')) {
                    return;
                }

                // Toggle expanded class
                el.classList.toggle('expanded');
            });
        } else {
            // For other items (shortcuts, etc.), keep default behavior
            el.addEventListener('click', () => handleItemClick(el.dataset));
        }
    });

    // Add click listeners for action chips
    container.querySelectorAll('.sfarc-action-chip[data-action]').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            var action = chip.dataset.action;
            var userId = chip.dataset.userId;
            var userName = chip.dataset.userName;
            handleUserAction(action, userId, userName);
        });
    });
}

function handleItemClick(data) {
    if (data.type === 'objects') {
        // Open object list view or describe
        var objectName = data.apiName;
        // window.open is usually fine for non-extension URLs, but let's use the background script for consistency if we wanted to.
        // For now, I'll stick to window.open for Salesforce URLs as they are not blocked.
        window.open(`${window.location.origin}/lightning/o/${objectName}/list`, '_blank');
    } else if (data.type === 'users') {
        // Open user record in Setup (Manage Users)
        window.open(`${window.location.origin}/lightning/setup/ManageUsers/page?address=%2F${data.id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`, '_blank');
    }
    togglePanel();
}

// Handle user actions (Login As, PSet, etc.)
async function handleUserAction(action, userId, userName) {
    var instanceUrl = window.location.origin;

    if (action === 'login-incognito') {
        var sessionId = window.sfApi?.sessionId;
        if (sessionId) {
            var payload = `${sessionId}+|+${userId}`;
            await navigator.clipboard.writeText(payload);
            chrome.runtime.sendMessage({ action: 'openIncognito', url: window.location.origin });
            toast.success('Session ID + Target User ID copied to clipboard. Opening Incognito window...');
        } else {
            toast.error('Could not retrieve Session ID.');
        }
        return;
    }

    if (action === 'login-as') {
        try {
            // Store current session info to allow easy return
            // We can't easily "return" without re-login, but we can store the original session
            // to potentially restore it. However, Salesforce usually invalidates the session 
            // if you log out. But "Login As" is a nested session.
            // Standard "Login As" opens a new window.

            // We need the Org ID for the login URL
            if (!searchCache.orgData) {
                // Fetch org data if missing
                await loadTabContent('org');
            }
            var orgId = searchCache.orgData?.orgId;

            if (!orgId) {
                toast.error('Could not retrieve Org ID. Please try loading the Org tab first.');
                return;
            }

            // Construct Login As URL
            // Format: /servlet/servlet.su?oid={orgId}&suorgadminid={targetUserId}&targetURL=%2Fhome%2Fhome.jsp&retURL=%2F


            // Construct Login As URL
            var loginUrl = `${instanceUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${userId}&targetURL=%2Fhome%2Fhome.jsp&retURL=%2F`;

            window.open(loginUrl, '_blank');

        } catch (e) {
            console.error('Login As failed:', e);
            toast.error('Failed to initiate Login As.');
        }
    } else if (action === 'login-incognito') {
        try {
            if (!searchCache.orgData) await loadTabContent('org');
            var orgId = searchCache.orgData?.orgId;
            if (!orgId) { toast.error('Could not retrieve Org ID.'); return; }

            var loginUrl = `${instanceUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${userId}&targetURL=%2Fhome%2Fhome.jsp&retURL=%2F`;
            var sessionId = window.sfApi?.sessionId;

            if (sessionId) {
                // Use frontdoor to bootstrap session in incognito
                var bootstrapUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${sessionId}&retURL=${encodeURIComponent(loginUrl)}`;
                chrome.runtime.sendMessage({ action: 'openIncognito', url: bootstrapUrl });
            } else {
                toast.info('Session ID required for Incognito login.');
            }
        } catch (e) {
            console.error('Incognito Login failed:', e);
            toast.error('Failed to initiate Incognito Login.');
        }
    } else if (action === 'pset') {
        // Permission Set Assignments
        var url = `${instanceUrl}/lightning/setup/PermSets/page?address=%2Fudd%2FPermissionSet%2FassignPermissionSet.apexp%3FuserId%3D${userId}`;
        window.open(url, '_blank');
    } else if (action === 'psetg') {
        // Permission Set Group Assignments
        var url = `${instanceUrl}/lightning/setup/PermSetGroups/page?address=%2Fudd%2FPermissionSetGroup%2FassignPermissionSet.apexp%3FuserId%3D${userId}%26isPermsetGroup%3D1`;
        window.open(url, '_blank');
    } else if (action === 'enable-logs') {
        await enableDebugLog(userId, userName);
    }
}

// Enable Debug Log for User
async function enableDebugLog(userId, userName) {
    try {
        // Fetch fresh settings to ensure we have the latest defaults
        var storageData = await chrome.storage.sync.get(['sfiSettings']);
        var currentSettings = { ...settings, ...(storageData.sfiSettings || {}) };

        var debugLevelId = currentSettings.defaultDebugLevelId;
        var logType = currentSettings.logType || currentSettings.debugType || 'USER_DEBUG';

        // 1. If no default set, find a suitable DebugLevel (e.g., SFDC_DevConsole)
        if (!debugLevelId) {
            var levelQuery = "SELECT Id FROM DebugLevel WHERE DeveloperName = 'SFDC_DevConsole'";
            var levelResult = await window.sfApi.query(levelQuery, true);

            if (levelResult.records && levelResult.records.length > 0) {
                debugLevelId = levelResult.records[0].Id;
            } else {
                // Fallback: Get ANY debug level
                var anyLevelQuery = "SELECT Id FROM DebugLevel LIMIT 1";
                var anyLevelResult = await window.sfApi.query(anyLevelQuery, true);
                if (anyLevelResult.records && anyLevelResult.records.length > 0) {
                    debugLevelId = anyLevelResult.records[0].Id;
                }
            }
        }

        if (!debugLevelId) {
            toast.error('No Debug Level found. Please create one in Developer Console.');
            return;
        }

        // 2. Create TraceFlag
        // Expiration: 30 minutes from now
        var expirationDate = new Date(Date.now() + 30 * 60000).toISOString();

        var traceFlag = {
            TracedEntityId: userId,
            DebugLevelId: debugLevelId,
            StartDate: new Date().toISOString(),
            ExpirationDate: expirationDate,
            LogType: logType
        };

        // Use Tooling API (third argument = true)
        var result = await window.sfApi.create('TraceFlag', traceFlag, true);

        if (result.success) {
            toast.success(`Debug logging enabled for ${userName} (${logType}) for 30 minutes.`);
        } else {
            console.error('Create TraceFlag failed:', result.errors);
            toast.error('Failed to enable logging: ' + JSON.stringify(result.errors));
        }

    } catch (e) {
        console.error('Error enabling logs:', e);
        toast.error('Error enabling logs: ' + e.message);
    }
}

function debounce(func, wait) {
    var timeout;
    return function executedFunction(...args) {
        var later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function togglePanel() {
    var panel = document.getElementById('sfarc-panel');
    var toggleContainer = document.getElementById('sfarc-toggle-container');

    if (!panel) return;

    if (panel.classList.contains('sfarc-hidden')) {
        // Open
        panel.classList.remove('sfarc-hidden');
        panel.classList.remove('sfarc-closing');



        // Dismiss onboarding overlay if open and mark completed so Shift+Space is never interrupted
        var onboardingOverlay = document.getElementById('sfarc-onboarding-overlay');
        if (onboardingOverlay) onboardingOverlay.remove();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarcHasSeenOnboarding: true, sfarcHasSeenOnboarding_v16: true, sfarc_needs_onboarding: false });
        }

        // Update footer immediately and attempt user fetch
        updateFooter();
        fetchCurrentUserId();

        // Ensure search focus (retry during animation)
        var focusAttempts = 0;
        var focusInterval = setInterval(() => {
            var searchInput = document.getElementById('sfarc-global-search');
            if (searchInput) {
                searchInput.focus();
                if (document.activeElement === searchInput || focusAttempts > 10) {
                    clearInterval(focusInterval);
                }
            }
            focusAttempts++;
        }, 50);

    } else {
        // Close with animation
        panel.classList.add('sfarc-closing');



        // Wait for animation to finish
        setTimeout(() => {
            if (panel.classList.contains('sfarc-closing')) { // check incase reopened
                panel.classList.add('sfarc-hidden');
                panel.classList.remove('sfarc-closing');
            }
        }, 250); // Match CSS animation duration (0.25s)
    }
}
window.togglePanel = togglePanel;

function openPanel() {
    var panel = document.getElementById('sfarc-panel');
    if (!panel) return;
    if (panel.classList.contains('sfarc-hidden')) {
        togglePanel();
    }
}
window.openPanel = openPanel;

function updateThemeColors(activeGroup) {
    var panel = document.getElementById('sfarc-panel');
    if (!panel) return;

    var isDark = panel.classList.contains('sfarc-dark-theme');

    var paletteLogo = document.getElementById('sfarc-palette-logo');
    if (paletteLogo && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        paletteLogo.src = chrome.runtime.getURL('icons/icon-48.png');
    }

    var userAccent = settings && settings.accentColor ? settings.accentColor : null;
    var primaryColor = userAccent || (isDark ? 'var(--sfarc-accent-light, #54a0ff)' : 'var(--sfarc-accent, var(--sfarc-accent, #2196f3))');
    var primaryColorRgb = isDark ? '84, 160, 255' : '33, 150, 243';
    var primaryLightBg = isDark ? 'rgba(84, 160, 255, 0.15)' : 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.1)';
    // "Match org favicon" mode: content.js already applied the org accent to the
    // root CSS vars — resolve them here so the popup panels share the org hue
    // (including the rgb triplet used in rgba() fills).
    if (userAccent === 'org') {
        userAccent = null;
        var rootCs = getComputedStyle(document.documentElement);
        var orgAccent = rootCs.getPropertyValue('--sfarc-accent').trim();
        var orgRgb = rootCs.getPropertyValue('--sfarc-accent-rgb').trim();
        if (orgRgb) {
            primaryColorRgb = orgRgb;
            primaryLightBg = `rgba(${orgRgb}, 0.15)`;
        }
        if (orgAccent) {
            primaryColor = orgAccent;
        }
    }

    if (activeGroup === 'objects' || activeGroup === 'users' || activeGroup === 'org' || activeGroup === 'bulk-field') {
        // Keeps user accent or defaults
    } else if (activeGroup === 'shortcuts' || activeGroup === 'devtools') {
        primaryColor = userAccent || (isDark ? '#c084fc' : '#7f00ff');
        primaryColorRgb = isDark ? '192, 132, 252' : '127, 0, 255';
        primaryLightBg = isDark ? 'rgba(192, 132, 252, 0.15)' : '#f5f0ff';
    } else if (activeGroup === 'debug-logs' || activeGroup === 'metadata') {
        primaryColor = userAccent || (isDark ? '#2dd4bf' : '#0d9488');
        primaryColorRgb = isDark ? '45, 212, 191' : '13, 148, 136';
        primaryLightBg = isDark ? 'rgba(45, 212, 191, 0.15)' : '#f0fdfa';
    }

    panel.style.setProperty('--primary-color', primaryColor, 'important');
    panel.style.setProperty('--primary-color-rgb', primaryColorRgb, 'important');
    panel.style.setProperty('--primary-light-bg', primaryLightBg, 'important');
}
window.updateThemeColors = updateThemeColors;

function filterTabs(activeGroup) {
    var tabButtons = document.querySelectorAll('.sfarc-tab');
    tabButtons.forEach(btn => {
        var tabName = btn.dataset.tab;
        var visible = false;

        if (activeGroup === 'objects' || activeGroup === 'users') {
            visible = (tabName === 'objects' || tabName === 'users');
        } else if (activeGroup === 'shortcuts' || activeGroup === 'devtools') {
            visible = (tabName === 'shortcuts' || tabName === 'devtools');
        } else if (activeGroup === 'debug-logs' || activeGroup === 'metadata') {
            visible = (tabName === 'debug-logs' || tabName === 'metadata');
        }

        btn.style.setProperty('display', visible ? 'flex' : 'none', 'important');
    });

    if (typeof updateThemeColors === 'function') {
        updateThemeColors(activeGroup);
    }
}
window.filterTabs = filterTabs;

function bindSecurityEvents() {
    var searchInput = document.getElementById('sfarc-sec-name');
    var typeSelect = document.getElementById('sfarc-sec-type');
    var searchButton = document.getElementById('sfarc-sec-search');
    var resultsDiv = document.getElementById('sfarc-sec-results');

    var debounceTimer;
    var resultRequestId = 0;
    var suggestionRequestId = 0;

    var performSearch = async () => {
        var requestId = ++resultRequestId;
        var type = typeSelect.value;
        var name = searchInput.value.trim();

        if (!name) {
            resultsDiv.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--sfarc-secondary-text); text-align: center; padding: 40px 20px;">
                    <i class="fa-solid fa-shield-halved" style="font-size: 36px; opacity: 0.25; margin-bottom: 12px; color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));"></i>
                    <span style="font-size: 13px; font-weight: 500;">Enter an API name above to analyze access permissions.</span>
                </div>`;
            return;
        }

        resultsDiv.innerHTML = '<div style="padding: 30px; color: var(--sfarc-secondary-text); text-align: center; font-size: 13px; font-weight: 500;"><span class="comet-loader-inline"></span> Analyzing permissions for ' + window.escapeHtml(name) + '...</div>';

        try {
            var query = '';
            var safeName = escapeSoqlLiteral(name);

            if (type === 'CustomObject') {
                query = `SELECT Parent.Id, Parent.Name, Parent.Label, Parent.IsOwnedByProfile, Parent.Profile.Id, Parent.Profile.Name, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE SobjectType = '${safeName}'`;
            } else if (type === 'CustomField') {
                query = `SELECT Parent.Id, Parent.Name, Parent.Label, Parent.IsOwnedByProfile, Parent.Profile.Id, Parent.Profile.Name, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE Field = '${safeName}'`;
            } else {
                var setupEntityTypes = new Set(['ApexClass', 'ApexPage', 'CustomPermission', 'FlowDefinition']);
                if (!setupEntityTypes.has(type)) {
                    throw new Error(`${type} is not reported because Salesforce does not model it as a generic SetupEntityAccess grant. Modern Named Credentials must be evaluated through External Credential principals and their mappings.`);
                }
                var objName = type;
                var nameField = 'DeveloperName';

                if (type === 'ApexClass' || type === 'ApexPage' || type === 'ConnectedApplication') {
                    nameField = 'Name';
                }

                var idQuery = `SELECT Id FROM ${objName} WHERE ${nameField} = '${safeName}' LIMIT 1`;
                var idRes = await window.sfApi.query(idQuery, false, { noCache: true });
                if (requestId !== resultRequestId) return;
                if (!idRes || idRes.records.length === 0) {
                    resultsDiv.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center; background: rgba(239, 68, 68, 0.05); border-radius: 8px; margin: 10px 0;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Could not find ${window.escapeHtml(type)} with name '${window.escapeHtml(name)}'. Note: Try using the exact API Name or DeveloperName.</div>`;
                    return;
                }
                var entityId = idRes.records[0].Id;
                query = `SELECT Parent.Id, Parent.Name, Parent.Label, Parent.IsOwnedByProfile, Parent.Profile.Id, Parent.Profile.Name FROM SetupEntityAccess WHERE SetupEntityId = '${entityId}'`;
            }

            var res = await window.sfApi.query(query, false, { noCache: true });
            if (requestId !== resultRequestId) return;
            if (!res || !res.records || res.records.length === 0) {
                var extraMsg = '';
                if (type === 'CustomField') {
                    extraMsg = `<br><span style="font-size: 12px; opacity: 0.8;"><i class="fa-solid fa-circle-info"></i> Standard required fields (like Account.Name) and universally required custom fields do not have Field-Level Security in Salesforce.</span>`;
                }
                resultsDiv.innerHTML = `<div style="padding: 30px 20px; color: var(--sfarc-secondary-text); text-align: center;">
                    <div style="font-size: 13px; font-weight: 500;">No Permission Sets or Profiles found with access to <b>${window.escapeHtml(name)}</b>.</div>
                    ${extraMsg}
                </div>`;
                return;
            }

            // Field permissions are only effective when the same profile or
            // permission set also grants the corresponding object access.
            var objectPermByParent = new Map();
            if (type === 'CustomField') {
                var objectName = name.split('.')[0];
                var parentIdsForObject = [...new Set(res.records.map(r => r.Parent && r.Parent.Id).filter(Boolean))];
                if (parentIdsForObject.length) {
                    var parentIn = parentIdsForObject.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                    var objectRes = await window.sfApi.query(`SELECT ParentId, PermissionsRead, PermissionsEdit FROM ObjectPermissions WHERE SobjectType = '${escapeSoqlLiteral(objectName)}' AND ParentId IN (${parentIn})`, false, { noCache: true });
                    if (requestId !== resultRequestId) return;
                    (objectRes.records || []).forEach(r => objectPermByParent.set(r.ParentId, r));
                }
            }

            // Assignment coverage prevents an unassigned permission set from
            // being presented as user access. Group-derived access is shown
            // separately because its muting permission set must be evaluated.
            var directAssignments = new Map();
            var profileAssignments = new Map();
            var groupAssignments = new Map();
            var groupsByPermissionSet = new Map();
            var mutedGroupIds = new Set();
            var assignmentCoverageError = '';
            try {
                var permissionSetIds = [...new Set(res.records.map(r => r.Parent && r.Parent.Id).filter(Boolean))];
                var profileIds = [...new Set(res.records.map(r => r.Parent && r.Parent.Profile && r.Parent.Profile.Id).filter(Boolean))];
                if (permissionSetIds.length) {
                    var psIn = permissionSetIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                    var assignmentRes = await window.sfApi.query(`SELECT PermissionSetId, COUNT(Id) total FROM PermissionSetAssignment WHERE PermissionSetId IN (${psIn}) GROUP BY PermissionSetId`, false, { noCache: true });
                    (assignmentRes.records || []).forEach(r => directAssignments.set(r.PermissionSetId, Number(r.total ?? r.expr0 ?? 0)));

                    var componentRes = await window.sfApi.query(`SELECT PermissionSetId, PermissionSetGroupId, PermissionSetGroup.DeveloperName, PermissionSetGroup.MutingPermissionSetId FROM PermissionSetGroupComponent WHERE PermissionSetId IN (${psIn})`, false, { noCache: true });
                    var groupIds = [...new Set((componentRes.records || []).map(r => r.PermissionSetGroupId).filter(Boolean))];
                    var mutingIds = [...new Set((componentRes.records || []).map(r => r.PermissionSetGroup && r.PermissionSetGroup.MutingPermissionSetId).filter(Boolean))];
                    if (mutingIds.length) {
                        var mutingIn = mutingIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                        var mutingQuery = type === 'CustomObject'
                            ? `SELECT ParentId FROM ObjectPermissions WHERE ParentId IN (${mutingIn}) AND SobjectType = '${safeName}'`
                            : type === 'CustomField'
                                ? `SELECT ParentId FROM FieldPermissions WHERE ParentId IN (${mutingIn}) AND Field = '${safeName}'`
                                : `SELECT ParentId FROM SetupEntityAccess WHERE ParentId IN (${mutingIn}) AND SetupEntityId = '${escapeSoqlLiteral(entityId)}'`;
                        var mutingRes = await window.sfApi.query(mutingQuery, false, { noCache: true });
                        var activeMutingIds = new Set((mutingRes.records || []).map(r => r.ParentId));
                        (componentRes.records || []).forEach(r => {
                            if (r.PermissionSetGroup && activeMutingIds.has(r.PermissionSetGroup.MutingPermissionSetId)) mutedGroupIds.add(r.PermissionSetGroupId);
                        });
                    }
                    if (groupIds.length) {
                        var groupIn = groupIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                        var groupAssignRes = await window.sfApi.query(`SELECT PermissionSetGroupId, COUNT(Id) total FROM PermissionSetAssignment WHERE PermissionSetGroupId IN (${groupIn}) GROUP BY PermissionSetGroupId`, false, { noCache: true });
                        (groupAssignRes.records || []).forEach(r => groupAssignments.set(r.PermissionSetGroupId, Number(r.total ?? r.expr0 ?? 0)));
                    }
                    (componentRes.records || []).forEach(r => {
                        if (!groupsByPermissionSet.has(r.PermissionSetId)) groupsByPermissionSet.set(r.PermissionSetId, []);
                        groupsByPermissionSet.get(r.PermissionSetId).push({
                            id: r.PermissionSetGroupId,
                            name: r.PermissionSetGroup && r.PermissionSetGroup.DeveloperName,
                            mutingPermissionSetId: r.PermissionSetGroup && r.PermissionSetGroup.MutingPermissionSetId,
                            muted: mutedGroupIds.has(r.PermissionSetGroupId),
                            users: groupAssignments.get(r.PermissionSetGroupId) || 0
                        });
                    });
                }
                if (profileIds.length) {
                    var profileIn = profileIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                    var activeClause = settings.secInactive ? '' : 'IsActive = true AND ';
                    var profileRes = await window.sfApi.query(`SELECT ProfileId, COUNT(Id) total FROM User WHERE ${activeClause}ProfileId IN (${profileIn}) GROUP BY ProfileId`, false, { noCache: true });
                    (profileRes.records || []).forEach(r => profileAssignments.set(r.ProfileId, Number(r.total ?? r.expr0 ?? 0)));
                }
                if (requestId !== resultRequestId) return;
            } catch (coverageError) {
                assignmentCoverageError = coverageError.message || String(coverageError);
            }

            // Sort Profiles first, then Permission Sets
            res.records.sort((a, b) => {
                var pA = a.Parent || {};
                var pB = b.Parent || {};
                var aIsProfile = !!pA.Profile;
                var bIsProfile = !!pB.Profile;
                if (aIsProfile && !bIsProfile) return -1;
                if (!aIsProfile && bIsProfile) return 1;
                return (pA.Name || '').localeCompare(pB.Name || '');
            });

            var seen = new Set();
            var rowsHtml = '';

            res.records.forEach(rec => {
                var parent = rec.Parent || {};
                var isProfile = !!parent.Profile || !!parent.IsOwnedByProfile;
                var typeStr = isProfile ? 'Profile' : 'Permission Set';
                var labelStr = isProfile ? parent.Profile.Name : (parent.Label || parent.Name || 'Unknown');

                var perms = [];
                var objectPermission = type === 'CustomField' ? objectPermByParent.get(parent.Id) : null;
                var effectiveFieldRead = type !== 'CustomField' || (!!rec.PermissionsRead && !!objectPermission && !!objectPermission.PermissionsRead);
                var effectiveFieldEdit = type !== 'CustomField' || (!!rec.PermissionsEdit && !!objectPermission && !!objectPermission.PermissionsEdit);
                if (type === 'CustomField' ? effectiveFieldRead : rec.PermissionsRead) perms.push('Read');
                if (rec.PermissionsCreate) perms.push('Create');
                if (type === 'CustomField' ? effectiveFieldEdit : rec.PermissionsEdit) perms.push('Edit');
                if (rec.PermissionsDelete) perms.push('Delete');
                if (rec.PermissionsViewAllRecords) perms.push('View All');
                if (rec.PermissionsModifyAllRecords) perms.push('Modify All');

                var permsStr = perms.length > 0 ? perms.join(', ') : (type === 'CustomField' ? 'No effective field access' : 'Enabled');
                var directUsers = isProfile
                    ? (profileAssignments.get(parent.Profile && parent.Profile.Id) || 0)
                    : (directAssignments.get(parent.Id) || 0);
                var sourceGroups = groupsByPermissionSet.get(parent.Id) || [];
                var groupUsers = sourceGroups.filter(group => !group.muted).reduce((sum, group) => sum + group.users, 0);
                var mutedGroups = sourceGroups.filter(group => group.muted).length;
                if (settings.secShowUnassigned === false && !directUsers && !groupUsers) return;
                var dedupKey = isProfile ? 'P_' + labelStr : 'PS_' + parent.Name;
                if (seen.has(dedupKey)) return;
                seen.add(dedupKey);
                var coverageText = `${directUsers} direct`;
                if (groupUsers) coverageText += `, ${groupUsers} via group`;
                if (mutedGroups) coverageText += ` · ${mutedGroups} muted group grant${mutedGroups === 1 ? '' : 's'} excluded`;
                if (!directUsers && !groupUsers) coverageText = 'No active-user assignment found';

                rowsHtml += `
                    <tr>
                        <td style="padding: 8px 12px !important; text-align: left;"><span class="sfarc-badge ${isProfile ? 'blue' : 'green'}" style="font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 500;">${typeStr}</span></td>
                        <td style="padding: 8px 12px !important; text-align: left; font-weight: 500;">${window.escapeHtml(isProfile ? '--' : (parent.Name || 'Unknown'))}</td>
                        <td style="padding: 8px 12px !important; text-align: left; font-weight: 500;">${window.escapeHtml(labelStr)}</td>
                        <td style="padding: 8px 12px !important; text-align: left; color: #059669; font-weight: 500;">${window.escapeHtml(permsStr)}</td>
                        <td style="padding: 8px 12px !important; text-align: left; color: ${directUsers || groupUsers ? '#059669' : '#d97706'}; font-weight: 500;">${window.escapeHtml(coverageText)}</td>
                    </tr>
                `;
            });

            var html = `
                <div style="font-size: 11.5px; font-weight: 500; color: var(--sfarc-secondary-text, #64748b); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Found <strong style="color: var(--sfarc-text, #0f172a);">${seen.size}</strong> grant definitions</span>
                </div>
                <div style="padding: 9px 11px; margin-bottom: 8px; border: 1px solid rgba(217,119,6,.35); border-radius: 7px; background: rgba(217,119,6,.08); color: var(--sfarc-secondary-text); font-size: 11px; line-height: 1.45;">
                    <strong>This is not a record-level access report.</strong> Object rows show CRUD/View All/Modify All definitions and assignment coverage; OWD, sharing, ownership, territories, restriction rules, session activation, and licenses can still change effective access.${type === 'CustomField' ? ' Field Read/Edit below is intersected with the matching object Read/Edit permission.' : ''}
                    ${assignmentCoverageError ? `<br><strong>Assignment coverage unavailable:</strong> ${window.escapeHtml(assignmentCoverageError)}` : ''}
                </div>
                <div class="sfarc-table-container" style="width: 100%; border: 1px solid var(--sfarc-border, #cbd5e1); border-radius: 8px; overflow: hidden; background: var(--sfarc-bg, #ffffff);">
                    <table class="sfarc-table" style="width: 100%; border-collapse: collapse; margin: 0;">
                        <thead>
                            <tr>
                                <th style="padding: 8px 12px !important; text-align: left !important; font-size: 11px; font-weight: 500; text-transform: uppercase; color: var(--sfarc-secondary-text);">Type</th>
                                <th style="padding: 8px 12px !important; text-align: left !important; font-size: 11px; font-weight: 500; text-transform: uppercase; color: var(--sfarc-secondary-text);">Name</th>
                                <th style="padding: 8px 12px !important; text-align: left !important; font-size: 11px; font-weight: 500; text-transform: uppercase; color: var(--sfarc-secondary-text);">Label / Profile</th>
                                <th style="padding: 8px 12px !important; text-align: left !important; font-size: 11px; font-weight: 500; text-transform: uppercase; color: var(--sfarc-secondary-text);">Permissions</th>
                                <th style="padding: 8px 12px !important; text-align: left !important; font-size: 11px; font-weight: 500; text-transform: uppercase; color: var(--sfarc-secondary-text);">Assignment coverage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
            resultsDiv.innerHTML = html;

        } catch (e) {
            if (requestId !== resultRequestId) return;
            var sessionUnavailable = e && (e.code === 'SESSION_UNAVAILABLE' || e.name === 'SalesforceSessionUnavailableError');
            resultsDiv.innerHTML = `<div style="color: ${sessionUnavailable ? '#d97706' : '#ef4444'}; padding: 20px; text-align: center; background: ${sessionUnavailable ? 'rgba(217,119,6,.08)' : 'rgba(239,68,68,.06)'}; border-radius: 8px; margin: 10px 0;"><i class="fa-solid ${sessionUnavailable ? 'fa-plug-circle-xmark' : 'fa-triangle-exclamation'}" style="margin-right: 6px;"></i>${sessionUnavailable ? '<strong>Session unavailable.</strong> No access results were generated. Open the target Salesforce org, sign in, and retry.' : `Error: ${window.escapeHtml(e.message)}`}</div>`;
        }
    };

    var suggestionsDiv = document.getElementById('sfarc-sec-suggestions');
    var suggestionTimer;

    var fetchSuggestions = async (type, text) => {
        var requestId = ++suggestionRequestId;
        if (text.length < 2) return [];
        var q = '';
        var safeText = text.replace(/'/g, "\\'");
        try {
            switch (type) {
                case 'CustomObject': q = `SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'CustomField':
                    if (safeText.includes('.')) {
                        var parts = safeText.split('.');
                        q = `SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${parts[0]}' AND QualifiedApiName LIKE '%${parts[1]}%' LIMIT 10`;
                    } else {
                        q = `SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE '%${safeText}%' LIMIT 10`;
                    }
                    break;
                case 'ApexClass': q = `SELECT Name FROM ApexClass WHERE Name LIKE '%${safeText}%' LIMIT 10`; break;
                case 'ApexPage': q = `SELECT Name FROM ApexPage WHERE Name LIKE '%${safeText}%' LIMIT 10`; break;
                case 'CustomPermission': q = `SELECT DeveloperName FROM CustomPermission WHERE DeveloperName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'FlowDefinition': q = `SELECT DeveloperName FROM FlowDefinition WHERE DeveloperName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'NamedCredential': q = `SELECT DeveloperName FROM NamedCredential WHERE DeveloperName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'ExternalDataSource': q = `SELECT DeveloperName FROM ExternalDataSource WHERE DeveloperName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'ServicePresenceStatus': q = `SELECT DeveloperName FROM ServicePresenceStatus WHERE DeveloperName LIKE '%${safeText}%' LIMIT 10`; break;
                case 'ConnectedApplication': q = `SELECT Name FROM ConnectedApplication WHERE Name LIKE '%${safeText}%' LIMIT 10`; break;
            }
            if (!q) return [];
            var res = await window.sfApi.query(q, false, { noCache: true });
            if (requestId !== suggestionRequestId || type !== typeSelect.value || text !== searchInput.value.trim()) return [];
            var results = [];
            if (res && res.records) {
                results = res.records.map(r => r.Name || r.DeveloperName || r.QualifiedApiName);
                if (type === 'CustomField') {
                    if (!safeText.includes('.')) {
                        results = results.map(r => r + '.');
                    } else {
                        var parts = safeText.split('.');
                        results = results.map(r => parts[0] + '.' + r);
                    }
                }
            }
            return results;
        } catch (e) {
            console.error("Suggestion error:", e);
            return [];
        }
    };

    searchInput.addEventListener('input', () => {
        suggestionRequestId++;
        clearTimeout(suggestionTimer);
        var text = searchInput.value.trim();
        var type = typeSelect.value;

        if (text.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionTimer = setTimeout(async () => {
            var suggestions = await fetchSuggestions(type, text);
            if (type !== typeSelect.value || text !== searchInput.value.trim()) return;
            if (suggestions.length > 0) {
                suggestionsDiv.innerHTML = suggestions.map(s => `<div class="sfarc-suggestion-item" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--sfarc-border); font-size: 13px;" onmouseover="this.style.background='var(--sfarc-hover-bg)'" onmouseout="this.style.background='transparent'">${window.escapeHtml(s)}</div>`).join('');
                suggestionsDiv.style.display = 'block';

                // Add click listeners
                suggestionsDiv.querySelectorAll('.sfarc-suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        searchInput.value = item.innerText;
                        suggestionsDiv.style.display = 'none';
                        if (type === 'CustomField' && item.innerText.endsWith('.')) {
                            searchInput.focus();
                        } else {
                            performSearch();
                        }
                    });
                });
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }, 300);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!suggestionsDiv.contains(e.target) && e.target !== searchInput) {
            suggestionsDiv.style.display = 'none';
        }
    });

    // Also trigger on Enter key immediately
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(suggestionTimer);
            suggestionsDiv.style.display = 'none';
            performSearch();
        }
    });

    if (searchButton) searchButton.addEventListener('click', () => {
        clearTimeout(suggestionTimer);
        suggestionsDiv.style.display = 'none';
        performSearch();
    });

    typeSelect.addEventListener('change', () => {
        resultRequestId++;
        suggestionRequestId++;
        suggestionsDiv.style.display = 'none';
        if (searchInput.value.trim()) {
            performSearch();
        }
    });
}

window.switchTab = function (tabName) {
    var cmd = window.sfarcCommands ? window.sfarcCommands.find(c => c.id === tabName) : null;
    if (cmd && window.setGlobalSearchContext) {
        window.setGlobalSearchContext(cmd);
    } else {
        loadTabContent(tabName);
    }
};

function toggleTheme() {
    // Toggle state
    var panel = document.getElementById('sfarc-panel');
    var isDark = panel ? !panel.classList.contains('sfarc-dark-theme') : !document.body.classList.contains('sfarc-dark-theme');

    // Update local settings object
    settings.theme = isDark ? 'dark' : 'light';

    // Apply visual changes (this handles class toggling and icon swapping based on settings.theme)
    applySettings();

    // Swap moon/sun icons to reflect the active theme (smooth fade)
    var moonIcon = document.querySelector('.sfarc-moon-icon');
    var sunIcon = document.querySelector('.sfarc-sun-icon');
    if (moonIcon && sunIcon) {
        if (isDark) {
            moonIcon.style.opacity = '0';
            sunIcon.style.opacity = '1';
        } else {
            moonIcon.style.opacity = '1';
            sunIcon.style.opacity = '0';
        }
    }

    // Save to storage (triggering sync to other tabs/settings page)
    saveSettings();
}

// Load saved theme from localStorage (legacy support, settings.theme is preferred)
var savedTheme = localStorage.getItem('sfarc-theme');
if (savedTheme === 'dark') {
    settings.theme = 'dark';
    setTimeout(() => {
        var panel = document.getElementById('sfarc-panel');
        if (panel) panel.classList.add('sfarc-dark-theme');
        var moonIcon = document.querySelector('.sfarc-moon-icon');
        var sunIcon = document.querySelector('.sfarc-sun-icon');
        if (moonIcon && sunIcon) {
            moonIcon.style.opacity = '0';
            sunIcon.style.opacity = '1';
        }
    }, 100);
}

function openInNewTab(feature, params) {
    if (chrome.runtime?.id) {
        var msg = { action: 'openExtensionPage', page: feature };
        if (params) msg.params = params;
        chrome.runtime.sendMessage(msg, () => {
            if (chrome.runtime.lastError) { /* suppress connection error */ }
        });
    }
}

// Listen for messages from extension pages requesting session info

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!chrome.runtime?.id) return; // Context invalidated

    if (request.action === 'getSession') {
        // Delegate to background script to get the best cookie (handles domain matching and HttpOnly)
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'getCookie', name: 'sid', url: window.location.href }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Background cookie fetch failed:', chrome.runtime.lastError);
                    sendResponse({ sessionId: null, instanceUrl: window.location.origin });
                } else if (response && response.value) {
                    sendResponse({
                        sessionId: response.value,
                        instanceUrl: window.location.origin
                    });
                } else {
                    // If background failed, try local fallback just in case (though unlikely to work if bg failed)
                    try {
                        var match = document.cookie.match(/(^|;\s*)sid=([^;]*)/);
                        if (match) {
                            sendResponse({
                                sessionId: decodeURIComponent(match[2]),
                                instanceUrl: window.location.origin
                            });
                        } else {
                            sendResponse({ sessionId: null, instanceUrl: window.location.origin });
                        }
                    } catch (e) {
                        sendResponse({ sessionId: null, instanceUrl: window.location.origin });
                    }
                }
            });
        } else {
            sendResponse({ sessionId: null, instanceUrl: window.location.origin });
        }
        return true; // Keep channel open for async response
    }
});


function showView(view) {
}

function getFlag(locale) {
    if (!locale) return '';
    var code = locale.split('_')[0].toLowerCase();
    var flags = {
        'en': '🇺🇸', 'de': '🇩🇪', 'es': '🇪🇸', 'fr': '🇫🇷', 'it': '🇮🇹',
        'ja': '🇯🇵', 'sv': '🇸🇪', 'ko': '🇰🇷', 'zh': '🇨🇳', 'pt': '🇧🇷',
        'nl': '🇳🇱', 'da': '🇩🇰', 'th': '🇹🇭', 'fi': '🇫🇮', 'ru': '🇷🇺',
        'no': '🇳🇴', 'hi': '🇮🇳'
    };
    return flags[code] || '🌐';
}
// FlowMonitor - Real-time Flow Automation Monitoring
var flowPollingInterval = null;
var flowCache = {
    interviews: [],
    lastUpdate: null,
    errorCount: 0
};

// Load Flow Monitor content
async function loadFlowsContent() {
    var container = document.getElementById('sfarc-flow-monitor');

    if (!container) return;

    // If already initialized, just refresh data
    if (container.children.length > 0) {
        // Maybe just refresh data?
        // But we need to ensure event listeners aren't duplicated if we re-run this.
        // Actually, if it's already there, we can just return, as the polling or manual refresh will handle data.
        // Let's just trigger a data refresh.
        refreshFlowData(false);
        return;
    }

    container.innerHTML = `
        <div class="sfarc-flow-monitor">
            <!-- Header with Controls -->
            <div class="sfarc-flows-header">
                <div class="sfarc-flows-controls">
                    <button class="sfarc-flow-refresh-btn" id="flow-refresh-btn" >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C9.8 2 11.4 2.8 12.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 2V4H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <span class="sfarc-flow-last-update" id="flow-last-update">Never</span>
                    <label class="sfarc-flow-auto-refresh">
                        <input type="checkbox" id="flow-auto-refresh" checked>
                        <span>Auto-refresh</span>
                    </label>
                </div>
                <div class="sfarc-flows-actions">
                    <button class="sfarc-flow-export-btn" id="flow-export-btn" >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 3V11M8 3L5 6M8 3L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Export
                    </button>
                </div>
            </div>


            <!-- Filter Bar -->
            <div class="sfarc-flows-filters">
                <div class="sfarc-debug-search-wrapper" style="width: 300px;">
                    <input type="text" id="flow-search" class="sfarc-debug-search-input" placeholder="Search flows...">
                    <span class="sfarc-debug-search-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                </div>

                <select id="flow-status-filter" class="sfarc-flow-filter">
                    <option value="all">All Status</option>
                    <option value="Started">Running</option>
                    <option value="Paused">Paused</option>
                    <option value="Error">Failed</option>
                    <option value="Finished">Completed</option>
                </select>
            </div>

            <!-- Stats Summary -->
            <div class="sfarc-flows-stats">
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Total</span>
                    <span class="sfarc-flow-stat-value" id="flow-stat-total">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Running</span>
                    <span class="sfarc-flow-stat-value sfarc-status-running" id="flow-stat-running">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Paused</span>
                    <span class="sfarc-flow-stat-value sfarc-status-paused" id="flow-stat-paused">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Failed</span>
                    <span class="sfarc-flow-stat-value sfarc-status-failed" id="flow-stat-failed">0</span>
                </div>
                <div class="sfarc-flow-stat">
                    <span class="sfarc-flow-stat-label">Completed</span>
                    <span class="sfarc-flow-stat-value sfarc-status-completed" id="flow-stat-completed">0</span>
                </div>
            </div>

            <!-- Flow List -->
            <div class="sfarc-flows-list" id="flows-list">
                <div class="sfarc-loading">Loading flows...</div>
            </div>
        </div>
    `;

    // Event listeners
    var flowRefreshBtn = document.getElementById('flow-refresh-btn');
    var flowAutoRefresh = document.getElementById('flow-auto-refresh');
    var flowSearch = document.getElementById('flow-search');
    var flowStatusFilter = document.getElementById('flow-status-filter');
    var flowExportBtn = document.getElementById('flow-export-btn');

    if (flowRefreshBtn) flowRefreshBtn.addEventListener('click', () => refreshFlowData(true));
    if (flowAutoRefresh) flowAutoRefresh.addEventListener('change', toggleAutoRefresh);
    if (flowSearch) flowSearch.addEventListener('input', filterFlows);
    if (flowStatusFilter) flowStatusFilter.addEventListener('change', filterFlows);
    if (flowExportBtn) flowExportBtn.addEventListener('click', exportFlowData);

    // Initial load
    await refreshFlowData(true);

    // Start auto-refresh
    startFlowPolling();
}

// Fetch flow interview data
async function fetchFlowInterviews() {
    try {
        // Calculate date for 24 hours ago
        var oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Query FlowInterview for recent runs (last 24 hours)
        var query = `
            SELECT Id, CurrentElement, FlowVersionView.Label, FlowVersionViewId,
                   InterviewStatus, PauseLabel, CreatedDate, CreatedBy.Name
            FROM FlowInterview 
            WHERE CreatedDate >= ${oneDayAgo}
            ORDER BY CreatedDate DESC
            LIMIT 100
        `;

        var result;
        try {
            result = await window.sfApi.query(query, true); // Prefer Tooling API
        } catch (toolingError) {
            console.warn('FlowInterview Tooling API query failed, retrying REST API:', toolingError);
            result = await window.sfApi.query(query, false);
        }
        return result.records || [];
    } catch (error) {
        // Suppress "not supported" error which happens if user lacks permissions or object doesn't exist
        if (error.message && (error.message.includes('not supported') || error.message.includes('sObject type') || error.message.includes('400'))) {

            // console.warn('Flow Interviews not available via Tooling API (limited permissions or object not supported).');

            return [];
        }
        console.error('Error fetching flow interviews:', error);
        return [];
    }
}

// Refresh flow data
async function refreshFlowData(showLoading = false) {
    if (showLoading) {
        var list = document.getElementById('flows-list');
        if (list) list.innerHTML = '<div class="sfarc-loading">Loading flows...</div>';
    }

    var interviews = await fetchFlowInterviews();
    flowCache.interviews = interviews;
    flowCache.lastUpdate = new Date();

    // Calculate stats
    var stats = {
        total: interviews.length,
        running: interviews.filter(i => i.InterviewStatus === 'Started').length,
        paused: interviews.filter(i => i.InterviewStatus === 'Paused').length,
        failed: interviews.filter(i => i.InterviewStatus === 'Error').length,
        completed: interviews.filter(i => i.InterviewStatus === 'Finished').length
    };

    flowCache.errorCount = stats.failed;

    // Update UI
    updateFlowStats(stats);
    renderFlowList(interviews);
    updateLastRefreshTime();
    updateErrorBadge();
}

// Update stats display
function updateFlowStats(stats) {
    var totalEl = document.getElementById('flow-stat-total');
    var runningEl = document.getElementById('flow-stat-running');
    var pausedEl = document.getElementById('flow-stat-paused');
    var failedEl = document.getElementById('flow-stat-failed');
    var completedEl = document.getElementById('flow-stat-completed');

    if (totalEl) totalEl.textContent = stats.total;
    if (runningEl) runningEl.textContent = stats.running;
    if (pausedEl) pausedEl.textContent = stats.paused;
    if (failedEl) failedEl.textContent = stats.failed;
    if (completedEl) completedEl.textContent = stats.completed;
}

// Render flow list
function renderFlowList(interviews) {
    var list = document.getElementById('flows-list');

    if (!interviews || interviews.length === 0) {
        list.innerHTML = '<div class="sfarc-empty-state">No flow interviews found in the last 24 hours.</div>';
        return;
    }

    list.innerHTML = interviews.map(interview => `
        <div class="sfarc-flow-item sfarc-flow-status-${interview.InterviewStatus.toLowerCase()}" data-id="${interview.Id}">
            <div class="sfarc-flow-item-header">
                <div class="sfarc-flow-name">
                    <span class="sfarc-flow-status-indicator"></span>
                    ${escapeHtml(interview.FlowVersionView?.Label || 'Unknown Flow')}
                </div>
                <div class="sfarc-flow-status-text">${escapeHtml(interview.InterviewStatus)}</div>
            </div>
            <div class="sfarc-flow-item-details">
                <div class="sfarc-flow-detail">
                    <span class="sfarc-flow-detail-label">Started:</span>
                    <span class="sfarc-flow-detail-value">${formatDateTime(interview.CreatedDate)}</span>
                </div>
                <div class="sfarc-flow-detail">
                    <span class="sfarc-flow-detail-label">User:</span>
                    <span class="sfarc-flow-detail-value">${escapeHtml(interview.CreatedBy?.Name || 'Unknown')}</span>
                </div>
                ${interview.PauseLabel ? `
                    <div class="sfarc-flow-detail">
                        <span class="sfarc-flow-detail-label">Pause:</span>
                        <span class="sfarc-flow-detail-value">${escapeHtml(interview.PauseLabel)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="sfarc-flow-item-actions">
                <button class="sfarc-flow-action-btn sfarc-view-flow-details" data-id="${interview.Id}" >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 4V7L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    Details
                </button>
                <a href="${window.location.origin}/lightning/setup/FlowEditView/home?flowId=${interview.FlowVersionViewId}" target="_blank" class="sfarc-flow-action-btn" >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 1L13 4L4 13H1V10L10 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Edit
                </a>
            </div>
        </div>
    `).join('');
}

// Filter flows
function filterFlows() {
    var searchTerm = document.getElementById('flow-search').value.toLowerCase();
    var statusFilter = document.getElementById('flow-status-filter').value;

    var filtered = flowCache.interviews;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(i =>
            (i.FlowVersionView?.Label || '').toLowerCase().includes(searchTerm) ||
            (i.CreatedBy?.Name || '').toLowerCase().includes(searchTerm)
        );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
        filtered = filtered.filter(i => i.InterviewStatus === statusFilter);
    }

    renderFlowList(filtered);
}


// Helper: iOS Spinner HTML
function getLoaderHtml(text) {
    return `
        <div class="sfarc-spinner-container">
            <div class="comet-loader"></div>
            ${text ? `<div class="sfarc-loader-label">${text}</div>` : ''}
        </div>
    `;
}

// Generate skeleton loading rows for smooth table loading
function generateSkeletonRows(count) {
    var html = '';
    for (let i = 0; i < count; i++) {
        var delay = i * 0.05;
        html += `
            <tr class="sfarc-skeleton-row" style="animation-delay: ${delay}s">
                <td style="width: 36px; padding: 8px 4px; text-align: center;"><div class="sfarc-skeleton-cell" style="width: 16px; height: 16px; margin: 0 auto;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 60px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 100px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 140px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 200px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 60px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 50px; height: 12px;"></div></td>
                <td><div class="sfarc-skeleton-cell" style="width: 80px; height: 12px;"></div></td>
            </tr>
        `;
    }
    return html;
}

// Optimized merge sort for debug logs (O(n log n) stable sort)
function mergeSortLogs(arr, compareFn) {
    if (arr.length <= 1) return arr;
    
    var mid = Math.floor(arr.length / 2);
    var left = mergeSortLogs(arr.slice(0, mid), compareFn);
    var right = mergeSortLogs(arr.slice(mid), compareFn);
    
    return merge(left, right, compareFn);
}

function merge(left, right, compareFn) {
    var result = [];
    var i = 0, j = 0;
    
    while (i < left.length && j < right.length) {
        if (compareFn(left[i], right[j]) <= 0) {
            result.push(left[i++]);
        } else {
            result.push(right[j++]);
        }
    }
    
    return result.concat(left.slice(i), right.slice(j));
}

// Format date/time
function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    var date = new Date(dateString);
    var now = new Date();
    var diff = now - date;

    // Handle future dates (e.g. Expiration Date)
    if (diff < 0) {
        var absDiff = Math.abs(diff);
        if (absDiff < 60000) return 'In less than a minute';
        if (absDiff < 3600000) {
            var mins = Math.floor(absDiff / 60000);
            return `In ${mins} min${mins > 1 ? 's' : ''}`;
        }
        if (absDiff < 86400000) {
            var hours = Math.floor(absDiff / 3600000);
            return `In ${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Less than 1 minute
    if (diff < 60000) return 'Just now';

    // Less than 1 hour
    if (diff < 3600000) {
        var mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
        var hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Format as date
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update last refresh time
function updateLastRefreshTime() {
    var elem = document.getElementById('flow-last-update');
    if (elem && flowCache.lastUpdate) {
        elem.textContent = formatDateTime(flowCache.lastUpdate.toISOString());
    }
}

// Update error badge
function updateErrorBadge() {
    var badge = document.getElementById('flow-error-badge');
    if (badge) {
        if (flowCache.errorCount > 0) {
            badge.textContent = flowCache.errorCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Start polling
function startFlowPolling() {
    stopFlowPolling();

    var autoRefresh = document.getElementById('flow-auto-refresh');
    if (autoRefresh && autoRefresh.checked) {
        flowPollingInterval = setInterval(() => {
            if (!chrome.runtime?.id) {
                clearInterval(flowPollingInterval);
                return;
            }
            if (currentTab === 'flows' && document.visibilityState === 'visible') {
                refreshFlowData(false);
            }
        }, 60000); // 60 seconds
    }
}

// Stop polling
function stopFlowPolling() {
    if (flowPollingInterval) {
        clearInterval(flowPollingInterval);
        flowPollingInterval = null;
    }
}

// Toggle auto-refresh
function toggleAutoRefresh(e) {
    if (e.target.checked) {
        startFlowPolling();
    } else {
        stopFlowPolling();
    }
}

// Export flow data
function exportFlowData() {
    var data = {
        exported: new Date().toISOString(),
        totalFlows: flowCache.interviews.length,
        errorCount: flowCache.errorCount,
        flows: flowCache.interviews.map(i => ({
            id: i.Id,
            flowName: i.FlowVersionView?.Label,
            status: i.InterviewStatus,
            startedDate: i.CreatedDate,
            startedBy: i.CreatedBy?.Name,
            pauseReason: i.PauseLabel
        }))
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = `flow-monitor-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// View flow details (placeholder for future implementation)
function viewFlowDetails(interviewId) {
    toast.error(`Flow details viewer coming soon!\n\nInterview ID: ${interviewId}\n\nThis will show:\n- Variable values\n- Execution timeline\n- Error details\n- Debug logs`);
}

// Make viewFlowDetails globally accessible
window.viewFlowDetails = viewFlowDetails;
// DevTools - In-Browser Apex/LWC Development
// DevTools State
// devToolsCache moved to top


// Load DevTools content
async function loadDevToolsContent() {
    var container = document.getElementById('sfarc-devtools-container');

    if (!container) return;

    // If already initialized, just return (or refresh)
    if (container.children.length > 0) {
        return;
    }

    container.innerHTML = `
        <div class="sfarc-devtools-wrapper">
            <!-- Apex Code Feature View -->
            <div class="sfarc-devtools-content" id="devtools-apex" style="display: block;">

                <div class="sfarc-devtools-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-code" style="color: var(--primary-color);"></i>
                        <span style="font-weight: 500; font-size: 15px; color: var(--sfarc-text);">Apex Code Explorer</span>
                    </div>

                    <div class="sfarc-debug-search-wrapper" style="width: 300px;">
                        <div class="sfarc-debug-search-icon">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <input type="text" id="apex-search" placeholder="Search Apex classes and triggers..." class="sfarc-debug-search-input" />
                    </div>
                    <div class="sfarc-debug-controls-right" style="display: flex; gap: 8px; align-items: center;">
                        <select id="apex-type-filter" class="sfarc-debug-select" style="max-width: 150px;">
                            <option value="all">All Types</option>
                            <option value="class">Classes Only</option>
                            <option value="trigger">Triggers Only</option>
                        </select>

                        <button id="apex-refresh-btn" class="sfarc-debug-icon-btn" >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C9.8 2 11.4 2.8 12.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M12 2V4H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>


                <div class="sfarc-devtools-main">
                    <!-- Code List -->
                    <div class="sfarc-code-list" id="apex-code-list">
                        <div class="sfarc-loading">Loading Apex code...</div>
                    </div>
                </div>
            </div>

        </div>
    `;

    var apexSearch = document.getElementById('apex-search');
    var apexTypeFilter = document.getElementById('apex-type-filter');
    var apexRefreshBtn = document.getElementById('apex-refresh-btn');
    var lwcSearch = document.getElementById('lwc-search');
    var lwcRefreshBtn = document.getElementById('lwc-refresh-btn');

    if (apexSearch) apexSearch.addEventListener('input', filterApexCode);
    if (apexTypeFilter) apexTypeFilter.addEventListener('change', handleApexTypeFilterChange);
    if (lwcSearch) lwcSearch.addEventListener('input', (e) => filterLwcList(e.target.value));
    if (lwcRefreshBtn) lwcRefreshBtn.addEventListener('click', () => loadLwcList(true));
    if (apexRefreshBtn) apexRefreshBtn.addEventListener('click', () => {
        var searchValue = apexSearch ? apexSearch.value : '';
        loadApexCode(searchValue, true);
    });


    // Initial load
    await loadApexCode(null, true);
}

// Handle DevTools tab switching
function handleDevToolsTabClick(e) {
    var tab = e.currentTarget.dataset.devtab;

    // Update tab states
    document.querySelectorAll('.sfarc-devtools-tab').forEach(t => t.classList.remove('active'));
    e.currentTarget.classList.add('active');

    if (tab === 'data') {
        chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'data-builder' });
        return; // Don't switch tab in current UI
    }

    // Show/hide content
    document.querySelectorAll('.sfarc-devtools-content').forEach(c => c.style.display = 'none');
    document.getElementById(`devtools-${tab}`).style.display = 'block';
}

// Separate LWC Standalone Feature
async function loadLwcContent() {
    var container = document.getElementById('sfarc-lwc-container');
    if (!container) return;

    if (container.children.length === 0) {
        container.innerHTML = `
            <div style="padding: 12px 20px; background: var(--sfarc-bg); border-bottom: 1px solid var(--sfarc-border); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-cubes" style="color: var(--primary-color);"></i>
                    <span style="font-weight: 500; font-size: 15px; color: var(--sfarc-text);">Lightning Web Components</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="lwc-create-btn" title="Create New LWC Component" style="background: linear-gradient(135deg, var(--sfarc-accent, #2196f3) 0%, var(--sfarc-accent-dark, #1976d2) 100%); color: var(--sfarc-accent-contrast, white); border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;">
                        <i class="fa-solid fa-plus"></i> Create New LWC
                    </button>
                    <button id="lwc-refresh-btn"  style="background: transparent; border: 1px solid var(--sfarc-border, #ccc); color: var(--sfarc-text); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-size: 13px; padding: 0; box-sizing: border-box;">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                </div>
            </div>
            <div class="sfarc-code-list" id="lwc-list" style="flex: 1; min-height: 0; overflow-y: auto;">
                <div class="sfarc-loading">Loading LWC...</div>
            </div>
        `;

        var refreshBtn = document.getElementById('lwc-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => loadLwcList(true));
        }

        var createBtn = document.getElementById('lwc-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                await storeSessionForEditor();
                chrome.runtime.sendMessage({
                    action: 'openExtensionPage',
                    page: 'code-editor'
                });
            });
        }
    }

    loadLwcList();
}

// Cache for LWC
var lwcCache = null;

// Load LWC List
async function loadLwcList(forceRefresh = false) {
    var list = document.getElementById('lwc-list');
    if (!list) return;

    if (lwcCache && !forceRefresh) {
        renderLwcList(lwcCache);
        return;
    }

    list.innerHTML = getLoaderHtml();

    try {
        // Use only bundle fields supported by the Tooling API. A relationship
        // field here can make the complete query fail in some Salesforce orgs.
        var query = `
            SELECT Id, DeveloperName, MasterLabel, ApiVersion, LastModifiedDate
            FROM LightningComponentBundle
            ORDER BY DeveloperName
        `;
        var result = await window.sfApi.query(query, true); // Use Tooling API

        // sfApi returns Salesforce error payloads instead of throwing. Do not
        // turn those responses into a cached, misleading empty result.
        if (!result || result.errorCode || Array.isArray(result)) {
            var error = Array.isArray(result) ? result[0] : result;
            throw new Error(error?.message || error?.errorCode || 'Salesforce could not load Lightning Web Components.');
        }

        lwcCache = Array.isArray(result.records) ? result.records : [];

        // Fetch API versions from js-meta.xml files since ApiVersion field may be empty
        try {
            var metaQuery = `SELECT Source, FilePath FROM LightningComponentResource WHERE FilePath LIKE '%js-meta.xml'`;
            var metaResult = await window.sfApi.query(metaQuery, true);
            if (metaResult && metaResult.records) {
                var versionMap = {};
                metaResult.records.forEach(function(r) {
                    var match = r.Source && r.Source.match(/<apiVersion>([^<]+)<\/apiVersion>/i);
                    if (match && r.FilePath) {
                        var lwcName = r.FilePath.split('/')[1];
                        if (lwcName) versionMap[lwcName] = match[1].trim();
                    }
                });
                lwcCache.forEach(function(cmp) {
                    if (!cmp.ApiVersion && versionMap[cmp.DeveloperName]) {
                        cmp.ApiVersion = versionMap[cmp.DeveloperName];
                    }
                });
            }
        } catch (e2) { /* fallback: show empty version */ }

        renderLwcList(lwcCache);

    } catch (e) {
        console.error('Error loading LWC:', e);
        list.innerHTML = `<div class="sfarc-error-msg">Error loading LWC: ${window.escapeHtml(e.message)}</div>`;
    }
}

function renderLwcList(components) {
    var list = document.getElementById('lwc-list');
    var globalSearch = document.getElementById('sfarc-global-search');
    var searchTerm = (globalSearch ? globalSearch.value : '').toLowerCase();

    list.innerHTML = '';

    var filtered = components.filter(c =>
        !searchTerm || (c.MasterLabel && c.MasterLabel.toLowerCase().includes(searchTerm))
    );

    if (filtered.length === 0) {
        list.innerHTML = '<div class="sfarc-empty-msg">No Lightning Web Components found.</div>';
        return;
    }

    // Create Table Container
    var tableContainer = document.createElement('div');
    tableContainer.className = 'sfarc-apex-table-container';

    // Create Table
    var table = document.createElement('table');
    table.className = 'sfarc-apex-table';

    // Header
    table.innerHTML = `
        <thead>
            <tr>
                <th>Component Name</th>
                <th>API Version</th>
                <th>Last Modified Date</th>
                <th>Last Modified By</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    var tbody = table.querySelector('tbody');

    sfarcRenderChunkedList(tbody, filtered, (cmp) => {
        var tr = document.createElement('tr');
        tr.className = 'sfarc-code-row'; // Reuse hover styles

        var byName = cmp.LastModifiedBy?.Name || '';
        tr.innerHTML = `
            <td>
                <div class="sfarc-cell-flex">
                    <div class="sfarc-code-icon lwc" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:transparent;border-radius:4px;color:#ff9800;font-size:14px;">
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                    <span class="sfarc-cell-title">${escapeHtml(cmp.MasterLabel || cmp.DeveloperName || 'Unnamed component')}</span>
                </div>
            </td>
            <td><span class="sfarc-live-version">v${escapeHtml(cmp.ApiVersion || '')}</span></td>
            <td><span class="sfarc-cell-text">${formatApexDate(cmp.LastModifiedDate)}</span></td>
            <td>${byName ? escapeHtml(byName) : '<span class="sfarc-cell-muted">\u2014</span>'}</td>
        `;

        // Open component in Code Editor
        tr.onclick = async () => {
            // Store session first
            await storeSessionForEditor();

            // Open editor with bundle params via background script
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'code-editor',
                params: {
                    bundleId: cmp.Id,
                    bundleName: cmp.MasterLabel
                }
            });
        };

        return tr;
    }, { moreTag: 'tr', moreColspan: 4 });

    tableContainer.appendChild(table);
    list.appendChild(tableContainer);
}

function filterLwcList(term) {
    if (lwcCache) {
        renderLwcList(lwcCache);
    }
}

// Load Apex code from org
async function loadApexCode(searchTerm = null, isRefresh = false) {

    var list = document.getElementById('apex-code-list');
    // Only show loader if explicit refresh or initial load (not just typing)
    if ((isRefresh || !searchTerm) && list) {
        list.innerHTML = getLoaderHtml();
    } else if (list && searchTerm) {
        // Opacity or small loading indicator for search could be better, but let's keep it simple
        list.style.opacity = '0.5';
    }

    try {
        var limitClause = 'LIMIT 50';
        var classWhere = '';
        var triggerWhere = '';

        if (searchTerm) {
            var cleanTerm = escapeSoqlLikeLiteral(searchTerm);
            classWhere = `WHERE Name LIKE '%${cleanTerm}%'`;
            triggerWhere = `WHERE Name LIKE '%${cleanTerm}%'`; // TableEnumOrId doesn't support LIKE
        }

        // Query Apex Classes
        var classQuery = `
            SELECT Id, Name, Body, ApiVersion, Status, LengthWithoutComments,
                   LastModifiedDate, LastModifiedBy.Name, CreatedDate, CreatedBy.Name
            FROM ApexClass
            ${classWhere}
            ORDER BY Name
            ${limitClause}
        `;

        // Query Apex Triggers
        var triggerQuery = `
            SELECT Id, Name, Body, ApiVersion, Status, TableEnumOrId,
                   LastModifiedDate, LastModifiedBy.Name, CreatedDate, CreatedBy.Name
            FROM ApexTrigger
            ${triggerWhere}
            ORDER BY Name
            ${limitClause}
        `;

        // Code Coverage (Cache it once if possible, or fetch small batch?)
        // Fetching full coverage every keystroke is bad.
        // Let's fetch coverage only if not cached, OR if we want to ensure we have it for these results.
        // For optimization: Fetch coverage for the specific IDs returned?
        // Querying "WHERE ApexClassOrTriggerId IN..." is better but ID list might be long.
        // Let's stick to full aggregate query ONCE if not loaded, or just refresh it on explicit refresh.
        // If we limit to 50, maybe we don't need coverage for ALL.

        // Strategy: Load full coverage map on INITIAL (or Refresh) load.
        // On Search: Use cached coverage map.

        var promiseList = [
            window.sfApi.query(classQuery, true),
            window.sfApi.query(triggerQuery, true)
        ];

        // Fetch coverage only if not loaded or force refresh
        if (!metadataState.coverageLoaded || isRefresh) {
            var coverageQuery = `
                SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered 
                FROM ApexCodeCoverageAggregate 
                WHERE NumLinesCovered > 0 OR NumLinesUncovered > 0
            `;
            promiseList.push(window.sfApi.query(coverageQuery, true));
        }

        var results = await Promise.all(promiseList);
        var classResult = results[0];
        var triggerResult = results[1];

        // Update coverage cache if we fetched it
        if (results[2]) {
            var coverageResult = results[2];
            var coverageMap = {};
            (coverageResult.records || []).forEach(r => {
                var covered = r.NumLinesCovered || 0;
                var uncovered = r.NumLinesUncovered || 0;
                var total = covered + uncovered;
                var percent = total > 0 ? Math.round((covered / total) * 100) : 0;
                coverageMap[r.ApexClassOrTrigger.Name] = { percent, covered, uncovered };
            });
            metadataState.coverageCache = coverageMap;
            metadataState.coverageLoaded = true;
        }

        // Process Results with cached coverage
        var coverageMap = metadataState.coverageCache || {};

        devToolsCache.apexClasses = (classResult.records || []).map(r => ({
            ...r,
            type: 'class',
            coverage: coverageMap[r.Name] || { percent: 0, covered: 0, uncovered: 0 }
        }));
        devToolsCache.apexTriggers = (triggerResult.records || []).map(r => ({
            ...r,
            type: 'trigger',
            coverage: coverageMap[r.Name] || { percent: 0, covered: 0, uncovered: 0 }
        }));
        devToolsCache.lastUpdate = new Date();

        // Render
        var allItems = [...devToolsCache.apexClasses, ...devToolsCache.apexTriggers];

        // Re-sort combined list by Name because class/trigger separate queries might mix order
        allItems.sort((a, b) => a.Name.localeCompare(b.Name));

        if (list) list.style.opacity = '1';
        renderApexCodeList(allItems);

    } catch (error) {
        console.error('Error loading Apex code:', error);
        var list = document.getElementById('apex-code-list');
        if (list) list.innerHTML = `<div class="sfarc-error-state">Failed to load Apex code. ${window.escapeHtml(error.message)}</div>`;
    }
}

// Compact date for the Apex explorer: relative under 24h, else a clear
// "Aug 11, 2026, 20:42" format (avoids locale-ambiguous DD/MM strings).
function formatApexDate(dateString) {
    if (!dateString) return 'Unknown';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    if (Date.now() - date.getTime() < 86400000) return formatDateTime(dateString);
    return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// Render Apex code list
function renderApexCodeList(items) {
    var list = document.getElementById('apex-code-list');

    if (!items || items.length === 0) {
        list.innerHTML = '<div class="sfarc-empty-state">No Apex code found.</div>';
        return;
    }

    // Table Header
    var html = `
        <div class="sfarc-apex-table-container">
            <table class="sfarc-apex-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Code Coverage</th>
                        <th>Line Covered</th>
                        <th>Last Modified</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
    `;


    html += items.map(item => {
        var cov = item.coverage;
        var colorClass = 'high';
        if (cov.percent < 75) colorClass = 'medium';
        if (cov.percent < 65) colorClass = 'low';

        // Icons
        var iconUser = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sfarc-icon-muted"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        var iconClock = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sfarc-icon-muted"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        var iconCode = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9H2M14 17.5L16.5 15L14 12.5M10 12.5L7.5 15L10 17.5M2 7.8L2 16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27977 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3L6.8 3C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8Z"></path></svg>`;
        var iconTrigger = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>`;
        var iconLines = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sfarc-icon-muted"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;

        var typeIcon = item.type === 'class' ? iconCode : iconTrigger;
        var typeLabel = item.type === 'class' ? 'APEX CLASS' : 'APEX TRIGGER';

        return `
        <tr class="sfarc-code-row sfarc-code-link" data-id="${item.Id}" data-name="${item.Name}" data-type="${item.type}">
            <!-- Type -->
            <td class="sfarc-col-type">
                <span class="sfarc-type-pill ${item.type === 'trigger' ? 'trigger' : 'class'}">
                    ${typeIcon} <span>${typeLabel}</span>
                </span>
            </td>
            
            <!-- Name -->
            <td class="sfarc-col-name">
                <div class="sfarc-cell-title">${escapeHtml(item.Name)}</div>
            </td>


            <!-- Code Coverage -->
            <td class="sfarc-col-coverage">
                <div class="sfarc-cov" title="${cov.covered} of ${cov.covered + cov.uncovered} lines covered">
                    <div class="sfarc-cov-track">
                        <div class="sfarc-cov-fill ${colorClass}" style="width: ${Math.min(100, cov.percent)}%;"></div>
                    </div>
                    <span class="sfarc-cov-pct ${colorClass}">${cov.percent}%</span>
                </div>
            </td>

            <!-- Line Covered -->
            <td class="sfarc-col-lines">
                <span class="sfarc-lines-chip">
                    ${iconLines} <span>${cov.covered}/${cov.covered + cov.uncovered}</span>
                </span>
            </td>


            <!-- Last Modified -->
            <td class="sfarc-col-modified" title="Modified by: ${escapeHtml(item.LastModifiedBy?.Name || 'Unknown')}">
                <div class="sfarc-cell-text">${formatApexDate(item.LastModifiedDate)}</div>
            </td>

            <!-- Created -->
            <td class="sfarc-col-created" title="Created by: ${escapeHtml(item.CreatedBy?.Name || 'Unknown')}">
                <div class="sfarc-cell-text">${formatApexDate(item.CreatedDate)}</div>
            </td>

        </tr>
    `;
    }).join('');

    html += `
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = html;

    // Add event listeners to all code items
    setTimeout(() => {
        document.querySelectorAll('.sfarc-code-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                var id = link.dataset.id;
                var name = link.dataset.name;

                // Store session first
                await storeSessionForEditor();

                // Then open editor via background script
                chrome.runtime.sendMessage({
                    action: 'openExtensionPage',
                    page: 'code-editor',
                    params: {
                        id: id,
                        name: name
                    }
                });
            });
        });
    }, 100);
}

// Store session info for code editor
async function storeSessionForEditor() {
    try {
        var sessionId = window.sfApi?.sessionId;
        var instanceUrl = window.sfApi?.instanceUrl;

        // Ensure instanceUrl is a valid Salesforce org URL and not chrome-extension://
        if (!instanceUrl || instanceUrl.startsWith('chrome-extension:')) {
            instanceUrl = window.sfApi?.serverUrl || (window.location.origin.startsWith('chrome-extension:') ? '' : window.location.origin);
        }

        if (sessionId && instanceUrl && !instanceUrl.startsWith('chrome-extension:')) {
            // Sanitize a stored URL that may carry an old doubled .my.
            // (xxx.trailblaze.my.my.salesforce.com) on Trailblazer orgs.
            instanceUrl = instanceUrl.replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com');
            var sessionData = {
                sessionId: sessionId,
                instanceUrl: instanceUrl,
                timestamp: Date.now()
            };
            await chrome.storage.session.set({
                sessionInfo: sessionData,
                sfarc_cached_session: sessionData
            });
        } else {
            console.error('Missing or invalid session info for Code Editor:', { sessionId: !!sessionId, instanceUrl });
        }
    } catch (error) {
        console.error('Error storing session for Code Editor:', error);
    }
}

// Filter Apex code (Debounced server-side)
var apexSearchTimeout = null;

function filterApexCode() {
    var searchInput = document.getElementById('apex-search');
    // Type filter is currently client-side post-fetch in render, OR we can add to query.
    // Simplifying: Let's fetch results based on name, then if we need to filter type locally we can, 
    // OR we can pass type to loadApexCode.
    // Given the current structure, loadApexCode fetches both. 
    // Let's rely on loadApexCode to fetch relevant items matching name.
    // Then renderApexCodeList can handle the type visibility if needed, OR we can just show all matches.

    // Actually, renderApexCodeList takes the list. 
    // If we want to support "Classes Only" via API, we would need to only query one table.
    // If we re-fetch with LIMIT 50, client-side filter on just 50 items is fine.
    // But if we want "Classes Only" and we have 50 triggers, we might see 0 classes if we don't query specifically.
    // For simplicity and typical usage, let's just re-render current results with filter 
    // UNLESS we want to push type filtering to SOQL to maximize relevant results.
    // Let's stick to client-side filtering of the *fetched* results for now, as `loadApexCode` fetches both tables.
    // We can modify `loadApexCode` to respect type filter later if needed, but the current `loadApexCode` 
    // puts results in `devToolsCache`. 

    // Wait, `loadApexCode` now RENDERS immediately at the end.
    // We should intercept or pass the type filter to `renderApexCodeList`.
    // Let's modify `filterApexCode` to just handle the Search Input (server side).
    // And add a listener for Type Filter to just re-render from cache?
    // But `loadApexCode` overwrites cache.
    // So Type Filter change should probably just trigger `renderApexCodeList` with current cache.

    // Let's trigger loadApexCode with the term.

    if (apexSearchTimeout) clearTimeout(apexSearchTimeout);

    apexSearchTimeout = setTimeout(() => {
        var term = searchInput ? searchInput.value.trim() : '';
        loadApexCode(term);
    }, 400); // 400ms debounce
}

// Separate handler for Type Filter change (Client-side fast filter on current results? Or re-fetch?)
// If we re-fetch with LIMIT 50, client-side filter on just 50 items is fine.
// But if we want "Classes Only" and we have 50 triggers, we might see 0 classes if we don't query specifically.
// For simplicity and typical usage, let's just re-render current results with filter 
// UNLESS we want to push type filtering to SOQL to maximize relevant results.
// Let's stick to client-side filtering of the *fetched* results for now, as `loadApexCode` fetches both tables.
// We can modify `loadApexCode` to respect type filter later if needed, but the current `loadApexCode` 
// puts results in `devToolsCache`. 

// Wait, `loadApexCode` now RENDERS immediately at the end.
// We should intercept or pass the type filter to `renderApexCodeList`.
// Let's modify `filterApexCode` to just handle the Search Input (server side).
// And add a listener for Type Filter to just re-render from cache?
// But `loadApexCode` overwrites cache.
// So Type Filter change should probably just trigger `renderApexCodeList` with current cache.

function handleApexTypeFilterChange() {
    var typeFilterInput = document.getElementById('apex-type-filter');
    var typeFilter = typeFilterInput ? typeFilterInput.value : 'all';

    var items = [...(devToolsCache.apexClasses || []), ...(devToolsCache.apexTriggers || [])];

    if (typeFilter !== 'all') {
        items = items.filter(i => i.type === typeFilter);
    }

    // Sort again just in case
    items.sort((a, b) => a.Name.localeCompare(b.Name));
    renderApexCodeList(items);
}

// View Apex code
async function viewApexCode(id, type) {
    var viewer = document.getElementById('apex-code-viewer');
    viewer.innerHTML = '<div class="sfarc-loading">Loading code...</div>';

    try {
        // Find the item in cache
        var allItems = [...devToolsCache.apexClasses, ...devToolsCache.apexTriggers];
        var item = allItems.find(i => i.Id === id);

        if (!item) {
            viewer.innerHTML = '<div class="sfarc-error-state">Code not found.</div>';
            return;
        }

        devToolsCache.selectedCode = item;

        // Render code viewer
        viewer.innerHTML = `
            <div class="sfarc-code-viewer-header">
                <div class="sfarc-code-viewer-title">
                    <span class="sfarc-code-item-icon ${type === 'class' ? 'sfarc-icon-class' : 'sfarc-icon-trigger'}">
                        ${type === 'class' ? 'C' : 'T'}
                    </span>
                    <h3>${escapeHtml(item.Name)}</h3>
                    ${item.Status === 'Inactive' ? '<span class="sfarc-code-status-inactive">Inactive</span>' : ''}
                </div>
                <div class="sfarc-code-viewer-actions">
                    <a href="${window.location.origin}/lightning/setup/${type === 'class' ? 'ApexClasses' : 'ApexTriggers'}/page?address=%2F${item.Id}" target="_blank" class="sfarc-code-action-btn" >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 1H13V4M13 1L7 7M6 1H2C1.44772 1 1 1.44772 1 2V12C1 12.5523 1.44772 13 2 13H12C12.5523 13 13 12.5523 13 12V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Open in Setup
                    </a>
                    <button class="sfarc-code-action-btn sfarc-copy-apex-code" >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M3 10H2C1.44772 10 1 9.55228 1 9V2C1 1.44772 1.44772 1 2 1H9C9.55228 1 10 1.44772 10 2V3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        Copy
                    </button>
                </div>
            </div>
            <div class="sfarc-code-viewer-info">
                ${type === 'trigger' && item.TableEnumOrId ? `<span>On: <strong>${item.TableEnumOrId}</strong></span>` : ''}
                <span>API Version: <strong>${item.ApiVersion}</strong></span>
                <span>Created: <strong>${formatDateTime(item.CreatedDate)}</strong> by ${escapeHtml(item.CreatedBy?.Name || 'Unknown')}</span>
                <span>Modified: <strong>${formatDateTime(item.LastModifiedDate)}</strong> by ${escapeHtml(item.LastModifiedBy?.Name || 'Unknown')}</span>
            </div>
            <div class="sfarc-code-viewer-body">
                <pre><code class="language-apex">${escapeHtml(item.Body || '// No code available')}</code></pre>
            </div>
        `;

        // Highlight selected item in list
        document.querySelectorAll('.sfarc-code-item').forEach(el => el.classList.remove('selected'));
        document.querySelector(`.sfarc-code-item[data-id="${id}"]`)?.classList.add('selected');
    } catch (error) {
        console.error('Error viewing code:', error);
        viewer.innerHTML = '<div class="sfarc-error-state">Failed to load code.</div>';
    }
}

// Copy code to clipboard
function copyApexCode() {
    if (!devToolsCache.selectedCode) return;

    var code = devToolsCache.selectedCode.Body;
    navigator.clipboard.writeText(code).then(() => {
        toast.success('Code copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Make functions globally accessible
window.viewApexCode = viewApexCode;
window.copyApexCode = copyApexCode;
// Global Search - Flows, LWC, and Apex
var globalSearchCache = {
    flows: [],
    lwc: [],
    apex: [],
    lastUpdate: null
};

// Add global search capabilities to main search
async function enhancedGlobalSearch(query) {
    if (!query || query.length < 2) return [];

    var results = {
        flows: [],
        lwc: [],
        apex: []
    };

    try {
        // Search Flows
        results.flows = await searchFlows(query);

        // Search LWC
        results.lwc = await searchLWC(query);

        // Search Apex (enhanced)
        results.apex = await searchApexCode(query);
    } catch (error) {
        console.error('Global search error:', error);
    }

    return results;
}

// Search Flows
async function searchFlows(query) {
    try {
        var lowerQuery = query.toLowerCase();

        // Query FlowDefinition for all flows
        var flowQuery = `
            SELECT Id, DeveloperName, MasterLabel, Description, ProcessType, 
                   ActiveVersionId, LatestVersionId, IsActive, NamespacePrefix
            FROM FlowDefinition
            WHERE DeveloperName LIKE '%${query}%' 
               OR MasterLabel LIKE '%${query}%'
            ORDER BY MasterLabel
            LIMIT 50
        `;

        var result = await window.sfApi.query(flowQuery, true); // Tooling API

        return (result.records || []).map(flow => ({
            id: flow.Id,
            name: flow.DeveloperName,
            label: flow.MasterLabel,
            description: flow.Description,
            type: flow.ProcessType,
            isActive: flow.IsActive,
            activeVersionId: flow.ActiveVersionId,
            namespace: flow.NamespacePrefix,
            category: 'Flow',
            url: `${window.location.origin}/lightning/setup/Flows/page?address=%2F${flow.ActiveVersionId || flow.LatestVersionId}`
        }));
    } catch (error) {
        console.error('Flow search error:', error);
        return [];
    }
}

// Search LWC
async function searchLWC(query) {
    try {
        var lowerQuery = query.toLowerCase();

        // Query LightningComponentBundle
        var lwcQuery = `
            SELECT Id, DeveloperName, Description, NamespacePrefix, ApiVersion,
                   IsExposed, MasterLabel
            FROM LightningComponentBundle
            WHERE DeveloperName LIKE '%${query}%' 
               OR MasterLabel LIKE '%${query}%'
            ORDER BY DeveloperName
            LIMIT 50
        `;

        var result = await window.sfApi.query(lwcQuery, true); // Tooling API

        return (result.records || []).map(lwc => ({
            id: lwc.Id,
            name: lwc.DeveloperName,
            label: lwc.MasterLabel || lwc.DeveloperName,
            description: lwc.Description,
            namespace: lwc.NamespacePrefix,
            apiVersion: lwc.ApiVersion,
            isExposed: lwc.IsExposed,
            category: 'LWC',
            url: `${window.location.origin}/lightning/setup/LightningComponentBundles/page?address=%2F${lwc.Id}`
        }));
    } catch (error) {
        console.error('LWC search error:', error);
        return [];
    }
}

// Enhanced Apex code search (full-text)
async function searchApexCode(query) {
    try {
        var lowerQuery = query.toLowerCase();
        var results = [];

        // First try name-based search (fast)
        var nameQuery = `
            SELECT Id, Name, Body, ApiVersion, LengthWithoutComments
            FROM ApexClass
            WHERE Name LIKE '%${query}%'
            ORDER BY Name
            LIMIT 25
        `;

        var classResult = await window.sfApi.query(nameQuery, true);
        results = results.concat((classResult.records || []).map(cls => ({
            id: cls.Id,
            name: cls.Name,
            type: 'Class',
            body: cls.Body,
            apiVersion: cls.ApiVersion,
            lines: cls.LengthWithoutComments,
            category: 'Apex',
            matches: [{ type: 'name', line: 0 }],
            url: `${window.location.origin}/lightning/setup/ApexClasses/page?address=%2F${cls.Id}`
        })));

        // Search triggers
        var triggerQuery = `
            SELECT Id, Name, Body, ApiVersion, TableEnumOrId
            FROM ApexTrigger
            WHERE Name LIKE '%${query}%'
            ORDER BY Name
            LIMIT 25
        `;

        var triggerResult = await window.sfApi.query(triggerQuery, true);
        results = results.concat((triggerResult.records || []).map(trg => ({
            id: trg.Id,
            name: trg.Name,
            type: 'Trigger',
            object: trg.TableEnumOrId,
            body: trg.Body,
            apiVersion: trg.ApiVersion,
            category: 'Apex',
            matches: [{ type: 'name', line: 0 }],
            url: `${window.location.origin}/lightning/setup/ApexTriggers/page?address=%2F${trg.Id}`
        })));

        // If query is longer, do full-text search in code bodies
        if (query.length >= 4) {
            // Search in code bodies (client-side)
            var allApex = [...(devToolsCache.apexClasses || []), ...(devToolsCache.apexTriggers || [])];

            for (const item of allApex) {
                if (item.Body && item.Body.toLowerCase().includes(lowerQuery)) {
                    // Find if already in results by name search
                    var existing = results.find(r => r.id === item.Id);
                    if (!existing) {
                        // Find matching lines
                        var lines = item.Body.split('\n');
                        var matchingLines = [];
                        lines.forEach((line, index) => {
                            if (line.toLowerCase().includes(lowerQuery)) {
                                matchingLines.push({
                                    type: 'code',
                                    line: index + 1,
                                    content: line.trim().substring(0, 100)
                                });
                            }
                        });

                        if (matchingLines.length > 0) {
                            results.push({
                                id: item.Id,
                                name: item.Name,
                                type: item.type === 'class' ? 'Class' : 'Trigger',
                                body: item.Body,
                                matches: matchingLines.slice(0, 5), // Top 5 matches
                                category: 'Apex',
                                url: `${window.location.origin}/lightning/setup/${item.type === 'class' ? 'ApexClasses' : 'ApexTriggers'}/page?address=%2F${item.Id}`
                            });
                        }
                    } else {
                        // Update existing with code matches
                        var lines = item.Body.split('\n');
                        var matchingLines = [];
                        lines.forEach((line, index) => {
                            if (line.toLowerCase().includes(lowerQuery)) {
                                matchingLines.push({
                                    type: 'code',
                                    line: index + 1,
                                    content: line.trim().substring(0, 100)
                                });
                            }
                        });
                        if (matchingLines.length > 0) {
                            existing.matches = existing.matches.concat(matchingLines.slice(0, 5));
                        }
                    }
                }
            }
        }

        return results;
    } catch (error) {
        console.error('Apex search error:', error);
        return [];
    }
}

// Render global search results
function renderGlobalSearchResults(results) {
    var suggestions = document.getElementById('sfarc-suggestions');

    var html = '';
    var totalResults = 0;

    // Flows section
    if (results.flows && results.flows.length > 0) {
        totalResults += results.flows.length;
        html += `
            <div class="sfarc-search-category">
                <h4 class="sfarc-category-header">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 2V7M7 7L10 4M7 7L4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <circle cx="7" cy="11" r="1" fill="currentColor"/>
                    </svg>
                    Flows (${results.flows.length})
                </h4>
                ${results.flows.map(flow => `
                    <div class="sfarc-suggestion-item sfarc-suggestion-item-toggle">
                        <div class="sfarc-search-result-icon sfarc-flow-icon">F</div>
                        <div class="sfarc-search-result-content">
                            <div class="sfarc-search-result-title">
                                ${escapeHtml(flow.label)}
                                <a href="${flow.url}" target="_blank" class="sfarc-open-link">Open</a>
                            </div>
                            <div class="sfarc-search-result-meta">
                                <span>${flow.type}</span>
                                ${flow.isActive ? '<span class="sfarc-status-active">Active</span>' : '<span class="sfarc-status-inactive">Inactive</span>'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // LWC section
    if (results.lwc && results.lwc.length > 0) {
        totalResults += results.lwc.length;
        html += `
            <div class="sfarc-search-category">
                <h4 class="sfarc-category-header">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 7L7 2L12 7M3 6L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Lightning Web Components (${results.lwc.length})
                </h4>
                ${results.lwc.map(lwc => `
                    <div class="sfarc-suggestion-item sfarc-suggestion-item-toggle">
                        <div class="sfarc-search-result-icon sfarc-lwc-icon"><i class="fa-solid fa-layer-group"></i></div>
                        <div class="sfarc-search-result-content">
                            <div class="sfarc-search-result-title">
                                ${escapeHtml(lwc.name)}
                                <a href="${lwc.url}" target="_blank" class="sfarc-open-link">Open</a>
                            </div>
                            <div class="sfarc-search-result-meta">
                                <span>v${lwc.apiVersion}</span>
                                ${lwc.isExposed ? '<span class="sfarc-status-exposed">Exposed</span>' : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Apex section
    if (results.apex && results.apex.length > 0) {
        totalResults += results.apex.length;
        html += `
            <div class="sfarc-search-category">
                <h4 class="sfarc-category-header">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 5L2 8L4 11M10 5L12 8L10 11M8 2L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Apex Code (${results.apex.length})
                </h4>
                ${results.apex.map(apex => `
                    <div class="sfarc-suggestion-item sfarc-view-apex-code" data-id="${apex.id}" data-type="${apex.type.toLowerCase()}">
                        <div class="sfarc-search-result-icon ${apex.type === 'Class' ? 'sfarc-class-icon' : 'sfarc-trigger-icon'}">
                            ${apex.type === 'Class' ? 'C' : 'T'}
                        </div>
                        <div class="sfarc-search-result-content">
                            <div class="sfarc-search-result-title">${escapeHtml(apex.name)}</div>
                            <div class="sfarc-search-result-meta">
                                <span>${apex.type}</span>
                                ${apex.matches && apex.matches.length > 0 ? `<span>${apex.matches.length} match${apex.matches.length > 1 ? 'es' : ''}</span>` : ''}
                            </div>
                            ${apex.matches && apex.matches.some(m => m.type === 'code') ? `
                                <div class="sfarc-search-matches">
                                    ${apex.matches.filter(m => m.type === 'code').slice(0, 2).map(m => `
                                        <div class="sfarc-match-line">
                                            <span class="sfarc-line-number">L${m.line}:</span>
                                            <code>${escapeHtml(m.content)}</code>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (totalResults === 0) {
        html = getEmptyStateHtml('No results found for Flows, LWC, or Apex code.');
    }

    suggestions.innerHTML = html;
}

// Add to global scope
window.enhancedGlobalSearch = enhancedGlobalSearch;
window.renderGlobalSearchResults = renderGlobalSearchResults;

// --- Debug Logs Logic ---

// Utility: Animate refresh icon
function startRefreshAnimation(buttonElement) {
    var icon = buttonElement.querySelector('.fa-arrows-rotate, i, svg');
    if (icon) {
        icon.classList.add('sfarc-refresh-spin');
        buttonElement.style.opacity = '0.7';
    }
}

function stopRefreshAnimation(buttonElement, minDuration = 2000) {
    var icon = buttonElement.querySelector('.fa-arrows-rotate, i, svg');
    if (icon) {
        // Ensure minimum rotation duration for smooth feel
        setTimeout(() => {
            icon.classList.remove('sfarc-refresh-spin');
            buttonElement.style.opacity = '1';
            // Smooth scale bounce on completion
            buttonElement.style.transform = 'scale(1.1)';
            setTimeout(() => {
                buttonElement.style.transform = 'scale(1)';
            }, 150);
        }, minDuration);
    }
}

// --- Debug Logs Logic ---

async function loadDebugLogsContent() {
    // Rely on hideAllContainers called by the tab switcher
    // But ensure it is visible here just in case called directly?
    // Actually, avoiding side effects is better.
    // If this function is ONLY called by handleTabClick, we don't need to touch styles here.
    // But let's leave the explicit show for safety, but remove the hides to avoid confusion.
    var container = document.getElementById('sfarc-debug-logs-view');
    if (container) container.style.display = 'flex'; // Use flex for layout

    await Promise.all([fetchTraceFlags(), fetchDebugLogs()]);
}



// Debug Log State
var allLogs = [];
var filteredLogs = [];
var currentPage = 1;
var rowsPerPage = 15;
var userFilter = '';
var currentUserFilter = false;
var isDeepSearching = false;
var logSearchTimeout = null;
var searchSequenceId = 0;
var logSortKey = 'StartTime';
var logSortDir = 'desc';
var logAutoRefreshTimer = null;

async function fetchDebugLogs() {
    isDeepSearching = false;
    var tbody = document.getElementById('sfarc-debug-logs-body');
    if (!tbody) return;

    // Smooth fade-out before loading
    tbody.classList.add('sfarc-table-fade-out');
    await new Promise(r => setTimeout(r, 150));
    tbody.classList.remove('sfarc-table-fade-out');

    // Skeleton loading animation
    tbody.innerHTML = generateSkeletonRows(8);

    try {
        // Ensure session is initialized before making API calls
        if (!window.sfApi.sessionId) {
            await window.sfApi.init();
        }
        if (!window.sfApi.sessionId || !window.sfApi.instanceUrl) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Could not establish a Salesforce session. Please refresh the page and try again.</td></tr>`;
            return;
        }

        // Fetch a larger batch for client-side filtering/pagination
        var retention = Math.max(20, Math.min(500, Number(settings.logRetention) || 100));
        var query = `SELECT Id, LogUser.Name, LogUser.Id, Operation, Status, DurationMilliseconds, LogLength, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT ${retention}`;
        var response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
        var result = await response.json();

        if (result.records) {
            allLogs = result.records;
            populateUserFilter();
            applyFilters();
        } else {
            allLogs = [];
            filteredLogs = [];
            renderPagination();
        }
    } catch (e) {
        console.error('Error fetching logs', e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Error: ${window.escapeHtml(e.message)}</td></tr>`;
    }
}

function populateUserFilter() {
    var userSelect = document.getElementById('sfarc-log-user-filter');
    var users = new Map();

    // Save the currently selected user before repopulating
    var currentlySelectedUser = userSelect.value;

    allLogs.forEach(log => {
        if (log.LogUser) {
            users.set(log.LogUser.Id, log.LogUser.Name);
        }
    });

    // Keep "All Users" option
    userSelect.innerHTML = '<option value="">All Users</option>';

    users.forEach((name, id) => {
        var option = document.createElement('option');
        option.value = id; // Filter by ID for accuracy
        option.textContent = name;
        userSelect.appendChild(option);
    });

    // Restore the previously selected user if it still exists in the list
    if (currentlySelectedUser && users.has(currentlySelectedUser)) {
        userSelect.value = currentlySelectedUser;
    }
}

function sortLogs(logs) {
    if (!logSortKey || !logs) return logs;
    var dir = logSortDir === 'asc' ? 1 : -1;
    var key = logSortKey;
    var getVal = (log) => {
        switch (key) {
            case 'User': return (log.LogUser && log.LogUser.Name || '').toLowerCase();
            case 'Operation': return (log.Operation || '').toLowerCase();
            case 'Status': return (log.Status || '').toLowerCase();
            case 'Duration': return log.DurationMilliseconds || 0;
            case 'Size': return log.LogLength || 0;
            case 'StartTime': return new Date(log.StartTime || 0).getTime();
            default: return String(log[key] || '').toLowerCase();
        }
    };
    // Use optimized merge sort for large datasets (O(n log n) stable sort)
    return mergeSortLogs(logs, (a, b) => {
        var va = getVal(a);
        var vb = getVal(b);
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return 0;
    });
}

function updateLogSortArrows() {
    document.querySelectorAll('#sfarc-debug-logs-view th[data-sort-key]').forEach(th => {
        var arrow = th.querySelector('.sfarc-log-sort');
        if (!arrow) return;
        if (th.dataset.sortKey === logSortKey) {
            arrow.textContent = logSortDir === 'asc' ? '▲' : '▼';
            arrow.classList.add('active');
        } else {
            arrow.textContent = '▲';
            arrow.classList.remove('active');
        }
    });
}

function setupLogSorting() {
    document.querySelectorAll('#sfarc-debug-logs-view th[data-sort-key]').forEach(th => {
        th.addEventListener('click', () => {
            var key = th.dataset.sortKey;
            if (logSortKey === key) {
                logSortDir = logSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                logSortKey = key;
                logSortDir = 'asc';
            }
            applyFilters();
            updateLogSortArrows();
        });
    });
    updateLogSortArrows();
}

function applyFilters() {
    if (isDeepSearching) return;
    var searchTerm = document.getElementById('sfarc-log-search').value.toLowerCase();
    var selectedUser = document.getElementById('sfarc-log-user-filter').value;

    // Optimized filtering with early termination
    filteredLogs = sortLogs(allLogs.filter(log => {
        // Early termination: if no search term, skip text matching
        if (!searchTerm) return true;
        
        // Check user filter first (cheapest check)
        if (selectedUser && log.LogUser && log.LogUser.Id !== selectedUser) return false;
        
        // Text matching with short-circuit evaluation
        var matchesSearch =
            (log.Operation && log.Operation.toLowerCase().includes(searchTerm)) ||
            (log.Status && log.Status.toLowerCase().includes(searchTerm)) ||
            (log.LogUser && log.LogUser.Name.toLowerCase().includes(searchTerm));

        var matchesUser = !selectedUser || (log.LogUser && log.LogUser.Id === selectedUser);

        // If "My Logs" is active, it overrides the dropdown (or works in tandem?)
        // Let's say "My Logs" sets the dropdown to current user if found, or filters by current user ID.
        // For now, let's assume "My Logs" button toggles a mode.
        // But the user request implies a separate button. 
        // Let's handle "My Logs" by setting the dropdown value if we have the ID, or filtering manually.
        // Actually, let's make "My Logs" just set the dropdown to the current user.

        return matchesSearch && matchesUser;
    }));

    currentPage = 1;
    renderPagination();
}

function renderPagination() {
    var totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
    var start = (currentPage - 1) * rowsPerPage;
    var end = start + rowsPerPage;
    var pageLogs = filteredLogs.slice(start, end);

    var logCountBadge = document.getElementById('sfarc-log-count-badge');
    if (logCountBadge) logCountBadge.textContent = String(filteredLogs.length);

    // Smooth page transition with fade
    var tbody = document.getElementById('sfarc-debug-logs-body');
    if (tbody) {
        tbody.classList.add('sfarc-table-fade-out');
        setTimeout(() => {
            renderDebugLogs(pageLogs);
            renderPaginationControls(totalPages);
        }, 100);
    } else {
        renderDebugLogs(pageLogs);
        renderPaginationControls(totalPages);
    }
}

function renderPaginationControls(totalPages) {
    var pageInfo = document.getElementById('sfarc-log-page-info');
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    var prevBtn = document.getElementById('sfarc-log-prev');
    if (prevBtn) prevBtn.disabled = currentPage === 1;

    var nextBtn = document.getElementById('sfarc-log-next');
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function renderDebugLogs(logs) {
    var tbody = document.getElementById('sfarc-debug-logs-body');
    
    // Smooth fade-out before re-rendering
    tbody.classList.add('sfarc-table-fade-out');
    
    // Use requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
        tbody.innerHTML = '';

    if (logs.length === 0) {
        var searchTermInput = document.getElementById('sfarc-log-search');
        var term = searchTermInput ? searchTermInput.value.trim() : '';
        if (term) {
            tbody.innerHTML = '<tr class="sfarc-table-empty"><td colspan="8"><div class="sfarc-table-empty-inner"><div class="sfarc-table-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div><div class="sfarc-table-empty-title">No matching logs</div><div class="sfarc-table-empty-sub">Press <strong>Enter ↵</strong> or click the search icon to search inside log bodies.</div></div></td></tr>';
        } else {
            tbody.innerHTML = '<tr class="sfarc-table-empty"><td colspan="8"><div class="sfarc-table-empty-inner"><div class="sfarc-table-empty-icon"><i class="fa-regular fa-file-lines"></i></div><div class="sfarc-table-empty-title">No debug logs found</div><div class="sfarc-table-empty-sub">Enable a trace flag and run some Apex to generate debug logs.</div></div></td></tr>';
        }
        return;
    }

    var searchTerm = document.getElementById('sfarc-log-search')?.value.toLowerCase() || '';

    // While a search is active, dim non-matching rows (CSS: only matches stay green)
    tbody.classList.toggle('sfarc-search-active', !!searchTerm);

    logs.forEach(log => {
        var tr = document.createElement('tr');

        // Highlight rows that contain the search term — whether it appears in a
        // visible cell (Operation / Status / User) or inside the log body (deep
        // search). Body hits are the whole point of the deep search, so those
        // rows get the same green match tint as visible-cell matches.
        var isMetadataMatch = searchTerm && (
            (log.Operation && log.Operation.toLowerCase().includes(searchTerm)) ||
            (log.Status && log.Status.toLowerCase().includes(searchTerm)) ||
            (log.LogUser && log.LogUser.Name.toLowerCase().includes(searchTerm))
        );

        // Visible-cell hits get the full green match tint; hits that only exist
        // inside the log body get a softer tint (distinct from both full matches
        // and the dimmed non-matching rows). No badge needed — the tint IS the cue.
        if (isMetadataMatch) {
            tr.classList.add('sfarc-search-match');
        } else if (log.bodyMatch) {
            tr.classList.add('sfarc-search-body-match');
        }

        var startTime = new Date(log.StartTime).toLocaleString();
        var sizeKB = log.LogLength / 1024;
        var sizeDisplay = sizeKB < 500
            ? sizeKB.toFixed(2) + ' KB'
            : (sizeKB / 1024).toFixed(2) + ' MB';

        var duration = log.DurationMilliseconds;
        var durationDisplay;
        if (duration < 1000) {
            durationDisplay = duration + ' ms';
        } else if (duration < 60000) {
            durationDisplay = (duration / 1000).toFixed(2) + ' s';
        } else if (duration < 3600000) {
            durationDisplay = (duration / 60000).toFixed(2) + ' min';
        } else {
            durationDisplay = (duration / 3600000).toFixed(2) + ' hr';
        }

        var statusClass = log.Status === 'Success' ? 'sfarc-status-success' : 'sfarc-status-error';


        var highlightText = (text, term) => {
            if (!term || !text) return escapeHtml(text || '');
            var escapedText = escapeHtml(text);
            var regex = new RegExp(`(${escapeHtml(term)})`, 'gi');
            return escapedText.replace(regex, '<mark class="sfarc-log-highlight">$1</mark>');
        };

        tr.innerHTML = `
                <td style="width: 36px; padding: 3px 4px; text-align: center; overflow: visible; text-overflow: clip;"><input type="checkbox" class="sfarc-log-checkbox" value="${log.Id}"></td>
                <td>
                    <div class="sfarc-log-actions">
                        <button class="sfarc-action-icon sfarc-view-log-btn" title="Open Log" data-id="${log.Id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </button>

                        <button class="sfarc-action-icon sfarc-download-log-btn"  data-id="${log.Id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <button class="sfarc-action-icon delete sfarc-delete-log-btn"  data-id="${log.Id}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
                <td>${highlightText(log.LogUser?.Name || 'Unknown', searchTerm)}</td>
                <td>
                    <div class="sfarc-log-op-cell">
                        ${highlightText(log.Operation, searchTerm)}
                    </div>
                </td>
                <td class="${statusClass}">${highlightText(log.Status, searchTerm)}</td>
                <td>${durationDisplay}</td>
                <td style="text-align: right; font-size: 11px; color: var(--sfarc-text-muted, #888);">${sizeDisplay}</td>
                <td style="font-size: 11px; color: var(--sfarc-text-muted, #888);">${startTime}</td>
            `;
        // Add staggered entrance animation
        tr.classList.add('sfarc-row-entering');
        tbody.appendChild(tr);
    });

    // Smooth fade-in after DOM update
    tbody.classList.remove('sfarc-table-fade-out');
    tbody.classList.add('sfarc-table-fade-in');
    
    // Stagger row animations for smooth entrance
    var rows = tbody.querySelectorAll('tr');
    rows.forEach((row, index) => {
        setTimeout(() => {
            row.classList.remove('sfarc-row-entering');
            row.classList.add('sfarc-row-visible');
        }, index * 30); // 30ms stagger between rows
    });

    // Attach event listeners
    tbody.querySelectorAll('.sfarc-view-log-btn').forEach(btn => btn.addEventListener('click', () => window.viewLog(btn.dataset.id)));
    tbody.querySelectorAll('.sfarc-download-log-btn').forEach(btn => btn.addEventListener('click', () => window.downloadLog(btn.dataset.id)));
    tbody.querySelectorAll('.sfarc-delete-log-btn').forEach(btn => btn.addEventListener('click', () => window.deleteLog(btn.dataset.id)));

    // Checkbox interactions: row highlight + select-all indeterminate + badge
    tbody.querySelectorAll('.sfarc-log-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            // Toggle row highlight
            var row = cb.closest('tr');
            if (row) row.classList.toggle('sfarc-row-selected', cb.checked);

            // Update select-all indeterminate state
            updateSelectAllState();
            // Update badge on delete button
            updateDeleteBadge();
        });
    });
    });
}

function updateSelectAllState() {
    var selectAll = document.getElementById('sfarc-select-all-logs');
    if (!selectAll) return;
    var all = document.querySelectorAll('.sfarc-log-checkbox');
    var checked = document.querySelectorAll('.sfarc-log-checkbox:checked');
    if (checked.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checked.length === all.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

function updateDeleteBadge() {
    var btn = document.getElementById('sfarc-delete-all-logs');
    if (!btn) return;
    var count = document.querySelectorAll('.sfarc-log-checkbox:checked').length;
    // Instead of a numeric bubble on the icon, the trash button turns red when
    // rows are selected, and the tooltip states exactly what will be deleted.
    btn.classList.toggle('has-selection', count > 0);
    btn.title = count > 0
        ? `Delete ${count} selected log${count > 1 ? 's' : ''}`
        : 'Delete All Logs';
}

window.viewLog = async (logId, defaultTab = 'log') => {
    try {
        var searchInput = document.getElementById('sfarc-log-search');
        var searchTerm = searchInput ? searchInput.value.trim() : '';
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'log-viewer',
            params: { id: logId, search: searchTerm, tab: defaultTab },
            sessionAuth: {
                sessionId: window.sfApi ? window.sfApi.sessionId : null,
                instanceUrl: window.sfApi ? window.sfApi.instanceUrl : null
            }
        });
    } catch (e) {
        if (e.message.includes('Extension context invalidated')) {
            toast.success('Salesforce Comet has been updated. Please refresh this page to continue.');
        } else {
            toast.error('Error opening log viewer: ' + e.message);
        }
    }
};

window.downloadLog = async (logId) => {
    try {
        var log = allLogs.find(l => l.Id === logId);
        if (!log) return;

        // Fetch body
        var response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}/Body`);
        if (!response) {
            throw new Error("No response from Salesforce");
        }
        var rawLog = typeof response.text === 'function' ? await response.text() : response;

        var blob = new Blob([rawLog], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `apex_log_${log.Id}.log`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        if (e.message.includes('Extension context invalidated')) {
            toast.success('Salesforce Comet has been updated. Please refresh this page to continue.');
        } else {
            toast.error('Download failed: ' + e.message);
        }
    }
};

window.deleteLog = async (logId) => {
    if (!(await toast.confirm('Are you sure you want to delete this log?', {danger: true}))) return;
    try {
        var url = `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}`;
        await window.sfApi.fetch(url, { method: 'DELETE' });
        fetchDebugLogs();
    } catch (e) {
        if (e.message.includes('Extension context invalidated')) {
            toast.success('Salesforce Comet has been updated. Please refresh this page to continue.');
        } else {
            toast.error('Error deleting log: ' + e.message);
        }
    }
};

// ==========================================
// Metadata Exporter Logic
// ==========================================

var metadataState = {
    types: [],
    currentType: null,
    membersCache: {}, // { TypeName: [members] }
    selectedTypes: new Set(),
    selectedMembers: {}, // { TypeName: Set(MemberNames) }
    coverageData: [],
    coverageLoaded: false,
    initialized: false
};



window.loadMetadataContent = async function () {
    // Initialize listeners once
    if (!metadataState.initialized) {
        setupMetadataListeners();
        metadataState.initialized = true;
    }

    // Load types if empty
    if (metadataState.types.length === 0) {
        await loadMetadataTypes();
    }
};

function setupMetadataListeners() {
    // Type Search
    var typeSearch = document.getElementById('sfarc-meta-type-search');
    if (typeSearch) typeSearch.addEventListener('input', (e) => renderMetadataTypesList(e.target.value));

    // Member Search
    var memSearch = document.getElementById('sfarc-meta-member-search');
    if (memSearch) memSearch.addEventListener('input', (e) => renderMetadataMembersList(e.target.value));

    // Filters
    var userFilter = document.getElementById('sfarc-meta-filter-user');
    if (userFilter) userFilter.addEventListener('change', () => renderMetadataMembersList(memSearch ? memSearch.value : ''));

    var dateFilter = document.getElementById('sfarc-meta-filter-date');
    if (dateFilter) {
        dateFilter.addEventListener('change', () => renderMetadataMembersList(memSearch ? memSearch.value : ''));
        // Prevent Salesforce/External scripts from attaching completion logic errors
        ['click', 'focus', 'mousedown', 'keydown'].forEach(evt =>
            dateFilter.addEventListener(evt, e => e.stopPropagation())
        );
    }

    // Clear Actions
    var clearTypes = document.getElementById('sfarc-meta-clear-types');
    if (clearTypes) clearTypes.addEventListener('click', () => {
        metadataState.selectedTypes.clear();
        metadataState.selectedMembers = {};
        renderMetadataTypesList(document.getElementById('sfarc-meta-type-search').value);
        renderMetadataMembersList();
    });

    function getFilteredMembersForCurrentType() {
        var typeName = metadataState.currentType;
        if (!typeName || !metadataState.membersCache[typeName]) return [];

        var searchInput = document.getElementById('sfarc-meta-member-search');
        var term = (searchInput ? searchInput.value : '').toLowerCase();
        var userFilter = document.getElementById('sfarc-meta-filter-user')?.value || '';
        var dateFilter = document.getElementById('sfarc-meta-filter-date')?.value;
        var dateThreshold = dateFilter ? new Date(dateFilter) : null;

        return metadataState.membersCache[typeName].filter(m => {
            if (term && !m.fullName.toLowerCase().includes(term)) return false;
            if (userFilter && m.lastModifiedByName !== userFilter) return false;
            if (dateThreshold && m.lastModifiedDate) {
                var modDate = new Date(m.lastModifiedDate);
                if (modDate < dateThreshold) return false;
            }
            return true;
        });
    }

    var selectAllMem = document.getElementById('sfarc-meta-select-all-members');
    if (selectAllMem) selectAllMem.addEventListener('click', () => {
        var type = metadataState.currentType;
        if (!type) return;

        var visibleMembers = getFilteredMembersForCurrentType();
        if (!metadataState.selectedMembers[type]) metadataState.selectedMembers[type] = new Set();

        visibleMembers.forEach(m => metadataState.selectedMembers[type].add(m.fullName));
        if (metadataState.selectedMembers[type].size > 0) {
            metadataState.selectedTypes.add(type);
        }

        renderMetadataTypesList(document.getElementById('sfarc-meta-type-search')?.value || '');
        renderMetadataMembersList(document.getElementById('sfarc-meta-member-search')?.value || '');
    });

    var clearMem = document.getElementById('sfarc-meta-clear-members');
    if (clearMem) clearMem.addEventListener('click', () => {
        var type = metadataState.currentType;
        if (!type) return;

        var visibleMembers = getFilteredMembersForCurrentType();
        if (metadataState.selectedMembers[type]) {
            visibleMembers.forEach(m => metadataState.selectedMembers[type].delete(m.fullName));
            if (metadataState.selectedMembers[type].size === 0) {
                delete metadataState.selectedMembers[type];
                metadataState.selectedTypes.delete(type);
            }
        }

        renderMetadataTypesList(document.getElementById('sfarc-meta-type-search')?.value || '');
        renderMetadataMembersList(document.getElementById('sfarc-meta-member-search')?.value || '');
    });

    // Update Package XML
    var updatePkgKey = document.getElementById('sfarc-meta-update-pkg');
    if (updatePkgKey) updatePkgKey.addEventListener('click', showPackageXmlModal);

    // Modal
    var mediaClose = document.getElementById('sfarc-xml-close-btn');
    if (mediaClose) mediaClose.addEventListener('click', () => document.getElementById('sfarc-xml-modal').classList.remove('active'));

    var copyXml = document.getElementById('sfarc-xml-copy-btn');
    if (copyXml) copyXml.addEventListener('click', () => {
        var code = document.getElementById('sfarc-xml-code').textContent;
        navigator.clipboard.writeText(code).then(() => toast.success('Copied to clipboard!'));
    });

    var downXml = document.getElementById('sfarc-xml-download-btn');
    if (downXml) downXml.addEventListener('click', downloadPackageXml);
}

async function loadMetadataTypes() {
    var listContainer = document.getElementById('sfarc-meta-types-list');
    listContainer.innerHTML = '<div class="sfarc-loading">Loading types...</div>';

    try {
        // Use describeGlobal as a fallback or if describedMetadata isn't available
        // Actually, let's use listMetadata with wildcard? No.
        // Let's assume describeMetadata is available as commonly patched in sfApi or existing.
        // If not, we might need a fallback.
        // Checking existing code, verify metadata-exporter usage.

        var metadataObjects = [];
        if (window.sfApi.describeMetadata) {
            var metadataDesc = await window.sfApi.describeMetadata(settings.apiVersion || '60.0');
            // api.js returns the array directly
            if (Array.isArray(metadataDesc)) {
                metadataObjects = metadataDesc;
            } else if (metadataDesc && metadataDesc.metadataObjects) {
                // Handle case if direct API response is returned (fallback logic)
                metadataObjects = metadataDesc.metadataObjects;
            }
        } else {
            // Fallback: limited hardcoded list or error
            // For now, let's error gracefully if missing
            // Or try to use Tooling API EntityDefinition? Not for metadata types.
            console.warn('sfApi.describeMetadata not found. Using fallback.');
        }

        if (metadataObjects.length > 0) {
            metadataState.types = metadataObjects.map(obj => ({
                xmlName: obj.xmlName,
                childXmlNames: obj.childXmlNames,
                label: obj.xmlName
            })).sort((a, b) => a.xmlName.localeCompare(b.xmlName));
            renderMetadataTypesList();
        } else {
            listContainer.innerHTML = '<div class="sfarc-error">Unable to fetch metadata types (API mismatch).</div>';
        }

    } catch (e) {
        console.error('Metadata types load error', e);
        listContainer.innerHTML = friendlyFetchError(e, null);
    }
}

function renderMetadataTypesList(filter = '') {
    var container = document.getElementById('sfarc-meta-types-list');
    container.innerHTML = '';

    var term = filter.toLowerCase();
    var filtered = metadataState.types.filter(t => t.xmlName.toLowerCase().includes(term));

    sfarcRenderChunkedList(container, filtered, (type) => {
        var div = document.createElement('div');
        div.className = 'sfarc-metadata-item';
        if (type.xmlName === metadataState.currentType) div.classList.add('selected');

        var isSelected = metadataState.selectedTypes.has(type.xmlName);
        var count = metadataState.selectedMembers[type.xmlName] ? metadataState.selectedMembers[type.xmlName].size : 0;

        div.innerHTML = `
            <span class="sfarc-meta-checkbox${isSelected ? ' checked' : ''}">
                ${isSelected ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </span>
            <span class="sfarc-meta-item-name">${escapeHtml(type.xmlName)}</span>
            ${count > 0 ? `<span class="count">${count}</span>` : ''}
            <span class="sfarc-meta-item-arrow">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
        `;

        div.addEventListener('click', () => selectMetadataType(type.xmlName));
        return div;
    });
}

async function selectMetadataType(typeName) {
    metadataState.currentType = typeName;
    var searchInput = document.getElementById('sfarc-meta-type-search');
    renderMetadataTypesList(searchInput ? searchInput.value : '');

    document.getElementById('sfarc-meta-selected-type-name').textContent = typeName;
    await loadMetadataMembers(typeName);
}

async function loadMetadataMembers(typeName) {
    var listContainer = document.getElementById('sfarc-meta-members-list');

    if (metadataState.membersCache[typeName]) {
        renderMetadataMembersList();
        return;
    }

    listContainer.innerHTML = '<div class="sfarc-loading">Loading members...</div>';

    try {
        var members = await window.sfApi.listMetadata(typeName);
        var memberArray = Array.isArray(members) ? members : (members ? [members] : []);

        metadataState.membersCache[typeName] = memberArray.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Populate User Filter
        var userSelect = document.getElementById('sfarc-meta-filter-user');
        if (userSelect) {
            var uniqueUsers = [...new Set(memberArray.map(m => m.lastModifiedByName).filter(Boolean))].sort();
            userSelect.innerHTML = '<option value="">All Users</option>' +
                uniqueUsers.map(u => `<option value="${u}">${u}</option>`).join('');
        }

        renderMetadataMembersList();

        // Hydrate CustomMetadata with real dates via SOQL
        if (typeName === 'CustomMetadata') {
            hydrateCustomMetadataDates(memberArray);
        }
    } catch (e) {
        console.error('Load members error', e);
        listContainer.innerHTML = friendlyFetchError(e, null);
    }
}

async function hydrateCustomMetadataDates(members) {
    if (!members || members.length === 0) return;

    // Group by MDT Type (Prefix)
    var typeGroups = {};
    members.forEach(m => {
        var parts = m.fullName.split('.');
        if (parts.length === 2) {
            var typeName = parts[0];
            if (!typeGroups[typeName]) typeGroups[typeName] = [];
            typeGroups[typeName].push(m);
        }
    });

    var mdtTypes = Object.keys(typeGroups);
    if (mdtTypes.length === 0) return;

    showToast(`Fetching accurate dates for ${mdtTypes.length} types...`, 'info', 2000);

    for (const mdtName of mdtTypes) {
        try {
            // Query the underlying __mdt object
            // Use SystemModstamp as LastModifiedDate is often not exposed on __mdt
            var query = `SELECT DeveloperName, SystemModstamp FROM ${mdtName}__mdt`;
            var result = await window.sfApi.query(query);

            if (result && result.records) {
                var recordMap = new Map();
                result.records.forEach(r => {
                    recordMap.set(r.DeveloperName, r);
                });

                // Update members
                var updatedCount = 0;
                typeGroups[mdtName].forEach(member => {
                    var parts = member.fullName.split('.');
                    var devName = parts[1];
                    var record = recordMap.get(devName);

                    if (record) {
                        member.lastModifiedDate = record.SystemModstamp;
                        updatedCount++;
                    }
                });

                // Re-render periodically to show progress
                if (updatedCount > 0) {
                    renderMetadataMembersList();
                }
            }
        } catch (e) {
            console.warn(`Failed to hydrate dates for ${mdtName}__mdt`, e);
            // Continue to next type
        }
    }
}

function renderMetadataMembersList(filter = '') {
    var container = document.getElementById('sfarc-meta-members-list');
    container.innerHTML = '';

    var typeName = metadataState.currentType;
    if (!typeName || !metadataState.membersCache[typeName]) {
        container.innerHTML = getEmptyStateHtml('No members found');
        return;
    }

    var term = filter.toLowerCase();
    var userFilter = document.getElementById('sfarc-meta-filter-user')?.value || '';
    var dateFilter = document.getElementById('sfarc-meta-filter-date')?.value;
    var dateThreshold = dateFilter ? new Date(dateFilter) : null;

    var members = metadataState.membersCache[typeName].filter(m => {
        // Name Search
        if (!m.fullName.toLowerCase().includes(term)) return false;

        // User Filter
        if (userFilter && m.lastModifiedByName !== userFilter) return false;

        // Date Filter (Since)
        if (dateThreshold && m.lastModifiedDate) {
            var modDate = new Date(m.lastModifiedDate);
            // Reset times for comparison to be day-inclusive/based
            // Actually, usually user wants "On or After".
            if (modDate < dateThreshold) return false;
        }

        return true;
    });

    var selectedSet = metadataState.selectedMembers[typeName] || new Set();

    sfarcRenderChunkedList(container, members, (member) => {
        var div = document.createElement('div');
        div.className = 'sfarc-metadata-item';
        if (selectedSet.has(member.fullName)) div.classList.add('selected');

        var dateStr = '';
        if (member.lastModifiedDate) {
            var d = new Date(member.lastModifiedDate);
            // Hide epoch dates (1970) which indicate missing/default data
            if (d.getFullYear() > 1970) {
                dateStr = d.toLocaleDateString();
            }
        }

        var isSel = selectedSet.has(member.fullName);

        div.innerHTML = `
            <span class="sfarc-meta-checkbox${isSel ? ' checked' : ''}">
                ${isSel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </span>
            <span class="sfarc-meta-item-name">
                ${escapeHtml(member.fullName)}
                ${dateStr ? `<span class="sfarc-meta-item-sub">${dateStr}</span>` : ''}
            </span>
            <span class="sfarc-meta-item-arrow">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
        `;

        div.addEventListener('click', () => toggleMemberSelection(typeName, member.fullName));
        return div;
    });
}

function toggleMemberSelection(type, memberName) {
    if (!metadataState.selectedMembers[type]) metadataState.selectedMembers[type] = new Set();

    var set = metadataState.selectedMembers[type];
    if (set.has(memberName)) {
        set.delete(memberName);
        if (set.size === 0) {
            delete metadataState.selectedMembers[type];
            metadataState.selectedTypes.delete(type);
        }
    } else {
        set.add(memberName);
        metadataState.selectedTypes.add(type);
    }

    var typeSearch = document.getElementById('sfarc-meta-type-search');
    var memberSearch = document.getElementById('sfarc-meta-member-search');

    renderMetadataTypesList(typeSearch ? typeSearch.value : '');
    renderMetadataMembersList(memberSearch ? memberSearch.value : '');

    // Update button color & animation state
    var updateBtn = document.getElementById('sfarc-meta-update-pkg');
    if (updateBtn) {
        var hasData = Object.keys(metadataState.selectedMembers).length > 0;
        updateBtn.classList.toggle('has-data', hasData);

        updateBtn.classList.remove('sfarc-anim-ring-gradient');
        void updateBtn.offsetWidth; // Force reflow
        updateBtn.classList.add('sfarc-anim-ring-gradient');

        // Remove class after animation (approx 2s) to keep clean state
        setTimeout(() => {
            updateBtn.classList.remove('sfarc-anim-ring-gradient');
        }, 2100);
    }
}

// Generate Package.xml Content
function generatePackageXml() {
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';

    var sortedTypes = Array.from(metadataState.selectedTypes).sort();

    sortedTypes.forEach(type => {
        var members = metadataState.selectedMembers[type];
        if (members && members.size > 0) {
            xml += '    <types>\n';
            Array.from(members).sort().forEach(m => {
                xml += `        <members>${m}</members>\n`;
            });
            xml += `        <name>${type}</name>\n    </types>\n`;
        }
    });

    xml += `    <version>${settings.apiVersion || '60.0'}</version>\n</Package>`;
    return xml;
}

// Generate Color-Coded HTML for Preview
function generatePackageHtml() {
    // Escaping helper
    var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    var html = '<span style="color: grey;">&lt;?xml version="1.0" encoding="UTF-8"?&gt;</span>\n';
    html += '<span style="color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));">&lt;Package xmlns="http://soap.sforce.com/2006/04/metadata"&gt;</span>\n';

    var sortedTypes = Array.from(metadataState.selectedTypes).sort();

    sortedTypes.forEach(type => {
        var members = metadataState.selectedMembers[type];
        if (members && members.size > 0) {
            // Generate a color for this type
            var color = getTypeColor(type);

            // We color the entire block's text or just the key elements?
            // "make all the Apex class types of same color... distinguish each type"
            // Let's color the logic tags.
            var tagStyle = `color: ${color}; font-weight: bold;`;
            var valStyle = `color: ${color};`; // Maybe slightly different?

            html += `    <span style="${tagStyle}">&lt;types&gt;</span>\n`;
            Array.from(members).sort().forEach(m => {
                html += `        <span style="${tagStyle}">&lt;members&gt;</span><span style="${valStyle}">${esc(m)}</span><span style="${tagStyle}">&lt;/members&gt;</span>\n`;
            });
            html += `        <span style="${tagStyle}">&lt;name&gt;</span><span style="${valStyle}">${esc(type)}</span><span style="${tagStyle}">&lt;/name&gt;</span>\n`;
            html += `    <span style="${tagStyle}">&lt;/types&gt;</span>\n`;
        }
    });

    html += `    <span style="color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));">&lt;version&gt;</span>${settings.apiVersion || '60.0'}<span style="color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));">&lt;/version&gt;</span>\n`;
    html += '<span style="color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));">&lt;/Package&gt;</span>';
    return html;
}

function getTypeColor(str) {
    var hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Mix with golden ratio to spread well
    var hue = Math.abs((hash % 360));
    // High saturation, readable lightness
    // Adjusted for both light/dark themes roughly. 
    // 35% lightness is good on white (darker text).
    // 75% lightness is good on dark (lighter text).
    var panel = document.getElementById('sfarc-panel');
    var isDark = panel ? panel.classList.contains('sfarc-dark-theme') : false;
    var lightness = isDark ? '75%' : '35%';
    return `hsl(${hue}, 90%, ${lightness})`;
}

function showPackageXmlModal() {
    var html = generatePackageHtml();
    // Use innerHTML for color coding
    var codeBlock = document.getElementById('sfarc-xml-code');
    codeBlock.innerHTML = html;

    // Ensure the container handles whitespace correctly if not 'pre' (it is pre in HTML)
    document.getElementById('sfarc-xml-modal').classList.add('active');

    // Trigger update animation on Download button
    var btn = document.getElementById('sfarc-xml-download-btn');
    if (btn) {
        // Reset animation
        btn.classList.remove('sfarc-anim-update');
        void btn.offsetWidth; // Trigger reflow
        btn.classList.add('sfarc-anim-update');

        // Show Notification
        var notif = document.getElementById('sfarc-xml-notif');
        if (!notif) {
            notif = document.createElement('div');
            notif.id = 'sfarc-xml-notif';
            notif.className = 'sfarc-xml-notification';
            notif.textContent = 'XML Updated';
            btn.parentNode.appendChild(notif); // Append relative to button action container? 
            // The button is in specific position, parent is .sfarc-metadata-actions (flex row).
            // Position absolute on notif requires relative parent.
            // Let's make button relative (it is).
            btn.appendChild(notif);
        }

        notif.classList.add('active');
        setTimeout(() => {
            notif.classList.remove('active');
        }, 2000);
    }
}

function downloadPackageXml() {
    var xml = generatePackageXml();
    var blob = new Blob([xml], { type: 'text/xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'package.xml';
    a.click();
    URL.revokeObjectURL(url);
}

// Code Coverage
async function loadCodeCoverage() {
    var tbody = document.getElementById('sfarc-coverage-list');
    tbody.innerHTML = '<tr><td colspan="4" class="sfarc-loading" style="text-align:center;">Fetching Coverage...</td></tr>';

    try {
        var query = 'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE NumLinesCovered > 0 OR NumLinesUncovered > 0';
        var result = await window.sfApi.query(query, true);

        metadataState.coverageData = (result.records || []).map(r => {
            var covered = r.NumLinesCovered || 0;
            var uncovered = r.NumLinesUncovered || 0;
            var total = covered + uncovered;
            var percent = total > 0 ? Math.round((covered / total) * 100) : 0;
            return {
                name: r.ApexClassOrTrigger.Name,
                percent: percent,
                covered: covered,
                uncovered: uncovered
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        metadataState.coverageLoaded = true;
        renderCoverageList();

        var totalLines = metadataState.coverageData.reduce((acc, curr) => acc + curr.covered + curr.uncovered, 0);
        var totalCovered = metadataState.coverageData.reduce((acc, curr) => acc + curr.covered, 0);
        var avg = totalLines > 0 ? Math.round((totalCovered / totalLines) * 100) : 0;
        document.getElementById('sfarc-avg-coverage').textContent = `Avg: ${avg}% `;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">Error: ${window.escapeHtml(e.message)}</td></tr>`;
    }
}

// Chunked list renderer: renders only `chunk` rows at a time and appends a
// "Show more" row so huge lists (e.g. 18,000 Apex classes) never build the
// whole DOM in one pass — that previously froze/crashed the page.
function sfarcRenderChunkedList(container, items, rowBuilder, opts) {
    opts = opts || {};
    const chunk = opts.chunk || 500;
    const moreTag = opts.moreTag || 'div';
    const moreColspan = opts.moreColspan || 1;
    container.innerHTML = '';
    if (!items || items.length === 0) return;
    let shown = 0;
    const label = () => `Show ${Math.min(chunk, items.length - shown)} more (${items.length - shown} remaining)`;
    const buildMore = (onClick) => {
        if (moreTag === 'tr') {
            const tr = document.createElement('tr');
            tr.className = 'sfarc-more-row';
            tr.innerHTML = `<td colspan="${moreColspan}" style="text-align:center; padding:8px; cursor:pointer; font-size:12px; font-weight:500; color:var(--sfarc-accent, #2196f3); user-select:none;">${label()}</td>`;
            tr.onclick = onClick;
            return tr;
        }
        const el = document.createElement('div');
        el.className = 'sfarc-more-row';
        el.style.cssText = 'text-align:center; padding:8px 12px; cursor:pointer; font-size:12px; font-weight:500; color:var(--sfarc-accent, #2196f3); user-select:none;';
        el.textContent = label();
        el.onclick = onClick;
        return el;
    };
    const appendNext = () => {
        const end = Math.min(shown + chunk, items.length);
        const frag = document.createDocumentFragment();
        for (let i = shown; i < end; i++) frag.appendChild(rowBuilder(items[i], i));
        shown = end;
        const prev = container.querySelector('.sfarc-more-row');
        if (prev) prev.remove();
        container.appendChild(frag);
        if (shown < items.length) container.appendChild(buildMore(appendNext));
    };
    appendNext();
}

function renderCoverageList(filter = '') {
    var tbody = document.getElementById('sfarc-coverage-list');
    tbody.innerHTML = '';

    var term = filter.toLowerCase();
    var filtered = metadataState.coverageData.filter(c => c.name.toLowerCase().includes(term));

    if (filtered.length === 0) return;

    sfarcRenderChunkedList(tbody, filtered, (item) => {
        var tr = document.createElement('tr');
        var color = item.percent >= 75 ? 'sfarc-coverage-high' : (item.percent >= 50 ? 'sfarc-coverage-medium' : 'sfarc-coverage-low');

        tr.innerHTML = `
            <td>${item.name}</td>
            <td class="${color}" style="font-weight:bold;">${item.percent}%</td>
            <td>${item.covered}</td>
            <td>${item.uncovered}</td>
        `;
        return tr;
    }, { moreTag: 'tr', moreColspan: 4 });
}

async function fetchTraceFlags() {
    if (isFetchingTraceFlags) return;
    isFetchingTraceFlags = true;

    var tbody = document.getElementById('sfarc-trace-flags-body');
    // Only show loading if table is empty to prevent UI flicker and state loss
    if (tbody && tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
    }

    try {
        // Ensure session is initialized before making API calls
        if (!window.sfApi.sessionId) {
            await window.sfApi.init();
        }
        if (!window.sfApi.sessionId || !window.sfApi.instanceUrl) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Could not establish a Salesforce session. Please refresh the page.</td></tr>';
            isFetchingTraceFlags = false;
            return;
        }

        var query = "SELECT Id, TracedEntityId, TracedEntity.Name, CreatedBy.Name, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName FROM TraceFlag WHERE LogType = 'USER_DEBUG' ORDER BY ExpirationDate DESC";
        var result = await window.sfApi.query(query, true);

        if (result.records) {
            var filterSelect = document.getElementById('sfarc-trace-filter');
            var filterValue = filterSelect ? filterSelect.value : 'active';
            renderTraceFlags(result.records, filterValue);
        } else {
            var traceCountBadge = document.getElementById('sfarc-trace-count-badge');
            if (traceCountBadge) traceCountBadge.textContent = '0';
            if (tbody) tbody.innerHTML = '<tr class="sfarc-table-empty"><td colspan="7"><div class="sfarc-table-empty-inner"><div class="sfarc-table-empty-icon"><i class="fa-solid fa-bug"></i></div><div class="sfarc-table-empty-title">No active trace flags</div><div class="sfarc-table-empty-sub">Click “Add Current User” to start tracing debug logs.</div></div></td></tr>';
            stopTraceTimer();
        }
    } catch (error) {
        console.error('Error fetching trace flags:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error: ${window.escapeHtml(error.message)}</td></tr>`;
    } finally {
        isFetchingTraceFlags = false;
    }
}


function renderTraceFlags(flags, arg2, arg3) {
    var container = document.getElementById('sfarc-trace-flags-body');
    var filter = 'active';

    if (arg2 instanceof HTMLElement) {
        container = arg2;
        if (arg3) filter = arg3;
    } else if (typeof arg2 === 'string') {
        filter = arg2;
    }

    if (!window.currentUserId) {
        fetchCurrentUserId().then(() => {
            if (flags) renderTraceFlags(flags, container, filter);
        });
        // Proceed without ID first to avoid "Loading..." stuck state
    }

    var tbody = container;
    var toggleBar = document.getElementById('sfarc-trace-toggle-bar');

    // Filter out expired flags if filter is 'active'
    var filteredFlags = flags;
    if (filter === 'active') {
        var now = new Date();
        filteredFlags = flags.filter(flag => {
            var expDate = new Date(flag.ExpirationDate);
            return expDate > now; // Only include non-expired
        });
    }

    if (!filteredFlags || filteredFlags.length === 0) {
        var traceCountBadge = document.getElementById('sfarc-trace-count-badge');
        if (traceCountBadge) traceCountBadge.textContent = '0';
        tbody.innerHTML = '<tr class="sfarc-table-empty"><td colspan="7"><div class="sfarc-table-empty-inner"><div class="sfarc-table-empty-icon"><i class="fa-solid fa-bug"></i></div><div class="sfarc-table-empty-title">No active trace flags</div><div class="sfarc-table-empty-sub">Click “Add Current User” to start tracing debug logs.</div></div></td></tr>';
        if (toggleBar) toggleBar.style.display = 'none';
        stopTraceTimer();
        return;
    }

    var traceCountBadge = document.getElementById('sfarc-trace-count-badge');
    if (traceCountBadge) traceCountBadge.textContent = String(filteredFlags.length);

    if (toggleBar) {
        if (filteredFlags.length > 3) {
            toggleBar.style.display = 'block';
            toggleBar.querySelector('button').title = tbody.classList.contains('sfarc-expanded') ? 'Minimize' : 'Expand';
        } else {
            toggleBar.style.display = 'none';
        }
    }

    // Capture currently checked items to preserve state across refreshes
    var checkedIds = new Set();
    var existingCheckboxes = tbody.querySelectorAll('.sfarc-trace-checkbox:checked');
    existingCheckboxes.forEach(cb => checkedIds.add(cb.value));

    tbody.innerHTML = '';

    filteredFlags.forEach(flag => {
        var tr = document.createElement('tr');
        // Match Debug Log table styling if interactive
        // tr.classList.add('sfarc-code-row'); // Optional if we want hover effects from code table

        var startDate = formatDateTime(flag.StartDate);
        var expDate = formatDateTime(flag.ExpirationDate);

        // Timer Logic
        var now = new Date();
        var end = new Date(flag.ExpirationDate);
        var diffMs = end - now;
        var isExpired = diffMs < 0;

        var remainingText = '';
        var remainingClass = '';

        if (isExpired) {
            remainingText = 'Expired';
            remainingClass = 'sfarc-trace-expired';
        } else {
            // Calculate refined time
            var diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 60) {
                remainingText = `${diffMins} m`;
            } else {
                var h = Math.floor(diffMins / 60);
                var m = diffMins % 60;
                remainingText = `${h}h ${m}m`;
            }
        }


        if (isExpired) {
            tr.classList.add('sfarc-trace-expired-row');
        }


        // Highlight active trace for current user
        if (!isExpired && flag.TracedEntityId === window.currentUserId) {
            tr.classList.add('sfarc-trace-active');
        }

        var debugLevelName = flag.DebugLevel?.DeveloperName || flag.DebugLevelId;
        var userName = flag.TracedEntity?.Name || flag.TracedEntityId;
        var isCurrentUser = flag.TracedEntityId === window.currentUserId;

        tr.innerHTML = `
            <td style="width: 32px; text-align: center;"><input type="checkbox" class="sfarc-trace-checkbox" value="${flag.Id}" ${checkedIds.has(flag.Id) ? 'checked' : ''}></td>
            <td><div class="sfarc-cell-text" style="font-weight: 500; ${isCurrentUser ? 'color: var(--sfarc-accent, var(--sfarc-accent, #2196f3));' : ''}">${escapeHtml(userName)}</div></td>
            <td><div class="sfarc-cell-text">${escapeHtml(flag.CreatedBy?.Name || 'System')}</div></td>
            <td><div class="sfarc-cell-text">${startDate}</div></td>
            <td><div class="sfarc-cell-text">${expDate}</div></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="sfarc-debug-icon-btn sfarc-trace-reset-btn" data-id="${flag.Id}"  style="width: 20px; height: 20px;">
                       <i class="fa-solid fa-arrow-rotate-left"></i>
                    </button>
                    <span class="${remainingClass}" style="font-variant-numeric: tabular-nums;">${remainingText}</span>
                </div>
            </td>
            <td><div class="sfarc-cell-text">${escapeHtml(debugLevelName)}</div></td>
        `;
        tbody.appendChild(tr);
    });

    // Re-attach listeners using event delegation or direct
    tbody.querySelectorAll('.sfarc-trace-reset-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            var flagId = e.currentTarget.dataset.id;
            var icon = e.currentTarget.querySelector('.fa-arrow-rotate-left');

            // Add anticlockwise rotation animation
            if (icon) {
                icon.classList.add('rotate-once-anticlockwise');
                // Remove class after animation completes
                setTimeout(() => {
                    icon.classList.remove('rotate-once-anticlockwise');
                }, 600);
            }

            await extendTraceFlag(flagId);
        });
    });

    // Check for current user's active trace to show timer
    var currentUserId = window.currentUserId;
    var myActiveFlag = flags.find(f => f.TracedEntityId === currentUserId && new Date(f.ExpirationDate) > new Date());

    if (myActiveFlag) {
        var expDate = new Date(myActiveFlag.ExpirationDate);
        startTraceTimer(expDate);
    } else {
        stopTraceTimer();
    }
}

var traceTimerInterval = null;

function startTraceTimer(expirationDate) {
    var badge = document.getElementById('sfarc-trace-timer-badge');
    var textSpan = document.getElementById('sfarc-trace-timer-text');

    if (!badge || !textSpan) return;

    badge.style.display = 'inline-flex';

    // Clear existing
    if (traceTimerInterval) clearInterval(traceTimerInterval);

    var update = () => {
        if (!chrome.runtime?.id) {
            clearInterval(traceTimerInterval);
            traceTimerInterval = null;
            return;
        }
        var now = new Date();
        var diff = expirationDate - now;

        if (diff <= 0) {
            stopTraceTimer();
            // Optional: refresh flags to remove expired one
            return;
        }

        // Format mm:ss or hh:mm:ss
        var hours = Math.floor(diff / (1000 * 60 * 60));
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((diff % (1000 * 60)) / 1000);

        var timeStr = '';
        if (hours > 0) {
            timeStr += `${hours}h `;
        }
        timeStr += `${minutes}m ${seconds}s`;

        textSpan.textContent = timeStr;
    };

    update(); // Run immediately
    traceTimerInterval = setInterval(update, 1000);
}

function stopTraceTimer() {
    if (traceTimerInterval) {
        clearInterval(traceTimerInterval);
        traceTimerInterval = null;
    }
    var badge = document.getElementById('sfarc-trace-timer-badge');
    if (badge) badge.style.display = 'none';
}


async function extendTraceFlag(flagId) {
    try {
        var now = new Date();
        // Salesforce expects ISO string
        // Extend by 30 mins from NOW
        var newStart = now.toISOString();
        var newExp = new Date(now.getTime() + 30 * 60000).toISOString();

        await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/TraceFlag/${flagId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                StartDate: newStart,
                ExpirationDate: newExp
            })
        });

        // Refresh list
        fetchTraceFlags();

    } catch (e) {
        console.error('Error extending trace flag:', e);
        toast.error('Failed to extend trace flag: ' + e.message);
    }
}

// Modal Logic
// We need to attach these listeners only once. 
// Since this script runs once, we can attach them here.

var debugLogListenersSetup = false;

function setupDebugLogListeners() {
    // Prevent duplicate event listener setup
    if (debugLogListenersSetup) {
        return;
    }
    debugLogListenersSetup = true;
    var traceModal = document.getElementById('sfarc-trace-modal');
    var levelModal = document.getElementById('sfarc-level-modal');
    var newTraceBtn = document.getElementById('sfarc-new-trace');
    var refreshTraceBtn = document.getElementById('sfarc-refresh-trace');
    var createTraceBtn = document.getElementById('sfarc-create-trace-btn');
    var addUserBtn = document.getElementById('sfarc-add-current-user');
    var userSearchInput = document.getElementById('sfarc-trace-user-search');
    var importLogBtn = document.getElementById('sfarc-import-log');
    if (importLogBtn) {
        importLogBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'log-viewer' });
        });
    }

    // Refresh trace flags with animation
    if (refreshTraceBtn) {
        refreshTraceBtn.addEventListener('click', async () => {
            var startTime = Date.now();
            startRefreshAnimation(refreshTraceBtn);
            await fetchTraceFlags();
            var elapsed = Date.now() - startTime;
            stopRefreshAnimation(refreshTraceBtn, Math.max(0, 2000 - elapsed));
        });
    }

    var deleteTraceBtn = document.getElementById('sfarc-delete-trace');

    if (deleteTraceBtn) {
        deleteTraceBtn.addEventListener('click', async () => {
            var checkboxes = document.querySelectorAll('.sfarc-trace-checkbox:checked');
            if (checkboxes.length === 0) {
                toast.error('Please select at least one trace flag to delete.');
                return;
            }

            if (!(await toast.confirm(`Delete ${checkboxes.length} trace flag(s) ? `, {danger: true}))) return;

            try {
                for (const checkbox of checkboxes) {
                    await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/TraceFlag/${checkbox.value}`, {
                        method: 'DELETE'
                    });
                }
                fetchTraceFlags();
            } catch (e) {
                toast.error('Error deleting trace flags: ' + e.message);
            }
        });
    }

    async function loadDebugLevels(forceReload = false) {
        var levelSelect = document.getElementById('sfarc-trace-level');
        if (!levelSelect) {
            console.error('Debug level select element not found');
            return;
        }

        if (forceReload || levelSelect.options.length <= 1) {
            try {
                // Show loading state
                levelSelect.innerHTML = '<option value="">Loading debug levels...</option>';
                levelSelect.disabled = true;

                var query = "SELECT Id, DeveloperName FROM DebugLevel ORDER BY DeveloperName";
                var response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
                var result = await response.json();

                // Reset dropdown
                levelSelect.innerHTML = '<option value="">-- Select Debug Level --</option>';
                levelSelect.disabled = false;

                if (result.records && result.records.length > 0) {
                    result.records.forEach(level => {
                        var option = document.createElement('option');
                        option.value = level.Id;
                        option.textContent = level.DeveloperName;
                        levelSelect.appendChild(option);
                    });
                } else {
                    levelSelect.innerHTML = '<option value="">No debug levels found</option>';
                    console.warn('No debug levels found in org');
                }
            } catch (e) {
                console.error('Error loading debug levels:', e);
                levelSelect.innerHTML = '<option value="">Error loading levels</option>';
                levelSelect.disabled = false;

                // Show user-friendly error
                showToast('Failed to load debug levels. Please try again.', 'error');
            }
        }
    }

    if (newTraceBtn) {
        // The Trace Flags "+" button launches the Create Log Level modal
        // (New Trace Flag creation is handled by "Add Current User").
        newTraceBtn.addEventListener('click', () => {
            if (traceModal) traceModal.style.display = 'none';
            openLogLevelModal();
        });
    }

    if (refreshTraceBtn) {
        refreshTraceBtn.addEventListener('click', fetchTraceFlags);
    }

    // Delete Selected Trace Flags
    var deleteSelectedTracesBtn = document.getElementById('sfarc-delete-selected-traces');
    if (deleteSelectedTracesBtn) {
        deleteSelectedTracesBtn.addEventListener('click', async () => {
            var checkboxes = document.querySelectorAll('.sfarc-trace-checkbox:checked');
            if (checkboxes.length === 0) {
                showToast('Please select at least one trace flag to delete.', 'warning');
                return;
            }

            var count = checkboxes.length;
            var confirmed = await showConfirmDialog(
                `Delete ${count} trace flag${count > 1 ? 's' : ''}?`,
                `Are you sure you want to delete ${count} trace flag${count > 1 ? 's' : ''}? This action cannot be undone.`,
                { danger: true, okLabel: 'Delete' }
            );

            if (!confirmed) return;

            var traceIds = Array.from(checkboxes).map(cb => cb.value);

            try {
                showToast(`Deleting ${count} trace flag${count > 1 ? 's' : ''}...`, 'info');

                // Show Progress UI
                var originalBtnContent = deleteSelectedTracesBtn.innerHTML;
                deleteSelectedTracesBtn.disabled = true;
                deleteSelectedTracesBtn.innerHTML = '';
                deleteSelectedTracesBtn.classList.add('processing');
                deleteSelectedTracesBtn.style.position = 'relative'; // Ensure positioning

                var ringSize = 34;
                var strokeWidth = 2;
                var radius = (ringSize - strokeWidth) / 2;
                var circumference = 2 * Math.PI * radius;

                deleteSelectedTracesBtn.insertAdjacentHTML('beforeend', `
                    <svg class="sfarc-progress-ring-outer" width="${ringSize}" height="${ringSize}">
                        <circle class="track" cx="${ringSize / 2}" cy="${ringSize / 2}" r="${radius}"></circle>
                        <circle class="progress red" cx="${ringSize / 2}" cy="${ringSize / 2}" r="${radius}" stroke-dasharray="0 ${circumference}"></circle>
                    </svg>
                    <div class="sfarc-progress-text">0/${count}</div>
                `);

                var deletedCount = 0;
                for (const id of traceIds) {
                    await window.sfApi.deleteRecord('TraceFlag', id, true);
                    deletedCount++;

                    // Update progress
                    var percent = (deletedCount / count);
                    var offset = percent * circumference;

                    var progressCircle = deleteSelectedTracesBtn.querySelector('.sfarc-progress-ring-outer .progress');
                    var progressText = deleteSelectedTracesBtn.querySelector('.sfarc-progress-text');

                    if (progressCircle) {
                        progressCircle.style.strokeDasharray = `${offset} ${circumference}`;
                    }
                    if (progressText) {
                        progressText.textContent = `${deletedCount}/${count}`;
                    }
                }
                showToast(`Successfully deleted ${count} trace flag${count > 1 ? 's' : ''}.`, 'success');

                // Reset UI
                deleteSelectedTracesBtn.disabled = false;
                deleteSelectedTracesBtn.classList.remove('processing');
                deleteSelectedTracesBtn.innerHTML = originalBtnContent;

                fetchTraceFlags(); // Refresh the list
            } catch (error) {
                console.error('Error deleting trace flags:', error);
                showToast('Failed to delete some trace flags. Check console for details.', 'error');
                // Restore button on error too
                deleteSelectedTracesBtn.disabled = false;
                deleteSelectedTracesBtn.innerHTML = originalBtnContent;
            }
        });
    }


    // Trace Filter Dropdown
    var traceFilterSelect = document.getElementById('sfarc-trace-filter');
    if (traceFilterSelect) {
        traceFilterSelect.addEventListener('change', fetchTraceFlags);
    }

    // Select All Trace Flags Checkbox
    var selectAllTraceCheckbox = document.getElementById('sfarc-select-all-trace');
    if (selectAllTraceCheckbox) {
        selectAllTraceCheckbox.addEventListener('change', (e) => {
            var checkboxes = document.querySelectorAll('.sfarc-trace-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }



    var refreshLogsBtn = document.getElementById('sfarc-refresh-logs');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', async () => {
            var startTime = Date.now();
            startRefreshAnimation(refreshLogsBtn);
            await fetchDebugLogs();
            var elapsed = Date.now() - startTime;
            stopRefreshAnimation(refreshLogsBtn, Math.max(0, 2000 - elapsed));
        });
    }

    // Open Full Debug Logs Tab
    var openFullLogsBtn = document.getElementById('sfarc-open-full-logs');
    if (openFullLogsBtn) {
        openFullLogsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openExtensionPage', page: 'debug-logs-tab' });
        });
    }

    // Deep Log Search
    var logSearchInput = document.getElementById('sfarc-log-search');
    var logSearchBtn = document.getElementById('sfarc-log-search-btn');
    var logSearchClear = document.getElementById('sfarc-log-search-clear');

    async function triggerBackgroundDeepSearch(term) {
        if (!term) {
            isDeepSearching = false;
            return;
        }

        searchSequenceId++;
        var currentSeqId = searchSequenceId;
        isDeepSearching = true;

        if (logSearchBtn) {
            logSearchBtn.innerHTML = '<span class="comet-loader-inline" ></span>';
        }

        // Clear previous matching flags
        allLogs.forEach(l => l.bodyMatch = false);

        try {
            var logsToSearch = allLogs.length > 0 ? allLogs.slice(0, 100) : [];

            if (logsToSearch.length === 0) {
                var query = "SELECT Id, LogUser.Name, LogUser.Id, Operation, Status, DurationMilliseconds, LogLength, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT 50";
                var response = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
                var result = await response.json();
                logsToSearch = result.records || [];
                allLogs = logsToSearch;
            }

            var concurrency = 5;

            for (let i = 0; i < logsToSearch.length; i += concurrency) {
                if (currentSeqId !== searchSequenceId) return;

                var batch = logsToSearch.slice(i, i + concurrency);
                var promises = batch.map(async (log) => {
                    if (currentSeqId !== searchSequenceId) return null;

                    if (log.bodyText !== undefined) {
                        var matches = log.bodyText.toLowerCase().includes(term);
                        log.bodyMatch = matches;
                        return matches ? log : null;
                    }

                    try {
                        var url = `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${log.Id}/Body`;
                        var response = await window.sfApi.fetch(url, { responseType: 'text' });
                        if (currentSeqId !== searchSequenceId) return null;

                        if (response && typeof response === 'string') {
                            log.bodyText = response; // Cache in-memory
                            var matches = response.toLowerCase().includes(term);
                            log.bodyMatch = matches;
                            return matches ? log : null;
                        }
                    } catch (e) {
                        console.error(`Error searching log ${log.Id}:`, e);
                    }
                    return null;
                });

                await Promise.all(promises);

                if (currentSeqId !== searchSequenceId) return;

                var selectedUser = document.getElementById('sfarc-log-user-filter')?.value;
                filteredLogs = sortLogs(allLogs.filter(log => {
                    var matchesSearch =
                        (log.Operation && log.Operation.toLowerCase().includes(term)) ||
                        (log.Status && log.Status.toLowerCase().includes(term)) ||
                        (log.LogUser && log.LogUser.Name.toLowerCase().includes(term)) ||
                        (log.bodyMatch === true);

                    var matchesUser = !selectedUser || (log.LogUser && log.LogUser.Id === selectedUser);
                    return matchesSearch && matchesUser;
                }));

                renderPagination();
            }
        } catch (e) {
            console.error('[DEBUG] Realtime deep search error:', e);
        } finally {
            if (currentSeqId === searchSequenceId && logSearchBtn) {
                logSearchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
            }
        }
    }

    function performDeepLogSearch() {
        if (logSearchTimeout) clearTimeout(logSearchTimeout);
        var term = logSearchInput.value.trim();
        applyFilters();
        if (term) {
            triggerBackgroundDeepSearch(term.toLowerCase());
        }
    }

    if (logSearchBtn) {
        logSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performDeepLogSearch();
        });
    }

    if (logSearchClear) {
        logSearchClear.addEventListener('click', () => {
            if (logSearchTimeout) clearTimeout(logSearchTimeout);
            searchSequenceId++;
            isDeepSearching = false;
            logSearchInput.value = '';
            logSearchClear.style.display = 'none';
            if (logSearchBtn) logSearchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
            allLogs.forEach(l => l.bodyMatch = false);
            fetchDebugLogs();
        });
    }

    if (logSearchInput) {
        // Handle Enter key for Deep Search
        logSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performDeepLogSearch();
            }
        });

        // Realtime background search on typing
        logSearchInput.addEventListener('input', () => {
            var term = logSearchInput.value.trim();
            if (logSearchClear) logSearchClear.style.display = term ? 'flex' : 'none';

            // Cancel any active searches immediately on typing
            searchSequenceId++;
            isDeepSearching = false;

            if (!term) {
                if (logSearchBtn) logSearchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
                allLogs.forEach(l => l.bodyMatch = false);
            }

            if (logSearchTimeout) clearTimeout(logSearchTimeout);
            logSearchTimeout = setTimeout(() => {
                applyFilters();
                if (term) {
                    triggerBackgroundDeepSearch(term.toLowerCase());
                }
            }, 300);
        });
    }

    var userFilterSelect = document.getElementById('sfarc-log-user-filter');
    if (userFilterSelect) {
        userFilterSelect.addEventListener('change', applyFilters);
    }

    var myLogsBtn = document.getElementById('sfarc-my-logs-btn');
    if (myLogsBtn) {
        myLogsBtn.addEventListener('click', async () => {
            try {
                // Toggle active state visualization
                myLogsBtn.classList.toggle('active');

                // Get current user ID if not known
                if (!window.currentUserId) {
                    var userResponse = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/chatter/users/me`);
                    var userInfo = await userResponse.json();
                    window.currentUserId = userInfo.id;
                    window.currentUserName = userInfo.displayName || userInfo.name || userInfo.username || window.currentUserName;
                    if (window.sfApi) {
                        window.sfApi.userInfo = {
                            ...(window.sfApi.userInfo || {}),
                            id: userInfo.id,
                            username: userInfo.username || userInfo.email,
                            orgId: userInfo.organizationId || userInfo.organization?.id,
                            name: window.currentUserName
                        };
                    }
                }

                // Set dropdown to current user
                if (window.currentUserId) {
                    // Check if we are activating or deactivating
                    if (myLogsBtn.classList.contains('active')) {
                        userFilterSelect.value = window.currentUserId;
                    } else {
                        userFilterSelect.value = ""; // Reset to All Users
                    }
                    applyFilters();
                }
            } catch (e) {
                console.error('Error getting current user', e);
                myLogsBtn.classList.remove('active'); // Revert on error
            }
        });

        // Also listen for dropdown changes to sync the button state
        if (userFilterSelect) {
            userFilterSelect.addEventListener('change', () => {
                if (userFilterSelect.value === window.currentUserId) {
                    myLogsBtn.classList.add('active');
                } else {
                    myLogsBtn.classList.remove('active');
                }
                applyFilters();
            });
        }
    }

    var rowsSelect = document.getElementById('sfarc-log-rows');
    if (rowsSelect) {
        rowsSelect.addEventListener('change', () => {
            rowsPerPage = parseInt(rowsSelect.value, 10);
            currentPage = 1;
            renderPagination();
        });
    }

    var prevBtn = document.getElementById('sfarc-log-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPagination();
            }
        });
    }

    var nextBtn = document.getElementById('sfarc-log-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            var totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
            if (currentPage < totalPages) {
                currentPage++;
                renderPagination();
            }
        });
    }

    setupLogSorting();

    // Select All Debug Logs Checkbox
    var selectAllLogsCheckbox = document.getElementById('sfarc-select-all-logs');
    if (selectAllLogsCheckbox) {
        selectAllLogsCheckbox.addEventListener('change', (e) => {
            var checkboxes = document.querySelectorAll('.sfarc-log-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                var row = cb.closest('tr');
                if (row) row.classList.toggle('sfarc-row-selected', cb.checked);
            });
            updateDeleteBadge();
        });
    }

    var deleteAllLogsBtn = document.getElementById('sfarc-delete-all-logs');
    if (deleteAllLogsBtn) {
        deleteAllLogsBtn.addEventListener('click', async () => {
            // Check if specific logs are selected
            var selectedCheckboxes = document.querySelectorAll('.sfarc-log-checkbox:checked');
            var hasSelection = selectedCheckboxes.length > 0;

            var confirmTitle = hasSelection
                ? `Delete ${selectedCheckboxes.length} selected debug log${selectedCheckboxes.length > 1 ? 's' : ''}?`
                : 'Delete ALL debug logs?';
            var confirmMsg = hasSelection
                ? `This will permanently delete ${selectedCheckboxes.length} selected log${selectedCheckboxes.length > 1 ? 's' : ''}. This action cannot be undone.`
                : 'No logs selected. This will permanently delete all debug logs (up to 50). This action cannot be undone.';

            var confirmed = await showConfirmDialog(confirmTitle, confirmMsg, { danger: true, okLabel: 'Delete' });
            if (!confirmed) return;

            try {
                var logIdsToDelete = [];

                if (hasSelection) {
                    // Delete only selected logs
                    logIdsToDelete = Array.from(selectedCheckboxes).map(cb => cb.value);
                } else {
                    // Delete all logs (original behavior)
                    var query = "SELECT Id FROM ApexLog ORDER BY StartTime DESC LIMIT 50";
                    var result = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);
                    if (result.records && result.records.length > 0) {
                        logIdsToDelete = result.records.map(r => r.Id);
                    }
                }

                if (logIdsToDelete.length === 0) {
                    showToast('No debug logs found to delete.', 'warning');
                    return;
                }

                showToast(`Deleting ${logIdsToDelete.length} debug log${logIdsToDelete.length > 1 ? 's' : ''}...`, 'info');

                // Show Progress UI on Button (Outer Ring + Centered Text)
                var originalBtnContent = deleteAllLogsBtn.innerHTML;
                deleteAllLogsBtn.disabled = true;
                deleteAllLogsBtn.innerHTML = '';
                deleteAllLogsBtn.classList.add('processing');

                var ringSize = 34;
                var strokeWidth = 2;
                var radius = (ringSize - strokeWidth) / 2;
                var circumference = 2 * Math.PI * radius;

                deleteAllLogsBtn.insertAdjacentHTML('beforeend', `
                    <svg class="sfarc-progress-ring-outer" width="${ringSize}" height="${ringSize}">
                        <circle class="track" cx="${ringSize / 2}" cy="${ringSize / 2}" r="${radius}"></circle>
                        <circle class="progress red" cx="${ringSize / 2}" cy="${ringSize / 2}" r="${radius}" stroke-dasharray="0 ${circumference}"></circle>
                    </svg>
                    <div class="sfarc-progress-text">0/${logIdsToDelete.length}</div>
                `);

                var deletedCount = 0;
                for (const logId of logIdsToDelete) {
                    try {
                        await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/ApexLog/${logId}`, { method: 'DELETE' });
                        deletedCount++;

                        var percent = (deletedCount / logIdsToDelete.length);
                        var offset = percent * circumference;

                        var progressCircle = deleteAllLogsBtn.querySelector('.sfarc-progress-ring-outer .progress');
                        var progressText = deleteAllLogsBtn.querySelector('.sfarc-progress-text');

                        if (progressCircle) {
                            progressCircle.style.strokeDasharray = `${offset} ${circumference}`;
                        }
                        if (progressText) {
                            progressText.textContent = `${deletedCount}/${logIdsToDelete.length}`;
                        }
                    } catch (delErr) {
                        console.error('Error deleting single log:', delErr);
                    }
                }

                showToast(`Deleted ${deletedCount} log${deletedCount > 1 ? 's' : ''}.`, 'success');

                // Reset UI
                deleteAllLogsBtn.disabled = false;
                deleteAllLogsBtn.classList.remove('processing');
                deleteAllLogsBtn.innerHTML = originalBtnContent;

                // Uncheck select-all
                if (selectAllLogsCheckbox) selectAllLogsCheckbox.checked = false;

                // Clear the badge since all selected logs have been deleted
                updateDeleteBadge();

                // Refresh
                fetchDebugLogs();
            } catch (e) {
                console.error('Error deleting logs:', e);
                showToast('Error deleting logs: ' + e.message, 'error');
                if (deleteAllLogsBtn) {
                    deleteAllLogsBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 6H13M8 6V12M5 6V12M11 6V12M4 3H12M10 3V1H6V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    deleteAllLogsBtn.disabled = false;
                }
            }
        });
    }

    if (levelModal) {
        levelModal.querySelectorAll('.sfarc-modal-close, .sfarc-modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                levelModal.style.display = 'none';
            });
        });
    }

    if (traceModal) {
        traceModal.querySelectorAll('.sfarc-modal-close, .sfarc-modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // If the click originated inside levelModal, do not close traceModal
                if (levelModal && levelModal.contains(e.target)) {
                    return;
                }
                traceModal.style.display = 'none';
            });
        });
    }

    // User Search
    if (userSearchInput) {
        var userSearchTimeout;
        var userResults = document.getElementById('sfarc-user-results');

        userSearchInput.addEventListener('input', () => {
            clearTimeout(userSearchTimeout);
            var term = userSearchInput.value;
            if (term.length < 2) {
                userResults.style.display = 'none';
                return;
            }

            userSearchTimeout = setTimeout(async () => {
                try {
                    var query = `SELECT Id, Name, Username FROM User WHERE Name LIKE '%${term}%' LIMIT 5`;
                    var result = await window.sfApi.query(query);
                    userResults.innerHTML = '';
                    if (result.records && result.records.length > 0) {
                        result.records.forEach(user => {
                            var div = document.createElement('div');
                            div.className = 'sfarc-dropdown-item';
                            div.textContent = `${user.Name} (${user.Username})`;
                            div.onclick = () => {
                                userSearchInput.value = user.Name;
                                userSearchInput.dataset.userId = user.Id;
                                userResults.style.display = 'none';
                            };
                            userResults.appendChild(div);
                        });
                        userResults.style.display = 'block';
                    } else {
                        userResults.style.display = 'none';
                    }
                } catch (e) {
                    console.error('User search error', e);
                }
            }, 300);
        });
    }

    // Create Trace Flag
    if (createTraceBtn) {
        createTraceBtn.addEventListener('click', async () => {
            var userId = userSearchInput.dataset.userId;
            var debugLevelId = document.getElementById('sfarc-trace-level').value;
            var expirationMinutes = parseInt(document.getElementById('sfarc-trace-expiration').value);

            if (!userId || !debugLevelId) {
                toast.error('Please select a User and a Debug Level.');
                return;
            }

            var startDate = new Date();
            var expirationDate = new Date(startDate.getTime() + expirationMinutes * 60000);

            // Fetch fresh settings for LogType
            var storageData = await chrome.storage.sync.get(['sfiSettings']);
            var currentSettings = { ...settings, ...(storageData.sfiSettings || {}) };
            var logType = currentSettings.logType || currentSettings.debugType || 'USER_DEBUG';

            var traceFlag = {
                TracedEntityId: userId,
                DebugLevelId: debugLevelId,
                StartDate: startDate.toISOString(),
                ExpirationDate: expirationDate.toISOString(),
                LogType: logType
            };

            try {
                var response = await window.sfApi.create('TraceFlag', traceFlag, true);

                if (response.id || response.success) {
                    traceModal.style.display = 'none';
                    fetchTraceFlags();
                } else {
                    toast.error('Failed to create Trace Flag: ' + JSON.stringify(response));
                }
            } catch (e) {
                toast.error('Error creating Trace Flag: ' + e.message);
            }
        });
    }

    // Add Current User
    if (addUserBtn) {
        addUserBtn.addEventListener('click', async () => {
            if (levelModal) levelModal.style.display = 'none';
            try {
                // Get current Salesforce user from the REST API.
                var currentUser = await fetchCurrentUserId();
                var currentUserId = currentUser?.id;
                var currentUserName = currentUser?.name;

                if (!currentUserId || !currentUserName) {
                    throw new Error('Current user info was incomplete. Please refresh the Salesforce tab and try again.');
                }

                // Pre-fill User Search Input
                userSearchInput.value = currentUserName;
                userSearchInput.dataset.userId = currentUserId;

                // Pre-fill Start Date with current local time
                var now = new Date();
                var localIsoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                document.getElementById('sfarc-trace-start').value = localIsoString;

                // Load Debug Levels
                await loadDebugLevels();

                // Fetch fresh settings
                var storageData = await chrome.storage.sync.get(['sfiSettings']);
                var currentSettings = { ...settings, ...(storageData.sfiSettings || {}) };

                // Set Default Debug Level if configured
                if (currentSettings.defaultDebugLevelId) {
                    var levelSelect = document.getElementById('sfarc-trace-level');
                    if (levelSelect) {
                        levelSelect.value = currentSettings.defaultDebugLevelId;
                    }
                }

                // Open Modal
                traceModal.style.display = 'flex';

            } catch (e) {
                console.error('Error getting current user info', e);
                toast.error('Failed to get current user info: ' + e.message);
            }
        });
    }

    // New Level Modal Logic
    var newLevelBtn = document.getElementById('sfarc-new-level-btn');
    var saveLevelBtn = document.getElementById('sfarc-save-level-btn');
    var levelRowsContainer = document.getElementById('sfarc-level-rows');
    var levelNameInput = document.getElementById('sfarc-level-name');

    var categories = [
        { key: 'Database', label: 'Database' },
        { key: 'Workflow', label: 'Workflow' },
        { key: 'Validation', label: 'Validation' },
        { key: 'Callout', label: 'Callout' },
        { key: 'ApexCode', label: 'Apex Code' },
        { key: 'ApexProfiling', label: 'Apex Profiling' },
        { key: 'Visualforce', label: 'Visualforce' },
        { key: 'System', label: 'System' }
    ];
    var logLevels = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

    // Shared "Create Log Level" modal opener — used by both the "New Level"
    // button and the Trace Flags "+" button (sfarc-new-trace).
    function openLogLevelModal() {
        // Clear name
        if (levelNameInput) levelNameInput.value = '';

        // Populate rows
        if (levelRowsContainer) {
            levelRowsContainer.innerHTML = '';
            categories.forEach(cat => {
                var tr = document.createElement('tr');
                tr.dataset.category = cat.key;

                var colsHtml = `<td style="font-weight: 500; text-align: left;">${cat.label}</td>`;
                logLevels.forEach(level => {
                    // Default to DEBUG for all categories
                    var isChecked = level === 'DEBUG' ? 'checked' : '';
                    colsHtml += `
                        <td style="text-align: center;">
                            <label class="sfarc-radio-cell-label">
                                <input type="radio" name="sfarc-level-${cat.key}" value="${level}" ${isChecked} class="sfarc-level-radio-input">
                            </label>
                        </td>
                    `;
                });

                tr.innerHTML = colsHtml;
                levelRowsContainer.appendChild(tr);
            });

            if (!levelRowsContainer.dataset.hasClickListener) {
                levelRowsContainer.dataset.hasClickListener = 'true';
                levelRowsContainer.addEventListener('click', (e) => {
                    var td = e.target.closest('td');
                    if (td && !e.target.matches('input[type="radio"]')) {
                        var radio = td.querySelector('input[type="radio"]');
                        if (radio) {
                            radio.checked = true;
                        }
                    }
                });
            }
        }

        // Show Modal
        if (levelModal) levelModal.style.display = 'flex';
    }

    if (newLevelBtn) {
        newLevelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLogLevelModal();
        });
    }

    if (saveLevelBtn) {
        saveLevelBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            var rawName = levelNameInput ? levelNameInput.value.trim() : '';
            if (!rawName) {
                toast.error('Please enter a Debug Level Name.');
                return;
            }

            // Generate standard developer name: replace spaces and special chars with underscores
            var devName = rawName.replace(/[^a-zA-Z0-9]/g, '_');
            // Remove leading/trailing underscores
            devName = devName.replace(/^_+|_+$/g, '');
            // Ensure starts with a letter
            if (!/^[a-zA-Z]/.test(devName)) {
                toast.error('Debug Level Name must start with a letter.');
                return;
            }

            var levels = {};
            var rows = levelRowsContainer ? levelRowsContainer.querySelectorAll('tr') : [];
            rows.forEach(row => {
                var cat = row.dataset.category;
                var checkedInput = row.querySelector(`input[name="sfarc-level-${cat}"]:checked`);
                if (cat && checkedInput) {
                    levels[cat] = checkedInput.value;
                }
            });

            var payload = {
                DeveloperName: devName,
                MasterLabel: rawName,
                ...levels
            };

            try {
                // Show saving state
                saveLevelBtn.disabled = true;
                saveLevelBtn.style.opacity = '0.5';

                var result = await window.sfApi.create('DebugLevel', payload, true);

                if (result.success || (result.id && !result.errors?.length)) {
                    var newId = result.id || result.Id;

                    // Hide Modal
                    if (levelModal) levelModal.style.display = 'none';

                    // Reload Debug Levels dropdown in real-time
                    await loadDebugLevels(true);

                    // Set selected value to newly created level
                    var levelSelect = document.getElementById('sfarc-trace-level');
                    if (levelSelect) {
                        if (newId && Array.from(levelSelect.options).some(o => o.value === newId)) {
                            levelSelect.value = newId;
                        } else if (devName && Array.from(levelSelect.options).some(o => o.text === devName || o.text === rawName)) {
                            var opt = Array.from(levelSelect.options).find(o => o.text === devName || o.text === rawName);
                            if (opt) levelSelect.value = opt.value;
                        }
                    }

                    showToast('Debug Level created successfully!', 'success');
                } else {
                    var errMsg = result.errors && result.errors.length > 0 ? result.errors[0].message : 'Unknown error';
                    toast.error('Failed to save Debug Level: ' + errMsg);
                }
            } catch (err) {
                console.error('Error saving Debug Level:', err);
                toast.error('Error saving Debug Level: ' + err.message);
            } finally {
                saveLevelBtn.disabled = false;
                saveLevelBtn.style.opacity = '1';
            }
        });
    }
}

// Initialize listeners when script loads (or when UI is injected)
// Since we inject UI dynamically, we should call this after injection.
// But for now, let's call it if elements exist, or rely on the fact that content.js runs after DOM load?
// Actually, content.js injects the UI. So we should call setupDebugLogListeners() inside injectUI or just after appending panel.
// I'll add a call to it at the end of the file, but it might run before UI is injected if I'm not careful.
// Better: Add a check or call it from init.
// For now, I'll add a timeout to ensure UI is present.
setTimeout(setupDebugLogListeners, 1000);

// Header Injection
function injectHeaderButtons() {
    var headerInjectionFrame = null;
    var scheduleHeaderInjection = () => {
        if (headerInjectionFrame !== null) return;
        headerInjectionFrame = requestAnimationFrame(() => {
            headerInjectionFrame = null;
            var globalActions = document.querySelector('.slds-global-actions');
            if (globalActions && !globalActions.dataset.sfiHeaderButtonsInjected) {
                addHeaderButtons(globalActions);
            }
        });
    };

    var observer = new MutationObserver(scheduleHeaderInjection);

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    scheduleHeaderInjection();
}

function getHeaderIconSettings() {
    return {
        sessionCopy: true,
        fieldApi: true,
        lwcViewer: true,
        flowViewer: true,
        showAllData: true,
        ...(settings.headerIcons || {})
    };
}

function refreshHeaderButtons() {
    var globalActions = document.querySelector('.slds-global-actions');
    if (!globalActions) return;
    var headerIcons = getHeaderIconSettings();
    if (!headerIcons.fieldApi) {
        document.body.classList.remove('sfarc-show-api-names-active');
        hideApiNames();
    }
    if (!headerIcons.lwcViewer) {
        document.body.classList.remove('sfarc-expose-lwc-active');
        hideLwcNames();
    }
    if (!headerIcons.flowViewer) {
        document.body.classList.remove('sfarc-expose-flow-active');
        hideFlowNames();
    }
    document.querySelectorAll('.sfarc-global-action-item').forEach(item => item.remove());
    delete globalActions.dataset.sfiHeaderButtonsInjected;
    addHeaderButtons(globalActions);
}

function triggerHeaderIconsAnimation() {
    var btnIds = ['sfarc-header-show-all-btn', 'sfarc-header-api-btn', 'sfarc-header-lwc-btn', 'sfarc-header-flow-btn'];
    btnIds.forEach((id, index) => {
        var btn = document.getElementById(id);
        if (btn) {
            setTimeout(() => {
                btn.classList.add('sfarc-header-icon-pop');
                btn.style.filter = 'drop-shadow(0 0 10px var(--sfarc-accent, var(--sfarc-accent, #2196f3)))';
                setTimeout(() => {
                    btn.classList.remove('sfarc-header-icon-pop');
                    btn.style.filter = '';
                }, 1200);
            }, index * 120);
        }
    });
}

function addHeaderButtons(container) {
    container.dataset.sfiHeaderButtonsInjected = 'true';
    document.querySelectorAll('.sfarc-global-action-item').forEach(item => item.remove());
    var headerIcons = getHeaderIconSettings();
    var beforeNode = container.lastElementChild;

    // API Name Button
    var apiLi = null;
    if (headerIcons.fieldApi) {
        apiLi = document.createElement('li');
        apiLi.id = 'sfarc-header-api-li';
        apiLi.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click sfarc-global-action-item sfarc-tooltip-wrapper';
        apiLi.style.display = (currentRecordContext && currentRecordContext.isRecordPage) ? '' : 'none';
        apiLi.innerHTML = `
            <button class="slds-button slds-button_icon slds-global-actions__item-action slds-button_icon-container slds-button_icon-small" id="sfarc-header-api-btn" style="position: relative; overflow: visible; z-index: 1;">
                <i class="fa-solid fa-eye" style="font-size: 20px;"></i>
                <span class="sfarc-header-badge" id="sfarc-api-badge" data-count="0">0</span>
            </button>
        `;
        apiLi.querySelector('button').addEventListener('click', toggleApiNames);
    }

    // Expose buttons support pages
    var isLightningPage = window.location.pathname.includes('/lightning/');
    var isSetupPage = window.location.pathname.includes('/lightning/setup/');
    var isExposeAppropriate = isLightningPage && !isSetupPage;

    // LWC Button
    var lwcLi = null;
    if (headerIcons.lwcViewer) {
        lwcLi = document.createElement('li');
        lwcLi.id = 'sfarc-header-lwc-li';
        lwcLi.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click sfarc-global-action-item sfarc-tooltip-wrapper';
        lwcLi.style.display = isExposeAppropriate ? '' : 'none';
        lwcLi.innerHTML = `
             <button class="slds-button slds-button_icon slds-global-actions__item-action slds-button_icon-container slds-button_icon-small" id="sfarc-header-lwc-btn" style="position: relative; overflow: visible; z-index: 1;">
                <i class="fa-solid fa-bolt" style="font-size: 20px;"></i>
                <span class="sfarc-header-badge" id="sfarc-lwc-badge" data-count="0">0</span>
            </button>
        `;
        lwcLi.querySelector('button').addEventListener('click', toggleLwcNames);
    }

    // Flow Button
    var flowLi = null;
    if (headerIcons.flowViewer) {
        flowLi = document.createElement('li');
        flowLi.id = 'sfarc-header-flow-li';
        flowLi.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click sfarc-global-action-item sfarc-tooltip-wrapper';
        flowLi.style.display = isExposeAppropriate ? '' : 'none';
        flowLi.innerHTML = `
             <button class="slds-button slds-button_icon slds-global-actions__item-action slds-button_icon-container slds-button_icon-small" id="sfarc-header-flow-btn" style="position: relative; overflow: visible; z-index: 1;">
                <i class="fa-solid fa-sitemap" style="font-size: 20px;"></i>
                <span class="sfarc-header-badge" id="sfarc-flow-badge" data-count="0">0</span>
            </button>
        `;
        flowLi.querySelector('button').addEventListener('click', toggleFlowNames);
    }

    // Insert before the user profile or last item
    if (flowLi) container.insertBefore(flowLi, beforeNode);
    if (lwcLi) container.insertBefore(lwcLi, flowLi || beforeNode);
    if (apiLi) container.insertBefore(apiLi, lwcLi || flowLi || beforeNode);

    // Show All Data Button
    var showAllLi = null;
    if (headerIcons.showAllData) {
        showAllLi = document.createElement('li');
        showAllLi.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click sfarc-global-action-item sfarc-tooltip-wrapper';
        showAllLi.id = 'sfarc-header-show-all-li';
        showAllLi.style.display = currentRecordContext && currentRecordContext.isRecordPage ? '' : 'none';
        var SHOW_ALL_DATA_ICON_HTML = '<i class="fa-solid fa-table-cells" style="font-size: 20px;"></i>';

        var resetShowAllDataBtn = () => {
            var btn = document.getElementById('sfarc-header-show-all-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = SHOW_ALL_DATA_ICON_HTML;
            }
        };

        showAllLi.innerHTML = `
             <button class="slds-button slds-button_icon slds-global-actions__item-action slds-button_icon-container slds-button_icon-small" id="sfarc-header-show-all-btn" style="position: relative; overflow: visible; z-index: 1;">
                ${SHOW_ALL_DATA_ICON_HTML}
            </button>
        `;
        showAllLi.querySelector('button').addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (!currentRecordContext || !currentRecordContext.isRecordPage) {
                toast.error('Please navigate to a record page first.');
                return;
            }

            var btn = document.getElementById('sfarc-header-show-all-btn') || e.currentTarget;
            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="comet-loader-inline"></span>';
                }

                var recordData = await fetchCompleteRecordData(
                    currentRecordContext.objectType,
                    currentRecordContext.recordId
                );

                var dataKey = `sfarc-record-${Date.now()}`;
                await chrome.storage.local.set({ [dataKey]: recordData });

                // Reset button state right before launching new tab
                resetShowAllDataBtn();

                // Open viewer with data key in URL via background script
                chrome.runtime.sendMessage({
                    action: 'openExtensionPage',
                    page: 'record-viewer',
                    params: { dataKey: dataKey }
                });

            } catch (error) {
                console.error('Error fetching record data:', error);
                toast.error('Error fetching record data. Check console for details.');
            } finally {
                resetShowAllDataBtn();
            }
        });

        container.insertBefore(showAllLi, apiLi || lwcLi || flowLi || beforeNode);
    }

    // Copy Session URL Button
    if (!headerIcons.sessionCopy) return;
    var sessionLi = createSessionCopyHeaderButton();
    container.insertBefore(sessionLi, showAllLi || apiLi || lwcLi || flowLi || beforeNode);
}

function createSessionCopyHeaderButton() {
    var sessionLi = document.createElement('li');
    sessionLi.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click sfarc-global-action-item';
    sessionLi.innerHTML = `
         <button class="slds-button slds-button_icon slds-global-actions__item-action slds-button_icon-container slds-button_icon-small" id="sfarc-header-session-btn">
            <i class="fa-solid fa-id-badge" style="font-size: 20px;"></i>
        </button>
    `;
    sessionLi.querySelector('button').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        var btn = e.currentTarget;

        try {
            // Get session ID and instance URL
            var sessionId = window.sfApi?.sessionId;
            var instanceUrl = window.sfApi?.instanceUrl;

            // Always try to fetch the Classic 'sid' cookie for frontdoor.jsp since Lightning sessions cause 302 redirects
            try {
                if (window.sfApi && typeof window.sfApi.getCookie === 'function') {
                    var sessionCookie = await window.sfApi.getCookie('sid');
                    if (sessionCookie && sessionCookie.value) {
                        sessionId = decodeURIComponent(sessionCookie.value);
                    }
                }
            } catch (e) { }

            if (sessionId && instanceUrl) {
                var classicDomainUrl = instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
                var decodedSessionId = decodeURIComponent(sessionId);
                var sessionUrl = `${classicDomainUrl}/secur/frontdoor.jsp?sid=${decodedSessionId}`;
                await navigator.clipboard.writeText(sessionUrl);

                // Show tooltip notification
                showTooltipNotification('Session ID URL Copied!');
            } else {
                showTooltipNotification('Session ID not found', 'error');
                toast.error('Session ID not found. Ensure Salesforce Comet is authorized.');
            }
        } catch (err) {
            showTooltipNotification('Failed to copy Session ID URL', 'error');
            console.error('Failed to copy session URL:', err);
        }
    });
    return sessionLi;
}

// Tooltip notification function
function showTooltipNotification(message, type = 'success') {
    // Remove any existing tooltip
    var existing = document.querySelector('.sfarc-tooltip-notification');
    if (existing) existing.remove();

    // Create tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'sfarc-tooltip-notification';

    var iconSvg = type === 'error'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    tooltip.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center;">${iconSvg}</span><span>${escapeHtml(message)}</span>`;

    if (type === 'error') {
        tooltip.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    } else {
        tooltip.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }

    document.body.appendChild(tooltip);

    // Trigger spring animation
    requestAnimationFrame(() => tooltip.classList.add('show'));

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
        tooltip.classList.remove('show');
        setTimeout(() => tooltip.remove(), 400);
    }, 2500);
}

// Show API Names Feature
async function toggleApiNames() {
    var sidebarBtn = document.getElementById('sfarc-show-api-names');
    var headerBtn = document.getElementById('sfarc-header-api-btn');
    var badge = document.getElementById('sfarc-api-badge');

    // Determine target state (toggle if clicking, or sync)
    // Here we toggle based on active class of sidebar button, or just flip it.
    // Simplest is to check body class or sidebar class.

    var isActive = false;
    if (sidebarBtn) {
        isActive = sidebarBtn.classList.toggle('active');
    } else {
        // If sidebar not loaded yet, check body class
        isActive = !document.body.classList.contains('sfarc-show-api-names-active');
    }

    if (headerBtn) {
        headerBtn.classList.toggle('slds-is-selected', isActive);
        headerBtn.classList.toggle('sfarc-header-btn-active', isActive);
    }

    if (isActive) {
        document.body.classList.add('sfarc-show-api-names-active');
        await showApiNames();
        // Count the badges
        var count = document.querySelectorAll('.sfarc-api-name-badge').length;
        if (badge) {
            badge.textContent = count;
            badge.setAttribute('data-count', count);
        }
    } else {
        document.body.classList.remove('sfarc-show-api-names-active');
        hideApiNames();
        if (badge) {
            badge.textContent = '0';
            badge.setAttribute('data-count', '0');
        }
    }
}

var sfarcApiNamesObserver = null;
var sfarcApiNamesScanTimer = null;

// Labels that already carry an API-name badge. Both scan paths (DOM-attribute
// and describe-label) and the lazy-load observer share this so a field can
// never get a second badge, no matter which path or re-scan runs first.
// Dedupe by the FIELD's unique key, not by DOM element. Lightning re-creates
// label/container elements as it lazy-loads and re-renders a details page, so
// an element-based WeakSet lets fresh elements get badged again (2-3 pills per
// field). API names are unique per object, so keying on the full
// data-target-selection-name (or object+apiName for the label path) guarantees
// exactly one badge per field no matter which path runs first or how often the
// DOM churns.
var sfarcApiBadgedKeys = new Map();

function resetApiBadgeDedupe() {
    sfarcApiBadgedKeys = new Map();
}

function isApiBadged(key) {
    return !!key && sfarcApiBadgedKeys.has(key);
}

// True when a badge for this API name is already visible ANYWHERE in the page.
// This is the authoritative dedupe: Lightning re-creates elements (and even
// entire containers) as it lazy-loads/re-renders, so element-based checks let
// fresh elements get badged again (2-3 pills per field). Keying on the API
// name means the SAME field can never carry two badges — while still
// self-healing: if a re-render destroys the badge-carrying element, this
// returns false and the next scan re-badges the fresh element exactly once.
function hasLiveBadge(apiName) {
    return Array.from(document.querySelectorAll('.sfarc-api-badge')).some(b =>
        b.dataset.api === apiName || (b.dataset.api && b.dataset.api.split(', ').includes(apiName)));
}

// Extra DOM-level guard: true when a badge already exists on the element itself
// or anywhere inside its [data-target-selection-name] container.
function hasApiBadgeInScope(el) {
    if (!el) return false;
    if (el.querySelector && el.querySelector('.sfarc-api-badge')) return true;
    var scope = el.closest ? el.closest('[data-target-selection-name^="sfdc:recordField"]') : null;
    return !!scope && !!scope.querySelector('.sfarc-api-badge');
}

// Create a blue API-name pill (click to copy) — same look as before
function createApiBadge(apiNameStr) {
    var badge = document.createElement('span');
    badge.className = 'sfarc-api-badge sfarc-api-name-badge';
    badge.innerHTML = `<i class="fa-regular fa-eye" style="margin-right: 4px;"></i>${window.escapeHtml(apiNameStr)}`;
    badge.style.cssText = 'margin-left:8px;background:var(--sfarc-accent, var(--sfarc-accent, #2196f3));color:white;padding:2px 6px;font-size:11px;font-family:monospace;border-radius:3px;cursor:pointer;white-space:nowrap;';
    badge.dataset.api = apiNameStr;
    badge.title = `API Name: ${apiNameStr}`;
    badge.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(apiNameStr);
            var originalText = badge.textContent;
            badge.textContent = 'Copied!';
            badge.style.backgroundColor = '#4bca81';
            badge.style.color = 'white';
            setTimeout(() => {
                badge.textContent = originalText;
                badge.style.backgroundColor = '';
                badge.style.color = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy API name', err);
        }
    });
    return badge;
}

// Normalize a label for fuzzy matching (case, whitespace, "required" markers)
function normalizeFieldLabel(text) {
    return (text || '')
        .replace(/\s+/g, ' ')
        .replace(/\s*\(required\)\s*$/i, '')
        .replace(/\s*[*:]\s*$/, '')
        .trim()
        .toLowerCase();
}

async function showApiNames() {
    // 1) Primary path — like Salesforce Inspector Reloaded: the authoritative API
    //    name is in data-target-selection-name ("sfdc:recordField.<Object>.<Field>").
    //    Depending on the Lightning runtime the attribute sits on the layout-item
    //    element itself OR on its direct child div, so match any element carrying it.
    //    No describe call needed, so it works for every field on the page.
    var scanAttributePath = () => {
        var count = 0;
        var fieldEls = document.querySelectorAll('[data-target-selection-name^="sfdc:recordField"]');
        fieldEls.forEach(fieldEl => {
            var selName = fieldEl.getAttribute('data-target-selection-name');
            if (!selName) return;
            var parts = selName.split('.');
            var apiName = parts[parts.length - 1];
            if (!apiName || apiName === 'null' || apiName === 'undefined') return;

            // Only process the innermost match so a field never gets two badges
            if (fieldEl.querySelector('[data-target-selection-name^="sfdc:recordField"]')) return;

            // Dedupe by the field's unique key (Object.ApiName), not by DOM
            // element: Lightning re-creates elements as it re-renders, so an
            // element-based set would let fresh elements get badged again.
            var fieldKey = parts.length >= 3 ? parts[parts.length - 2] + '.' + apiName : apiName;
            // Skip if this API name already has a visible badge anywhere (the
            // same field can never get a second one, no matter the DOM churn).
            if (hasLiveBadge(apiName)) return;

            // Prefer the real field label; fall back to the first span.
            var labelEl = fieldEl.querySelector('.slds-form-element__label, .test-id__field-label') || fieldEl.querySelector('span');
            if (!labelEl || hasApiBadgeInScope(labelEl)) return;
            labelEl.appendChild(createApiBadge(apiName));
            sfarcApiBadgedKeys.set(fieldKey, true);
            count++;
        });
        return count;
    };

    // 2) Fallback — Classic / Visualforce / custom DOM without the attribute:
    //    fuzzy-match labels against the object describe map.
    var scanLabelPath = async () => {
        var context = detectRecordContext();
        if (!context.objectType) return 0;
        try {
            var fields = null;
            if (searchCache.objects && searchCache.objects[context.objectType]) {
                fields = searchCache.objects[context.objectType].fields;
            }
            if (!fields) {
                var describe = await window.sfApi.describe(context.objectType);
                fields = describe.fields;
                if (!searchCache.objects) searchCache.objects = {};
                if (!searchCache.objects[context.objectType]) searchCache.objects[context.objectType] = {};
                searchCache.objects[context.objectType].fields = fields;
            }
            var labelMap = {};
            fields.forEach(f => {
                var key = normalizeFieldLabel(f.label);
                if (!labelMap[key]) labelMap[key] = [];
                labelMap[key].push(f.name);
            });

            var count = 0;
            var labelEls = document.querySelectorAll('td.labelCol, th.labelCol, .test-id__field-label, .slds-form-element__label, span.slds-form-element__label');
            labelEls.forEach(el => {
                if (hasApiBadgeInScope(el)) return;
                var clone = el.cloneNode(true);
                clone.querySelectorAll('.sfarc-api-badge, i, svg').forEach(c => c.remove());
                var labelText = clone.textContent;
                var key = normalizeFieldLabel(labelText);
                var apiNames = labelMap[key];
                if (!apiNames) apiNames = labelMap[key + ' id']; // e.g. UI "Account Name" vs API "Account Name ID"
                if (!apiNames) {
                    // e.g. UI "Phone" vs API "Account Phone"
                    apiNames = labelMap[normalizeFieldLabel(context.objectType.replace(/_/g, ' ') + ' ' + labelText)];
                }
                if (apiNames && apiNames.length) {
                    // Skip if any resolved API name already has a visible badge
                    // (the attribute path or a previous pass may have badged it).
                    if (apiNames.some(n => hasLiveBadge(n))) return;
                    el.appendChild(createApiBadge(apiNames.join(', ')));
                    apiNames.forEach(n => sfarcApiBadgedKeys.set(context.objectType + '.' + n, true));
                    count++;
                }
            });
            return count;
        } catch (e) {
            console.error('Error fetching field describe for API names:', e);
            return 0;
        }
    };

    // Run both paths (the DOM path works even without a describe call), then watch
    // for lazily-loaded fields (tabs, accordions, "View All", edit mode) so every
    // field gets its badge without re-toggling.
    var count = scanAttributePath();
    count += await scanLabelPath();

    startApiNamesObserver(scanAttributePath, scanLabelPath);

    var badge = document.getElementById('sfarc-api-badge');
    if (badge) {
        badge.textContent = count;
        badge.setAttribute('data-count', count);
    }
    return count;
}

// Keep adding badges as Salesforce lazy-loads record sections
function startApiNamesObserver(scanAttributePath, scanLabelPath) {
    stopApiNamesObserver();
    if (!document.body.classList.contains('sfarc-show-api-names-active')) return;
    sfarcApiNamesObserver = new MutationObserver(mutations => {
        if (!mutations.some(m => m.addedNodes && m.addedNodes.length)) return;
        clearTimeout(sfarcApiNamesScanTimer);
        sfarcApiNamesScanTimer = setTimeout(() => {
            if (!document.body.classList.contains('sfarc-show-api-names-active')) return;
            var added = scanAttributePath();
            scanLabelPath().then(labelCount => {
                var badge = document.getElementById('sfarc-api-badge');
                if (badge) {
                    var current = parseInt(badge.getAttribute('data-count') || '0', 10) || 0;
                    var total = current + added + labelCount;
                    badge.textContent = total;
                    badge.setAttribute('data-count', total);
                }
            });
        }, 300);
    });
    sfarcApiNamesObserver.observe(document.body, { childList: true, subtree: true });
}

function stopApiNamesObserver() {
    if (sfarcApiNamesObserver) {
        sfarcApiNamesObserver.disconnect();
        sfarcApiNamesObserver = null;
    }
    clearTimeout(sfarcApiNamesScanTimer);
}

function hideApiNames() {
    stopApiNamesObserver();
    document.querySelectorAll('.sfarc-api-badge').forEach(el => el.remove());
    resetApiBadgeDedupe();
}

// Expose LWC Feature
function toggleLwcNames() {
    var sidebarBtn = document.getElementById('sfarc-expose-lwc');
    var headerBtn = document.getElementById('sfarc-header-lwc-btn');
    var badge = document.getElementById('sfarc-lwc-badge');

    var isActive = false;
    if (sidebarBtn) {
        isActive = sidebarBtn.classList.toggle('active');
    } else {
        isActive = !document.body.classList.contains('sfarc-expose-lwc-active');
    }

    if (headerBtn) {
        headerBtn.classList.toggle('slds-is-selected', isActive);
        headerBtn.classList.toggle('sfarc-header-btn-active', isActive);
    }

    if (isActive) {
        document.body.classList.add('sfarc-expose-lwc-active');
        var count = showLwcNames();
        if (badge) {
            badge.textContent = count;
            badge.setAttribute('data-count', count);
        }
    } else {
        document.body.classList.remove('sfarc-expose-lwc-active');
        hideLwcNames();
        if (badge) {
            badge.textContent = '0';
            badge.setAttribute('data-count', '0');
        }
    }
}

function showLwcNames() {
    var count = 0;

    // Recursive function to traverse Shadow DOM
    function traverse(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            var tag = node.tagName.toLowerCase();
            if (tag.includes('-')) {
                var added = addLwcBadge(node, tag);
                if (added) count++;
            }
        }

        // Traverse Shadow Root
        if (node.shadowRoot) {
            Array.from(node.shadowRoot.children).forEach(child => traverse(child));
        }

        // Traverse Children
        if (node.children) {
            Array.from(node.children).forEach(child => traverse(child));
        }
    }

    traverse(document.body);
    return count;
}

function addLwcBadge(node, tag) {
    // Skip elements inside Salesforce global top navigation header, utility bar, or header banners
    if (node.closest('.oneGlobalNav, .slds-global-header, .slds-global-header_container, header, .oneUtilityBar, #oneHeader, [role="banner"]')) return false;

    // Filter out standard components to reduce noise. Only show custom 'c-' components.
    if (!tag.startsWith('c-')) return false;

    if (node.dataset.sfiLwcBadge) return false; // Already processed

    var rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Convert c-my-component to MyComponent
    var bundleName = tag.substring(2).split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');

    var overlay = document.createElement('div');
    overlay.className = 'sfarc-lwc-badge';
    overlay.innerHTML = `LWC: ${window.escapeHtml(bundleName)}`;
    overlay.title = `Click to open ${bundleName} in Code Editor`;
    overlay.setAttribute('role', 'button');
    overlay.setAttribute('tabindex', '0');

    node.style.position = 'relative';
    node.style.outline = '2px dashed #f97316';
    node.appendChild(overlay);
    node.dataset.sfiLwcBadge = 'true'; // Mark as processed

    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openLwcInEditor(tag); // Pass original tag for parsing in openLwcInEditor
    });

    return true;
}

function hideLwcNames() {
    document.querySelectorAll('.sfarc-lwc-badge').forEach(badge => badge.remove());
    document.querySelectorAll('[data-sfi-lwc-badge]').forEach(el => {
        el.style.outline = '';
        delete el.dataset.sfiLwcBadge;
    });
}

// Expose Flow Feature
function toggleFlowNames() {
    var headerBtn = document.getElementById('sfarc-header-flow-btn');
    var badge = document.getElementById('sfarc-flow-badge');
    var isActive = !document.body.classList.contains('sfarc-expose-flow-active');

    if (headerBtn) {
        headerBtn.classList.toggle('slds-is-selected', isActive);
        headerBtn.classList.toggle('sfarc-header-btn-active', isActive);
    }

    if (isActive) {
        document.body.classList.add('sfarc-expose-flow-active');
        var count = showFlowNames();
        if (badge) {
            badge.textContent = count;
            badge.setAttribute('data-count', count);
        }
    } else {
        document.body.classList.remove('sfarc-expose-flow-active');
        hideFlowNames();
        if (badge) {
            badge.textContent = '0';
            badge.setAttribute('data-count', '0');
        }
    }
}

function injectFlowNameExtractor() {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/flow-name-extractor.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

function showFlowNames() {
    injectFlowNameExtractor();
    var flowElements = findFlowRuntimeElements();
    var count = 0;

    flowElements.forEach((el, index) => {
        if (el.dataset.sfiFlowExposed) return;
        var flowName = getFlowDisplayName(el, index);
        var badge = document.createElement('div');
        badge.className = 'sfarc-flow-badge';
        badge.textContent = `Flow: ${flowName}`;
        badge.title = 'Open this flow';
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openEmbeddedFlow(el, flowName, badge);
        });
        badge.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                openEmbeddedFlow(el, flowName, badge);
            }
        });
        el.style.position = 'relative';
        el.style.outline = '2px dashed var(--sfarc-accent, var(--sfarc-accent, #2196f3))';
        el.appendChild(badge);
        el.dataset.sfiFlowExposed = 'true';
        count++;
    });
    return count;
}

function findFlowRuntimeElements() {
    var selectors = [
        '[data-flow-api-name]',
        '[data-flow-name]',
        '[data-component-id*="flow" i]',
        '[data-aura-class*="flowruntime" i]',
        '.flowruntime',
        '.flowruntimeForFlexipage',
        '.runtime_flowruntimeFlow',
        'flowruntime-flow',
        'flowruntime-interview',
        'runtime_flowruntime-flow',
        'lightning-flow'
    ];
    var matches = new Set();

    document.querySelectorAll(selectors.join(',')).forEach(el => {
        if (el.closest('.oneGlobalNav, .slds-global-header, .slds-global-header_container, header, .oneUtilityBar, #oneHeader, [role="banner"]')) return;
        if (isUsableFlowElement(el)) matches.add(el);
    });

    var inspectElement = (el) => {
        if (matches.has(el)) return;

        var tag = el.tagName?.toLowerCase() || '';
        var className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
        var auraClass = (el.getAttribute('data-aura-class') || '').toLowerCase();
        var componentId = (el.getAttribute('data-component-id') || '').toLowerCase();

        if (
            tag.includes('flowruntime') ||
            tag === 'lightning-flow' ||
            className.includes('flowruntime') ||
            className.includes('runtime_flowruntime') ||
            auraClass.includes('flowruntime') ||
            componentId.includes('flow')
        ) {
            if (isUsableFlowElement(el)) matches.add(el);
        }
    };

    var walkRoot = (root) => {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            var el = walker.currentNode;
            inspectElement(el);
            if (el.shadowRoot) walkRoot(el.shadowRoot);
        }
    };

    walkRoot(document.body);

    document.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
            el.shadowRoot.querySelectorAll(selectors.join(',')).forEach(match => {
                if (isUsableFlowElement(match)) matches.add(match);
            });
        }
    });

    return Array.from(matches).filter(el => !Array.from(matches).some(other => other !== el && other.contains(el)));
}

function isUsableFlowElement(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function getFlowDisplayName(el, index) {
    var candidates = getFlowNameCandidates(el, '');

    for (const value of candidates) {
        var cleaned = String(value).trim();
        if (cleaned) return cleaned;
    }

    var text = (el.textContent || '').trim().split('\n').map(s => s.trim()).filter(Boolean)[0];
    if (text && text.length <= 60) return text;

    return `Embedded Flow ${index + 1}`;
}

async function openEmbeddedFlow(el, flowName, badge) {
    var originalText = badge?.textContent;
    var targetWindow = window.open('about:blank', '_blank');
    try {
        if (badge) {
            badge.classList.add('sfarc-flow-badge-loading');
            badge.textContent = 'Opening flow...';
        }

        var flow = await findFlowDefinitionForElement(el, flowName);
        if (flow && flow.Id) {
            var flowId = flow.Id;
            var flowVersionId = flow.ActiveVersionId || flow.activeVersionId || flow.LatestVersionId || flow.latestVersionId;
            var flowUrl = `${window.sfApi.instanceUrl}/lightning/${flowId}`;

            if (flowVersionId && String(flowVersionId).startsWith('301')) {
                flowUrl = `${window.sfApi.instanceUrl}/lightning/r/Flow/${flowVersionId}/view`;
            } else if (flowId) {
                flowUrl = `${window.sfApi.instanceUrl}/lightning/${flowId}`;
            }

            openUrlInPreparedTab(targetWindow, flowUrl);
            return;
        }

        var candidates = getFlowNameCandidates(el, flowName);
        var searchTerm = candidates.find(candidate => !/^Embedded Flow \d+$/i.test(candidate)) || '';
        var setupUrl = `${window.sfApi.instanceUrl || window.location.origin}/lightning/setup/Flows/home`;
        openUrlInPreparedTab(targetWindow, setupUrl);
        toast.error(searchTerm
            ? `Could not find a flow named "${searchTerm}". Opening Flow Setup.`
            : 'Could not detect this embedded flow API name. Opening Flow Setup.');
    } catch (error) {
        console.error('Error opening embedded flow:', error);
        if (targetWindow && !targetWindow.closed) targetWindow.close();
        toast.error('Could not open this flow: ' + (error.message || error));
    } finally {
        if (badge) {
            badge.classList.remove('sfarc-flow-badge-loading');
            badge.textContent = originalText;
        }
    }
}

function openUrlInPreparedTab(targetWindow, url) {
    if (targetWindow && !targetWindow.closed) {
        targetWindow.location.href = url;
    } else {
        window.open(url, '_blank');
    }
}

async function findFlowDefinitionForElement(el, flowName) {
    var candidates = getFlowNameCandidates(el, flowName);
    if (!candidates.length) return null;

    var tryQueryList = async (query, useTooling) => {
        try {
            var res = await window.sfApi.query(query, useTooling);
            if (res.records?.length) return res.records;
        } catch (e) {
            console.warn(`salesforce comet: query failed (${query.substring(0, 40)}...)`, e.message);
        }
        return [];
    };

    // 1. Fast SOQL query: SELECT Id, MasterLabel FROM Flow LIMIT 200
    var flowRecords = await tryQueryList(`SELECT Id, MasterLabel, DeveloperName FROM Flow LIMIT 200`, false);
    if (!flowRecords.length) {
        flowRecords = await tryQueryList(`SELECT Id, MasterLabel, DeveloperName FROM Flow LIMIT 200`, true);
    }
    if (!flowRecords.length) {
        flowRecords = await tryQueryList(`SELECT Id, MasterLabel, DeveloperName, ActiveVersionId, LatestVersionId FROM FlowDefinition LIMIT 200`, true);
    }

    if (flowRecords.length > 0) {
        for (const candidate of candidates) {
            var term = candidate.toLowerCase().trim();
            var match = flowRecords.find(f => {
                var label = (f.MasterLabel || f.Label || '').toLowerCase().trim();
                var name = (f.DeveloperName || f.ApiName || f.Name || '').toLowerCase().trim();
                return label === term || name === term || (term.length >= 3 && (label.includes(term) || name.includes(term)));
            });
            if (match) {
                return {
                    Id: match.Id,
                    MasterLabel: match.MasterLabel || match.Label,
                    DeveloperName: match.DeveloperName || match.ApiName,
                    ActiveVersionId: match.ActiveVersionId,
                    LatestVersionId: match.LatestVersionId
                };
            }
        }
    }

    // 2. Direct exact query fallback
    var exactTerms = candidates.map(escapeSoqlLiteral);
    var inClause = exactTerms.map(term => `'${term}'`).join(',');
    var tryQuerySingle = async (query, useTooling) => {
        try {
            var res = await window.sfApi.query(query, useTooling);
            if (res.records?.length) return res.records[0];
        } catch (e) {}
        return null;
    };

    var r = await tryQuerySingle(`SELECT Id, ApiName, Label, ActiveVersionId, LatestVersionId FROM FlowDefinitionView WHERE ApiName IN (${inClause}) OR Label IN (${inClause}) LIMIT 1`, false);
    if (r) return { Id: r.Id, DeveloperName: r.ApiName, MasterLabel: r.Label, ActiveVersionId: r.ActiveVersionId, LatestVersionId: r.LatestVersionId };

    r = await tryQuerySingle(`SELECT Id, DeveloperName, MasterLabel, ActiveVersionId, LatestVersionId FROM FlowDefinition WHERE DeveloperName IN (${inClause}) OR MasterLabel IN (${inClause}) LIMIT 1`, true);
    if (r) return r;

    return null;
}

function getFlowNameCandidates(el, flowName) {
    var values = new Set();
    var add = (value) => {
        var cleaned = String(value || '').trim();
        if (!cleaned || cleaned.length > 120 || isGenericFlowName(cleaned)) return;
        addFlowCandidateVariants(values, cleaned);
    };

    add(flowName);

    // Check our extracted true flow name first
    add(el.getAttribute('data-sfarc-true-flow-name'));

    [
        'flowApiName',
        'flowName',
        'apiName',
        'name'
    ].forEach(key => add(el.dataset?.[key]));

    [
        'flow-api-name',
        'flow-name',
        'data-flow-api-name',
        'data-flow-name',
        'data-api-name',
        'data-name',
        'name',
        'title',
        'aria-label'
    ].forEach(attr => add(el.getAttribute?.(attr)));

    el.querySelectorAll?.('[data-sfarc-true-flow-name], [flow-api-name], [flow-name], [data-flow-api-name], [data-flow-name], lightning-flow').forEach(child => {
        add(child.getAttribute('data-sfarc-true-flow-name'));
        add(child.getAttribute('flow-api-name'));
        add(child.getAttribute('flow-name'));
        add(child.getAttribute('data-flow-api-name'));
        add(child.getAttribute('data-flow-name'));
        add(child.getAttribute('name'));
    });

    collectFlowTextCandidates(el).forEach(add);

    return Array.from(values).filter(value => !/^Flow:\s*$/i.test(value));
}

function addFlowCandidateVariants(values, value) {
    var cleaned = value.replace(/^Flow:\s*/i, '').trim();
    if (!cleaned || isGenericFlowName(cleaned)) return;

    values.add(cleaned);
    values.add(cleaned.replace(/\s+/g, '_'));

    var colonParts = cleaned.split(':').map(part => part.trim()).filter(Boolean);
    if (colonParts.length > 1) {
        var lastPart = colonParts[colonParts.length - 1];
        if (lastPart && !isGenericFlowName(lastPart)) {
            values.add(lastPart);
            values.add(lastPart.replace(/\s+/g, '_'));
        }
    }
}

function isGenericFlowName(value) {
    return /^Embedded[_\s-]*Flow[_\s-]*\d+$/i.test(String(value || '').trim());
}

function collectFlowTextCandidates(root) {
    var candidates = new Set();
    var selectors = [
        'h1',
        'h2',
        'h3',
        '[role="heading"]',
        '.slds-text-heading_large',
        '.slds-text-heading_medium',
        '.slds-text-heading_small',
        '.flowruntimeBody h1',
        '.flowruntimeBody h2',
        '.flowruntimeBody h3'
    ];

    var addText = (value) => {
        var cleaned = String(value || '').replace(/\s+/g, ' ').trim();
        if (cleaned && cleaned.length <= 120) candidates.add(cleaned);
    };

    var scanRoot = (scanTarget) => {
        selectors.forEach(selector => {
            scanTarget.querySelectorAll?.(selector).forEach(match => addText(match.textContent));
        });
    };

    scanRoot(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
        var el = walker.currentNode;
        if (el.shadowRoot) scanRoot(el.shadowRoot);
    }

    var firstText = (root.textContent || '').trim().split('\n').map(s => s.trim()).filter(Boolean)[0];
    addText(firstText);

    return Array.from(candidates);
}

function escapeSoqlLiteral(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeSoqlLikeLiteral(value) {
    return escapeSoqlLiteral(value).replace(/%/g, '\\%').replace(/_/g, '\\_');
}


function hideFlowNames() {
    document.querySelectorAll('.sfarc-flow-badge').forEach(badge => badge.remove());
    document.querySelectorAll('[data-sfarc-flow-exposed]').forEach(el => {
        el.style.outline = '';
        delete el.dataset.sfiFlowExposed;
    });
}


async function openLwcInEditor(tagName) {
    var name = tagName;
    if (name.startsWith('c-')) name = name.substring(2);
    else if (name.startsWith('lightning-')) name = name.substring(10);

    var bundleName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');

    try {
        // Ensure sfApi session is initialized before any queries
        if (window.sfApi) {
            await window.sfApi.init();
        }

        // Save current session to storage for the editor to use
        if (window.sfApi && window.sfApi.sessionId) {
            await chrome.storage.session.set({
                sessionInfo: {
                    sessionId: window.sfApi.sessionId,
                    instanceUrl: (window.sfApi.instanceUrl || '').replace(/\.my\.my\.salesforce\.com$/, '.my.salesforce.com'),
                    timestamp: Date.now()
                }
            });
        }

        if (!window.sfApi || !window.sfApi.sessionId) {
            // Session unavailable — open editor anyway; it will prompt login internally
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'code-editor',
                params: { bundleName: bundleName, type: 'lwc' }
            });
            return;
        }

        // Fetch Bundle ID via Tooling API
        var query = `SELECT Id FROM LightningComponentBundle WHERE DeveloperName = '${bundleName}'`;
        var result = await window.sfApi.query(query, true);

        if (result.records && result.records.length > 0) {
            var bundleId = result.records[0].Id;
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'code-editor',
                params: { bundleId: bundleId, bundleName: bundleName, type: 'lwc' }
            });
        } else {
            // Bundle not found — open editor anyway so user lands on editor home
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'code-editor',
                params: { bundleName: bundleName, type: 'lwc' }
            });
        }
    } catch (e) {
        console.error('Error opening LWC in editor:', e);
        // Always open the editor even on error
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'code-editor',
            params: { bundleName: bundleName, type: 'lwc' }
        });
    }
}

// Settings UI Helpers
// Settings UI Helpers
function openSettings() {
    // Instead of using an iframe (which gets blocked by Chrome), open settings in a new tab
    chrome.runtime.sendMessage({
        action: 'openExtensionPage',
        page: 'settings'
    });
}

function openAutomationCascade() {
    chrome.runtime.sendMessage({
        action: 'openExtensionPage',
        page: 'automation-cascade'
    });
}

async function loadDebugLevelsDropdown() {
    var select = document.getElementById('sfarc-setting-debug-level');
    select.innerHTML = '<option value="">-- Loading... --</option>';

    try {
        var query = 'SELECT Id, DeveloperName FROM DebugLevel ORDER BY DeveloperName';
        var result = await window.sfApi.query(query, true);

        select.innerHTML = '<option value="">-- Select Default --</option>';

        if (result.records) {
            result.records.forEach(level => {
                var option = document.createElement('option');
                option.value = level.Id;
                option.textContent = level.DeveloperName;
                if (level.Id === settings.defaultDebugLevelId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Error loading debug levels for settings:', e);
        select.innerHTML = '<option value="">Error loading levels</option>';
    }
}

function closeSettings() {
    var modal = document.getElementById('sfarc-settings-modal');
    if (modal) {
        modal.classList.add('sfarc-hidden');
    }
}

function updatePositionButtons() {
    // Icon Position Buttons
    document.querySelectorAll('#sfarc-icon-pos-controls button').forEach(btn => {
        if (btn.dataset.pos === settings.iconPosition) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Panel Position Buttons
    document.querySelectorAll('#sfarc-panel-pos-controls button').forEach(btn => {
        if (btn.dataset.pos === settings.panelPosition) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// --- Creation Handlers ---

function initCreationMenu() {
    // Dropdown removed, but keeping function stub if called elsewhere or for future use
    var orgBtn = document.getElementById('sfarc-org-btn');
    if (orgBtn) {
        orgBtn.addEventListener('click', () => {
            loadTabContent('org');
            // Update active tab UI manually since it's not a tab button
            document.querySelectorAll('.sfarc-tab').forEach(t => t.classList.remove('active'));
        });
    }

    var bulkFieldBtn = document.getElementById('sfarc-bulk-field-btn');
    if (bulkFieldBtn) {
        bulkFieldBtn.addEventListener('click', () => {
            loadTabContent('bulk-field');
            document.querySelectorAll('.sfarc-tab').forEach(t => t.classList.remove('active'));
        });
    }
}

// LWC Creation
function openCreateLwcModal() {
    var modal = document.getElementById('sfarc-create-lwc-modal');
    modal.style.display = 'flex';
    document.getElementById('sfarc-lwc-name').focus();

    // Auto-fill label
    document.getElementById('sfarc-lwc-name').addEventListener('input', (e) => {
        var labelInput = document.getElementById('sfarc-lwc-label');
        if (!labelInput.value || labelInput.value === e.target.value.slice(0, -1)) {
            labelInput.value = e.target.value;
        }
    });

    document.getElementById('sfarc-create-lwc-confirm').onclick = handleCreateLWC;
}

async function handleCreateLWC() {
    var name = document.getElementById('sfarc-lwc-name').value.trim();
    var label = document.getElementById('sfarc-lwc-label').value.trim();
    var desc = document.getElementById('sfarc-lwc-desc').value.trim();
    var apiVersion = document.getElementById('sfarc-lwc-api-version').value;
    var isExposed = document.getElementById('sfarc-lwc-exposed').checked;
    var includeSvg = document.getElementById('sfarc-lwc-svg')?.checked;

    var targets = Array.from(document.querySelectorAll('.sfarc-lwc-target:checked')).map(cb => cb.value);

    if (!name) {
        toast.info('Name is required');
        return;
    }

    var btn = document.getElementById('sfarc-create-lwc-confirm');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        // 1. Create Bundle
        var metadata = {
            apiVersion: parseFloat(apiVersion),
            isExposed: isExposed,
            masterLabel: label || name,
            description: desc
        };

        if (targets.length > 0) {
            metadata.targets = { target: targets };
        }

        var bundleRes = await window.sfApi.create('LightningComponentBundle', {
            FullName: name,
            Metadata: metadata
        }, true); // Use Tooling API

        if (!bundleRes.success) {
            throw new Error(bundleRes.errors[0]?.message || 'Failed to create bundle');
        }

        var bundleId = bundleRes.id;

        // 2. Create Resources
        var createResource = async (fileName, source, format) => {
            await window.sfApi.create('LightningComponentResource', {
                LightningComponentBundleId: bundleId,
                FilePath: `lwc/${name}/${fileName}`,
                Source: source,
                Format: format
            }, true);
        };

        var promises = [];
        // JS
        promises.push(createResource(`${name}.js`, `import { LightningElement } from 'lwc';\n\nexport default class ${name} extends LightningElement {}`, 'js'));
        // HTML
        promises.push(createResource(`${name}.html`, `<template>\n    <p>Hello ${name}!</p>\n</template>`, 'html'));
        // CSS
        promises.push(createResource(`${name}.css`, `:host {\n    display: block;\n}`, 'css'));
        // XML metadata
        var targetXml = targets.map(target => `        <target>${target}</target>`).join('\n');
        var targetConfigXml = targetXml ? `\n    <targets>\n${targetXml}\n    </targets>` : '';
        promises.push(createResource(`${name}.js-meta.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>${parseFloat(apiVersion)}</apiVersion>\n    <isExposed>${isExposed}</isExposed>${targetConfigXml}\n</LightningComponentBundle>`, 'xml'));
        // SVG
        if (includeSvg) promises.push(createResource(`${name}.svg`, `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n        <path d="M120,120 L0,120 L0,0 L120,0 L120,120 Z" fill="#FFFFFF"></path>\n    </g>\n</svg>`, 'svg'));

        await Promise.all(promises);

        toast.success(`LWC "${name}" created successfully!`);
        document.getElementById('sfarc-create-lwc-modal').style.display = 'none';

        // Open in editor
        openLwcInEditor(bundleId, name);

    } catch (e) {
        console.error('Create LWC Error:', e);
        toast.error('Error creating LWC: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create';
    }
}

// Apex Creation
function openCreateApexModal() {
    var modal = document.getElementById('sfarc-create-apex-modal');
    modal.style.display = 'flex';
    document.getElementById('sfarc-apex-name').focus();
    document.getElementById('sfarc-create-apex-confirm').onclick = handleCreateApex;
}

async function handleCreateApex() {
    var name = document.getElementById('sfarc-apex-name').value.trim();
    var apiVersion = document.getElementById('sfarc-apex-api-version').value;

    if (!name) {
        toast.info('Name is required');
        return;
    }

    var btn = document.getElementById('sfarc-create-apex-confirm');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        var body = `public class ${name} {\n    public ${name}() {\n\n    }\n}`;

        var res = await window.sfApi.create('ApexClass', {
            Name: name,
            Body: body
        }, true);

        if (!res.success) {
            throw new Error(res.errors[0]?.message || 'Failed to create Apex Class');
        }

        toast.success(`Apex Class "${name}" created successfully!`);
        document.getElementById('sfarc-create-apex-modal').style.display = 'none';

        // Open in editor (reuse existing function if available, or just open editor)
        // For now, just open editor with this file
        chrome.runtime.sendMessage({
            action: 'openExtensionPage',
            page: 'editor',
            params: { fileId: res.id, fileName: name, fileType: 'ApexClass' }
        });

    } catch (e) {
        console.error('Create Apex Error:', e);
        toast.error('Error creating Apex Class: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create';
    }
}

// Initialize Header Buttons
injectHeaderButtons();

// --- Split View Implementation ---

function renderSplitView(items, tabType) {
    var suggestionsParams = document.getElementById('sfarc-suggestions');
    suggestionsParams.innerHTML = '';

    // Inject Split Structure
    var splitContainer = document.createElement('div');
    splitContainer.className = 'sfarc-split-view';

    // Left Pane
    var leftPane = document.createElement('div');
    leftPane.className = 'sfarc-split-left';


    // Local Search
    var searchContainer = document.createElement('div');
    searchContainer.className = 'sfarc-local-search-container';
    searchContainer.innerHTML = `
        <div class="sfarc-debug-search-wrapper" style="width: 100%; position: relative;">
            <input type="text" class="sfarc-debug-search-input sfarc-local-search-input" placeholder="Search ${tabType}..." style="padding-left: 16px; padding-right: 36px; border-radius: 4px; width: 100%;">
            <span class="sfarc-debug-search-icon" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #999;">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke-width="1.5"/><path d="M14 14L10.5 10.5" stroke-width="1.5"/></svg>
            </span>
        </div>
    `;


    var listContainer = document.createElement('div');
    listContainer.className = 'sfarc-split-list';
    listContainer.id = 'sfarc-split-list-container';

    // Hide local search as we use global search now
    searchContainer.style.display = 'none';

    leftPane.appendChild(searchContainer);
    leftPane.appendChild(listContainer);

    // Right Pane
    var rightPane = document.createElement('div');
    rightPane.className = 'sfarc-split-right';
    rightPane.id = 'sfarc-split-detail-container';

    // Initial Right Pane Content
    if (tabType === 'shortcuts') {
        renderRecentShortcuts(rightPane);
    } else if (tabType === 'users') {
        rightPane.innerHTML = `
            <div class="sfarc-split-empty">
                <div class="sfarc-split-empty-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div class="sfarc-split-empty-title">Select a user</div>
                <div class="sfarc-split-empty-sub">Search above or pick a user from the list to view profile, permissions and quick actions.</div>
            </div>
        `;
    } else if (tabType === 'objects') {
        rightPane.innerHTML = `
            <div class="sfarc-split-empty">
                <div class="sfarc-split-empty-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
                <div class="sfarc-split-empty-title">Select an object</div>
                <div class="sfarc-split-empty-sub">Pick an object from the list to view fields, layouts, flows and more.</div>
            </div>
        `;
    } else {
        rightPane.innerHTML = '<div class="sfarc-detail-placeholder">Select an item to view details</div>';
    }


    splitContainer.appendChild(leftPane);
    splitContainer.appendChild(rightPane);
    suggestionsParams.appendChild(splitContainer);

    // Smart Filters will be handled by the global search bar popup
    // Add Toggle for Objects Tab
    if (tabType === 'objects') {
        var toggleBar = document.createElement('div');
        toggleBar.className = 'sfarc-tab-toggle-bar';
        toggleBar.innerHTML = `
            <button class="sfarc-toggle-btn active" data-filter="all">All</button>
            <button class="sfarc-toggle-btn" data-filter="standard">Standard</button>
            <button class="sfarc-toggle-btn" data-filter="custom">Custom</button>
        `;
        leftPane.insertBefore(toggleBar, listContainer);

        toggleBar.querySelectorAll('.sfarc-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleBar.querySelectorAll('.sfarc-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                performSearch(input.value.trim().toLowerCase());
            });
        });
    }

    // Render Initial List
    renderSplitList(items, tabType, listContainer);

    // Search Listener
    var input = searchContainer.querySelector('input');

    var performSearch = async (query) => {
        // If users tab and (query or filters) exist, do server-side search
        if (tabType === 'users') {
            var hasFilters = window.sfarcSmartFilters && window.sfarcSmartFilters.length > 0;
            if (query.length >= 2 || hasFilters) {
                listContainer.innerHTML = '<div class="sfarc-loading" style="padding: 20px;">' + getLoaderHtml() + '</div>';
                try {
                    var where = [];
                    if (query) where.push(`(Name LIKE '%${query}%' OR Username LIKE '%${query}%')`);

                    if (hasFilters) {
                        var filterClause = window.sfarcSmartFilters.map((f, i) => {
                            // Ensure we have a value — fall back to 'true' for booleans with empty value
                            var rawVal = (f.value !== undefined && f.value !== '') ? f.value : (f.type === 'boolean' ? 'true' : f.value);
                            var valStr = rawVal;
                            if (f.operator === 'LIKE') {
                                valStr = `'%${rawVal}%'`;
                            } else if (f.type !== 'boolean' && f.type !== 'int' && f.type !== 'double') {
                                valStr = `'${rawVal}'`;
                            }
                            var prefix = i === 0 ? '' : ` ${f.logicType || 'AND'} `;
                            return `${prefix}${f.field} ${f.operator} ${valStr}`;
                        }).join('');
                        where.push(`(${filterClause})`);
                    }

                    var soql = `SELECT Id, Name, Username, Email, Profile.Name, Profile.UserLicense.Name, UserRole.Name, IsActive, SmallPhotoUrl FROM User`;
                    if (where.length > 0) soql += ` WHERE ${where.join(' AND ')}`;
                    soql += ` LIMIT 50`;

                    var result = await window.sfApi.query(soql);
                    renderSplitList(result.records, tabType, listContainer);
                } catch (e) {
                    listContainer.innerHTML = `
                        <div style="margin: 16px; padding: 16px; background-color: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.2); border-radius: 8px; display: flex; align-items: flex-start; gap: 12px;">
                            <i class="fa-solid fa-circle-exclamation" style="color: #dc2626; font-size: 16px; margin-top: 2px; flex-shrink: 0;"></i>
                            <div style="flex: 1; min-width: 0;">
                                <div style="color: #dc2626; font-weight: 500; font-size: 13px; margin-bottom: 4px;">Search Error</div>
                                <div style="color: var(--sfarc-text-primary, #dc2626); font-size: 12px; line-height: 1.5; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${e.message}</div>
                            </div>
                        </div>
                    `;
                }
                return;
            }
        }

        // Default: Local filter
        var filtered = items;

        if (tabType === 'objects') {
            var activeFilter = document.querySelector('.sfarc-toggle-btn.active')?.dataset.filter;
            if (activeFilter === 'standard') {
                filtered = items.filter(item => !item.custom);
            } else if (activeFilter === 'custom') {
                filtered = items.filter(item => item.custom);
            }
        }

        if (query) {
            filtered = items.filter(item => {
                if (tabType === 'objects') return (item.label || item.name).toLowerCase().includes(query) || (item.name || '').toLowerCase().includes(query);
                if (tabType === 'users') return (item.Name || item.Username).toLowerCase().includes(query);
                if (tabType === 'shortcuts') return (item.label || '').toLowerCase().includes(query) || (item.category || '').toLowerCase().includes(query);
                if (tabType === 'flows') return (item.FlowVersionView?.Label || '').toLowerCase().includes(query) || (item.InterviewStatus || '').toLowerCase().includes(query);
                return false;
            });
        }
        renderSplitList(filtered, tabType, listContainer);
    };

    // Export for Global Search
    window.executeSplitViewSearch = performSearch;

    input.addEventListener('input', debounce((e) => {
        var query = e.target.value.trim().toLowerCase(); // Trim to avoid searching on just spaces
        performSearch(query);
    }, 300));

    // Aggressively stop propagation to prevent Salesforce internal scripts from crashing
    // when they try to handle events from our "foreign" input element.
    var stopProp = (e) => e.stopPropagation();
    ['keydown', 'keyup', 'keypress', 'focus', 'blur', 'click', 'mousedown', 'mouseup'].forEach(evt => {
        input.addEventListener(evt, stopProp);
    });

    // For 'input', we need our own handler, but we also want to stop bubbling.
    // The previous listener was anonymous, so we can't remove it easily if we wanted to replace it,
    // but we can just add stopPropagation INSIDE the existing handler logic if we could edit it better,
    // OR just add a separate capturing listener or just rely on the fact that input bubbles.
    // Actually, let's just add a separate listener for stopPropagation.
    input.addEventListener('input', stopProp); // This runs in addition to the search handler

    input.addEventListener('focusin', stopProp); // Explicit focusin as well

    // Delay focus to avoid race conditions and ensure event handlers are ready
    setTimeout(() => {
        if (document.body.contains(input)) {
            input.focus();
        }
    }, 50);
}


// --- Favorites State Management ---
var userFavorites = [];

// Load favorites from storage
function loadFavorites() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfiFavorites'], (result) => {
            if (result.sfiFavorites) {
                userFavorites = result.sfiFavorites;
                // re-render if visible
            }
        });
    }
}
loadFavorites();

function toggleFavorite(item) {
    var validFavorites = userFavorites.filter(f => searchCache.shortcuts.find(s => s.label === f.label)); // Filter outdated
    var exists = validFavorites.find(f => f.label === item.label);

    if (exists) {
        userFavorites = userFavorites.filter(f => f.label !== item.label);
    } else {
        if (validFavorites.length >= 12) {
            toast.info('You can only add up to 12 favorites.');
            return false;
        }
        userFavorites.push({
            label: item.label,
            url: item.url,
            icon: item.label.charAt(0), // Fallback initial
            color: '#2196F3' // Default color
        });
    }

    // Save
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 'sfiFavorites': userFavorites });
    }


    // Refresh UI
    var shortcutsTab = document.querySelector('[data-tab="shortcuts"]');
    if (shortcutsTab && shortcutsTab.classList.contains('active')) {
        var detailContainer = document.getElementById('sfarc-split-detail-container');
        if (detailContainer) {
            renderRecentShortcuts(detailContainer);
        }
    }
    return true;
}


// SVG Icons
var Icons = {
    Pin: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"></path></svg>', // Using tag icon as pin for now or similar
    PinFilled: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"></path></svg>',
    Star: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    Generic: '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
    Code: '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9H2M14 17.5L16.5 15L14 12.5M10 12.5L7.5 15L10 17.5M2 7.8L2 16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27977 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3L6.8 3C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8Z"></path></svg>',
    Settings: '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    BlueTick: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#3b82f6" style="flex-shrink: 0;" ><circle cx="12" cy="12" r="12"></circle><path d="M10 15.5l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4L10 15.5z" fill="#ffffff"></path></svg>'
};


function renderSplitList(items, tabType, container) {
    // 1. Clean up any existing scroll event handler to prevent multiple bindings and memory leaks
    if (container._sfiScrollHandler) {
        container.removeEventListener('scroll', container._sfiScrollHandler);
        container._sfiScrollHandler = null;
    }

    container.innerHTML = '';
    container.scrollTop = 0; // Reset scroll position for search/tab switches

    if (!items || items.length === 0) {
        container.innerHTML = getEmptyStateHtml('No results found');
        return;
    }

    // Sort shortcuts by category for grouping
    if (tabType === 'shortcuts') {
        items.sort((a, b) => (a.category || 'General').localeCompare(b.category || 'General'));
    }

    var CHUNK_SIZE = 40;
    var currentIndex = 0;
    var lastCategory = null;

    // Generator-style chunk renderer
    function renderNextChunk() {
        if (currentIndex >= items.length) {
            // All items rendered; clean up scroll handler as it is no longer needed
            if (container._sfiScrollHandler) {
                container.removeEventListener('scroll', container._sfiScrollHandler);
                container._sfiScrollHandler = null;
            }
            return;
        }

        var limit = Math.min(currentIndex + CHUNK_SIZE, items.length);
        var fragment = document.createDocumentFragment();

        for (let i = currentIndex; i < limit; i++) {
            const item = items[i];

            // Handle Category Grouping
            var currentCategory = null;
            if (tabType === 'shortcuts') {
                currentCategory = item.category || 'General';
            } else if (tabType === 'objects') {
                currentCategory = item.custom ? 'Custom Objects' : 'Standard Objects';
            }

            if (currentCategory && currentCategory !== lastCategory) {
                var header = document.createElement('div');
                header.className = 'sfarc-category-header';
                header.textContent = currentCategory;
                fragment.appendChild(header);
                lastCategory = currentCategory;
            }

            var row = document.createElement('div');
            row.className = 'sfarc-suggestion-item';
            row.style.position = 'relative';

            // Tab-specific contents
            var content = '';
            if (tabType === 'objects') {
                var prefix = item.keyPrefix || '---';
                var badges = [];
                if (item.custom) badges.push('<span class="sfarc-badge custom" >C</span>');
                if (item.customSetting) badges.push('<span class="sfarc-badge setting" >S</span>');
                if (!item.queryable) badges.push('<span class="sfarc-badge locked" >LQ</span>');

                content = `
                    <div class="sfarc-obj-row">
                        <div class="sfarc-obj-prefix" >${prefix}</div>
                        <div class="sfarc-obj-info">
                            <div class="sfarc-suggestion-main">${escapeHtml(item.label)}</div>
                            <div class="sfarc-suggestion-sub">${escapeHtml(item.name)}</div>
                        </div>
                        <div class="sfarc-obj-badges">${badges.join('')}</div>
                    </div>
                `;
            } else if (tabType === 'users') {
                row.title = item.Username || '';
                var isActive = item.IsActive !== false; // default to true if undefined
                content = `
                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                        <span class="sfarc-user-status-dot ${isActive ? 'active' : 'inactive'}" title="${isActive ? 'Active' : 'Inactive'}"></span>
                        <div class="sfarc-suggestion-main">${escapeHtml(item.Name)}</div>
                    </div>
                `;
            } else if (tabType === 'shortcuts') {
                var isFav = userFavorites.some(f => f.label === item.label);
                content = `
                    <div class="sfarc-suggestion-main" style="display: flex; align-items: center; gap: 6px;">
                        ${escapeHtml(item.label)}
                        ${item.liveQuery ? Icons.BlueTick : ''}
                    </div>
                    <div class="sfarc-open-btn"  style="position: absolute; right: 40px; top: 50%; transform: translateY(-50%); color: #bbb; cursor: pointer; padding: 4px; border-radius: 50%;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    </div>
                    <div class="sfarc-pin-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">
                       ${Icons.Star}
                    </div>
                `;
            } else if (tabType === 'flows') {
                content = `
                    <div class="sfarc-suggestion-main">${escapeHtml(item.FlowVersionView?.Label || 'Unknown Flow')}</div>
                    <div class="sfarc-suggestion-sub">${escapeHtml(item.InterviewStatus)}</div>
                `;
            }

            row.innerHTML = content;

            // Row-specific event handlers
            if (tabType === 'shortcuts') {
                var pinBtn = row.querySelector('.sfarc-pin-btn');
                if (pinBtn) {
                    pinBtn.onclick = (e) => {
                        e.stopPropagation();
                        var added = toggleFavorite(item);
                        if (added !== false) {
                            var isNowFav = userFavorites.some(f => f.label === item.label);
                            pinBtn.classList.toggle('active', isNowFav);
                            pinBtn.title = isNowFav ? 'Remove from Favorites' : 'Add to Favorites';
                        }
                    };
                }

                var openBtn = row.querySelector('.sfarc-open-btn');
                if (openBtn) {
                    openBtn.onclick = (e) => {
                        e.stopPropagation();
                        addToRecents(item);
                        if (item.url.startsWith('sfi:')) {
                            var feature = item.url.replace('sfi:', '');
                            var params = (feature === 'data-export') ? (() => { const q = buildSmartQuery(); return q ? { query: q } : undefined; })() : undefined;
                            openInNewTab(feature, params);
                        } else {
                            window.open(`${window.sfApi.instanceUrl}${item.url}`, '_blank');
                        }
                    };
                    openBtn.onmouseover = () => openBtn.style.color = 'var(--sfarc-accent, var(--sfarc-accent, #2196f3))';
                    openBtn.onmouseout = () => openBtn.style.color = '#bbb';
                }
            }

            row.addEventListener('click', () => {
                container.querySelectorAll('.sfarc-suggestion-item').forEach(el => el.classList.remove('selected'));
                row.classList.add('selected');

                if (tabType === 'shortcuts') {
                    addToRecents(item);
                    if (item.liveQuery) {
                        renderSplitDetails(item, 'shortcuts-live');
                    } else if (item.url.startsWith('sfi:')) {
                        var feature = item.url.replace('sfi:', '');
                        var params = (feature === 'data-export') ? (() => { const q = buildSmartQuery(); return q ? { query: q } : undefined; })() : undefined;
                        openInNewTab(feature, params);
                    } else {
                        window.open(`${window.sfApi.instanceUrl}${item.url}`, '_blank');
                    }
                } else {
                    if (tabType === 'users') {
                        addToUserRecents(item);
                    }
                    renderSplitDetails(item, tabType);
                }
            });

            fragment.appendChild(row);
        }

        container.appendChild(fragment);
        currentIndex = limit;
    }

    // Load initial chunk
    renderNextChunk();

    // Setup Infinite Scrolling event listener
    var scrollHandler = () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            renderNextChunk();
        }
    };
    container.addEventListener('scroll', scrollHandler);
    container._sfiScrollHandler = scrollHandler;
}

function renderSplitDetails(item, tabType) {
    var container = document.getElementById('sfarc-split-detail-container');
    container.innerHTML = ''; // Clear

    // Defensive: a stray user/object card must never linger as a sibling of the
    // wrapper (an older build could leave one directly in the split pane). The
    // card only ever belongs inside the padded wrapper rendered below.
    if (container.parentElement) {
        container.parentElement.querySelectorAll(':scope > .sfarc-user-card-header').forEach(el => el.remove());
    }

    // Reset styles (important for switching between tabs)
    container.style.overflowY = '';
    container.style.padding = '';

    var wrapper = document.createElement('div');
    if (tabType === 'objects' || tabType === 'users') {
        container.style.padding = '0';
        wrapper.style.padding = '0';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
    } else {
        wrapper.style.padding = '20px';
    }

    if (tabType === 'objects') {
        wrapper.innerHTML = `
            <h2>${escapeHtml(item.label)} (${escapeHtml(item.name)})</h2>
            <div class="sfarc-pill">${item.custom ? 'Custom' : 'Standard'}</div>
            <pre style="margin-top:20px; background:#f5f5f5; padding:10px; border-radius:4px; overflow:auto; max-height:400px;">${JSON.stringify(item, null, 2)}</pre>
            <div style="margin-top:20px;" id="sfarc-detail-actions"></div>
        `;

        var btn = document.createElement('button');
        btn.className = 'sfarc-btn sfarc-btn-primary';
        btn.textContent = 'View in Salesforce';
        btn.onclick = () => {
            window.open(`${window.sfApi.instanceUrl}/${item.name}`, '_blank');
        };
        wrapper.querySelector('#sfarc-detail-actions').appendChild(btn);

        addToObjectRecents(item);

        var arrowIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;




        // Helper for Meta Row
        var metaRow = (label, value) => `
            <div class="sfarc-user-meta-row">
                <span class="sfarc-user-meta-label">${label} :</span>
                <span class="sfarc-user-meta-value">${escapeHtml(String(value || '-'))}</span>
            </div>
        `;

        wrapper.innerHTML = `

            <div class="sfarc-user-card-header">
                <div class="sfarc-user-card-title">${escapeHtml(item.label)}</div>
                ${metaRow('API Name', item.name)}
                ${metaRow('Label', item.label)}
                ${metaRow('Key Prefix', item.keyPrefix)}
                ${metaRow('Is Custom', item.custom)}
                
                <button class="sfarc-user-arrow-btn"  id="sfarc-obj-setup-btn">
                    ${arrowIcon}
                </button>

                <div class="sfarc-user-action-grid">
                    <button class="sfarc-user-action-btn" id="sfarc-btn-fields"><i class="fa-solid fa-list"></i> FIELDS</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-layouts"><i class="fa-solid fa-layer-group"></i> PAGE LAYOUTS</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-flows"><i class="fa-solid fa-sitemap"></i> FLOWS</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-triggers"><i class="fa-solid fa-bolt"></i> TRIGGERS</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-records"><i class="fa-solid fa-table"></i> RECORDS</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-validation"><i class="fa-solid fa-check-double"></i> VALIDATION RULES</button>
                </div>
            </div>
        `;



        // --- Action Handlers ---

        var openObjectManager = (section) => {
            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${item.name}/${section}/view`, '_blank');
        };

        // Go To Setup (Arrow)
        wrapper.querySelector('#sfarc-obj-setup-btn').onclick = () => openObjectManager('Details');

        // Fields
        wrapper.querySelector('#sfarc-btn-fields').onclick = () => openObjectManager('FieldsAndRelationships');

        // Page Layouts
        wrapper.querySelector('#sfarc-btn-layouts').onclick = () => openObjectManager('PageLayouts');

        // Flows (Global Flow Home)
        wrapper.querySelector('#sfarc-btn-flows').onclick = () => {
            window.open(`${window.sfApi.instanceUrl}/lightning/setup/Flows/home`, '_blank');
        };

        // Triggers
        wrapper.querySelector('#sfarc-btn-triggers').onclick = () => openObjectManager('Triggers');

        // Records (List View)
        wrapper.querySelector('#sfarc-btn-records').onclick = () => {
            window.open(`${window.sfApi.instanceUrl}/lightning/o/${item.name}/list`, '_blank');
        };


        // Validation Rules
        wrapper.querySelector('#sfarc-btn-validation').onclick = () => openObjectManager('ValidationRules');

        // Export Data (Local)
        var exportBtn = document.createElement('button');
        exportBtn.className = 'sfarc-user-action-btn';
        exportBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> EXPORT DATA';
        exportBtn.onclick = () => {
            // Pre-fill query: SELECT Id, Name FROM [Object] LIMIT 50
            var query = `SELECT Id, Name, CreatedDate FROM ${item.name} ORDER BY CreatedDate DESC LIMIT 50`;
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'data-export',
                params: { query }
            });
        };
        wrapper.querySelector('.sfarc-user-action-grid').appendChild(exportBtn);
    } else if (tabType === 'shortcuts-live') {
        // Sticky Header Mode
        container.style.overflowY = 'hidden';
        container.style.padding = '0';
        wrapper.style.padding = '0';
        wrapper.style.height = '100%';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';

        var headerTitle = item.label || 'Details';

        wrapper.innerHTML = `
            <div style="display: none;">
                <input type="text" id="sfarc-live-search" value="">
            </div>
            <div id="sfarc-live-content" style="flex: 1; min-height: 0; padding: 0 !important; margin-top: 0 !important; display: flex; flex-direction: column; overflow-y: auto;">
                <div class="sfarc-loading">Fetching live data...</div>
            </div>
        `;

        // Fetch Data
        window.sfApi.query(item.liveQuery, item.useToolingApi || false)
            .then(result => {
                var contentDiv = wrapper.querySelector('#sfarc-live-content');
                var searchInput = wrapper.querySelector('#sfarc-live-search');
                var allRecords = result.records;

                // Initial Render
                renderLiveShortcutsTable(allRecords, contentDiv, item);

                // Search Listener
                searchInput.addEventListener('input', (e) => {
                    var term = e.target.value.toLowerCase();
                    var filtered = allRecords.filter(rec => {
                        return Object.values(rec).some(val =>
                            String(val).toLowerCase().includes(term)
                        );
                    });
                    renderLiveShortcutsTable(filtered, contentDiv, item);
                });
            })
            .catch(err => {
                var contentDiv = wrapper.querySelector('#sfarc-live-content');
                var errorMsg = err.message;
                if (errorMsg.includes("sObject type 'SandboxInfo' is not supported")) {
                    errorMsg = "Sandbox data is not available here. You can only view Sandboxes when logged into a Production Org (Enterprise, Unlimited, etc.).";
                }
                contentDiv.innerHTML = friendlyFetchError(err, null);
            });

    } else if (tabType === 'users') {
        wrapper.style.padding = '12px 16px 5px 16px';
        addToUserRecents(item); // Add to recents when user details are viewed
        var arrowIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;
        var chevronIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        // Helper for Meta Row
        var metaRow = (label, value) => `
            <div class="sfarc-user-meta-row">
                <span class="sfarc-user-meta-label">${label} :</span>
                <span class="sfarc-user-meta-value">${escapeHtml(value || '-')}</span>
            </div>
        `;

        var isActive = !!item.IsActive;
        var initials = (item.Name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

        wrapper.innerHTML = `

            <div class="sfarc-user-card-header">
                <div class="sfarc-user-card-head">
                    <div class="sfarc-user-avatar" aria-hidden="true">${escapeHtml(initials || '?')}</div>
                    <div class="sfarc-user-head-main">
                        <div class="sfarc-user-card-title">${escapeHtml(item.Name)}</div>
                        <div class="sfarc-user-card-sub">User Details
                            <span class="sfarc-user-status-badge ${isActive ? 'is-active' : 'is-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <button class="sfarc-user-arrow-btn"  id="sfarc-user-open-btn">
                        ${arrowIcon}
                    </button>
                </div>

                <div class="sfarc-user-meta-list">
                    ${metaRow('Username', item.Username)}
                    ${metaRow('Email', item.Email)}
                    ${metaRow('Profile', item.Profile?.Name)}
                    ${metaRow('Role', item.UserRole?.Name)}
                    ${metaRow('License', item.Profile?.UserLicense?.Name)}
                </div>

                <div class="sfarc-user-action-grid">
                    <div class="sfarc-dropdown-container">
                        <button class="sfarc-user-action-btn sfarc-dropdown-trigger" id="sfarc-btn-debug-trigger">
                            <i class="fa-solid fa-bug"></i> ENABLE DEBUG LOGS
                        </button>
                        <div class="sfarc-dropdown-menu" id="sfarc-btn-debug-menu" style="bottom: 100%; top: auto; margin-top: 0; margin-bottom: 8px;">
                            <div class="sfarc-dropdown-item" data-value="SFDC_DevConsole">SFDC_DevConsole</div>
                            <div class="sfarc-dropdown-item" data-value="FINEST">FINEST (All)</div>
                            <div class="sfarc-dropdown-item" data-value="DEBUGONLY">DEBUG ONLY</div>
                        </div>
                    </div>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-summary"><i class="fa-solid fa-chart-column"></i> VIEW SUMMARY</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-login"><i class="fa-solid fa-user-check"></i> LOGIN AS USER</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-login-incognito"><i class="fa-solid fa-user-secret"></i> LOGIN IN INCOGNITO</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-reset"><i class="fa-solid fa-key"></i> RESET PASSWORD</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-ps"><i class="fa-solid fa-shield-halved"></i> PS ASSIGN</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-psg"><i class="fa-solid fa-users-gear"></i> PSG ASSIGN</button>
                    <button class="sfarc-user-action-btn" id="sfarc-btn-sharing"><i class="fa-solid fa-share-nodes"></i> SHARING</button>
                </div>
            </div>

        `;









        // --- Action Handlers ---

        // Open Record in Setup
        wrapper.querySelector('#sfarc-user-open-btn').onclick = () => {
            // Open user in Salesforce Setup (ManageUsers page)
            var setupUrl = `${window.sfApi.instanceUrl}/lightning/setup/ManageUsers/page?address=%2F${item.Id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`;
            window.open(setupUrl, '_blank');
        };

        // Enable Debug Logs (Custom Dropdown)
        var debugTrigger = wrapper.querySelector('#sfarc-btn-debug-trigger');
        var debugMenu = wrapper.querySelector('#sfarc-btn-debug-menu');

        if (debugTrigger && debugMenu) {
            debugTrigger.onclick = (e) => {
                e.stopPropagation();
                debugMenu.classList.toggle('active');
            };

            document.addEventListener('click', () => {
                debugMenu.classList.remove('active');
            });

            debugMenu.querySelectorAll('.sfarc-dropdown-item').forEach(itemBtn => {
                itemBtn.onclick = async (e) => {
                    e.stopPropagation();
                    var selectedLevel = itemBtn.dataset.value;
                    debugMenu.classList.remove('active');

                    var originalHTML = debugTrigger.innerHTML;
                    debugTrigger.disabled = true;
                    debugTrigger.innerHTML = `<span class="comet-loader-inline"></span> ENABLING...`;

                    try {
                        // Create TraceFlag
                        // 1. Get DebugLevel
                        var debugLevelQuery = `SELECT Id FROM DebugLevel WHERE DeveloperName = '${selectedLevel}' LIMIT 1`;
                        var dbRes = await window.sfApi.query(debugLevelQuery, true);

                        // Fallback to SFDC_DevConsole if specific one not found
                        if ((!dbRes.records || dbRes.records.length === 0) && selectedLevel !== 'SFDC_DevConsole') {
                            dbRes = await window.sfApi.query("SELECT Id FROM DebugLevel WHERE DeveloperName = 'SFDC_DevConsole' LIMIT 1", true);
                        }

                        if (!dbRes.records || dbRes.records.length === 0) throw new Error('Debug Level not found');

                        var debugLevelId = dbRes.records[0].Id;
                        var userId = item.Id; // TracedEntityId

                        // Expiry: 30 mins
                        var expiry = new Date(Date.now() + 30 * 60000).toISOString();

                        // Create TraceFlag
                        await window.sfApi.create('TraceFlag', {
                            DebugLevelId: debugLevelId,
                            TracedEntityId: userId,
                            LogType: 'USER_DEBUG',
                            StartDate: new Date().toISOString(),
                            ExpirationDate: expiry
                        }, true);

                        debugTrigger.innerHTML = `✅ ENABLED (${selectedLevel})`;

                        setTimeout(() => {
                            debugTrigger.innerHTML = originalHTML;
                            debugTrigger.disabled = false;
                        }, 3000);
                    } catch (err) {
                        console.error(err);
                        toast.error('Failed to enable logs: ' + err.message);
                        debugTrigger.innerHTML = originalHTML;
                        debugTrigger.disabled = false;
                    }
                };
            });
        }

        // View Summary (Setup Summary Page)
        wrapper.querySelector('#sfarc-btn-summary').onclick = () => {
            // Open user summary in setup
            var summaryUrl = `${window.sfApi.instanceUrl}/lightning/setup/ManageUsers/${item.Id}/summary`;
            window.open(summaryUrl, '_blank');
        };

        // Login As User
        wrapper.querySelector('#sfarc-btn-login').onclick = () => {
            if (searchCache.orgData && searchCache.orgData.orgId) {
                var loginUrl = `${window.sfApi.instanceUrl}/servlet/servlet.su?oid=${searchCache.orgData.orgId}&suorgadminid=${item.Id}&retURL=%2F&targetURL=%2F`;
                window.open(loginUrl, '_blank');
            } else {
                // Try to fetch Org ID if missing
                window.sfApi.query("SELECT Id FROM Organization LIMIT 1").then(res => {
                    if (res.records && res.records.length > 0) {
                        var orgId = res.records[0].Id;
                        // Cache it
                        if (!searchCache.orgData) searchCache.orgData = {};
                        searchCache.orgData.orgId = orgId;

                        var loginUrl = `${window.sfApi.instanceUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${item.Id}&retURL=%2F&targetURL=%2F`;
                        window.open(loginUrl, '_blank');
                    } else {
                        toast.error('Could not determine Org ID for login.');
                    }
                });
            }
        };

        // Login in Incognito
        wrapper.querySelector('#sfarc-btn-login-incognito').onclick = async () => {
            try {
                var orgId = searchCache.orgData?.orgId;
                if (!orgId) {
                    var res = await window.sfApi.query("SELECT Id FROM Organization LIMIT 1");
                    if (res.records && res.records.length > 0) {
                        orgId = res.records[0].Id;
                        if (!searchCache.orgData) searchCache.orgData = {};
                        searchCache.orgData.orgId = orgId;
                    }
                }

                if (!orgId) { toast.error('Could not determine Org ID.'); return; }

                var relativeLoginUrl = `/servlet/servlet.su?oid=${orgId}&suorgadminid=${item.Id}&retURL=%2F&targetURL=%2F`;
                var classicDomainUrl = window.sfApi.instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
                var absoluteLoginUrl = `${classicDomainUrl}${relativeLoginUrl}`;
                var sessionId = window.sfApi.sessionId;

                // Always try to fetch the Classic 'sid' cookie for frontdoor.jsp since Lightning sessions cause 302 redirects
                try {
                    if (window.sfApi && typeof window.sfApi.getCookie === 'function') {
                        var sessionCookie = await window.sfApi.getCookie('sid');
                        if (sessionCookie && sessionCookie.value) {
                            sessionId = decodeURIComponent(sessionCookie.value);
                        }
                    }
                } catch (e) { }

                if (sessionId) {
                    var decodedSessionId = decodeURIComponent(sessionId);
                    // Salesforce frontdoor.jsp requires retURL to be relative to prevent open redirects
                    var bootstrapUrl = `${classicDomainUrl}/secur/frontdoor.jsp?sid=${decodedSessionId}&retURL=${encodeURIComponent(relativeLoginUrl)}`;

                    // Copy the bootstrap URL to clipboard as a fallback for incognito
                    navigator.clipboard.writeText(bootstrapUrl).catch(err => console.log('Clipboard copy failed', err));

                    // Show a quick tooltip/toast to inform the user about the fallback
                    var btn = wrapper.querySelector('#sfarc-btn-login-incognito');
                    var originalText = btn.innerHTML;
                    btn.innerHTML = `<i class="fa-solid fa-check"></i> URL COPIED (FALLBACK)`;
                    setTimeout(() => { btn.innerHTML = originalText; }, 3000);

                    chrome.runtime.sendMessage({ action: 'openIncognito', url: bootstrapUrl });
                } else {
                    toast.info('Session ID required for Incognito login.');
                }
            } catch (e) {
                console.error('Incognito Login failed:', e);
                toast.error('Failed to initiate Incognito Login.');
            }
        };

        // Reset Password (Open in Setup)
        wrapper.querySelector('#sfarc-btn-reset').onclick = () => {
            // Open user in setup to reset password
            var setupUrl = `${window.sfApi.instanceUrl}/lightning/setup/ManageUsers/page?address=%2F${item.Id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`;
            window.open(setupUrl, '_blank');
        };

        // PS Assign (Permission Set Assignment)
        wrapper.querySelector('#sfarc-btn-ps').onclick = () => {
            // Open Permission Set assignment page in setup
            var psUrl = `${window.sfApi.instanceUrl}/lightning/setup/PermSets/page?address=%2Fudd%2FPermissionSet%2FassignPermissionSet.apexp%3FuserId%3D${item.Id}`;
            window.open(psUrl, '_blank');
        };

        // PSG Assign (Permission Set Group Assignment)
        wrapper.querySelector('#sfarc-btn-psg').onclick = () => {
            // Open Permission Set Group assignment page in setup
            var psgUrl = `${window.sfApi.instanceUrl}/lightning/setup/PermSetGroups/page?address=%2Fudd%2FPermissionSetGroup%2FassignPermissionSet.apexp%3FuserId%3D${item.Id}%26isPermsetGroup%3D1`;
            window.open(psgUrl, '_blank');
        };

        // Sharing
        wrapper.querySelector('#sfarc-btn-sharing').onclick = () => {
            window.open(`${window.sfApi.instanceUrl}/p/share/UserSharingDetail?parentId=${item.Id}`, '_blank');
        };


    } else if (tabType === 'shortcuts') {
        wrapper.innerHTML = `

            <h2>${escapeHtml(item.label)}</h2>
            <div class="sfarc-pill" style="margin-bottom:20px;">${escapeHtml(item.category || 'Shortcut')}</div>
            <div id="sfarc-detail-actions"></div>
         `;
        var btn = document.createElement('button');
        btn.className = 'sfarc-btn sfarc-btn-primary';
        btn.textContent = 'Open in New Tab';
        btn.onclick = () => {
            window.open(`${window.sfApi.instanceUrl}${item.url}`, '_blank');
        };
        wrapper.querySelector('#sfarc-detail-actions').appendChild(btn);

    } else if (tabType === 'flows') {
        wrapper.innerHTML = `
            <h2>${escapeHtml(item.FlowVersionView?.Label || 'Unknown Flow')}</h2>
            <div class="sfarc-pill ${item.InterviewStatus === 'Error' ? 'sfarc-pill-error' : 'sfarc-pill-success'}">${escapeHtml(item.InterviewStatus)}</div>
            <div style="margin-top:20px;">
                <p><strong>Created Date:</strong> ${new Date(item.CreatedDate).toLocaleString()}</p>
                <p><strong>Created By:</strong> ${escapeHtml(item.CreatedBy?.Name)}</p>
                ${item.PauseLabel ? `<p><strong>Pause Label:</strong> ${escapeHtml(item.PauseLabel)}</p>` : ''}
                <p><strong>Current Element:</strong> ${escapeHtml(item.CurrentElement || 'N/A')}</p>
            </div>
             <div style="margin-top:20px;" id="sfarc-detail-actions"></div>
         `;
        var btn = document.createElement('button');
        btn.className = 'sfarc-btn sfarc-btn-danger';
        btn.textContent = 'Delete Interview';
        btn.onclick = async () => {
            if (await toast.confirm('Are you sure you want to delete this flow interview?', {danger: true})) {
                try {
                    var result = await window.sfApi.request(window.sfApi.toolingUrl + '/sobjects/FlowInterview/' + item.Id, 'DELETE');
                    // Refresh list
                    var newItems = await fetchFlowInterviews();
                    renderSplitView(newItems, 'flows');
                } catch (e) {
                    toast.error('Error deleting flow: ' + e.message);
                }
            }
        };
        wrapper.querySelector('#sfarc-detail-actions').appendChild(btn);
    }

    container.appendChild(wrapper);
}





// --- Recents State Management (Shortcuts) ---
var recentShortcuts = [];

function loadRecents() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sfiRecents'], (result) => {
            if (result.sfiRecents) {
                recentShortcuts = result.sfiRecents;
            }
        });
    }
}
loadRecents();

function addToRecents(item) {
    // Deduplicate
    recentShortcuts = recentShortcuts.filter(r => r.label !== item.label);

    // Add to top
    recentShortcuts.unshift({
        label: item.label,
        url: item.url,
        category: item.category || 'Shortcut',
        timestamp: Date.now()
    });

    // Limit to 10
    if (recentShortcuts.length > 10) {
        recentShortcuts = recentShortcuts.slice(0, 10);
    }


    // Save
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 'sfiRecents': recentShortcuts });
    }
}

function renderRecentShortcuts(container) {
    if (!container) return;
    container.innerHTML = '';

    // Dashboard Wrapper
    var dashboard = document.createElement('div');
    dashboard.className = 'sfarc-shortcuts-dashboard';
    container.appendChild(dashboard);


    // --- Favorites Section ---
    var favSection = document.createElement('div');
    favSection.innerHTML = `<div class="sfarc-section-header">Favorites (${userFavorites.length}/12)</div><div class="sfarc-favorites-grid"></div>`;
    dashboard.appendChild(favSection);


    var favGrid = favSection.querySelector('.sfarc-favorites-grid');

    // Use userFavorites to render
    var displayFavorites = userFavorites.length > 0 ? userFavorites : [
        // Default favorites if none pinned
        { label: 'Setup Home', url: '/lightning/setup/SetupOneHome/home', icon: 'S', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { label: 'Users', url: '/lightning/setup/ManageUsers/home', icon: 'U', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
        { label: 'Flows', url: '/lightning/setup/Flows/home', icon: 'F', gradient: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)' }
    ];



    displayFavorites.forEach((fav, index) => {
        // Colors & Gradients if not saved
        var gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
            'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
            'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)',
            'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)'
        ];
        var bg = fav.gradient || gradients[index % gradients.length];
        var textColor = bg.includes('cfd9df') ? '#555' : 'white';
        var initials = getInitials(fav.label);

        var item = document.createElement('div');
        item.className = 'sfarc-fav-item';
        item.innerHTML = `
            <div class="sfarc-fav-icon" style="background: ${bg}; color: ${textColor}">${initials}</div>
            <div class="sfarc-fav-label">${escapeHtml(fav.label)}</div>
        `;
        item.onclick = () => {
            addToRecents(fav);
            if (fav.url.startsWith('sfi:')) {
                var feature = fav.url.replace('sfi:', '');
                var params = (feature === 'data-export') ? (() => { const q = buildSmartQuery(); return q ? { query: q } : undefined; })() : undefined;
                openInNewTab(feature, params);
            } else {
                window.open(`${window.sfApi.instanceUrl}${fav.url}`, '_blank');
            }
            // Refresh detailed view to show updated recents if visible?
            // renderRecentShortcuts(container); // might be too jarring if it redraws
        };
        favGrid.appendChild(item);
    });


    // --- Recents Section ---
    var recentSection = document.createElement('div');
    recentSection.innerHTML = `<div class="sfarc-section-header">Recent Activity</div><div class="sfarc-recents-grid"></div>`;
    dashboard.appendChild(recentSection);

    var recentGrid = recentSection.querySelector('.sfarc-recents-grid');

    // Use Real Recents
    if (recentShortcuts.length === 0) {
        container.innerHTML = '<div style="color:#888; font-style:italic; padding:10px;">No recent activity yet.</div>';
    } else {
        recentShortcuts.forEach(rec => {
            var card = document.createElement('div');
            card.className = 'sfarc-recent-card';

            // Determine icon based on category/label or just generic
            var iconCode = Icons.Generic;
            if (rec.label.includes('Apex') || rec.category === 'Custom Code') iconCode = Icons.Code;
            if (rec.label.includes('Settings') || rec.category === 'Settings') iconCode = Icons.Settings;
            if (rec.label.includes('Flow')) iconCode = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

            card.innerHTML = `
                <div class="sfarc-recent-icon">${iconCode}</div>
                <div class="sfarc-recent-info">
                    <div class="sfarc-recent-title">${escapeHtml(rec.label)}</div>
                    <div class="sfarc-recent-sub">${escapeHtml(rec.category)}</div>
                </div>
            `;
            card.onclick = () => {
                addToRecents(rec); // Bump to top
                if (rec.url.startsWith('sfi:')) {
                    var feature = rec.url.replace('sfi:', '');
                    var params = (feature === 'data-export') ? (() => { const q = buildSmartQuery(); return q ? { query: q } : undefined; })() : undefined;
                    openInNewTab(feature, params);
                } else {
                    window.open(`${window.sfApi.instanceUrl}${rec.url}`, '_blank');
                }
                renderRecentShortcuts(container); // Refresh to show new order
            };
            recentGrid.appendChild(card);
        });
    }
}



// Toast Notification System
function showToast(message, type = 'info') {
    var toast = document.createElement('div');
    toast.className = `sfarc-toast sfarc-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('sfarc-toast-show'), 10);
    setTimeout(() => {
        toast.classList.remove('sfarc-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Confirm Dialog System
function showConfirmDialog(title, message, opts = {}) {
    const { danger = false, okLabel = 'OK', cancelLabel = 'Cancel' } = opts || {};
    return new Promise((resolve) => {
        var overlay = document.createElement('div');
        overlay.className = 'sfarc-confirm-overlay';
        var dialog = document.createElement('div');
        dialog.className = 'sfarc-confirm-dialog' + (danger ? ' is-danger' : '');
        dialog.innerHTML = `
            <div class="sfarc-confirm-head">
                <div class="sfarc-confirm-icon" aria-hidden="true">
                    ${danger
                        ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
                        : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'}
                </div>
                <div style="min-width: 0;">
                    <div class="sfarc-confirm-title">${escapeHtml(title)}</div>
                    <div class="sfarc-confirm-message">${escapeHtml(message)}</div>
                </div>
            </div>
            <div class="sfarc-confirm-buttons">
                <button class="sfarc-confirm-btn sfarc-confirm-cancel">${escapeHtml(cancelLabel)}</button>
                <button class="sfarc-confirm-btn sfarc-confirm-ok${danger ? ' danger' : ''}">${escapeHtml(okLabel)}</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('sfarc-confirm-show');
            dialog.classList.add('sfarc-confirm-dialog-show');
        }, 10);
        var closeDialog = (result) => {
            overlay.classList.remove('sfarc-confirm-show');
            dialog.classList.remove('sfarc-confirm-dialog-show');
            setTimeout(() => overlay.remove(), 300);
            resolve(result);
        };
        dialog.querySelector('.sfarc-confirm-cancel').onclick = () => closeDialog(false);
        dialog.querySelector('.sfarc-confirm-ok').onclick = () => closeDialog(true);
        overlay.onclick = (e) => { if (e.target === overlay) closeDialog(false); };
    });
}

// ── Live table cell formatters (human dates, status pills, version chips) ──
function liveDisplayValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        return val.Name || val.DeveloperName || val.Label || val.Address ||
            Object.values(val).filter(v => typeof v !== 'object').join(', ') || JSON.stringify(val);
    }
    return String(val);
}

var LIVE_ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
var LIVE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function liveHumanizeDate(value) {
    if (typeof value !== 'string') return value;
    var isDateTime = LIVE_ISO_DT_RE.test(value);
    if (!isDateTime && !LIVE_DATE_RE.test(value)) return value;
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    var opts = { month: 'short', day: 'numeric', year: 'numeric' };
    if (isDateTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    return d.toLocaleString(undefined, opts);
}

function liveStatusClass(statusText) {
    var lower = String(statusText).toLowerCase();
    if (['active', 'installed', 'compiled', 'valid', 'success', 'enabled', 'true'].includes(lower)) return 'success';
    if (['inactive', 'expired', 'error', 'failed', 'invalid', 'deleted', 'blocked', 'false'].includes(lower)) return 'danger';
    return 'neutral';
}

function liveCellHtml(col, rawVal) {
    var colLower = col.toLowerCase();
    if (colLower === 'isactive' || colLower.includes('status')) {
        var statusText = typeof rawVal === 'boolean'
            ? (rawVal ? 'Active' : 'Inactive')
            : liveDisplayValue(rawVal);
        return `<span class="sfarc-live-status ${liveStatusClass(statusText)}">${escapeHtml(statusText)}</span>`;
    }
    var text = liveDisplayValue(rawVal);
    if (LIVE_ISO_DT_RE.test(text) || LIVE_DATE_RE.test(text)) {
        return `<span class="sfarc-live-date" title="${escapeHtml(text)}">${escapeHtml(liveHumanizeDate(text))}</span>`;
    }
    if (colLower === 'apiversion' || colLower === 'apiversionnumber') {
        return `<span class="sfarc-live-version">v${escapeHtml(text)}</span>`;
    }
    return escapeHtml(text);
}

function renderLiveShortcutsTable(records, container, item) {
    if (!records || records.length === 0) {
        container.innerHTML = getEmptyStateHtml('No records found.');
        return;
    }

    container.innerHTML = '';

    var isFlow = item.label === 'Flows';
    var isApexSource = item.label === 'Apex Classes' || item.label === 'Apex Triggers';
    var isLwcSource = item.label === 'Lightning Web Components' || item.label === 'LightningComponentBundle';

    var tableKey = item.label ? item.label.replace(/[^a-zA-Z0-9]/g, '_') : 'Table_Default';
    var sObjectName = extractSObjectNameFromQuery(item.liveQuery);

    // Determine initial columns from records
    var initialRecordCols = Object.keys(records[0]).filter(k => k !== 'attributes' && k.toLowerCase() !== 'id' && k !== 'DurableId' && k !== 'LatestVersionId');
    var allAvailableColumns = [...initialRecordCols];

    // Retrieve saved column preferences from device storage
    var selectedCols = getSavedTableColumns(tableKey, initialRecordCols);
    if (!selectedCols || selectedCols.length === 0) {
        selectedCols = [...initialRecordCols];
    }

    var columns = [...selectedCols];
    if (isFlow && !columns.includes('Actions')) {
        columns.unshift('Actions');
    }

    // Render Table Header Toolbar with Field Chooser
    var toolbar = document.createElement('div');
    toolbar.className = 'sfarc-table-toolbar';
    toolbar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 3px 12px; background: var(--sfarc-card-bg, #ffffff); border-bottom: 1px solid var(--sfarc-border, #e2e8f0); position: relative; z-index: 1000; flex-shrink: 0; user-select: none; overflow: visible !important;';

    var countInfo = document.createElement('div');
    countInfo.style.cssText = 'font-size: 11px; font-weight: 500; color: var(--sfarc-secondary-text, #64748b);';
    countInfo.innerHTML = `<span class="sfarc-live-count"><strong>${records.length}</strong> records</span>`;

    var pickerContainer = document.createElement('div');
    pickerContainer.style.cssText = 'position: relative; display: inline-block; z-index: 99999;';

    var pickerBtn = document.createElement('button');
    pickerBtn.className = 'sfarc-col-chooser-btn sfarc-footer-icon-btn';
    pickerBtn.title = `Select Table Fields (${selectedCols.length}/${allAvailableColumns.length})`;
    pickerBtn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; font-size: 11.5px; color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.08); border: 1px solid rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25); cursor: pointer; transition: all 0.2s;';
    pickerBtn.innerHTML = `<i class="fa-solid fa-sliders"></i>`;

    var dropdown = document.createElement('div');
    dropdown.className = 'sfarc-col-chooser-dropdown';
    dropdown.style.cssText = 'display: none; position: absolute; top: calc(100% + 4px); right: 0; width: 270px; max-height: 350px; background: var(--sfarc-bg, #ffffff); border: 1px solid var(--sfarc-border, #cbd5e1); border-radius: 8px; box-shadow: 0 12px 28px rgba(0,0,0,0.22); z-index: 9999999; flex-direction: column; overflow: hidden; font-family: inherit; margin: 0;';

    var renderCheckboxList = (fieldsList) => {
        var listDiv = dropdown.querySelector('.sfarc-col-checkbox-list');
        if (!listDiv) return;
        listDiv.innerHTML = fieldsList.map(col => {
            var checked = selectedCols.includes(col) ? 'checked' : '';
            return `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--sfarc-text, #334155); cursor: pointer; user-select: none; padding: 2px 0;">
                    <input type="checkbox" class="sfarc-col-chk" data-col="${col}" ${checked} style="accent-color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); cursor: pointer;">
                    <span>${col}</span>
                </label>
            `;
        }).join('');

        // Wire checkbox listeners
        listDiv.querySelectorAll('.sfarc-col-chk').forEach(chk => {
            chk.onchange = async () => {
                var newSelected = [];
                listDiv.querySelectorAll('.sfarc-col-chk:checked').forEach(c => {
                    newSelected.push(c.dataset.col);
                });
                if (newSelected.length === 0) {
                    chk.checked = true;
                    return;
                }
                saveTableColumns(tableKey, newSelected);

                // Check if any newly checked field is missing in current records
                var missingFields = newSelected.filter(f => records.length > 0 && !(f in records[0]));
                if (missingFields.length > 0 && item.liveQuery && sObjectName) {
                    // Dynamic Re-Query with newly selected fields
                    try {
                        var baseFields = ['Id', ...newSelected].filter((v, i, a) => a.indexOf(v) === i);
                        var whereClause = '';
                        var orderClause = '';
                        var limitClause = '';

                        var whereMatch = item.liveQuery.match(/WHERE\s+([\s\S]+?)(?:ORDER BY|LIMIT|$)/i);
                        if (whereMatch) whereClause = ' WHERE ' + whereMatch[1].trim();

                        var orderMatch = item.liveQuery.match(/ORDER BY\s+([\s\S]+?)(?:LIMIT|$)/i);
                        if (orderMatch) orderClause = ' ORDER BY ' + orderMatch[1].trim();

                        var limitMatch = item.liveQuery.match(/LIMIT\s+(\d+)/i);
                        if (limitMatch) limitClause = ' LIMIT ' + limitMatch[1];

                        var dynamicQuery = `SELECT ${baseFields.join(', ')} FROM ${sObjectName}${whereClause}${orderClause}${limitClause}`;
                        var queryRes = await window.sfApi.query(dynamicQuery, item.useToolingApi || false);
                        if (queryRes && queryRes.records) {
                            renderLiveShortcutsTable(queryRes.records, container, item);
                            return;
                        }
                    } catch (e) {
                        console.error('salesforce comet: Re-query failed', e);
                    }
                }

                renderLiveShortcutsTable(records, container, item);
            };
        });
    };

    dropdown.innerHTML = `
        <div style="padding: 8px 12px; background: var(--sfarc-body-bg, #f1f5f9); border-bottom: 1px solid var(--sfarc-border, #cbd5e1); font-size: 11.5px; font-weight: 500; color: var(--sfarc-text, #0f172a); display: flex; justify-content: space-between; align-items: center;">
            <span>Display Fields (${sObjectName || 'Object'})</span>
            <button class="sfarc-col-reset-btn" style="background: transparent; border: none; padding: 0; color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); cursor: pointer; font-size: 11px; font-weight: 500;">Reset All</button>
        </div>
        <div style="padding: 6px 10px; border-bottom: 1px solid var(--sfarc-border, #e2e8f0);">
            <input type="text" class="sfarc-col-search-input" placeholder="Search fields..." style="width: 100%; padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--sfarc-border, #cbd5e1); outline: none; box-sizing: border-box;">
        </div>
        <div class="sfarc-col-checkbox-list" style="flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px;">
        </div>
    `;

    renderCheckboxList(allAvailableColumns);

    var describeFetched = false;
    pickerBtn.onclick = async (e) => {
        e.stopPropagation();
        var isOpen = dropdown.style.display === 'flex';
        dropdown.style.display = isOpen ? 'none' : 'flex';

        if (!isOpen && sObjectName && !describeFetched) {
            describeFetched = true;
            var sObjectFields = await fetchObjectDescribeFields(sObjectName);
            if (sObjectFields && sObjectFields.length > 0) {
                // Combine record fields with sObject describe fields
                var combined = [...new Set([...initialRecordCols, ...sObjectFields])];
                allAvailableColumns = combined;
                pickerBtn.title = `Select Table Fields (${selectedCols.length}/${allAvailableColumns.length})`;
                renderCheckboxList(allAvailableColumns);
            }
        }
    };

    document.addEventListener('click', (e) => {
        if (!pickerContainer.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    dropdown.querySelector('.sfarc-col-reset-btn').onclick = (e) => {
        e.stopPropagation();
        saveTableColumns(tableKey, [...initialRecordCols]);
        renderLiveShortcutsTable(records, container, item);
    };

    var colSearchInput = dropdown.querySelector('.sfarc-col-search-input');
    colSearchInput.oninput = (e) => {
        var term = e.target.value.toLowerCase();
        dropdown.querySelectorAll('.sfarc-col-checkbox-list label').forEach(lbl => {
            var colName = lbl.querySelector('span').textContent.toLowerCase();
            lbl.style.display = colName.includes(term) ? 'flex' : 'none';
        });
    };

    // Field search visibility toggle
    var showColumnFilters = localStorage.getItem('sfarc_col_filter_visible') === 'true';

    var rightControls = document.createElement('div');
    rightControls.style.cssText = 'display: flex; align-items: center; gap: 6px; position: relative; z-index: 99999;';

    var filterToggleBtn = document.createElement('button');
    filterToggleBtn.className = 'sfarc-col-filter-toggle-btn sfarc-footer-icon-btn';

    var updateFilterBtnStyle = () => {
        filterToggleBtn.style.cssText = showColumnFilters
            ? 'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; font-size: 11.5px; color: var(--sfarc-accent-contrast, #ffffff); background: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); border: 1px solid var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); cursor: pointer; transition: all 0.2s; '
            : 'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; font-size: 11.5px; color: var(--sfarc-secondary-text, #64748b); background: transparent; border: 1px solid var(--sfarc-border, #cbd5e1); cursor: pointer; transition: all 0.2s;';
        filterToggleBtn.title = showColumnFilters ? 'Hide Field Search Bars' : 'Show Field Search Bars';
    };
    filterToggleBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    updateFilterBtnStyle();

    filterToggleBtn.onclick = (e) => {
        e.stopPropagation();
        showColumnFilters = !showColumnFilters;
        localStorage.setItem('sfarc_col_filter_visible', showColumnFilters ? 'true' : 'false');
        updateFilterBtnStyle();
        table.querySelectorAll('.sfarc-col-filter').forEach(inp => {
            inp.style.display = showColumnFilters ? 'block' : 'none';
        });
    };

    pickerContainer.appendChild(pickerBtn);
    pickerContainer.appendChild(dropdown);
    rightControls.appendChild(filterToggleBtn);
    rightControls.appendChild(pickerContainer);
    toolbar.appendChild(countInfo);
    toolbar.appendChild(rightControls);
    container.appendChild(toolbar);

    var table = document.createElement('table');
    table.className = 'sfarc-table';
    table.style.width = '100%';
    table.style.marginTop = '0';

    var thead = document.createElement('thead');
    var theadHtml = `<tr>${columns.map(c => `
        <th style="padding: 6px 12px !important; text-align: left !important; vertical-align: top; border-bottom: 1px solid var(--sfarc-border, #e2e8f0) !important;">
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                ${c === 'Actions' ? '' : `<span style="font-size: 9.5px; font-weight: 500; color: var(--text-gray, #666); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">${c}</span>`}
                ${c === 'Actions' ? '' : `<input type="text" data-col="${c}" placeholder="Filter..." class="sfarc-input sfarc-col-filter" style="${showColumnFilters ? 'display: block;' : 'display: none; '}width: 100%; min-width: 60px; font-size: 11px; padding: 4px 8px 4px 24px; box-sizing: border-box; font-weight: normal; border-radius: 12px; border: 1px solid var(--sfarc-border, #bae6fd); background-color: var(--sfarc-bg, #e0f2fe); background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2211%22 height=%2211%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22%3E%3C/circle%3E%3Cline x1=%2221%22 y1=%2221%22 x2=%2216.65%22 y2=%2216.65%22%3E%3C/line%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: 8px center; color: var(--sfarc-text, #0369a1); outline: none; transition: all 0.2s ease;">`}
            </div>
        </th>`).join('')}</tr>`;
    thead.innerHTML = theadHtml;
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    var renderRows = (data) => {
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}" style="text-align: center; padding: 20px; color: var(--text-gray); font-style: italic;">No results match filters.</td></tr>`;
            return;
        }
        data.forEach(rec => {
            var tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            if (isApexSource) {
                tr.title = `Open ${rec.Name} in Comet Code Editor`;
            } else if (isLwcSource) {
                tr.title = `Open ${rec.DeveloperName || rec.MasterLabel || rec.Name} in Comet Code Editor`;
            }
            tr.innerHTML = columns.map(c => {
                if (isFlow && c === 'Actions') {
                    var versionId = rec.ActiveVersionId || rec.LatestVersionId;
                    var detailBtnHtml = versionId ? `
                        <div class="sfarc-flow-detail-btn" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 2px; color: var(--sfarc-text-muted, var(--sfarc-accent, var(--sfarc-accent, #2196f3)));" >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>` : '';
                    return `<td style="text-align: left; padding: 4px 8px !important; vertical-align: middle;">
                        ${detailBtnHtml}
                    </td>`;
                }

                return `<td style="text-align: left; vertical-align: middle;">${liveCellHtml(c, rec[c])}</td>`;
            }).join('');

            var versionsBtn = tr.querySelector('.sfarc-flow-versions-btn');
            if (versionsBtn) {
                versionsBtn.onclick = (e) => {
                    e.stopPropagation();
                    renderFlowVersionsView(rec.Id, rec.Label, container, records, item);
                };
            }

            var detailBtn = tr.querySelector('.sfarc-flow-detail-btn');
            if (detailBtn) {
                detailBtn.onclick = async (e) => {
                    e.stopPropagation();
                    var setupBaseUrl = window.sfApi.instanceUrl.replace('.my.salesforce.com', '.my.salesforce-setup.com').replace('.lightning.force.com', '.my.salesforce-setup.com');

                    // We need the real FlowDefinition record ID (300xxx).
                    // Use a direct Tooling API record GET on the Flow version to retrieve DefinitionId.
                    var versionId = rec.ActiveVersionId || rec.LatestVersionId;
                    if (versionId) {
                        try {
                            var res = await window.sfApi.fetch(
                                `${window.sfApi.instanceUrl}/services/data/${window.sfApi.apiVersion}/tooling/sobjects/Flow/${versionId}`
                            );
                            var flowData = await res.json();
                            if (flowData && flowData.DefinitionId) {
                                var address = encodeURIComponent('/' + flowData.DefinitionId + '?retUrl=/lightning/setup/Flows/home');
                                window.open(`${setupBaseUrl}/lightning/setup/Flows/page?address=${address}`, '_blank');
                                return;
                            }
                        } catch (err) {
                            console.error('salesforce comet: Failed to resolve FlowDefinition ID via direct GET', err);
                        }
                    }

                    // Fallback: open Flows home
                    window.open(`${setupBaseUrl}/lightning/setup/Flows/home`, '_blank');
                };
            }

            tr.onclick = async (e) => {
                if (e.target.closest('.sfarc-flow-versions-btn') || e.target.closest('.sfarc-flow-detail-btn')) return;
                if (isApexSource) {
                    await storeSessionForEditor();
                    chrome.runtime.sendMessage({
                        action: 'openExtensionPage',
                        page: 'code-editor',
                        params: {
                            apexId: rec.Id,
                            apexName: rec.Name,
                            type: item.label === 'Apex Classes' ? 'ApexClass' : 'ApexTrigger'
                        }
                    });
                    return;
                }
                if (isLwcSource) {
                    await storeSessionForEditor();
                    chrome.runtime.sendMessage({
                        action: 'openExtensionPage',
                        page: 'code-editor',
                        params: {
                            bundleId: rec.Id,
                            bundleName: rec.DeveloperName || rec.MasterLabel || rec.Name
                        }
                    });
                    return;
                }
                // Navigate to record
                var flowVersionId = rec.ActiveVersionId || rec.LatestVersionId;
                if ((item.label === 'Flows' || item.label === 'Process Builder') && flowVersionId) {
                    window.open(`${window.sfApi.instanceUrl}/builder_platform_interaction/flowBuilder.app?flowId=${flowVersionId}#/`, '_blank');
                } else if (item.label === 'Flows' || item.label === 'Process Builder') {
                    // Fallback: trigger same detail page resolution
                    tr.querySelector('.sfarc-flow-detail-btn')?.click();
                } else {
                    window.open(`${window.sfApi.instanceUrl}/${rec.Id}`, '_blank');
                }
            };

            tbody.appendChild(tr);
        });
    };

    renderRows(records);

    // Setup filter event listeners
    var filters = {};
    var inputs = thead.querySelectorAll('.sfarc-col-filter');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            filters[e.target.dataset.col] = e.target.value.toLowerCase();
            var filtered = records.filter(r => {
                return Object.keys(filters).every(col => {
                    var filterVal = filters[col];
                    if (!filterVal) return true;

                    return liveDisplayValue(r[col]).toLowerCase().includes(filterVal);
                });
            });
            renderRows(filtered);
        });
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'sfarc-table-container';
    wrapper.style.width = '100%';
    wrapper.style.margin = '0';
    wrapper.style.maxHeight = 'none';
    wrapper.style.flex = '1';
    wrapper.style.minHeight = '0';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'auto';
    wrapper.appendChild(table);

    container.innerHTML = '';
    container.appendChild(toolbar);
    container.appendChild(wrapper);
}

function renderFlowVersionsView(flowDefinitionId, flowLabel, container, originalRecords, originalItem) {
    container.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <button id="sfarc-back-to-flows" class="sfarc-btn-secondary" style="padding: 6px 12px; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Back
            </button>
            <h3 style="margin: 0; font-size: 1.1em; color: var(--text-color);">Versions for ${escapeHtml(flowLabel)}</h3>
        </div>
        <div id="sfarc-flow-versions-content" style="position: relative; min-height: 100px;">
            <div class="sfarc-loading">Fetching versions...</div>
        </div>
    `;

    document.getElementById('sfarc-back-to-flows').onclick = () => {
        renderLiveShortcutsTable(originalRecords, container, originalItem);
    };

    var contentDiv = document.getElementById('sfarc-flow-versions-content');

    var query = `SELECT Id, VersionNumber, Status, Description FROM FlowVersionView WHERE FlowDefinitionViewId = '${flowDefinitionId}' ORDER BY VersionNumber DESC`;

    window.sfApi.query(query, false)
        .then(result => {
            var versions = result.records;
            if (!versions || versions.length === 0) {
                contentDiv.innerHTML = getEmptyStateHtml('No versions found for this Flow.');
                return;
            }

            var table = document.createElement('table');
            table.className = 'sfarc-table';
            table.style.width = '100%';

            var columns = ['VersionNumber', 'Status', 'Description'];

            var thead = document.createElement('thead');
            thead.innerHTML = `<tr>${columns.map(c => `<th>${window.escapeHtml(c)}</th>`).join('')}</tr>`;
            table.appendChild(thead);

            var tbody = document.createElement('tbody');
            versions.forEach(v => {
                var tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.innerHTML = columns.map(c => {
                    var val = v[c] || '';
                    return `<td>${escapeHtml(String(val))}</td>`;
                }).join('');

                tr.onclick = () => {
                    window.open(`${window.sfApi.instanceUrl}/builder_platform_interaction/flowBuilder.app?flowId=${v.Id}#/`, '_blank');
                };
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            var wrapper = document.createElement('div');
            wrapper.style.width = '100%';
            wrapper.style.overflowX = 'auto';
            wrapper.appendChild(table);

            contentDiv.innerHTML = '';
            contentDiv.appendChild(wrapper);
        })
        .catch(err => {
            contentDiv.innerHTML = friendlyFetchError(err, null);
        });
}

// --- Global Shortcut Handler ---
document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input (except for specific shortcuts like Escape)
    var isInput = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) && !e.altKey; // Allow Alt shortcuts even in input

    // 1. Toggle Inspector: Shift+Space (skipped when the user chose Sidebar-only launch)
    if (e.shiftKey && (e.code === 'Space' || e.key === ' ') && settings.launcherMethod !== 'sidebar') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof togglePanel === 'function') {
            togglePanel();
        } else {
            var firstToggle = document.querySelector('.sfarc-side-toggle-btn');
            if (firstToggle) firstToggle.click();
        }
        return;
    }

    // 2. Export Data: Alt+E
    // Allow even in inputs if it's Alt+E
    if (e.altKey && (e.code === 'KeyE' || e.key.toLowerCase() === 'e')) {
        e.preventDefault();
        var exportBtn = document.getElementById('sfarc-data-export');
        if (exportBtn) {
            var panel = document.getElementById('sfarc-panel');
            if (panel && panel.classList.contains('sfarc-hidden')) {
                if (typeof togglePanel === 'function') togglePanel();
            }
            exportBtn.click();
        }
        return;
    }

    // 3. Close Panel: Escape
    if (e.key === 'Escape') {
        var panel = document.getElementById('sfarc-panel');
        if (panel && !panel.classList.contains('sfarc-hidden')) {
            var modals = Array.from(document.querySelectorAll('.sfarc-modal'));
            var modalOpen = modals.some(m => !m.classList.contains('sfarc-hidden') && m.style.display !== 'none');

            if (!modalOpen) {
                e.preventDefault();
                if (typeof togglePanel === 'function') togglePanel();
            }
        }
    }

    // 4. Focus Search: Alt+F
    if (e.altKey && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        var panel = document.getElementById('sfarc-panel');
        if (panel && panel.classList.contains('sfarc-hidden')) {
            if (typeof togglePanel === 'function') togglePanel();
        }

        setTimeout(() => {
            var searchInput = document.querySelector('.sfarc-search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 50);
        return;
    }

    // 5. Switch Tabs: Alt+1 to Alt+6
    if (e.altKey && !e.shiftKey && !e.ctrlKey) {
        var key = e.key;
        if (/^[1-6]$/.test(key)) {
            var index = parseInt(key) - 1;
            var tabs = document.querySelectorAll('.sfarc-tab');
            if (tabs && tabs[index]) {
                e.preventDefault();
                var panel = document.getElementById('sfarc-panel');
                if (panel && panel.classList.contains('sfarc-hidden')) {
                    if (typeof togglePanel === 'function') togglePanel();
                }
                tabs[index].click();
            }
        }
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!chrome.runtime?.id) return;

    if (request.action === 'get-user-info') {
        fetchCurrentUserId().finally(() => {
            var userId = window.currentUserId;
            var userName = window.currentUserName;
            var instanceUrl = window.sfApi ? window.sfApi.instanceUrl : (window.location.origin);

            // Try to get actual username and OrgId if sfApi is available
            var username = window.sfApi?.userInfo?.username;
            var orgId = window.sfApi?.userInfo?.orgId;

            sendResponse({
                userId,
                userName,
                username,
                orgId,
                instanceUrl
            });
        });
        return true;
    }
});

// --- Org Color Branding (Favicon) ---
function applyOrgColorBranding() {
    if (!chrome.runtime?.id) return;
    if (!window.sfApi || !window.sfApi.instanceUrl) return;

    try {
        chrome.storage.local.get(['sfiGroups', 'sfiAccounts'], (result) => {
            if (chrome.runtime.lastError) return;
            var allAccounts = [];

            // Support both new grouped structure and old flat structure
            if (result.sfiGroups) {
                // Flatten groups to get all accounts
                result.sfiGroups.forEach(group => {
                    if (group.accounts && Array.isArray(group.accounts)) {
                        allAccounts = allAccounts.concat(group.accounts);
                    }
                });
            }
            if (result.sfiAccounts) {
                // Fallback to old structure
                allAccounts = allAccounts.concat(result.sfiAccounts);
            }

            if (allAccounts.length === 0) return;

            var currentUsername = window.sfApi.userInfo?.username;
            var currentOrgId = window.sfApi.userInfo?.orgId;
            var currentInstanceUrl = normalizeOrgBrandingUrl(window.sfApi.instanceUrl || window.location.origin);

            var account = allAccounts.find(acc =>
                (currentOrgId && acc.orgId === currentOrgId) ||
                (currentUsername && acc.username === currentUsername) ||
                (currentInstanceUrl && normalizeOrgBrandingUrl(acc.instanceUrl || acc.loginUrl) === currentInstanceUrl)
            );

            if (account && isValidOrgColor(account.color)) {
                updateFavicon(account.color);
            }
        });
    } catch (e) {
        // Context invalidated
    }
}

function updateOrgColorBar(color) {
    var bar = document.getElementById('sfarc-org-color-bar');
    if (bar) bar.remove();
    var envBanner = document.getElementById('sfarc-env-banner');
    if (envBanner) envBanner.remove();
}

// BUG 9 FIX: Call branding directly after user info is fetched, without fragile monkey-patching.
// We hook into the existing fetchCurrentUserId promise chain cleanly.
(function initBranding() {
    // Apply once when user info is ready
    if (typeof fetchCurrentUserId === 'function') {
        var result = fetchCurrentUserId();
        if (result && typeof result.then === 'function') {
            result.then(() => applyOrgColorBranding());
        }
    }

    // BUG 5 FIX: Instead of a 5-second interval, re-apply branding only on SPA navigations.
    // The Navigation API listener or history patches already handle this via updateRecordContext.
    // We just need to call branding once at init and on navigation events.
    if (window.navigation) {
        window.navigation.addEventListener('navigatesuccess', () => {
            setTimeout(applyOrgColorBranding, 300);
        });
    } else {
        window.addEventListener('popstate', () => {
            setTimeout(applyOrgColorBranding, 300);
        });
    }

    // One-shot initial application
    setTimeout(applyOrgColorBranding, 1000);
})();
// --- Object Manager Navigator UX ---
var sfarcObjectTabState = {
    stack: [], // e.g. [{ type: 'search' }, { type: 'object', data: { name: 'Account' } }, { type: 'category', data: { name: 'Account', category: 'Fields' } }]
    query: '',
    cachedObjects: null,
    searchTimeout: null,
    scrollPositions: {}
};

function initObjectNavigator(container) {
    container.innerHTML = `
        <div class="sfarc-stack-navigator" id="sfarc-object-stack">
            <!-- Dynamic content goes here -->
        </div>
    `;

    // Initialize stack if empty
    if (sfarcObjectTabState.stack.length === 0) {
        sfarcObjectTabState.stack.push({ type: 'search' });
    }

    renderCurrentObjectStackView();
}

function renderCurrentObjectStackView() {
    var stackContainer = document.getElementById('sfarc-object-stack');
    if (!stackContainer) return;

    var currentView = sfarcObjectTabState.stack[sfarcObjectTabState.stack.length - 1];
    stackContainer.innerHTML = ''; // Clear for now (could implement slide animations later)

    var viewElement = document.createElement('div');
    viewElement.className = 'sfarc-stack-view active';
    viewElement.id = 'sfarc-active-stack-view';
    stackContainer.appendChild(viewElement);

    if (currentView.type === 'search') {
        renderObjectSearchScreen(viewElement);
    } else if (currentView.type === 'object') {
        renderObjectOverviewScreen(viewElement, currentView.data);
    } else if (currentView.type === 'category') {
        renderObjectCategoryScreen(viewElement, currentView.data);
    }
}

function pushObjectNavStack(view) {
    sfarcObjectTabState.stack.push(view);
    renderCurrentObjectStackView();
}

function popObjectNavStack() {
    if (sfarcObjectTabState.stack.length > 1) {
        sfarcObjectTabState.stack.pop();
        renderCurrentObjectStackView();
    }
}

function saveRecentObject(item) {
    try {
        if (!window.sfApi || !window.sfApi.instanceUrl) return;
        var storageKey = `sfarc_recent_objects_${window.sfApi.instanceUrl}`;
        chrome.storage.local.get([storageKey], (res) => {
            var recents = res[storageKey] || [];
            // Remove if already exists
            recents = recents.filter(o => o.name !== item.name);
            // Add to front
            recents.unshift({
                name: item.name,
                label: item.label,
                custom: item.custom
            });
            // Keep top 15
            if (recents.length > 15) recents = recents.slice(0, 15);

            var toSet = {};
            toSet[storageKey] = recents;
            chrome.storage.local.set(toSet);
        });
    } catch (e) { }
}
function renderObjectSearchScreen(container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: calc(100% - 10px); width: 100%;">
            <div id="sfarc-obj-search-results" style="flex: 1; min-height: 0; overflow-y: auto; padding: 0; width: 100%;">
                ${sfarcObjectTabState.query ? '<div class="sfarc-loading">Loading...</div>' : ''}
            </div>
        </div>
    `;

    var resultsContainer = container.querySelector('#sfarc-obj-search-results');
    var showObjectSearchPrompt = () => {
        resultsContainer.innerHTML = `
            <div class="sfarc-object-search-empty">
                <div class="sfarc-object-search-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="7" ry="3"></ellipse>
                        <path d="M5 5v7c0 1.66 3.13 3 7 3"></path>
                        <path d="M19 5v5"></path>
                        <path d="M5 12v7c0 1.66 3.13 3 7 3"></path>
                        <circle cx="18" cy="17" r="3"></circle>
                        <path d="m20.3 19.3 1.7 1.7"></path>
                    </svg>
                </div>
                <div class="sfarc-object-search-empty-title">Explore your Salesforce data model</div>
                <div class="sfarc-object-search-empty-copy">Search an object name or API name above to open its fields, layouts, automation, and more.</div>
                <div class="sfarc-object-search-empty-hint">Try <button type="button" class="sfarc-suggest-obj" data-query="Account">Account</button>, <button type="button" class="sfarc-suggest-obj" data-query="Contact">Contact</button>, or <button type="button" class="sfarc-suggest-obj" data-query="Custom__c">Custom__c</button></div>
            </div>
        `;
        // Make the suggestion pills run the search on click
        resultsContainer.querySelectorAll('.sfarc-suggest-obj').forEach(btn => {
            btn.addEventListener('click', () => {
                var q = btn.dataset.query.toLowerCase();
                var input = document.getElementById('sfarc-global-search');
                if (input) input.value = btn.dataset.query;
                if (window.sfarcObjectTabState) window.sfarcObjectTabState.query = q;
                if (window.executeObjectSearch) window.executeObjectSearch(q);
                if (input) input.focus();
            });
        });
    };

    var executeSearch = async (query) => {
        if (!query.trim()) {
            try {
                var storageKey = `sfarc_recent_objects_${window.sfApi.instanceUrl}`;
                chrome.storage.local.get([storageKey], (res) => {
                    var recents = res[storageKey] || [];
                    if (recents.length === 0) {
                        showObjectSearchPrompt();
                        return;
                    }

                    resultsContainer.innerHTML = `
                        <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2.5fr 2fr 1fr 1fr 1fr 30px; margin-bottom: 0; position: sticky; top: 0; z-index: 10; background: var(--bg-panel, #1e1e2e); padding: 0 16px;">
                            <div>Label</div>
                            <div>API Name</div>
                            <div>Prefix</div>
                            <div>Type</div>
                            <div>Access</div>
                            <div></div>
                        </div>
                        <div id="sfarc-obj-recents-list" style="padding: 0 0 10px 0;"></div>
                    `;
                    var listContainer = resultsContainer.querySelector('#sfarc-obj-recents-list');
                    recents.forEach(item => {
                        var row = document.createElement('div');
                        row.className = 'sfarc-obj-grid-row';
                        row.style = 'display: grid; grid-template-columns: 2.5fr 2fr 1fr 1fr 1fr 30px; align-items: stretch; cursor: pointer; border-bottom: 1px solid var(--border-color); padding: 0 16px;';
                        row.innerHTML = `
                            <div style="padding: 8px 10px; font-weight: 500; font-size: 13px; display: flex; align-items: center;">${escapeHtml(item.label)}</div>
                            <div style="padding: 8px 10px; color: var(--sfarc-secondary-text, #666); font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; display: flex; align-items: center;">${escapeHtml(item.name)}</div>
                            <div style="padding: 8px 10px; color: var(--sfarc-secondary-text, #666); font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; display: flex; align-items: center;">${item.keyPrefix || '-'}</div>
                            <div style="padding: 8px 10px; display: flex; align-items: center;">
                                <span class="sfarc-obj-type-badge ${item.custom ? 'custom' : 'standard'}">${item.custom ? 'Custom' : 'Standard'}</span>
                            </div>
                            <div style="padding: 8px 10px; display: flex; gap: 3px; align-items: center;">
                                ${item.createable ? '<span class="sfarc-obj-access-badge c" >C</span>' : ''}
                                ${item.updateable ? '<span class="sfarc-obj-access-badge u" >U</span>' : ''}
                                ${item.deletable ? '<span class="sfarc-obj-access-badge d" >D</span>' : ''}
                            </div>
                            <div style="display: flex; align-items: center; justify-content: center;">
                                <button class="sfarc-open-obj-btn" style="background: none; border: none; cursor: pointer; color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); padding: 4px; display: flex;" >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                </button>
                            </div>
                        `;
                        row.addEventListener('click', () => {
                            saveRecentObject(item);
                            pushObjectNavStack({ type: 'object', data: item });
                        });
                        var btn = row.querySelector('.sfarc-open-obj-btn');
                        if (btn) {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                window.open(`${window.sfApi.instanceUrl}/lightning/o/${item.name}/home`, '_blank');
                            });
                        }
                        listContainer.appendChild(row);
                    });
                });
            } catch (e) {
                showObjectSearchPrompt();
            }
            return;
        }

        resultsContainer.innerHTML = '<div class="sfarc-loading">Searching...</div>';

        try {
            // Lazy load global cache if not present for instant search
            if (!sfarcObjectTabState.cachedObjects) {
                var global = await window.sfApi.describeGlobal();
                sfarcObjectTabState.cachedObjects = global.sobjects;
            }

            var lowerQuery = query.toLowerCase();
            var matched = sfarcObjectTabState.cachedObjects.filter(obj =>
                obj.name.toLowerCase().includes(lowerQuery) ||
                obj.label.toLowerCase().includes(lowerQuery)
            ).slice(0, 30); // Limit to 30 for performance

            if (matched.length === 0) {
                resultsContainer.innerHTML = getEmptyStateHtml('No results found');
                return;
            }

            resultsContainer.innerHTML = `
                <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2.5fr 2fr 1fr 1fr 1fr 30px; margin-bottom: 0; position: sticky; top: 0; z-index: 10; background: var(--bg-panel, #1e1e2e); padding: 0 16px;">
                    <div>Label</div>
                    <div>API Name</div>
                    <div>Prefix</div>
                    <div>Type</div>
                    <div>Access</div>
                    <div></div>
                </div>
                <div id="sfarc-obj-search-list" style="padding: 0 0 10px 0;"></div>
            `;
            var searchListContainer = resultsContainer.querySelector('#sfarc-obj-search-list');
            matched.forEach(item => {
                var row = document.createElement('div');
                row.className = 'sfarc-obj-grid-row';
                row.style = 'display: grid; grid-template-columns: 2.5fr 2fr 1fr 1fr 1fr 30px; align-items: stretch; cursor: pointer; border-bottom: 1px solid var(--border-color); padding: 0 16px;';
                row.innerHTML = `
                    <div style="padding: 8px 10px; font-weight: 500; font-size: 13px; display: flex; align-items: center;">${escapeHtml(item.label)}</div>
                    <div style="padding: 8px 10px; color: var(--sfarc-secondary-text, #666); font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; display: flex; align-items: center;">${escapeHtml(item.name)}</div>
                    <div style="padding: 8px 10px; color: var(--sfarc-secondary-text, #666); font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; display: flex; align-items: center;">${item.keyPrefix || '-'}</div>
                    <div style="padding: 8px 10px; display: flex; align-items: center;">
                        <span class="sfarc-obj-type-badge ${item.custom ? 'custom' : 'standard'}">${item.custom ? 'Custom' : 'Standard'}</span>
                    </div>
                    <div style="padding: 8px 10px; display: flex; gap: 3px; align-items: center;">
                        ${item.createable ? '<span class="sfarc-obj-access-badge c" >C</span>' : ''}
                        ${item.updateable ? '<span class="sfarc-obj-access-badge u" >U</span>' : ''}
                        ${item.deletable ? '<span class="sfarc-obj-access-badge d" >D</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <button class="sfarc-open-obj-btn" style="background: none; border: none; cursor: pointer; color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3))); padding: 4px; display: flex;" >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                `;
                row.addEventListener('click', () => {
                    saveRecentObject(item);
                    pushObjectNavStack({ type: 'object', data: item });
                });
                var btn = row.querySelector('.sfarc-open-obj-btn');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.open(`${window.sfApi.instanceUrl}/lightning/o/${item.name}/home`, '_blank');
                    });
                }
                searchListContainer.appendChild(row);
            });

        } catch (e) {
            resultsContainer.innerHTML = friendlyFetchError(e, null);
        }
    };

    window.executeObjectSearch = (query) => {
        if (sfarcObjectTabState.searchTimeout) clearTimeout(sfarcObjectTabState.searchTimeout);
        sfarcObjectTabState.searchTimeout = setTimeout(() => {
            executeSearch(query);
        }, 300);
    };

    if (sfarcObjectTabState.query) {
        window.executeObjectSearch(sfarcObjectTabState.query);
    } else {
        window.executeObjectSearch('');
    }
}

function renderObjectOverviewScreen(container, objectData) {
    container.innerHTML = `
        <div class="sfarc-stack-header">
            <button class="sfarc-stack-back-btn" id="sfarc-obj-back" >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div class="sfarc-breadcrumb-bar">
                <span class="sfarc-breadcrumb-pill active">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    ${escapeHtml(objectData.label)}
                </span>
            </div>                    <button class="sfarc-btn sfarc-btn-primary" id="sfarc-setup-redirect" style="margin-left:auto; flex-shrink:0; display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        Open in Setup
                    </button>
        </div>
        <div class="sfarc-stack-content">
            <div class="sfarc-obj-overview-head">
                <div class="sfarc-obj-overview-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5"></path><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"></path></svg>
                </div>
                <div style="min-width: 0;">
                    <div class="sfarc-obj-overview-title">${escapeHtml(objectData.label)}</div>
                    <div class="sfarc-obj-overview-sub">
                        <span class="sfarc-obj-api-chip">${escapeHtml(objectData.name)}</span>
                        <span class="sfarc-obj-type-badge ${objectData.custom ? 'custom' : 'standard'}">${objectData.custom ? 'Custom' : 'Standard'}</span>
                    </div>
                </div>
            </div>
            
            <div class="sfarc-obj-overview-grid">
                ${[
            { id: 'Fields', label: 'Fields', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>' },
            { id: 'PageLayouts', label: 'Page Layouts', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>' },
            { id: 'Flows', label: 'Flows', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>' },
            { id: 'Triggers', label: 'Triggers', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>' },
            { id: 'ValidationRules', label: 'Validation Rules', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>' },
            { id: 'RecordTypes', label: 'Record Types', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 17 22 12"></polyline></svg>' },
            { id: 'Buttons', label: 'Buttons', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
            { id: 'LightningPages', label: 'Lightning Pages', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' }
        ].map(cat => `
                    <div class="sfarc-obj-category-card" data-category="${cat.id}" tabindex="0">
                        <div class="sfarc-obj-category-title">
                            <span class="sfarc-obj-category-icon">${cat.icon}</span>
                            <span>${cat.label}</span>
                        </div>
                        <svg class="sfarc-obj-category-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                `).join('')}
            </div>
            

        </div>
    `;

    container.querySelector('#sfarc-obj-back').addEventListener('click', popObjectNavStack);
    container.querySelector('#sfarc-setup-redirect').addEventListener('click', () => {
        window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/Details/view`, '_blank');
    });

    container.querySelectorAll('.sfarc-obj-category-card').forEach(card => {
        var openCategory = () => {
            pushObjectNavStack({
                type: 'category',
                data: { objectData, category: card.getAttribute('data-category') }
            });
        };
        card.addEventListener('click', openCategory);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openCategory();
            }
        });
    });
}

function renderObjectCategoryScreen(container, data) {
    const { objectData, category } = data;
    var catLabel = category.replace(/([A-Z])/g, ' $1').trim();

    container.innerHTML = `
        <div class="sfarc-stack-header" style="justify-content: space-between; gap: 12px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <button class="sfarc-stack-back-btn" id="sfarc-cat-back" >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <div class="sfarc-breadcrumb-bar">
                    <span class="sfarc-breadcrumb-pill" id="sfarc-breadcrumb-root"  ${escapeHtml(objectData.label)}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        ${escapeHtml(objectData.label)}
                    </span>
                    <span class="sfarc-breadcrumb-sep">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                    <span class="sfarc-breadcrumb-pill active">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        ${catLabel}
                    </span>
                </div>
            </div>
            <div style="width: 220px; flex-shrink: 0;">
                <input type="text" id="sfarc-cat-search" class="sfarc-search-input" placeholder="Search ${catLabel}..." autocomplete="off">
            </div>
        </div>
        <div class="sfarc-stack-content" style="padding: 0;">
            <div id="sfarc-cat-results" style="padding: 12px 16px;">
                 <div class="sfarc-loading">Loading ${catLabel}...</div>
            </div>
        </div>
    `;

    container.querySelector('#sfarc-cat-back').addEventListener('click', popObjectNavStack);
    container.querySelector('#sfarc-breadcrumb-root').addEventListener('click', popObjectNavStack);
    var resultsContainer = container.querySelector('#sfarc-cat-results');
    var searchInput = container.querySelector('#sfarc-cat-search');

    var openSetup = (section) => {
        window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/${section}/view`, '_blank');
    };

    // Lazy load the specific category
    (async () => {
        try {
            var items = [];
            var rowRenderer = (item) => '';

            if (category === 'Fields') {
                // Query FieldDefinition including DurableId (Format: ObjectName.FieldName or 00N...)
                try {
                    var result = await window.sfApi.query(`SELECT DurableId, QualifiedApiName, Label, DataType, LastModifiedDate, LastModifiedBy.Name FROM FieldDefinition WHERE EntityDefinitionId = '${objectData.name}'`);
                    items = result.records || [];
                } catch (e) {
                    // Fallback to describe if FieldDefinition query fails
                    var desc = await window.sfApi.describe(objectData.name);
                    items = (desc.fields || []).map(f => ({
                        DurableId: f.name,
                        QualifiedApiName: f.name,
                        Label: f.label,
                        DataType: f.type,
                        LastModifiedDate: null,
                        LastModifiedBy: null
                    }));
                }

                rowRenderer = (item) => {
                    var dateStr = item.LastModifiedDate ? new Date(item.LastModifiedDate).toLocaleDateString() : '-';
                    var byName = item.LastModifiedBy && item.LastModifiedBy.Name ? item.LastModifiedBy.Name : '-';
                    return `
                    <div class="sfarc-obj-grid-row" data-id="${item.DurableId || item.QualifiedApiName}" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.Label)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${escapeHtml(item.QualifiedApiName)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px); word-break: break-word;">${escapeHtml(item.DataType)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${dateStr}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${escapeHtml(byName)}</div>
                    </div>
                `;
                };
            } else if (category === 'Triggers') {
                var result = await window.sfApi.query(`SELECT Id, Name, Status FROM ApexTrigger WHERE TableEnumOrId = '${objectData.name}'`);
                items = result.records || [];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-list-item" data-id="${item.Id}" style="display: grid; grid-template-columns: 3fr 1fr; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid var(--sfarc-border, rgba(0, 0, 0, 0.08));">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.Name)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px);">${escapeHtml(item.Status)}</div>
                    </div>
                `;
            } else if (category === 'Flows') {
                // First get DurableId for the object
                var entityResult = await window.sfApi.query(`SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName = '${objectData.name}'`, true);
                var durableId = objectData.name;
                if (entityResult.records && entityResult.records.length > 0) {
                    durableId = entityResult.records[0].DurableId;
                }
                var result = await window.sfApi.query(`SELECT ApiName, Label, TriggerType, ProcessType, Description, ActiveVersionId, LatestVersionId FROM FlowDefinitionView WHERE TriggerObjectOrEventId = '${durableId}'`);
                items = result.records || [];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-grid-row" data-id="${item.ApiName}" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.Label)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${escapeHtml(item.ApiName)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${escapeHtml(item.ProcessType)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${escapeHtml(item.TriggerType)}</div>
                        <div class="sfarc-obj-cell-status ${item.ActiveVersionId ? 'is-active' : 'is-inactive'}" style="font-size: clamp(10px, 1vw + 4px, 12px);">${item.ActiveVersionId ? 'Active' : 'Inactive'}</div>
                    </div>
                `;
            } else if (category === 'ValidationRules') {
                try {
                    var result = await window.sfApi.query(`SELECT Id, ValidationName, Active, Description FROM ValidationRule WHERE EntityDefinitionId = '${objectData.name}' OR EntityDefinition.QualifiedApiName = '${objectData.name}'`, true);
                    items = (result && result.records) ? result.records : [];
                } catch (e) {
                    try {
                        var result = await window.sfApi.query(`SELECT Id, ValidationName, Active, Description FROM ValidationRule WHERE EntityDefinitionId = '${objectData.name}'`, true);
                        items = (result && result.records) ? result.records : [];
                    } catch (e2) {
                        items = [];
                    }
                }
                rowRenderer = (item) => `
                    <div class="sfarc-obj-grid-row" data-id="${item.Id}" style="display: grid; grid-template-columns: 2fr 1fr 3fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.ValidationName)}</div>
                        <div class="sfarc-obj-cell-status ${item.Active ? 'is-active' : 'is-inactive'}" style="font-size: clamp(10px, 1vw + 4px, 12px);">${item.Active ? 'Active' : 'Inactive'}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); word-break: break-word;">${escapeHtml(item.Description || '-')}</div>
                    </div>
                `;
            } else if (category === 'RecordTypes') {
                var result = await window.sfApi.query(`SELECT Id, Name, IsActive FROM RecordType WHERE SobjectType = '${objectData.name}'`);
                items = result.records || [];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-grid-row" data-id="${item.Id}" style="display: grid; grid-template-columns: 2fr 2fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.Name)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${escapeHtml(item.DeveloperName)}</div>
                        <div class="sfarc-obj-cell-status ${item.IsActive ? 'is-active' : 'is-inactive'}" style="font-size: clamp(10px, 1vw + 4px, 12px);">${item.IsActive ? 'Active' : 'Inactive'}</div>
                    </div>
                `;
            } else if (category === 'PageLayouts') {
                var result = await window.sfApi.query(`SELECT Id, Name FROM Layout WHERE TableEnumOrId = '${objectData.name}'`, true);
                items = result.records || [];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-grid-row" data-id="${item.Id}" style="display: grid; grid-template-columns: 3fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.Name)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px); font-family: monospace;">${escapeHtml(item.Id)}</div>
                    </div>
                `;
            } else if (category === 'Buttons') {
                var result = await window.sfApi.query(`SELECT Id, MasterLabel, Name, LinkType FROM WebLink WHERE PageOrSobjectType = '${objectData.name}'`);
                items = result.records || [];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-grid-row" data-id="${item.Id}" style="display: grid; grid-template-columns: 2fr 2fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.MasterLabel)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${escapeHtml(item.Name)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${escapeHtml(item.LinkType)}</div>
                    </div>
                `;
            } else if (category === 'LightningPages') {
                var result = await window.sfApi.query(`SELECT Id, DeveloperName, MasterLabel FROM FlexiPage WHERE EntityDefinitionId = '${objectData.name}' AND Type = 'RecordPage'`, true);
                items = result.records || [];
                rowRenderer = (item) => {
                    var dateStr = item.LastModifiedDate ? new Date(item.LastModifiedDate).toLocaleDateString() : 'N/A API';
                    var byName = item.LastModifiedById ? item.LastModifiedById : 'N/A API';
                    return `
                    <div class="sfarc-obj-grid-row" data-id="${item.Id}" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${escapeHtml(item.MasterLabel)}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${escapeHtml(item.DeveloperName)}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${dateStr}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${escapeHtml(byName)}</div>
                    </div>
                    `;
                };
            } else {
                items = [{ label: `View ${catLabel} in Setup`, isSetupLink: true }];
                rowRenderer = (item) => `
                    <div class="sfarc-obj-list-item" style="color: var(--primary-color, var(--sfarc-accent, var(--sfarc-accent, #2196f3)));">
                        ${item.label} &rarr;
                    </div>
                `;
            }

            var renderList = (filter) => {
                resultsContainer.innerHTML = '';

                if (items.length > 0) {
                    var headerHtml = '';
                    if (category === 'Fields') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr; align-items: stretch;">
                                <div>Name</div>
                                <div>API Name</div>
                                <div>Type</div>
                                <div>Last Modified</div>
                                <div>Modified By</div>
                            </div>`;
                    } else if (category === 'Triggers') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 3fr 1fr; align-items: stretch;">
                                <div>Name</div>
                                <div>Status</div>
                            </div>`;
                    } else if (category === 'Flows') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr 1fr; align-items: stretch;">
                                <div>Label</div>
                                <div>API Name</div>
                                <div>Process Type</div>
                                <div>Trigger Type</div>
                                <div>Status</div>
                            </div>`;
                    } else if (category === 'ValidationRules') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 1fr 3fr; align-items: stretch;">
                                <div>Name</div>
                                <div>Status</div>
                                <div>Description</div>
                            </div>`;
                    } else if (category === 'RecordTypes') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 2fr 1fr; align-items: stretch;">
                                <div>Name</div>
                                <div>API Name</div>
                                <div>Status</div>
                            </div>`;
                    } else if (category === 'PageLayouts') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 3fr 1fr; align-items: stretch;">
                                <div>Name</div>
                                <div>ID</div>
                            </div>`;
                    } else if (category === 'Buttons') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 2fr 1fr; align-items: stretch;">
                                <div>Label</div>
                                <div>API Name</div>
                                <div>Type</div>
                            </div>`;
                    } else if (category === 'LightningPages') {
                        headerHtml = `
                            <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items: stretch;">
                                <div>Label</div>
                                <div>API Name</div>
                                <div>Last Modified</div>
                                <div>Modified By</div>
                            </div>`;
                    }
                    if (headerHtml) {
                        resultsContainer.innerHTML = headerHtml;
                    }
                }

                var term = filter.toLowerCase();
                var filtered = items.filter(i =>
                    i.isSetupLink ||
                    (i.label && i.label.toLowerCase().includes(term)) ||
                    (i.name && i.name.toLowerCase().includes(term)) ||
                    (i.Name && i.Name.toLowerCase().includes(term)) ||
                    (i.ValidationName && i.ValidationName.toLowerCase().includes(term)) ||
                    (i.DeveloperName && i.DeveloperName.toLowerCase().includes(term)) ||
                    (i.Label && i.Label.toLowerCase().includes(term)) ||
                    (i.QualifiedApiName && i.QualifiedApiName.toLowerCase().includes(term)) ||
                    (i.MasterLabel && i.MasterLabel.toLowerCase().includes(term))
                );

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = getEmptyStateHtml('No items found.');
                    return;
                }

                filtered.forEach(item => {
                    var el = document.createElement('div');
                    el.innerHTML = rowRenderer(item);
                    var row = el.firstElementChild;

                    row.addEventListener('click', async () => {
                        if (item.isSetupLink) {
                        } else if (category === 'Flows') {
                            var flowId = item.ActiveVersionId || item.LatestVersionId;
                            if (flowId) {
                                window.open(`${window.sfApi.instanceUrl}/builder_platform_interaction/flowBuilder.app?flowId=${flowId}`, '_blank');
                            }
                        } else if (category === 'Fields') {
                            var fieldTarget = item.DurableId || item.QualifiedApiName || item.name;
                            // If fieldTarget is DurableId like "Account.00N..." extract the field ID portion
                            if (fieldTarget.includes('.')) {
                                var parts = fieldTarget.split('.');
                                fieldTarget = parts[1] || parts[0];
                            }
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/FieldsAndRelationships/${fieldTarget}/view`, '_blank');
                        } else if (category === 'Triggers') {
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ApexTriggers/page?address=/${item.Id}`, '_blank');
                        } else if (category === 'ValidationRules') {
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/ValidationRules/${item.Id}/view`, '_blank');
                        } else if (category === 'RecordTypes') {
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/RecordTypes/${item.Id}/view`, '_blank');
                        } else if (category === 'PageLayouts') {
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/PageLayouts/${item.Id}/view`, '_blank');
                        } else if (category === 'Buttons') {
                            window.open(`${window.sfApi.instanceUrl}/lightning/setup/ObjectManager/${objectData.name}/ButtonsLinksActions/${item.Id}/view`, '_blank');
                        } else if (category === 'LightningPages') {
                            window.open(`${window.sfApi.instanceUrl}/visualEditor/appBuilder.app?pageId=${item.Id}`, '_blank');
                        }
                    });
                    resultsContainer.appendChild(row);
                });
            };

            searchInput.addEventListener('input', (e) => renderList(e.target.value));
            renderList('');

        } catch (e) {
            resultsContainer.innerHTML = friendlyFetchError(e, null);
        }
    })();
}

window.anonApexEventsBound = false;
function bindAnonApexEvents() {
    var executeBtn = document.getElementById('sfarc-anon-execute-btn');
    var newTabBtn = document.getElementById('sfarc-anon-new-tab-btn');

    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'openExtensionPage',
                page: 'anonymous-apex',
                params: { host: window.location.hostname }
            });
        });
    }

    var editor = document.getElementById('sfarc-anon-apex-editor');
    var outputPanel = document.getElementById('sfarc-anon-output-panel');
    var outputTitle = document.getElementById('sfarc-anon-output-title');
    var outputContent = document.getElementById('sfarc-anon-output-content');
    var outputClose = document.getElementById('sfarc-anon-output-close');
    var historyBtn = document.getElementById('sfarc-anon-history-btn');
    var historyPanel = document.getElementById('sfarc-anon-history-panel');
    var historyClose = document.getElementById('sfarc-anon-history-close');
    var historyList = document.getElementById('sfarc-anon-history-list');

    // The anonymous Apex editor respects the code editor's Font Family setting
    // (stored under sfarc_editor_settings) — including the Helvetica option.
    // The three font elements must share the family so line numbers, the
    // syntax-highlight layer, and the caret text stay aligned.
    var anonFontEls = ['sfarc-anon-line-numbers', 'sfarc-anon-highlight', 'sfarc-anon-apex-editor']
        .map(id => document.getElementById(id))
        .filter(Boolean);
    function applyAnonEditorFont(family) {
        if (!family) return;
        anonFontEls.forEach(el => { el.style.fontFamily = family; });
    }
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['sfarc_editor_settings'], (res) => {
                var fam = res && res.sfarc_editor_settings && res.sfarc_editor_settings.fontFamily;
                if (fam) applyAnonEditorFont(fam);
            });
        }
    } catch (e) { /* font stays default */ }

    var history = JSON.parse(localStorage.getItem('sfarc-anon-history') || '[]');

    function saveHistory(code) {
        if (!code.trim()) return;
        history = history.filter(h => h.code !== code);
        history.unshift({ code, date: new Date().toISOString() });
        if (history.length > 50) history.pop();
        localStorage.setItem('sfarc-anon-history', JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div style="padding: 24px 16px; color: #8b949e; font-size: 12px; text-align: center;"><i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No recent scripts saved yet.</div>';
            return;
        }
        history.forEach((h, idx) => {
            var item = document.createElement('div');
            item.style.cssText = 'padding: 10px 14px; border-bottom: 1px solid #2d2d2d; cursor: pointer; font-family: "Consolas", "Courier New", monospace; font-size: 11px; transition: background 0.15s ease; background: #1e1e1e;';
            item.title = h.code;
            var date = new Date(h.date).toLocaleString();
            item.innerHTML = `
                <div style="color: #8b949e; font-size: 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-regular fa-clock" style="font-size: 10px; color: #4fc1ff;"></i>
                    <span>${date}</span>
                </div>
                <div style="color: #d4d4d4; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;">${h.code.replace(/</g, '&lt;').substring(0, 70)}${h.code.length > 70 ? '...' : ''}</div>
            `;
            item.addEventListener('mouseenter', () => item.style.background = '#2a2d2e');
            item.addEventListener('mouseleave', () => item.style.background = '#1e1e1e');
            item.addEventListener('click', () => {
                editor.value = h.code;
                if (typeof updateEditorState === 'function') updateEditorState();
                historyPanel.style.display = 'none';
            });
            historyList.appendChild(item);
        });
    }

    renderHistory();

    var explorerBtn = document.getElementById('sfarc-anon-explorer-btn');
    var explorerToolbar = document.getElementById('sfarc-anon-explorer-toolbar');
    var explorerClose = document.getElementById('sfarc-anon-explorer-close');
    var classSelect = document.getElementById('sfarc-explorer-class-select');
    var methodSelect = document.getElementById('sfarc-explorer-method-select');
    var insertBtn = document.getElementById('sfarc-explorer-insert-btn');

    var allApexClasses = [];
    var classesLoaded = false;
    var cachedMethods = [];

    explorerBtn.addEventListener('click', () => {
        explorerToolbar.style.display = explorerToolbar.style.display === 'none' ? 'flex' : 'none';
        if (explorerToolbar.style.display === 'flex' && !classesLoaded) {
            loadAllClasses();
        }
    });

    explorerClose.addEventListener('click', () => explorerToolbar.style.display = 'none');

    function loadAllClasses() {
        classSelect.innerHTML = '<option value="">Loading classes...</option>';
        window.sfApi.query('SELECT Id, Name, NamespacePrefix FROM ApexClass ORDER BY Name', true)
            .then(result => {
                allApexClasses = result.records.filter(r => !r.NamespacePrefix); // Exclude managed packages
                classSelect.innerHTML = '<option value="">-- Select an Apex Class --</option>';
                allApexClasses.forEach(cls => {
                    var opt = document.createElement('option');
                    opt.value = cls.Id;
                    opt.textContent = cls.Name;
                    classSelect.appendChild(opt);
                });
                classesLoaded = true;
            })
            .catch(err => {
                classSelect.innerHTML = `<option value="">Error loading classes</option>`;
            });
    }

    classSelect.addEventListener('change', async (e) => {
        var clsId = e.target.value;
        var clsName = e.target.options[e.target.selectedIndex].text;
        if (!clsId) {
            methodSelect.innerHTML = '<option value="">Select a class first</option>';
            methodSelect.disabled = true;
            insertBtn.disabled = true;
            cachedMethods = [];
            return;
        }

        methodSelect.innerHTML = '<option value="">Loading methods...</option>';
        methodSelect.disabled = true;
        insertBtn.disabled = true;

        try {
            var res = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/v60.0/tooling/sobjects/ApexClass/${clsId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            var data = await res.json();

            cachedMethods = [];

            var isTestClass = false;
            if (data.SymbolTable && data.SymbolTable.tableDeclaration && data.SymbolTable.tableDeclaration.annotations) {
                isTestClass = data.SymbolTable.tableDeclaration.annotations.some(a => a.name && a.name.toLowerCase() === 'istest');
            } else if (data.Body) {
                var beforeClass = data.Body.split(/\bclass\b/i)[0] || '';
                if (/@isTest\b/i.test(beforeClass)) {
                    isTestClass = true;
                }
            }

            if (isTestClass) {
                methodSelect.innerHTML = '<option value="">Cannot execute Test Classes</option>';
                return;
            }

            if (data.SymbolTable && data.SymbolTable.methods && data.SymbolTable.methods.length > 0) {
                cachedMethods = data.SymbolTable.methods.filter(m => {
                    return !(m.annotations || []).some(a => a.name && a.name.toLowerCase() === 'istest');
                });
            } else if (data.Body) {
                var methodRegex = /(?:global|public|private|protected)\s+(?:static\s+)?(?:[\w<>,\[\]]+\s+)+(\w+)\s*\((.*?)\)\s*\{/g;
                var match;
                while ((match = methodRegex.exec(data.Body)) !== null) {
                    if (!match[0].toLowerCase().includes('testmethod')) {
                        cachedMethods.push({ name: match[1], params: match[2], returnType: 'Object', fallback: true });
                    }
                }
            }

            if (cachedMethods.length === 0) {
                methodSelect.innerHTML = '<option value="">No methods found</option>';
            } else {
                methodSelect.innerHTML = '<option value="">-- Select a Method --</option>';
                cachedMethods.forEach((m, idx) => {
                    var opt = document.createElement('option');
                    opt.value = idx;

                    var paramStr = '';
                    if (m.parameters) {
                        paramStr = m.parameters.map(p => `${p.type} ${p.name}`).join(', ');
                    } else if (m.params) {
                        paramStr = m.params.trim();
                    }

                    opt.textContent = `${m.name}(${paramStr}) : ${m.returnType || 'void'}`;
                    methodSelect.appendChild(opt);
                });
                methodSelect.disabled = false;
            }

        } catch (err) {
            methodSelect.innerHTML = '<option value="">Error loading methods</option>';
        }
    });

    methodSelect.addEventListener('change', (e) => {
        insertBtn.disabled = !e.target.value;
    });

    function highlightApexCode(code) {
        if (!code) return '';
        var html = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        var tokens = [];
        var saveToken = (str, color, fontWeight = 'normal') => {
            var id = `___TOK${tokens.length}___`;
            tokens.push(`<span style="color: ${color}; font-weight: ${fontWeight};">${str}</span>`);
            return id;
        };

        // Strings
        html = html.replace(/('[^'\\]*(?:\\.[^'\\]*)*')|("[^"\\]*(?:\\.[^"\\]*)*")/g, m => saveToken(m, '#ce9178'));
        // Comments
        html = html.replace(/(\/\*[\s\S]*?\*\/)|(\/\/.*)/g, m => saveToken(m, '#6a9955'));
        // Apex & SOQL Keywords
        var keywords = ['public', 'private', 'protected', 'global', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'transient', 'virtual', 'abstract', 'override', 'void', 'return', 'if', 'else', 'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'new', 'null', 'true', 'false', 'this', 'super', 'insert', 'update', 'upsert', 'delete', 'undelete', 'merge', 'select', 'from', 'where', 'limit', 'offset', 'order', 'by', 'asc', 'desc', 'and', 'or', 'not', 'in', 'with', 'sharing', 'without'];
        var kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        html = html.replace(kwRegex, m => saveToken(m, '#569cd6', 'bold'));

        // Standard Types & Standard Classes
        var types = ['System', 'Database', 'Schema', 'String', 'Integer', 'Boolean', 'Decimal', 'Double', 'Long', 'Date', 'Datetime', 'Time', 'Id', 'Object', 'Blob', 'List', 'Set', 'Map', 'PageReference', 'ApexPages', 'JSON', 'Http', 'HttpRequest', 'HttpResponse', 'Account', 'Contact', 'Opportunity', 'Lead', 'User', 'Task', 'Event', 'Case'];
        var typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
        html = html.replace(typeRegex, m => saveToken(m, '#4ec9b0'));

        // Method calls
        html = html.replace(/\b([a-zA-Z0-9_]+)(?=\s*\()/g, m => {
            if (m.startsWith('___TOK')) return m;
            return saveToken(m, '#dcdcaa');
        });

        // Numbers
        html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, m => {
            if (m.startsWith('___TOK')) return m;
            return saveToken(m, '#b5cea8');
        });

        // Restore tokens
        tokens.forEach((tok, i) => {
            html = html.replace(`___TOK${i}___`, tok);
        });

        if (html.endsWith('\n')) html += ' ';
        return html;
    }

    var highlightEl = document.getElementById('sfarc-anon-highlight');
    var lineNumbersEl = document.getElementById('sfarc-anon-line-numbers');

    function updateEditorState() {
        if (!editor) return;
        var val = editor.value || '';
        if (highlightEl) {
            highlightEl.innerHTML = highlightApexCode(val);
        }
        if (lineNumbersEl) {
            var count = val.split('\n').length || 1;
            var nums = '';
            for (let i = 1; i <= count; i++) {
                nums += i + '<br>';
            }
            lineNumbersEl.innerHTML = nums;
        }
    }

    if (editor) {
        editor.addEventListener('input', updateEditorState);
        editor.addEventListener('scroll', () => {
            if (highlightEl) {
                highlightEl.scrollTop = editor.scrollTop;
                highlightEl.scrollLeft = editor.scrollLeft;
            }
            if (lineNumbersEl) {
                lineNumbersEl.scrollTop = editor.scrollTop;
            }
        });
    }

    insertBtn.addEventListener('click', () => {
        var idx = methodSelect.value;
        var clsName = classSelect.options[classSelect.selectedIndex].text;
        var method = cachedMethods[idx];
        if (!method) return;

        var code = '';
        var paramsCode = '';

        if (method.parameters && method.parameters.length > 0) {
            paramsCode = method.parameters.map(p => `/*${p.type} ${p.name}*/ null`).join(', ');
        } else if (method.params) {
            paramsCode = method.params.split(',').map(p => {
                var parts = p.trim().split(/\s+/);
                if (parts.length >= 2) return `/*${parts[0]} ${parts[1]}*/ null`;
                return `null`;
            }).filter(p => p !== 'null').join(', ');
        }

        var retType = method.returnType || 'void';
        if (retType.toLowerCase() !== 'void') {
            code += `${retType} result = `;
        }

        code += `${clsName}.${method.name}(${paramsCode});\n`;
        if (retType.toLowerCase() !== 'void') {
            code += `System.debug(result);\n`;
        }

        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + code + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + code.length;
        editor.focus();
        updateEditorState();
    });

    historyBtn.addEventListener('click', () => {
        historyPanel.style.display = historyPanel.style.display === 'none' ? 'flex' : 'none';
    });

    historyClose.addEventListener('click', () => historyPanel.style.display = 'none');
    outputClose.addEventListener('click', () => outputPanel.style.display = 'none');

    editor.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var start = this.selectionStart;
            var end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
            updateEditorState();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            executeBtn.click();
        }
    });

    // Initial sync
    updateEditorState();

    var realtimeDebugChk = document.getElementById('sfarc-anon-realtime-debug-chk');
    var tabsBar = document.getElementById('sfarc-anon-tabs-bar');
    var tabDebug = document.getElementById('sfarc-anon-tab-debug');
    var tabSummary = document.getElementById('sfarc-anon-tab-summary');
    var tabRaw = document.getElementById('sfarc-anon-tab-raw');

    if (realtimeDebugChk) {
        var savedPref = localStorage.getItem('sfarc-anon-realtime-debug');
        if (savedPref !== null) {
            realtimeDebugChk.checked = savedPref !== 'false';
        }
        realtimeDebugChk.addEventListener('change', () => {
            localStorage.setItem('sfarc-anon-realtime-debug', realtimeDebugChk.checked);
        });
    }

    var anonExecutionResultState = {
        activeTab: 'debug',
        debugContent: '',
        summaryContent: '',
        rawLogContent: ''
    };

    function setActiveTab(tabName) {
        anonExecutionResultState.activeTab = tabName;
        [tabDebug, tabSummary, tabRaw].forEach(btn => {
            if (!btn) return;
            btn.style.background = 'transparent';
            btn.style.borderColor = '#444';
            btn.style.color = '#aaa';
        });

        if (tabName === 'debug' && tabDebug) {
            tabDebug.style.background = 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25)';
            tabDebug.style.borderColor = 'var(--sfarc-accent, var(--sfarc-accent, #2196f3))';
            tabDebug.style.color = '#4fc1ff';
            outputContent.innerHTML = anonExecutionResultState.debugContent || '<div style="color:#aaa;">No System.debug logs available.</div>';
        } else if (tabName === 'summary' && tabSummary) {
            tabSummary.style.background = 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25)';
            tabSummary.style.borderColor = 'var(--sfarc-accent, var(--sfarc-accent, #2196f3))';
            tabSummary.style.color = '#4fc1ff';
            outputContent.innerHTML = anonExecutionResultState.summaryContent || '<div style="color:#aaa;">No summary available.</div>';
        } else if (tabName === 'raw' && tabRaw) {
            tabRaw.style.background = 'rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25)';
            tabRaw.style.borderColor = 'var(--sfarc-accent, var(--sfarc-accent, #2196f3))';
            tabRaw.style.color = '#4fc1ff';
            outputContent.innerHTML = anonExecutionResultState.rawLogContent ?
                `<pre style="margin: 0; white-space: pre-wrap; word-break: break-all; color: #d4d4d4; font-family: inherit; font-size: 11px;">${escapeHtml(anonExecutionResultState.rawLogContent)}</pre>` :
                '<div style="color:#aaa;">No raw log available.</div>';
        }
    }

    if (tabDebug) tabDebug.addEventListener('click', () => setActiveTab('debug'));
    if (tabSummary) tabSummary.addEventListener('click', () => setActiveTab('summary'));
    if (tabRaw) tabRaw.addEventListener('click', () => setActiveTab('raw'));

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function parseUserDebugLogs(logBody) {
        if (!logBody) return [];
        var lines = logBody.split(/\r?\n/);
        var debugEntries = [];
        var currentEntry = null;

        var userDebugRegex = /^(\d{2}:\d{2}:\d{2}\.\d+)\s*\([^)]*\)\|USER_DEBUG\|(?:\[(\d+)\]\|)?(?:([A-Z]+)\|)?(.*)$/;
        var logLineStartRegex = /^\d{2}:\d{2}:\d{2}\.\d+\s*\([^)]*\)\|/;

        for (let i = 0; i < lines.length; i++) {
            var line = lines[i];
            var match = line.match(userDebugRegex);
            if (match) {
                if (currentEntry) {
                    debugEntries.push(currentEntry);
                }
                currentEntry = {
                    timestamp: match[1],
                    lineNum: match[2] || '?',
                    level: match[3] || 'DEBUG',
                    message: match[4] || ''
                };
            } else if (currentEntry) {
                if (logLineStartRegex.test(line)) {
                    debugEntries.push(currentEntry);
                    currentEntry = null;
                } else {
                    currentEntry.message += '\n' + line;
                }
            }
        }
        if (currentEntry) {
            debugEntries.push(currentEntry);
        }
        return debugEntries;
    }

    async function ensureTraceFlagForUser(userId) {
        if (!userId) return false;
        try {
            var nowIso = new Date().toISOString();
            var checkQuery = `SELECT Id, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND ExpirationDate > ${nowIso} LIMIT 1`;
            var res = await window.sfApi.query(checkQuery, true);
            if (res && res.records && res.records.length > 0) {
                return true;
            }

            var debugLevelId = null;
            var levelQuery = "SELECT Id FROM DebugLevel WHERE DeveloperName = 'SFDC_DevConsole' LIMIT 1";
            var levelResult = await window.sfApi.query(levelQuery, true);
            if (levelResult && levelResult.records && levelResult.records.length > 0) {
                debugLevelId = levelResult.records[0].Id;
            } else {
                var anyLevelRes = await window.sfApi.query("SELECT Id FROM DebugLevel LIMIT 1", true);
                if (anyLevelRes && anyLevelRes.records && anyLevelRes.records.length > 0) {
                    debugLevelId = anyLevelRes.records[0].Id;
                }
            }

            if (!debugLevelId) return false;

            var traceFlag = {
                TracedEntityId: userId,
                DebugLevelId: debugLevelId,
                StartDate: new Date().toISOString(),
                ExpirationDate: new Date(Date.now() + 30 * 60000).toISOString(),
                LogType: 'USER_DEBUG'
            };

            var createRes = await window.sfApi.create('TraceFlag', traceFlag, true);
            return createRes && createRes.success;
        } catch (e) {
            console.warn('salesforce comet: Auto TraceFlag error:', e.message);
            return false;
        }
    }

    executeBtn.addEventListener('click', async () => {
        var code = editor.value;
        if (!code.trim()) {
            code = "System.debug('Hello World!');";
            editor.value = code;
            updateEditorState();
        }

        saveHistory(code);
        executeBtn.innerHTML = '<span class="comet-loader-inline"></span> Executing...';
        executeBtn.disabled = true;
        outputPanel.style.display = 'flex';
        outputTitle.innerHTML = '<span class="comet-loader-inline"></span> Executing...';
        outputTitle.style.color = '#4fc1ff';
        if (tabsBar) tabsBar.style.display = 'none';

        var isRealtimeDebug = realtimeDebugChk ? realtimeDebugChk.checked : true;
        var userId = window.currentUserId;
        if (isRealtimeDebug && !userId && typeof getCurrentUserInfo === 'function') {
            var userInfo = await getCurrentUserInfo();
            if (userInfo) userId = userInfo.id;
        }

        var executionStartTime = new Date(Date.now() - 3000);

        if (isRealtimeDebug && userId) {
            outputContent.innerHTML = '<div style="color: #81d4fa;"><span class="comet-loader-inline"></span> Verifying Debug TraceFlag & Executing Apex...</div>';
            await ensureTraceFlagForUser(userId);
        } else {
            outputContent.innerHTML = '<div style="color: #81d4fa;"><span class="comet-loader-inline"></span> Executing Anonymous Apex...</div>';
        }

        try {
            var url = window.sfApi.instanceUrl + '/services/data/v60.0/tooling/executeAnonymous/?anonymousBody=' + encodeURIComponent(code);
            var response = await window.sfApi.fetch(url);
            var result = await response.json();

            var summaryHtml = '';
            var isSuccess = false;

            if (response.ok && result.success) {
                isSuccess = true;
                outputTitle.innerHTML = '<i class="fa-solid fa-check-circle" style="color: #4caf50; margin-right: 5px;"></i> Success';
                outputTitle.style.color = '#4caf50';
                summaryHtml = '<div style="color: #a5d6a7;"><i class="fa-solid fa-check-circle" style="color: #4caf50; margin-right: 6px;"></i>Execution completed successfully.</div>';
            } else if (result.success === false) {
                outputTitle.innerHTML = '<i class="fa-solid fa-times-circle" style="color: #f44336; margin-right: 5px;"></i> Execution Failed';
                outputTitle.style.color = '#f44336';
                if (!result.compiled) {
                    summaryHtml = `<div style="color: #ef9a9a;"><strong>Compile Error at Line ${result.line}, Column ${result.column}:</strong>\n${escapeHtml(result.compileProblem)}</div>`;
                } else {
                    summaryHtml = `<div style="color: #ef9a9a;"><strong>Runtime Exception:</strong>\n${escapeHtml(result.exceptionMessage)}\n\n<strong>Stack Trace:</strong>\n${escapeHtml(result.exceptionStackTrace)}</div>`;
                }
            } else if (Array.isArray(result) && result[0] && result[0].errorCode) {
                outputTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #ff9800; margin-right: 5px;"></i> API Error';
                outputTitle.style.color = '#ff9800';
                summaryHtml = `<div style="color: #ffcc80;">${escapeHtml(result[0].errorCode)}: ${escapeHtml(result[0].message)}</div>`;
            } else {
                throw new Error("Unknown error occurred");
            }

            anonExecutionResultState.summaryContent = summaryHtml;
            anonExecutionResultState.rawLogContent = '';

            var debugEntries = [];
            var fetchedRawLog = '';

            if (isRealtimeDebug && userId && result.compiled !== false) {
                outputContent.innerHTML = '<div style="color: #81d4fa;"><span class="comet-loader-inline"></span> Fetching real-time System.debug output...</div>';

                var formattedStartTime = executionStartTime.toISOString();
                var logQuery = `SELECT Id, Operation, Status, DurationMilliseconds, LogLength, StartTime FROM ApexLog WHERE LogUserId = '${userId}' AND StartTime >= ${formattedStartTime} ORDER BY StartTime DESC LIMIT 1`;

                var logRecords = [];
                try {
                    var logRes = await window.sfApi.query(logQuery, true);
                    logRecords = logRes?.records || [];
                    if (logRecords.length === 0) {
                        var fallbackQuery = `SELECT Id, Operation, Status, DurationMilliseconds, LogLength, StartTime FROM ApexLog WHERE LogUserId = '${userId}' ORDER BY StartTime DESC LIMIT 1`;
                        var fallbackRes = await window.sfApi.query(fallbackQuery, true);
                        logRecords = fallbackRes?.records || [];
                    }
                } catch (err) {
                    console.warn('salesforce comet: Log query error:', err);
                }

                if (logRecords.length > 0) {
                    var logId = logRecords[0].Id;
                    try {
                        var bodyRes = await window.sfApi.fetch(`${window.sfApi.instanceUrl}/services/data/v60.0/tooling/sobjects/ApexLog/${logId}/Body`);
                        if (bodyRes.ok) {
                            fetchedRawLog = await bodyRes.text();
                            debugEntries = parseUserDebugLogs(fetchedRawLog);
                        }
                    } catch (err) {
                        console.warn('salesforce comet: Fetch log body error:', err);
                    }
                }
            }

            anonExecutionResultState.rawLogContent = fetchedRawLog;

            var debugHtml = '';
            if (debugEntries.length > 0) {
                debugHtml = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 3px; font-size: 10.5px; color: var(--sfarc-muted-text, #94a3b8);">
                        <span><i class="fa-solid fa-terminal" style="color: #4fc1ff; margin-right: 4px;"></i><strong>System.debug Outputs (${debugEntries.length})</strong></span>
                        <span style="font-size: 9.5px; color: var(--sfarc-secondary-text, #64748b);">Live Log Captured</span>
                    </div>
                    ${debugEntries.map(entry => `
                        <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid var(--sfarc-accent, var(--sfarc-accent, #2196f3)); padding: 4px 8px; border-radius: 0 4px 4px 0; font-size: 11.5px; line-height: 1.35; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                            <span style="color: #4fc1ff; font-size: 10px; user-select: none;">${escapeHtml(entry.timestamp)}</span>
                            <span style="color: #ffc107; font-weight: bold; font-size: 10px; user-select: none;">[Line ${escapeHtml(entry.lineNum)}]</span>
                            <span style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.2); color: #4fc1ff; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 500; user-select: none;">${escapeHtml(entry.level)}</span>
                            <span style="color: #ffffff; white-space: pre-wrap; word-break: break-word; flex: 1; min-width: 120px;">${escapeHtml(entry.message)}</span>
                        </div>
                    `).join('')}
                </div>`;
            } else if (isRealtimeDebug && isSuccess) {
                debugHtml = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="color: #a5d6a7; padding: 6px 0;">
                        <i class="fa-solid fa-check-circle" style="color: #4caf50; margin-right: 6px;"></i>
                        Execution completed successfully.
                    </div>
                    <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: 11px; font-style: italic; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 4px; border: 1px dashed #333;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 4px; color: #4fc1ff;"></i>
                        No <code>System.debug(...)</code> statements were executed in this Apex script.
                    </div>
                </div>`;
            } else {
                debugHtml = summaryHtml;
            }

            anonExecutionResultState.debugContent = debugHtml;

            if (tabsBar) tabsBar.style.display = 'flex';

            if (isRealtimeDebug && debugEntries.length > 0) {
                setActiveTab('debug');
            } else if (!isSuccess || !isRealtimeDebug) {
                setActiveTab('summary');
            } else {
                setActiveTab('debug');
            }

        } catch (e) {
            outputPanel.style.display = 'flex';
            outputTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #ff9800; margin-right: 5px;"></i> Error';
            outputTitle.style.color = '#ff9800';
            outputContent.style.color = '#ffcc80';
            outputContent.textContent = "Network or API Error: " + e.message;
            if (tabsBar) tabsBar.style.display = 'none';
        } finally {
            executeBtn.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right: 5px;"></i> Run Code';
            executeBtn.disabled = false;
        }
    });
}

function bindBulkUpdaterEvents() {
    var targetTypeInput = document.getElementById('sfarc-bulk-target-type');
    var targetNameInput = document.getElementById('sfarc-bulk-target-name');
    var suggestionsBox = document.getElementById('sfarc-bulk-target-suggestions');
    var objSearch = document.getElementById('sfarc-bulk-obj-search');
    var objList = document.getElementById('sfarc-bulk-obj-list');
    var objSelectAll = document.getElementById('sfarc-bulk-obj-selectall');

    var next1Btn = document.getElementById('sfarc-bulk-next1-btn');
    var back1Btn = document.getElementById('sfarc-bulk-back1-btn');
    var next1bBtn = document.getElementById('sfarc-bulk-next1b-btn');

    var back2Btn = document.getElementById('sfarc-bulk-back2-btn');
    var next2Btn = document.getElementById('sfarc-bulk-next2-btn');

    var fldSearch = document.getElementById('sfarc-bulk-fld-search');
    var fldList = document.getElementById('sfarc-bulk-fld-list');
    var fldSelectAll = document.getElementById('sfarc-bulk-fld-selectall');

    var chkRead = document.getElementById('sfarc-bulk-chk-Read');
    var chkEdit = document.getElementById('sfarc-bulk-chk-Edit');

    var step1 = document.getElementById('sfarc-bulk-step1');
    var step2 = document.getElementById('sfarc-bulk-step2');
    var step3 = document.getElementById('sfarc-bulk-step3');
    var step4 = document.getElementById('sfarc-bulk-step4');

    var ind1 = document.getElementById('sfarc-wiz-ind-1');
    var ind2 = document.getElementById('sfarc-wiz-ind-2');
    var ind3 = document.getElementById('sfarc-wiz-ind-3');
    var ind4 = document.getElementById('sfarc-wiz-ind-4');

    var back4Btn = document.getElementById('sfarc-bulk-back4-btn');
    var executeBtn = document.getElementById('sfarc-bulk-execute-btn');
    var abortBtn = document.getElementById('sfarc-bulk-abort-btn');
    var rollbackBtn = document.getElementById('sfarc-bulk-rollback-btn');

    var allObjects = [];
    var selectedObjects = [];
    var allFields = [];
    var selectedFields = [];
    var selectedObjectPerms = {};
    var selectedRecordTypes = [];
    var parentId = null;

    var fieldPermsToApply = {};

    var debounceTimer;

    targetNameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        var val = e.target.value.trim();
        if (!val || val.length < 2) {
            suggestionsBox.style.display = 'none';
            parentId = null;
            return;
        }

        debounceTimer = setTimeout(async () => {
            var type = targetTypeInput.value;
            var safeVal = escapeSoqlLikeLiteral(val);
            var q = '';
            if (type === 'PermissionSet') {
                q = `SELECT Id, Name, Label FROM PermissionSet WHERE Name LIKE '%${safeVal}%' OR Label LIKE '%${safeVal}%' LIMIT 10`;
            } else {
                q = `SELECT Id, Name FROM Profile WHERE Name LIKE '%${safeVal}%' LIMIT 10`;
            }

            try {
                var res = await window.sfApi.query(q);
                if (res && res.records && res.records.length > 0) {
                    suggestionsBox.innerHTML = res.records.map(r => {
                        const id = escapeHtml(r.Id || '');
                        const name = escapeHtml(r.Name || r.Label || '');
                        return `<div class="sfarc-suggestion-item" data-id="${id}" data-name="${name}">${name}</div>`;
                    }).join('');
                    suggestionsBox.style.display = 'block';

                    document.querySelectorAll('.sfarc-suggestion-item').forEach(item => {
                        item.addEventListener('click', async (evt) => {
                            targetNameInput.value = evt.target.dataset.name;
                            var targetId = evt.target.dataset.id;
                            suggestionsBox.style.display = 'none';

                            if (type === 'Profile') {
                                try {
                                    var psRes = await window.sfApi.query(`SELECT Id FROM PermissionSet WHERE ProfileId = '${targetId}' LIMIT 1`);
                                    if (psRes && psRes.records && psRes.records.length > 0) {
                                        parentId = psRes.records[0].Id;
                                    } else {
                                        toast.error('Could not find associated Permission Set for this Profile.');
                                        parentId = null;
                                    }
                                } catch (err) {
                                    console.error('Failed to resolve Profile to Permission Set', err);
                                    parentId = null;
                                }
                            } else {
                                parentId = targetId;
                            }
                        });
                    });
                } else {
                    suggestionsBox.innerHTML = `<div class="sfarc-suggestion-item sfarc-suggestion-empty">No matches found</div>`;
                    suggestionsBox.style.display = 'block';
                }
            } catch (e) {
                // Silent — best effort suggestion loading, fallback is showing nothing
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!suggestionsBox.contains(e.target) && e.target !== targetNameInput) {
            suggestionsBox.style.display = 'none';
        }
    });

    var loadObjects = async () => {
        try {
            var res = await window.sfApi.fetch(`/services/data/${window.sfApi.apiVersion}/sobjects`);
            var json = await res.json();
            if (json && json.sobjects) {
                allObjects = json.sobjects.map(o => ({
                    name: o.name,
                    label: o.label
                })).sort((a, b) => a.name.localeCompare(b.name));
                renderObjects();
            }
        } catch (e) {
            objList.innerHTML = `<div class="sfarc-bw-empty" style="color: #ef4444 !important;">Failed to load objects: ${window.escapeHtml(e.message)}</div>`;
        }
    };

    var renderObjects = () => {
        var term = objSearch.value.toLowerCase();
        var filtered = allObjects.filter(o => o.name.toLowerCase().includes(term) || o.label.toLowerCase().includes(term));

        objList.innerHTML = filtered.map(o => `
            <label class="sfarc-bulk-obj-row" title="${escapeHtml(o.label || o.name)}">
                <input type="checkbox" class="sfarc-obj-chk" value="${escapeHtml(o.name)}">
                <span class="sfarc-bulk-obj-name">${escapeHtml(o.name)}</span>
                ${o.label && o.label.toLowerCase() !== o.name.toLowerCase()
                    ? `<span class="sfarc-bulk-obj-label">${escapeHtml(o.label)}</span>` : ''}
            </label>
        `).join('');

        var countEl = document.getElementById('sfarc-bulk-obj-count');
        if (countEl) countEl.textContent = filtered.length + ' objects';

        objSelectAll.checked = false;
        objSelectAll.onchange = (e) => {
            var isChecked = e.target.checked;
            document.querySelectorAll('.sfarc-obj-chk').forEach(chk => {
                chk.checked = isChecked;
            });
        };
    };

    objSearch.addEventListener('input', renderObjects);

    var setStep = (stepNum) => {
        step1.style.display = stepNum === 1 ? 'flex' : 'none';
        step2.style.display = stepNum === 2 ? 'flex' : 'none';
        step3.style.display = stepNum === 3 ? 'flex' : 'none';
        step4.style.display = stepNum === 4 ? 'flex' : 'none';

        [ind1, ind2, ind3, ind4].forEach((el, i) => {
            if (!el) return;
            var s = i + 1;
            el.classList.remove('active', 'done', 'upcoming');
            if (s < stepNum) el.classList.add('done');
            else if (s === stepNum) el.classList.add('active');
            else el.classList.add('upcoming');
            var num = el.querySelector('.sfarc-wiz-num');
            if (num) num.textContent = s < stepNum ? '\u2713' : String(s);
        });
    };

    next1Btn.addEventListener('click', async () => {
        if (!targetNameInput.value.trim() || !parentId) {
            toast.error('Please select a Target Profile or Permission Set from the dropdown suggestions.');
            return;
        }

        selectedObjects = Array.from(document.querySelectorAll('.sfarc-obj-chk:checked')).map(chk => chk.value);
        if (selectedObjects.length === 0) {
            toast.error('Please select at least one object.');
            return;
        }

        setStep(2);
        var permsList = document.getElementById('sfarc-bulk-obj-perms-list');
        permsList.innerHTML = `<div class="sfarc-bw-empty">Loading Object & Record Type settings...</div>`;

        var html = `<div class="sfarc-bw-section-title">Object Permissions</div>`;
        html += `
        <div class="sfarc-bw-master-panel">
            <div class="sfarc-bw-master-panel-title"><i class="fa-solid fa-bolt"></i> Bulk Select All Objects</div>
            <div class="sfarc-bw-perm-grid">
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsRead"> Read</label>
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsCreate"> Create</label>
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsEdit"> Edit</label>
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsDelete"> Delete</label>
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsViewAllRecords"> View All</label>
                <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsModifyAllRecords"> Modify All</label>
            </div>
        </div>`;
        selectedObjects.forEach(obj => {
            html += `
            <div class="sfarc-bw-perm-card">
                <div class="sfarc-bw-perm-card-title">${escapeHtml(obj)}</div>
                <div class="sfarc-bw-perm-grid">
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsRead"> Read</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsCreate"> Create</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsEdit"> Edit</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsDelete"> Delete</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsViewAllRecords"> View All</label>
                    <label><input type="checkbox" class="sfarc-obj-perm-chk" data-obj="${escapeHtml(obj)}" value="PermissionsModifyAllRecords"> Modify All</label>
                </div>
            </div>`;
        });

        permsList.innerHTML = html;

        // Wire up the master checkboxes
        document.querySelectorAll('.sfarc-obj-perm-master').forEach(master => {
            master.addEventListener('change', (e) => {
                var perm = e.target.value;
                var isChecked = e.target.checked;
                document.querySelectorAll(`.sfarc-obj-perm-chk[value="${perm}"]`).forEach(chk => {
                    chk.checked = isChecked;
                });
            });
        });

        try {
            var rtIn = selectedObjects.map(o => `'${o}'`).join(',');
            var rtQuery = `SELECT Id, Name, SobjectType FROM RecordType WHERE SobjectType IN (${rtIn}) AND IsActive = true`;
            var rtRes = await window.sfApi.query(rtQuery);
            if (rtRes && rtRes.records && rtRes.records.length > 0) {
                var rtHtml = `<div class="sfarc-bw-section-title sfarc-bw-rt-head">
                    <span>Record Type Access</span>
                    <label class="sfarc-bw-chk"><input type="checkbox" id="sfarc-rt-selectall"> Select All</label>
                </div>`;
                rtRes.records.forEach(rt => {
                    rtHtml += `
                    <div class="sfarc-bw-rt-row">
                        <div class="sfarc-bw-rt-name">${escapeHtml(rt.Name)} <span class="sfarc-bw-rt-type">(${escapeHtml(rt.SobjectType)})</span></div>
                        <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-rt-chk" value="${rt.Id}"> Grant Access</label>
                    </div>`;
                });
                permsList.innerHTML += rtHtml;

                var rtSelectAll = document.getElementById('sfarc-rt-selectall');
                if (rtSelectAll) {
                    rtSelectAll.addEventListener('change', (e) => {
                        document.querySelectorAll('.sfarc-rt-chk').forEach(chk => chk.checked = e.target.checked);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to fetch RecordTypes:', e);
        }
    });

    back1Btn.addEventListener('click', () => setStep(1));

    next1bBtn.addEventListener('click', async () => {
        selectedObjectPerms = {};
        document.querySelectorAll('.sfarc-obj-perm-chk:checked').forEach(chk => {
            var obj = chk.dataset.obj;
            var perm = chk.value;
            if (!selectedObjectPerms[obj]) selectedObjectPerms[obj] = {};
            selectedObjectPerms[obj][perm] = true;
        });

        selectedRecordTypes = Array.from(document.querySelectorAll('.sfarc-rt-chk:checked')).map(chk => chk.value);

        setStep(3);
        fldList.innerHTML = `<div class="sfarc-bw-empty">Fetching fields for ${selectedObjects.length} objects...</div>`;

        try {
            allFields = [];
            for (const objName of selectedObjects) {
                try {
                    var res = await window.sfApi.describeSObject(objName);
                    if (res && res.fields) {
                        res.fields.forEach(f => {
                            allFields.push({
                                objName: objName,
                                name: f.name,
                                label: f.label,
                                apiName: `${objName}.${f.name}`
                            });
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to describe ${objName}:`, err);
                }
            }
            allFields.sort((a, b) => a.apiName.localeCompare(b.apiName));
            renderFields();
        } catch (e) {
            fldList.innerHTML = `<div class="sfarc-bw-empty" style="color: #ef4444 !important;">Error loading fields: ${window.escapeHtml(e.message)}</div>`;
        }
    });

    var actionModeSelect = document.getElementById('sfarc-bulk-action-mode');

    var renderFields = () => {
        var isRevokeMode = actionModeSelect ? (actionModeSelect.value === 'revoke') : false;
        var term = fldSearch.value.toLowerCase();
        var filtered = allFields.filter(f => f.apiName.toLowerCase().includes(term) || f.label.toLowerCase().includes(term));

        var readLabel = isRevokeMode ? '<span style="color: #f44336; font-weight: 500;">Revoke Read</span>' : 'Read';
        var editLabel = isRevokeMode ? '<span style="color: #f44336; font-weight: 500;">Revoke Edit</span>' : 'Edit';

        fldList.innerHTML = filtered.map(f => `
            <div class="sfarc-bw-fld-row">
                <div class="sfarc-bw-fld-name">${escapeHtml(f.apiName)} <span class="sfarc-bw-fld-label">(${escapeHtml(f.label)})</span></div>
                <div class="sfarc-bw-fld-perms">
                    <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-fld-chk-read" data-api="${f.apiName}"> ${readLabel}</label>
                    <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-fld-chk-edit" data-api="${f.apiName}"> ${editLabel}</label>
                </div>
            </div>
        `).join('');

        // Master toggle logic
        fldSelectAll.checked = false;
        fldSelectAll.onchange = (e) => {
            var isChecked = e.target.checked;
            var applyRead = chkRead.checked;
            var applyEdit = chkEdit.checked;

            document.querySelectorAll('.sfarc-fld-chk-read').forEach(chk => chk.checked = isChecked && applyRead);
            document.querySelectorAll('.sfarc-fld-chk-edit').forEach(chk => chk.checked = isChecked && applyEdit);
        };
    };

    if (actionModeSelect) {
        actionModeSelect.addEventListener('change', renderFields);
    }

    fldSearch.addEventListener('input', renderFields);

    back2Btn.addEventListener('click', () => setStep(2));

    next2Btn.addEventListener('click', () => {
        fieldPermsToApply = {};
        var readCount = 0;
        var editCount = 0;

        var isRevokeMode = actionModeSelect ? (actionModeSelect.value === 'revoke') : false;

        document.querySelectorAll('.sfarc-fld-chk-read').forEach(chk => {
            if (chk.checked) {
                var api = chk.dataset.api;
                if (!fieldPermsToApply[api]) fieldPermsToApply[api] = {};
                fieldPermsToApply[api].Read = isRevokeMode ? false : true;
                readCount++;
            }
        });
        document.querySelectorAll('.sfarc-fld-chk-edit').forEach(chk => {
            if (chk.checked) {
                var api = chk.dataset.api;
                if (!fieldPermsToApply[api]) fieldPermsToApply[api] = {};
                fieldPermsToApply[api].Edit = isRevokeMode ? false : true;
                editCount++;
            }
        });

        selectedFields = Object.keys(fieldPermsToApply);

        setStep(4);
        window._sfarcFieldPermsToApply = fieldPermsToApply;
        window._sfarcIsRevokeMode = isRevokeMode;

        var actionText = isRevokeMode ? 'REVOKE access from' : 'grant access to';
        var actionColor = isRevokeMode ? '#f44336' : 'var(--primary-color)';

        document.getElementById('sfarc-bulk-summary-text').innerHTML = `
            You are about to <strong style="color: ${actionColor};">${actionText}</strong> <strong>${escapeHtml(targetNameInput.value)}</strong>:<br>
            <span style="font-size:13px; color:var(--sfarc-secondary-text);">
            ${Object.keys(selectedObjectPerms).length} Objects, ${selectedRecordTypes.length} Record Types, ${selectedFields.length} Fields (${readCount} Read, ${editCount} Edit)
            </span>
        `;
    });

    back4Btn.addEventListener('click', () => setStep(3));

    executeBtn.addEventListener('click', async () => {
        executeBtn.style.display = 'none';
        back4Btn.style.display = 'none';
        rollbackBtn.style.display = 'none';
        abortBtn.style.display = 'block';

        window._sfarcAbortSignal = false;
        window._sfarcOriginalFieldPerms = new Map();

        var progressContainer = document.getElementById('sfarc-bulk-progress-container');
        var progressBar = document.getElementById('sfarc-bulk-progress-bar');
        var progressText = document.getElementById('sfarc-bulk-progress-text');
        var resultsList = document.getElementById('sfarc-bulk-results-list');

        progressContainer.style.display = 'block';
        resultsList.style.display = 'block';
        resultsList.innerHTML = `<div class="sfarc-bw-empty">Starting updates...</div>`;
        progressBar.style.width = '0%';
        progressText.innerText = '0%';

        var fieldPerms = window._sfarcFieldPermsToApply || {};
        var isRevokeMode = window._sfarcIsRevokeMode || false;

        try {
            var compositeRequests = [];

            // =========================
            // 1. OBJECT PERMISSIONS
            // =========================
            var objApiNames = Object.keys(selectedObjectPerms);
            if (objApiNames.length > 0) {
                objApiNames.forEach(f => window._sfarcOriginalFieldPerms.set('OBJ_' + f, { exists: false }));
                var objChunkSize = 30;
                var existingObjMap = new Map();

                for (let i = 0; i < objApiNames.length; i += objChunkSize) {
                    var chunk = objApiNames.slice(i, i + objChunkSize);
                    var inClause = chunk.map(n => `'${n}'`).join(',');
                    var existingQuery = `SELECT Id, SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${parentId}' AND SobjectType IN (${inClause})`;
                    var existingRes = await window.sfApi.query(existingQuery);
                    if (existingRes && existingRes.records) {
                        existingRes.records.forEach(r => {
                            existingObjMap.set(r.SobjectType, r.Id);
                            window._sfarcOriginalFieldPerms.set('OBJ_' + r.SobjectType, {
                                Id: r.Id,
                                PermissionsRead: r.PermissionsRead, PermissionsCreate: r.PermissionsCreate,
                                PermissionsEdit: r.PermissionsEdit, PermissionsDelete: r.PermissionsDelete,
                                PermissionsViewAllRecords: r.PermissionsViewAllRecords, PermissionsModifyAllRecords: r.PermissionsModifyAllRecords,
                                exists: true, type: 'ObjectPermissions'
                            });
                        });
                    }
                }

                objApiNames.forEach((apiName, index) => {
                    var record = { attributes: { type: 'ObjectPermissions' } };
                    var perms = selectedObjectPerms[apiName];

                    if (isRevokeMode) {
                        if (existingObjMap.has(apiName)) {
                            if (perms.PermissionsRead) record.PermissionsRead = false;
                            if (perms.PermissionsCreate) record.PermissionsCreate = false;
                            if (perms.PermissionsEdit) record.PermissionsEdit = false;
                            if (perms.PermissionsDelete) record.PermissionsDelete = false;
                            if (perms.PermissionsViewAllRecords) record.PermissionsViewAllRecords = false;
                            if (perms.PermissionsModifyAllRecords) record.PermissionsModifyAllRecords = false;

                            compositeRequests.push({
                                method: "PATCH",
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions/${existingObjMap.get(apiName)}`,
                                referenceId: `objreq_${index}`,
                                body: record
                            });
                        }
                    } else {
                        if (perms.PermissionsRead) record.PermissionsRead = true;
                        if (perms.PermissionsCreate) record.PermissionsCreate = true;
                        if (perms.PermissionsEdit) record.PermissionsEdit = true;
                        if (perms.PermissionsDelete) record.PermissionsDelete = true;
                        if (perms.PermissionsViewAllRecords) record.PermissionsViewAllRecords = true;
                        if (perms.PermissionsModifyAllRecords) record.PermissionsModifyAllRecords = true;

                        if (existingObjMap.has(apiName)) {
                            compositeRequests.push({
                                method: "PATCH",
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions/${existingObjMap.get(apiName)}`,
                                referenceId: `objreq_${index}`,
                                body: record
                            });
                        } else {
                            record.ParentId = parentId;
                            record.SobjectType = apiName;
                            compositeRequests.push({
                                method: "POST",
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions/`,
                                referenceId: `objreq_${index}`,
                                body: record
                            });
                        }
                    }
                });
            }

            // =========================
            // 2. RECORD TYPE PERMISSIONS
            // =========================
            if (selectedRecordTypes.length > 0) {
                selectedRecordTypes.forEach(f => window._sfarcOriginalFieldPerms.set('RT_' + f, { exists: false }));
                var rtChunkSize = 50;
                var existingRtMap = new Map();

                for (let i = 0; i < selectedRecordTypes.length; i += rtChunkSize) {
                    var chunk = selectedRecordTypes.slice(i, i + rtChunkSize);
                    var inClause = chunk.map(n => `'${n}'`).join(',');
                    var existingQuery = `SELECT Id, SetupEntityId FROM SetupEntityAccess WHERE ParentId = '${parentId}' AND SetupEntityId IN (${inClause})`;
                    var existingRes = await window.sfApi.query(existingQuery);
                    if (existingRes && existingRes.records) {
                        existingRes.records.forEach(r => {
                            existingRtMap.set(r.SetupEntityId, r.Id);
                            window._sfarcOriginalFieldPerms.set('RT_' + r.SetupEntityId, {
                                Id: r.Id, exists: true, type: 'SetupEntityAccess'
                            });
                        });
                    }
                }

                selectedRecordTypes.forEach((rtId, index) => {
                    if (isRevokeMode) {
                        if (existingRtMap.has(rtId)) {
                            compositeRequests.push({
                                method: "DELETE",
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/SetupEntityAccess/${existingRtMap.get(rtId)}`,
                                referenceId: `rtreq_${index}`
                            });
                        }
                    } else {
                        if (!existingRtMap.has(rtId)) {
                            compositeRequests.push({
                                method: "POST",
                                url: `/services/data/${window.sfApi.apiVersion}/sobjects/SetupEntityAccess/`,
                                referenceId: `rtreq_${index}`,
                                body: { attributes: { type: 'SetupEntityAccess' }, ParentId: parentId, SetupEntityId: rtId }
                            });
                        }
                    }
                });
            }

            // =========================
            // 3. FIELD PERMISSIONS
            // =========================
            var existingMap = new Map();
            var queryChunkSize = 30;

            selectedFields.forEach(f => window._sfarcOriginalFieldPerms.set('FLD_' + f, { exists: false }));

            for (let i = 0; i < selectedFields.length; i += queryChunkSize) {
                var chunk = selectedFields.slice(i, i + queryChunkSize);
                var inClause = chunk.map(n => `'${n}'`).join(',');
                var existingQuery = `SELECT Id, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '${parentId}' AND Field IN (${inClause})`;
                var existingRes = await window.sfApi.query(existingQuery);
                if (existingRes && existingRes.records) {
                    existingRes.records.forEach(r => {
                        existingMap.set(r.Field, r.Id);
                        window._sfarcOriginalFieldPerms.set('FLD_' + r.Field, {
                            Id: r.Id, PermissionsRead: r.PermissionsRead, PermissionsEdit: r.PermissionsEdit,
                            exists: true, type: 'FieldPermissions'
                        });
                    });
                }
            }

            selectedFields.forEach((apiName, index) => {
                var record = { attributes: { type: 'FieldPermissions' } };
                var fieldPerm = fieldPerms[apiName];

                if (isRevokeMode) {
                    if (existingMap.has(apiName)) {
                        if (fieldPerm.Read === false) record.PermissionsRead = false;
                        if (fieldPerm.Edit === false) record.PermissionsEdit = false;

                        compositeRequests.push({
                            method: "PATCH",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions/${existingMap.get(apiName)}`,
                            referenceId: `req_${index}`,
                            body: record
                        });
                    }
                } else {
                    if (fieldPerm.Read) record.PermissionsRead = true;
                    if (fieldPerm.Edit) {
                        record.PermissionsRead = true;
                        record.PermissionsEdit = true;
                    }

                    if (existingMap.has(apiName)) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions/${existingMap.get(apiName)}`,
                            referenceId: `req_${index}`,
                            body: record
                        });
                    } else {
                        record.ParentId = parentId;
                        record.Field = apiName;
                        record.SobjectType = apiName.split('.')[0];
                        compositeRequests.push({
                            method: "POST",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions/`,
                            referenceId: `req_${index}`,
                            body: record
                        });
                    }
                }
            });

            // =========================
            // EXECUTE COMPOSITE BATCHES
            // =========================
            if (compositeRequests.length === 0) {
                resultsList.innerHTML = `<div style="color: green; text-align: center; font-weight: bold; margin-top: 15px;">No changes selected to apply.</div>`;
                abortBtn.style.display = 'none';
                back4Btn.style.display = 'block';
                return;
            }

            var results = [];
            var chunkSize = 25;
            for (let i = 0; i < compositeRequests.length; i += chunkSize) {
                if (window._sfarcAbortSignal) {
                    resultsList.innerHTML += `<div style="color: red; text-align: center; margin-top: 10px; font-weight: bold;">Execution Aborted!</div>`;
                    break;
                }

                var chunk = compositeRequests.slice(i, i + chunkSize);
                var payload = { allOrNone: false, compositeRequest: chunk };
                var compositeUrl = `/services/data/${window.sfApi.apiVersion}/composite`;

                var response;
                try {
                    response = await window.sfApi.fetch(compositeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch (err) {
                    throw new Error(`Composite Request Failed: ${err.message}`);
                }

                if (!response.ok) throw new Error(`Composite API returned ${response.status}: ${await response.text()}`);

                var jsonRes = await response.json();
                if (jsonRes.compositeResponse) {
                    results.push(...jsonRes.compositeResponse);
                } else {
                    throw new Error("Invalid response format from Composite API");
                }

                var pct = Math.round(((i + chunk.length) / compositeRequests.length) * 100);
                progressBar.style.width = `${pct}%`;
                progressText.innerText = `${pct}%`;
            }

            var successCount = 0;
            var errorCount = 0;
            var errorMessages = [];

            results.forEach((res, index) => {
                if (res.httpStatusCode >= 200 && res.httpStatusCode < 300) {
                    successCount++;
                } else {
                    errorCount++;
                    var errBody = Array.isArray(res.body) ? res.body[0] : res.body;
                    var msgStr = errBody ? (errBody.message || JSON.stringify(errBody)) : 'Unknown error';
                    errorMessages.push(msgStr);
                    console.error('SF Bulk Error:', res.referenceId, res.httpStatusCode, errBody);
                }
            });

            var html = `
                <div style="display: flex; gap: 20px; margin-bottom: 15px; padding: 15px; background: var(--sfarc-bg); border: 1px solid var(--sfarc-border); border-radius: 6px;">
                    <div>Total Processed: ${results.length}</div>
                    <div style="color: green;">Success: ${successCount}</div>
                    <div style="color: red;">Errors: ${errorCount}</div>
                </div>
            `;

            if (successCount > 0) {
                html += `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 6px; margin-bottom: 10px;">
                    <i class="fa-solid fa-circle-check" style="color: #2e7d32; font-size: 18px; margin-top: 2px;"></i>
                    <div style="color: #1b5e20; font-size: 13px;">${successCount} permission(s) applied successfully.</div>
                </div>`;
            }

            if (errorCount > 0) {
                html += `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 6px;">
                    <i class="fa-solid fa-circle-exclamation" style="color: #e65100; font-size: 18px; margin-top: 2px;"></i>
                    <div>
                        <div style="color: #e65100; font-weight: 500; margin-bottom: 6px;">Please review the following:</div>
                        <div style="color: #bf360c; font-size: 12px; line-height: 1.7;">
                            ${errorMessages.map(m => m).join('<br>')}
                        </div>
                    </div>
                </div>`;
            }

            resultsList.innerHTML = html;

            abortBtn.style.display = 'none';
            back4Btn.style.display = 'block';
            rollbackBtn.style.display = 'block';

        } catch (e) {
            resultsList.innerHTML = `<div style="color: red; text-align: center;">Error: ${window.escapeHtml(e.message)}</div>`;
            abortBtn.style.display = 'none';
            back4Btn.style.display = 'block';
            rollbackBtn.style.display = 'block';
        }
    });

    abortBtn.addEventListener('click', async () => {
        if (await toast.confirm('Are you sure you want to abort? Some changes may have already been applied.', {danger: true})) {
            window._sfarcAbortSignal = true;
            abortBtn.innerHTML = '<span class="comet-loader-inline"></span> Aborting...';
            abortBtn.disabled = true;
        }
    });

    rollbackBtn.addEventListener('click', async () => {
        if (!(await toast.confirm('Are you sure you want to rollback all modified permissions?', {danger: true}))) {
            return;
        }

        rollbackBtn.style.display = 'none';
        back4Btn.style.display = 'none';

        var progressContainer = document.getElementById('sfarc-bulk-progress-container');
        var progressBar = document.getElementById('sfarc-bulk-progress-bar');
        var progressText = document.getElementById('sfarc-bulk-progress-text');
        var resultsList = document.getElementById('sfarc-bulk-results-list');

        progressContainer.style.display = 'block';
        resultsList.style.display = 'block';
        resultsList.innerHTML = `<div style="text-align: center; color: var(--sfarc-secondary-text);">Starting Rollback...</div>`;
        progressBar.style.width = '0%';
        progressText.innerText = '0%';

        try {
            var compositeRequests = [];

            for (let [key, original] of window._sfarcOriginalFieldPerms.entries()) {
                var isObj = key.startsWith('OBJ_');
                var isRt = key.startsWith('RT_');
                var isFld = key.startsWith('FLD_');
                var apiName = key.substring(4);

                var currentId = null;
                var q = '';
                if (isObj) q = `SELECT Id FROM ObjectPermissions WHERE ParentId = '${parentId}' AND SobjectType = '${apiName}'`;
                if (isRt) q = `SELECT Id FROM SetupEntityAccess WHERE ParentId = '${parentId}' AND SetupEntityId = '${apiName}'`;
                if (isFld) q = `SELECT Id FROM FieldPermissions WHERE ParentId = '${parentId}' AND Field = '${apiName}'`;

                var res = await window.sfApi.query(q);
                if (res && res.records && res.records.length > 0) {
                    currentId = res.records[0].Id;
                }

                if (original.exists) {
                    if (currentId && isObj) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/ObjectPermissions/${currentId}`,
                            referenceId: `rb_${key}`,
                            body: {
                                PermissionsRead: original.PermissionsRead, PermissionsCreate: original.PermissionsCreate,
                                PermissionsEdit: original.PermissionsEdit, PermissionsDelete: original.PermissionsDelete,
                                PermissionsViewAllRecords: original.PermissionsViewAllRecords, PermissionsModifyAllRecords: original.PermissionsModifyAllRecords
                            }
                        });
                    }
                    if (currentId && isFld) {
                        compositeRequests.push({
                            method: "PATCH",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/FieldPermissions/${currentId}`,
                            referenceId: `rb_${key}`,
                            body: { PermissionsRead: original.PermissionsRead, PermissionsEdit: original.PermissionsEdit }
                        });
                    }
                } else {
                    if (currentId) {
                        var sobjType = isObj ? 'ObjectPermissions' : (isRt ? 'SetupEntityAccess' : 'FieldPermissions');
                        compositeRequests.push({
                            method: "DELETE",
                            url: `/services/data/${window.sfApi.apiVersion}/sobjects/${sobjType}/${currentId}`,
                            referenceId: `rb_${key}`
                        });
                    }
                }
            }

            if (compositeRequests.length === 0) {
                resultsList.innerHTML = `<div style="color: green; text-align: center; font-weight: bold; margin-top: 15px;">Nothing to rollback!</div>`;
                back4Btn.style.display = 'block';
                return;
            }

            var results = [];
            var chunkSize = 25;
            for (let i = 0; i < compositeRequests.length; i += chunkSize) {
                var chunk = compositeRequests.slice(i, i + chunkSize);
                var payload = { allOrNone: false, compositeRequest: chunk };
                var compositeUrl = `/services/data/${window.sfApi.apiVersion}/composite`;
                var response = await window.sfApi.fetch(compositeUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                var jsonRes = await response.json();
                if (jsonRes.compositeResponse) results.push(...jsonRes.compositeResponse);

                var pct = Math.round(((i + chunk.length) / compositeRequests.length) * 100);
                progressBar.style.width = `${pct}%`;
                progressText.innerText = `${pct}%`;
            }

            resultsList.innerHTML = `<div style="color: green; text-align: center; margin-top: 15px; font-weight:bold;">Rollback Completed (${results.length} records processed).</div>`;
            back4Btn.style.display = 'block';
        } catch (e) {
            resultsList.innerHTML += `<div style="color: red; text-align: center; margin-top: 10px;">Rollback Error: ${window.escapeHtml(e.message)}</div>`;
            back4Btn.style.display = 'block';
        }
    });

    loadObjects();
}

function checkAndShowOnboarding() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['sfarc_needs_onboarding', 'sfarcHasSeenOnboarding', 'sfarcHasSeenOnboarding_v16'], (res) => {
        var needsOnboarding = res.sfarc_needs_onboarding === true && res.sfarcHasSeenOnboarding !== true && res.sfarcHasSeenOnboarding_v16 !== true;
        if (needsOnboarding) {
            var overlay = document.createElement('div');
            overlay.id = 'sfarc-onboarding-overlay';
            overlay.style.cssText = `position: fixed; inset: 0; background: rgba(7, 10, 15, 0.88); z-index: 99999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(16px); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #f8fafc; overflow: hidden;`;

            var logoUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icons/icon-128.png') : 'icons/icon-128.png';

            overlay.innerHTML = `
                <style>
                @keyframes sfarcAmbientIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes sfarcSurfaceIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes sfarcContentIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes sfarcLogoFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes sfarcCursorBlink {
                    0%, 45% { opacity: 1; }
                    50%, 100% { opacity: 0; }
                }
                .sfarc-welcome-ambient {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .sfarc-welcome-ambient::before {
                    content: "";
                    position: absolute;
                    width: 620px;
                    height: 620px;
                    left: 50%;
                    top: 47%;
                    transform: translate(-50%, -50%);
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.08) 0%, rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.02) 30%, transparent 68%);
                    filter: blur(18px);
                    animation: sfarcAmbientIn 1.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
                }
                .sfarc-welcome-surface {
                    position: absolute;
                    width: min(760px, 88vw);
                    height: min(560px, 82vh);
                    border-radius: 42px;
                    background: transparent;
                    border: none;
                    box-shadow: none;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    animation: sfarcSurfaceIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .sfarc-welcome-content {
                    position: relative;
                    z-index: 5;
                    width: min(700px, 90vw);
                    padding: 34px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    animation: sfarcContentIn 1s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards;
                }
                .sfarc-brand-mark {
                    position: relative;
                    width: 68px;
                    height: 68px;
                    margin-bottom: 22px;
                    display: grid;
                    place-items: center;
                    background: transparent;
                    border: none;
                    box-shadow: none;
                    animation: sfarcLogoFloat 5s ease-in-out infinite;
                }
                .sfarc-brand-mark::before {
                    content: "";
                    position: absolute;
                    inset: -24px;
                    border-radius: 50%;
                    background: conic-gradient(from 0deg, transparent 0deg, rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.5) 42deg, transparent 95deg, transparent 175deg, rgba(45,212,191,0.42) 225deg, transparent 275deg, transparent 360deg);
                    -webkit-mask-image: radial-gradient(circle, transparent 58%, #000 64%, #000 76%, transparent 80%);
                    mask-image: radial-gradient(circle, transparent 58%, #000 64%, #000 76%, transparent 80%);
                    animation: sfarcRingSpin 7s linear infinite;
                    opacity: 0.9;
                    pointer-events: none;
                }
                .sfarc-brand-mark::after {
                    content: "";
                    position: absolute;
                    width: 96px;
                    height: 96px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.3), transparent 65%);
                    filter: blur(8px);
                    animation: sfarcLogoGlow 3.2s ease-in-out infinite;
                    pointer-events: none;
                }
                .sfarc-brand-mark img {
                    position: relative;
                    z-index: 2;
                    width: 64px;
                    height: 64px;
                    object-fit: contain;
                    filter: drop-shadow(0 0 16px rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.45));
                }
                @keyframes sfarcRingSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes sfarcLogoGlow {
                    0%, 100% { opacity: 0.65; transform: scale(0.95); }
                    50% { opacity: 1; transform: scale(1.06); }
                }
                .sfarc-title-container {
                    min-height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: clamp(32px, 4.5vw, 46px);
                    font-weight: 300 !important;
                    letter-spacing: -0.5px;
                    color: #ffffff;
                }
                #sfarc-typewriter-text {
                    font-weight: 300 !important;
                    background: linear-gradient(110deg, #ffffff 18%, rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.25) 42%, var(--sfarc-accent-light, #5eb4ff) 62%, #ffffff 84%);
                    background-size: 220% auto;
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    animation: sfarcTitleShimmer 7s linear infinite;
                }
                @keyframes sfarcTitleShimmer {
                    0% { background-position: 120% center; }
                    100% { background-position: -80% center; }
                }
                .sfarc-cursor {
                    width: 2px;
                    height: 38px;
                    margin-left: 6px;
                    background: var(--sfarc-accent-glow, var(--sfarc-accent-glow, #38bdf8));
                    box-shadow: 0 0 14px rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.55);
                    animation: sfarcCursorBlink 0.85s ease-in-out infinite;
                }
                .sfarc-secondary {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-top: 24px;
                    opacity: 0;
                    transform: translateY(12px);
                    transition: opacity 0.8s ease, transform 0.8s ease;
                }
                .sfarc-secondary.visible {
                    opacity: 1;
                    transform: translateY(0);
                }
                .sfarc-shortcut-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .sfarc-key-box {
                    width: 108px;
                    height: 70px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    border-radius: 14px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03) 72%, rgba(0,0,0,0.1));
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    box-shadow: 0 3px 0 rgba(0,0,0,0.32), 0 12px 30px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
                    transition: all 0.2s ease;
                }
                .sfarc-key-box.active {
                    transform: translateY(-3px) scale(1.02);
                    border-color: rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.7);
                    background: linear-gradient(180deg, rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.22), rgba(45, 212, 191, 0.1) 72%, rgba(0,0,0,0.12));
                    box-shadow: 0 1px 0 rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.3), 0 12px 38px rgba(var(--sfarc-accent-glow-rgb, 56, 189, 248), 0.22), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .sfarc-key-symbol {
                    display: grid;
                    place-items: center;
                    color: #e2e8f0;
                    line-height: 1;
                }
                .sfarc-key-symbol svg {
                    display: block;
                }
                .sfarc-key-label {
                    color: #64748b;
                    font-size: 9px;
                    font-weight: 500;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }
                .sfarc-key-box.active .sfarc-key-symbol {
                    color: #ffffff;
                }
                .sfarc-key-box.active .sfarc-key-label {
                    color: #93c5fd;
                }
                .sfarc-plus {
                    color: #475569;
                    font-size: 14px;
                    font-weight: 500;
                }
                .sfarc-bottom-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-top: 30px;
                }
                .sfarc-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 7px 14px;
                    border-radius: 999px;
                    background: rgba(52, 211, 153, 0.08);
                    border: 1px solid rgba(52, 211, 153, 0.18);
                    color: #6ee7b7;
                    font-size: 10px;
                    font-weight: 500;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                }
                .sfarc-status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #34d399;
                    box-shadow: 0 0 10px rgba(52, 211, 153, 0.65);
                    animation: sfarcDotPulse 2s ease-in-out infinite;
                }
                @keyframes sfarcDotPulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(52,211,153,0.55); }
                    50% { opacity: 0.55; box-shadow: 0 0 14px rgba(52,211,153,0.85); }
                }
                .sfarc-divider {
                    width: 1px;
                    height: 16px;
                    background: rgba(255,255,255,0.1);
                }
                </style>

                <div class="sfarc-welcome-ambient"></div>
                <div class="sfarc-welcome-surface"></div>

                <div class="sfarc-welcome-content">
                    <div class="sfarc-brand-mark">
                        <img src="${logoUrl}" alt="Salesforce Comet">
                    </div>

                    <div class="sfarc-title-container">
                        <span id="sfarc-typewriter-text"></span>
                        <span class="sfarc-cursor" id="sfarc-typewriter-cursor"></span>
                    </div>

                    <div class="sfarc-secondary" id="sfarc-secondary-content">
                        <p style="margin-bottom: 24px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                            Your faster workspace for <span style="color: #e2e8f0; font-weight: 400;">Salesforce development, inspection &amp; debugging.</span>
                        </p>

                        <div class="sfarc-shortcut-row">
                            <div class="sfarc-key-box" id="sfarc-key-shift">
                                <span class="sfarc-key-symbol">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                                </span>
                                <span class="sfarc-key-label">Shift</span>
                            </div>
                            <span class="sfarc-plus">+</span>
                            <div class="sfarc-key-box" id="sfarc-key-space">
                                <span class="sfarc-key-symbol">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/></svg>
                                </span>
                                <span class="sfarc-key-label">Space</span>
                            </div>
                        </div>

                        <div style="margin-bottom: 28px; color: #475569; font-size: 10px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">
                            Press to launch Comet
                        </div>

                        <div class="sfarc-bottom-row">
                            <div class="sfarc-status">
                                <span class="sfarc-status-dot"></span>
                                Ready to launch
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            var textIdx = 0;
            var fullText = "Welcome to Salesforce Comet";
            var typeTextEl = document.getElementById("sfarc-typewriter-text");
            var cursorEl = document.getElementById("sfarc-typewriter-cursor");
            var secondaryEl = document.getElementById("sfarc-secondary-content");

            function runTypewriter() {
                if (textIdx < fullText.length) {
                    typeTextEl.textContent += fullText[textIdx];
                    textIdx++;
                    setTimeout(runTypewriter, fullText[textIdx - 1] === ' ' ? 70 : 52);
                } else {
                    setTimeout(() => {
                        if (cursorEl) cursorEl.style.display = "none";
                        if (secondaryEl) secondaryEl.classList.add("visible");
                    }, 400);
                }
            }
            setTimeout(runTypewriter, 300);

            var dismissOverlay = (e) => {
                if (e) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                }
                overlay.remove();
                chrome.storage.local.set({ sfarcHasSeenOnboarding: true, sfarcHasSeenOnboarding_v16: true, sfarc_needs_onboarding: false });
                window.removeEventListener('keydown', handleKeyDismiss, true);

                if (typeof openPanel === 'function') openPanel();
            };

            var shiftBox = document.getElementById('sfarc-key-shift');
            var spaceBox = document.getElementById('sfarc-key-space');

            var handleKeyDismiss = (e) => {
                if (e.key === 'Shift' && shiftBox) shiftBox.classList.add('active');
                if ((e.code === 'Space' || e.key === ' ') && spaceBox) spaceBox.classList.add('active');

                var isSpace = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;
                if ((e.shiftKey && isSpace) || e.key === 'Escape') {
                    dismissOverlay(e);
                }
            };

            window.addEventListener('keydown', handleKeyDismiss, true);
            window.addEventListener('keyup', (e) => {
                if (e.key === 'Shift' && shiftBox) shiftBox.classList.remove('active');
                if ((e.code === 'Space' || e.key === ' ') && spaceBox) spaceBox.classList.remove('active');
            }, true);
        }
    });
}
