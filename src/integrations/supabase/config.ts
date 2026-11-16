// Supabase connection settings, read at build time from the VITE_* variables
// of the committed `.env` file (Cloudflare Pages builds with that file).
// To point the app to another Supabase project, change `.env` only.

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  projectRef: string;
}

type Env = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_PROJECT_ID', string>>;

// Project ref of a legacy anon key (JWT): its payload carries `ref`.
// New-style publishable keys (sb_publishable_…) are not JWTs: returns null.
export function keyProjectRef(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const ref = JSON.parse(json)?.ref;
    return typeof ref === 'string' ? ref : null;
  } catch {
    return null;
  }
}

/**
 * Validates the settings so a half-done project switch (URL of one project,
 * key or project id of another) fails loudly at startup instead of
 * producing confusing auth/RLS errors at runtime.
 */
export function resolveSupabaseConfig(env: Env): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error('Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  }

  let projectRef: string;
  try {
    projectRef = new URL(url).hostname.split('.')[0];
  } catch {
    throw new Error(`Supabase config invalid: VITE_SUPABASE_URL is not a URL (${url})`);
  }

  const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
  if (projectId && projectId !== projectRef) {
    throw new Error(`Supabase config mismatch: VITE_SUPABASE_PROJECT_ID (${projectId}) differs from the URL project (${projectRef})`);
  }
  const keyRef = keyProjectRef(publishableKey);
  if (keyRef && keyRef !== projectRef) {
    throw new Error(`Supabase config mismatch: VITE_SUPABASE_PUBLISHABLE_KEY belongs to project ${keyRef}, URL is project ${projectRef}`);
  }

  return { url, publishableKey, projectRef };
}
