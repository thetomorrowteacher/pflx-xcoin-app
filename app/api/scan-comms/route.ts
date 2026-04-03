import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Primary Badge definitions for AI context ────────────────────
const PRIMARY_BADGES = [
  { name: "Self Directed Player", behavior: "Independently completing a complex task without support", xc: 200 },
  { name: "Strategic Organizer", behavior: "Organizing tasks, tools, or objectives to complete work efficiently", xc: 100 },
  { name: "Entrepreneurial Spirit", behavior: "Demonstrating initiative, problem solving, and risk-taking", xc: 100 },
  { name: "Self Advocate", behavior: "Confidently expressing needs, asking for help, and taking ownership of personal growth", xc: 100 },
  { name: "Focus Optimizer", behavior: "Staying focused and minimizing distractions during learning activities", xc: 100 },
  { name: "Gamification Guru", behavior: "Using/boosting the PFLX Platform by ideating new functions and concepts", xc: 100 },
  { name: "Professional Communicator", behavior: "Clear, kind, effective speaking or writing within a professional situation", xc: 100 },
  { name: "Critical Thinker", behavior: "Asking strong questions or proposing thoughtful solutions", xc: 100 },
  { name: "Master Collaborator", behavior: "Positive teamwork and inclusive collaboration", xc: 100 },
  { name: "Innovative Creator", behavior: "Generating creative ideas or unique contributions", xc: 100 },
  { name: "Digital Tool Master", behavior: "Effectively using required apps or tools independently", xc: 100 },
  { name: "Resilient Learner", behavior: "Actively pushing through challenges to engage in learning", xc: 100 },
  { name: "Growth Mindset", behavior: "Demonstrating perseverance when challenges arise", xc: 100 },
  { name: "Goal Setter", behavior: "Setting and sharing daily/weekly goals with clear intent", xc: 100 },
  { name: "Time Manager", behavior: "Completing tasks on time", xc: 100 },
  { name: "Peer Supporter", behavior: "Helping a classmate understand a concept or catch up", xc: 100 },
  { name: "Positive Participant", behavior: "Consistent participation in class activities and discussions", xc: 100 },
  { name: "Digital Citizen", behavior: "Using devices responsibly, showing online etiquette", xc: 100 },
  { name: "Emerging Leader", behavior: "Taking initiative, guiding peers, or contributing positively to group dynamics", xc: 100 },
];

// ─── Load helpers ────────────────────────────────────────────────
async function loadData(key: string) {
  const { data } = await supabase.from("app_data").select("data").eq("key", key).single();
  return data?.data || [];
}

async function saveData(key: string, value: any) {
  await supabase.from("app_data").upsert({ key, data: value }, { onConflict: "key" });
}

// ─── Fetch Discord messages ──────────────────────────────────────
async function fetchDiscordMessages(channelId: string, botToken: string, limit = 50): Promise<any[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) {
      console.error("[scan] Discord fetch failed:", res.status, await res.text());
      return [];
    }
    const messages = await res.json();
    // Filter to human messages only (not bot)
    return messages.filter((m: any) => !m.author?.bot).map((m: any) => ({
      platform: "discord",
      authorId: m.author?.id,
      authorName: m.author?.username || m.author?.global_name || "Unknown",
      content: m.content,
      timestamp: m.timestamp,
      channelId: channelId,
    }));
  } catch (e) {
    console.error("[scan] Discord fetch error:", e);
    return [];
  }
}

// ─── Fetch Slack messages (using Slack Bot Token from env or settings) ──
async function fetchSlackMessages(channelId: string, slackToken: string, limit = 50): Promise<any[]> {
  try {
    const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.ok) {
      console.error("[scan] Slack fetch error:", data.error);
      return [];
    }
    // Resolve user names
    const userIds = [...new Set((data.messages || []).filter((m: any) => !m.bot_id && !m.subtype).map((m: any) => m.user))];
    const userMap: Record<string, string> = {};
    for (const uid of userIds) {
      try {
        const userRes = await fetch(`https://slack.com/api/users.info?user=${uid}`, {
          headers: { Authorization: `Bearer ${slackToken}` },
        });
        const userData = await userRes.json();
        if (userData.ok) userMap[uid as string] = userData.user?.real_name || userData.user?.name || uid as string;
      } catch { userMap[uid as string] = uid as string; }
    }
    return (data.messages || [])
      .filter((m: any) => !m.bot_id && !m.subtype)
      .map((m: any) => ({
        platform: "slack",
        authorId: m.user,
        authorName: userMap[m.user] || m.user,
        content: m.text,
        timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
        channelId: channelId,
      }));
  } catch (e) {
    console.error("[scan] Slack fetch error:", e);
    return [];
  }
}

// ─── X-Bot AI Analysis ──────────────────────────────────────────
async function analyzeMessagesWithAI(messages: any[], users: any[]): Promise<any[]> {
  if (messages.length === 0) return [];

  const playerNames = users.filter((u: any) => u.role === "player").map((u: any) => ({
    id: u.id,
    name: u.name,
    brandName: u.brandName,
    discordId: u.discordId,
    slackId: u.slackId,
  }));

  const badgeList = PRIMARY_BADGES.map(b => `- "${b.name}": ${b.behavior} (${b.xc} XC)`).join("\n");

  const messageBlock = messages.map((m, i) =>
    `[${i}] ${m.platform.toUpperCase()} | ${m.authorName} (${m.authorId}) | ${m.timestamp}\n${m.content}`
  ).join("\n\n");

  const prompt = `You are the PFLX X-Bot — an AI that monitors team communications to identify students who demonstrate positive behaviors worth rewarding with Digital Badges.

PFLX is a gamified education platform for students grades 5-12. The following are the available Primary Badges (Behavior) that can be awarded:

${badgeList}

Here are the registered players in the system:
${JSON.stringify(playerNames, null, 2)}

Here are the recent messages from team communication channels:

${messageBlock}

INSTRUCTIONS:
1. Analyze each message for behaviors that match one or more Primary Badges.
2. Only recommend awards for CLEAR, GENUINE demonstrations of the behavior — not trivial or ambiguous messages.
3. Try to match message authors to registered players by name, brandName, discordId, or slackId.
4. If you cannot confidently match a message author to a registered player, skip them.
5. Be selective — it's better to miss an award than to over-award. Quality over quantity.
6. Maximum 5 recommendations per scan.

RESPOND WITH ONLY a JSON array. Each element should be:
{
  "playerId": "player-id or null if can't match",
  "playerName": "display name",
  "badgeName": "exact Primary Badge name",
  "xc": number,
  "reason": "Brief 1-2 sentence explanation of what behavior was observed",
  "messageExcerpt": "the key quote (under 100 chars)",
  "confidence": "high" | "medium",
  "platform": "discord" | "slack"
}

If no awards are warranted, return an empty array: []

RESPOND WITH ONLY THE JSON ARRAY. No markdown, no explanation.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    });

    if (!res.ok) {
      console.error("[scan] Gemini error:", res.status);
      return [];
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[scan] AI analysis error:", e);
    return [];
  }
}

// ─── Process recommendations into submissions ────────────────────
async function processRecommendations(recommendations: any[], autoApprove: boolean, users: any[]) {
  const submissions = await loadData("submissions") as any[];
  const results: any[] = [];
  const now = new Date().toISOString();

  for (const rec of recommendations) {
    // Skip if no player match
    if (!rec.playerId) continue;

    // Check for duplicate — same player + badge in last 24h
    const recent = submissions.find((s: any) =>
      s.playerId === rec.playerId &&
      s.coinType === rec.badgeName &&
      s.reason?.includes("[X-Bot]") &&
      new Date(s.submittedAt).getTime() > Date.now() - 86400000
    );
    if (recent) continue;

    const submission: any = {
      id: `xbot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: rec.playerId,
      coinType: rec.badgeName,
      amount: 1,
      reason: `[X-Bot] ${rec.reason}`,
      evidenceUrl: rec.messageExcerpt ? `"${rec.messageExcerpt}" (${rec.platform})` : undefined,
      status: autoApprove ? "approved" : "pending",
      submittedAt: now,
      reviewedAt: autoApprove ? now : undefined,
      feedback: autoApprove ? "Auto-approved by X-Bot" : undefined,
      source: "xbot",
      confidence: rec.confidence,
      platform: rec.platform,
    };

    submissions.push(submission);
    results.push(submission);

    // If auto-approve, also grant the XC immediately
    if (autoApprove) {
      const player = users.find((u: any) => u.id === rec.playerId);
      if (player) {
        player.xcoin = (player.xcoin || 0) + rec.xc;
        player.totalXcoin = (player.totalXcoin || 0) + rec.xc;
        player.digitalBadges = (player.digitalBadges || 0) + 1;
        if (!player.badgeCounts) player.badgeCounts = { signature: 0, executive: 0, premium: 0, primary: 0 };
        player.badgeCounts.primary += 1;
      }
    }
  }

  // Save everything
  await saveData("submissions", submissions);
  if (autoApprove && results.length > 0) {
    await saveData("users", users);
  }

  return results;
}

// ─── Main POST handler ──────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = body.source || "both"; // "discord" | "slack" | "both"

    // Load settings
    const { data: settingsRow } = await supabase
      .from("app_data").select("data").eq("key", "notificationSettings").single();
    const settings = settingsRow?.data || {};

    const autoApprove = settings.scanAutoApprove ?? false;
    const discordBotToken = settings.discordBotToken || "";
    const discordScanChannelId = settings.discordScanChannelId || settings.discordChannelId || "";
    const slackBotToken = settings.slackBotToken || process.env.SLACK_BOT_TOKEN || "";
    const slackScanChannelId = settings.slackScanChannelId || "";

    // Load users for matching
    const users = await loadData("users");

    // Fetch messages from configured platforms
    let allMessages: any[] = [];

    if ((source === "discord" || source === "both") && discordBotToken && discordScanChannelId) {
      const discordMsgs = await fetchDiscordMessages(discordScanChannelId, discordBotToken, 30);
      allMessages.push(...discordMsgs);
    }

    if ((source === "slack" || source === "both") && slackBotToken && slackScanChannelId) {
      const slackMsgs = await fetchSlackMessages(slackScanChannelId, slackBotToken, 30);
      allMessages.push(...slackMsgs);
    }

    if (allMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No messages to scan. Check channel IDs and tokens in Settings → Integrations.",
        recommendations: [],
        scannedMessages: 0,
      });
    }

    // Analyze with AI
    const recommendations = await analyzeMessagesWithAI(allMessages, users);

    // Process into submissions
    const results = await processRecommendations(recommendations, autoApprove, users);

    // Save scan timestamp
    const scanLog = {
      scannedAt: new Date().toISOString(),
      messagesScanned: allMessages.length,
      recommendationsFound: recommendations.length,
      submissionsCreated: results.length,
      autoApproved: autoApprove,
      platforms: source,
    };
    const scanHistory = await loadData("scanHistory") as any[];
    scanHistory.push(scanLog);
    // Keep last 50 scans
    if (scanHistory.length > 50) scanHistory.splice(0, scanHistory.length - 50);
    await saveData("scanHistory", scanHistory);

    return NextResponse.json({
      success: true,
      message: `Scanned ${allMessages.length} messages → ${recommendations.length} behaviors identified → ${results.length} submissions created${autoApprove ? " (auto-approved)" : " (pending review)"}`,
      recommendations: results,
      scannedMessages: allMessages.length,
      scanLog,
    });
  } catch (err) {
    console.error("[scan-comms] Error:", err);
    return NextResponse.json({ success: false, error: "Scan failed" }, { status: 500 });
  }
}

// ─── GET handler for status ──────────────────────────────────────
export async function GET() {
  const scanHistory = await loadData("scanHistory") as any[];
  const lastScan = scanHistory[scanHistory.length - 1] || null;
  return NextResponse.json({ lastScan, totalScans: scanHistory.length });
}
