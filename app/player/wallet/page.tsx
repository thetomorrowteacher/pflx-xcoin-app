"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, mockTransactions, Transaction, mockSubmissions, COIN_CATEGORIES, Coin } from "../../lib/data";

export default function PlayerWallet() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const myTxns = [...mockTransactions].filter((t) => t.userId === user.id).reverse();
  const approvedSubmissions = mockSubmissions.filter(s => s.playerId === user.id && s.status === "approved");
  
  // Calculate badge counts
  const badgeCounts: Record<string, number> = {};
  approvedSubmissions.forEach(s => {
    badgeCounts[s.coinType] = (badgeCounts[s.coinType] || 0) + s.amount;
  });

  const typeIcon: Record<Transaction["type"], string> = {
    earned: "✅",
    spent: "💸",
    admin_grant: "🎁",
    pflx_tax: "🚫",
    investment_return: "📈",
    investment_stake: "🤝"
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06090d" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>🪙 WALLET & COLLECTION</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ VIEW YOUR DIGITAL CURRENCY AND BADGE COLLECTION ]</p>
        </div>

        {/* Balance Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
          <div style={{
            background: "rgba(245,200,66,0.08)",
            border: "1px solid rgba(245,200,66,0.35)", borderRadius: "16px", padding: "24px",
            boxShadow: "0 0 20px rgba(245,200,66,0.15), inset 0 0 20px rgba(245,200,66,0.05)"
          }}>
            <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "rgba(245,200,66,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>DIGITAL BADGES EARNED</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "42px", fontWeight: 900, color: "#f5c842", textShadow: "0 0 15px rgba(245,200,66,0.6)" }}>{user.digitalBadges}</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "rgba(245,200,66,0.6)" }}>BADGES</span>
            </div>
          </div>
          <div style={{
            background: "rgba(79,142,247,0.08)",
            border: "1px solid rgba(79,142,247,0.35)", borderRadius: "16px", padding: "24px",
            boxShadow: "0 0 20px rgba(79,142,247,0.15), inset 0 0 20px rgba(79,142,247,0.05)"
          }}>
            <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "rgba(79,142,247,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>X-COIN (XC) BALANCE</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "42px", fontWeight: 900, color: "#a78bfa", textShadow: "0 0 15px rgba(167,139,250,0.6)" }}>{user.xcoin.toLocaleString()}</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "rgba(167,139,250,0.6)" }}>XC</span>
            </div>
          </div>
        </div>

        {/* Badge Collection Section */}
        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{
              margin: 0, fontSize: "18px", fontWeight: 700, color: "#00d4ff",
              textShadow: "0 0 15px rgba(0,212,255,0.5)",
              textTransform: "uppercase", letterSpacing: "0.1em"
            }}>🛡️ DIGITAL BADGE COLLECTION</h2>
            <span style={{ fontSize: "11px", color: "rgba(0,212,255,0.5)", fontWeight: 600 }}>UNIQUE BADGES: {Object.keys(badgeCounts).length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {COIN_CATEGORIES.map(cat => {
              const ownedInCat = cat.coins.filter(c => badgeCounts[c.name]);
              if (ownedInCat.length === 0) return null;

              return (
                <div key={cat.name}>
                  <p style={{
                    margin: "0 0 16px", fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.6)",
                    textTransform: "uppercase", letterSpacing: "0.1em"
                  }}>
                    {cat.name}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                    {ownedInCat.map(coin => (
                      <div key={coin.name} style={{
                        background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)",
                        borderRadius: "16px", padding: "20px", textAlign: "center", position: "relative",
                        boxShadow: "0 0 15px rgba(0,212,255,0.08), inset 0 0 15px rgba(0,212,255,0.02)",
                        transition: "all 0.3s ease",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 25px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,212,255,0.06)";
                        e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 15px rgba(0,212,255,0.08), inset 0 0 15px rgba(0,212,255,0.02)";
                        e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)";
                      }}>
                        {/* Corner brackets */}
                        <div style={{ position: "absolute", top: "8px", left: "8px", width: "12px", height: "12px", border: "1.5px solid rgba(0,212,255,0.3)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                        <div style={{ position: "absolute", top: "8px", right: "8px", width: "12px", height: "12px", border: "1.5px solid rgba(0,212,255,0.3)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />

                        <div style={{
                          width: "56px", height: "56px", margin: "0 auto 12px", borderRadius: "12px",
                          background: "rgba(0,212,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                          border: "1px solid rgba(0,212,255,0.2)", overflow: "hidden",
                          boxShadow: "0 0 12px rgba(0,212,255,0.15)"
                        }}>
                          {coin.image ? <img src={coin.image} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '28px'}}>🪙</span>}
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#00d4ff", textShadow: "0 0 8px rgba(0,212,255,0.4)" }}>{coin.name}</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "rgba(0,212,255,0.5)" }}>Value: {coin.xc} XC</p>

                        {/* Quantity Badge */}
                        <div style={{
                          position: "absolute", bottom: "8px", right: "8px",
                          background: "#f5c842", color: "#000", fontSize: "11px", fontWeight: 800,
                          width: "28px", height: "28px", borderRadius: "8px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 0 12px rgba(245,200,66,0.4), 0 4px 8px rgba(0,0,0,0.3)",
                          border: "1px solid rgba(255,255,255,0.2)"
                        }}>
                          {badgeCounts[coin.name]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {Object.keys(badgeCounts).length === 0 && (
              <div style={{
                padding: "60px 40px", textAlign: "center", background: "rgba(0,212,255,0.03)",
                border: "2px dashed rgba(0,212,255,0.15)", borderRadius: "20px"
              }}>
                <span style={{ fontSize: "48px", marginBottom: "16px", display: "block" }}>🕵️‍♂️</span>
                <p style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#00d4ff", textShadow: "0 0 10px rgba(0,212,255,0.4)" }}>NO BADGES COLLECTED YET</p>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(0,212,255,0.5)" }}>Submit work through the X-Tracker to start your collection!</p>
              </div>
            )}
          </div>
        </section>

        {/* Recent History */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{
              margin: 0, fontSize: "18px", fontWeight: 700, color: "#00d4ff",
              textShadow: "0 0 15px rgba(0,212,255,0.5)",
              textTransform: "uppercase", letterSpacing: "0.1em"
            }}>📊 RECENT ACTIVITY</h2>
          </div>
          <div style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "16px", overflow: "hidden" }}>
            {myTxns.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "rgba(0,212,255,0.5)", fontSize: "14px" }}>
                No transactions yet
              </div>
            ) : (
              myTxns.map((t, i) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px",
                  borderBottom: i < myTxns.length - 1 ? "1px solid rgba(0,212,255,0.08)" : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(0,212,255,0.02)"
                }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                    background: t.type === "earned" ? "rgba(34,197,94,0.12)" : t.type === "spent" ? "rgba(239,68,68,0.12)" : "rgba(0,212,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                    border: t.type === "earned" ? "1px solid rgba(34,197,94,0.2)" : t.type === "spent" ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(0,212,255,0.2)",
                    boxShadow: t.type === "earned" ? "0 0 8px rgba(34,197,94,0.15)" : t.type === "spent" ? "0 0 8px rgba(239,68,68,0.15)" : "0 0 8px rgba(0,212,255,0.15)"
                  }}>
                    {typeIcon[t.type]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: "rgba(0,212,255,0.8)" }}>{t.description}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "rgba(0,212,255,0.4)" }}>{t.createdAt}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{
                      margin: 0, fontSize: "14px", fontWeight: 700,
                      color: t.currency === "digitalBadge" ? "#f5c842" : "#a78bfa",
                      textShadow: t.currency === "digitalBadge" ? "0 0 8px rgba(245,200,66,0.4)" : "0 0 8px rgba(167,139,250,0.4)"
                    }}>
                      {t.type === "spent" || t.type === "pflx_tax" ? "-" : "+"}
                      {t.currency === "digitalBadge" ? `${t.amount} Digital Badge(s)` : `${t.amount} XC`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
