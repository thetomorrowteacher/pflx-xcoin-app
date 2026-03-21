"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { mockUsers, isHostUser } from "./lib/data";

type Step = "select" | "pin";

export default function Home() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("select");
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [pinError, setPinError] = useState("");
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pflx_remembered_email");
    if (saved) { setEmail(saved); setRememberEmail(true); }
  }, []);

  const players = mockUsers.filter(u => u.role === "player" && !u.isHost);
  const hosts = mockUsers.filter(u => isHostUser(u));
  const selectedUser = mockUsers.find(u => u.id === selectedId) ?? null;

  const handleEmailSubmit = () => {
    setEmailError("");
    if (!email.trim()) { setEmailError("Email address is required"); return; }
    const match = mockUsers.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
    if (match) {
      setSelectedId(match.id);
      if (rememberEmail) localStorage.setItem("pflx_remembered_email", email.trim());
      else localStorage.removeItem("pflx_remembered_email");
      setStep("pin");
    } else {
      setEmailError("No account found. Contact your instructor.");
    }
  };

  const handleBrandSelect = (id: string) => {
    setSelectedId(id);
    const user = mockUsers.find(u => u.id === id);
    if (user?.email) setEmail(user.email);
    setStep("pin");
  };

  const handleSignIn = () => {
    if (!selectedUser) return;
    setPinError("");
    const correctPin = selectedUser.pin ?? (selectedUser.role === "admin" ? "0000" : "1234");
    if (pin === correctPin) {
      if (rememberEmail && selectedUser.email) localStorage.setItem("pflx_remembered_email", selectedUser.email);
      localStorage.setItem("pflx_user", JSON.stringify(selectedUser));
      if (keepSignedIn) localStorage.setItem("pflx_keep_signed_in", "true");
      if (isHostUser(selectedUser)) {
        router.push("/admin");
      } else if (!selectedUser.diagnosticComplete) {
        router.push("/diagnostic");
      } else {
        router.push("/player");
      }
    } else {
      setPinError("Incorrect PIN. Contact your instructor.");
      setPin("");
    }
  };

  const goBack = () => { setStep("select"); setPin(""); setPinError(""); setSelectedId(null); };

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

  const dividerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "12px", margin: "18px 0",
  };

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

          {/* ══ STEP 1 ══════════════════════════════════════════════════ */}
          {step === "select" && (
            <>
              {/* Email field */}
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="your@email.com"
                  style={emailError ? inputErr : inputStyle}
                  autoFocus
                />
                {emailError && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ff6b6b", letterSpacing: "0.02em" }}>{emailError}</p>
                )}
              </div>

              {/* Remember email */}
              <label style={{
                display: "flex", alignItems: "center", gap: "10px",
                cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.03em", marginBottom: "20px",
              }}>
                <div
                  onClick={() => setRememberEmail(r => !r)}
                  style={{
                    width: "16px", height: "16px", borderRadius: "3px", flexShrink: 0,
                    border: `1.5px solid ${rememberEmail ? CYAN : "rgba(255,255,255,0.2)"}`,
                    background: rememberEmail ? "rgba(0,212,255,0.2)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >
                  {rememberEmail && <span style={{ color: CYAN, fontSize: "10px", fontWeight: 900 }}>✓</span>}
                </div>
                REMEMBER EMAIL ON THIS DEVICE
              </label>

              {/* Initialize Session button */}
              <button
                onClick={handleEmailSubmit}
                disabled={!email.trim()}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px",
                  borderRadius: "8px", border: "none",
                  background: email.trim()
                    ? `linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)`
                    : "rgba(255,255,255,0.06)",
                  color: email.trim() ? "#ffffff" : "rgba(255,255,255,0.2)",
                  fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: email.trim() ? "pointer" : "default",
                  marginBottom: "20px",
                  transition: "all .2s",
                  boxShadow: email.trim() && btnHover ? `0 0 24px rgba(0,212,255,0.3)` : "none",
                  transform: email.trim() && btnHover ? "translateY(-1px)" : "none",
                }}>
                Initialize Session
              </button>

              {/* Divider */}
              <div style={dividerStyle}>
                <div style={{ flex: 1, height: "1px", background: "rgba(0,212,255,0.12)" }} />
                <span style={{ fontSize: "10px", color: "rgba(0,212,255,0.4)", fontWeight: 700, letterSpacing: "0.1em" }}>OR SELECT BRAND</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(0,212,255,0.12)" }} />
              </div>

              {/* Brand dropdown */}
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <label style={labelStyle}>Brand Name</label>
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
                    <option value="" disabled style={{ background: "#0a1218" }}>Select your brand name…</option>
                    <optgroup label="── Host ──" style={{ background: "#0a1218", color: CYAN_DIM }}>
                      {hosts.map(h => (
                        <option key={h.id} value={h.id} style={{ background: "#0a1218", color: "#fff" }}>
                          🛡 {h.brandName ?? h.name}{h.isHost ? " (Co-Host)" : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="── Players ──" style={{ background: "#0a1218", color: CYAN_DIM }}>
                      {players.map(p => (
                        <option key={p.id} value={p.id} style={{ background: "#0a1218", color: "#fff" }}>
                          {p.brandName ?? p.name} — {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: CYAN_DIM, fontSize: "11px" }}>▾</span>
                </div>
              </div>

              {/* Claim account */}
              <button
                onClick={() => router.push("/signup")}
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
              {/* Player preview */}
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
                  <div style={{ fontSize: "11px", color: CYAN_DIM, letterSpacing: "0.05em" }}>{selectedUser.email ?? selectedUser.cohort}</div>
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
                    onChange={e => { setPin(e.target.value.slice(0, 4)); setPinError(""); }}
                    onKeyDown={e => e.key === "Enter" && pin.length === 4 && handleSignIn()}
                    placeholder="••••"
                    maxLength={4}
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
                    {showPin ? "🙈" : "👁"}
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
                    {keepSignedIn && <span style={{ color: CYAN, fontSize: "9px", fontWeight: 900 }}>✓</span>}
                  </div>
                  KEEP ME SIGNED IN
                </label>
                <button
                  onClick={() => alert("Contact your instructor to reset your PIN.")}
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
                  background: pin.length === 4
                    ? "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)"
                    : "rgba(255,255,255,0.06)",
                  color: pin.length === 4 ? "#ffffff" : "rgba(255,255,255,0.2)",
                  fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: pin.length === 4 ? "pointer" : "default",
                  marginBottom: "12px",
                  transition: "all .2s",
                  boxShadow: pin.length === 4 && btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                  transform: pin.length === 4 && btnHover ? "translateY(-1px)" : "none",
                }}>
                Initialize Session
              </button>

              <button
                onClick={() => router.push("/signup")}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: `1px solid rgba(0,212,255,0.15)`,
                  color: "rgba(0,212,255,0.45)",
                  fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer",
                }}>
                Claim Player Account
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: "20px",
          fontSize: "10px", color: "rgba(0,212,255,0.25)",
          letterSpacing: "0.12em", fontFamily: "monospace",
        }}>
          SYSTEM VERSION 1.0.0 // SECURE CONNECTION
        </p>
      </div>
    </div>
  );
}
