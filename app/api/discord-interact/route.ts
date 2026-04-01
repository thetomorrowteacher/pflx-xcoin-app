import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hyxiagexyptzvetqjmnj.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

// Discord Interaction Types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Discord Response Types
const PONG = 1;
const CHANNEL_MESSAGE = 4;

// ─── Helpers to load data from Supabase ──────────────────────────
async function loadData(key: string) {
  const { data } = await supabase.from("app_data").select("data").eq("key", key).single();
  return data?.data || [];
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleBalance(discordUserId: string, discordUsername: string) {
  const users = await loadData("users");
  // Try to find player by discord ID or name match
  const player = users.find((u: any) =>
    u.discordId === discordUserId ||
    u.name?.toLowerCase() === discordUsername?.toLowerCase() ||
    u.brandName?.toLowerCase() === discordUsername?.toLowerCase()
  );

  if (!player) {
    return {
      type: CHANNEL_MESSAGE,
      data: {
        embeds: [{
          title: "❓ Player Not Found",
          description: `No PFLX player linked to your Discord account.\n\nAsk your host to link your Discord ID in the X-Coin app, or use \`/link <your-pflx-name>\` to connect.`,
          color: 0xef4444,
        }],
      },
    };
  }

  return {
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: `🪙 ${player.brandName || player.name}'s Wallet`,
        color: 0xa78bfa,
        fields: [
          { name: "XC Balance", value: `⚡ ${(player.xcoin || 0).toLocaleString()} XC`, inline: true },
          { name: "Lifetime XC", value: `📊 ${(player.totalXcoin || 0).toLocaleString()} XC`, inline: true },
          { name: "Digital Badges", value: `🏅 ${player.digitalBadges || 0}`, inline: true },
          { name: "Evo Rank", value: `📈 Level ${player.rank || 1}`, inline: true },
          { name: "Studio", value: player.studioId ? `🏛️ ${player.studioId}` : "None", inline: true },
        ],
        footer: { text: "PFLX X-Coin System" },
        timestamp: new Date().toISOString(),
      }],
    },
  };
}

async function handleLeaderboard() {
  const users = await loadData("users");
  const players = users
    .filter((u: any) => u.role === "player")
    .sort((a: any, b: any) => (b.totalXcoin || 0) - (a.totalXcoin || 0))
    .slice(0, 10);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = players.map((p: any, i: number) => {
    const medal = medals[i] || `**${i + 1}.**`;
    return `${medal} **${p.brandName || p.name}** — ${(p.totalXcoin || 0).toLocaleString()} XC (🏅 ${p.digitalBadges || 0})`;
  });

  return {
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: "🏆 PFLX Leaderboard — Top 10",
        description: lines.join("\n") || "No players found.",
        color: 0xf5c842,
        footer: { text: "PFLX X-Coin System" },
        timestamp: new Date().toISOString(),
      }],
    },
  };
}

async function handleJobs() {
  const jobs = await loadData("jobs");
  const openJobs = (Array.isArray(jobs) ? jobs : [])
    .filter((j: any) => j.status === "open")
    .slice(0, 8);

  if (openJobs.length === 0) {
    return {
      type: CHANNEL_MESSAGE,
      data: {
        embeds: [{
          title: "📋 Open Jobs",
          description: "No open jobs right now. Check back later!",
          color: 0x00d4ff,
        }],
      },
    };
  }

  const lines = openJobs.map((j: any) =>
    `**${j.title}** — ⚡ ${j.xcReward || 0} XC\n> ${(j.description || "").slice(0, 80)}${(j.description || "").length > 80 ? "..." : ""}`
  );

  return {
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: `📋 Open Jobs (${openJobs.length})`,
        description: lines.join("\n\n"),
        color: 0x00d4ff,
        footer: { text: "Apply in the X-Coin app • PFLX" },
        timestamp: new Date().toISOString(),
      }],
    },
  };
}

async function handlePitches() {
  const pitches = await loadData("projectPitches");
  const livePitches = (Array.isArray(pitches) ? pitches : [])
    .filter((p: any) => p.status === "approved" || p.status === "live")
    .slice(0, 6);

  if (livePitches.length === 0) {
    return {
      type: CHANNEL_MESSAGE,
      data: {
        embeds: [{
          title: "💡 Active Pitched Projects",
          description: "No live pitched projects right now. Submit a pitch in the X-Coin app!",
          color: 0xf59e0b,
        }],
      },
    };
  }

  const lines = livePitches.map((p: any) => {
    const fee = (p.entryFeeXC || 0) > 0 ? ` | 🎟️ ${p.entryFeeXC} XC entry` : "";
    return `**${p.title}** — ⚡ ${p.xcValue || 0} XC${fee}\n> ${(p.description || "").slice(0, 80)}...`;
  });

  return {
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: `💡 Live Pitched Projects (${livePitches.length})`,
        description: lines.join("\n\n"),
        color: 0xf59e0b,
        footer: { text: "Explore on the Pathway Portal • PFLX" },
        timestamp: new Date().toISOString(),
      }],
    },
  };
}

async function handleStats() {
  const users = await loadData("users");
  const tasks = await loadData("tasks");
  const jobs = await loadData("jobs");
  const pitches = await loadData("projectPitches");

  const players = (Array.isArray(users) ? users : []).filter((u: any) => u.role === "player");
  const totalXC = players.reduce((sum: number, p: any) => sum + (p.totalXcoin || 0), 0);
  const totalBadges = players.reduce((sum: number, p: any) => sum + (p.digitalBadges || 0), 0);
  const openJobs = (Array.isArray(jobs) ? jobs : []).filter((j: any) => j.status === "open").length;
  const livePitches = (Array.isArray(pitches) ? pitches : []).filter((p: any) => p.status === "live" || p.status === "approved").length;

  return {
    type: CHANNEL_MESSAGE,
    data: {
      embeds: [{
        title: "📊 PFLX Economy Stats",
        color: 0x00d4ff,
        fields: [
          { name: "Total Players", value: `👥 ${players.length}`, inline: true },
          { name: "XC in Circulation", value: `⚡ ${totalXC.toLocaleString()}`, inline: true },
          { name: "Badges Earned", value: `🏅 ${totalBadges.toLocaleString()}`, inline: true },
          { name: "Open Jobs", value: `📋 ${openJobs}`, inline: true },
          { name: "Live Projects", value: `💡 ${livePitches}`, inline: true },
        ],
        footer: { text: "PFLX X-Coin System" },
        timestamp: new Date().toISOString(),
      }],
    },
  };
}

// ─── Main POST handler (Discord sends interactions here) ─────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Discord sends a PING to verify the endpoint
    if (body.type === PING) {
      return NextResponse.json({ type: PONG });
    }

    // Handle slash commands
    if (body.type === APPLICATION_COMMAND) {
      const commandName = body.data?.name;
      const discordUserId = body.member?.user?.id || body.user?.id || "";
      const discordUsername = body.member?.user?.username || body.user?.username || "";

      let response;
      switch (commandName) {
        case "balance":
        case "wallet":
          response = await handleBalance(discordUserId, discordUsername);
          break;
        case "leaderboard":
        case "lb":
          response = await handleLeaderboard();
          break;
        case "jobs":
          response = await handleJobs();
          break;
        case "pitches":
        case "projects":
          response = await handlePitches();
          break;
        case "stats":
          response = await handleStats();
          break;
        default:
          response = {
            type: CHANNEL_MESSAGE,
            data: {
              embeds: [{
                title: "🤖 PFLX Bot Commands",
                description: [
                  "`/balance` — Check your XC wallet",
                  "`/leaderboard` — Top 10 players",
                  "`/jobs` — View open job postings",
                  "`/pitches` — See live pitched projects",
                  "`/stats` — PFLX economy overview",
                ].join("\n"),
                color: 0x00d4ff,
              }],
            },
          };
      }

      return NextResponse.json(response);
    }

    return NextResponse.json({ type: PONG });
  } catch (err) {
    console.error("[Discord Interact] Error:", err);
    return NextResponse.json(
      { type: CHANNEL_MESSAGE, data: { content: "An error occurred processing your command." } },
      { status: 200 } // Discord requires 200 even on errors
    );
  }
}
