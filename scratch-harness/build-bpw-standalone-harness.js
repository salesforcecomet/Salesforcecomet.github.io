// Builds scratch-harness/bpw-standalone-preview.html from the REAL
// bulk-permission-wizard.css + .js (inlined) plus stubs for sfApi/toast/FA.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'bulk-permission-wizard.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'bulk-permission-wizard.js'), 'utf8');

// Tiny FA-solid icon shim (SVG data-URI backgrounds) for the icons the wizard uses.
const faShim = `
i.fa-solid { display: inline-block; width: 1em; height: 1em; background: currentColor; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center; -webkit-mask-size: contain; }
i.fa-magnifying-glass { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E"); }
i.fa-xmark { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Cline x1='6' y1='6' x2='18' y2='18'/%3E%3Cline x1='18' y1='6' x2='6' y2='18'/%3E%3C/svg%3E"); }
i.fa-layer-group { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'/%3E%3Cpolyline points='2 12 12 17 22 12'/%3E%3Cpolyline points='2 17 12 22 22 17'/%3E%3C/svg%3E"); }
i.fa-arrow-right { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3Cpolyline points='12 5 19 12 12 19'/%3E%3C/svg%3E"); }
i.fa-arrow-left { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='19' y1='12' x2='5' y2='12'/%3E%3Cpolyline points='12 19 5 12 12 5'/%3E%3C/svg%3E"); }
i.fa-bolt { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'%3E%3Cpolygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/%3E%3C/svg%3E"); }
i.fa-spinner { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M21 12a9 9 0 1 1-6.2-8.56'/%3E%3C/svg%3E"); }
i.fa-circle-check { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E"); }
i.fa-circle-exclamation { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E"); }
.fa-spin { animation: fa-spin 1s linear infinite; }
@keyframes fa-spin { to { transform: rotate(360deg); } }
`;

const stubApi = `
window.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        switch (m) { case '&': return '&amp;'; case '<': return '&lt;'; case '>': return '&gt;'; case '"': return '&quot;'; case "'": return '&#039;'; default: return m; }
    });
};
window.toast = {
    success: (m) => console.log('[toast success]', m),
    error: (m) => console.log('[toast error]', m),
    info: (m) => console.log('[toast info]', m),
    warning: (m) => console.log('[toast warn]', m)
};
const FAKE_OBJECTS = [
    { name: 'Account', label: 'Accounts' },
    { name: 'Contact', label: 'Contacts' },
    { name: 'Opportunity', label: 'Opportunities' },
    { name: 'Case', label: 'Cases' },
    { name: 'Lead', label: 'Leads' },
    { name: 'Order', label: 'Orders' },
    { name: 'Product2', label: 'Products' },
    { name: 'Quote', label: 'Quotes' },
    { name: 'Campaign', label: 'Campaigns' },
    { name: 'Event', label: 'Events' },
    { name: 'Task', label: 'Tasks' },
    { name: 'User', label: 'Users' },
    { name: 'AccountShare', label: 'Account Shares' },
    { name: 'CustomObject__c', label: 'Custom Object' },
    { name: 'OpportunityChangeEvent', label: 'Opportunity Change Events' },
    { name: 'AccountHistory', label: 'Account History' },
    { name: 'Asset', label: 'Assets' },
    { name: 'Contract', label: 'Contracts' },
    { name: 'Entitlement', label: 'Entitlements' },
    { name: 'Solution', label: 'Solutions' },
    { name: 'Idea', label: 'Ideas' },
    { name: 'Note', label: 'Notes' },
    { name: 'Pricebook2', label: 'Price Books' },
    { name: 'RecordType', label: 'Record Types' },
    { name: 'SObject', label: 'SObjects' }
];
window.sfApi = {
    sessionId: '00D000000000000!FAKE',
    apiVersion: '60.0',
    init: async () => { console.log('sfApi.init()'); },
    query: async (soql, isTooling) => {
        if (soql.includes('PermissionSet')) {
            return { records: [
                { Id: '0PS000000000001', Name: 'Sales_User_PS', Label: 'Sales User Permission Set' },
                { Id: '0PS000000000002', Name: 'Service_User_PS', Label: 'Service User Permission Set' },
                { Id: '0PS000000000003', Name: 'Marketing_User_PS', Label: 'Marketing User Permission Set' },
                { Id: '0PS000000000004', Name: 'Analyst_PS', Label: 'Analyst Permission Set' }
            ]};
        }
        if (soql.includes('RecordType')) {
            return { records: [
                { Id: '012000000000001', Name: 'Person Account', DeveloperName: 'PersonAccount', SobjectType: 'Account', IsActive: true },
                { Id: '012000000000002', Name: 'Business Account', DeveloperName: 'BusinessAccount', SobjectType: 'Account', IsActive: true },
                { Id: '012000000000003', Name: 'Standard Opportunity', DeveloperName: 'StandardOpportunity', SobjectType: 'Opportunity', IsActive: true }
            ]};
        }
        return { records: [] };
    },
    describeGlobal: async () => ({ sobjects: FAKE_OBJECTS }),
    describeSObject: async () => ({
        fields: [
            { name: 'Id', label: 'Record ID', type: 'id', updateable: false, createable: false },
            { name: 'Name', label: 'Name', type: 'string', updateable: true, createable: true },
            { name: 'OwnerId', label: 'Owner ID', type: 'reference', updateable: true, createable: true },
            { name: 'CreatedDate', label: 'Created Date', type: 'datetime', updateable: false, createable: false },
            { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', updateable: true, createable: true },
            { name: 'Description', label: 'Description', type: 'textarea', updateable: true, createable: true }
        ]
    }),
    fetch: async () => ({ json: async () => ({ compositeResponse: [] }) })
};
`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Bulk Permission Wizard — Standalone Page Preview</title>
<style>
${faShim}
${css}
/* harness extras */
body { transition: none; }
.theme-toggle {
    position: fixed; right: 14px; top: 14px; z-index: 99;
    padding: 6px 12px; border-radius: 8px; border: 1px solid #cdd4dd;
    background: #fff; color: #1e293b; font-size: 12px; cursor: pointer; font-family: inherit;
}
body.sfarc-dark-theme .theme-toggle { background: #17181c; border-color: #30363d; color: #e6e9ef; }
</style>
</head>
<body>
<button class="theme-toggle" id="theme-toggle" onclick="document.body.classList.toggle('sfarc-dark-theme')">Toggle theme</button>
<div id="bpw-root"></div>
<script>
${stubApi}
</script>
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'bpw-standalone-preview.html'), html);
console.log('wrote bpw-standalone-preview.html,', html.length, 'bytes');
