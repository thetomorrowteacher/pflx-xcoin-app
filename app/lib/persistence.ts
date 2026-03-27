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
 * Load ALL collections at once (batch).
 * Returns { ok: true, data: {...} } on success, or { ok: false } on error.
 * CRITICAL: callers MUST check .ok — a failed load is NOT the same as an empty DB.
 */
export async function loadAllData(
  onProgress?: (attempt: number, maxRetries: number) => void,
): Promise<{ ok: boolean; data: Record<string, any> }> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 4000; // 4s per attempt — Supabase typically responds in <2s

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(attempt, MAX_RETRIES);
      console.log(`[persistence] loadAllData attempt ${attempt}/${MAX_RETRIES}...`);

      // Race against timeout so we don't hang forever
      const timeoutPromise = new Promise<{ data: null; error: { message: string; code: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: `Timeout (${TIMEOUT_MS}ms)`, code: "TIMEOUT" } }), TIMEOUT_MS)
      );

      const queryPromise = supabase.from("app_data").select("key, data");
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn(`[persistence] loadAllData attempt ${attempt} failed:`, error.message);
        if (attempt < MAX_RETRIES) {
          // Quick backoff: 500ms, 1s between retries
          await new Promise(r => setTimeout(r, attempt * 500));
          continue;
        }
        return { ok: false, data: {} };
      }

      const result: Record<string, any> = {};
      for (const row of data || []) {
        result[row.key] = row.data;
      }
      console.log(`[persistence] ✓ loadAllData: ${Object.keys(result).length} keys loaded (attempt ${attempt})`);
      return { ok: true, data: result };
    } catch (err) {
      console.warn(`[persistence] loadAllData attempt ${attempt} exception:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 500));
        continue;
      }
      return { ok: false, data: {} };
    }
  }
  return { ok: false, data: {} };
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
