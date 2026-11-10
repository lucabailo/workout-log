import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { Loading } from '@/components/ui';
import { getSettings } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';
import { refreshWeighInReminder } from '@/lib/weigh-in-reminder';

/** First launch goes to the "About you" screen, every other launch to the Workouts tab. */
export default function Index() {
  const db = useSQLiteContext();
  const { data } = useDbQuery(getSettings);
  // Re-plan the weigh-in reminder at every launch (a measurement may have been logged or deleted).
  useEffect(() => {
    refreshWeighInReminder(db).catch(() => {});
  }, [db]);
  if (!data) return <Loading />;
  return <Redirect href={data.onboarded ? '/workouts' : '/onboarding'} />;
}
