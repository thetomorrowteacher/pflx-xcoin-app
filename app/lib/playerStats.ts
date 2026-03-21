/**
 * playerStats.ts
 * localStorage persistence layer for mutable player stats.
 * Bridges the gap between admin mutations (in-memory mockUsers) and
 * player dashboard reads (localStorage pflx_user).
 *
 * Admin pages call updatePlayerStats() after any XC/badge change.
 * Player pages call mergePlayerStats() on load to get the latest values.
 */

const STATS_KEY = "pflx_player_stats";

export interface PlayerStats {
  xcoin: number;
  totalXcoin: number;
  digitalBadges: number;
  level: number;
  rank: number;
  studioId?: string;
  diagnosticComplete?: boolean;
}

/** Read the full stats map from localStorage. */
function readAll(): Record<string, PlayerStats> {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PlayerStats>) : {};
  } catch {
    return {};
  }
}

/** Write the full stats map back to localStorage. */
function writeAll(all: Record<string, PlayerStats>): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Get persisted stats for one player.
 * Returns null if no entry exists yet (first load).
 */
export function getPlayerStats(playerId: string): PlayerStats | null {
  const all = readAll();
  return all[playerId] ?? null;
}

/**
 * Persist updated stats for a player.
 * Also updates pflx_user in localStorage if this player is currently logged in,
 * so the player's own dashboard reflects the change immediately.
 */
export function updatePlayerStats(playerId: string, updates: Partial<PlayerStats>): void {
  const all = readAll();
  all[playerId] = { ...(all[playerId] ?? {}), ...updates } as PlayerStats;
  writeAll(all);

  // Keep pflx_user in sync if this is the logged-in player
  try {
    const raw = localStorage.getItem("pflx_user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user.id === playerId) {
        localStorage.setItem("pflx_user", JSON.stringify({ ...user, ...updates }));
      }
    }
  } catch {}
}

/**
 * Merge persisted stats into a user object loaded from localStorage.
 * Call this in every player-facing page's useEffect after parsing pflx_user.
 * If no persisted stats exist yet, seeds them from the user object itself.
 */
export function mergePlayerStats<T extends { id: string; xcoin: number; totalXcoin: number; digitalBadges: number; level: number; rank: number }>(
  user: T
): T {
  const stored = getPlayerStats(user.id);
  if (!stored) {
    // First time — seed from current user so we have a baseline
    updatePlayerStats(user.id, {
      xcoin: user.xcoin,
      totalXcoin: user.totalXcoin,
      digitalBadges: user.digitalBadges,
      level: user.level,
      rank: user.rank,
    });
    return user;
  }
  // Return user with persisted stats merged in (persisted wins)
  return { ...user, ...stored };
}

/**
 * Seed stats for all players from the mockUsers array.
 * Call once at app startup (e.g. in a layout) to initialise the store.
 * Skips players that already have an entry so manual updates aren't overwritten.
 */
export function seedPlayerStats(players: Array<{ id: string; xcoin: number; totalXcoin: number; digitalBadges: number; level: number; rank: number }>): void {
  const all = readAll();
  let changed = false;
  for (const p of players) {
    if (!all[p.id]) {
      all[p.id] = {
        xcoin: p.xcoin,
        totalXcoin: p.totalXcoin,
        digitalBadges: p.digitalBadges,
        level: p.level,
        rank: p.rank,
      };
      changed = true;
    }
  }
  if (changed) writeAll(all);
}
