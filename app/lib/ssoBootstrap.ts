// ═══════════════════════════════════════════════════════════════════════════
// PFLX SSO Bootstrap
// ─────────────────────────────────────────────────────────────────────────
// When X-Coin is deep-linked from the PFLX Platform (e.g. Mission Control
// iframing /admin/task-management?sso=pflx&brand=...), this helper
// populates localStorage.pflx_user BEFORE the page's own auth gate runs —
// so the page can render in place instead of bouncing to `/` and losing
// the intended route.
//
// Mirrors the SSO handling in app/page.tsx (Home), but usable from any
// page's useEffect.
// ═══════════════════════════════════════════════════════════════════════════

import { User, mockUsers, isHostUser } from "./data";

/**
 * If the current URL has `?sso=pflx&brand=...` and localStorage does not
 * already hold a matching pflx_user, look up the user in mockUsers and
 * hydrate localStorage (pflx_user, pflx_keep_signed_in, pflx_sso_active,
 * pflx_active_role). Returns the resolved User or null.
 *
 * Safe to call in any client-side useEffect. No-op during SSR.
 */
export function bootstrapPflxSSOFromURL(): User | null {
  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") !== "pflx") return null;

    const brand = params.get("brand");
    if (!brand) return null;

    // If we already have a pflx_user matching this brand, don't clobber it
    const existing = localStorage.getItem("pflx_user");
    if (existing) {
      try {
        const u = JSON.parse(existing) as User;
        if ((u.brandName || "").toLowerCase() === brand.toLowerCase()) {
          return u;
        }
      } catch {
        // fall through — re-bootstrap
      }
    }

    const user = mockUsers.find(
      (u) => (u.brandName || "").toLowerCase() === brand.toLowerCase()
    );
    if (!user) return null;

    // Mark onboarding complete (PFLX Platform owns first-run flow now)
    user.onboardingComplete = true;
    user.pinChanged = true;

    // Sync optional SSO fields from the URL
    const ssoXC = params.get("xc");
    const ssoCohort = params.get("cohort");
    if (ssoXC) user.xcoin = parseInt(ssoXC) || user.xcoin;
    if (ssoCohort && ssoCohort !== "N/A") user.cohort = ssoCohort;

    const activeRole = isHostUser(user) ? "host" : "player";
    localStorage.setItem("pflx_user", JSON.stringify(user));
    localStorage.setItem("pflx_keep_signed_in", "true");
    localStorage.setItem("pflx_sso_active", "true");
    localStorage.setItem("pflx_active_role", activeRole);
    if (typeof document !== "undefined") {
      document.body.dataset.pflxRole = activeRole;
    }

    // eslint-disable-next-line no-console
    console.log(
      "[X-Coin SSO] Bootstrapped from URL — brand:",
      user.brandName || user.name,
      "role:",
      activeRole
    );
    return user;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[X-Coin SSO] bootstrap failed:", err);
    return null;
  }
}
