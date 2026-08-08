import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionExpiredError } from '../api/data';

interface Options<T> {
  loader: () => Promise<T>;
  deps: unknown[];
  onSessionExpired?: () => void;
}

export function useAsyncData<T>({ loader, deps, onSessionExpired }: Options<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const expiredRef = useRef(onSessionExpired);
  expiredRef.current = onSessionExpired;

  const run = useCallback(
    async (refresh: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await loader();
        setData(result);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          setError('登录已过期，请重新登录');
          expiredRef.current?.();
        } else {
          setError(e instanceof Error ? e.message : '加载失败，请重试');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    run(false);
  }, [run]);

  return {
    data,
    loading,
    error,
    refreshing,
    reload: () => run(true),
    retry: () => run(false),
  };
}
