import { DatabaseSync } from 'node:sqlite';

import type { Db } from '../db';
import { migrate } from '../schema';

type Param = string | number | null;

/**
 * Wraps Node's built-in SQLite in the same async API the app uses from expo-sqlite,
 * so repository tests run the real SQL against a real (in-memory) database.
 */
export async function createTestDb(): Promise<Db> {
  const sqlite = new DatabaseSync(':memory:');
  const flat = (params: unknown[]): Param[] =>
    (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Param[];

  const db = {
    async execAsync(source: string) {
      sqlite.exec(source);
    },
    async runAsync(source: string, ...params: unknown[]) {
      const r = sqlite.prepare(source).run(...flat(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync(source: string, ...params: unknown[]) {
      return sqlite.prepare(source).get(...flat(params)) ?? null;
    },
    async getAllAsync(source: string, ...params: unknown[]) {
      return sqlite.prepare(source).all(...flat(params));
    },
    async withTransactionAsync(task: () => Promise<void>) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as Db;

  await migrate(db);
  return db;
}
