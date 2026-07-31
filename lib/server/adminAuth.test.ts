import { describe, it, expect, afterEach } from 'vitest';
import { isAdminEmail } from './adminAuth.js';

const OWNER = 'bacelomarcos@gmail.com';

// isAdminEmail reads process.env at call time, so each test sets it and the
// afterEach puts it back — no module reloading needed.
const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = original;
});

describe('isAdminEmail', () => {
  it('falls back to the owner account when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail(OWNER)).toBe(true);
    expect(isAdminEmail('someone@example.com')).toBe(false);
  });

  it('falls back to the owner account when ADMIN_EMAILS is empty or just separators', () => {
    for (const value of ['', '   ', ',', ' , ,']) {
      process.env.ADMIN_EMAILS = value;
      expect(isAdminEmail(OWNER)).toBe(true);
      expect(isAdminEmail('someone@example.com')).toBe(false);
    }
  });

  it('uses ADMIN_EMAILS when configured, replacing the default', () => {
    process.env.ADMIN_EMAILS = 'boss@example.com';
    expect(isAdminEmail('boss@example.com')).toBe(true);
    // An explicit list is authoritative — the default is not silently appended.
    expect(isAdminEmail(OWNER)).toBe(false);
  });

  it('parses a comma-separated list, tolerating whitespace', () => {
    process.env.ADMIN_EMAILS = ' one@example.com ,two@example.com,  three@example.com ';
    expect(isAdminEmail('one@example.com')).toBe(true);
    expect(isAdminEmail('two@example.com')).toBe(true);
    expect(isAdminEmail('three@example.com')).toBe(true);
    expect(isAdminEmail('four@example.com')).toBe(false);
  });

  it('matches case-insensitively on both sides', () => {
    process.env.ADMIN_EMAILS = 'Boss@Example.COM';
    expect(isAdminEmail('boss@example.com')).toBe(true);
    expect(isAdminEmail('BOSS@EXAMPLE.COM')).toBe(true);
  });

  it('rejects empty and whitespace-only input', () => {
    process.env.ADMIN_EMAILS = 'boss@example.com';
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail('   ')).toBe(false);
  });
});
