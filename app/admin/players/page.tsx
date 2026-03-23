"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, getLevelFromXC, getCurrentRank, generatePin,
  isHostUser,
} from "../../lib/data";
import { savePlayerImage, applyPlayerImages } from "../../lib/playerImages";

// ─── Avatar color palette (deterministic by id) ───────────────────────────────
const AVATAR_COLORS = [
  ["#f97316","#7c2d12"], ["#a855f7","#3b0764"], ["#22c55e","#14532d"],
  ["#3b82f6","#1e3a8a"], ["#f59e0b","#78350f"], ["#ef4444","#7f1d1d"],
  ["#06b6d4","#164e63"], ["#ec4899","#831843"],
];
function avatarColor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] as [string, string];
}

type SortKey = "name" | "brandName" | "xcoin" | "digitalBadges" | "level" | "rank" | "joinedAt";
type SortDir = "asc" | "desc";

// ─── 3-dot dropdown ────────────────────────────────────────────────────────────
function ActionsMenu({ player, onEdit, onDelete, onToggleHost }: {
  player: User;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHost: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#00d4ff", fontSize: "18px", lineHeight: 1,
          padding: "4px 8px", borderRadius: "6px",
          transition: "all .15s ease-out",
          textShadow: "0 0 10px rgba(0,212,255,0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#00d4ff";
          e.currentTarget.style.textShadow = "0 0 20px rgba(0,212,255,0.6)";
          e.currentTarget.style.background = "rgba(0,212,255,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#00d4ff";
          e.currentTarget.style.textShadow = "0 0 10px rgba(0,212,255,0.3)";
          e.currentTarget.style.background = "none";
        }}
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px",
          background: "linear-gradient(135deg, #0d1117 0%, #06090d 100%)",
          border: "1px solid #00d4ff",
          borderRadius: "8px",
          boxShadow: "0 0 20px rgba(0,212,255,0.2), inset 0 0 10px rgba(0,212,255,0.05)",
          zIndex: 1000,
          minWidth: "160px",
          overflow: "hidden",
        }}>
          <MenuItem label="Edit" onClick={() => { onEdit(); setOpen(false); }} />
          <MenuItem label="Delete" onClick={() => { onDelete(); setOpen(false); }} />
          <MenuItem label={isHostUser(player) ? "Unhost" : "Make Host"} onClick={() => { onToggleHost(); setOpen(false); }} />
        </div>
      )}
    </div>
  );

  function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "10px 16px", background: "transparent", border: "none",
          color: "#00d4ff", cursor: "pointer", fontSize: "13px",
          fontWeight: "500", transition: "all .15s ease-out",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
          textShadow: "0 0 8px rgba(0,212,255,0.2)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,212,255,0.1)";
          e.currentTarget.style.textShadow = "0 0 15px rgba(0,212,255,0.6)";
          e.currentTarget.style.paddingLeft = "20px";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.textShadow = "0 0 8px rgba(0,212,255,0.2)";
          e.currentTarget.style.paddingLeft = "16px";
        }}
      >
        {label}
      </button>
    );
  }
}

// ─── Column header with sorting ────────────────────────────────────────────────
function ColHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: "12px 16px",
        textAlign: "left",
        background: "linear-gradient(90deg, rgba(0,212,255,0.05) 0%, rgba(0,212,255,0.02) 100%)",
        borderBottom: "2px solid #00d4ff",
        color: isActive ? "#00d4ff" : "rgba(0,212,255,0.7)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "700",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        transition: "all .2s ease-out",
        userSelect: "none",
        textShadow: isActive ? "0 0 12px rgba(0,212,255,0.5)" : "0 0 6px rgba(0,212,255,0.2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "linear-gradient(90deg, rgba(0,212,255,0.1) 0%, rgba(0,212,255,0.05) 100%)";
        e.currentTarget.style.textShadow = "0 0 15px rgba(0,212,255,0.6)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "linear-gradient(90deg, rgba(0,212,255,0.05) 0%, rgba(0,212,255,0.02) 100%)";
        e.currentTarget.style.textShadow = isActive ? "0 0 12px rgba(0,212,255,0.5)" : "0 0 6px rgba(0,212,255,0.2)";
      }}
    >
      {label} {isActive && (currentSort.dir === "asc" ? "↑" : "↓")}
    </th>
  );
}

// ─── Compact chip dropdown (leaderboard-style) ───────────────────────────────
const CYAN = "#00d4ff";
function ChipSelect<T extends string>({
  label, value, options, onChange, activeColor = CYAN,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  activeColor?: string;
}) {
  const isFiltered = value !== "all";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          background: isFiltered ? `${activeColor}14` : "rgba(255,255,255,0.04)",
          border: `1px solid ${isFiltered ? activeColor + "50" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "7px",
          color: isFiltered ? activeColor : "rgba(255,255,255,0.45)",
          fontSize: "11px", fontWeight: 700, padding: "3px 7px",
          cursor: "pointer", outline: "none", letterSpacing: "0.04em",
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key} style={{ background: "#10101e" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AdminPlayers() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [pathwayFilter, setPathwayFilter] = useState<string>("all");
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const [editingPlayer, setEditingPlayer] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCSV, setImportCSV] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "admin") { router.push("/player"); return; }
    setUser(u);
    // Apply any persisted profile images on top of the mock data
    setPlayers(applyPlayerImages(mockUsers));
  }, [router]);

  if (!user) return null;

  const allCohorts = Array.from(new Set(players.map(p => p.cohort))).sort();
  const allPathways = Array.from(new Set(players.map(p => p.pathway))).sort();

  const hasFilters = cohortFilter !== "all" || pathwayFilter !== "all" || hostFilter !== "all" || search !== "";

  // Helper: avatar element shown in rows
  function PlayerAvatar({ player }: { player: User }) {
    const [bg, text] = avatarColor(player.id);
    return (
      <div style={{
        width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: player.image ? "transparent" : `linear-gradient(135deg, ${bg} 0%, ${text} 100%)`,
        border: "1.5px solid rgba(0,212,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: "14px", color: "#fff",
        boxShadow: player.image ? "0 0 10px rgba(0,212,255,0.25)" : `0 0 10px ${bg}80`,
      }}>
        {player.image
          ? <img src={player.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : player.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  let filtered = players.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brandName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCohort = cohortFilter === "all" || p.cohort === cohortFilter;
    const matchesPathway = pathwayFilter === "all" || p.pathway === pathwayFilter;
    const matchesHost =
      hostFilter === "all" ||
      (hostFilter === "yes" && isHostUser(p)) ||
      (hostFilter === "no" && !isHostUser(p));
    return matchesSearch && matchesCohort && matchesPathway && matchesHost;
  });

  if (sort.key === "level") {
    filtered.sort((a, b) => {
      const aLvl = getLevelFromXC(a.xcoin);
      const bLvl = getLevelFromXC(b.xcoin);
      return sort.dir === "asc" ? aLvl - bLvl : bLvl - aLvl;
    });
  } else if (sort.key === "rank") {
    filtered.sort((a, b) => {
      const aRank = getCurrentRank(a.xcoin);
      const bRank = getCurrentRank(b.xcoin);
      return sort.dir === "asc" ? aRank.name.localeCompare(bRank.name) : bRank.name.localeCompare(aRank.name);
    });
  } else {
    const key = sort.key as keyof User;
    filtered.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sort.dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sort.dir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }

  const filteredHosts = filtered.filter(p => isHostUser(p));
  const filteredPlayers = filtered.filter(p => !isHostUser(p));

  const handleSort = (key: SortKey) => {
    setSort(s => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setShowEditModal(true);
  };

  const handleEditPlayer = (player: User) => {
    setEditingPlayer(player);
    setShowEditModal(true);
  };

  const handleDeletePlayer = (player: User) => {
    setDeleteTarget(player);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      // Update mock array so auto-save detects the change
      const idx = mockUsers.findIndex(u => u.id === deleteTarget.id);
      if (idx !== -1) mockUsers.splice(idx, 1);
      setPlayers(players.filter(p => p.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setToast({ msg: "Player deleted successfully", type: "success" });
    }
  };

  const handleToggleHost = (player: User) => {
    const newHost = isHostUser(player);
    alert(`${newHost ? "Unhost" : "Make host"} ${player.name}?`);
  };

  const handleSavePlayer = (updatedPlayer: User) => {
    // Persist the image in the shared image store so ALL pages see it
    savePlayerImage(updatedPlayer.id, updatedPlayer.image ?? "");

    if (editingPlayer) {
      // Update mock array so auto-save detects the change
      const idx = mockUsers.findIndex(u => u.id === editingPlayer.id);
      if (idx !== -1) mockUsers[idx] = updatedPlayer;
      setPlayers(players.map(p => (p.id === editingPlayer.id ? updatedPlayer : p)));
      // If the edited player is the currently logged-in user, also update
      // the pflx_user entry so the SideNav reflects the change immediately
      if (updatedPlayer.id === user.id) {
        const stored = localStorage.getItem("pflx_user");
        if (stored) {
          const merged: User = { ...JSON.parse(stored), image: updatedPlayer.image };
          localStorage.setItem("pflx_user", JSON.stringify(merged));
          setUser(merged);
        }
      }
    } else {
      // Add to mock array so auto-save detects the change
      mockUsers.push(updatedPlayer);
      setPlayers([...players, updatedPlayer]);
    }
    setShowEditModal(false);
    setToast({ msg: `Player ${editingPlayer ? "updated" : "created"} successfully`, type: "success" });
  };

  const handleImportCSV = () => {
    try {
      const lines = importCSV.trim().split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        setToast({ msg: "Import failed: need a header row + at least one player row", type: "error" });
        return;
      }

      const header = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx   = header.indexOf("name");
      const brandIdx  = header.findIndex(h => h === "brandname" || h === "brand");
      const cohortIdx = header.indexOf("cohort");
      const emailIdx  = header.indexOf("email");

      if (nameIdx === -1 || brandIdx === -1 || cohortIdx === -1 || emailIdx === -1) {
        setToast({ msg: "CSV must include columns: name, brandName, cohort, email", type: "error" });
        return;
      }

      const newPlayers: User[] = lines.slice(1).map((line, i) => {
        const values = line.split(",").map(v => v.trim());
        const name      = values[nameIdx]   || `Player ${i + 1}`;
        const brandName = values[brandIdx]  || name;
        const cohort    = values[cohortIdx] || "Cohort 1";
        const email     = values[emailIdx]  || "";
        const id        = `player-import-${Date.now()}-${i}`;
        return {
          id,
          name,
          brandName,
          email,
          cohort,
          role: "player" as const,
          avatar: name.substring(0, 2).toUpperCase(),
          digitalBadges: 0,
          xcoin: 0,
          totalXcoin: 0,
          level: 1,
          rank: 1,
          pathway: "",
          joinedAt: new Date().toISOString().split("T")[0],
          pin: generatePin(),
          claimed: false,
        };
      });

      // Push into live mockUsers so the rest of the app sees them immediately
      mockUsers.push(...newPlayers);
      setPlayers([...players, ...newPlayers]);
      setShowImportModal(false);
      setImportCSV("");
      setToast({ msg: `${newPlayers.length} player${newPlayers.length !== 1 ? "s" : ""} imported successfully`, type: "success" });
    } catch {
      setToast({ msg: "Import failed: check your CSV format", type: "error" });
    }
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #06090d 0%, #0d1117 50%, #0a0e14 100%)",
      color: "#e0e8ff",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <SideNav user={user} />
      <main style={{
        flex: 1,
        padding: "24px",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
          paddingBottom: "16px",
          borderBottom: "1px solid rgba(0,212,255,0.12)",
        }}>
          <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>👥 PLAYER MANAGEMENT</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ MANAGE PLAYERS, COHORTS & ACCESS PERMISSIONS ]</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={handleAddPlayer}
              style={{
                padding: "9px 18px",
                background: "linear-gradient(135deg, #00d4ff 0%, #00a8cc 100%)",
                border: "none", borderRadius: "8px",
                color: "#06090d", fontWeight: 700, fontSize: "13px", cursor: "pointer",
                boxShadow: "0 0 15px rgba(0,212,255,0.3)",
                letterSpacing: "0.3px",
              }}
            >
              + Add Player
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                padding: "9px 18px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.35)", borderRadius: "8px",
                color: "#00d4ff", fontWeight: 600, fontSize: "13px", cursor: "pointer",
              }}
            >
              Import CSV
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 20px",
            background: toast.type === "success"
              ? "linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.1) 100%)"
              : "linear-gradient(135deg, rgba(255,100,100,0.2) 0%, rgba(255,100,100,0.1) 100%)",
            border: `1px solid ${toast.type === "success" ? "#00d4ff" : "#ff6464"}`,
            borderRadius: "8px",
            color: toast.type === "success" ? "#00d4ff" : "#ff9999",
            fontSize: "13px",
            fontWeight: "500",
            boxShadow: toast.type === "success"
              ? "0 0 20px rgba(0,212,255,0.3)"
              : "0 0 20px rgba(255,100,100,0.3)",
            textShadow: "0 0 8px currentColor",
            animation: "slideInUp .3s ease-out",
            zIndex: 2000,
          }} onAnimationEnd={() => setToast(null)}>
            {toast.msg}
          </div>
        )}

        {/* Table */}
        <div style={{
          borderRadius: "12px",
          border: "1px solid rgba(0,212,255,0.15)",
          boxShadow: "0 0 30px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.02)",
          background: "linear-gradient(135deg, rgba(6,9,13,0.9) 0%, rgba(13,17,23,0.9) 100%)",
          overflow: "hidden",
        }}>

          {/* ── Compact filter toolbar ────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
            padding: "10px 16px",
            borderBottom: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(0,212,255,0.03)",
          }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "3px 9px",
                background: search ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${search ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "7px",
                color: search ? "#00d4ff" : "rgba(255,255,255,0.45)",
                fontSize: "11px", fontWeight: 700, outline: "none",
                width: "110px", letterSpacing: "0.04em",
              }}
            />
            <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
            <ChipSelect<string>
              label="COHORT"
              value={cohortFilter}
              onChange={setCohortFilter}
              activeColor={CYAN}
              options={[
                { key: "all", label: "All cohorts" },
                ...allCohorts.map(c => ({ key: c, label: c })),
              ]}
            />
            {allPathways.length > 0 && (
              <>
                <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
                <ChipSelect<string>
                  label="PATHWAY"
                  value={pathwayFilter}
                  onChange={setPathwayFilter}
                  activeColor="#a78bfa"
                  options={[
                    { key: "all", label: "All pathways" },
                    ...allPathways.map(p => ({ key: p, label: p })),
                  ]}
                />
              </>
            )}
            <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
            <ChipSelect<string>
              label="ROLE"
              value={hostFilter}
              onChange={setHostFilter}
              activeColor="#f5c842"
              options={[
                { key: "all",  label: "All roles" },
                { key: "no",   label: "Players only" },
                { key: "yes",  label: "Hosts only" },
              ]}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: hasFilters ? "#00d4ff" : "rgba(0,212,255,0.3)", letterSpacing: "0.06em" }}>
              {filtered.length} PLAYER{filtered.length !== 1 ? "S" : ""}
              {hasFilters && (
                <button
                  onClick={() => { setCohortFilter("all"); setPathwayFilter("all"); setHostFilter("all"); setSearch(""); }}
                  style={{ marginLeft: "8px", fontSize: "10px", color: "rgba(0,212,255,0.5)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  clear
                </button>
              )}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>

            {/* ── HOSTS table ─────────────────────────────────────── */}
            {filteredHosts.length > 0 && (
              <>
                <div style={{
                  padding: "8px 16px",
                  background: "rgba(245,200,66,0.04)",
                  borderBottom: "1px solid rgba(245,200,66,0.12)",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "rgba(245,200,66,0.7)", letterSpacing: "0.12em" }}>
                    ⚡ HOSTS &amp; CO-HOSTS
                  </span>
                  <span style={{ fontSize: "10px", color: "rgba(245,200,66,0.35)", fontWeight: 600 }}>
                    {filteredHosts.length}
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(90deg, rgba(245,200,66,0.06) 0%, rgba(245,200,66,0.02) 100%)" }}>
                      {(["Name","Brand","Email","Cohort","Joined","Actions"] as const).map(label => (
                        <th key={label} style={{
                          padding: "10px 16px", textAlign: "left",
                          borderBottom: "1px solid rgba(245,200,66,0.2)",
                          color: "rgba(245,200,66,0.6)", fontSize: "11px",
                          fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                        }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHosts.map((host, idx) => (
                      <tr key={host.id}
                        style={{
                          background: idx % 2 === 0 ? "rgba(245,200,66,0.02)" : "transparent",
                          borderBottom: "1px solid rgba(245,200,66,0.06)",
                          transition: "background .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,200,66,0.06)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? "rgba(245,200,66,0.02)" : "transparent"; }}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <PlayerAvatar player={host} />
                            <span
                              onClick={e => { e.stopPropagation(); router.push(`/profile/${host.id}`); }}
                              style={{ fontWeight: 600, color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.3)", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(245,200,66,0.3)" }}
                            >
                              {host.name}
                            </span>
                            <span style={{ fontSize: "10px", color: "rgba(245,200,66,0.5)", fontWeight: 700, letterSpacing: "0.06em" }}>
                              {host.isHost ? "CO-HOST" : "HOST"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", color: "rgba(224,232,255,0.8)" }}>{host.brandName}</td>
                        <td style={{ padding: "10px 16px", color: "rgba(224,232,255,0.5)", fontSize: "12px" }}>{host.email || <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}</td>
                        <td style={{ padding: "10px 16px", color: "rgba(224,232,255,0.6)", fontSize: "12px" }}>{host.cohort}</td>
                        <td style={{ padding: "10px 16px", color: "rgba(224,232,255,0.5)", fontSize: "12px" }}>
                          {new Date(host.joinedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "center" }}>
                          <ActionsMenu
                            player={host}
                            onEdit={() => handleEditPlayer(host)}
                            onDelete={() => handleDeletePlayer(host)}
                            onToggleHost={() => handleToggleHost(host)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ── PLAYERS table ───────────────────────────────────── */}
            {(filteredHosts.length > 0 || filteredPlayers.length > 0) && (
              <div style={{
                padding: "8px 16px",
                background: "rgba(0,212,255,0.03)",
                borderBottom: "1px solid rgba(0,212,255,0.08)",
                borderTop: filteredHosts.length > 0 ? "1px solid rgba(0,212,255,0.08)" : undefined,
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "rgba(0,212,255,0.5)", letterSpacing: "0.12em" }}>
                  👤 PLAYERS
                </span>
                <span style={{ fontSize: "10px", color: "rgba(0,212,255,0.3)", fontWeight: 600 }}>
                  {filteredPlayers.length}
                </span>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "linear-gradient(90deg, rgba(0,212,255,0.08) 0%, rgba(0,212,255,0.03) 100%)" }}>
                  <ColHeader label="Name" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <ColHeader label="Brand" sortKey="brandName" currentSort={sort} onSort={handleSort} />
                  <th style={{ padding: "12px 16px", textAlign: "left", background: "linear-gradient(90deg, rgba(0,212,255,0.05) 0%, rgba(0,212,255,0.02) 100%)", borderBottom: "2px solid #00d4ff", color: "rgba(0,212,255,0.7)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Email</th>
                  <ColHeader label="Level" sortKey="level" currentSort={sort} onSort={handleSort} />
                  <ColHeader label="XC" sortKey="xcoin" currentSort={sort} onSort={handleSort} />
                  <ColHeader label="Badges" sortKey="digitalBadges" currentSort={sort} onSort={handleSort} />
                  <ColHeader label="Rank" sortKey="rank" currentSort={sort} onSort={handleSort} />
                  <ColHeader label="Joined" sortKey="joinedAt" currentSort={sort} onSort={handleSort} />
                  <th style={{
                    padding: "12px 16px", textAlign: "left",
                    borderBottom: "2px solid #00d4ff",
                    color: "rgba(0,212,255,0.7)", fontSize: "12px",
                    fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, idx) => {
                  const level = getLevelFromXC(player.xcoin);
                  const rank = getCurrentRank(player.xcoin);
                  return (
                    <tr key={player.id}
                      style={{
                        background: idx % 2 === 0
                          ? "linear-gradient(90deg, rgba(0,212,255,0.02) 0%, rgba(0,0,0,0) 100%)"
                          : "transparent",
                        borderBottom: "1px solid rgba(0,212,255,0.08)",
                        transition: "all .2s ease-out",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "linear-gradient(90deg, rgba(0,212,255,0.08) 0%, rgba(0,212,255,0.03) 100%)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = idx % 2 === 0
                          ? "linear-gradient(90deg, rgba(0,212,255,0.02) 0%, rgba(0,0,0,0) 100%)"
                          : "transparent";
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <PlayerAvatar player={player} />
                          <span
                            onClick={e => { e.stopPropagation(); router.push(`/profile/${player.id}`); }}
                            style={{ fontWeight: 600, color: "#00d4ff", textShadow: "0 0 8px rgba(0,212,255,0.3)", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(0,212,255,0.3)" }}
                          >
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "rgba(224,232,255,0.9)" }}>{player.brandName}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {player.email
                          ? <span style={{ fontSize: "12px", color: "rgba(0,212,255,0.6)", fontFamily: "monospace" }}>{player.email}</span>
                          : <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.15)" }}>—</span>}
                        {player.claimed === false && player.email && (
                          <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 800, color: "#f5c842", background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.3)", borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.05em" }}>UNCLAIMED</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#00d4ff", fontWeight: 600 }}>{level}</td>
                      <td style={{ padding: "12px 16px", color: "rgba(224,232,255,0.8)" }}>
                        {player.xcoin.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#00d4ff", fontWeight: 600 }}>
                        {player.digitalBadges.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px", color: "rgba(224,232,255,0.9)" }}>{rank.name}</td>
                      <td style={{ padding: "12px 16px", color: "rgba(224,232,255,0.7)", fontSize: "12px" }}>
                        {new Date(player.joinedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <ActionsMenu
                          player={player}
                          onEdit={() => handleEditPlayer(player)}
                          onDelete={() => handleDeletePlayer(player)}
                          onToggleHost={() => handleToggleHost(player)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{
                padding: "40px 20px", textAlign: "center",
                color: "rgba(0,212,255,0.5)", fontSize: "14px",
              }}>
                No players match your filters.
              </div>
            )}
          </div>{/* end overflowX scroll wrapper */}
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div style={overlayStyle()}>
            <div style={modalStyle()}>
              <h2 style={{
                fontSize: "22px",
                fontWeight: "700",
                margin: "0 0 20px 0",
                color: "#00d4ff",
                textShadow: "0 0 15px rgba(0,212,255,0.4)",
              }}>
                {editingPlayer ? "Edit Player" : "Add New Player"}
              </h2>
              <EditPlayerForm
                player={editingPlayer}
                onSave={handleSavePlayer}
                onCancel={() => setShowEditModal(false)}
              />
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && deleteTarget && (
          <div style={overlayStyle()}>
            <div style={modalStyle()}>
              <h2 style={{
                fontSize: "20px",
                fontWeight: "700",
                margin: "0 0 16px 0",
                color: "#ff6464",
                textShadow: "0 0 12px rgba(255,100,100,0.4)",
              }}>
                Confirm Delete
              </h2>
              <p style={{
                margin: "0 0 20px 0",
                color: "rgba(224,232,255,0.8)",
                fontSize: "14px",
              }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
              </p>
              <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={cancelBtn()}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    ...btnStyle(),
                    background: "linear-gradient(135deg, #ff6464 0%, #cc5252 100%)",
                    boxShadow: "0 0 15px rgba(255,100,100,0.3), 0 4px 15px rgba(255,100,100,0.2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 25px rgba(255,100,100,0.5), 0 8px 25px rgba(255,100,100,0.3)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(255,100,100,0.3), 0 4px 15px rgba(255,100,100,0.2)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div style={overlayStyle()}>
            <div style={modalStyle()}>
              <h2 style={{
                fontSize: "22px",
                fontWeight: "700",
                margin: "0 0 12px 0",
                color: "#00d4ff",
                textShadow: "0 0 15px rgba(0,212,255,0.4)",
              }}>
                Import Players from CSV
              </h2>

              {/* Format instructions */}
              <div style={{
                background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: "8px", padding: "12px 14px", marginBottom: "14px",
              }}>
                <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 800, color: "rgba(0,212,255,0.7)", letterSpacing: "0.08em" }}>
                  REQUIRED COLUMNS
                </p>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                  Only four columns are needed. Everything else (PIN, XC, level, etc.) is generated automatically.
                </p>
                <code style={{ fontSize: "11px", color: "#00d4ff", background: "rgba(0,212,255,0.08)", padding: "4px 8px", borderRadius: "5px", display: "block", letterSpacing: "0.03em" }}>
                  name, brandName, cohort, email
                </code>
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                  Example: <span style={{ color: "rgba(0,212,255,0.6)" }}>Jordan Smith, DesignDriven, Cohort 1, jordan@school.edu</span>
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(167,139,250,0.7)" }}>
                  ✦ Players use their email to claim their account and complete the diagnostic.
                </p>
              </div>

              <textarea
                value={importCSV}
                onChange={(e) => setImportCSV(e.target.value)}
                placeholder={"name,brandName,cohort,email\nJordan Smith,DesignDriven,Cohort 1,jordan@school.edu\nAlex Torres,PixelForge,Cohort 1,alex@school.edu"}
                style={{
                  width: "100%",
                  height: "180px",
                  padding: "12px",
                  background: "rgba(6,9,13,0.8)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  borderRadius: "8px",
                  color: "#00d4ff",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  boxShadow: "inset 0 0 10px rgba(0,212,255,0.05)",
                  textShadow: "0 0 6px rgba(0,212,255,0.2)",
                  marginBottom: "16px",
                  resize: "vertical",
                  transition: "all .2s ease-out",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#00d4ff";
                  e.currentTarget.style.boxShadow = "inset 0 0 15px rgba(0,212,255,0.1), 0 0 20px rgba(0,212,255,0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)";
                  e.currentTarget.style.boxShadow = "inset 0 0 10px rgba(0,212,255,0.05)";
                }}
              />
              <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}>
                <button
                  onClick={() => setShowImportModal(false)}
                  style={cancelBtn()}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportCSV}
                  style={btnStyle()}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        input::placeholder {
          color: rgba(0, 212, 255, 0.3);
        }
        textarea::placeholder {
          color: rgba(0, 212, 255, 0.3);
        }
      `}</style>
    </div>
  );
}

// ─── Image Cropper ────────────────────────────────────────────────────────────
function ImageCropper({
  src, onApply, onCancel,
}: { src: string; onApply: (dataUrl: string) => void; onCancel: () => void }) {
  const PREV = 180;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);

  // Load image once when component mounts
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = src;
  }, [src]);

  // Redraw canvas whenever zoom or offset changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, PREV, PREV);
    ctx.save();
    ctx.beginPath();
    ctx.arc(PREV / 2, PREV / 2, PREV / 2, 0, Math.PI * 2);
    ctx.clip();
    const cover = Math.max(PREV / img.naturalWidth, PREV / img.naturalHeight) * zoom;
    const w = img.naturalWidth * cover;
    const h = img.naturalHeight * cover;
    ctx.drawImage(img, PREV / 2 - w / 2 + offX, PREV / 2 - h / 2 + offY, w, h);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(PREV / 2, PREV / 2, PREV / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,212,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [zoom, offX, offY, src]);

  const applyAndClose = () => {
    const img = imgRef.current;
    if (!img) return;
    const OUT = 200;
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    const cover = Math.max(OUT / img.naturalWidth, OUT / img.naturalHeight) * zoom;
    const w = img.naturalWidth * cover;
    const h = img.naturalHeight * cover;
    const scale = OUT / PREV;
    ctx.drawImage(img, OUT / 2 - w / 2 + offX * scale, OUT / 2 - h / 2 + offY * scale, w, h);
    onApply(c.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "4px 0" }}>
      <p style={{ margin: 0, fontSize: "11px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.04em" }}>
        Drag to reposition · Adjust zoom
      </p>
      <canvas
        ref={canvasRef}
        width={PREV}
        height={PREV}
        style={{ borderRadius: "50%", cursor: "move", boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}
        onMouseDown={e => {
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offX, oy: offY };
        }}
        onMouseMove={e => {
          if (!dragRef.current) return;
          setOffX(dragRef.current.ox + (e.clientX - dragRef.current.sx));
          setOffY(dragRef.current.oy + (e.clientY - dragRef.current.sy));
        }}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseLeave={() => { dragRef.current = null; }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", maxWidth: "240px" }}>
        <span style={{ fontSize: "11px", color: "rgba(0,212,255,0.5)", whiteSpace: "nowrap" }}>Zoom</span>
        <input
          type="range" min="0.5" max="4" step="0.05" value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#00d4ff" }}
        />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#00d4ff", minWidth: "28px", textAlign: "right" }}>
          {zoom.toFixed(1)}×
        </span>
      </div>
      <button
        onClick={() => { setZoom(1); setOffX(0); setOffY(0); }}
        style={{ fontSize: "11px", background: "none", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "6px", padding: "4px 12px", color: "rgba(0,212,255,0.5)", cursor: "pointer" }}
      >
        Reset
      </button>
      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={applyAndClose} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #00d4ff, #00a8cc)", border: "none", borderRadius: "7px", color: "#06090d", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
          Apply as Profile Photo
        </button>
      </div>
    </div>
  );
}

// ─── Edit Player Form ─────────────────────────────────────────────────────────
function EditPlayerForm({ player, onSave, onCancel }: {
  player: User | null;
  onSave: (p: User) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<User>(
    player || {
      id: Math.random().toString(36).slice(2),
      name: "",
      brandName: "",
      role: "player" as const,
      avatar: "⚡",
      digitalBadges: 0,
      xcoin: 0,
      totalXcoin: 0,
      level: 1,
      rank: 1,
      cohort: "",
      pathway: "",
      joinedAt: new Date().toISOString().split("T")[0],
      pin: generatePin(),
      image: "",
      email: "",
    }
  );
  const [showPin, setShowPin] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCropSrc(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      maxHeight: "70vh",
      overflowY: "auto",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
      }}>
        <div>
          <label style={labelStyle()}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>Brand Name</label>
          <input
            type="text"
            value={form.brandName}
            onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))}
            style={inputStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>Cohort</label>
          <input
            type="text"
            value={form.cohort}
            onChange={(e) => setForm(f => ({ ...f, cohort: e.target.value }))}
            style={inputStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>Pathway</label>
          <input
            type="text"
            value={form.pathway}
            onChange={(e) => setForm(f => ({ ...f, pathway: e.target.value }))}
            style={inputStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>Joined Date</label>
          <input
            type="date"
            value={form.joinedAt}
            onChange={(e) => setForm(f => ({ ...f, joinedAt: e.target.value }))}
            style={inputStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>Email</label>
          <input
            type="email"
            value={form.email || ""}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="player@school.edu"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={{
        borderTop: "1px solid rgba(0,212,255,0.1)",
        paddingTop: "16px",
      }}>
        <h3 style={{
          fontSize: "13px",
          fontWeight: "700",
          color: "#00d4ff",
          textShadow: "0 0 10px rgba(0,212,255,0.3)",
          marginBottom: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}>
          Economy
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}>
          <div>
            <label style={labelStyle()}>XC</label>
            <input
              type="number"
              value={form.xcoin}
              onChange={(e) => setForm(f => ({ ...f, xcoin: parseInt(e.target.value) || 0 }))}
              style={inputStyle()}
            />
          </div>
        </div>
      </div>

      <div style={{
        borderTop: "1px solid rgba(0,212,255,0.1)",
        paddingTop: "16px",
      }}>
        <h3 style={{
          fontSize: "13px",
          fontWeight: "700",
          color: "#00d4ff",
          textShadow: "0 0 10px rgba(0,212,255,0.3)",
          marginBottom: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}>
          Access PIN
        </h3>
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
        }}>
          <div style={{
            flex: 1,
            padding: "10px 14px",
            background: "rgba(6,9,13,0.8)",
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: "8px",
            color: "#00d4ff",
            fontSize: "14px",
            fontWeight: "700",
            fontFamily: "monospace",
            textShadow: "0 0 8px rgba(0,212,255,0.3)",
            letterSpacing: "2px",
          }}>
            {showPin ? form.pin : "••••••"}
          </div>
          <button
            onClick={() => setShowPin(!showPin)}
            style={{
              padding: "8px 14px",
              background: "rgba(0,212,255,0.1)",
              border: "1px solid #00d4ff",
              borderRadius: "6px",
              color: "#00d4ff",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all .15s ease-out",
              textShadow: "0 0 6px rgba(0,212,255,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.15)";
              e.currentTarget.style.textShadow = "0 0 10px rgba(0,212,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.1)";
              e.currentTarget.style.textShadow = "0 0 6px rgba(0,212,255,0.2)";
            }}
          >
            {showPin ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(form.pin ?? "");
              alert("PIN copied!");
            }}
            style={{
              padding: "8px 14px",
              background: "rgba(0,212,255,0.1)",
              border: "1px solid #00d4ff",
              borderRadius: "6px",
              color: "#00d4ff",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all .15s ease-out",
              textShadow: "0 0 6px rgba(0,212,255,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.15)";
              e.currentTarget.style.textShadow = "0 0 10px rgba(0,212,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.1)";
              e.currentTarget.style.textShadow = "0 0 6px rgba(0,212,255,0.2)";
            }}
          >
            Copy
          </button>
          <button
            onClick={() => setForm(f => ({ ...f, pin: generatePin() }))}
            style={{
              padding: "8px 14px",
              background: "rgba(0,212,255,0.1)",
              border: "1px solid #00d4ff",
              borderRadius: "6px",
              color: "#00d4ff",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all .15s ease-out",
              textShadow: "0 0 6px rgba(0,212,255,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.15)";
              e.currentTarget.style.textShadow = "0 0 10px rgba(0,212,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,212,255,0.1)";
              e.currentTarget.style.textShadow = "0 0 6px rgba(0,212,255,0.2)";
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(0,212,255,0.1)", paddingTop: "16px" }}>
        <label style={{ ...labelStyle(), display: "block", marginBottom: "12px" }}>
          Profile Photo
        </label>

        {/* Show cropper when raw image is ready */}
        {cropSrc ? (
          <ImageCropper
            src={cropSrc}
            onApply={(dataUrl) => {
              setForm(f => ({ ...f, image: dataUrl }));
              setCropSrc(null);
            }}
            onCancel={() => setCropSrc(null)}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Current avatar preview */}
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%", flexShrink: 0,
              overflow: "hidden", border: "2px solid rgba(0,212,255,0.3)",
              background: "rgba(0,212,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px", boxShadow: "0 0 12px rgba(0,212,255,0.2)",
            }}>
              {form.image
                ? <img src={form.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "rgba(0,212,255,0.4)" }}>👤</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: "block", width: "100%", color: "rgba(0,212,255,0.6)", fontSize: "12px" }}
              />
              {form.image && (
                <button
                  onClick={() => setForm(f => ({ ...f, image: "" }))}
                  style={{ marginTop: "8px", fontSize: "11px", background: "none", border: "none", color: "rgba(239,68,68,0.6)", cursor: "pointer", textDecoration: "underline" }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        borderTop: "1px solid rgba(0,212,255,0.1)",
        paddingTop: "16px",
      }}>
        <button onClick={onCancel} style={cancelBtn()}>
          Cancel
        </button>
        <button onClick={() => onSave(form)} style={btnStyle()}>
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
function overlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(6,9,13,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1500,
    backdropFilter: "blur(4px)",
  };
}

function modalStyle(): React.CSSProperties {
  return {
    background: "linear-gradient(135deg, #0d1117 0%, #06090d 100%)",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: "12px",
    padding: "28px",
    maxWidth: "600px",
    width: "90%",
    boxShadow: "0 0 50px rgba(0,212,255,0.15), inset 0 0 30px rgba(0,212,255,0.03)",
    position: "relative",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: "12px",
    fontWeight: "700",
    color: "rgba(0,212,255,0.8)",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    textShadow: "0 0 8px rgba(0,212,255,0.2)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(6,9,13,0.8)",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: "8px",
    color: "#00d4ff",
    fontSize: "13px",
    boxShadow: "inset 0 0 10px rgba(0,212,255,0.05)",
    textShadow: "0 0 6px rgba(0,212,255,0.2)",
    transition: "all .2s ease-out",
  };
}

function cancelBtn(): React.CSSProperties {
  return {
    padding: "10px 20px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: "8px",
    color: "rgba(224,232,255,0.7)",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all .15s ease-out",
    textShadow: "0 0 4px rgba(0,212,255,0.1)",
  };
}

function btnStyle(): React.CSSProperties {
  return {
    padding: "10px 20px",
    background: "linear-gradient(135deg, #00d4ff 0%, #00a8cc 100%)",
    border: "none",
    borderRadius: "8px",
    color: "#06090d",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all .2s ease-out",
    boxShadow: "0 0 15px rgba(0,212,255,0.3), 0 4px 15px rgba(0,212,255,0.2)",
    textShadow: "0 0 4px rgba(0,0,0,0.3)",
    letterSpacing: "0.5px",
  };
}
