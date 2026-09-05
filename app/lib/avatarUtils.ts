/**
 * avatarUtils.ts
 * Shared "brand initials" fallback for player avatar circles across
 * X-Coin (Host Dashboard Top Players, Master Leaderboard podium/list,
 * startup-studio member chips). Real player records synced from
 * Mission Control/X-Live never populate a legacy `avatar` initials
 * field, so any UI that rendered `player.image ? <img/> : player.avatar`
 * showed a completely blank circle for every player without an
 * uploaded photo. This mirrors the same "never a blank/branded
 * placeholder — always the player's own initials" convention already
 * shipped platform-wide (PATCH PLATFORM v1.130).
 */

export function playerInitials(entity: {
  brandName?: string | null;
  name?: string | null;
  avatar?: string | null;
}): string {
  if (entity.avatar) return entity.avatar;
  const source = (entity.brandName || entity.name || "?").toString().trim();
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}
