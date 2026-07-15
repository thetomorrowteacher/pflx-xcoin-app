import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

const KEY = "notificationSettings";

// GET — return current notification settings

// Never prerender at build time — this route does live work (Supabase / external
// services). Build-time prerendering hung the July 15 Vercel deploy on /api/diag;
// same failure mode applies to any zero-arg GET route.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("key", KEY)
      .single();

    if (error || !data) {
      // Return defaults
      return NextResponse.json({
        slackWebhookUrl: "",
        discordWebhookUrl: "",
        discordBotToken: "",
        discordGuildId: "",
        discordChannelId: "",
        enabledEvents: [
          "pitch_submitted", "pitch_approved", "pitch_rejected",
          "xc_awarded", "task_approved", "job_hired",
          "badge_awarded", "rank_up",
        ],
        slackChannel: "#pflx-xcoin-feed",
        mentionAdmins: true,
      });
    }
    return NextResponse.json(data.data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// POST — save notification settings
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error } = await supabase.from("app_data").upsert(
      { key: KEY, data: body, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
