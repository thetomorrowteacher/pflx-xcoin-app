"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * RoleGuard — Listens for `pflx_role_changed` postMessage from the PFLX
 * Platform shell. When the active role flips to "player", the host is
 * redirected out of /admin/* into /player/*. When it flips back to "host",
 * they return to /admin.
 *
 * KEY FIX: This no longer re-runs the full effect on pathname changes,
 * which was causing an infinite redirect loop:
 *   SSO → /admin → RoleGuard reads stale "player" → /player →
 *   parent says "host" → /admin → repeat
 *
 * Now uses a ref for pathname and a cooldown to prevent rapid redirects.
 */

const ADMIN_TO_PLAYER: Record<string, string> = {
  "/admin": "/player",
  "/admin/task-management": "/player/tasks",
  "/admin/tasks": "/player/tasks",
  "/admin/projects": "/player/projects",
  "/admin/jobs": "/player/jobs",
  "/admin/leaderboard": "/player/leaderboard",
  "/admin/marketplace": "/player/marketplace",
  "/admin/wallet": "/player/wallet",
  "/admin/options": "/player/options",
};

const PLAYER_TO_ADMIN: Record<string, string> = {
  "/player": "/admin",
  "/player/tasks": "/admin/task-management",
  "/player/projects": "/admin/projects",
  "/player/jobs": "/admin/jobs",
  "/player/leaderboard": "/admin/leaderboard",
  "/player/marketplace": "/admin/marketplace",
  "/player/wallet": "/admin/wallet",
  "/player/options": "/admin/options",
};

function mapRoute(pathname: string, role: "host" | "player"): string | null {
  if (role === "player") {
    const keys = Object.keys(ADMIN_TO_PLAYER).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (pathname === k || pathname.startsWith(k + "/")) {
        return ADMIN_TO_PLAYER[k];
      }
    }
    return pathname.startsWith("/admin") ? "/player" : null;
  } else {
    const keys = Object.keys(PLAYER_TO_ADMIN).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (pathname === k || pathname.startsWith(k + "/")) {
        return PLAYER_TO_ADMIN[k];
      }
    }
    return pathname.startsWith("/player") ? "/admin" : null;
  }
}

// Minimum ms between consecutive redirects to prevent loops
const REDIRECT_COOLDOWN = 2000;

export default function RoleGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastRedirectTime = useRef(0);
  const hasInitialized = useRef(false);

  // Keep pathname ref in sync without triggering effect re-runs
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    function safeRedirect(target: string) {
      const now = Date.now();
      if (now - lastRedirectTime.current < REDIRECT_COOLDOWN) {
        console.log("[RoleGuard] Redirect throttled — cooldown active");
        return;
      }
      if (target === pathnameRef.current) return;
      lastRedirectTime.current = now;
      console.log("[RoleGuard] Redirecting:", pathnameRef.current, "→", target);
      router.replace(target);
    }

    // ── Initial role check ──
    // Skip initial redirect if SSO is actively logging in (pflx_sso_active flag)
    // The SSO handler in page.tsx already sets the correct role
    const ssoActive = localStorage.getItem("pflx_sso_active");
    let initialRole: "host" | "player" | null = null;
    try {
      const stored = localStorage.getItem("pflx_active_role");
      if (stored === "host" || stored === "player") initialRole = stored;
    } catch {}

    if (initialRole) {
      document.body.dataset.pflxRole = initialRole;
      // Only redirect on initial load if NOT during SSO login
      // During SSO, page.tsx already routes correctly
      if (!ssoActive) {
        const target = mapRoute(pathnameRef.current || "/admin", initialRole);
        if (target && target !== pathnameRef.current) {
          safeRedirect(target);
        }
      }
    } else {
      document.body.dataset.pflxRole = "host";
    }

    // Ask parent for authoritative role
    if (window.parent !== window) {
      try {
        window.parent.postMessage(
          JSON.stringify({ type: "pflx_role_query" }),
          "*"
        );
      } catch {}
    }

    // ── Live role change listener ──
    function handleMessage(event: MessageEvent) {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg?.type !== "pflx_role_changed") return;
        const role: "host" | "player" = msg.role === "player" ? "player" : "host";

        try { localStorage.setItem("pflx_active_role", role); } catch {}
        document.body.dataset.pflxRole = role;

        const target = mapRoute(pathnameRef.current || "/admin", role);
        if (target) {
          safeRedirect(target);
        }
      } catch {
        // ignore non-JSON
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
