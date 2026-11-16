import { describe, it, expect } from 'vitest';
import { keyProjectRef, resolveSupabaseConfig } from './config';

// Unsigned JWT-shaped key with the given `ref` (only the payload is read).
const fakeKey = (ref: string) =>
  `xx.${btoa(JSON.stringify({ iss: 'supabase', ref, role: 'anon' })).replace(/=+$/, '')}.yy`;

describe('resolveSupabaseConfig', () => {
  const ok = {
    VITE_SUPABASE_URL: 'https://abcproject.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: fakeKey('abcproject'),
    VITE_SUPABASE_PROJECT_ID: 'abcproject',
  };

  it('accepts consistent settings', () => {
    expect(resolveSupabaseConfig(ok)).toMatchObject({ url: ok.VITE_SUPABASE_URL, projectRef: 'abcproject' });
  });

  it('rejects missing values', () => {
    expect(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: ok.VITE_SUPABASE_URL })).toThrow(/missing/);
  });

  it('rejects a key from another project', () => {
    expect(() => resolveSupabaseConfig({ ...ok, VITE_SUPABASE_PUBLISHABLE_KEY: fakeKey('oldproject') })).toThrow(/oldproject/);
  });

  it('rejects a project id that does not match the URL', () => {
    expect(() => resolveSupabaseConfig({ ...ok, VITE_SUPABASE_PROJECT_ID: 'oldproject' })).toThrow(/mismatch/);
  });

  it('accepts non-JWT publishable keys', () => {
    expect(keyProjectRef('sb_publishable_abc123')).toBeNull();
    expect(() => resolveSupabaseConfig({ ...ok, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123' })).not.toThrow();
  });
});

describe('committed .env', () => {
  it('is consistent', () => {
    expect(() => resolveSupabaseConfig(import.meta.env)).not.toThrow();
  });
});
