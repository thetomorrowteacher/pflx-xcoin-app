// Centralized data store — bridges mock data ↔ Supabase persistence
// On first load: pull from Supabase. If empty, seed with mock defaults.
// On every mutation: update in-memory + save to Supabase.

import { loadAllData, saveData, DataKey } from "./persistence";
import * as D from "./data";

let _initialized = false;
let _loading = false;
let _initPromise: Promise<void> | null = null;
let _needsSeed = false; // True if Supabase was empty on first load

// Listeners for re-render triggers
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Initialize the store: load all data from Supabase.
 * If a collection doesn't exist in Supabase yet, keep mock defaults.
 * If it does exist, overwrite the in-memory mock data.
 * Safe to call multiple times — deduplicates.
 */
export async function initStore(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _loading = true;
  _initPromise = (async () => {
    try {
      const all = await loadAllData();

      // Check if Supabase has any PFLX data (not just pathway keys)
      const pflxKeys = ['users','checkpoints','tasks','jobs','transactions','modifiers','coinCategories'];
      const hasData = pflxKeys.some(k => all[k] && Array.isArray(all[k]) && all[k].length > 0);

      if (hasData) {
        // Supabase has data — overwrite mocks
        if (all.users?.length) D.mockUsers.splice(0, D.mockUsers.length, ...all.users);
        if (all.checkpoints?.length) D.mockCheckpoints.splice(0, D.mockCheckpoints.length, ...all.checkpoints);
        if (all.tasks?.length) D.mockTasks.splice(0, D.mockTasks.length, ...all.tasks);
        if (all.jobs?.length) D.mockJobs.splice(0, D.mockJobs.length, ...all.jobs);
        if (all.transactions?.length) D.mockTransactions.splice(0, D.mockTransactions.length, ...all.transactions);
        if (all.modifiers?.length) D.mockModifiers.splice(0, D.mockModifiers.length, ...all.modifiers);
        if (all.playerModifiers?.length) D.mockPlayerModifiers.splice(0, D.mockPlayerModifiers.length, ...all.playerModifiers);
        if (all.pflxRanks?.length) D.mockPflxRanks.splice(0, D.mockPflxRanks.length, ...all.pflxRanks);
        if (all.gamePeriods?.length) D.mockGamePeriods.splice(0, D.mockGamePeriods.length, ...all.gamePeriods);
        if (all.submissions?.length) D.mockSubmissions.splice(0, D.mockSubmissions.length, ...all.submissions);
        if (all.playerDeals?.length) D.mockPlayerDeals.splice(0, D.mockPlayerDeals.length, ...all.playerDeals);
        if (all.startupStudios?.length) D.mockStartupStudios.splice(0, D.mockStartupStudios.length, ...all.startupStudios);
        if (all.studioInvestments?.length) D.mockStudioInvestments.splice(0, D.mockStudioInvestments.length, ...all.studioInvestments);
        if (all.projects?.length) D.mockProjects.splice(0, D.mockProjects.length, ...all.projects);
        if (all.coinCategories?.length) D.COIN_CATEGORIES.splice(0, D.COIN_CATEGORIES.length, ...all.coinCategories);
        if (all.trades?.length) D.mockTrades.splice(0, D.mockTrades.length, ...all.trades);
        if (all.investments?.length) D.mockInvestments.splice(0, D.mockInvestments.length, ...all.investments);
      } else {
        // Supabase is empty — seed it with mock defaults
        _needsSeed = true;
        console.log("[store] Supabase empty — seeding with default data");
      }

      _initialized = true;
      notify();
    } catch (err) {
      console.error("[store] initStore failed:", err);
    } finally {
      _loading = false;
    }
  })();

  return _initPromise;
}

export function needsSeed() {
  return _needsSeed;
}
export function clearSeedFlag() {
  _needsSeed = false;
}
export function isStoreReady() {
  return _initialized;
}
export function isStoreLoading() {
  return _loading;
}

// ─── Save helpers (call after any mutation) ──────────────────────

export function saveUsers() {
  return saveData("users", D.mockUsers);
}
export function saveCheckpoints() {
  return saveData("checkpoints", D.mockCheckpoints);
}
export function saveTasks() {
  return saveData("tasks", D.mockTasks);
}
export function saveJobs() {
  return saveData("jobs", D.mockJobs);
}
export function saveTransactions() {
  return saveData("transactions", D.mockTransactions);
}
export function saveModifiers() {
  return saveData("modifiers", D.mockModifiers);
}
export function savePlayerModifiers() {
  return saveData("playerModifiers", D.mockPlayerModifiers);
}
export function savePflxRanks() {
  return saveData("pflxRanks", D.mockPflxRanks);
}
export function saveGamePeriods() {
  return saveData("gamePeriods", D.mockGamePeriods);
}
export function saveSubmissions() {
  return saveData("submissions", D.mockSubmissions);
}
export function savePlayerDeals() {
  return saveData("playerDeals", D.mockPlayerDeals);
}
export function saveStartupStudios() {
  return saveData("startupStudios", D.mockStartupStudios);
}
export function saveStudioInvestments() {
  return saveData("studioInvestments", D.mockStudioInvestments);
}
export function saveProjects() {
  return saveData("projects", D.mockProjects);
}
export function saveCoinCategories() {
  return saveData("coinCategories", D.COIN_CATEGORIES);
}
export function saveTrades() {
  return saveData("trades", D.mockTrades);
}
export function saveInvestments() {
  return saveData("investments", D.mockInvestments);
}

/**
 * Convenience: save everything at once (used after bulk operations).
 */
export async function saveAll() {
  await Promise.all([
    saveUsers(),
    saveCheckpoints(),
    saveTasks(),
    saveJobs(),
    saveTransactions(),
    saveModifiers(),
    savePlayerModifiers(),
    savePflxRanks(),
    saveGamePeriods(),
    saveSubmissions(),
    savePlayerDeals(),
    saveStartupStudios(),
    saveStudioInvestments(),
    saveProjects(),
    saveCoinCategories(),
    saveTrades(),
    saveInvestments(),
  ]);
}
