// ──────────────────────────────────────────────────────────────────────────
// X-Bot Briefing — per-player data point log
// ──────────────────────────────────────────────────────────────────────────
// X-Bot is an AI layer that continuously analyzes each player's tasks,
// projects, checkpoints, and seasons. Every event worth analyzing should be
// recorded here as a "data point" tied to the player. Later, the host AI
// reports engine reads these data points on checkpoint/season cadence to
// generate per-player reports, warnings, tips, missions, and check-ins.
//
// This is the minimal stub. It persists events to localStorage today and
// can be swapped for a Supabase table (or a dedicated `pflx_xbot_events`
// channel) when the backend is ready.

export type XBotEventKind =
  | "instruction"
  | "tip"
  | "mission"
  | "guidance"
  | "briefing"
  | "warning"
  | "system_fine"
  | "upgrade"
  | "deadline_checkin"
  | "task_assigned"
  | "task_completed"
  | "project_assigned"
  | "project_completed"
  | "checkpoint_released"
  | "season_started";

export interface XBotEvent {
  id: string;
  playerId: string;
  kind: XBotEventKind;
  title: string;
  body?: string;
  contextType?: "task" | "project" | "checkpoint" | "season" | "job";
  contextId?: string;
  createdAt: string; // ISO
  read?: boolean;
  meta?: Record<string, any>;
}

const STORAGE_KEY = "pflx_xbot_events";

function loadAll(): XBotEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as XBotEvent[]) : [];
  } catch {
    return [];
  }
}

function saveAll(events: XBotEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

/** Record a single X-Bot data point for a player. */
export function logXBotEvent(ev: Omit<XBotEvent, "id" | "createdAt" | "read"> & { id?: string }): XBotEvent {
  const full: XBotEvent = {
    id: ev.id || `xbot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId: ev.playerId,
    kind: ev.kind,
    title: ev.title,
    body: ev.body,
    contextType: ev.contextType,
    contextId: ev.contextId,
    meta: ev.meta,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const all = loadAll();
  all.push(full);
  saveAll(all);
  return full;
}

/** Bulk log — one event per player (used when a Task/Project is assigned to many). */
export function logXBotEventForPlayers(
  playerIds: string[],
  ev: Omit<XBotEvent, "id" | "createdAt" | "read" | "playerId">
): XBotEvent[] {
  return playerIds.map(pid => logXBotEvent({ ...ev, playerId: pid }));
}

/** Read all events for a given player (newest first). */
export function getPlayerXBotEvents(playerId: string): XBotEvent[] {
  return loadAll()
    .filter(e => e.playerId === playerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Read every event (for host AI reports engine). */
export function getAllXBotEvents(): XBotEvent[] {
  return loadAll();
}

/** Generate a simple per-player checkpoint report from raw events. */
export function generatePlayerCheckpointReport(playerId: string, checkpointId: string) {
  const events = getPlayerXBotEvents(playerId).filter(
    e => e.contextType === "checkpoint" ? e.contextId === checkpointId : true
  );
  const byKind: Record<string, number> = {};
  events.forEach(e => { byKind[e.kind] = (byKind[e.kind] || 0) + 1; });
  return {
    playerId,
    checkpointId,
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    byKind,
    recent: events.slice(0, 20),
  };
}
