/**
 * Neon Postgres connection — @neondatabase/serverless.
 *
 * Node 22 has a fully stable built-in fetch, so no node-fetch injection
 * is required. The neon driver uses the global fetch automatically.
 */
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

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
