/**
 * Smart Suggestions Engine v2
 * Deep context-aware suggestions with instant launch.
 * Tracks user activity, parses Salesforce page context (record IDs, object names,
 * fields, record types, user IDs) and provides actionable suggestions.
 */

var SmartSuggestions = SmartSuggestions || (() => {
  const ACTIVITY_LOG_KEY = 'sfarc_activity_log';
  const SUGGESTIONS_KEY = 'sfarc_smart_suggestions_v2';

  let activityLog = [];
  let suggestions = [];
  let currentContext = null;

  /* ─── Salesforce URL Parsers ─── */

  /**
   * Parse the current Salesforce URL to extract rich context:
   * objectApiName, recordId, recordTypeId, fieldName, userId, pageType, etc.
   */
  function parseSalesforceContext() {
    const url = window.location.href;
    const ctx = {
      url,
      pageType: 'other',
      objectApiName: null,
      recordId: null,
      recordTypeId: null,
      fieldName: null,
      userId: null,
      isSetup: false,
      isRecordPage: false,
      isListView: false,
      isHome: false,
      setupPath: null
    };

    // Detect Setup pages
    if (url.includes('/lightning/setup/')) {
      ctx.isSetup = true;
      ctx.pageType = 'setup';
      const setupMatch = url.match(/\/lightning\/setup\/([^/?]+)/);
      if (setupMatch) ctx.setupPath = setupMatch[1];
    }

    // Detect Record pages: /lightning/r/{ObjectApiName}/{RecordId}/view
    const recordMatch = url.match(/\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})/);
    if (recordMatch) {
      ctx.pageType = 'record';
      ctx.isRecordPage = true;
      ctx.objectApiName = recordMatch[1];
      ctx.recordId = recordMatch[2];
    }

    // Detect Object List views: /lightning/o/{ObjectApiName}/list
    const listMatch = url.match(/\/lightning\/o\/([^/]+)/);
    if (listMatch) {
      ctx.pageType = 'list';
      ctx.isListView = true;
      ctx.objectApiName = listMatch[1];
    }

    // Detect Home page
    if (url.includes('/lightning/page/home') || url.endsWith('/') || url.endsWith('#')) {
      ctx.pageType = 'home';
      ctx.isHome = true;
    }

    // Detect Record Type from URL params
    const rtMatch = url.match(/recordTypeId=([a-zA-Z0-9]{15,18})/);
    if (rtMatch) ctx.recordTypeId = rtMatch[1];

    // Detect Field pages: /lightning/object/{ObjectApiName}/field/{FieldName}
    const fieldMatch = url.match(/\/lightning\/object\/([^/]+)\/field\/([^/?]+)/);
    if (fieldMatch) {
      ctx.pageType = 'field';
      ctx.objectApiName = fieldMatch[1];
      ctx.fieldName = fieldMatch[2];
    }

    // Detect User pages: /lightning/r/User/{UserId}/view
    const userMatch = url.match(/\/lightning\/r\/User\/([a-zA-Z0-9]{15,18})/);
    if (userMatch) {
      ctx.userId = userMatch[1];
    }

    // Extract Object from Apex/Setup paths
    if (url.includes('/apex/')) {
      ctx.pageType = 'apex';
      const apexMatch = url.match(/\/apex\/([^/?]+)/);
      if (apexMatch) ctx.apexClassName = apexMatch[1];
    }

    // Detect Flow Builder
    if (url.includes('/builder_platform_interaction/flowBuilder.app')) {
      ctx.pageType = 'flowBuilder';
      ctx.isSetup = true;
      const flowIdMatch = url.match(/flowId=([a-zA-Z0-9]{15,18})/);
      if (flowIdMatch) ctx.recordId = flowIdMatch[1];
    }

    return ctx;
  }

  /**
   * Get the current Salesforce instance URL
   */
  function getInstanceUrl() {
    if (window.sfApi && window.sfApi.instanceUrl) return window.sfApi.instanceUrl;
    return window.location.origin;
  }

  /**
   * Get the 18-digit record ID from the page (for fallback)
   */
  function getCurrentRecordId() {
    // Try URL first
    const urlMatch = window.location.href.match(/\/([a-zA-Z0-9]{15,18})(?:[/?#]|$)/);
    if (urlMatch) return urlMatch[1];
    return null;
  }

  /* ─── Time Analysis ─── */

  function getTimePeriod() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /* ─── Activity Tracking ─── */

  function loadActivityLog() {
    try {
      const stored = localStorage.getItem(ACTIVITY_LOG_KEY);
      if (stored) {
        activityLog = JSON.parse(stored);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        activityLog = activityLog.filter(e => e.timestamp > sevenDaysAgo);
      }
    } catch (e) { activityLog = []; }
  }

  function saveActivityLog() {
    try { localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog.slice(-500))); }
    catch (e) { /* quota */ }
  }

  function recordActivity(action, details = {}) {
    activityLog.push({ timestamp: Date.now(), action, ...details });
    if (activityLog.length > 500) activityLog = activityLog.slice(-500);
    saveActivityLog();
  }

  function getFrequencyScore(action) {
    const now = Date.now();
    const day = 86400000;
    let score = 0;
    for (const e of activityLog) {
      if (e.action !== action) continue;
      const age = now - e.timestamp;
      if (age < day) score += 3;
      else if (age < 7 * day) score += 1;
    }
    return score;
  }

  /* ─── Deep Context Suggestion Generator ─── */

  function generateContextSuggestions(ctx) {
    const suggestions = [];
    const baseUrl = getInstanceUrl();

    // ═══════════════════════════════════════════════════════════════
    // RECORD PAGE suggestions — the richest context
    // ═══════════════════════════════════════════════════════════════
    if (ctx.isRecordPage && ctx.objectApiName && ctx.recordId) {
      const obj = ctx.objectApiName;
      const rid = ctx.recordId;

      suggestions.push(
        {
          id: 'show-all-data',
          label: `Show All Data — ${obj}`,
          desc: `Inspect every field on this ${obj} record`,
          icon: 'fa-database',
          category: 'Inspector',
          priority: 10,
          launch: () => window.setGlobalSearchContext?.({ name: 'Show All Data', url: `sfi:record-viewer?id=${rid}&object=${obj}` })
        },
        {
          id: 'field-info',
          label: `Field Info — ${obj}`,
          desc: `Browse field definitions, types, and FLS for ${obj}`,
          icon: 'fa-table-columns',
          category: 'Inspector',
          priority: 9,
          launch: () => window.setGlobalSearchContext?.({ name: 'Field Info', url: `sfi:data-export?query=${encodeURIComponent('SELECT Id FROM ' + obj + ' LIMIT 0')}&openFieldInfo=true` })
        },
        {
          id: 'clone-record',
          label: `Clone this ${obj}`,
          desc: `Clone to another org or as a new record`,
          icon: 'fa-copy',
          category: 'Tools',
          priority: 8,
          launch: () => window.setGlobalSearchContext?.({ name: 'Clone Record', url: `sfi:record-clone?id=${rid}&object=${obj}` })
        },
        {
          id: 'export-record',
          label: `Export this ${obj}`,
          desc: `Query and export this record's data`,
          icon: 'fa-download',
          category: 'Data Export',
          priority: 8,
          launch: () => window.setGlobalSearchContext?.({ name: 'Data Export (Inspector)', url: `sfi:data-export?query=${encodeURIComponent('SELECT Id FROM ' + obj + " WHERE Id = '" + rid + "'" )}`, liveQuery: true })
        },
        {
          id: 'open-setup-object',
          label: `Object Manager — ${obj}`,
          desc: `Open ${obj} in Salesforce Setup`,
          icon: 'fa-cubes',
          category: 'Setup',
          priority: 7,
          launch: () => window.open(`${baseUrl}/lightning/setup/ObjectManager/${obj}/details`, '_blank')
        },
        {
          id: 'open-compact-layout',
          label: `Compact Layouts — ${obj}`,
          desc: `View and edit compact layouts for ${obj}`,
          icon: 'fa-table-list',
          category: 'Setup',
          priority: 6,
          launch: () => window.open(`${baseUrl}/lightning/setup/ObjectManager/${obj}/compactLayouts`, '_blank')
        }
      );

      // If recordTypeId is in URL, add Record Type suggestion
      if (ctx.recordTypeId) {
        suggestions.push({
          id: 'open-record-type',
          label: `Record Type — ${obj}`,
          desc: `View record type ${ctx.recordTypeId.substring(0, 8)}…`,
          icon: 'fa-tag',
          category: 'Setup',
          priority: 7,
          launch: () => window.open(`${baseUrl}/lightning/setup/ObjectManager/${obj}/recordTypes`, '_blank')
        });
      }

      // Object-specific quick links
      const objectShortcuts = {
        'User': [
          { id: 'login-as', label: `Login as this User`, desc: 'Switch to this user\'s session', icon: 'fa-right-to-bracket', category: 'Admin', priority: 10,
            launch: () => window.open(`${baseUrl}/_ui/core/chatter/users/UiInternalLoginAs?userId=${rid}`, '_blank') },
          { id: 'user-permissions', label: `Permissions — User`, desc: 'View assigned permission sets and profiles', icon: 'fa-key', category: 'Security', priority: 8,
            launch: () => window.open(`${baseUrl}/lightning/setup/EnhancedProfiles/page?address=%2Fp%2Fsetup%2Fenhancedprofiles%2FUserEditWorkflow%3Fid%3D${rid}`, '_blank') },
          { id: 'assign-perm-set', label: `Assign Permission Set`, desc: 'Assign a permission set to this user', icon: 'fa-user-shield', category: 'Security', priority: 8,
            launch: () => window.open(`${baseUrl}/lightning/setup/PermSets/page?address=%2Fp%2Fsetup%2Fpermset%2FPermissionSetAssignment%3FuserId%3D${rid}`, '_blank') },
          { id: 'user-login-history', label: `Login History`, desc: 'View login history for this user', icon: 'fa-clock-rotate-left', category: 'Security', priority: 7,
            launch: () => window.open(`${baseUrl}/lightning/setup/LoginHistory/page?address=%2F005%2Fe%3FretURL%3D%252F${rid}`, '_blank') }
        ],
        'Contact': [
          { id: 'login-as-contact', label: `Login as Contact's User`, desc: 'Login as the portal user linked to this contact', icon: 'fa-right-to-bracket', category: 'Admin', priority: 9,
            launch: () => window.open(`${baseUrl}/_ui/core/chatter/users/UiInternalLoginAs?userId=${rid}`, '_blank') }
        ],
        'Account': [
          { id: 'account-contacts', label: `View Account Contacts`, desc: 'See all contacts under this account', icon: 'fa-address-book', category: 'Related', priority: 7,
            launch: () => window.open(`${baseUrl}/lightning/r/Account/${rid}/related/Contacts/view`, '_blank') },
          { id: 'account-opportunities', label: `View Account Opportunities`, desc: 'See all opportunities for this account', icon: 'fa-handshake', category: 'Related', priority: 7,
            launch: () => window.open(`${baseUrl}/lightning/r/Account/${rid}/related/Opportunities/view`, '_blank') }
        ],
        'Opportunity': [
          { id: 'opp-contact-roles', label: `Contact Roles`, desc: 'View contact roles on this opportunity', icon: 'fa-users', category: 'Related', priority: 7,
            launch: () => window.open(`${baseUrl}/lightning/r/Opportunity/${rid}/related/OpportunityContactRoles/view`, '_blank') }
        ]
      };

      if (objectShortcuts[obj]) {
        suggestions.push(...objectShortcuts[obj]);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // LIST VIEW suggestions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.isListView && ctx.objectApiName) {
      const obj = ctx.objectApiName;
      suggestions.push(
        { id: 'export-list', label: `Export ${obj} List`, desc: `Query all ${obj} records`, icon: 'fa-download', category: 'Data Export', priority: 9,
          launch: () => { window.setGlobalSearchContext?.({ name: 'Data Export (Inspector)', url: 'sfi:data-export' }); } },
        { id: 'setup-object', label: `Object Manager — ${obj}`, desc: `Open ${obj} in Setup`, icon: 'fa-cubes', category: 'Setup', priority: 8,
          launch: () => window.open(`${baseUrl}/lightning/setup/ObjectManager/${obj}/details`, '_blank') },
        { id: 'import-object', label: `Import to ${obj}`, desc: `Bulk import records into ${obj}`, icon: 'fa-file-import', category: 'Data Import', priority: 7,
          launch: () => openInNewTab('data-import') },
        { id: 'bulk-fields', label: `Bulk Fields — ${obj}`, desc: `Create multiple fields on ${obj}`, icon: 'fa-table-columns', category: 'Builder', priority: 6,
          launch: () => openInNewTab('bulk-field-builder') }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // SETUP page suggestions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.isSetup) {
      const setupSuggestions = {
        'ApexClasses': [
          { id: 'anon-apex', label: 'Execute Anonymous Apex', desc: 'Run a quick Apex snippet', icon: 'fa-terminal', category: 'Dev', priority: 9,
            launch: () => openInNewTab('anonymous-apex') },
          { id: 'code-coverage', label: 'Code Coverage Report', desc: 'View Apex test coverage', icon: 'fa-vial', category: 'Testing', priority: 8,
            launch: () => openInNewTab('code-coverage') },
          { id: 'apex-triggers', label: 'Apex Triggers', desc: 'Browse all triggers', icon: 'fa-bolt', category: 'Dev', priority: 7,
            launch: () => openInNewTab('apex-triggers') }
        ],
        'ApexTriggers': [
          { id: 'anon-apex2', label: 'Execute Anonymous Apex', desc: 'Run a quick Apex snippet', icon: 'fa-terminal', category: 'Dev', priority: 9,
            launch: () => openInNewTab('anonymous-apex') },
          { id: 'apex-classes2', label: 'Apex Classes', desc: 'Browse all classes', icon: 'fa-code', category: 'Dev', priority: 8,
            launch: () => openInNewTab('apex-classes') }
        ],
        'Flows': [
          { id: 'flow-scanner', label: 'Flow Scanner Rules', desc: 'Configure flow analysis rules', icon: 'fa-magnifying-glass', category: 'Quality', priority: 9,
            launch: () => openInNewTab('flow-scanner') }
        ],
        'Users': [
          { id: 'user-list-export', label: 'Export User List', desc: 'Query and export all users', icon: 'fa-download', category: 'Data', priority: 8,
            launch: () => openInNewTab('data-export') },
          { id: 'security-audit', label: 'Access & Security Audit', desc: 'Scan user permissions and access', icon: 'fa-shield-halved', category: 'Security', priority: 7,
            launch: () => openInNewTab('security-audit') }
        ],
        'Profiles': [
          { id: 'perm-sets', label: 'Permission Sets', desc: 'Browse and manage permission sets', icon: 'fa-key', category: 'Security', priority: 8,
            launch: () => window.open(`${baseUrl}/lightning/setup/PermissionSets/home`, '_blank') },
          { id: 'security-audit2', label: 'Access & Security Audit', desc: 'Scan permissions and access', icon: 'fa-shield-halved', category: 'Security', priority: 7,
            launch: () => openInNewTab('security-audit') }
        ],
        'PermissionSets': [
          { id: 'bulk-perm', label: 'Bulk Permission Wizard', desc: 'Assign/revoke permissions in bulk', icon: 'fa-user-shield', category: 'Admin', priority: 9,
            launch: () => openInNewTab('bulk-permission-wizard') }
        ],
        'CustomSettings': [
          { id: 'cs-manage', label: 'Manage Records', desc: 'Manage custom setting records', icon: 'fa-table-list', category: 'Data', priority: 9,
            launch: () => window.open(`${baseUrl}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FlistCustomSettingsData.apexp`, '_blank') }
        ],
        'CustomMetadata': [
          { id: 'cmd-export', label: 'Export Metadata Records', desc: 'Query and export custom metadata records', icon: 'fa-download', category: 'Data', priority: 9,
            launch: () => window.setGlobalSearchContext?.({ name: 'Data Export (Inspector)', url: 'sfi:data-export' }) }
        ]
      };

      if (ctx.setupPath && setupSuggestions[ctx.setupPath]) {
        suggestions.push(...setupSuggestions[ctx.setupPath]);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FLOW BUILDER suggestions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.pageType === 'flowBuilder' && ctx.recordId) {
      suggestions.push(
        { id: 'flow-version-history', label: 'Flow Version History', desc: 'See all versions of this flow', icon: 'fa-clock-rotate-left', category: 'Setup', priority: 9,
          launch: () => window.open(`${baseUrl}/lightning/setup/Flows/page?address=%2F${ctx.recordId}`, '_blank') }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // FIELD page suggestions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.pageType === 'field' && ctx.objectApiName && ctx.fieldName) {
      suggestions.push(
        { id: 'field-fls', label: `FLS for ${ctx.fieldName}`, desc: `Check field-level security on ${ctx.fieldName}`, icon: 'fa-lock', category: 'Security', priority: 9,
          launch: () => openInNewTab('field-info') },
        { id: 'field-usage', label: `Field Usage — ${ctx.fieldName}`, desc: `See where ${ctx.fieldName} is used`, icon: 'fa-magnifying-glass', category: 'Analysis', priority: 7,
          launch: () => openInNewTab('field-info') }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // APEX page suggestions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.pageType === 'apex' && ctx.apexClassName) {
      suggestions.push(
        { id: 'open-in-editor', label: `Open ${ctx.apexClassName} in Editor`, desc: 'Edit this class in the built-in code editor', icon: 'fa-code', category: 'Dev', priority: 10,
          launch: () => openInNewTab('code-editor', { className: ctx.apexClassName }) },
        { id: 'view-coverage', label: `Coverage — ${ctx.apexClassName}`, desc: 'See code coverage for this class', icon: 'fa-vial', category: 'Testing', priority: 8,
          launch: () => openInNewTab('code-coverage') }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // HOME page — universal quick actions
    // ═══════════════════════════════════════════════════════════════
    if (ctx.isHome) {
      suggestions.push(
        { id: 'quick-export', label: 'Quick Data Export', desc: 'Run a SOQL query and export results', icon: 'fa-download', category: 'Data', priority: 9,
          launch: () => openInNewTab('data-export') },
        { id: 'quick-apex', label: 'Execute Anonymous', desc: 'Run Apex code instantly', icon: 'fa-terminal', category: 'Dev', priority: 8,
          launch: () => openInNewTab('anonymous-apex') },
        { id: 'debug-logs', label: 'Debug Logs', desc: 'View and manage debug logs', icon: 'fa-scroll', category: 'Logs', priority: 7,
          launch: () => openInNewTab('debug-logs') }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // UNIVERSAL suggestions — always available
    // ═══════════════════════════════════════════════════════════════
    const universalSuggestions = [
      { id: 'org-limits', label: 'Org Limits', desc: 'Check API usage and org limits', icon: 'fa-gauge', category: 'Monitoring', priority: 5,
        launch: () => openInNewTab('org-limits') },
      { id: 'metadata-export', label: 'Metadata Exporter', desc: 'Retrieve metadata components', icon: 'fa-cube', category: 'Metadata', priority: 5,
        launch: () => openInNewTab('metadata-exporter') },
      { id: 'rest-explorer', label: 'REST Explorer', desc: 'Test REST API endpoints', icon: 'fa-paper-plane', category: 'API', priority: 5,
        launch: () => openInNewTab('rest-explorer') }
    ];
    suggestions.push(...universalSuggestions);

    return suggestions;
  }

  /**
   * Get frequency-based suggestions from activity history
   */
  function getFrequencySuggestions() {
    const scored = {};
    for (const e of activityLog) {
      if (!e.action.startsWith('command-')) continue;
      if (!scored[e.action]) {
        scored[e.action] = { action: e.action, score: getFrequencyScore(e.action), lastUsed: e.timestamp };
      }
    }
    return Object.values(scored)
      .filter(s => s.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => ({
        id: 'freq-' + s.action,
        label: formatLabel(s.action),
        desc: 'Frequently used',
        icon: 'fa-clock-rotate-left',
        category: 'Recent',
        priority: Math.min(8, Math.floor(s.score / 2) + 4),
        launch: () => {
          const cmd = (window.sfarcCommands || []).find(c => c.name === formatLabel(s.action) || c.label === formatLabel(s.action));
          if (cmd) window.setGlobalSearchContext?.(cmd);
        }
      }));
  }

  function formatLabel(action) {
    const name = action.startsWith('command-') ? action.substring(8) : action;
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /* ─── Main API ─── */

  function init() {
    loadActivityLog();
    refresh();

    // Listen for Salesforce Lightning SPA navigation
    // Lightning uses hash-based routing, so listen for hashchange
    window.addEventListener('hashchange', () => {
      setTimeout(() => refresh(), 100);
    });

    // Also listen for popstate for non-hash navigation
    window.addEventListener('popstate', () => {
      setTimeout(() => refresh(), 100);
    });

    // MutationObserver to detect URL changes via pushState/replaceState
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => refresh(), 150);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    return suggestions;
  }

  function refresh() {
    const ctx = parseSalesforceContext();
    currentContext = ctx;

    const contextSuggestions = generateContextSuggestions(ctx);
    const freqSuggestions = getFrequencySuggestions();

    // Merge, deduplicate by id, sort by priority
    const seen = new Set();
    const merged = [];
    for (const s of [...contextSuggestions, ...freqSuggestions]) {
      if (!seen.has(s.id)) { seen.add(s.id); merged.push(s); }
    }
    suggestions = merged.sort((a, b) => b.priority - a.priority).slice(0, 12);
    return suggestions;
  }

  function getSuggestions() { return suggestions; }

  function getFormattedSuggestions() {
    // Always refresh context before returning suggestions
    refresh();
    return suggestions.map(s => ({
      ...s,
      isSmart: true,
      icon: s.icon || 'fa-circle'
    }));
  }

  function recordCommandUsage(commandName) {
    recordActivity('command-' + commandName.toLowerCase().replace(/\s+/g, '-'));
  }

  return {
    init,
    refresh,
    getSuggestions,
    getFormattedSuggestions,
    recordActivity,
    recordCommandUsage,
    parseSalesforceContext,
    getInstanceUrl
  };
})();

if (typeof window !== 'undefined') {
  window.SmartSuggestions = SmartSuggestions;
}
