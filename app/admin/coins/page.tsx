"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User,
  COIN_CATEGORIES,
  Coin,
  CoinCategory,
  mockUsers,
  mockSubmissions,
  CoinSubmission,
  mockStartupStudios,
  StartupStudio
} from "../../lib/data";
import { applyPlayerImages } from "../../lib/playerImages";
import { playReward, playSuccess, playClick, playDelete } from "../../lib/sounds";
import { updatePlayerStats } from "../../lib/playerStats";
import { saveCoinCategories, saveUsers, saveSubmissions } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";
import { compressImage } from "../../lib/imageUtils";


export default function ManageCoinsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<CoinCategory[]>(COIN_CATEGORIES);
  const [editingCoin, setEditingCoin] = useState<{catIndex: number, coinIndex: number, coin: Coin} | null>(null);
  const [isAdding, setIsAdding] = useState<number | null>(null); // Category index
  const [grantTarget, setGrantTarget] = useState<{playerId: string, coin: Coin, amount: number} | null>(null);
  const [newCoinImage, setNewCoinImage] = useState<string>(""); // base64 for new coin image
  const [newSponsorType, setNewSponsorType] = useState<"player" | "studio" | "none">("none");
  const [newSponsorId, setNewSponsorId] = useState("");
  const [newSponsorName, setNewSponsorName] = useState("");
  const [newResidualPercent, setNewResidualPercent] = useState(10);
  const [_tick, setTick] = useState(0);

  // Refresh player list every 2s so newly added players appear in picker
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "admin") { router.push("/player"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const handleDelete = (catIdx: number, coinIdx: number) => {
    if (!confirm("Are you sure you want to delete this coin?")) return;
    const newCats = [...categories];
    newCats[catIdx].coins.splice(coinIdx, 1);
    setCategories([...newCats]);
    // Sync back to mock array so auto-save picks it up
    COIN_CATEGORIES.splice(0, COIN_CATEGORIES.length, ...newCats);
    playDelete();
    saveAndToast([saveCoinCategories], "Coin deleted — saved to cloud ✓");
  };

  const handleSaveCoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoin) return;
    const { catIndex, coinIndex, coin } = editingCoin;
    console.log(`[coins] Saving coin "${coin.name}", image: ${coin.image ? `${(coin.image.length / 1024).toFixed(1)}KB` : "none"}`);
    const newCats = [...categories];
    newCats[catIndex].coins[coinIndex] = coin;
    setCategories([...newCats]);
    // Sync back to mock array so auto-save picks it up
    COIN_CATEGORIES.splice(0, COIN_CATEGORIES.length, ...newCats);
    setEditingCoin(null);
    playSuccess();
    await saveAndToast([saveCoinCategories], "Coin saved to cloud ✓");
  };

  const handleImageUpload = async (file: File, isEditing: boolean) => {
    const compressed = await compressImage(file);
    console.log(`[coins] Image compressed: ${(compressed.length / 1024).toFixed(1)}KB`);
    if (isEditing && editingCoin) {
      setEditingCoin({ ...editingCoin, coin: { ...editingCoin.coin, image: compressed } });
    } else {
      setNewCoinImage(compressed);
    }
  };

  const handleCreateCoin = async (e: React.FormEvent, catIdx: number) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newCoin: Coin = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      xc: parseInt(formData.get("xc") as string) || 0,
      image: newCoinImage || undefined,
      sponsorType: newSponsorType !== "none" ? newSponsorType : undefined,
      sponsorId: newSponsorType !== "none" ? newSponsorId : undefined,
      sponsorName: newSponsorType !== "none" ? newSponsorName : undefined,
      residualPercent: newSponsorType !== "none" ? newResidualPercent : undefined,
    };
    console.log(`[coins] Creating coin "${newCoin.name}", image: ${newCoin.image ? `${(newCoin.image.length / 1024).toFixed(1)}KB` : "none"}`);
    const newCats = [...categories];
    newCats[catIdx].coins.push(newCoin);
    setCategories([...newCats]);
    // Sync back to mock array so auto-save picks it up
    COIN_CATEGORIES.splice(0, COIN_CATEGORIES.length, ...newCats);
    setIsAdding(null);
    setNewCoinImage("");
    setNewSponsorType("none");
    setNewSponsorId("");
    setNewSponsorName("");
    setNewResidualPercent(10);
    playSuccess();
    await saveAndToast([saveCoinCategories], "Badge created — saved to cloud ✓");
  };

  const handleGrantCoin = () => {
    if (!grantTarget) return;
    const { playerId, coin, amount } = grantTarget;
    const targetPlayer = mockUsers.find(u => u.id === playerId);
    if (targetPlayer) {
      const totalXcReward = coin.xc * amount;
      targetPlayer.digitalBadges += amount; // +X badges
      targetPlayer.xcoin += totalXcReward;
      targetPlayer.totalXcoin += totalXcReward;

      // Add to submissions history as pre-approved
      mockSubmissions.push({
        id: `grant-${Date.now()}`,
        playerId,
        coinType: coin.name,
        amount: amount,
        reason: "Administrator Grant",
        status: "approved",
        submittedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString()
      });

      // Persist updated stats so player dashboard reflects this immediately
      updatePlayerStats(playerId, {
        xcoin: targetPlayer.xcoin,
        totalXcoin: targetPlayer.totalXcoin,
        digitalBadges: targetPlayer.digitalBadges,
        level: targetPlayer.level,
        rank: targetPlayer.rank,
      });

      // Save to Supabase
      playReward();
      saveAndToast([saveUsers, saveSubmissions], `${amount}x ${coin.name} granted — saved to cloud ✓`);
    }
    setGrantTarget(null);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />

      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>💎 X-COIN MANAGEMENT</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ ADD, MANAGE & CONFIGURE PFLX CURRENCY ]</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {categories.map((cat, catIdx) => (
            <section key={cat.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f5c842", margin: 0 }}>{cat.name}</h2>
                <button 
                  onClick={() => setIsAdding(catIdx)}
                  style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", color: "#f5c842", padding: "6px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >+ Add New Coin</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {cat.coins.map((coin, coinIdx) => (
                  <div key={coin.name} style={{ background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "flex-start", gap: "20px" }}>
                    <div style={{ width: "86px", height: "86px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, padding: "8px" }}>
                      {coin.image ? <img src={coin.image} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt={coin.name} /> : <span style={{ fontSize: "36px" }}>🪙</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}>{coin.name}</p>
                      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{coin.description}</p>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#4f8ef7", padding: "2px 8px", background: "rgba(79,142,247,0.1)", borderRadius: "6px" }}>{coin.xc} XC REWARD</span>
                        {coin.sponsorType && coin.sponsorType !== "none" && coin.sponsorName && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", padding: "2px 8px", background: "rgba(167,139,250,0.1)", borderRadius: "6px" }}>
                            {coin.residualPercent || 10}% → {coin.sponsorName}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          onClick={() => setEditingCoin({ catIndex: catIdx, coinIndex: coinIdx, coin: {...coin} })}
                          style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "white", fontSize: "11px", cursor: "pointer" }}
                        >Edit</button>
                        <button 
                          onClick={() => setGrantTarget({ playerId: "", coin, amount: 1 })}
                          style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "none", background: "rgba(79,142,247,0.2)", color: "#4f8ef7", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                        >Grant</button>
                        <button 
                          onClick={() => handleDelete(catIdx, coinIdx)}
                          style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "11px", cursor: "pointer" }}
                        >Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Edit Modal */}
        {editingCoin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
            <div style={{ background: "#16161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "450px" }}>
              <h2 style={{ margin: "0 0 24px", color: "#f0f0ff" }}>Edit Coin</h2>
              <form onSubmit={handleSaveCoin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Name</label>
                  <input 
                    value={editingCoin.coin.name}
                    onChange={e => setEditingCoin({...editingCoin, coin: {...editingCoin.coin, name: e.target.value}})}
                    style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Description</label>
                  <textarea 
                    value={editingCoin.coin.description}
                    onChange={e => setEditingCoin({...editingCoin, coin: {...editingCoin.coin, description: e.target.value}})}
                    style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", minHeight: "80px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>XC Reward</label>
                  <input
                    type="number"
                    value={editingCoin.coin.xc}
                    onChange={e => setEditingCoin({...editingCoin, coin: {...editingCoin.coin, xc: parseInt(e.target.value)}})}
                    style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                  />
                </div>
                
                {/* Image Upload */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Coin Image</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {editingCoin.coin.image ? <img src={editingCoin.coin.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "24px" }}>🪙</span>}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="edit-coin-file" 
                      hidden 
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], true)}
                    />
                    <label htmlFor="edit-coin-file" style={{
                      flex: 1, padding: "12px",
                      background: editingCoin.coin.image ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px dashed ${editingCoin.coin.image ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.2)"}`,
                      borderRadius: "12px", color: editingCoin.coin.image ? "#22c55e" : "rgba(255,255,255,0.6)", fontSize: "13px", textAlign: "center", cursor: "pointer"
                    }}>
                      {editingCoin.coin.image ? "✓ Image Set — Click to Change" : "Upload Custom Image"}
                    </label>
                  </div>
                </div>

                {/* Course Sponsor & Residual Income */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "rgba(167,139,250,0.9)", marginBottom: "12px", letterSpacing: "0.05em" }}>COURSE / PROJECT SPONSOR</label>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Sponsor Type</label>
                    <select
                      value={editingCoin.coin.sponsorType || "none"}
                      onChange={e => {
                        const val = e.target.value as "player" | "studio" | "none";
                        setEditingCoin({...editingCoin, coin: {...editingCoin.coin, sponsorType: val, sponsorId: "", sponsorName: ""}});
                      }}
                      style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                    >
                      <option value="none" style={{ background: "#16161f" }}>No Sponsor</option>
                      <option value="player" style={{ background: "#16161f" }}>Player</option>
                      <option value="studio" style={{ background: "#16161f" }}>Startup Studio</option>
                    </select>
                  </div>

                  {editingCoin.coin.sponsorType === "player" && (
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Select Player</label>
                      <select
                        value={editingCoin.coin.sponsorId || ""}
                        onChange={e => {
                          const p = mockUsers.find(u => u.id === e.target.value);
                          setEditingCoin({...editingCoin, coin: {...editingCoin.coin, sponsorId: e.target.value, sponsorName: p?.brandName || p?.name || ""}});
                        }}
                        style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                      >
                        <option value="" style={{ background: "#16161f" }}>— Choose Player —</option>
                        {mockUsers.filter(u => u.role === "player").map(u => (
                          <option key={u.id} value={u.id} style={{ background: "#16161f" }}>{u.brandName || u.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingCoin.coin.sponsorType === "studio" && (
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Select Startup Studio</label>
                      <select
                        value={editingCoin.coin.sponsorId || ""}
                        onChange={e => {
                          const s = mockStartupStudios.find(st => st.id === e.target.value);
                          setEditingCoin({...editingCoin, coin: {...editingCoin.coin, sponsorId: e.target.value, sponsorName: s?.name || ""}});
                        }}
                        style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                      >
                        <option value="" style={{ background: "#16161f" }}>— Choose Studio —</option>
                        {mockStartupStudios.map(s => (
                          <option key={s.id} value={s.id} style={{ background: "#16161f" }}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingCoin.coin.sponsorType && editingCoin.coin.sponsorType !== "none" && (
                    <div style={{ marginBottom: "4px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Residual Income %</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editingCoin.coin.residualPercent ?? 10}
                          onChange={e => setEditingCoin({...editingCoin, coin: {...editingCoin.coin, residualPercent: parseInt(e.target.value) || 10}})}
                          style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                        />
                        <span style={{ fontSize: "13px", color: "rgba(167,139,250,0.7)", minWidth: "90px" }}>
                          = {((editingCoin.coin.residualPercent ?? 10) / 100 * editingCoin.coin.xc).toFixed(0)} XC / badge
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>Industry standard: 10%. Sponsor earns this % of XC each time a player completes the course.</p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button type="button" onClick={() => setEditingCoin(null)} style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "none", color: "white", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#f5c842", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {isAdding !== null && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
            <div style={{ background: "#16161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "450px" }}>
              <h2 style={{ margin: "0 0 24px", color: "#f0f0ff" }}>Add to {categories[isAdding].name}</h2>
              <form onSubmit={(e) => handleCreateCoin(e, isAdding)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <input name="name" placeholder="Coin Name" required style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }} />
                <textarea name="description" placeholder="Description" required style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", minHeight: "80px" }} />
                <input name="xc" type="number" placeholder="XC Reward" required style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }} />
                
                {/* Image Upload for New Coin */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Coin Image</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {newCoinImage ? <img src={newCoinImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "24px" }}>🪙</span>}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      id="add-coin-file"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, false);
                      }}
                    />
                    <label htmlFor="add-coin-file" style={{
                      flex: 1, padding: "12px", background: newCoinImage ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px dashed ${newCoinImage ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.2)"}`,
                      borderRadius: "12px", color: newCoinImage ? "#22c55e" : "rgba(255,255,255,0.6)", fontSize: "13px", textAlign: "center", cursor: "pointer"
                    }}>
                      {newCoinImage ? "✓ Image Ready — Click to Change" : "Upload Badge Image"}
                    </label>
                  </div>
                </div>

                {/* Course Sponsor & Residual Income */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "rgba(167,139,250,0.9)", marginBottom: "12px", letterSpacing: "0.05em" }}>COURSE / PROJECT SPONSOR</label>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Sponsor Type</label>
                    <select
                      value={newSponsorType}
                      onChange={e => { setNewSponsorType(e.target.value as "player" | "studio" | "none"); setNewSponsorId(""); setNewSponsorName(""); }}
                      style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                    >
                      <option value="none" style={{ background: "#16161f" }}>No Sponsor</option>
                      <option value="player" style={{ background: "#16161f" }}>Player</option>
                      <option value="studio" style={{ background: "#16161f" }}>Startup Studio</option>
                    </select>
                  </div>

                  {newSponsorType === "player" && (
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Select Player</label>
                      <select
                        value={newSponsorId}
                        onChange={e => { const p = mockUsers.find(u => u.id === e.target.value); setNewSponsorId(e.target.value); setNewSponsorName(p?.brandName || p?.name || ""); }}
                        style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                      >
                        <option value="" style={{ background: "#16161f" }}>— Choose Player —</option>
                        {mockUsers.filter(u => u.role === "player").map(u => (
                          <option key={u.id} value={u.id} style={{ background: "#16161f" }}>{u.brandName || u.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newSponsorType === "studio" && (
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Select Startup Studio</label>
                      <select
                        value={newSponsorId}
                        onChange={e => { const s = mockStartupStudios.find(st => st.id === e.target.value); setNewSponsorId(e.target.value); setNewSponsorName(s?.name || ""); }}
                        style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", appearance: "auto" }}
                      >
                        <option value="" style={{ background: "#16161f" }}>— Choose Studio —</option>
                        {mockStartupStudios.map(s => (
                          <option key={s.id} value={s.id} style={{ background: "#16161f" }}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newSponsorType !== "none" && (
                    <div style={{ marginBottom: "4px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Residual Income %</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={newResidualPercent}
                          onChange={e => setNewResidualPercent(parseInt(e.target.value) || 10)}
                          style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                        />
                        <span style={{ fontSize: "13px", color: "rgba(167,139,250,0.7)", minWidth: "90px" }}>
                          Industry default: 10%
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>Sponsor earns this % of XC each time a player completes the course and earns the badge.</p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button type="button" onClick={() => setIsAdding(null)} style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "none", color: "white", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#f5c842", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Create Coin</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Grant Modal */}
        {grantTarget && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
            <div style={{ background: "#16161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "400px" }}>
              <h2 style={{ margin: "0 0 8px", color: "#f0f0ff" }}>Grant {grantTarget.coin.name}</h2>
              <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>Select a player to award this coin</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px", maxHeight: "200px", overflowY: "auto" }}>
                {applyPlayerImages(mockUsers).filter(u => u.role === "player").map(s => (
                  <button
                    key={s.id}
                    onClick={() => setGrantTarget({...grantTarget, playerId: s.id})}
                    style={{
                      padding: "12px", borderRadius: "12px", border: grantTarget.playerId === s.id ? "1px solid #4f8ef7" : "1px solid rgba(255,255,255,0.05)",
                      background: grantTarget.playerId === s.id ? "rgba(79,142,247,0.1)" : "rgba(255,255,255,0.02)",
                      display: "flex", alignItems: "center", gap: "12px", color: "#f0f0ff", cursor: "pointer", textAlign: "left"
                    }}
                  >
                    <div style={{ width: "24px", height: "24px", overflow: "hidden",
                      borderRadius: s.image ? "50%" : "6px",
                      background: s.image ? "transparent" : "linear-gradient(135deg, #4f8ef7, #8b5cf6)",
                      fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {s.image ? <img src={s.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.avatar}
                    </div>
                    <span style={{ fontSize: "14px", flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Lv.{s.level}</span>
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Amount to Grant</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={grantTarget.amount} 
                    onChange={e => setGrantTarget({...grantTarget, amount: parseInt(e.target.value) || 1})}
                    style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                  />
                  <div style={{ textAlign: "right", minWidth: "100px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#4f8ef7" }}>+{grantTarget.coin.xc * grantTarget.amount} XP</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{grantTarget.amount} Badges</p>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setGrantTarget(null)} style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "none", color: "white", cursor: "pointer" }}>Cancel</button>
                <button 
                  onClick={handleGrantCoin}
                  disabled={!grantTarget.playerId}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#4f8ef7", border: "none", color: "white", fontWeight: 700, cursor: grantTarget.playerId ? "pointer" : "not-allowed", opacity: grantTarget.playerId ? 1 : 0.5 }}
                >Confirm Grant</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
