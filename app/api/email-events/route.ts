import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/email-events?playerId=...&type=...&limit=100
 *
 * Reads stored Resend webhook events (populated by /api/resend-webhook)
 * so the Host Analytics Dashboard can show "opened / delivered / bounced"
 * status per player and per email.
 *
 * Filter params are all optional.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

const BUCKET_KEY = "email_events";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const playerId = url.searchParams.get("playerId");
    const type = url.searchParams.get("type");
    const eventType = url.searchParams.get("eventType"); // e.g. "email.opened"
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);

    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", BUCKET_KEY)
      .single();

    if (error || !data?.data?.events) {
      return NextResponse.json({ events: [], total: 0 });
    }

    let events = data.data.events as any[];
    if (playerId) events = events.filter(e => e.playerId === playerId);
    if (type) events = events.filter(e => e.messageType === type);
    if (eventType) events = events.filter(e => e.type === eventType);
    const total = events.length;
    events = events.slice(0, limit);

    return NextResponse.json({ events, total });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
