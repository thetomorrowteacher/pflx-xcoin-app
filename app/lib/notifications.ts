// ─── PFLX Notification Service ────────────────────────────────────
// Sends notifications to Slack and Discord via webhooks.
// Webhook URLs are stored in Supabase (app_data key: "notificationSettings").

export interface NotificationPayload {
  event: NotificationEvent;
  title: string;
  message: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: string; // hex color for embed
  emoji?: string; // leading emoji
  url?: string;   // optional link
}

export type NotificationEvent =
  | "pitch_submitted"
  | "pitch_approved"
  | "pitch_rejected"
  | "xc_awarded"
  | "job_posted"
  | "job_hired"
  | "task_approved"
  | "task_rejected"
  | "leaderboard_update"
  | "studio_tax"
  | "entry_fee_paid"
  | "residual_earned"
  | "badge_awarded"
  | "rank_up"
  | "custom";

export interface NotificationSettings {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  enabledEvents: NotificationEvent[];
  slackChannel?: string; // Override channel (if webhook supports it)
  mentionAdmins?: boolean;
}

const EVENT_COLORS: Record<NotificationEvent, string> = {
  pitch_submitted: "#4f8ef7",
  pitch_approved: "#22c55e",
  pitch_rejected: "#ef4444",
  xc_awarded: "#a78bfa",
  job_posted: "#00d4ff",
  job_hired: "#f59e0b",
  task_approved: "#22c55e",
  task_rejected: "#ef4444",
  leaderboard_update: "#f5c842",
  studio_tax: "#94a3b8",
  entry_fee_paid: "#22c55e",
  residual_earned: "#a78bfa",
  badge_awarded: "#f5c842",
  rank_up: "#f59e0b",
  custom: "#00d4ff",
};

const EVENT_EMOJIS: Record<NotificationEvent, string> = {
  pitch_submitted: "💡",
  pitch_approved: "✅",
  pitch_rejected: "❌",
  xc_awarded: "⚡",
  job_posted: "📋",
  job_hired: "🤝",
  task_approved: "🎯",
  task_rejected: "🔄",
  leaderboard_update: "🏆",
  studio_tax: "🏛️",
  entry_fee_paid: "🎟️",
  residual_earned: "💰",
  badge_awarded: "🏅",
  rank_up: "📈",
  custom: "📢",
};

// ─── Format for Slack ─────────────────────────────────────────────
function formatSlackPayload(notif: NotificationPayload) {
  const emoji = notif.emoji || EVENT_EMOJIS[notif.event] || "📢";
  const color = notif.color || EVENT_COLORS[notif.event] || "#00d4ff";

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${notif.title}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: notif.message },
    },
  ];

  if (notif.fields && notif.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: notif.fields.map(f => ({
        type: "mrkdwn",
        text: `*${f.name}*\n${f.value}`,
      })),
    });
  }

  if (notif.url) {
    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "Open in PFLX →", emoji: true },
        url: notif.url,
        style: "primary",
      }],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `PFLX X-Coin System • ${new Date().toLocaleString()}` }],
  });

  return {
    blocks,
    attachments: [{ color }],
  };
}

// ─── Format for Discord ───────────────────────────────────────────
function formatDiscordPayload(notif: NotificationPayload) {
  const emoji = notif.emoji || EVENT_EMOJIS[notif.event] || "📢";
  const color = parseInt((notif.color || EVENT_COLORS[notif.event] || "#00d4ff").replace("#", ""), 16);

  const embed: any = {
    title: `${emoji} ${notif.title}`,
    description: notif.message,
    color,
    timestamp: new Date().toISOString(),
    footer: { text: "PFLX X-Coin System" },
  };

  if (notif.fields && notif.fields.length > 0) {
    embed.fields = notif.fields.map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline !== false,
    }));
  }

  if (notif.url) {
    embed.url = notif.url;
  }

  return { embeds: [embed] };
}

// ─── Send notification to all configured platforms ────────────────
export async function sendNotification(notif: NotificationPayload, settings?: NotificationSettings): Promise<{ slack: boolean; discord: boolean }> {
  const result = { slack: false, discord: false };

  // Load settings from Supabase if not provided
  let cfg = settings;
  if (!cfg) {
    try {
      const res = await fetch("/api/notify-settings");
      if (res.ok) cfg = await res.json();
    } catch {
      console.warn("[PFLX Notify] Could not load notification settings");
    }
  }

  if (!cfg) return result;

  // Check if this event is enabled
  if (cfg.enabledEvents && cfg.enabledEvents.length > 0 && !cfg.enabledEvents.includes(notif.event)) {
    return result;
  }

  // Send to Slack
  if (cfg.slackWebhookUrl) {
    try {
      const payload = formatSlackPayload(notif);
      const res = await fetch(cfg.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      result.slack = res.ok;
      if (!res.ok) console.warn("[PFLX Notify] Slack webhook failed:", res.status);
    } catch (err) {
      console.warn("[PFLX Notify] Slack webhook error:", err);
    }
  }

  // Send to Discord
  if (cfg.discordWebhookUrl) {
    try {
      const payload = formatDiscordPayload(notif);
      const res = await fetch(cfg.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      result.discord = res.ok;
      if (!res.ok) console.warn("[PFLX Notify] Discord webhook failed:", res.status);
    } catch (err) {
      console.warn("[PFLX Notify] Discord webhook error:", err);
    }
  }

  return result;
}

// ─── Convenience helpers for common events ────────────────────────

export function notifyPitchSubmitted(playerName: string, pitchTitle: string, pathway: string) {
  return sendNotification({
    event: "pitch_submitted",
    title: "New Project Pitch Submitted",
    message: `*${playerName}* submitted a new pitch for the *${pathway}* pathway.`,
    fields: [
      { name: "Project", value: pitchTitle },
      { name: "Pathway", value: pathway },
      { name: "Status", value: "⏳ Awaiting Review" },
    ],
  });
}

export function notifyPitchApproved(playerName: string, pitchTitle: string, jobCount: number) {
  return sendNotification({
    event: "pitch_approved",
    title: "Project Pitch Approved!",
    message: `*${playerName}*'s pitch has been approved and is now live on the Pathway Portal.`,
    fields: [
      { name: "Project", value: pitchTitle },
      { name: "Jobs Created", value: `${jobCount} roles open` },
      { name: "Status", value: "✅ Approved → Live" },
    ],
  });
}

export function notifyXCAward(playerName: string, amount: number, reason: string, taxDeducted?: number) {
  const fields = [
    { name: "Player", value: playerName },
    { name: "XC Earned", value: `⚡ ${amount.toLocaleString()} XC` },
    { name: "Reason", value: reason },
  ];
  if (taxDeducted && taxDeducted > 0) {
    fields.push({ name: "Studio Tax", value: `🏛️ -${taxDeducted} XC` });
  }
  return sendNotification({
    event: "xc_awarded",
    title: "X-Coin Awarded",
    message: `*${playerName}* earned *${amount.toLocaleString()} XC*!`,
    fields,
  });
}

export function notifyTaskApproved(playerName: string, taskTitle: string, xcAwarded: number) {
  return sendNotification({
    event: "task_approved",
    title: "Task Approved",
    message: `*${playerName}*'s submission for "${taskTitle}" has been approved.`,
    fields: [
      { name: "Task", value: taskTitle },
      { name: "XC Awarded", value: `⚡ ${xcAwarded.toLocaleString()} XC` },
    ],
  });
}

export function notifyJobHired(playerName: string, jobTitle: string, projectTitle: string) {
  return sendNotification({
    event: "job_hired",
    title: "Player Hired for Job",
    message: `*${playerName}* has been hired as *${jobTitle}*!`,
    fields: [
      { name: "Job", value: jobTitle },
      { name: "Project", value: projectTitle },
    ],
  });
}

export function notifyBadgeAwarded(playerName: string, badgeName: string, xc: number) {
  return sendNotification({
    event: "badge_awarded",
    title: "Badge Awarded",
    message: `*${playerName}* earned the *${badgeName}* badge!`,
    fields: [
      { name: "Badge", value: `🏅 ${badgeName}` },
      { name: "XC Value", value: `⚡ ${xc.toLocaleString()} XC` },
    ],
  });
}

export function notifyRankUp(playerName: string, newRank: string, level: number) {
  return sendNotification({
    event: "rank_up",
    title: "Evo Rank Up!",
    message: `*${playerName}* has reached *${newRank}* (Level ${level})! 🎉`,
    fields: [
      { name: "New Rank", value: `📈 ${newRank}` },
      { name: "Level", value: `${level}` },
    ],
    color: "#f59e0b",
  });
}
