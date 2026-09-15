/** What a debt sale adds to a completed basket (§12.2). Shared by the till and the debt feature. */
export interface DebtChoice {
  customerId: string;
  limitGrant: string | null;
  limitReason: string | null;
  dueDate: string | null;
}
