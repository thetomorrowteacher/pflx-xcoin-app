"use client";
import { useState, useEffect, useCallback } from "react";

export default function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const updateState = useCallback(() => {
    const fs = !!document.fullscreenElement;
    setIsFullscreen(fs);
    if (fs) {
      sessionStorage.setItem("pflx_fullscreen", "1");
    } else {
      sessionStorage.removeItem("pflx_fullscreen");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", updateState);

    // Auto-re-enter fullscreen if it was active on the previous page
    if (sessionStorage.getItem("pflx_fullscreen") === "1" && !document.fullscreenElement) {
      // Need a user gesture — try immediately (works on SPA navigations)
      document.documentElement.requestFullscreen().catch(() => {
        // If that fails, wait for first click
        const reEnter = () => {
          document.documentElement.requestFullscreen().catch(() => {});
          document.removeEventListener("click", reEnter);
        };
        document.addEventListener("click", reEnter, { once: true });
      });
    }

    return () => document.removeEventListener("fullscreenchange", updateState);
  }, [updateState]);

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
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
