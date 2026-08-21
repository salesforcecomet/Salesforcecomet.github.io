(function () {
    try {
        const elements = document.querySelectorAll('.flowruntime, .flowruntimeForFlexipage, lightning-flow, [data-component-id*="flow" i], [data-aura-class*="flowruntime" i]');
        elements.forEach(el => {
            let apiName = null;
            // Check LWC properties
            if (el.flowApiName) apiName = el.flowApiName;
            else if (el.flowName) apiName = el.flowName;

            // Check Aura properties
            if (!apiName && window.$A && window.$A.getComponent) {
                try {
                    const cmp = window.$A.getComponent(el);
                    if (cmp) {
                        apiName = cmp.get('v.flowName') || cmp.get('v.flowApiName') || cmp.get('v.name');
                    }
                } catch (e) { }
            }

            if (apiName && typeof apiName === 'string') {
                el.setAttribute('data-sfarc-true-flow-name', apiName);
            }
        });
    } catch (e) {
        console.warn('salesforce comet: Flow name extraction failed', e);
    }
})();
