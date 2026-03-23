"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../components/SideNav";
import { User, mockTasks, mockUsers, mockModifiers, mockTransactions, COIN_CATEGORIES, isHostUser } from "../lib/data";
import { applyPlayerImages } from "../lib/playerImages";
import { saveUsers, saveTransactions } from "../lib/store";
import { saveAndToast } from "../lib/saveToast";
import { playReward, playBadge, playCoin, playTax, playError, playClick, playNav, playToggle } from "../lib/sounds";

// ── Multi-select player picker ────────────────────────────────────────────────
function PlayerPicker({
  players,
  selected,
  onChange,
  accentColor = "#00d4ff",
  accentFaint = "rgba(0,212,255,0.2)",
}: {
  players: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  accentColor?: string;
  accentFaint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cohort, setCohort] = useState("ALL");
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const cohorts = ["ALL", ...Array.from(new Set(players.map(p => p.cohort).filter(Boolean)))];
  const filtered = players.filter(p =>
    (cohort === "ALL" || p.cohort === cohort) &&
    ((p.brandName ?? p.name).toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const selectAllFiltered = () => {
    const ids = filtered.map(p => p.id);
    const allIn = ids.every(id => selected.includes(id));
    if (allIn) onChange(selected.filter(id => !ids.includes(id)));
    else onChange(Array.from(new Set([...selected, ...ids])));
  };

  const selectedPlayers = players.filter(p => selected.includes(p.id));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
          background: "rgba(0,212,255,0.05)", border: `1px solid ${open ? accentColor : accentFaint}`,
          color: selected.length ? "#ffffff" : "rgba(255,255,255,0.35)",
          fontSize: "13px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "all 0.15s", fontFamily: "inherit",
          boxShadow: open ? `0 0 12px ${accentColor}22` : "none",
        }}
      >
        <span>
          {selected.length === 0 ? "Choose players..." : selected.length === 1
            ? (selectedPlayers[0]?.brandName ?? selectedPlayers[0]?.name)
            : `${selected.length} players selected`}
        </span>
        <span style={{ color: accentColor, fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
      </button>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
          {selectedPlayers.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "3px 8px", borderRadius: "6px",
              background: `${accentColor}18`, border: `1px solid ${accentColor}44`,
              fontSize: "11px", color: accentColor, fontFamily: "monospace",
            }}>
              {p.brandName ?? p.name}
              <button type="button" onClick={() => toggle(p.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: accentColor, lineHeight: 1, padding: "0 0 0 2px", fontSize: "12px" }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([])}
            style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "11px", cursor: "pointer", fontFamily: "monospace" }}>
            CLEAR ALL
          </button>
        </div>
      )}

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 500,
          background: "#0d1117", border: `1px solid ${accentColor}33`,
          borderRadius: "10px", overflow: "hidden",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${accentColor}11`,
        }}>
          <div style={{ padding: "10px 10px 6px", display: "flex", gap: "5px", flexWrap: "wrap",
            borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
            {cohorts.map(c => (
              <button key={c} type="button" onClick={() => setCohort(c)} style={{
                padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "10px",
                fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.06em",
                background: cohort === c ? `${accentColor}20` : "transparent",
                border: `1px solid ${cohort === c ? accentColor : "rgba(0,212,255,0.12)"}`,
                color: cohort === c ? accentColor : "rgba(0,212,255,0.4)",
                transition: "all 0.1s",
              }}>{c}</button>
            ))}
          </div>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
            <input type="text" placeholder="Search players..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", fontSize: "12px",
                background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,212,255,0.06)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "rgba(0,212,255,0.4)", fontFamily: "monospace" }}>
              {filtered.length} PLAYERS{cohort !== "ALL" ? ` · ${cohort}` : ""}
            </span>
            <button type="button" onClick={selectAllFiltered} style={{
              padding: "3px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "10px",
              fontWeight: 700, fontFamily: "monospace",
              background: `${accentColor}12`, border: `1px solid ${accentColor}33`, color: accentColor,
            }}>
              {filtered.every(p => selected.includes(p.id)) ? "DESELECT ALL" : "SELECT ALL"}
            </button>
          </div>
          <div style={{ maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "rgba(0,212,255,0.3)", fontSize: "12px", fontFamily: "monospace" }}>
                NO PLAYERS FOUND
              </div>
            ) : filtered.map(p => {
              const checked = selected.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggle(p.id)} style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                  cursor: "pointer", background: checked ? `${accentColor}0a` : "transparent",
                  borderBottom: "1px solid rgba(0,212,255,0.04)", transition: "background 0.1s",
                }}
                  onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.05)"; }}
                  onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0,
                    border: `2px solid ${checked ? accentColor : "rgba(0,212,255,0.25)"}`,
                    background: checked ? `${accentColor}25` : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: checked ? `0 0 6px ${accentColor}44` : "none", transition: "all 0.15s",
                  }}>
                    {checked && <span style={{ color: accentColor, fontSize: "10px", lineHeight: "1" }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: checked ? "#fff" : "rgba(255,255,255,0.75)" }}>
                      {p.brandName ?? p.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(0,212,255,0.4)", fontFamily: "monospace" }}>
                      {p.cohort} · ⚡{p.xcoin.toLocaleString()} · 🪙{p.digitalBadges}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// Violation Picker - dropdown multi-select for violations
function ViolationPicker({
  taxes, selected, onChange,
}: {
  taxes: { id: string; name: string; description?: string; costXcoin: number }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const selectedTaxes = taxes.filter(t => selected.includes(t.id));
  const allSelected = taxes.length > 0 && taxes.every(t => selected.includes(t.id));
  const totalXp = selectedTaxes.reduce((s, t) => s + t.costXcoin, 0);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
          background: "rgba(239,68,68,0.05)",
          border: `1px solid ${open ? "#ef4444" : "rgba(239,68,68,0.2)"}`,
          color: selected.length ? "#ffffff" : "rgba(255,255,255,0.35)",
          fontSize: "13px", textAlign: "left", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          transition: "all 0.15s", fontFamily: "inherit",
          boxShadow: open ? "0 0 12px rgba(239,68,68,0.2)" : "none",
        }}
      >
        <span>
          {selected.length === 0
            ? "Choose violations..."
            : selected.length === 1
              ? selectedTaxes[0]?.name
              : `${selected.length} violations selected`}
        </span>
        <span style={{ color: "#ef4444", fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
          {selectedTaxes.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "3px 8px", borderRadius: "6px",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              fontSize: "11px", color: "#ef4444", fontFamily: "monospace",
            }}>
              {t.name}&nbsp;<span style={{ opacity: 0.6 }}>−{t.costXcoin.toLocaleString()} XC</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", lineHeight: 1, padding: "0 0 0 2px", fontSize: "12px" }}
              >×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "11px", cursor: "pointer", fontFamily: "monospace" }}
          >CLEAR ALL</button>
          {totalXp > 0 && (
            <span style={{ alignSelf: "center", fontSize: "11px", color: "rgba(239,68,68,0.6)", fontFamily: "monospace" }}>
              = −{totalXp.toLocaleString()} XC
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 500,
          background: "#0d1117", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "10px", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(239,68,68,0.08)",
        }}>
          <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(239,68,68,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "rgba(239,68,68,0.4)", fontFamily: "monospace" }}>{taxes.length} VIOLATIONS</span>
            <button
              type="button"
              onClick={() => onChange(allSelected ? [] : taxes.map(t => t.id))}
              style={{ padding: "3px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "10px", fontWeight: 700, fontFamily: "monospace", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
            >
              {allSelected ? "DESELECT ALL" : "SELECT ALL"}
            </button>
          </div>
          <div style={{ maxHeight: "220px", overflowY: "auto" }}>
            {taxes.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "rgba(239,68,68,0.3)", fontSize: "11px", fontFamily: "monospace" }}>NO VIOLATIONS CONFIGURED</div>
            ) : taxes.map((tax, i) => {
              const checked = selected.includes(tax.id);
              return (
                <div
                  key={tax.id}
                  onClick={() => toggle(tax.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", cursor: "pointer",
                    background: checked ? "rgba(239,68,68,0.06)" : "transparent",
                    borderBottom: i < taxes.length - 1 ? "1px solid rgba(239,68,68,0.06)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.04)"; }}
                  onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0,
                    border: `2px solid ${checked ? "#ef4444" : "rgba(239,68,68,0.25)"}`,
                    background: checked ? "rgba(239,68,68,0.2)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: checked ? "0 0 6px rgba(239,68,68,0.3)" : "none", transition: "all 0.15s",
                  }}>
                    {checked && <span style={{ color: "#ef4444", fontSize: "10px" }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: checked ? "#fff" : "rgba(255,255,255,0.7)" }}>{tax.name}</p>
                    {tax.description && <p style={{ margin: 0, fontSize: "10px", color: "rgba(239,68,68,0.45)", fontFamily: "monospace" }}>{tax.description}</p>}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", fontFamily: "monospace", textShadow: checked ? "0 0 8px rgba(239,68,68,0.5)" : "none" }}>
                    −{tax.costXcoin.toLocaleString()} XC
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [taxPlayerIds, setTaxPlayerIds] = useState<string[]>([]);
  const [taxIds, setTaxIds] = useState<string[]>([]);

  const [grantPlayerIds, setGrantPlayerIds] = useState<string[]>([]);
  const [grantType, setGrantType] = useState<"xp" | "xc">("xc");
  const [grantNote, setGrantNote] = useState("");
  const [grantItems, setGrantItems] = useState<{ coinName: string; amount: string }[]>([{ coinName: "", amount: "1" }]);
  const [grantXpAmount, setGrantXpAmount] = useState("");
  const [_tick, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pflx_user");
      if (!stored) { router.push("/"); return; }
      const u = JSON.parse(stored) as User;
      if (!isHostUser(u)) { router.push("/player"); return; }
      setUser(u);
    } catch {
      localStorage.removeItem("pflx_user");
      router.push("/");
    }
    // Re-read mockUsers periodically so new players from other pages appear
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#06090d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00d4ff", fontSize: "14px", letterSpacing: "0.1em", fontFamily: "monospace" }}>LOADING...</div>
    </div>
  );

  const players = applyPlayerImages(mockUsers).filter(u => u.role === "player");
  const totalDigitalBadges = players.reduce((s, u) => s + u.digitalBadges, 0);
  const totalXP = players.reduce((s, u) => s + u.xcoin, 0);
  const pendingApprovals = mockTasks.filter(t => t.status === "submitted").length;
  const availableTaxes = mockModifiers.filter(m => m.type === "tax");
  const topPlayers = [...players].sort((a, b) => b.xcoin - a.xcoin).slice(0, 5);
  const recentSubmissions = mockTasks
    .filter(t => t.status === "submitted")
    .map(t => ({ ...t, player: players.find(s => s.id === t.submittedBy) }));

  const handleApplyTax = () => {
    if (taxPlayerIds.length === 0 || taxIds.length === 0) {
      playError(); showToast("Select at least one player and one violation.", "error"); return;
    }
    const now = new Date().toISOString().split("T")[0];
    let count = 0;
    taxPlayerIds.forEach(pid => {
      taxIds.forEach(tid => {
        const tax = availableTaxes.find(t => t.id === tid);
        const target = mockUsers.find(u => u.id === pid);
        if (!tax || !target) return;
        target.xcoin = Math.max(0, target.xcoin - tax.costXcoin);
        mockTransactions.push({
          id: `tx-${Date.now()}-${pid}-${tid}-${count}`,
          userId: pid, type: "pflx_tax", amount: tax.costXcoin, currency: "xcoin",
          description: `Fine: ${tax.name}`, createdAt: now,
        });
        count++;
      });
    });
    playTax();
    saveAndToast([saveUsers, saveTransactions], "Fines saved to cloud ✓");
    forceUpdate();
    showToast(`${count} fine(s) applied to ${taxPlayerIds.length} player(s).`, "success");
    setTaxPlayerIds([]); setTaxIds([]);
  };

  const handleGrant = () => {
    if (grantPlayerIds.length === 0) { playError(); showToast("Select at least one player.", "error"); return; }
    const now = new Date().toISOString().split("T")[0];
    if (grantType === "xp") {
      const amt = parseInt(grantXpAmount) || 0;
      if (amt <= 0) { playError(); showToast("Enter a valid XC amount.", "error"); return; }
      grantPlayerIds.forEach(pid => {
        const target = mockUsers.find(u => u.id === pid);
        if (!target) return;
        target.xcoin += amt; target.totalXcoin += amt;
        mockTransactions.push({ id: `tx-${Date.now()}-${pid}`, userId: pid, type: "admin_grant",
          amount: amt, currency: "xcoin", description: grantNote || "Admin XC Grant", createdAt: now });
      });
      console.log(`[xc-grant] Granted ${amt} XC to ${grantPlayerIds.length} player(s), ${mockTransactions.length} total txns`);
      playCoin();
      saveAndToast([saveUsers, saveTransactions], "XC granted — saved to cloud ✓");
      showToast(`+${amt.toLocaleString()} XC granted to ${grantPlayerIds.length} player(s).`, "success");
    } else {
      const validItems = grantItems.filter(gi => gi.coinName && parseInt(gi.amount) > 0);
      if (validItems.length === 0) { playError(); showToast("Add at least one badge.", "error"); return; }
      let totalAwarded = 0;
      grantPlayerIds.forEach(pid => {
        const target = mockUsers.find(u => u.id === pid);
        if (!target) return;
        // Ensure badgeCounts exists
        if (!target.badgeCounts) target.badgeCounts = { signature: 0, executive: 0, premium: 0, primary: 0 };
        validItems.forEach(gi => {
          const amt = parseInt(gi.amount);
          const coinDef = COIN_CATEGORIES.flatMap(c => c.coins).find(c => c.name === gi.coinName);
          target.digitalBadges += amt;
          // Update per-type badge breakdown
          const category = COIN_CATEGORIES.find(cat => cat.coins.some(c => c.name === gi.coinName));
          if (category) {
            const catName = category.name.toLowerCase();
            if (catName.includes("primary")) target.badgeCounts.primary += amt;
            else if (catName.includes("premium")) target.badgeCounts.premium += amt;
            else if (catName.includes("executive")) target.badgeCounts.executive += amt;
            else if (catName.includes("signature")) target.badgeCounts.signature += amt;
          }
          if (coinDef) { target.xcoin += coinDef.xc * amt; target.totalXcoin += coinDef.xc * amt; }
          mockTransactions.push({ id: `tx-${Date.now()}-${pid}-${gi.coinName}-${totalAwarded}`,
            userId: pid, type: "admin_grant", amount: amt, currency: "xcoin",
            description: grantNote || `Badge Awarded: ${gi.coinName}`, createdAt: now });
          totalAwarded += amt;
        });
      });
      // Log badge state before saving
      grantPlayerIds.forEach(pid => {
        const u = mockUsers.find(x => x.id === pid);
        if (u) console.log(`[badge-grant] Player "${u.brandName||u.name}": badges=${u.digitalBadges}, badgeCounts=`, u.badgeCounts, `xcoin=${u.xcoin}`);
      });
      console.log(`[badge-grant] mockUsers has ${mockUsers.length} users, mockTransactions has ${mockTransactions.length} txns`);
      playBadge();
      saveAndToast([saveUsers, saveTransactions], "Badges saved to cloud ✓");
      forceUpdate();
      showToast(`${totalAwarded} badge(s) across ${validItems.length} type(s) to ${grantPlayerIds.length} player(s).`, "success");
    }
    forceUpdate();
    setGrantPlayerIds([]); setGrantXpAmount(""); setGrantNote("");
    setGrantItems([{ coinName: "", amount: "1" }]);
  };

  const canGrant = grantPlayerIds.length > 0 && (
    grantType === "xp" ? parseInt(grantXpAmount) > 0 : grantItems.some(gi => gi.coinName && parseInt(gi.amount) > 0)
  );
  const canTax = taxPlayerIds.length > 0 && taxIds.length > 0;

  const CYAN = "#00d4ff";
  const now2 = new Date();
  const timeStr = now2.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now2.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)",
    color: "#ffffff", fontSize: "13px", fontFamily: "inherit", outline: "none",
  };

  const Brackets = ({ color = "rgba(0,212,255,0.4)" }: { color?: string }) => (
    <>
      <div style={{ position: "absolute", top: 8, left: 8, width: 14, height: 14, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ position: "absolute", top: 8, right: 8, width: 14, height: 14, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
      <div style={{ position: "absolute", bottom: 8, left: 8, width: 14, height: 14, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ position: "absolute", bottom: 8, right: 8, width: 14, height: 14, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
    </>
  );

  const panelStyle: React.CSSProperties = {
    position: "relative", background: "rgba(6,14,20,0.95)",
    border: "1px solid rgba(0,212,255,0.15)", borderRadius: "12px", padding: "24px",
    boxShadow: "0 0 20px rgba(0,212,255,0.04), inset 0 1px 0 rgba(0,212,255,0.06)",
  };
  const panelTitle: React.CSSProperties = {
    margin: 0, fontSize: "11px", fontWeight: 700, color: CYAN,
    letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px",
  };
  const fieldLabel: React.CSSProperties = {
    margin: "0 0 5px", fontSize: "9px", fontWeight: 700, color: "rgba(0,212,255,0.45)",
    textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06090d", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .stat-card:hover { border-color: rgba(0,212,255,0.35) !important; box-shadow: 0 0 24px rgba(0,212,255,0.08) !important; }
        .action-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        select option { background: #0a1218; }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.2);border-radius:2px}
      `}</style>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:`linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)`,
        backgroundSize:"50px 50px" }} />
      <div style={{ position:"fixed", top:-200, right:-200, width:700, height:700, borderRadius:"50%",
        background:"radial-gradient(circle,rgba(0,212,255,0.05) 0%,transparent 65%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", left:0, right:0, height:"3px", zIndex:0, pointerEvents:"none",
        background:"linear-gradient(transparent,rgba(0,212,255,0.04),transparent)", animation:"scan 8s linear infinite" }} />

      <SideNav user={user} />

      {toast && (
        <div style={{ position:"fixed", top:"24px", right:"24px", zIndex:9999, padding:"14px 20px", borderRadius:"10px",
          background: toast.type==="success" ? "rgba(0,212,255,0.1)" : "rgba(239,68,68,0.12)",
          border:`1px solid ${toast.type==="success" ? "rgba(0,212,255,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: toast.type==="success" ? CYAN : "#f87171",
          fontSize:"13px", fontWeight:700, maxWidth:"380px",
          boxShadow:`0 0 24px ${toast.type==="success" ? "rgba(0,212,255,0.15)" : "rgba(239,68,68,0.1)"}` }}>
          {toast.type==="success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      <main style={{ flex:1, padding:"28px 32px", overflow:"auto", position:"relative", zIndex:1 }}>

        {/* Status Bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px",
          marginBottom:"24px", background:"rgba(0,212,255,0.04)", border:"1px solid rgba(0,212,255,0.1)",
          borderRadius:"8px", fontFamily:"monospace", fontSize:"10px", color:"rgba(0,212,255,0.5)", letterSpacing:"0.1em" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <span style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", display:"inline-block", animation:"pulse-dot 2s ease-in-out infinite" }} />
              SYSTEM ONLINE
            </span>
            <span>SESSION ACTIVE · {user.brandName?.toUpperCase()}</span>
          </div>
          <div style={{ display:"flex", gap:"16px" }}>
            <span>{dateStr}</span><span>{timeStr}</span><span>v1.0.0</span>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom:"28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>⚡ HOST DASHBOARD</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ EXPERIENCE MANAGEMENT SYSTEM · X-COIN ECONOMY CONTROL ]</p>
        </div>

        {/* Stat Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
          {[
            { label:"Total Players", value:players.length, icon:"👥", color:"#a78bfa", glow:"rgba(167,139,250,0.15)" },
            { label:"Badges Issued", value:totalDigitalBadges.toLocaleString(), icon:"🪙", color:"#f5c842", glow:"rgba(245,200,66,0.12)" },
            { label:"Total XC", value:totalXP.toLocaleString(), icon:"⚡", color:CYAN, glow:"rgba(0,212,255,0.12)" },
            { label:"Pending", value:pendingApprovals, icon:"🔔", color:"#f97316", glow:"rgba(249,115,22,0.12)" },
          ].map(stat => (
            <div key={stat.label} className="stat-card" style={{ position:"relative", background:"rgba(6,14,20,0.95)",
              border:"1px solid rgba(0,212,255,0.12)", borderRadius:"12px", padding:"20px 22px", transition:"all 0.2s", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, right:0, width:"60px", height:"60px",
                background:`radial-gradient(circle at top right,${stat.glow},transparent)`, pointerEvents:"none" }} />
              <Brackets color="rgba(0,212,255,0.25)" />
              <p style={{ margin:"0 0 10px", fontSize:"9px", fontWeight:700, color:"rgba(0,212,255,0.4)",
                letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"monospace" }}>{stat.icon} {stat.label}</p>
              <p style={{ margin:0, fontSize:"30px", fontWeight:900, color:stat.color,
                fontFamily:"monospace", letterSpacing:"0.04em", textShadow:`0 0 20px ${stat.glow}` }}>{stat.value}</p>
              <p style={{ margin:"4px 0 0", fontSize:"9px", color:"rgba(0,212,255,0.25)", fontFamily:"monospace", letterSpacing:"0.1em" }}>LIVE DATA</p>
            </div>
          ))}
        </div>

        {/* Top Players + Pending */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>
          <div style={panelStyle}>
            <Brackets />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <span style={panelTitle}>▸ TOP PLAYERS</span>
              <button onClick={() => router.push("/admin/leaderboard")} style={{ background:"none", border:"none",
                color:"rgba(0,212,255,0.5)", fontSize:"11px", cursor:"pointer", fontWeight:700, fontFamily:"monospace", letterSpacing:"0.08em" }}>VIEW ALL →</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {topPlayers.map((s,i) => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 10px", borderRadius:"8px",
                  background: i===0 ? "rgba(245,200,66,0.06)" : "rgba(0,212,255,0.02)",
                  border:`1px solid ${i===0 ? "rgba(245,200,66,0.15)" : "rgba(0,212,255,0.06)"}` }}>
                  <div style={{ width:"24px", height:"24px", borderRadius:"6px", flexShrink:0,
                    background: i===0?"rgba(245,200,66,0.2)":i===1?"rgba(148,163,184,0.15)":i===2?"rgba(205,124,47,0.15)":"rgba(255,255,255,0.05)",
                    border:`1px solid ${i===0?"rgba(245,200,66,0.4)":"rgba(255,255,255,0.1)"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"11px", fontWeight:800, color:i===0?"#f5c842":"rgba(255,255,255,0.4)", fontFamily:"monospace" }}>{i+1}</div>
                  <div style={{ width:"30px", height:"30px", flexShrink:0, overflow:"hidden",
                    borderRadius: s.image ? "50%" : "8px",
                    background: s.image ? "transparent" : "linear-gradient(135deg,#00d4ff22,#7c3aed33)",
                    border: `1px solid ${s.image ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.2)"}`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", color:CYAN }}>
                    {s.image ? <img src={s.image} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : s.avatar}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:"12px", fontWeight:700, color:"#fff" }}>{s.brandName ?? s.name}</p>
                    <p style={{ margin:0, fontSize:"10px", color:"rgba(0,212,255,0.4)", fontFamily:"monospace" }}>{s.pathway}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ margin:0, fontSize:"12px", fontWeight:700, color:CYAN, fontFamily:"monospace" }}>⚡{s.xcoin.toLocaleString()}</p>
                    <p style={{ margin:0, fontSize:"10px", color:"#f5c842", fontFamily:"monospace" }}>🪙{s.digitalBadges}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, border:"1px solid rgba(249,115,22,0.18)" }}>
            <Brackets color="rgba(249,115,22,0.35)" />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <span style={{ ...panelTitle, color:"#f97316" }}>▸ PENDING APPROVALS</span>
              <button onClick={() => router.push("/admin/approvals")} style={{ background:"none", border:"none",
                color:"rgba(249,115,22,0.5)", fontSize:"11px", cursor:"pointer", fontWeight:700, fontFamily:"monospace", letterSpacing:"0.08em" }}>VIEW ALL →</button>
            </div>
            {recentSubmissions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", color:"rgba(0,212,255,0.2)", fontSize:"11px", fontFamily:"monospace", letterSpacing:"0.1em" }}>✓ NO PENDING ITEMS</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {recentSubmissions.slice(0,4).map(t => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px",
                    borderRadius:"8px", background:"rgba(249,115,22,0.05)", border:"1px solid rgba(249,115,22,0.15)" }}>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:"12px", fontWeight:700, color:"#fff" }}>{t.title}</p>
                      <p style={{ margin:0, fontSize:"10px", color:"rgba(249,115,22,0.55)", fontFamily:"monospace" }}>SUBMITTED · {t.player?.name}</p>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ margin:0, fontSize:"11px", fontWeight:700, color:"#f5c842", fontFamily:"monospace" }}>🪙{t.rewardCoins?.reduce((s:number,rc:{amount:number})=>s+rc.amount,0)??0}</p>
                      <p style={{ margin:0, fontSize:"10px", color:CYAN, fontFamily:"monospace" }}>⚡{t.xcReward}</p>
                    </div>
                    <button onClick={() => router.push("/admin/approvals")} style={{ padding:"5px 12px", borderRadius:"6px",
                      border:"1px solid rgba(249,115,22,0.35)", background:"rgba(249,115,22,0.12)", color:"#f97316",
                      fontSize:"10px", fontWeight:700, cursor:"pointer", fontFamily:"monospace", letterSpacing:"0.08em" }}>REVIEW</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Award + Fine panels ──────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>

          {/* AWARD */}
          <div style={{ ...panelStyle, border:"1px solid rgba(0,212,255,0.18)" }}>
            <Brackets color="rgba(0,212,255,0.35)" />
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}>
              <div style={{ width:36, height:36, borderRadius:"8px", background:"rgba(0,212,255,0.1)",
                border:"1px solid rgba(0,212,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🎁</div>
              <div>
                <p style={{ ...panelTitle, color:CYAN }}>▸ AWARD X-COIN</p>
                <p style={{ margin:0, fontSize:"10px", color:"rgba(0,212,255,0.35)", fontFamily:"monospace" }}>Grant to one or more players</p>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

              <div>
                <p style={fieldLabel}>
                  Select Players
                  {grantPlayerIds.length > 0 && <span style={{ marginLeft:"6px", background:"rgba(0,212,255,0.15)",
                    color:"#00d4ff", padding:"1px 6px", borderRadius:"4px", fontSize:"9px" }}>{grantPlayerIds.length}</span>}
                </p>
                <PlayerPicker players={players} selected={grantPlayerIds} onChange={setGrantPlayerIds} />
              </div>

              <div>
                <p style={fieldLabel}>Award Type</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                  {([{val:"xc" as const,label:"🪙 Digital Badge",accent:"#f5c842"},{val:"xp" as const,label:"⚡ XC",accent:CYAN}]).map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => { playToggle(); setGrantType(opt.val); setGrantItems([{coinName:"",amount:"1"}]); setGrantXpAmount(""); }}
                      style={{ padding:"9px", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:700, fontFamily:"monospace",
                        border:`1px solid ${grantType===opt.val ? opt.accent : "rgba(0,212,255,0.12)"}`,
                        background: grantType===opt.val ? `${opt.accent}18` : "transparent",
                        color: grantType===opt.val ? opt.accent : "rgba(255,255,255,0.35)",
                        transition:"all 0.15s", letterSpacing:"0.06em" }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {grantType === "xp" && (
                <div>
                  <p style={fieldLabel}>XP Amount</p>
                  <input type="number" min={1} value={grantXpAmount} onChange={e => setGrantXpAmount(e.target.value)}
                    placeholder="e.g. 500" style={selectStyle} />
                </div>
              )}

              {grantType === "xc" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                    <p style={{ ...fieldLabel, margin:0 }}>Badges to Award</p>
                    <button type="button" onClick={() => setGrantItems(gi => [...gi, {coinName:"",amount:"1"}])}
                      style={{ padding:"3px 10px", borderRadius:"5px", cursor:"pointer", fontSize:"10px",
                        fontWeight:700, fontFamily:"monospace", letterSpacing:"0.05em",
                        background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.25)", color:CYAN }}>+ ADD BADGE</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    {grantItems.map((gi, idx) => {
                      const coinDef = COIN_CATEGORIES.flatMap(c => c.coins).find(c => c.name === gi.coinName);
                      return (
                        <div key={idx}>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 28px", gap:"6px" }}>
                            <select value={gi.coinName}
                              onChange={e => setGrantItems(items => items.map((it,i) => i===idx ? {...it, coinName:e.target.value} : it))}
                              style={selectStyle}>
                              <option value="">Choose badge...</option>
                              {COIN_CATEGORIES.map(cat => (
                                <optgroup key={cat.name} label={cat.name}>
                                  {cat.coins.map(coin => (
                                    <option key={coin.name} value={coin.name}>{coin.name} (+{coin.xc.toLocaleString()} XC)</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <input type="number" min={1} value={gi.amount}
                              onChange={e => setGrantItems(items => items.map((it,i) => i===idx ? {...it, amount:e.target.value} : it))}
                              style={{ ...selectStyle, textAlign:"center", padding:"10px 6px" }} />
                            <button type="button"
                              onClick={() => setGrantItems(items => items.length===1 ? [{coinName:"",amount:"1"}] : items.filter((_,i) => i!==idx))}
                              style={{ borderRadius:"6px", border:"1px solid rgba(239,68,68,0.2)",
                                background:"rgba(239,68,68,0.08)", color:"#ef4444", fontSize:"14px", cursor:"pointer" }}>×</button>
                          </div>
                          {coinDef && (
                            <div style={{ marginTop:"4px", padding:"5px 9px", borderRadius:"5px",
                              background:"rgba(245,200,66,0.06)", border:"1px solid rgba(245,200,66,0.12)",
                              fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:"monospace" }}>
                              <span style={{ color:"#f5c842", fontWeight:700 }}>+{coinDef.xc.toLocaleString()} XC</span> · {coinDef.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p style={fieldLabel}>Note (optional)</p>
                <input type="text" value={grantNote} onChange={e => setGrantNote(e.target.value)}
                  placeholder="e.g. Extra credit for presentation" style={selectStyle} />
              </div>

              {grantPlayerIds.length > 0 && (
                <div style={{ padding:"8px 12px", borderRadius:"7px",
                  background:"rgba(0,212,255,0.06)", border:"1px solid rgba(0,212,255,0.15)",
                  fontSize:"11px", color:"rgba(0,212,255,0.7)", fontFamily:"monospace", lineHeight:"1.6" }}>
                  <span style={{ color:"#00d4ff", fontWeight:700 }}>{grantPlayerIds.length} player(s)</span>
                  {grantType==="xc" && grantItems.filter(gi=>gi.coinName).length>0 &&
                    <> · {grantItems.filter(gi=>gi.coinName).map(gi=>`${gi.coinName} ×${gi.amount}`).join(", ")}</>}
                  {grantType==="xp" && grantXpAmount &&
                    <> · <span style={{ color:"#a78bfa" }}>+{parseInt(grantXpAmount).toLocaleString()} XP each</span></>}
                </div>
              )}

              <button onClick={handleGrant} disabled={!canGrant} style={{ padding:"12px", borderRadius:"8px", border:"none",
                background: canGrant ? "linear-gradient(135deg,#00d4ff,#7c3aed)" : "rgba(0,212,255,0.08)",
                color: canGrant ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize:"12px", fontWeight:800, cursor: canGrant ? "pointer" : "not-allowed",
                transition:"all 0.2s", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"monospace",
                boxShadow: canGrant ? "0 0 20px rgba(0,212,255,0.25)" : "none" }}>
                ▸ AWARD {grantType==="xp" ? "XC" : grantItems.filter(gi=>gi.coinName).length>1
                  ? `${grantItems.filter(gi=>gi.coinName).length} BADGES` : grantItems[0]?.coinName||"X-COIN"}
                {grantPlayerIds.length>1 ? ` TO ${grantPlayerIds.length} PLAYERS` : ""}
              </button>
            </div>
          </div>

          {/* FINE */}
          <div style={{ ...panelStyle, border:"1px solid rgba(239,68,68,0.18)" }}>
            <Brackets color="rgba(239,68,68,0.35)" />
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}>
              <div style={{ width:36, height:36, borderRadius:"8px", background:"rgba(239,68,68,0.1)",
                border:"1px solid rgba(239,68,68,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🚫</div>
              <div>
                <p style={{ ...panelTitle, color:"#ef4444" }}>▸ ISSUE PFLX FINE</p>
                <p style={{ margin:0, fontSize:"10px", color:"rgba(239,68,68,0.4)", fontFamily:"monospace" }}>Deduct XP for violations</p>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

              <div>
                <p style={{ ...fieldLabel, color:"rgba(239,68,68,0.5)" }}>
                  Select Players
                  {taxPlayerIds.length>0 && <span style={{ marginLeft:"6px", background:"rgba(239,68,68,0.15)",
                    color:"#ef4444", padding:"1px 6px", borderRadius:"4px", fontSize:"9px" }}>{taxPlayerIds.length}</span>}
                </p>
                <PlayerPicker players={players} selected={taxPlayerIds} onChange={setTaxPlayerIds}
                  accentColor="#ef4444" accentFaint="rgba(239,68,68,0.2)" />
              </div>

                            <div>
                <p style={{ ...fieldLabel, color:"rgba(239,68,68,0.5)", margin:"0 0 6px" }}>
                  Violations
                  {taxIds.length>0 && <span style={{ marginLeft:"6px", background:"rgba(239,68,68,0.15)",
                    color:"#ef4444", padding:"1px 6px", borderRadius:"4px", fontSize:"9px" }}>{taxIds.length} selected</span>}
                </p>
                <ViolationPicker taxes={availableTaxes} selected={taxIds} onChange={setTaxIds} />
              </div>
              {taxPlayerIds.length>0 && taxIds.length>0 && (
                <div style={{ padding:"8px 12px", borderRadius:"7px",
                  background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)",
                  fontSize:"11px", color:"rgba(239,68,68,0.7)", fontFamily:"monospace", lineHeight:"1.6" }}>
                  <span style={{ color:"#ef4444", fontWeight:700 }}>{taxPlayerIds.length} player(s)</span>
                  {" · "}{taxIds.length} violation(s) · total −<span style={{ color:"#ef4444", fontWeight:700 }}>
                    {(taxIds.reduce((sum,tid) => {
                      const t = availableTaxes.find(x => x.id===tid);
                      return sum + (t?.costXcoin ?? 0);
                    }, 0) * taxPlayerIds.length).toLocaleString()} XC
                  </span>
                </div>
              )}

              <button onClick={handleApplyTax} disabled={!canTax} style={{ padding:"12px", borderRadius:"8px", border:"none",
                background: canTax ? "linear-gradient(135deg,#ef4444,#7f1d1d)" : "rgba(239,68,68,0.08)",
                color: canTax ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize:"12px", fontWeight:800, cursor: canTax ? "pointer" : "not-allowed",
                transition:"all 0.2s", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"monospace",
                boxShadow: canTax ? "0 0 20px rgba(239,68,68,0.25)" : "none" }}>
                ▸ APPLY {taxIds.length>1 ? `${taxIds.length} FINES` : "FINE"}
                {taxPlayerIds.length>1 ? ` TO ${taxPlayerIds.length} PLAYERS` : ""}
              </button>
              <p style={{ margin:"4px 0 0", fontSize:"9px", color:"rgba(239,68,68,0.3)", fontFamily:"monospace", letterSpacing:"0.06em" }}>
                * BADGES UNAFFECTED · XP &amp; RANK REDUCED
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ ...panelStyle, border:"1px solid rgba(0,212,255,0.12)" }}>
          <Brackets />
          <p style={{ ...panelTitle, marginBottom:"16px" }}>▸ QUICK ACTIONS</p>
          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {[
              { label:"➕ NEW TASK", onClick:()=>router.push("/admin/task-management"), color:"#f5c842" },
              { label:"💼 POST JOB", onClick:()=>router.push("/admin/task-management"), color:"#a78bfa" },
              { label:"💎 MANAGE COINS", onClick:()=>router.push("/admin/coins"), color:CYAN },
              { label:"👥 PLAYERS", onClick:()=>router.push("/admin/players"), color:"#a78bfa" },
              { label:"🔔 APPROVALS", onClick:()=>router.push("/admin/approvals"), color:"#f97316" },
              { label:"🏆 LEADERBOARD", onClick:()=>router.push("/admin/leaderboard"), color:"#f5c842" },
            ].map(a => (
              <button key={a.label} onClick={a.onClick} className="action-btn" style={{
                padding:"9px 16px", borderRadius:"8px", border:`1px solid ${a.color}33`,
                background:`${a.color}0e`, color:a.color, fontSize:"10px", fontWeight:700,
                cursor:"pointer", transition:"all 0.15s", fontFamily:"monospace", letterSpacing:"0.08em" }}>{a.label}</button>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
