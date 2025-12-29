/**
 * =============================================================================
 * DATABASE CONNECTION MODULE
 * =============================================================================
 * 
 * Provides a shared Drizzle database connection for direct queries.
 * This is used by the vector store adapters and other services that need
 * raw database access.
 * 
 * TEACHING NOTES:
 * ---------------
 * This module creates a singleton database connection pool:
 * - Pool manages multiple connections efficiently
 * - Connections are reused rather than created for each query
 * - Idle connections are closed after 30 seconds
 * 
 * For most operations, use the storage interface instead of direct db access.
 * =============================================================================
 */

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let _db: NodePgDatabase | null = null;
let _pool: Pool | null = null;

/**
 * Get the shared Drizzle database instance
 * Creates the connection pool on first call (lazy initialization)
 */
export function getDb(): NodePgDatabase {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });

    _pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err.message);
    });

    _db = drizzle(_pool);
    console.log("[db] Database connection pool created");
  }

  return _db;
}

/**
 * Alias for getDb() - provides direct db access
 * Named export for convenience in imports
 */
export const db = {
  execute: async (query: any) => {
    return getDb().execute(query);
  },
};

/**
 * Close the database connection pool
 * Call this on graceful shutdown
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    console.log("[db] Database connection pool closed");
  }
}
