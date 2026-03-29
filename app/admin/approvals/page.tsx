"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Task, mockTasks, mockUsers, CoinSubmission, mockSubmissions, mockModifiers, mockTransactions } from "../../lib/data";
import { playSuccess, playError } from "../../lib/sounds";
import { saveUsers, saveTransactions, saveSubmissions, saveTasks, saveTrades, saveInvestments } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";

/* ── AI Analysis types ─────────────────────────────────────────────── */
interface AIAnalysis {
  score: number;
  recommendation: "approve" | "review" | "reject";
  signals: string[];
  flags: string[];
  summary: string;
  source: "claude" | "heuristic";
}

export default function AdminApprovals() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [submissions, setSubmissions] = useState<CoinSubmission[]>(mockSubmissions);
  const [trades, setTrades] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedTaxId, setSelectedTaxId] = useState<string>("");
  const availableTaxes = mockModifiers.filter(m => m.type === "tax");
  const [_tick, setTick] = useState(0);

  /* ── AI Analysis state ───────────────────────────────────────────── */
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [showQuickClear, setShowQuickClear] = useState(false);

  /* ── Rejection feedback modal state ──────────────────────────────── */
  const [rejectModal, setRejectModal] = useState<{ taskId: string; feedback: string; generating: boolean } | null>(null);

  useEffect(() => {
    // Load mock data
    import("../../lib/data").then((data) => {
      setTrades(data.mockTrades);
      setInvestments(data.mockInvestments);
    });
    // Refresh player list every 2s so newly added players appear
    const iv = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "admin") { router.push("/player"); return; }
    setUser(u);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveTask = (taskId: string) => {
    const idx = mockTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) (mockTasks[idx] as any).status = "approved";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "approved" as const } : t));
    playSuccess();
    saveAndToast([saveTasks], "Task approved — saved to cloud ✓");
    showToast("Task approved! X-Coin & XP awarded. 🎉", "success");
  };

  /* Opens the reject modal — auto-generates AI feedback if analysis exists */
  const openRejectModal = async (taskId: string) => {
    const ai = analyses[taskId];
    let draft = "";
    if (ai) {
      const parts: string[] = [];
      if (ai.flags.length > 0) parts.push("Issues found: " + ai.flags.join("; ") + ".");
      if (ai.summary) parts.push(ai.summary);
      parts.push("Please review the feedback, make corrections, and resubmit when ready.");
      draft = parts.join(" ");
    }
    setRejectModal({ taskId, feedback: draft, generating: false });

    // If no AI analysis yet, auto-generate feedback via Gemini
    if (!ai) {
      setRejectModal(prev => prev ? { ...prev, generating: true } : null);
      try {
        const task = tasks.find(t => t.id === taskId);
        const player = mockUsers.find(u => u.id === task?.submittedBy);
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `A student named ${player?.name || "Player"} submitted a task called "${task?.title}" but it is being rejected. Their submission proof: link="${task?.submissionProof?.linkUrl || "none"}", file="${task?.submissionProof?.fileUrl || "none"}", note="${task?.submissionProof?.note || "none"}". The task was due ${task?.dueDate || "unknown"} and submitted ${task?.submittedAt || "unknown"}. Write a brief, encouraging rejection message (2-3 sentences) explaining what might be missing and how they can improve for resubmission. Be specific and helpful.`,
            role: "host",
            context: { taskTitle: task?.title, playerName: player?.name },
          }),
        });
        const data = await res.json();
        if (data.reply) {
          setRejectModal(prev => prev ? { ...prev, feedback: data.reply, generating: false } : null);
        } else {
          setRejectModal(prev => prev ? { ...prev, generating: false } : null);
        }
      } catch {
        setRejectModal(prev => prev ? { ...prev, feedback: "Your submission needs some improvements. Please review the task requirements and resubmit with stronger proof of completion.", generating: false } : null);
      }
    }
  };

  const handleRejectTask = (taskId: string, feedback?: string) => {
    const idx = mockTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      (mockTasks[idx] as any).status = "rejected";
      if (feedback) {
        (mockTasks[idx] as any).rejectionFeedback = feedback;
        (mockTasks[idx] as any).rejectedAt = new Date().toISOString().split("T")[0];
      }
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? {
      ...t,
      status: "rejected" as const,
      rejectionFeedback: feedback || undefined,
      rejectedAt: new Date().toISOString().split("T")[0],
    } : t));
    playError();
    saveAndToast([saveTasks], "Task rejected — saved to cloud ✓");
    showToast("Task rejected with feedback sent to player.", "error");
    setRejectModal(null);
  };

  const handleApproveTrade = (id: string) => {
    setTrades(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, status: "approved" } : t);
      // Sync to mock array
      import("../../lib/data").then(d => {
        const idx = d.mockTrades.findIndex((t: any) => t.id === id);
        if (idx >= 0) d.mockTrades[idx].status = "approved";
      });
      return updated;
    });
    playSuccess();
    saveAndToast([saveTrades], "Trade approved — saved to cloud ✓");
    showToast("XP Trade approved! Credits transferred.", "success");
  };

  const handleApproveInvestment = (id: string) => {
    setInvestments(prev => {
      const updated = prev.map(inv => inv.id === id ? { ...inv, status: "active" } : inv);
      // Sync to mock array
      import("../../lib/data").then(d => {
        const idx = d.mockInvestments.findIndex((inv: any) => inv.id === id);
        if (idx >= 0) d.mockInvestments[idx].status = "active";
      });
      return updated;
    });
    playSuccess();
    saveAndToast([saveInvestments], "Investment approved — saved to cloud ✓");
    showToast("Investment Proposal approved! Stake is now active.", "success");
  };

  const handleApplyTax = () => {
    if (!selectedPlayerId || !selectedTaxId) {
      showToast("Please select a player and a violation type.", "error");
      return;
    }
    const tax = availableTaxes.find(t => t.id === selectedTaxId);
    if (!tax) return;

    // In a real app, update the user's XP and record the transaction
    mockTransactions.push({
      id: `tx-${Date.now()}`,
      userId: selectedPlayerId,
      type: "pflx_tax",
      amount: tax.costXcoin,
      currency: "xcoin",
      description: `Tax/Fine Applied: ${tax.name}`,
      createdAt: new Date().toISOString().split("T")[0]
    });

    saveAndToast([saveTransactions], "Fine saved to cloud ✓");
    showToast(`Successfully issued fine: ${tax.name} (-${tax.costXcoin} XP)`, "success");
    setSelectedPlayerId("");
    setSelectedTaxId("");
  };

  /* ── AI Analysis helpers ─────────────────────────────────────────── */
  const analyzeTask = useCallback(async (task: Task) => {
    setAnalyzing(prev => ({ ...prev, [task.id]: true }));
    try {
      const player = mockUsers.find(u => u.id === task.submittedBy);
      const taskHistory = mockTasks
        .filter(t => t.submittedBy === task.submittedBy && (t.status === "approved" || t.status === "rejected"))
        .map(t => ({ status: t.status }));
      const res = await fetch("/api/analyze-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            title: task.title,
            description: task.description,
            category: task.category,
            dueDate: task.dueDate,
            submittedAt: task.submittedAt,
            submissionProof: task.submissionProof,
          },
          player: { name: player?.name, brandName: player?.brandName, cohort: player?.cohort },
          taskHistory,
        }),
      });
      const data: AIAnalysis = await res.json();
      setAnalyses(prev => ({ ...prev, [task.id]: data }));
    } catch {
      setAnalyses(prev => ({
        ...prev,
        [task.id]: { score: 0, recommendation: "review", signals: [], flags: ["Analysis failed"], summary: "Could not analyze — please review manually.", source: "heuristic" },
      }));
    } finally {
      setAnalyzing(prev => ({ ...prev, [task.id]: false }));
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    const pending = mockTasks.filter(t => t.status === "submitted");
    setBulkAnalyzing(true);
    await Promise.all(pending.map(t => analyzeTask(t)));
    setBulkAnalyzing(false);
    setShowQuickClear(true);
  }, [analyzeTask]);

  const quickClearApprovals = () => {
    const pending = tasks.filter(t => t.status === "submitted");
    let cleared = 0;
    pending.forEach(t => {
      const a = analyses[t.id];
      if (a && a.score >= 70 && a.recommendation === "approve") {
        handleApproveTask(t.id);
        cleared++;
      }
    });
    if (cleared > 0) {
      showToast(`AI Quick Clear: ${cleared} submission${cleared > 1 ? "s" : ""} auto-approved!`, "success");
    } else {
      showToast("No submissions met the auto-approve threshold (score >= 70).", "error");
    }
    setShowQuickClear(false);
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "#22c55e";
    if (score >= 45) return "#f5c842";
    return "#ef4444";
  };

  const recBadge = (rec: string) => {
    if (rec === "approve") return { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", icon: "✅", label: "APPROVE" };
    if (rec === "reject") return { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", icon: "❌", label: "REJECT" };
    return { color: "#f5c842", bg: "rgba(245,200,66,0.12)", border: "rgba(245,200,66,0.25)", icon: "👁", label: "REVIEW" };
  };

  if (!user) return null;

  const pendingTasks = tasks.filter((t) => t.status === "submitted");
  const pendingCoins = submissions.filter((s) => s.status === "pending");
  const reviewed = [
    ...tasks.filter((t) => t.status === "approved" || t.status === "rejected").map(t => ({ id: t.id, title: t.title, playerId: t.submittedBy, date: t.submittedAt, status: t.status, type: 'task' })),
    ...submissions.filter((s) => s.status === "approved" || s.status === "rejected").map(s => ({ id: s.id, title: `${s.amount}x ${s.coinType}`, playerId: s.playerId, date: s.submittedAt, status: s.status, type: 'coin' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const players = mockUsers.filter((u) => u.role === "player");

  const statusStyle = (status: string) => {
    if (status === "approved") return { color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", label: "✅ Approved" };
    if (status === "rejected") return { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", label: "❌ Rejected" };
    return { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", label: "⏳ Pending" };
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        {/* Toast */}
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
          }}>✅ APPROVALS</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ REVIEW AND APPROVE PLAYER SUBMISSIONS ]</p>
        </div>

        {/* Section: XP Barter & Trade */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#22c55e" }}>🤝 XP Barter & Trade</h2>
            {trades.filter(t => t.status === "pending").length > 0 && (
              <span style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "12px", background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                {trades.filter(t => t.status === "pending").length}
              </span>
            )}
          </div>

          {trades.filter(t => t.status === "pending").length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "14px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "16px" }}>No pending trades</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {trades.filter(t => t.status === "pending").map((tr) => {
                const fromUser = players.find(u => u.id === tr.fromId);
                const toUser = players.find(u => u.id === tr.toId);
                return (
                  <div key={tr.id} style={{ background: "rgba(22,22,31,0.9)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>
                        <span style={{ color: "#4f8ef7" }}>@{fromUser?.brandName}</span> ➔ <span style={{ color: "#f5c842" }}>@{toUser?.brandName}</span>
                      </p>
                      <p style={{ margin: "0 0 8px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Note: &quot;{tr.note}&quot;</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>Proposed on {tr.createdAt}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#4f8ef7" }}>⚡ {tr.amount}</p>
                      <button onClick={() => { playError(); showToast("Trade rejected", "error"); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>✕</button>
                      <button onClick={() => handleApproveTrade(tr.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Approve</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section: Investment Proposals */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#4f8ef7" }}>📈 Investment Proposals</h2>
            {investments.filter(i => i.status === "pending").length > 0 && (
              <span style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "12px", background: "rgba(79,142,247,0.15)", color: "#4f8ef7" }}>
                {investments.filter(i => i.status === "pending").length}
              </span>
            )}
          </div>

          {investments.filter(i => i.status === "pending").length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "14px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "16px" }}>No pending investments</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {investments.filter(i => i.status === "pending").map((inv) => {
                const player = players.find(u => u.id === inv.playerId);
                const project = [ ...tasks, ...mockTasks ].find(t => t.id === inv.targetId);
                return (
                  <div key={inv.id} style={{ background: "rgba(22,22,31,0.9)", border: "1px solid rgba(79,142,247,0.15)", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                        <span style={{ color: "#f5c842" }}>@{player?.brandName}</span> wants to invest in:
                      </p>
                      <p style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#f0f0ff" }}>{project?.title || "Project"}</p>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Stake: ⚡ {inv.amount}</span>
                        <span style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>Exp. Return: ⚡ {inv.expectedReturn}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => { playError(); showToast("Investment rejected", "error"); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "transparent" }}>✕</button>
                      <button onClick={() => handleApproveInvestment(inv.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(79,142,247,0.15)", border: "1px solid rgba(79,142,247,0.3)", color: "#4f8ef7", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Approve Stake</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section: Task Submissions — AI-Enhanced */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#8b5cf6" }}>✅ Task Submissions</h2>
            {pendingTasks.length > 0 && (
              <span style={{
                padding: "2px 8px", borderRadius: "100px", fontSize: "12px", fontWeight: 700,
                background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
                border: "1px solid rgba(139,92,246,0.25)"
              }}>{pendingTasks.length}</span>
            )}
            {/* AI Bulk Actions */}
            {pendingTasks.length > 0 && (
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={analyzeAll}
                  disabled={bulkAnalyzing}
                  style={{
                    padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                    background: bulkAnalyzing ? "rgba(167,139,250,0.1)" : "rgba(167,139,250,0.15)",
                    border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa",
                    cursor: bulkAnalyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  {bulkAnalyzing ? (
                    <><span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "13px" }}>⟳</span> Analyzing...</>
                  ) : (
                    <>🤖 Analyze All</>
                  )}
                </button>
                {showQuickClear && Object.keys(analyses).length > 0 && (
                  <button
                    onClick={quickClearApprovals}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                      background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                      color: "#22c55e", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                    }}
                  >
                    ⚡ Quick Clear ({pendingTasks.filter(t => analyses[t.id]?.score >= 70 && analyses[t.id]?.recommendation === "approve").length})
                  </button>
                )}
              </div>
            )}
          </div>

          {pendingTasks.length === 0 ? (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: "16px", padding: "32px", textAlign: "center",
              color: "rgba(255,255,255,0.2)", fontSize: "14px"
            }}>No pending task submissions</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pendingTasks.map((t) => {
                const player = players.find((s) => s.id === t.submittedBy);
                const ai = analyses[t.id];
                const isAnalyzing = analyzing[t.id];
                return (
                  <div key={t.id} style={{
                    background: "rgba(22,22,31,0.9)",
                    border: ai ? `1px solid ${recBadge(ai.recommendation).border}` : "1px solid rgba(139,92,246,0.15)",
                    borderRadius: "16px", padding: "20px",
                  }}>
                    {/* Top row: task info + actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                            background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)"
                          }}>{t.category}</span>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>submitted {t.submittedAt}</span>
                          {/* Submission proof indicators */}
                          {t.submissionProof?.linkUrl && (
                            <a href={t.submissionProof.linkUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#4f8ef7", textDecoration: "none" }}>🔗 Link</a>
                          )}
                          {t.submissionProof?.fileUrl && <span style={{ fontSize: "11px", color: "#22c55e" }}>📎 File</span>}
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>{t.title}</p>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                          Player: <span style={{ color: "#f0f0ff", fontWeight: 600 }}>{player?.name}</span> · {player?.cohort}
                        </p>
                        {t.submissionProof?.note && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                            &quot;{t.submissionProof.note.slice(0, 120)}{t.submissionProof.note.length > 120 ? "..." : ""}&quot;
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <div style={{ textAlign: "right", marginRight: "8px" }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f5c842" }}>🪙 +{t.rewardCoins.reduce((sum, rc) => sum + rc.amount, 0)}</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "#4f8ef7" }}>⚡ +{t.xcReward}</p>
                        </div>
                        {/* Analyze button */}
                        <button
                          onClick={() => analyzeTask(t)}
                          disabled={isAnalyzing}
                          style={{
                            padding: "8px 12px", borderRadius: "8px",
                            background: isAnalyzing ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.12)",
                            border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa",
                            fontSize: "12px", fontWeight: 600, cursor: isAnalyzing ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap"
                          }}
                        >
                          {isAnalyzing ? "⟳" : "🤖"} {isAnalyzing ? "..." : "Analyze"}
                        </button>
                        <button onClick={() => openRejectModal(t.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>✕ Reject</button>
                        <button onClick={() => handleApproveTask(t.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Approve</button>
                      </div>
                    </div>

                    {/* AI Analysis Results (shown after analysis) */}
                    {ai && (
                      <div style={{
                        marginTop: "14px", padding: "14px 16px", borderRadius: "12px",
                        background: "rgba(0,0,0,0.3)", border: `1px solid ${recBadge(ai.recommendation).border}`,
                      }}>
                        {/* Score bar + recommendation */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Score</span>
                            <span style={{ fontSize: "20px", fontWeight: 900, color: scoreColor(ai.score) }}>{ai.score}</span>
                          </div>
                          {/* Score bar */}
                          <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ width: `${ai.score}%`, height: "100%", borderRadius: "3px", background: scoreColor(ai.score), transition: "width 0.5s" }} />
                          </div>
                          {/* Recommendation badge */}
                          <span style={{
                            padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                            background: recBadge(ai.recommendation).bg,
                            border: `1px solid ${recBadge(ai.recommendation).border}`,
                            color: recBadge(ai.recommendation).color
                          }}>{recBadge(ai.recommendation).icon} {recBadge(ai.recommendation).label}</span>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>via {ai.source}</span>
                        </div>
                        {/* Summary */}
                        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{ai.summary}</p>
                        {/* Signals & Flags */}
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          {ai.signals.length > 0 && (
                            <div style={{ flex: 1, minWidth: "180px" }}>
                              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#22c55e" }}>Positive Signals</p>
                              {ai.signals.map((s, i) => (
                                <p key={i} style={{ margin: "2px 0", fontSize: "12px", color: "rgba(34,197,94,0.7)" }}>+ {s}</p>
                              ))}
                            </div>
                          )}
                          {ai.flags.length > 0 && (
                            <div style={{ flex: 1, minWidth: "180px" }}>
                              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#ef4444" }}>Flags / Concerns</p>
                              {ai.flags.map((f, i) => (
                                <p key={i} style={{ margin: "2px 0", fontSize: "12px", color: "rgba(239,68,68,0.7)" }}>! {f}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Reviewed */}
        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#f0f0ff" }}>Recently Reviewed</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {reviewed.slice(0, 5).map((r) => {
              const player = players.find((st) => st.id === r.playerId);
              const s = statusStyle(r.status);
              return (
                <div key={`${r.type}-${r.id}`} style={{
                  background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px"
                }}>
                  <span style={{ fontSize: "18px" }}>{r.type === 'coin' ? '🪙' : '✅'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#f0f0ff" }}>{r.title}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                      {player?.name ?? "Unknown"} · {r.date}
                    </p>
                  </div>
                  <div style={{
                    padding: "4px 12px", borderRadius: "8px", background: s.bg, border: `1px solid ${s.border}`,
                    color: s.color, fontSize: "12px", fontWeight: 600
                  }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Issue PFLX Tax (Fines) */}
        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "16px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <span style={{ fontSize: "24px" }}>🚫</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ef4444" }}>Issue PFLX Tax</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(239,68,68,0.6)" }}>Apply XP fines for disruptions or code violations</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "16px" }}>
            {/* Player Select */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Select Player</p>
              <select 
                value={selectedPlayerId} 
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff", fontSize: "14px"
                }}>
                <option value="">Choose a player...</option>
                {players.map(s => <option key={s.id} value={s.id}>{s.name} ({s.cohort})</option>)}
              </select>
            </div>

            {/* Violation Type */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Violation Type</p>
              <select 
                value={selectedTaxId} 
                onChange={(e) => setSelectedTaxId(e.target.value)}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff", fontSize: "14px"
                }}>
                <option value="">Choose violation...</option>
                {availableTaxes.map(t => <option key={t.id} value={t.id}>{t.name} (-{t.costXcoin} XC)</option>)}
              </select>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button 
                onClick={handleApplyTax}
                disabled={!selectedPlayerId || !selectedTaxId}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                  background: (!selectedPlayerId || !selectedTaxId) ? "rgba(239,68,68,0.3)" : "#ef4444", 
                  color: (!selectedPlayerId || !selectedTaxId) ? "rgba(255,255,255,0.5)" : "white", 
                  fontSize: "14px", fontWeight: 700, 
                  cursor: (!selectedPlayerId || !selectedTaxId) ? "not-allowed" : "pointer",
                  transition: "all 0.2s"
                }}>
                Apply PFLX Tax
              </button>
            </div>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
            * Note: PFLX Tax will take away from XP and Rank. Digital Badges (X-Coins) remain unchanged.
          </p>
        </div>

        {/* ══════════════════ REJECTION FEEDBACK MODAL ══════════════════ */}
        {rejectModal && (() => {
          const task = tasks.find(t => t.id === rejectModal.taskId);
          const player = players.find(u => u.id === task?.submittedBy);
          return (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }} onClick={() => setRejectModal(null)}>
              <div style={{
                background: "#16161f", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "20px", padding: "28px", width: "520px", maxWidth: "90vw",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: "#ef4444" }}>
                  Reject Submission
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                  {task?.title} — <span style={{ color: "#f0f0ff" }}>{player?.name}</span>
                </p>

                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                  Feedback for Player {rejectModal.generating && <span style={{ color: "#a78bfa" }}>(AI generating...)</span>}
                </label>
                <textarea
                  value={rejectModal.feedback}
                  onChange={e => setRejectModal(prev => prev ? { ...prev, feedback: e.target.value } : null)}
                  rows={5}
                  placeholder="Explain what needs to be fixed or improved..."
                  style={{
                    width: "100%", padding: "12px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0f0ff", fontSize: "14px", lineHeight: 1.5, resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
                <p style={{ margin: "8px 0 16px", fontSize: "11px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                  This feedback will be shown to the player so they can improve and resubmit.
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button onClick={() => setRejectModal(null)} style={{
                    padding: "10px 20px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button
                    onClick={() => handleRejectTask(rejectModal.taskId, rejectModal.feedback)}
                    disabled={rejectModal.generating}
                    style={{
                      padding: "10px 20px", borderRadius: "10px",
                      background: rejectModal.generating ? "rgba(239,68,68,0.2)" : "#ef4444",
                      border: "none", color: rejectModal.generating ? "rgba(255,255,255,0.4)" : "white",
                      fontSize: "13px", fontWeight: 700, cursor: rejectModal.generating ? "not-allowed" : "pointer"
                    }}
                  >Reject & Send Feedback</button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
