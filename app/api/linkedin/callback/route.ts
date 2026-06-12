// GET /api/linkedin/callback — LinkedIn redirects here after consent.
// Exchanges code → access token, resolves the member URN via OpenID
// userinfo, stores the encrypted token, bounces back to the wallet.
import { NextRequest, NextResponse } from "next/server";
import { LI_CLIENT_ID, LI_CLIENT_SECRET, baseUrlFromReq, storeToken } from "../lib";

export async function GET(req: NextRequest) {
  const base = baseUrlFromReq(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") || "";
  const err = req.nextUrl.searchParams.get("error");

  const back = (q: string) => NextResponse.redirect(`${base}/player/wallet?linkedin=${q}`);

  if (err || !code) return back("denied");

  let playerId = "";
  try { playerId = JSON.parse(Buffer.from(state, "base64url").toString("utf8")).p || ""; } catch { /* bad state */ }
  if (!playerId) return back("error");

  try {
    // 1. code → access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: LI_CLIENT_ID,
        client_secret: LI_CLIENT_SECRET,
        redirect_uri: `${base}/api/linkedin/callback`,
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) return back("error");

    // 2. who is this member? (OpenID userinfo → sub = member id)
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await meRes.json();
    if (!me.sub) return back("error");

    // 3. persist (encrypted)
    await storeToken(playerId, `urn:li:person:${me.sub}`, tok.access_token, tok.expires_in || 5184000);
    return back("connected");
  } catch {
    return back("error");
  }
}
