export class Constants {
  static PromptTemplateSOQL = "GenerateSOQL";
  static PromptTemplateFlow = "DescribeFlow";
  static PromptTemplateDebugLog = "AnalyzeDebugLog";
}

export class StorageHistory {
  constructor(storageKey, max, options = {}) {
    this.storageKey = storageKey;
    this.max = max;
    this.options = {
      isValidEntry: (e) => typeof e === "object",
      matchAdd: null,
      matchRemove: null,
      sortComparator: null,
      addToFront: true,
      ...options
    };
    this.list = this._get();
  }
  _get() {
    let list;
    try {
      const stored = localStorage.getItem(this.storageKey);
      list = stored ? JSON.parse(stored) : [];
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    list = list.filter(this.options.isValidEntry);
    if (this.options.sortComparator) list.sort(this.options.sortComparator);
    this.list = list;
    return list;
  }
  add(entry) {
    let list = this._get();
    const match = this.options.matchAdd || ((e, ent) => e.key === ent.key);
    const idx = list.findIndex((e) => match(e, entry));
    if (idx > -1) list.splice(idx, 1);
    if (this.options.addToFront) list.splice(0, 0, entry);
    else list.push(entry);
    if (this.options.sortComparator) list.sort(this.options.sortComparator);
    if (list.length > this.max) list.pop();
    localStorage.setItem(this.storageKey, JSON.stringify(list));
    this.list = list;
  }
  remove(entry) {
    let list = this._get();
    const match = this.options.matchRemove || this.options.matchAdd || ((e, ent) => e.key === ent.key);
    const idx = list.findIndex((e) => match(e, entry));
    if (idx > -1) list.splice(idx, 1);
    localStorage.setItem(this.storageKey, JSON.stringify(list));
    this.list = list;
  }
  clear() {
    localStorage.removeItem(this.storageKey);
    this.list = [];
  }
}

export function getLinkTarget() { return "_blank"; }
export function nullToEmptyString(v) { return v == null ? "" : v; }
export function isOptionEnabled() { return true; }

export function createSpinForMethod(context) {
  return function (promise) {
    context.spinnerCount++;
    return Promise.resolve(promise)
      .catch((err) => { console.error("spinFor", err); })
      .then(() => {
        context.spinnerCount--;
        if (context.didUpdate) context.didUpdate();
      });
  };
}

export class UserInfoModel {
  constructor() {
    this.userInfo = "...";
    this.userFullName = "Test User";
    this.userInitials = "TU";
    this.userName = "test.user";
    this.userError = null;
    this.userErrorDescription = null;
  }
  getProps() {
    return {
      userInitials: this.userInitials,
      userFullName: this.userFullName,
      userName: this.userName,
      userError: this.userError,
      userErrorDescription: this.userErrorDescription
    };
  }
}

export class PromptTemplate {
  constructor(promptName) { this.promptName = promptName; }
  async generate() { return { success: false, error: "stub" }; }
}

export function copyToClipboard() {}
export function downloadCsvFile() {}
