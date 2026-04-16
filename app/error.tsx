"use client";

/**
 * App-level error boundary — catches errors in page components
 * (below the root layout).  The root layout + StoreProvider + Ticker
 * continue rendering; only the broken page is replaced by this UI.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      color: "#fff",
      fontFamily: "monospace",
      gap: "14px",
      padding: "32px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: "1.6rem",
        fontWeight: 900,
        letterSpacing: "0.15em",
        color: "#ef4444",
      }}>
        PAGE ERROR
      </div>
      <p style={{
        fontSize: "0.8rem",
        color: "rgba(255,255,255,0.55)",
        maxWidth: "420px",
        lineHeight: 1.5,
      }}>
        {error?.message || "An unexpected error occurred loading this page."}
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
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.6)",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.85rem",
            fontFamily: "monospace",
          }}
        >
          Full Reload
        </button>
      </div>
    </div>
  );
}
