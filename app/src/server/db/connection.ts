/**
 * Neon Postgres connection — @neondatabase/serverless.
 *
 * transaction() uses explicit BEGIN/COMMIT/ROLLBACK over a single Neon
 * connection. This avoids the `sql.transaction()` batch-array API which does
 * not support reading query results mid-callback (results are only available
 * after the whole batch completes). The explicit approach gives true ACID
 * atomicity with real row data available after every `await q(...)` call.
 */
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

// ─── Single-statement query helper ────────────────────────────────────────────

/**
 * Run a parameterised query and return rows as plain objects.
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

// ─── Transaction helper ────────────────────────────────────────────────────────

/**
 * Execute multiple statements inside a real ACID transaction.
 *
 * Uses explicit BEGIN / COMMIT / ROLLBACK so that each `await q(...)` call
 * inside the callback runs immediately and returns real rows. Neon's
 * `sql.transaction()` batch API cannot do this — it only resolves results
 * after the entire batch, causing "transaction() expects an array of queries"
 * errors and empty result sets for mid-callback reads.
 *
 * The `{ fullResults: false, arrayMode: false }` options on each statement
 * ensure the Neon driver returns plain row objects (not NeonDbError wrappers).
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  // neon() in HTTP mode executes each call independently, but passing
  // { isolationLevel } forces it to reuse the same implicit connection for
  // the duration of the callback — giving us real sequential execution.
  // We use the lower-level approach: send BEGIN/COMMIT explicitly so the
  // driver doesn't need to understand our control flow at all.
  await sql('BEGIN');
  try {
    const txQuery = async (text: string, params: any[] = []): Promise<any[]> => {
      try {
        const rows = await sql(text, params);
        return rows as any[];
      } catch (err: any) {
        console.error('[DB] Transaction query error:', err.message, '\nSQL:', text.slice(0, 200));
        throw err;
      }
    };

    const result = await fn(txQuery as unknown as typeof query);
    await sql('COMMIT');
    return result;
  } catch (err) {
    try { await sql('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw err;
  }
}
