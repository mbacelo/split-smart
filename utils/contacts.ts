// Thin wrapper around the browser Contacts Picker API.
//
// This API lets a web app open the OS native contact picker and read back the
// contacts the user selects. It is only available on Chrome/Edge on Android in a
// secure context — iOS Safari and all desktop browsers lack it — so callers must
// feature-detect with `contactsPickerSupported()` and hide their UI when false.
//
// TypeScript ships no built-in types for this API, so we declare the minimal
// shape we use here.

interface ContactInfo {
  name?: string[];
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfo[]>;
}

type NavigatorWithContacts = Navigator & { contacts?: ContactsManager };

// True only where the picker is actually usable. Checking both `navigator.contacts`
// and the `ContactsManager` constructor avoids false positives on partial impls.
export const contactsPickerSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

// Open the OS contact picker and return the trimmed display names of every
// selected contact. Returns [] if unsupported, on user-cancel, or on any error —
// so callers can treat "nothing picked" and "picker unavailable" the same way.
export const pickContactNames = async (): Promise<string[]> => {
  if (!contactsPickerSupported()) return [];
  try {
    const contacts = await (navigator as NavigatorWithContacts).contacts!.select(['name'], { multiple: true });
    return contacts
      .map((c) => (c.name ?? []).map((n) => n.trim()).find((n) => n.length > 0) ?? '')
      .filter((n) => n.length > 0);
  } catch {
    // The picker rejects on cancel and on permission/availability errors; treat
    // all of them as "no selection".
    return [];
  }
};
