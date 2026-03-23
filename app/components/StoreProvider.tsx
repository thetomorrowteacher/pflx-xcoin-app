"use client";

import { useEffect, useRef, useState } from "react";
import { initStore, saveAll, isStoreReady, needsSeed, clearSeedFlag } from "../lib/store";
import { getPlayerImages } from "../lib/playerImages";
import * as D from "../lib/data";

// Snapshot the current state of all collections for dirty-checking
function snapshot() {
  return JSON.stringify({
    u: D.mockUsers,
    c: D.mockCheckpoints,
    t: D.mockTasks,
    j: D.mockJobs,
    tx: D.mockTransactions,
    m: D.mockModifiers,
    pm: D.mockPlayerModifiers,
    r: D.mockPflxRanks,
    g: D.mockGamePeriods,
    s: D.mockSubmissions,
    pd: D.mockPlayerDeals,
    ss: D.mockStartupStudios,
    si: D.mockStudioInvestments,
    p: D.mockProjects,
    cc: D.COIN_CATEGORIES,
  });
}

/**
 * Merge any profile images from localStorage into the mockUsers array.
 * This ensures images are included when we save users to Supabase.
 * Returns true if any images were merged (data changed).
 */
function mergeLocalImages(): boolean {
  const imageMap = getPlayerImages();
  if (Object.keys(imageMap).length === 0) return false;
  let changed = false;
  D.mockUsers.forEach((u) => {
    if (imageMap[u.id] && imageMap[u.id] !== u.image) {
      u.image = imageMap[u.id];
      changed = true;
    }
  });
  return changed;
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const lastSnap = useRef<string>("");

  useEffect(() => {
    initStore().then(() => {
      // Merge any locally-stored profile images into mockUsers
      const imagesChanged = mergeLocalImages();

      lastSnap.current = snapshot();
      setReady(true);

      // If Supabase was empty OR images were merged, save everything
      if (needsSeed() || imagesChanged) {
        console.log("[StoreProvider] Saving data to Supabase (seed or image merge)...");
        saveAll().then(() => {
          clearSeedFlag();
          console.log("[StoreProvider] Save complete");
        });
      }
    });
  }, []);

  // Auto-save every 2 seconds if data changed
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      // Also check for new localStorage images each tick
      mergeLocalImages();
      const current = snapshot();
      if (current !== lastSnap.current) {
        lastSnap.current = current;
        saveAll().then(() => console.log("[auto-save] saved to Supabase"));
      }
    }, 2000);

    // Also save on page unload
    const handleUnload = () => {
      mergeLocalImages();
      const current = snapshot();
      if (current !== lastSnap.current) {
        saveAll();
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#0a0a0f",
        color: "#00e5ff",
        fontFamily: "monospace",
        fontSize: "1.2rem",
      }}>
        Loading PFLX Data…
      </div>
    );
  }

  return <>{children}</>;
}
