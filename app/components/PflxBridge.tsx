"use client";
import { useEffect } from "react";
import { saveData } from "../lib/persistence";
import * as D from "../lib/data";

/**
 * PflxBridge — Cross-app message listener.
 * Receives data sync messages from the PFLX Overlay (Mission Control)
 * and persists them to Supabase via the X-Coin persistence layer.
 * Also responds with fresh data when requested.
 */
export default function PflxBridge() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        // ── Cloud Save: MC pushes data to X-Coin for Supabase persistence ──
        if (msg.type === "pflx_cloud_save" && msg.key && msg.data) {
          console.log("[X-Coin Bridge] Cloud save received:", msg.key);
          // Save to Supabase
          saveData(msg.key, msg.data).then(() => {
            console.log("[X-Coin Bridge] Saved to cloud:", msg.key);
            // Also update in-memory mock data if applicable
            switch (msg.key) {
              case "users": D.mockUsers.splice(0, D.mockUsers.length, ...msg.data); break;
              case "checkpoints": D.mockCheckpoints.splice(0, D.mockCheckpoints.length, ...msg.data); break;
              case "tasks": D.mockTasks.splice(0, D.mockTasks.length, ...msg.data); break;
              case "projects": D.mockProjects.splice(0, D.mockProjects.length, ...msg.data); break;
              case "jobs": D.mockJobs.splice(0, D.mockJobs.length, ...msg.data); break;
              case "cohortGroups": D.mockCohortGroups.splice(0, D.mockCohortGroups.length, ...msg.data); break;
            }
          }).catch(err => {
            console.error("[X-Coin Bridge] Save failed:", msg.key, err);
          });
        }

        // ── MC Broadcast events — update in-memory data ──
        if (msg.type && msg.type.startsWith("pflx_mc_")) {
          console.log("[X-Coin Bridge] MC event:", msg.type);
        }

        // ── Data request from parent (Overlay asking for fresh data) ──
        if (msg.type === "pflx_data_request" && msg.key) {
          let data: unknown = null;
          switch (msg.key) {
            case "users": data = D.mockUsers; break;
            case "checkpoints": data = D.mockCheckpoints; break;
            case "tasks": data = D.mockTasks; break;
            case "projects": data = D.mockProjects; break;
            case "jobs": data = D.mockJobs; break;
            case "badges": data = D.COIN_CATEGORIES; break;
            case "cohortGroups": data = D.mockCohortGroups; break;
          }
          if (data && window.parent !== window) {
            window.parent.postMessage(JSON.stringify({
              type: "pflx_cloud_data",
              key: msg.key,
              data: data,
            }), "*");
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Invisible component — no UI
  return null;
}
