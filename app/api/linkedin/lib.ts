// ═══════════════════════════════════════════════════════════════════
// LinkedIn OAuth helpers (phase 2 — "Share on LinkedIn" product)
//
// Requires two Vercel env vars (server-side only, never NEXT_PUBLIC):
//   LINKEDIN_CLIENT_ID
//   LINKEDIN_CLIENT_SECRET
//
// Tokens are AES-256-GCM encrypted with a key derived from the client
// secret before being persisted to the shared app_data table, because
// that table is anon-readable by design across PFLX apps.
// ═══════════════════════════════════════════════════════════════════
import crypto from "crypto";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eGlhZ2V4eXB0enZldHFqbW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODM4MTYsImV4cCI6MjA4OTY1OTgxNn0.hqHVlRu775dZfJrKxSFMNEPhANu5EFm7gJpaJ3RnbnY";

export const LI_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
export const LI_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
export const TOKENS_KEY = "linkedin_tokens";

export interface LinkedInToken {
  playerId: string;
  memberUrn: string;        // urn:li:person:xxxx
  accessTokenEnc: string;   // encrypted
  expiresAt: string;        // ISO
  connectedAt: string;
}

// ── app_data KV (same pattern as the other PFLX server routes) ────
export async function loadKey<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/app_data?key=eq.${key}&select=data`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.data ?? null;
  } catch { return null; }
}

export async function saveKey(key: string, value: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/app_data?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key, data: value, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch { return false; }
}

// ── token encryption (AES-256-GCM, key derived from client secret) ─
function aesKey(): Buffer {
  return crypto.createHash("sha256").update("pflx-li-" + LI_CLIENT_SECRET).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(blob: string): string | null {
  try {
    const [ivB, tagB, encB] = blob.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
  } catch { return null; }
}

export async function getStoredToken(playerId: string): Promise<{ accessToken: string; memberUrn: string } | null> {
  const all = ((await loadKey<LinkedInToken[]>(TOKENS_KEY)) || []).filter(t => t && t.playerId);
  const rec = all.find(t => t.playerId === playerId);
  if (!rec) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null; // expired (60-day LinkedIn tokens)
  const accessToken = decryptToken(rec.accessTokenEnc);
  if (!accessToken) return null;
  return { accessToken, memberUrn: rec.memberUrn };
}

export async function storeToken(playerId: string, memberUrn: string, accessToken: string, expiresInSec: number) {
  const all = ((await loadKey<LinkedInToken[]>(TOKENS_KEY)) || []).filter(t => t && t.playerId !== playerId);
  all.push({
    playerId,
    memberUrn,
    accessTokenEnc: encryptToken(accessToken),
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    connectedAt: new Date().toISOString(),
  });
  await saveKey(TOKENS_KEY, all);
}

export function baseUrlFromReq(req: Request): string {
  const u = new URL(req.url);
  const host = (req.headers.get("x-forwarded-host") || u.host);
  const proto = (req.headers.get("x-forwarded-proto") || "https");
  return `${proto}://${host}`;
}
