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

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../lib/supabaseClient";
import { publishEvent, loadEvents, PflxAppId, PflxEventType } from "../../lib/pflx-events";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

// ── GET: Read shared data ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

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
      const { type, title, description, postedBy, xc, badges, url } = body;
      if (!type || !title) {
        return NextResponse.json({ error: "Missing type or title" }, { status: 400, headers: CORS });
      }

      const dcUrl = process.env.DARKCAMPUS_URL || "https://pflx-darkcampus.vercel.app";
      try {
        const res = await fetch(`${dcUrl}/api/xbot-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, description, postedBy, xc, badges, url }),
        });
        const data = await res.json();
        return NextResponse.json({ success: data.success, bridgedTo: data.bridgedTo }, { headers: CORS });
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
