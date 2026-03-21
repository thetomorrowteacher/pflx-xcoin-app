/**
 * playerImages.ts
 * Client-side persistence for player profile images.
 * Images are stored in localStorage so they survive page navigation
 * without requiring a real database.
 *
 * Storage key: "pflx_player_images"
 * Value: JSON object mapping { [playerId]: dataUrl }
 */

const STORAGE_KEY = "pflx_player_images";

/** Read the full image map from localStorage */
export function getPlayerImages(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Persist a single player's image (or clear it if imageUrl is empty) */
export function savePlayerImage(playerId: string, imageUrl: string): void {
  if (typeof window === "undefined") return;
  const map = getPlayerImages();
  if (imageUrl) {
    map[playerId] = imageUrl;
  } else {
    delete map[playerId];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Merge persisted images into an array of user-like objects.
 * Any object with an `id` field gets its `image` field overwritten
 * with the stored value (if one exists).
 */
export function applyPlayerImages<T extends { id: string; image?: string }>(
  users: T[]
): T[] {
  const map = getPlayerImages();
  if (Object.keys(map).length === 0) return users;
  return users.map((u) =>
    map[u.id] !== undefined ? { ...u, image: map[u.id] } : u
  );
}
