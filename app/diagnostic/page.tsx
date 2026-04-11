"use client";
import { useEffect } from "react";

// ─── Legacy onboarding route ──────────────────────────────────────────────
// The full diagnostic + brand + slogan + studio-placement flow now lives in
// PFLX Platform (pflx-overlay) as the official SSO onboarding. This stub
// exists only to bounce any stale deep-links back to the Platform so
// onboarding runs in one place.
//
// Override the fallback URL by setting NEXT_PUBLIC_PLATFORM_URL in Vercel.

export default function LegacyDiagnosticRedirect() {
  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_PLATFORM_URL || "https://pflx-overlay.vercel.app";
    const search = typeof window !== "undefined" ? window.location.search : "";
    window.location.replace(`${base}/${search}`);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#00d4ff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      Redirecting to PFLX Platform…
    </div>
  );
}
