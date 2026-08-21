export let apiVersion = "60.0";
export let defaultApiVersion = "60.0";
export let sessionError;
export let sfConn = {
  instanceHostname: "test.my.salesforce.com",
  getSession: async () => ({ instanceUrl: "https://test.my.salesforce.com", accessToken: "stub" }),
  rest: async () => { throw new Error("stubbed-rest"); },
  soap: async () => { throw new Error("stubbed-soap"); },
  wsdl: () => ({}),
};
