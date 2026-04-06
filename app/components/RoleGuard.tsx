"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * RoleGuard — Listens for `pflx_role_changed` postMessage from the PFLX
 * Platform shell (preview.html's pflxSetRole). When the active role flips
 * to "player", the host is redirected out of /admin/* into the matching
 * /player/* route so they see exactly what a player sees. When it flips
 * back to "host", they return to /admin.
 *
 * Also checks initial role on mount (via localStorage bridge + parent
 * identity broadcast) to handle page loads while already in player mode.
 *
 * Belt-and-suspenders: toggles `document.body.dataset.pflxRole` so CSS
 * can hide any lingering admin chrome if a route swap misses a corner.
 */

// Map admin sub-routes → matching player sub-routes (best-effort).
// Anything that doesn't have an explicit match falls back to /player.
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
    // Find longest matching admin prefix
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

export default function RoleGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // ── Initial role check (page load / refresh) ──
    let initialRole: "host" | "player" | null = null;
    try {
      const stored = localStorage.getItem("pflx_active_role");
      if (stored === "host" || stored === "player") initialRole = stored;
    } catch {}

    if (initialRole) {
      document.body.dataset.pflxRole = initialRole;
      const target = mapRoute(pathname || "/admin", initialRole);
      if (target && target !== pathname) {
        router.replace(target);
      }
    } else {
      // Default assumption: if we're on /admin without an explicit role,
      // treat as host. Ask the parent to confirm.
      document.body.dataset.pflxRole = "host";
      if (window.parent !== window) {
        try {
          window.parent.postMessage(
            JSON.stringify({ type: "pflx_role_query" }),
            "*"
          );
        } catch {}
      }
    }

    // ── Live role change listener ──
    function handleMessage(event: MessageEvent) {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg?.type !== "pflx_role_changed") return;
        const role: "host" | "player" = msg.role === "player" ? "player" : "host";

        try { localStorage.setItem("pflx_active_role", role); } catch {}
        document.body.dataset.pflxRole = role;

        const target = mapRoute(pathname || "/admin", role);
        if (target && target !== pathname) {
          router.push(target);
        }
      } catch {
        // ignore non-JSON
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pathname, router]);

  return null;
}
