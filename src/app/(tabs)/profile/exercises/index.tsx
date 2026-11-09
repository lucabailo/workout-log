import { router } from 'expo-router';
import { useState } from 'react';

import { ExerciseList, SearchField } from '@/components/exercise-list';
import { NewExerciseForm } from '@/components/new-exercise-form';
import { Button, Loading, Screen } from '@/components/ui';
import { listExercises } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';

export default function ExercisesScreen() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, reload } = useDbQuery(listExercises);

  if (!data) return <Loading />;

  return (
    <Screen>
      {creating ? (
        <NewExerciseForm
          onCancel={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await reload();
          }}
        />
      ) : (
        <Button title="+ New exercise" variant="secondary" onPress={() => setCreating(true)} />
      )}
      <SearchField value={search} onChange={setSearch} />
      <ExerciseList exercises={data} search={search} onSelect={(e) => router.push(`/profile/exercises/${e.id}`)} />
    </Screen>
  );
}
