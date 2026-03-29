"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, mockUsers, mockSubmissions, COIN_CATEGORIES, getCurrentRank, getRankProgress, getXCProgress, mockStartupStudios } from "../../lib/data";
import { applyPlayerImages, savePlayerImage } from "../../lib/playerImages";

export default function PlayerProfile({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const cu = JSON.parse(stored) as User;
    setCurrentUser(cu);

    const withImages = applyPlayerImages(mockUsers);
    const foundUser = withImages.find(u => u.id === params.id);
    if (!foundUser) {
      router.push(cu.role === "admin" ? "/admin/players" : "/player/leaderboard");
      return;
    }
    setProfileUser(foundUser);
  }, [params.id, router]);

  if (!currentUser || !profileUser) return null;

  const canEdit = currentUser.role === "admin" || currentUser.id === profileUser.id;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !profileUser) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updated = { ...profileUser, image: base64 };
      setProfileUser(updated);
      savePlayerImage(profileUser.id, base64); // persist to pflx_player_images so SideNav picks it up
      const index = mockUsers.findIndex(u => u.id === profileUser.id);
      if (index >= 0) mockUsers[index] = updated;
      // Persist to localStorage so SideNav picks up the new photo
      if (currentUser && currentUser.id === profileUser.id) {
        const updatedCurrent = { ...currentUser, image: base64 };
        localStorage.setItem("pflx_user", JSON.stringify(updatedCurrent));
        setCurrentUser(updatedCurrent);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentRank = getCurrentRank(profileUser.totalXcoin);
  const xpProgress = getXCProgress(profileUser.xcoin);

  // Group approved submissions by coinType
  const approvedSubs = mockSubmissions.filter(s => s.playerId === profileUser.id && s.status === "approved");
  const coinCounts: Record<string, number> = {};
  approvedSubs.forEach(s => {
    coinCounts[s.coinType] = (coinCounts[s.coinType] || 0) + s.amount;
  });

  // Re-map category headers to professional equivalents
  const portolioCategories = [
    { sourceName: "Primary Badges (Behavior)",        targetName: "Professional Endorsements", color: "#4f8ef7", colorRgb: "79,142,247",   rarity: null,        rarityGradient: "" },
    { sourceName: "Premium Badges (Achievement)",     targetName: "Exceptional Achievements",  color: "#a78bfa", colorRgb: "167,139,250",  rarity: "Rare",      rarityGradient: "linear-gradient(135deg, #a78bfa, #6366f1)" },
    { sourceName: "Executive Badges (Jobs)",          targetName: "Job Experience & Roles",    color: "#f5c842", colorRgb: "245,200,66",   rarity: "Epic",      rarityGradient: "linear-gradient(135deg, #f5c842, #f97316)" },
    { sourceName: "Signature Badges (Skill Mastery)", targetName: "Official Certifications",   color: "#ef4444", colorRgb: "239,68,68",    rarity: "Legendary", rarityGradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  ];

  // Ownership stake — coins this player sponsors (residual income)
  const allCoins = COIN_CATEGORIES.flatMap(cat => cat.coins);
  const sponsoredCoins = allCoins.filter(c => c.sponsorId === profileUser.id);
  const totalResidualEarned = sponsoredCoins.reduce((sum, coin) => {
    // Count how many times ANY player earned this coin, then multiply by residual %
    const timesEarned = mockSubmissions.filter(s => s.coinType === coin.name && s.status === "approved").reduce((a, s) => a + s.amount, 0);
    const pct = (coin.residualPercent ?? 10) / 100;
    return sum + Math.floor(timesEarned * coin.xc * pct);
  }, 0);

  // Studio + diagnostic
  const studio = mockStartupStudios.find(s => s.id === profileUser.studioId);
  const dr = profileUser.diagnosticResult;
  const designerTypeLabels: Record<string, string> = {
    "technical-builder":    "🔧 Technical Builder",
    "creative-director":    "🎨 Creative Director",
    "experience-designer":  "✨ Experience Designer",
    "digital-innovator":    "🚀 Digital Innovator",
  };
  const designerLabel = dr?.brandType ? (designerTypeLabels[dr.brandType] ?? dr.brandType) : null;
  const majorPathway = dr?.topPathways?.[0] ?? profileUser.pathway ?? null;
  const minorPathway = dr?.topPathways?.[1] ?? null;
  const alternatePathway = dr?.topPathways?.[2] ?? null;
  const visionParts = dr?.visionStatement
    ? [dr.visionStatement.create, dr.visionStatement.impact, dr.visionStatement.perspective, dr.visionStatement.future].filter(Boolean)
    : [];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <div className="no-print">
        <SideNav user={currentUser} />
      </div>

      <main style={{ flex: 1, padding: "32px", overflow: "auto", display: "flex", justifyContent: "center" }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            main { padding: 0 !important; }
            .cv-container { width: 100% !important; max-width: none !important; border: none !important; margin: 0 !important; box-shadow: none !important; background: white !important; color: black !important; }
            .cv-card { background: transparent !important; border: 1px solid #ccc !important; break-inside: avoid; color: black !important; }
            * { color: black !important; }
            .badge-txt { color: #555 !important; }
          }
          @media (max-width: 620px) {
            .badge-grid-2col { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <div className="cv-container" style={{ width: "100%", maxWidth: "900px", margin: "0 auto", background: "#12121c", borderRadius: "24px", padding: "40px", border: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
          
          <div className="no-print" style={{ display: "flex", gap: "12px", position: "absolute", top: "40px", right: "40px" }}>
            <button 
              onClick={() => window.print()}
              style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 20px",
                borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              📄 Download PDF / CV
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "32px", marginBottom: "40px" }}>
            <div style={{ position: "relative" }}>
              <div style={{
                width: "140px", height: "140px", borderRadius: "24px", background: "linear-gradient(135deg, #4f8ef7, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", fontWeight: 800, color: "white", overflow: "hidden", border: "4px solid rgba(255,255,255,0.1)"
              }}>
                {profileUser.image ? <img src={profileUser.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : profileUser.avatar}
              </div>
              {canEdit && (
                <div 
                  className="no-print"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: "absolute", bottom: "-10px", right: "-10px", background: "#f5c842",
                    padding: "8px", borderRadius: "50%", cursor: "pointer", border: "4px solid #12121c",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  📸
                </div>
              )}
              <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleImageUpload} />
            </div>
            
            <div style={{ padding: "10px 0" }}>
              <h1 style={{ margin: "0 0 4px", fontSize: "36px", fontWeight: 900, color: "#f0f0ff" }}>{profileUser.brandName}</h1>
              {/* Real name only visible to admins */}
              {currentUser.role === "admin" && (
                <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
                  🔒 {profileUser.name}
                </p>
              )}
              <p style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>✦ PFLX Identity</p>
              
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "6px 16px", borderRadius: "20px" }}>🏫 {profileUser.cohort}</div>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "6px 16px", borderRadius: "20px" }}>📅 Since {profileUser.joinedAt}</div>
              </div>
            </div>
          </div>

          {/* ── Designer Identity + Vision (top of profile) ──────────── */}
          {(designerLabel || majorPathway || visionParts.length > 0) && (
            <div className="cv-card" style={{
              marginBottom: "28px", borderRadius: "16px", padding: "22px 24px",
              background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap", marginBottom: visionParts.length > 0 ? "18px" : 0 }}>
                {/* Designer type */}
                {designerLabel && (
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(167,139,250,0.5)", marginBottom: "4px" }}>DESIGNER TYPE</div>
                    <div style={{
                      display: "inline-block", padding: "6px 16px", borderRadius: "20px",
                      background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)",
                      fontSize: "15px", fontWeight: 800, color: "#a78bfa",
                    }}>{designerLabel}</div>
                  </div>
                )}
                {/* Major + Minor pathway */}
                {majorPathway && (
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(0,212,255,0.5)", marginBottom: "4px" }}>PATHWAYS</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ padding: "5px 14px", borderRadius: "20px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", fontSize: "12px", fontWeight: 700, color: "#00d4ff" }}>
                        ⭐ Major: {majorPathway}
                      </span>
                      {minorPathway && (
                        <span style={{ padding: "5px 14px", borderRadius: "20px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.65)" }}>
                          Minor: {minorPathway}
                        </span>
                      )}
                      {alternatePathway && (
                        <span style={{ padding: "5px 14px", borderRadius: "20px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.10)", fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.45)" }}>
                          Alternate: {alternatePathway}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Vision Statement */}
              {visionParts.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(167,139,250,0.1)", paddingTop: "16px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(167,139,250,0.5)", marginBottom: "10px" }}>VISION STATEMENT</div>
                  <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontStyle: "italic" }}>
                    "{visionParts.join(" ")}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stats Bar */}
          <div className="cv-card" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "24px", marginBottom: "40px" }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Total Badges (Digital Badges)</p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "#f5c842" }}>{profileUser.digitalBadges}</p>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Lifetime XC</p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "#4f8ef7" }}>{profileUser.totalXcoin.toLocaleString()}</p>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Evolution Rank</p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "#22c55e" }}>{currentRank.name} {currentRank.icon}</p>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Level</p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "white" }}>Lv. {profileUser.level}</p>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "2px dashed rgba(255,255,255,0.1)", margin: "0 0 32px" }} />

          {/* ── Studio Identity Card ───────────────────────────────────── */}
          {studio && (
            <div className="cv-card" style={{
              marginBottom: "32px", borderRadius: "16px", padding: "20px 24px",
              background: `rgba(${studio.colorRgb},0.07)`,
              border: `1px solid rgba(${studio.colorRgb},0.3)`,
              display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, rgba(${studio.colorRgb},0.7), transparent)` }} />
              {/* Logo */}
              <div style={{
                width: "64px", height: "64px", borderRadius: "14px", flexShrink: 0,
                background: `rgba(${studio.colorRgb},0.85)`,
                border: `1.5px solid rgba(${studio.colorRgb},0.5)`,
                boxShadow: `0 0 18px rgba(${studio.colorRgb},0.3)`,
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              }}>
                <img
                  src={`/studio-${studio.id.replace("studio-", "")}.png`}
                  alt={studio.name}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "block"; }}
                  style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                />
                <span style={{ fontSize: "28px", display: "none" }}>{studio.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: `rgba(${studio.colorRgb},0.6)`, marginBottom: "3px" }}>STARTUP STUDIO</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#fff", marginBottom: "2px" }}>{studio.name}</div>
                <div style={{ fontSize: "12px", color: `rgba(${studio.colorRgb},0.75)`, fontStyle: "italic" }}>{studio.tagline}</div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { label: "XC POOL", value: `⚡ ${studio.xcPool.toLocaleString()}`, c: studio.color },
                  { label: "TAX RATE", value: `💼 ${studio.corporateTaxRate}%`, c: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ background: `rgba(${studio.colorRgb},0.08)`, border: `1px solid rgba(${studio.colorRgb},0.15)`, borderRadius: "10px", padding: "8px 14px", textAlign: "center" }}>
                    <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 800, color: s.c, fontFamily: "monospace" }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 700 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ownership Stake / Investor Card ────────────────────────── */}
          {sponsoredCoins.length > 0 && (
            <div className="cv-card" style={{
              marginBottom: "32px", borderRadius: "16px", padding: "22px 24px",
              background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.25)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, rgba(245,200,66,0.7), rgba(249,115,22,0.5), transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  background: "linear-gradient(135deg, rgba(245,200,66,0.2), rgba(249,115,22,0.15))",
                  border: "1px solid rgba(245,200,66,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
                }}>💰</div>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(245,200,66,0.5)" }}>OWNERSHIP STAKE</div>
                  <div style={{ fontSize: "16px", fontWeight: 900, color: "#f5c842" }}>Course & Project Investor</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(34,197,94,0.5)", marginBottom: "2px" }}>REVENUE EARNED</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: "#22c55e", fontFamily: "monospace" }}>{totalResidualEarned.toLocaleString()} XC</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {sponsoredCoins.map(coin => {
                  const pct = coin.residualPercent ?? 10;
                  return (
                    <div key={coin.name} style={{
                      padding: "8px 14px", borderRadius: "10px",
                      background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      {coin.image && <span style={{ fontSize: "16px" }}>{coin.image}</span>}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{coin.name}</div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(245,200,66,0.7)", fontFamily: "monospace" }}>{pct}% residual · {coin.xc} XC</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Badge Portfolio ────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
            {portolioCategories.map(pCat => {
              const catDef = COIN_CATEGORIES.find(c => c.name === pCat.sourceName);
              if (!catDef) return null;
              const earnedCoins = catDef.coins.filter(c => (coinCounts[c.name] ?? 0) > 0);
              if (earnedCoins.length === 0) return null;

              return (
                <div key={pCat.targetName}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid rgba(${pCat.colorRgb},0.2)` }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#f0f0ff", letterSpacing: "0.04em" }}>{pCat.targetName}</h2>
                    {pCat.rarity && (
                      <span style={{
                        padding: "2px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 800,
                        background: pCat.rarityGradient, color: "white", letterSpacing: "0.06em",
                      }}>{pCat.rarity}</span>
                    )}
                    <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, background: `rgba(${pCat.colorRgb},0.12)`, border: `1px solid rgba(${pCat.colorRgb},0.3)`, color: pCat.color }}>
                      {earnedCoins.length} badge{earnedCoins.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* 2-column grid of badge cards */}
                  <div className="badge-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {earnedCoins.map(coin => {
                      const count = coinCounts[coin.name] ?? 0;
                      return (
                        <div className="cv-card" key={coin.name} style={{
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: "16px",
                          border: "1px solid rgba(255,255,255,0.07)",
                          padding: "16px",
                          display: "flex", alignItems: "center", gap: "16px",
                          cursor: "default",
                          transition: "background 0.2s",
                        }}>
                          {/* Coin image with rarity ribbon + count badge */}
                          <div style={{ position: "relative", flexShrink: 0, width: "80px", height: "80px" }}>
                            {/* Rarity ribbon — top-left corner of image */}
                            {pCat.rarity && (
                              <div style={{
                                position: "absolute", top: 0, left: 0,
                                background: pCat.rarityGradient,
                                color: "white", fontSize: "8px", fontWeight: 900,
                                padding: "3px 7px", borderRadius: "8px 0 8px 0",
                                zIndex: 2, letterSpacing: "0.05em",
                              }}>{pCat.rarity}</div>
                            )}
                            {/* Coin image */}
                            <div style={{
                              width: "80px", height: "80px", borderRadius: "50%",
                              overflow: "hidden",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(255,255,255,0.04)",
                            }}>
                              {(coin as any).image
                                ? <img src={(coin as any).image} alt={coin.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                : <span style={{ fontSize: "38px" }}>🪙</span>}
                            </div>
                            {/* Count badge — bottom-left */}
                            <div style={{
                              position: "absolute", bottom: "0px", left: "2px",
                              background: "#1a1a2e",
                              border: "2px solid rgba(255,255,255,0.18)",
                              borderRadius: "50%",
                              minWidth: "22px", height: "22px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "11px", fontWeight: 900, color: "white", zIndex: 2,
                              padding: "0 3px",
                            }}>{count}</div>
                          </div>

                          {/* Text content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: "0 0 5px", fontSize: "15px", fontWeight: 800, color: "white" }}>{coin.name}</h3>
                            <p className="badge-txt" style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                              {coin.description}{coin.xc ? ` (${coin.xc.toLocaleString()} points)` : ""}
                            </p>
                          </div>

                          {/* Chevron */}
                          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "22px", fontWeight: 300, flexShrink: 0 }}>›</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}
