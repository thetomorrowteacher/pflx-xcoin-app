// Supabase persistence layer for PFLX X-Coin app
// Uses a key-value JSONB table (app_data) to store all collections

import { supabase } from "./supabaseClient";

// All data keys that map to mock collections in data.ts
export const DATA_KEYS = [
  "users",
  "checkpoints",
  "tasks",
  "jobs",
  "transactions",
  "modifiers",
  "playerModifiers",
  "pflxRanks",
  "gamePeriods",
  "submissions",
  "playerDeals",
  "startupStudios",
  "studioInvestments",
  "projects",
  "coinCategories",
  "trades",
  "investments",
] as const;

export type DataKey = (typeof DATA_KEYS)[number];

/**
 * Load a single collection from Supabase.
 * Returns null if no data exists yet (first load — use mock defaults).
 */
export async function loadData<T>(key: DataKey): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", key)
      .single();

    if (error) {
      // PGRST116 = row not found — expected on first load
      if (error.code === "PGRST116") return null;
      console.error(`[persistence] loadData("${key}") error:`, error);
      return null;
    }
    return data?.data as T;
  } catch (err) {
    console.error(`[persistence] loadData("${key}") exception:`, err);
    return null;
  }
}

/**
 * Save a single collection to Supabase (upsert).
 */
export async function saveData<T>(key: DataKey, value: T): Promise<boolean> {
  try {
    const summary = Array.isArray(value) ? `${(value as any[]).length} items` : typeof value;
    console.log(`[persistence] saveData("${key}") → ${summary}`);
    const { error } = await supabase.from("app_data").upsert(
      {
        key,
        data: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error(`[persistence] ✗ saveData("${key}") error:`, error.message, error.code, error.details);
      return false;
    }
    console.log(`[persistence] ✓ saveData("${key}") success`);
    return true;
  } catch (err) {
    console.error(`[persistence] ✗ saveData("${key}") exception:`, err);
    return false;
  }
}

/**
 * Load ALL collections via parallel individual fetches.
 *
 * The old approach (SELECT * FROM app_data) returned ~12MB of JSONB in one query,
 * which exceeded Supabase's PostgreSQL statement timeout (error 57014).
 * Instead, we fetch each collection individually and in parallel — each query
 * returns a single row and completes in <1s.
 */
export async function loadAllData(
  onProgress?: (attempt: number, maxRetries: number) => void,
): Promise<{ ok: boolean; data: Record<string, any> }> {
  try {
    onProgress?.(1, 1);
    console.log(`[persistence] loadAllData — fetching ${DATA_KEYS.length} collections in parallel...`);

    let completed = 0;
    const total = DATA_KEYS.length;

    const results = await Promise.all(
      DATA_KEYS.map(async (key) => {
        try {
          const { data, error } = await supabase
            .from("app_data")
            .select("data")
            .eq("key", key)
            .single();

          completed++;
          // Report progress as each collection finishes
          onProgress?.(completed, total);

          if (error) {
            // PGRST116 = row not found — expected if collection never saved
            if (error.code === "PGRST116") return { key, data: null, ok: true };
            console.warn(`[persistence] load "${key}" error:`, error.message);
            return { key, data: null, ok: false };
          }
          return { key, data: data?.data, ok: true };
        } catch (err) {
          completed++;
          onProgress?.(completed, total);
          console.warn(`[persistence] load "${key}" exception:`, err);
          return { key, data: null, ok: false };
        }
      })
    );

    // Check if the majority loaded successfully
    const okCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    console.log(`[persistence] ✓ loadAllData: ${okCount} ok, ${failCount} failed out of ${total}`);

    // If more than half failed, treat as a connection issue
    if (failCount > total / 2) {
      console.error("[persistence] Too many collections failed — treating as load failure");
      return { ok: false, data: {} };
    }

    const result: Record<string, any> = {};
    for (const r of results) {
      if (r.data !== null && r.data !== undefined) {
        result[r.key] = r.data;
      }
    }

    return { ok: true, data: result };
  } catch (err) {
    console.error("[persistence] loadAllData exception:", err);
    return { ok: false, data: {} };
  }
}

/**
 * Save multiple collections at once (batch upsert).
 */
export async function saveAllData(
  collections: Partial<Record<DataKey, any>>
): Promise<boolean> {
  try {
    const rows = Object.entries(collections).map(([key, value]) => ({
      key,
      data: value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("app_data")
      .upsert(rows, { onConflict: "key" });

    if (error) {
      console.error("[persistence] saveAllData error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[persistence] saveAllData exception:", err);
    return false;
  }
}
