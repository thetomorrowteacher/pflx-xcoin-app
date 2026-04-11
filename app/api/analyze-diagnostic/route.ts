// ─── Legacy onboarding API ────────────────────────────────────────────────
// The diagnostic analysis now runs inside PFLX Platform (pflx-overlay) as
// part of the official SSO onboarding flow. This endpoint is retained only
// to return a clear 410 Gone so any stale clients see an explicit
// deprecation message instead of a 500.

import { NextResponse } from "next/server";

const GONE_BODY = {
  error: "gone",
  message:
    "The X-Coin diagnostic API has been removed. Onboarding now runs in PFLX Platform (pflx-overlay).",
};

export async function GET() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}
