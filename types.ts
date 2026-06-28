
export interface ReceiptItem {
  id: string;
  name: string;
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
}
