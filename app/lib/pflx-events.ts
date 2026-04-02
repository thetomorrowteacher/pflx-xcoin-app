// ─── PFLX Cross-App Event System ────────────────────────────────────────────
// X-Coin is the central hub. All satellite apps (DarkCampus, Battle Arena,
// Core Pathway) publish events here. Events are stored in Supabase app_data
// under the key "pflx_events" and kept to a rolling 500-event window.
//
// Each app can:
//   publishEvent()  — write an event to the shared log
//   loadEvents()    — read recent events (with optional app/type filters)

import { supabase } from "./supabaseClient";

export type PflxAppId = "xcoin" | "darkcampus" | "battle-arena" | "core-pathway";

export type PflxEventType =
  | "xc_earned"        // Player earned XC (any source)
  | "xc_spent"         // Player spent XC (shop, wager, etc.)
  | "xc_fined"         // Player fined (violation)
  | "badge_earned"     // Digital badge awarded
  | "badge_submitted"  // Badge submission created
  | "level_up"         // Player leveled up
  | "rank_up"          // Player rank changed
  | "pathway_started"  // Player started a pathway node
  | "pathway_completed"// Player completed a pathway node
  | "battle_started"   // Battle/match started
  | "battle_won"       // Player won a battle
  | "battle_lost"      // Player lost a battle
  | "wager_placed"     // XC wager placed
  | "violation"        // DarkCampus violation detected
  | "message_sent"     // Cross-platform message
  | "system"           // System event (deploy, maintenance, etc.)
  ;

export interface PflxEvent {
  id: string;
  app: PflxAppId;
  type: PflxEventType;
  playerId?: string;
  playerName?: string;
  data: Record<string, unknown>;     // Flexible payload
  timestamp: string;
}

const EVENT_KEY = "pflx_events";
const MAX_EVENTS = 500;

/** Generate a short unique ID */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Publish an event to the shared PFLX event log.
 * Called from any app that has the Supabase client.
 */
export async function publishEvent(
  app: PflxAppId,
  type: PflxEventType,
  data: Record<string, unknown>,
  playerId?: string,
  playerName?: string,
): Promise<boolean> {
  try {
    const event: PflxEvent = {
      id: uid(),
      app,
      type,
      playerId,
      playerName,
      data,
      timestamp: new Date().toISOString(),
    };

    // Load existing events
    const { data: row } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", EVENT_KEY)
      .single();

    const events: PflxEvent[] = (row?.data as PflxEvent[]) || [];
    events.push(event);

    // Keep rolling window
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }

    await supabase
      .from("app_data")
      .upsert({ key: EVENT_KEY, data: events, updated_at: new Date().toISOString() }, { onConflict: "key" });

    return true;
  } catch (err) {
    console.error("[pflx-events] publish error:", err);
    return false;
  }
}

/**
 * Load recent events from the shared log.
 * Optionally filter by app, type, or player.
 */
export async function loadEvents(filters?: {
  app?: PflxAppId;
  type?: PflxEventType;
  playerId?: string;
  limit?: number;
}): Promise<PflxEvent[]> {
  try {
    const { data: row } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", EVENT_KEY)
      .single();

    let events: PflxEvent[] = (row?.data as PflxEvent[]) || [];

    if (filters?.app) events = events.filter(e => e.app === filters.app);
    if (filters?.type) events = events.filter(e => e.type === filters.type);
    if (filters?.playerId) events = events.filter(e => e.playerId === filters.playerId);

    // Most recent first
    events.reverse();

    if (filters?.limit) events = events.slice(0, filters.limit);

    return events;
  } catch (err) {
    console.error("[pflx-events] load error:", err);
    return [];
  }
}
