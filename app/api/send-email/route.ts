import { NextResponse } from "next/server";

/**
 * POST /api/send-email
 *
 * Wraps the Resend HTTP API. Called from the PFLX Platform Host
 * Dashboard (and eventually Mission Control) to send player + host
 * notifications and analytics reports.
 *
 * Auth: requires header `x-pflx-email-secret` to match EMAIL_INTERNAL_SECRET.
 *       Keeps the Resend key server-side; prevents arbitrary callers.
 *
 * Body: {
 *   to: string | string[]        // recipient email(s)
 *   subject: string
 *   html: string                  // rendered email body
 *   text?: string                 // optional plaintext fallback
 *   type?: string                 // tag for analytics (e.g. "host_weekly_report")
 *   playerId?: string             // optional, for linking events back to a player
 *   from?: string                 // override default From
 *   replyTo?: string              // optional Reply-To
 *   attachments?: { filename: string; content: string }[] // base64 content
 * }
 *
 * Response: { id: string }  on success, { error } on failure.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-pflx-email-secret") || "";
    const expected = process.env.EMAIL_INTERNAL_SECRET || "";
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { to, subject, html, text, type, playerId, from, replyTo, attachments } = body;
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const defaultFrom =
      process.env.RESEND_FROM || "PFLX <host@prototypeflx.com>";

    // Tags are searchable in the Resend dashboard and flow through webhook events.
    const tags: { name: string; value: string }[] = [];
    if (type) tags.push({ name: "type", value: String(type).slice(0, 50) });
    if (playerId) tags.push({ name: "playerId", value: String(playerId).slice(0, 50) });

    const payload: any = {
      from: from || defaultFrom,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;
    if (tags.length) payload.tags = tags;
    if (Array.isArray(attachments) && attachments.length) {
      payload.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content,
      }));
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[send-email] Resend error", r.status, data);
      return NextResponse.json(
        { error: data?.message || "Resend request failed", resend: data },
        { status: r.status }
      );
    }

    return NextResponse.json({ id: data.id, ok: true });
  } catch (err: any) {
    console.error("[send-email] Unhandled error", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST with {to, subject, html}" });
}
