/**
 * Lightning Flow Scanner Coordinator
 * Supports official configuration options (severity thresholds, category filtering, exceptions, ignoreFlows).
 */

class FlowScannerEngine {
  constructor(rules = FLOW_RULES, options = {}) {
    this.rules = rules;
    this.options = {
      threshold: options.threshold || null, // 'error' | 'warning' | 'note'
      categories: options.categories || null, // ['problem', 'suggestion', 'layout']
      ignoreFlows: options.ignoreFlows || [],
      exceptions: options.exceptions || {},
      ...options
    };
  }

  scan(flowMetadata) {
    const startTime = performance.now();
    let issues = [];

    if (!flowMetadata) {
      return {
        summary: { total: 0, errors: 0, warnings: 0, info: 0, durationMs: 0 },
        issues: []
      };
    }

    const flowName = flowMetadata.fullName || flowMetadata.name || "";

    // Check ignoreFlows configuration
    if (this.options.ignoreFlows && this.options.ignoreFlows.includes(flowName)) {
      console.log(`[FlowScanner] Flow '${flowName}' is ignored by configuration.`);
      return {
        summary: { total: 0, errors: 0, warnings: 0, info: 0, durationMs: 0, ignored: true },
        issues: []
      };
    }

    // Filter rules by categories option if specified
    let activeRules = this.rules;
    if (this.options.categories && Array.isArray(this.options.categories)) {
      activeRules = activeRules.filter(r => this.options.categories.includes(r.category));
    }

    // Execute each rule against the flow metadata
    activeRules.forEach(rule => {
      try {
        const ruleIssues = rule.evaluate(flowMetadata);
        if (Array.isArray(ruleIssues)) {
          // Check exceptions for this flow & rule
          const flowExceptions = this.options.exceptions[flowName] || {};
          const ruleExceptions = flowExceptions[rule.ruleId] || flowExceptions[rule.className] || [];

          ruleIssues.forEach(issue => {
            // Apply rule override options
            if (this.options.rules && this.options.rules[rule.ruleId]) {
              const ruleConfig = this.options.rules[rule.ruleId];
              if (ruleConfig.enabled === false) return;
              if (ruleConfig.severity) issue.severity = ruleConfig.severity;
              if (ruleConfig.message) issue.message = ruleConfig.message;
            }

            // Suppress if in exceptions
            if (ruleExceptions.includes("*") || ruleExceptions.includes(issue.violationName)) {
              return;
            }

            issues.push(issue);
          });
        }
      } catch (err) {
        console.error(`[FlowScanner] Error executing rule ${rule.ruleId || rule.id}:`, err);
      }
    });

    // Apply severity threshold filter
    if (this.options.threshold) {
      const allowedSeverities = {
        error: ['error'],
        warning: ['error', 'warning'],
        note: ['error', 'warning', 'note']
      }[this.options.threshold.toLowerCase()] || ['error', 'warning', 'note'];

      issues = issues.filter(i => allowedSeverities.includes(i.severity.toLowerCase()));
    }

    // Sort issues by severity (error -> warning -> note)
    const severityMap = { error: 1, warning: 2, note: 3 };
    issues.sort((a, b) => (severityMap[a.severity.toLowerCase()] || 99) - (severityMap[b.severity.toLowerCase()] || 99));

    const durationMs = Math.round(performance.now() - startTime);

    const errors = issues.filter(i => i.severity.toLowerCase() === 'error').length;
    const warnings = issues.filter(i => i.severity.toLowerCase() === 'warning').length;
    const info = issues.filter(i => i.severity.toLowerCase() === 'note').length;

    return {
      summary: {
        total: issues.length,
        errors,
        warnings,
        info,
        durationMs,
        rulesExecutedCount: activeRules.length,
        scannedAt: new Date().toISOString()
      },
      issues
    };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { FlowScannerEngine };
}
