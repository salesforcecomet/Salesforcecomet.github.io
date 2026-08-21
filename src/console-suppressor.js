// Salesforce Comet - Console Suppressor (Main World)
// This file is injected via chrome.scripting.executeScript with world: 'MAIN'
// to intercept and silence noisy Salesforce instrumentation logs.
(function () {
    if (window.__sfarcLogsSuppressed) return;
    window.__sfarcLogsSuppressed = true;

    // Redirect 'unload' listeners to 'pagehide' to prevent Chrome Permissions Policy violations
    try {
        const origAdd = EventTarget.prototype.addEventListener;
        if (origAdd && !origAdd.__sfarcUnloadPatched) {
            const patchedAdd = function (type, listener, options) {
                if (type === 'unload') {
                    return origAdd.call(this, 'pagehide', listener, options);
                }
                return origAdd.call(this, type, listener, options);
            };
            patchedAdd.__sfarcUnloadPatched = true;
            EventTarget.prototype.addEventListener = patchedAdd;
        }
    } catch (e) {}

    const suppressionStrings = [
        'O11Y',
        'o11y',
        'ComponentProfiler',
        'empApi setting initialized',
        '<lightning-spinner>',
        'A `lightning-card` with `hide-header`',
        'The role attribute value is invalid.',
        'The alternativeText attribute should not be empty.',
        'InstrumentationResult',
        'O11yInstrumentationResult',
        'Unsupported WebVital metrics',
        'apple-mobile-web-app-capable',
        'mobile-web-app-capable',
        'lightning-card',
        'lightning-input',
        'hide-header requires',
        'Notifications permission has been blocked',
        'WebVital',
        'Permissions policy violation',
        'unload is not allowed',
        'Failed to create durable storage',
        'TelemetryResponse',
        'AILTN',
        'Refused to apply style',
        'FlowScanner'
    ];

    const suppressionNamespaces = new Set(['sf.instrumentation']);
    const suppressionMetricNames = new Set(['FID', 'LCP', 'CLS', 'INP', 2]);
    const suppressionLoggerNames = new Set(['Network', 'network', 'WebVitals', 'O11Y', 'o11y']);

    // Known object "shape" suppressors for Salesforce instrumentation
    function isSuppressedObject(obj) {
        if (!obj || typeof obj !== 'object') return false;
        if (suppressionNamespaces.has(obj.userPayload?.schema?.namespace)) return true;
        if (suppressionMetricNames.has(obj.name)) return true;
        if (suppressionLoggerNames.has(obj.loggerName || obj.loggerNamespace || obj.name)) return true;
        if ('InstrumentationResult' in obj || 'O11yInstrumentationResult' in obj || 'TelemetryResponse' in obj) return true;
        if (obj.schemaSequence !== undefined && obj.sequence !== undefined && obj.rootId !== undefined) return true; // O11Y metadata shape
        if (obj.userPayload !== undefined && obj.schema !== undefined) return true; // Instrumentation payload shape
        if (obj.stack && obj.name === 'Error' && obj.message) {
            // Error objects from O11Y/instrumentation
            const errMsg = obj.message;
            for (let j = 0; j < suppressionStrings.length; j++) {
                if (errMsg.includes(suppressionStrings[j])) return true;
            }
        }
        // Suppress O11Y metadata envelopes by checking common fields
        if (obj.timestamp !== undefined && obj.sequence !== undefined && obj.loggerName !== undefined) return true;
        return false;
    }

    function shouldSuppress(args) {
        if (!args || args.length === 0) return false;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === null || arg === undefined) continue;

            const type = typeof arg;

            if (type === 'string') {
                for (let j = 0; j < suppressionStrings.length; j++) {
                    if (arg.includes(suppressionStrings[j])) return true;
                }
            } else if (type === 'object') {
                if (isSuppressedObject(arg)) return true;

                // Check JSON string representation or object keys for suppression strings
                try {
                    const str = JSON.stringify(arg);
                    for (let j = 0; j < suppressionStrings.length; j++) {
                        if (str.includes(suppressionStrings[j])) return true;
                    }
                } catch (e) {
                    for (const key in arg) {
                        if (typeof key === 'string') {
                            for (let j = 0; j < suppressionStrings.length; j++) {
                                if (key.includes(suppressionStrings[j])) return true;
                            }
                        }
                    }
                }
            } else if (type === 'number') {
                if (suppressionMetricNames.has(arg)) return true;
            }
        }

        return false;
    }

    const wrap = (methodName) => {
        const original = console[methodName];
        if (!original || original.__sfarcWrapped) return;
        const wrapped = function (...args) {
            if (shouldSuppress(args)) return;
            original.apply(console, args);
        };
        wrapped.__sfarcWrapped = true;
        console[methodName] = wrapped;
    };

    wrap('log');
    wrap('warn');
    wrap('error');
    wrap('info');
    wrap('debug');
})();
