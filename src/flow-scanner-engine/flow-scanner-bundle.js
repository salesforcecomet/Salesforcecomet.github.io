var lightningFlowScanner = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../package/main/libs/Compiler.js
  var require_Compiler = __commonJS({
    "../package/main/libs/Compiler.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "Compiler", {
        enumerable: true,
        get: function() {
          return Compiler;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var Compiler = class Compiler {
        traverseFlow(startElementName, visitCallback, nodeMap, allConnectors, endElementName) {
          let elementsToVisit = [
            startElementName
          ];
          while (elementsToVisit.length > 0) {
            const nextElements = [];
            for (const elementName of elementsToVisit) {
              if (!this.visitedElements.has(elementName)) {
                const currentElement = nodeMap.get(elementName);
                if (currentElement) {
                  visitCallback(currentElement);
                  this.visitedElements.add(elementName);
                  nextElements.push(...this.findNextElements(elementName, allConnectors, nodeMap, endElementName));
                }
              }
            }
            if (nextElements.length === 0) {
              break;
            }
            elementsToVisit = nextElements;
          }
        }
        findNextElements(elementName, allConnectors, nodeMap, endElementName) {
          const nextElements = [];
          const targets = allConnectors.get(elementName);
          if (targets) {
            for (const targetReference of targets) {
              if (targetReference !== endElementName && nodeMap.has(targetReference)) {
                nextElements.push(targetReference);
              }
            }
          }
          return nextElements;
        }
        constructor() {
          _define_property(this, "visitedElements", void 0);
          this.visitedElements = /* @__PURE__ */ new Set();
        }
      };
    }
  });

  // ../package/node_modules/fast-xml-parser/lib/fxp.cjs
  var require_fxp = __commonJS({
    "../package/node_modules/fast-xml-parser/lib/fxp.cjs"(exports, module) {
      (() => {
        "use strict";
        var t = { d: (e2, i2) => {
          for (var n2 in i2) t.o(i2, n2) && !t.o(e2, n2) && Object.defineProperty(e2, n2, { enumerable: true, get: i2[n2] });
        }, o: (t2, e2) => Object.prototype.hasOwnProperty.call(t2, e2), r: (t2) => {
          "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(t2, "__esModule", { value: true });
        } }, e = {};
        t.r(e), t.d(e, { XMLBuilder: () => Oe, XMLParser: () => re, XMLValidator: () => je });
        const i = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD", n = new RegExp("^[" + i + "][" + i + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$");
        function r(t2, e2) {
          const i2 = [];
          let n2 = e2.exec(t2);
          for (; n2; ) {
            const r2 = [];
            r2.startIndex = e2.lastIndex - n2[0].length;
            const s2 = n2.length;
            for (let t3 = 0; t3 < s2; t3++) r2.push(n2[t3]);
            i2.push(r2), n2 = e2.exec(t2);
          }
          return i2;
        }
        const s = function(t2) {
          return !(null == n.exec(t2));
        }, o = ["hasOwnProperty", "toString", "valueOf", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"], a = ["__proto__", "constructor", "prototype"], l = { allowBooleanAttributes: false, unpairedTags: [] };
        function p(t2, e2) {
          e2 = Object.assign({}, l, e2);
          const i2 = [];
          let n2 = false, r2 = false;
          "\uFEFF" === t2[0] && (t2 = t2.substr(1));
          for (let s2 = 0; s2 < t2.length; s2++) if ("<" === t2[s2] && "?" === t2[s2 + 1]) {
            if (s2 += 2, s2 = h(t2, s2), s2.err) return s2;
          } else {
            if ("<" !== t2[s2]) {
              if (c(t2[s2])) continue;
              return y("InvalidChar", "char '" + t2[s2] + "' is not expected.", w(t2, s2));
            }
            {
              let o2 = s2;
              if (s2++, "!" === t2[s2]) {
                s2 = d(t2, s2);
                continue;
              }
              {
                let a2 = false;
                "/" === t2[s2] && (a2 = true, s2++);
                let l2 = "";
                for (; s2 < t2.length && ">" !== t2[s2] && " " !== t2[s2] && "	" !== t2[s2] && "\n" !== t2[s2] && "\r" !== t2[s2]; s2++) l2 += t2[s2];
                if (l2 = l2.trim(), "/" === l2[l2.length - 1] && (l2 = l2.substring(0, l2.length - 1), s2--), !E(l2)) {
                  let e3;
                  return e3 = 0 === l2.trim().length ? "Invalid space after '<'." : "Tag '" + l2 + "' is an invalid name.", y("InvalidTag", e3, w(t2, s2));
                }
                const p2 = g(t2, s2);
                if (false === p2) return y("InvalidAttr", "Attributes for '" + l2 + "' have open quote.", w(t2, s2));
                let u2 = p2.value;
                if (s2 = p2.index, "/" === u2[u2.length - 1]) {
                  const i3 = s2 - u2.length;
                  u2 = u2.substring(0, u2.length - 1);
                  const r3 = x(u2, e2);
                  if (true !== r3) return y(r3.err.code, r3.err.msg, w(t2, i3 + r3.err.line));
                  n2 = true;
                } else if (a2) {
                  if (!p2.tagClosed) return y("InvalidTag", "Closing tag '" + l2 + "' doesn't have proper closing.", w(t2, s2));
                  if (u2.trim().length > 0) return y("InvalidTag", "Closing tag '" + l2 + "' can't have attributes or invalid starting.", w(t2, o2));
                  if (0 === i2.length) return y("InvalidTag", "Closing tag '" + l2 + "' has not been opened.", w(t2, o2));
                  {
                    const e3 = i2.pop();
                    if (l2 !== e3.tagName) {
                      let i3 = w(t2, e3.tagStartPos);
                      return y("InvalidTag", "Expected closing tag '" + e3.tagName + "' (opened in line " + i3.line + ", col " + i3.col + ") instead of closing tag '" + l2 + "'.", w(t2, o2));
                    }
                    0 == i2.length && (r2 = true);
                  }
                } else {
                  const a3 = x(u2, e2);
                  if (true !== a3) return y(a3.err.code, a3.err.msg, w(t2, s2 - u2.length + a3.err.line));
                  if (true === r2) return y("InvalidXml", "Multiple possible root nodes found.", w(t2, s2));
                  -1 !== e2.unpairedTags.indexOf(l2) || i2.push({ tagName: l2, tagStartPos: o2 }), n2 = true;
                }
                for (s2++; s2 < t2.length; s2++) if ("<" === t2[s2]) {
                  if ("!" === t2[s2 + 1]) {
                    s2++, s2 = d(t2, s2);
                    continue;
                  }
                  if ("?" !== t2[s2 + 1]) break;
                  if (s2 = h(t2, ++s2), s2.err) return s2;
                } else if ("&" === t2[s2]) {
                  const e3 = b(t2, s2);
                  if (-1 == e3) return y("InvalidChar", "char '&' is not expected.", w(t2, s2));
                  s2 = e3;
                } else if (true === r2 && !c(t2[s2])) return y("InvalidXml", "Extra text at the end", w(t2, s2));
                "<" === t2[s2] && s2--;
              }
            }
          }
          return n2 ? 1 == i2.length ? y("InvalidTag", "Unclosed tag '" + i2[0].tagName + "'.", w(t2, i2[0].tagStartPos)) : !(i2.length > 0) || y("InvalidXml", "Invalid '" + JSON.stringify(i2.map((t3) => t3.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 }) : y("InvalidXml", "Start tag expected.", 1);
        }
        function c(t2) {
          return " " === t2 || "	" === t2 || "\n" === t2 || "\r" === t2;
        }
        function h(t2, e2) {
          const i2 = e2;
          for (; e2 < t2.length; e2++) if ("?" == t2[e2] || " " == t2[e2]) {
            const n2 = t2.substr(i2, e2 - i2);
            if (e2 > 5 && "xml" === n2) return y("InvalidXml", "XML declaration allowed only at the start of the document.", w(t2, e2));
            if ("?" == t2[e2] && ">" == t2[e2 + 1]) {
              e2++;
              break;
            }
            continue;
          }
          return e2;
        }
        function d(t2, e2) {
          if (t2.length > e2 + 5 && "-" === t2[e2 + 1] && "-" === t2[e2 + 2]) {
            for (e2 += 3; e2 < t2.length; e2++) if ("-" === t2[e2] && "-" === t2[e2 + 1] && ">" === t2[e2 + 2]) {
              e2 += 2;
              break;
            }
          } else if (t2.length > e2 + 8 && "D" === t2[e2 + 1] && "O" === t2[e2 + 2] && "C" === t2[e2 + 3] && "T" === t2[e2 + 4] && "Y" === t2[e2 + 5] && "P" === t2[e2 + 6] && "E" === t2[e2 + 7]) {
            let i2 = 1;
            for (e2 += 8; e2 < t2.length; e2++) if ("<" === t2[e2]) i2++;
            else if (">" === t2[e2] && (i2--, 0 === i2)) break;
          } else if (t2.length > e2 + 9 && "[" === t2[e2 + 1] && "C" === t2[e2 + 2] && "D" === t2[e2 + 3] && "A" === t2[e2 + 4] && "T" === t2[e2 + 5] && "A" === t2[e2 + 6] && "[" === t2[e2 + 7]) {
            for (e2 += 8; e2 < t2.length; e2++) if ("]" === t2[e2] && "]" === t2[e2 + 1] && ">" === t2[e2 + 2]) {
              e2 += 2;
              break;
            }
          }
          return e2;
        }
        const u = '"', f = "'";
        function g(t2, e2) {
          let i2 = "", n2 = "", r2 = false;
          for (; e2 < t2.length; e2++) {
            if (t2[e2] === u || t2[e2] === f) "" === n2 ? n2 = t2[e2] : n2 !== t2[e2] || (n2 = "");
            else if (">" === t2[e2] && "" === n2) {
              r2 = true;
              break;
            }
            i2 += t2[e2];
          }
          return "" === n2 && { value: i2, index: e2, tagClosed: r2 };
        }
        const m = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
        function x(t2, e2) {
          const i2 = r(t2, m), n2 = {};
          for (let t3 = 0; t3 < i2.length; t3++) {
            if (0 === i2[t3][1].length) return y("InvalidAttr", "Attribute '" + i2[t3][2] + "' has no space in starting.", v(i2[t3]));
            if (void 0 !== i2[t3][3] && void 0 === i2[t3][4]) return y("InvalidAttr", "Attribute '" + i2[t3][2] + "' is without value.", v(i2[t3]));
            if (void 0 === i2[t3][3] && !e2.allowBooleanAttributes) return y("InvalidAttr", "boolean attribute '" + i2[t3][2] + "' is not allowed.", v(i2[t3]));
            const r2 = i2[t3][2];
            if (!N(r2)) return y("InvalidAttr", "Attribute '" + r2 + "' is an invalid name.", v(i2[t3]));
            if (Object.prototype.hasOwnProperty.call(n2, r2)) return y("InvalidAttr", "Attribute '" + r2 + "' is repeated.", v(i2[t3]));
            n2[r2] = 1;
          }
          return true;
        }
        function b(t2, e2) {
          if (";" === t2[++e2]) return -1;
          if ("#" === t2[e2]) return (function(t3, e3) {
            let i3 = /\d/;
            for ("x" === t3[e3] && (e3++, i3 = /[\da-fA-F]/); e3 < t3.length; e3++) {
              if (";" === t3[e3]) return e3;
              if (!t3[e3].match(i3)) break;
            }
            return -1;
          })(t2, ++e2);
          let i2 = 0;
          for (; e2 < t2.length; e2++, i2++) if (!(t2[e2].match(/\w/) && i2 < 20)) {
            if (";" === t2[e2]) break;
            return -1;
          }
          return e2;
        }
        function y(t2, e2, i2) {
          return { err: { code: t2, msg: e2, line: i2.line || i2, col: i2.col } };
        }
        function N(t2) {
          return s(t2);
        }
        function E(t2) {
          return s(t2);
        }
        function w(t2, e2) {
          const i2 = t2.substring(0, e2).split(/\r?\n/);
          return { line: i2.length, col: i2[i2.length - 1].length + 1 };
        }
        function v(t2) {
          return t2.startIndex + t2[1].length;
        }
        const S = (t2) => o.includes(t2) ? "__" + t2 : t2, A = { preserveOrder: false, attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, removeNSPrefix: false, allowBooleanAttributes: false, parseTagValue: true, parseAttributeValue: false, trimValues: true, cdataPropName: false, numberParseOptions: { hex: true, leadingZeros: true, eNotation: true, unicode: false }, tagValueProcessor: function(t2, e2) {
          return e2;
        }, attributeValueProcessor: function(t2, e2) {
          return e2;
        }, stopNodes: [], alwaysCreateTextNode: false, isArray: () => false, commentPropName: false, unpairedTags: [], processEntities: true, htmlEntities: false, entityDecoder: null, ignoreDeclaration: false, ignorePiTags: false, transformTagName: false, transformAttributeName: false, updateTag: function(t2, e2, i2) {
          return t2;
        }, captureMetaData: false, maxNestedTags: 100, strictReservedNames: true, jPath: true, onDangerousProperty: S };
        function T(t2, e2) {
          if ("string" != typeof t2) return;
          const i2 = t2.toLowerCase();
          if (o.some((t3) => i2 === t3.toLowerCase())) throw new Error(`[SECURITY] Invalid ${e2}: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
          if (a.some((t3) => i2 === t3.toLowerCase())) throw new Error(`[SECURITY] Invalid ${e2}: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
        }
        function _(t2, e2) {
          return "boolean" == typeof t2 ? { enabled: t2, maxEntitySize: 1e4, maxExpansionDepth: 1e4, maxTotalExpansions: 1 / 0, maxExpandedLength: 1e5, maxEntityCount: 1e3, allowedTags: null, tagFilter: null, appliesTo: "all" } : "object" == typeof t2 && null !== t2 ? { enabled: false !== t2.enabled, maxEntitySize: Math.max(1, t2.maxEntitySize ?? 1e4), maxExpansionDepth: Math.max(1, t2.maxExpansionDepth ?? 1e4), maxTotalExpansions: Math.max(1, t2.maxTotalExpansions ?? 1 / 0), maxExpandedLength: Math.max(1, t2.maxExpandedLength ?? 1e5), maxEntityCount: Math.max(1, t2.maxEntityCount ?? 1e3), allowedTags: t2.allowedTags ?? null, tagFilter: t2.tagFilter ?? null, appliesTo: t2.appliesTo ?? "all" } : _(true);
        }
        const C = function(t2) {
          const e2 = Object.assign({}, A, t2), i2 = [{ value: e2.attributeNamePrefix, name: "attributeNamePrefix" }, { value: e2.attributesGroupName, name: "attributesGroupName" }, { value: e2.textNodeName, name: "textNodeName" }, { value: e2.cdataPropName, name: "cdataPropName" }, { value: e2.commentPropName, name: "commentPropName" }];
          for (const { value: t3, name: e3 } of i2) t3 && T(t3, e3);
          return null === e2.onDangerousProperty && (e2.onDangerousProperty = S), e2.processEntities = _(e2.processEntities, e2.htmlEntities), e2.unpairedTagsSet = new Set(e2.unpairedTags), e2.stopNodes && Array.isArray(e2.stopNodes) && (e2.stopNodes = e2.stopNodes.map((t3) => "string" == typeof t3 && t3.startsWith("*.") ? ".." + t3.substring(2) : t3)), e2;
        };
        let $;
        $ = "function" != typeof Symbol ? "@@xmlMetadata" : Symbol("XML Node Metadata");
        class P {
          constructor(t2) {
            this.tagname = t2, this.child = [], this[":@"] = /* @__PURE__ */ Object.create(null);
          }
          add(t2, e2) {
            "__proto__" === t2 && (t2 = "#__proto__"), this.child.push({ [t2]: e2 });
          }
          addChild(t2, e2) {
            "__proto__" === t2.tagname && (t2.tagname = "#__proto__"), t2[":@"] && Object.keys(t2[":@"]).length > 0 ? this.child.push({ [t2.tagname]: t2.child, ":@": t2[":@"] }) : this.child.push({ [t2.tagname]: t2.child }), void 0 !== e2 && (this.child[this.child.length - 1][$] = { startIndex: e2 });
          }
          static getMetaDataSymbol() {
            return $;
          }
        }
        const O = ":A-Za-z_\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD", j = ":A-Za-z_\xC0-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}", I = j + "\\-\\.\\d\xB7\u0300-\u036F\u0487\u203F-\u2040", k = (t2, e2, i2 = "") => {
          const n2 = `[${t2.replace(":", "")}][${e2.replace(":", "")}]*`;
          return { name: new RegExp(`^[${t2}][${e2}]*$`, i2), ncName: new RegExp(`^${n2}$`, i2), qName: new RegExp(`^${n2}(?::${n2})?$`, i2), nmToken: new RegExp(`^[${e2}]+$`, i2), nmTokens: new RegExp(`^[${e2}]+(?:\\s+[${e2}]+)*$`, i2) };
        }, L = k(O, O + "\\-\\.\\d\xB7\u0300-\u036F\u203F-\u2040"), D = k(j, I, "u"), R = ":A-Za-z_", M = k(R, R + "\\-\\.\\d"), V = (t2, { xmlVersion: e2 = "1.0", asciiOnly: i2 = false } = {}) => (/* @__PURE__ */ ((t3 = "1.0", e3 = false) => e3 ? M : "1.1" === t3 ? D : L)(e2, i2)).qName.test(t2);
        class q {
          constructor(t2, e2) {
            this.suppressValidationErr = !t2, this.options = t2, this.xmlVersion = e2 || 1;
          }
          setXmlVersion(t2 = 1) {
            this.xmlVersion = t2;
          }
          readDocType(t2, e2) {
            const i2 = /* @__PURE__ */ Object.create(null);
            let n2 = 0;
            if ("O" !== t2[e2 + 3] || "C" !== t2[e2 + 4] || "T" !== t2[e2 + 5] || "Y" !== t2[e2 + 6] || "P" !== t2[e2 + 7] || "E" !== t2[e2 + 8]) throw new Error("Invalid Tag instead of DOCTYPE");
            {
              e2 += 9;
              let r2 = 1, s2 = false, o2 = false, a2 = "";
              for (; e2 < t2.length; e2++) if ("<" !== t2[e2] || o2) if (">" === t2[e2]) {
                if (o2 ? "-" === t2[e2 - 1] && "-" === t2[e2 - 2] && (o2 = false, r2--) : r2--, 0 === r2) break;
              } else "[" === t2[e2] ? s2 = true : a2 += t2[e2];
              else {
                if (s2 && U(t2, "!ENTITY", e2)) {
                  let r3, s3;
                  if (e2 += 7, [r3, s3, e2] = this.readEntityExp(t2, e2 + 1, this.suppressValidationErr), -1 === s3.indexOf("&")) {
                    if (false !== this.options.enabled && null != this.options.maxEntityCount && n2 >= this.options.maxEntityCount) throw new Error(`Entity count (${n2 + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`);
                    i2[r3] = s3, n2++;
                  }
                } else if (s2 && U(t2, "!ELEMENT", e2)) {
                  e2 += 8;
                  const { index: i3 } = this.readElementExp(t2, e2 + 1);
                  e2 = i3;
                } else if (s2 && U(t2, "!ATTLIST", e2)) e2 += 8;
                else if (s2 && U(t2, "!NOTATION", e2)) {
                  e2 += 9;
                  const { index: i3 } = this.readNotationExp(t2, e2 + 1, this.suppressValidationErr);
                  e2 = i3;
                } else {
                  if (!U(t2, "!--", e2)) throw new Error("Invalid DOCTYPE");
                  o2 = true;
                }
                r2++, a2 = "";
              }
              if (0 !== r2) throw new Error("Unclosed DOCTYPE");
            }
            return { entities: i2, i: e2 };
          }
          readEntityExp(t2, e2) {
            const i2 = e2 = F(t2, e2);
            for (; e2 < t2.length && !/\s/.test(t2[e2]) && '"' !== t2[e2] && "'" !== t2[e2]; ) e2++;
            let n2 = t2.substring(i2, e2);
            if (B(n2, { xmlVersion: this.xmlVersion }), e2 = F(t2, e2), !this.suppressValidationErr) {
              if ("SYSTEM" === t2.substring(e2, e2 + 6).toUpperCase()) throw new Error("External entities are not supported");
              if ("%" === t2[e2]) throw new Error("Parameter entities are not supported");
            }
            let r2 = "";
            if ([e2, r2] = this.readIdentifierVal(t2, e2, "entity"), false !== this.options.enabled && null != this.options.maxEntitySize && r2.length > this.options.maxEntitySize) throw new Error(`Entity "${n2}" size (${r2.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`);
            return [n2, r2, --e2];
          }
          readNotationExp(t2, e2) {
            const i2 = e2 = F(t2, e2);
            for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
            let n2 = t2.substring(i2, e2);
            !this.suppressValidationErr && B(n2, { xmlVersion: this.xmlVersion }), e2 = F(t2, e2);
            const r2 = t2.substring(e2, e2 + 6).toUpperCase();
            if (!this.suppressValidationErr && "SYSTEM" !== r2 && "PUBLIC" !== r2) throw new Error(`Expected SYSTEM or PUBLIC, found "${r2}"`);
            e2 += r2.length, e2 = F(t2, e2);
            let s2 = null, o2 = null;
            if ("PUBLIC" === r2) [e2, s2] = this.readIdentifierVal(t2, e2, "publicIdentifier"), '"' !== t2[e2 = F(t2, e2)] && "'" !== t2[e2] || ([e2, o2] = this.readIdentifierVal(t2, e2, "systemIdentifier"));
            else if ("SYSTEM" === r2 && ([e2, o2] = this.readIdentifierVal(t2, e2, "systemIdentifier"), !this.suppressValidationErr && !o2)) throw new Error("Missing mandatory system identifier for SYSTEM notation");
            return { notationName: n2, publicIdentifier: s2, systemIdentifier: o2, index: --e2 };
          }
          readIdentifierVal(t2, e2, i2) {
            let n2 = "";
            const r2 = t2[e2];
            if ('"' !== r2 && "'" !== r2) throw new Error(`Expected quoted string, found "${r2}"`);
            const s2 = ++e2;
            for (; e2 < t2.length && t2[e2] !== r2; ) e2++;
            if (n2 = t2.substring(s2, e2), t2[e2] !== r2) throw new Error(`Unterminated ${i2} value`);
            return [++e2, n2];
          }
          readElementExp(t2, e2) {
            const i2 = e2 = F(t2, e2);
            for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
            let n2 = t2.substring(i2, e2);
            if (!this.suppressValidationErr && !V(n2, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid element name: "${n2}"`);
            let r2 = "";
            if ("E" === t2[e2 = F(t2, e2)] && U(t2, "MPTY", e2)) e2 += 4;
            else if ("A" === t2[e2] && U(t2, "NY", e2)) e2 += 2;
            else if ("(" === t2[e2]) {
              const i3 = ++e2;
              for (; e2 < t2.length && ")" !== t2[e2]; ) e2++;
              if (r2 = t2.substring(i3, e2), ")" !== t2[e2]) throw new Error("Unterminated content model");
            } else if (!this.suppressValidationErr) throw new Error(`Invalid Element Expression, found "${t2[e2]}"`);
            return { elementName: n2, contentModel: r2.trim(), index: e2 };
          }
          readAttlistExp(t2, e2) {
            let i2 = e2 = F(t2, e2);
            for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
            let n2 = t2.substring(i2, e2);
            for (B(n2, { xmlVersion: this.xmlVersion }), i2 = e2 = F(t2, e2); e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
            let r2 = t2.substring(i2, e2);
            if (!B(r2, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid attribute name: "${r2}"`);
            e2 = F(t2, e2);
            let s2 = "";
            if ("NOTATION" === t2.substring(e2, e2 + 8).toUpperCase()) {
              if (s2 = "NOTATION", "(" !== t2[e2 = F(t2, e2 += 8)]) throw new Error(`Expected '(', found "${t2[e2]}"`);
              e2++;
              let i3 = [];
              for (; e2 < t2.length && ")" !== t2[e2]; ) {
                const n3 = e2;
                for (; e2 < t2.length && "|" !== t2[e2] && ")" !== t2[e2]; ) e2++;
                let r3 = t2.substring(n3, e2);
                if (r3 = r3.trim(), !B(r3, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid notation name: "${r3}"`);
                i3.push(r3), "|" === t2[e2] && (e2++, e2 = F(t2, e2));
              }
              if (")" !== t2[e2]) throw new Error("Unterminated list of notations");
              e2++, s2 += " (" + i3.join("|") + ")";
            } else {
              const i3 = e2;
              for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
              s2 += t2.substring(i3, e2);
              const n3 = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
              if (!this.suppressValidationErr && !n3.includes(s2.toUpperCase())) throw new Error(`Invalid attribute type: "${s2}"`);
            }
            e2 = F(t2, e2);
            let o2 = "";
            return "#REQUIRED" === t2.substring(e2, e2 + 8).toUpperCase() ? (o2 = "#REQUIRED", e2 += 8) : "#IMPLIED" === t2.substring(e2, e2 + 7).toUpperCase() ? (o2 = "#IMPLIED", e2 += 7) : [e2, o2] = this.readIdentifierVal(t2, e2, "ATTLIST"), { elementName: n2, attributeName: r2, attributeType: s2, defaultValue: o2, index: e2 };
          }
        }
        const F = (t2, e2) => {
          for (; e2 < t2.length && /\s/.test(t2[e2]); ) e2++;
          return e2;
        };
        function U(t2, e2, i2) {
          for (let n2 = 0; n2 < e2.length; n2++) if (e2[n2] !== t2[i2 + n2 + 1]) return false;
          return true;
        }
        function B(t2, e2) {
          if (V(t2, { xmlVersion: e2 })) return t2;
          throw new Error(`Invalid entity name ${t2}`);
        }
        const G = [48, 1632, 1776, 2406, 2534, 2662, 2790, 2918, 3046, 3174, 3302, 3430, 3558, 3664, 3792, 3872, 4160, 4240, 6112, 6160, 6470, 6608, 6784, 6800, 6992, 7088, 7232, 7248, 65296, 120782, 120792, 120802, 120812, 120822, 66720, 68912, 69734, 69872, 69942, 70096, 70384, 70736, 70864, 71248, 71360, 71472, 71904, 72016, 72688, 72784, 73040, 73120, 73552, 92768, 92864, 93008, 123200, 123632, 124144, 125264, 130032], X = /* @__PURE__ */ new Map(), W = 1632, z = new Uint8Array(63904).fill(255);
        for (const t2 of G) for (let e2 = 0; e2 < 10; e2++) {
          const i2 = t2 + e2;
          i2 <= 65535 ? z[i2 - W] = e2 : X.set(i2, e2);
        }
        const Y = /* @__PURE__ */ new Set([8722, 65293, 65123]), H = /^[-+]?0x[a-fA-F0-9]+$/, Q = /^0b[01]+$/, J = /^0o[0-7]+$/, Z = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/, K = { hex: true, binary: false, octal: false, leadingZeros: true, decimalPoint: ".", eNotation: true, infinity: "original", unicode: false };
        function tt(t2, e2 = {}) {
          if (e2 = Object.assign({}, K, e2), !t2 || "string" != typeof t2) return t2;
          let i2 = t2.trim();
          if (0 === i2.length) return t2;
          if (void 0 !== e2.skipLike && e2.skipLike.test(i2)) return t2;
          if ("0" === i2) return 0;
          if (e2.unicode && (i2 = (function(t3) {
            if ("string" != typeof t3) return t3;
            const e3 = t3.length;
            if (0 === e3) return t3;
            let i3 = -1;
            for (let n4 = 0; n4 < e3; n4++) {
              const r2 = t3.charCodeAt(n4);
              if (!(r2 >= 48 && r2 <= 57 || 45 === r2)) {
                if (r2 < W) {
                  if (Y.has(r2)) {
                    i3 = n4;
                    break;
                  }
                } else if (r2 >= 55296 && r2 <= 56319) {
                  if (n4 + 1 < e3) {
                    const e4 = t3.charCodeAt(n4 + 1);
                    if (e4 >= 56320 && e4 <= 57343) {
                      const t4 = 65536 + (r2 - 55296 << 10) + (e4 - 56320);
                      if (X.has(t4)) {
                        i3 = n4;
                        break;
                      }
                    }
                  }
                } else if (255 !== z[r2 - W] || Y.has(r2)) {
                  i3 = n4;
                  break;
                }
              }
            }
            if (-1 === i3) return t3;
            const n3 = [];
            i3 > 0 && n3.push(t3.slice(0, i3));
            for (let r2 = i3; r2 < e3; r2++) {
              const i4 = t3.charCodeAt(r2);
              if (i4 >= 48 && i4 <= 57 || 45 === i4) {
                n3.push(t3[r2]);
                continue;
              }
              if (i4 < W) {
                n3.push(Y.has(i4) ? "-" : t3[r2]);
                continue;
              }
              if (i4 >= 55296 && i4 <= 56319) {
                if (r2 + 1 < e3) {
                  const e4 = t3.charCodeAt(r2 + 1);
                  if (e4 >= 56320 && e4 <= 57343) {
                    const t4 = 65536 + (i4 - 55296 << 10) + (e4 - 56320), s3 = X.get(t4);
                    if (void 0 !== s3) {
                      n3.push(String.fromCharCode(s3 + 48)), r2++;
                      continue;
                    }
                  }
                }
                n3.push(t3[r2]);
                continue;
              }
              if (Y.has(i4)) {
                n3.push("-");
                continue;
              }
              const s2 = z[i4 - W];
              n3.push(255 !== s2 ? String.fromCharCode(s2 + 48) : t3[r2]);
            }
            return n3.join("");
          })(i2), "0" === i2)) return 0;
          if (e2.hex && H.test(i2)) return it(i2, 16);
          if (e2.binary && Q.test(i2)) return it(i2, 2);
          if (e2.octal && J.test(i2)) return it(i2, 8);
          if (isFinite(i2)) {
            if (i2.includes("e") || i2.includes("E")) return (function(t3, e3, i3) {
              if (!i3.eNotation) return t3;
              const n3 = e3.match(et);
              if (n3) {
                let r2 = n3[1] || "";
                const s2 = -1 === n3[3].indexOf("e") ? "E" : "e", o2 = n3[2], a2 = r2 ? t3[o2.length + 1] === s2 : t3[o2.length] === s2;
                return o2.length > 1 && a2 ? t3 : (1 !== o2.length || !n3[3].startsWith(`.${s2}`) && n3[3][0] !== s2) && o2.length > 0 ? i3.leadingZeros && !a2 ? (e3 = (n3[1] || "") + n3[3], Number(e3)) : t3 : Number(e3);
              }
              return t3;
            })(t2, i2, e2);
            {
              const r2 = Z.exec(i2);
              if (r2) {
                const s2 = r2[1] || "", o2 = r2[2];
                let a2 = (n2 = r2[3]) && -1 !== n2.indexOf(".") ? ("." === (n2 = n2.replace(/0+$/, "")) ? n2 = "0" : "." === n2[0] ? n2 = "0" + n2 : "." === n2[n2.length - 1] && (n2 = n2.substring(0, n2.length - 1)), n2) : n2;
                const l2 = s2 ? "." === t2[o2.length + 1] : "." === t2[o2.length];
                if (!e2.leadingZeros && (o2.length > 1 || 1 === o2.length && !l2)) return t2;
                {
                  const n3 = Number(i2), r3 = String(n3);
                  if (0 === n3) return n3;
                  if (-1 !== r3.search(/[eE]/)) return e2.eNotation ? n3 : t2;
                  if (-1 !== i2.indexOf(".")) return "0" === r3 || r3 === a2 || r3 === `${s2}${a2}` ? n3 : t2;
                  let l3 = o2 ? a2 : i2;
                  return o2 ? l3 === r3 || s2 + l3 === r3 ? n3 : t2 : l3 === r3 || l3 === s2 + r3 ? n3 : t2;
                }
              }
              return t2;
            }
          }
          var n2;
          return (function(t3, e3, i3) {
            const n3 = e3 === 1 / 0;
            switch (i3.infinity.toLowerCase()) {
              case "null":
                return null;
              case "infinity":
                return e3;
              case "string":
                return n3 ? "Infinity" : "-Infinity";
              default:
                return t3;
            }
          })(t2, Number(i2), e2);
        }
        const et = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
        function it(t2, e2) {
          const i2 = t2.trim();
          if (2 !== e2 && 8 !== e2 || (t2 = i2.substring(2)), parseInt) return parseInt(t2, e2);
          if (Number.parseInt) return Number.parseInt(t2, e2);
          if (window && window.parseInt) return window.parseInt(t2, e2);
          throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
        }
        class nt {
          constructor(t2) {
            this._matcher = t2;
          }
          get separator() {
            return this._matcher.separator;
          }
          getCurrentTag() {
            const t2 = this._matcher.path;
            return t2.length > 0 ? t2[t2.length - 1].tag : void 0;
          }
          getCurrentNamespace() {
            const t2 = this._matcher.path;
            return t2.length > 0 ? t2[t2.length - 1].namespace : void 0;
          }
          getAttrValue(t2) {
            const e2 = this._matcher.path;
            if (0 !== e2.length) return e2[e2.length - 1].values?.[t2];
          }
          hasAttr(t2) {
            const e2 = this._matcher.path;
            if (0 === e2.length) return false;
            const i2 = e2[e2.length - 1];
            return void 0 !== i2.values && t2 in i2.values;
          }
          getAnyParentAttr(t2) {
            return this._matcher.getAnyParentAttr(t2);
          }
          hasAnyParentAttr(t2) {
            return this._matcher.hasAnyParentAttr(t2);
          }
          getPosition() {
            const t2 = this._matcher.path;
            return 0 === t2.length ? -1 : t2[t2.length - 1].position ?? 0;
          }
          getCounter() {
            const t2 = this._matcher.path;
            return 0 === t2.length ? -1 : t2[t2.length - 1].counter ?? 0;
          }
          getIndex() {
            return this.getPosition();
          }
          getDepth() {
            return this._matcher.path.length;
          }
          toString(t2, e2 = true) {
            return this._matcher.toString(t2, e2);
          }
          toArray() {
            return this._matcher.path.map((t2) => t2.tag);
          }
          matches(t2) {
            return this._matcher.matches(t2);
          }
          matchesAny(t2) {
            return t2.matchesAny(this._matcher);
          }
        }
        class rt {
          constructor(t2 = {}) {
            this.separator = t2.separator || ".", this.path = [], this.siblingStacks = [], this._pathStringCache = null, this._view = new nt(this), this._keptAttrs = [];
          }
          push(t2, e2 = null, i2 = null, n2 = null) {
            this._pathStringCache = null, this.path.length > 0 && (this.path[this.path.length - 1].values = void 0);
            const r2 = this.path.length;
            let s2 = this.siblingStacks[r2];
            s2 || (s2 = { counts: /* @__PURE__ */ new Map(), total: 0 }, this.siblingStacks[r2] = s2);
            const o2 = i2 ? `${i2}:${t2}` : t2, a2 = s2.counts.get(o2) || 0, l2 = s2.total;
            s2.counts.set(o2, a2 + 1), s2.total++;
            const p2 = { tag: t2, position: l2, counter: a2 };
            null != i2 && (p2.namespace = i2), null != e2 && (p2.values = e2), this.path.push(p2);
            const c2 = this.path.length, h2 = null !== n2 ? n2.keep : null;
            if (null != h2 && h2.length > 0 && e2) for (let t3 = 0; t3 < h2.length; t3++) {
              const i3 = h2[t3];
              void 0 !== e2[i3] && this._keptAttrs.push({ depth: c2, name: i3, value: e2[i3] });
            }
          }
          pop() {
            if (0 === this.path.length) return;
            this._pathStringCache = null;
            const t2 = this.path.pop();
            this.siblingStacks.length > this.path.length + 1 && (this.siblingStacks.length = this.path.length + 1);
            const e2 = this.path.length + 1;
            for (; this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= e2; ) this._keptAttrs.pop();
            return t2;
          }
          updateCurrent(t2) {
            if (this.path.length > 0) {
              const e2 = this.path[this.path.length - 1];
              null != t2 && (e2.values = t2);
            }
          }
          getCurrentTag() {
            return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
          }
          getCurrentNamespace() {
            return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
          }
          getAttrValue(t2) {
            if (0 !== this.path.length) return this.path[this.path.length - 1].values?.[t2];
          }
          hasAttr(t2) {
            if (0 === this.path.length) return false;
            const e2 = this.path[this.path.length - 1];
            return void 0 !== e2.values && t2 in e2.values;
          }
          getAnyParentAttr(t2) {
            const e2 = this._keptAttrs;
            for (let i2 = e2.length - 1; i2 >= 0; i2--) if (e2[i2].name === t2) return e2[i2].value;
          }
          hasAnyParentAttr(t2) {
            const e2 = this._keptAttrs;
            for (let i2 = e2.length - 1; i2 >= 0; i2--) if (e2[i2].name === t2) return true;
            return false;
          }
          getPosition() {
            return 0 === this.path.length ? -1 : this.path[this.path.length - 1].position ?? 0;
          }
          getCounter() {
            return 0 === this.path.length ? -1 : this.path[this.path.length - 1].counter ?? 0;
          }
          getIndex() {
            return this.getPosition();
          }
          getDepth() {
            return this.path.length;
          }
          toString(t2, e2 = true) {
            const i2 = t2 || this.separator;
            if (i2 === this.separator && true === e2) {
              if (null !== this._pathStringCache) return this._pathStringCache;
              const t3 = this.path.map((t4) => t4.namespace ? `${t4.namespace}:${t4.tag}` : t4.tag).join(i2);
              return this._pathStringCache = t3, t3;
            }
            return this.path.map((t3) => e2 && t3.namespace ? `${t3.namespace}:${t3.tag}` : t3.tag).join(i2);
          }
          toArray() {
            return this.path.map((t2) => t2.tag);
          }
          reset() {
            this._pathStringCache = null, this.path = [], this.siblingStacks = [], this._keptAttrs = [];
          }
          matches(t2) {
            const e2 = t2.segments;
            return 0 !== e2.length && (t2.hasDeepWildcard() ? this._matchWithDeepWildcard(e2) : this._matchSimple(e2));
          }
          _matchSimple(t2) {
            if (this.path.length !== t2.length) return false;
            for (let e2 = 0; e2 < t2.length; e2++) if (!this._matchSegment(t2[e2], this.path[e2], e2 === this.path.length - 1)) return false;
            return true;
          }
          _matchWithDeepWildcard(t2) {
            let e2 = this.path.length - 1, i2 = t2.length - 1;
            for (; i2 >= 0 && e2 >= 0; ) {
              const n2 = t2[i2];
              if ("deep-wildcard" === n2.type) {
                if (i2--, i2 < 0) return true;
                const n3 = t2[i2];
                let r2 = false;
                for (let t3 = e2; t3 >= 0; t3--) if (this._matchSegment(n3, this.path[t3], t3 === this.path.length - 1)) {
                  e2 = t3 - 1, i2--, r2 = true;
                  break;
                }
                if (!r2) return false;
              } else {
                if (!this._matchSegment(n2, this.path[e2], e2 === this.path.length - 1)) return false;
                e2--, i2--;
              }
            }
            return i2 < 0;
          }
          _matchSegment(t2, e2, i2) {
            if ("*" !== t2.tag && t2.tag !== e2.tag) return false;
            if (void 0 !== t2.namespace && "*" !== t2.namespace && t2.namespace !== e2.namespace) return false;
            if (void 0 !== t2.attrName) {
              if (!i2) return false;
              if (!e2.values || !(t2.attrName in e2.values)) return false;
              if (void 0 !== t2.attrValue && String(e2.values[t2.attrName]) !== String(t2.attrValue)) return false;
            }
            if (void 0 !== t2.position) {
              if (!i2) return false;
              const n2 = e2.counter ?? 0;
              if ("first" === t2.position && 0 !== n2) return false;
              if ("odd" === t2.position && n2 % 2 != 1) return false;
              if ("even" === t2.position && n2 % 2 != 0) return false;
              if ("nth" === t2.position && n2 !== t2.positionValue) return false;
            }
            return true;
          }
          matchesAny(t2) {
            return t2.matchesAny(this);
          }
          snapshot() {
            return { path: this.path.map((t2) => ({ ...t2 })), siblingStacks: this.siblingStacks.map((t2) => t2 ? { counts: new Map(t2.counts), total: t2.total } : t2), keptAttrs: this._keptAttrs.map((t2) => ({ ...t2 })) };
          }
          restore(t2) {
            this._pathStringCache = null, this.path = t2.path.map((t3) => ({ ...t3 })), this.siblingStacks = t2.siblingStacks.map((t3) => t3 ? { counts: new Map(t3.counts), total: t3.total } : t3), this._keptAttrs = (t2.keptAttrs || []).map((t3) => ({ ...t3 }));
          }
          readOnly() {
            return this._view;
          }
        }
        class st {
          constructor(t2, e2 = {}, i2) {
            this.pattern = t2, this.separator = e2.separator || ".", this.segments = this._parse(t2), this.data = i2, this._hasDeepWildcard = this.segments.some((t3) => "deep-wildcard" === t3.type), this._hasAttributeCondition = this.segments.some((t3) => void 0 !== t3.attrName), this._hasPositionSelector = this.segments.some((t3) => void 0 !== t3.position);
          }
          _parse(t2) {
            const e2 = [];
            let i2 = 0, n2 = "";
            for (; i2 < t2.length; ) t2[i2] === this.separator ? i2 + 1 < t2.length && t2[i2 + 1] === this.separator ? (n2.trim() && (e2.push(this._parseSegment(n2.trim())), n2 = ""), e2.push({ type: "deep-wildcard" }), i2 += 2) : (n2.trim() && e2.push(this._parseSegment(n2.trim())), n2 = "", i2++) : (n2 += t2[i2], i2++);
            return n2.trim() && e2.push(this._parseSegment(n2.trim())), e2;
          }
          _parseSegment(t2) {
            const e2 = { type: "tag" };
            let i2 = null, n2 = t2;
            const r2 = t2.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
            if (r2 && (n2 = r2[1] + r2[3], r2[2])) {
              const t3 = r2[2].slice(1, -1);
              t3 && (i2 = t3);
            }
            let s2, o2, a2 = n2;
            if (n2.includes("::")) {
              const e3 = n2.indexOf("::");
              if (s2 = n2.substring(0, e3).trim(), a2 = n2.substring(e3 + 2).trim(), !s2) throw new Error(`Invalid namespace in pattern: ${t2}`);
            }
            let l2 = null;
            if (a2.includes(":")) {
              const t3 = a2.lastIndexOf(":"), e3 = a2.substring(0, t3).trim(), i3 = a2.substring(t3 + 1).trim();
              ["first", "last", "odd", "even"].includes(i3) || /^nth\(\d+\)$/.test(i3) ? (o2 = e3, l2 = i3) : o2 = a2;
            } else o2 = a2;
            if (!o2) throw new Error(`Invalid segment pattern: ${t2}`);
            if (e2.tag = o2, s2 && (e2.namespace = s2), i2) if (i2.includes("=")) {
              const t3 = i2.indexOf("=");
              e2.attrName = i2.substring(0, t3).trim(), e2.attrValue = i2.substring(t3 + 1).trim();
            } else e2.attrName = i2.trim();
            if (l2) {
              const t3 = l2.match(/^nth\((\d+)\)$/);
              t3 ? (e2.position = "nth", e2.positionValue = parseInt(t3[1], 10)) : e2.position = l2;
            }
            return e2;
          }
          get length() {
            return this.segments.length;
          }
          hasDeepWildcard() {
            return this._hasDeepWildcard;
          }
          hasAttributeCondition() {
            return this._hasAttributeCondition;
          }
          hasPositionSelector() {
            return this._hasPositionSelector;
          }
          toString() {
            return this.pattern;
          }
        }
        class ot {
          constructor() {
            this._byDepthAndTag = /* @__PURE__ */ new Map(), this._wildcardByDepth = /* @__PURE__ */ new Map(), this._deepWildcards = [], this._deepByTerminalTag = /* @__PURE__ */ new Map(), this._patterns = /* @__PURE__ */ new Set(), this._sealed = false;
          }
          add(t2) {
            if (this._sealed) throw new TypeError("ExpressionSet is sealed. Create a new ExpressionSet to add more expressions.");
            if (this._patterns.has(t2.pattern)) return this;
            if (this._patterns.add(t2.pattern), t2.hasDeepWildcard()) {
              const e3 = t2.segments[t2.segments.length - 1];
              if (e3 && "deep-wildcard" !== e3.type && "*" !== e3.tag) {
                const i3 = e3.tag;
                this._deepByTerminalTag.has(i3) || this._deepByTerminalTag.set(i3, []), this._deepByTerminalTag.get(i3).push(t2);
              } else this._deepWildcards.push(t2);
              return this;
            }
            const e2 = t2.length, i2 = t2.segments[t2.segments.length - 1], n2 = i2?.tag;
            if (n2 && "*" !== n2) {
              const i3 = `${e2}:${n2}`;
              this._byDepthAndTag.has(i3) || this._byDepthAndTag.set(i3, []), this._byDepthAndTag.get(i3).push(t2);
            } else this._wildcardByDepth.has(e2) || this._wildcardByDepth.set(e2, []), this._wildcardByDepth.get(e2).push(t2);
            return this;
          }
          addAll(t2) {
            for (const e2 of t2) this.add(e2);
            return this;
          }
          has(t2) {
            return this._patterns.has(t2.pattern);
          }
          get size() {
            return this._patterns.size;
          }
          seal() {
            return this._sealed = true, this;
          }
          get isSealed() {
            return this._sealed;
          }
          matchesAny(t2) {
            return null !== this.findMatch(t2);
          }
          findMatch(t2) {
            const e2 = t2.getDepth(), i2 = t2.getCurrentTag(), n2 = `${e2}:${i2}`, r2 = this._byDepthAndTag.get(n2);
            if (r2) {
              for (let e3 = 0; e3 < r2.length; e3++) if (t2.matches(r2[e3])) return r2[e3];
            }
            const s2 = this._wildcardByDepth.get(e2);
            if (s2) {
              for (let e3 = 0; e3 < s2.length; e3++) if (t2.matches(s2[e3])) return s2[e3];
            }
            const o2 = this._deepByTerminalTag.get(i2);
            if (o2) {
              for (let e3 = 0; e3 < o2.length; e3++) if (t2.matches(o2[e3])) return o2[e3];
            }
            for (let e3 = 0; e3 < this._deepWildcards.length; e3++) if (t2.matches(this._deepWildcards[e3])) return this._deepWildcards[e3];
            return null;
          }
        }
        const at = { cent: "\xA2", pound: "\xA3", curren: "\xA4", yen: "\xA5", euro: "\u20AC", dollar: "$", fnof: "\u0192", inr: "\u20B9", af: "\u060B", birr: "\u1265\u122D", peso: "\u20B1", rub: "\u20BD", won: "\u20A9", yuan: "\xA5", cedil: "\xB8" }, lt = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' }, pt = { nbsp: "\xA0", copy: "\xA9", reg: "\xAE", trade: "\u2122", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", laquo: "\xAB", raquo: "\xBB", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", bull: "\u2022", para: "\xB6", sect: "\xA7", deg: "\xB0", frac12: "\xBD", frac14: "\xBC", frac34: "\xBE" }, ct = Object.freeze({ ALLOW: "allow", BLOCK: "block", THROW: "throw" }), ht = new Set("!?\\\\/[]$%{}^&*()<>|+");
        function dt(t2) {
          if ("#" === t2[0]) throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${t2}"`);
          for (const e2 of t2) if (ht.has(e2)) throw new Error(`[EntityReplacer] Invalid character '${e2}' in entity name: "${t2}"`);
          return t2;
        }
        function ut(...t2) {
          const e2 = /* @__PURE__ */ Object.create(null);
          for (const i2 of t2) if (i2) for (const t3 of Object.keys(i2)) {
            const n2 = i2[t3];
            if ("string" == typeof n2) e2[t3] = n2;
            else if (n2 && "object" == typeof n2 && void 0 !== n2.val) {
              const i3 = n2.val;
              "string" == typeof i3 && (e2[t3] = i3);
            }
          }
          return e2;
        }
        const ft = "external", gt = "base", mt = "all", xt = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 }), bt = /* @__PURE__ */ new Set([9, 10, 13]);
        class yt {
          constructor(t2 = {}) {
            var e2;
            this._limit = t2.limit || {}, this._maxTotalExpansions = this._limit.maxTotalExpansions || 0, this._maxExpandedLength = this._limit.maxExpandedLength || 0, this._postCheck = "function" == typeof t2.postCheck ? t2.postCheck : (t3) => t3, this._limitTiers = (e2 = this._limit.applyLimitsTo ?? ft) && e2 !== ft ? e2 === mt ? /* @__PURE__ */ new Set([mt]) : e2 === gt ? /* @__PURE__ */ new Set([gt]) : Array.isArray(e2) ? new Set(e2) : /* @__PURE__ */ new Set([ft]) : /* @__PURE__ */ new Set([ft]), this._numericAllowed = t2.numericAllowed ?? true, this._baseMap = ut(lt, t2.namedEntities || null), this._externalMap = /* @__PURE__ */ Object.create(null), this._inputMap = /* @__PURE__ */ Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this._removeSet = new Set(t2.remove && Array.isArray(t2.remove) ? t2.remove : []), this._leaveSet = new Set(t2.leave && Array.isArray(t2.leave) ? t2.leave : []);
            const i2 = (function(t3) {
              if (!t3) return { xmlVersion: 1, onLevel: xt.allow, nullLevel: xt.remove };
              const e3 = 1.1 === t3.xmlVersion ? 1.1 : 1, i3 = xt[t3.onNCR] ?? xt.allow, n2 = xt[t3.nullNCR] ?? xt.remove;
              return { xmlVersion: e3, onLevel: i3, nullLevel: Math.max(n2, xt.remove) };
            })(t2.ncr);
            this._ncrXmlVersion = i2.xmlVersion, this._ncrOnLevel = i2.onLevel, this._ncrNullLevel = i2.nullLevel, this._onExternalEntity = "function" == typeof t2.onExternalEntity ? t2.onExternalEntity : null, this._onInputEntity = "function" == typeof t2.onInputEntity ? t2.onInputEntity : null;
          }
          _applyRegistrationHook(t2, e2, i2, n2) {
            if (!t2) return true;
            const r2 = t2(e2, i2);
            if (r2 === ct.BLOCK) return false;
            if (r2 === ct.THROW) throw new Error(`[EntityDecoder] Registration of ${n2} entity "&${e2};" was rejected by hook`);
            return true;
          }
          setExternalEntities(t2) {
            if (t2) for (const e3 of Object.keys(t2)) dt(e3);
            if (!this._onExternalEntity) return void (this._externalMap = ut(t2));
            const e2 = ut(t2), i2 = /* @__PURE__ */ Object.create(null);
            for (const [t3, n2] of Object.entries(e2)) this._applyRegistrationHook(this._onExternalEntity, t3, n2, "external") && (i2[t3] = n2);
            this._externalMap = i2;
          }
          addExternalEntity(t2, e2) {
            dt(t2), "string" == typeof e2 && -1 === e2.indexOf("&") && this._applyRegistrationHook(this._onExternalEntity, t2, e2, "external") && (this._externalMap[t2] = e2);
          }
          addInputEntities(t2) {
            if (this._totalExpansions = 0, this._expandedLength = 0, !this._onInputEntity) return void (this._inputMap = ut(t2));
            const e2 = ut(t2), i2 = /* @__PURE__ */ Object.create(null);
            for (const [t3, n2] of Object.entries(e2)) this._applyRegistrationHook(this._onInputEntity, t3, n2, "input") && (i2[t3] = n2);
            this._inputMap = i2;
          }
          reset() {
            return this._inputMap = /* @__PURE__ */ Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this;
          }
          setXmlVersion(t2) {
            this._ncrXmlVersion = 1.1 === t2 ? 1.1 : 1;
          }
          decode(t2) {
            if ("string" != typeof t2 || 0 === t2.length) return t2;
            if (-1 === t2.indexOf("&")) return t2;
            const e2 = t2, i2 = [], n2 = t2.length;
            let r2 = 0, s2 = 0;
            const o2 = this._maxTotalExpansions > 0, a2 = this._maxExpandedLength > 0, l2 = o2 || a2;
            for (; s2 < n2; ) {
              if (38 !== t2.charCodeAt(s2)) {
                s2++;
                continue;
              }
              let e3 = s2 + 1;
              for (; e3 < n2 && 59 !== t2.charCodeAt(e3) && e3 - s2 <= 32; ) e3++;
              if (e3 >= n2 || 59 !== t2.charCodeAt(e3)) {
                s2++;
                continue;
              }
              const p3 = t2.slice(s2 + 1, e3);
              if (0 === p3.length) {
                s2++;
                continue;
              }
              let c2, h2;
              if (this._removeSet.has(p3)) c2 = "", void 0 === h2 && (h2 = ft);
              else {
                if (this._leaveSet.has(p3)) {
                  s2++;
                  continue;
                }
                if (35 === p3.charCodeAt(0)) {
                  const t3 = this._resolveNCR(p3);
                  if (void 0 === t3) {
                    s2++;
                    continue;
                  }
                  c2 = t3, h2 = gt;
                } else {
                  const t3 = this._resolveName(p3);
                  c2 = t3?.value, h2 = t3?.tier;
                }
              }
              if (void 0 !== c2) {
                if (s2 > r2 && i2.push(t2.slice(r2, s2)), i2.push(c2), r2 = e3 + 1, s2 = r2, l2 && this._tierCounts(h2)) {
                  if (o2 && (this._totalExpansions++, this._totalExpansions > this._maxTotalExpansions)) throw new Error(`[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`);
                  if (a2) {
                    const t3 = c2.length - (p3.length + 2);
                    if (t3 > 0 && (this._expandedLength += t3, this._expandedLength > this._maxExpandedLength)) throw new Error(`[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`);
                  }
                }
              } else s2++;
            }
            r2 < n2 && i2.push(t2.slice(r2));
            const p2 = 0 === i2.length ? t2 : i2.join("");
            return this._postCheck(p2, e2);
          }
          _tierCounts(t2) {
            return !!this._limitTiers.has(mt) || this._limitTiers.has(t2);
          }
          _resolveName(t2) {
            return t2 in this._inputMap ? { value: this._inputMap[t2], tier: ft } : t2 in this._externalMap ? { value: this._externalMap[t2], tier: ft } : t2 in this._baseMap ? { value: this._baseMap[t2], tier: gt } : void 0;
          }
          _classifyNCR(t2) {
            return 0 === t2 ? this._ncrNullLevel : t2 >= 55296 && t2 <= 57343 || 1 === this._ncrXmlVersion && t2 >= 1 && t2 <= 31 && !bt.has(t2) ? xt.remove : -1;
          }
          _applyNCRAction(t2, e2, i2) {
            switch (t2) {
              case xt.allow:
                return String.fromCodePoint(i2);
              case xt.remove:
                return "";
              case xt.leave:
                return;
              case xt.throw:
                throw new Error(`[EntityDecoder] Prohibited numeric character reference &${e2}; (U+${i2.toString(16).toUpperCase().padStart(4, "0")})`);
              default:
                return String.fromCodePoint(i2);
            }
          }
          _resolveNCR(t2) {
            const e2 = t2.charCodeAt(1);
            let i2;
            if (i2 = 120 === e2 || 88 === e2 ? parseInt(t2.slice(2), 16) : parseInt(t2.slice(1), 10), Number.isNaN(i2) || i2 < 0 || i2 > 1114111) return;
            const n2 = this._classifyNCR(i2);
            if (!this._numericAllowed && n2 < xt.remove) return;
            const r2 = -1 === n2 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, n2);
            return this._applyNCRAction(r2, t2, i2);
          }
        }
        const Nt = [{ id: "sql-block-comment-open", description: "SQL block comment open: /* ... */ \u2014 unusual in legitimate user text", pattern: /\/\*/ }, { id: "sql-union-select", description: "UNION SELECT \u2014 most common SQL injection aggregation attack", pattern: /\bUNION\s{1,20}(?:ALL\s{1,20})?SELECT\b/i }, { id: "sql-drop-table", description: "DROP TABLE \u2014 destructive DDL injection", pattern: /\bDROP\s{1,20}TABLE\b/i }, { id: "sql-drop-database", description: "DROP DATABASE \u2014 destructive DDL injection", pattern: /\bDROP\s{1,20}DATABASE\b/i }, { id: "sql-insert-into", description: "INSERT INTO \u2014 data injection", pattern: /\bINSERT\s{1,20}INTO\b/i }, { id: "sql-delete-from", description: "DELETE FROM \u2014 data deletion injection", pattern: /\bDELETE\s{1,20}FROM\b/i }, { id: "sql-update-set", description: "UPDATE ... SET \u2014 data modification injection", pattern: /\bUPDATE\b[\s\S]{1,60}\bSET\b/i }, { id: "sql-exec-xp", description: "EXEC xp_ \u2014 MSSQL extended stored procedure execution", pattern: /\bEXEC(?:UTE)?\s{1,20}xp_/i }, { id: "sql-tautology-string", description: `Classic string tautology: ' OR '1'='1 or " OR "1"="1"`, pattern: /'\s{0,10}OR\s{0,10}'[^']{0,20}'\s*=\s*'[^']{0,20}/i }, { id: "sql-tautology-numeric", description: "Numeric tautology: OR 1=1", pattern: /\bOR\s{1,10}1\s*=\s*1\b/i }, { id: "sql-always-true-zero", description: "Numeric tautology: OR 0=0", pattern: /\bOR\s{1,10}0\s*=\s*0\b/i }, { id: "sql-sleep-benchmark", description: "Time-based blind injection: SLEEP() or BENCHMARK()", pattern: /\b(?:SLEEP|BENCHMARK)\s*\(/i }, { id: "sql-waitfor-delay", description: "MSSQL time-based blind injection: WAITFOR DELAY", pattern: /\bWAITFOR\s{1,20}DELAY\b/i }, { id: "sql-char-function", description: "CHAR() function \u2014 used to obfuscate injected strings", pattern: /\bCHAR\s*\(\s*\d{1,3}/i }, { id: "sql-information-schema", description: "INFORMATION_SCHEMA \u2014 reconnaissance query for table/column enumeration", pattern: /\bINFORMATION_SCHEMA\b/i }], Et = [...Nt, { id: "sql-line-comment", description: "SQL line comment: -- followed by whitespace or end of string", pattern: /--(?:\s|$)/ }, { id: "sql-stacked-query", description: "Stacked queries: semicolon immediately followed by a SQL keyword", pattern: /;\s{0,10}(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i }, { id: "sql-hex-encoding", description: "Hex-encoded string injection: 0x41414141 style (MySQL)", pattern: /\b0x[0-9a-f]{4,}/i }], wt = [{ id: "html-script-open", description: "<script opening tag", pattern: /<script[\s>/]/i }, { id: "html-script-close", description: "<\/script closing tag", pattern: /<\/script[\s>]/i }, { id: "html-javascript-protocol", description: "javascript: URI scheme (with optional whitespace/encoding)", pattern: /j[\t\n\r ]*a[\t\n\r ]*v[\t\n\r ]*a[\t\n\r ]*s[\t\n\r ]*c[\t\n\r ]*r[\t\n\r ]*i[\t\n\r ]*p[\t\n\r ]*t[\t\n\r ]*:/i }, { id: "html-vbscript-protocol", description: "vbscript: URI scheme", pattern: /vbscript[\t\n\r ]*:/i }, { id: "html-data-html", description: "data:text/html URI \u2014 can execute scripts in browsers", pattern: /data[\t\n\r ]*:[\t\n\r ]*text\/html/i }, { id: "html-data-xhtml", description: "data:application/xhtml+xml URI", pattern: /data[\t\n\r ]*:[\t\n\r ]*application\/xhtml/i }, { id: "html-data-svg", description: "data:image/svg+xml URI \u2014 can execute scripts", pattern: /data[\t\n\r ]*:[\t\n\r ]*image\/svg\+xml/i }, { id: "html-inline-event-handler", description: "Inline event handler attributes: onclick=, onerror=, onload=, etc.", pattern: /\bon\w{1,30}\s*=/i }, { id: "html-entity-obfuscated-script", description: "HTML-entity-encoded <script (e.g. &#x3C;script or &lt;script)", pattern: /(?:&#x0*3[Cc];?|&#0*60;?|&lt;)\s*script/i }, { id: "html-entity-obfuscated-javascript", description: 'HTML-entity-encoded javascript: (partial \u2014 catches common &#106; or &#x6a; for "j")', pattern: /(?:&#x0*6[Aa];?|&#0*106;?)\s*(?:&#x0*61;?|a)[\s\S]{0,80}script\s*:/i }, { id: "html-style-expression", description: "CSS expression() \u2014 IE-era code execution in style attributes", pattern: /style[\s\S]{0,20}expression\s*\(/i }, { id: "html-object-embed", description: "<object or <embed tags that can load active content", pattern: /<(?:object|embed)[\s>/]/i }, { id: "html-base-tag", description: "<base href= \u2014 can hijack all relative URLs on a page", pattern: /<base[\s>]/i }, { id: "html-meta-refresh", description: '<meta http-equiv="refresh" \u2014 can redirect users', pattern: /<meta[\s\S]{0,40}http-equiv[\s\S]{0,20}refresh/i }, { id: "html-srcdoc", description: "srcdoc= attribute on iframes \u2014 embeds HTML that can run scripts", pattern: /srcdoc\s*=/i }, { id: "html-iframe", description: "<iframe tag", pattern: /<iframe[\s>/]/i }, { id: "html-form", description: "<form tag \u2014 can be used for phishing / credential harvesting injection", pattern: /<form[\s>/]/i }], vt = [{ id: "xml-cdata-injection", description: "CDATA section injection: <![CDATA[ breaks out of text node context", pattern: /<!\[CDATA\[/i }, { id: "xml-cdata-close", description: "CDATA close sequence: ]]> can terminate an enclosing CDATA section", pattern: /\]\]>/ }, { id: "xml-processing-instruction", description: "XML processing instruction: <?xml-stylesheet or <?php etc.", pattern: /<\?(?:xml[\- ]|php|asp)/i }, { id: "xml-doctype-injection", description: "DOCTYPE declaration embedded in content \u2014 can define entities", pattern: /<!DOCTYPE(?:[\s[]|$)/i }, { id: "xml-entity-system", description: "SYSTEM keyword \u2014 used in external entity declarations (XXE)", pattern: /\bSYSTEM\s+["']/i }, { id: "xml-entity-public", description: "PUBLIC keyword \u2014 used in external entity declarations (XXE)", pattern: /\bPUBLIC\s+["']/i }, { id: "xml-entity-declaration", description: "<!ENTITY declaration \u2014 defines entities, potential XXE or entity expansion", pattern: /<!ENTITY[\s%]/i }, { id: "xml-billion-laughs", description: "Entity reference chaining / billion laughs: repeated &eX; style references", pattern: /(?:&\w{1,20};){3,}/ }, { id: "xml-namespace-confusion", description: "xmlns: attribute injection \u2014 can redefine namespaces to confuse parsers", pattern: /\bxmlns\s*(?::\w{1,40})?\s*=/i }, { id: "xml-comment-injection", description: "<!-- comment injection \u2014 can hide content from some parsers", pattern: /<!--/ }, { id: "xml-comment-close", description: "--> closes an enclosing XML comment", pattern: /-->/ }, { id: "xml-pi-close", description: "?> closes an enclosing processing instruction", pattern: /\?>/ }], St = [{ id: "svg-script-element", description: "<script element inside SVG executes JavaScript", pattern: /<script[\s>/]/i }, { id: "svg-xlink-href-javascript", description: "xlink:href with javascript: \u2014 classic SVG XSS via <a> or <use>", pattern: /xlink\s*:\s*href\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-href-javascript", description: "href= with javascript: in SVG context (<a>, <animate>, etc.)", pattern: /href\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-foreignobject", description: "<foreignObject embeds HTML inside SVG \u2014 can execute scripts", pattern: /<foreignObject[\s>/]/i }, { id: "svg-use-external", description: "<use xlink:href or href pointing to external resource (non-fragment URL)", pattern: /<use[\s\S]{0,60}(?:xlink\s*:\s*)?href\s*=\s*(?:["'][^#]|[^"'#\s>])/i }, { id: "svg-animate-href", description: '<animate attributeName="href" \u2014 can dynamically change href to javascript:', pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*href["']/i }, { id: "svg-animate-xlinkhref", description: '<animate attributeName="xlink:href"', pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*xlink\s*:\s*href["']/i }, { id: "svg-set-javascript", description: '<set to="javascript:..." \u2014 sets an attribute to a javascript: URI', pattern: /<set[\s\S]{0,80}to\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-event-handler", description: "SVG-specific event handler attributes: onload=, onerror=, onactivate=, etc.", pattern: /\bon(?:load|error|activate|begin|end|repeat|focus|blur|click|mouse\w{1,20}|key\w{1,20})\s*=/i }, { id: "svg-handler-generic", description: "Generic on* handler catch-all for SVG attributes", pattern: /\bon\w{1,30}\s*=/i }, { id: "svg-filter-feimage", description: "<feImage href= \u2014 filter primitive that can load external resources", pattern: /<feImage[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=/i }, { id: "svg-image-external", description: "<image xlink:href with http/https or javascript protocol", pattern: /<image[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=\s*["']?\s*(?:https?|javascript)\s*:/i }, { id: "svg-style-javascript", description: "style= attribute containing javascript: (e.g. background:url(javascript:...))", pattern: /style\s*=[\s\S]{0,60}javascript\s*:/i }], At = [{ id: "shell-path-traversal-unix", description: "Unix path traversal: ../  \u2014 climbing the directory tree", pattern: /\.\.\// }, { id: "shell-path-traversal-windows", description: "Windows path traversal: ..\\ \u2014 climbing the directory tree", pattern: /\.\.\\/ }, { id: "shell-path-traversal-encoded", description: "URL-encoded path traversal: %2e%2e or %2f variants", pattern: /%2e%2e|%2f\.\.|\.\.%2f/i }, { id: "shell-null-byte", description: "Null byte injection: \\x00 or %00 \u2014 truncates strings in C-backed functions", pattern: /\x00|%00/ }, { id: "shell-semicolon", description: "Semicolon command separator: cmd1; cmd2", pattern: /;/ }, { id: "shell-pipe", description: "Pipe operator: cmd1 | cmd2", pattern: /\|/ }, { id: "shell-and-operator", description: "AND operator: cmd1 && cmd2", pattern: /&&/ }, { id: "shell-or-operator", description: "OR operator: cmd1 || cmd2", pattern: /\|\|/ }, { id: "shell-backtick", description: "Backtick command substitution: `cmd`", pattern: /`/ }, { id: "shell-dollar-paren", description: "Dollar-paren command substitution: $(cmd)", pattern: /\$\(/ }, { id: "shell-dollar-brace", description: "Dollar-brace variable expansion: ${var} \u2014 can be abused for injection", pattern: /\$\{/ }, { id: "shell-redirect-out", description: "Output redirection: cmd > file or cmd >> file", pattern: />{1,2}/ }, { id: "shell-redirect-in", description: "Input redirection: cmd < file", pattern: /</ }, { id: "shell-newline-injection", description: "Newline injection: \\n or \\r \u2014 can inject new shell commands", pattern: /[\n\r]/ }, { id: "shell-glob-star", description: "Glob expansion: * or ? \u2014 can expand to unintended files", pattern: /[/\\][*?]/ }, { id: "shell-absolute-root", description: "Absolute root path injection: string starting with / or \\ (Windows UNC)", pattern: /^(?:\/|\\\\)/ }, { id: "shell-windows-drive", description: "Windows drive letter path injection: C:\\ or D:/", pattern: /^[a-zA-Z]:[/\\]/ }, { id: "shell-curl-wget", description: "curl/wget with URL or flags \u2014 can exfiltrate data or download payloads", pattern: /\b(?:curl|wget)\s+(?:https?:\/\/|ftp:\/\/|-)/i }], Tt = [{ id: "redos-nested-quantifier-plus", description: "Nested + quantifier inside a group with outer quantifier: (a+)+, (.+b)*, etc.", pattern: /\([^)]*\+[^)]*\)[+*]/ }, { id: "redos-nested-quantifier-star", description: "Nested * quantifier: (a*)* or (a*)+ \u2014 catastrophic backtracking", pattern: /\([^)]*\*[^)]*\)[*+]/ }, { id: "redos-nested-groups", description: "Doubly nested quantified groups: ((a+)+) \u2014 guaranteed catastrophic", pattern: /\(\([^)]{0,40}\)[+*]\)[+*]/ }, { id: "redos-alternation-overlap", description: "Overlapping alternation under quantifier: (a|a)+ \u2014 ambiguous NFA paths", pattern: /\(([^|()]{1,20})\|(?:\1)(?:\|[^|()]{1,20}){0,5}\)[+*?]{1,2}/ }, { id: "redos-star-plus-concat", description: "(x*x)+ pattern \u2014 triggers super-linear backtracking", pattern: /\([^)]{0,10}\*[^)]{0,10}\)[+*]/ }, { id: "redos-dot-star-greedy", description: "(.*){n,} or (.+){n,} \u2014 repeated greedy dot quantifiers", pattern: /\(\.[*+]\)\{?\d/ }, { id: "redos-large-repetition", description: "Very large fixed or range repetition count {1000,} or {1000,n} \u2014 denial of service via backtracking", pattern: /\{\d{4,}(?:,\d*)?\}/ }, { id: "redos-catastrophic-alternation", description: "Long alternation with many similar branches \u2014 polynomial backtracking risk", pattern: /\([^)]{0,200}(?:\|[^|)]{0,50}){9,}\)/ }], _t = `["'\\s]*:`, Ct = [{ id: "nosql-where-operator", description: "$where \u2014 executes arbitrary JavaScript server-side in MongoDB", pattern: new RegExp(`\\$where${_t}`, "i") }, { id: "nosql-ne-operator", description: '$ne \u2014 "not equal" operator used to bypass equality checks', pattern: new RegExp(`\\$ne${_t}`, "i") }, { id: "nosql-gt-operator", description: '$gt \u2014 "greater than" used to bypass password/value checks', pattern: new RegExp(`\\$gte?${_t}`, "i") }, { id: "nosql-lt-operator", description: '$lt / $lte \u2014 "less than" bypass variants', pattern: new RegExp(`\\$lte?${_t}`, "i") }, { id: "nosql-regex-operator", description: "$regex \u2014 can be used to extract data character by character (blind injection)", pattern: new RegExp(`\\$regex${_t}`, "i") }, { id: "nosql-or-operator", description: "$or \u2014 logical OR; used to create always-true conditions", pattern: new RegExp(`\\$or${_t}\\s*\\[`, "i") }, { id: "nosql-and-operator", description: "$and \u2014 logical AND operator injection", pattern: new RegExp(`\\$and${_t}\\s*\\[`, "i") }, { id: "nosql-nor-operator", description: "$nor \u2014 logical NOR operator injection", pattern: new RegExp(`\\$nor${_t}\\s*\\[`, "i") }, { id: "nosql-exists-operator", description: "$exists \u2014 can enumerate fields to determine schema", pattern: new RegExp(`\\$exists${_t}`, "i") }, { id: "nosql-in-operator", description: "$in \u2014 matches any value in a list; can enumerate values", pattern: new RegExp(`\\$in${_t}\\s*\\[`, "i") }, { id: "nosql-expr-operator", description: "$expr \u2014 allows aggregation expressions in queries (MongoDB 3.6+)", pattern: new RegExp(`\\$expr${_t}`, "i") }, { id: "nosql-function-operator", description: "$function \u2014 executes arbitrary JavaScript in MongoDB 4.4+", pattern: new RegExp(`\\$function${_t}`, "i") }, { id: "nosql-accumulator-operator", description: "$accumulator \u2014 custom aggregation with arbitrary JS execution", pattern: new RegExp(`\\$accumulator${_t}`, "i") }, { id: "nosql-proto-pollution", description: "__proto__ \u2014 prototype pollution via object key injection", pattern: /__proto__/ }, { id: "nosql-constructor-prototype", description: "constructor.prototype \u2014 alternative prototype pollution vector (dot notation or JSON key)", pattern: /constructor[\s"':.,{\[]*prototype/i }, { id: "nosql-proto-bracket", description: '["__proto__"] \u2014 bracket-notation prototype pollution', pattern: /\[["']__proto__["']\]/ }], $t = [{ id: "log-crlf-injection", description: "CRLF injection: literal \\r or \\n embeds fake log lines", pattern: /[\r\n]/ }, { id: "log-url-encoded-crlf", description: "URL-encoded CRLF: %0d, %0a, %0D, %0A \u2014 decoded by some log parsers", pattern: /%0[dDaA]/ }, { id: "log-unicode-newline", description: "Unicode newline variants: U+2028 (line separator), U+2029 (paragraph separator)", pattern: /[\u2028\u2029]/ }, { id: "log-log4shell-jndi", description: "Log4Shell: ${jndi:...} triggers remote code execution in Apache Log4j", pattern: /\$\{jndi\s*:/i }, { id: "log-log4shell-obfuscated", description: "Obfuscated Log4Shell: ${::-j}... lookup-bypass prefix used to evade WAF detection", pattern: /\$\{::-/ }, { id: "log-log4j-lookup", description: "Log4j lookup syntax: ${env:...}, ${sys:...}, ${ctx:...} \u2014 data exfiltration", pattern: /\$\{(?:env|sys|ctx|main|map|sd|web|docker|k8s|spring)\s*:/i }, { id: "log-ssti-double-brace", description: "SSTI double-brace: {{expression}} \u2014 Jinja2, Twig, Handlebars, etc.", pattern: /\{\{[\s\S]{0,80}\}\}/ }, { id: "log-ssti-hash-brace", description: "SSTI hash-brace: #{expression} \u2014 Thymeleaf, Velocity, Ruby ERB", pattern: /#\{[\s\S]{0,80}\}/ }, { id: "log-ssti-dollar-brace", description: "SSTI/EL injection: ${expression with operators or method calls} \u2014 JSP EL, Freemarker, SpEL", pattern: /\$\{[^}]*(?:\.|\(|\*|\+|\bclass\b|\bruntime\b|\bprocess\b|\bexec\b)[^}]{0,80}\}/i }, { id: "log-ssti-percent-tag", description: "SSTI ERB/ASP tag: <%= expression %> \u2014 Ruby ERB, ASP", pattern: /<%=[\s\S]{0,80}%>/ }, { id: "log-null-byte", description: "Null byte: \\x00 or %00 \u2014 can truncate log entries in C-backed loggers", pattern: /\x00|%00/ }, { id: "log-ansi-escape", description: "ANSI escape sequence: ESC[ \u2014 can manipulate terminal output when logs are tailed", pattern: /\x1b\[/ }];
        function Pt(t2, e2) {
          const i2 = e2.label ?? "CUSTOM";
          for (const n2 of e2) if (n2.pattern.test(t2)) return { context: i2, id: n2.id, description: n2.description, pattern: n2.pattern };
          return null;
        }
        function Ot(t2, e2) {
          (function(t3) {
            if ("string" != typeof t3) throw new TypeError("is-unsafe: first argument must be a string, got " + typeof t3);
          })(t2), (function(t3) {
            if (!(t3 instanceof RegExp)) {
              if (!Array.isArray(t3)) throw new TypeError("is-unsafe: second argument must be a PatternList (e.g. HTML), an array of PatternLists (e.g. [HTML, XML]), or a RegExp. Got: " + typeof t3);
              if (0 === t3.length) throw new TypeError("is-unsafe: context must not be an empty array");
              if (Array.isArray(t3[0])) {
                for (const e3 of t3) if (!Array.isArray(e3) || 0 === e3.length) throw new TypeError("is-unsafe: each context in the array must be a non-empty pattern array (PatternList)");
              }
            }
          })(e2);
          const { lists: i2, regex: n2 } = (function(t3) {
            return t3 instanceof RegExp ? { lists: null, regex: t3 } : Array.isArray(t3[0]) ? { lists: t3, regex: null } : { lists: [t3], regex: null };
          })(e2);
          if (n2) return n2.test(t2);
          for (const e3 of i2) if (null !== Pt(t2, e3)) return true;
          return false;
        }
        function jt(t2, e2) {
          if (!t2) return {};
          const i2 = e2.attributesGroupName ? t2[e2.attributesGroupName] : t2;
          if (!i2) return {};
          const n2 = {};
          for (const t3 in i2) t3.startsWith(e2.attributeNamePrefix) ? n2[t3.substring(e2.attributeNamePrefix.length)] = i2[t3] : n2[t3] = i2[t3];
          return n2;
        }
        function It(t2) {
          if (!t2 || "string" != typeof t2) return;
          const e2 = t2.indexOf(":");
          if (-1 !== e2 && e2 > 0) {
            const i2 = t2.substring(0, e2);
            if ("xmlns" !== i2) return i2;
          }
        }
        wt.label = "HTML", vt.label = "XML", St.label = "SVG", Nt.label = "SQL", Et.label = "SQL-STRICT", At.label = "SHELL", Tt.label = "REDOS", Ct.label = "NOSQL", $t.label = "LOG", Object.freeze({ HTML: wt, XML: vt, SVG: St, SQL: Nt, "SQL-STRICT": Et, SHELL: At, REDOS: Tt, NOSQL: Ct, LOG: $t });
        class kt {
          constructor(t2, e2) {
            var i2;
            this.options = t2, this.currentNode = null, this.tagsNodeStack = [], this.parseXml = Vt, this.parseTextData = Lt, this.resolveNameSpace = Dt, this.buildAttributesMap = Mt, this.isItStopNode = Bt, this.replaceEntitiesValue = Ft, this.readStopNodeData = zt, this.saveTextToParentTag = Ut, this.addChild = qt, this.ignoreAttributesFn = "function" == typeof (i2 = this.options.ignoreAttributes) ? i2 : Array.isArray(i2) ? (t3) => {
              for (const e3 of i2) {
                if ("string" == typeof e3 && t3 === e3) return true;
                if (e3 instanceof RegExp && e3.test(t3)) return true;
              }
            } : () => false, this.entityExpansionCount = 0, this.currentExpandedLength = 0, this.doctypefound = false;
            let n2 = { ...lt };
            this.options.entityDecoder ? this.entityDecoder = this.options.entityDecoder : ("object" == typeof this.options.htmlEntities ? n2 = this.options.htmlEntities : true === this.options.htmlEntities && (n2 = { ...pt, ...at }), this.entityDecoder = new yt({ namedEntities: { ...n2, ...e2 }, numericAllowed: this.options.htmlEntities, limit: { maxTotalExpansions: this.options.processEntities.maxTotalExpansions, maxExpandedLength: this.options.processEntities.maxExpandedLength, applyLimitsTo: this.options.processEntities.appliesTo }, onInputEntity: (t3, e3) => Ot(e3, [wt, vt]) ? ct.BLOCK : ct.ALLOW })), this.matcher = new rt(), this.readonlyMatcher = this.matcher.readOnly(), this.isCurrentNodeStopNode = false, this.stopNodeExpressionsSet = new ot();
            const r2 = this.options.stopNodes;
            if (r2 && r2.length > 0) {
              for (let t3 = 0; t3 < r2.length; t3++) {
                const e3 = r2[t3];
                "string" == typeof e3 ? this.stopNodeExpressionsSet.add(new st(e3)) : e3 instanceof st && this.stopNodeExpressionsSet.add(e3);
              }
              this.stopNodeExpressionsSet.seal();
            }
          }
        }
        function Lt(t2, e2, i2, n2, r2, s2, o2) {
          const a2 = this.options;
          if (void 0 !== t2 && (a2.trimValues && !n2 && (t2 = t2.trim()), t2.length > 0)) {
            o2 || (t2 = this.replaceEntitiesValue(t2, e2, i2));
            const n3 = a2.jPath ? i2.toString() : i2, l2 = a2.tagValueProcessor(e2, t2, n3, r2, s2);
            return null == l2 ? t2 : typeof l2 != typeof t2 || l2 !== t2 ? l2 : a2.trimValues || t2.trim() === t2 ? Yt(t2, a2.parseTagValue, a2.numberParseOptions) : t2;
          }
        }
        function Dt(t2) {
          if (this.options.removeNSPrefix) {
            const e2 = t2.split(":"), i2 = "/" === t2.charAt(0) ? "/" : "";
            if ("xmlns" === e2[0]) return "";
            2 === e2.length && (t2 = i2 + e2[1]);
          }
          return t2;
        }
        const Rt = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
        function Mt(t2, e2, i2, n2 = false) {
          const s2 = this.options;
          if (true === n2 || true !== s2.ignoreAttributes && "string" == typeof t2) {
            const n3 = r(t2, Rt), o2 = n3.length, a2 = {}, l2 = new Array(o2);
            let p2 = false;
            const c2 = {};
            for (let t3 = 0; t3 < o2; t3++) {
              const e3 = this.resolveNameSpace(n3[t3][1]), r2 = n3[t3][4];
              if (e3.length && void 0 !== r2) {
                let n4 = r2;
                s2.trimValues && (n4 = n4.trim()), n4 = this.replaceEntitiesValue(n4, i2, this.readonlyMatcher), l2[t3] = n4, c2[e3] = n4, p2 = true;
              }
            }
            p2 && "object" == typeof e2 && e2.updateCurrent && e2.updateCurrent(c2);
            const h2 = s2.jPath ? e2.toString() : this.readonlyMatcher;
            let d2 = false;
            for (let t3 = 0; t3 < o2; t3++) {
              const e3 = this.resolveNameSpace(n3[t3][1]);
              if (this.ignoreAttributesFn(e3, h2)) continue;
              let i3 = s2.attributeNamePrefix + e3;
              if (e3.length) if (s2.transformAttributeName && (i3 = s2.transformAttributeName(i3)), i3 = Qt(i3, s2), void 0 !== n3[t3][4]) {
                const n4 = l2[t3], r2 = s2.attributeValueProcessor(e3, n4, h2);
                a2[i3] = null == r2 ? n4 : typeof r2 != typeof n4 || r2 !== n4 ? r2 : Yt(n4, s2.parseAttributeValue, s2.numberParseOptions), d2 = true;
              } else s2.allowBooleanAttributes && (a2[i3] = true, d2 = true);
            }
            if (!d2) return;
            if (s2.attributesGroupName && !s2.preserveOrder) {
              const t3 = {};
              return t3[s2.attributesGroupName] = a2, t3;
            }
            return a2;
          }
        }
        const Vt = function(t2) {
          t2 = t2.replace(/\r\n?/g, "\n");
          const e2 = new P("!xml");
          let i2 = e2, n2 = "";
          this.matcher.reset(), this.entityDecoder.reset(), this.entityExpansionCount = 0, this.currentExpandedLength = 0, this.doctypefound = false;
          const r2 = this.options, s2 = new q(r2.processEntities), o2 = t2.length;
          for (let a2 = 0; a2 < o2; a2++) if ("<" === t2[a2]) {
            const l2 = t2.charCodeAt(a2 + 1);
            if (47 === l2) {
              const e3 = Gt(t2, ">", a2, "Closing Tag is not closed.");
              let s3 = t2.substring(a2 + 2, e3).trim();
              if (r2.removeNSPrefix) {
                const t3 = s3.indexOf(":");
                -1 !== t3 && (s3 = s3.substr(t3 + 1));
              }
              s3 = Ht(r2.transformTagName, s3, "", r2).tagName, i2 && (n2 = this.saveTextToParentTag(n2, i2, this.readonlyMatcher));
              const o3 = this.matcher.getCurrentTag();
              if (s3 && r2.unpairedTagsSet.has(s3)) throw new Error(`Unpaired tag can not be used as closing tag: </${s3}>`);
              o3 && r2.unpairedTagsSet.has(o3) && (this.matcher.pop(), this.tagsNodeStack.pop()), this.matcher.pop(), this.isCurrentNodeStopNode = false, i2 = this.tagsNodeStack.pop(), n2 = "", a2 = e3;
            } else if (63 === l2) {
              let e3 = Wt(t2, a2, false, "?>");
              if (!e3) throw new Error("Pi Tag is not closed.");
              n2 = this.saveTextToParentTag(n2, i2, this.readonlyMatcher);
              const o3 = this.buildAttributesMap(e3.tagExp, this.matcher, e3.tagName, true);
              if (o3) {
                const t3 = o3[this.options.attributeNamePrefix + "version"];
                this.entityDecoder.setXmlVersion(Number(t3) || 1), s2.setXmlVersion(Number(t3) || 1);
              }
              if (r2.ignoreDeclaration && "?xml" === e3.tagName || r2.ignorePiTags) ;
              else {
                const t3 = new P(e3.tagName);
                t3.add(r2.textNodeName, ""), e3.tagName !== e3.tagExp && e3.attrExpPresent && true !== r2.ignoreAttributes && (t3[":@"] = o3), this.addChild(i2, t3, this.readonlyMatcher, a2);
              }
              a2 = e3.closeIndex + 1;
            } else if (33 === l2 && 45 === t2.charCodeAt(a2 + 2) && 45 === t2.charCodeAt(a2 + 3)) {
              const e3 = Gt(t2, "-->", a2 + 4, "Comment is not closed.");
              if (r2.commentPropName) {
                const s3 = t2.substring(a2 + 4, e3 - 2);
                n2 = this.saveTextToParentTag(n2, i2, this.readonlyMatcher), i2.add(r2.commentPropName, [{ [r2.textNodeName]: s3 }]);
              }
              a2 = e3;
            } else if (33 === l2 && 68 === t2.charCodeAt(a2 + 2)) {
              if (this.doctypefound) throw new Error("Multiple DOCTYPE declarations found.");
              this.doctypefound = true;
              const e3 = s2.readDocType(t2, a2);
              this.entityDecoder.addInputEntities(e3.entities), a2 = e3.i;
            } else if (33 === l2 && 91 === t2.charCodeAt(a2 + 2)) {
              const e3 = Gt(t2, "]]>", a2, "CDATA is not closed.") - 2, s3 = t2.substring(a2 + 9, e3);
              n2 = this.saveTextToParentTag(n2, i2, this.readonlyMatcher);
              let o3 = this.parseTextData(s3, i2.tagname, this.readonlyMatcher, true, false, true, true);
              null == o3 && (o3 = ""), r2.cdataPropName ? i2.add(r2.cdataPropName, [{ [r2.textNodeName]: s3 }]) : i2.add(r2.textNodeName, o3), a2 = e3 + 2;
            } else {
              let s3 = Wt(t2, a2, r2.removeNSPrefix);
              if (!s3) {
                const e3 = t2.substring(Math.max(0, a2 - 50), Math.min(o2, a2 + 50));
                throw new Error(`readTagExp returned undefined at position ${a2}. Context: "${e3}"`);
              }
              let l3 = s3.tagName;
              const p2 = s3.rawTagName;
              let c2 = s3.tagExp, h2 = s3.attrExpPresent, d2 = s3.closeIndex;
              if ({ tagName: l3, tagExp: c2 } = Ht(r2.transformTagName, l3, c2, r2), r2.strictReservedNames && (l3 === r2.commentPropName || l3 === r2.cdataPropName || l3 === r2.textNodeName || l3 === r2.attributesGroupName)) throw new Error(`Invalid tag name: ${l3}`);
              i2 && n2 && "!xml" !== i2.tagname && (n2 = this.saveTextToParentTag(n2, i2, this.readonlyMatcher, false));
              const u2 = i2;
              u2 && r2.unpairedTagsSet.has(u2.tagname) && (i2 = this.tagsNodeStack.pop(), this.matcher.pop());
              let f2 = false;
              c2.length > 0 && c2.lastIndexOf("/") === c2.length - 1 && (f2 = true, "/" === l3[l3.length - 1] ? (l3 = l3.substr(0, l3.length - 1), c2 = l3) : c2 = c2.substr(0, c2.length - 1), h2 = l3 !== c2);
              let g2, m2 = null, x2 = {};
              g2 = It(p2), l3 !== e2.tagname && this.matcher.push(l3, {}, g2), l3 !== c2 && h2 && (m2 = this.buildAttributesMap(c2, this.matcher, l3), m2 && (x2 = jt(m2, r2))), l3 !== e2.tagname && (this.isCurrentNodeStopNode = this.isItStopNode());
              const b2 = a2;
              if (this.isCurrentNodeStopNode) {
                let e3 = "";
                if (f2) a2 = s3.closeIndex;
                else if (r2.unpairedTagsSet.has(l3)) a2 = s3.closeIndex;
                else {
                  const i3 = this.readStopNodeData(t2, p2, d2 + 1);
                  if (!i3) throw new Error(`Unexpected end of ${p2}`);
                  a2 = i3.i, e3 = i3.tagContent;
                }
                const n3 = new P(l3);
                m2 && (n3[":@"] = m2), n3.add(r2.textNodeName, e3), this.matcher.pop(), this.isCurrentNodeStopNode = false, this.addChild(i2, n3, this.readonlyMatcher, b2);
              } else {
                if (f2) {
                  ({ tagName: l3, tagExp: c2 } = Ht(r2.transformTagName, l3, c2, r2));
                  const t3 = new P(l3);
                  m2 && (t3[":@"] = m2), this.addChild(i2, t3, this.readonlyMatcher, b2), this.matcher.pop(), this.isCurrentNodeStopNode = false;
                } else {
                  if (r2.unpairedTagsSet.has(l3)) {
                    const t3 = new P(l3);
                    m2 && (t3[":@"] = m2), this.addChild(i2, t3, this.readonlyMatcher, b2), this.matcher.pop(), this.isCurrentNodeStopNode = false, a2 = s3.closeIndex;
                    continue;
                  }
                  {
                    const t3 = new P(l3);
                    if (this.tagsNodeStack.length > r2.maxNestedTags) throw new Error("Maximum nested tags exceeded");
                    this.tagsNodeStack.push(i2), m2 && (t3[":@"] = m2), this.addChild(i2, t3, this.readonlyMatcher, b2), i2 = t3;
                  }
                }
                n2 = "", a2 = d2;
              }
            }
          } else n2 += t2[a2];
          return e2.child;
        };
        function qt(t2, e2, i2, n2) {
          this.options.captureMetaData || (n2 = void 0);
          const r2 = this.options.jPath ? i2.toString() : i2, s2 = this.options.updateTag(e2.tagname, r2, e2[":@"]);
          false === s2 || ("string" == typeof s2 ? (e2.tagname = s2, t2.addChild(e2, n2)) : t2.addChild(e2, n2));
        }
        function Ft(t2, e2, i2) {
          const n2 = this.options.processEntities;
          if (!n2 || !n2.enabled) return t2;
          if (n2.allowedTags) {
            const r2 = this.options.jPath ? i2.toString() : i2;
            if (!(Array.isArray(n2.allowedTags) ? n2.allowedTags.includes(e2) : n2.allowedTags(e2, r2))) return t2;
          }
          if (n2.tagFilter) {
            const r2 = this.options.jPath ? i2.toString() : i2;
            if (!n2.tagFilter(e2, r2)) return t2;
          }
          return this.entityDecoder.decode(t2);
        }
        function Ut(t2, e2, i2, n2) {
          return t2 && (void 0 === n2 && (n2 = 0 === e2.child.length), void 0 !== (t2 = this.parseTextData(t2, e2.tagname, i2, false, !!e2[":@"] && 0 !== Object.keys(e2[":@"]).length, n2)) && "" !== t2 && e2.add(this.options.textNodeName, t2), t2 = ""), t2;
        }
        function Bt() {
          return 0 !== this.stopNodeExpressionsSet.size && this.matcher.matchesAny(this.stopNodeExpressionsSet);
        }
        function Gt(t2, e2, i2, n2) {
          const r2 = t2.indexOf(e2, i2);
          if (-1 === r2) throw new Error(n2);
          return r2 + e2.length - 1;
        }
        function Xt(t2, e2, i2, n2) {
          const r2 = t2.indexOf(e2, i2);
          if (-1 === r2) throw new Error(n2);
          return r2;
        }
        function Wt(t2, e2, i2, n2 = ">") {
          const r2 = (function(t3, e3, i3 = ">") {
            let n3 = 0;
            const r3 = t3.length, s3 = i3.charCodeAt(0), o3 = i3.length > 1 ? i3.charCodeAt(1) : -1;
            let a3 = "", l3 = e3;
            for (let i4 = e3; i4 < r3; i4++) {
              const e4 = t3.charCodeAt(i4);
              if (n3) e4 === n3 && (n3 = 0);
              else if (34 === e4 || 39 === e4) n3 = e4;
              else if (e4 === s3) {
                if (-1 === o3) return a3 += t3.substring(l3, i4), { data: a3, index: i4 };
                if (t3.charCodeAt(i4 + 1) === o3) return a3 += t3.substring(l3, i4), { data: a3, index: i4 };
              } else 9 !== e4 || n3 || (a3 += t3.substring(l3, i4) + " ", l3 = i4 + 1);
            }
          })(t2, e2 + 1, n2);
          if (!r2) return;
          let s2 = r2.data;
          const o2 = r2.index, a2 = s2.search(/\s/);
          let l2 = s2, p2 = true;
          -1 !== a2 && (l2 = s2.substring(0, a2), s2 = s2.substring(a2 + 1).trimStart());
          const c2 = l2;
          if (i2) {
            const t3 = l2.indexOf(":");
            -1 !== t3 && (l2 = l2.substr(t3 + 1), p2 = l2 !== r2.data.substr(t3 + 1));
          }
          return { tagName: l2, tagExp: s2, closeIndex: o2, attrExpPresent: p2, rawTagName: c2 };
        }
        function zt(t2, e2, i2) {
          const n2 = i2;
          let r2 = 1;
          const s2 = t2.length;
          for (; i2 < s2; i2++) if ("<" === t2[i2]) {
            const s3 = t2.charCodeAt(i2 + 1);
            if (47 === s3) {
              const s4 = Xt(t2, ">", i2, `${e2} is not closed`);
              if (t2.substring(i2 + 2, s4).trim() === e2 && (r2--, 0 === r2)) return { tagContent: t2.substring(n2, i2), i: s4 };
              i2 = s4;
            } else if (63 === s3) i2 = Gt(t2, "?>", i2 + 1, "StopNode is not closed.");
            else if (33 === s3 && 45 === t2.charCodeAt(i2 + 2) && 45 === t2.charCodeAt(i2 + 3)) i2 = Gt(t2, "-->", i2 + 3, "StopNode is not closed.");
            else if (33 === s3 && 91 === t2.charCodeAt(i2 + 2)) i2 = Gt(t2, "]]>", i2, "StopNode is not closed.") - 2;
            else {
              const n3 = Wt(t2, i2, false);
              n3 && ((n3 && n3.tagName) === e2 && "/" !== n3.tagExp[n3.tagExp.length - 1] && r2++, i2 = n3.closeIndex);
            }
          }
        }
        function Yt(t2, e2, i2) {
          if (e2 && "string" == typeof t2) {
            const e3 = t2.trim();
            return "true" === e3 || "false" !== e3 && tt(t2, i2);
          }
          return void 0 !== t2 ? t2 : "";
        }
        function Ht(t2, e2, i2, n2) {
          if (t2) {
            const n3 = t2(e2);
            i2 === e2 && (i2 = n3), e2 = n3;
          }
          return { tagName: e2 = Qt(e2, n2), tagExp: i2 };
        }
        function Qt(t2, e2) {
          if (a.includes(t2)) throw new Error(`[SECURITY] Invalid name: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
          return o.includes(t2) ? e2.onDangerousProperty(t2) : t2;
        }
        const Jt = P.getMetaDataSymbol();
        function Zt(t2, e2) {
          if (!t2 || "object" != typeof t2) return {};
          if (!e2) return t2;
          const i2 = {};
          for (const n2 in t2) n2.startsWith(e2) ? i2[n2.substring(e2.length)] = t2[n2] : i2[n2] = t2[n2];
          return i2;
        }
        function Kt(t2, e2, i2, n2) {
          return te(t2, e2, i2, n2);
        }
        function te(t2, e2, i2, n2) {
          let r2;
          const s2 = {};
          for (let o2 = 0; o2 < t2.length; o2++) {
            const a2 = t2[o2], l2 = ee(a2);
            if (void 0 !== l2 && l2 !== e2.textNodeName) {
              const t3 = Zt(a2[":@"] || {}, e2.attributeNamePrefix);
              i2.push(l2, t3);
            }
            if (l2 === e2.textNodeName) void 0 === r2 ? r2 = a2[l2] : r2 += "" + a2[l2];
            else {
              if (void 0 === l2) continue;
              if (a2[l2]) {
                let t3 = te(a2[l2], e2, i2, n2);
                const r3 = ne(t3, e2);
                if (0 === Object.keys(t3).length && e2.alwaysCreateTextNode && (t3[e2.textNodeName] = ""), a2[":@"] ? ie(t3, a2[":@"], n2, e2) : 1 !== Object.keys(t3).length || void 0 === t3[e2.textNodeName] || e2.alwaysCreateTextNode ? 0 === Object.keys(t3).length && (e2.alwaysCreateTextNode ? t3[e2.textNodeName] = "" : t3 = "") : t3 = t3[e2.textNodeName], void 0 !== a2[Jt] && "object" == typeof t3 && null !== t3 && (t3[Jt] = a2[Jt]), void 0 !== s2[l2] && Object.prototype.hasOwnProperty.call(s2, l2)) Array.isArray(s2[l2]) || (s2[l2] = [s2[l2]]), s2[l2].push(t3);
                else {
                  const i3 = e2.jPath ? n2.toString() : n2;
                  e2.isArray(l2, i3, r3) ? s2[l2] = [t3] : s2[l2] = t3;
                }
                void 0 !== l2 && l2 !== e2.textNodeName && i2.pop();
              }
            }
          }
          return "string" == typeof r2 ? r2.length > 0 && (s2[e2.textNodeName] = r2) : void 0 !== r2 && (s2[e2.textNodeName] = r2), s2;
        }
        function ee(t2) {
          const e2 = Object.keys(t2);
          for (let t3 = 0; t3 < e2.length; t3++) {
            const i2 = e2[t3];
            if (":@" !== i2) return i2;
          }
        }
        function ie(t2, e2, i2, n2) {
          if (e2) {
            const r2 = Object.keys(e2), s2 = r2.length;
            for (let o2 = 0; o2 < s2; o2++) {
              const s3 = r2[o2], a2 = s3.startsWith(n2.attributeNamePrefix) ? s3.substring(n2.attributeNamePrefix.length) : s3, l2 = n2.jPath ? i2.toString() + "." + a2 : i2;
              n2.isArray(s3, l2, true, true) ? t2[s3] = [e2[s3]] : t2[s3] = e2[s3];
            }
          }
        }
        function ne(t2, e2) {
          const { textNodeName: i2 } = e2, n2 = Object.keys(t2).length;
          return 0 === n2 || !(1 !== n2 || !t2[i2] && "boolean" != typeof t2[i2] && 0 !== t2[i2]);
        }
        class re {
          constructor(t2) {
            this.externalEntities = {}, this.options = C(t2);
          }
          parse(t2, e2) {
            if ("string" != typeof t2 && t2.toString) t2 = t2.toString();
            else if ("string" != typeof t2) throw new Error("XML data is accepted in String or Bytes[] form.");
            if (e2) {
              true === e2 && (e2 = {});
              const i3 = p(t2, e2);
              if (true !== i3) throw Error(`${i3.err.msg}:${i3.err.line}:${i3.err.col}`);
            }
            const i2 = new kt(this.options, this.externalEntities), n2 = i2.parseXml(t2);
            return this.options.preserveOrder || void 0 === n2 ? n2 : Kt(n2, this.options, i2.matcher, i2.readonlyMatcher);
          }
          addEntity(t2, e2) {
            if (-1 !== e2.indexOf("&")) throw new Error("Entity value can't have '&'");
            if (-1 !== t2.indexOf("&") || -1 !== t2.indexOf(";")) throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
            if ("&" === e2) throw new Error("An entity with value '&' is not permitted");
            this.externalEntities[t2] = e2;
          }
          static getMetaDataSymbol() {
            return P.getMetaDataSymbol();
          }
        }
        function se(t2) {
          return String(t2).replace(/--/g, "- -").replace(/--/g, "- -").replace(/-$/, "- ");
        }
        function oe(t2) {
          return String(t2).replace(/\]\]>/g, "]]]]><![CDATA[>");
        }
        function ae(t2) {
          return String(t2).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        }
        const le = ":A-Za-z_\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD", pe = ":A-Za-z_\xC0-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}", ce = pe + "\\-\\.\\d\xB7\u0300-\u036F\u0487\u203F-\u2040", he = (t2, e2, i2 = "") => {
          const n2 = `[${t2.replace(":", "")}][${e2.replace(":", "")}]*`;
          return { name: new RegExp(`^[${t2}][${e2}]*$`, i2), ncName: new RegExp(`^${n2}$`, i2), qName: new RegExp(`^${n2}(?::${n2})?$`, i2), nmToken: new RegExp(`^[${e2}]+$`, i2), nmTokens: new RegExp(`^[${e2}]+(?:\\s+[${e2}]+)*$`, i2) };
        }, de = he(le, le + "\\-\\.\\d\xB7\u0300-\u036F\u203F-\u2040"), ue = he(pe, ce, "u"), fe = (t2, { xmlVersion: e2 = "1.0" } = {}) => (/* @__PURE__ */ ((t3 = "1.0") => "1.1" === t3 ? ue : de)(e2)).qName.test(t2);
        function ge(t2, e2, i2, n2, r2) {
          return i2.sanitizeName ? fe(t2, { xmlVersion: r2 }) ? t2 : i2.sanitizeName(t2, { isAttribute: e2, matcher: n2.readOnly() }) : t2;
        }
        function me(t2, e2) {
          let i2 = "";
          e2.format && (i2 = "\n");
          const n2 = [];
          if (e2.stopNodes && Array.isArray(e2.stopNodes)) for (let t3 = 0; t3 < e2.stopNodes.length; t3++) {
            const i3 = e2.stopNodes[t3];
            "string" == typeof i3 ? n2.push(new st(i3)) : i3 instanceof st && n2.push(i3);
          }
          const r2 = (function(t3, e3) {
            if (!Array.isArray(t3) || 0 === t3.length) return "1.0";
            const i3 = t3[0];
            if ("?xml" === Ee(i3)) {
              const t4 = i3[":@"];
              if (t4) {
                const i4 = e3.attributeNamePrefix + "version";
                if (t4[i4]) return t4[i4];
              }
            }
            return "1.0";
          })(t2, e2);
          return xe(t2, e2, i2, new rt(), n2, r2);
        }
        function xe(t2, e2, i2, n2, r2, s2) {
          let o2 = "", a2 = false;
          if (e2.maxNestedTags && n2.getDepth() > e2.maxNestedTags) throw new Error("Maximum nested tags exceeded");
          if (!Array.isArray(t2)) {
            if (null != t2) {
              let i3 = t2.toString();
              return i3 = Se(i3, e2), i3;
            }
            return "";
          }
          for (let l2 = 0; l2 < t2.length; l2++) {
            const p2 = t2[l2], c2 = Ee(p2);
            if (void 0 === c2) continue;
            const h2 = c2 === e2.textNodeName || c2 === e2.cdataPropName || c2 === e2.commentPropName || "?" === c2[0] ? c2 : ge(c2, false, e2, n2, s2), d2 = be(p2[":@"], e2);
            n2.push(h2, d2);
            const u2 = ve(n2, r2);
            if (h2 === e2.textNodeName) {
              let t3 = p2[c2];
              u2 || (t3 = e2.tagValueProcessor(h2, t3), t3 = Se(t3, e2)), a2 && (o2 += i2), o2 += t3, a2 = false, n2.pop();
              continue;
            }
            if (h2 === e2.cdataPropName) {
              a2 && (o2 += i2), o2 += `<![CDATA[${oe(p2[c2][0][e2.textNodeName])}]]>`, a2 = false, n2.pop();
              continue;
            }
            if (h2 === e2.commentPropName) {
              o2 += i2 + `<!--${se(p2[c2][0][e2.textNodeName])}-->`, a2 = true, n2.pop();
              continue;
            }
            if ("?" === h2[0]) {
              o2 += ("?xml" === h2 ? "" : i2) + `<${h2}${we(p2[":@"], e2, u2, n2, s2)}?>`, a2 = true, n2.pop();
              continue;
            }
            let f2 = i2;
            "" !== f2 && (f2 += e2.indentBy);
            const g2 = i2 + `<${h2}${we(p2[":@"], e2, u2, n2, s2)}`;
            let m2;
            m2 = u2 ? ye(p2[c2], e2) : xe(p2[c2], e2, f2, n2, r2, s2), -1 !== e2.unpairedTags.indexOf(h2) ? e2.suppressUnpairedNode ? o2 += g2 + ">" : o2 += g2 + "/>" : m2 && 0 !== m2.length || !e2.suppressEmptyNode ? m2 && m2.endsWith(">") ? o2 += g2 + `>${m2}${i2}</${h2}>` : (o2 += g2 + ">", m2 && "" !== i2 && (m2.includes("/>") || m2.includes("</")) ? o2 += i2 + e2.indentBy + m2 + i2 : o2 += m2, o2 += `</${h2}>`) : o2 += g2 + "/>", a2 = true, n2.pop();
          }
          return o2;
        }
        function be(t2, e2) {
          if (!t2 || e2.ignoreAttributes) return null;
          const i2 = {};
          let n2 = false;
          for (let r2 in t2) Object.prototype.hasOwnProperty.call(t2, r2) && (i2[r2.startsWith(e2.attributeNamePrefix) ? r2.substr(e2.attributeNamePrefix.length) : r2] = ae(t2[r2]), n2 = true);
          return n2 ? i2 : null;
        }
        function ye(t2, e2) {
          if (!Array.isArray(t2)) return null != t2 ? t2.toString() : "";
          let i2 = "";
          for (let n2 = 0; n2 < t2.length; n2++) {
            const r2 = t2[n2], s2 = Ee(r2);
            if (s2 === e2.textNodeName) i2 += r2[s2];
            else if (s2 === e2.cdataPropName) i2 += r2[s2][0][e2.textNodeName];
            else if (s2 === e2.commentPropName) i2 += r2[s2][0][e2.textNodeName];
            else {
              if (s2 && "?" === s2[0]) continue;
              if (s2) {
                const t3 = Ne(r2[":@"], e2), n3 = ye(r2[s2], e2);
                n3 && 0 !== n3.length ? i2 += `<${s2}${t3}>${n3}</${s2}>` : i2 += `<${s2}${t3}/>`;
              }
            }
          }
          return i2;
        }
        function Ne(t2, e2) {
          let i2 = "";
          if (t2 && !e2.ignoreAttributes) for (let n2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, n2)) continue;
            let r2 = t2[n2];
            true === r2 && e2.suppressBooleanAttributes ? i2 += ` ${n2.substr(e2.attributeNamePrefix.length)}` : i2 += ` ${n2.substr(e2.attributeNamePrefix.length)}="${ae(r2)}"`;
          }
          return i2;
        }
        function Ee(t2) {
          const e2 = Object.keys(t2);
          for (let i2 = 0; i2 < e2.length; i2++) {
            const n2 = e2[i2];
            if (Object.prototype.hasOwnProperty.call(t2, n2) && ":@" !== n2) return n2;
          }
        }
        function we(t2, e2, i2, n2, r2) {
          let s2 = "";
          if (t2 && !e2.ignoreAttributes) for (let o2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, o2)) continue;
            const a2 = o2.substr(e2.attributeNamePrefix.length), l2 = i2 ? a2 : ge(a2, true, e2, n2, r2);
            let p2;
            i2 ? p2 = t2[o2] : (p2 = e2.attributeValueProcessor(o2, t2[o2]), p2 = Se(p2, e2)), true === p2 && e2.suppressBooleanAttributes ? s2 += ` ${l2}` : s2 += ` ${l2}="${ae(p2)}"`;
          }
          return s2;
        }
        function ve(t2, e2) {
          if (!e2 || 0 === e2.length) return false;
          for (let i2 = 0; i2 < e2.length; i2++) if (t2.matches(e2[i2])) return true;
          return false;
        }
        function Se(t2, e2) {
          if (t2 && t2.length > 0 && e2.processEntities) for (let i2 = 0; i2 < e2.entities.length; i2++) {
            const n2 = e2.entities[i2];
            t2 = t2.replace(n2.regex, n2.val);
          }
          return t2;
        }
        const Ae = { attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, cdataPropName: false, format: false, indentBy: "  ", suppressEmptyNode: false, suppressUnpairedNode: true, suppressBooleanAttributes: true, tagValueProcessor: function(t2, e2) {
          return e2;
        }, attributeValueProcessor: function(t2, e2) {
          return e2;
        }, preserveOrder: false, commentPropName: false, unpairedTags: [], entities: [{ regex: new RegExp("&", "g"), val: "&amp;" }, { regex: new RegExp(">", "g"), val: "&gt;" }, { regex: new RegExp("<", "g"), val: "&lt;" }, { regex: new RegExp("'", "g"), val: "&apos;" }, { regex: new RegExp('"', "g"), val: "&quot;" }], processEntities: true, stopNodes: [], oneListGroup: false, maxNestedTags: 100, jPath: true, sanitizeName: false };
        function Te(t2) {
          if (this.options = Object.assign({}, Ae, t2), this.options.stopNodes && Array.isArray(this.options.stopNodes) && (this.options.stopNodes = this.options.stopNodes.map((t3) => "string" == typeof t3 && t3.startsWith("*.") ? ".." + t3.substring(2) : t3)), this.stopNodeExpressions = [], this.options.stopNodes && Array.isArray(this.options.stopNodes)) for (let t3 = 0; t3 < this.options.stopNodes.length; t3++) {
            const e3 = this.options.stopNodes[t3];
            "string" == typeof e3 ? this.stopNodeExpressions.push(new st(e3)) : e3 instanceof st && this.stopNodeExpressions.push(e3);
          }
          var e2;
          true === this.options.ignoreAttributes || this.options.attributesGroupName ? this.isAttribute = function() {
            return false;
          } : (this.ignoreAttributesFn = "function" == typeof (e2 = this.options.ignoreAttributes) ? e2 : Array.isArray(e2) ? (t3) => {
            for (const i2 of e2) {
              if ("string" == typeof i2 && t3 === i2) return true;
              if (i2 instanceof RegExp && i2.test(t3)) return true;
            }
          } : () => false, this.attrPrefixLen = this.options.attributeNamePrefix.length, this.isAttribute = Pe), this.processTextOrObjNode = Ce, this.options.format ? (this.indentate = $e, this.tagEndChar = ">\n", this.newLine = "\n") : (this.indentate = function() {
            return "";
          }, this.tagEndChar = ">", this.newLine = "");
        }
        function _e(t2, e2, i2, n2, r2) {
          return i2.sanitizeName ? fe(t2, { xmlVersion: r2 }) ? t2 : i2.sanitizeName(t2, { isAttribute: e2, matcher: n2.readOnly() }) : t2;
        }
        function Ce(t2, e2, i2, n2, r2) {
          const s2 = this.extractAttributes(t2);
          if (n2.push(e2, s2), this.checkStopNode(n2)) {
            const r3 = this.buildRawContent(t2), s3 = this.buildAttributesForStopNode(t2);
            return n2.pop(), this.buildObjectNode(r3, e2, s3, i2);
          }
          const o2 = this.j2x(t2, i2 + 1, n2, r2);
          return n2.pop(), "?" === e2[0] ? this.buildTextValNode("", e2, o2.attrStr, i2, n2) : void 0 !== t2[this.options.textNodeName] && 1 === Object.keys(t2).length ? this.buildTextValNode(t2[this.options.textNodeName], e2, o2.attrStr, i2, n2) : this.buildObjectNode(o2.val, e2, o2.attrStr, i2);
        }
        function $e(t2) {
          return this.options.indentBy.repeat(t2);
        }
        function Pe(t2) {
          return !(!t2.startsWith(this.options.attributeNamePrefix) || t2 === this.options.textNodeName) && t2.substr(this.attrPrefixLen);
        }
        Te.prototype.build = function(t2) {
          if (this.options.preserveOrder) return me(t2, this.options);
          {
            Array.isArray(t2) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1 && (t2 = { [this.options.arrayNodeName]: t2 });
            const e2 = new rt(), i2 = (function(t3, e3) {
              const i3 = t3["?xml"];
              if (i3 && "object" == typeof i3) {
                if (e3.attributesGroupName && i3[e3.attributesGroupName]) {
                  const t5 = i3[e3.attributesGroupName][e3.attributeNamePrefix + "version"];
                  if (t5) return t5;
                }
                const t4 = i3[e3.attributeNamePrefix + "version"];
                if (t4) return t4;
              }
              return "1.0";
            })(t2, this.options);
            return this.j2x(t2, 0, e2, i2).val;
          }
        }, Te.prototype.j2x = function(t2, e2, i2, n2) {
          let r2 = "", s2 = "";
          if (this.options.maxNestedTags && i2.getDepth() >= this.options.maxNestedTags) throw new Error("Maximum nested tags exceeded");
          const o2 = this.options.jPath ? i2.toString() : i2, a2 = this.checkStopNode(i2);
          for (let l2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, l2)) continue;
            const p2 = l2 === this.options.textNodeName || l2 === this.options.cdataPropName || l2 === this.options.commentPropName || this.options.attributesGroupName && l2 === this.options.attributesGroupName || this.isAttribute(l2) || "?" === l2[0] ? l2 : _e(l2, false, this.options, i2, n2);
            if (void 0 === t2[l2]) this.isAttribute(l2) && (s2 += "");
            else if (null === t2[l2]) this.isAttribute(l2) || p2 === this.options.cdataPropName || p2 === this.options.commentPropName ? s2 += "" : "?" === p2[0] ? s2 += this.indentate(e2) + "<" + p2 + "?" + this.tagEndChar : s2 += this.indentate(e2) + "<" + p2 + "/" + this.tagEndChar;
            else if (t2[l2] instanceof Date) s2 += this.buildTextValNode(t2[l2], p2, "", e2, i2);
            else if ("object" != typeof t2[l2]) {
              const c2 = this.isAttribute(l2);
              if (c2 && !this.ignoreAttributesFn(c2, o2)) {
                const e3 = _e(c2, true, this.options, i2, n2);
                r2 += this.buildAttrPairStr(e3, "" + t2[l2], a2);
              } else if (!c2) if (l2 === this.options.textNodeName) {
                let e3 = this.options.tagValueProcessor(l2, "" + t2[l2]);
                s2 += this.replaceEntitiesValue(e3);
              } else {
                i2.push(p2);
                const n3 = this.checkStopNode(i2);
                if (i2.pop(), n3) {
                  const i3 = "" + t2[l2];
                  s2 += "" === i3 ? this.indentate(e2) + "<" + p2 + this.closeTag(p2) + this.tagEndChar : this.indentate(e2) + "<" + p2 + ">" + i3 + "</" + p2 + this.tagEndChar;
                } else s2 += this.buildTextValNode(t2[l2], p2, "", e2, i2);
              }
            } else if (Array.isArray(t2[l2])) {
              const r3 = t2[l2].length;
              let o3 = "", a3 = "";
              for (let c2 = 0; c2 < r3; c2++) {
                const r4 = t2[l2][c2];
                if (void 0 === r4) ;
                else if (null === r4) "?" === p2[0] ? s2 += this.indentate(e2) + "<" + p2 + "?" + this.tagEndChar : s2 += this.indentate(e2) + "<" + p2 + "/" + this.tagEndChar;
                else if ("object" == typeof r4) if (this.options.oneListGroup) {
                  i2.push(p2);
                  const t3 = this.j2x(r4, e2 + 1, i2, n2);
                  i2.pop(), o3 += t3.val, this.options.attributesGroupName && r4.hasOwnProperty(this.options.attributesGroupName) && (a3 += t3.attrStr);
                } else o3 += this.processTextOrObjNode(r4, p2, e2, i2, n2);
                else if (this.options.oneListGroup) {
                  let t3 = this.options.tagValueProcessor(p2, r4);
                  t3 = this.replaceEntitiesValue(t3), o3 += t3;
                } else {
                  i2.push(p2);
                  const t3 = this.checkStopNode(i2);
                  if (i2.pop(), t3) {
                    const t4 = "" + r4;
                    o3 += "" === t4 ? this.indentate(e2) + "<" + p2 + this.closeTag(p2) + this.tagEndChar : this.indentate(e2) + "<" + p2 + ">" + t4 + "</" + p2 + this.tagEndChar;
                  } else o3 += this.buildTextValNode(r4, p2, "", e2, i2);
                }
              }
              this.options.oneListGroup && (o3 = this.buildObjectNode(o3, p2, a3, e2)), s2 += o3;
            } else if (this.options.attributesGroupName && l2 === this.options.attributesGroupName) {
              const e3 = Object.keys(t2[l2]), s3 = e3.length;
              for (let o3 = 0; o3 < s3; o3++) {
                const s4 = _e(e3[o3], true, this.options, i2, n2);
                r2 += this.buildAttrPairStr(s4, "" + t2[l2][e3[o3]], a2);
              }
            } else s2 += this.processTextOrObjNode(t2[l2], p2, e2, i2, n2);
          }
          return { attrStr: r2, val: s2 };
        }, Te.prototype.buildAttrPairStr = function(t2, e2, i2) {
          return i2 || (e2 = this.options.attributeValueProcessor(t2, "" + e2), e2 = this.replaceEntitiesValue(e2)), this.options.suppressBooleanAttributes && "true" === e2 ? " " + t2 : " " + t2 + '="' + ae(e2) + '"';
        }, Te.prototype.extractAttributes = function(t2) {
          if (!t2 || "object" != typeof t2) return null;
          const e2 = {};
          let i2 = false;
          if (this.options.attributesGroupName && t2[this.options.attributesGroupName]) {
            const n2 = t2[this.options.attributesGroupName];
            for (let t3 in n2) Object.prototype.hasOwnProperty.call(n2, t3) && (e2[t3.startsWith(this.options.attributeNamePrefix) ? t3.substring(this.options.attributeNamePrefix.length) : t3] = ae(n2[t3]), i2 = true);
          } else for (let n2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, n2)) continue;
            const r2 = this.isAttribute(n2);
            r2 && (e2[r2] = ae(t2[n2]), i2 = true);
          }
          return i2 ? e2 : null;
        }, Te.prototype.buildRawContent = function(t2) {
          if ("string" == typeof t2) return t2;
          if ("object" != typeof t2 || null === t2) return String(t2);
          if (void 0 !== t2[this.options.textNodeName]) return t2[this.options.textNodeName];
          let e2 = "";
          for (let i2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, i2)) continue;
            if (this.isAttribute(i2)) continue;
            if (this.options.attributesGroupName && i2 === this.options.attributesGroupName) continue;
            const n2 = t2[i2];
            if (i2 === this.options.textNodeName) e2 += n2;
            else if (Array.isArray(n2)) {
              for (let t3 of n2) if ("string" == typeof t3 || "number" == typeof t3) e2 += `<${i2}>${t3}</${i2}>`;
              else if ("object" == typeof t3 && null !== t3) {
                const n3 = this.buildRawContent(t3), r2 = this.buildAttributesForStopNode(t3);
                e2 += "" === n3 ? `<${i2}${r2}/>` : `<${i2}${r2}>${n3}</${i2}>`;
              }
            } else if ("object" == typeof n2 && null !== n2) {
              const t3 = this.buildRawContent(n2), r2 = this.buildAttributesForStopNode(n2);
              e2 += "" === t3 ? `<${i2}${r2}/>` : `<${i2}${r2}>${t3}</${i2}>`;
            } else e2 += `<${i2}>${n2}</${i2}>`;
          }
          return e2;
        }, Te.prototype.buildAttributesForStopNode = function(t2) {
          if (!t2 || "object" != typeof t2) return "";
          let e2 = "";
          if (this.options.attributesGroupName && t2[this.options.attributesGroupName]) {
            const i2 = t2[this.options.attributesGroupName];
            for (let t3 in i2) {
              if (!Object.prototype.hasOwnProperty.call(i2, t3)) continue;
              const n2 = t3.startsWith(this.options.attributeNamePrefix) ? t3.substring(this.options.attributeNamePrefix.length) : t3, r2 = i2[t3];
              true === r2 && this.options.suppressBooleanAttributes ? e2 += " " + n2 : e2 += " " + n2 + '="' + r2 + '"';
            }
          } else for (let i2 in t2) {
            if (!Object.prototype.hasOwnProperty.call(t2, i2)) continue;
            const n2 = this.isAttribute(i2);
            if (n2) {
              const r2 = t2[i2];
              true === r2 && this.options.suppressBooleanAttributes ? e2 += " " + n2 : e2 += " " + n2 + '="' + r2 + '"';
            }
          }
          return e2;
        }, Te.prototype.buildObjectNode = function(t2, e2, i2, n2) {
          if ("" === t2) return "?" === e2[0] ? this.indentate(n2) + "<" + e2 + i2 + "?" + this.tagEndChar : this.indentate(n2) + "<" + e2 + i2 + this.closeTag(e2) + this.tagEndChar;
          if ("?" === e2[0]) return this.indentate(n2) + "<" + e2 + i2 + "?" + this.tagEndChar;
          {
            let r2 = "</" + e2 + this.tagEndChar, s2 = "";
            return "?" === e2[0] && (s2 = "?", r2 = ""), !i2 && "" !== i2 || -1 !== t2.indexOf("<") ? false !== this.options.commentPropName && e2 === this.options.commentPropName && 0 === s2.length ? this.indentate(n2) + `<!--${t2}-->` + this.newLine : this.indentate(n2) + "<" + e2 + i2 + s2 + this.tagEndChar + t2 + this.indentate(n2) + r2 : this.indentate(n2) + "<" + e2 + i2 + s2 + ">" + t2 + r2;
          }
        }, Te.prototype.closeTag = function(t2) {
          let e2 = "";
          return -1 !== this.options.unpairedTags.indexOf(t2) ? this.options.suppressUnpairedNode || (e2 = "/") : e2 = this.options.suppressEmptyNode ? "/" : `></${t2}`, e2;
        }, Te.prototype.checkStopNode = function(t2) {
          if (!this.stopNodeExpressions || 0 === this.stopNodeExpressions.length) return false;
          for (let e2 = 0; e2 < this.stopNodeExpressions.length; e2++) if (t2.matches(this.stopNodeExpressions[e2])) return true;
          return false;
        }, Te.prototype.buildTextValNode = function(t2, e2, i2, n2, r2) {
          if (false !== this.options.cdataPropName && e2 === this.options.cdataPropName) {
            const e3 = oe(t2);
            return this.indentate(n2) + `<![CDATA[${e3}]]>` + this.newLine;
          }
          if (false !== this.options.commentPropName && e2 === this.options.commentPropName) {
            const e3 = se(t2);
            return this.indentate(n2) + `<!--${e3}-->` + this.newLine;
          }
          if ("?" === e2[0]) return this.indentate(n2) + "<" + e2 + i2 + "?" + this.tagEndChar;
          {
            let r3 = this.options.tagValueProcessor(e2, t2);
            return r3 = this.replaceEntitiesValue(r3), "" === r3 ? this.indentate(n2) + "<" + e2 + i2 + this.closeTag(e2) + this.tagEndChar : this.indentate(n2) + "<" + e2 + i2 + ">" + r3 + "</" + e2 + this.tagEndChar;
          }
        }, Te.prototype.replaceEntitiesValue = function(t2) {
          if (t2 && t2.length > 0 && this.options.processEntities) for (let e2 = 0; e2 < this.options.entities.length; e2++) {
            const i2 = this.options.entities[e2];
            t2 = t2.replace(i2.regex, i2.val);
          }
          return t2;
        };
        const Oe = Te, je = { validate: p };
        module.exports = e;
      })();
    }
  });

  // path-shim.js
  var path_shim_exports = {};
  __export(path_shim_exports, {
    basename: () => basename,
    default: () => path_shim_default,
    dirname: () => dirname,
    extname: () => extname,
    join: () => join,
    resolve: () => resolve
  });
  var basename, extname, join, resolve, dirname, path_shim_default;
  var init_path_shim = __esm({
    "path-shim.js"() {
      basename = (p, ext) => {
        let base = p.split(/[\\/]/).pop() || "";
        if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length);
        return base;
      };
      extname = (p) => {
        const base = basename(p);
        const idx = base.lastIndexOf(".");
        return idx > 0 ? base.slice(idx) : "";
      };
      join = (...parts) => parts.join("/").replace(/\/+/g, "/");
      resolve = (...parts) => parts.join("/").replace(/\/+/g, "/");
      dirname = (p) => p.replace(/[\\/][^\\/]*$/, "") || ".";
      path_shim_default = { basename, extname, join, resolve, dirname };
    }
  });

  // ../package/main/enums/MetadataTypes.js
  var require_MetadataTypes = __commonJS({
    "../package/main/enums/MetadataTypes.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MetaType", {
        enumerable: true,
        get: function() {
          return MetaType;
        }
      });
      var MetaType = /* @__PURE__ */ (function(MetaType2) {
        MetaType2["ATTRIBUTE"] = "attribute";
        MetaType2["VARIABLE"] = "variable";
        MetaType2["RESOURCE"] = "resource";
        MetaType2["NODE"] = "node";
        return MetaType2;
      })({});
    }
  });

  // ../package/main/models/FlowElement.js
  var require_FlowElement = __commonJS({
    "../package/main/models/FlowElement.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowElement", {
        enumerable: true,
        get: function() {
          return FlowElement;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowElement = class FlowElement {
        constructor(metaType, subtype, name, element = {}) {
          _define_property(this, "subtype", void 0);
          _define_property(this, "metaType", void 0);
          _define_property(this, "element", {});
          _define_property(this, "connectors", void 0);
          _define_property(this, "name", void 0);
          _define_property(this, "locationX", void 0);
          _define_property(this, "locationY", void 0);
          this.element = element;
          this.subtype = subtype;
          this.name = name;
          this.metaType = metaType;
        }
      };
    }
  });

  // ../package/main/models/FlowMetadata.js
  var require_FlowMetadata = __commonJS({
    "../package/main/models/FlowMetadata.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowMetadata", {
        enumerable: true,
        get: function() {
          return FlowMetadata;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _FlowElement = require_FlowElement();
      var FlowMetadata = class FlowMetadata extends _FlowElement.FlowElement {
        constructor(name, subtype, element) {
          super(_MetadataTypes.MetaType.ATTRIBUTE, subtype, name, element);
        }
      };
    }
  });

  // ../package/main/models/FlowElementConnector.js
  var require_FlowElementConnector = __commonJS({
    "../package/main/models/FlowElementConnector.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowElementConnector", {
        enumerable: true,
        get: function() {
          return FlowElementConnector;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowElementConnector = class FlowElementConnector {
        constructor(type, element, args) {
          _define_property(this, "type", void 0);
          _define_property(this, "element", {});
          _define_property(this, "processed", false);
          _define_property(this, "alias", void 0);
          _define_property(this, "reference", void 0);
          _define_property(this, "childName", void 0);
          _define_property(this, "childOf", void 0);
          _define_property(this, "connectorTargetReference", void 0);
          this.type = type;
          this.element = element;
          this.childName = args.childName ? args.childName : void 0;
          this.childOf = args.childOf ? args.childOf : void 0;
          if (element && "targetReference" in element) {
            this.reference = element.targetReference;
          }
          if (element && "connector" in element) {
            this.connectorTargetReference = element.connector;
          }
        }
      };
    }
  });

  // ../package/main/config/NodeIcons.js
  var require_NodeIcons = __commonJS({
    "../package/main/config/NodeIcons.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get ASCII_ICONS() {
          return ASCII_ICONS;
        },
        get DEFAULT_ICONS() {
          return DEFAULT_ICONS;
        },
        get getDefaultIconConfig() {
          return getDefaultIconConfig;
        }
      });
      var DEFAULT_ICONS = {
        actionCalls: {
          apex: "\u2699\uFE0F",
          emailAlert: "\u{1F4E7}",
          emailSimple: "\u{1F4E7}",
          submit: "\u26A1",
          default: "\u26A1"
          // HIGH VOLTAGE
        },
        assignments: {
          default: "\u{1F7F0}"
          // 🟰 HEAVY EQUALS SIGN
        },
        collectionProcessors: {
          FilterCollectionProcessor: "\u{1F53D}",
          SortCollectionProcessor: "\u{1F503}",
          default: "\u{1F4E6}"
          // PACKAGE
        },
        customErrors: {
          default: "\u{1F6AB}"
          // PROHIBITED
        },
        decisions: {
          default: "\u{1F500}"
          // TWISTED ARROWS
        },
        loops: {
          default: "\u{1F501}"
          // REPEAT BUTTON
        },
        recordCreates: {
          default: "\u2795"
          // PLUS
        },
        recordDeletes: {
          default: "\u{1F5D1}\uFE0F"
          // WASTEBASKET
        },
        recordLookups: {
          default: "\u{1F50D}"
          // MAGNIFYING GLASS
        },
        recordUpdates: {
          default: "\u{1F6E0}\uFE0F"
          // HAMMER AND WRENCH
        },
        screens: {
          default: "\u{1F4BB}"
          // LAPTOP
        },
        subflows: {
          default: "\u{1F517}"
          // LINK
        },
        transforms: {
          default: "\u267B\uFE0F"
        }
      };
      var ASCII_ICONS = {
        actionCalls: {
          apex: "[A]",
          emailAlert: "[E]",
          emailSimple: "[E]",
          submit: "[!]",
          default: "[!]"
        },
        assignments: {
          default: "[=]"
        },
        collectionProcessors: {
          FilterCollectionProcessor: "[F]",
          SortCollectionProcessor: "[S]",
          default: "[C]"
        },
        customErrors: {
          default: "[X]"
        },
        decisions: {
          default: "[?]"
        },
        loops: {
          default: "[L]"
        },
        recordCreates: {
          default: "[+]"
        },
        recordDeletes: {
          default: "[-]"
        },
        recordLookups: {
          default: "[S]"
        },
        recordUpdates: {
          default: "[U]"
        },
        screens: {
          default: "[#]"
        },
        subflows: {
          default: "[>]"
        },
        transforms: {
          default: "[T]"
        }
      };
      function getDefaultIconConfig() {
        return DEFAULT_ICONS;
      }
    }
  });

  // ../package/main/models/FlowNode.js
  var require_FlowNode = __commonJS({
    "../package/main/models/FlowNode.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowNode", {
        enumerable: true,
        get: function() {
          return FlowNode;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _FlowElement = require_FlowElement();
      var _FlowElementConnector = require_FlowElementConnector();
      var _NodeIcons = require_NodeIcons();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowNode = class FlowNode2 extends _FlowElement.FlowElement {
        /**
        * Set custom icon configuration for all FlowNodes
        * @example
        * ```typescript
        * // Use ASCII icons for old terminals
        * FlowNode.setIconConfig(ASCII_ICONS);
        * 
        * // Or provide custom icons
        * FlowNode.setIconConfig({
        *   actionCalls: { default: '[ACTION]' },
        *   decisions: { default: '[IF]' }
        * });
        * ```
        */
        static setIconConfig(config) {
          FlowNode2.iconConfig = config;
        }
        /**
        * Use ASCII icons instead of emoji (for older browsers/terminals)
        */
        static useAsciiIcons() {
          FlowNode2.iconConfig = _NodeIcons.ASCII_ICONS;
        }
        /**
        * Reset to default emoji icons
        */
        static useDefaultIcons() {
          FlowNode2.iconConfig = _NodeIcons.DEFAULT_ICONS;
        }
        extractTypeSpecificProperties(subtype, element) {
          switch (subtype) {
            case "actionCalls":
              this.actionType = element.actionType;
              this.actionName = element.actionName;
              break;
            case "recordCreates":
            case "recordUpdates":
            case "recordDeletes":
            case "recordLookups":
              this.object = element.object;
              this.inputReference = element.inputReference;
              this.outputReference = element.outputReference;
              break;
            case "collectionProcessors":
              this.elementSubtype = element.elementSubtype;
              this.collectionReference = element.collectionReference;
              break;
            case "subflows":
              this.flowName = element.flowName;
              break;
            case "decisions":
              this.rules = Array.isArray(element.rules) ? element.rules : element.rules ? [
                element.rules
              ] : [];
              this.defaultConnectorLabel = element.defaultConnectorLabel;
              break;
            case "loops":
              this.collectionReference = element.collectionReference;
              this.iterationOrder = element.iterationOrder;
              break;
            case "screens":
              this.fields = Array.isArray(element.fields) ? element.fields : element.fields ? [
                element.fields
              ] : [];
              this.allowPause = element.allowPause;
              this.showFooter = element.showFooter;
              break;
          }
        }
        /**
        * Get a human-readable summary of this node
        */
        getSummary() {
          const parts = [];
          switch (this.subtype) {
            case "actionCalls":
              if (this.actionType) parts.push(this.prettifyValue(this.actionType));
              if (this.actionName) parts.push(this.actionName);
              break;
            case "recordCreates":
            case "recordUpdates":
            case "recordDeletes":
            case "recordLookups":
              if (this.object) parts.push(this.object);
              break;
            case "collectionProcessors":
              if (this.elementSubtype) parts.push(this.prettifyValue(this.elementSubtype));
              break;
            case "decisions":
              var _this_rules, _this_rules1;
              parts.push(`${((_this_rules = this.rules) === null || _this_rules === void 0 ? void 0 : _this_rules.length) || 0} rule${((_this_rules1 = this.rules) === null || _this_rules1 === void 0 ? void 0 : _this_rules1.length) !== 1 ? "s" : ""}`);
              break;
            case "loops":
              if (this.collectionReference) parts.push(`Loop: ${this.collectionReference}`);
              break;
            case "subflows":
              if (this.flowName) parts.push(this.flowName);
              break;
          }
          if (this.description) {
            parts.push(this.description.substring(0, 50) + (this.description.length > 50 ? "..." : ""));
          }
          return parts.join(" \u2022 ");
        }
        /**
        * Get the icon for this node type
        */
        getIcon() {
          const typeIcons = FlowNode2.iconConfig[this.subtype];
          if (!typeIcons) {
            const fallback = FlowNode2.iconConfig["default"];
            return fallback && "default" in fallback ? fallback.default : "\u2022";
          }
          const subtype = this.actionType || this.elementSubtype;
          const icons = typeIcons;
          if (subtype && icons[subtype]) {
            return icons[subtype];
          }
          return icons.default || "\u2022";
        }
        /**
        * Get the display name for this node type
        */
        getTypeLabel() {
          const labelMap = {
            actionCalls: "Action",
            assignments: "Assignment",
            collectionProcessors: "Collection",
            customErrors: "Error",
            decisions: "Decision",
            loops: "Loop",
            recordCreates: "Create",
            recordDeletes: "Delete",
            recordLookups: "Get Records",
            recordUpdates: "Update",
            screens: "Screen",
            subflows: "Subflow",
            transforms: "Transform"
          };
          return labelMap[this.subtype] || this.subtype;
        }
        prettifyValue(value) {
          return value.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
        }
        getConnectors(subtype, element) {
          const connectors = [];
          if (subtype === "start") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (Array.isArray(element.scheduledPaths)) {
              for (const asyncElement of (element === null || element === void 0 ? void 0 : element.scheduledPaths) || []) {
                if (asyncElement.connector) {
                  var _asyncElement_name;
                  connectors.push(new _FlowElementConnector.FlowElementConnector("connector", asyncElement.connector, {
                    childName: (_asyncElement_name = asyncElement === null || asyncElement === void 0 ? void 0 : asyncElement.name) !== null && _asyncElement_name !== void 0 ? _asyncElement_name : "AsyncAfterCommit",
                    childOf: "scheduledPaths"
                  }));
                }
              }
            } else {
              if (element.scheduledPaths) {
                connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.scheduledPaths, {
                  childName: element.scheduledPaths.name,
                  childOf: "scheduledPaths"
                }));
              }
            }
            return connectors;
          } else if (subtype === "decisions") {
            if (element.defaultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("defaultConnector", element.defaultConnector, {}));
            }
            if (element.rules) {
              if (Array.isArray(element.rules)) {
                for (const rule of element.rules) {
                  if (rule.connector) {
                    connectors.push(new _FlowElementConnector.FlowElementConnector("connector", rule.connector, {
                      childName: rule.name,
                      childOf: "rules"
                    }));
                  }
                }
              } else {
                if (element.rules.connector) {
                  connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.rules.connector, {
                    childName: element.rules.name,
                    childOf: "rules"
                  }));
                }
              }
            }
            return connectors;
          } else if (subtype === "assignments" || subtype === "transforms" || subtype === "customErrors") {
            return element.connector ? [
              new _FlowElementConnector.FlowElementConnector("connector", element.connector, {})
            ] : [];
          } else if (subtype === "loops") {
            if (element.nextValueConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("nextValueConnector", element.nextValueConnector, {}));
            }
            if (element.noMoreValuesConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("noMoreValuesConnector", element.noMoreValuesConnector, {}));
            }
            return connectors;
          } else if (subtype === "actionCalls") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            return connectors;
          } else if (subtype === "waits") {
            if (element.defaultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("defaultConnector", element.defaultConnector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            if (Array.isArray(element.waitEvents)) {
              for (const waitEvent of element.waitEvents) {
                if (waitEvent.connector) {
                  connectors.push(new _FlowElementConnector.FlowElementConnector("connector", waitEvent.connector, {
                    childName: waitEvent.name,
                    childOf: "waitEvents"
                  }));
                }
              }
            }
            return connectors;
          } else if (subtype === "recordCreates") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            return connectors;
          } else if (subtype === "recordDeletes") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            return connectors;
          } else if (subtype === "recordLookups") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            return connectors;
          } else if (subtype === "recordUpdates") {
            if (element.connector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("connector", element.connector, {}));
            }
            if (element.faultConnector) {
              connectors.push(new _FlowElementConnector.FlowElementConnector("faultConnector", element.faultConnector, {}));
            }
            return connectors;
          } else if (subtype === "subflows") {
            return element.connector ? [
              new _FlowElementConnector.FlowElementConnector("connector", element.connector, {})
            ] : [];
          } else if (subtype === "screens") {
            return element.connector ? [
              new _FlowElementConnector.FlowElementConnector("connector", element.connector, {})
            ] : [];
          } else {
            return element.connector ? [
              new _FlowElementConnector.FlowElementConnector("connector", element.connector, {})
            ] : [];
          }
        }
        constructor(provName, subtype, element) {
          const nodeName = subtype === "start" ? "flowstart" : provName;
          super(_MetadataTypes.MetaType.NODE, subtype, nodeName, element), _define_property(this, "connectors", []), _define_property(this, "locationX", void 0), _define_property(this, "locationY", void 0), // Common properties across node types
          _define_property(this, "label", void 0), _define_property(this, "description", void 0), // Action-specific properties
          _define_property(this, "actionType", void 0), _define_property(this, "actionName", void 0), // Record operation properties
          _define_property(this, "object", void 0), _define_property(this, "inputReference", void 0), _define_property(this, "outputReference", void 0), // Collection processor properties
          _define_property(this, "elementSubtype", void 0), _define_property(this, "collectionReference", void 0), // Subflow properties
          _define_property(this, "flowName", void 0), // Decision properties
          _define_property(this, "rules", void 0), _define_property(this, "defaultConnectorLabel", void 0), // Loop properties
          _define_property(this, "iterationOrder", void 0), // Screen properties
          _define_property(this, "fields", void 0), _define_property(this, "allowPause", void 0), _define_property(this, "showFooter", void 0), // Fault handling
          _define_property(this, "faultConnector", void 0);
          this.label = element["label"];
          this.description = element["description"];
          this.locationX = element["locationX"];
          this.locationY = element["locationY"];
          this.extractTypeSpecificProperties(subtype, element);
          this.connectors = this.getConnectors(subtype, element);
          this.faultConnector = this.connectors.find((c) => c.type === "faultConnector");
        }
      };
      _define_property(FlowNode, "iconConfig", _NodeIcons.DEFAULT_ICONS);
    }
  });

  // ../package/main/models/FlowResource.js
  var require_FlowResource = __commonJS({
    "../package/main/models/FlowResource.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowResource", {
        enumerable: true,
        get: function() {
          return FlowResource;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _FlowElement = require_FlowElement();
      var FlowResource = class FlowResource extends _FlowElement.FlowElement {
        constructor(name, subtype, element) {
          super(_MetadataTypes.MetaType.RESOURCE, subtype, name, element);
        }
      };
    }
  });

  // ../package/main/config/VariableIcons.js
  var require_VariableIcons = __commonJS({
    "../package/main/config/VariableIcons.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get ASCII_VARIABLE_ICONS() {
          return ASCII_VARIABLE_ICONS;
        },
        get DEFAULT_VARIABLE_ICONS() {
          return DEFAULT_VARIABLE_ICONS;
        },
        get getDefaultVariableIconConfig() {
          return getDefaultVariableIconConfig;
        }
      });
      var DEFAULT_VARIABLE_ICONS = {
        subtypes: {
          variables: "\u{1F4CA}",
          constants: "\u{1F512}",
          formulas: "\u{1F9EE}",
          choices: "\u{1F4CB}",
          dynamicChoiceSets: "\u{1F504}"
        },
        boolean: {
          true: "\u2705",
          false: "\u2B1C"
        }
      };
      var ASCII_VARIABLE_ICONS = {
        subtypes: {
          variables: "[V]",
          constants: "[C]",
          formulas: "[F]",
          choices: "[CH]",
          dynamicChoiceSets: "[D]"
        },
        boolean: {
          true: "[X]",
          false: "[ ]"
        }
      };
      function getDefaultVariableIconConfig() {
        return DEFAULT_VARIABLE_ICONS;
      }
    }
  });

  // ../package/main/models/FlowVariable.js
  var require_FlowVariable = __commonJS({
    "../package/main/models/FlowVariable.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowVariable", {
        enumerable: true,
        get: function() {
          return FlowVariable;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _FlowElement = require_FlowElement();
      var _VariableIcons = require_VariableIcons();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowVariable = class FlowVariable2 extends _FlowElement.FlowElement {
        /**
        * Set custom icon configuration for all FlowVariables
        * @example
        * ```typescript
        * // Use ASCII icons
        * FlowVariable.setIconConfig(ASCII_VARIABLE_ICONS);
        * 
        * // Or provide custom icons
        * FlowVariable.setIconConfig({
        *   subtypes: {
        *     variables: '[VAR]',
        *     constants: '[CONST]'
        *   },
        *   boolean: {
        *     true: '[YES]',
        *     false: '[NO]'
        *   }
        * });
        * ```
        */
        static setIconConfig(config) {
          FlowVariable2.iconConfig = config;
        }
        /**
        * Use ASCII icons instead of emoji
        */
        static useAsciiIcons() {
          FlowVariable2.iconConfig = _VariableIcons.ASCII_VARIABLE_ICONS;
        }
        /**
        * Reset to default emoji icons
        */
        static useDefaultIcons() {
          FlowVariable2.iconConfig = _VariableIcons.DEFAULT_VARIABLE_ICONS;
        }
        /**
        * Get the icon for this variable subtype
        */
        getIcon() {
          return FlowVariable2.iconConfig.subtypes[this.subtype] || "\u{1F4CA}";
        }
        /**
        * Get icon for a boolean value
        */
        getBooleanIcon(value) {
          if (value === true) {
            return FlowVariable2.iconConfig.boolean.true;
          } else if (value === false) {
            return FlowVariable2.iconConfig.boolean.false;
          }
          return "";
        }
        /**
        * Get a human-readable type label
        */
        getTypeLabel() {
          const labelMap = {
            variables: "Variable",
            constants: "Constant",
            formulas: "Formula",
            choices: "Choice",
            dynamicChoiceSets: "Dynamic Choice"
          };
          return labelMap[this.subtype] || this.subtype;
        }
        /**
        * Get a markdown table row for this variable
        */
        toTableRow() {
          const parts = [
            this.name,
            this.dataType || "",
            this.getBooleanIcon(this.isCollection),
            this.getBooleanIcon(this.isInput),
            this.getBooleanIcon(this.isOutput),
            this.objectType || "",
            this.description || ""
          ];
          return `| ${parts.join(" | ")} |`;
        }
        /**
        * Get a detailed markdown table for this variable
        */
        toMarkdownTable() {
          let table = "| Property | Value |\n|:---|:---|\n";
          table += `| Name | ${this.name} |
`;
          table += `| Type | ${this.getIcon()} ${this.getTypeLabel()} |
`;
          if (this.dataType) table += `| Data Type | ${this.dataType} |
`;
          if (this.objectType) table += `| Object Type | ${this.objectType} |
`;
          if (this.isCollection !== void 0) {
            table += `| Collection | ${this.getBooleanIcon(this.isCollection)} |
`;
          }
          if (this.isInput !== void 0) {
            table += `| Input | ${this.getBooleanIcon(this.isInput)} |
`;
          }
          if (this.isOutput !== void 0) {
            table += `| Output | ${this.getBooleanIcon(this.isOutput)} |
`;
          }
          if (this.value !== void 0) {
            table += `| Value | ${this.formatValue(this.value)} |
`;
          }
          if (this.description) table += `| Description | ${this.description} |
`;
          return table;
        }
        formatValue(value) {
          if (typeof value === "object") {
            return JSON.stringify(value, null, 2);
          }
          return String(value);
        }
        constructor(name, subtype, element) {
          super(_MetadataTypes.MetaType.VARIABLE, subtype, name, element), _define_property(this, "dataType", void 0), _define_property(this, "isCollection", void 0), _define_property(this, "isInput", void 0), _define_property(this, "isOutput", void 0), _define_property(this, "objectType", void 0), _define_property(this, "description", void 0), _define_property(this, "value", void 0);
          this.dataType = element["dataType"];
          this.isCollection = element["isCollection"];
          this.isInput = element["isInput"];
          this.isOutput = element["isOutput"];
          this.objectType = element["objectType"];
          this.description = element["description"];
          if (subtype === "constants") {
            this.value = element["value"];
          } else if (subtype === "formulas") {
            this.value = element["expression"];
          }
        }
      };
      _define_property(FlowVariable, "iconConfig", _VariableIcons.DEFAULT_VARIABLE_ICONS);
    }
  });

  // ../package/main/models/FlowGraph.js
  var require_FlowGraph = __commonJS({
    "../package/main/models/FlowGraph.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowGraph", {
        enumerable: true,
        get: function() {
          return FlowGraph;
        }
      });
      var _Compiler = require_Compiler();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowGraph = class FlowGraph {
        /**
        * Add START node connectors to the connector maps (for flows with explicit <start> element)
        */
        addStartNodeConnectors(startNode) {
          const startName = "START";
          this.faultConnectors.set(startName, /* @__PURE__ */ new Set());
          this.normalConnectors.set(startName, /* @__PURE__ */ new Set());
          this.allConnectors.set(startName, /* @__PURE__ */ new Set());
          if (!startNode.connectors || startNode.connectors.length === 0) return;
          for (const connector of startNode.connectors) {
            var _connector_connectorTargetReference, _this_normalConnectors_get, _this_allConnectors_get, _this_reverseConnectors_get;
            var _connector_connectorTargetReference_targetReference;
            const targetRef = (_connector_connectorTargetReference_targetReference = (_connector_connectorTargetReference = connector.connectorTargetReference) === null || _connector_connectorTargetReference === void 0 ? void 0 : _connector_connectorTargetReference.targetReference) !== null && _connector_connectorTargetReference_targetReference !== void 0 ? _connector_connectorTargetReference_targetReference : connector.reference;
            if (!targetRef) continue;
            (_this_normalConnectors_get = this.normalConnectors.get(startName)) === null || _this_normalConnectors_get === void 0 ? void 0 : _this_normalConnectors_get.add(targetRef);
            (_this_allConnectors_get = this.allConnectors.get(startName)) === null || _this_allConnectors_get === void 0 ? void 0 : _this_allConnectors_get.add(targetRef);
            if (!this.reverseConnectors.has(targetRef)) {
              this.reverseConnectors.set(targetRef, /* @__PURE__ */ new Set());
            }
            (_this_reverseConnectors_get = this.reverseConnectors.get(targetRef)) === null || _this_reverseConnectors_get === void 0 ? void 0 : _this_reverseConnectors_get.add(startName);
          }
        }
        /**
        * Add START edge for newer flows that use startElementReference (no explicit <start> node)
        */
        addStartEdgeFromReference(startReference) {
          var _this_normalConnectors_get, _this_allConnectors_get, _this_reverseConnectors_get;
          const startName = "START";
          this.faultConnectors.set(startName, /* @__PURE__ */ new Set());
          this.normalConnectors.set(startName, /* @__PURE__ */ new Set());
          this.allConnectors.set(startName, /* @__PURE__ */ new Set());
          (_this_normalConnectors_get = this.normalConnectors.get(startName)) === null || _this_normalConnectors_get === void 0 ? void 0 : _this_normalConnectors_get.add(startReference);
          (_this_allConnectors_get = this.allConnectors.get(startName)) === null || _this_allConnectors_get === void 0 ? void 0 : _this_allConnectors_get.add(startReference);
          if (!this.reverseConnectors.has(startReference)) {
            this.reverseConnectors.set(startReference, /* @__PURE__ */ new Set());
          }
          (_this_reverseConnectors_get = this.reverseConnectors.get(startReference)) === null || _this_reverseConnectors_get === void 0 ? void 0 : _this_reverseConnectors_get.add(startName);
        }
        /**
        * Build node map for O(1) lookups
        */
        buildNodeMaps(nodes) {
          for (const node of nodes) {
            this.nodeMap.set(node.name, node);
          }
        }
        /**
        * Build connector maps by inspecting node connectors
        */
        buildConnectorMaps(nodes) {
          for (const node of nodes) {
            this.faultConnectors.set(node.name, /* @__PURE__ */ new Set());
            this.normalConnectors.set(node.name, /* @__PURE__ */ new Set());
            this.allConnectors.set(node.name, /* @__PURE__ */ new Set());
            if (!node.connectors || node.connectors.length === 0) continue;
            for (const connector of node.connectors) {
              var _connector_connectorTargetReference, _this_allConnectors_get, _this_reverseConnectors_get;
              var _connector_connectorTargetReference_targetReference;
              const targetRef = (_connector_connectorTargetReference_targetReference = (_connector_connectorTargetReference = connector.connectorTargetReference) === null || _connector_connectorTargetReference === void 0 ? void 0 : _connector_connectorTargetReference.targetReference) !== null && _connector_connectorTargetReference_targetReference !== void 0 ? _connector_connectorTargetReference_targetReference : connector.reference;
              if (!targetRef) continue;
              if (connector.type === "faultConnector") {
                var _this_faultConnectors_get;
                (_this_faultConnectors_get = this.faultConnectors.get(node.name)) === null || _this_faultConnectors_get === void 0 ? void 0 : _this_faultConnectors_get.add(targetRef);
              } else {
                var _this_normalConnectors_get;
                (_this_normalConnectors_get = this.normalConnectors.get(node.name)) === null || _this_normalConnectors_get === void 0 ? void 0 : _this_normalConnectors_get.add(targetRef);
              }
              (_this_allConnectors_get = this.allConnectors.get(node.name)) === null || _this_allConnectors_get === void 0 ? void 0 : _this_allConnectors_get.add(targetRef);
              if (!this.reverseConnectors.has(targetRef)) {
                this.reverseConnectors.set(targetRef, /* @__PURE__ */ new Set());
              }
              (_this_reverseConnectors_get = this.reverseConnectors.get(targetRef)) === null || _this_reverseConnectors_get === void 0 ? void 0 : _this_reverseConnectors_get.add(node.name);
            }
          }
        }
        /**
        * Use Compiler to compute which elements are reachable from start.
        * This reuses the existing IDDFS traversal logic!
        */
        computeReachability(startReference) {
          const compiler = new _Compiler.Compiler();
          compiler.traverseFlow(startReference, (element) => {
            this.reachableFromStart.add(element.name);
          }, this.nodeMap, this.allConnectors);
        }
        /**
        * Compute which elements are reachable from start using ONLY normal connectors (not fault connectors).
        * Elements that are reachable overall but NOT reachable via normal connectors are part of fault handling.
        */
        computeNormalReachability(startReference) {
          const compiler = new _Compiler.Compiler();
          compiler.traverseFlow(startReference, (element) => {
            this.normalReachableFromStart.add(element.name);
          }, this.nodeMap, this.normalConnectors);
        }
        /**
        * Use Compiler to compute which elements are inside loops.
        * Calls Compiler.traverseFlow() for each loop with endElementName.
        */
        computeLoopBoundaries() {
          const loopNodes = Array.from(this.nodeMap.values()).filter((n) => n.subtype === "loops");
          for (const loopNode of loopNodes) {
            var _loopNode_element_noMoreValuesConnector, _loopNode_element;
            var _loopNode_element_noMoreValuesConnector_targetReference;
            const loopEnd = (_loopNode_element_noMoreValuesConnector_targetReference = (_loopNode_element = loopNode.element) === null || _loopNode_element === void 0 ? void 0 : (_loopNode_element_noMoreValuesConnector = _loopNode_element.noMoreValuesConnector) === null || _loopNode_element_noMoreValuesConnector === void 0 ? void 0 : _loopNode_element_noMoreValuesConnector.targetReference) !== null && _loopNode_element_noMoreValuesConnector_targetReference !== void 0 ? _loopNode_element_noMoreValuesConnector_targetReference : loopNode.name;
            const compiler = new _Compiler.Compiler();
            compiler.traverseFlow(loopNode.name, (element) => {
              this.elementsInLoop.set(element.name, loopNode.name);
            }, this.nodeMap, this.allConnectors, loopEnd);
          }
        }
        // ========== PUBLIC QUERY API ==========
        isReachable(elementName) {
          return this.reachableFromStart.has(elementName);
        }
        getReachableElements() {
          return new Set(this.reachableFromStart);
        }
        isInLoop(elementName) {
          return this.elementsInLoop.has(elementName);
        }
        getContainingLoop(elementName) {
          return this.elementsInLoop.get(elementName);
        }
        getLoopElements(loopName) {
          const result = /* @__PURE__ */ new Set();
          for (const [element, loop] of this.elementsInLoop) {
            if (loop === loopName) {
              result.add(element);
            }
          }
          return result;
        }
        hasFaultConnector(elementName) {
          const faults = this.faultConnectors.get(elementName);
          return faults ? faults.size > 0 : false;
        }
        getFaultTargets(elementName) {
          return Array.from(this.faultConnectors.get(elementName) || []);
        }
        getNextElements(elementName) {
          return Array.from(this.normalConnectors.get(elementName) || []);
        }
        getAllNextElements(elementName) {
          return Array.from(this.allConnectors.get(elementName) || []);
        }
        getPreviousElements(elementName) {
          return Array.from(this.reverseConnectors.get(elementName) || []);
        }
        getNode(elementName) {
          return this.nodeMap.get(elementName);
        }
        /**
        * Check if an element is part of fault handling flow.
        * An element is part of fault handling if it's only reachable through fault paths
        * (i.e., reachable overall but NOT reachable via normal connectors from START).
        */
        isPartOfFaultHandling(elementName) {
          return this.reachableFromStart.has(elementName) && !this.normalReachableFromStart.has(elementName);
        }
        getLoopNodes() {
          return Array.from(this.nodeMap.values()).filter((n) => n.subtype === "loops");
        }
        forEachReachable(callback) {
          for (const elementName of this.reachableFromStart) {
            const node = this.nodeMap.get(elementName);
            if (node) {
              callback(node);
            }
          }
        }
        /**
        * Export the graph to Mermaid flowchart syntax with rich documentation.
        */
        toMermaid(options = {}) {
          let output = "";
          const diagram = this.generateMermaidDiagram(options);
          if (options.includeMarkdownDocs) {
            output = this.generateFullMarkdownDoc(diagram, options);
          } else {
            output = `\`\`\`mermaid
${diagram}
\`\`\``;
          }
          return output;
        }
        generateMermaidDiagram(options) {
          let mermaid = "flowchart TB\n";
          mermaid += this.generateStartNode(options.flowMetadata) + "\n\n";
          for (const [name, node] of this.nodeMap) {
            const icon = node.getIcon();
            const typeLabel = node.getTypeLabel();
            const summary = options.includeDetails ? node.getSummary() : "";
            let label = `${icon} <em>${typeLabel}</em><br/>${node.label || node.name}`;
            if (summary) {
              label += `<br/><small>${summary}</small>`;
            }
            const shape = this.getNodeShape(node.subtype);
            mermaid += `  ${name}${shape[0]}"${label}"${shape[1]}:::${node.subtype}
`;
          }
          mermaid += "\n";
          mermaid += this.generateEdges() + "\n";
          mermaid += this.generateLoopSubgraphs() + "\n";
          mermaid += this.generateMermaidStyles();
          return mermaid;
        }
        generateStartNode(flowMetadata) {
          if (!flowMetadata) {
            return 'START(["\u{1F680} <b>START</b>"]):::startClass';
          }
          let label = "\u{1F680} <b>START</b>";
          if (flowMetadata.processType === "Flow") {
            label += "<br/><b>Screen Flow</b>";
          } else if (flowMetadata.processType === "AutoLaunchedFlow") {
            label += "<br/><b>AutoLaunched Flow</b>";
            if (flowMetadata.triggerType) {
              label += `<br/>Type: <b>${this.prettifyValue(flowMetadata.triggerType)}</b>`;
            }
          } else if (flowMetadata.object) {
            label += `<br/><b>${flowMetadata.object}</b>`;
            if (flowMetadata.triggerType) {
              label += `<br/>Type: <b>${this.prettifyValue(flowMetadata.triggerType)}</b>`;
            }
          }
          if (flowMetadata.status) {
            const statusIcon = flowMetadata.status === "Active" ? "\u2705" : "\u26A0\uFE0F";
            label += `<br/>${statusIcon} ${flowMetadata.status}`;
          }
          return `START(["${label}"]):::startClass`;
        }
        getNodeShape(subtype) {
          const shapeMap = {
            decisions: [
              "{",
              "}"
            ],
            loops: [
              "{{",
              "}}"
            ],
            collectionProcessors: [
              "{{",
              "}}"
            ],
            transforms: [
              "{{",
              "}}"
            ],
            screens: [
              "([",
              "])"
            ],
            recordCreates: [
              "[(",
              ")]"
            ],
            recordDeletes: [
              "[(",
              ")]"
            ],
            recordLookups: [
              "[(",
              ")]"
            ],
            recordUpdates: [
              "[(",
              ")]"
            ],
            subflows: [
              "[[",
              "]]"
            ],
            assignments: [
              "[\\",
              "/]"
            ],
            default: [
              "(",
              ")"
            ]
          };
          return shapeMap[subtype] || shapeMap.default;
        }
        generateEdges() {
          let edges = "";
          for (const [from, targets] of this.allConnectors) {
            for (const to of targets) {
              edges += `  ${from} --> ${to}
`;
            }
          }
          for (const [from, faults] of this.faultConnectors) {
            for (const to of faults) {
              edges += `  ${from} -. Fault .-> ${to}
`;
            }
          }
          const endNodes = this.findEndNodes();
          for (const endNode of endNodes) {
            edges += `  ${endNode}(( END )):::endClass
`;
          }
          return edges;
        }
        findEndNodes() {
          const endNodes = /* @__PURE__ */ new Set();
          for (const [from, targets] of this.allConnectors) {
            for (const to of targets) {
              if (!this.nodeMap.has(to)) {
                endNodes.add(to);
              }
            }
          }
          return endNodes;
        }
        generateLoopSubgraphs() {
          let subgraphs = "";
          for (const loopNode of this.getLoopNodes()) {
            const loopElems = this.getLoopElements(loopNode.name);
            if (loopElems.size > 0) {
              subgraphs += `  subgraph "${loopNode.label || loopNode.name} Loop"
`;
              for (const elem of loopElems) {
                subgraphs += `    ${elem}
`;
              }
              subgraphs += "  end\n";
            }
          }
          return subgraphs;
        }
        generateMermaidStyles() {
          const styles = {
            actionCalls: {
              fill: "#D4E4FC",
              color: "black"
            },
            assignments: {
              fill: "#FBEED7",
              color: "black"
            },
            collectionProcessors: {
              fill: "#F0E3FA",
              color: "black"
            },
            customErrors: {
              fill: "#FFE9E9",
              color: "black"
            },
            decisions: {
              fill: "#FDEAF6",
              color: "black"
            },
            loops: {
              fill: "#FDEAF6",
              color: "black"
            },
            recordCreates: {
              fill: "#FFF8C9",
              color: "black"
            },
            recordDeletes: {
              fill: "#FFF8C9",
              color: "black"
            },
            recordLookups: {
              fill: "#EDEAFF",
              color: "black"
            },
            recordUpdates: {
              fill: "#FFF8C9",
              color: "black"
            },
            screens: {
              fill: "#DFF6FF",
              color: "black"
            },
            subflows: {
              fill: "#D4E4FC",
              color: "black"
            },
            transforms: {
              fill: "#FDEAF6",
              color: "black"
            },
            startClass: {
              fill: "#D9F2E6",
              color: "black"
            },
            endClass: {
              fill: "#F9BABA",
              color: "black"
            }
          };
          let styleStr = "";
          for (const [className, style] of Object.entries(styles)) {
            styleStr += `  classDef ${className} fill:${style.fill},color:${style.color},stroke:#333,stroke-width:2px
`;
          }
          return styleStr;
        }
        generateNodeDetailsMarkdown(collapsed) {
          let md = "## Flow Nodes Details\n\n";
          if (collapsed) {
            md += "<details><summary>NODE DETAILS (expand to view)</summary>\n\n";
          }
          for (const [name, node] of this.nodeMap) {
            md += `### ${name}

`;
            md += this.nodeToMarkdownTable(node);
            md += "\n";
          }
          if (collapsed) {
            md += "</details>\n\n";
          }
          return md;
        }
        nodeToMarkdownTable(node) {
          let table = "| Property | Value |\n|:---|:---|\n";
          if (node.label) table += `| Label | ${node.label} |
`;
          table += `| Type | ${node.getTypeLabel()} |
`;
          if (node.actionType) table += `| Action Type | ${this.prettifyValue(node.actionType)} |
`;
          if (node.actionName) table += `| Action Name | ${node.actionName} |
`;
          if (node.object) table += `| Object | ${node.object} |
`;
          if (node.flowName) table += `| Subflow | ${node.flowName} |
`;
          if (node.collectionReference) table += `| Collection | ${node.collectionReference} |
`;
          if (node.elementSubtype) table += `| Subtype | ${this.prettifyValue(node.elementSubtype)} |
`;
          if (node.rules && node.rules.length > 0) {
            table += `| Rules | ${node.rules.length} |
`;
            for (const rule of node.rules) {
              const conditions = Array.isArray(rule.conditions) ? rule.conditions : rule.conditions ? [
                rule.conditions
              ] : [];
              table += `| \u21B3 ${rule.label || rule.name} | ${conditions.length} condition(s) |
`;
            }
          }
          if (node.fields && node.fields.length > 0) {
            table += `| Fields | ${node.fields.length} |
`;
          }
          if (node.description) table += `| Description | ${node.description} |
`;
          if (node.faultConnector) table += `| Has Fault Handler | \u2705 |
`;
          return table;
        }
        prettifyValue(value) {
          return value.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
        }
        /**
        * Generate full markdown documentation with diagram and node details
        */
        generateFullMarkdownDoc(diagram, options) {
          let md = "";
          md += "## Flow Diagram\n\n";
          md += "```mermaid\n";
          md += diagram;
          md += "\n```\n\n";
          if (options.includeDetails) {
            md += this.generateNodeDetailsMarkdown(options.collapsedDetails);
          }
          return md;
        }
        /**
        * Export the graph to PlantUML syntax for UML-style diagrams.
        * @returns PlantUML string.
        */
        toPlantUML() {
          let plantuml = "@startuml\nskinparam activityBackgroundColor #D4E4FC\n";
          for (const [name, node] of this.nodeMap) {
            plantuml += `activity "${node.subtype}: ${name}" as ${name}
`;
          }
          for (const [from, targets] of this.allConnectors) {
            for (const to of targets) {
              plantuml += `${from} --> ${to}
`;
            }
          }
          for (const loopNode of this.getLoopNodes()) {
            plantuml += `partition "${loopNode.name} Loop" {
`;
            const loopElems = this.getLoopElements(loopNode.name);
            for (const elem of loopElems) {
              plantuml += `  ${elem}
`;
            }
            plantuml += "}\n";
          }
          plantuml += "@enduml";
          return plantuml;
        }
        constructor(nodes, startReference, startNode) {
          _define_property(this, "nodeMap", /* @__PURE__ */ new Map());
          _define_property(this, "reachableFromStart", /* @__PURE__ */ new Set());
          _define_property(this, "normalReachableFromStart", /* @__PURE__ */ new Set());
          _define_property(this, "elementsInLoop", /* @__PURE__ */ new Map());
          _define_property(this, "faultConnectors", /* @__PURE__ */ new Map());
          _define_property(this, "normalConnectors", /* @__PURE__ */ new Map());
          _define_property(this, "allConnectors", /* @__PURE__ */ new Map());
          _define_property(this, "reverseConnectors", /* @__PURE__ */ new Map());
          this.buildNodeMaps(nodes);
          this.buildConnectorMaps(nodes);
          if (startNode) {
            this.addStartNodeConnectors(startNode);
          } else if (startReference) {
            this.addStartEdgeFromReference(startReference);
          }
          this.computeLoopBoundaries();
          if (startReference) {
            this.computeReachability(startReference);
            this.computeNormalReachability(startReference);
          }
        }
      };
    }
  });

  // ../package/main/models/Flow.js
  var require_Flow = __commonJS({
    "../package/main/models/Flow.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "Flow", {
        enumerable: true,
        get: function() {
          return Flow2;
        }
      });
      var _fastxmlparser = require_fxp();
      var _path = /* @__PURE__ */ _interop_require_wildcard((init_path_shim(), __toCommonJS(path_shim_exports)));
      var _FlowMetadata = require_FlowMetadata();
      var _FlowNode = require_FlowNode();
      var _FlowResource = require_FlowResource();
      var _FlowVariable = require_FlowVariable();
      var _FlowGraph = require_FlowGraph();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      function _object_spread(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};
          var ownKeys2 = Object.keys(source);
          if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys2 = ownKeys2.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
              return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
          }
          ownKeys2.forEach(function(key) {
            _define_property(target, key, source[key]);
          });
        }
        return target;
      }
      function ownKeys(object, enumerableOnly) {
        var keys = Object.keys(object);
        if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(object);
          if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
              return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
          }
          keys.push.apply(keys, symbols);
        }
        return keys;
      }
      function _object_spread_props(target, source) {
        source = source != null ? source : {};
        if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
        return target;
      }
      var Flow2 = class Flow3 {
        get graph() {
          if (!this._graph) {
            const flowNodes = this.elements.filter((e) => e instanceof _FlowNode.FlowNode);
            this.startReference || (this.startReference = this.findStart());
            this._graph = new _FlowGraph.FlowGraph(flowNodes, this.startReference, this.startNode);
          }
          return this._graph;
        }
        static from(obj) {
          if (obj instanceof Flow3) {
            return obj;
          }
          const flow = Object.create(Flow3.prototype);
          Object.assign(flow, obj);
          if (!flow.toXMLString) {
            flow.toXMLString = () => "";
          }
          return flow;
        }
        preProcessNodes() {
          if (!this.xmldata) {
            return;
          }
          this.label = this.xmldata.label || "";
          this.interviewLabel = this.xmldata.interviewLabel;
          this.processType = this.xmldata.processType || "AutoLaunchedFlow";
          this.type = this.processType;
          this.processMetadataValues = this.xmldata.processMetadataValues;
          this.startElementReference = this.xmldata.startElementReference;
          this.status = this.xmldata.status || "Draft";
          this.triggerOrder = this.xmldata.triggerOrder;
          const allNodes = [];
          for (const nodeType in this.xmldata) {
            if (nodeType.startsWith("@_") || nodeType === "@xmlns") {
              continue;
            }
            const data = this.xmldata[nodeType];
            if (nodeType === "start") {
              if (Array.isArray(data) && data.length > 0) {
                this.startNode = new _FlowNode.FlowNode(data[0].name || "start", "start", data[0]);
              } else if (!Array.isArray(data)) {
                this.startNode = new _FlowNode.FlowNode(data.name || "start", "start", data);
              }
              continue;
            }
            if (Flow3.ATTRIBUTE_TAGS.includes(nodeType)) {
              this.processNodeType(data, nodeType, allNodes, _FlowMetadata.FlowMetadata);
            } else if (Flow3.VARIABLE_TAGS.includes(nodeType)) {
              this.processNodeType(data, nodeType, allNodes, _FlowVariable.FlowVariable);
            } else if (Flow3.NODE_TAGS.includes(nodeType)) {
              this.processNodeType(data, nodeType, allNodes, _FlowNode.FlowNode);
            } else if (Flow3.RESOURCE_TAGS.includes(nodeType)) {
              this.processNodeType(data, nodeType, allNodes, _FlowResource.FlowResource);
            }
          }
          this.elements = allNodes;
          this.startReference = this.findStart();
          const flowNodes = allNodes.filter((e) => e instanceof _FlowNode.FlowNode);
          this._graph = new _FlowGraph.FlowGraph(flowNodes, this.startReference, this.startNode);
        }
        visualize(format = "mermaid", options = {}) {
          if (format === "mermaid") {
            var _this_xmldata, _this_startNode_element, _this_startNode, _this_startNode_element1, _this_startNode1;
            return this.graph.toMermaid(_object_spread_props(_object_spread({}, options), {
              flowMetadata: {
                label: this.label,
                processType: this.processType,
                status: this.status,
                description: (_this_xmldata = this.xmldata) === null || _this_xmldata === void 0 ? void 0 : _this_xmldata.description,
                triggerType: (_this_startNode = this.startNode) === null || _this_startNode === void 0 ? void 0 : (_this_startNode_element = _this_startNode.element) === null || _this_startNode_element === void 0 ? void 0 : _this_startNode_element["triggerType"],
                object: (_this_startNode1 = this.startNode) === null || _this_startNode1 === void 0 ? void 0 : (_this_startNode_element1 = _this_startNode1.element) === null || _this_startNode_element1 === void 0 ? void 0 : _this_startNode_element1["object"]
              }
            }));
          } else if (format === "plantuml") {
            return this.graph.toPlantUML();
          }
          throw new Error("Unsupported format");
        }
        processNodeType(data, nodeType, allNodes, NodeClass) {
          if (Array.isArray(data)) {
            for (const node of data) {
              allNodes.push(new NodeClass(node.name, nodeType, node));
            }
          } else {
            allNodes.push(new NodeClass(data.name, nodeType, data));
          }
        }
        /**
        * Find the name of the first element to execute.
        * Priority order:
        * 1. startElementReference (newer flows, direct XML attribute)
        * 2. Start node connector (older flows, points to first element)
        * 3. Start node scheduledPaths (async flows)
        */
        findStart() {
          var _this_startNode;
          if (this.startElementReference) {
            return this.startElementReference;
          }
          if (this.startNode && this.startNode.connectors && this.startNode.connectors.length > 0) {
            const connector = this.startNode.connectors[0];
            if (connector.reference) {
              return connector.reference;
            }
          }
          if ((_this_startNode = this.startNode) === null || _this_startNode === void 0 ? void 0 : _this_startNode.element) {
            const scheduledPaths = this.startNode.element["scheduledPaths"];
            if (scheduledPaths) {
              var _paths_;
              const paths = Array.isArray(scheduledPaths) ? scheduledPaths : [
                scheduledPaths
              ];
              if (paths.length > 0 && ((_paths_ = paths[0]) === null || _paths_ === void 0 ? void 0 : _paths_.connector)) {
                const targetRef = paths[0].connector.targetReference;
                if (targetRef) {
                  return targetRef;
                }
              }
            }
          }
          return "";
        }
        toXMLString() {
          try {
            return this.generateDoc();
          } catch (exception) {
            const errorMsg = exception instanceof Error ? exception.message : String(exception);
            console.warn(`Unable to write xml, caught an error: ${errorMsg}`);
            return "";
          }
        }
        generateDoc() {
          const flowXmlNamespace = "http://soap.sforce.com/2006/04/metadata";
          const builderOptions = {
            attributeNamePrefix: "@_",
            format: true,
            ignoreAttributes: false,
            suppressBooleanAttributes: false,
            suppressEmptyNode: false
          };
          const builder = new _fastxmlparser.XMLBuilder(builderOptions);
          const xmldataWithNs = _object_spread({}, this.xmldata);
          if (!xmldataWithNs["@_xmlns"]) {
            xmldataWithNs["@_xmlns"] = flowXmlNamespace;
          }
          if (!xmldataWithNs["@_xmlns:xsi"] && this.hasXsiAttributes(xmldataWithNs)) {
            xmldataWithNs["@_xmlns:xsi"] = "http://www.w3.org/2001/XMLSchema-instance";
          }
          const rootObj = {
            Flow: xmldataWithNs
          };
          const xmlContent = builder.build(rootObj);
          const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
          if (!xmlContent.startsWith("<?xml")) {
            return xmlDeclaration + xmlContent;
          }
          return xmlContent;
        }
        hasXsiAttributes(obj) {
          if (obj === null || obj === void 0) {
            return false;
          }
          if (typeof obj !== "object") {
            return false;
          }
          for (const key of Object.keys(obj)) {
            if (key.includes(":xsi") || key.includes("xsi:")) {
              return true;
            }
            if (this.hasXsiAttributes(obj[key])) {
              return true;
            }
          }
          return false;
        }
        constructor(path, data) {
          _define_property(this, "elements", []);
          _define_property(this, "fsPath", void 0);
          _define_property(this, "uri", void 0);
          _define_property(this, "label", "");
          _define_property(this, "interviewLabel", void 0);
          _define_property(this, "name", "unnamed");
          _define_property(this, "processMetadataValues", void 0);
          _define_property(this, "processType", "AutoLaunchedFlow");
          _define_property(this, "type", "");
          _define_property(this, "status", "");
          _define_property(this, "triggerOrder", void 0);
          _define_property(this, "start", void 0);
          _define_property(this, "startElementReference", void 0);
          _define_property(this, "startReference", void 0);
          _define_property(this, "startNode", void 0);
          _define_property(this, "_graph", void 0);
          _define_property(this, "root", void 0);
          _define_property(this, "xmldata", void 0);
          if (path) {
            this.uri = path;
            if (typeof process !== "undefined" && typeof process.cwd === "function") {
              this.fsPath = _path.resolve(path);
            }
            let flowName = _path.basename(_path.basename(path), _path.extname(path));
            if (flowName.includes(".")) {
              flowName = flowName.split(".")[0];
            }
            this.name = flowName || "unnamed";
          }
          if (data) {
            const hasFlowElement = typeof data === "object" && data !== null && "Flow" in data;
            if (hasFlowElement) {
              this.xmldata = data.Flow;
            } else {
              this.xmldata = data;
            }
            this.preProcessNodes();
          }
        }
      };
      _define_property(Flow2, "ATTRIBUTE_TAGS", [
        "apiVersion",
        "areMetricsLoggedToDataCloud",
        "description",
        "environments",
        "fullName",
        "interviewLabel",
        "isAdditionalPermissionRequiredToRun",
        "isTemplate",
        "label",
        "migratedFromWorkflowRuleName",
        "processMetadataValues",
        "processType",
        "runInMode",
        "segment",
        "startElementReference",
        "status",
        "timeZoneSidKey",
        "triggerOrder"
      ]);
      _define_property(Flow2, "NODE_TAGS", [
        "actionCalls",
        "apexPluginCalls",
        "assignments",
        "collectionProcessors",
        "decisions",
        "loops",
        "orchestratedStages",
        "recordCreates",
        "recordDeletes",
        "recordLookups",
        "recordUpdates",
        "recordRollbacks",
        "screens",
        "steps",
        "subflows",
        "waits",
        "transforms",
        "customErrors"
      ]);
      _define_property(Flow2, "RESOURCE_TAGS", [
        "textTemplates",
        "stages"
      ]);
      _define_property(Flow2, "VARIABLE_TAGS", [
        "choices",
        "constants",
        "dynamicChoiceSets",
        "formulas",
        "variables"
      ]);
    }
  });

  // ../package/main/models/FlowAttribute.js
  var require_FlowAttribute = __commonJS({
    "../package/main/models/FlowAttribute.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowAttribute", {
        enumerable: true,
        get: function() {
          return FlowAttribute;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _FlowElement = require_FlowElement();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowAttribute = class FlowAttribute extends _FlowElement.FlowElement {
        constructor(name, subtype, expression) {
          super(_MetadataTypes.MetaType.ATTRIBUTE, subtype, name), _define_property(this, "expression", void 0);
          this.expression = expression;
        }
      };
    }
  });

  // ../package/main/models/FlowType.js
  var require_FlowType = __commonJS({
    "../package/main/models/FlowType.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowType", {
        enumerable: true,
        get: function() {
          return FlowType2;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var FlowType2 = class FlowType {
      };
      _define_property(FlowType2, "autolaunchedType", "AutoLaunchedFlow");
      _define_property(FlowType2, "backEndTypes", [
        FlowType2.autolaunchedType,
        "CustomEvent",
        "InvocableProcess",
        "Orchestrator",
        "EvaluationFlow",
        "ActionCadenceAutolaunchedFlow"
      ]);
      _define_property(FlowType2, "processBuilder", [
        "Workflow"
      ]);
      _define_property(FlowType2, "surveyTypes", [
        "Survey"
      ]);
      _define_property(FlowType2, "unsupportedTypes", [
        "ActionPlan",
        "UserProvisioningFlow",
        "CheckoutFlow",
        "FSCLending",
        "LoyaltyManagementFlow",
        "JourneyBuilderIntegration"
      ]);
      _define_property(FlowType2, "visualTypes", [
        "Flow",
        "IndividualObjectLinkingFlow",
        "LoginFlow",
        "RoutingFlow",
        "Appointments",
        "ActionCadenceStepFlow",
        "ContactRequestFlow",
        "CustomerLifecycle",
        "FieldServiceMobile",
        "FieldServiceWeb",
        "SurveyEnrich"
      ]);
      _define_property(FlowType2, "allTypes", function() {
        return [
          ...this.backEndTypes,
          ...this.visualTypes,
          ...this.surveyTypes
        ];
      });
    }
  });

  // ../package/main/models/ParsedFlow.js
  var require_ParsedFlow = __commonJS({
    "../package/main/models/ParsedFlow.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ParsedFlow", {
        enumerable: true,
        get: function() {
          return ParsedFlow;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var ParsedFlow = class ParsedFlow {
        constructor(uri, flow, errorMessage) {
          _define_property(this, "uri", void 0);
          _define_property(this, "flow", void 0);
          _define_property(this, "errorMessage", void 0);
          this.uri = uri;
          this.flow = flow;
          if (errorMessage) {
            this.errorMessage = errorMessage;
          }
        }
      };
    }
  });

  // ../package/main/models/RuleCommon.js
  var require_RuleCommon = __commonJS({
    "../package/main/models/RuleCommon.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RuleCommon", {
        enumerable: true,
        get: function() {
          return RuleCommon;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var RuleCommon = class RuleCommon {
        execute(flow, options, suppressions = []) {
          if (suppressions.includes("*")) {
            return new _internals.RuleResult(this, []);
          }
          if (suppressions.includes(this.ruleId) || suppressions.includes(this.name)) {
            return new _internals.RuleResult(this, []);
          }
          const suppSet = new Set(suppressions);
          let violations = this.check(flow, options, suppSet);
          violations = violations.filter((v) => !suppSet.has(v.name));
          return new _internals.RuleResult(this, violations);
        }
        isSuppressed(name, suppressions) {
          return suppressions.has(name);
        }
        /**
        * Get the start node (the special <start> element).
        * This is now stored separately in flow.startNode, not in flow.elements.
        * 
        * @param flow - The Flow instance
        * @returns The start FlowNode or undefined if not found
        */
        getStartNode(flow) {
          return flow.startNode;
        }
        /**
        * Get the reference name of the first actual element (what the flow starts at).
        * This is the element that comes AFTER the start node.
        * 
        * @param flow - The Flow instance
        * @returns The start reference name or undefined
        */
        getStartReference(flow) {
          return flow.startReference || void 0;
        }
        /**
        * Find the INDEX of the first actual element in a FlowNode array.
        * Useful for rules that need to iterate by index.
        * 
        * @param flow - The Flow instance
        * @param flowElements - Array of FlowNodes (typically from flow.elements)
        * @returns The index of the starting element, or -1 if not found
        */
        findStartIndex(flow, flowElements) {
          const startRef = this.getStartReference(flow);
          if (!startRef) {
            return -1;
          }
          return flowElements.findIndex((n) => n.name === startRef);
        }
        /**
        * Safely get a property from the start element.
        * 
        * @param flow - The Flow instance
        * @param propertyName - The property to retrieve (e.g., 'triggerType', 'object')
        * @returns The property value or undefined
        */
        getStartProperty(flow, propertyName) {
          var _flow_startNode;
          if ((_flow_startNode = flow.startNode) === null || _flow_startNode === void 0 ? void 0 : _flow_startNode.element) {
            var _flow_startNode_element;
            return (_flow_startNode_element = flow.startNode.element) === null || _flow_startNode_element === void 0 ? void 0 : _flow_startNode_element[propertyName];
          }
          return void 0;
        }
        constructor(info, optional) {
          _define_property(this, "category", void 0);
          _define_property(this, "description", void 0);
          _define_property(this, "summary", void 0);
          _define_property(this, "docRefs", []);
          _define_property(this, "isConfigurable", void 0);
          _define_property(this, "configurableOptions", void 0);
          _define_property(this, "isFixable", void 0);
          _define_property(this, "label", void 0);
          _define_property(this, "name", void 0);
          _define_property(this, "severity", void 0);
          _define_property(this, "supportedTypes", void 0);
          _define_property(this, "uri", void 0);
          _define_property(this, "ruleId", void 0);
          this.category = info.category;
          this.ruleId = info.ruleId;
          this.name = info.name;
          this.supportedTypes = info.supportedTypes;
          this.label = info.label;
          this.description = info.description;
          this.summary = info.summary;
          this.uri = `https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner/tree/main/src/main/rules/${info.name}.ts`;
          this.docRefs = info.docRefs;
          this.configurableOptions = info.configurableOptions;
          this.isConfigurable = !!(info.configurableOptions && info.configurableOptions.length > 0);
          var _info_isFixable;
          this.isFixable = (_info_isFixable = info.isFixable) !== null && _info_isFixable !== void 0 ? _info_isFixable : false;
          var _optional_severity;
          this.severity = (_optional_severity = optional === null || optional === void 0 ? void 0 : optional.severity) !== null && _optional_severity !== void 0 ? _optional_severity : "warning";
        }
      };
    }
  });

  // ../package/main/models/RuleResult.js
  var require_RuleResult = __commonJS({
    "../package/main/models/RuleResult.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RuleResult", {
        enumerable: true,
        get: function() {
          return RuleResult2;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var RuleResult2 = class RuleResult {
        constructor(info, details, errorMessage) {
          _define_property(this, "occurs", void 0);
          _define_property(this, "ruleName", void 0);
          _define_property(this, "ruleId", void 0);
          _define_property(this, "ruleDefinition", void 0);
          _define_property(this, "severity", void 0);
          _define_property(this, "details", []);
          _define_property(this, "errorMessage", void 0);
          _define_property(this, "message", void 0);
          _define_property(this, "messageUrl", void 0);
          this.ruleDefinition = info;
          this.ruleName = info.name;
          this.ruleId = info.ruleId;
          this.severity = info.severity ? info.severity : "warning";
          this.occurs = false;
          this.details = details;
          if (details.length > 0) {
            this.occurs = true;
          }
          if (errorMessage) {
            this.errorMessage = errorMessage;
          }
        }
      };
    }
  });

  // ../package/main/models/ScanResult.js
  var require_ScanResult = __commonJS({
    "../package/main/models/ScanResult.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ScanResult", {
        enumerable: true,
        get: function() {
          return ScanResult2;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var ScanResult2 = class ScanResult {
        constructor(flow, ruleResults) {
          _define_property(this, "flow", void 0);
          _define_property(this, "ruleResults", void 0);
          this.flow = flow;
          this.ruleResults = ruleResults;
        }
      };
    }
  });

  // ../package/main/models/Violation.js
  var require_Violation = __commonJS({
    "../package/main/models/Violation.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get Violation() {
          return Violation2;
        },
        get enrichViolationsWithLineNumbers() {
          return enrichViolationsWithLineNumbers;
        }
      });
      var _MetadataTypes = require_MetadataTypes();
      var _Flow = require_Flow();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var Violation2 = class Violation {
        constructor(violation) {
          _define_property(this, "columnNumber", void 0);
          _define_property(this, "details", void 0);
          _define_property(this, "lineNumber", void 0);
          _define_property(this, "metaType", void 0);
          _define_property(this, "name", void 0);
          _define_property(this, "type", void 0);
          this.name = violation.name;
          this.metaType = violation.metaType;
          this.type = violation.subtype;
          this.lineNumber = 1;
          this.columnNumber = 1;
          if (violation.metaType === _MetadataTypes.MetaType.VARIABLE) {
            const element = violation;
            this.details = {
              dataType: element.dataType
            };
          } else if (violation.metaType === _MetadataTypes.MetaType.NODE) {
            var _element_connectors;
            const element = violation;
            this.details = {
              connectsTo: (_element_connectors = element.connectors) === null || _element_connectors === void 0 ? void 0 : _element_connectors.map((connector) => connector.reference),
              locationX: element.locationX,
              locationY: element.locationY
            };
          } else if (violation.metaType === _MetadataTypes.MetaType.ATTRIBUTE) {
            const element = violation;
            this.details = {
              expression: element.expression
            };
          }
        }
      };
      function enrichViolationsWithLineNumbers(violations, flowXml) {
        if (!flowXml || violations.length === 0) return;
        const lines = flowXml.split("\n");
        const flowLevelTags = _Flow.Flow.ATTRIBUTE_TAGS;
        for (const violation of violations) {
          if (violation.metaType !== _MetadataTypes.MetaType.ATTRIBUTE) {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(`<name>${violation.name}</name>`)) {
                violation.lineNumber = i + 1;
                violation.columnNumber = lines[i].indexOf(violation.name) + 1;
                break;
              }
            }
          }
          if (violation.metaType === _MetadataTypes.MetaType.ATTRIBUTE) {
            const tagName = violation.type;
            if (flowLevelTags.includes(tagName)) {
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`<${tagName}>`)) {
                  violation.lineNumber = i + 1;
                  violation.columnNumber = lines[i].indexOf(`<${tagName}>`) + 1;
                  break;
                }
              }
            }
          }
        }
      }
    }
  });

  // ../package/main/internals/internals.js
  var require_internals = __commonJS({
    "../package/main/internals/internals.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get Compiler() {
          return _Compiler.Compiler;
        },
        get Flow() {
          return _Flow.Flow;
        },
        get FlowAttribute() {
          return _FlowAttribute.FlowAttribute;
        },
        get FlowElement() {
          return _FlowElement.FlowElement;
        },
        get FlowGraph() {
          return _FlowGraph.FlowGraph;
        },
        get FlowNode() {
          return _FlowNode.FlowNode;
        },
        get FlowResource() {
          return _FlowResource.FlowResource;
        },
        get FlowType() {
          return _FlowType.FlowType;
        },
        get FlowVariable() {
          return _FlowVariable.FlowVariable;
        },
        get ParsedFlow() {
          return _ParsedFlow.ParsedFlow;
        },
        get RuleCommon() {
          return _RuleCommon.RuleCommon;
        },
        get RuleResult() {
          return _RuleResult.RuleResult;
        },
        get ScanResult() {
          return _ScanResult.ScanResult;
        },
        get Violation() {
          return _Violation.Violation;
        }
      });
      var _Compiler = require_Compiler();
      var _Flow = require_Flow();
      var _FlowAttribute = require_FlowAttribute();
      var _FlowElement = require_FlowElement();
      var _FlowGraph = require_FlowGraph();
      var _FlowNode = require_FlowNode();
      var _FlowResource = require_FlowResource();
      var _FlowType = require_FlowType();
      var _FlowVariable = require_FlowVariable();
      var _ParsedFlow = require_ParsedFlow();
      var _RuleCommon = require_RuleCommon();
      var _RuleResult = require_RuleResult();
      var _ScanResult = require_ScanResult();
      var _Violation = require_Violation();
    }
  });

  // ../package/main/interfaces/IRulesConfig.js
  var require_IRulesConfig = __commonJS({
    "../package/main/interfaces/IRulesConfig.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get DetailLevel() {
          return DetailLevel;
        },
        get SEVERITY_ORDER() {
          return SEVERITY_ORDER;
        },
        get countThresholdViolations() {
          return countThresholdViolations;
        },
        get filterByThreshold() {
          return filterByThreshold;
        },
        get meetsThreshold() {
          return meetsThreshold;
        }
      });
      var DetailLevel = /* @__PURE__ */ (function(DetailLevel2) {
        DetailLevel2["ENRICHED"] = "enriched";
        DetailLevel2["SIMPLE"] = "simple";
        return DetailLevel2;
      })({});
      var SEVERITY_ORDER = [
        "error",
        "warning",
        "note"
      ];
      function meetsThreshold(severity, threshold) {
        if (threshold === "never") return false;
        const sev = severity || "warning";
        const sevIndex = SEVERITY_ORDER.indexOf(sev);
        const thresholdIndex = SEVERITY_ORDER.indexOf(threshold);
        return sevIndex >= 0 && sevIndex <= thresholdIndex;
      }
      function countThresholdViolations(results, threshold) {
        if (threshold === "never") return 0;
        return results.filter((r) => meetsThreshold(r.severity, threshold)).length;
      }
      function filterByThreshold(results, threshold) {
        if (threshold === "never") return results;
        return results.filter((r) => meetsThreshold(r.severity, threshold));
      }
    }
  });

  // ../package/main/models/LoopRuleCommon.js
  var require_LoopRuleCommon = __commonJS({
    "../package/main/models/LoopRuleCommon.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "LoopRuleCommon", {
        enumerable: true,
        get: function() {
          return LoopRuleCommon;
        }
      });
      var _internals = require_internals();
      var _RuleCommon = require_RuleCommon();
      var LoopRuleCommon = class LoopRuleCommon extends _RuleCommon.RuleCommon {
        check(flow, _options, suppressions) {
          const loopElements = flow.graph.getLoopNodes();
          if (!loopElements.length) {
            return [];
          }
          const statementsInLoops = this.findStatementsInLoops(flow, loopElements);
          const results = statementsInLoops.filter((det) => !suppressions.has(det.name)).map((det) => new _internals.Violation(det));
          return results;
        }
        findLoopElements(flow) {
          return flow.graph.getLoopNodes();
        }
        findLoopEnd(element) {
          var _element_element_noMoreValuesConnector, _element_element;
          var _element_element_noMoreValuesConnector_targetReference;
          return (_element_element_noMoreValuesConnector_targetReference = (_element_element = element.element) === null || _element_element === void 0 ? void 0 : (_element_element_noMoreValuesConnector = _element_element.noMoreValuesConnector) === null || _element_element_noMoreValuesConnector === void 0 ? void 0 : _element_element_noMoreValuesConnector.targetReference) !== null && _element_element_noMoreValuesConnector_targetReference !== void 0 ? _element_element_noMoreValuesConnector_targetReference : element.name;
        }
        findStatementsInLoops(flow, loopElements) {
          const statementsInLoops = [];
          const statementTypes = this.getStatementTypes();
          for (const element of loopElements) {
            const loopElems = flow.graph.getLoopElements(element.name);
            for (const elemName of loopElems) {
              const node = flow.graph.getNode(elemName);
              if (node && statementTypes.includes(node.subtype)) {
                statementsInLoops.push(node);
              }
            }
          }
          return statementsInLoops;
        }
        constructor(info, optional) {
          super(info, optional);
        }
      };
    }
  });

  // ../package/main/rules/ActionCallsInLoop.js
  var require_ActionCallsInLoop = __commonJS({
    "../package/main/rules/ActionCallsInLoop.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ActionCallsInLoop", {
        enumerable: true,
        get: function() {
          return ActionCallsInLoop;
        }
      });
      var _internals = require_internals();
      var _LoopRuleCommon = require_LoopRuleCommon();
      var ActionCallsInLoop = class ActionCallsInLoop extends _LoopRuleCommon.LoopRuleCommon {
        getStatementTypes() {
          return [
            "actionCalls",
            "apexPluginCalls"
          ];
        }
        constructor() {
          super({
            ruleId: "action-call-in-loop",
            category: "suggestion",
            description: "Repeatedly invoking Apex actions inside a loop can exhaust governor limits and lead to performance issues. Where possible, bulkify your logic by moving the action call outside the loop and passing a collection variable instead.",
            summary: "Action calls inside loop risk governor limits",
            docRefs: [
              {
                label: "Action Call In A Loop",
                path: "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm"
              }
            ],
            label: "Action Call In A Loop",
            name: "ActionCallsInLoop",
            supportedTypes: _internals.FlowType.backEndTypes
          }, {
            severity: "warning"
          });
        }
      };
    }
  });

  // ../package/main/rules/APIVersion.js
  var require_APIVersion = __commonJS({
    "../package/main/rules/APIVersion.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "APIVersion", {
        enumerable: true,
        get: function() {
          return APIVersion;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var APIVersion = class APIVersion extends _RuleCommon.RuleCommon {
        check(flow, options, _suppressions) {
          let flowAPIVersionNumber = null;
          if (flow.xmldata.apiVersion) {
            flowAPIVersionNumber = +flow.xmldata.apiVersion;
          }
          if (options === null || options === void 0 ? void 0 : options.expression) {
            if (!flowAPIVersionNumber) {
              return [
                new _internals.Violation(new _internals.FlowAttribute("apiVersion<50", "apiVersion", "<50"))
              ];
            }
            const match = options.expression.match(/^\s*(>=|<=|>|<|===|!==)\s*(\d+)\s*$/);
            if (!match) {
              return [
                new _internals.Violation(new _internals.FlowAttribute("Invalid API rule expression", "apiVersion", options.expression))
              ];
            }
            const [, operator, versionStr] = match;
            const target = parseFloat(versionStr);
            let isValid = true;
            switch (operator) {
              case ">":
                isValid = flowAPIVersionNumber > target;
                break;
              case "<":
                isValid = flowAPIVersionNumber < target;
                break;
              case ">=":
                isValid = flowAPIVersionNumber >= target;
                break;
              case "<=":
                isValid = flowAPIVersionNumber <= target;
                break;
              case "===":
                isValid = flowAPIVersionNumber === target;
                break;
              case "!==":
                isValid = flowAPIVersionNumber !== target;
                break;
            }
            if (!isValid) {
              return [
                new _internals.Violation(new _internals.FlowAttribute(`${flowAPIVersionNumber}`, "apiVersion", options.expression))
              ];
            }
          } else {
            if (!flowAPIVersionNumber || flowAPIVersionNumber < 50) {
              return [
                new _internals.Violation(new _internals.FlowAttribute(flowAPIVersionNumber ? `${flowAPIVersionNumber}` : "apiVersion<50", "apiVersion", "<50"))
              ];
            }
          }
          return [];
        }
        constructor() {
          super({
            ruleId: "invalid-api-version",
            category: "suggestion",
            name: "APIVersion",
            label: "Invalid API Version",
            description: "Flows running on outdated API versions may behave inconsistently when newer platform features or components are used. From API version 50.0 onward, the API Version attribute explicitly controls Flow runtime behavior. Keeping Flows aligned with a supported API version helps prevent compatibility issues and ensures predictable execution.",
            summary: "Outdated API versions risk compatibility issues",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: [],
            configurableOptions: [
              {
                name: "expression",
                type: "expression",
                description: "Comparison expression for API version (e.g., `>= 58`, `< 50`, `=== 60`)",
                defaultValue: ">= 50"
              }
            ],
            isFixable: true
          });
        }
      };
    }
  });

  // ../package/main/rules/AutoLayout.js
  var require_AutoLayout = __commonJS({
    "../package/main/rules/AutoLayout.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "AutoLayout", {
        enumerable: true,
        get: function() {
          return AutoLayout;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var AutoLayout = class AutoLayout extends _RuleCommon.RuleCommon {
        check(flow, _options) {
          var _CanvasMode_value;
          if (!flow.processMetadataValues) return [];
          const CanvasMode = flow.xmldata.processMetadataValues.find((mdv) => mdv.name === "CanvasMode");
          const autoLayout = (CanvasMode === null || CanvasMode === void 0 ? void 0 : CanvasMode.value) && typeof CanvasMode.value === "object" && CanvasMode.value.stringValue === "AUTO_LAYOUT_CANVAS";
          if (autoLayout) return [];
          var _CanvasMode_value_stringValue;
          return [
            new _internals.Violation(new _internals.FlowAttribute((_CanvasMode_value_stringValue = CanvasMode === null || CanvasMode === void 0 ? void 0 : (_CanvasMode_value = CanvasMode.value) === null || _CanvasMode_value === void 0 ? void 0 : _CanvasMode_value.stringValue) !== null && _CanvasMode_value_stringValue !== void 0 ? _CanvasMode_value_stringValue : "undefined", "CanvasMode", "!== AUTO_LAYOUT_CANVAS"))
          ];
        }
        constructor() {
          super({
            ruleId: "missing-auto-layout",
            category: "layout",
            name: "AutoLayout",
            label: "Missing Auto Layout",
            description: "Auto-Layout automatically arranges and aligns Flow elements, keeping the canvas organized and easier to maintain. Enabling it saves time and improves readability.",
            summary: "Auto-Layout improves canvas organization and readability",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: [],
            isFixable: true
          }, {
            severity: "note"
          });
        }
      };
    }
  });

  // ../package/main/rules/CognitiveComplexity.js
  var require_CognitiveComplexity = __commonJS({
    "../package/main/rules/CognitiveComplexity.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "CognitiveComplexity", {
        enumerable: true,
        get: function() {
          return CognitiveComplexity;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var CognitiveComplexity = class CognitiveComplexity extends _RuleCommon.RuleCommon {
        check(flow, options) {
          var _options_threshold;
          const threshold = (_options_threshold = options === null || options === void 0 ? void 0 : options.threshold) !== null && _options_threshold !== void 0 ? _options_threshold : this.defaultThreshold;
          const complexity = this.calculateCognitiveComplexity(flow);
          if (complexity > threshold) {
            return [
              new _internals.Violation(new _internals.FlowAttribute(`${complexity}`, "CognitiveComplexity", `>${threshold}`))
            ];
          }
          return [];
        }
        /**
        * Calculate cognitive complexity for a flow.
        *
        * Algorithm:
        * 1. Find all loops and decisions
        * 2. Calculate nesting depth for each (how many loops/decisions contain it)
        * 3. Add 1 + nesting_depth for each control structure
        */
        calculateCognitiveComplexity(flow) {
          let complexity = 0;
          const graph = flow.graph;
          const loops = flow.elements.filter((e) => e.subtype === "loops");
          const decisions = flow.elements.filter((e) => e.subtype === "decisions");
          const nestingDepth = /* @__PURE__ */ new Map();
          for (const element of flow.elements) {
            if (!(element instanceof _internals.FlowNode)) continue;
            let depth = 0;
            if (graph.isInLoop(element.name)) {
              depth++;
              const containingLoop = graph.getContainingLoop(element.name);
              if (containingLoop && containingLoop !== element.name) {
                depth += this.countParentLoops(containingLoop, graph, loops);
              }
            }
            nestingDepth.set(element.name, depth);
          }
          for (const loop of loops) {
            var _nestingDepth_get;
            const depth = (_nestingDepth_get = nestingDepth.get(loop.name)) !== null && _nestingDepth_get !== void 0 ? _nestingDepth_get : 0;
            complexity += 1 + depth;
          }
          for (const decision of decisions) {
            var _decision_rules;
            var _nestingDepth_get1;
            const depth = (_nestingDepth_get1 = nestingDepth.get(decision.name)) !== null && _nestingDepth_get1 !== void 0 ? _nestingDepth_get1 : 0;
            var _decision_rules_length;
            const rulesCount = (_decision_rules_length = (_decision_rules = decision.rules) === null || _decision_rules === void 0 ? void 0 : _decision_rules.length) !== null && _decision_rules_length !== void 0 ? _decision_rules_length : 0;
            complexity += 1 + depth;
            if (rulesCount > 1) {
              complexity += rulesCount - 1;
            }
          }
          return complexity;
        }
        /**
        * Count how many parent loops contain this loop
        */
        countParentLoops(loopName, graph, allLoops) {
          let count = 0;
          for (const parentLoop of allLoops) {
            if (parentLoop.name === loopName) continue;
            const loopElements = graph.getLoopElements(parentLoop.name);
            if (loopElements.has(loopName)) {
              count++;
            }
          }
          return count;
        }
        constructor() {
          super({
            ruleId: "cognitive-complexity",
            category: "suggestion",
            name: "CognitiveComplexity",
            label: "Cognitive Complexity",
            description: "Flows with deeply nested loops and decisions are hard to understand. Unlike cyclomatic complexity which counts paths, cognitive complexity penalizes nesting depth. Consider extracting nested logic into subflows.",
            summary: "Deeply nested logic harms readability",
            supportedTypes: _internals.FlowType.backEndTypes,
            docRefs: [
              {
                label: "Cognitive Complexity is a measure of how difficult code is to understand, as opposed to Cyclomatic Complexity which measures testability.",
                path: "https://www.sonarsource.com/docs/CognitiveComplexity.pdf"
              }
            ],
            configurableOptions: [
              {
                name: "threshold",
                type: "number",
                description: "Maximum cognitive complexity score before triggering a violation",
                defaultValue: 15
              }
            ]
          }, {
            severity: "note"
          }), _define_property(this, "defaultThreshold", 15);
        }
      };
    }
  });

  // ../package/main/rules/CopyAPIName.js
  var require_CopyAPIName = __commonJS({
    "../package/main/rules/CopyAPIName.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "CopyAPIName", {
        enumerable: true,
        get: function() {
          return CopyAPIName;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var CopyAPIName = class CopyAPIName extends _RuleCommon.RuleCommon {
        check(flow) {
          const flowElements = flow.elements.filter((node) => node instanceof _internals.FlowNode);
          const copyOfElements = flowElements.filter((el) => /Copy_[0-9]+_of_[A-Za-z0-9]+/.test(el.name));
          return copyOfElements.map((el) => new _internals.Violation(el));
        }
        constructor() {
          super({
            ruleId: "unclear-api-naming",
            category: "layout",
            name: "CopyAPIName",
            label: "Unclear API Name",
            description: "Elements with unclear or duplicated API names, like Copy_X_Of_Element, reduce Flow readability. Make sure to update the API name when copying elements to keep your Flow organized.",
            summary: "Duplicated API names reduce Flow readability",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: []
          });
        }
      };
    }
  });

  // ../package/main/rules/CyclomaticComplexity.js
  var require_CyclomaticComplexity = __commonJS({
    "../package/main/rules/CyclomaticComplexity.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "CyclomaticComplexity", {
        enumerable: true,
        get: function() {
          return CyclomaticComplexity;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var CyclomaticComplexity = class CyclomaticComplexity extends _RuleCommon.RuleCommon {
        check(flow, options) {
          var _flow_elements, _flow_elements1;
          var _options_threshold;
          const threshold = (_options_threshold = options === null || options === void 0 ? void 0 : options.threshold) !== null && _options_threshold !== void 0 ? _options_threshold : this.defaultThreshold;
          let cyclomaticComplexity = 1;
          const flowDecisions = flow === null || flow === void 0 ? void 0 : (_flow_elements = flow.elements) === null || _flow_elements === void 0 ? void 0 : _flow_elements.filter((node) => node.subtype === "decisions");
          const flowLoops = flow === null || flow === void 0 ? void 0 : (_flow_elements1 = flow.elements) === null || _flow_elements1 === void 0 ? void 0 : _flow_elements1.filter((node) => node.subtype === "loops");
          for (const decision of flowDecisions || []) {
            const rules = decision.element["rules"];
            cyclomaticComplexity += Array.isArray(rules) ? rules.length + 1 : 1;
          }
          var _flowLoops_length;
          cyclomaticComplexity += (_flowLoops_length = flowLoops === null || flowLoops === void 0 ? void 0 : flowLoops.length) !== null && _flowLoops_length !== void 0 ? _flowLoops_length : 0;
          this.cyclomaticComplexityUnit = cyclomaticComplexity;
          if (cyclomaticComplexity > threshold) {
            return [
              new _internals.Violation(new _internals.FlowAttribute(`${cyclomaticComplexity}`, "CyclomaticComplexity", `>${threshold}`))
            ];
          }
          return [];
        }
        constructor() {
          super({
            ruleId: "excessive-cyclomatic-complexity",
            category: "suggestion",
            name: "CyclomaticComplexity",
            label: "Excessive Cyclomatic Complexity",
            description: "High numbers of loops and decision elements increase a Flow's cyclomatic complexity. To maintain simplicity and readability, consider using subflows or splitting a Flow into smaller, ordered Flows.",
            summary: "Too many loops and decisions harm readability",
            supportedTypes: _internals.FlowType.backEndTypes,
            docRefs: [
              {
                label: `Cyclomatic complexity is a software metric used to indicate the complexity of a program. It is a quantitative measure of the number of linearly independent paths through a program's source code.`,
                path: "https://en.wikipedia.org/wiki/Cyclomatic_complexity"
              }
            ],
            configurableOptions: [
              {
                name: "threshold",
                type: "number",
                description: "Maximum cyclomatic complexity score before triggering a violation",
                defaultValue: 25
              }
            ]
          }, {
            severity: "note"
          }), _define_property(this, "defaultThreshold", 25), _define_property(this, "cyclomaticComplexityUnit", 0);
        }
      };
    }
  });

  // ../package/main/rules/DMLStatementInLoop.js
  var require_DMLStatementInLoop = __commonJS({
    "../package/main/rules/DMLStatementInLoop.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "DMLStatementInLoop", {
        enumerable: true,
        get: function() {
          return DMLStatementInLoop;
        }
      });
      var _internals = require_internals();
      var _LoopRuleCommon = require_LoopRuleCommon();
      var DMLStatementInLoop = class DMLStatementInLoop extends _LoopRuleCommon.LoopRuleCommon {
        getStatementTypes() {
          return [
            "recordDeletes",
            "recordUpdates",
            "recordCreates"
          ];
        }
        constructor() {
          super({
            ruleId: "dml-in-loop",
            category: "problem",
            description: "Executing DML operations (insert, update, delete) inside a loop is a high-risk anti-pattern that frequently causes governor limit exceptions. All database operations should be collected and executed once, outside the loop.",
            summary: "DML operations inside loop risk governor limits",
            docRefs: [
              {
                label: "Flow Best Practices",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_prep_bestpractices.htm&type=5"
              }
            ],
            label: "DML Statement In A Loop",
            name: "DMLStatementInLoop",
            supportedTypes: _internals.FlowType.backEndTypes
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/main/rules/DuplicateDMLOperation.js
  var require_DuplicateDMLOperation = __commonJS({
    "../package/main/rules/DuplicateDMLOperation.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "DuplicateDMLOperation", {
        enumerable: true,
        get: function() {
          return DuplicateDMLOperation;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var DuplicateDMLOperation = class DuplicateDMLOperation extends _RuleCommon.RuleCommon {
        check(flow, _options, suppressions) {
          const graph = flow.graph;
          const start = flow.startReference;
          if (!start) return [];
          const violations = [];
          const visited = /* @__PURE__ */ new Set();
          const stack = [
            {
              name: start,
              seenDML: false
            }
          ];
          while (stack.length > 0) {
            const { name, seenDML } = stack.pop();
            const stateKey = `${name}:${seenDML}`;
            if (visited.has(stateKey)) continue;
            visited.add(stateKey);
            const node = graph.getNode(name);
            if (!node) continue;
            let nextSeenDML = seenDML || this.isDML(node);
            if (nextSeenDML && node.subtype === "screens" && node.element["allowBack"] === "true" && node.element["showFooter"] === "true" && !suppressions.has(node.name)) {
              violations.push(new _internals.Violation(node));
            }
            if (nextSeenDML && node.subtype === "screens" && node.element["allowBack"] !== "true") {
              nextSeenDML = false;
            }
            for (const next of graph.getNextElements(name)) {
              stack.push({
                name: next,
                seenDML: nextSeenDML
              });
            }
          }
          return violations;
        }
        isDML(node) {
          return node.subtype === "recordCreates" || node.subtype === "recordUpdates" || node.subtype === "recordDeletes";
        }
        constructor() {
          super({
            ruleId: "duplicate-dml",
            category: "problem",
            name: "DuplicateDMLOperation",
            label: "Duplicate DML Operation",
            description: "When a Flow performs database operations across multiple screens, users navigating backward can cause the same actions to run multiple times. To prevent unintended changes, either restrict backward navigation or redesign the Flow so database operations execute in a single, forward-moving step.",
            summary: "DML across screens may execute multiple times",
            supportedTypes: _internals.FlowType.visualTypes,
            docRefs: []
          });
        }
      };
    }
  });

  // ../package/main/rules/FlowDescription.js
  var require_FlowDescription = __commonJS({
    "../package/main/rules/FlowDescription.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowDescription", {
        enumerable: true,
        get: function() {
          return FlowDescription;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var FlowDescription = class FlowDescription extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          var _flow_xmldata;
          if ((_flow_xmldata = flow.xmldata) === null || _flow_xmldata === void 0 ? void 0 : _flow_xmldata.description) {
            return [];
          }
          return [
            new _internals.Violation(new _internals.FlowAttribute("undefined", "description", "!==null"))
          ];
        }
        constructor() {
          super({
            ruleId: "missing-flow-description",
            category: "layout",
            description: "Flow descriptions are essential for documentation and maintainability. Include a description for each Flow, explaining its purpose and where it's used.",
            summary: "Flow descriptions improve documentation and maintainability",
            docRefs: [],
            label: "Missing Flow Description",
            name: "FlowDescription",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ]
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/models/MetadataFile.js
  var require_MetadataFile = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/models/MetadataFile.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/models/RegexViolation.js
  var require_RegexViolation = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/models/RegexViolation.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/models/RegexRule.js
  var require_RegexRule = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/models/RegexRule.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RegexRule", {
        enumerable: true,
        get: function() {
          return RegexRule;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _object_spread(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};
          var ownKeys2 = Object.keys(source);
          if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys2 = ownKeys2.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
              return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
          }
          ownKeys2.forEach(function(key) {
            _define_property(target, key, source[key]);
          });
        }
        return target;
      }
      function ownKeys(object, enumerableOnly) {
        var keys = Object.keys(object);
        if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(object);
          if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
              return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
          }
          keys.push.apply(keys, symbols);
        }
        return keys;
      }
      function _object_spread_props(target, source) {
        source = source != null ? source : {};
        if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
        return target;
      }
      var RegexRule = class RegexRule {
        /**
        * Execute the rule against a metadata file.
        * Handles type filtering and config merging before calling check().
        */
        execute(file, config) {
          if (!this.supportedTypes.includes("*") && !this.supportedTypes.includes(file.metadataType)) {
            return [];
          }
          if ((config === null || config === void 0 ? void 0 : config.enabled) === false) {
            return [];
          }
          var _config_severity;
          const effectiveSeverity = (_config_severity = config === null || config === void 0 ? void 0 : config.severity) !== null && _config_severity !== void 0 ? _config_severity : this.severity;
          const violations = this.check(file, config);
          return violations.map((v) => {
            var _config_message, _config_messageUrl;
            return _object_spread_props(_object_spread({}, v), {
              severity: effectiveSeverity,
              message: (_config_message = config === null || config === void 0 ? void 0 : config.message) !== null && _config_message !== void 0 ? _config_message : v.message,
              messageUrl: (_config_messageUrl = config === null || config === void 0 ? void 0 : config.messageUrl) !== null && _config_messageUrl !== void 0 ? _config_messageUrl : v.messageUrl
            });
          });
        }
        /**
        * Helper to create a violation with common fields populated
        */
        createViolation(file, overrides) {
          var _file_filePath;
          var _file_filePath_replace;
          return _object_spread({
            file: (_file_filePath_replace = (_file_filePath = file.filePath) === null || _file_filePath === void 0 ? void 0 : _file_filePath.replace(/\\/g, "/")) !== null && _file_filePath_replace !== void 0 ? _file_filePath_replace : file.fileName,
            fileName: file.fileName,
            metadataType: file.metadataType,
            ruleId: this.ruleId,
            ruleName: this.name,
            severity: this.severity,
            message: this.description,
            lineNumber: 1,
            columnNumber: 1,
            name: file.name,
            type: "name",
            metaType: "attribute"
          }, overrides);
        }
        constructor(info) {
          _define_property(this, "ruleId", void 0);
          _define_property(this, "name", void 0);
          _define_property(this, "label", void 0);
          _define_property(this, "description", void 0);
          _define_property(this, "summary", void 0);
          _define_property(this, "supportedTypes", void 0);
          _define_property(this, "docRefs", void 0);
          _define_property(this, "isConfigurable", void 0);
          _define_property(this, "severity", void 0);
          this.ruleId = info.ruleId;
          this.name = info.name;
          this.label = info.label;
          this.description = info.description;
          this.summary = info.summary;
          this.severity = info.severity;
          this.supportedTypes = info.supportedTypes;
          var _info_docRefs;
          this.docRefs = (_info_docRefs = info.docRefs) !== null && _info_docRefs !== void 0 ? _info_docRefs : [];
          this.isConfigurable = info.isConfigurable;
        }
      };
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/rules/NamingConvention.js
  var require_NamingConvention = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/rules/NamingConvention.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "NamingConvention", {
        enumerable: true,
        get: function() {
          return NamingConvention;
        }
      });
      var _RegexRule = require_RegexRule();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var NamingConvention = class NamingConvention2 extends _RegexRule.RegexRule {
        check(file, config) {
          var _config_expression;
          const pattern = (_config_expression = config === null || config === void 0 ? void 0 : config.expression) !== null && _config_expression !== void 0 ? _config_expression : NamingConvention2.DEFAULT_PATTERN;
          var _file_name;
          const name = (_file_name = file.name) !== null && _file_name !== void 0 ? _file_name : "";
          if (new RegExp(pattern).test(name)) {
            return [];
          }
          return [
            this.createViolation(file, {
              name,
              type: "name",
              metaType: "attribute",
              expression: pattern,
              message: this.description
            })
          ];
        }
        constructor() {
          super({
            ruleId: "naming-convention",
            name: "NamingConvention",
            label: "Naming Convention",
            description: "Using clear and consistent names improves readability, discoverability, and maintainability. A good naming convention helps team members quickly understand a file's purpose\u2014for example, including a domain and brief description like Service_OrderFulfillment.",
            summary: "Consistent naming improves discoverability and maintainability",
            severity: "error",
            supportedTypes: [
              "*"
            ],
            docRefs: [
              {
                label: "Naming your Flows is more critical than ever",
                path: "https://www.linkedin.com/posts/stephen-n-church_naming-your-flows-this-is-more-critical-activity-7099733198175158274-1sPx"
              }
            ],
            isConfigurable: true
          });
        }
      };
      _define_property(NamingConvention, "DEFAULT_PATTERN", "[A-Za-z0-9]+_[A-Za-z0-9]+");
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/utils/stripDescriptionContent.js
  var require_stripDescriptionContent = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/utils/stripDescriptionContent.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "stripDescriptionContent", {
        enumerable: true,
        get: function() {
          return stripDescriptionContent;
        }
      });
      function stripDescriptionContent(content) {
        let result = content.replace(/<description>[\s\S]*?<\/description>/gi, "");
        result = result.replace(/"description"\s*:\s*"(?:[^"\\]|\\.)*"/g, "");
        return result;
      }
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedId.js
  var require_HardcodedId = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedId.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedId", {
        enumerable: true,
        get: function() {
          return HardcodedId;
        }
      });
      var _RegexRule = require_RegexRule();
      var _stripDescriptionContent = require_stripDescriptionContent();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var HardcodedId = class HardcodedId2 extends _RegexRule.RegexRule {
        check(file, _config) {
          const violations = [];
          if (file.elements && file.elements.length > 0) {
            for (const element of file.elements) {
              const rawContent = typeof element.content === "string" ? element.content : JSON.stringify(element.content);
              const content = (0, _stripDescriptionContent.stripDescriptionContent)(rawContent);
              const regex = new RegExp(HardcodedId2.SALESFORCE_ID_PATTERN);
              const matches = content.match(regex);
              if (matches) {
                violations.push(this.createViolation(file, {
                  name: element.name,
                  type: element.type,
                  metaType: "element",
                  matchedText: matches[0],
                  message: this.description
                }));
              }
            }
          } else {
            const content = (0, _stripDescriptionContent.stripDescriptionContent)(file.content);
            const regex = new RegExp(HardcodedId2.SALESFORCE_ID_PATTERN);
            const matches = content.match(regex);
            if (matches) {
              for (const match of matches) {
                violations.push(this.createViolation(file, {
                  name: file.name,
                  type: "content",
                  metaType: "content",
                  matchedText: match,
                  message: this.description
                }));
              }
            }
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "hardcoded-id",
            name: "HardcodedId",
            label: "Hardcoded Salesforce Id",
            description: "Avoid hard-coding record IDs, as they are unique to a specific org and will not work in other environments. Instead, store IDs in variables\u2014such as merge-field URL parameters or a Get Records element\u2014to make the Flow portable, maintainable, and flexible.",
            summary: "Hardcoded IDs break portability across environments",
            severity: "error",
            supportedTypes: [
              "*"
            ],
            docRefs: [
              {
                label: "Flow Best Practices",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_prep_bestpractices.htm&type=5"
              },
              {
                label: "Don't hard code Record Type IDs in Flow",
                path: "https://www.linkedin.com/feed/update/urn:li:activity:6947530300012826624/"
              }
            ],
            isConfigurable: false
          });
        }
      };
      _define_property(HardcodedId, "SALESFORCE_ID_PATTERN", /\b[a-zA-Z0-9]{5}0[a-zA-Z0-9]{9}(?:[a-zA-Z0-9]{3})?\b/g);
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedUrl.js
  var require_HardcodedUrl = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedUrl.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedUrl", {
        enumerable: true,
        get: function() {
          return HardcodedUrl;
        }
      });
      var _RegexRule = require_RegexRule();
      var _stripDescriptionContent = require_stripDescriptionContent();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var HardcodedUrl = class HardcodedUrl2 extends _RegexRule.RegexRule {
        check(file, _config) {
          const violations = [];
          if (file.elements && file.elements.length > 0) {
            for (const element of file.elements) {
              const rawContent = typeof element.content === "string" ? element.content : JSON.stringify(element.content);
              const content = (0, _stripDescriptionContent.stripDescriptionContent)(rawContent);
              const regex = new RegExp(HardcodedUrl2.FORCE_URL_PATTERN);
              const matches = content.match(regex);
              if (matches) {
                violations.push(this.createViolation(file, {
                  name: element.name,
                  type: element.type,
                  metaType: "element",
                  matchedText: matches[0],
                  message: this.description
                }));
              }
            }
          } else {
            const content = (0, _stripDescriptionContent.stripDescriptionContent)(file.content);
            const regex = new RegExp(HardcodedUrl2.FORCE_URL_PATTERN);
            const matches = content.match(regex);
            if (matches) {
              for (const match of matches) {
                violations.push(this.createViolation(file, {
                  name: file.name,
                  type: "content",
                  metaType: "content",
                  matchedText: match,
                  message: this.description
                }));
              }
            }
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "hardcoded-url",
            name: "HardcodedUrl",
            label: "Hardcoded Salesforce Url",
            description: "Avoid hard-coding URLs, as they may change between environments or over time. Instead, store URLs in variables or custom settings to make the Flow adaptable, maintainable, and environment-independent.",
            summary: "Hardcoded URLs break across different environments",
            severity: "error",
            supportedTypes: [
              "*"
            ],
            docRefs: [
              {
                label: "The Ultimate Guide to Salesforce Flow Best Practices",
                path: "https://admin.salesforce.com/blog/2021/the-ultimate-guide-to-flow-best-practices-and-standards"
              },
              {
                label: "Why You Should Avoid Hard Coding and Three Alternative Solutions",
                path: "https://admin.salesforce.com/blog/2021/why-you-should-avoid-hard-coding-and-three-alternative-solutions"
              }
            ],
            isConfigurable: false
          });
        }
      };
      _define_property(HardcodedUrl, "FORCE_URL_PATTERN", /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}force\.com/g);
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedSecret.js
  var require_HardcodedSecret = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/rules/HardcodedSecret.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedSecret", {
        enumerable: true,
        get: function() {
          return HardcodedSecret;
        }
      });
      var _RegexRule = require_RegexRule();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var HardcodedSecret = class HardcodedSecret2 extends _RegexRule.RegexRule {
        check(file, _config) {
          const violations = [];
          if (file.elements && file.elements.length > 0) {
            for (const element of file.elements) {
              const content = typeof element.content === "string" ? element.content : JSON.stringify(element.content);
              const matches = this.findSecrets(content);
              for (const match of matches) {
                violations.push(this.createViolation(file, {
                  name: element.name,
                  type: element.type,
                  metaType: "element",
                  matchedText: this.maskSecret(match.matchedText),
                  message: match.description
                }));
              }
            }
          } else {
            const matches = this.findSecrets(file.content);
            for (const match of matches) {
              violations.push(this.createViolation(file, {
                name: file.name,
                type: "content",
                metaType: "content",
                matchedText: this.maskSecret(match.matchedText),
                message: match.description
              }));
            }
          }
          return violations;
        }
        /**
        * Find all secrets in content using all patterns
        */
        findSecrets(content) {
          const results = [];
          const seen = /* @__PURE__ */ new Set();
          for (const secretPattern of HardcodedSecret2.SECRET_PATTERNS) {
            const regex = new RegExp(secretPattern.pattern.source, secretPattern.pattern.flags);
            const matches = content.match(regex);
            if (matches) {
              for (const match of matches) {
                if (!seen.has(match)) {
                  seen.add(match);
                  results.push({
                    matchedText: match,
                    description: secretPattern.description
                  });
                }
              }
            }
          }
          return results;
        }
        /**
        * Mask sensitive parts of the secret for display
        * Shows first 4 and last 4 characters only
        */
        maskSecret(secret) {
          if (secret.length <= 12) {
            return secret.substring(0, 4) + "****";
          }
          return secret.substring(0, 4) + "****" + secret.substring(secret.length - 4);
        }
        constructor() {
          super({
            ruleId: "hardcoded-secret",
            name: "HardcodedSecret",
            label: "Hardcoded Secret",
            description: "Avoid hardcoding secrets, API keys, tokens, or credentials in metadata files. These should be stored securely in Named Credentials, Custom Settings, Custom Metadata, or external secret management systems.",
            summary: "Hardcoded secrets pose security risks",
            severity: "error",
            supportedTypes: [
              "*"
            ],
            docRefs: [
              {
                label: "Salesforce Named Credentials",
                path: "https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm"
              },
              {
                label: "OWASP Secrets Management",
                path: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
              }
            ],
            isConfigurable: false
          });
        }
      };
      _define_property(HardcodedSecret, "SECRET_PATTERNS", [
        // Azure
        {
          name: "Azure Storage Account Key",
          pattern: /AccountKey=[A-Za-z0-9+/]{88}==/g,
          description: "Azure Storage account key detected"
        },
        {
          name: "Azure Connection String",
          pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g,
          description: "Azure connection string detected"
        },
        // GCP Service Account Key
        {
          name: "GCP Service Account Key",
          pattern: /"type"\s*:\s*"service_account"[\s\S]{0,500}"private_key"/g,
          description: "GCP service account JSON key detected"
        },
        // Stripe
        {
          name: "Stripe API Key",
          pattern: /(sk|pk|rk)_(test|live)_[0-9a-zA-Z]{24,}/g,
          description: "Stripe API key detected"
        },
        // AWS
        {
          name: "AWS Access Key ID",
          pattern: /\bAKIA[0-9A-Z]{16}\b/g,
          description: "AWS access key ID detected"
        },
        {
          name: "AWS Secret Access Key",
          pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/gi,
          description: "AWS secret access key detected"
        },
        // Salesforce
        {
          name: "Salesforce Session ID",
          pattern: /\b00D[a-zA-Z0-9]{15}![a-zA-Z0-9.]{80,}/g,
          description: "Salesforce session ID detected"
        },
        {
          name: "Salesforce Refresh Token",
          pattern: /\b5Aep[a-zA-Z0-9._]{80,}/g,
          description: "Salesforce refresh token detected"
        },
        {
          name: "Hardcoded OAuth Token",
          pattern: /(authorization|auth)\s*[:=]\s*["']Bearer\s+[A-Za-z0-9\-_\.]{20,}["']/gi,
          description: "Hardcoded OAuth bearer token detected"
        },
        // Generic API Keys and Tokens
        {
          name: "Bearer Token",
          pattern: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/gi,
          description: "Bearer token detected"
        },
        {
          name: "Basic Auth",
          pattern: /Basic\s+[a-zA-Z0-9+/=]{20,}/gi,
          description: "Basic authentication credentials detected"
        },
        // Private Keys
        {
          name: "Private Key",
          pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
          description: "Private key detected"
        },
        {
          name: "Certificate",
          pattern: /-----BEGIN\s+CERTIFICATE-----/g,
          description: "Certificate detected"
        },
        {
          name: "JWT Secret",
          pattern: /jwt[_-]?secret\s*[:=]\s*["'][^"']{8,}["']/gi,
          description: "Hardcoded JWT secret detected"
        },
        // GitHub
        {
          name: "GitHub Token",
          pattern: /gh[puo]_[A-Za-z0-9_]{36,}/g,
          description: "GitHub token detected"
        },
        // Slack
        {
          name: "Slack Token",
          pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
          description: "Slack token detected"
        },
        {
          name: "Slack Webhook",
          pattern: /hooks\.slack\.com\/services\/[A-Z0-9]{9,}\/[A-Z0-9]{9,}\/[A-Za-z0-9]{20,}/g,
          description: "Slack webhook URL detected"
        },
        // Google
        {
          name: "Google API Key",
          pattern: /AIza[0-9A-Za-z_-]{35}/g,
          description: "Google API key detected"
        },
        // Twilio
        {
          name: "Twilio API Key",
          pattern: /SK[a-fA-F0-9]{32}/g,
          description: "Twilio API key detected"
        },
        // SendGrid
        {
          name: "SendGrid API Key",
          pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
          description: "SendGrid API key detected"
        },
        // Mailchimp
        {
          name: "Mailchimp API Key",
          pattern: /[a-f0-9]{32}-us[0-9]{1,2}/g,
          description: "Mailchimp API key detected"
        },
        // Generic password patterns
        {
          name: "Password Assignment",
          pattern: /(password|passwd|pwd|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/gi,
          description: "Hardcoded password or secret assignment detected"
        },
        // AI API Keys
        {
          name: "OpenAI API Key",
          pattern: /sk-[A-Za-z0-9]{48,}/g,
          description: "OpenAI API key detected"
        },
        {
          name: "Anthropic API Key",
          pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
          description: "Anthropic API key detected"
        }
      ]);
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/config/RuleRegistry.js
  var require_RuleRegistry = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/config/RuleRegistry.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "regexRuleRegistry", {
        enumerable: true,
        get: function() {
          return regexRuleRegistry;
        }
      });
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var RuleRegistry = class RuleRegistry {
        register(ruleId, ruleClass, legacyName) {
          const entry = {
            ruleId,
            ruleClass,
            legacyName
          };
          this.rules.set(ruleId, entry);
          this.legacyNameMap.set(legacyName, ruleId);
        }
        get(idOrLegacyName) {
          let entry = this.rules.get(idOrLegacyName);
          if (!entry) {
            const ruleId = this.legacyNameMap.get(idOrLegacyName);
            if (ruleId) {
              entry = this.rules.get(ruleId);
            }
          }
          return entry;
        }
        getAllRuleIds() {
          return Array.from(this.rules.keys());
        }
        has(idOrLegacyName) {
          return this.get(idOrLegacyName) !== void 0;
        }
        createInstance(idOrLegacyName) {
          const entry = this.get(idOrLegacyName);
          if (!entry) {
            throw new Error(`Regex rule not found: ${idOrLegacyName}`);
          }
          return new entry.ruleClass();
        }
        /**
        * Get all rules, optionally filtered by config.
        * Supports both ruleId and legacy name lookups.
        */
        getRules(config) {
          const selectedRules = [];
          for (const ruleId of this.getAllRuleIds()) {
            var _config_rules, _config_rules1;
            const rule = this.createInstance(ruleId);
            var _config_rules_rule_ruleId;
            const ruleConfig = (_config_rules_rule_ruleId = config === null || config === void 0 ? void 0 : (_config_rules = config.rules) === null || _config_rules === void 0 ? void 0 : _config_rules[rule.ruleId]) !== null && _config_rules_rule_ruleId !== void 0 ? _config_rules_rule_ruleId : config === null || config === void 0 ? void 0 : (_config_rules1 = config.rules) === null || _config_rules1 === void 0 ? void 0 : _config_rules1[rule.name];
            if ((ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.enabled) === false) continue;
            if (ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.severity) {
              rule.severity = ruleConfig.severity;
            }
            selectedRules.push(rule);
          }
          return selectedRules;
        }
        /**
        * Get specific rules by ID or legacy name.
        */
        getRulesByIds(ruleIds) {
          const rules = [];
          for (const id of ruleIds) {
            if (this.has(id)) {
              rules.push(this.createInstance(id));
            }
          }
          return rules;
        }
        constructor() {
          _define_property(this, "rules", /* @__PURE__ */ new Map());
          _define_property(this, "legacyNameMap", /* @__PURE__ */ new Map());
        }
      };
      var registry = new RuleRegistry();
      var regexRuleRegistry = registry;
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/scan.js
  var require_scan = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/scan.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get getRegexRuleIds() {
          return getRegexRuleIds;
        },
        get hasRegexRule() {
          return hasRegexRule;
        },
        get scanFile() {
          return scanFile;
        },
        get scanRegex() {
          return scanRegex;
        }
      });
      var _RuleRegistry = require_RuleRegistry();
      function scanRegex(files, config) {
        const violations = [];
        const rules = _RuleRegistry.regexRuleRegistry.getRules(config);
        for (const file of files) {
          for (const rule of rules) {
            var _config_rules, _config_rules1;
            var _config_rules_rule_ruleId;
            const ruleConfig = (_config_rules_rule_ruleId = config === null || config === void 0 ? void 0 : (_config_rules = config.rules) === null || _config_rules === void 0 ? void 0 : _config_rules[rule.ruleId]) !== null && _config_rules_rule_ruleId !== void 0 ? _config_rules_rule_ruleId : config === null || config === void 0 ? void 0 : (_config_rules1 = config.rules) === null || _config_rules1 === void 0 ? void 0 : _config_rules1[rule.name];
            const ruleViolations = rule.execute(file, ruleConfig);
            violations.push(...ruleViolations);
          }
        }
        return violations;
      }
      function scanFile(file, config) {
        return scanRegex([
          file
        ], config);
      }
      function getRegexRuleIds() {
        return _RuleRegistry.regexRuleRegistry.getAllRuleIds();
      }
      function hasRegexRule(idOrName) {
        return _RuleRegistry.regexRuleRegistry.has(idOrName);
      }
    }
  });

  // ../package/node_modules/@flow-scanner/regex-scanner/index.js
  var require_regex_scanner = __commonJS({
    "../package/node_modules/@flow-scanner/regex-scanner/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get HardcodedId() {
          return _HardcodedId.HardcodedId;
        },
        get HardcodedSecret() {
          return _HardcodedSecret.HardcodedSecret;
        },
        get HardcodedUrl() {
          return _HardcodedUrl.HardcodedUrl;
        },
        get MetadataElement() {
          return _MetadataFile.MetadataElement;
        },
        get MetadataFile() {
          return _MetadataFile.MetadataFile;
        },
        get NamingConvention() {
          return _NamingConvention.NamingConvention;
        },
        get RegexRule() {
          return _RegexRule.RegexRule;
        },
        get RegexRuleConfig() {
          return _RegexViolation.RegexRuleConfig;
        },
        get RegexRuleInfo() {
          return _RegexRule.RegexRuleInfo;
        },
        get RegexScanConfig() {
          return _RegexViolation.RegexScanConfig;
        },
        get RegexViolation() {
          return _RegexViolation.RegexViolation;
        },
        get getRegexRuleIds() {
          return _scan.getRegexRuleIds;
        },
        get hasRegexRule() {
          return _scan.hasRegexRule;
        },
        get regexRuleRegistry() {
          return _RuleRegistry.regexRuleRegistry;
        },
        get scanFile() {
          return _scan.scanFile;
        },
        get scanRegex() {
          return _scan.scanRegex;
        }
      });
      var _MetadataFile = require_MetadataFile();
      var _RegexViolation = require_RegexViolation();
      var _RegexRule = require_RegexRule();
      var _NamingConvention = require_NamingConvention();
      var _HardcodedId = require_HardcodedId();
      var _HardcodedUrl = require_HardcodedUrl();
      var _HardcodedSecret = require_HardcodedSecret();
      var _RuleRegistry = require_RuleRegistry();
      var _scan = require_scan();
      _RuleRegistry.regexRuleRegistry.register("naming-convention", _NamingConvention.NamingConvention, "NamingConvention");
      _RuleRegistry.regexRuleRegistry.register("hardcoded-id", _HardcodedId.HardcodedId, "HardcodedId");
      _RuleRegistry.regexRuleRegistry.register("hardcoded-url", _HardcodedUrl.HardcodedUrl, "HardcodedUrl");
      _RuleRegistry.regexRuleRegistry.register("hardcoded-secret", _HardcodedSecret.HardcodedSecret, "HardcodedSecret");
    }
  });

  // ../package/main/config/RegexAdapter.js
  var require_RegexAdapter = __commonJS({
    "../package/main/config/RegexAdapter.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get flowElementToMetadataElement() {
          return flowElementToMetadataElement;
        },
        get toMetadataElements() {
          return toMetadataElements;
        },
        get toMetadataFile() {
          return toMetadataFile;
        },
        get toViolation() {
          return toViolation;
        },
        get toViolations() {
          return toViolations;
        }
      });
      var _FlowAttribute = require_FlowAttribute();
      var _Violation = require_Violation();
      function toMetadataFile(flow) {
        let content = "";
        if (typeof flow.toXMLString === "function") {
          content = flow.toXMLString();
        }
        var _flow_uri_split_pop;
        return {
          name: flow.name,
          fileName: flow.uri ? (_flow_uri_split_pop = flow.uri.split(/[\\/]/).pop()) !== null && _flow_uri_split_pop !== void 0 ? _flow_uri_split_pop : `${flow.name}.flow-meta.xml` : `${flow.name}.flow-meta.xml`,
          filePath: flow.fsPath,
          metadataType: "Flow",
          content,
          elements: toMetadataElements(flow)
        };
      }
      function toMetadataElements(flow) {
        if (!flow.elements || flow.elements.length === 0) {
          return [];
        }
        return flow.elements.map((element) => {
          var _element_element;
          return {
            name: element.name,
            type: element.subtype,
            content: (_element_element = element.element) !== null && _element_element !== void 0 ? _element_element : element
          };
        });
      }
      function toViolation(rv) {
        var _rv_expression;
        const flowElement = new _FlowAttribute.FlowAttribute(rv.name, rv.type, (_rv_expression = rv.expression) !== null && _rv_expression !== void 0 ? _rv_expression : rv.matchedText);
        const violation = new _Violation.Violation(flowElement);
        violation.lineNumber = rv.lineNumber;
        violation.columnNumber = rv.columnNumber;
        return violation;
      }
      function flowElementToMetadataElement(element) {
        var _element_element;
        return {
          name: element.name,
          type: element.subtype,
          content: (_element_element = element.element) !== null && _element_element !== void 0 ? _element_element : element
        };
      }
      function toViolations(violations) {
        return violations.map(toViolation);
      }
    }
  });

  // ../package/main/rules/FlowName.js
  var require_FlowName = __commonJS({
    "../package/main/rules/FlowName.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "FlowName", {
        enumerable: true,
        get: function() {
          return FlowName;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      var _regexscanner = require_regex_scanner();
      var _RegexAdapter = require_RegexAdapter();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var FlowName = class FlowName extends _RuleCommon.RuleCommon {
        check(flow, options, _suppressions) {
          const metadataFile = (0, _RegexAdapter.toMetadataFile)(flow);
          const regexViolations = this.regexRule.execute(metadataFile, {
            expression: options === null || options === void 0 ? void 0 : options.expression
          });
          return (0, _RegexAdapter.toViolations)(regexViolations);
        }
        constructor() {
          super({
            ruleId: "invalid-naming-convention",
            category: "layout",
            description: "Using clear and consistent Flow names improves readability, discoverability, and maintainability. A good naming convention helps team members quickly understand a Flow's purpose\u2014for example, including a domain and brief description like Service_OrderFulfillment. Adopt a naming pattern that aligns with your organization's standards.",
            summary: "Consistent naming improves Flow discoverability and maintainability",
            docRefs: [
              {
                label: "Naming your Flows is more critical than ever. By Stephen Church",
                path: "https://www.linkedin.com/posts/stephen-n-church_naming-your-flows-this-is-more-critical-activity-7099733198175158274-1sPx"
              }
            ],
            label: "Flow Naming Convention",
            name: "FlowName",
            supportedTypes: _internals.FlowType.allTypes(),
            configurableOptions: [
              {
                name: "expression",
                type: "expression",
                description: "Regex pattern for valid Flow names",
                defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"
              }
            ]
          }, {
            severity: "error"
          }), _define_property(this, "regexRule", new _regexscanner.NamingConvention());
        }
      };
    }
  });

  // ../package/main/rules/GetRecordAllFields.js
  var require_GetRecordAllFields = __commonJS({
    "../package/main/rules/GetRecordAllFields.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "GetRecordAllFields", {
        enumerable: true,
        get: function() {
          return GetRecordAllFields;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var GetRecordAllFields = class GetRecordAllFields extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          var _flow_elements;
          var _flow_elements_filter;
          const lookupNodes = (_flow_elements_filter = (_flow_elements = flow.elements) === null || _flow_elements === void 0 ? void 0 : _flow_elements.filter((e) => e.subtype === "recordLookups")) !== null && _flow_elements_filter !== void 0 ? _flow_elements_filter : [];
          const violations = lookupNodes.filter((node) => {
            const el = node.element;
            const storeAllFields = typeof el === "object" && "storeOutputAutomatically" in el && el.storeOutputAutomatically;
            const queriedFields = el.queriedFields;
            const hasQueriedFields = queriedFields && (Array.isArray(queriedFields) && queriedFields.length > 0 || typeof queriedFields === "string");
            return storeAllFields && !hasQueriedFields;
          }).map((node) => new _internals.Violation(node));
          return violations;
        }
        constructor() {
          super({
            ruleId: "get-record-all-fields",
            category: "suggestion",
            description: "Avoid using Get Records to retrieve all fields unless necessary. This improves performance, reduces processing time, and limits exposure of unnecessary data.",
            summary: "Retrieving all fields harms performance and security",
            docRefs: [
              {
                label: "Get Records Stores All Fields",
                path: "https://developer.salesforce.com/docs/atlas.en-us.salesforce_large_data_volumes_bp.meta/salesforce_large_data_volumes_bp/ldv_deployments_best_practices_soql_and_sosl.htm"
              },
              {
                label: "Indexes | Best Practices",
                path: "https://developer.salesforce.com/docs/atlas.en-us.salesforce_large_data_volumes_bp.meta/salesforce_large_data_volumes_bp/ldv_deployments_infrastructure_indexes.htm"
              }
            ],
            label: "Get Record All Fields",
            name: "GetRecordAllFields",
            supportedTypes: _internals.FlowType.allTypes()
          }, {
            severity: "warning"
          });
        }
      };
    }
  });

  // ../package/main/rules/HardcodedId.js
  var require_HardcodedId2 = __commonJS({
    "../package/main/rules/HardcodedId.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedId", {
        enumerable: true,
        get: function() {
          return HardcodedId;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      var _regexscanner = require_regex_scanner();
      var _RegexAdapter = require_RegexAdapter();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var HardcodedId = class HardcodedId extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const metadataFile = (0, _RegexAdapter.toMetadataFile)(flow);
          const regexViolations = this.regexRule.execute(metadataFile);
          return (0, _RegexAdapter.toViolations)(regexViolations);
        }
        constructor() {
          super({
            ruleId: "hardcoded-id",
            name: "HardcodedId",
            category: "problem",
            label: "Hardcoded Id",
            description: "Avoid hard-coding record IDs, as they are unique to a specific org and will not work in other environments. Instead, store IDs in variables\u2014such as merge-field URL parameters or a **Get Records** element\u2014to make the Flow portable, maintainable, and flexible.",
            summary: "Hardcoded IDs break portability across environments",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: [
              {
                label: "Flow Best Practices",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_prep_bestpractices.htm&type=5"
              },
              {
                label: "Don't hard code Record Type IDs in Flow. By Stephen Church.",
                path: "https://www.linkedin.com/feed/update/urn:li:activity:6947530300012826624/"
              }
            ]
          }, {
            severity: "error"
          }), _define_property(this, "regexRule", new _regexscanner.HardcodedId());
        }
      };
    }
  });

  // ../package/main/rules/HardcodedUrl.js
  var require_HardcodedUrl2 = __commonJS({
    "../package/main/rules/HardcodedUrl.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedUrl", {
        enumerable: true,
        get: function() {
          return HardcodedUrl;
        }
      });
      var _internals = require_internals();
      var _RuleCommon = require_RuleCommon();
      var _regexscanner = require_regex_scanner();
      var _RegexAdapter = require_RegexAdapter();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      var HardcodedUrl = class HardcodedUrl extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const metadataFile = (0, _RegexAdapter.toMetadataFile)(flow);
          const regexViolations = this.regexRule.execute(metadataFile);
          return (0, _RegexAdapter.toViolations)(regexViolations);
        }
        constructor() {
          super({
            ruleId: "hardcoded-url",
            category: "problem",
            description: "Avoid hard-coding URLs, as they may change between environments or over time. Instead, store URLs in variables or custom settings to make the Flow adaptable, maintainable, and environment-independent.",
            summary: "Hardcoded URLs break across different environments",
            docRefs: [
              {
                label: "The Ultimate Guide to Salesforce Flow Best Practices",
                path: "https://admin.salesforce.com/blog/2021/the-ultimate-guide-to-flow-best-practices-and-standards"
              },
              {
                label: "Why You Should Avoid Hard Coding and Three Alternative Solutions",
                path: "https://admin.salesforce.com/blog/2021/why-you-should-avoid-hard-coding-and-three-alternative-solutions"
              }
            ],
            label: "Hardcoded Url",
            name: "HardcodedUrl",
            supportedTypes: _internals.FlowType.allTypes()
          }, {
            severity: "error"
          }), _define_property(this, "regexRule", new _regexscanner.HardcodedUrl());
        }
      };
    }
  });

  // ../package/main/rules/HardcodedSecret.js
  var require_HardcodedSecret2 = __commonJS({
    "../package/main/rules/HardcodedSecret.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HardcodedSecret", {
        enumerable: true,
        get: function() {
          return HardcodedSecret;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      var _regexscanner = require_regex_scanner();
      var _RegexAdapter = require_RegexAdapter();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var HardcodedSecret = class HardcodedSecret extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const metadataFile = (0, _RegexAdapter.toMetadataFile)(flow);
          const regexViolations = this.regexRule.execute(metadataFile);
          return (0, _RegexAdapter.toViolations)(regexViolations);
        }
        constructor() {
          super({
            ruleId: "hardcoded-secret",
            name: "HardcodedSecret",
            category: "problem",
            label: "Hardcoded Secret",
            description: "Avoid hardcoding secrets, API keys, tokens, or credentials in Flows. These should be stored securely in Named Credentials, Custom Settings, Custom Metadata, or external secret management systems.",
            summary: "Hardcoded secrets pose security risks",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: [
              {
                label: "Salesforce Named Credentials",
                path: "https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm"
              },
              {
                label: "OWASP Secrets Management Cheat Sheet",
                path: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
              }
            ]
          }, {
            severity: "error"
          }), _define_property(this, "regexRule", new _regexscanner.HardcodedSecret());
        }
      };
    }
  });

  // ../package/main/rules/InactiveFlow.js
  var require_InactiveFlow = __commonJS({
    "../package/main/rules/InactiveFlow.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "InactiveFlow", {
        enumerable: true,
        get: function() {
          return InactiveFlow;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var InactiveFlow = class InactiveFlow extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          if (flow.status !== "Active") {
            return [
              new _internals.Violation(new _internals.FlowAttribute(flow.status, "status", "!= Active"))
            ];
          }
          return [];
        }
        constructor() {
          super({
            ruleId: "inactive-flow",
            category: "suggestion",
            name: "InactiveFlow",
            label: "Inactive Flow",
            description: "Inactive Flows should be deleted or archived to reduce risk. Even when inactive, they can cause unintended record changes during testing or be activated as subflows. Keeping only active, relevant Flows improves safety and maintainability.",
            summary: "Inactive Flows should be deleted or archived",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: []
          });
        }
      };
    }
  });

  // ../package/main/rules/MissingFaultPath.js
  var require_MissingFaultPath = __commonJS({
    "../package/main/rules/MissingFaultPath.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MissingFaultPath", {
        enumerable: true,
        get: function() {
          return MissingFaultPath;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var MissingFaultPath = class MissingFaultPath extends _RuleCommon.RuleCommon {
        isValidSubtype(proxyNode) {
          if (!this.applicableElements.includes(proxyNode.subtype)) {
            return false;
          }
          if (proxyNode.subtype === "waits") {
            var _proxyNode_element;
            const elementSubtype = (_proxyNode_element = proxyNode.element) === null || _proxyNode_element === void 0 ? void 0 : _proxyNode_element["elementSubtype"];
            const excludedSubtypes = [
              "WaitDuration",
              "WaitDate"
            ];
            return !excludedSubtypes.includes(elementSubtype);
          }
          return true;
        }
        check(flow, _options, suppressions) {
          var _flow_graph;
          const results = [];
          const elementsWhereFaultPathIsApplicable = flow.elements.filter((node) => {
            const proxyNode = node;
            return this.isValidSubtype(proxyNode);
          }).map((e) => e.name);
          const isRecordBeforeSave = this.isRecordBeforeSaveFlow(flow);
          const visitCallback = (element) => {
            var _element_connectors;
            if (!(element === null || element === void 0 ? void 0 : (_element_connectors = element.connectors) === null || _element_connectors === void 0 ? void 0 : _element_connectors.find((connector) => connector.type === "faultConnector")) && elementsWhereFaultPathIsApplicable.includes(element.name)) {
              if (isRecordBeforeSave && element.subtype === "recordUpdates") {
                return;
              }
              if (!this.isPartOfFaultHandlingFlow(element, flow)) {
                if (!suppressions.has(element.name)) {
                  results.push(new _internals.Violation(element));
                }
              }
            }
          };
          (_flow_graph = flow.graph) === null || _flow_graph === void 0 ? void 0 : _flow_graph.forEachReachable(visitCallback);
          return results;
        }
        /**
        *  Determine if this is a RecordBeforeSave flow.
        */
        isRecordBeforeSaveFlow(flow) {
          var _flow_startNode;
          if ((_flow_startNode = flow.startNode) === null || _flow_startNode === void 0 ? void 0 : _flow_startNode.element) {
            var _flow_startNode_element;
            const triggerType = (_flow_startNode_element = flow.startNode.element) === null || _flow_startNode_element === void 0 ? void 0 : _flow_startNode_element["triggerType"];
            if (triggerType === "RecordBeforeSave") {
              return true;
            }
          }
          return false;
        }
        isPartOfFaultHandlingFlow(element, flow) {
          var _flow_graph;
          return ((_flow_graph = flow.graph) === null || _flow_graph === void 0 ? void 0 : _flow_graph.isPartOfFaultHandling(element.name)) || false;
        }
        constructor() {
          super({
            ruleId: "missing-fault-path",
            category: "problem",
            description: "Elements that can fail should include a Fault Path to handle errors gracefully. Without it, failures show generic errors to users. Fault Paths improve reliability and user experience.",
            summary: "Fault Paths enable graceful error handling",
            docRefs: [
              {
                label: "Flow Best Practices",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_prep_bestpractices.htm&type=5"
              }
            ],
            label: "Missing Fault Path",
            name: "MissingFaultPath",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ]
          }), _define_property(this, "applicableElements", [
            "recordLookups",
            "recordDeletes",
            "recordUpdates",
            "recordCreates",
            "waits",
            "actionCalls",
            "apexPluginCalls"
          ]);
        }
      };
    }
  });

  // ../package/main/rules/MissingNullHandler.js
  var require_MissingNullHandler = __commonJS({
    "../package/main/rules/MissingNullHandler.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MissingNullHandler", {
        enumerable: true,
        get: function() {
          return MissingNullHandler;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var MissingNullHandler = class MissingNullHandler extends _RuleCommon.RuleCommon {
        check(flow, _options, suppressions) {
          const getOperations = [
            "recordLookups"
          ];
          const getOperationElements = flow.elements.filter((node) => node.metaType === "node" && getOperations.includes(node.subtype));
          const decisionElements = flow.elements.filter((node) => node.metaType === "node" && node.subtype === "decisions");
          const violations = [];
          for (const getElement of getOperationElements) {
            var _getElement_connectors;
            if (suppressions.has(getElement.name)) continue;
            const elementName = getElement.name;
            const assignNulls = String(getElement.element["assignNullValuesIfNoRecordsFound"]).toLowerCase() === "true";
            const hasFaultConnector = !!getElement.element["faultConnector"] || ((_getElement_connectors = getElement.connectors) === null || _getElement_connectors === void 0 ? void 0 : _getElement_connectors.some((c) => c.type === "faultConnector"));
            if (!assignNulls && hasFaultConnector) {
              continue;
            }
            const resultReferences = [];
            if (getElement.element["storeOutputAutomatically"]) {
              resultReferences.push(elementName);
            } else if (getElement.element["outputReference"]) {
              resultReferences.push(getElement.element["outputReference"]);
            } else if (getElement.element["outputAssignments"]) {
              const assignments = getElement.element["outputAssignments"];
              for (const a of assignments) {
                resultReferences.push(a.assignToReference);
              }
            }
            const resultIsUsed = flow.elements.some((el) => {
              if (el.name === getElement.name) return false;
              const json = JSON.stringify(el.element);
              return resultReferences.some((ref) => json.includes(`"${ref}"`) || json.includes(`"${ref}.`));
            });
            if (!resultIsUsed) continue;
            if (!assignNulls) {
              continue;
            }
            let nullCheckFound = false;
            for (const decision of decisionElements) {
              let rules = decision.element["rules"];
              if (!Array.isArray(rules)) rules = [
                rules
              ];
              for (const rule of rules) {
                let conditions = rule.conditions;
                if (!Array.isArray(conditions)) conditions = [
                  conditions
                ];
                for (const condition of conditions) {
                  var _condition_rightValue;
                  let referenceFound = false;
                  let isNullOperator = false;
                  let checksFalse = false;
                  if (condition.leftValueReference) {
                    const ref = condition.leftValueReference;
                    if (resultReferences.some((r) => ref.startsWith(r))) {
                      referenceFound = true;
                    }
                  }
                  if (condition.operator === "IsNull") {
                    isNullOperator = true;
                  }
                  const rightBool = (_condition_rightValue = condition.rightValue) === null || _condition_rightValue === void 0 ? void 0 : _condition_rightValue.booleanValue;
                  if (rightBool != null && String(rightBool).toLowerCase() === "false") {
                    checksFalse = true;
                  }
                  if (referenceFound && isNullOperator && checksFalse) {
                    nullCheckFound = true;
                    break;
                  }
                }
                if (nullCheckFound) break;
              }
              if (nullCheckFound) break;
            }
            if (!nullCheckFound) {
              violations.push(getElement);
            }
          }
          return violations.map((det) => new _internals.Violation(det));
        }
        constructor() {
          super({
            ruleId: "missing-null-handler",
            category: "problem",
            description: "Get Records operations return null when no data is found. Without handling these null values, Flows can fail or produce unintended results. Adding a null check improves reliability and ensures the Flow behaves as expected.",
            summary: "Null checks prevent failures from missing records",
            docRefs: [],
            label: "Missing Null Handler",
            name: "MissingNullHandler",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ]
          });
        }
      };
    }
  });

  // ../package/main/rules/ProcessBuilder.js
  var require_ProcessBuilder = __commonJS({
    "../package/main/rules/ProcessBuilder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ProcessBuilder", {
        enumerable: true,
        get: function() {
          return ProcessBuilder;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var ProcessBuilder = class ProcessBuilder extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          return [
            new _internals.Violation(new _internals.FlowAttribute("Workflow", "processType", "== Workflow"))
          ];
        }
        constructor() {
          super({
            ruleId: "process-builder-usage",
            category: "problem",
            name: "ProcessBuilder",
            label: "Process Builder",
            description: "Process Builder is retired. Continuing to use it increases maintenance overhead and risks future compatibility issues. Migrating automation to Flow reduces risk and improves maintainability.",
            summary: "Process Builder is retired, migrate to Flow",
            supportedTypes: _internals.FlowType.processBuilder,
            docRefs: [
              {
                label: "Process Builder Retirement",
                path: "https://help.salesforce.com/s/articleView?id=000389396&type=1"
              }
            ]
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/main/rules/RecursiveAfterUpdate.js
  var require_RecursiveAfterUpdate = __commonJS({
    "../package/main/rules/RecursiveAfterUpdate.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RecursiveAfterUpdate", {
        enumerable: true,
        get: function() {
          return RecursiveAfterUpdate;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var RecursiveAfterUpdate = class RecursiveAfterUpdate extends _RuleCommon.RuleCommon {
        check(flow, _options, suppressions) {
          var _flow_elements, _flow_elements_filter, _flow_elements1;
          const results = [];
          const triggerType = this.getStartProperty(flow, "triggerType");
          const recordTriggerType = this.getStartProperty(flow, "recordTriggerType");
          const isAfterSave = triggerType === "RecordAfterSave";
          const isQualifiedTriggerTypes = this.qualifiedRecordTriggerTypes.has(recordTriggerType);
          if (!isAfterSave || !isQualifiedTriggerTypes) {
            return results;
          }
          const potentialElements = (_flow_elements = flow.elements) === null || _flow_elements === void 0 ? void 0 : _flow_elements.filter((node) => node.subtype === "recordUpdates");
          if (potentialElements == null || typeof potentialElements[Symbol.iterator] !== "function") {
            return results;
          }
          for (const node of potentialElements) {
            if (typeof node.element === "object" && "inputReference" in node.element && node.element.inputReference === "$Record") {
              if (!suppressions.has(node.name)) {
                results.push(new _internals.Violation(node));
              }
            }
          }
          const flowObject = this.getStartProperty(flow, "object");
          const lookupElementsWithTheSameObjectType = (_flow_elements1 = flow.elements) === null || _flow_elements1 === void 0 ? void 0 : (_flow_elements_filter = _flow_elements1.filter((node) => node.subtype === "recordLookups" && typeof node.element === "object" && "object" in node.element && flowObject === node.element["object"])) === null || _flow_elements_filter === void 0 ? void 0 : _flow_elements_filter.map((node) => node.name);
          if (lookupElementsWithTheSameObjectType == null || typeof lookupElementsWithTheSameObjectType[Symbol.iterator] !== "function") {
            return results;
          }
          for (const node of potentialElements) {
            if (typeof node.element === "object" && "inputReference" in node.element && lookupElementsWithTheSameObjectType.includes(node.element.inputReference)) {
              if (!suppressions.has(node.name)) {
                results.push(new _internals.Violation(node));
              }
            }
          }
          return results;
        }
        constructor() {
          super({
            ruleId: "recursive-record-update",
            category: "problem",
            description: "After-save Flows that update the same record can trigger recursion, causing unintended behavior or performance issues. Avoid updating the triggering record in after-save Flows; use before-save Flows instead to prevent recursion.",
            summary: "After-save updates to same record trigger recursion",
            docRefs: [
              {
                label: "Learn about same record field updates",
                path: "https://architect.salesforce.com/decision-guides/trigger-automation#Same_Record_Field_Updates"
              }
            ],
            label: "Recursive After Update",
            name: "RecursiveAfterUpdate",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes
            ]
          }, {
            severity: "warning"
          }), _define_property(this, "qualifiedRecordTriggerTypes", /* @__PURE__ */ new Set([
            "Create",
            "CreateAndUpdate",
            "Update"
          ]));
        }
      };
    }
  });

  // ../package/main/rules/SameRecordFieldUpdates.js
  var require_SameRecordFieldUpdates = __commonJS({
    "../package/main/rules/SameRecordFieldUpdates.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "SameRecordFieldUpdates", {
        enumerable: true,
        get: function() {
          return SameRecordFieldUpdates;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var SameRecordFieldUpdates = class SameRecordFieldUpdates extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          var _flow_elements;
          const results = [];
          const triggerType = this.getStartProperty(flow, "triggerType");
          const recordTriggerType = this.getStartProperty(flow, "recordTriggerType");
          const isBeforeSaveType = triggerType === "RecordBeforeSave";
          const isQualifiedTriggerTypes = this.qualifiedRecordTriggerTypes.has(recordTriggerType);
          if (!isBeforeSaveType || !isQualifiedTriggerTypes) {
            return results;
          }
          const potentialElements = (_flow_elements = flow.elements) === null || _flow_elements === void 0 ? void 0 : _flow_elements.filter((node) => node.subtype === "recordUpdates");
          if (!potentialElements) return results;
          for (const node of potentialElements) {
            if (typeof node.element === "object" && "inputReference" in node.element && node.element.inputReference === "$Record") {
              results.push(new _internals.Violation(node));
            }
          }
          return results;
        }
        constructor() {
          super({
            ruleId: "same-record-field-updates",
            category: "suggestion",
            name: "SameRecordFieldUpdates",
            label: "Same Record Field Updates",
            description: "Before-save Flows can safely update the triggering record directly via $Record, applying changes efficiently without extra DML operations. Using before-save updates improves performance",
            summary: "Before-save Flows can update $Record directly",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes
            ],
            docRefs: [
              {
                label: "Learn about same record field updates",
                path: "https://architect.salesforce.com/decision-guides/trigger-automation#Same_Record_Field_Updates"
              }
            ]
          }, {
            severity: "warning"
          }), _define_property(this, "qualifiedRecordTriggerTypes", /* @__PURE__ */ new Set([
            "Create",
            "Update",
            "CreateAndUpdate"
          ]));
        }
      };
    }
  });

  // ../package/main/rules/SOQLQueryInLoop.js
  var require_SOQLQueryInLoop = __commonJS({
    "../package/main/rules/SOQLQueryInLoop.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "SOQLQueryInLoop", {
        enumerable: true,
        get: function() {
          return SOQLQueryInLoop;
        }
      });
      var _internals = require_internals();
      var _LoopRuleCommon = require_LoopRuleCommon();
      var SOQLQueryInLoop = class SOQLQueryInLoop extends _LoopRuleCommon.LoopRuleCommon {
        getStatementTypes() {
          return [
            "recordLookups"
          ];
        }
        constructor() {
          super({
            ruleId: "soql-in-loop",
            category: "problem",
            description: "Running SOQL queries inside a loop can rapidly exceed query limits and severely degrade performance. Queries should be executed once, with results reused throughout the loop.",
            summary: "SOQL queries inside loop risk governor limits",
            docRefs: [
              {
                label: "Flow Best Practices",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_prep_bestpractices.htm&type=5"
              }
            ],
            label: "SOQL Query In A Loop",
            name: "SOQLQueryInLoop",
            supportedTypes: _internals.FlowType.backEndTypes
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/main/rules/TriggerOrder.js
  var require_TriggerOrder = __commonJS({
    "../package/main/rules/TriggerOrder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "TriggerOrder", {
        enumerable: true,
        get: function() {
          return TriggerOrder;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var TriggerOrder = class TriggerOrder extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const startObject = this.getStartProperty(flow, "object");
          if (!startObject) {
            return [];
          }
          if (!flow.triggerOrder) {
            return [
              new _internals.Violation(new _internals.FlowAttribute("TriggerOrder", "TriggerOrder", "10, 20, 30 ..."))
            ];
          }
          return [];
        }
        constructor() {
          super({
            ruleId: "unspecified-trigger-order",
            category: "suggestion",
            name: "TriggerOrder",
            label: "Missing Trigger Order",
            description: "Record-triggered Flows without a specified Trigger Order may execute in an unpredictable sequence. Setting a Trigger Order ensures your Flows run in the intended order.",
            summary: "Trigger Order ensures predictable execution sequence",
            supportedTypes: [
              _internals.FlowType.autolaunchedType
            ],
            docRefs: [
              {
                label: "Learn more about flow ordering orchestration",
                path: "https://architect.salesforce.com/decision-guides/trigger-automation#Ordering___Orchestration"
              }
            ]
          }, {
            severity: "note"
          });
        }
      };
    }
  });

  // ../package/main/rules/UnconnectedElement.js
  var require_UnconnectedElement = __commonJS({
    "../package/main/rules/UnconnectedElement.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "UnconnectedElement", {
        enumerable: true,
        get: function() {
          return UnconnectedElement;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var UnconnectedElement = class UnconnectedElement extends _RuleCommon.RuleCommon {
        check(flow, _options, suppressions) {
          var _flow_graph;
          const connectedElements = ((_flow_graph = flow.graph) === null || _flow_graph === void 0 ? void 0 : _flow_graph.getReachableElements()) || /* @__PURE__ */ new Set();
          const flowElements = flow.elements.filter((node) => node instanceof _internals.FlowNode);
          const unconnectedElements = flowElements.filter((element) => !connectedElements.has(element.name) && !suppressions.has(element.name));
          return unconnectedElements.map((det) => new _internals.Violation(det));
        }
        constructor() {
          super({
            ruleId: "unreachable-element",
            category: "layout",
            description: "Unconnected elements never execute and add unnecessary clutter. Remove or connect unused Flow elements to keep Flows clean and efficient.",
            summary: "Unconnected elements add clutter without executing",
            docRefs: [],
            label: "Unreachable Element",
            name: "UnconnectedElement",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ],
            isFixable: true
          });
        }
      };
    }
  });

  // ../package/main/rules/UnsafeRunningContext.js
  var require_UnsafeRunningContext = __commonJS({
    "../package/main/rules/UnsafeRunningContext.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "UnsafeRunningContext", {
        enumerable: true,
        get: function() {
          return UnsafeRunningContext;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var UnsafeRunningContext = class UnsafeRunningContext extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          if (!("runInMode" in flow.xmldata)) {
            return [];
          }
          const runInMode = flow.xmldata.runInMode;
          const riskyMode = "SystemModeWithoutSharing";
          if (runInMode === riskyMode) {
            return [
              new _internals.Violation(new _internals.FlowAttribute(runInMode, "runInMode", `== ${riskyMode}`))
            ];
          }
          return [];
        }
        constructor() {
          super({
            ruleId: "unsafe-running-context",
            category: "problem",
            name: "UnsafeRunningContext",
            label: "Unsafe Running Context",
            description: "Flows configured to run in System Mode without Sharing grant access to all data, bypassing user permissions. Avoid this setting to prevent security risks and protect sensitive data.",
            summary: "System mode without sharing creates security risks",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ],
            docRefs: [
              {
                label: "Learn about data safety when running flows in system context in Salesforce Help",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_distribute_context_data_safety_system_context.htm&type=5"
              }
            ]
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/main/rules/UnusedVariable.js
  var require_UnusedVariable = __commonJS({
    "../package/main/rules/UnusedVariable.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "UnusedVariable", {
        enumerable: true,
        get: function() {
          return UnusedVariable;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var UnusedVariable = class UnusedVariable extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const variables = flow.elements.filter((node) => node instanceof _internals.FlowVariable);
          const unusedVariables = [];

          // Create JSON string of all non-variable flow elements (nodes, formulas, text templates, constants)
          const otherElements = flow.elements.filter((node) => !(node instanceof _internals.FlowVariable));
          const otherElementsJson = JSON.stringify(otherElements);

          for (const variable of variables) {
            const variableName = variable.name;
            if (!variableName) continue;

            const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Check if variable is referenced in formulas, text templates, decisions, screens, assignments, etc.
            const refRegex = new RegExp(`(\\{!\\s*${escapedName}(?:\\.[a-zA-Z0-9_]+)*\\s*\\}|\\b${escapedName}\\b)`, 'i');

            if (!refRegex.test(otherElementsJson)) {
              unusedVariables.push(variable);
            }
          }
          return unusedVariables.map((variable) => new _internals.Violation(variable));
        }
        constructor() {
          super({
            ruleId: "unused-variable",
            category: "layout",
            name: "UnusedVariable",
            label: "Unused Variable",
            description: "Unused variables are never referenced and add unnecessary clutter. Remove them to keep Flows efficient and easy to maintain.",
            summary: "Unused variables add clutter and hurt maintainability",
            supportedTypes: [
              ..._internals.FlowType.backEndTypes,
              ..._internals.FlowType.visualTypes
            ],
            docRefs: [],
            isFixable: true
          });
        }
      };
    }
  });

  // ../package/main/rules/MissingMetadataDescription.js
  var require_MissingMetadataDescription = __commonJS({
    "../package/main/rules/MissingMetadataDescription.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MissingMetadataDescription", {
        enumerable: true,
        get: function() {
          return MissingMetadataDescription;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var MissingMetadataDescription = class MissingMetadataDescription extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppression) {
          const violations = [];
          flow.elements.filter((elem) => {
            if (elem.metaType !== "attribute" && !elem.element["description"] && elem.subtype !== "start") {
              return elem;
            }
          }).forEach((elem) => {
            return violations.push(new _internals.Violation(elem));
          });
          return violations;
        }
        constructor() {
          super({
            ruleId: "missing-metadata-description",
            category: "layout",
            description: "Elements and metadata without a description reduce clarity and maintainability. Adding descriptions improves readability and makes your automation easier to understand.",
            summary: "Element descriptions improve clarity and maintainability",
            docRefs: [],
            label: "Missing Metadata Description",
            name: "MissingMetadataDescription",
            supportedTypes: _internals.FlowType.allTypes()
          }, {
            severity: "warning"
          });
        }
      };
    }
  });

  // ../package/main/rules/MissingRecordTriggerFilter.js
  var require_MissingRecordTriggerFilter = __commonJS({
    "../package/main/rules/MissingRecordTriggerFilter.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MissingRecordTriggerFilter", {
        enumerable: true,
        get: function() {
          return MissingRecordTriggerFilter;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var MissingRecordTriggerFilter = class MissingRecordTriggerFilter extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          var _flow_xmldata_start, _flow_xmldata;
          const violations = [];
          const triggerType = this.getStartProperty(flow, "triggerType");
          if (!triggerType || ![
            "RecordAfterSave",
            "RecordBeforeSave"
          ].includes(triggerType)) {
            return violations;
          }
          const filters = this.getStartProperty(flow, "filters");
          const filterFormula = this.getStartProperty(flow, "filterFormula");
          const hasFilters = !!filters;
          const hasFilterFormula = !!filterFormula;
          const scheduledPaths = (_flow_xmldata = flow.xmldata) === null || _flow_xmldata === void 0 ? void 0 : (_flow_xmldata_start = _flow_xmldata.start) === null || _flow_xmldata_start === void 0 ? void 0 : _flow_xmldata_start.scheduledPaths;
          const hasScheduledPaths = !!scheduledPaths;
          if (!hasFilters && !hasFilterFormula && !hasScheduledPaths) {
            violations.push(new _internals.Violation(new _internals.FlowAttribute(triggerType, "triggerType", "autolaunched && triggerType")));
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "missing-record-trigger-filter",
            category: "suggestion",
            name: "MissingRecordTriggerFilter",
            label: "Missing Filter Record Trigger",
            description: "Record-triggered Flows without filters on changed fields or entry conditions execute on every record change. Adding filters ensures the Flow runs only when needed, improving performance.",
            summary: "Filters ensure Flows run only when needed",
            supportedTypes: [
              _internals.FlowType.autolaunchedType
            ],
            docRefs: []
          }, {
            severity: "warning"
          });
        }
      };
    }
  });

  // ../package/main/rules/MissingStartReference.js
  var require_MissingStartReference = __commonJS({
    "../package/main/rules/MissingStartReference.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "MissingStartReference", {
        enumerable: true,
        get: function() {
          return MissingStartReference;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var MissingStartReference = class MissingStartReference extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const violations = [];
          if (!flow.startNode) {
            violations.push(new _internals.Violation(new _internals.FlowAttribute("undefined", "startNode", "startNode")));
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "missing-start-reference",
            category: "system",
            name: "MissingStartReference",
            label: "Missing Start Reference",
            description: "When a flow has no start reference.",
            summary: "Ensure flow has a start reference node",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: []
          }, {
            severity: "error"
          });
        }
      };
    }
  });

  // ../package/main/rules/TransformInsteadOfLoop.js
  var require_TransformInsteadOfLoop = __commonJS({
    "../package/main/rules/TransformInsteadOfLoop.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "TransformInsteadOfLoop", {
        enumerable: true,
        get: function() {
          return TransformInsteadOfLoop;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var TransformInsteadOfLoop = class TransformInsteadOfLoop extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          const violations = [];
          const triggerType = this.getStartProperty(flow, "triggerType");
          const isRecordBeforeSave = triggerType === "RecordBeforeSave";
          if (isRecordBeforeSave) {
            return violations;
          }
          const loops = flow.graph.getLoopNodes();
          for (const loopNode of loops) {
            const nextElements = flow.graph.getNextElements(loopNode.name);
            for (const nextElementName of nextElements) {
              const nextElement = flow.graph.getNode(nextElementName);
              if ((nextElement === null || nextElement === void 0 ? void 0 : nextElement.subtype) === "assignments") {
                violations.push(new _internals.Violation(loopNode));
                break;
              }
            }
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "transform-instead-of-loop",
            category: "suggestion",
            name: "TransformInsteadOfLoop",
            label: "Transform Instead of Loop",
            description: "Loop elements that perform direct Assignments on each item can slow down Flows. Using Transform elements allows bulk operations on collections, improving performance and reducing complexity.",
            summary: "Transform elements enable faster bulk operations",
            supportedTypes: _internals.FlowType.allTypes(),
            docRefs: [
              {
                label: "Transform Multiple Records - Trailhead",
                path: "https://trailhead.salesforce.com/content/learn/modules/multirecord-elements-and-transforms-in-flows/transform-multiple-records"
              }
            ]
          }, {
            severity: "note"
          });
        }
      };
    }
  });

  // ../package/main/rules/RecordIdAsString.js
  var require_RecordIdAsString = __commonJS({
    "../package/main/rules/RecordIdAsString.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RecordIdAsString", {
        enumerable: true,
        get: function() {
          return RecordIdAsString;
        }
      });
      var _internals = /* @__PURE__ */ _interop_require_wildcard(require_internals());
      var _RuleCommon = require_RuleCommon();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
          return {
            default: obj
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null
        };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      var RecordIdAsString = class RecordIdAsString extends _RuleCommon.RuleCommon {
        check(flow, _options, _suppressions) {
          var _flow_elements;
          const violations = [];
          const triggerType = this.getStartProperty(flow, "triggerType");
          const isRecordTriggered = triggerType === "RecordAfterSave" || triggerType === "RecordBeforeDelete" || triggerType === "RecordBeforeSave";
          if (isRecordTriggered) {
            return violations;
          }
          const variables = (_flow_elements = flow.elements) === null || _flow_elements === void 0 ? void 0 : _flow_elements.filter((e) => e.subtype === "variables");
          for (const variable of variables) {
            const varElement = variable.element;
            if ((varElement.isInput === true || varElement.isInput === "true") && variable.name.toLowerCase() === "recordid" && varElement.dataType === "String") {
              violations.push(new _internals.Violation(variable));
            }
          }
          return violations;
        }
        constructor() {
          super({
            ruleId: "record-id-as-string",
            category: "suggestion",
            name: "RecordIdAsString",
            label: "Record ID as String",
            description: "Flows that use a String variable for a record ID instead of receiving the full record introduce unnecessary complexity and additional Get Records queries. Using the complete record simplifies the Flow and improves performance.",
            summary: "String record IDs add complexity and queries",
            supportedTypes: [
              ..._internals.FlowType.visualTypes,
              _internals.FlowType.autolaunchedType
            ],
            docRefs: [
              {
                label: "Screen Flow Distribution",
                path: "https://help.salesforce.com/s/articleView?id=sf.flow_distribute_screen.htm"
              }
            ]
          }, {
            severity: "note"
          });
        }
      };
    }
  });

  // ../package/main/config/RuleRegistry.js
  var require_RuleRegistry2 = __commonJS({
    "../package/main/config/RuleRegistry.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ruleRegistry", {
        enumerable: true,
        get: function() {
          return ruleRegistry;
        }
      });
      var _ActionCallsInLoop = require_ActionCallsInLoop();
      var _APIVersion = require_APIVersion();
      var _AutoLayout = require_AutoLayout();
      var _CognitiveComplexity = require_CognitiveComplexity();
      var _CopyAPIName = require_CopyAPIName();
      var _CyclomaticComplexity = require_CyclomaticComplexity();
      var _DMLStatementInLoop = require_DMLStatementInLoop();
      var _DuplicateDMLOperation = require_DuplicateDMLOperation();
      var _FlowDescription = require_FlowDescription();
      var _FlowName = require_FlowName();
      var _GetRecordAllFields = require_GetRecordAllFields();
      var _HardcodedId = require_HardcodedId2();
      var _HardcodedUrl = require_HardcodedUrl2();
      var _HardcodedSecret = require_HardcodedSecret2();
      var _InactiveFlow = require_InactiveFlow();
      var _MissingFaultPath = require_MissingFaultPath();
      var _MissingNullHandler = require_MissingNullHandler();
      var _ProcessBuilder = require_ProcessBuilder();
      var _RecursiveAfterUpdate = require_RecursiveAfterUpdate();
      var _SameRecordFieldUpdates = require_SameRecordFieldUpdates();
      var _SOQLQueryInLoop = require_SOQLQueryInLoop();
      var _TriggerOrder = require_TriggerOrder();
      var _UnconnectedElement = require_UnconnectedElement();
      var _UnsafeRunningContext = require_UnsafeRunningContext();
      var _UnusedVariable = require_UnusedVariable();
      var _MissingMetadataDescription = require_MissingMetadataDescription();
      var _MissingRecordTriggerFilter = require_MissingRecordTriggerFilter();
      var _MissingStartReference = require_MissingStartReference();
      var _TransformInsteadOfLoop = require_TransformInsteadOfLoop();
      var _RecordIdAsString = require_RecordIdAsString();
      function _define_property(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _object_spread(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};
          var ownKeys2 = Object.keys(source);
          if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys2 = ownKeys2.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
              return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
          }
          ownKeys2.forEach(function(key) {
            _define_property(target, key, source[key]);
          });
        }
        return target;
      }
      function ownKeys(object, enumerableOnly) {
        var keys = Object.keys(object);
        if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(object);
          if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
              return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
          }
          keys.push.apply(keys, symbols);
        }
        return keys;
      }
      function _object_spread_props(target, source) {
        source = source != null ? source : {};
        if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
        return target;
      }
      var RuleRegistry = class RuleRegistry {
        register(ruleId, ruleClass, legacyName, isBeta = false) {
          const entry = {
            ruleId,
            ruleClass,
            legacyName,
            isBeta
          };
          this.rules.set(ruleId, entry);
          this.legacyNameMap.set(legacyName, ruleId);
        }
        get(idOrLegacyName) {
          let entry = this.rules.get(idOrLegacyName);
          if (!entry) {
            const ruleId = this.legacyNameMap.get(idOrLegacyName);
            if (ruleId) {
              entry = this.rules.get(ruleId);
            }
          }
          return entry;
        }
        getAllRuleIds(includeBeta = false) {
          return Array.from(this.rules.values()).filter((entry) => includeBeta || !entry.isBeta).map((entry) => entry.ruleId);
        }
        has(idOrLegacyName) {
          return this.get(idOrLegacyName) !== void 0;
        }
        createInstance(idOrLegacyName) {
          const entry = this.get(idOrLegacyName);
          if (!entry) {
            throw new Error(`Rule not found: ${idOrLegacyName}`);
          }
          return new entry.ruleClass();
        }
        getRules(ruleConfig, options) {
          const includeBeta = (options === null || options === void 0 ? void 0 : options.betaMode) === true || (options === null || options === void 0 ? void 0 : options.betamode) === true;
          const rulesMode = (options === null || options === void 0 ? void 0 : options.ruleMode) || "merged";
          const selectedRules = [];
          if (rulesMode === "isolated" && ruleConfig && ruleConfig.size > 0) {
            for (const key of ruleConfig.keys()) {
              const entry = this.get(key);
              if (!entry) continue;
              const config = ruleConfig.get(key);
              if ((config === null || config === void 0 ? void 0 : config.enabled) === false) continue;
              const rule = this.createInstance(entry.ruleId);
              if (config === null || config === void 0 ? void 0 : config.severity) {
                rule.severity = config.severity;
              }
              selectedRules.push(rule);
            }
            return selectedRules;
          }
          const allRuleIds = this.getAllRuleIds(includeBeta);
          for (const ruleId of allRuleIds) {
            const rule = this.createInstance(ruleId);
            var _ruleConfig_get;
            const config = (_ruleConfig_get = ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.get(rule.ruleId)) !== null && _ruleConfig_get !== void 0 ? _ruleConfig_get : ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.get(rule.name);
            if ((config === null || config === void 0 ? void 0 : config.enabled) === false) continue;
            if (config === null || config === void 0 ? void 0 : config.severity) {
              rule.severity = config.severity;
            }
            selectedRules.push(rule);
          }
          return selectedRules;
        }
        getRulesByNames(ruleNames, options) {
          if (!ruleNames || ruleNames.length === 0) {
            return this.getRules(void 0, options);
          }
          const config = /* @__PURE__ */ new Map();
          for (const identifier of ruleNames) {
            const entry = this.get(identifier);
            if (entry) {
              config.set(entry.ruleId, {
                enabled: true
              });
            }
          }
          return this.getRules(config, _object_spread_props(_object_spread({}, options), {
            ruleMode: "isolated"
          }));
        }
        constructor() {
          _define_property(this, "rules", /* @__PURE__ */ new Map());
          _define_property(this, "legacyNameMap", /* @__PURE__ */ new Map());
        }
      };
      var registry = new RuleRegistry();
      registry.register("action-call-in-loop", _ActionCallsInLoop.ActionCallsInLoop, "ActionCallsInLoop");
      registry.register("invalid-api-version", _APIVersion.APIVersion, "APIVersion");
      registry.register("missing-auto-layout", _AutoLayout.AutoLayout, "AutoLayout");
      registry.register("unclear-api-naming", _CopyAPIName.CopyAPIName, "CopyAPIName");
      registry.register("cognitive-complexity", _CognitiveComplexity.CognitiveComplexity, "CognitiveComplexity", true);
      registry.register("excessive-cyclomatic-complexity", _CyclomaticComplexity.CyclomaticComplexity, "CyclomaticComplexity");
      registry.register("dml-in-loop", _DMLStatementInLoop.DMLStatementInLoop, "DMLStatementInLoop");
      registry.register("duplicate-dml", _DuplicateDMLOperation.DuplicateDMLOperation, "DuplicateDMLOperation");
      registry.register("missing-flow-description", _FlowDescription.FlowDescription, "FlowDescription");
      registry.register("invalid-naming-convention", _FlowName.FlowName, "FlowName");
      registry.register("get-record-all-fields", _GetRecordAllFields.GetRecordAllFields, "GetRecordAllFields");
      registry.register("hardcoded-id", _HardcodedId.HardcodedId, "HardcodedId");
      registry.register("hardcoded-url", _HardcodedUrl.HardcodedUrl, "HardcodedUrl");
      registry.register("inactive-flow", _InactiveFlow.InactiveFlow, "InactiveFlow");
      registry.register("missing-fault-path", _MissingFaultPath.MissingFaultPath, "MissingFaultPath");
      registry.register("missing-null-handler", _MissingNullHandler.MissingNullHandler, "MissingNullHandler");
      registry.register("process-builder-usage", _ProcessBuilder.ProcessBuilder, "ProcessBuilder");
      registry.register("recursive-record-update", _RecursiveAfterUpdate.RecursiveAfterUpdate, "RecursiveAfterUpdate");
      registry.register("same-record-field-updates", _SameRecordFieldUpdates.SameRecordFieldUpdates, "SameRecordFieldUpdates");
      registry.register("soql-in-loop", _SOQLQueryInLoop.SOQLQueryInLoop, "SOQLQueryInLoop");
      registry.register("unspecified-trigger-order", _TriggerOrder.TriggerOrder, "TriggerOrder");
      registry.register("unreachable-element", _UnconnectedElement.UnconnectedElement, "UnconnectedElement");
      registry.register("unsafe-running-context", _UnsafeRunningContext.UnsafeRunningContext, "UnsafeRunningContext");
      registry.register("unused-variable", _UnusedVariable.UnusedVariable, "UnusedVariable");
      registry.register("missing-metadata-description", _MissingMetadataDescription.MissingMetadataDescription, "MissingMetadataDescription", true);
      registry.register("missing-record-trigger-filter", _MissingRecordTriggerFilter.MissingRecordTriggerFilter, "MissingFilterRecordTrigger", true);
      registry.register("missing-start-reference", _MissingStartReference.MissingStartReference, "MissingStartReference", true);
      registry.register("transform-instead-of-loop", _TransformInsteadOfLoop.TransformInsteadOfLoop, "TransformInsteadOfLoop", true);
      registry.register("record-id-as-string", _RecordIdAsString.RecordIdAsString, "RecordIdAsString", true);
      registry.register("hardcoded-secret", _HardcodedSecret.HardcodedSecret, "HardcodedSecret", true);
      var ruleRegistry = registry;
    }
  });

  // ../package/main/libs/GetRuleDefinitions.js
  var require_GetRuleDefinitions = __commonJS({
    "../package/main/libs/GetRuleDefinitions.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get GetRuleDefinitions() {
          return GetRuleDefinitions;
        },
        get getRules() {
          return getRules2;
        }
      });
      var _RuleRegistry = require_RuleRegistry2();
      function GetRuleDefinitions(ruleConfig, options) {
        const includeBeta = (options === null || options === void 0 ? void 0 : options.betaMode) === true || (options === null || options === void 0 ? void 0 : options.betamode) === true;
        const includeSystem = (options === null || options === void 0 ? void 0 : options.systemRules) !== false;
        const categories = options === null || options === void 0 ? void 0 : options.categories;
        const rulesMode = (options === null || options === void 0 ? void 0 : options.ruleMode) || "merged";
        const selectedRules = [];
        const ruleIds = _RuleRegistry.ruleRegistry.getAllRuleIds(includeBeta);
        if (rulesMode === "isolated" && ruleConfig && ruleConfig.size > 0) {
          for (const key of ruleConfig.keys()) {
            const entry = _RuleRegistry.ruleRegistry.get(key);
            if (!entry) continue;
            const config = ruleConfig.get(key);
            if ((config === null || config === void 0 ? void 0 : config.enabled) === false) continue;
            const rule = _RuleRegistry.ruleRegistry.createInstance(entry.ruleId);
            if (rule.category === "system" && !includeSystem) continue;
            if (!isCategoryIncluded(rule.category, categories, includeSystem)) continue;
            if (config === null || config === void 0 ? void 0 : config.severity) {
              rule.severity = config.severity;
            }
            selectedRules.push(rule);
          }
          return selectedRules;
        }
        for (const ruleId of ruleIds) {
          const rule = _RuleRegistry.ruleRegistry.createInstance(ruleId);
          if (rule.category === "system" && !includeSystem) continue;
          if (!isCategoryIncluded(rule.category, categories, includeSystem)) continue;
          var _ruleConfig_get;
          const config = (_ruleConfig_get = ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.get(rule.ruleId)) !== null && _ruleConfig_get !== void 0 ? _ruleConfig_get : ruleConfig === null || ruleConfig === void 0 ? void 0 : ruleConfig.get(rule.name);
          if ((config === null || config === void 0 ? void 0 : config.enabled) === false) continue;
          if (config === null || config === void 0 ? void 0 : config.severity) {
            rule.severity = config.severity;
          }
          selectedRules.push(rule);
        }
        return selectedRules;
      }
      function isCategoryIncluded(ruleCategory, categories, includeSystem) {
        if (ruleCategory === "system") {
          return includeSystem;
        }
        if (!categories || categories.length === 0) {
          return true;
        }
        const normalizedCategories = categories.map((c) => c.toLowerCase());
        return normalizedCategories.includes(ruleCategory === null || ruleCategory === void 0 ? void 0 : ruleCategory.toLowerCase());
      }
      function getRules2(ruleNames, options) {
        return _RuleRegistry.ruleRegistry.getRulesByNames(ruleNames, options);
      }
    }
  });

  // ../package/main/libs/RuleDocumentation.js
  var require_RuleDocumentation = __commonJS({
    "../package/main/libs/RuleDocumentation.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get getRuleDocumentationUrl() {
          return getRuleDocumentationUrl;
        },
        get labelToAnchor() {
          return labelToAnchor;
        }
      });
      function labelToAnchor(label) {
        return label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
      }
      function getRuleDocumentationUrl(label, customUrl) {
        if (customUrl) {
          return customUrl;
        }
        const anchor = labelToAnchor(label);
        return `https://flow-scanner.github.io/lightning-flow-scanner/#${anchor}`;
      }
    }
  });

  // ../package/main/libs/ScanFlows.js
  var require_ScanFlows = __commonJS({
    "../package/main/libs/ScanFlows.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: Object.getOwnPropertyDescriptor(all, name).get
        });
      }
      _export(exports, {
        get ScanFlows() {
          return ScanFlows2;
        },
        get scan() {
          return scan2;
        }
      });
      var _internals = require_internals();
      var _IRulesConfig = require_IRulesConfig();
      var _Violation = require_Violation();
      var _GetRuleDefinitions = require_GetRuleDefinitions();
      var _RuleDocumentation = require_RuleDocumentation();
      function getRuleConfigByIdOrName(rule, rulesConfig) {
        if (!rulesConfig) return void 0;
        return rulesConfig[rule.ruleId] || rulesConfig[rule.name];
      }
      function getSuppressionsForRule(rule, flowName, exceptions) {
        if (!(exceptions === null || exceptions === void 0 ? void 0 : exceptions[flowName])) return [];
        const flowExceptions = exceptions[flowName];
        const rawSuppressions = flowExceptions[rule.ruleId] || flowExceptions[rule.name];
        return (rawSuppressions === null || rawSuppressions === void 0 ? void 0 : rawSuppressions.includes("*")) ? [
          "*"
        ] : rawSuppressions !== null && rawSuppressions !== void 0 ? rawSuppressions : [];
      }
      function scan2(parsedFlows, ruleOptions) {
        const flows = [];
        const ignoreFlows = (ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.ignoreFlows) || [];
        for (const flow of parsedFlows) {
          if (!flow.errorMessage && flow.flow) {
            if (ignoreFlows.length > 0 && ignoreFlows.includes(flow.flow.name)) {
              continue;
            }
            flows.push(flow.flow);
          }
        }
        const scanResults = ScanFlows2(flows, ruleOptions);
        return scanResults;
      }
      function ScanFlows2(flows, ruleOptions) {
        const flowResults = [];
        const rawMode = ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.detailLevel;
        const detailLevel = typeof rawMode === "string" && rawMode.toLowerCase() === "simple" ? _IRulesConfig.DetailLevel.SIMPLE : _IRulesConfig.DetailLevel.ENRICHED;
        let ruleMap = void 0;
        if ((ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.rules) && Object.keys(ruleOptions.rules).length > 0) {
          ruleMap = /* @__PURE__ */ new Map();
          for (const [ruleName, config] of Object.entries(ruleOptions.rules)) {
            ruleMap.set(ruleName, config);
          }
        }
        const selectedRules = (0, _GetRuleDefinitions.GetRuleDefinitions)(ruleMap, ruleOptions);
        const flowXmlCache = /* @__PURE__ */ new Map();
        for (const flowInput of flows) {
          const flow = flowInput instanceof _internals.Flow ? flowInput : _internals.Flow.from(flowInput);
          const ruleResults = [];
          for (const rule of selectedRules) {
            try {
              if (!rule.supportedTypes.includes(flow.type)) {
                ruleResults.push(new _internals.RuleResult(rule, []));
                continue;
              }
              const config = getRuleConfigByIdOrName(rule, ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.rules);
              const suppressions = getSuppressionsForRule(rule, flow.name, ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.exceptions);
              const result = config && Object.keys(config).length > 0 ? rule.execute(flow, config, suppressions) : rule.execute(flow, void 0, suppressions);
              if (config && typeof config === "object" && "message" in config && typeof config.message === "string") {
                result.message = config.message;
              } else {
                result.message = result.ruleDefinition.summary || result.ruleDefinition.description;
              }
              const customUrl = config && typeof config === "object" && "messageUrl" in config && typeof config.messageUrl === "string" ? config.messageUrl : void 0;
              result.messageUrl = (0, _RuleDocumentation.getRuleDocumentationUrl)(result.ruleDefinition.label, customUrl);
              if (result.details.length > 0) {
                let flowXml = flowXmlCache.get(flow.name);
                if (!flowXml) {
                  flowXml = flow.toXMLString();
                  flowXmlCache.set(flow.name, flowXml);
                }
                if (flowXml) {
                  (0, _Violation.enrichViolationsWithLineNumbers)(result.details, flowXml);
                }
              }
              ruleResults.push(result);
            } catch (error) {
              const message = `Something went wrong while executing ${rule.name} in the Flow: ${flow.name} with error ${error}`;
              ruleResults.push(new _internals.RuleResult(rule, [], message));
            }
          }
          flowResults.push(new _internals.ScanResult(flow, ruleResults));
          flowXmlCache.delete(flow.name);
        }
        flowXmlCache.clear();
        if (detailLevel === _IRulesConfig.DetailLevel.SIMPLE) {
          flowResults.forEach((scanResult) => {
            scanResult.ruleResults.forEach((ruleResult) => {
              ruleResult.details.forEach((violation) => {
                delete violation.details;
              });
            });
          });
        }
        const threshold = ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.threshold;
        if (threshold && threshold !== "never") {
          for (const scanResult of flowResults) {
            scanResult.ruleResults = scanResult.ruleResults.filter((ruleResult) => {
              const config = getRuleConfigByIdOrName(ruleResult.ruleDefinition, ruleOptions === null || ruleOptions === void 0 ? void 0 : ruleOptions.rules);
              const severity = (config === null || config === void 0 ? void 0 : config.severity) || ruleResult.severity || "warning";
              return (0, _IRulesConfig.meetsThreshold)(severity, threshold);
            });
          }
        }
        return flowResults;
      }
    }
  });

  // entry.js
  var entry_exports = {};
  __export(entry_exports, {
    Flow: () => import_internals.Flow,
    FlowType: () => import_internals.FlowType,
    RuleResult: () => import_internals.RuleResult,
    ScanFlows: () => import_ScanFlows.ScanFlows,
    ScanResult: () => import_internals.ScanResult,
    Violation: () => import_internals.Violation,
    getRules: () => import_GetRuleDefinitions.GetRuleDefinitions,
    scan: () => import_ScanFlows.scan
  });
  var import_internals = __toESM(require_internals());
  var import_ScanFlows = __toESM(require_ScanFlows());
  var import_GetRuleDefinitions = __toESM(require_GetRuleDefinitions());
  return __toCommonJS(entry_exports);
})();
