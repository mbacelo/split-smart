import { describe, it, expect } from 'vitest';
import { COLOR_PALETTE, nextPersonColor, defaultPersonName, createPerson } from './personColors';
import { Person } from '../types';

const person = (name: string, color: string, id = name): Person => ({ id, name, color });

describe('nextPersonColor', () => {
  it('hands out the first palette color when none are used', () => {
    expect(nextPersonColor([])).toBe(COLOR_PALETTE[0]);
  });

  it('skips colors already in use', () => {
    const existing = [person('Ana', COLOR_PALETTE[0]), person('Ben', COLOR_PALETTE[1])];
    expect(nextPersonColor(existing)).toBe(COLOR_PALETTE[2]);
  });

  it('cycles the palette once every color is taken', () => {
    const existing = COLOR_PALETTE.map((c, i) => person(`P${i}`, c));
    expect(nextPersonColor(existing)).toBe(COLOR_PALETTE[existing.length % COLOR_PALETTE.length]);
  });
});

describe('defaultPersonName', () => {
  it('numbers one past the highest existing default-style name', () => {
    const existing = [person('Person #1', 'blue'), person('Person #3', 'green')];
    expect(defaultPersonName(existing)).toBe('Person #4');
  });

  it('falls back to list length + 1 when no default-style names exist', () => {
    const existing = [person('Ana', 'blue'), person('Ben', 'green')];
    expect(defaultPersonName(existing)).toBe('Person #3');
  });

  it('ignores custom names that merely contain a number', () => {
    const existing = [person('Table 9', 'blue')];
    expect(defaultPersonName(existing)).toBe('Person #2');
  });

  it('starts at Person #1 for an empty list', () => {
    expect(defaultPersonName([])).toBe('Person #1');
  });
});

describe('createPerson', () => {
  it('builds a person with a unique id, default name, and unused color', () => {
    const existing = [person('Person #1', COLOR_PALETTE[0])];
    const created = createPerson(existing);
    expect(created.id).toBeTruthy();
    expect(created.id).not.toBe(existing[0].id);
    expect(created.name).toBe('Person #2');
    expect(created.color).toBe(COLOR_PALETTE[1]);
  });

  it('uses an explicit name when given one', () => {
    expect(createPerson([], 'Carla').name).toBe('Carla');
  });
});
