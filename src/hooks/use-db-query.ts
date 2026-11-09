import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Db } from '@/db/db';

/**
 * Runs a database query every time the screen gains focus, so the data is fresh after
 * coming back from another screen. Returns the result (undefined while loading), a
 * `reload` function to call after a change, and the database itself.
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const latestQuery = useRef(query);
  const requestId = useRef(0);

  useEffect(() => {
    latestQuery.current = query;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const result = await latestQuery.current(db);
    // Ignore the answer if a newer request has started in the meantime.
    if (id === requestId.current) setData(result);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload, db };
}
