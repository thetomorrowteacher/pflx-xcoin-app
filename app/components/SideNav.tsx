"use client";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";
import { User, isHostUser, getCurrentRank } from "../lib/data";
import { playNav, playClick, getSoundSettings, saveSoundSettings, SoundSettings, syncAmbient } from "../lib/sounds";
import { applyPlayerImages } from "../lib/playerImages";

// ─── PFLX branding badge (top-right, fixed) ─────────────────────────────────
function PflxBadge() {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div style={{
      position: "fixed", top: "14px", right: "20px",
      zIndex: 9999, pointerEvents: "none",
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      {!imgFailed ? (
        <img
          src="/pflx-logo.png"
          alt="PFLX"
          onError={() => setImgFailed(true)}
          style={{ height: "36px", width: "auto", objectFit: "contain" }}
        />
      ) : (
        <div style={{
          fontSize: "13px", fontWeight: 900, letterSpacing: "0.12em",
          background: "linear-gradient(90deg, #00d4ff, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 8px rgba(0,212,255,0.4))",
        }}>PFLX</div>
      )}
      <span style={{
        fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em",
        color: "#f5c842", background: "rgba(245,200,66,0.12)",
        border: "1px solid rgba(245,200,66,0.3)",
        borderRadius: "4px", padding: "2px 6px",
        textTransform: "uppercase",
      }}>BETA</span>
    </div>
  );
}

interface NavProps {
  user: User;
}

const adminLinks = [
  { href: "/admin", label: "Home", icon: "🏠" },
  { href: "/admin/leaderboard", label: "Master Leaderboard", icon: "🏆" },
  { href: "/admin/players", label: "Player Management", icon: "👥" },
  { href: "/admin/coins", label: "Digital Badge Management", icon: "💎" },
  { href: "/admin/task-management", label: "Task Management", icon: "📋" },
  { href: "/admin/studios", label: "Startup Studios", icon: "🏢" },
  { href: "/admin/modifiers", label: "Game Management", icon: "🎮" },
  { href: "/admin/approvals", label: "Approvals", icon: "🔔" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

const playerLinks = [
  { href: "/player", label: "Home", icon: "🏠" },
  { href: "/player/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/player/submit", label: "X-Tracker", icon: "🚀" },
  { href: "/player/task-management", label: "Task Management", icon: "📋" },
  { href: "/player/pitch", label: "Project Pitch", icon: "💡" },
  { href: "/player/projects", label: "My Projects", icon: "🎬" },
  { href: "/player/marketplace", label: "Marketplace", icon: "🛒" },
  { href: "/player/wallet", label: "Wallet", icon: "🪙" },
  { href: "/player/options", label: "Options", icon: "⚙️" },
];

const CYAN = "#00d4ff";
const CYAN_DIM = "rgba(0,212,255,0.55)";
const CYAN_FAINT = "rgba(0,212,255,0.08)";

export default function SideNav({ user }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isHost = isHostUser(user);
  // Executive Evo Rank players (Chief level 9+, Partner level 10) get access to Approvals
  const rankLevel = getCurrentRank(user.totalXcoin, user).level;
  const isExecutiveRank = rankLevel >= 9;
  const basePlayerLinks = isExecutiveRank
    ? [...playerLinks.slice(0, -1), { href: "/admin/approvals", label: "Approvals", icon: "🔔" }, playerLinks[playerLinks.length - 1]]
    : playerLinks;
  const links = isHost ? adminLinks : basePlayerLinks;
  // Always show the latest uploaded profile image, even if localStorage is stale
  const displayUser = applyPlayerImages([user])[0] ?? user;
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const s = getSoundSettings();
    setSoundOn(s.enabled);
  }, []);

  const toggleSound = () => {
    const s = getSoundSettings();
    const next: SoundSettings = { ...s, enabled: !s.enabled };
    saveSoundSettings(next);
    setSoundOn(next.enabled);
    syncAmbient();
  };

  const handleLogout = () => {
    playClick();
    localStorage.removeItem("pflx_user");
    router.push("/");
  };

  return (
    <>
    <PflxBadge />
    <nav style={{
      width: "230px",
      minWidth: "230px",
      height: "100vh",
      position: "sticky",
      top: 0,
      background: "#06090d",
      borderRight: `1px solid rgba(0,212,255,0.12)`,
      display: "flex",
      flexDirection: "column",
      padding: "0",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      overflowY: "auto",
      overflowX: "hidden",
    }}>

      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "20px 14px" }}>

        {/* ── Logo / Brand Header ──────────────────────────────────── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "20px 10px 18px",
          borderBottom: `1px solid rgba(0,212,255,0.1)`,
          marginBottom: "18px",
        }}>
          <div style={{
            width: "100px", height: "100px", borderRadius: "50%", flexShrink: 0,
            overflow: "hidden",
            border: `2px solid rgba(0,212,255,0.4)`,
            boxShadow: "0 0 28px rgba(0,212,255,0.25), 0 0 60px rgba(0,212,255,0.08)",
            marginBottom: "12px",
          }}>
            <Image src="/xcoin-logo.png" alt="Digital Badge" width={100} height={100} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{
            fontSize: "26px", fontWeight: 900, color: "#ffffff",
            letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1,
            marginBottom: "6px",
          }}>X-COIN</div>
          <div style={{
            fontSize: "7.5px", fontWeight: 700, color: CYAN,
            letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center",
          }}>EXPERIENCE MANAGEMENT SYSTEM</div>
        </div>

        {/* ── User Badge ───────────────────────────────────────────── */}
        <div
          onClick={() => { playClick(); router.push(`/profile/${user.id}`); }}
          title="View your profile"
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: CYAN_FAINT,
            border: `1px solid rgba(0,212,255,0.15)`,
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "20px",
            cursor: "pointer",
            transition: "border-color 0.2s, background 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,212,255,0.4)";
            (e.currentTarget as HTMLDivElement).style.background = "rgba(0,212,255,0.12)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,212,255,0.15)";
            (e.currentTarget as HTMLDivElement).style.background = CYAN_FAINT;
          }}
        >
          <div style={{
            width: "38px", height: "38px",
            borderRadius: displayUser.image ? "50%" : "8px",
            flexShrink: 0, overflow: "hidden",
            background: displayUser.image
              ? "transparent"
              : isHost
                ? "linear-gradient(135deg, #00d4ff, #7c3aed)"
                : "linear-gradient(135deg, #7c3aed, #00d4ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700, color: "white",
            boxShadow: displayUser.image
              ? "0 0 14px rgba(0,212,255,0.4), 0 0 0 2px rgba(0,212,255,0.3)"
              : "0 0 10px rgba(0,212,255,0.25)",
            border: displayUser.image ? "2px solid rgba(0,212,255,0.35)" : "none",
            transition: "all 0.2s ease",
          }}>
            {displayUser.image
              ? <img src={displayUser.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : user.avatar}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <p style={{
              margin: 0, fontSize: "12px", fontWeight: 700, color: "#ffffff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.02em",
            }}>
              {user.brandName || user.name}
            </p>
            <p style={{
              margin: 0, fontSize: "10px", color: CYAN_DIM,
              letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
            }}>
              {isHost ? (user.isHost ? "⚡ Co-Host" : "🛡 Host") : `LV.${user.level}`}
            </p>
          </div>
        </div>

        {/* ── Digital Badges / XC pills (players only) ────────────── */}
        {!isHost && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(0,212,255,0.06)",
              border: `1px solid rgba(0,212,255,0.18)`,
              borderRadius: "8px", padding: "8px 4px",
            }}>
              <span style={{ fontSize: "13px" }}>🏅</span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: CYAN }}>{user.digitalBadges}</span>
              <span style={{ fontSize: "8px", color: CYAN_DIM, letterSpacing: "0.08em", fontWeight: 700 }}>BADGES</span>
            </div>
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(124,58,237,0.08)",
              border: `1px solid rgba(124,58,237,0.2)`,
              borderRadius: "8px", padding: "8px 4px",
            }}>
              <span style={{ fontSize: "13px" }}>⚡</span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#a78bfa" }}>{user.xcoin.toLocaleString()}</span>
              <span style={{ fontSize: "8px", color: "rgba(167,139,250,0.6)", letterSpacing: "0.08em", fontWeight: 700 }}>XC</span>
            </div>
          </div>
        )}

        {/* ── Nav Links ────────────────────────────────────────────── */}
        <div style={{
          fontSize: "9px", fontWeight: 700, color: "rgba(0,212,255,0.3)",
          letterSpacing: "0.14em", textTransform: "uppercase",
          padding: "0 8px", marginBottom: "8px",
        }}>
          {isHost ? "HOST PANEL" : "NAVIGATION"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <button
                key={link.href}
                id={`nav-${link.label.toLowerCase()}`}
                onClick={() => { playNav(); router.push(link.href); }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 12px", borderRadius: "8px", border: "none",
                  background: active ? "rgba(0,212,255,0.1)" : "transparent",
                  borderLeft: active ? `2px solid ${CYAN}` : "2px solid transparent",
                  color: active ? CYAN : "rgba(255,255,255,0.4)",
                  fontSize: "12px", fontWeight: active ? 700 : 500,
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  letterSpacing: active ? "0.03em" : "0.01em",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.04)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)";
                  }
                }}
              >
                <span style={{ fontSize: "14px", width: "18px", textAlign: "center", opacity: active ? 1 : 0.7 }}>{link.icon}</span>
                {link.label}
              </button>
            );
          })}
        </div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div style={{ height: "1px", background: "rgba(0,212,255,0.08)", margin: "10px 0 8px" }} />

        {/* ── Sound Toggle ─────────────────────────────────────────── */}
        <button
          onClick={toggleSound}
          title={soundOn ? "Sound FX On — click to mute" : "Sound FX Off — click to enable"}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 12px", borderRadius: "8px", border: "none",
            background: soundOn ? "rgba(0,212,255,0.06)" : "transparent",
            color: soundOn ? CYAN_DIM : "rgba(255,255,255,0.2)",
            fontSize: "11px", fontWeight: 700,
            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            letterSpacing: "0.08em", textTransform: "uppercase", width: "100%",
          }}
        >
          <span style={{ fontSize: "14px" }}>{soundOn ? "🔊" : "🔇"}</span>
          {soundOn ? "Sound FX On" : "Sound FX Off"}
        </button>

        {/* ── Sign Out ─────────────────────────────────────────────── */}
        <button
          id="logout-btn"
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 12px", borderRadius: "8px", border: "none",
            background: "transparent",
            color: "rgba(0,212,255,0.3)",
            fontSize: "11px", fontWeight: 700,
            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.06)";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,100,100,0.7)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,212,255,0.3)";
          }}
        >
          <span style={{ fontSize: "13px" }}>↩</span>
          Sign Out
        </button>

        {/* ── Version footer ───────────────────────────────────────── */}
        <p style={{
          margin: "10px 0 0", fontSize: "9px",
          color: "rgba(0,212,255,0.18)", letterSpacing: "0.1em",
          fontFamily: "monospace", textAlign: "center",
        }}>
          SYS v1.0.0 // SECURE
        </p>
      </div>
    </nav>
    </>
  );
}
