"use client";

// ── ACTIVE SEASON banner (July 12) ──
// Same indicator as the Console's Home Base / Mission Control bar: season
// banner image backdrop, name, dates, DAYS LEFT pill and progress line.
// Reads the MC-owned pflx_mc_seasons row (Mission Control is the single
// source of truth for seasonal data). Cohort-scoped seasons hide the card
// from players outside the scope; hosts always see it.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Season = {
  id: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  active?: boolean;
  allCohorts?: boolean;
  cohorts?: string[];
  bannerImage?: string;
};

const DAY = 86400000;
const norm = (x: unknown) => String(x ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function isLive(s: Season, now: number): boolean {
  const flagged = s.status === "active" || s.active === true;
  if (!flagged) return false;
  let st = s.startDate ? Date.parse(s.startDate) : -Infinity;
  let en = s.endDate ? Date.parse(s.endDate) + DAY - 1 : Infinity;
  if (isNaN(st)) st = -Infinity;
  if (isNaN(en)) en = Infinity;
  return now >= st && now <= en;
}

export default function SeasonBanner({ compact = false }: { compact?: boolean }) {
  const [season, setSeason] = useState<Season | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("app_data")
          .select("data")
          .eq("key", "pflx_mc_seasons")
          .maybeSingle();
        const payload = data?.data as { items?: Season[] } | Season[] | null;
        const items: Season[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? (payload!.items as Season[])
            : [];
        const now = Date.now();
        const s =
          items.find((x) => x && isLive(x, now)) ||
          items.find((x) => x && (x.status === "active" || x.active === true)) ||
          null;
        if (!s || dead) return;
        // Cohort scope — hide from players outside a scoped season
        if (s.allCohorts === false && Array.isArray(s.cohorts) && s.cohorts.length) {
          try {
            const u = JSON.parse(localStorage.getItem("pflx_user") || "null");
            const isHostish = u && /admin|host|instructor|teacher/i.test(String(u.role || ""));
            if (!isHostish) {
              const myCoh = String(u?.cohort || "")
                .split(/[,;]/)
                .map(norm)
                .filter(Boolean);
              const scope = s.cohorts.map(norm);
              if (!myCoh.some((c) => scope.includes(c))) return;
            }
          } catch {
            /* no user context — show it */
          }
        }
        setSeason(s);
      } catch {
        /* silent — no banner is fine */
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  if (!season) return null;

  const now = Date.now();
  const end = season.endDate ? Date.parse(season.endDate) + DAY - 1 : NaN;
  const st0 = season.startDate ? Date.parse(season.startDate) : NaN;
  const daysLeft = isFinite(end) ? Math.max(0, Math.ceil((end - now) / DAY)) : null;
  const pct =
    isFinite(st0) && isFinite(end) && end > st0
      ? Math.min(100, Math.max(0, Math.round(((now - st0) / (end - st0)) * 100)))
      : null;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        border: "1px solid rgba(245,200,66,0.35)",
        marginBottom: compact ? "14px" : "20px",
        minHeight: compact ? "64px" : "84px",
        display: "flex",
        alignItems: "center",
        boxShadow: "0 0 22px rgba(245,200,66,0.10)",
      }}
    >
      {season.bannerImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={season.bannerImage}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(8,10,18,0.92) 0%, rgba(8,10,18,0.55) 55%, rgba(8,10,18,0.25) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: compact ? "10px 16px" : "14px 18px",
          width: "100%",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: compact ? "20px" : "26px", filter: "drop-shadow(0 0 8px rgba(245,200,66,0.6))" }}>🏆</span>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <div style={{ fontSize: "9px", color: "rgba(245,200,66,0.85)", letterSpacing: "0.16em", fontWeight: 800 }}>
            ACTIVE SEASON
          </div>
          <div
            style={{
              fontSize: compact ? "14px" : "16px",
              fontWeight: 900,
              color: "#f5c842",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              textShadow: "0 1px 10px rgba(0,0,0,0.85)",
            }}
          >
            {season.name || "Season"}
          </div>
          {(season.startDate || season.endDate) && (
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "rgba(255,255,255,0.8)", marginTop: "2px", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
              {(season.startDate || "") + (season.endDate ? " → " + season.endDate : "")}
            </div>
          )}
        </div>
        {daysLeft !== null && (
          <div
            style={{
              textAlign: "center",
              padding: "6px 14px",
              background: "rgba(245,200,66,0.16)",
              border: "1px solid rgba(245,200,66,0.45)",
              borderRadius: "10px",
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#f5c842" }}>{daysLeft}</div>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.85)", letterSpacing: "0.14em", fontWeight: 700 }}>DAYS LEFT</div>
          </div>
        )}
      </div>
      {pct !== null && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: "3px",
            width: `${pct}%`,
            background: "linear-gradient(90deg,#f5c842,#a78bfa)",
            boxShadow: "0 0 8px rgba(245,200,66,0.6)",
          }}
        />
      )}
    </div>
  );
}
