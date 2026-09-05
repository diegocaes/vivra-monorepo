import { useCallback, useEffect, useRef, useState } from 'react';

interface RemoteState<T> {
  key: string | null;
  data: T | null;
  error: unknown | null;
  loading: boolean;
}

/** Own one request per account/resource; ignore cancelled responses and coalesce refreshes. */
export function useRemoteData<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<RemoteState<T>>({ key: null, data: null, error: null, loading: false });
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (key === null) return Promise.resolve();
    if (pending.current?.key === key) return pending.current.promise;

    pending.current?.controller.abort();
    const controller = new AbortController();
    setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: null, loading: true }));
    const promise = Promise.resolve()
      .then(() => load(controller.signal))
      .then(data => {
        if (!controller.signal.aborted) setState({ key, data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ key, data: null, error, loading: false });
      })
      .finally(() => {
        if (pending.current?.controller === controller) pending.current = null;
      });
    pending.current = { key, controller, promise };
    return promise;
  }, [key, load]);

  useEffect(() => {
    void refresh();
    return () => {
      pending.current?.controller.abort();
      pending.current = null;
    };
  }, [refresh]);

  // Hide the previous account/pet immediately, before the next effect runs.
  return {
    ...(state.key === key ? state : { data: null, error: null, loading: key !== null }),
    refresh,
  };
}
