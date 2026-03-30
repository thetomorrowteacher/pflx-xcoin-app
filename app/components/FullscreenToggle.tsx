"use client";
import { useState, useEffect, useCallback } from "react";

export default function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const updateState = useCallback(() => {
    const fs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
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
    if (
      sessionStorage.getItem("pflx_fullscreen") === "1" &&
      !document.fullscreenElement
    ) {
      document.documentElement.requestFullscreen().catch(() => {
        const reEnter = () => {
          document.documentElement.requestFullscreen().catch(() => {});
        };
        document.addEventListener("click", reEnter, { once: true });
      });
    }

    return () => {
      document.removeEventListener("fullscreenchange", updateState);
      document.removeEventListener("webkitfullscreenchange", updateState);
    };
  }, [updateState]);

  // MUST be synchronous — browsers require fullscreen calls
  // to happen directly inside a user-gesture (click) handler.
  // Using async/await breaks the gesture chain and the call silently fails.
  const toggle = () => {
    const el = document.documentElement as any;
    const doc = document as any;

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => {
          sessionStorage.setItem("pflx_fullscreen", "1");
        }).catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        sessionStorage.setItem("pflx_fullscreen", "1");
      }
    }
  };

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
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
