"use client";

/**
 * Global error boundary — catches errors in the root layout itself
 * (including StoreProvider, Ticker, etc.).
 * Must render its own <html> and <body> since the root layout may have failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "monospace",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: "2rem",
          fontWeight: 900,
          letterSpacing: "0.2em",
          background: "linear-gradient(90deg, #ef4444, #f59e0b)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          PFLX
        </div>
        <h2 style={{ fontSize: "1.1rem", color: "#ef4444", margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{
          fontSize: "0.8rem",
          color: "rgba(255,255,255,0.5)",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}>
          {error?.message || "An unexpected error occurred."}
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(0,212,255,0.4)",
              background: "rgba(0,212,255,0.1)",
              color: "#00d4ff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "monospace",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              try { localStorage.removeItem("pflx_user"); localStorage.removeItem("pflx_keep_signed_in"); } catch(e) {}
              window.location.href = "/";
            }}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "monospace",
            }}
          >
            Clear Session & Reload
          </button>
        </div>
        {error?.digest && (
          <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", marginTop: "16px" }}>
            Error ID: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
