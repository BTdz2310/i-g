export interface GetPolicyInput {
  RequestId: string;
}

export interface GetPolicyResult {
  Status: string;
  Message: string;
  SerialNumber: string;
  RequestId: string;
  PolicyNumber: string;
  URL: string;
}
