"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, Job, mockJobs } from "../../lib/data";

export default function PlayerJobs() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    // Onboarding now owned by PFLX Platform SSO — no per-route gate needed
    setUser(u);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApply = (jobId: string) => {
    if (!user) return;
    setJobs((prev) => prev.map((j) =>
      j.id === jobId ? { ...j, applicants: [...j.applicants, user.id] } : j
    ));
    showToast("Application submitted! Waiting for teacher approval. 📤", "success");
  };

  if (!user) return null;

  const openJobs = jobs.filter((j) => j.status === "open");
  const myJobs = jobs.filter((j) => j.applicants.includes(user.id));

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
          }}>💼 JOBS</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ APPLY FOR CLASS JOBS TO EARN BIG REWARDS ]</p>
        </div>

        {/* My Applications Banner */}
        {myJobs.length > 0 && (
          <div style={{
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "14px", padding: "16px 20px", marginBottom: "24px",
            display: "flex", alignItems: "center", gap: "12px"
          }}>
            <span style={{ fontSize: "20px" }}>📋</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#f0f0ff" }}>You have {myJobs.length} active application{myJobs.length > 1 ? "s" : ""}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Waiting for teacher review</p>
            </div>
          </div>
        )}

        {/* Jobs Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {[...openJobs, ...jobs.filter((j) => j.status === "closed")].map((j) => {
            const hasApplied = j.applicants.includes(user.id);
            const isApproved = j.approved.includes(user.id);
            const slotsLeft = j.slots - j.filledSlots;
            const isFull = slotsLeft <= 0;

            return (
              <div key={j.id} style={{
                background: "rgba(22,22,31,0.9)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "16px", padding: "22px", display: "flex", flexDirection: "column", gap: "14px"
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>{j.title}</h2>
                  <span style={{
                    padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, flexShrink: 0,
                    background: j.status === "open" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)",
                    color: j.status === "open" ? "#22c55e" : "rgba(255,255,255,0.35)",
                    border: `1px solid ${j.status === "open" ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`
                  }}>{j.status === "open" ? "Open" : "Closed"}</span>
                </div>

                {j.description && (
                  <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{j.description}</p>
                )}

                {/* Rewards */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{
                    flex: 1, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)",
                    borderRadius: "8px", padding: "10px", textAlign: "center"
                  }}>
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f5c842" }}>{j.rewardCoins.reduce((sum, rc) => sum + rc.amount, 0)} XC</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>BADGES</p>
                  </div>
                  <div style={{
                    flex: 1, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.15)",
                    borderRadius: "8px", padding: "10px", textAlign: "center"
                  }}>
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#4f8ef7" }}>⚡ {j.xpReward}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>XP</p>
                  </div>
                  <div style={{
                    flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "8px", padding: "10px", textAlign: "center"
                  }}>
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: slotsLeft > 0 ? "#22c55e" : "#ef4444" }}>{slotsLeft}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>SLOTS LEFT</p>
                  </div>
                </div>

                {/* Action */}
                {isApproved ? (
                  <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e" }}>✅ You&apos;re hired!</span>
                  </div>
                ) : hasApplied ? (
                  <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#f97316" }}>⏳ Application Pending</span>
                  </div>
                ) : isFull || j.status === "closed" ? (
                  <div style={{ padding: "10px", borderRadius: "10px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>Position Filled</span>
                  </div>
                ) : (
                  <button
                    id={`apply-job-${j.id}`}
                    onClick={() => handleApply(j.id)}
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >Apply Now →</button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
