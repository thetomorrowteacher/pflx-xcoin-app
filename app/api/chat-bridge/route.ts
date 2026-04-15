import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * /api/chat-bridge
 *
 * Unified Slack + Discord + PFLX-internal chat relay for the DarkCampus
 * QuickChat sidebar and full DarkCampus portal.
 *
 * Auth: header `x-pflx-email-secret` (re-using EMAIL_INTERNAL_SECRET for
 * all internal-to-internal calls; keeps env var count down).
 *
 * POST body:
 *   { channel: "terminal" | "missioncontrol" | "dm" | "group",
 *     target?: string,           // target channel id / user id / group id
 *     text: string,
 *     author: { id, brand, name, role },
 *     platform?: "slack" | "discord" | "pflx" }   // default: relay to all
 *
 * GET query:
 *   ?channel=terminal&limit=50
 *
 * Messages are stored in Supabase `app_data` key `darkcampus_chat` as a
 * rolling window of last 2000 events. Slack/Discord relays are fire-and-
 * forget — if either 3rd-party fails, the PFLX copy still persists.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
);

const BUCKET = "darkcampus_chat";
const MAX = 2000;

// Channel → external IDs map. Slack ID from saved memory (Prototypeflx
// workspace #missioncontrol). Discord we use channel names; the bot must
// be in those channels in the PFLX Discord server.
const CHANNEL_MAP: Record<string, { slack?: string; discordName?: string }> = {
  terminal: { slack: "C093WJ0RS23", discordName: "terminal" },
  missioncontrol: { slack: "C093WJ0RS23", discordName: "missioncontrol" },
};

function authOK(req: Request) {
  const secret = req.headers.get("x-pflx-email-secret") || "";
  const expected = process.env.EMAIL_INTERNAL_SECRET || "";
  return !!expected && secret === expected;
}

async function slackPost(channelId: string, text: string, author: any) {
  const token = process.env.SLACK_BOT_TOKEN || "";
  if (!token || !channelId) return { ok: false, error: "no_slack" };
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        text: `[${author?.brand || author?.name || "PFLX"}] ${text}`,
      }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: !!d.ok, error: d.error, ts: d.ts };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

// Resolve Discord channel ID by name (cached in memory once per cold start)
let DISCORD_CH_CACHE: Record<string, string> = {};
async function discordResolveChannel(name: string) {
  if (DISCORD_CH_CACHE[name]) return DISCORD_CH_CACHE[name];
  const token = process.env.DISCORD_BOT_TOKEN || "";
  const guildId = process.env.DISCORD_GUILD_ID || "";
  if (!token || !guildId) return "";
  try {
    const r = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    const list: any[] = await r.json();
    if (Array.isArray(list)) {
      list.forEach((c) => {
        if (c.name) DISCORD_CH_CACHE[c.name] = c.id;
      });
    }
    return DISCORD_CH_CACHE[name] || "";
  } catch {
    return "";
  }
}

async function discordPost(channelName: string, text: string, author: any) {
  const token = process.env.DISCORD_BOT_TOKEN || "";
  if (!token) return { ok: false, error: "no_discord" };
  const chId = await discordResolveChannel(channelName);
  if (!chId) return { ok: false, error: "channel_not_found" };
  try {
    const r = await fetch(
      `https://discord.com/api/v10/channels/${chId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `**[${author?.brand || author?.name || "PFLX"}]** ${text}`,
        }),
      }
    );
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: r.ok ? undefined : d?.message };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

async function loadBucket() {
  const { data } = await supabase
    .from("app_data")
    .select("data")
    .eq("key", BUCKET)
    .single();
  const events = (data?.data?.events as any[]) || [];
  return events;
}

async function saveBucket(events: any[]) {
  if (events.length > MAX) events = events.slice(0, MAX);
  await supabase.from("app_data").upsert(
    {
      key: BUCKET,
      data: { events, updatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

export async function POST(req: Request) {
  try {
    if (!authOK(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { channel, target, text, author, platform } = body;
    if (!channel || !text || !author)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const entry = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      channel,
      target: target || null,
      text: String(text).slice(0, 2000),
      author,
      platform: platform || "pflx",
      relays: {} as Record<string, any>,
      createdAt: new Date().toISOString(),
    };

    // Relay to Slack + Discord for public channels (terminal / missioncontrol)
    const map = CHANNEL_MAP[channel];
    if (map && (platform === "slack" || platform === "pflx" || !platform)) {
      if (map.slack) entry.relays.slack = await slackPost(map.slack, text, author);
    }
    if (map && (platform === "discord" || platform === "pflx" || !platform)) {
      if (map.discordName)
        entry.relays.discord = await discordPost(map.discordName, text, author);
    }

    const events = await loadBucket();
    events.unshift(entry);
    await saveBucket(events);

    return NextResponse.json({ ok: true, id: entry.id, relays: entry.relays });
  } catch (e: any) {
    console.error("[chat-bridge] POST", e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const channel = url.searchParams.get("channel");
    const target = url.searchParams.get("target");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10) || 50,
      500
    );
    const events = await loadBucket();
    let out = events;
    if (channel) out = out.filter((e: any) => e.channel === channel);
    if (target) out = out.filter((e: any) => e.target === target);
    return NextResponse.json({ events: out.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
