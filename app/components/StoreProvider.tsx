"use client";

import { useEffect, useRef, useState } from "react";
import { initStore, saveAll, isStoreReady, needsSeed, clearSeedFlag } from "../lib/store";
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
  });
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const lastSnap = useRef<string>("");

  useEffect(() => {
    initStore().then(() => {
      lastSnap.current = snapshot();
      setReady(true);
      // If Supabase was empty, seed it with the default mock data immediately
      if (needsSeed()) {
        console.log("[StoreProvider] Seeding Supabase with default data...");
        saveAll().then(() => {
          clearSeedFlag();
          console.log("[StoreProvider] Seed complete — all data saved to Supabase");
        });
      }
    });
  }, []);

  // Auto-save every 2 seconds if data changed
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const current = snapshot();
      if (current !== lastSnap.current) {
        lastSnap.current = current;
        saveAll().then(() => console.log("[auto-save] saved to Supabase"));
      }
    }, 2000);

    // Also save on page unload
    const handleUnload = () => {
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
