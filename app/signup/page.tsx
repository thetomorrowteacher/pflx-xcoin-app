"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { mockUsers } from "../lib/data";

type ClaimStep = "email" | "found" | "notfound";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<ClaimStep>("email");
  const [foundId, setFoundId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [btnHover, setBtnHover] = useState(false);

  const foundUser = foundId ? mockUsers.find(u => u.id === foundId) : null;

  const handleLookup = () => {
    setEmailError("");
    if (!email.trim()) { setEmailError("Your email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    const match = mockUsers.find(u => u.email?.toLowerCase() === email.toLowerCase().trim() && u.role === "player");
    if (match) {
      setFoundId(match.id);
      setStep("found");
    } else {
      setStep("notfound");
    }
  };

  const handleClaim = () => {
    if (!foundUser) return;
    const idx = mockUsers.findIndex(u => u.id === foundUser.id);
    if (idx >= 0) mockUsers[idx].claimed = true;
    localStorage.setItem("pflx_user", JSON.stringify(mockUsers[idx]));
    router.push("/player");
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const CYAN = "#00d4ff";
  const CYAN_DIM = "rgba(0,212,255,0.55)";
  const CYAN_GLOW = "rgba(0,212,255,0.15)";

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 16px", borderRadius: "8px", fontSize: "15px",
    background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)",
    color: "#ffffff", outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", letterSpacing: "0.02em", transition: "border-color .2s",
  };
  const inputErr: React.CSSProperties = { ...inputStyle, border: "1px solid rgba(255,80,80,0.6)" };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 700, color: CYAN,
    letterSpacing: "0.12em", marginBottom: "8px", textTransform: "uppercase",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#06090d", padding: "24px",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-150px", right: "-150px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ width: "100%", maxWidth: "400px", position: "relative", zIndex: 1 }}>

        {/* ── Logo & Title ─────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "110px", height: "110px", borderRadius: "50%",
            margin: "0 auto 20px", overflow: "hidden",
            boxShadow: `0 0 40px ${CYAN_GLOW}, 0 0 80px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.6)`,
            border: "2px solid rgba(0,212,255,0.3)",
            background: "rgba(0,212,255,0.05)",
          }}>
            <Image src="/xcoin-logo.png" alt="X-Coin" width={110} height={110} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 900, margin: "0 0 6px", color: "#ffffff", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            X-COIN
          </h1>
          <p style={{ fontSize: "11px", fontWeight: 700, color: CYAN, letterSpacing: "0.18em", margin: "0 0 6px", textTransform: "uppercase" }}>
            EXPERIENCE MANAGEMENT SYSTEM
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.03em" }}>
            {step === "email" && "Enter your email to access your pre-created account"}
            {step === "found" && "Account located — ready to initialize"}
            {step === "notfound" && "No account found for that address"}
          </p>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(8,16,22,0.97)",
          border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "16px", padding: "28px 28px 24px",
          boxShadow: "0 0 40px rgba(0,212,255,0.06), 0 20px 60px rgba(0,0,0,0.6)",
          backdropFilter: "blur(20px)",
        }}>

          {/* ══ EMAIL LOOKUP ════════════════════════════════════════════ */}
          {step === "email" && (
            <>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleLookup()}
                  placeholder="your@email.com"
                  style={emailError ? inputErr : inputStyle}
                  autoFocus
                />
                {emailError
                  ? <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ff6b6b" }}>{emailError}</p>
                  : <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(0,212,255,0.3)", letterSpacing: "0.03em" }}>
                      Enter the email your instructor registered for you
                    </p>
                }
              </div>

              <button
                onClick={handleLookup}
                disabled={!email.trim()}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px", borderRadius: "8px", border: "none",
                  background: email.trim() ? "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)" : "rgba(255,255,255,0.06)",
                  color: email.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                  fontSize: "13px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: email.trim() ? "pointer" : "default", marginBottom: "12px", transition: "all .2s",
                  boxShadow: email.trim() && btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                  transform: email.trim() && btnHover ? "translateY(-1px)" : "none",
                }}>
                Locate Account
              </button>

              <button onClick={() => router.push("/")} style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                background: "transparent", border: "1px solid rgba(0,212,255,0.15)",
                color: CYAN_DIM, fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>
                ← Back to Sign In
              </button>
            </>
          )}

          {/* ══ ACCOUNT FOUND ═══════════════════════════════════════════ */}
          {step === "found" && foundUser && (
            <>
              {/* Success */}
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
                background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "10px", marginBottom: "18px",
              }}>
                <span style={{ fontSize: "18px" }}>✅</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: CYAN, letterSpacing: "0.05em" }}>ACCOUNT LOCATED</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{email}</div>
                </div>
              </div>

              {/* Player card */}
              <div style={{
                background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
                borderRadius: "12px", padding: "18px", marginBottom: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden",
                    background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", fontWeight: 800, color: "#fff", flexShrink: 0,
                    boxShadow: "0 0 16px rgba(0,212,255,0.3)",
                  }}>
                    {foundUser.image
                      ? <img src={foundUser.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : foundUser.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "17px", color: CYAN, letterSpacing: "0.04em" }}>
                      {foundUser.brandName ?? foundUser.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{foundUser.name}</div>
                    <div style={{ fontSize: "11px", color: "rgba(0,212,255,0.4)", marginTop: "2px", letterSpacing: "0.04em" }}>
                      {foundUser.cohort} · {foundUser.pathway}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(0,212,255,0.08)", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.15)" }}>
                    <div style={{ fontWeight: 800, color: CYAN, fontSize: "14px" }}>⚡ {foundUser.xp.toLocaleString()}</div>
                    <div style={{ fontSize: "9px", color: CYAN_DIM, marginTop: "2px", letterSpacing: "0.08em", fontWeight: 700 }}>XP</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(124,58,237,0.08)", borderRadius: "8px", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <div style={{ fontWeight: 800, color: "#a78bfa", fontSize: "14px" }}>🪙 {foundUser.xcoin}</div>
                    <div style={{ fontSize: "9px", color: "rgba(167,139,250,0.6)", marginTop: "2px", letterSpacing: "0.08em", fontWeight: 700 }}>X-COIN</div>
                  </div>
                </div>
              </div>

              {/* PIN notice */}
              <div style={{
                display: "flex", gap: "10px", padding: "12px 14px",
                background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: "10px", marginBottom: "18px",
              }}>
                <span style={{ fontSize: "16px" }}>🔑</span>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, letterSpacing: "0.02em" }}>
                  Your instructor will provide your 4-digit access PIN privately. You'll need it to sign in.
                </div>
              </div>

              <button
                onClick={handleClaim}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)",
                  color: "#fff", fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: "pointer", marginBottom: "12px", transition: "all .2s",
                  boxShadow: btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                  transform: btnHover ? "translateY(-1px)" : "none",
                }}>
                Enter Dashboard →
              </button>

              <button onClick={() => { setStep("email"); setEmail(""); }} style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                background: "transparent", border: "1px solid rgba(0,212,255,0.15)",
                color: CYAN_DIM, fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>
                ← Try Different Email
              </button>
            </>
          )}

          {/* ══ NOT FOUND ════════════════════════════════════════════════ */}
          {step === "notfound" && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px",
                background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)",
                borderRadius: "10px", marginBottom: "18px",
              }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#ff6b6b", letterSpacing: "0.05em" }}>NO ACCOUNT FOUND</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{email}</div>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: "22px", letterSpacing: "0.02em" }}>
                No player profile was found for <span style={{ color: "#ffffff", fontWeight: 600 }}>{email}</span>. Your instructor must create your profile and register your email before you can claim it.
              </p>

              <button
                onClick={() => { setStep("email"); setEmailError(""); }}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%", padding: "14px", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)",
                  color: "#fff", fontSize: "13px", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: "pointer", marginBottom: "12px", transition: "all .2s",
                  boxShadow: btnHover ? "0 0 24px rgba(0,212,255,0.3)" : "none",
                  transform: btnHover ? "translateY(-1px)" : "none",
                }}>
                Try Again
              </button>

              <button onClick={() => router.push("/")} style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                background: "transparent", border: "1px solid rgba(0,212,255,0.15)",
                color: CYAN_DIM, fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>
                ← Back to Sign In
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
