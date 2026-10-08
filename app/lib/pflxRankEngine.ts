/**
 * PflxRankEngine — Pro Rank rules shared with the Console (preview.html).
 * Pure functions, no DOM, no storage. Behaviour must match the Console copy.
 *
 *  - XC requirement uses LIFETIME XC (totalXcoin), never the spendable balance.
 *  - Checkpoint + badge requirements are enforced unless the rank has enforceRequirements === false
 *    (host bypass) or the player has rankBypass === true.
 *  - Badge requirements STACK up the ladder (a rank also needs everything lower ranks need)
 *    unless the rank has stackRequirements === false.
 *  - A specific-badge requirement may list alternatives with "|" ("Design Thinker L1|BrandBuilder").
 *  - The Master rank (godTier / masterOnly) is only ever returned for the two Master Host accounts.
 */
export interface EngineRank {
  id?: string;
  level: number;
  name: string;
  icon?: string;
  image?: string;
  color?: string;
  group?: string;
  xcoinUnlock: number;
  checkpointsRequired?: number;
  badgeTypeRequirements?: string[];
  specificBadgeRequirements?: string[];
  enforceRequirements?: boolean;
  stackRequirements?: boolean;
  godTier?: boolean;
  masterOnly?: boolean;
}
export interface EngineFacts {
  xc: number;
  checkpoints: number | (() => number);
  badgeKeys: Record<string, boolean>;
  tiers: Record<string, number>;
}
export interface EnginePlayer { id?: string; rankOverride?: string | number | null; rankBypass?: boolean }
export interface RankCheck {
  kind: "xc" | "checkpoints" | "type" | "badge";
  label: string;
  have: number;
  need: number;
  met: boolean;
  enforced: boolean;
  alts?: string[];
  via?: string | null;
}
export interface RankEval { met: boolean; checks: RankCheck[]; rank: EngineRank }
export interface RankResolution {
  current: EngineRank | null;
  next: EngineRank | null;
  nextEval: RankEval | null;
  master: boolean;
  overridden: boolean;
  bypassed: boolean;
}

export const MASTER_IDS = ["admin-0", "admin-1"]; // PrototypeFLX (PFLX HOST) + Mr. Johnson (THETOMORROWTEACHER)

const ALIASES: Record<string, string> = {
  "personal branding": "personal branding l1",
  "e portfolio starter": "portfolio starter",
  "digital citizen": "digital citizen l1",
  "digital citizen cybersecurity": "digital citizen l1",
  "pflx user certification": "pflx user cert",
  "brand builder": "brandbuilder",
};

export function norm(s: unknown): string {
  let t = String(s == null ? "" : s).toLowerCase().replace(/&/g, " and ").replace(/\band\b/g, " ");
  t = t.replace(/\blevel\s*(\d+)/g, "l$1").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return ALIASES[t] || t;
}

export function isMasterHost(p?: { id?: string; playerId?: string } | null): boolean {
  if (!p) return false;
  return MASTER_IDS.indexOf(String(p.id || p.playerId || "")) >= 0;
}

export function ladder(ranks: EngineRank[]): EngineRank[] {
  return (ranks || []).filter(r => r && !r.godTier && !r.masterOnly).sort((a, b) => (a.level || 0) - (b.level || 0));
}
export function masterRank(ranks: EngineRank[]): EngineRank | null {
  return (ranks || []).find(r => r && (r.godTier || r.masterOnly)) || null;
}
function uniq(arr: string[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  arr.forEach(x => { const k = norm(x); if (k && !seen[k]) { seen[k] = true; out.push(x); } });
  return out;
}
export function effectiveReqs(rank: EngineRank, ranks: EngineRank[]) {
  const types: string[] = [];
  const specifics: string[] = [];
  const pool = rank.stackRequirements === false ? [rank] : ladder(ranks).filter(r => (r.level || 0) <= (rank.level || 0));
  if (pool.indexOf(rank) < 0) pool.push(rank);
  pool.forEach(r => {
    (r.badgeTypeRequirements || []).forEach(t => types.push(t));
    (r.specificBadgeRequirements || []).forEach(s => specifics.push(s));
  });
  return { types: uniq(types), specifics: uniq(specifics) };
}
function enforced(rank: EngineRank, player?: EnginePlayer | null) {
  if (player && player.rankBypass) return false;
  return rank.enforceRequirements !== false;
}
export function altsOf(req: string): string[] {
  return String(req).split("|").map(s => s.trim()).filter(Boolean);
}
export function holdsBadge(req: string, facts: EngineFacts): string | null {
  const keys = (facts && facts.badgeKeys) || {};
  for (const a of altsOf(req)) if (keys[norm(a)]) return a;
  return null;
}
function cpCount(facts: EngineFacts): number {
  if (!facts) return 0;
  let c = facts.checkpoints;
  if (typeof c === "function") { try { c = c(); } catch { c = 0; } facts.checkpoints = c as number; }
  return Number(c) || 0;
}
export function evaluate(rank: EngineRank, facts: EngineFacts, ranks: EngineRank[], player?: EnginePlayer | null): RankEval {
  const checks: RankCheck[] = [];
  const xc = Number(facts && facts.xc) || 0;
  const need = Number(rank.xcoinUnlock) || 0;
  checks.push({ kind: "xc", label: "Lifetime XC", have: xc, need, met: xc >= need, enforced: true });
  const enf = enforced(rank, player);
  const cpNeed = Number(rank.checkpointsRequired) || 0;
  if (cpNeed > 0) {
    const have = cpCount(facts);
    checks.push({ kind: "checkpoints", label: "Checkpoints completed", have, need: cpNeed, met: have >= cpNeed, enforced: enf });
  }
  const req = effectiveReqs(rank, ranks);
  const tiers = (facts && facts.tiers) || {};
  req.types.forEach(t => {
    const n = Number(tiers[String(t).toLowerCase()]) || 0;
    checks.push({ kind: "type", label: t + " badge", have: n, need: 1, met: n >= 1, enforced: enf });
  });
  req.specifics.forEach(s => {
    const alts = altsOf(s);
    const got = holdsBadge(s, facts);
    checks.push({ kind: "badge", label: alts.join(" or "), alts, have: got ? 1 : 0, need: 1, met: !!got, via: got, enforced: enf });
  });
  return { met: checks.every(c => c.met || !c.enforced), checks, rank };
}
export function resolve(player: EnginePlayer | null | undefined, facts: EngineFacts, ranks: EngineRank[], opts?: { skipNext?: boolean }): RankResolution {
  const lad = ladder(ranks);
  const out: RankResolution = { current: lad[0] || null, next: null, nextEval: null, master: false, overridden: false, bypassed: !!(player && player.rankBypass) };
  if (!lad.length) return out;
  if (isMasterHost(player)) {
    const m = masterRank(ranks);
    if (m) { out.current = m; out.master = true; return out; }
  }
  const ov = player && player.rankOverride;
  if (ov !== undefined && ov !== null && ov !== "") {
    const o = lad.find(r => r.id === ov || r.level === ov || r.level === Number(ov) || r.name === ov);
    if (o) { out.current = o; out.overridden = true; }
  }
  if (!out.overridden) {
    let cur = lad[0];
    for (let i = lad.length - 1; i >= 0; i--) {
      if (i === 0) { cur = lad[0]; break; } // rank 1 is the floor
      if ((Number(facts && facts.xc) || 0) < (Number(lad[i].xcoinUnlock) || 0)) continue; // cheap XC gate first
      if (evaluate(lad[i], facts, ranks, player).met) { cur = lad[i]; break; }
    }
    out.current = cur;
  }
  const idx = out.current ? lad.indexOf(out.current) : -1;
  out.next = idx >= 0 && idx < lad.length - 1 ? lad[idx + 1] : null;
  if (out.next && !(opts && opts.skipNext)) out.nextEval = evaluate(out.next, facts, ranks, player);
  return out;
}
export function progress(ev: RankEval | null): number {
  if (!ev) return 1;
  const cs = ev.checks.filter(c => c.enforced);
  if (!cs.length) return 1;
  let sum = 0;
  cs.forEach(c => {
    if (c.met) sum += 1;
    else if (c.kind === "xc" || c.kind === "checkpoints") sum += Math.max(0, Math.min(1, c.have / (c.need || 1)));
  });
  return sum / cs.length;
}
export function buildFacts(opts: {
  xc: number;
  badges?: { id?: string; name?: string; tier?: string; type?: string }[];
  tierCounts?: Record<string, number>;
  checkpoints: number | (() => number);
}): EngineFacts {
  const keys: Record<string, boolean> = {};
  const tiers: Record<string, number> = {};
  (opts.badges || []).forEach(b => {
    if (!b) return;
    [b.name, b.id && String(b.id).replace(/^badge[-_]/, "").replace(/[-_]+/g, " ")].forEach(nm => { if (nm) keys[norm(nm)] = true; });
    const t = String(b.tier || b.type || "").toLowerCase();
    if (t) tiers[t] = (tiers[t] || 0) + 1;
  });
  const tc = opts.tierCounts || {};
  Object.keys(tc).forEach(k => { const v = Number(tc[k]) || 0; const kk = k.toLowerCase(); if (v > (tiers[kk] || 0)) tiers[kk] = v; });
  return { xc: Number(opts.xc) || 0, checkpoints: opts.checkpoints, badgeKeys: keys, tiers };
}
