"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, COIN_CATEGORIES, mockSubmissions, CoinSubmission,
  mockStartupStudios, mockStudioInvestments, StudioInvestment,
  getStudioMaxStakePercent,
  CORE_PATHWAYS, mockCommunityContributions,
} from "../../lib/data";
import { saveCommunityContributions } from "../../lib/store";

interface RequestEntry {
  id: string;
  coinType: string;
  amount: number;
  reason: string;
  fileName: string | null;
  pathwaySlug: string;
  proposeAsCourse: boolean;
  courseTitle: string;
  courseDescription: string;
}

export default function PlayerSubmit() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"request" | "trade" | "stake">("request");
  const [allPlayers, setAllPlayers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);

  // Trade Form State
  const [tradeData, setTradeData] = useState({ toId: "", amount: 0, note: "" });

  // Studio Stake State
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [stakeAction, setStakeAction] = useState<"stake" | "withdraw">("stake");
  const [studioInvestments, setStudioInvestments] = useState<StudioInvestment[]>([...mockStudioInvestments]);

  const [entries, setEntries] = useState<RequestEntry[]>([
    { id: Math.random().toString(36).substr(2, 9), coinType: "", amount: 1, reason: "", fileName: null, pathwaySlug: "", proposeAsCourse: false, courseTitle: "", courseDescription: "" }
  ]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const userData = JSON.parse(stored) as User;
    // Onboarding now owned by PFLX Platform SSO — no per-route gate needed
    setUser(userData);

    // Filter all activities for this player
    import("../../lib/data").then(data => {
      const subs = data.mockSubmissions.filter(s => s.playerId === userData.id).map(s => ({ ...s, type: 'coin', date: s.submittedAt }));
      const trades = data.mockTrades.filter(t => t.fromId === userData.id).map(t => ({ ...t, type: 'trade', date: t.createdAt }));
      const stakeInvs = data.mockStudioInvestments.filter(i => i.playerId === userData.id).map(i => ({ ...i, type: 'stake', date: i.createdAt }));

      const combined = [...subs, ...trades, ...stakeInvs].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setHistory(combined);
      
      setAllPlayers(data.mockUsers.filter(u => u.role === "player" && u.id !== userData.id));
      setAllTasks([...data.mockTasks, ...data.mockJobs]);
    });
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addEntry = () => {
    setEntries([...entries, { id: Math.random().toString(36).substr(2, 9), coinType: "", amount: 1, reason: "", fileName: null, pathwaySlug: "", proposeAsCourse: false, courseTitle: "", courseDescription: "" }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof RequestEntry, value: any) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateEntry(id, "fileName", file.name);
      showToast(`Evidence attached: ${file.name}`, "success");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const invalid = entries.some(e => !e.coinType || !e.reason);
    if (invalid) {
      showToast("Please fill out all fields for each coin request.", "error");
      return;
    }

    // In a real app, this would be an API call to Supabase
    showToast(`${entries.length} submission(s) successful! Waiting for teacher review. 🚀`, "success");

    const newSubs = entries.map(entry => ({
      id: Math.random().toString(36).substr(2, 9),
      playerId: user.id,
      coinType: entry.coinType,
      amount: entry.amount,
      reason: entry.reason,
      status: "pending",
      submittedAt: new Date().toISOString(),
      date: new Date().toISOString(),
      type: 'coin'
    }));

    setHistory([...newSubs, ...history]);

    // Create community contributions for entries with proposeAsCourse checked
    const courseEntries = entries.filter(e => e.proposeAsCourse && e.pathwaySlug);
    if (courseEntries.length > 0) {
      courseEntries.forEach(entry => {
        const contrib = {
          id: `cc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          playerId: user.id,
          taskId: entry.coinType, // Using coinType as a reference since there is no direct taskId
          title: entry.courseTitle || `Course proposal: ${entry.coinType}`,
          description: entry.courseDescription || entry.reason,
          pathwaySlug: entry.pathwaySlug,
          evidenceUrl: "",
          status: "pending" as const,
          submittedAt: new Date().toISOString(),
        };
        mockCommunityContributions.push(contrib);
      });
      saveCommunityContributions();
    }

    // Clear form
    setEntries([{ id: Math.random().toString(36).substr(2, 9), coinType: "", amount: 1, reason: "", fileName: null, pathwaySlug: "", proposeAsCourse: false, courseTitle: "", courseDescription: "" }]);
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "approved": return { color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" };
      case "rejected": return { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" };
      default: return { color: "#f5c842", bg: "rgba(245,200,66,0.1)", border: "rgba(245,200,66,0.3)" };
    }
  };

  if (!user) return null;

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
          }}>🚀 X-TRACKER</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ MANAGE YOUR XP, TRADE WITH PEERS, AND INVEST ]</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "24px", marginBottom: "32px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {[
            { id: "request", label: "Coin Request", icon: "🪙" },
            { id: "trade", label: "Barter & Trade", icon: "🤝" },
            { id: "stake", label: "Investments", icon: "📈" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: "none", border: "none", padding: "12px 16px", cursor: "pointer",
                color: activeTab === tab.id ? "#f5c842" : "rgba(255,255,255,0.4)",
                fontSize: "14px", fontWeight: 700, transition: "all 0.2s",
                borderBottom: `2px solid ${activeTab === tab.id ? "#f5c842" : "transparent"}`,
                display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "40px", maxWidth: "1200px" }}>
          {/* Main Area */}
          <div>
            {activeTab === "request" && (
              <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {entries.map((entry, index) => (
                  <div key={entry.id} style={{
                    background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "20px", padding: "28px",
                    position: "relative",
                    boxShadow: "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)",
                    transition: "all 0.3s ease"
                  }}>
                    <div style={{ position: "absolute", top: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f5c842", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Coin #{index + 1}
                      </h3>
                      {entries.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeEntry(entry.id)}
                          style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase" }}>COIN TYPE</label>
                        <select
                          value={entry.coinType}
                          onChange={(e) => updateEntry(entry.id, "coinType", e.target.value)}
                          className="input-field"
                          style={{ borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                        >
                          <option value="" disabled>Select a coin...</option>
                          {COIN_CATEGORIES.map((cat) => (
                            <optgroup key={cat.name} label={cat.name}>
                              {cat.coins.map((coin) => (
                                <option key={coin.name} value={coin.name}>
                                  {coin.name} ({coin.xc} XP)
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase" }}>AMOUNT</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={entry.amount}
                          onChange={(e) => updateEntry(entry.id, "amount", Number(e.target.value))}
                          className="input-field"
                          style={{ borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase" }}>REASON / EVIDENCE</label>
                      <textarea
                        value={entry.reason}
                        onChange={(e) => updateEntry(entry.id, "reason", e.target.value)}
                        placeholder="Explain what you did to earn this..."
                        className="input-field"
                        style={{ minHeight: "80px", resize: "vertical", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                      />
                    </div>

                    {/* Evidence Upload for this request */}
                    <div style={{ position: "relative" }}>
                      <input 
                        type="file" 
                        id={`file-${entry.id}`}
                        onChange={(e) => handleFileChange(entry.id, e)}
                        style={{ display: "none" }} 
                      />
                      <label 
                        htmlFor={`file-${entry.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", 
                          padding: "16px", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)",
                          background: entry.fileName ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)",
                          cursor: "pointer", transition: "all 0.2s",
                          borderColor: entry.fileName ? "#22c55e" : "rgba(255,255,255,0.1)"
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>{entry.fileName ? "✅" : "📁"}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: entry.fileName ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
                            {entry.fileName ? entry.fileName : "Attach Evidence"}
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                            Upload image, PDF, or video
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Pathway Tag & Propose as Course */}
                    <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.15)" }}>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(167,139,250,0.6)", marginBottom: "8px", textTransform: "uppercase" }}>CORE PATHWAY TAG</label>
                        <select
                          value={entry.pathwaySlug}
                          onChange={(e) => updateEntry(entry.id, "pathwaySlug", e.target.value)}
                          className="input-field"
                          style={{ borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                        >
                          <option value="">None (optional)</option>
                          {CORE_PATHWAYS.map(pw => (
                            <option key={pw.slug} value={pw.slug}>{pw.icon} {pw.name}</option>
                          ))}
                        </select>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={entry.proposeAsCourse}
                          onChange={(e) => updateEntry(entry.id, "proposeAsCourse", e.target.checked)}
                          style={{ width: "16px", height: "16px", accentColor: "#a78bfa", cursor: "pointer" }} />
                        <div>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa" }}>Propose as Course</span>
                          <p style={{ margin: "2px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                            Suggest this as a new course for the pathway. Your host will review it.
                          </p>
                        </div>
                      </label>
                      {entry.proposeAsCourse && (
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "6px", textTransform: "uppercase" }}>PROPOSED COURSE TITLE</label>
                            <input
                              value={entry.courseTitle}
                              onChange={(e) => updateEntry(entry.id, "courseTitle", e.target.value)}
                              placeholder="What should this course be called?"
                              className="input-field"
                              style={{ borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "6px", textTransform: "uppercase" }}>WHAT DID YOU LEARN?</label>
                            <textarea
                              value={entry.courseDescription}
                              onChange={(e) => updateEntry(entry.id, "courseDescription", e.target.value)}
                              placeholder="Describe what this course could teach others..."
                              className="input-field"
                              style={{ minHeight: "60px", resize: "vertical", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addEntry}
                  style={{
                    background: "rgba(245,200,66,0.05)", border: "1px dashed rgba(245,200,66,0.2)",
                    borderRadius: "16px", padding: "16px", color: "#f5c842",
                    fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  + Add Another Coin Request
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "18px", fontSize: "16px", fontWeight: 800, marginTop: "12px" }}
                >
                  Submit {entries.length} Request{entries.length > 1 ? "s" : ""} for Review 🚀
                </button>
              </div>
              </form>
            )}

            {activeTab === "trade" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{
                  background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.2)",
                  borderRadius: "20px", padding: "28px",
                  boxShadow: "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)",
                  position: "relative"
                }}>
                  <div style={{ position: "absolute", top: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", top: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderBottom: "none", borderRadius: "2px", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderTop: "none", borderRadius: "2px", pointerEvents: "none" }} />
                  <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700, color: "#f5c842" }}>Peer-to-Peer XP Trade</h3>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "24px" }}>
                    Transfer XP to another player for collaboration or assistance. Note: All trades require Admin approval.
                  </p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>RECIPIENT BRANDNAME</label>
                      <select 
                        className="input-field" 
                        value={tradeData.toId}
                        onChange={(e) => setTradeData({...tradeData, toId: e.target.value})}
                      >
                        <option value="">Select Player...</option>
                        {allPlayers.map(s => <option key={s.id} value={s.id}>@{s.brandName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>XP AMOUNT</label>
                      <input 
                        type="number" className="input-field" placeholder="0" 
                        value={tradeData.amount || ""}
                        onChange={(e) => setTradeData({...tradeData, amount: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>ADD A NOTE</label>
                      <textarea 
                        className="input-field" placeholder="Why are you trading this XP?" 
                        value={tradeData.note}
                        onChange={(e) => setTradeData({...tradeData, note: e.target.value})}
                      />
                    </div>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        if (!tradeData.toId || tradeData.amount <= 0) return showToast("Please fill all trade details", "error");
                        
                        const newTrade = {
                          id: Math.random().toString(36).substr(2, 9),
                          fromId: user.id,
                          toId: tradeData.toId,
                          amount: tradeData.amount,
                          note: tradeData.note,
                          status: "pending",
                          createdAt: new Date().toISOString(),
                          date: new Date().toISOString(),
                          type: 'trade'
                        };
                        
                        setHistory([newTrade, ...history]);
                        showToast("Trade request sent! Waiting for Admin approval.", "success");
                        setTradeData({ toId: "", amount: 0, note: "" });
                      }}
                    >Send Trade Request 🤝</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "stake" && (() => {
              const myStudio = mockStartupStudios.find(s => s.id === user?.studioId);
              const myActiveStake = studioInvestments.find(i => i.playerId === user?.id && i.studioId === user?.studioId && i.status === "active");
              const maxStakePct = user ? getStudioMaxStakePercent(user.rank) : 5;
              const maxStakeXC = myStudio ? Math.floor(myStudio.xcPool * maxStakePct / 100) : 0;
              const estimatedReturn = myStudio && stakeAmount > 0 ? Math.floor((myStudio.xcPool * (stakeAmount / myStudio.xcPool)) * 0.05) : 0;

              if (!myStudio) {
                return (
                  <div style={{
                    background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "20px", padding: "40px 28px", textAlign: "center",
                    position: "relative",
                    boxShadow: "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)",
                  }}>
                    <div style={{ position: "absolute", top: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", top: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />
                    <div style={{ fontSize: "40px", marginBottom: "16px" }}>🏢</div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "#fff" }}>No Studio Assigned</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                      Complete the Checkpoint Alpha Diagnostic to be placed in a Startup Studio.
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Studio identity card */}
                  <div style={{
                    background: `rgba(${myStudio.colorRgb},0.06)`,
                    border: `1px solid rgba(${myStudio.colorRgb},0.3)`,
                    borderRadius: "20px", padding: "24px",
                    position: "relative",
                    boxShadow: `0 0 20px rgba(${myStudio.colorRgb},0.08), inset 0 0 20px rgba(${myStudio.colorRgb},0.03)`,
                  }}>
                    {[
                      { top: "8px", left: "8px", borderRight: "none", borderBottom: "none" },
                      { top: "8px", right: "8px", borderLeft: "none", borderBottom: "none" },
                      { bottom: "8px", left: "8px", borderRight: "none", borderTop: "none" },
                      { bottom: "8px", right: "8px", borderLeft: "none", borderTop: "none" },
                    ].map((pos, i) => (
                      <div key={i} style={{ position: "absolute", width: "14px", height: "14px", ...pos, border: `2px solid rgba(${myStudio.colorRgb},0.5)`, borderRadius: "2px", pointerEvents: "none" }} />
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
                      <div style={{
                        width: "56px", height: "56px", borderRadius: "14px",
                        background: `rgba(${myStudio.colorRgb},0.15)`,
                        border: `1px solid rgba(${myStudio.colorRgb},0.35)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "26px",
                        boxShadow: `0 0 16px rgba(${myStudio.colorRgb},0.2)`,
                      }}>{myStudio.icon}</div>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: myStudio.color, marginBottom: "2px" }}>{myStudio.name}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{myStudio.tagline}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                      {[
                        { label: "STUDIO POOL", value: `${myStudio.xcPool.toLocaleString()} XC`, icon: "⚡" },
                        { label: "YOUR MAX STAKE", value: `${maxStakePct}%`, icon: "📊" },
                        { label: "TAX RATE", value: `${Math.round(myStudio.corporateTaxRate * 100)}%/season`, icon: "🏛" },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          background: `rgba(${myStudio.colorRgb},0.08)`,
                          border: `1px solid rgba(${myStudio.colorRgb},0.15)`,
                          borderRadius: "10px", padding: "12px 10px", textAlign: "center",
                        }}>
                          <div style={{ fontSize: "14px", marginBottom: "4px" }}>{stat.icon}</div>
                          <div style={{ fontSize: "14px", fontWeight: 800, color: myStudio.color }}>{stat.value}</div>
                          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current stake status */}
                  {myActiveStake && (
                    <div style={{
                      background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: "14px", padding: "16px 20px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e", marginBottom: "2px" }}>✅ Active Stake</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                          {myActiveStake.stakeXC.toLocaleString()} XC staked · {myActiveStake.stakePercent}% of pool
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#22c55e" }}>+{myActiveStake.earnedReturn || 0} XC</div>
                        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>EARNED RETURNS</div>
                      </div>
                    </div>
                  )}

                  {/* Stake / Withdraw form */}
                  <div style={{
                    background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)",
                    borderRadius: "20px", padding: "24px",
                    position: "relative",
                    boxShadow: "0 0 16px rgba(0,212,255,0.06), inset 0 0 16px rgba(0,212,255,0.03)",
                  }}>
                    <div style={{ position: "absolute", top: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", top: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.38)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />

                    {/* Action toggle */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "22px" }}>
                      {(["stake", "withdraw"] as const).map(action => (
                        <button key={action} onClick={() => setStakeAction(action)} style={{
                          flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                          background: stakeAction === action ? (action === "stake" ? `rgba(${myStudio.colorRgb},0.2)` : "rgba(239,68,68,0.15)") : "rgba(255,255,255,0.04)",
                          color: stakeAction === action ? (action === "stake" ? myStudio.color : "#ef4444") : "rgba(255,255,255,0.35)",
                          fontSize: "12px", fontWeight: 700, cursor: "pointer",
                          border: `1px solid ${stakeAction === action ? (action === "stake" ? `rgba(${myStudio.colorRgb},0.4)` : "rgba(239,68,68,0.3)") : "rgba(255,255,255,0.08)"}`,
                          letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s",
                        }}>
                          {action === "stake" ? "📈 Place Stake" : "📤 Withdraw"}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>
                        {stakeAction === "stake" ? "STAKE AMOUNT (XC)" : "WITHDRAW AMOUNT (XC)"}
                      </label>
                      <input
                        type="number" className="input-field" placeholder="0"
                        min="1" max={stakeAction === "stake" ? (user?.xcoin ?? 0) : (myActiveStake?.stakeXC ?? 0)}
                        value={stakeAmount || ""}
                        onChange={e => setStakeAmount(parseInt(e.target.value) || 0)}
                      />
                      {stakeAction === "stake" && (
                        <div style={{ marginTop: "6px", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                          Max stake based on your Evo Rank: <strong style={{ color: myStudio.color }}>{maxStakeXC.toLocaleString()} XC ({maxStakePct}% of pool)</strong>
                        </div>
                      )}
                    </div>

                    {stakeAction === "stake" && stakeAmount > 0 && (
                      <div style={{
                        background: `rgba(${myStudio.colorRgb},0.08)`,
                        border: `1px solid rgba(${myStudio.colorRgb},0.2)`,
                        borderRadius: "10px", padding: "14px 16px", marginBottom: "16px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>Pool share</span>
                          <span style={{ fontSize: "12px", color: myStudio.color, fontWeight: 700 }}>
                            {((stakeAmount / myStudio.xcPool) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>Estimated return</span>
                          <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 700 }}>+{estimatedReturn} XC/season</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>Corporate tax</span>
                          <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700 }}>
                            -{Math.floor(estimatedReturn * myStudio.corporateTaxRate)} XC/season
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (!user || stakeAmount <= 0) return showToast("Enter a valid amount", "error");
                        if (stakeAction === "stake") {
                          if (stakeAmount > (user.xcoin ?? 0)) return showToast("Insufficient XC balance", "error");
                          if (stakeAmount > maxStakeXC) return showToast(`Max stake at your rank is ${maxStakeXC} XC`, "error");
                          const newStake: StudioInvestment & { type: string; date: string } = {
                            id: Math.random().toString(36).substr(2, 9),
                            playerId: user.id,
                            studioId: myStudio.id,
                            stakeXC: stakeAmount,
                            stakePercent: parseFloat(((stakeAmount / myStudio.xcPool) * 100).toFixed(2)),
                            status: "active",
                            createdAt: new Date().toISOString(),
                            earnedReturn: 0,
                            type: "stake",
                            date: new Date().toISOString(),
                          };
                          mockStudioInvestments.push(newStake);
                          setStudioInvestments([...mockStudioInvestments]);
                          setHistory([newStake, ...history]);
                          setStakeAmount(0);
                          showToast(`Staked ${stakeAmount} XC in ${myStudio.name}! 🏢`, "success");
                        } else {
                          if (!myActiveStake) return showToast("No active stake to withdraw", "error");
                          if (stakeAmount > myActiveStake.stakeXC) return showToast("Withdrawal exceeds current stake", "error");
                          myActiveStake.stakeXC -= stakeAmount;
                          if (myActiveStake.stakeXC <= 0) myActiveStake.status = "withdrawn";
                          setStudioInvestments([...mockStudioInvestments]);
                          setStakeAmount(0);
                          showToast(`Withdrew ${stakeAmount} XC from ${myStudio.name}`, "success");
                        }
                      }}
                      className="btn-primary"
                      style={{
                        background: stakeAction === "stake"
                          ? `linear-gradient(135deg, rgba(${myStudio.colorRgb},0.8), rgba(${myStudio.colorRgb},0.5))`
                          : "rgba(239,68,68,0.15)",
                        border: stakeAction === "stake" ? "none" : "1px solid rgba(239,68,68,0.3)",
                        color: stakeAction === "stake" ? "#fff" : "#ef4444",
                        width: "100%",
                      }}
                    >
                      {stakeAction === "stake" ? `Place Stake of ${stakeAmount || 0} XC 🏢` : `Withdraw ${stakeAmount || 0} XC 📤`}
                    </button>
                  </div>

                  {/* Rank abilities info */}
                  <div style={{
                    background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.15)",
                    borderRadius: "14px", padding: "16px 18px",
                    display: "flex", gap: "14px", alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "22px", flexShrink: 0 }}>🏆</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#f5c842", marginBottom: "4px" }}>Rank Stake Limits</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                        Evo Rank 1–2: 5% · Rank 3–4: 10% · Rank 5–6: 20% · Rank 7–8: 35% · Rank 9–10: 50%
                        {user && <span style={{ color: "#f5c842" }}> — Your current max: <strong>{maxStakePct}%</strong></span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Info Card */}
            <div style={{
              marginTop: "40px", background: "rgba(79,142,247,0.05)", border: "1px solid rgba(79,142,247,0.2)",
              borderRadius: "20px", padding: "24px", display: "flex", gap: "20px"
            }}>
              <span style={{ fontSize: "28px" }}>📘</span>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#4f8ef7" }}>X-Tracker Protocol</p>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Instructors review each coin separately. Make sure you attach the correct evidence for each request to ensure a smooth approval process!
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: Recent Submissions */}
          <aside>
            <div style={{
              background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "24px", padding: "24px", position: "sticky", top: "32px"
            }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, color: "#f0f0ff" }}>Recent Submissions</h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.3 }}>
                    <p style={{ margin: 0, fontSize: "13px" }}>No recent activity</p>
                  </div>
                ) : (
                  history.map((item) => {
                    const style = statusStyle(item.status);
                    const isTrade = item.type === 'trade';
                    const isStake = item.type === 'stake';
                    const isCoin = item.type === 'coin';

                    let title = "";
                    let subtitle = "";
                    let amountLabel = "";
                    let amountValue = "";
                    let icon = "";

                    if (isCoin) {
                      title = item.coinType;
                      subtitle = item.reason;
                      amountLabel = "XC";
                      amountValue = `+${(COIN_CATEGORIES.flatMap(c => c.coins).find(c => c.name === item.coinType)?.xc || 0) * item.amount} XC`;
                      icon = "🪙";
                    } else if (isTrade) {
                      const recipient = allPlayers.find(s => s.id === item.toId);
                      title = `Trade to @${recipient?.brandName || 'Player'}`;
                      subtitle = item.note || "No note";
                      amountLabel = "Transfer";
                      amountValue = `-${item.amount} XP`;
                      icon = "🤝";
                    } else if (isStake) {
                      const studio = mockStartupStudios.find(s => s.id === item.studioId);
                      title = `Studio Stake: ${studio?.name || 'Studio'}`;
                      subtitle = `${item.stakePercent}% pool share · ${item.earnedReturn ?? 0} XC returned`;
                      amountLabel = "Staked";
                      amountValue = `-${item.stakeXC} XC`;
                      icon = "🏢";
                    }

                    return (
                      <div key={`${item.type}-${item.id}`} style={{
                        padding: "16px", background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#f0f0ff", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{icon}</span> {title}
                          </p>
                          <span style={{ 
                            fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "100px",
                            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                            textTransform: "uppercase"
                          }}>
                            {item.status}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 12px", fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {subtitle}
                        </p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                            {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: isCoin ? "#f5c842" : isStake ? "#a78bfa" : "#4f8ef7" }}>
                              {amountValue}
                            </p>
                            <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
                              {isCoin ? `${item.amount} ${amountLabel}` : `${amountLabel}: ${isStake ? item.stakeXC : item.amount}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
