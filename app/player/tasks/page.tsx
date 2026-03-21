"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Task, mockTasks } from "../../lib/data";

export default function PlayerTasks() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
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
    showToast("Task submitted! Waiting for teacher approval. 📤", "success");
  };

  if (!user) return null;

  const mySubmitted = tasks.filter((t) => t.submittedBy === user.id);
  const open = tasks.filter((t) => t.status === "open" && t.submittedBy !== user.id);
  const display = filter === "open" ? open : mySubmitted;

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
                  <span style={{
                    padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                    background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)"
                  }}>{t.category}</span>
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
                  <div style={{
                    padding: "10px", borderRadius: "10px", textAlign: "center",
                    background: ss?.color === "#22c55e" ? "rgba(34,197,94,0.08)" : ss?.color === "#ef4444" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
                    border: `1px solid ${ss?.color}33`
                  }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: ss?.color }}>{ss?.label}</span>
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
            {filter === "open" ? "No available tasks right now. Check back later!" : "No submissions yet. Start completing tasks!"}
          </div>
        )}
      </main>
    </div>
  );
}
