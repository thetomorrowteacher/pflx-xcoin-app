"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../components/SideNav";
import { mergePlayerStats } from "../lib/playerStats";
import {
  User, mockUsers, mockTransactions, Transaction,
  mockGamePeriods, GamePeriod,
  getCurrentRank, PFLXRank,
  mockTasks, Task,
  mockJobs, Job,
  mockCheckpoints, Checkpoint,
  mockProjects, Project,
  isAssignedToPlayer,
  mockStartupStudios,
  mockStudioInvestments,
  getStudioMaxStakePercent,
} from "../lib/data";

// ─── Studio logo helper ───────────────────────────────────────────────────────
function StudioLogo({ studioId, icon, color, colorRgb, size = 56 }: {
  studioId: string; icon: string; color: string; colorRgb: string; size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const slug = studioId.replace("studio-", "");
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.22)}px`,
      flexShrink: 0, overflow: "hidden",
      background: `rgba(${colorRgb},0.85)`,
      border: `1.5px solid rgba(${colorRgb},0.5)`,
      boxShadow: `0 0 20px rgba(${colorRgb},0.35)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {imgFailed ? (
        <span style={{ fontSize: `${Math.round(size * 0.46)}px` }}>{icon}</span>
      ) : (
        <img
          src={`/studio-${slug}.png`}
          alt={studioId}
          onError={() => setImgFailed(true)}
          style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      )}
    </div>
  );
}

export default function PlayerHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeSeason, setActiveSeason] = useState<GamePeriod | null>(null);
  const [currentRank, setCurrentRank] = useState<PFLXRank | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [dailyReport, setDailyReport] = useState<string>("");
  const [dailyChecklist, setDailyChecklist] = useState<{ item: string; done: boolean }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    try {
      let u = JSON.parse(stored) as User;
      if (u.role !== "player") { router.push("/admin"); return; }
      if (!u.onboardingComplete) { router.push("/diagnostic"); return; }

      // Merge with live mockUsers to pick up any admin changes this session
      const fresh = mockUsers.find(mu => mu.id === u.id);
      if (fresh) {
        u.xcoin = fresh.xcoin;
        u.totalXcoin = fresh.totalXcoin;
        u.digitalBadges = fresh.digitalBadges;
        u.level = fresh.level;
        u.rank = fresh.rank;
        if (fresh.studioId) u.studioId = fresh.studioId;
        if (fresh.diagnosticResult) u.diagnosticResult = fresh.diagnosticResult;
        if (fresh.diagnosticComplete !== undefined) u.diagnosticComplete = fresh.diagnosticComplete;
      }

      // Also merge persisted stats (survives refresh, works cross-route)
      u = mergePlayerStats(u);

      // Write merged state back so pflx_user stays current
      localStorage.setItem("pflx_user", JSON.stringify(u));
      setUser(u);
      setTransactions(mockTransactions.filter(t => t.userId === u.id).slice().reverse().slice(0, 8));
      setActiveSeason(mockGamePeriods.find(p => p.isActive) ?? mockGamePeriods[0] ?? null);
      setCurrentRank(getCurrentRank(u.totalXcoin, u));
      setMyTasks(mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, u.id, u.cohort)).slice(0, 3));
      setMyJobs(mockJobs.filter(j => isAssignedToPlayer(j.assignedTo, u.id, u.cohort)).slice(0, 3));
    } catch {
      router.push("/");
    }
  }, [router]);

  // Fetch X-Bot daily report
  const fetchDailyReport = useCallback(async (u: User) => {
    setReportLoading(true);
    setReportError("");
    try {
      const playerTasks = mockTasks.filter(t => isAssignedToPlayer(t.assignedTo, u.id, u.cohort));
      const playerJobs = mockJobs.filter(j => isAssignedToPlayer(j.assignedTo, u.id, u.cohort));
      const activeCP = mockCheckpoints.find(c => c.status === "active");
      const mode = u.workEthicMode || "medium";

      const taskSummary = playerTasks.slice(0, 10).map(t =>
        `- "${t.title}" (${t.status}, ${t.xcReward}XC${t.dueDate ? `, due ${t.dueDate}` : ""})`
      ).join("\n");
      const jobSummary = playerJobs.slice(0, 5).map(j =>
        `- "${j.title}" (${j.status}, ${j.xcReward}XC)`
      ).join("\n");
      const cpSummary = activeCP ? `Active Checkpoint: "${activeCP.name}" (ends ${activeCP.endDate})` : "No active checkpoint";

      const prompt = `You are X-Bot, the PFLX game assistant. Generate a brief daily report for player "${u.brandName || u.name}".

Work Ethic Mode: ${mode.toUpperCase()}
${mode === "high" ? "Give detailed micro-tasks, aggressive action items, and tight deadlines. Be intense and motivating." : mode === "low" ? "Give high-level guidance, relaxed suggestions, focus on big picture. Be encouraging." : "Give balanced, actionable suggestions with weekly milestones."}

Player Stats: ${u.totalXcoin} lifetime XC, ${u.xcoin} spendable XC, ${u.digitalBadges} badges, Rank ${u.rank}
${cpSummary}

Current Tasks:
${taskSummary || "None assigned"}

Current Jobs:
${jobSummary || "None available"}

Return ONLY valid JSON with this exact format (no markdown, no code blocks):
{"report":"A 2-3 sentence daily briefing about their progress and priorities","checklist":["Action item 1","Action item 2","Action item 3","Action item 4","Action item 5"]}`;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      if (!res.ok) throw new Error("Gemini API error");
      const data = await res.json();
      const text = (data.response || data.reply || "").trim();
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setDailyReport(parsed.report || "");
        setDailyChecklist((parsed.checklist || []).map((item: string) => ({ item, done: false })));
      } else {
        setDailyReport(text.slice(0, 300));
        setDailyChecklist([]);
      }
    } catch (err: any) {
      setReportError("Could not load daily report. Check back later.");
      console.error("[gemini-report]", err);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // Auto-fetch daily report on mount
  useEffect(() => {
    if (user && !dailyReport && !reportLoading) {
      fetchDailyReport(user);
    }
  }, [user, dailyReport, reportLoading, fetchDailyReport]);

  if (!user) return null;

  const xpProgress = user.totalXcoin > 0 ? Math.min((user.totalXcoin % 1000) / 1000, 1) : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto", paddingBottom: "60px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>🏠 PLAYER HOME</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
            [ YOUR PFLX DASHBOARD & ACTIVITY FEED ]
          </p>
        </div>

        {/* Active Season Banner */}
        {activeSeason && (
          <div style={{
            marginBottom: "28px", borderRadius: "18px", overflow: "hidden",
            background: activeSeason.image
              ? `linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4)), url(${activeSeason.image}) center/cover`
              : "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.12))",
            border: "1px solid rgba(0,212,255,0.2)",
            padding: "20px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "rgba(0,212,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
                {activeSeason.isActive ? "🟢 ACTIVE SEASON" : "UPCOMING SEASON"}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#f0f0ff", marginBottom: "4px" }}>
                {activeSeason.title}
              </div>
              {activeSeason.endDate && (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                  Ends {new Date(activeSeason.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
            <div style={{
              padding: "10px 18px", borderRadius: "12px",
              background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em"
            }}>
              SEASON ACTIVE
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "28px" }}>
          {[
            { label: "Digital Badges", value: user.digitalBadges.toLocaleString(), color: "#f5c842", icon: "🏅" },
            { label: "XC Balance", value: user.xcoin.toLocaleString(), color: "#4f8ef7", icon: "⚡" },
            { label: "Total XC Earned", value: user.totalXcoin.toLocaleString(), color: "#a78bfa", icon: "💎" },
            { label: "Evo Rank", value: currentRank?.name ?? `LV.${user.level}`, color: "#00d4ff", icon: currentRank?.icon ?? "🌱" },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: "18px", borderRadius: "16px",
              background: "rgba(22,22,31,0.6)", border: `1px solid ${stat.color}22`,
              display: "flex", flexDirection: "column", gap: "6px"
            }}>
              <span style={{ fontSize: "18px" }}>{stat.icon}</span>
              <span style={{ fontSize: "22px", fontWeight: 900, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Evo Rank Progress */}
        {currentRank && (
          <div style={{
            marginBottom: "28px", padding: "20px 24px", borderRadius: "16px",
            background: "rgba(22,22,31,0.6)", border: "1px solid rgba(0,212,255,0.12)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,212,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "3px" }}>Evo Rank Progress</div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#f0f0ff" }}>{currentRank.icon} {currentRank.name}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>XC to next rank</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#00d4ff" }}>{Math.max(0, currentRank.xcoinUnlock + 1000 - user.totalXcoin).toLocaleString()} XC</div>
              </div>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "3px",
                width: `${Math.min(xpProgress * 100, 100)}%`,
                background: "linear-gradient(90deg, #00d4ff, #a78bfa)",
                transition: "width 0.5s ease"
              }} />
            </div>
          </div>
        )}

        {/* ── AI Daily Report & Checklist ── */}
        <div style={{
          marginBottom: "28px", borderRadius: "18px", overflow: "hidden",
          background: "rgba(22,22,31,0.8)",
          border: "1px solid rgba(167,139,250,0.25)",
          boxShadow: "0 0 28px rgba(167,139,250,0.08)",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, #a78bfa, #4f8ef7, transparent)" }} />
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>🤖</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#f0f0ff", letterSpacing: "0.04em" }}>DAILY BRIEFING</div>
                  <div style={{ fontSize: "10px", color: "rgba(167,139,250,0.6)", letterSpacing: "0.08em" }}>
                    POWERED BY X-BOT · {(user.workEthicMode || "medium").toUpperCase()} MODE
                  </div>
                </div>
              </div>
              <button onClick={() => fetchDailyReport(user)} disabled={reportLoading}
                style={{ padding: "6px 14px", borderRadius: "8px", cursor: reportLoading ? "default" : "pointer",
                  background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                  color: "#a78bfa", fontSize: "11px", fontWeight: 700, opacity: reportLoading ? 0.5 : 1 }}>
                {reportLoading ? "Loading…" : "🔄 Refresh"}
              </button>
            </div>

            {/* Report text */}
            {reportLoading ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px", animation: "pulse 1.5s infinite" }}>🤖</div>
                <p style={{ margin: 0, fontSize: "12px", color: "rgba(167,139,250,0.5)" }}>Generating your daily report...</p>
              </div>
            ) : reportError ? (
              <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>{reportError}</p>
              </div>
            ) : (
              <>
                {dailyReport && (
                  <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.12)", marginBottom: "14px" }}>
                    <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{dailyReport}</p>
                  </div>
                )}

                {/* Checklist */}
                {dailyChecklist.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Today's Action Items</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {dailyChecklist.map((item, i) => (
                        <button key={i} onClick={() => {
                          setDailyChecklist(prev => prev.map((c, j) => j === i ? { ...c, done: !c.done } : c));
                        }} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                          background: item.done ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${item.done ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
                          textAlign: "left", width: "100%",
                          transition: "all 0.15s",
                        }}>
                          <span style={{
                            width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: item.done ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                            border: `1px solid ${item.done ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
                            fontSize: "12px", color: item.done ? "#22c55e" : "transparent",
                          }}>✓</span>
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            color: item.done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)",
                            textDecoration: item.done ? "line-through" : "none",
                            flex: 1,
                          }}>{item.item}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: "10px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: "rgba(167,139,250,0.5)", fontWeight: 700 }}>
                        {dailyChecklist.filter(c => c.done).length}/{dailyChecklist.length} completed
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Startup Studio Card */}
        {(() => {
          const studio = mockStartupStudios.find(s => s.id === user.studioId);
          if (!studio) return null;
          const activeStake = mockStudioInvestments.find(i => i.userId === user.id && i.studioId === studio.id && i.status === "active");
          const maxStakePct = getStudioMaxStakePercent(getCurrentRank(user.totalXcoin, user).level);
          return (
            <div style={{
              marginBottom: "28px", borderRadius: "18px", padding: "22px 24px",
              background: `rgba(${studio.colorRgb},0.07)`,
              border: `1px solid rgba(${studio.colorRgb},0.35)`,
              boxShadow: `0 0 28px rgba(${studio.colorRgb},0.1)`,
              position: "relative", overflow: "hidden",
            }}>
              {/* Accent line top */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, rgba(${studio.colorRgb},0.7), transparent)` }} />
              {/* Bracket corners */}
              <div style={{ position: "absolute", top: "10px", left: "10px", width: "12px", height: "12px", borderTop: `2px solid rgba(${studio.colorRgb},0.6)`, borderLeft: `2px solid rgba(${studio.colorRgb},0.6)` }} />
              <div style={{ position: "absolute", top: "10px", right: "10px", width: "12px", height: "12px", borderTop: `2px solid rgba(${studio.colorRgb},0.6)`, borderRight: `2px solid rgba(${studio.colorRgb},0.6)` }} />
              <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "12px", height: "12px", borderBottom: `2px solid rgba(${studio.colorRgb},0.6)`, borderLeft: `2px solid rgba(${studio.colorRgb},0.6)` }} />
              <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "12px", height: "12px", borderBottom: `2px solid rgba(${studio.colorRgb},0.6)`, borderRight: `2px solid rgba(${studio.colorRgb},0.6)` }} />

              <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                {/* Logo */}
                <StudioLogo studioId={studio.id} icon={studio.icon} color={studio.color} colorRgb={studio.colorRgb} size={72} />

                {/* Name + tagline */}
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: `rgba(${studio.colorRgb},0.6)`, marginBottom: "4px" }}>
                    ✦ YOUR STARTUP STUDIO
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    {studio.name}
                  </div>
                  <div style={{ fontSize: "12px", color: `rgba(${studio.colorRgb},0.75)`, fontStyle: "italic" }}>
                    {studio.tagline}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {[
                    { label: "XC POOL", value: `⚡ ${studio.xcPool.toLocaleString()}`, color: studio.color },
                    { label: "MAX STAKE", value: `📈 ${maxStakePct}%`, color: "#4ade80" },
                    { label: "TAX RATE", value: `💼 ${studio.corporateTaxRate}%`, color: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: `rgba(${studio.colorRgb},0.07)`,
                      border: `1px solid rgba(${studio.colorRgb},0.15)`,
                      borderRadius: "10px", padding: "10px 14px", textAlign: "center", minWidth: "80px",
                    }}>
                      <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
                      <p style={{ margin: 0, fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 700 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active stake row */}
              {activeStake && (
                <div style={{
                  marginTop: "14px", paddingTop: "12px",
                  borderTop: `1px solid rgba(${studio.colorRgb},0.12)`,
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>ACTIVE STAKE</span>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>📈 {activeStake.stakeXC.toLocaleString()} XC</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>({activeStake.stakePercent}% of pool)</span>
                  <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "6px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "9px", fontWeight: 700, color: "#4ade80", letterSpacing: "0.08em" }}>
                    STAKED
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Active Checkpoint Card */}
        {(() => {
          const cp = mockCheckpoints.find(c => c.status === "active");
          if (!cp) return null;

          // Gather projects linked to this checkpoint
          const cpProjects = (cp.projectIds ?? [])
            .map(pid => mockProjects.find(p => p.id === pid))
            .filter(Boolean) as Project[];

          // Gather tasks directly on the checkpoint (not via project)
          const cpProjectTaskIds = new Set(cpProjects.flatMap(p => p.taskIds));
          const directTasks = mockTasks.filter(
            t => t.roundId === cp.id && !cpProjectTaskIds.has(t.id) && isAssignedToPlayer(t.assignedTo, user.id, user.cohort)
          );

          // Build display items: projects first, then direct tasks — max 3 shown
          type CpItem =
            | { kind: "project"; proj: Project }
            | { kind: "task";    task: Task };

          const items: CpItem[] = [
            ...cpProjects.map(p => ({ kind: "project" as const, proj: p })),
            ...directTasks.map(t => ({ kind: "task" as const, task: t })),
          ].slice(0, 3);

          const totalItems = cpProjects.length + directTasks.length;
          const daysLeft = Math.max(0, Math.ceil(
            (new Date(cp.endDate).getTime() - Date.now()) / 86400000
          ));
          const urgentColor = daysLeft <= 2 ? "#ef4444" : daysLeft <= 5 ? "#f59e0b" : "#4ade80";

          const taskStatusStyle = (status: string) => {
            if (status === "approved")  return { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)" };
            if (status === "submitted") return { color: "#f5c842", bg: "rgba(245,200,66,0.1)",  border: "rgba(245,200,66,0.25)" };
            if (status === "rejected")  return { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" };
            return                             { color: "#00d4ff", bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.2)" };
          };

          return (
            <div style={{
              marginBottom: "28px", borderRadius: "18px", padding: "22px 24px",
              background: "rgba(22,22,31,0.8)",
              border: "1px solid rgba(0,212,255,0.2)",
              boxShadow: "0 0 24px rgba(0,212,255,0.06)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Top accent line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, #00d4ff, #a78bfa, transparent)" }} />

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(0,212,255,0.5)", marginBottom: "4px" }}>
                    🏁 ACTIVE CHECKPOINT
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "#f0f0ff", letterSpacing: "0.02em" }}>
                    {cp.name}
                  </div>
                  {cp.description && (
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>
                      {cp.description}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  {/* Days left badge */}
                  <div style={{
                    padding: "5px 12px", borderRadius: "8px",
                    background: `rgba(${urgentColor === "#4ade80" ? "74,222,128" : urgentColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.1)`,
                    border: `1px solid ${urgentColor}44`,
                    fontSize: "11px", fontWeight: 800, color: urgentColor, fontFamily: "monospace",
                  }}>
                    ⏱ {daysLeft === 0 ? "Due today!" : `${daysLeft}d left`}
                  </div>
                  <div style={{
                    padding: "5px 12px", borderRadius: "8px",
                    background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                    fontSize: "11px", fontWeight: 700, color: "rgba(167,139,250,0.8)",
                  }}>
                    📋 {totalItems} item{totalItems !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Items list */}
              {items.length === 0 ? (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>
                  No tasks or projects in this checkpoint yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {items.map((item, i) => {
                    if (item.kind === "project") {
                      const p = item.proj;
                      const daysUntilDue = p.dueDate
                        ? Math.max(0, Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000))
                        : null;
                      return (
                        <div key={p.id} style={{
                          padding: "12px 14px", borderRadius: "12px",
                          background: "rgba(167,139,250,0.07)",
                          border: "1px solid rgba(167,139,250,0.2)",
                          display: "flex", alignItems: "center", gap: "12px",
                        }}>
                          <span style={{ fontSize: "16px", flexShrink: 0 }}>📁</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#e0e0ff", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p.title}
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(167,139,250,0.6)" }}>
                              📋 {p.taskIds.length} task{p.taskIds.length !== 1 ? "s" : ""}
                              {p.xcRewardPool ? ` · ⚡ ${p.xcRewardPool.toLocaleString()} XC pool` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                            {daysUntilDue !== null && (
                              <span style={{ fontSize: "10px", color: daysUntilDue <= 3 ? "#f59e0b" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>
                                {daysUntilDue === 0 ? "Due today" : `${daysUntilDue}d`}
                              </span>
                            )}
                            <span style={{
                              fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "5px",
                              background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                              color: "#a78bfa", letterSpacing: "0.08em",
                            }}>PROJECT</span>
                          </div>
                        </div>
                      );
                    } else {
                      const t = item.task;
                      const s = taskStatusStyle(t.status);
                      return (
                        <div key={t.id} style={{
                          padding: "12px 14px", borderRadius: "12px",
                          background: s.bg, border: `1px solid ${s.border}`,
                          display: "flex", alignItems: "center", gap: "12px",
                        }}>
                          <span style={{ fontSize: "16px", flexShrink: 0 }}>
                            {t.status === "approved" ? "✅" : t.status === "submitted" ? "📤" : t.status === "rejected" ? "❌" : "📝"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#e0e0ff", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                              ⚡ {t.xcReward} XC
                              {t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                            </div>
                          </div>
                          <span style={{
                            fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "5px",
                            background: s.bg, border: `1px solid ${s.border}`,
                            color: s.color, letterSpacing: "0.08em", textTransform: "uppercase",
                            flexShrink: 0,
                          }}>{t.status}</span>
                        </div>
                      );
                    }
                  })}
                </div>
              )}

              {/* Footer: show more + end date */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>
                  Ends {new Date(cp.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
                {totalItems > 3 && (
                  <button
                    onClick={() => router.push("/player/task-management")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "rgba(0,212,255,0.6)", letterSpacing: "0.06em" }}
                  >
                    +{totalItems - 3} more →
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Two-column: Tasks + Jobs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
          {/* Tasks preview */}
          <div style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#a78bfa", letterSpacing: "0.04em" }}>✅ My Tasks</div>
              <button
                onClick={() => router.push("/player/task-management")}
                style={{ background: "none", border: "none", color: "rgba(167,139,250,0.5)", fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
              >View All →</button>
            </div>
            {myTasks.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>No tasks assigned yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {myTasks.map(t => (
                  <div key={t.id} style={{
                    padding: "10px 12px", borderRadius: "10px",
                    background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#e0e0ff", marginBottom: "2px" }}>{t.title}</div>
                    <div style={{ fontSize: "11px", color: "rgba(167,139,250,0.6)" }}>⚡ +{t.xcReward} XC · {t.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jobs preview */}
          <div style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(245,200,66,0.2)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#f5c842", letterSpacing: "0.04em" }}>💼 Active Jobs</div>
              <button
                onClick={() => router.push("/player/jobs")}
                style={{ background: "none", border: "none", color: "rgba(245,200,66,0.5)", fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
              >View All →</button>
            </div>
            {myJobs.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>No jobs available yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {myJobs.map(j => (
                  <div key={j.id} style={{
                    padding: "10px 12px", borderRadius: "10px",
                    background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.15)"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#e0e0ff", marginBottom: "2px" }}>{j.title}</div>
                    <div style={{ fontSize: "11px", color: "rgba(245,200,66,0.6)" }}>⚡ +{j.xcReward} XC · {j.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", marginBottom: "14px" }}>📋 RECENT ACTIVITY</div>
          {transactions.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>No recent transactions.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {transactions.map(tx => {
                const isPositive = tx.type === "earned" || tx.type === "admin_grant";
                return (
                  <div key={tx.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: "10px",
                    background: isPositive ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
                    border: `1px solid ${isPositive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                  }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0ff" }}>{tx.description}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                        {new Date(tx.createdAt ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "13px", fontWeight: 800,
                      color: isPositive ? "#22c55e" : "#ef4444"
                    }}>
                      {isPositive ? "+" : "-"}{tx.amount} {tx.currency === "xcoin" ? "XC" : "🏅"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
