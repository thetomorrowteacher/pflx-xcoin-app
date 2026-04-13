"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Task, mockTasks } from "../../lib/data";
import { saveTasks } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";

export default function PlayerTasks() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState("open");

  /* ── Resubmit modal state ──────────────────────────────────────── */
  const [resubmitModal, setResubmitModal] = useState<{
    taskId: string; linkUrl: string; fileUrl: string; note: string;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    // When Platform has toggled to player mode, allow host users on player pages
    const activeRole = localStorage.getItem("pflx_active_role");
    if (u.role !== "player" && activeRole !== "player") { router.push("/admin"); return; }
    // Onboarding now owned by PFLX Platform SSO — no per-route gate needed
    setUser(u);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = (taskId: string) => {
    if (!user) return;
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, status: "submitted" as const, submittedBy: user.id, submittedAt: new Date().toISOString().split("T")[0] } : t
    ));
    showToast("Task submitted! Waiting for coach approval. 📤", "success");
  };

  /* Open resubmit modal — pre-fill with existing proof */
  const openResubmit = (task: Task) => {
    setResubmitModal({
      taskId: task.id,
      linkUrl: task.submissionProof?.linkUrl || "",
      fileUrl: task.submissionProof?.fileUrl || "",
      note: task.submissionProof?.note || "",
    });
  };

  /* Save resubmission — changes status back to "submitted" */
  const handleResubmit = () => {
    if (!resubmitModal || !user) return;
    const now = new Date().toISOString().split("T")[0];
    const updater = (t: Task): Task =>
      t.id === resubmitModal.taskId
        ? {
            ...t,
            status: "submitted" as const,
            submittedAt: now,
            submissionProof: {
              ...t.submissionProof,
              linkUrl: resubmitModal.linkUrl || undefined,
              fileUrl: resubmitModal.fileUrl || undefined,
              note: resubmitModal.note || undefined,
            },
            rejectionFeedback: undefined,
            rejectedAt: undefined,
          }
        : t;
    // Update mockTasks (shared state) + local state
    const idx = mockTasks.findIndex(t => t.id === resubmitModal.taskId);
    if (idx !== -1) {
      const updated = updater(mockTasks[idx]);
      mockTasks[idx] = updated;
    }
    setTasks(prev => prev.map(updater));
    saveAndToast([saveTasks], "Resubmitted — saved to cloud ✓");
    showToast("Task resubmitted! Your coach will review it soon. 📤", "success");
    setResubmitModal(null);
  };

  /* Delete a rejected submission — resets it to open */
  const handleDeleteSubmission = (taskId: string) => {
    const updater = (t: Task): Task =>
      t.id === taskId
        ? {
            ...t,
            status: "open" as const,
            submittedBy: undefined,
            submittedAt: undefined,
            submissionProof: undefined,
            rejectionFeedback: undefined,
            rejectedAt: undefined,
          }
        : t;
    const idx = mockTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) mockTasks[idx] = updater(mockTasks[idx]);
    setTasks(prev => prev.map(updater));
    saveAndToast([saveTasks], "Submission withdrawn — saved to cloud ✓");
    showToast("Submission withdrawn. Task is available again.", "success");
  };

  if (!user) return null;

  const mySubmitted = tasks.filter((t) => t.submittedBy === user.id);
  const myRejected = tasks.filter((t) => t.submittedBy === user.id && t.status === "rejected");
  const open = tasks.filter((t) => t.status === "open" && t.submittedBy !== user.id)
    .sort((a, b) => {
      // Required tasks (in checkpoint) sort first
      const aReq = a.roundId ? 0 : 1;
      const bReq = b.roundId ? 0 : 1;
      return aReq - bReq;
    });
  const display = filter === "open" ? open : filter === "rejected" ? myRejected : mySubmitted;

  const statusStyle = (status: string) => {
    if (status === "approved") return { color: "#22c55e", label: "✅ Approved" };
    if (status === "rejected") return { color: "#ef4444", label: "❌ Rejected" };
    return { color: "#f97316", label: "⏳ Pending Review" };
  };

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

        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>✅ TASKS</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ COMPLETE TASKS TO EARN DIGITAL BADGES AND XC ]</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {[
            { key: "open", label: `Available (${open.length})` },
            { key: "mine", label: `My Submissions (${mySubmitted.length})` },
            ...(myRejected.length > 0 ? [{ key: "rejected", label: `Needs Work (${myRejected.length})` }] : []),
          ].map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
              padding: "8px 20px", borderRadius: "10px", border: "1px solid",
              borderColor: filter === tab.key ? "#f5c842" : "rgba(255,255,255,0.08)",
              background: filter === tab.key ? "rgba(245,200,66,0.1)" : "transparent",
              color: filter === tab.key ? "#f5c842" : "rgba(255,255,255,0.4)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer"
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Task Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
          {display.map((t) => {
            const isMyTask = t.submittedBy === user.id;
            const ss = isMyTask ? statusStyle(t.status) : null;
            return (
              <div key={t.id} style={{
                background: "rgba(22,22,31,0.9)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px"
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                      background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)"
                    }}>{t.category}</span>
                    {t.roundId ? (
                      <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                        background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", color: "#f5c842" }}>
                        📌 Required
                      </span>
                    ) : (
                      <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                        background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)", color: "#00d4ff" }}>
                        Optional
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Due {t.dueDate}</span>
                </div>

                <div>
                  <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>{t.title}</p>
                  {t.description && <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{t.description}</p>}
                </div>

                {/* Rewards */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{
                    flex: 1, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)",
                    borderRadius: "8px", padding: "8px", textAlign: "center"
                  }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#f5c842" }}>{t.rewardCoins.reduce((sum, rc) => sum + rc.amount, 0)} XC</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>BADGES</p>
                  </div>
                  <div style={{
                    flex: 1, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.15)",
                    borderRadius: "8px", padding: "8px", textAlign: "center"
                  }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#4f8ef7" }}>⚡ {t.xcReward}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>XP</p>
                  </div>
                </div>

                {/* Action */}
                {isMyTask ? (
                  <div>
                    <div style={{
                      padding: "10px", borderRadius: "10px", textAlign: "center",
                      background: ss?.color === "#22c55e" ? "rgba(34,197,94,0.08)" : ss?.color === "#ef4444" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
                      border: `1px solid ${ss?.color}33`
                    }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: ss?.color }}>{ss?.label}</span>
                    </div>

                    {/* Rejection feedback + actions */}
                    {t.status === "rejected" && (
                      <div style={{ marginTop: "10px" }}>
                        {t.rejectionFeedback && (
                          <div style={{
                            padding: "12px", borderRadius: "10px",
                            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                            marginBottom: "10px"
                          }}>
                            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>Coach Feedback</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{t.rejectionFeedback}</p>
                            {t.rejectedAt && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>Rejected on {t.rejectedAt}</p>}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => openResubmit(t)}
                            style={{
                              flex: 1, padding: "10px", borderRadius: "10px",
                              background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
                              color: "#a78bfa", fontSize: "13px", fontWeight: 700, cursor: "pointer"
                            }}
                          >Edit & Resubmit</button>
                          <button
                            onClick={() => handleDeleteSubmission(t.id)}
                            style={{
                              padding: "10px 16px", borderRadius: "10px",
                              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.35)", fontSize: "13px", fontWeight: 600, cursor: "pointer"
                            }}
                          >Withdraw</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    id={`submit-task-${t.id}`}
                    onClick={() => handleSubmit(t.id)}
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >Submit Task 📤</button>
                )}
              </div>
            );
          })}
        </div>

        {display.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            color: "rgba(255,255,255,0.25)", fontSize: "15px"
          }}>
            {filter === "open" ? "No available tasks right now. Check back later!" : filter === "rejected" ? "No rejected tasks — you're all good!" : "No submissions yet. Start completing tasks!"}
          </div>
        )}

        {/* ══════════════════ RESUBMIT MODAL ══════════════════ */}
        {resubmitModal && (() => {
          const task = tasks.find(t => t.id === resubmitModal.taskId);
          return (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }} onClick={() => setResubmitModal(null)}>
              <div style={{
                background: "#16161f", border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "20px", padding: "28px", width: "520px", maxWidth: "90vw",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: "#a78bfa" }}>
                  Edit & Resubmit
                </h3>
                <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "#f0f0ff" }}>{task?.title}</p>

                {/* Show original rejection feedback as reminder */}
                {task?.rejectionFeedback && (
                  <div style={{
                    padding: "10px 12px", borderRadius: "10px", marginBottom: "16px",
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)"
                  }}>
                    <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: 700, color: "#ef4444" }}>Previous Feedback:</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{task.rejectionFeedback}</p>
                  </div>
                )}

                {/* Submission Link */}
                <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Proof Link (Google Docs, Canva, YouTube, etc.)</label>
                <input
                  type="url"
                  value={resubmitModal.linkUrl}
                  onChange={e => setResubmitModal(prev => prev ? { ...prev, linkUrl: e.target.value } : null)}
                  placeholder="https://..."
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "10px", marginBottom: "12px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0f0ff", fontSize: "14px"
                  }}
                />

                {/* Note */}
                <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Explain Your Work</label>
                <textarea
                  value={resubmitModal.note}
                  onChange={e => setResubmitModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                  rows={3}
                  placeholder="Describe what you did and what you improved..."
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "10px", marginBottom: "16px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0f0ff", fontSize: "14px", resize: "vertical", fontFamily: "inherit"
                  }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button onClick={() => setResubmitModal(null)} style={{
                    padding: "10px 20px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button onClick={handleResubmit} style={{
                    padding: "10px 20px", borderRadius: "10px",
                    background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
                    border: "none", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer"
                  }}>Resubmit</button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
