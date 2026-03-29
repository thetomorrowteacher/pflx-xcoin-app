"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User, mockTasks, mockJobs, mockTransactions, mockCheckpoints,
  mockGamePeriods, mockUsers, COIN_CATEGORIES,
  getLevelFromXC, getXCProgress, getCurrentRank, getRankProgress,
  isAssignedToPlayer,
} from "../lib/data";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
}

// ─── Voice helpers ────────────────────────────────────────────────────────────
function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`🎮🏆⚡🪙📋💼🕒✅❌🎁🔔]/g, ""));
  u.rate = 1.05; u.pitch = 1.1; u.volume = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ─── Smart Priority Advisor ──────────────────────────────────────────────────
function buildPriorityAdvice(player: User): string {
  const firstName = player.name.split(" ")[0];
  const now = new Date();
  const myTasks = mockTasks.filter(
    t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open"
  );
  const myJobs = mockJobs.filter(
    j => isAssignedToPlayer(j.assignedTo, player.id, player.cohort) && j.status === "open"
  );
  const pendingSubs = mockTasks.filter(t => t.submittedBy === player.id && t.status === "submitted");

  if (myTasks.length === 0 && myJobs.length === 0 && pendingSubs.length === 0) {
    return `You're all caught up, ${firstName}! No tasks, jobs, or pending submissions right now. Check back soon or ask your host about upcoming opportunities.`;
  }

  // Score and rank each item by urgency + value
  interface PriorityItem {
    type: "task" | "job";
    title: string;
    xc: number;
    dueDate?: string;
    urgencyScore: number;
    valueScore: number;
    totalScore: number;
    reason: string;
  }

  const items: PriorityItem[] = [];

  for (const t of myTasks) {
    let urgencyScore = 0;
    let reason = "";
    const daysLeft = t.dueDate ? Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / 86400000) : 999;

    if (daysLeft < 0) { urgencyScore = 100; reason = "OVERDUE"; }
    else if (daysLeft === 0) { urgencyScore = 90; reason = "Due today"; }
    else if (daysLeft === 1) { urgencyScore = 80; reason = "Due tomorrow"; }
    else if (daysLeft <= 3) { urgencyScore = 60; reason = `Due in ${daysLeft} days`; }
    else if (daysLeft <= 7) { urgencyScore = 30; reason = `Due this week`; }
    else { urgencyScore = 10; reason = t.dueDate ? `Due ${t.dueDate}` : "No deadline"; }

    // Value = XC reward normalized (higher XC = higher priority)
    const valueScore = Math.min(100, Math.round((t.xcReward / 500) * 100));

    items.push({
      type: "task", title: t.title, xc: t.xcReward,
      dueDate: t.dueDate, urgencyScore, valueScore,
      totalScore: urgencyScore * 0.6 + valueScore * 0.4,
      reason,
    });
  }

  for (const j of myJobs) {
    const slotsLeft = j.slots - j.filledSlots;
    const urgencyScore = slotsLeft <= 1 ? 70 : slotsLeft <= 3 ? 40 : 15;
    const valueScore = Math.min(100, Math.round((j.xcReward / 500) * 100));
    const reason = slotsLeft <= 1 ? "Only 1 slot left!" : `${slotsLeft} slots open`;

    items.push({
      type: "job", title: j.title, xc: j.xcReward,
      urgencyScore, valueScore,
      totalScore: urgencyScore * 0.6 + valueScore * 0.4,
      reason,
    });
  }

  // Sort by total score descending
  items.sort((a, b) => b.totalScore - a.totalScore);

  // Build advice
  let advice = `Here's my recommended priority order for you, ${firstName}:\n\n`;

  const top = items.slice(0, 5);
  top.forEach((item, i) => {
    const icon = item.type === "task" ? "📋" : "💼";
    const urgencyTag = item.urgencyScore >= 80 ? " ⚠️" : item.urgencyScore >= 60 ? " 🔶" : "";
    advice += `${i + 1}. ${icon} ${item.title}${urgencyTag}\n   ${item.reason} · ${item.xc} XC reward\n`;
  });

  if (items.length > 5) {
    advice += `\n...plus ${items.length - 5} more. Focus on these first!\n`;
  }

  // Strategic tips based on player state
  const overdue = items.filter(i => i.reason === "OVERDUE");
  const highValue = items.filter(i => i.valueScore >= 60);
  const level = getLevelFromXC(player.xcoin);
  const progress = Math.round(getXCProgress(player.xcoin) * 100);

  advice += "\n💡 Strategy tips:\n";

  if (overdue.length > 0) {
    advice += `• You have ${overdue.length} overdue item${overdue.length > 1 ? "s" : ""} — knock ${overdue.length === 1 ? "it" : "these"} out first to avoid fines.\n`;
  }
  if (progress >= 75) {
    advice += `• You're ${progress}% to Level ${level + 1} — a couple completions could level you up!\n`;
  }
  if (highValue.length > 0 && overdue.length === 0) {
    advice += `• "${highValue[0].title}" has the best XC payout (${highValue[0].xc} XC) — great target if you want to climb the leaderboard.\n`;
  }
  if (pendingSubs.length > 0) {
    advice += `• ${pendingSubs.length} submission${pendingSubs.length > 1 ? "s are" : " is"} pending review — follow up with your host if it's been a while.\n`;
  }

  return advice.trim();
}

// ─── Contextual guidance for open-ended questions ────────────────────────────
function buildGuidance(input: string, player: User): string | null {
  const txt = input.toLowerCase().trim();
  const firstName = player.name.split(" ")[0];

  // How to earn / level up / get XC
  if (/\b(how.*(earn|get|make).*(xc|xp|coins?|money|badge)|level.?up|rank.?up|grow|improve|get better)\b/.test(txt)) {
    const level = getLevelFromXC(player.xcoin);
    const openTasks = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open");
    const openJobs = mockJobs.filter(j => isAssignedToPlayer(j.assignedTo, player.id, player.cohort) && j.status === "open");
    const topTask = openTasks.sort((a, b) => b.xcReward - a.xcReward)[0];
    const topJob = openJobs.sort((a, b) => b.xcReward - a.xcReward)[0];

    let resp = `Here's how to level up faster, ${firstName} (currently Level ${level}):\n\n`;
    resp += `1. Complete tasks — you have ${openTasks.length} open right now`;
    if (topTask) resp += `. Best payout: "${topTask.title}" (${topTask.xcReward} XC)`;
    resp += `\n2. Apply for jobs — ${openJobs.length} available`;
    if (topJob) resp += `. Top: "${topJob.title}" (${topJob.xcReward} XC)`;
    resp += `\n3. Submit early & with strong proof — quality submissions get approved faster`;
    resp += `\n4. Avoid fines — missed deadlines cost XC. Check deadlines often.`;
    resp += `\n5. Stay consistent — daily engagement keeps momentum going.\n`;
    resp += `\nSay "prioritize" for a ranked action plan based on your current assignments!`;
    return resp;
  }

  // What should I do / where to start / I'm stuck / confused
  if (/\b(what should i|where.*(start|begin)|i'?m (stuck|lost|confused|new|unsure)|what.?next|next step|don'?t know what)\b/.test(txt)) {
    return buildPriorityAdvice(player);
  }

  // How do I submit / turn in work
  if (/\b(how.*(submit|turn in|send|upload)|where.*submit|submission process)\b/.test(txt)) {
    return `To submit your work:\n\n1. Go to your Tasks page (say "go to tasks")\n2. Find the task you completed\n3. Click Submit and attach your proof — this can be a Google Doc link, Canva project, YouTube video, or file upload\n4. Add a note explaining what you did\n5. Hit Submit!\n\nTips for a strong submission:\n• Always include a link to your work\n• Write a clear explanation of what you accomplished\n• Submit before the deadline to avoid fines\n• The more evidence you provide, the faster approval goes`;
  }

  // What are badges / coins / how does XC work
  if (/\b(what.*(badge|coin|xc|signature coin|digital badge)|how.*(xc|badge|coin|economy|system).*(work|function))\b/.test(txt)) {
    const cats = COIN_CATEGORIES;
    let resp = `Here's how the PFLX economy works:\n\n`;
    resp += `⚡ XC (X-Coin) is the currency — you earn it by completing tasks and jobs.\n`;
    resp += `🪙 Digital Badges are earned alongside XC and track your mastery.\n`;
    resp += `📈 Your Level is based on your current XC balance.\n`;
    resp += `🏆 Your Rank is based on lifetime XC earned (never decreases).\n\n`;
    resp += `Badge categories:\n`;
    cats.forEach(c => {
      resp += `• ${c.name}: ${c.coins.length} badge${c.coins.length !== 1 ? "s" : ""}\n`;
    });
    resp += `\nEach badge has an XC reward attached. The harder the challenge, the bigger the payout!`;
    return resp;
  }

  return null; // No guidance match — fall through to other handlers
}

// ─── Response builder (player-scoped) ────────────────────────────────────────
function buildResponse(input: string, player: User, router: ReturnType<typeof useRouter>): string {
  const txt = input.toLowerCase().trim();
  const firstName = player.name.split(" ")[0];

  // ── Priority / Advice (check first) ────────────────────────────────────
  if (/\b(priorit|what should i|advice|recommend|suggest|plan|strateg|guide|coach|next step|what.?next|where.*(start|begin)|focus)\b/.test(txt)) {
    return buildPriorityAdvice(player);
  }

  // ── Contextual guidance (how-to, explanations) ─────────────────────────
  const guidance = buildGuidance(input, player);
  if (guidance) return guidance;

  // ── Greetings ────────────────────────────────────────────────────────────
  if (/^(hi|hey|hello|sup|what'?s up|yo)\b/.test(txt)) {
    const level = getLevelFromXC(player.xcoin);
    const openTasks = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open").length;
    const overdue = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    let greeting = `Hey ${firstName}! 👋 You're Level ${level} with ${player.xcoin.toLocaleString()} XC and ${player.digitalBadges} Digital Badges.`;
    if (overdue > 0) greeting += ` ⚠️ Heads up — ${overdue} overdue task${overdue > 1 ? "s" : ""} need attention!`;
    else if (openTasks > 0) greeting += ` You have ${openTasks} open task${openTasks > 1 ? "s" : ""} ready to work on.`;
    greeting += ` Say "prioritize" for a recommended action plan, or ask me anything!`;
    return greeting;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (/\b(my stats|stats|xp|coins?|balance|level|rank|progress)\b/.test(txt)) {
    const level = getLevelFromXC(player.xcoin);
    const progress = Math.round(getXCProgress(player.xcoin) * 100);
    const rank = getCurrentRank(player.totalXcoin);
    const rankProgress = Math.round(getRankProgress(player.totalXcoin) * 100);
    const leaderboard = [...mockUsers.filter(u => u.role === "player")].sort((a, b) => b.xcoin - a.xcoin);
    const position = leaderboard.findIndex(u => u.id === player.id) + 1;
    return `📊 Your stats, ${firstName}:\n\n⚡ XC: ${player.xcoin.toLocaleString()} (Level ${level} · ${progress}% to next)\n🏆 Rank: ${rank.name} (${rankProgress}% to next tier)\n🪙 Badges: ${player.digitalBadges}\n🏅 Leaderboard: #${position} of ${leaderboard.length} players\n\nKeep pushing — you're doing great!`;
  }

  // ── My tasks ──────────────────────────────────────────────────────────────
  if (/\b(my tasks?|open tasks?|todo|to.do|what.*tasks?|tasks? due)\b/.test(txt)) {
    const myTasks = mockTasks.filter(
      t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open"
    );
    if (myTasks.length === 0) return `🎉 No open tasks right now, ${firstName}! Check back later or ask about your jobs.`;
    const lines = myTasks.slice(0, 5).map(t =>
      `• ${t.title} — ${t.xcReward} XC${t.dueDate ? ` (due ${t.dueDate})` : ""}`
    );
    const more = myTasks.length > 5 ? `\n…and ${myTasks.length - 5} more.` : "";
    return `📋 Your open tasks (${myTasks.length}):\n\n${lines.join("\n")}${more}`;
  }

  // ── Deadlines ─────────────────────────────────────────────────────────────
  if (/\b(deadline|due|due soon|upcoming|expir)\b/.test(txt)) {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    const myTasks = mockTasks.filter(
      t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) &&
        t.status === "open" && t.dueDate
    );
    const soon = myTasks
      .filter(t => { const d = new Date(t.dueDate!); return d >= now && d <= week; })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    const overdue = myTasks.filter(t => new Date(t.dueDate!) < now);

    if (overdue.length === 0 && soon.length === 0)
      return `✅ No deadlines this week, ${firstName}. You're all caught up!`;

    let resp = "";
    if (overdue.length > 0) {
      resp += `⚠️ Overdue (${overdue.length}):\n${overdue.map(t => `• ${t.title} (was due ${t.dueDate})`).join("\n")}\n\n`;
    }
    if (soon.length > 0) {
      resp += `🕒 Due this week (${soon.length}):\n${soon.map(t => `• ${t.title} — ${t.dueDate}`).join("\n")}`;
    }
    return resp.trim();
  }

  // ── Pending submissions ───────────────────────────────────────────────────
  if (/\b(submit|submission|pending|waiting|review)\b/.test(txt)) {
    const pending = mockTasks.filter(
      t => t.submittedBy === player.id && t.status === "submitted"
    );
    if (pending.length === 0) return `No submissions waiting on approval right now. Submit a task from the Tasks page!`;
    const lines = pending.map(t => `• ${t.title} — submitted ${t.submittedAt ?? "recently"}`);
    return `⏳ Submissions awaiting approval (${pending.length}):\n\n${lines.join("\n")}\n\nHang tight while your teacher reviews them!`;
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  if (/\b(my jobs?|active jobs?|job)\b/.test(txt)) {
    const myJobs = mockJobs.filter(
      j => isAssignedToPlayer(j.assignedTo, player.id, player.cohort) && j.status === "open"
    );
    if (myJobs.length === 0) return `No active jobs assigned to you right now.`;
    const lines = myJobs.map(j => `• ${j.title} — ${j.xcReward} XC (${j.slots - j.filledSlots} slot${j.slots - j.filledSlots !== 1 ? "s" : ""} left)`);
    return `💼 Your active jobs (${myJobs.length}):\n\n${lines.join("\n")}`;
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  if (/\b(leaderboard|ranking|top players?|who.*winning|standing)\b/.test(txt)) {
    const sorted = [...mockUsers.filter(u => u.role === "player")].sort((a, b) => b.xcoin - a.xcoin);
    const myPos = sorted.findIndex(u => u.id === player.id) + 1;
    const lines = sorted.slice(0, 5).map((u, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      const isMe = u.id === player.id ? " ← you" : "";
      return `${medal} ${u.name} — ${u.xcoin.toLocaleString()} XC${isMe}`;
    });
    const mySnippet = myPos > 5 ? `\n\nYou're at #${myPos} — keep grinding to break into the top 5!` : "";
    return `🏆 Top 5 Leaderboard:\n\n${lines.join("\n")}${mySnippet}`;
  }

  // ── Wallet / Transactions ────────────────────────────────────────────────
  if (/\b(wallet|transaction|history|earn|spent|recent)\b/.test(txt)) {
    const myTxns = mockTransactions.filter(t => t.userId === player.id).reverse().slice(0, 5);
    if (myTxns.length === 0) return `No transactions on record yet. Complete tasks to start earning!`;
    const lines = myTxns.map(t => {
      const sign = t.type === "spent" || t.type === "pflx_tax" ? "−" : "+";
      return `• ${sign}${t.amount} ${t.currency.toUpperCase()} — ${t.description}`;
    });
    return `💳 Recent transactions:\n\n${lines.join("\n")}\n\nFor full history, check your Wallet page.`;
  }

  // ── Checkpoints ──────────────────────────────────────────────────────────
  if (/\b(checkpoint|season|period|round)\b/.test(txt)) {
    const activePeriod = mockGamePeriods.find(p => p.isActive);
    const activeCP = mockCheckpoints.find(cp => cp.status === "active");
    let resp = "";
    if (activePeriod) resp += `📅 Season: ${activePeriod.title}\n`;
    if (activeCP) {
      resp += `🎯 Checkpoint: ${activeCP.name}`;
      if (activeCP.endDate) resp += ` (ends ${activeCP.endDate})`;
    } else {
      resp += "No active checkpoint right now.";
    }
    return resp || "No active season or checkpoint found.";
  }

  // ── Coins / Badges ───────────────────────────────────────────────────────
  if (/\b(badge|coin categories|what coins?|x.?coin types?)\b/.test(txt)) {
    const categories = COIN_CATEGORIES.map(cat =>
      `${cat.name}: ${cat.coins.map(c => c.name).join(", ")}`
    );
    return `🪙 Digital Badge categories:\n\n${categories.join("\n")}\n\nEarn badges by completing tasks and jobs!`;
  }

  // ── Motivation ───────────────────────────────────────────────────────────
  if (/\b(motivat|inspire|pump.?up|hype|encourag|push)\b/.test(txt)) {
    const level = getLevelFromXC(player.xcoin);
    const openCount = mockTasks.filter(
      t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open"
    ).length;
    return `🔥 Let's go, ${firstName}! You're Level ${level} and you've earned ${player.xcoin.toLocaleString()} XP — that's real work. You have ${openCount} open task${openCount !== 1 ? "s" : ""} waiting. Every submission is another step toward the top. You've got this. 💪`;
  }

  // ── Navigate ──────────────────────────────────────────────────────────────
  if (/\bgo to\b|\bopen\b|\bnavigate\b|\btake me\b/.test(txt)) {
    if (/task/.test(txt)) { router.push("/player/tasks"); return "Opening your Tasks page..."; }
    if (/job/.test(txt)) { router.push("/player/jobs"); return "Opening Jobs..."; }
    if (/wallet/.test(txt)) { router.push("/player/wallet"); return "Opening your Wallet..."; }
    if (/leaderboard/.test(txt)) { router.push("/player/leaderboard"); return "Opening the Leaderboard..."; }
    if (/market/.test(txt)) { router.push("/player/marketplace"); return "Opening the Marketplace..."; }
    if (/home|dashboard/.test(txt)) { router.push("/player"); return "Taking you home..."; }
    if (/submit/.test(txt)) { router.push("/player/submit"); return "Opening Submit..."; }
  }

  // ── Help ──────────────────────────────────────────────────────────────────
  if (/\b(help|commands?|what can you|what do you)\b/.test(txt)) {
    return `🎮 Here's what I can help with:\n\n📌 Guidance & Strategy:\n• "Prioritize" / "What should I do?" — smart priority ranking\n• "How do I level up?" — earning strategies\n• "How do I submit?" — submission walkthrough\n• "How does XC work?" — economy explained\n\n📊 Your Data:\n• "My stats" — XP, level, rank, position\n• "My tasks" — open tasks\n• "Deadlines" — due soon or overdue\n• "My jobs" — active jobs\n• "Submissions" — pending approvals\n• "Leaderboard" — top players\n• "Wallet" — transactions\n\n🎯 Actions:\n• "Motivate me" — a boost 🔥\n• "Go to [page]" — navigate\n\nYou can also tap the mic and speak!`;
  }

  // ── Default — contextual rather than unhelpful ─────────────────────────
  const defOpen = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open").length;
  const defOverdue = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
  let fallback = `I'm not sure about that one, ${firstName}. But here's a snapshot: `;
  if (defOverdue > 0) fallback += `⚠️ ${defOverdue} overdue task${defOverdue > 1 ? "s" : ""} need attention. `;
  else if (defOpen > 0) fallback += `You have ${defOpen} open task${defOpen > 1 ? "s" : ""} to work on. `;
  fallback += `Try "prioritize" for a full action plan, or "help" to see everything I can do.`;
  return fallback;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlayerAssistant() {
  const router = useRouter();
  const [player, setPlayer] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // Load player from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (stored) {
      try { setPlayer(JSON.parse(stored) as User); } catch { /* ignore */ }
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0 && player) {
      const level = getLevelFromXC(player.xcoin);
      const openTasks = mockTasks.filter(
        t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) && t.status === "open"
      ).length;
      const pending = mockTasks.filter(t => t.submittedBy === player.id && t.status === "pending").length;
      let welcome = `Hey ${player.name.split(" ")[0]}! 👋 I'm your PFLX game assistant.\n\n⚡ ${player.xcoin.toLocaleString()} XC · Level ${level} · 🪙 ${player.digitalBadges} Digital Badges`;
      if (openTasks > 0) welcome += `\n📋 ${openTasks} open task${openTasks !== 1 ? "s" : ""} waiting`;
      if (pending > 0) welcome += `\n⏳ ${pending} submission${pending !== 1 ? "s" : ""} pending review`;
      welcome += `\n\nAsk me anything or say "help"!`;
      setMessages([{ id: "welcome", role: "assistant", text: welcome, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }
  }, [open, player]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMsg = (role: "user" | "assistant", text: string) => {
    const msg: Message = { id: Date.now().toString(), role, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const handleSend = useCallback(async (raw?: string) => {
    if (!player) return;
    const text = (raw ?? input).trim();
    if (!text) return;
    setInput("");
    addMsg("user", text);
    setThinking(true);
    await new Promise(r => setTimeout(r, 400));
    const reply = buildResponse(text, player, router);
    setThinking(false);
    addMsg("assistant", reply);
    speak(reply, voiceOn);
  }, [input, player, router, voiceOn]);

  // Voice
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition || (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      handleSend(transcript);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }, [handleSend]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  if (!player) return null;

  const pendingCount = mockTasks.filter(t => t.submittedBy === player.id && t.status === "submitted").length;
  const overdueCount = mockTasks.filter(
    t => isAssignedToPlayer(t.assignedTo, player.id, player.cohort) &&
      t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()
  ).length;
  const badgeCount = pendingCount + overdueCount;

  const ACCENT = "#a855f7"; // purple
  const GOLD = "#f5c842";

  const quickChips = ["Prioritize", "My tasks", "How to level up", "Deadlines", "Help"];

  return (
    <>
      <style>{`
        @keyframes pa-pulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.35);opacity:0} }
        @keyframes pa-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes pa-dot { 0%,80%,100%{opacity:.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
        .pa-typing span { display:inline-block; width:6px; height:6px; border-radius:50%; background:${ACCENT}; margin:0 2px; animation:pa-dot 1.4s infinite; }
        .pa-typing span:nth-child(2){animation-delay:.2s} .pa-typing span:nth-child(3){animation-delay:.4s}
      `}</style>

      {/* FAB */}
      <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999 }}>
        {badgeCount > 0 && !open && (
          <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${ACCENT}`, animation: "pa-pulse 1.8s ease-out infinite" }} />
        )}
        <button
          onClick={() => setOpen(o => !o)}
          title="PFLX Game Assistant"
          style={{
            width: "56px", height: "56px", borderRadius: "50%", border: "none", cursor: "pointer",
            background: open ? `${ACCENT}` : `linear-gradient(135deg, #7c3aed, ${GOLD})`,
            boxShadow: `0 4px 20px ${ACCENT}66`,
            color: "#fff", fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .2s",
          }}
        >
          {open ? "✕" : "🎮"}
        </button>
        {badgeCount > 0 && !open && (
          <div style={{
            position: "absolute", top: "-4px", right: "-4px",
            width: "20px", height: "20px", borderRadius: "50%",
            background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {badgeCount}
          </div>
        )}
      </div>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "96px", right: "28px", width: "360px",
          maxHeight: "560px", borderRadius: "20px", zIndex: 9998,
          background: "linear-gradient(145deg, #1a0a2e, #0f0a1e)",
          border: `1px solid ${ACCENT}44`,
          boxShadow: `0 20px 60px rgba(168,85,247,0.2)`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "'Inter','Segoe UI',sans-serif",
        }}>

          {/* Header */}
          <div style={{ padding: "14px 16px 10px", background: `linear-gradient(135deg, ${ACCENT}22, #7c3aed11)`, borderBottom: `1px solid ${ACCENT}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "10px",
                  background: `linear-gradient(135deg, #7c3aed, ${GOLD})`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                }}>🎮</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#f0e8ff" }}>PFLX Coach</div>
                  <div style={{ fontSize: "10px", color: ACCENT }}>● Online · {player.name}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setVoiceOn(v => !v)} title={voiceOn ? "Mute" : "Unmute"}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: "8px", color: voiceOn ? GOLD : "rgba(255,255,255,0.3)", fontSize: "14px", width: "30px", height: "30px", cursor: "pointer" }}>
                  {voiceOn ? "🔊" : "🔇"}
                </button>
                <button onClick={() => { setMessages([]); }}
                  title="Clear chat"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: "8px", color: "rgba(255,255,255,0.4)", fontSize: "12px", width: "30px", height: "30px", cursor: "pointer" }}>
                  🗑
                </button>
              </div>
            </div>

            {/* Player XP mini bar */}
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: GOLD, fontWeight: 700 }}>⚡ {player.xcoin.toLocaleString()}</span>
              <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)" }}>
                <div style={{ height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${ACCENT}, ${GOLD})`, width: `${Math.round(getXCProgress(player.xcoin) * 100)}%`, transition: "width .5s" }} />
              </div>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Lv {getLevelFromXC(player.xcoin)}</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: "24px", height: "24px", borderRadius: "8px", background: `linear-gradient(135deg, #7c3aed, ${GOLD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0, marginRight: "8px", alignSelf: "flex-end" }}>🎮</div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "9px 12px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? `linear-gradient(135deg, ${ACCENT}, #7c3aed)` : "rgba(255,255,255,0.06)",
                  border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
                  color: "#f0e8ff", fontSize: "12px", lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {msg.text}
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "4px", textAlign: msg.role === "user" ? "right" : "left" }}>{msg.time}</div>
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "8px", background: `linear-gradient(135deg, #7c3aed, ${GOLD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>🎮</div>
                <div className="pa-typing" style={{ padding: "8px 12px", borderRadius: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          <div style={{ padding: "0 12px 8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {quickChips.map(c => (
              <button key={c} onClick={() => handleSend(c)}
                style={{
                  padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  background: "rgba(168,85,247,0.12)", border: `1px solid ${ACCENT}44`, color: ACCENT,
                  whiteSpace: "nowrap",
                }}>
                {c}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={listening ? "Listening..." : "Ask me anything..."}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: "12px", fontSize: "12px",
                background: "rgba(255,255,255,0.06)", border: `1px solid ${input ? ACCENT + "66" : "rgba(255,255,255,0.1)"}`,
                color: "#f0e8ff", outline: "none",
              }}
            />
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              title="Hold to speak"
              style={{
                width: "36px", height: "36px", borderRadius: "10px", border: "none", cursor: "pointer", flexShrink: 0,
                background: listening ? ACCENT : "rgba(168,85,247,0.15)",
                color: listening ? "#fff" : ACCENT,
                fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                animation: listening ? "pa-bounce .5s ease-in-out infinite" : "none",
                transition: "background .15s",
              }}>
              🎤
            </button>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              style={{
                width: "36px", height: "36px", borderRadius: "10px", border: "none", cursor: "pointer", flexShrink: 0,
                background: input.trim() ? `linear-gradient(135deg, ${ACCENT}, #7c3aed)` : "rgba(255,255,255,0.06)",
                color: input.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
