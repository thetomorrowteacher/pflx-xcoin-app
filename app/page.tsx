"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { mockUsers, isHostUser } from "./lib/data";
import { saveUsers } from "./lib/store";

type Step = "select" | "pin" | "change-pin" | "claim";

export default function Home() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [pinError, setPinError] = useState("");
  const [btnHover, setBtnHover] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  // Change-PIN state
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changePinError, setChangePinError] = useState("");
  // Claim account state
  const [claimEmail, setClaimEmail] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [tempPin, setTempPin] = useState("");

  // ═══ PFLX SSO AUTO-LOGIN ═══
  // When embedded in the PFLX Platform, URL params bypass the login screen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    const brand = params.get("brand");
    const ssoPin = params.get("pin");
    if (sso === "pflx" && brand) {
      const user = mockUsers.find(
        u => (u.brandName || "").toLowerCase() === brand.toLowerCase()
      );
      if (user) {
        const autoselect = params.get("autoselect") === "true";
        // Validate PIN if provided, otherwise trust SSO
        const correctPin = user.pin ?? (user.role === "admin" ? "0000" : "1234");
        if (!ssoPin || ssoPin === correctPin) {
          // SSO from PFLX Overlay — mark onboarding complete (handled by overlay login)
          // SSO from PFLX Platform — mark onboarding complete (handled by overlay login)
          user.onboardingComplete = true;
          user.pinChanged = true;
          // Sync SSO data (XC, cohort, role) from overlay
          const ssoXC = params.get("xc");
          const ssoCohort = params.get("cohort");
          const ssoRole = params.get("role");
          if (ssoXC) user.xcoin = parseInt(ssoXC) || user.xcoin;
          if (ssoCohort && ssoCohort !== "N/A") user.cohort = ssoCohort;
          localStorage.setItem("pflx_user", JSON.stringify(user));
          localStorage.setItem("pflx_keep_signed_in", "true");
          // Set the active role BEFORE routing so RoleGuard doesn't fight
          const activeRole = isHostUser(user) ? "host" : "player";
          localStorage.setItem("pflx_active_role", activeRole);
          document.body.dataset.pflxRole = activeRole;
          // Temporarily block RoleGuard during SSO routing, then clear so it works on future loads
          localStorage.setItem("pflx_sso_active", "true");
          console.log("[X-Coin] SSO auto-login for:", user.brandName || user.name, "role:", activeRole);
          setRedirecting(true);
          if (isHostUser(user)) {
            router.push("/admin");
          } else {
            router.push("/player");
          }
          // Clear SSO flag after routing settles so RoleGuard can function normally
          setTimeout(() => { try { localStorage.removeItem("pflx_sso_active"); } catch(e) {} }, 3000);
          return;
        }
        // Auto-select mode: pre-select player and show PIN entry only
        if (autoselect) {
          setSelectedId(user.id);
          setStep("pin");
          setSessionChecked(true);
          console.log("[X-Coin] Auto-selected player for PIN entry:", user.brandName || user.name);
          return;
        }
      } else {
        // SSO brand not found — fall through to keep-signed-in check or login
        console.warn("[X-Coin] SSO brand not found:", brand);
      }
    }
    // Also check existing session (keep-signed-in)
    const existing = localStorage.getItem("pflx_user");
    const stay = localStorage.getItem("pflx_keep_signed_in");
    if (existing && stay) {
      let u: any;
      try { u = JSON.parse(existing); } catch(e) { console.warn("[X-Coin] Corrupt pflx_user in localStorage, clearing"); localStorage.removeItem("pflx_user"); localStorage.removeItem("pflx_keep_signed_in"); setSessionChecked(true); return; }
      if (!u || !u.id) { localStorage.removeItem("pflx_user"); localStorage.removeItem("pflx_keep_signed_in"); setSessionChecked(true); return; }
      // Set role before routing to prevent RoleGuard conflict
      const resumeRole = isHostUser(u) ? "host" : "player";
      localStorage.setItem("pflx_active_role", resumeRole);
      // Clear stale SSO flag so RoleGuard works on this session
      try { localStorage.removeItem("pflx_sso_active"); } catch(e) {}
      document.body.dataset.pflxRole = resumeRole;
      setRedirecting(true);
      if (isHostUser(u)) { router.push("/admin"); }
      else { router.push("/player"); }
      return; // Don't show login screen
    }
    // No SSO and no keep-signed-in — safe to show login screen
    setSessionChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ PFLX PLATFORM IFRAME SSO ═══
  // When X-Coin runs inside the Platform iframe, the PflxBridge dispatches a
  // `pflx-identity-changed` event with the active player. We trust the Platform
  // (already authenticated) and skip PIN validation entirely. No local login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return; // standalone — local login flow OK
    function adoptFromPlatform(detailUser?: { brand?: string; brandName?: string; id?: string; role?: string; xc?: number; cohort?: string; image?: string; }) {
      try {
        let u = detailUser as any;
        if (!u) {
          const cached = localStorage.getItem("pflx_user");
          if (cached) u = JSON.parse(cached);
        }
        if (!u) return false;
        const brand = (u.brand || u.brandName || "").toString();
        if (!brand) return false;
        // Find matching mockUser; if not found, synthesize a minimal one so
        // the rest of X-Coin has something to render against.
        let user = mockUsers.find(m => (m.brandName || "").toLowerCase() === brand.toLowerCase());
        if (!user && u.id) user = mockUsers.find(m => m.id === u.id);
        if (!user) {
          // Synthesize and push into mockUsers so downstream pages render
          const synthesized: any = {
            id: u.id || ("platform-" + Date.now()),
            name: u.name || brand,
            brandName: brand,
            role: (u.role && /admin|host|teacher|instructor|master/i.test(String(u.role))) ? "admin" : "player",
            avatar: "",
            digitalBadges: u.digitalBadges || 0,
            xcoin: u.xc || u.xcoin || 0,
            totalXcoin: u.totalXcoin || u.xc || 0,
            level: u.level || 1, rank: 1,
            cohort: u.cohort || "PlayerPool", pathway: "",
            joinedAt: new Date().toISOString(),
            email: u.email || "", image: u.image || "",
            pin: u.pin || "", claimed: true,
            isHost: /admin|host|teacher|instructor|master/i.test(String(u.role || "")),
            studioId: "", badgeCounts: u.badgeCounts || { primary: 0, premium: 0, executive: 0, signature: 0 },
            onboardingComplete: true, pinChanged: true,
          };
          mockUsers.push(synthesized);
          user = synthesized;
        }
        // Mark complete + persist
        (user as any).onboardingComplete = true;
        (user as any).pinChanged = true;
        if (typeof u.xc === "number") (user as any).xcoin = u.xc;
        if (typeof u.totalXcoin === "number") (user as any).totalXcoin = u.totalXcoin;
        if (u.cohort) (user as any).cohort = u.cohort;
        if (u.image) (user as any).image = u.image;
        localStorage.setItem("pflx_user", JSON.stringify(user));
        localStorage.setItem("pflx_keep_signed_in", "true");
        const activeRole = isHostUser(user as any) ? "host" : "player";
        localStorage.setItem("pflx_active_role", activeRole);
        document.body.dataset.pflxRole = activeRole;
        localStorage.setItem("pflx_sso_active", "true");
        console.log("[X-Coin] Platform iframe SSO — adopting", brand, "as", activeRole);
        setRedirecting(true);
        if (isHostUser(user as any)) router.push("/admin"); else router.push("/player");
        setTimeout(() => { try { localStorage.removeItem("pflx_sso_active"); } catch(e) {} }, 3000);
        return true;
      } catch (e) { console.warn("[X-Coin] iframe SSO adopt failed", e); return false; }
    }
    const onIdent = (ev: Event) => { adoptFromPlatform((ev as CustomEvent).detail); };
    window.addEventListener("pflx-identity-changed", onIdent as EventListener);
    // Also try immediately — pflx_user may already be cached from a prior broadcast
    setTimeout(() => { adoptFromPlatform(); }, 100);
    return () => window.removeEventListener("pflx-identity-changed", onIdent as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const players = mockUsers.filter(u => u.role === "player" && !u.isHost);
  const hosts = mockUsers.filter(u => isHostUser(u));
  const selectedUser = mockUsers.find(u => u.id === selectedId) ?? null;

  const handleBrandSelect = (id: string) => {
    setSelectedId(id);
    setStep("pin");
  };

  const handleSignIn = () => {
    if (!selectedUser) return;
    setPinError("");
    const correctPin = selectedUser.pin ?? (selectedUser.role === "admin" ? "0000" : "1234");
    if (pin === correctPin) {
      // If player hasn't changed PIN yet (claimed account), go to change-pin step
      if (selectedUser.role === "player" && !selectedUser.isHost && selectedUser.pinChanged === false) {
        setStep("change-pin");
        return;
      }

      // Onboarding is now owned by PFLX Platform SSO — legacy/local X-Coin sign-ins
      // bypass the old /diagnostic page and auto-mark the flag so downstream routes don't loop.
      const idx = mockUsers.findIndex(u => u.id === selectedUser.id);
      if (idx >= 0 && !mockUsers[idx].onboardingComplete) {
        mockUsers[idx].onboardingComplete = true;
        saveUsers(mockUsers);
      }
      const userToStore = { ...selectedUser, onboardingComplete: true };
      localStorage.setItem("pflx_user", JSON.stringify(userToStore));
      if (keepSignedIn) localStorage.setItem("pflx_keep_signed_in", "true");
      if (isHostUser(selectedUser)) {
        router.push("/admin");
      } else {
        router.push("/player");
      }
    } else {
      setPinError("Incorrect PIN. Contact your instructor.");
      setPin("");
    }
  };

  const handleChangePin = () => {
    setChangePinError("");
    if (newPin.length < 4) { setChangePinError("PIN must be at least 4 digits"); return; }
    if (newPin !== confirmPin) { setChangePinError("PINs do not match"); return; }
    if (!selectedUser) return;

    // Update in mockUsers
    const idx = mockUsers.findIndex(u => u.id === selectedUser.id);
    if (idx >= 0) {
      mockUsers[idx].pin = newPin;
      mockUsers[idx].pinChanged = true;
    }

    // Onboarding is now owned by PFLX Platform SSO — PIN-change flow auto-completes onboarding
    // so legacy accounts don't bounce to a removed /diagnostic route.
    if (idx >= 0 && !mockUsers[idx].onboardingComplete) {
      mockUsers[idx].onboardingComplete = true;
    }
    const updatedUser = { ...selectedUser, pin: newPin, pinChanged: true, onboardingComplete: true };
    localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
    if (keepSignedIn) localStorage.setItem("pflx_keep_signed_in", "true");
    saveUsers(mockUsers);

    router.push("/player");
  };

  const handleClaimAccount = () => {
    setClaimError("");
    if (!claimEmail.trim()) { setClaimError("Email address is required"); return; }
    const match = mockUsers.find(u => u.email?.toLowerCase() === claimEmail.toLowerCase().trim());
    if (!match) {
      setClaimError("No account found with that email. Contact your instructor.");
      return;
    }

    // Generate a temporary 4-digit PIN
    const generated = String(Math.floor(1000 + Math.random() * 9000));
    setTempPin(generated);

    // Update the user's PIN to the temp PIN and mark as not changed
    const idx = mockUsers.findIndex(u => u.id === match.id);
    if (idx >= 0) {
      mockUsers[idx].pin = generated;
      mockUsers[idx].pinChanged = false;
    }
    saveUsers(mockUsers);

    setClaimSuccess(true);
  };

  const goBack = () => {
    setStep("select");
    setPin(""); setPinError(""); setSelectedId(null);
    setNewPin(""); setConfirmPin(""); setChangePinError("");
  };

  const goBackFromClaim = () => {
    setStep("select");
    setClaimEmail(""); setClaimError(""); setClaimSuccess(false); setTempPin("");
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const CYAN = "#00d4ff";
  const CYAN_DIM = "rgba(0,212,255,0.6)";
  const CYAN_GLOW = "rgba(0,212,255,0.15)";
  const BG = "#06090d";
  const CARD_BG = "rgba(8,16,22,0.97)";
  const CARD_BORDER = "rgba(0,212,255,0.18)";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: "8px",
    fontSize: "15px",
    background: "rgba(0,212,255,0.05)",
    border: `1px solid rgba(0,212,255,0.2)`,
    color: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .2s",
    fontFamily: "inherit",
    letterSpacing: "0.02em",
  };
  const inputErr: React.CSSProperties = { ...inputStyle, border: "1px solid rgba(255,80,80,0.6)" };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: CYAN,
    letterSpacing: "0.12em",
    marginBottom: "8px",
    textTransform: "uppercase",
  };

  // Show a minimal loading screen while checking session or redirecting
  // This prevents the login form from flashing before SSO/keep-signed-in redirect
  if (redirecting || !sessionChecked) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        height: "100vh", background: "#06090d", color: "#00d4ff",
        fontFamily: "monospace", fontSize: "0.8rem", gap: "16px",
      }}>
        <div style={{
          fontSize: "1.8rem", fontWeight: 900, letterSpacing: "0.2em",
          background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 20px rgba(0,212,255,0.4))",
        }}>PFLX</div>
        <div style={{ fontSize: "0.6rem", color: "rgba(0,229,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Initializing session...
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PFLX PLATFORM GATE — X-Coin no longer owns login.
  // ═══════════════════════════════════════════════════════════════════
  // The legacy local login UI (brand-select dropdown + PIN entry) below
  // is dead code retained for rollback. Identity now comes exclusively
  // from the PFLX Platform — either via SSO URL params (handled by the
  // first useEffect, which redirects to /player or /admin) or via the
  // postMessage bridge (handled by the second useEffect, same redirect).
  //
  // If neither path resolved by the time we get here, render the gate:
  //   standalone → "Access via PFLX Platform" block screen
  //   iframed    → "Syncing with Platform" splash (waiting for handshake)
  const inIframe = typeof window !== "undefined" && window.parent !== window;
  if (!inIframe) {
    // Standalone visit — block and direct to the Platform.
    return (
      <div style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
        fontFamily: "Orbitron, monospace", color: "#e0e6ff", zIndex: 2147483647,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: 460, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🛰️</div>
          <div style={{ color: "#00f0ff", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>
            Access via PFLX Platform
          </div>
          <div style={{ color: "#8a92b0", fontSize: 13, lineHeight: 1.6, fontFamily: "Rajdhani, sans-serif" }}>
            X-Coin runs inside the PFLX Platform. Your profile, balance, badges, and rank are all managed there.
            Open the Platform and launch this app from inside.
          </div>
          <a href="https://www.prototypeflx.com/" style={{
            marginTop: 8, padding: "12px 28px",
            background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
            color: "#fff", textDecoration: "none", borderRadius: 10,
            fontFamily: "Orbitron, sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: 700,
            boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
          }}>OPEN PFLX PLATFORM →</a>
        </div>
      </div>
    );
  }

  // Iframed but neither URL params nor cached identity worked — wait for
  // the postMessage handshake. PflxBridge will dispatch pflx-identity-changed
  // when the Console pushes identity, and adoptFromPlatform redirects.
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
      fontFamily: "Orbitron, monospace", color: "#e0e6ff", zIndex: 2147483647,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          border: "2px solid rgba(0,240,255,0.18)",
          borderTopColor: "#00f0ff",
          animation: "pflx-xcoin-spin 0.9s linear infinite",
        }} />
        <div style={{ color: "#00f0ff", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>
          Syncing with Platform
        </div>
        <div style={{ color: "#6a7290", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Loading your profile across all apps
        </div>
      </div>
      <style>{`@keyframes pflx-xcoin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Legacy local login JSX fully removed ─────────────────────────────
  // The PFLX Platform is the sole login surface for the entire suite.
  // See git history (pre-commit d3d2b6b) for the brand-select + PIN form.
}
