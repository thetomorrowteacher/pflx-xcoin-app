"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, PFLXModifier, mockModifiers, mockPlayerModifiers, PlayerModifier, mockTransactions, getCurrentRank, SHIP_TIERS, ShipTier, PlayerShipState, getDefaultShipState } from "../../lib/data";
import { playSuccess, playError, playCashRegister } from "../../lib/sounds";

export default function PlayerMarketplace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [upgrades, setUpgrades] = useState<PFLXModifier[]>([]);
  const [myModifiers, setMyModifiers] = useState<PlayerModifier[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"upgrades" | "shipbay">("upgrades");
  const [shipState, setShipState] = useState<PlayerShipState>(getDefaultShipState());
  const [selectedShip, setSelectedShip] = useState<ShipTier | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    // Onboarding now owned by PFLX Platform SSO — no per-route gate needed
    setUser(u);
    // Filter upgrades by availability restrictions
    const playerRank = getCurrentRank(u.totalXcoin, u).level;
    const allUpgrades = mockModifiers.filter(m => m.type === "upgrade");
    const visibleUpgrades = allUpgrades.filter(m => {
      if (!m.availableTo || m.availableTo === "all") return true;
      // Check rank restrictions
      if (m.minRank && playerRank < m.minRank) return false;
      if (m.maxRank && playerRank > m.maxRank) return false;
      // Check level restrictions
      if (m.minLevel && u.level < m.minLevel) return false;
      // Check cohort restrictions
      if (m.allowedCohorts && m.allowedCohorts.length > 0 && !m.allowedCohorts.includes(u.cohort)) return false;
      // Check studio restrictions
      if (m.allowedStudios && m.allowedStudios.length > 0 && (!u.studioId || !m.allowedStudios.includes(u.studioId))) return false;
      return true;
    });
    setUpgrades(visibleUpgrades);
    setMyModifiers(mockPlayerModifiers.filter(m => m.playerId === u.id));

    // Load ship state
    try {
      const saved = localStorage.getItem("pflx_ship_state");
      if (saved) setShipState(JSON.parse(saved));
    } catch(e) {}
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

    playCashRegister();
    showToast(`Successfully purchased ${mod.name}! 🚀`, "success");
  };

  const saveShipState = (newState: PlayerShipState) => {
    setShipState(newState);
    localStorage.setItem("pflx_ship_state", JSON.stringify(newState));
    localStorage.setItem("pflx_ship_upgrades", JSON.stringify(newState)); // Cross-app compat
    // Notify pathway page via postMessage
    try {
      window.parent.postMessage({ type: "pflx_ship_state_update", state: newState }, "*");
    } catch(e) {}
  };

  const purchaseShip = (ship: ShipTier) => {
    if (!user) return;
    if (shipState.ownedTiers.includes(ship.id)) {
      // Already owned — equip it
      const ns = { ...shipState, equippedTier: ship.id, equippedHull: ship.hullOptions[0].id, equippedEngine: ship.engineOptions[0].id, equippedTrail: ship.trailOptions[0].id };
      saveShipState(ns);
      playSuccess();
      showToast(`Equipped ${ship.name}! 🚀`, "success");
      return;
    }
    if (user.xcoin < ship.costXC) {
      playError();
      showToast("Not enough XC for this ship.", "error");
      return;
    }
    const rank = getCurrentRank(user.totalXcoin, user).level;
    if (rank < ship.minRank) {
      playError();
      showToast(`Requires Rank ${ship.minRank}+ to purchase.`, "error");
      return;
    }
    // Deduct XC
    const updatedUser = { ...user, xcoin: user.xcoin - ship.costXC };
    setUser(updatedUser);
    localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
    // Record transaction
    mockTransactions.push({
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: "spent",
      amount: ship.costXC,
      currency: "xcoin",
      description: `Purchased Ship: ${ship.name}`,
      createdAt: new Date().toISOString().split("T")[0]
    });
    // Update ship state
    const ns = {
      ...shipState,
      ownedTiers: [...shipState.ownedTiers, ship.id],
      equippedTier: ship.id,
      equippedHull: ship.hullOptions[0].id,
      equippedEngine: ship.engineOptions[0].id,
      equippedTrail: ship.trailOptions[0].id,
    };
    saveShipState(ns);
    playCashRegister();
    showToast(`${ship.name} acquired and equipped! 🚀`, "success");
  };

  const equipCustomization = (type: "hull" | "engine" | "trail", optionId: string) => {
    const ns = { ...shipState };
    if (type === "hull") ns.equippedHull = optionId;
    else if (type === "engine") ns.equippedEngine = optionId;
    else if (type === "trail") ns.equippedTrail = optionId;
    saveShipState(ns);
    playSuccess();
  };

  const currentShip = SHIP_TIERS.find(s => s.id === shipState.equippedTier) || SHIP_TIERS[0];
  const playerRank = user ? getCurrentRank(user.totalXcoin, user).level : 1;

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

        {/* ── Tab Switcher ── */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px" }}>
          {(["upgrades", "shipbay"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 24px", borderRadius: "10px", fontWeight: 700, fontSize: "13px",
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
              border: activeTab === tab ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === tab ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
              color: activeTab === tab ? "#00d4ff" : "rgba(255,255,255,0.4)",
              textShadow: activeTab === tab ? "0 0 10px rgba(0,212,255,0.4)" : "none",
              boxShadow: activeTab === tab ? "0 0 15px rgba(0,212,255,0.15)" : "none",
              transition: "all 0.3s",
            }}>{tab === "upgrades" ? "🛒 Upgrades" : "🚀 Ship Bay"}</button>
          ))}
        </div>

        {/* ═══════ SHIP BAY TAB ═══════ */}
        {activeTab === "shipbay" && (
          <div>
            {/* Current Ship Banner */}
            <div style={{
              marginBottom: "32px", padding: "24px",
              background: `linear-gradient(135deg, rgba(0,212,255,0.06), rgba(167,139,250,0.04))`,
              border: "1px solid rgba(0,212,255,0.25)", borderRadius: "16px",
              display: "flex", alignItems: "center", gap: "24px",
              boxShadow: "0 0 30px rgba(0,212,255,0.08)"
            }}>
              <div style={{
                width: "80px", height: "80px", borderRadius: "20px",
                background: `radial-gradient(circle at 30% 30%, ${currentShip.hullColor}40, transparent)`,
                border: `2px solid ${currentShip.hullColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "36px",
                boxShadow: `0 0 25px ${currentShip.hullColor}30`
              }}>🚀</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>CURRENT SHIP</div>
                <div style={{ fontSize: "22px", fontWeight: 900, color: currentShip.hullColor, textShadow: `0 0 15px ${currentShip.hullColor}60`, letterSpacing: "0.05em" }}>{currentShip.name}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginTop: "2px" }}>{currentShip.tagline}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em" }}>TIER {currentShip.tier} / 6</div>
                <button onClick={() => setCustomizing(customizing ? null : currentShip.id)} style={{
                  marginTop: "8px", padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                  background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
                  color: "#00d4ff", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em",
                }}>CUSTOMIZE</button>
              </div>
            </div>

            {/* Customization Panel */}
            {customizing && (() => {
              const ship = SHIP_TIERS.find(s => s.id === customizing);
              if (!ship || !shipState.ownedTiers.includes(ship.id)) return null;
              return (
                <div style={{
                  marginBottom: "32px", padding: "20px",
                  background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: "14px"
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#00d4ff", marginBottom: "16px", letterSpacing: "0.08em" }}>CUSTOMIZE {ship.name.toUpperCase()}</div>

                  {/* Hull Colors */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", letterSpacing: "0.1em" }}>HULL COLOR</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {ship.hullOptions.map(h => (
                        <button key={h.id} onClick={() => equipCustomization("hull", h.id)} style={{
                          width: "40px", height: "40px", borderRadius: "10px", cursor: "pointer",
                          background: h.color, border: shipState.equippedHull === h.id ? "3px solid white" : "2px solid rgba(255,255,255,0.15)",
                          boxShadow: shipState.equippedHull === h.id ? `0 0 15px ${h.color}80` : "none",
                          transition: "all 0.2s",
                        }} title={h.name} />
                      ))}
                    </div>
                  </div>

                  {/* Engine Glow */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", letterSpacing: "0.1em" }}>ENGINE GLOW</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {ship.engineOptions.map(e => (
                        <button key={e.id} onClick={() => equipCustomization("engine", e.id)} style={{
                          width: "40px", height: "40px", borderRadius: "10px", cursor: "pointer",
                          background: `radial-gradient(circle, ${e.color}, ${e.color}40)`,
                          border: shipState.equippedEngine === e.id ? "3px solid white" : "2px solid rgba(255,255,255,0.15)",
                          boxShadow: shipState.equippedEngine === e.id ? `0 0 15px ${e.color}80` : "none",
                          transition: "all 0.2s",
                        }} title={e.name} />
                      ))}
                    </div>
                  </div>

                  {/* Trail Effect */}
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", letterSpacing: "0.1em" }}>TRAIL EFFECT</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {ship.trailOptions.map(t => (
                        <button key={t.id} onClick={() => equipCustomization("trail", t.id)} style={{
                          padding: "8px 14px", borderRadius: "10px", cursor: "pointer",
                          background: shipState.equippedTrail === t.id ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
                          border: shipState.equippedTrail === t.id ? "2px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
                          color: shipState.equippedTrail === t.id ? "#00d4ff" : "rgba(255,255,255,0.5)",
                          fontSize: "12px", fontWeight: 600, transition: "all 0.2s",
                        }}>{t.emoji} {t.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Ship Tier Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
              {SHIP_TIERS.map(ship => {
                const owned = shipState.ownedTiers.includes(ship.id);
                const equipped = shipState.equippedTier === ship.id;
                const canAfford = user.xcoin >= ship.costXC;
                const rankOk = playerRank >= ship.minRank;
                const canBuy = !owned && canAfford && rankOk;
                const isNeon = ship.id === "ship-t6-fx824";

                return (
                  <div key={ship.id} style={{
                    background: isNeon
                      ? "linear-gradient(135deg, rgba(255,0,255,0.08), rgba(0,255,255,0.05), rgba(255,0,255,0.08))"
                      : "rgba(0,212,255,0.04)",
                    border: equipped ? `2px solid ${ship.hullColor}` : owned ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "20px", padding: "24px",
                    position: "relative", overflow: "hidden",
                    boxShadow: equipped ? `0 0 30px ${ship.hullColor}25, inset 0 0 30px ${ship.hullColor}08` : "none",
                    transition: "all 0.3s",
                    animation: isNeon && owned ? "neonShipGlow 3s ease-in-out infinite alternate" : "none",
                  }}>
                    {/* Tier badge */}
                    <div style={{
                      position: "absolute", top: "12px", right: "12px",
                      background: `${ship.hullColor}20`, border: `1px solid ${ship.hullColor}40`,
                      borderRadius: "8px", padding: "4px 10px",
                      fontSize: "10px", fontWeight: 800, color: ship.hullColor,
                      letterSpacing: "0.15em",
                    }}>TIER {ship.tier}</div>

                    {/* Ship icon + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                      <div style={{
                        width: "56px", height: "56px", borderRadius: "14px",
                        background: `radial-gradient(circle at 30% 30%, ${ship.hullColor}50, ${ship.hullColor}10)`,
                        border: `1px solid ${ship.hullColor}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "28px",
                        boxShadow: `0 0 20px ${ship.hullColor}20`,
                      }}>🚀</div>
                      <div>
                        <div style={{
                          fontSize: "20px", fontWeight: 900,
                          color: ship.hullColor,
                          textShadow: `0 0 12px ${ship.hullColor}50`,
                          letterSpacing: "0.04em",
                        }}>{ship.name}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{ship.tagline}</div>
                      </div>
                    </div>

                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: "16px" }}>{ship.description}</p>

                    {/* Features */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "10px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em", marginBottom: "6px" }}>FEATURES</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {ship.features.map((f, i) => (
                          <span key={i} style={{
                            fontSize: "10px", padding: "3px 8px", borderRadius: "6px",
                            background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                            color: "rgba(0,212,255,0.7)", letterSpacing: "0.02em",
                          }}>{f}</span>
                        ))}
                      </div>
                    </div>

                    {/* Cosmetics preview */}
                    <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                      {ship.hullOptions.map(h => (
                        <div key={h.id} style={{
                          width: "18px", height: "18px", borderRadius: "5px",
                          background: h.color, border: "1px solid rgba(255,255,255,0.2)",
                        }} title={h.name} />
                      ))}
                    </div>

                    {/* Price + action */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        {ship.costXC === 0 ? (
                          <span style={{ fontSize: "14px", fontWeight: 800, color: "#22c55e" }}>FREE</span>
                        ) : (
                          <span style={{
                            padding: "6px 12px", borderRadius: "8px",
                            background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.3)",
                            color: "#f5c842", fontSize: "14px", fontWeight: 800,
                          }}>🪙 {ship.costXC.toLocaleString()} XC</span>
                        )}
                        {ship.minRank > 1 && (
                          <span style={{ marginLeft: "8px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Rank {ship.minRank}+</span>
                        )}
                      </div>
                      <button
                        onClick={() => equipped ? setCustomizing(customizing === ship.id ? null : ship.id) : purchaseShip(ship)}
                        disabled={!owned && !canBuy}
                        style={{
                          padding: "8px 18px", borderRadius: "10px", fontWeight: 700, fontSize: "12px",
                          cursor: (owned || canBuy) ? "pointer" : "not-allowed",
                          background: equipped ? "rgba(0,212,255,0.15)" : owned ? "rgba(34,197,94,0.12)" : canBuy ? `linear-gradient(135deg, ${ship.hullColor}20, ${ship.hullColor}10)` : "rgba(255,255,255,0.03)",
                          color: equipped ? "#00d4ff" : owned ? "#22c55e" : canBuy ? ship.hullColor : "rgba(255,255,255,0.2)",
                          border: equipped ? "1px solid rgba(0,212,255,0.4)" : owned ? "1px solid rgba(34,197,94,0.3)" : canBuy ? `1px solid ${ship.hullColor}40` : "1px solid rgba(255,255,255,0.08)",
                          letterSpacing: "0.08em",
                          transition: "all 0.3s",
                        }}
                      >
                        {equipped ? "CUSTOMIZE" : owned ? "EQUIP" : canBuy ? "PURCHASE" : !rankOk ? `RANK ${ship.minRank}+` : "NOT ENOUGH XC"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Neon glow keyframe for FX-824 */}
            <style>{`
              @keyframes neonShipGlow {
                0% { box-shadow: 0 0 20px rgba(255,0,255,0.15), 0 0 40px rgba(0,255,255,0.08), inset 0 0 20px rgba(255,0,255,0.05); }
                33% { box-shadow: 0 0 25px rgba(0,255,255,0.15), 0 0 50px rgba(255,0,255,0.1), inset 0 0 25px rgba(0,255,255,0.05); }
                66% { box-shadow: 0 0 20px rgba(255,200,0,0.12), 0 0 40px rgba(255,0,255,0.08), inset 0 0 20px rgba(255,200,0,0.04); }
                100% { box-shadow: 0 0 25px rgba(255,0,255,0.18), 0 0 50px rgba(0,255,255,0.1), inset 0 0 25px rgba(255,0,255,0.06); }
              }
            `}</style>
          </div>
        )}

        {/* ═══════ UPGRADES TAB ═══════ */}
        {activeTab === "upgrades" && <>
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
        </>}
      </main>
    </div>
  );
}
