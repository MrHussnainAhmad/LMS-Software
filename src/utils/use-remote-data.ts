import { useCallback, useEffect, useState } from 'react';
export function useRemoteData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setError('');
    load().then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(cause.message || 'Unable to load data.'); });
    return () => { active = false; };
  }, [load, revision]);
  return { data, error, reload };
}
