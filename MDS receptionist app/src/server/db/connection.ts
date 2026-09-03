/**
 * Neon Postgres connection — @neondatabase/serverless with node-fetch.
 *
 * Node 18's built-in fetch (undici) has a connect-timeout bug in some
 * environments. We inject node-fetch as the HTTP transport for the neon
 * driver, which resolves this reliably.
 *
 * On Vercel (edge / Node 20+) the built-in fetch works fine, so this
 * is only needed in local dev with Node 18.
 */
import { neon, neonConfig } from '@neondatabase/serverless';
import nodeFetch from 'node-fetch';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Inject node-fetch so the neon HTTP driver doesn't use undici
neonConfig.fetchFunction = nodeFetch as unknown as typeof fetch;

const sql = neon(process.env.DATABASE_URL);

/**
 * Run a parameterised query. Returns rows as plain objects.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  try {
    const rows = await sql(text, params ?? []);
    return rows as T[];
  } catch (err: any) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text.slice(0, 200));
    throw err;
  }
}

/**
 * Execute a callback inside a BEGIN / COMMIT block.
 * Each statement is a separate HTTPS round-trip (neon HTTP is stateless),
 * so this provides best-effort atomicity for sequential operations.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  await query('BEGIN');
  try {
    const result = await fn(query);
    await query('COMMIT');
    return result;
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    throw err;
  }
}
