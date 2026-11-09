import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The part of expo-sqlite the app uses. Depending on this narrow type (instead of the
 * whole database class) lets the tests run the real queries against Node's built-in SQLite.
 */
export type Db = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'
>;

export const DATABASE_NAME = 'workout-log.db';
