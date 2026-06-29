
export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  originalPrice: number;
}

export interface ProcessedReceipt {
  items: ReceiptItem[];
  total: number;
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface AssignmentState {
  // Map of itemId -> array of personIds
  [itemId: string]: string[];
}

export interface AppState {
  step: 'upload' | 'analyzing' | 'splitting';
  receiptImage: string | null;
  items: ReceiptItem[];
  total: number;
  discount: number; // Discount as a percentage (0-100)
  assignments: AssignmentState;
  people: Person[];
  error: string | null;
  // Manual entry mode: no receipt was scanned, so there is no authoritative
  // receipt total to scale items against — the total is simply the sum of the
  // items the user types in. See computeStats for how this changes the math.
  manualEntry: boolean;
  // Manual entry only: an optional user-supplied grand total that overrides the
  // auto-computed items sum. null means "track the items sum automatically";
  // a number means the user pinned a total (e.g. to fold in a global discount
  // or extra charge not present on any line), and items scale to match it just
  // like a scanned receipt total. Ignored when manualEntry is false.
  manualTotalOverride: number | null;
}
