// PFLX v295 — shared server login. The PIN is checked by the pflx-auth Edge
// Function; apps hold a signed sign-in pass, never the PIN. Links from the
// Platform carry ?token=…, which is verified here before anyone is let in.
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co";
// Public anon key (the same one shipped in every PFLX page); env wins if set.
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eGlhZ2V4eXB0enZldHFqbW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODM4MTYsImV4cCI6MjA4OTY1OTgxNn0.hqHVlRu775dZfJrKxSFMNEPhANu5EFm7gJpaJ3RnbnY";
const TK = "pflx_auth_v1";

export type PflxWho = { id: string; brand: string; name: string; role: string };

const ORIGINS = [/^https:\/\/(www\.)?prototypeflx\.com$/, /^https:\/\/pflx-[a-z0-9-]+(-[a-z0-9-]+)*\.vercel\.app$/, /^https:\/\/x-live[a-z0-9-]*\.vercel\.app$/, /^https:\/\/thetomorrowteacher\.github\.io$/, /^http:\/\/localhost(:\d+)?$/];
export function isPflxOrigin(o: string): boolean { return ORIGINS.some((r) => r.test(String(o || ""))); }

async function call(body: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(BASE + "/functions/v1/pflx-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify(body),
    });
    try { return await r.json(); } catch { return { ok: false, error: "server_error" }; }
  } catch { return { ok: false, error: "offline" }; }
}
export function getToken(): string {
  try { const t = JSON.parse(localStorage.getItem(TK) || "null"); if (t && t.token && t.exp > Date.now()) return t.token; } catch {}
  return "";
}
function saveToken(token: string, who: PflxWho) {
  try {
    let exp = Date.now() + 2592000000;
    try { exp = JSON.parse(atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).exp || exp; } catch {}
    localStorage.setItem(TK, JSON.stringify({ token, pid: who.id, brand: who.brand, role: who.role, exp }));
  } catch {}
}
export function clearToken() { try { localStorage.removeItem(TK); } catch {} }
export async function pflxLogin(who: string, pin: string): Promise<{ ok: boolean; player?: PflxWho; error?: string }> {
  const r = await call({ action: "login", who, pin });
  if (r && r.ok && r.token) { saveToken(r.token, r.player); return { ok: true, player: r.player }; }
  return { ok: false, error: (r && r.error) || "error" };
}
export async function pflxVerify(token: string): Promise<PflxWho | null> {
  if (!token) return null;
  const r = await call({ action: "verify", token });
  if (r && r.ok && r.player) { saveToken(token, r.player); return r.player as PflxWho; }
  return null;
}
export async function pflxSetPin(newPin: string, targetId?: string): Promise<boolean> {
  const t = getToken(); if (!t) return false;
  const r = await call({ action: "setPin", token: t, newPin, targetId });
  return !!(r && r.ok);
}
