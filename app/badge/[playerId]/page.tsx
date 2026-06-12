// ═══════════════════════════════════════════════════════════════════
// PUBLIC DIGITAL BADGE PAGE — server-rendered for LinkedIn/social
// crawlers (OG meta tags require SSR; client-injected tags are not
// seen by the LinkedIn preview bot).
//
// URL:  /badge/<playerId>            → full badge wall
//       /badge/<playerId>?b=<name>   → highlights one badge (used by
//                                      per-badge LinkedIn share links)
//
// PRIVACY: brand name ONLY — never the player's real name or email.
// Reads the cloud `users` + `submissions` collections via Supabase
// REST (anon key, read-only, same key embedded across PFLX apps).
// ═══════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { headers } from "next/headers";
import { COIN_CATEGORIES } from "../../lib/data";
import ShareButtons from "./ShareButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eGlhZ2V4eXB0enZldHFqbW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODM4MTYsImV4cCI6MjA4OTY1OTgxNn0.hqHVlRu775dZfJrKxSFMNEPhANu5EFm7gJpaJ3RnbnY";

const ORG_NAME = "PFLX — The Tomorrow Teacher";

interface CloudUser {
  id: string;
  brandName?: string;
  rank?: number;
  digitalBadges?: number;
  totalXcoin?: number;
  joinedAt?: string;
}
interface CloudSubmission {
  id: string;
  playerId: string;
  coinType: string;
  amount: number;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
}
interface EarnedBadge {
  name: string;
  count: number;
  earnedAt: string;      // most recent earn date
  description: string;
  xc: number;
  category: string;      // "Primary" | "Premium" | "Executive" | "Signature" | "Badge"
}

async function loadKey<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_data?key=eq.${key}&select=data`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.data ?? null;
  } catch {
    return null;
  }
}

// Badge catalog lookup — prefers the host-customized cloud catalog
// (`coinCategories`, may include renamed/custom badges) and falls back
// to the static COIN_CATEGORIES build.
interface CatalogCat { name: string; coins: { name: string; description?: string; xc?: number }[] }
function catalogLookup(name: string, cloudCats: CatalogCat[] | null): { description: string; xc: number; category: string } {
  const sources: CatalogCat[][] = [];
  if (Array.isArray(cloudCats) && cloudCats.length) sources.push(cloudCats);
  sources.push(COIN_CATEGORIES as unknown as CatalogCat[]);
  for (const cats of sources) {
    for (const cat of cats) {
      const coin = (cat.coins || []).find(c => c.name === name);
      if (coin) {
        const short = String(cat.name || "Badge").split(" ")[0]; // "Primary" / "Premium" / "Executive" / "Signature"
        return { description: coin.description || "PFLX Digital Badge", xc: coin.xc || 0, category: short };
      }
    }
  }
  return { description: "PFLX Digital Badge", xc: 0, category: "Badge" };
}

async function getBadgeData(playerId: string): Promise<{ brand: string; rank: number; total: number; badges: EarnedBadge[] } | null> {
  const [users, subs, cloudCats] = await Promise.all([
    loadKey<CloudUser[]>("users"),
    loadKey<CloudSubmission[]>("submissions"),
    loadKey<CatalogCat[]>("coinCategories"),
  ]);
  const u = (Array.isArray(users) ? users : []).find(x => x.id === playerId);
  if (!u) return null;
  const approved = (Array.isArray(subs) ? subs : []).filter(
    s => s.playerId === playerId && s.status === "approved"
  );
  const byName = new Map<string, EarnedBadge>();
  for (const s of approved) {
    const when = s.reviewedAt || s.submittedAt || "";
    const cur = byName.get(s.coinType);
    if (cur) {
      cur.count += s.amount || 1;
      if (when > cur.earnedAt) cur.earnedAt = when;
    } else {
      const info = catalogLookup(s.coinType, cloudCats);
      byName.set(s.coinType, { name: s.coinType, count: s.amount || 1, earnedAt: when, ...info });
    }
  }
  const badges = Array.from(byName.values()).sort((a, b) => (b.earnedAt > a.earnedAt ? 1 : -1));
  return {
    brand: u.brandName || "PFLX Player",   // privacy: brand only, never real name
    rank: u.rank || 1,
    total: u.digitalBadges || badges.reduce((s, b) => s + b.count, 0),
    badges,
  };
}

function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "pflx-xcoin-app.vercel.app";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

const CAT_COLORS: Record<string, string> = {
  Primary: "#3b82f6",
  Premium: "#a855f7",
  Executive: "#f5c842",
  Signature: "#ef4444",
  Badge: "#00d4ff",
};

// ── OG metadata (what LinkedIn's crawler reads) ────────────────────
export async function generateMetadata(
  { params, searchParams }: { params: { playerId: string }; searchParams: { b?: string } }
): Promise<Metadata> {
  const data = await getBadgeData(params.playerId);
  if (!data) return { title: "PFLX Digital Badge" };
  const focus = searchParams?.b ? data.badges.find(b => b.name === searchParams.b) : null;
  const title = focus
    ? `${data.brand} earned the "${focus.name}" Digital Badge`
    : `${data.brand} — PFLX Digital Badge Wall (${data.total} badges)`;
  const description = focus
    ? `${focus.description} Verified ${focus.category} Badge issued by ${ORG_NAME}.`
    : `Verified Digital Badges earned by ${data.brand} on the PFLX gamified learning platform. Issued by ${ORG_NAME}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: "PFLX", type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

// ── Page ───────────────────────────────────────────────────────────
export default async function PublicBadgePage(
  { params, searchParams }: { params: { playerId: string }; searchParams: { b?: string } }
) {
  const data = await getBadgeData(params.playerId);
  const base = baseUrl();

  if (!data) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: "center", color: "#8a92b0", fontFamily: "monospace" }}>
          <div style={{ fontSize: 48 }}>🛡️</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Badge record not found.</div>
        </div>
      </div>
    );
  }

  const focusName = searchParams?.b || "";
  const pageUrl = `${base}/badge/${params.playerId}`;

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header card */}
        <div style={card}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#00d4ff", fontWeight: 700 }}>
            VERIFIED DIGITAL BADGES
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginTop: 6, letterSpacing: 1 }}>
            {data.brand}
          </div>
          <div style={{ fontSize: 12, color: "#8a92b0", marginTop: 6 }}>
            Evolution Rank {data.rank} · {data.total} Digital Badge{data.total === 1 ? "" : "s"} earned
          </div>
          <div style={{ fontSize: 11, color: "#5a6280", marginTop: 10 }}>
            Issued by <span style={{ color: "#f5c842" }}>{ORG_NAME}</span> · Verified on the PFLX platform
          </div>
        </div>

        {/* Badge list */}
        {data.badges.length === 0 && (
          <div style={{ ...card, textAlign: "center", color: "#5a6280", fontSize: 13 }}>
            No approved badges yet — check back soon.
          </div>
        )}
        {data.badges.map(b => {
          const color = CAT_COLORS[b.category] || CAT_COLORS.Badge;
          const isFocus = b.name === focusName;
          const earned = b.earnedAt ? new Date(b.earnedAt) : null;
          return (
            <div
              key={b.name}
              style={{
                ...card,
                border: isFocus ? `2px solid ${color}` : "1px solid #1a2236",
                boxShadow: isFocus ? `0 0 30px ${color}44` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: `${color}22`, border: `1px solid ${color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                }}>
                  🏅
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{b.name}</span>
                    {b.count > 1 && (
                      <span style={{ fontSize: 10, color, fontWeight: 700 }}>×{b.count}</span>
                    )}
                    <span style={{
                      fontSize: 9, padding: "2px 8px", borderRadius: 99,
                      background: `${color}1c`, color, border: `1px solid ${color}44`,
                      letterSpacing: 1, fontWeight: 700,
                    }}>
                      {b.category.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#8a92b0", marginTop: 5, lineHeight: 1.5 }}>
                    {b.description}
                  </div>
                  <div style={{ fontSize: 10, color: "#5a6280", marginTop: 6 }}>
                    {earned ? `Earned ${earned.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : "Earned on PFLX"}
                    {b.xc > 0 ? ` · ${b.xc} XC value` : ""}
                  </div>
                  <ShareButtons
                    badgeName={b.name}
                    orgName={ORG_NAME}
                    pageUrl={pageUrl}
                    certId={`${params.playerId}-${b.name.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                    issueYear={earned ? earned.getFullYear() : undefined}
                    issueMonth={earned ? earned.getMonth() + 1 : undefined}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: 28, fontSize: 10, color: "#3a4258" }}>
          PFLX · The Future of Learning · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

const card: React.CSSProperties = {
  background: "#0c1322",
  border: "1px solid #1a2236",
  borderRadius: 16,
  padding: "22px 24px",
  marginBottom: 14,
};
