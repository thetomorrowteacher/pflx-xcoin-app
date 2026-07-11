"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  mockUsers, mockTasks, mockCheckpoints, mockGamePeriods,
  mockModifiers, mockTransactions, mockJobs, Task,
  isAssignedToPlayer,
} from "../lib/data";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  score: number;
  recommendation: "approve" | "review" | "reject";
  signals: string[];
  flags: string[];
  summary: string;
  source: "heuristic" | "xbot";
}

interface ReviewCard {
  type: "submission_review";
  task: Task;
  playerName: string;
  analysis: AnalysisResult;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  card?: ReviewCard;
}

// ─── Voice ────────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g, ""));
  u.rate = 1.05; u.pitch = 1; u.volume = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, rec }: { score: number; rec: string }) {
  const color = rec === "approve" ? "#22c55e" : rec === "reject" ? "#ef4444" : "#f59e0b";
  const label = rec === "approve" ? "✅ APPROVE" : rec === "reject" ? "❌ REJECT" : "👁 REVIEW";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "18px", fontWeight: 800, color }}>{score}</span>
      </div>
      <span style={{ padding: "4px 10px", borderRadius: "8px", background: `${color}22`, color, fontSize: "12px", fontWeight: 800 }}>{label}</span>
    </div>
  );
}

// ─── Submission review card rendered inside chat ──────────────────────────────
function SubmissionCard({ card, onApprove, onReject }: { card: ReviewCard; onApprove: () => void; onReject: () => void }) {
  const { task, playerName, analysis } = card;
  const proof = task.submissionProof;
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "14px", fontSize: "12px" }}>
      <div style={{ fontWeight: 700, color: "#f0f0ff", fontSize: "13px", marginBottom: "4px" }}>{task.title}</div>
      <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: "12px" }}>by {playerName} · {task.submittedAt ?? "—"}</div>

      {/* Proof */}
      <div style={{ marginBottom: "12px" }}>
        {proof?.linkUrl && (
          <a href={proof.linkUrl} target="_blank" rel="noreferrer" style={{ color: "#4f8ef7", display: "block", wordBreak: "break-all", marginBottom: "4px" }}>
            🔗 {proof.linkUrl}
          </a>
        )}
        {proof?.fileUrl && <div style={{ color: "rgba(255,255,255,0.5)" }}>📎 {proof.fileUrl}</div>}
        {!proof?.linkUrl && !proof?.fileUrl && <div style={{ color: "#ef4444" }}>⚠️ No proof submitted</div>}
        {proof?.note && <div style={{ color: "rgba(255,255,255,0.5)", marginTop: "4px", fontStyle: "italic" }}>"{proof.note}"</div>}
      </div>

      {/* AI Analysis */}
      <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "10px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <ScoreBadge score={analysis.score} rec={analysis.recommendation} />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
            {analysis.source === "xbot" ? "🤖 X-Bot" : "📊 Heuristic"}
          </span>
        </div>
        <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{analysis.summary}</p>
        {analysis.signals.length > 0 && (
          <div style={{ marginBottom: "4px" }}>
            {analysis.signals.map((s, i) => <div key={i} style={{ color: "#4ade80", marginBottom: "2px" }}>✓ {s}</div>)}
          </div>
        )}
        {analysis.flags.length > 0 && (
          <div>
            {analysis.flags.map((f, i) => <div key={i} style={{ color: "#fca5a5", marginBottom: "2px" }}>⚠ {f}</div>)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <button onClick={onApprove} style={{ padding: "8px", borderRadius: "8px", border: "none", background: "rgba(34,197,94,0.2)", color: "#4ade80", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>✅ Approve</button>
        <button onClick={onReject} style={{ padding: "8px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.15)", color: "#f87171", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>❌ Request Resubmission</button>
      </div>
    </div>
  );
}

// ─── Command Engine ───────────────────────────────────────────────────────────
async function analyzeTask(task: Task): Promise<AnalysisResult> {
  const playerHistory = mockTasks.filter(t => t.submittedBy === task.submittedBy && t.id !== task.id);
  try {
    const res = await fetch("/api/analyze-submission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, taskHistory: playerHistory }),
    });
    if (res.ok) return await res.json();
  } catch { /* fallback below */ }
  // Client-side heuristic fallback
  const proof = task.submissionProof;
  let score = 0; const signals: string[] = []; const flags: string[] = [];
  if (proof?.linkUrl) {
    score += 35; signals.push("Submission link provided");
    try {
      const url = new URL(proof.linkUrl);
      const h = url.hostname;
      if (h.includes("docs.google") || h.includes("drive.google")) { score += 15; signals.push("Google Docs/Drive"); }
      else if (h.includes("canva")) { score += 15; signals.push("Canva project"); }
      else if (h.includes("youtube") || h.includes("youtu.be")) { score += 10; signals.push("Video submission"); }
      else if (h.includes("github")) { score += 15; signals.push("GitHub repository"); }
      else { score += 5; }
    } catch { flags.push("Malformed URL"); score -= 15; }
  } else { flags.push("No submission link"); }
  if (proof?.fileUrl) { score += 20; signals.push("File attached"); }
  if (proof?.note && proof.note.length > 10) { score += 15; signals.push(`Note: "${proof.note.slice(0, 50)}"`); } else { flags.push("No explanatory note"); }
  if (task.submittedAt && task.dueDate) {
    if (new Date(task.submittedAt) <= new Date(task.dueDate)) { score += 15; signals.push("Submitted on time"); }
    else { flags.push("Submitted late"); score -= 10; }
  }
  score = Math.max(0, Math.min(100, score));
  const recommendation: AnalysisResult["recommendation"] = score >= 70 ? "approve" : score >= 40 ? "review" : "reject";
  return { score, recommendation, signals, flags, summary: recommendation === "approve" ? "Strong submission — evidence looks credible." : recommendation === "review" ? "Submission needs a closer look before approving." : "Missing key proof. Consider requesting resubmission.", source: "heuristic" };
}

function buildTextResponse(input: string, router: ReturnType<typeof useRouter>): string {
  const txt = input.toLowerCase().trim();
  const players = mockUsers.filter(u => u.role === "player");
  const pending = mockTasks.filter(t => t.status === "submitted");
  const openTasks = mockTasks.filter(t => t.status === "open");
  const activeSeason = mockGamePeriods.find(g => g.isActive);
  const activeCheckpoints = mockCheckpoints.filter(c => c.status === "active");

  // navigation
  const navMap: [string[], string, string][] = [
    [["dashboard","home"], "/admin", "Dashboard"],
    [["approvals","approval"], "/admin/approvals", "Approvals"],
    [["players","player"], "/admin/players", "Players"],
    [["task management","tasks"], "/admin/task-management", "Task Management"],
    [["leaderboard"], "/admin/leaderboard", "Leaderboard"],
    [["coins","coin management"], "/admin/coins", "Coin Management"],
    [["game management","modifiers"], "/admin/modifiers", "Game Management"],
    [["settings"], "/admin/settings", "Settings"],
  ];
  for (const [kws, path, label] of navMap) {
    if ((txt.includes("go to")||txt.includes("open")||txt.includes("navigate")||txt.includes("show me")) && kws.some(k => txt.includes(k))) {
      setTimeout(() => router.push(path), 400);
      return `Navigating to ${label} now.`;
    }
  }

  if (txt.match(/\b(stats|overview|summary|how.*doing)\b/)) {
    const xp = players.reduce((s,u)=>s+u.xcoin,0);
    return `Overview: ${players.length} players · ${xp.toLocaleString()} total XC · ${pending.length} pending approvals · ${openTasks.length} open tasks · ${activeCheckpoints.length} active checkpoint${activeCheckpoints.length!==1?"s":""}.${activeSeason?` Season: "${activeSeason.title}".`:""}`;
  }
  if (txt.match(/\bapprove all\b/)) {
    if (!pending.length) return "Nothing pending right now — you're all clear!";
    const count = pending.length;
    pending.forEach(t => {
      const idx = mockTasks.findIndex(x=>x.id===t.id);
      if (idx!==-1) {
        mockTasks[idx].status="approved";
        const pl = mockUsers.find(u=>u.id===t.submittedBy);
        if(pl){pl.xcoin+=t.xcReward;pl.totalXcoin+=t.xcReward;mockTransactions.push({id:`tx-${Date.now()}-${t.id}`,userId:pl.id,type:"earned",amount:t.xcReward,currency:"xcoin",description:`Task Approved: ${t.title}`,createdAt:new Date().toISOString().split("T")[0]});}
      }
    });
    return `Done! Approved all ${count} pending submissions and credited XC.`;
  }
  if (txt.match(/\b(pending|review|waiting|approvals?)\b/) && !txt.match(/\banalyze|review.*submission\b/)) {
    if (!pending.length) return "No pending submissions right now!";
    const list = pending.slice(0,3).map(t=>{const p=players.find(u=>u.id===t.submittedBy);return `"${t.title}" by ${p?.name??"?"}`; }).join("; ");
    return `${pending.length} pending: ${list}${pending.length>3?` + ${pending.length-3} more`:""}.`;
  }
  if (txt.match(/\b(top players?|leaderboard|ranking|who.*leading)\b/)) {
    const top=[...players].sort((a,b)=>b.xcoin-a.xcoin).slice(0,5);
    return "Leaderboard: "+top.map((p,i)=>`${i+1}. ${p.name} — ${p.xcoin.toLocaleString()} XC`).join("; ");
  }
  if (txt.match(/\bcheckpoint\b/)) {
    if (!activeCheckpoints.length) return "No checkpoints currently active.";
    return `Active: ${activeCheckpoints.map(c=>`"${c.name}"`).join(", ")}.`;
  }
  if (txt.match(/\bseason\b/)) {
    return activeSeason ? `Current season: "${activeSeason.title}"${activeSeason.startDate?` (${activeSeason.startDate} → ${activeSeason.endDate})`:""}` : "No active season.";
  }
  if (txt.match(/\b(open tasks?|available tasks?)\b/)) {
    if (!openTasks.length) return "No open tasks right now.";
    return `${openTasks.length} open tasks: ${openTasks.slice(0,3).map(t=>`"${t.title}"`).join(", ")}${openTasks.length>3?` + ${openTasks.length-3} more`:""}.`;
  }
  if (txt.match(/\btotal (xp|coins?|economy)\b/)) {
    return `Economy: ${players.reduce((s,u)=>s+u.xcoin,0).toLocaleString()} XC · ${players.reduce((s,u)=>s+u.digitalBadges,0)} Digital Badges across ${players.length} players.`;
  }
  if (txt.match(/\bjob(s| board)\b/)) {
    const open = mockJobs ? mockJobs.filter((j:{status:string})=>j.status==="open").length : 0;
    return `${open} open job${open!==1?"s":""} on the board.`;
  }
  if (txt.match(/\bfine|tax|violation\b/)) {
    const taxes = mockModifiers.filter(m=>m.type==="tax");
    const issued = mockTransactions.filter(t=>t.type==="pflx_tax");
    return `${taxes.length} fine types configured. ${issued.length} fine${issued.length!==1?"s":""} issued total.`;
  }
  // ── Player lookup ──────────────────────────────────────────────────────
  const playerLookup = txt.match(/\b(how is|check on|look up|status of|about)\s+(.+)/);
  if (playerLookup) {
    const query = playerLookup[2].replace(/[?.!]/g, "").trim();
    const match = players.find(u =>
      u.name.toLowerCase().includes(query) ||
      (u.brandName && u.brandName.toLowerCase().includes(query))
    );
    if (match) {
      const pTasks = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, match.id, match.cohort) && t.status === "open");
      const pSubs = mockTasks.filter(t => t.submittedBy === match.id && t.status === "submitted");
      const pOverdue = pTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
      const rank = [...players].sort((a, b) => b.xcoin - a.xcoin).findIndex(u => u.id === match.id) + 1;
      let resp = `${match.brandName || match.name}: ${match.xcoin.toLocaleString()} XC · Level ${match.level} · #${rank} on leaderboard · ${match.digitalBadges} badges.`;
      if (pTasks.length > 0) resp += ` ${pTasks.length} open task${pTasks.length > 1 ? "s" : ""}.`;
      if (pOverdue.length > 0) resp += ` ⚠️ ${pOverdue.length} overdue!`;
      if (pSubs.length > 0) resp += ` ${pSubs.length} submission${pSubs.length > 1 ? "s" : ""} awaiting your review.`;
      if (pTasks.length === 0 && pSubs.length === 0) resp += ` All caught up — no pending work.`;
      return resp;
    }
  }

  // ── At-risk / struggling players ──────────────────────────────────────
  if (txt.match(/\b(at.?risk|struggling|behind|falling behind|inactive|low|need help|who needs)\b/)) {
    const now = new Date();
    const atRisk = players.map(p => {
      const pTasks = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, p.id, p.cohort) && t.status === "open");
      const overdue = pTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;
      const completed = mockTasks.filter(t => t.submittedBy === p.id && (t.status === "approved" || t.status === "submitted")).length;
      return { name: p.brandName || p.name, id: p.id, overdue, xc: p.xcoin, completed, riskScore: overdue * 30 + (completed === 0 ? 40 : 0) + (p.xcoin < 100 ? 20 : 0) };
    }).filter(p => p.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);
    if (atRisk.length === 0) return "All players look on track — no one flagged as at-risk right now!";
    const top = atRisk.slice(0, 5);
    return `Players who may need support:\n${top.map(p => {
      const reasons: string[] = [];
      if (p.overdue > 0) reasons.push(`${p.overdue} overdue`);
      if (p.completed === 0) reasons.push("no completions yet");
      if (p.xc < 100) reasons.push("low XC");
      return `• ${p.name} — ${reasons.join(", ")}`;
    }).join("\n")}\n\nConsider reaching out or adjusting deadlines for these players.`;
  }

  // ── Class / cohort insights ───────────────────────────────────────────
  if (txt.match(/\b(class|cohort|group|engagement|participation|activity)\b/)) {
    const totalXC = players.reduce((s, u) => s + u.xcoin, 0);
    const avgXC = Math.round(totalXC / (players.length || 1));
    const totalCompleted = mockTasks.filter(t => t.status === "approved").length;
    const totalOpen = openTasks.length;
    const overdueAll = mockTasks.filter(t => t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    return `Class insights:\n• ${players.length} active players, avg ${avgXC.toLocaleString()} XC\n• ${totalCompleted} tasks completed, ${totalOpen} still open\n• ${overdueAll} overdue across all players\n• ${pending.length} submissions awaiting your review\n\nSay "at-risk" to see which players need attention, or "top players" for the leaderboard.`;
  }

  // ── Advice on how to run the program ──────────────────────────────────
  if (txt.match(/\b(tips|advice|best practice|how should i|recommend|suggest|strategy|coaching)\b/)) {
    let tips = "Host coaching tips:\n\n";
    if (pending.length > 3) tips += `• ⚠️ You have ${pending.length} pending reviews — try to review within 24-48hrs to keep players motivated.\n`;
    if (pending.length === 0) tips += `• ✅ All submissions reviewed — great job staying on top of approvals!\n`;
    const overdueTotal = mockTasks.filter(t => t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    if (overdueTotal > 3) tips += `• ${overdueTotal} tasks are overdue across players — consider extending deadlines or sending reminders.\n`;
    tips += `• Review the leaderboard weekly to celebrate top performers.\n`;
    tips += `• Use checkpoint milestones to create natural momentum.\n`;
    tips += `• Balance high-XC tasks with quick wins to keep all players engaged.\n`;
    tips += `• Check "at-risk" players regularly to intervene early.`;
    return tips;
  }

  if (txt.match(/\b(help|what can you do|commands?)\b/)) {
    return `I can help with:\n\n📋 Submissions: "analyze submissions", "pending approvals", "approve all"\n👥 Players: "check on [name]", "at-risk players", "top players"\n📊 Insights: "overview", "class insights", "economy"\n🎯 Management: "coaching tips", "open tasks", "checkpoints", "season"\n🧭 Navigate: "go to [approvals/players/tasks/settings]"\n\nI analyze submissions with AI scoring and can give approve/reject recommendations!`;
  }
  if (txt.match(/^(hi|hello|hey|good)\b/)) {
    const h=new Date().getHours();
    const g=h<12?"Good morning":h<17?"Good afternoon":"Good evening";
    const overdueTotal = mockTasks.filter(t => t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    let greeting = `${g}! I'm X-Bot, your PFLX assistant. ${pending.length} submission${pending.length!==1?"s":""} waiting for review.`;
    if (overdueTotal > 0) greeting += ` ⚠️ ${overdueTotal} tasks are overdue across your players.`;
    greeting += ` Say "analyze submissions" for AI recommendations, "at-risk" to check struggling players, or "help" for all commands!`;
    return greeting;
  }
  // ── Default — signal to call X-Bot AI ────────────────────────────────
  return null; // null = no regex match, use X-Bot AI
}

// ─── Gather host context for X-Bot ──────────────────────────────────────────
function gatherHostContext() {
  const players = mockUsers.filter(u => u.role === "player");
  const pending = mockTasks.filter(t => t.status === "submitted");
  const openTasks = mockTasks.filter(t => t.status === "open");
  const approvedTasks = mockTasks.filter(t => t.status === "approved");
  const overdue = mockTasks.filter(t => t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date());
  const activeSeason = mockGamePeriods.find(g => g.isActive);
  const activeCheckpoints = mockCheckpoints.filter(c => c.status === "active");
  const totalXC = players.reduce((s, u) => s + u.xcoin, 0);
  const topPlayers = [...players].sort((a, b) => b.xcoin - a.xcoin).slice(0, 5);

  return {
    totalPlayers: players.length,
    totalXCInEconomy: totalXC,
    avgXCPerPlayer: Math.round(totalXC / (players.length || 1)),
    pendingSubmissions: pending.length,
    pendingDetails: pending.slice(0, 5).map(t => {
      const p = players.find(u => u.id === t.submittedBy);
      return { task: t.title, player: p?.brandName || p?.name || "Unknown", submittedAt: t.submittedAt };
    }),
    openTasks: openTasks.length,
    completedTasks: approvedTasks.length,
    overdueAcrossPlayers: overdue.length,
    topPlayers: topPlayers.map(p => ({ name: p.brandName || p.name, xc: p.xcoin, level: p.level, badges: p.digitalBadges })),
    atRiskPlayers: players.filter(p => {
      const pOverdue = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, p.id, p.cohort) && t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
      return pOverdue > 0 || p.xcoin < 100;
    }).slice(0, 5).map(p => ({ name: p.brandName || p.name, xc: p.xcoin })),
    activeSeason: activeSeason?.title || "none",
    activeCheckpoints: activeCheckpoints.map(c => c.name),
    openJobs: mockJobs ? mockJobs.filter(j => j.status === "open").length : 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id:"welcome", role:"assistant", time: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
    text:`Hey! I'm X-Bot, your PFLX assistant. I can analyze pending submissions and give you approve/reject recommendations — just say "analyze submissions". I also support voice control 🎤`,
  }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<{ task: Task; index: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setVoiceSupported(!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);
  useEffect(() => { if (open) setTimeout(()=>inputRef.current?.focus(),150); }, [open]);

  const addMessage = useCallback((msg: Omit<Message,"id"|"time">) => {
    setMessages(prev=>[...prev,{...msg,id:`m-${Date.now()}-${Math.random()}`,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
  },[]);

  // ── Approve / reject from card ───────────────────────────────────────────
  const handleApproveFromCard = useCallback((taskId: string) => {
    const idx = mockTasks.findIndex(t=>t.id===taskId);
    if (idx!==-1) {
      const task = mockTasks[idx];
      mockTasks[idx].status="approved";
      const pl = mockUsers.find(u=>u.id===task.submittedBy);
      if(pl){pl.xcoin+=task.xcReward;pl.totalXcoin+=task.xcReward;mockTransactions.push({id:`tx-${Date.now()}`,userId:pl.id,type:"earned",amount:task.xcReward,currency:"xcoin",description:`Task Approved: ${task.title}`,createdAt:new Date().toISOString().split("T")[0]});}
      addMessage({role:"assistant",text:`✅ "${task.title}" approved! +${task.xcReward} XC credited to ${pl?.name??"player"}.`});
      if(voiceOn) speak(`Approved. ${task.xcReward} XC credited.`);
    }
  },[addMessage,voiceOn]);

  const handleRejectFromCard = useCallback((taskId: string) => {
    const idx = mockTasks.findIndex(t=>t.id===taskId);
    if (idx!==-1) {
      mockTasks[idx].status="rejected";
      addMessage({role:"assistant",text:`❌ "${mockTasks[idx].title}" sent back for resubmission.`});
      if(voiceOn) speak("Submission sent back for resubmission.");
    }
  },[addMessage,voiceOn]);

  // ── Analyze single submission ────────────────────────────────────────────
  const analyzeSubmission = useCallback(async (task: Task) => {
    setIsTyping(true);
    const player = mockUsers.find(u=>u.id===task.submittedBy);
    const analysis = await analyzeTask(task);
    setIsTyping(false);
    const voiceSnippet = `${task.title}: score ${analysis.score}, recommendation: ${analysis.recommendation}.`;
    addMessage({
      role:"assistant",
      text: analysis.source==="xbot" ? "🤖 X-Bot analysis complete:" : "📊 Analysis complete:",
      card:{ type:"submission_review", task, playerName:player?.name??"Unknown", analysis },
    });
    if(voiceOn) speak(voiceSnippet);
  },[addMessage,voiceOn]);

  // ── Process text input ───────────────────────────────────────────────────
  const processInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    addMessage({role:"user",text});
    setInput("");
    const txt = text.toLowerCase();

    // Analyze submissions command
    if (txt.match(/\banalyz[e]?\b.*\bsubmission|review.*submission|check.*submission|submission.*review/)) {
      const pending = mockTasks.filter(t=>t.status==="submitted");
      if (!pending.length) {
        setIsTyping(true);
        setTimeout(()=>{setIsTyping(false);addMessage({role:"assistant",text:"No pending submissions to analyze right now!"});},400);
        return;
      }
      addMessage({role:"assistant",text:`Found ${pending.length} pending submission${pending.length!==1?"s":""} — analyzing now...`});
      // Analyze them one by one with slight delay for UX
      for (let i=0;i<pending.length;i++) {
        await new Promise(r=>setTimeout(r,i===0?300:600));
        await analyzeSubmission(pending[i]);
      }
      addMessage({role:"assistant",text:`Analysis complete. Use the Approve / Reject buttons above, or say "approve all" to bulk-approve.`});
      return;
    }

    // Analyze specific task by name
    const analyzeMatch = txt.match(/analyz[e]?\s+["']?(.+?)["']?\s*$/);
    if (analyzeMatch) {
      const query = analyzeMatch[1].trim();
      const task = mockTasks.find(t=>t.status==="submitted"&&t.title.toLowerCase().includes(query));
      if(task){ await analyzeSubmission(task); return; }
    }

    // Try local regex handlers first
    const localResponse = buildTextResponse(text, router);
    if (localResponse !== null) {
      setIsTyping(true);
      setTimeout(()=>{
        setIsTyping(false);
        addMessage({role:"assistant",text:localResponse});
        if(voiceOn) speak(localResponse);
      },400);
      return;
    }

    // No local match — call X-Bot AI
    setIsTyping(true);
    try {
      const context = gatherHostContext();
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, role: "host", context }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsTyping(false);
        addMessage({role:"assistant",text:data.reply});
        if(voiceOn) speak(data.reply);
        return;
      }
      // Handle specific error types from API
      const errData = await res.json().catch(() => ({ error: "unknown" }));
      setIsTyping(false);
      if (errData.error === "rate_limited") {
        addMessage({role:"assistant",text:`I'm getting a lot of requests right now! Give me about 30 seconds and try again. In the meantime, try "analyze submissions", "at-risk", or "help" for quick answers.`});
      } else if (errData.error === "api_key_invalid") {
        addMessage({role:"assistant",text:`X-Bot's AI connection needs to be reconfigured. Please check the API key in your environment settings. You can still use "analyze submissions", "at-risk", or "help" for quick answers!`});
      } else {
        addMessage({role:"assistant",text:`I hit a temporary issue — try again in a moment! You can also use "analyze submissions", "at-risk", or "help" for quick answers.`});
      }
      return;
    } catch (err) {
      console.error("[X-Bot] AI call failed:", err);
    }
    // Fallback (network error)
    setIsTyping(false);
    addMessage({role:"assistant",text:`Sorry, I'm having trouble connecting right now. Try "analyze submissions", "at-risk", or "help" for quick answers!`});
  },[addMessage,analyzeSubmission,router,voiceOn]);

  // ── Voice recognition ────────────────────────────────────────────────────
  const startListening = useCallback(()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR) return;
    const r=new SR(); recognitionRef.current=r;
    r.continuous=false; r.interimResults=false; r.lang="en-US";
    r.onstart=()=>setListening(true);
    r.onresult=(e:any)=>{setListening(false);processInput(e.results[0][0].transcript);};
    r.onerror=()=>setListening(false); r.onend=()=>setListening(false);
    r.start();
  },[processInput]);

  const stopListening=useCallback(()=>{recognitionRef.current?.stop();setListening(false);},[]);

  const pendingCount = mockTasks.filter(t=>t.status==="submitted").length;

  return (
    <>
      {/* FAB */}
      <div style={{position:"fixed",bottom:"28px",right:"28px",zIndex:9999}}>
        {pendingCount>0&&!open&&(
          <div style={{position:"absolute",inset:"-6px",borderRadius:"50%",border:"2px solid rgba(79,142,247,0.5)",animation:"pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite"}}/>
        )}
        <button onClick={()=>setOpen(o=>!o)} style={{width:"56px",height:"56px",borderRadius:"50%",background:open?"linear-gradient(135deg,#6d28d9,#4f8ef7)":"linear-gradient(135deg,#4f8ef7,#8b5cf6)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",boxShadow:"0 8px 32px rgba(79,142,247,0.4)",transition:"transform 0.2s",transform:open?"scale(1.05) rotate(15deg)":"scale(1)"}}>
          {open?"✕":"🤖"}
        </button>
        {pendingCount>0&&!open&&(
          <div style={{position:"absolute",top:"-4px",right:"-4px",width:"20px",height:"20px",borderRadius:"50%",background:"#ef4444",border:"2px solid #0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,color:"white"}}>{pendingCount}</div>
        )}
      </div>

      {/* Panel */}
      {open&&(
        <div style={{position:"fixed",bottom:"96px",right:"28px",zIndex:9998,width:"400px",maxHeight:"600px",background:"rgba(14,14,22,0.97)",backdropFilter:"blur(20px)",border:"1px solid rgba(79,142,247,0.25)",borderRadius:"24px",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.6)",overflow:"hidden"}}>

          {/* Header */}
          <div style={{padding:"16px 20px",background:"linear-gradient(135deg,rgba(79,142,247,0.12),rgba(139,92,246,0.12))",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"10px",background:"linear-gradient(135deg,#4f8ef7,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontSize:"14px",fontWeight:700,color:"#f0f0ff"}}>PFLX X-Bot</div>
              <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",gap:"5px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
                {pendingCount>0?`${pendingCount} pending review`:"All clear"}
                {" · "}
                <span style={{color:"rgba(79,142,247,0.7)"}}>X-Bot powered</span>
              </div>
            </div>
            {voiceSupported&&(
              <button onClick={()=>setVoiceOn(v=>!v)} title={voiceOn?"Disable voice":"Enable voice"} style={{padding:"6px 10px",borderRadius:"8px",border:"none",cursor:"pointer",background:voiceOn?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)",color:voiceOn?"#4ade80":"rgba(255,255,255,0.4)",fontSize:"14px"}}>
                {voiceOn?"🔊":"🔇"}
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"12px"}}>
            {messages.map(msg=>(
              <div key={msg.id} style={{display:"flex",flexDirection:msg.role==="user"?"row-reverse":"row",gap:"8px",alignItems:"flex-start"}}>
                {msg.role==="assistant"&&(
                  <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"linear-gradient(135deg,#4f8ef7,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,marginTop:"2px"}}>🤖</div>
                )}
                <div style={{maxWidth:"85%",display:"flex",flexDirection:"column",gap:"6px"}}>
                  <div style={{padding:"10px 14px",borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:msg.role==="user"?"linear-gradient(135deg,#4f8ef7,#6d28d9)":"rgba(255,255,255,0.06)",border:msg.role==="assistant"?"1px solid rgba(255,255,255,0.06)":"none",fontSize:"13px",color:"#f0f0ff",lineHeight:1.5}}>
                    {msg.text}
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginTop:"4px",textAlign:msg.role==="user"?"right":"left"}}>{msg.time}</div>
                  </div>
                  {msg.card&&(
                    <SubmissionCard
                      card={msg.card}
                      onApprove={()=>handleApproveFromCard(msg.card!.task.id)}
                      onReject={()=>handleRejectFromCard(msg.card!.task.id)}
                    />
                  )}
                </div>
              </div>
            ))}
            {isTyping&&(
              <div style={{display:"flex",gap:"8px",alignItems:"flex-end"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"linear-gradient(135deg,#4f8ef7,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px"}}>🤖</div>
                <div style={{padding:"12px 16px",borderRadius:"16px 16px 16px 4px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:"4px",alignItems:"center"}}>
                  {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4f8ef7",animation:`typing-dot 1.2s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick chips */}
          <div style={{padding:"0 12px 8px",display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {["Analyze submissions","At-risk players","Coaching tips","Class insights","Help"].map(cmd=>(
              <button key={cmd} onClick={()=>processInput(cmd)} style={{padding:"4px 10px",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.5)",fontSize:"11px",cursor:"pointer"}}>
                {cmd}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:"8px",alignItems:"center"}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&processInput(input)} placeholder={listening?"Listening…":"Ask me anything…"} style={{flex:1,padding:"10px 14px",borderRadius:"12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${listening?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"}`,color:"#f0f0ff",fontSize:"13px",outline:"none"}}/>
            {voiceSupported&&(
              <button onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening} title="Hold to speak" style={{width:"40px",height:"40px",borderRadius:"10px",border:"none",cursor:"pointer",background:listening?"rgba(239,68,68,0.8)":"rgba(255,255,255,0.08)",color:listening?"white":"rgba(255,255,255,0.5)",fontSize:"16px",flexShrink:0,animation:listening?"mic-pulse 0.8s ease-in-out infinite":"none"}}>🎤</button>
            )}
            <button onClick={()=>processInput(input)} disabled={!input.trim()} style={{width:"40px",height:"40px",borderRadius:"10px",border:"none",cursor:"pointer",background:input.trim()?"linear-gradient(135deg,#4f8ef7,#8b5cf6)":"rgba(255,255,255,0.06)",color:"white",fontSize:"16px",flexShrink:0}}>↑</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring{0%{transform:scale(1);opacity:0.8}50%{transform:scale(1.15);opacity:0.3}100%{transform:scale(1);opacity:0.8}}
        @keyframes typing-dot{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-4px);opacity:1}}
        @keyframes mic-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
      `}</style>
    </>
  );
}
