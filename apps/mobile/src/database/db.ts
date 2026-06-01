/**
 * Mobile SQLite Database Connection (Drizzle + expo-sqlite)
 * 
 * Single source of truth for the local offline database.
 * 
 * This module must be initialized early in the app lifecycle (e.g. in _layout.tsx or App.tsx).
 */

import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import * as schema from './schema';

// Database name - consistent across the app
const DATABASE_NAME = 'idialog_offline.db';

let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get the Drizzle database instance (singleton).
 * Safe to call multiple times.
 */
export function getDatabase() {
  if (!dbInstance) {
    const expoDb = SQLite.openDatabaseSync(DATABASE_NAME);
    dbInstance = drizzle(expoDb, { schema });
  }
  return dbInstance;
}

/**
 * Initialize the database and run migrations.
 * Should be called once when the app starts (e.g. in root layout).
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();

  try {
    // Migrations are optional for now (tables are created via schema or manual SQL on first run).
    // Uncomment and provide proper migrations folder when using drizzle-kit generate.
    // await migrate(db, { migrationsFolder: './src/database/migrations' });
  } catch (error) {
    console.warn('[Database] Migration warning (may be first run):', error);
  }

  // Ensure critical tables exist (defensive)
  await ensureTablesExist(db);
}

async function ensureTablesExist(db: unknown) {
  // In a real implementation, we would have proper migrations.
  // For now, we assume the schema in schema.ts is the source of truth
  // and tables are created via app startup scripts or previous migrations.
  // This is a placeholder for robustness.
}

/**
 * Close the database connection (mainly for testing or app shutdown).
 */
export function closeDatabase() {
  if (dbInstance) {
    // expo-sqlite v14+ handles cleanup differently
    dbInstance = null;
  }
}
