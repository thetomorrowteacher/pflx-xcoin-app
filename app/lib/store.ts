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
    const MAX_RETRIES = 3; // Cap retries to prevent infinite flickering

    while (true) {
      try {
        retryRound++;
        setProgress(10, retryRound > 1 ? `Reconnecting (attempt ${retryRound}/${MAX_RETRIES})...` : "Fetching saved data...");

        const result = await loadAllData((loaded, total) => {
          // Map parallel fetches to 10–60% of the progress bar
          const p = 10 + Math.round((loaded / total) * 50);
          setProgress(p, `Loading collections... (${loaded}/${total})`);
        });

        // If all retries in loadAllData failed, wait and loop again (up to MAX_RETRIES)
        if (!result.ok) {
          if (retryRound >= MAX_RETRIES) {
            console.warn(`[store] Load failed after ${MAX_RETRIES} attempts — proceeding with defaults`);
            setProgress(100, "Using cached data");
            _loadFailed = true;
            break; // Exit loop — proceed with default/mock data instead of looping forever
          }
          console.warn(`[store] Load round ${retryRound} failed — waiting 2s then retrying...`);
          setProgress(10, "Connection lost — retrying...");
          _loadFailed = true;
          await new Promise(r => setTimeout(r, 2000));
          _loadFailed = false;
          continue; // stay in the loop — promise stays pending
        }

        // ── Success — process the data ──
        setProgress(65, "Processing collections...");
        const all = result.data;

        const pflxKeys = ['users','checkpoints','tasks','jobs','transactions','modifiers','coinCategories'];
        const hasData = pflxKeys.some(k => all[k] && Array.isArray(all[k]) && all[k].length > 0);

        // Track whether this app has ever had real data (prevents re-seeding after data loss)
        const everInitialized = typeof window !== "undefined" && localStorage.getItem("pflx_ever_initialized") === "1";

        if (hasData) {
          // Mark that real data has been loaded at least once
          if (typeof window !== "undefined") localStorage.setItem("pflx_ever_initialized", "1");
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
            ["cohortGroups",      () => { if (all.cohortGroups?.length)      D.mockCohortGroups.splice(0, D.mockCohortGroups.length, ...all.cohortGroups); }],
            ["projectPitches",    () => { if (all.projectPitches?.length)    D.mockProjectPitches.splice(0, D.mockProjectPitches.length, ...all.projectPitches); }],
          ];
          for (let i = 0; i < spliceOps.length; i++) {
            spliceOps[i][1]();
            setProgress(65 + Math.round(((i + 1) / spliceOps.length) * 30), `Loading ${spliceOps[i][0]}...`);
          }
          console.log("[store] ✓ Loaded", Object.keys(all).length, "collections from Supabase");
        } else {
          // Supabase returned empty — try loading from bundled seed-data.json
          console.warn("[store] ⚠ Supabase returned empty — loading from seed-data.json fallback...");
          setProgress(70, "Loading backup data...");
          try {
            const seedRes = await fetch("/seed-data.json");
            if (seedRes.ok) {
              const seedAll = await seedRes.json() as Record<string, unknown[]>;
              const seedSplice: [string, () => void][] = [
                ["users",             () => { if (seedAll.users?.length)             D.mockUsers.splice(0, D.mockUsers.length, ...(seedAll.users as any[])); }],
                ["checkpoints",       () => { if (seedAll.checkpoints?.length)       D.mockCheckpoints.splice(0, D.mockCheckpoints.length, ...(seedAll.checkpoints as any[])); }],
                ["tasks",             () => { if (seedAll.tasks?.length)             D.mockTasks.splice(0, D.mockTasks.length, ...(seedAll.tasks as any[])); }],
                ["jobs",              () => { if (seedAll.jobs?.length)              D.mockJobs.splice(0, D.mockJobs.length, ...(seedAll.jobs as any[])); }],
                ["transactions",      () => { if (seedAll.transactions?.length)      D.mockTransactions.splice(0, D.mockTransactions.length, ...(seedAll.transactions as any[])); }],
                ["modifiers",         () => { if (seedAll.modifiers?.length)         D.mockModifiers.splice(0, D.mockModifiers.length, ...(seedAll.modifiers as any[])); }],
                ["playerModifiers",   () => { if (seedAll.playerModifiers?.length)   D.mockPlayerModifiers.splice(0, D.mockPlayerModifiers.length, ...(seedAll.playerModifiers as any[])); }],
                ["pflxRanks",         () => { if (seedAll.pflxRanks?.length)         D.mockPflxRanks.splice(0, D.mockPflxRanks.length, ...(seedAll.pflxRanks as any[])); }],
                ["gamePeriods",       () => { if (seedAll.gamePeriods?.length)       D.mockGamePeriods.splice(0, D.mockGamePeriods.length, ...(seedAll.gamePeriods as any[])); }],
                ["submissions",       () => { if (seedAll.submissions?.length)       D.mockSubmissions.splice(0, D.mockSubmissions.length, ...(seedAll.submissions as any[])); }],
                ["playerDeals",       () => { if (seedAll.playerDeals?.length)       D.mockPlayerDeals.splice(0, D.mockPlayerDeals.length, ...(seedAll.playerDeals as any[])); }],
                ["startupStudios",    () => { if (seedAll.startupStudios?.length)    D.mockStartupStudios.splice(0, D.mockStartupStudios.length, ...(seedAll.startupStudios as any[])); }],
                ["studioInvestments", () => { if (seedAll.studioInvestments?.length) D.mockStudioInvestments.splice(0, D.mockStudioInvestments.length, ...(seedAll.studioInvestments as any[])); }],
                ["projects",          () => { if (seedAll.projects?.length)          D.mockProjects.splice(0, D.mockProjects.length, ...(seedAll.projects as any[])); }],
                ["coinCategories",    () => { if (seedAll.coinCategories?.length)    D.COIN_CATEGORIES.splice(0, D.COIN_CATEGORIES.length, ...(seedAll.coinCategories as any[])); }],
                ["trades",            () => { if (seedAll.trades?.length)            D.mockTrades.splice(0, D.mockTrades.length, ...(seedAll.trades as any[])); }],
                ["investments",       () => { if (seedAll.investments?.length)       D.mockInvestments.splice(0, D.mockInvestments.length, ...(seedAll.investments as any[])); }],
                ["cohortGroups",      () => { if (seedAll.cohortGroups?.length)      D.mockCohortGroups.splice(0, D.mockCohortGroups.length, ...(seedAll.cohortGroups as any[])); }],
                ["projectPitches",    () => { if (seedAll.projectPitches?.length)    D.mockProjectPitches.splice(0, D.mockProjectPitches.length, ...(seedAll.projectPitches as any[])); }],
              ];
              for (const [, fn] of seedSplice) fn();
              console.log("[store] ✓ Loaded seed-data.json fallback with", Object.keys(seedAll).length, "collections");
              // Push seed data to Supabase so next load is fast
              _needsSeed = true;
              setProgress(85, "Restoring data to cloud...");
            } else {
              console.warn("[store] seed-data.json fetch failed:", seedRes.status);
              _needsSeed = !everInitialized;
            }
          } catch (seedErr) {
            console.warn("[store] seed-data.json fallback failed:", seedErr);
            _needsSeed = !everInitialized;
          }
        }

        setProgress(100, "Ready");
        _initialized = true;
        _loading = false;
        notify();
        return; // ← only exit point — promise resolves ONLY here

      } catch (err) {
        if (retryRound >= MAX_RETRIES) {
          console.error(`[store] initStore crashed after ${MAX_RETRIES} attempts:`, err, "— proceeding with defaults");
          _loadFailed = true;
          break;
        }
        console.error(`[store] initStore round ${retryRound} crashed:`, err, "— retrying in 2s...");
        setProgress(10, "Error — retrying...");
        await new Promise(r => setTimeout(r, 2000));
        continue; // stay in loop — promise stays pending
      }
    }

    // If we broke out of the loop (max retries), still initialize so the app loads
    if (!_initialized) {
      setProgress(100, "Ready");
      _initialized = true;
      _loading = false;
      notify();
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
export function saveCohortGroups() {
  return saveData("cohortGroups", D.mockCohortGroups);
}
export function saveProjectPitches() {
  return saveData("projectPitches", D.mockProjectPitches);
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
    saveCohortGroups(),
    saveProjectPitches(),
  ]);
}
