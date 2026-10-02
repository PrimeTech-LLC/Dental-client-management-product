/**
 * Neon Postgres connection — @neondatabase/serverless (WebSocket transport).
 *
 * We deliberately use the WebSocket-based `Client` rather than the HTTP-based
 * `neon()` function.  The HTTP transport sends every `sql()` call as an
 * independent fetch request to a stateless endpoint, which means BEGIN/COMMIT/
 * ROLLBACK are silently no-ops — each goes to a different backend connection.
 *
 * The `Client` (WebSocket) transport maintains a single persistent connection
 * for the lifetime of the JavaScript Client instance, giving us real ACID
 * transactions via explicit BEGIN / COMMIT / ROLLBACK.
 *
 * References:
 *   https://github.com/neondatabase/serverless#sessions-transactions-and-node-postgres-compatibility
 */

import { Client, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Provide the WebSocket constructor so the driver can open a WS connection
// in Node.js (Node does not have a built-in WebSocket until v21).
neonConfig.webSocketConstructor = ws;

// ─── Single-statement query helper ────────────────────────────────────────────

/**
 * Run a parameterised query using a short-lived Client connection.
 * For a single query this is equivalent to the old neon() HTTP call but goes
 * over WebSocket, which is required for real session / transaction support.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = new Client(process.env.DATABASE_URL!);
  try {
    await client.connect();
    const result = await client.query(text, params ?? []);
    return result.rows as T[];
  } catch (err: any) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text.slice(0, 200));
    throw err;
  } finally {
    await client.end().catch(() => {}); // always release the connection
  }
}

// ─── Transaction helper ────────────────────────────────────────────────────────

/**
 * Execute multiple statements inside a real ACID transaction.
 *
 * Opens a single WebSocket Client connection, issues BEGIN, runs the user
 * callback (which receives a `q` helper bound to the same connection), then
 * COMMITs on success or ROLLBACKs on error — all over the same connection so
 * every statement is part of the same Postgres transaction.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  const client = new Client(process.env.DATABASE_URL!);
  await client.connect();

  // A query helper scoped to this specific client connection (= this transaction).
  const txQuery = async (text: string, params: any[] = []): Promise<any[]> => {
    try {
      const result = await client.query(text, params);
      return result.rows;
    } catch (err: any) {
      console.error('[DB] Transaction query error:', err.message, '\nSQL:', text.slice(0, 200));
      throw err;
    }
  };

  try {
    await client.query('BEGIN');
    const result = await fn(txQuery as unknown as typeof query);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw err;
  } finally {
    await client.end().catch(() => {}); // always release the connection
  }
}
