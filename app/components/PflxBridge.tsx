"use client";
import { useEffect } from "react";
import { saveData } from "../lib/persistence";
import { isStoreReady, initStore } from "../lib/store";
import * as D from "../lib/data";

// ── Pass-through caches for MC-owned collections without in-memory arrays ──
// These collections originate from Mission Control and are just persisted through X-Coin
let _seasons: unknown[] = [];
let _sessions: unknown[] = [];

// ── Key alias map: MC key → Supabase/data.ts key ──
const KEY_ALIAS: Record<string, string> = {
  badges: "coinCategories",
  pitches: "projectPitches",
  studios: "startupStudios",
};
function resolveKey(key: string): string {
  return KEY_ALIAS[key] || key;
}

/**
 * PflxBridge — Cross-app message listener.
 * Receives data sync messages from the PFLX Overlay (Mission Control)
 * and persists them to Supabase via the X-Coin persistence layer.
 * Also responds with fresh data when requested.
 *
 * v2: Waits for store initialization before responding to data requests.
 *     Handles all collection keys + key aliases.
 *     Sends pflx_store_ready signal to parent when store is loaded.
 */
export default function PflxBridge() {
  useEffect(() => {
    // ── Send readiness signal to parent once store is initialized ──
    async function signalReady() {
      try {
        await initStore(); // No-op if already initialized
      } catch {
        // Store may fail but we still signal so Platform doesn't hang
      }
      if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({
          type: "pflx_store_ready",
          timestamp: Date.now(),
        }), "*");
        console.log("[X-Coin Bridge] ✓ Store ready — signaled parent");
      }
    }
    signalReady();

    // ── Queued data requests that arrived before store was ready ──
    const pendingRequests: string[] = [];

    function respondToDataRequest(key: string) {
      const resolved = resolveKey(key);
      let data: unknown = null;

      switch (resolved) {
        case "users":             data = D.mockUsers; break;
        case "checkpoints":       data = D.mockCheckpoints; break;
        case "tasks":             data = D.mockTasks; break;
        case "projects":          data = D.mockProjects; break;
        case "jobs":              data = D.mockJobs; break;
        case "coinCategories":    data = D.COIN_CATEGORIES; break;
        case "cohortGroups":      data = D.mockCohortGroups; break;
        case "pflxRanks":         data = D.mockPflxRanks; break;
        case "transactions":      data = D.mockTransactions; break;
        case "modifiers":         data = D.mockModifiers; break;
        case "playerModifiers":   data = D.mockPlayerModifiers; break;
        case "gamePeriods":       data = D.mockGamePeriods; break;
        case "submissions":       data = D.mockSubmissions; break;
        case "playerDeals":       data = D.mockPlayerDeals; break;
        case "startupStudios":    data = D.mockStartupStudios; break;
        case "studioInvestments": data = D.mockStudioInvestments; break;
        case "trades":            data = D.mockTrades; break;
        case "investments":       data = D.mockInvestments; break;
        case "projectPitches":    data = D.mockProjectPitches; break;
        // Pass-through caches (MC-owned, no data.ts array)
        case "seasons":           data = _seasons; break;
        case "sessions":          data = _sessions; break;
      }

      if (data && window.parent !== window) {
        window.parent.postMessage(JSON.stringify({
          type: "pflx_cloud_data",
          key: key, // Respond with the ORIGINAL key so MC recognizes it
          data: data,
        }), "*");
        console.log("[X-Coin Bridge] → Sent", key, "(" + (Array.isArray(data) ? data.length + " items" : "object") + ")");
      }
    }

    function handleMessage(event: MessageEvent) {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        // ── Cloud Save: MC pushes data to X-Coin for Supabase persistence ──
        if (msg.type === "pflx_cloud_save" && msg.key && msg.data) {
          const resolved = resolveKey(msg.key);
          console.log("[X-Coin Bridge] Cloud save received:", msg.key, "→", resolved);

          // Save to Supabase using the canonical key
          saveData(resolved as any, msg.data).then(() => {
            console.log("[X-Coin Bridge] ✓ Saved to cloud:", resolved);
            // Also update in-memory mock data if applicable
            switch (resolved) {
              case "users": {
                // Map MC player format → X-Coin User format (MC uses xc/brand, X-Coin uses xcoin/brandName)
                const mapped = msg.data.map((p: Record<string, unknown>) => ({
                  id:             p.id || String(Math.random()).slice(2, 10),
                  name:           p.name || p.brand || "Unknown",
                  brandName:      p.brand || p.brandName || p.name || "",
                  role:           (p.role === "admin" ? "admin" : "player"),
                  avatar:         p.avatar || "",
                  digitalBadges:  typeof p.digitalBadges === "number" ? p.digitalBadges : 0,
                  xcoin:          typeof p.xcoin === "number" ? p.xcoin : (typeof p.xc === "number" ? p.xc : 0),
                  totalXcoin:     typeof p.totalXcoin === "number" ? p.totalXcoin : (typeof p.xc === "number" ? p.xc : 0),
                  level:          typeof p.level === "number" ? p.level : 1,
                  rank:           typeof p.rank === "number" ? p.rank : 1,
                  cohort:         p.cohort || "",
                  pathway:        p.pathway || "",
                  joinedAt:       p.joinedAt || new Date().toISOString(),
                  email:          p.email || "",
                  image:          p.image || "",
                  pin:            p.pin || "",
                  claimed:        !!p.claimed,
                  isHost:         p.role === "admin" || !!p.isHost,
                  studioId:       p.studioId || "",
                  badgeCounts:    p.badgeCounts || { primary: 0, premium: 0, executive: 0, signature: 0 },
                }));
                D.mockUsers.splice(0, D.mockUsers.length, ...mapped);
                console.log("[X-Coin Bridge] ✓ Mapped", mapped.length, "users from cloud save");
                break;
              }
              case "checkpoints":       D.mockCheckpoints.splice(0, D.mockCheckpoints.length, ...msg.data); break;
              case "tasks":             D.mockTasks.splice(0, D.mockTasks.length, ...msg.data); break;
              case "projects":          D.mockProjects.splice(0, D.mockProjects.length, ...msg.data); break;
              case "jobs":              D.mockJobs.splice(0, D.mockJobs.length, ...msg.data); break;
              case "cohortGroups":      D.mockCohortGroups.splice(0, D.mockCohortGroups.length, ...msg.data); break;
              case "coinCategories":    D.COIN_CATEGORIES.splice(0, D.COIN_CATEGORIES.length, ...msg.data); break;
              case "pflxRanks":         D.mockPflxRanks.splice(0, D.mockPflxRanks.length, ...msg.data); break;
              case "modifiers":         D.mockModifiers.splice(0, D.mockModifiers.length, ...msg.data); break;
              case "playerModifiers":   D.mockPlayerModifiers.splice(0, D.mockPlayerModifiers.length, ...msg.data); break;
              case "startupStudios":    D.mockStartupStudios.splice(0, D.mockStartupStudios.length, ...msg.data); break;
              case "studioInvestments": D.mockStudioInvestments.splice(0, D.mockStudioInvestments.length, ...msg.data); break;
              case "projectPitches":    D.mockProjectPitches.splice(0, D.mockProjectPitches.length, ...msg.data); break;
              case "transactions":      D.mockTransactions.splice(0, D.mockTransactions.length, ...msg.data); break;
              case "submissions":       D.mockSubmissions.splice(0, D.mockSubmissions.length, ...msg.data); break;
              case "playerDeals":       D.mockPlayerDeals.splice(0, D.mockPlayerDeals.length, ...msg.data); break;
              case "gamePeriods":       D.mockGamePeriods.splice(0, D.mockGamePeriods.length, ...msg.data); break;
              // Pass-through caches
              case "seasons":           _seasons = msg.data; break;
              case "sessions":          _sessions = msg.data; break;
            }
          }).catch(err => {
            console.error("[X-Coin Bridge] Save failed:", resolved, err);
          });
        }

        // ── MC Broadcast events — update in-memory data ──
        if (msg.type && msg.type.startsWith("pflx_mc_")) {
          console.log("[X-Coin Bridge] MC event:", msg.type);

          // ── Player roster sync: MC pushed updated players ──
          if (msg.type === "pflx_mc_pflx_players_updated" && msg.data && msg.data.players) {
            const mcPlayers = msg.data.players;
            console.log("[X-Coin Bridge] Received", mcPlayers.length, "players from MC");

            // Map MC player objects → X-Coin User format
            const mapped = mcPlayers.map((p: Record<string, unknown>) => ({
              id:             p.id || String(Math.random()).slice(2, 10),
              name:           p.name || p.brand || "Unknown",
              brandName:      p.brand || p.name || "",
              role:           (p.role === "admin" ? "admin" : "player") as "admin" | "player",
              avatar:         "",
              digitalBadges:  typeof p.digitalBadges === "number" ? p.digitalBadges : 0,
              xcoin:          typeof p.xc === "number" ? p.xc : 0,
              totalXcoin:     typeof p.xc === "number" ? p.xc : 0,
              level:          typeof p.level === "number" ? p.level : 1,
              rank:           typeof p.rank === "number" ? p.rank : 1,
              cohort:         p.cohort || "",
              pathway:        p.pathway || "",
              joinedAt:       p.joinedAt || new Date().toISOString(),
              email:          p.email || "",
              image:          p.image || "",
              pin:            p.pin || "",
              claimed:        !!p.claimed,
              isHost:         p.role === "admin",
              studioId:       p.studioId || "",
              badgeCounts:    p.badgeCounts || { primary: 0, premium: 0, executive: 0, signature: 0 },
            }));

            // Replace in-memory mockUsers with MC data
            D.mockUsers.splice(0, D.mockUsers.length, ...mapped);
            console.log("[X-Coin Bridge] ✓ mockUsers updated with", mapped.length, "players from MC");

            // Also persist to Supabase
            saveData("users" as any, mapped).catch(err => {
              console.error("[X-Coin Bridge] Failed to persist MC players:", err);
            });
          }
        }

        // ── Data request from parent (Overlay asking for fresh data) ──
        if (msg.type === "pflx_data_request" && msg.key) {
          if (!isStoreReady()) {
            // Store still loading — queue the request and process after init
            console.log("[X-Coin Bridge] Store not ready — queuing request for:", msg.key);
            pendingRequests.push(msg.key);
            return;
          }
          respondToDataRequest(msg.key);
        }
      } catch {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener("message", handleMessage);

    // ── Process any queued requests once store is ready ──
    const readyCheck = setInterval(() => {
      if (isStoreReady() && pendingRequests.length > 0) {
        console.log("[X-Coin Bridge] Processing", pendingRequests.length, "queued data requests");
        const queued = [...pendingRequests];
        pendingRequests.length = 0;
        queued.forEach(key => respondToDataRequest(key));
        clearInterval(readyCheck);
      } else if (isStoreReady()) {
        clearInterval(readyCheck);
      }
    }, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(readyCheck);
    };
  }, []);

  // Invisible component — no UI
  return null;
}
