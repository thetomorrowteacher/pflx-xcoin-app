"use client";

import { useEffect, useState } from "react";
import { initStore, isStoreReady, subscribe } from "./store";

/**
 * Hook to ensure the Supabase data store is loaded before rendering.
 * Returns { ready, loading } so pages can show a loading state.
 *
 * Usage:
 *   const { ready } = useStore();
 *   if (!ready) return <LoadingSpinner />;
 */
export function useStore() {
  const [ready, setReady] = useState(isStoreReady());
  const [loading, setLoading] = useState(!isStoreReady());

  useEffect(() => {
    if (isStoreReady()) {
      setReady(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    initStore().then(() => {
      setReady(true);
      setLoading(false);
    });

    // Also subscribe to store changes
    const unsub = subscribe(() => {
      setReady(isStoreReady());
    });
    return unsub;
  }, []);

  return { ready, loading };
}
