import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/resend-webhook
 *
 * Receives email delivery events from Resend (sent, delivered, opened,
 * clicked, bounced, complained, etc.) and appends them to a Supabase
 * `app_data` bucket keyed as "email_events" so the Host Analytics
 * dashboard can surface "did this player open the report?" and similar
 * signals.
 *
 * Resend uses Svix to sign webhooks. We verify the signature using the
 * whsec_... secret stored in RESEND_WEBHOOK_SECRET.
 *
 * Docs: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
);

const BUCKET_KEY = "email_events";
const MAX_EVENTS = 2000; // keep the most recent 2k events to avoid unbounded growth

function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  try {
    const svixId = headers.get("svix-id") || "";
    const svixTimestamp = headers.get("svix-timestamp") || "";
    const svixSignature = headers.get("svix-signature") || "";
    if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

    // Secret prefix handling: Resend sends "whsec_<base64>"
    const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const secretBytes = Buffer.from(key, "base64");

    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expected = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    // svixSignature is "v1,<sig> v1,<sig2> ..." — any match passes
    const sigs = svixSignature.split(" ").map(s => s.split(",")[1]).filter(Boolean);
    return sigs.some(s => {
      try {
        return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
      } catch {
        return false;
      }
    });
  } catch (e) {
    console.error("[resend-webhook] verify error", e);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const secret = process.env.RESEND_WEBHOOK_SECRET || "";

    // If no secret is configured yet, accept (dev mode) but log loudly.
    const hasSecret = !!secret;
    if (hasSecret) {
      const ok = verifySvixSignature(rawBody, req.headers, secret);
      if (!ok) {
        console.warn("[resend-webhook] signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unverified event");
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Resend event shape: { type: "email.delivered", created_at, data: { email_id, to, subject, tags, ... } }
    const event = {
      type: payload?.type || "unknown",
      createdAt: payload?.created_at || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      emailId: payload?.data?.email_id || payload?.data?.id || null,
      to: payload?.data?.to || [],
      from: payload?.data?.from || null,
      subject: payload?.data?.subject || null,
      tags: payload?.data?.tags || [],
      raw: payload?.data || {},
    };

    // Pull out helpful tag values
    const tagMap: Record<string, string> = {};
    (Array.isArray(event.tags) ? event.tags : []).forEach((t: any) => {
      if (t?.name) tagMap[t.name] = t.value;
    });
    (event as any).playerId = tagMap.playerId || null;
    (event as any).messageType = tagMap.type || null;

    // Load existing bucket
    const { data: existing } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", BUCKET_KEY)
      .single();

    let events: any[] = [];
    if (existing?.data?.events && Array.isArray(existing.data.events)) {
      events = existing.data.events;
    }
    events.unshift(event);
    if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS);

    const { error: upsertErr } = await supabase.from("app_data").upsert(
      {
        key: BUCKET_KEY,
        data: { events, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (upsertErr) {
      console.error("[resend-webhook] supabase upsert error", upsertErr);
      // Still return 200 so Resend doesn't retry-storm us — we've logged it.
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[resend-webhook] unhandled", err);
    // Return 200 to avoid Resend retry loops on transient failures.
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "This endpoint receives Resend webhook events. Configure at resend.com/webhooks",
  });
}
