// Thin wrapper around the browser Contacts Picker API.
//
// This API lets a web app open the OS native contact picker and read back the
// contacts the user selects. It is only available on Chrome/Edge on Android in a
// secure context — iOS Safari and all desktop browsers lack it — so callers must
// feature-detect with `contactsPickerSupported()` and hide their UI when false.
//
// TypeScript ships no built-in types for this API, so we declare the minimal
// shape we use here.

import { downscaleImage } from './image';

interface ContactInfo {
  name?: string[];
  icon?: Blob[];
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfo[]>;
  getProperties?(): Promise<string[]>;
}

type NavigatorWithContacts = Navigator & { contacts?: ContactsManager };

// A contact picked from the OS picker, reduced to what we use: a display name and
// (when the contact had one and the platform exposes it) a small avatar data URL.
export interface PickedContact {
  name: string;
  photo?: string;
}

// True only where the picker is actually usable. Checking both `navigator.contacts`
// and the `ContactsManager` constructor avoids false positives on partial impls.
export const contactsPickerSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

// Turn the first non-empty contact icon blob into a small, JPEG-compressed data
// URL suitable for storing inline with the person. Returns undefined on any
// failure so a bad/oversized photo never blocks the import.
const blobToThumbnail = async (icon: Blob[] | undefined): Promise<string | undefined> => {
  const blob = (icon ?? []).find((b) => b && b.size > 0);
  if (!blob) return undefined;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    // Aggressive downscale: these render at <=48px, so 96px keeps them crisp on
    // hi-dpi while staying a few KB — safe to keep in localStorage per person.
    return await downscaleImage(dataUrl, 96, 0.7);
  } catch {
    return undefined;
  }
};

// Open the OS contact picker and return the trimmed name (and photo, when
// available) of every selected contact. Returns [] if unsupported, on
// user-cancel, or on any error — so callers can treat "nothing picked" and
// "picker unavailable" the same way.
export const pickContacts = async (): Promise<PickedContact[]> => {
  if (!contactsPickerSupported()) return [];
  try {
    const manager = (navigator as NavigatorWithContacts).contacts!;
    // 'icon' isn't supported on every platform that has the picker; only request
    // it when getProperties advertises it, else the whole select() can reject.
    const available = manager.getProperties ? await manager.getProperties() : ['name'];
    const props = ['name', ...(available.includes('icon') ? ['icon'] : [])];

    const contacts = await manager.select(props, { multiple: true });
    const picked = await Promise.all(
      contacts.map(async (c) => {
        const name = (c.name ?? []).map((n) => n.trim()).find((n) => n.length > 0) ?? '';
        const photo = await blobToThumbnail(c.icon);
        return { name, photo };
      }),
    );
    // Keep contacts with a usable name or a photo (a photo-only contact still
    // adds a person; the name falls back to the default downstream).
    return picked.filter((c) => c.name.length > 0 || c.photo);
  } catch {
    // The picker rejects on cancel and on permission/availability errors; treat
    // all of them as "no selection".
    return [];
  }
};
