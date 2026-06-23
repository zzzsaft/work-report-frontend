import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/utils/errors";

export function useAsyncResource<T>(load: () => Promise<T>) {
  const requestId = useRef(0);
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      if (id === requestId.current) setData(result);
      return result;
    } catch (loadError) {
      if (id === requestId.current) setError(getErrorMessage(loadError));
      return undefined;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
    return () => {
      requestId.current += 1;
    };
  }, [reload]);

  return { data, error, loading, reload, setData };
}
