"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Task, mockTasks, mockUsers, CoinSubmission, mockSubmissions, mockModifiers, mockTransactions } from "../../lib/data";
import { playSuccess, playError } from "../../lib/sounds";
import { saveUsers, saveTransactions, saveSubmissions, saveTasks } from "../../lib/store";
import { showSaveToast } from "../../lib/saveToast";

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

  useEffect(() => {
    // Load mock data
    import("../../lib/data").then((data) => {
      setTrades(data.mockTrades);
      setInvestments(data.mockInvestments);
    });
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
    saveTasks().then(() => showSaveToast("Task approved — saved to cloud ✓"));
    showToast("Task approved! X-Coin & XP awarded. 🎉", "success");
  };

  const handleRejectTask = (taskId: string) => {
    const idx = mockTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) (mockTasks[idx] as any).status = "rejected";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "rejected" as const } : t));
    playError();
    saveTasks().then(() => showSaveToast("Task rejected — saved to cloud ✓"));
    showToast("Task rejected.", "error");
  };

  const handleApproveTrade = (id: string) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
    playSuccess();
    showToast("XP Trade approved! Credits transferred.", "success");
  };

  const handleApproveInvestment = (id: string) => {
    setInvestments(prev => prev.map(inv => inv.id === id ? { ...inv, status: "active" } : inv));
    playSuccess();
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

    saveTransactions().then(() => showSaveToast("Fine saved to cloud ✓"));
    showToast(`Successfully issued fine: ${tax.name} (-${tax.costXcoin} XP)`, "success");
    setSelectedPlayerId("");
    setSelectedTaxId("");
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

        {/* Section: Task Submissions */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#8b5cf6" }}>✅ Task Submissions</h2>
            {pendingTasks.length > 0 && (
              <span style={{
                padding: "2px 8px", borderRadius: "100px", fontSize: "12px", fontWeight: 700,
                background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
                border: "1px solid rgba(139,92,246,0.25)"
              }}>{pendingTasks.length}</span>
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
                return (
                  <div key={t.id} style={{
                    background: "rgba(22,22,31,0.9)", border: "1px solid rgba(139,92,246,0.15)",
                    borderRadius: "16px", padding: "20px", display: "flex", alignItems: "center", gap: "16px"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                          background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)"
                        }}>{t.category}</span>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>submitted {t.submittedAt}</span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>{t.title}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                        Player: <span style={{ color: "#f0f0ff", fontWeight: 600 }}>{player?.name}</span> · {player?.cohort}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <div style={{ textAlign: "right", marginRight: "8px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f5c842" }}>🪙 +{t.rewardCoins.reduce((sum, rc) => sum + rc.amount, 0)}</p>
                        <p style={{ margin: 0, fontSize: "12px", color: "#4f8ef7" }}>⚡ +{t.xcReward}</p>
                      </div>
                      <button onClick={() => handleRejectTask(t.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>✕</button>
                      <button onClick={() => handleApproveTask(t.id)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Approve</button>
                    </div>
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
      </main>
    </div>
  );
}
