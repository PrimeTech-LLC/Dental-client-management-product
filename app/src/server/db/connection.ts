/**
 * Neon Postgres connection — @neondatabase/serverless.
 *
 * SEC-05 FIX: The previous `transaction()` implementation sent BEGIN / COMMIT
 * as separate HTTP requests.  Because the Neon HTTP driver is stateless, each
 * call goes to a different ephemeral connection so BEGIN had no effect and the
 * "transaction" was not atomic.
 *
 * The correct approach for the Neon HTTP driver is to use the built-in
 * `sql.transaction()` helper which batches all statements in a single
 * HTTP round-trip and guarantees true ACID atomicity.
 *
 * For single (non-transactional) queries we continue to use `sql()` directly.
 */
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

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
 * All calls are collected and sent as a single batched HTTP request to Neon,
 * which guarantees atomicity (all succeed or all roll back).
 *
 * IMPORTANT: because Neon's HTTP transaction API requires all SQL statements
 * to be provided up-front, we collect them eagerly, then fire them in one
 * batch.  The callback must therefore be a series of awaited `q()` calls
 * whose return values are used only *after* all statements are registered —
 * exactly the usage pattern in this codebase.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  // Collect every statement the callback issues.
  const statements: { text: string; params: any[] }[] = [];
  const results: any[][] = [];

  // Proxy `q` that records statements instead of executing them immediately.
  const recordingQ = async (text: string, params: any[] = []): Promise<any[]> => {
    const idx = statements.length;
    statements.push({ text, params });
    // Return a placeholder — the real result will be filled in after execution.
    const placeholder: any[] = [];
    results.push(placeholder);
    return placeholder;
  };

  // Run the callback in recording mode to discover all statements.
  let callbackResult: T;
  try {
    callbackResult = await fn(recordingQ as unknown as typeof query);
  } catch (err) {
    throw err;
  }

  if (statements.length === 0) {
    return callbackResult;
  }

  // Execute all statements in a single atomic HTTP transaction via Neon.
  try {
    const batchResults = await sql.transaction(
      statements.map(s => sql(s.text, s.params))
    );

    // Back-fill real row arrays into the placeholder arrays so any caller
    // that holds a reference to the placeholder gets the real data.
    batchResults.forEach((rows: any[], i: number) => {
      results[i].push(...rows);
    });
  } catch (err: any) {
    console.error('[DB] Transaction error:', err.message);
    throw err;
  }

  return callbackResult;
}
