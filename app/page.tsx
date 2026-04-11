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
          localStorage.setItem("pflx_sso_active", "true");
          // Set the active role BEFORE routing so RoleGuard doesn't fight
          const activeRole = isHostUser(user) ? "host" : "player";
          localStorage.setItem("pflx_active_role", activeRole);
          document.body.dataset.pflxRole = activeRole;
          console.log("[X-Coin] SSO auto-login for:", user.brandName || user.name, "role:", activeRole);
          setRedirecting(true);
          if (isHostUser(user)) {
            router.push("/admin");
          } else {
            router.push("/player");
          }
          return;
        }
        // Auto-select mode: pre-select player and show PIN entry only
        if (autoselect) {
          setSelectedId(user.id);
          setStep("pin");
          console.log("[X-Coin] Auto-selected player for PIN entry:", user.brandName || user.name);
          return;
        }
      }
    }
    // Also check existing session (keep-signed-in)
    const existing = localStorage.getItem("pflx_user");
    const stay = localStorage.getItem("pflx_keep_signed_in");
    if (existing && stay) {
      const u = JSON.parse(existing);
      // Set role before routing to prevent RoleGuard conflict
      const resumeRole = isHostUser(u) ? "host" : "player";
      localStorage.setItem("pflx_active_role", resumeRole);
      document.body.dataset.pflxRole = resumeRole;
      setRedirecting(true);
      if (isHostUser(u)) { router.push("/admin"); }
      else { router.push("/player"); }
    }
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

  // Show a minimal loading screen while SSO redirect is in progress
  // This prevents the login form from flashing before the route change
  if (redirecting) {
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

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: BG,
      padding: "24px",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid lines */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }} />
      {/* Glow blobs */}
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-150px", right: "-150px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ width: "100%", maxWidth: "400px", position: "relative", zIndex: 1 }}>

        {/* ── Logo & Title ─────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "110px", height: "110px", borderRadius: "50%",
            margin: "0 auto 20px",
            overflow: "hidden",
            boxShadow: `0 0 40px ${CYAN_GLOW}, 0 0 80px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.6)`,
            border: `2px solid rgba(0,212,255,0.3)`,
            background: "rgba(0,212,255,0.05)",
          }}>
            <Image src="/xcoin-logo.png" alt="X-Coin" width={110} height={110} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{
            fontSize: "36px", fontWeight: 900, margin: "0 0 6px", color: "#ffffff",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            X-COIN
          </h1>
          <p style={{
            fontSize: "11px", fontWeight: 700, color: CYAN,
            letterSpacing: "0.18em", margin: 0, textTransform: "uppercase",
          }}>
            EXPERIENCE MANAGEMENT SYSTEM
          </p>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "16px",
          padding: "28px 28px 24px",
          boxShadow: `0 0 40px rgba(0,212,255,0.06), 0 20px 60px rgba(0,0,0,0.6)`,
          backdropFilter: "blur(20px)",
        }}>

          {/* ══ STEP 1: BRAND SELECT ══════════════════════════════════ */}
          {step === "select" && (
            <>
              {/* Brand dropdown — primary login */}
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Select Your Brand</label>
                <div style={{ position: "relative" }}>
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleBrandSelect(e.target.value); }}
                    style={{
                      ...inputStyle,
                      appearance: "none", paddingRight: "36px", cursor: "pointer",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <option value="" disabled style={{ background: "#0a1218" }}>Select your brand name&hellip;</option>
                    <optgroup label="── Host ──" style={{ background: "#0a1218", color: CYAN_DIM }}>
                      {hosts.map(h => (
                        <option key={h.id} value={h.id} style={{ background: "#0a1218", color: "#fff" }}>
                          {h.brandName ?? h.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="── Players ──" style={{ background: "#0a1218", color: CYAN_DIM }}>
                      {players.map(p => (
                        <option key={p.id} value={p.id} style={{ background: "#0a1218", color: "#fff" }}>
                          {p.brandName ?? p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: CYAN_DIM, fontSize: "11px" }}>&#x25BE;</span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(0,212,255,0.12)" }} />
                <span style={{ fontSize: "10px", color: "rgba(0,212,255,0.4)", fontWeight: 700, letterSpacing: "0.1em" }}>NEW PLAYER?</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(0,212,255,0.12)" }} />
              </div>

              {/* Claim account */}
              <button
                onClick={() => { setStep("claim"); setClaimEmail(""); setClaimError(""); setClaimSuccess(false); setTempPin(""); }}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: `1px solid rgba(0,212,255,0.2)`,
                  color: CYAN_DIM,
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", transition: "all .2s",
                }}>
                Claim Player Account
              </button>
            </>
          )}

          {/* ══ STEP 2: PIN ═════════════════════════════════════════════ */}
          {step === "pin" && selectedUser && (
            <>
              {/* Player preview — brand name only */}
              <div style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px", marginBottom: "22px",
                background: "rgba(0,212,255,0.05)",
                border: `1px solid rgba(0,212,255,0.15)`,
                borderRadius: "10px",
              }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0,
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 800, color: "#fff",
                  boxShadow: "0 0 12px rgba(0,212,255,0.3)",
                }}>
                  {selectedUser.image
                    ? <img src={selectedUser.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : selectedUser.avatar}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#ffffff", letterSpacing: "0.02em" }}>{selectedUser.brandName ?? selectedUser.name}</div>
                  <div style={{ fontSize: "11px", color: CYAN_DIM, letterSpacing: "0.05em" }}>{isHostUser(selectedUser) ? "System Host" : "Player"}</div>
                </div>
                <button onClick={goBack} style={{ background: "none", border: "none", color: CYAN_DIM, cursor: "pointer", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Change
                </button>
              </div>

              {/* Security PIN */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Security PIN</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setPinError(""); }}
                    onKeyDown={e => e.key === "Enter" && pin.length >= 4 && handleSignIn()}
                    placeholder="&#x2022;&#x2022;&#x2022;&#x2022;"
                    maxLength={6}
                    style={{
                      ...(pinError ? inputErr : inputStyle),
                      letterSpacing: showPin ? "0.2em" : "0.5em",
                      fontSize: "20px",
                      paddingRight: "48px",
                      textAlign: "center",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => setShowPin(s => !s)}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: CYAN_DIM, fontSize: "16px" }}
                  >
                    {showPin ? "\uD83D\uDE48" : "\uD83D\uDC41"}
                  </button>
                </div>
                {pinError && <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ff6b6b", letterSpacing: "0.02em" }}>{pinError}</p>}
              </div>

              {/* Keep signed in + Reset PIN */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>
                  <div
                    onClick={() => setKeepSignedIn(k => !k)}
                    style={{
                      width: "15px", height: "15px", borderRadius: "3px", flexShrink: 0,
                      border: `1.5px solid ${keepSignedIn ? CYAN : "rgba(255,255,255,0.2)"}`,
                      background: keepSignedIn ? "rgba(0,212,255,0.2)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all .15s",
                    }}
                  >
                    {keepSignedIn && <span style={{ color: CYAN, fontSize: "9px", fontWeight: 900 }}>&#x2713;</span>}
                  </div>
                  KEEP ME SIGNED IN
                </label>
                <button
                  onClick={() => alert("Use 'Claim Player Account' on the login screen to reset your PIN.")}
                  style={{ background: "none", border: "none", color: CYAN_DIM, fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Reset PIN
                </button>
              </div>

              {/* Initialize Session */}
              <button
                onClick={handleSignIn}
                disabled={pin.length < 4}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px",
                  borderRadius: "8px", border: "none",
                  background: pin.length >= 4
                    ? "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)"
                    : "rgba(255,255,255,0.06)",
                  color: pin.length >= 4 ? "#ffffff" : "rgba(255,255,255,0.2)",
                  fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: pin.length >= 4 ? "pointer" : "default",
                  transition: "all .2s",
                  boxShadow: pin.length >= 4 && btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                  transform: pin.length >= 4 && btnHover ? "translateY(-1px)" : "none",
                }}>
                Initialize Session
              </button>
            </>
          )}

          {/* ══ STEP 3: CHANGE PIN ══════════════════════════════════════ */}
          {step === "change-pin" && selectedUser && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
                background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.25)",
                borderRadius: "10px", marginBottom: "20px",
              }}>
                <span style={{ fontSize: "18px" }}>&#x1F510;</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#f5c842", letterSpacing: "0.05em" }}>CREATE YOUR PERSONAL PIN</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                    Replace your temporary PIN with one you&apos;ll remember
                  </div>
                </div>
              </div>

              {/* New PIN */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>New PIN (4-6 digits)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={e => { setNewPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setChangePinError(""); }}
                  placeholder="Enter new PIN"
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    letterSpacing: "0.3em",
                    fontSize: "20px",
                    textAlign: "center",
                  }}
                  autoFocus
                />
              </div>

              {/* Confirm PIN */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Confirm PIN</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setChangePinError(""); }}
                  onKeyDown={e => e.key === "Enter" && newPin.length >= 4 && confirmPin.length >= 4 && handleChangePin()}
                  placeholder="Re-enter new PIN"
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    letterSpacing: "0.3em",
                    fontSize: "20px",
                    textAlign: "center",
                  }}
                />
              </div>

              {changePinError && (
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#ff6b6b", textAlign: "center" }}>{changePinError}</p>
              )}

              <button
                onClick={handleChangePin}
                disabled={newPin.length < 4 || confirmPin.length < 4}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px",
                  borderRadius: "8px", border: "none",
                  background: newPin.length >= 4 && confirmPin.length >= 4
                    ? "linear-gradient(135deg, #f5c842 0%, #f97316 100%)"
                    : "rgba(255,255,255,0.06)",
                  color: newPin.length >= 4 && confirmPin.length >= 4 ? "#000" : "rgba(255,255,255,0.2)",
                  fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: newPin.length >= 4 && confirmPin.length >= 4 ? "pointer" : "default",
                  transition: "all .2s",
                  boxShadow: newPin.length >= 4 && confirmPin.length >= 4 && btnHover ? "0 0 24px rgba(245,200,66,0.3)" : "none",
                }}>
                Set My PIN &amp; Continue
              </button>
            </>
          )}

          {/* ══ STEP 4: CLAIM ACCOUNT ═══════════════════════════════════ */}
          {step === "claim" && (
            <>
              {!claimSuccess ? (
                <>
                  {/* Back link */}
                  <button
                    onClick={goBackFromClaim}
                    style={{
                      background: "none", border: "none", color: CYAN_DIM, cursor: "pointer",
                      fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
                      textTransform: "uppercase", marginBottom: "18px", padding: 0,
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    &#x2190; Back to Login
                  </button>

                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
                    background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                    borderRadius: "10px", marginBottom: "20px",
                  }}>
                    <span style={{ fontSize: "18px" }}>&#x1F4E7;</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: CYAN, letterSpacing: "0.05em" }}>CLAIM YOUR ACCOUNT</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                        Enter your email to receive a temporary PIN
                      </div>
                    </div>
                  </div>

                  {/* Email field */}
                  <div style={{ marginBottom: "20px" }}>
                    <label style={labelStyle}>Email Address</label>
                    <input
                      type="email"
                      value={claimEmail}
                      onChange={e => { setClaimEmail(e.target.value); setClaimError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleClaimAccount()}
                      placeholder="Enter your email..."
                      style={claimError ? inputErr : inputStyle}
                      autoFocus
                    />
                    {claimError && (
                      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ff6b6b", letterSpacing: "0.02em" }}>{claimError}</p>
                    )}
                  </div>

                  {/* Claim button */}
                  <button
                    onClick={handleClaimAccount}
                    disabled={!claimEmail.trim()}
                    onMouseEnter={() => setBtnHover(true)}
                    onMouseLeave={() => setBtnHover(false)}
                    style={{
                      width: "100%", padding: "14px",
                      borderRadius: "8px", border: "none",
                      background: claimEmail.trim()
                        ? "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)"
                        : "rgba(255,255,255,0.06)",
                      color: claimEmail.trim() ? "#ffffff" : "rgba(255,255,255,0.2)",
                      fontSize: "13px", fontWeight: 800,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      cursor: claimEmail.trim() ? "pointer" : "default",
                      transition: "all .2s",
                      boxShadow: claimEmail.trim() && btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                      transform: claimEmail.trim() && btnHover ? "translateY(-1px)" : "none",
                    }}>
                    Generate Temporary PIN
                  </button>
                </>
              ) : (
                <>
                  {/* Success — show temp PIN */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px",
                    background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: "10px", marginBottom: "20px",
                  }}>
                    <span style={{ fontSize: "20px" }}>&#x2705;</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#4ade80", letterSpacing: "0.05em" }}>ACCOUNT CLAIMED</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                        Your temporary PIN has been generated
                      </div>
                    </div>
                  </div>

                  {/* Display temp PIN */}
                  <div style={{
                    textAlign: "center", padding: "20px",
                    background: "rgba(0,212,255,0.05)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "12px", marginBottom: "14px",
                  }}>
                    <div style={{ fontSize: "11px", color: CYAN_DIM, letterSpacing: "0.12em", marginBottom: "8px", fontWeight: 700 }}>YOUR TEMPORARY PIN</div>
                    <div style={{ fontSize: "36px", fontWeight: 900, color: "#fff", letterSpacing: "0.3em", fontFamily: "monospace" }}>{tempPin}</div>
                  </div>

                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
                    Write this down. Select your brand name on the login screen and enter this PIN. You&apos;ll be prompted to create a personal PIN.
                  </p>

                  {/* Go to login */}
                  <button
                    onClick={goBackFromClaim}
                    onMouseEnter={() => setBtnHover(true)}
                    onMouseLeave={() => setBtnHover(false)}
                    style={{
                      width: "100%", padding: "14px",
                      borderRadius: "8px", border: "none",
                      background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)",
                      color: "#ffffff",
                      fontSize: "13px", fontWeight: 800,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "all .2s",
                      boxShadow: btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                      transform: btnHover ? "translateY(-1px)" : "none",
                    }}>
                    Go to Login
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: "20px",
          fontSize: "10px", color: "rgba(0,212,255,0.25)",
          letterSpacing: "0.12em", fontFamily: "monospace",
        }}>
          SYSTEM VERSION 1.0.0 // BETA // SECURE CONNECTION
        </p>
      </div>
    </div>
  );
}
