"use client";

import { useEffect, useRef, useState } from "react";
import { initStore, saveAll, isStoreReady, needsSeed, clearSeedFlag, didLoadFail, onLoadProgress, saveCoinCategories, saveUsers } from "../lib/store";
import { getPlayerImages } from "../lib/playerImages";
import { showSaveToast } from "../lib/saveToast";
import { recompressBase64 } from "../lib/imageUtils";
import * as D from "../lib/data";

// Per-collection snapshots for granular dirty-checking
// Only save collections that actually changed, not everything
type CollectionKey = string;
const COLLECTIONS: { key: CollectionKey; getData: () => any; save: () => Promise<any> }[] = [
  { key: "u",  getData: () => D.mockUsers,            save: () => import("../lib/store").then(m => m.saveUsers()) },
  { key: "c",  getData: () => D.mockCheckpoints,      save: () => import("../lib/store").then(m => m.saveCheckpoints()) },
  { key: "t",  getData: () => D.mockTasks,             save: () => import("../lib/store").then(m => m.saveTasks()) },
  { key: "j",  getData: () => D.mockJobs,              save: () => import("../lib/store").then(m => m.saveJobs()) },
  { key: "tx", getData: () => D.mockTransactions,      save: () => import("../lib/store").then(m => m.saveTransactions()) },
  { key: "m",  getData: () => D.mockModifiers,         save: () => import("../lib/store").then(m => m.saveModifiers()) },
  { key: "pm", getData: () => D.mockPlayerModifiers,   save: () => import("../lib/store").then(m => m.savePlayerModifiers()) },
  { key: "r",  getData: () => D.mockPflxRanks,         save: () => import("../lib/store").then(m => m.savePflxRanks()) },
  { key: "g",  getData: () => D.mockGamePeriods,       save: () => import("../lib/store").then(m => m.saveGamePeriods()) },
  { key: "s",  getData: () => D.mockSubmissions,       save: () => import("../lib/store").then(m => m.saveSubmissions()) },
  { key: "pd", getData: () => D.mockPlayerDeals,       save: () => import("../lib/store").then(m => m.savePlayerDeals()) },
  { key: "ss", getData: () => D.mockStartupStudios,    save: () => import("../lib/store").then(m => m.saveStartupStudios()) },
  { key: "si", getData: () => D.mockStudioInvestments, save: () => import("../lib/store").then(m => m.saveStudioInvestments()) },
  { key: "p",  getData: () => D.mockProjects,          save: () => import("../lib/store").then(m => m.saveProjects()) },
  { key: "cc", getData: () => D.COIN_CATEGORIES,       save: () => import("../lib/store").then(m => m.saveCoinCategories()) },
  { key: "tr", getData: () => D.mockTrades,            save: () => import("../lib/store").then(m => m.saveTrades()) },
  { key: "iv", getData: () => D.mockInvestments,       save: () => import("../lib/store").then(m => m.saveInvestments()) },
  { key: "ccon", getData: () => D.mockCommunityContributions, save: () => import("../lib/store").then(m => m.saveCommunityContributions()) },
];

function snapshotAll(): Record<string, string> {
  const snaps: Record<string, string> = {};
  for (const c of COLLECTIONS) {
    snaps[c.key] = JSON.stringify(c.getData());
  }
  return snaps;
}

// Save ONLY the collections that differ from the last snapshot
async function saveDirty(lastSnaps: Record<string, string>): Promise<Record<string, string>> {
  const currentSnaps: Record<string, string> = {};
  const saves: Promise<any>[] = [];
  const dirtyKeys: string[] = [];
  for (const c of COLLECTIONS) {
    const snap = JSON.stringify(c.getData());
    currentSnaps[c.key] = snap;
    if (snap !== lastSnaps[c.key]) {
      saves.push(c.save());
      dirtyKeys.push(c.key);
    }
  }
  if (saves.length > 0) {
    await Promise.all(saves);
    console.log("[auto-save] saved dirty collections:", dirtyKeys.join(", "));
    showSaveToast();
  }
  return currentSnaps;
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

/**
 * One-time migration: recompress oversized images in coinCategories and users.
 * Old badge PNGs were full-res (~6.8MB total). This shrinks them to 200px JPEG
 * so coinCategories fits easily in a Supabase upsert.
 */
async function migrateImages() {
  let coinsDirty = false;
  let usersDirty = false;

  // Recompress coin/badge images
  for (const cat of D.COIN_CATEGORIES) {
    for (const coin of cat.coins) {
      if (coin.image && (coin.image.startsWith("data:image/png") || coin.image.length > 20_000)) {
        const before = coin.image.length;
        coin.image = await recompressBase64(coin.image, 200, 0.7);
        if (coin.image.length < before) {
          console.log(`[migrate] coin "${coin.name}": ${(before/1024).toFixed(0)}KB → ${(coin.image.length/1024).toFixed(0)}KB`);
          coinsDirty = true;
        }
      }
    }
  }

  // Recompress user profile images
  for (const u of D.mockUsers) {
    if (u.image && (u.image.startsWith("data:image/png") || u.image.length > 30_000)) {
      const before = u.image.length;
      u.image = await recompressBase64(u.image, 200, 0.8);
      if (u.image.length < before) {
        console.log(`[migrate] user "${u.name}": ${(before/1024).toFixed(0)}KB → ${(u.image.length/1024).toFixed(0)}KB`);
        usersDirty = true;
      }
    }
  }

  // Save migrated data back to Supabase
  const saves: Promise<boolean>[] = [];
  if (coinsDirty) {
    console.log("[migrate] Saving recompressed coinCategories...");
    saves.push(saveCoinCategories());
  }
  if (usersDirty) {
    console.log("[migrate] Saving recompressed users...");
    saves.push(saveUsers());
  }
  if (saves.length > 0) {
    await Promise.all(saves);
    console.log("[migrate] ✓ Image migration complete");
  }
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatus, setLoadStatus] = useState("Connecting...");
  const lastSnaps = useRef<Record<string, string>>({});

  // Subscribe to load progress from the store
  useEffect(() => {
    return onLoadProgress((progress, status) => {
      setLoadProgress(progress);
      setLoadStatus(status);
    });
  }, []);

  useEffect(() => {
    initStore().then(async () => {
      // Merge any locally-stored profile images into mockUsers
      mergeLocalImages();

      // ── One-time migration: recompress oversized images ──
      // Old badge images are full-res PNGs (6.8MB total). Shrink to 200px JPEG.
      await migrateImages();

      // Take per-collection snapshots AFTER load + image merge + migration
      lastSnaps.current = snapshotAll();
      // Start fade-out animation, then reveal children
      setFadeOut(true);
      setTimeout(() => {
        setShowChildren(true);
        setReady(true);
      }, 500);

      // If Supabase was empty, seed with defaults
      if (needsSeed()) {
        console.log("[StoreProvider] Supabase empty — seeding all data...");
        saveAll().then(() => {
          clearSeedFlag();
          lastSnaps.current = snapshotAll(); // re-snapshot after seed
          console.log("[StoreProvider] Seed complete");
          showSaveToast("Data initialized ✓");
        });
      }
    });
  }, []);

  // Auto-save every 2 seconds — only dirty collections
  // CRITICAL: skip auto-save entirely if the initial load failed,
  // otherwise we'd overwrite real Supabase data with hardcoded defaults
  useEffect(() => {
    if (!ready) return;
    if (didLoadFail()) {
      console.warn("[StoreProvider] Skipping auto-save — initial Supabase load failed");
      return;
    }
    const interval = setInterval(async () => {
      // Check for new localStorage images each tick
      mergeLocalImages();
      // Save only collections that actually changed
      lastSnaps.current = await saveDirty(lastSnaps.current);
    }, 2000);

    // Also save on page unload
    const handleUnload = () => {
      mergeLocalImages();
      // Fire-and-forget dirty save
      saveDirty(lastSnaps.current);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [ready]);

  // Show loading screen with fade-out transition
  if (!showChildren) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#0a0a0f",
        color: "#00e5ff",
        fontFamily: "monospace",
        fontSize: "1.2rem",
        gap: "20px",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.5s ease-out",
      }}>
        {/* PFLX logo text */}
        <div style={{
          fontSize: "2rem",
          fontWeight: 900,
          letterSpacing: "0.2em",
          background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 20px rgba(0,212,255,0.4))",
        }}>
          PFLX
        </div>

        {/* Progress bar container */}
        <div style={{
          width: "280px",
          height: "6px",
          borderRadius: "6px",
          background: "rgba(0,212,255,0.08)",
          overflow: "hidden",
          position: "relative",
          boxShadow: "inset 0 0 4px rgba(0,0,0,0.4)",
        }}>
          {/* Filled portion */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${loadProgress}%`,
            borderRadius: "6px",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa)",
            boxShadow: "0 0 12px rgba(0,212,255,0.5), 0 0 4px rgba(167,139,250,0.3)",
            transition: "width 0.4s ease-out",
          }} />
        </div>

        {/* Percentage */}
        <div style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "#00d4ff",
          letterSpacing: "0.1em",
        }}>
          {loadProgress}%
        </div>

        {/* Status label */}
        <div style={{
          fontSize: "0.6rem",
          color: "rgba(0,229,255,0.35)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          minHeight: "1em",
        }}>
          {loadStatus}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
