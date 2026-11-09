import type { Db } from './db';
import type { LoadType, MuscleGroup } from '@/domain/types';

/** Exercises available on first launch. Users can add their own. */
export const DEFAULT_EXERCISES: [string, MuscleGroup][] = [
  ['Bench Press', 'Chest'],
  ['Incline Dumbbell Press', 'Chest'],
  ['Push-up', 'Chest'],
  ['Cable Fly', 'Chest'],
  ['Deadlift', 'Back'],
  ['Pull-up', 'Back'],
  ['Barbell Row', 'Back'],
  ['Lat Pulldown', 'Back'],
  ['Seated Cable Row', 'Back'],
  ['Back Squat', 'Legs'],
  ['Front Squat', 'Legs'],
  ['Romanian Deadlift', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Walking Lunge', 'Legs'],
  ['Leg Curl', 'Legs'],
  ['Calf Raise', 'Legs'],
  ['Overhead Press', 'Shoulders'],
  ['Lateral Raise', 'Shoulders'],
  ['Face Pull', 'Shoulders'],
  ['Barbell Curl', 'Arms'],
  ['Hammer Curl', 'Arms'],
  ['Triceps Pushdown', 'Arms'],
  ['Dips', 'Arms'],
  ['Plank', 'Core'],
  ['Hanging Leg Raise', 'Core'],
  ['Kettlebell Swing', 'Full body'],
];

/** Load type of the default exercises that are not done with a barbell. */
export const DEFAULT_LOAD_TYPES: Record<string, LoadType> = {
  'Incline Dumbbell Press': 'dumbbell',
  'Lateral Raise': 'dumbbell',
  'Hammer Curl': 'dumbbell',
  'Kettlebell Swing': 'dumbbell',
  'Push-up': 'bodyweight',
  'Pull-up': 'bodyweight',
  Dips: 'bodyweight',
  Plank: 'bodyweight',
  'Hanging Leg Raise': 'bodyweight',
  'Cable Fly': 'cable',
  'Lat Pulldown': 'cable',
  'Seated Cable Row': 'cable',
  'Face Pull': 'cable',
  'Triceps Pushdown': 'cable',
  'Leg Press': 'machine',
  'Leg Curl': 'machine',
  'Calf Raise': 'machine',
};

/**
 * Schema migrations, applied in order. The database remembers the last one it ran in
 * `PRAGMA user_version`, so each migration runs exactly once per device.
 */
const MIGRATIONS: ((db: Db) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exercises (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        muscle_group TEXT    NOT NULL,
        is_custom    INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE workouts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at  TEXT NOT NULL,
        finished_at TEXT,
        notes       TEXT
      );
      CREATE TABLE workout_sets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        set_index   INTEGER NOT NULL,
        reps        INTEGER NOT NULL DEFAULT 0,
        weight_kg   REAL    NOT NULL DEFAULT 0,
        completed   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_sets_workout  ON workout_sets (workout_id);
      CREATE INDEX idx_sets_exercise ON workout_sets (exercise_id);
    `);
    for (const [name, group] of DEFAULT_EXERCISES) {
      await db.runAsync('INSERT INTO exercises (name, muscle_group) VALUES (?, ?)', name, group);
    }
  },
  // v2: routines (the user's plan), body measurements, settings, load type per exercise.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN load_type TEXT NOT NULL DEFAULT 'barbell';
      CREATE TABLE routines (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        notes      TEXT,
        position   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL
      );
      CREATE TABLE routine_exercises (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id   INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        exercise_id  INTEGER NOT NULL REFERENCES exercises(id),
        position     INTEGER NOT NULL,
        sets         INTEGER NOT NULL,
        reps_min     INTEGER NOT NULL,
        reps_max     INTEGER NOT NULL,
        target_kg    REAL,
        rest_seconds INTEGER NOT NULL
      );
      CREATE INDEX idx_routine_exercises ON routine_exercises (routine_id, position);
      ALTER TABLE workouts ADD COLUMN routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL;
      CREATE TABLE body_measurements (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        measured_at   TEXT NOT NULL,
        weight_kg     REAL NOT NULL,
        body_fat_pct  REAL,
        muscle_kg     REAL,
        water_pct     REAL,
        visceral_fat  REAL
      );
      CREATE INDEX idx_body_date ON body_measurements (measured_at);
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    for (const [name, type] of Object.entries(DEFAULT_LOAD_TYPES)) {
      await db.runAsync('UPDATE exercises SET load_type = ? WHERE name = ? AND is_custom = 0', type, name);
    }
  },
  // v3: when each set was ticked off (to close a forgotten workout at its real end) and supersets.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE workout_sets      ADD COLUMN completed_at TEXT;
      ALTER TABLE routine_exercises ADD COLUMN superset_with_next INTEGER NOT NULL DEFAULT 0;
    `);
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(() => migration(db));
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
