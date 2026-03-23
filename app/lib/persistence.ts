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
 * Returns a map of key → data, with null for missing keys.
 */
export async function loadAllData(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase.from("app_data").select("key, data");

    if (error) {
      console.error("[persistence] loadAllData error:", error);
      return {};
    }

    const result: Record<string, any> = {};
    for (const row of data || []) {
      result[row.key] = row.data;
    }
    return result;
  } catch (err) {
    console.error("[persistence] loadAllData exception:", err);
    return {};
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
