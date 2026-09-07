import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Fetches `fetchFn` immediately, then again every `intervalMs`.
 * Pauses while the tab is hidden (no point polling in the background),
 * and stops on unmount. Exposes a manual `refresh()` too, e.g. to call
 * right after an approve/reject/edit action for an instant update
 * instead of waiting for the next poll tick.
 */
export function usePolling(fetchFn, intervalMs = 12000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFnRef.current();
      setData(result);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh };
}
