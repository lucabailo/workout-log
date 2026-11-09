import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { getSettings } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';

/** First launch goes to the "About you" screen, every other launch to the Workouts tab. */
export default function Index() {
  const { data } = useDbQuery(getSettings);
  if (!data) return <Loading />;
  return <Redirect href={data.onboarded ? '/workouts' : '/onboarding'} />;
}
