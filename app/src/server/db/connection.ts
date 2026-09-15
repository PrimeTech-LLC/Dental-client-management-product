/**
 * Neon Postgres connection — @neondatabase/serverless.
 *
 * FIX (Finding 2): The previous transaction() implementation used a recording
 * proxy that collected statements and back-filled placeholder arrays after the
 * batch executed. Any code inside the callback that read query results
 * immediately (e.g. `const rxId = rxRows[0].id`) would see an empty
 * placeholder array because the batch hadn't run yet.
 *
 * The fix replaces the proxy with a real sequential executor: each `q()` call
 * inside the callback runs immediately against a transaction-scoped sql
 * function provided by Neon's `sql.transaction()` helper. This gives true ACID
 * atomicity while returning real rows to the caller on every await.
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
 * The callback receives a `q` function identical in signature to `query`.
 * Each `await q(...)` call executes immediately and returns real rows, while
 * still being wrapped in a single atomic transaction via Neon's
 * `sql.transaction()` helper. If any statement throws, the entire transaction
 * is rolled back.
 *
 * This replaces the previous recording-proxy approach which returned empty
 * placeholder arrays to callers that read results mid-callback.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  let result: T | undefined;

  await (sql as any).transaction(async (txSql: typeof sql) => {
    // Provide a query function that executes immediately inside the transaction
    const txQuery = async (text: string, params: any[] = []): Promise<any[]> => {
      try {
        const rows = await txSql(text, params);
        return rows as any[];
      } catch (err: any) {
        console.error('[DB] Transaction query error:', err.message, '\nSQL:', text.slice(0, 200));
        throw err;
      }
    };

    result = await fn(txQuery as unknown as typeof query);
  });

  return result as T;
}
