"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, PFLXModifier, mockModifiers, mockPlayerModifiers, PlayerModifier, mockTransactions } from "../../lib/data";
import { playSuccess, playError } from "../../lib/sounds";

export default function PlayerMarketplace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [upgrades, setUpgrades] = useState<PFLXModifier[]>([]);
  const [myModifiers, setMyModifiers] = useState<PlayerModifier[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    setUser(u);
    setUpgrades(mockModifiers.filter(m => m.type === "upgrade"));
    setMyModifiers(mockPlayerModifiers.filter(m => m.playerId === u.id));
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const purchaseUpgrade = (mod: PFLXModifier) => {
    if (!user) return;
    if (user.xcoin < mod.costXcoin || user.digitalBadges < mod.costBadge) {
      playError();
      showToast("Insufficient balance for this purchase.", "error");
      return;
    }

    // Deduct cost
    const updatedUser = { ...user, xp: user.xcoin - mod.costXcoin, xc: user.digitalBadges - mod.costXcoin };
    setUser(updatedUser);
    localStorage.setItem("pflx_user", JSON.stringify(updatedUser));

    // Record Transaction
    if (mod.costXcoin > 0) {
      mockTransactions.push({
        id: `tx-${Date.now()}`,
        userId: user.id,
        type: "spent",
        amount: mod.costXcoin,
        currency: "xcoin",
        description: `Purchased Upgrade: ${mod.name}`,
        createdAt: new Date().toISOString().split("T")[0]
      });
    }

    // Add to inventory
    const newMod: PlayerModifier = {
      id: `pm-${Date.now()}`,
      playerId: user.id,
      modifierId: mod.id,
      status: "active",
      acquiredAt: new Date().toISOString()
    };
    mockPlayerModifiers.push(newMod);
    setMyModifiers([...myModifiers, newMod]);

    playSuccess();
    showToast(`Successfully purchased ${mod.name}! 🚀`, "success");
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06090d" }}>
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
          <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>🛒 MARKETPLACE</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ SPEND YOUR EARNED XP & DIGITAL BADGES ON UPGRADES ]</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
             <div style={{
               background: "rgba(245,200,66,0.08)",
               border: "1px solid rgba(245,200,66,0.35)",
               borderRadius: "10px",
               padding: "8px 16px",
               boxShadow: "0 0 12px rgba(245,200,66,0.2), inset 0 0 12px rgba(245,200,66,0.05)"
             }}>
               <span style={{ fontSize: "12px", color: "rgba(245,200,66,0.7)" }}>XC BALANCE</span>
               <div style={{ fontSize: "18px", fontWeight: 800, color: "#f5c842", textShadow: "0 0 10px rgba(245,200,66,0.6)" }}>🏅 {user.digitalBadges}</div>
             </div>
             <div style={{
               background: "rgba(79,142,247,0.08)",
               border: "1px solid rgba(79,142,247,0.35)",
               borderRadius: "10px",
               padding: "8px 16px",
               boxShadow: "0 0 12px rgba(79,142,247,0.2), inset 0 0 12px rgba(79,142,247,0.05)"
             }}>
               <span style={{ fontSize: "12px", color: "rgba(79,142,247,0.7)" }}>XP BALANCE</span>
               <div style={{ fontSize: "18px", fontWeight: 800, color: "#a78bfa", textShadow: "0 0 10px rgba(167,139,250,0.6)" }}>⚡ {user.xcoin}</div>
             </div>
          </div>
        </div>

        {/* My Active Modifiers Banner */}
        {myModifiers.length > 0 && (
          <div style={{
            marginBottom: "40px",
            padding: "20px",
            background: "rgba(0,212,255,0.05)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "16px",
            boxShadow: "0 0 20px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.05)"
          }}>
            <h2 style={{
              margin: "0 0 12px",
              fontSize: "16px",
              color: "#00d4ff",
              textShadow: "0 0 15px rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.1em"
            }}>⚡ YOUR ACTIVE UPGRADES</h2>
            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
              {myModifiers.map(pm => {
                const upg = upgrades.find(u => u.id === pm.modifierId) || mockModifiers.find(m => m.id === pm.modifierId);
                return upg ? (
                  <div key={pm.id} style={{
                    minWidth: "200px",
                    background: "rgba(0,212,255,0.05)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "12px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    boxShadow: "0 0 15px rgba(0,212,255,0.1)"
                  }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      background: "rgba(0,212,255,0.1)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      boxShadow: "0 0 10px rgba(0,212,255,0.2)"
                    }}>
                      {upg.image ? <img src={upg.image} style={{ width: "100%", height: "100%", borderRadius: "8px", objectFit: "cover" }} /> : upg.icon}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#00d4ff", textShadow: "0 0 8px rgba(0,212,255,0.4)" }}>{upg.name}</p>
                      <p style={{ margin: 0, fontSize: "10px", color: "rgba(0,212,255,0.6)" }}>Status: <span style={{ color: "#22c55e", textShadow: "0 0 8px rgba(34,197,94,0.4)" }}>ACTIVE</span></p>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {upgrades.map(mod => {
            const hasEnough = user.xcoin >= mod.costXcoin && user.digitalBadges >= mod.costXcoin;

            return (
              <div key={mod.id} style={{
                background: "rgba(0,212,255,0.05)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "20px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 0 20px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.03)",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.3s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 30px rgba(0,212,255,0.3), inset 0 0 30px rgba(0,212,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 20px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)";
              }}>
                {/* Corner brackets */}
                <div style={{ position: "absolute", top: "8px", left: "8px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                <div style={{ position: "absolute", top: "8px", right: "8px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
                <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />

                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    overflow: "hidden",
                    boxShadow: "0 0 15px rgba(0,212,255,0.2)"
                  }}>
                    {mod.image ? <img src={mod.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mod.icon}
                  </div>
                  <div>
                    <h3 style={{
                      margin: "0 0 4px",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#00d4ff",
                      textShadow: "0 0 12px rgba(0,212,255,0.4)"
                    }}>{mod.name}</h3>
                    <span style={{
                      fontSize: "11px",
                      color: "rgba(0,212,255,0.6)",
                      padding: "2px 6px",
                      background: "rgba(0,212,255,0.1)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      ⏳ {mod.duration}
                    </span>
                  </div>
                </div>

                <p style={{
                  margin: "0 0 20px",
                  fontSize: "14px",
                  color: "rgba(0,212,255,0.7)",
                  lineHeight: 1.5,
                  flex: 1
                }}>
                  {mod.description}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {mod.costXcoin > 0 && (
                      <span style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: "rgba(167,139,250,0.1)",
                        border: "1px solid rgba(167,139,250,0.3)",
                        color: "#a78bfa",
                        fontSize: "14px",
                        fontWeight: 800,
                        textShadow: "0 0 8px rgba(167,139,250,0.4)",
                        boxShadow: "0 0 10px rgba(167,139,250,0.15)"
                      }}>
                        ⚡ {mod.costXcoin} XC
                      </span>
                    )}
                    {mod.costXcoin > 0 && (
                      <span style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: "rgba(245,200,66,0.1)",
                        border: "1px solid rgba(245,200,66,0.3)",
                        color: "#f5c842",
                        fontSize: "14px",
                        fontWeight: 800,
                        textShadow: "0 0 8px rgba(245,200,66,0.4)",
                        boxShadow: "0 0 10px rgba(245,200,66,0.15)"
                      }}>
                        🪙 {mod.costXcoin} XC
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => purchaseUpgrade(mod)}
                    disabled={!hasEnough}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      cursor: hasEnough ? "pointer" : "not-allowed",
                      background: hasEnough ? "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(167,139,250,0.1))" : "rgba(255,255,255,0.03)",
                      color: hasEnough ? "#00d4ff" : "rgba(0,212,255,0.3)",
                      border: hasEnough ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      textShadow: hasEnough ? "0 0 8px rgba(0,212,255,0.4)" : "none",
                      boxShadow: hasEnough ? "0 0 12px rgba(0,212,255,0.2)" : "none",
                      transition: "all 0.3s ease"
                    }}
                    onMouseEnter={(e) => {
                      if (hasEnough) {
                        e.currentTarget.style.boxShadow = "0 0 20px rgba(0,212,255,0.4), inset 0 0 12px rgba(0,212,255,0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hasEnough) {
                        e.currentTarget.style.boxShadow = "0 0 12px rgba(0,212,255,0.2)";
                      }
                    }}
                  >
                    {hasEnough ? "PURCHASE" : "NOT ENOUGH"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
