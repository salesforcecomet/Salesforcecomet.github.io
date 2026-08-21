// Performance optimization utilities for Salesforce Comet
// Addresses low-end PC and corporate PC performance issues
// Now includes automatic performance mode detection

(function() {
    'use strict';

    // Performance monitoring
    const PERF = {
        metrics: {
            domOperations: 0,
            memoryPeak: 0,
            lastGC: Date.now(),
            intervals: new Map(),
            timeouts: new Map(),
            fps: 60,
            lastFrameTime: Date.now(),
            frameCount: 0
        },
        
        // Detect system capabilities
        systemInfo: {
            memory: navigator.deviceMemory || 4,
            cores: navigator.hardwareConcurrency || 4,
            isLowEnd: false,
            isCorporate: false,
            isHighLoad: false,
            performanceModeActive: false,
            connectionType: 'unknown'
        },

        // Performance thresholds
        thresholds: {
            memoryLow: 4, // GB
            coresLow: 4,
            fpsLow: 30,
            memoryUsageHigh: 0.8, // 80%
            cpuUsageHigh: 0.7 // 70%
        },

        init() {
            this.detectSystem();
            this.setupMemoryMonitoring();
            this.setupFPSMonitoring();
            this.setupNetworkMonitoring();
            this.optimizeIntervals();
            this.autoDetectPerformanceMode();
            
            // Periodic re-evaluation
            setInterval(() => this.reEvaluatePerformance(), 30000);
        },

        detectSystem() {
            // Detect low-end devices
            this.systemInfo.isLowEnd = 
                this.systemInfo.memory <= this.thresholds.memoryLow || 
                this.systemInfo.cores <= this.thresholds.coresLow;
            
            // Detect corporate environments (common indicators)
            this.systemInfo.isCorporate = 
                navigator.userAgent.includes('Enterprise') ||
                navigator.userAgent.includes('Managed') ||
                window.chrome?.enterprise !== undefined ||
                document.querySelector('[data-enterprise]') !== null ||
                this.detectCorporateExtensions();
            
            // Detect connection type
            if (navigator.connection) {
                this.systemInfo.connectionType = navigator.connection.effectiveType || 'unknown';
            }
            
            console.log('[SFARC Perf] System detected:', {
                memory: this.systemInfo.memory + 'GB',
                cores: this.systemInfo.cores,
                isLowEnd: this.systemInfo.isLowEnd,
                isCorporate: this.systemInfo.isCorporate,
                connection: this.systemInfo.connectionType
            });
        },

        detectCorporateExtensions() {
            // Check for common corporate security extensions
            const corporateExtensions = [
                'Cisco', 'Zscaler', 'Symantec', 'McAfee', 'Tanium',
                'CrowdStrike', 'Carbon Black', 'Sentinel', 'Fortinet'
            ];
            
            return corporateExtensions.some(ext => 
                navigator.userAgent.includes(ext) || 
                document.querySelector(`[data-extension*="${ext.toLowerCase()}"]`)
            );
        },

        setupMemoryMonitoring() {
            if (!performance.memory) return;
            
            const checkMemory = () => {
                const used = performance.memory.usedJSHeapSize / 1024 / 1024;
                const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;
                const usageRatio = used / limit;
                
                this.metrics.memoryPeak = Math.max(this.metrics.memoryPeak, used);
                
                // Check for high memory usage
                if (usageRatio > this.thresholds.memoryUsageHigh) {
                    this.systemInfo.isHighLoad = true;
                    this.triggerGarbageCollection();
                }
                
                // Auto-enable performance mode if memory is critical
                if (usageRatio > 0.9) {
                    this.enablePerformanceMode('high-memory');
                }
            };
            
            setInterval(checkMemory, 10000);
            checkMemory();
        },

        setupFPSMonitoring() {
            let lastTime = performance.now();
            let frames = 0;
            
            const measureFPS = () => {
                frames++;
                const currentTime = performance.now();
                
                if (currentTime - lastTime >= 1000) {
                    this.metrics.fps = Math.round((frames * 1000) / (currentTime - lastTime));
                    frames = 0;
                    lastTime = currentTime;
                    
                    // Auto-enable performance mode if FPS is low
                    if (this.metrics.fps < this.thresholds.fpsLow) {
                        this.systemInfo.isHighLoad = true;
                        this.enablePerformanceMode('low-fps');
                    }
                }
                
                requestAnimationFrame(measureFPS);
            };
            
            requestAnimationFrame(measureFPS);
        },

        setupNetworkMonitoring() {
            if (!navigator.connection) return;
            
            const connection = navigator.connection;
            
            const updateConnectionInfo = () => {
                this.systemInfo.connectionType = connection.effectiveType;
                
                // Enable performance mode on slow connections
                if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                    this.enablePerformanceMode('slow-connection');
                }
            };
            
            connection.addEventListener('change', updateConnectionInfo);
            updateConnectionInfo();
        },

        optimizeIntervals() {
            // Reduce interval frequency on low-end devices
            const multiplier = this.systemInfo.isLowEnd ? 2 : 1;
            
            // Patch setInterval to optimize intervals
            const originalSetInterval = window.setInterval;
            window.setInterval = function(fn, delay, ...args) {
                // Increase delay on low-end devices
                const optimizedDelay = delay * multiplier;
                const id = originalSetInterval.call(window, fn, optimizedDelay, ...args);
                PERF.metrics.intervals.set(id, { delay: optimizedDelay, created: Date.now() });
                return id;
            };
            
            // Patch clearInterval to track cleanup
            const originalClearInterval = window.clearInterval;
            window.clearInterval = function(id) {
                PERF.metrics.intervals.delete(id);
                return originalClearInterval.call(window, id);
            };
        },

        autoDetectPerformanceMode() {
            // Determine if performance mode should be enabled automatically
            let shouldEnable = false;
            let reason = '';
            
            // Check system specs
            if (this.systemInfo.isLowEnd) {
                shouldEnable = true;
                reason = 'low-end-device';
            }
            
            // Check corporate environment
            if (this.systemInfo.isCorporate) {
                shouldEnable = true;
                reason = 'corporate-environment';
            }
            
            // Check current load
            if (this.systemInfo.isHighLoad) {
                shouldEnable = true;
                reason = 'high-load';
            }
            
            // Check connection
            if (this.systemInfo.connectionType === 'slow-2g' || this.systemInfo.connectionType === '2g') {
                shouldEnable = true;
                reason = 'slow-connection';
            }
            
            if (shouldEnable) {
                this.enablePerformanceMode(reason);
            }
            
            return shouldEnable;
        },

        enablePerformanceMode(reason) {
            if (this.systemInfo.performanceModeActive) return;
            
            this.systemInfo.performanceModeActive = true;
            
            // Store the setting
            if (chrome?.storage?.sync) {
                chrome.storage.sync.get(['sfiSettings'], (result) => {
                    const settings = result?.sfiSettings || {};
                    settings.performanceMode = true;
                    settings.performanceModeReason = reason;
                    chrome.storage.sync.set({ sfiSettings: settings });
                });
            }
            
            // Apply to panel if it exists
            const panel = document.getElementById('sfarc-panel');
            if (panel) {
                panel.classList.add('sfarc-performance-mode');
            }
            
            console.log(`[SFARC Perf] Performance mode enabled automatically: ${reason}`);
            
            // Notify user
            this.showPerformanceNotification(reason);
        },

        showPerformanceNotification(reason) {
            const messages = {
                'low-end-device': 'Performance mode enabled: Low-end device detected',
                'corporate-environment': 'Performance mode enabled: Corporate security software detected',
                'high-load': 'Performance mode enabled: High system load detected',
                'slow-connection': 'Performance mode enabled: Slow network connection detected',
                'high-memory': 'Performance mode enabled: High memory usage detected',
                'low-fps': 'Performance mode enabled: Low frame rate detected'
            };
            
            const message = messages[reason] || 'Performance mode enabled';
            
            // Show toast notification if available
            if (window.sfarcToast) {
                window.sfarcToast.info(message);
            } else {
                console.log(`[SFARC Perf] ${message}`);
            }
        },

        reEvaluatePerformance() {
            // Re-evaluate if performance mode should be disabled
            if (!this.systemInfo.performanceModeActive) return;
            
            // Check if conditions have improved
            const memoryOk = performance.memory ? 
                (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) < 0.6 : true;
            const fpsOk = this.metrics.fps >= 45;
            
            // Don't auto-disable - once enabled, let user control it
            // But log the status
            if (memoryOk && fpsOk) {
                console.log('[SFARC Perf] System performance improved, but keeping performance mode active');
            }
        },

        triggerGarbageCollection() {
            // Clear unnecessary caches
            if (window.sfarcLogs && window.sfarcLogs.length > 100) {
                window.sfarcLogs = window.sfarcLogs.slice(-50);
            }
            
            // Clear old data from localStorage
            try {
                const keys = Object.keys(localStorage);
                const now = Date.now();
                keys.forEach(key => {
                    if (key.startsWith('sfarc_') && key.includes('_cache')) {
                        try {
                            const item = JSON.parse(localStorage.getItem(key));
                            if (item && item.timestamp && now - item.timestamp > 3600000) {
                                localStorage.removeItem(key);
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}
            
            this.metrics.lastGC = Date.now();
        },

        // Public API
        getStatus() {
            return {
                performanceModeActive: this.systemInfo.performanceModeActive,
                systemInfo: { ...this.systemInfo },
                metrics: { ...this.metrics }
            };
        },

        forcePerformanceMode(enable) {
            if (enable) {
                this.enablePerformanceMode('manual');
            } else {
                this.systemInfo.performanceModeActive = false;
                const panel = document.getElementById('sfarc-panel');
                if (panel) {
                    panel.classList.remove('sfarc-performance-mode');
                }
            }
        }
    };

    // Lazy load features based on usage
    const LazyLoader = {
        loaded: new Set(),
        
        async load(feature) {
            if (this.loaded.has(feature)) return;
            
            // Check if lazy loading is enabled
            const settings = await this.getSettings();
            if (!settings.lazyLoad) {
                // Lazy loading disabled, load everything
                await this.loadFeature(feature);
                this.loaded.add(feature);
                return;
            }
            
            // Check if feature is needed
            if (PERF.systemInfo.isLowEnd && !this.isEssential(feature)) {
                console.log(`[SFARC Perf] Skipping non-essential feature: ${feature}`);
                return;
            }
            
            try {
                await this.loadFeature(feature);
                this.loaded.add(feature);
            } catch (e) {
                console.error(`[SFARC Perf] Failed to load ${feature}:`, e);
            }
        },
        
        async loadFeature(feature) {
            switch(feature) {
                case 'monaco':
                    return this.loadMonaco();
                case 'flow-scanner':
                    return this.loadFlowScanner();
                case 'debug-logs':
                    return this.loadDebugLogs();
                default:
                    console.log(`[SFARC Perf] Unknown feature: ${feature}`);
            }
        },
        
        isEssential(feature) {
            const essential = ['search', 'objects', 'users'];
            return essential.includes(feature);
        },
        
        async getSettings() {
            return new Promise((resolve) => {
                if (chrome?.storage?.sync) {
                    chrome.storage.sync.get(['sfiSettings'], (result) => {
                        resolve(result?.sfiSettings || { lazyLoad: true });
                    });
                } else {
                    resolve({ lazyLoad: true });
                }
            });
        },
        
        async loadMonaco() {
            // Lazy load Monaco editor only when needed
            if (window.monaco) return;
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '../lib/monaco-editor/min/vs/loader.js';
                script.onload = () => {
                    require.config({ paths: { vs: '../lib/monaco-editor/min/vs' } });
                    require(['vs/editor/editor.main'], () => resolve(), reject);
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        },
        
        async loadFlowScanner() {
            // Only load flow scanner if user accesses flow features
            return import('./flow-scanner-engine/flow-scanner-bundle.js');
        },
        
        async loadDebugLogs() {
            // Pre-load debug log parser
            return import('./log-viewer.js');
        }
    };

    // DOM operation batching
    const DOMBatch = {
        queue: [],
        isProcessing: false,
        
        add(operation) {
            this.queue.push(operation);
            if (!this.isProcessing) {
                this.processQueue();
            }
        },
        
        processQueue() {
            this.isProcessing = true;
            
            requestAnimationFrame(() => {
                const fragment = document.createDocumentFragment();
                const operations = this.queue.splice(0, 50); // Process max 50 per frame
                
                operations.forEach(op => {
                    try {
                        op(fragment);
                        PERF.metrics.domOperations++;
                    } catch (e) {
                        console.error('[SFARC Perf] DOM operation failed:', e);
                    }
                });
                
                if (this.queue.length > 0) {
                    this.processQueue();
                } else {
                    this.isProcessing = false;
                }
            });
        }
    };

    // Event delegation optimization
    const EventOptimizer = {
        handlers: new Map(),
        
        // Delegate events to parent elements
        delegate(parent, eventType, selector, handler) {
            const key = `${parent.id || 'root'}_${eventType}_${selector}`;
            if (this.handlers.has(key)) return;
            
            const delegatedHandler = (e) => {
                const target = e.target.closest(selector);
                if (target && parent.contains(target)) {
                    handler.call(target, e, target);
                }
            };
            
            parent.addEventListener(eventType, delegatedHandler, { passive: true });
            this.handlers.set(key, delegatedHandler);
        },
        
        // Throttle event handlers
        throttle(fn, delay) {
            let lastCall = 0;
            let timeoutId;
            
            return function(...args) {
                const now = Date.now();
                const remaining = delay - (now - lastCall);
                
                if (remaining <= 0) {
                    clearTimeout(timeoutId);
                    lastCall = now;
                    fn.apply(this, args);
                } else if (!timeoutId) {
                    timeoutId = setTimeout(() => {
                        lastCall = Date.now();
                        timeoutId = null;
                        fn.apply(this, args);
                    }, remaining);
                }
            };
        }
    };

    // Export to window for use by other modules
    window.SFARC_Perf = PERF;
    window.SFARC_LazyLoader = LazyLoader;
    window.SFARC_DOMBatch = DOMBatch;
    window.SFARC_EventOptimizer = EventOptimizer;

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PERF.init());
    } else {
        PERF.init();
    }

})();
