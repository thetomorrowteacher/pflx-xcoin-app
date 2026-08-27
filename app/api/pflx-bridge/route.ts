// ─── PFLX Bridge API ────────────────────────────────────────────────────────
// Central endpoint for satellite apps (DarkCampus, Battle Arena, Core Pathway)
// to read shared data from X-Coin and publish cross-app events.
//
// GET  ?action=users           → All players (id, name, brandName, xcoin, rank, etc.)
// GET  ?action=user&id=xxx     → Single player data
// GET  ?action=events          → Recent cross-app events (with optional filters)
// GET  ?action=submissions     → Recent submissions
// POST { action: "event", ... }→ Publish a cross-app event
// POST { action: "xc_update", playerId, delta, reason } → Award/deduct XC
//
// ── SECURITY (Aug 26, PATCH v1.98 quick-harden) ─────────────────────────────
// This endpoint has NO per-player authentication: `playerId` is whatever the
// caller says it is, not tied to a verified session. That's a real gap and
// is NOT closed by anything below — closing it means Battle Arena (and any
// other satellite) reporting raw match state to a new authenticated endpoint
// that independently computes the payout server-side, which is real work
// that hasn't been scoped/built yet. What IS shipped here narrows the blast
// radius of the easiest version of the exploit (a single call requesting an
// enormous or unbounded delta) without touching how legitimate wagers/awards
// flow today:
//   1. CORS is restricted to known PFLX app origins instead of "*". This only
//      stops a THIRD-PARTY WEBSITE from silently firing a cross-site request
//      using a visitor's browser — it does nothing against a direct curl/
//      fetch/devtools call (CORS is a browser-enforced, response-reading
//      policy, not a server-side authorization check).
//   2. A hard per-call cap on |delta| (MAX_XC_DELTA_PER_CALL) — calibrated
//      above the largest real balance seen in production (~202k as of Aug
//      2026, so up to ~404k for a doubled all-in wager) so it won't break a
//      legitimate high-roller, but stops a single call from minting/erasing
//      an arbitrary amount.
//   3. Best-effort in-memory rate limiting per playerId. This is PER WARM
//      SERVERLESS INSTANCE ONLY — Vercel can spin up multiple instances or
//      cold-start, which resets this map — so treat it as a speed bump
//      against a single rapid-fire script, not a real distributed limiter.
//   4. Anomaly logging: any call at/above a lower "suspicious" threshold is
//      recorded to Supabase (`app_data` key `xc_anomaly_log`, capped at the
//      last 500) even if it's allowed through, so Ennis can review after the
//      fact rather than the activity being invisible.
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../lib/supabaseClient";
import { publishEvent, loadEvents, PflxAppId, PflxEventType } from "../../lib/pflx-events";

// ── CORS allowlist ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://pflx-battle-arena.vercel.app",
  "https://pflx-darkcampus.vercel.app",
  "https://pflx-overlay.vercel.app",
  "https://pflx-pathway-portal.vercel.app",
  "https://pflx-xcoin-app.vercel.app",
  "https://www.prototypeflx.com",
  "https://prototypeflx.com",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // local dev only
  if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  // Only echo the Origin back (enabling the browser to read the response)
  // when it's on the allowlist. A disallowed/missing Origin gets no ACAO
  // header at all — the request still runs (this is not an auth check, see
  // header comment), but a disallowed browser origin can't read the result.
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
  }
  return headers;
}

// ── xc_update hardening constants ─────────────────────────────────────────
const MAX_XC_DELTA_PER_CALL = 500_000;      // hard reject above this magnitude
const SUSPICIOUS_XC_DELTA = 10_000;         // log (but still allow) at/above this
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_CALLS = 30;            // per playerId, per warm instance

// Module-scope = persists only for the lifetime of a warm serverless
// instance. See header comment — this is a speed bump, not a real limiter.
const _xcUpdateCallLog: Map<string, number[]> = new Map();

function isRateLimited(playerId: string): boolean {
  const now = Date.now();
  const calls = (_xcUpdateCallLog.get(playerId) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  calls.push(now);
  _xcUpdateCallLog.set(playerId, calls);
  return calls.length > RATE_LIMIT_MAX_CALLS;
}

async function logXcAnomaly(entry: Record<string, unknown>): Promise<void> {
  try {
    const { data: row } = await supabase.from("app_data").select("data").eq("key", "xc_anomaly_log").single();
    const log = Array.isArray(row?.data) ? (row!.data as Record<string, unknown>[]) : [];
    log.push({ ...entry, loggedAt: new Date().toISOString() });
    const trimmed = log.slice(-500);
    await supabase.from("app_data").upsert(
      { key: "xc_anomaly_log", data: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  } catch (err) {
    console.error("[pflx-bridge] logXcAnomaly failed:", err);
  }
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) });
}

// ── GET: Read shared data ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const CORS = corsHeaders(req);

  try {
    // ── List all players ──────────────────────────────────────────────
    if (action === "users") {
      const { data } = await supabase.from("app_data").select("data").eq("key", "users").single();
      const users = (data?.data as Record<string, unknown>[]) || [];
      const players = users
        .filter((u) => u.role === "player")
        .map((u) => ({
          id: u.id,
          name: u.name,
          brandName: u.brandName,
          avatar: u.avatar,
          image: u.image || undefined,
          xcoin: u.xcoin,
          totalXcoin: u.totalXcoin,
          digitalBadges: u.digitalBadges,
          level: u.level,
          rank: u.rank,
          cohort: u.cohort,
          pathway: u.pathway,
          badgeCounts: u.badgeCounts,
          studioId: u.studioId,
        }));
      return NextResponse.json({ players }, { headers: CORS });
    }

    // ── Single player ─────────────────────────────────────────────────
    if (action === "user") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400, headers: CORS });
      const { data } = await supabase.from("app_data").select("data").eq("key", "users").single();
      const users = (data?.data as Record<string, unknown>[]) || [];
      const user = users.find((u) => (u.id as string) === id);
      if (!user) return NextResponse.json({ error: "Player not found" }, { status: 404, headers: CORS });
      return NextResponse.json({ player: user }, { headers: CORS });
    }

    // ── Recent events ─────────────────────────────────────────────────
    if (action === "events") {
      const app = req.nextUrl.searchParams.get("app") as PflxAppId | undefined;
      const type = req.nextUrl.searchParams.get("type") as PflxEventType | undefined;
      const playerId = req.nextUrl.searchParams.get("playerId") || undefined;
      const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
      const events = await loadEvents({ app: app || undefined, type: type || undefined, playerId, limit });
      return NextResponse.json({ events }, { headers: CORS });
    }

    // ── Recent submissions ────────────────────────────────────────────
    if (action === "submissions") {
      const { data } = await supabase.from("app_data").select("data").eq("key", "submissions").single();
      const subs = ((data?.data as Record<string, unknown>[]) || []).slice(-50).reverse();
      return NextResponse.json({ submissions: subs }, { headers: CORS });
    }

    return NextResponse.json({ error: "Unknown action. Use: users, user, events, submissions" }, { status: 400, headers: CORS });
  } catch (err) {
    console.error("[pflx-bridge] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}

// ── POST: Write operations ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const CORS = corsHeaders(req);
  try {
    const body = await req.json();
    const action = body.action;

    // ── Publish cross-app event ─────────────────────────────────────
    if (action === "event") {
      const { app, type, data: eventData, playerId, playerName } = body;
      if (!app || !type) {
        return NextResponse.json({ error: "Missing app or type" }, { status: 400, headers: CORS });
      }
      const ok = await publishEvent(app, type, eventData || {}, playerId, playerName);
      return NextResponse.json({ success: ok }, { headers: CORS });
    }

    // ── Update player XC (award or deduct) ──────────────────────────
    if (action === "xc_update") {
      const { playerId, delta, reason, app: sourceApp } = body;
      if (!playerId || delta === undefined) {
        return NextResponse.json({ error: "Missing playerId or delta" }, { status: 400, headers: CORS });
      }

      // ── Hard cap: reject an unbounded/absurd single-call delta ──────
      if (Math.abs(delta) > MAX_XC_DELTA_PER_CALL) {
        console.warn(`[pflx-bridge] REJECTED xc_update: |delta|=${Math.abs(delta)} exceeds cap for player ${playerId} (source: ${sourceApp || "unknown"})`);
        await logXcAnomaly({ playerId, delta, reason, sourceApp, outcome: "rejected_over_cap" });
        return NextResponse.json({ error: "Delta exceeds allowed per-call maximum" }, { status: 400, headers: CORS });
      }

      // ── Best-effort rate limit per playerId (see header comment) ────
      if (isRateLimited(playerId)) {
        console.warn(`[pflx-bridge] REJECTED xc_update: rate limit exceeded for player ${playerId} (source: ${sourceApp || "unknown"})`);
        await logXcAnomaly({ playerId, delta, reason, sourceApp, outcome: "rejected_rate_limited" });
        return NextResponse.json({ error: "Too many XC updates for this player — try again shortly" }, { status: 429, headers: CORS });
      }

      const { data } = await supabase.from("app_data").select("data").eq("key", "users").single();
      const users = (data?.data as Record<string, unknown>[]) || [];
      const player = users.find((u) => (u.id as string) === playerId) as Record<string, unknown> | undefined;

      if (!player) {
        return NextResponse.json({ error: "Player not found" }, { status: 404, headers: CORS });
      }

      const oldXC = (player.xcoin as number) || 0;
      const newXC = Math.max(0, oldXC + delta);
      player.xcoin = newXC;

      if (delta > 0) {
        player.totalXcoin = ((player.totalXcoin as number) || 0) + delta;
      }

      await supabase.from("app_data").upsert(
        { key: "users", data: users, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      // Log transaction
      const { data: txRow } = await supabase.from("app_data").select("data").eq("key", "transactions").single();
      const transactions = ((txRow?.data as Record<string, unknown>[]) || []);
      transactions.push({
        id: `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: playerId,
        type: delta > 0 ? "earned" : "pflx_tax",
        amount: Math.abs(delta),
        currency: "xc",
        description: `[${sourceApp || "bridge"}] ${reason || "Cross-app XC update"}`,
        createdAt: new Date().toISOString(),
      });
      await supabase.from("app_data").upsert(
        { key: "transactions", data: transactions, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      // Flag (but still allow) anomalously large legitimate-looking calls
      if (Math.abs(delta) >= SUSPICIOUS_XC_DELTA) {
        console.warn(`[pflx-bridge] SUSPICIOUS xc_update: delta=${delta} player=${playerId} source=${sourceApp || "unknown"} reason="${reason || ""}"`);
        await logXcAnomaly({ playerId, delta, reason, sourceApp, oldXC, newXC, outcome: "allowed_flagged" });
      }

      // Publish event
      await publishEvent(
        sourceApp || "xcoin",
        delta > 0 ? "xc_earned" : "xc_fined",
        { delta, reason, oldXC, newXC },
        playerId,
        (player.brandName as string) || (player.name as string),
      );

      return NextResponse.json({ success: true, newXC, delta }, { headers: CORS });
    }

    // ── Notify DarkCampus (X-Bot notification on #Terminal) ────────
    if (action === "notify_darkcampus") {
      const { type, title, description, postedBy, xc, badges, url, channels } = body;
      if (!type || !title) {
        return NextResponse.json({ error: "Missing type or title" }, { status: 400, headers: CORS });
      }

      const dcUrl = process.env.DARKCAMPUS_URL || "https://pflx-darkcampus.vercel.app";
      try {
        const res = await fetch(`${dcUrl}/api/xbot-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, description, postedBy, xc, badges, url, channels }),
        });
        const data = await res.json();
        return NextResponse.json({ success: data.success, channels: data.channels, bridgedTo: data.bridgedTo }, { headers: CORS });
      } catch (err) {
        console.error("[pflx-bridge] DarkCampus notify error:", err);
        return NextResponse.json({ success: false, error: "DarkCampus unreachable" }, { headers: CORS });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: CORS });
  } catch (err) {
    console.error("[pflx-bridge] POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
