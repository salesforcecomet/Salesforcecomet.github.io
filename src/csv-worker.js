import {csvParse} from "./csv-parse.js";

self.onmessage = async event => {
  try {
    const {file, separator: configuredSeparator = ","} = event.data || {};
    if (!file) throw new Error("No file selected");
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8", {fatal: true}).decode(buffer).replace(/^\uFEFF/, "");
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      JSON.parse(text);
      self.postMessage({format: "json", text});
      return;
    }
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const format = firstLine.includes("\t") ? "excel" : "csv";
    const separator = format === "excel" ? "\t" : configuredSeparator;
    const data = csvParse(text, separator);
    self.postMessage({format, separator, data});
  } catch (error) {
    self.postMessage({error: error instanceof TypeError ? "The file is not valid UTF-8" : String(error.message || error)});
  }
};
