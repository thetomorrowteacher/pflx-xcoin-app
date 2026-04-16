"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, mockUsers, mockSubmissions, COIN_CATEGORIES, getCurrentRank, getRankProgress, getRankRequirements, getXCProgress, mockStartupStudios, mockPflxRanks } from "../../lib/data";
import { applyPlayerImages, savePlayerImage } from "../../lib/playerImages";

interface Project {
  id: string;
  title: string;
  description: string;
  link: string;
  tags: string[];
  createdAt: string;
}

export default function PlayerProfile({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [published, setPublished] = useState(false);

  // Form state for adding/editing projects
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formTags, setFormTags] = useState("");

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

  // Load projects and published state
  useEffect(() => {
    if (!profileUser) return;
    const projectsKey = `pflx_portfolio_projects_${profileUser.id}`;
    const publishedKey = `pflx_portfolio_published_${profileUser.id}`;

    const stored = localStorage.getItem(projectsKey);
    if (stored) {
      setProjects(JSON.parse(stored));
    }

    const pub = localStorage.getItem(publishedKey);
    setPublished(pub === "true");
  }, [profileUser]);

  const saveProjects = (updatedProjects: Project[]) => {
    if (!profileUser) return;
    setProjects(updatedProjects);
    localStorage.setItem(`pflx_portfolio_projects_${profileUser.id}`, JSON.stringify(updatedProjects));
  };

  const handleSaveProject = () => {
    if (!formTitle.trim() || !formDescription.trim() || !formLink.trim()) return;

    const tags = formTags.split(",").map(t => t.trim()).filter(t => t.length > 0);

    if (editingProject) {
      const updated = projects.map(p =>
        p.id === editingProject
          ? { ...p, title: formTitle, description: formDescription, link: formLink, tags }
          : p
      );
      saveProjects(updated);
    } else {
      const newProject: Project = {
        id: `project_${Date.now()}`,
        title: formTitle,
        description: formDescription,
        link: formLink,
        tags,
        createdAt: new Date().toISOString(),
      };
      saveProjects([...projects, newProject]);
    }

    setFormTitle("");
    setFormDescription("");
    setFormLink("");
    setFormTags("");
    setEditingProject(null);
    setShowAddProject(false);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project.id);
    setFormTitle(project.title);
    setFormDescription(project.description);
    setFormLink(project.link);
    setFormTags(project.tags.join(", "));
    setShowAddProject(true);
  };

  const handleCancelEdit = () => {
    setFormTitle("");
    setFormDescription("");
    setFormLink("");
    setFormTags("");
    setEditingProject(null);
    setShowAddProject(false);
  };

  const togglePublished = () => {
    if (!profileUser) return;
    const newPublished = !published;
    setPublished(newPublished);
    localStorage.setItem(`pflx_portfolio_published_${profileUser.id}`, String(newPublished));
  };

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

  const currentRank = getCurrentRank(profileUser.totalXcoin ?? 0, profileUser);
  const xpProgress = getXCProgress(profileUser.xcoin ?? 0);

  // Next rank requirements
  const nextRankDef = mockPflxRanks.find(r => r.level === currentRank.level + 1);
  const nextRankReqs = nextRankDef ? getRankRequirements(nextRankDef, profileUser) : null;

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
    const timesEarned = mockSubmissions.filter(s => s.coinType === coin.name && s.status === "approved").reduce((a, s) => a + s.amount, 0);
    const pct = (coin.residualPercent ?? 10) / 100;
    return sum + Math.floor(timesEarned * coin.xc * pct);
  }, 0);

  // ── Rank-based Studio Equity System ──────────────────────────────
  // Higher ranks = higher ownership stake, more revenue, studio leadership
  const rankEquityTiers: Record<number, { title: string; equity: number; revenueMultiplier: number; recruitBonus: number; perks: string[] }> = {
    1:  { title: "Member",              equity: 1,   revenueMultiplier: 1.0, recruitBonus: 0,   perks: ["Studio access"] },
    2:  { title: "Contributor",         equity: 2,   revenueMultiplier: 1.1, recruitBonus: 25,  perks: ["Studio access", "Vote on projects"] },
    3:  { title: "Stakeholder",         equity: 4,   revenueMultiplier: 1.25, recruitBonus: 50, perks: ["Vote on projects", "Propose initiatives"] },
    4:  { title: "Lead Stakeholder",    equity: 7,   revenueMultiplier: 1.5, recruitBonus: 100, perks: ["Lead projects", "Recruit players"] },
    5:  { title: "Studio Director",     equity: 12,  revenueMultiplier: 2.0, recruitBonus: 200, perks: ["Lead projects", "Recruit players", "Revenue share"] },
    6:  { title: "Executive Partner",   equity: 18,  revenueMultiplier: 2.5, recruitBonus: 350, perks: ["Revenue share", "Mentor recruits", "Brand spotlight"] },
    7:  { title: "Senior Partner",      equity: 25,  revenueMultiplier: 3.0, recruitBonus: 500, perks: ["Revenue share", "Mentor recruits", "Studio strategy"] },
    8:  { title: "Managing Partner",    equity: 33,  revenueMultiplier: 4.0, recruitBonus: 750, perks: ["Studio strategy", "Set tax rates", "Brand spotlight"] },
    9:  { title: "Chief Partner",       equity: 42,  revenueMultiplier: 5.0, recruitBonus: 1000, perks: ["Full governance", "Revenue share", "Brand spotlight"] },
    10: { title: "Founding Partner",    equity: 51,  revenueMultiplier: 6.0, recruitBonus: 1500, perks: ["Full governance", "Max revenue", "Legacy status"] },
  };
  const rankLevel = currentRank.level;
  const equityTier = rankEquityTiers[rankLevel] || rankEquityTiers[1];

  // Count recruits — players in same studio who joined after this player
  const studioMembers = mockUsers.filter(u => u.studioId === profileUser.studioId && u.role === "player");
  const recruits = studioMembers.filter(u => u.id !== profileUser.id && u.joinedAt && profileUser.joinedAt && u.joinedAt > profileUser.joinedAt);

  // Calculate studio revenue from pool growth (equity % × pool × multiplier)
  const studioObj = mockStartupStudios.find(s => s.id === profileUser.studioId);
  const studioPoolShare = studioObj ? Math.floor((equityTier.equity / 100) * studioObj.xcPool * equityTier.revenueMultiplier) : 0;
  const recruitRevenue = recruits.length * equityTier.recruitBonus;
  const totalStudioRevenue = studioPoolShare + recruitRevenue + totalResidualEarned;

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
          
          <div className="no-print" style={{ display: "flex", gap: "12px", position: "absolute", top: "40px", right: "40px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={() => window.print()}
              style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 20px",
                borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              📄 Download PDF / CV
            </button>

            {canEdit && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={togglePublished}
                  style={{
                    background: published
                      ? "rgba(255,255,255,0.1)"
                      : "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(0,212,255,0.2))",
                    border: published
                      ? "1px solid rgba(255,255,255,0.2)"
                      : "1px solid rgba(34,197,94,0.4)",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  {published ? "🔒 Unpublish" : "🌐 Publish Portfolio"}
                </button>

                {published && (
                  <div style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                  }}>
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/portfolio/${profileUser.id}`}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#00d4ff",
                        flex: 1,
                        fontSize: "12px",
                        fontWeight: 600,
                        outline: "none",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/portfolio/${profileUser.id}`;
                        navigator.clipboard.writeText(url);
                      }}
                      style={{
                        background: "rgba(0,212,255,0.2)",
                        border: "1px solid rgba(0,212,255,0.4)",
                        color: "#00d4ff",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
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
              <p style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "#4f8ef7" }}>{(profileUser.totalXcoin ?? 0).toLocaleString()}</p>
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

          {/* ── Next Rank Requirements ──────────────────────────────── */}
          {nextRankReqs && !nextRankReqs.allMet && (
            <div className="cv-card" style={{
              marginBottom: "32px", borderRadius: "16px", padding: "20px 24px",
              background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, rgba(34,197,94,0.6), rgba(0,212,255,0.4), transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <span style={{ fontSize: "18px" }}>🎯</span>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(34,197,94,0.5)" }}>NEXT RANK REQUIREMENTS</div>
                  <div style={{ fontSize: "16px", fontWeight: 900, color: "#22c55e" }}>
                    {nextRankReqs.rank.name} {nextRankReqs.rank.icon} <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>Rank {nextRankReqs.rank.level}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {/* XC requirement */}
                <div style={{
                  padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                  background: nextRankReqs.xcMet ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${nextRankReqs.xcMet ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: nextRankReqs.xcMet ? "#22c55e" : "rgba(255,255,255,0.5)",
                }}>
                  {nextRankReqs.xcMet ? "✅" : "⬜"} {nextRankReqs.xcCurrent.toLocaleString()} / {nextRankReqs.rank.xcoinUnlock.toLocaleString()} XC
                </div>
                {/* Checkpoints */}
                <div style={{
                  padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                  background: nextRankReqs.checkpointsMet ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${nextRankReqs.checkpointsMet ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: nextRankReqs.checkpointsMet ? "#22c55e" : "rgba(255,255,255,0.5)",
                }}>
                  {nextRankReqs.checkpointsMet ? "✅" : "⬜"} {nextRankReqs.checkpointsCurrent} / {nextRankReqs.rank.checkpointsRequired} Checkpoints
                </div>
                {/* Badge types */}
                {nextRankReqs.badgeTypesDetail.map(bt => (
                  <div key={bt.type} style={{
                    padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                    background: bt.met ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${bt.met ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: bt.met ? "#22c55e" : "rgba(255,255,255,0.5)",
                  }}>
                    {bt.met ? "✅" : "⬜"} {bt.type} Badge {bt.met ? `(${bt.count})` : "(0)"}
                  </div>
                ))}
                {/* Specific badges */}
                {nextRankReqs.specificBadgesDetail.map(sb => (
                  <div key={sb.name} style={{
                    padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                    background: sb.met ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${sb.met ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: sb.met ? "#22c55e" : "rgba(255,255,255,0.5)",
                  }}>
                    {sb.met ? "✅" : "⬜"} {sb.name}
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* ── Studio Ownership & Equity Card ─────────────────────────── */}
          {studioObj && (
            <div className="cv-card" style={{
              marginBottom: "32px", borderRadius: "16px", padding: "24px",
              background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.2)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, rgba(245,200,66,0.8), rgba(${studioObj.colorRgb},0.6), transparent)` }} />

              {/* Header row: title + total revenue */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(245,200,66,0.25), rgba(249,115,22,0.15))",
                  border: "1px solid rgba(245,200,66,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
                }}>👑</div>
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(245,200,66,0.5)" }}>STUDIO OWNERSHIP — {studioObj.name.toUpperCase()}</div>
                  <div style={{ fontSize: "20px", fontWeight: 900, color: "#f5c842" }}>{equityTier.title}</div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>Rank {rankLevel} · {currentRank.name} {currentRank.icon}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(34,197,94,0.5)", marginBottom: "2px" }}>TOTAL REVENUE</div>
                  <div style={{ fontSize: "28px", fontWeight: 900, color: "#22c55e", fontFamily: "monospace", lineHeight: 1 }}>{totalStudioRevenue.toLocaleString()} XC</div>
                </div>
              </div>

              {/* Equity stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
                {[
                  { label: "EQUITY STAKE", value: `${equityTier.equity}%`, color: "#f5c842", icon: "📊" },
                  { label: "POOL SHARE", value: `${studioPoolShare.toLocaleString()} XC`, color: studioObj.color, icon: "⚡" },
                  { label: "REVENUE MULT", value: `×${equityTier.revenueMultiplier}`, color: "#22c55e", icon: "📈" },
                  { label: "RECRUITS", value: `${recruits.length} player${recruits.length !== 1 ? "s" : ""}`, color: "#8b5cf6", icon: "🤝" },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px", padding: "12px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: "14px", marginBottom: "4px" }}>{stat.icon}</div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: stat.color, fontFamily: "monospace" }}>{stat.value}</div>
                    <div style={{ fontSize: "8px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: "4px" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Revenue breakdown */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                {totalResidualEarned > 0 && (
                  <div style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)", fontSize: "11px", fontWeight: 700 }}>
                    <span style={{ color: "rgba(245,200,66,0.7)" }}>Course Residuals:</span> <span style={{ color: "#f5c842", fontFamily: "monospace" }}>{totalResidualEarned.toLocaleString()} XC</span>
                  </div>
                )}
                {recruitRevenue > 0 && (
                  <div style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", fontSize: "11px", fontWeight: 700 }}>
                    <span style={{ color: "rgba(139,92,246,0.7)" }}>Recruit Bonus:</span> <span style={{ color: "#8b5cf6", fontFamily: "monospace" }}>{recruitRevenue.toLocaleString()} XC</span>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}> ({equityTier.recruitBonus} XC/recruit)</span>
                  </div>
                )}
                {studioPoolShare > 0 && (
                  <div style={{ padding: "6px 12px", borderRadius: "8px", background: `rgba(${studioObj.colorRgb},0.08)`, border: `1px solid rgba(${studioObj.colorRgb},0.15)`, fontSize: "11px", fontWeight: 700 }}>
                    <span style={{ color: `rgba(${studioObj.colorRgb},0.7)` }}>Pool Revenue:</span> <span style={{ color: studioObj.color, fontFamily: "monospace" }}>{studioPoolShare.toLocaleString()} XC</span>
                  </div>
                )}
              </div>

              {/* Perks / Leadership capabilities */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {equityTier.perks.map(perk => (
                  <span key={perk} style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em",
                  }}>✦ {perk}</span>
                ))}
              </div>

              {/* Sponsored courses sub-section */}
              {sponsoredCoins.length > 0 && (
                <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(245,200,66,0.1)" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(245,200,66,0.4)", marginBottom: "10px" }}>SPONSORED COURSES & PROJECTS</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {sponsoredCoins.map(coin => (
                      <div key={coin.name} style={{
                        padding: "8px 14px", borderRadius: "10px",
                        background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)",
                        display: "flex", alignItems: "center", gap: "8px",
                      }}>
                        {coin.image && <span style={{ fontSize: "16px" }}>{coin.image}</span>}
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{coin.name}</div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(245,200,66,0.7)", fontFamily: "monospace" }}>{coin.residualPercent ?? 10}% residual · {coin.xc} XC</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

          {/* ── Project Portfolio ──────────────────────────────────────── */}
          <div style={{ marginTop: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#f0f0ff", letterSpacing: "0.04em" }}>PROJECT PORTFOLIO</h2>
              <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff" }}>
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </span>
            </div>

            {canEdit && !showAddProject && (
              <button
                onClick={() => setShowAddProject(true)}
                style={{
                  marginBottom: "16px",
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(34,197,94,0.15))",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: "10px",
                  color: "#00d4ff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                + Add Project
              </button>
            )}

            {showAddProject && (
              <div className="cv-card" style={{
                marginBottom: "16px",
                background: "rgba(0,212,255,0.05)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "16px",
                padding: "20px",
              }}>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.7)", display: "block", marginBottom: "6px" }}>PROJECT TITLE</label>
                  <input
                    type="text"
                    placeholder="Enter project title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.7)", display: "block", marginBottom: "6px" }}>DESCRIPTION</label>
                  <textarea
                    placeholder="Enter project description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      minHeight: "80px",
                      boxSizing: "border-box",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.7)", display: "block", marginBottom: "6px" }}>PROJECT LINK</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,212,255,0.7)", display: "block", marginBottom: "6px" }}>TAGS (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="design, development, mobile"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleSaveProject}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(0,212,255,0.2))",
                      border: "1px solid rgba(34,197,94,0.4)",
                      borderRadius: "8px",
                      color: "#22c55e",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "rgba(255,255,255,0.6)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {projects.length === 0 && !showAddProject && (
              <div style={{
                padding: "32px 24px",
                textAlign: "center",
                background: "rgba(0,212,255,0.03)",
                border: "1px dashed rgba(0,212,255,0.15)",
                borderRadius: "16px",
                color: "rgba(255,255,255,0.4)",
              }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>No projects yet</p>
                {canEdit && <p style={{ margin: "8px 0 0", fontSize: "12px" }}>Add your first project to get started</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {projects.map(project => (
                <div key={project.id} className="cv-card" style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: "16px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}>
                  <div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "white" }}>{project.title}</h3>
                    <p style={{ margin: "0 0 12px", fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                      {project.description}
                    </p>
                  </div>

                  {project.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {project.tags.map(tag => (
                        <span key={tag} style={{
                          padding: "4px 10px",
                          background: "rgba(0,212,255,0.1)",
                          border: "1px solid rgba(0,212,255,0.2)",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#00d4ff",
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        color: "#00d4ff",
                        textDecoration: "none",
                        fontSize: "13px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      View Project →
                    </a>
                    {canEdit && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => handleEditProject(project)}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(139,92,246,0.15)",
                            border: "1px solid rgba(139,92,246,0.3)",
                            borderRadius: "6px",
                            color: "#8b5cf6",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: "6px",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
