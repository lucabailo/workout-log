import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ExerciseList, SearchField } from '@/components/exercise-list';
import { NewExerciseForm } from '@/components/new-exercise-form';
import { Button, Loading, Screen } from '@/components/ui';
import { addSet, getActiveWorkout, getWorkoutBlocks, listExercises, startWorkout } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';
import { deliverPick } from '@/lib/exercise-picker';

/**
 * Modal to choose an exercise. By default it adds the exercise to the workout in progress;
 * with `mode=pick` (from the routine editor) it just hands the choice back.
 */
export default function PickExerciseScreen() {
  const params = useLocalSearchParams<{ mode?: string; exclude?: string }>();
  const picking = params.mode === 'pick';
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, db, reload } = useDbQuery(async (db) => {
    let alreadyAdded: number[];
    if (picking) {
      alreadyAdded = (params.exclude ?? '').split(',').filter(Boolean).map(Number);
    } else {
      const active = await getActiveWorkout(db);
      alreadyAdded = active ? (await getWorkoutBlocks(db, active.id)).map((b) => b.exercise.id) : [];
    }
    return { exercises: await listExercises(db), alreadyAdded };
  });

  if (!data) return <Loading />;

  async function choose(exerciseId: number) {
    if (picking) {
      deliverPick(exerciseId);
    } else {
      const workoutId = await startWorkout(db); // returns the workout in progress
      await addSet(db, workoutId, exerciseId);
    }
    router.back();
  }

  return (
    <Screen>
      {creating ? (
        <NewExerciseForm
          onCancel={() => setCreating(false)}
          onCreated={async (id) => {
            await reload();
            await choose(id);
          }}
        />
      ) : (
        <Button title="+ New exercise" variant="secondary" onPress={() => setCreating(true)} />
      )}
      <SearchField value={search} onChange={setSearch} />
      <ExerciseList
        exercises={data.exercises}
        search={search}
        disabledIds={data.alreadyAdded}
        onSelect={(e) => choose(e.id)}
      />
    </Screen>
  );
}
