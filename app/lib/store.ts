// Centralized data store — bridges mock data ↔ Supabase persistence
// On first load: pull from Supabase. If empty, seed with mock defaults.
// On every mutation: update in-memory + save to Supabase.

import { loadAllData, saveData, DataKey } from "./persistence";
import * as D from "./data";

let _initialized = false;
let _loading = false;
let _initPromise: Promise<void> | null = null;
let _needsSeed = false; // True if Supabase was genuinely empty on first load
let _loadFailed = false; // True if Supabase load errored — prevent auto-save from overwriting

// ─── Load progress (0–100) for the loading bar ───────────────────
let _loadProgress = 0;
let _loadStatus = "Connecting to cloud...";
type ProgressListener = (progress: number, status: string) => void;
const progressListeners = new Set<ProgressListener>();
export function onLoadProgress(fn: ProgressListener) {
  progressListeners.add(fn);
  // Immediately fire with current state
  fn(_loadProgress, _loadStatus);
  return () => progressListeners.delete(fn);
}
function setProgress(p: number, status?: string) {
  _loadProgress = p;
  if (status) _loadStatus = status;
  progressListeners.forEach(fn => fn(_loadProgress, _loadStatus));
}

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
  setProgress(5, "Connecting to cloud...");

  // CRITICAL: The promise only resolves when data is SUCCESSFULLY loaded.
  // On failure we loop/retry inside the same promise so StoreProvider
  // never sees a resolved promise with default data.
  _initPromise = (async () => {
    let retryRound = 0;

    while (true) {
      try {
        retryRound++;
        setProgress(10, retryRound > 1 ? `Reconnecting (round ${retryRound})...` : "Fetching saved data...");

        const result = await loadAllData((attempt, max) => {
          const p = 10 + Math.round((attempt / max) * 50);
          setProgress(p, attempt > 1 ? `Retrying... (${attempt}/${max})` : "Fetching saved data...");
        });

        // If all retries in loadAllData failed, wait and loop again
        if (!result.ok) {
          console.warn(`[store] Load round ${retryRound} failed — waiting 5s then retrying...`);
          setProgress(10, "Connection lost — retrying...");
          _loadFailed = true;
          await new Promise(r => setTimeout(r, 5000));
          _loadFailed = false;
          continue; // stay in the loop — promise stays pending
        }

        // ── Success — process the data ──
        setProgress(65, "Processing collections...");
        const all = result.data;

        const pflxKeys = ['users','checkpoints','tasks','jobs','transactions','modifiers','coinCategories'];
        const hasData = pflxKeys.some(k => all[k] && Array.isArray(all[k]) && all[k].length > 0);

        if (hasData) {
          const spliceOps: [string, () => void][] = [
            ["users",             () => { if (all.users?.length)             D.mockUsers.splice(0, D.mockUsers.length, ...all.users); }],
            ["checkpoints",       () => { if (all.checkpoints?.length)       D.mockCheckpoints.splice(0, D.mockCheckpoints.length, ...all.checkpoints); }],
            ["tasks",             () => { if (all.tasks?.length)             D.mockTasks.splice(0, D.mockTasks.length, ...all.tasks); }],
            ["jobs",              () => { if (all.jobs?.length)              D.mockJobs.splice(0, D.mockJobs.length, ...all.jobs); }],
            ["transactions",      () => { if (all.transactions?.length)      D.mockTransactions.splice(0, D.mockTransactions.length, ...all.transactions); }],
            ["modifiers",         () => { if (all.modifiers?.length)         D.mockModifiers.splice(0, D.mockModifiers.length, ...all.modifiers); }],
            ["playerModifiers",   () => { if (all.playerModifiers?.length)   D.mockPlayerModifiers.splice(0, D.mockPlayerModifiers.length, ...all.playerModifiers); }],
            ["pflxRanks",         () => { if (all.pflxRanks?.length)         D.mockPflxRanks.splice(0, D.mockPflxRanks.length, ...all.pflxRanks); }],
            ["gamePeriods",       () => { if (all.gamePeriods?.length)       D.mockGamePeriods.splice(0, D.mockGamePeriods.length, ...all.gamePeriods); }],
            ["submissions",       () => { if (all.submissions?.length)       D.mockSubmissions.splice(0, D.mockSubmissions.length, ...all.submissions); }],
            ["playerDeals",       () => { if (all.playerDeals?.length)       D.mockPlayerDeals.splice(0, D.mockPlayerDeals.length, ...all.playerDeals); }],
            ["startupStudios",    () => { if (all.startupStudios?.length)    D.mockStartupStudios.splice(0, D.mockStartupStudios.length, ...all.startupStudios); }],
            ["studioInvestments", () => { if (all.studioInvestments?.length) D.mockStudioInvestments.splice(0, D.mockStudioInvestments.length, ...all.studioInvestments); }],
            ["projects",          () => { if (all.projects?.length)          D.mockProjects.splice(0, D.mockProjects.length, ...all.projects); }],
            ["coinCategories",    () => { if (all.coinCategories?.length)    D.COIN_CATEGORIES.splice(0, D.COIN_CATEGORIES.length, ...all.coinCategories); }],
            ["trades",            () => { if (all.trades?.length)            D.mockTrades.splice(0, D.mockTrades.length, ...all.trades); }],
            ["investments",       () => { if (all.investments?.length)       D.mockInvestments.splice(0, D.mockInvestments.length, ...all.investments); }],
          ];
          for (let i = 0; i < spliceOps.length; i++) {
            spliceOps[i][1]();
            setProgress(65 + Math.round(((i + 1) / spliceOps.length) * 30), `Loading ${spliceOps[i][0]}...`);
          }
          console.log("[store] ✓ Loaded", Object.keys(all).length, "collections from Supabase");
        } else {
          _needsSeed = true;
          setProgress(80, "First launch — preparing data...");
          console.log("[store] Supabase genuinely empty — will seed with default data");
        }

        setProgress(100, "Ready");
        _initialized = true;
        _loading = false;
        notify();
        return; // ← only exit point — promise resolves ONLY here

      } catch (err) {
        console.error(`[store] initStore round ${retryRound} crashed:`, err, "— retrying in 5s...");
        setProgress(10, "Error — retrying...");
        await new Promise(r => setTimeout(r, 5000));
        continue; // stay in loop — promise stays pending
      }
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
export function didLoadFail() {
  return _loadFailed;
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
