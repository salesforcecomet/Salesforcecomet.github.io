export function Enumerable(iterable) { return iterable; }

export function DescribeInfo() {
  return {
    describeGlobal: () => ({ globalStatus: null, globalDescribe: null }),
    describeSobject: () => ({ sobjectStatus: null, sobjectDescribe: null }),
    reloadAll: () => {}
  };
}

export function s(num, suffix = "s") { return num === 1 ? "" : suffix; }

export function initScrollTable() { return { dataChange: () => {}, viewportChange: () => {} }; }
