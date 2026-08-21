// Builds log-viewer-preview.html — the REAL log-viewer page (html/css/js)
// with a realistic multi-class debug log injected as if fetched by id.
// NOTE: log-viewer.js contains backticks + ${...}, so we must concatenate
// strings rather than nest it inside a template literal.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'src', 'log-viewer.html'), 'utf8');

const css = fs.readFileSync(path.join(ROOT, 'src', 'log-viewer.css'), 'utf8');
const glassCss = fs.readFileSync(path.join(ROOT, 'src', 'glass-toast.css'), 'utf8');
const controlsCss = fs.readFileSync(path.join(ROOT, 'src', 'controls.css'), 'utf8');
const dropdownCss = fs.readFileSync(path.join(ROOT, 'src', 'custom-dropdown.css'), 'utf8');
const lvJs = fs.readFileSync(path.join(ROOT, 'src', 'log-viewer.js'), 'utf8');

const sampleLog = [
    '60.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT,INFO;DATA_ACCESS,INFO;DB,INFO;NBA,INFO;SYSTEM,DEBUG;VALIDATION,INFO;VISUALFORCE,INFO;WAVE,INFO;WORKFLOW,INFO',
    'Execute Anonymous: AccountService.processNewAccounts();',
    '15:01:55.140 (14908407)|USER_INFO|[EXTERNAL]|005d200000GQdNt|vishu.grade@example.com|(GMT+05:30) India Standard Time (Asia/Kolkata)|GMT+05:30',
    '15:01:55.140 (14941810)|EXECUTION_STARTED',
    '15:01:55.140 (14965545)|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
    '15:01:55.140 (15261970)|METHOD_ENTRY|[1]|AccountService.processNewAccounts()',
    '15:01:55.140 (15340992)|VARIABLE_SCOPE_BEGIN|[1]|this|AccountService',
    '15:01:55.140 (15360937)|VARIABLE_SCOPE_BEGIN|[2]|accs',
    '15:01:55.140 (15546914)|STATEMENT_EXECUTE|[2]',
    '15:01:55.140 (15550825)|VARIABLE_ASSIGNMENT|[2]|accs|[Account]',
    '15:01:55.140 (15578698)|SOQL_EXECUTE_BEGIN|[3]|Aggregations:0|SELECT Id, Name FROM Account',
    '15:01:55.140 (15614989)|SOQL_EXECUTE_END|[3]|Rows:5',
    '15:01:55.140 (15781113)|USER_DEBUG|[4]|DEBUG|Processing 5 accounts',
    '15:01:55.140 (15878092)|METHOD_ENTRY|[5]|AccountService.applyDiscount(List<Account>)',
    '15:01:55.140 (15878093)|VARIABLE_SCOPE_BEGIN|[5]|this|AccountService',
    '15:01:55.140 (15878094)|VARIABLE_SCOPE_BEGIN|[6]|acc',
    '15:01:55.140 (15878095)|STATEMENT_EXECUTE|[6]',
    '15:01:55.140 (15878096)|VARIABLE_ASSIGNMENT|[6]|acc.Discount__c|15',
    '15:01:55.140 (15878097)|DML_BEGIN|[6]|Op:Update|Type:Account|Rows:5',
    '15:01:55.140 (15878098)|DML_END|[6]',
    '15:01:55.140 (15878099)|METHOD_EXIT|[5]|AccountService.applyDiscount',
    '15:01:55.150 (15878100)|FLOW_START_INTERVIEW_BEGIN|[7]|My_Approval_Flow',
    '15:01:55.150 (15878101)|FLOW_ELEMENT_BEGIN|[7]|Decision|Check_Amount',
    '15:01:55.150 (15878102)|FLOW_ELEMENT_END|[7]',
    '15:01:55.150 (15878103)|FLOW_START_INTERVIEW_END|[7]',
    '15:01:55.150 (15878104)|VALIDATION_RULE|[8]|Account_Validation_Amount',
    '15:01:55.150 (15878105)|EXCEPTION_THROWN|[9]|System.NoAccessException: Insufficient access to Account',
    '15:01:55.150 (15878092)|CUMULATIVE_LIMIT_USAGE',
    '15:01:55.150 (15878092)|LIMIT_USAGE_FOR_NS|(default)|',
    '    Number of SOQL queries: 1 out of 100',
    '    Number of query rows: 5 out of 50000',
    '    Number of DML statements: 1 out of 150',
    '    Number of DML rows: 5 out of 10000',
    '    Maximum CPU time: 120 out of 10000',
    '    Maximum heap size: 20000 out of 6000000',
    '    Number of callouts: 0 out of 100',
    '15:01:55.150 (15878092)|CUMULATIVE_LIMIT_USAGE_END',
    '15:01:55.140 (16044542)|METHOD_EXIT|[1]|AccountService.processNewAccounts',
    '15:01:55.140 (16069950)|CODE_UNIT_FINISHED|execute_anonymous_apex',
    '15:01:55.140 (16069951)|EXECUTION_FINISHED'
].join('\n');

const stub = [
    '<script>',
    '// Stub the API so initViewer path works without Salesforce',
    'window.sfApi = {',
    "    sessionId: '00Dfaketoken',",
    "    instanceUrl: 'https://example.my.salesforce.com',",
    "    apiVersion: '60.0',",
    '    init: async () => {},',
    '    fetch: async (url) => {',
    "        if (url.includes('/Body')) return " + JSON.stringify(sampleLog) + ';',
    "        return { records: [{",
    "            Id: '07Lfakelogid',",
    "            LogUser: { Name: 'vishu.grade@example.com', Id: '005fakeloguser' },",
    "            Operation: 'execute_anonymous_apex',",
    "            Status: 'Success',",
    '            DurationMilliseconds: 220,',
    '            LogLength: ' + sampleLog.length + ',',
    '            StartTime: new Date().toISOString(),',
    "            Application: 'IDE',",
    "            Request: 'Apex Execute'",
    '        }] };',
    '    }',
    '};',
    "window.toast = { confirm: async () => true, error: (m) => console.error('toast:', m) };",
    "document.addEventListener('DOMContentLoaded', () => { window.__logReady = true; });",
    '</script>'
].join('\n');

const lvBlock = '<script>\n' + lvJs + '\n</script>';

html = html
    .replace(/<script src="theme-manager\.js"><\/script>/, '')
    .replace(/<script src="lib\/font-awesome\.min\.js" defer><\/script>/, '<style>.fa-solid,.fa-regular,.fa-brands{font-style:normal;display:inline-block}</style>')
    .replace(/<link rel="stylesheet" href="log-viewer\.css">/, '<style>' + css + '</style>')
    .replace(/<link rel="stylesheet" href="glass-toast\.css">/, '<style>' + glassCss + '</style>')
    .replace(/<link rel="stylesheet" href="custom-dropdown\.css">/, '<style>' + dropdownCss + '</style>')
    .replace(/<link rel="stylesheet" href="controls\.css">/, '<style>' + controlsCss + '</style>')
    .replace(/<script src="colored-favicon\.js" defer><\/script>/, '')
    .replace(/<script src="custom-tooltip\.js" defer><\/script>/, '')
    .replace(/<script src="glass-toast\.js"><\/script>/, '')
    .replace(/<script src="custom-dropdown\.js"><\/script>/, '')
    .replace(/<script src="api\.js"><\/script>/, '')
    // Function replacement: a string replacement would interpret $& / $1
    // sequences inside log-viewer.js (escapeRegExp uses '\\$&') and corrupt it.
    .replace(/<script src="log-viewer\.js"><\/script>/, () => stub + '\n' + lvBlock)
    .replace('<body>', '<body class="sfarc-dark-theme">');

fs.writeFileSync(path.join(__dirname, 'log-viewer-preview.html'), html);
console.log('Wrote scratch-harness/log-viewer-preview.html (self-contained, no template corruption)');
