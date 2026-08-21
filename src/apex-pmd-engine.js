// apex-pmd-engine.js - Client-Side Static Analysis Engine for Apex Code

export const DEFAULT_PMD_RULES = {
  AvoidSoqlInLoops: { enabled: true, severity: 'error', name: 'Avoid SOQL In Loops', desc: 'Avoid executing SOQL queries inside loops to prevent Governor Limit exceptions (101 SOQL limit).' },
  AvoidDmlInLoops: { enabled: true, severity: 'error', name: 'Avoid DML In Loops', desc: 'Avoid executing DML statements (insert, update, delete, merge, undelete) inside loops.' },
  AvoidHardcodedIds: { enabled: true, severity: 'warning', name: 'Avoid Hardcoded Salesforce IDs', desc: 'Hardcoding 15 or 18 character Salesforce IDs makes code non-portable across environments.' },
  ApexCRUDViolation: { enabled: true, severity: 'warning', name: 'Apex CRUD/FLS Enforcement', desc: 'Ensure accessibility and updateability checks (isAccessible, isUpdateable) are performed before database operations.' },
  ExcessiveClassLength: { enabled: true, severity: 'info', name: 'Excessive Class Length', desc: 'Classes exceeding 1,000 lines are harder to maintain and test.', threshold: 1000 },
  MissingApexDoc: { enabled: true, severity: 'info', name: 'Missing ApexDoc Comments', desc: 'Public or global classes and methods should include ApexDoc comments.' }
};

/**
 * Analyzes Apex code and returns array of PMD markers.
 * @param {string} code - Apex source code
 * @param {Object} rulesConfig - Configuration map overriding DEFAULT_PMD_RULES
 * @returns {Array} Array of diagnostic markers
 */
export function analyzeApexPmd(code, rulesConfig = {}) {
  if (!code || typeof code !== 'string') return [];

  const rules = { ...DEFAULT_PMD_RULES, ...rulesConfig };
  const markers = [];
  const lines = code.split('\n');

  let inLoop = false;
  let loopStartLine = 0;
  let braceDepth = 0;
  let loopBraceDepth = 0;

  lines.forEach((lineText, index) => {
    const lineNumber = index + 1;
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // Track loop context
    if (/^\b(for|while|do)\b/i.test(trimmed)) {
      inLoop = true;
      loopStartLine = lineNumber;
      loopBraceDepth = braceDepth;
    }

    // Count braces
    const openBraces = (lineText.match(/\{/g) || []).length;
    const closeBraces = (lineText.match(/\}/g) || []).length;
    braceDepth += openBraces - closeBraces;

    if (inLoop && braceDepth <= loopBraceDepth && closeBraces > 0) {
      inLoop = false;
    }

    // Rule 1: AvoidSoqlInLoops
    if (rules.AvoidSoqlInLoops.enabled && inLoop) {
      if (/\[\s*SELECT\b/i.test(trimmed) || /Database\.(query|countQuery)\s*\(/i.test(trimmed)) {
        markers.push({
          ruleId: 'AvoidSoqlInLoops',
          severity: rules.AvoidSoqlInLoops.severity,
          message: 'PMD Rule (AvoidSoqlInLoops): Avoid executing SOQL queries inside loops to prevent Governor Limit exceptions (101 limit).',
          startLineNumber: lineNumber,
          startColumn: lineText.indexOf(trimmed.substring(0, 10)) + 1,
          endLineNumber: lineNumber,
          endColumn: lineText.length + 1
        });
      }
    }

    // Rule 2: AvoidDmlInLoops
    if (rules.AvoidDmlInLoops.enabled && inLoop) {
      if (/\b(insert|update|delete|merge|undelete|upsert)\b/i.test(trimmed) && !/Schema\./i.test(trimmed)) {
        markers.push({
          ruleId: 'AvoidDmlInLoops',
          severity: rules.AvoidDmlInLoops.severity,
          message: 'PMD Rule (AvoidDmlInLoops): Avoid executing DML operations inside loops.',
          startLineNumber: lineNumber,
          startColumn: lineText.indexOf(trimmed.substring(0, 10)) + 1,
          endLineNumber: lineNumber,
          endColumn: lineText.length + 1
        });
      }
    }

    // Rule 3: AvoidHardcodedIds
    if (rules.AvoidHardcodedIds.enabled) {
      const idMatch = trimmed.match(/'[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?'/);
      if (idMatch && !/000000000000000AAA/.test(idMatch[0])) {
        markers.push({
          ruleId: 'AvoidHardcodedIds',
          severity: rules.AvoidHardcodedIds.severity,
          message: `PMD Rule (AvoidHardcodedIds): Avoid hardcoding Salesforce ID (${idMatch[0]}). Use querying or Custom Settings instead.`,
          startLineNumber: lineNumber,
          startColumn: lineText.indexOf(idMatch[0]) + 1,
          endLineNumber: lineNumber,
          endColumn: lineText.indexOf(idMatch[0]) + idMatch[0].length + 1
        });
      }
    }

    // Rule 4: ApexCRUDViolation
    if (rules.ApexCRUDViolation.enabled) {
      if (/\b(insert|update|delete)\b/i.test(trimmed) && !/isAccessible|isUpdateable|isCreateable|isDeletable|Security\.stripInaccessible/i.test(trimmed)) {
        markers.push({
          ruleId: 'ApexCRUDViolation',
          severity: rules.ApexCRUDViolation.severity,
          message: 'PMD Rule (ApexCRUDViolation): Ensure CRUD/FLS permissions are checked or Security.stripInaccessible() is used before DML operations.',
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineText.length + 1
        });
      }
    }

    // Rule 5: MissingApexDoc
    if (rules.MissingApexDoc.enabled) {
      if (/^\s*public\s+(class|interface|with\s+sharing\s+class|without\s+sharing\s+class)/i.test(lineText) && index > 0) {
        const prevLine = lines[index - 1].trim();
        if (!prevLine.startsWith('*/') && !prevLine.startsWith('//')) {
          markers.push({
            ruleId: 'MissingApexDoc',
            severity: rules.MissingApexDoc.severity,
            message: 'PMD Rule (MissingApexDoc): Public/Global classes should include ApexDoc header comments.',
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: lineText.length + 1
          });
        }
      }
    }
  });

  // Rule 6: ExcessiveClassLength
  if (rules.ExcessiveClassLength.enabled && lines.length > (rules.ExcessiveClassLength.threshold || 1000)) {
    markers.push({
      ruleId: 'ExcessiveClassLength',
      severity: rules.ExcessiveClassLength.severity,
      message: `PMD Rule (ExcessiveClassLength): Class length (${lines.length} lines) exceeds threshold (${rules.ExcessiveClassLength.threshold || 1000} lines).`,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 50
    });
  }

  return markers;
}
