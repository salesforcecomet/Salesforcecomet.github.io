/**
 * Complete Official Lightning Flow Scanner Rules Engine
 * Implements 29 official rules with exact Rule IDs, Class Names, Categories, Severities, and Expressions.
 * Includes array-normalizer for Salesforce Tooling API single-object metadata responses.
 */

// Helper to normalize single objects vs arrays returned by Salesforce Tooling API
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

const OFFICIAL_FLOW_RULES = [
  // ==========================================
  // CATEGORY: PROBLEMS (Anti-patterns & Security)
  // ==========================================
  {
    ruleId: "dml-in-loop",
    className: "DMLStatementInLoop",
    ruleName: "DMLStatementInLoop",
    severity: "error",
    category: "problem",
    description: "Executing DML operations (insert, update, delete) inside a loop is a high-risk anti-pattern.",
    evaluate: function (flow) {
      const issues = [];
      const loops = ensureArray(flow.loops);
      loops.forEach(loop => {
        const loopNodes = getNodesInsideLoop(flow, loop);
        loopNodes.forEach(node => {
          if (['recordCreates', 'recordUpdates', 'recordDeletes'].includes(node.type)) {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: node.name || node.apiName || node.label || "undefined",
              type: node.type,
              metaType: "node",
              dataType: "",
              locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
              locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
              connectsTo: getConnectorTarget(node),
              expression: "",
              message: `DML statement '${node.name}' executed inside loop '${loop.name}'.`
            });
          }
        });
      });
      return issues;
    }
  },
  {
    ruleId: "hardcoded-id",
    className: "HardcodedId",
    ruleName: "HardcodedId",
    severity: "error",
    category: "problem",
    description: "Avoid hard-coding record IDs, as they are unique to a specific org.",
    evaluate: function (flow) {
      const issues = [];
      const idRegex = /\b[0-9a-zA-Z]{15}([0-9a-zA-Z]{3})?\b/;
      const isRecordId = (val) => typeof val === 'string' && idRegex.test(val) && !val.startsWith('00000');
      const ignoredKeys = new Set(['id', 'Id', 'flowId', 'definitionId', 'latestVersionId', 'activeVersionId', 'apiVersion', 'processType', 'fullName']);

      const checkUserValues = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (ignoredKeys.has(key)) continue;
            const val = obj[key];
            if (typeof val === 'string' && isRecordId(val)) {
              issues.push({
                ruleId: this.ruleId,
                className: this.className,
                ruleName: this.className,
                severity: this.severity,
                category: this.category,
                violationName: obj.name || obj.apiName || obj.label || "attribute",
                type: "attribute",
                metaType: "attribute",
                dataType: "string",
                locationX: obj.locationX !== undefined && obj.locationX !== null ? obj.locationX : "",
                locationY: obj.locationY !== undefined && obj.locationY !== null ? obj.locationY : "",
                connectsTo: getConnectorTarget(obj),
                expression: val,
                message: `Hardcoded Salesforce ID '${val}' found.`
              });
            } else if (typeof val === 'object') {
              checkUserValues(val);
            }
          }
        }
      };

      const userSections = ['assignments', 'decisions', 'formulas', 'constants', 'textTemplates', 'recordLookups', 'recordCreates', 'recordUpdates', 'recordDeletes'];
      userSections.forEach(sec => {
        ensureArray(flow[sec]).forEach(item => checkUserValues(item));
      });
      return issues;
    }
  },
  {
    ruleId: "hardcoded-secret",
    className: "HardcodedSecret",
    ruleName: "HardcodedSecret",
    severity: "error",
    category: "problem",
    description: "Avoid hardcoding secrets, API keys, tokens, or credentials in Flows.",
    evaluate: function (flow) {
      const issues = [];
      const secretRegex = /\b(sk_live_[0-9a-zA-Z]{24}|bearer\s+[a-zA-Z0-9_\-\.]{20,}|api[_\-]?key[_\-]?=[a-zA-Z0-9]{16,})\b/i;

      traverseFlowValues(flow, (obj, path, val) => {
        if (typeof val === 'string' && secretRegex.test(val)) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: obj.name || obj.apiName || "attribute",
            type: "attribute",
            metaType: "attribute",
            dataType: "string",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: "secret_pattern",
            message: `Possible hardcoded secret or API token detected in '${path}'.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "hardcoded-url",
    className: "HardcodedUrl",
    ruleName: "HardcodedUrl",
    severity: "error",
    category: "problem",
    description: "Avoid hardcoding environment-dependent URLs in Flows.",
    evaluate: function (flow) {
      const issues = [];
      const urlRegex = /\bhttps?:\/\/[a-zA-Z0-9\-\.]+\.(salesforce|force|my\.salesforce)\.com\b/i;

      traverseFlowValues(flow, (obj, path, val) => {
        if (typeof val === 'string' && urlRegex.test(val)) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: obj.name || obj.apiName || "attribute",
            type: "attribute",
            metaType: "attribute",
            dataType: "string",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: val,
            message: `Hardcoded environment URL '${val}' detected.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "process-builder-usage",
    className: "ProcessBuilder",
    ruleName: "ProcessBuilder",
    severity: "error",
    category: "problem",
    description: "Process Builder is retired. Migrate logic to Flow.",
    evaluate: function (flow) {
      const issues = [];
      if (flow.processType === "Workflow" || flow.processType === "CustomProcess" || flow.processType === "ProcessBuilder") {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: flow.fullName || "ProcessBuilder",
          type: "processType",
          metaType: "attribute",
          dataType: "",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: flow.processType,
          message: "Process Builder automations are retired and should be migrated to Flow."
        });
      }
      return issues;
    }
  },
  {
    ruleId: "soql-in-loop",
    className: "SOQLQueryInLoop",
    ruleName: "SOQLQueryInLoop",
    severity: "error",
    category: "problem",
    description: "Running SOQL queries inside a loop can rapidly exceed query limits.",
    evaluate: function (flow) {
      const issues = [];
      const loops = ensureArray(flow.loops);
      loops.forEach(loop => {
        const loopNodes = getNodesInsideLoop(flow, loop);
        loopNodes.forEach(node => {
          if (node.type === 'recordLookups') {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: node.name || node.apiName || node.label || "undefined",
              type: "recordLookups",
              metaType: "node",
              dataType: "",
              locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
              locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
              connectsTo: getConnectorTarget(node),
              expression: "",
              message: `SOQL Get Records query '${node.name}' executed inside loop '${loop.name}'.`
            });
          }
        });
      });
      return issues;
    }
  },
  {
    ruleId: "unsafe-running-context",
    className: "UnsafeRunningContext",
    ruleName: "UnsafeRunningContext",
    severity: "error",
    category: "problem",
    description: "Flows configured to run in System Mode without Sharing grant access to all data.",
    evaluate: function (flow) {
      const issues = [];
      if (flow.runInMode === "SystemModeWithoutSharing") {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: flow.fullName || "FlowSettings",
          type: "runInMode",
          metaType: "attribute",
          dataType: "",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: "SystemModeWithoutSharing",
          message: "Unsafe running context: Flow is set to System Mode without Sharing."
        });
      }
      return issues;
    }
  },
  {
    ruleId: "duplicate-dml",
    className: "DuplicateDMLOperation",
    ruleName: "DuplicateDMLOperation",
    severity: "warning",
    category: "problem",
    description: "Backward navigation in screen flows with DML can cause duplicate operations.",
    evaluate: function (flow) {
      const issues = [];
      const screens = ensureArray(flow.screens);
      const dmls = [...ensureArray(flow.recordCreates), ...ensureArray(flow.recordUpdates), ...ensureArray(flow.recordDeletes)];
      if (screens.length > 1 && dmls.length > 0) {
        const allowsBack = screens.some(s => s.allowBack !== false);
        if (allowsBack) {
          dmls.forEach(dml => {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: dml.name || dml.label || "undefined",
              type: dml.type || "recordUpdates",
              metaType: "node",
              dataType: "",
              locationX: dml.locationX !== undefined && dml.locationX !== null ? dml.locationX : "",
              locationY: dml.locationY !== undefined && dml.locationY !== null ? dml.locationY : "",
              connectsTo: getConnectorTarget(dml),
              expression: "allowBack === true",
              message: `Screen flow contains DML element '${dml.name}' with backward screen navigation enabled.`
            });
          });
        }
      }
      return issues;
    }
  },
  {
    ruleId: "missing-fault-path",
    className: "MissingFaultPath",
    ruleName: "MissingFaultPath",
    severity: "warning",
    category: "problem",
    description: "Elements that can fail should include a Fault Path to handle errors gracefully.",
    evaluate: function (flow) {
      const issues = [];
      const dbNodeTypes = ['recordLookups', 'recordUpdates', 'recordCreates', 'recordDeletes', 'actionCalls'];

      dbNodeTypes.forEach(type => {
        const nodes = ensureArray(flow[type]);
        nodes.forEach(node => {
          const hasFault = node.faultConnector && (node.faultConnector.targetReference || node.faultConnector.target);
          if (!hasFault) {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: node.name || node.apiName || node.label || "undefined",
              type: type,
              metaType: "node",
              dataType: "",
              locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
              locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
              connectsTo: getConnectorTarget(node),
              expression: "",
              message: `Element '${node.name || node.label}' is missing a Fault Path connector.`
            });
          }
        });
      });
      return issues;
    }
  },
  {
    ruleId: "missing-null-handler",
    className: "MissingNullHandler",
    ruleName: "MissingNullHandler",
    severity: "warning",
    category: "problem",
    description: "Get Records operations return null when no data is found.",
    evaluate: function (flow) {
      const issues = [];
      const lookups = ensureArray(flow.recordLookups);
      lookups.forEach(node => {
        const handlesNull = node.assignNullValuesIfNoRecordsFound || node.storeOutputAutomatically;
        if (!handlesNull) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: node.name || node.apiName || node.label || "undefined",
            type: "recordLookups",
            metaType: "node",
            dataType: "",
            locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
            locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
            connectsTo: getConnectorTarget(node),
            expression: "",
            message: `Get Records element '${node.name}' does not handle null or empty results.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "recursive-record-update",
    className: "RecursiveAfterUpdate",
    ruleName: "RecursiveAfterUpdate",
    severity: "warning",
    category: "problem",
    description: "After-save Flows updating the triggering record can cause recursion.",
    evaluate: function (flow) {
      const issues = [];
      const updates = ensureArray(flow.recordUpdates);
      if (flow.triggerType === "RecordAfterSave" || (flow.start && flow.start.recordTriggerType)) {
        updates.forEach(node => {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: node.name || node.apiName || node.label || "undefined",
            type: "recordUpdates",
            metaType: "node",
            dataType: "",
            locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
            locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
            connectsTo: getConnectorTarget(node),
            expression: "",
            message: `Record update node '${node.name}' in after-save flow may trigger recursion.`
          });
        });
      }
      return issues;
    }
  },

  // ==========================================
  // CATEGORY: SUGGESTIONS
  // ==========================================
  {
    ruleId: "action-call-in-loop",
    className: "ActionCallsInLoop",
    ruleName: "ActionCallsInLoop",
    severity: "warning",
    category: "suggestion",
    description: "Repeatedly invoking Apex actions inside a loop can exhaust governor limits.",
    evaluate: function (flow) {
      const issues = [];
      const loops = ensureArray(flow.loops);
      loops.forEach(loop => {
        const loopNodes = getNodesInsideLoop(flow, loop);
        loopNodes.forEach(node => {
          if (node.type === 'actionCalls') {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: node.name || node.apiName || "undefined",
              type: "actionCalls",
              metaType: "node",
              dataType: "",
              locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
              locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
              connectsTo: getConnectorTarget(node),
              expression: "",
              message: `Action Call '${node.name}' executed inside loop '${loop.name}'. Bulkify logic.`
            });
          }
        });
      });
      return issues;
    }
  },
  {
    ruleId: "get-record-all-fields",
    className: "GetRecordAllFields",
    ruleName: "GetRecordAllFields",
    severity: "warning",
    category: "suggestion",
    description: "Avoid using Get Records to retrieve all fields unless necessary.",
    evaluate: function (flow) {
      const issues = [];
      const lookups = ensureArray(flow.recordLookups);
      lookups.forEach(node => {
        const isAllFields = node.storeOutputAutomatically === true ||
                            node.storeOutputAutomatically === "true" ||
                            !node.queriedFields ||
                            (Array.isArray(node.queriedFields) && node.queriedFields.length === 0);

        if (isAllFields) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: node.name || node.apiName || "undefined",
            type: "recordLookups",
            metaType: "node",
            dataType: "",
            locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
            locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
            connectsTo: getConnectorTarget(node),
            expression: "storeOutputAutomatically === true",
            message: `Get Records element '${node.name}' retrieves all fields automatically.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "inactive-flow",
    className: "InactiveFlow",
    ruleName: "InactiveFlow",
    severity: "warning",
    category: "suggestion",
    description: "Inactive Flows should be deleted or archived to reduce maintenance risk.",
    evaluate: function (flow) {
      const issues = [];
      if (flow.status === "Draft" || flow.status === "Inactive") {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: flow.fullName || "FlowStatus",
          type: "status",
          metaType: "attribute",
          dataType: "",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: flow.status,
          message: `Flow status is '${flow.status}'. Inactive flows should be archived if unused.`
        });
      }
      return issues;
    }
  },
  {
    ruleId: "invalid-api-version",
    className: "APIVersion",
    ruleName: "APIVersion",
    severity: "warning",
    category: "suggestion",
    description: "Flows running on outdated API versions may behave inconsistently.",
    evaluate: function (flow) {
      const issues = [];
      const apiVer = parseFloat(flow.apiVersion || "63");
      if (apiVer < 50.0) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: "apiVersion",
          type: "apiVersion",
          metaType: "attribute",
          dataType: "number",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: `>= 50 (Current: ${apiVer})`,
          message: `Flow API Version is ${apiVer}. Recommended API Version is >= 50.0.`
        });
      }
      return issues;
    }
  },
  {
    ruleId: "missing-record-trigger-filter",
    className: "MissingFilterRecordTrigger",
    ruleName: "MissingFilterRecordTrigger",
    severity: "warning",
    category: "suggestion",
    description: "Record-triggered Flows without filters on changed fields execute on every change.",
    evaluate: function (flow) {
      const issues = [];
      if (flow.start && (flow.start.recordTriggerType || flow.start.object) && (!flow.start.filters || ensureArray(flow.start.filters).length === 0)) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: "Start",
          type: "start",
          metaType: "node",
          dataType: "",
          locationX: flow.start.locationX || "",
          locationY: flow.start.locationY || "",
          connectsTo: getConnectorTarget(flow.start),
          expression: "filters === empty",
          message: "Record-triggered flow lacks entry filter conditions."
        });
      }
      return issues;
    }
  },
  {
    ruleId: "same-record-field-updates",
    className: "SameRecordFieldUpdates",
    ruleName: "SameRecordFieldUpdates",
    severity: "warning",
    category: "suggestion",
    description: "Use before-save updates to update triggering record fields efficiently.",
    evaluate: function (flow) {
      const issues = [];
      const updates = ensureArray(flow.recordUpdates);
      if (flow.start && flow.start.recordTriggerType === "RecordAfterSave") {
        updates.forEach(u => {
          if (u.inputReference === "$Record" || u.object === flow.start.object) {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: u.name || u.label || "undefined",
              type: "recordUpdates",
              metaType: "node",
              dataType: "",
              locationX: u.locationX || "",
              locationY: u.locationY || "",
              connectsTo: getConnectorTarget(u),
              expression: "$Record",
              message: `Record update '${u.name}' updates triggering record in after-save. Consider before-save flow.`
            });
          }
        });
      }
      return issues;
    }
  },
  {
    ruleId: "cognitive-complexity",
    className: "CognitiveComplexity",
    ruleName: "CognitiveComplexity",
    severity: "note",
    category: "suggestion",
    description: "Flows with deeply nested loops and decisions are hard to understand.",
    evaluate: function (flow) {
      const issues = [];
      const score = (ensureArray(flow.loops).length * 3) + (ensureArray(flow.decisions).length * 2);
      if (score > 15) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: flow.fullName || "FlowComplexity",
          type: "complexity",
          metaType: "attribute",
          dataType: "number",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: `score > 15 (${score})`,
          message: `Flow cognitive complexity score is ${score} (threshold: 15).`
        });
      }
      return issues;
    }
  },
  {
    ruleId: "excessive-cyclomatic-complexity",
    className: "CyclomaticComplexity",
    ruleName: "CyclomaticComplexity",
    severity: "note",
    category: "suggestion",
    description: "High numbers of loops and decision elements increase cyclomatic complexity.",
    evaluate: function (flow) {
      const issues = [];
      const decs = ensureArray(flow.decisions);
      const decCount = decs.reduce((acc, d) => acc + (ensureArray(d.rules).length || 1), 0);
      const loopCount = ensureArray(flow.loops).length;
      const complexity = 1 + decCount + loopCount;

      if (complexity > 25) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: flow.fullName || "CyclomaticComplexity",
          type: "complexity",
          metaType: "attribute",
          dataType: "number",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: `complexity > 25 (${complexity})`,
          message: `Flow cyclomatic complexity score is ${complexity} (threshold: 25).`
        });
      }
      return issues;
    }
  },
  {
    ruleId: "unspecified-trigger-order",
    className: "TriggerOrder",
    ruleName: "TriggerOrder",
    severity: "note",
    category: "suggestion",
    description: "Record-triggered Flows without a specified Trigger Order execute in unpredictable sequence.",
    evaluate: function (flow) {
      const issues = [];
      if (flow.processType === "AutoLaunchedFlow" || (flow.start && (flow.start.recordTriggerType || flow.start.object))) {
        if (!flow.triggerOrder) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: "TriggerOrder",
            type: "TriggerOrder",
            metaType: "attribute",
            dataType: "",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: "10, 20, 30 ...",
            message: "Trigger order recommended for record-triggered execution ordering."
          });
        }
      }
      return issues;
    }
  },
  {
    ruleId: "record-id-as-string",
    className: "RecordIdAsString",
    ruleName: "RecordIdAsString",
    severity: "note",
    category: "suggestion",
    description: "Flows that use String variables for record IDs introduce extra complexity.",
    evaluate: function (flow) {
      const issues = [];
      const vars = ensureArray(flow.variables);
      vars.forEach(v => {
        if (v.dataType === "String" && (v.name.toLowerCase().includes("recordid") || v.name.toLowerCase().endsWith("id"))) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: v.name,
            type: "variables",
            metaType: "variable",
            dataType: "String",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: "recordId as String",
            message: `Variable '${v.name}' is a String record ID. Consider using Record Variable.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "transform-instead-of-loop",
    className: "TransformInsteadOfLoop",
    ruleName: "TransformInsteadOfLoop",
    severity: "note",
    category: "suggestion",
    description: "Loop elements performing direct assignments can be replaced by Transform elements.",
    evaluate: function (flow) {
      const issues = [];
      const loops = ensureArray(flow.loops);
      loops.forEach(l => {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: l.name,
          type: "loops",
          metaType: "node",
          dataType: "",
          locationX: l.locationX || "",
          locationY: l.locationY || "",
          connectsTo: getConnectorTarget(l),
          expression: "TransformElement",
          message: `Loop '${l.name}' could be replaced with a Transform element for bulk performance.`
        });
      });
      return issues;
    }
  },

  // ==========================================
  // CATEGORY: LAYOUT & GOVERNANCE
  // ==========================================
  {
    ruleId: "invalid-naming-convention",
    className: "FlowName",
    ruleName: "FlowName",
    severity: "error",
    category: "layout",
    description: "Flow API name must match naming convention regex pattern.",
    evaluate: function (flow) {
      const issues = [];
      const name = flow.fullName || flow.name || "";
      const isSystemId = /^(30[01][a-zA-Z0-9]{12,15})$/.test(name);
      if (isSystemId) return []; // Ignore system IDs

      const regex = /^[A-Za-z0-9]+_[A-Za-z0-9]+$/;
      if (name && !regex.test(name)) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: name,
          type: "fullName",
          metaType: "attribute",
          dataType: "string",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: "[A-Za-z0-9]+_[A-Za-z0-9]+",
          message: `Flow API name '${name}' does not follow naming convention (Domain_Description).`
        });
      }
      return issues;
    }
  },
  {
    ruleId: "missing-flow-description",
    className: "FlowDescription",
    ruleName: "FlowDescription",
    severity: "error",
    category: "layout",
    description: "Flow descriptions are essential for documentation and maintainability.",
    evaluate: function (flow) {
      const issues = [];
      const desc = flow.description;
      if (desc === undefined || desc === null || String(desc).trim() === '') {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: "undefined",
          type: "description",
          metaType: "attribute",
          dataType: "",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: "!==null",
          message: "Flow description is missing or null."
        });
      }
      return issues;
    }
  },
  {
    ruleId: "missing-metadata-description",
    className: "MissingMetadataDescription",
    ruleName: "MissingMetadataDescription",
    severity: "warning",
    category: "layout",
    description: "Elements and metadata without a description reduce clarity.",
    evaluate: function (flow) {
      const issues = [];
      const nodeCols = ['recordCreates', 'recordUpdates', 'recordDeletes', 'recordLookups', 'assignments', 'decisions', 'loops', 'screens', 'actionCalls'];

      nodeCols.forEach(col => {
        ensureArray(flow[col]).forEach(node => {
          if (!node.description || String(node.description).trim() === '') {
            issues.push({
              ruleId: this.ruleId,
              className: this.className,
              ruleName: this.className,
              severity: this.severity,
              category: this.category,
              violationName: node.name || node.label || "undefined",
              type: col,
              metaType: "node",
              dataType: "",
              locationX: node.locationX !== undefined && node.locationX !== null ? node.locationX : "",
              locationY: node.locationY !== undefined && node.locationY !== null ? node.locationY : "",
              connectsTo: getConnectorTarget(node),
              expression: "",
              message: `Element '${node.name || node.label}' is missing a description.`
            });
          }
        });
      });
      return issues;
    }
  },
  {
    ruleId: "unclear-api-naming",
    className: "CopyAPIName",
    ruleName: "CopyAPIName",
    severity: "warning",
    category: "layout",
    description: "Elements with API names like Copy_X_Of_Element reduce Flow readability.",
    evaluate: function (flow) {
      const issues = [];
      traverseFlowValues(flow, (obj, path, val) => {
        if (typeof val === 'string' && /^Copy_\d+_of_/i.test(val)) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: val,
            type: "name",
            metaType: "attribute",
            dataType: "string",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: "Copy_X_Of_*",
            message: `Element API name '${val}' uses copied naming convention.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "unreachable-element",
    className: "UnconnectedElement",
    ruleName: "UnconnectedElement",
    severity: "warning",
    category: "layout",
    description: "Unconnected elements never execute and add unnecessary clutter.",
    evaluate: function (flow) {
      const issues = [];
      const reachable = getReachableNodeNames(flow);
      const allNodes = getAllFlowNodes(flow);

      allNodes.forEach(node => {
        if (!reachable.has(node.name) && node.name !== (flow.start ? flow.start.connector ? flow.start.connector.targetReference : '' : '')) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: node.name,
            type: node.type || "node",
            metaType: "node",
            dataType: "",
            locationX: node.locationX || "",
            locationY: node.locationY || "",
            connectsTo: getConnectorTarget(node),
            expression: "unconnected",
            message: `Element '${node.name}' is unreachable from start element.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "unused-variable",
    className: "UnusedVariable",
    ruleName: "UnusedVariable",
    severity: "warning",
    category: "layout",
    description: "Unused variables are never referenced.",
    evaluate: function (flow) {
      const issues = [];
      const vars = ensureArray(flow.variables);
      const flowCopy = { ...flow };
      delete flowCopy.variables;
      const otherJson = JSON.stringify(flowCopy);

      vars.forEach(v => {
        const vName = typeof v.name === 'string' ? v.name : (v.name?._ || v.apiName || '');
        if (!vName) return;
        const escaped = vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const refRegex = new RegExp(`(\\{!\\s*${escaped}(?:\\.[a-zA-Z0-9_]+)*\\s*\\}|\\b${escaped}\\b)`, 'i');
        if (!refRegex.test(otherJson)) {
          issues.push({
            ruleId: this.ruleId,
            className: this.className,
            ruleName: this.className,
            severity: this.severity,
            category: this.category,
            violationName: vName,
            type: "variables",
            metaType: "variable",
            dataType: v.dataType || "",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: "",
            message: `Variable '${vName}' is declared but never referenced.`
          });
        }
      });
      return issues;
    }
  },
  {
    ruleId: "missing-auto-layout",
    className: "AutoLayout",
    ruleName: "AutoLayout",
    severity: "note",
    category: "layout",
    description: "Auto-Layout keeps the canvas organized and easier to maintain.",
    evaluate: function (flow) {
      const issues = [];
      const metadataVals = ensureArray(flow.processMetadataValues);
      const isAuto = metadataVals.some(p => p.name === "CanvasMode" && p.value && p.value.stringValue === "AUTO_LAYOUT_CANVAS");
      if (!isAuto) {
        issues.push({
          ruleId: this.ruleId,
          className: this.className,
          ruleName: this.className,
          severity: this.severity,
          category: this.category,
          violationName: "CanvasMode",
          type: "processMetadataValues",
          metaType: "attribute",
          dataType: "",
          locationX: "",
          locationY: "",
          connectsTo: "",
          expression: "CanvasMode !== AUTO_LAYOUT_CANVAS",
          message: "Canvas mode is freeform. Enabling Auto-Layout is recommended."
        });
      }
      return issues;
    }
  }
];

// Helper traversal functions
function traverseFlowValues(obj, callback, currentPath = '') {
  if (!obj || typeof obj !== 'object') return;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof val === 'string') {
        callback(obj, newPath, val);
      } else if (typeof val === 'object') {
        traverseFlowValues(val, callback, newPath);
      }
    }
  }
}

function getConnectorTarget(node) {
  if (!node) return "";
  if (node.connector && node.connector.targetReference) return node.connector.targetReference;
  if (node.defaultConnector && node.defaultConnector.targetReference) return node.defaultConnector.targetReference;
  return "";
}

function getNodesInsideLoop(flow, loopNode) {
  const nodesInLoop = [];
  const nextValueConnector = loopNode.nextValueConnector ? loopNode.nextValueConnector.targetReference : null;
  if (!nextValueConnector) return nodesInLoop;

  const visited = new Set();
  const queue = [nextValueConnector];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId) || currentId === loopNode.name) continue;
    visited.add(currentId);

    const node = findElementByName(flow, currentId);
    if (node) {
      nodesInLoop.push(node);
      const connectors = getOutboundConnectors(node);
      connectors.forEach(c => {
        if (c && c !== loopNode.name && !visited.has(c)) {
          queue.push(c);
        }
      });
    }
  }

  return nodesInLoop;
}

function getReachableNodeNames(flow) {
  const reachable = new Set();
  const startTarget = flow.start && flow.start.connector ? flow.start.connector.targetReference : null;
  if (!startTarget) return reachable;

  const queue = [startTarget];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr || reachable.has(curr)) continue;
    reachable.add(curr);

    const node = findElementByName(flow, curr);
    if (node) {
      const outbound = getOutboundConnectors(node);
      outbound.forEach(c => {
        if (c && !reachable.has(c)) queue.push(c);
      });
    }
  }
  return reachable;
}

function getAllFlowNodes(flow) {
  const nodeCols = ['recordCreates', 'recordUpdates', 'recordDeletes', 'recordLookups', 'assignments', 'decisions', 'loops', 'screens', 'actionCalls', 'subflows'];
  const all = [];
  nodeCols.forEach(col => {
    ensureArray(flow[col]).forEach(n => all.push({ ...n, type: col }));
  });
  return all;
}

function findElementByName(flow, name) {
  const nodeCollections = ['recordCreates', 'recordUpdates', 'recordDeletes', 'recordLookups', 'assignments', 'decisions', 'loops', 'screens', 'actionCalls', 'subflows'];
  for (const col of nodeCollections) {
    const items = ensureArray(flow[col]);
    const found = items.find(item => item.name === name || item.apiName === name);
    if (found) return { ...found, type: col };
  }
  return null;
}

function getOutboundConnectors(node) {
  const connectors = [];
  if (node.connector && node.connector.targetReference) connectors.push(node.connector.targetReference);
  if (node.faultConnector && node.faultConnector.targetReference) connectors.push(node.faultConnector.targetReference);
  if (node.rules) {
    ensureArray(node.rules).forEach(r => {
      if (r.connector && r.connector.targetReference) connectors.push(r.connector.targetReference);
    });
  }
  if (node.defaultConnector && node.defaultConnector.targetReference) connectors.push(node.defaultConnector.targetReference);
  return connectors;
}

const FLOW_RULES = OFFICIAL_FLOW_RULES;

if (typeof module !== 'undefined') {
  module.exports = { FLOW_RULES, OFFICIAL_FLOW_RULES };
}
