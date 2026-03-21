"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Task, Job, Checkpoint, GamePeriod, mockTasks, mockJobs, mockCheckpoints, mockGamePeriods, isAssignedToPlayer, SubmissionProof } from "../../lib/data";

type MainTab = "rounds" | "jobs" | "history";

interface ProofForm {
  taskId: string;
  linkUrl: string;
  fileName: string | null;
  note: string;
}

export default function PlayerTaskManagement() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("rounds");
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [rounds] = useState<Checkpoint[]>(mockCheckpoints);
  const [seasons] = useState<GamePeriod[]>(mockGamePeriods);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set(["round-1"]));
  const [proofForm, setProofForm] = useState<ProofForm | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    setUser(u);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleRound = (id: string) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openProof = (taskId: string) => {
    setProofForm({ taskId, linkUrl: "", fileName: null, note: "" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setProofForm(prev => prev ? { ...prev, fileName: file.name } : prev);
  };

  const handleSubmitProof = () => {
    if (!user || !proofForm) return;
    const { taskId, linkUrl, fileName, note } = proofForm;
    if (!linkUrl && !fileName) {
      showToast("Please add a link or upload a file as proof.", "error");
      return;
    }
    const proof: SubmissionProof = { linkUrl: linkUrl || undefined, fileUrl: fileName || undefined, note: note || undefined };
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: "submitted" as const, submittedBy: user.id, submittedAt: new Date().toISOString().split("T")[0], submissionProof: proof }
        : t
    ));
    setProofForm(null);
    showToast("Task submitted! Pending teacher review. 📤", "success");
  };

  const handleApplyJob = (jobId: string) => {
    if (!user) return;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, applicants: [...j.applicants, user.id] } : j));
    showToast("Application submitted! Waiting for teacher approval. 📤", "success");
  };

  if (!user) return null;

  // Active season for banner display
  const activeSeason = seasons.find(s => s.isActive) ?? null;

  // Filter by assignment
  const myTasks = tasks.filter(t => isAssignedToPlayer(t.assignedTo, user.id, user.cohort));
  const myJobs = jobs.filter(j => isAssignedToPlayer(j.assignedTo, user.id, user.cohort));

  // Active and upcoming rounds
  const activeRounds = rounds.filter(r =>
    isAssignedToPlayer(r.assignedTo, user.id, user.cohort) && (r.status === "active" || r.status === "upcoming")
  );
  // Past rounds
  const pastRounds = rounds.filter(r =>
    isAssignedToPlayer(r.assignedTo, user.id, user.cohort) && r.status === "completed"
  );

  const tasksForRound = (roundId: string) =>
    myTasks.filter(t => t.roundId === roundId);

  // Tasks NOT in any round (standalone)
  const unroundedTasks = myTasks.filter(t => !t.roundId && (t.status === "open" || t.submittedBy === user.id));

  const roundProgress = (roundId: string) => {
    const all = tasksForRound(roundId);
    const done = all.filter(t => t.status === "approved" || (t.status === "submitted" && t.submittedBy === user.id)).length;
    return { done, total: all.length };
  };

  const taskStatusMeta = (t: Task) => {
    if (t.status === "approved") return { color: "#22c55e", label: "✅ Approved", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" };
    if (t.status === "rejected") return { color: "#ef4444", label: "❌ Rejected", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };
    if (t.status === "submitted" && t.submittedBy === user.id) return { color: "#f97316", label: "⏳ Pending Review", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" };
    return null;
  };

  const openJobs = myJobs.filter(j => j.status === "open");
  const appliedJobs = myJobs.filter(j => j.applicants.includes(user.id));

  // Total open tasks across active rounds
  const totalOpen = myTasks.filter(t => t.status === "open" && t.submittedBy !== user.id).length;
  const totalOpenJobs = openJobs.length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />

      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        {toast && (
          <div style={{
            position: "fixed", top: "24px", right: "24px", zIndex: 9999,
            padding: "12px 20px", borderRadius: "12px",
            background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: "13px", fontWeight: 600, backdropFilter: "blur(10px)"
          }}>{toast.msg}</div>
        )}

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>📋 TASK MANAGEMENT</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ COMPLETE CHECKPOINTS AND APPLY FOR JOBS ]</p>
        </div>

        {/* Main Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", padding: "4px", width: "fit-content" }}>
          {[
            { key: "rounds" as MainTab, label: "🎯 Checkpoints", count: totalOpen },
            { key: "jobs" as MainTab, label: "💼 Jobs", count: totalOpenJobs },
            { key: "history" as MainTab, label: "🕐 History", count: pastRounds.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
              padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: mainTab === tab.key ? "rgba(245,200,66,0.12)" : "transparent",
              color: mainTab === tab.key ? "#f5c842" : "rgba(255,255,255,0.4)",
              fontSize: "13px", fontWeight: mainTab === tab.key ? 700 : 500,
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px",
            }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  padding: "2px 7px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                  background: mainTab === tab.key ? "rgba(245,200,66,0.2)" : "rgba(255,255,255,0.06)",
                  color: mainTab === tab.key ? "#f5c842" : "rgba(255,255,255,0.3)",
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── ROUNDS TAB ─── */}
        {mainTab === "rounds" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Season hero banner */}
            {activeSeason && (
              <div style={{
                width: "100%", borderRadius: "20px", overflow: "hidden", position: "relative",
                minHeight: activeSeason.image ? "180px" : "72px",
                background: activeSeason.image ? "transparent" : "rgba(245,200,66,0.06)",
                border: "1px solid rgba(245,200,66,0.2)"
              }}>
                {activeSeason.image && (
                  <img src={activeSeason.image} alt={activeSeason.title}
                    style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }} />
                )}
                <div style={{
                  position: activeSeason.image ? "absolute" : "relative",
                  bottom: 0, left: 0, right: 0,
                  padding: "16px 22px",
                  background: activeSeason.image
                    ? "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)"
                    : "transparent",
                  display: "flex", alignItems: "center", gap: "12px"
                }}>
                  <span style={{ fontSize: "20px" }}>🗓️</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "#f5c842", textTransform: "uppercase", letterSpacing: "0.08em" }}>Current Season</p>
                    <p style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#fff" }}>{activeSeason.title}</p>
                    {activeSeason.durationString && <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>{activeSeason.durationString}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Active / Upcoming Rounds */}
            {activeRounds.map(round => {
              const { done, total } = roundProgress(round.id);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isExpanded = expandedRounds.has(round.id);
              const roundTasks = tasksForRound(round.id);

              return (
                <div key={round.id} style={{
                  background: "rgba(22,22,31,0.8)",
                  border: `1px solid ${round.status === "active" ? "rgba(245,200,66,0.2)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "20px", overflow: "hidden"
                }}>
                  {/* Round Banner Image */}
                  {round.bannerImage && (
                    <div style={{ position: "relative", height: "140px", overflow: "hidden" }}>
                      <img src={round.bannerImage} alt={round.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(10,10,15,0.85) 0%, rgba(10,10,15,0.1) 60%, transparent 100%)"
                      }} />
                      <div style={{ position: "absolute", bottom: "12px", left: "20px", right: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                          background: round.status === "active" ? "rgba(245,200,66,0.85)" : "rgba(255,255,255,0.15)",
                          color: round.status === "active" ? "#000" : "rgba(255,255,255,0.8)",
                          backdropFilter: "blur(4px)"
                        }}>{round.status === "active" ? "🟢 Active" : "🔜 Upcoming"}</span>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{round.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Round Header */}
                  <div
                    onClick={() => toggleRound(round.id)}
                    style={{ padding: round.bannerImage ? "14px 24px" : "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px" }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: round.bannerImage ? "2px" : "6px" }}>
                        {!round.bannerImage && (
                          <span style={{
                            padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                            background: round.status === "active" ? "rgba(245,200,66,0.12)" : "rgba(255,255,255,0.06)",
                            color: round.status === "active" ? "#f5c842" : "rgba(255,255,255,0.3)",
                            border: `1px solid ${round.status === "active" ? "rgba(245,200,66,0.25)" : "rgba(255,255,255,0.08)"}`
                          }}>{round.status === "active" ? "🟢 Active" : "🔜 Upcoming"}</span>
                        )}
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                          {round.startDate} → {round.endDate}
                        </span>
                      </div>
                      {!round.bannerImage && <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 800, color: "#f0f0ff" }}>{round.name}</h2>}
                      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{round.description}</p>
                    </div>

                    {/* Progress */}
                    <div style={{ textAlign: "right", minWidth: "100px" }}>
                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                        {done}/{total} COMPLETE
                      </p>
                      <div style={{ width: "100px", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22c55e" : "linear-gradient(90deg,#f5c842,#f0a020)", borderRadius: "3px", transition: "width 0.4s" }} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "10px", color: pct === 100 ? "#22c55e" : "rgba(255,255,255,0.2)" }}>{pct}%</p>
                    </div>

                    <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.2)", marginLeft: "8px" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* Task Cards */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px 24px" }}>
                      {roundTasks.length === 0 ? (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", fontStyle: "italic" }}>No tasks in this checkpoint yet.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                          {roundTasks.map(t => {
                            const meta = taskStatusMeta(t);
                            const isSubmittedByMe = t.submittedBy === user.id;
                            const isOpen = t.status === "open" && !isSubmittedByMe;
                            const isProofOpen = proofForm?.taskId === t.id;

                            return (
                              <div key={t.id} style={{
                                background: "rgba(0,212,255,0.04)",
                                border: `1px solid ${meta ? meta.border : "rgba(0,212,255,0.18)"}`,
                                borderRadius: "16px", position: "relative",
                                boxShadow: "0 0 16px rgba(0,212,255,0.07), inset 0 0 16px rgba(0,212,255,0.03)",
                                transition: "all 0.3s ease"
                              }}>
                                <div style={{ position: "absolute", top: "7px", left: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                                <div style={{ position: "absolute", top: "7px", right: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                                <div style={{ position: "absolute", bottom: "7px", left: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                                <div style={{ position: "absolute", bottom: "7px", right: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                                <div style={{ padding: "16px" }}>
                                  {/* Category + Due */}
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                    <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: 700, background: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)" }}>{t.category}</span>
                                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>Due {t.dueDate}</span>
                                  </div>

                                  <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}>{t.title}</p>
                                  {t.description && <p style={{ margin: "0 0 12px", fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{t.description}</p>}

                                  {/* Rewards */}
                                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                                    <div style={{ flex: 1, background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.12)", borderRadius: "7px", padding: "6px", textAlign: "center" }}>
                                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#f5c842" }}>{t.rewardCoins.reduce((s, rc) => s + rc.amount, 0)} XC</p>
                                      <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>BADGES</p>
                                    </div>
                                    <div style={{ flex: 1, background: "rgba(79,142,247,0.07)", border: "1px solid rgba(79,142,247,0.12)", borderRadius: "7px", padding: "6px", textAlign: "center" }}>
                                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#4f8ef7" }}>⚡ {t.xcReward}</p>
                                      <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>XP</p>
                                    </div>
                                  </div>

                                  {/* Status or Submit button */}
                                  {meta ? (
                                    <div style={{ padding: "8px 12px", borderRadius: "8px", textAlign: "center", background: meta.bg, border: `1px solid ${meta.border}` }}>
                                      <span style={{ fontSize: "12px", fontWeight: 600, color: meta.color }}>{meta.label}</span>
                                      {t.submissionProof && (
                                        <p style={{ margin: "4px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                                          {t.submissionProof.linkUrl && `🔗 ${t.submissionProof.linkUrl.slice(0, 40)}…`}
                                          {t.submissionProof.fileUrl && ` 📎 ${t.submissionProof.fileUrl}`}
                                        </p>
                                      )}
                                    </div>
                                  ) : isOpen ? (
                                    <button
                                      onClick={() => openProof(t.id)}
                                      style={{
                                        width: "100%", padding: "9px", borderRadius: "8px",
                                        border: "1px solid rgba(245,200,66,0.25)",
                                        background: isProofOpen ? "rgba(245,200,66,0.15)" : "rgba(245,200,66,0.1)",
                                        color: "#f5c842", fontSize: "12px", fontWeight: 700, cursor: "pointer"
                                      }}
                                    >{isProofOpen ? "✏️ Editing Proof" : "📤 Submit Task"}</button>
                                  ) : null}
                                </div>

                                {/* Inline Proof Panel */}
                                {isProofOpen && proofForm && (
                                  <div style={{ borderTop: "1px solid rgba(245,200,66,0.15)", padding: "14px 16px", background: "rgba(245,200,66,0.03)" }}>
                                    <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 700, color: "rgba(245,200,66,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Add Proof of Work</p>

                                    {/* Link field */}
                                    <div style={{ marginBottom: "10px" }}>
                                      <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" }}>🔗 Link (Google Doc, Canva, YouTube…)</label>
                                      <input
                                        type="url"
                                        placeholder="https://"
                                        value={proofForm.linkUrl}
                                        onChange={e => setProofForm(prev => prev ? { ...prev, linkUrl: e.target.value } : prev)}
                                        className="input-field"
                                        style={{ fontSize: "12px", padding: "8px 12px" }}
                                      />
                                    </div>

                                    {/* File upload */}
                                    <div style={{ marginBottom: "10px" }}>
                                      <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" }}>📎 File Upload</label>
                                      <label style={{
                                        display: "flex", alignItems: "center", gap: "8px",
                                        padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
                                        background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)",
                                        color: proofForm.fileName ? "#22c55e" : "rgba(255,255,255,0.3)", fontSize: "12px"
                                      }}>
                                        <input type="file" style={{ display: "none" }} onChange={handleFileChange} />
                                        {proofForm.fileName ? `✓ ${proofForm.fileName}` : "Choose file…"}
                                      </label>
                                    </div>

                                    {/* Note */}
                                    <div style={{ marginBottom: "12px" }}>
                                      <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" }}>📝 Note (optional)</label>
                                      <textarea
                                        placeholder="Add context for your teacher…"
                                        value={proofForm.note}
                                        onChange={e => setProofForm(prev => prev ? { ...prev, note: e.target.value } : prev)}
                                        className="input-field"
                                        style={{ fontSize: "12px", padding: "8px 12px", minHeight: "56px", resize: "vertical" }}
                                      />
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button onClick={() => setProofForm(null)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>Cancel</button>
                                      <button onClick={handleSubmitProof} style={{ flex: 2, padding: "8px", borderRadius: "8px", border: "none", background: "#f5c842", color: "#000", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Submit for Review ✓</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unrounded / standalone tasks */}
            {unroundedTasks.length > 0 && (
              <div style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px", padding: "20px 24px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>📌 Standalone Tasks</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                  {unroundedTasks.map(t => {
                    const meta = taskStatusMeta(t);
                    const isOpen = t.status === "open" && t.submittedBy !== user.id;
                    const isProofOpen = proofForm?.taskId === t.id;
                    return (
                      <div key={t.id} style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "16px", position: "relative", boxShadow: "0 0 16px rgba(0,212,255,0.07), inset 0 0 16px rgba(0,212,255,0.03)", transition: "all 0.3s ease" }}>
                        <div style={{ position: "absolute", top: "7px", left: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", top: "7px", right: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", bottom: "7px", left: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", bottom: "7px", right: "7px", width: "12px", height: "12px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                        <div style={{ padding: "16px" }}>
                          <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}>{t.title}</p>
                          {t.description && <p style={{ margin: "0 0 12px", fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{t.description}</p>}
                          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                            <span style={{ padding: "4px 10px", borderRadius: "7px", fontSize: "13px", fontWeight: 800, color: "#f5c842", background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.12)" }}>{t.rewardCoins.reduce((s, rc) => s + rc.amount, 0)} XC</span>
                            <span style={{ padding: "4px 10px", borderRadius: "7px", fontSize: "13px", fontWeight: 800, color: "#4f8ef7", background: "rgba(79,142,247,0.07)", border: "1px solid rgba(79,142,247,0.12)" }}>⚡ {t.xcReward} XC</span>
                          </div>
                          {meta ? (
                            <div style={{ padding: "8px 12px", borderRadius: "8px", textAlign: "center", background: meta.bg, border: `1px solid ${meta.border}` }}>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: meta.color }}>{meta.label}</span>
                            </div>
                          ) : isOpen ? (
                            <button onClick={() => openProof(t.id)} style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid rgba(245,200,66,0.25)", background: "rgba(245,200,66,0.1)", color: "#f5c842", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>📤 Submit Task</button>
                          ) : null}
                        </div>
                        {isProofOpen && proofForm && (
                          <div style={{ borderTop: "1px solid rgba(245,200,66,0.15)", padding: "14px 16px", background: "rgba(245,200,66,0.03)" }}>
                            <div style={{ marginBottom: "10px" }}>
                              <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" }}>🔗 Link</label>
                              <input type="url" placeholder="https://" value={proofForm.linkUrl} onChange={e => setProofForm(prev => prev ? { ...prev, linkUrl: e.target.value } : prev)} className="input-field" style={{ fontSize: "12px", padding: "8px 12px" }} />
                            </div>
                            <div style={{ marginBottom: "10px" }}>
                              <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" }}>📎 File</label>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", color: proofForm.fileName ? "#22c55e" : "rgba(255,255,255,0.3)", fontSize: "12px" }}>
                                <input type="file" style={{ display: "none" }} onChange={handleFileChange} />
                                {proofForm.fileName ? `✓ ${proofForm.fileName}` : "Choose file…"}
                              </label>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => setProofForm(null)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>Cancel</button>
                              <button onClick={handleSubmitProof} style={{ flex: 2, padding: "8px", borderRadius: "8px", border: "none", background: "#f5c842", color: "#000", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Submit ✓</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeRounds.length === 0 && unroundedTasks.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)", fontSize: "15px" }}>No active rounds right now. Check back soon!</div>
            )}
          </div>
        )}

        {/* ─── JOBS TAB ─── */}
        {mainTab === "jobs" && (
          <>
            {appliedJobs.length > 0 && (
              <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "14px", padding: "14px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>📋</span>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#f0f0ff" }}>You have {appliedJobs.length} active application{appliedJobs.length > 1 ? "s" : ""}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Waiting for teacher review</p>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
              {[...openJobs, ...myJobs.filter(j => j.status === "closed")].map(j => {
                const hasApplied = j.applicants.includes(user.id);
                const isApproved = j.approved.includes(user.id);
                const slotsLeft = j.slots - j.filledSlots;
                const isFull = slotsLeft <= 0;
                return (
                  <div key={j.id} style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "20px", padding: "22px", display: "flex", flexDirection: "column", gap: "14px", position: "relative", boxShadow: "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)", transition: "all 0.3s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 28px rgba(0,212,255,0.22), inset 0 0 28px rgba(0,212,255,0.07)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.18)"; }}>
                    <div style={{ position: "absolute", top: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>{j.title}</h2>
                      <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, flexShrink: 0, background: j.status === "open" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)", color: j.status === "open" ? "#22c55e" : "rgba(255,255,255,0.35)", border: `1px solid ${j.status === "open" ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}` }}>{j.status === "open" ? "Open" : "Closed"}</span>
                    </div>
                    {j.description && <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{j.description}</p>}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ flex: 1, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f5c842" }}>{j.rewardCoins.reduce((s, rc) => s + rc.amount, 0)} XC</p>
                        <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>BADGES</p>
                      </div>
                      <div style={{ flex: 1, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.15)", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#4f8ef7" }}>⚡ {j.xcReward}</p>
                        <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>XP</p>
                      </div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: slotsLeft > 0 ? "#22c55e" : "#ef4444" }}>{slotsLeft}</p>
                        <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>SLOTS LEFT</p>
                      </div>
                    </div>
                    {isApproved ? (
                      <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}><span style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e" }}>✅ You&apos;re hired!</span></div>
                    ) : hasApplied ? (
                      <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}><span style={{ fontSize: "13px", fontWeight: 600, color: "#f97316" }}>⏳ Application Pending</span></div>
                    ) : isFull || j.status === "closed" ? (
                      <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>Position Filled</span></div>
                    ) : (
                      <button id={`apply-job-${j.id}`} onClick={() => handleApplyJob(j.id)} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>Apply Now →</button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── HISTORY TAB ─── */}
        {mainTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {pastRounds.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)", fontSize: "15px" }}>No completed rounds yet.</div>
            ) : (
              pastRounds.map(round => {
                const { done, total } = roundProgress(round.id);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isExpanded = expandedRounds.has(round.id);
                const roundTasks = tasksForRound(round.id);

                return (
                  <div key={round.id} style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px", overflow: "hidden" }}>
                    <div onClick={() => toggleRound(round.id)} style={{ padding: "18px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: 700, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>✓ Completed</span>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>{round.startDate} → {round.endDate}</span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{round.name}</h3>
                      </div>
                      <div style={{ textAlign: "right", minWidth: "90px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{done}/{total} tasks</p>
                        <div style={{ width: "90px", height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: "3px" }} />
                        </div>
                      </div>
                      <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.15)" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "14px 24px 20px" }}>
                        {roundTasks.length === 0 ? (
                          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: "13px", fontStyle: "italic" }}>No tasks recorded.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {roundTasks.map(t => {
                              const meta = taskStatusMeta(t);
                              return (
                                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: meta ? meta.color : "rgba(255,255,255,0.3)" }}>{t.title}</p>
                                    {t.submissionProof?.linkUrl && <p style={{ margin: "2px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>🔗 {t.submissionProof.linkUrl.slice(0, 50)}</p>}
                                    {t.submissionProof?.fileUrl && <p style={{ margin: "2px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>📎 {t.submissionProof.fileUrl}</p>}
                                  </div>
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#f5c842" }}>{t.rewardCoins.reduce((s, rc) => s + rc.amount, 0)} XC</span>
                                    <span style={{ fontSize: "12px", color: meta ? meta.color : "rgba(255,255,255,0.2)" }}>{meta?.label || "Not submitted"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
