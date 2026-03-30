"use client";
import { useState, useEffect, useCallback } from "react";

export default function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Detect if running inside an iframe
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  const getFullscreenElement = () =>
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement;

  const updateState = useCallback(() => {
    const fs = !!getFullscreenElement();
    setIsFullscreen(fs);
    if (fs) {
      sessionStorage.setItem("pflx_fullscreen", "1");
    } else {
      sessionStorage.removeItem("pflx_fullscreen");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", updateState);
    document.addEventListener("webkitfullscreenchange", updateState);

    // Auto-re-enter fullscreen if it was active on the previous page
    if (sessionStorage.getItem("pflx_fullscreen") === "1" && !getFullscreenElement()) {
      requestFS().catch(() => {
        const reEnter = () => {
          requestFS().catch(() => {});
          document.removeEventListener("click", reEnter);
        };
        document.addEventListener("click", reEnter, { once: true });
      });
    }

    return () => {
      document.removeEventListener("fullscreenchange", updateState);
      document.removeEventListener("webkitfullscreenchange", updateState);
    };
  }, [updateState]);

  // Cross-browser fullscreen request that works in iframes
  async function requestFS() {
    const el = document.documentElement as any;

    // Try standard API first
    if (el.requestFullscreen) {
      return el.requestFullscreen();
    }
    // WebKit (Safari/iOS)
    if (el.webkitRequestFullscreen) {
      return el.webkitRequestFullscreen();
    }
    // MS Edge/IE
    if (el.msRequestFullscreen) {
      return el.msRequestFullscreen();
    }
    throw new Error("Fullscreen API not available");
  }

  async function exitFS() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if ((document as any).webkitExitFullscreen) return (document as any).webkitExitFullscreen();
    if ((document as any).msExitFullscreen) return (document as any).msExitFullscreen();
  }

  const toggle = async () => {
    if (getFullscreenElement()) {
      exitFS();
      return;
    }

    try {
      await requestFS();
    } catch {
      // Fullscreen failed — likely blocked in an iframe without allowfullscreen
      // Try sending a message to the parent frame to request fullscreen on the iframe
      if (isInIframe) {
        try {
          window.parent.postMessage({ type: "pflx-request-fullscreen" }, "*");
        } catch {}

        // Also try opening in a new tab as ultimate fallback
        // Give postMessage 500ms to work, then open new tab if still not fullscreen
        setTimeout(() => {
          if (!getFullscreenElement()) {
            window.open(window.location.href, "_blank");
          }
        }, 500);
      }
    }
  };

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isFullscreen ? "Exit Fullscreen" : isInIframe ? "Open Fullscreen" : "Toggle Fullscreen"}
      style={{
        position: "fixed",
        bottom: "36px",
        left: "244px",
        zIndex: 100000,
        width: "36px",
        height: "36px",
        borderRadius: "6px",
        background: hovered ? "rgba(0,212,255,0.15)" : "rgba(6,10,18,0.95)",
        border: "1px solid rgba(0,212,255,0.25)",
        color: hovered ? "#fff" : "rgba(0,212,255,0.7)",
        pointerEvents: "auto",
        fontSize: "16px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
        backdropFilter: "blur(8px)",
        padding: 0,
        lineHeight: 1,
      }}
    >
      {isFullscreen ? "⊡" : "⛶"}
    </button>
  );
}
