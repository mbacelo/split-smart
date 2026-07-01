
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
  // Optional avatar as a data URL, only ever set when a person is imported from
  // the OS contacts picker and that contact had a photo. Downscaled to a small
  // thumbnail (see utils/contacts) so it's cheap to keep inline in localStorage.
  // When absent, the UI falls back to the colored initial/icon.
  photo?: string;
}

export interface AssignmentState {
  // Map of itemId -> array of personIds
  [itemId: string]: string[];
}

export interface UnitWeightState {
  // itemId -> { personId -> weight }. Sparse: only items the user has
  // explicitly weighted appear here, and within one item only the people
  // given an explicit weight. Anyone assigned but absent gets an implicit
  // weight of 1 (equal share), so an empty/missing entry == the plain
  // equal-split behavior. Weights are relative (a 3:2 split of the line
  // total), NOT required to sum to the item's quantity.
  [itemId: string]: { [personId: string]: number };
}

export interface AppState {
  step: 'upload' | 'analyzing' | 'splitting';
  receiptImage: string | null;
  items: ReceiptItem[];
  total: number;
  discount: number; // Discount as a percentage (0-100)
  // Tip added on top of the post-discount total. The user enters it either as a
  // percentage of that total (tipMode 'percent') or as a flat money amount
  // (tipMode 'amount'); `tip` holds the value in whichever unit tipMode selects.
  // The resulting tip money is folded into effectiveTotal in computeStats, so it
  // scales across items the same way a scanned receipt's tip/tax does. 0 = none.
  tip: number;
  tipMode: 'percent' | 'amount';
  assignments: AssignmentState;
  // Optional per-item, per-person consumption weights for splitting a line
  // proportionally instead of equally (e.g. 3 of 5 beers). Additive on top of
  // `assignments`: an item absent here splits equally across its assignees, as
  // before. See UnitWeightState and computeStats.
  unitWeights: UnitWeightState;
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
