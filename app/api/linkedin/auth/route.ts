// GET /api/linkedin/auth?playerId=...  → redirect to LinkedIn consent.
// Scopes: openid profile (identify member) + w_member_social (post).
import { NextRequest, NextResponse } from "next/server";
import { LI_CLIENT_ID, baseUrlFromReq } from "../lib";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  if (!LI_CLIENT_ID) {
    return NextResponse.json(
      { error: "LinkedIn is not configured yet. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel env." },
      { status: 503 }
    );
  }
  if (!playerId) return NextResponse.json({ error: "Missing playerId" }, { status: 400 });

  const base = baseUrlFromReq(req);
  const state = Buffer.from(JSON.stringify({ p: playerId, n: Math.random().toString(36).slice(2) })).toString("base64url");

  const url =
    "https://www.linkedin.com/oauth/v2/authorization" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(LI_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(base + "/api/linkedin/callback")}` +
    `&scope=${encodeURIComponent("openid profile w_member_social")}` +
    `&state=${state}`;

  return NextResponse.redirect(url);
}
