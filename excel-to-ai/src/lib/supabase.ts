import { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Permissive client type — the `excel_to_ai` schema isn't in a generated
// Database type yet, so we let supabase-js infer schema-name freely.
type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

declare global {
  // eslint-disable-next-line no-var
  var __excelToAiPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __excelToAiAnonClient: AnySupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __excelToAiServiceClient: AnySupabaseClient | undefined;
}

/**
 * Server-side Postgres pool scoped to the `excel_to_ai` schema via the
 * `lp_excel_to_ai` role. `search_path` is set on the role itself so queries
 * don't need to prefix the schema name.
 *
 * Returns null when EXCEL_TO_AI_DB_URL is not configured — callers should
 * fall back to the legacy JSON store in that case.
 */
export function getPool(): Pool | null {
  const url = process.env.EXCEL_TO_AI_DB_URL;
  if (!url) return null;

  if (!globalThis.__excelToAiPgPool) {
    globalThis.__excelToAiPgPool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis.__excelToAiPgPool;
}

/**
 * Anon Supabase JS client — for any reads from the browser or for places
 * where RLS-aware access is preferred over the privileged pg pool.
 * Uses the publishable key, which is safe to ship in client bundles.
 */
export function getAnonClient(): AnySupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  if (!globalThis.__excelToAiAnonClient) {
    globalThis.__excelToAiAnonClient = createClient(url, key, {
      db: { schema: 'excel_to_ai' },
      auth: { persistSession: false },
    });
  }
  return globalThis.__excelToAiAnonClient ?? null;
}

/**
 * Server-side Supabase client using the secret/service-role key. Bypasses RLS,
 * so use sparingly and never import this file from a client component.
 */
export function getServiceClient(): AnySupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  if (!globalThis.__excelToAiServiceClient) {
    globalThis.__excelToAiServiceClient = createClient(url, key, {
      db: { schema: 'excel_to_ai' },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return globalThis.__excelToAiServiceClient ?? null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.EXCEL_TO_AI_DB_URL);
}
