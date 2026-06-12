// POST /api/linkedin/post — share an achievement to the connected
// member's own LinkedIn feed (UGC Posts API, w_member_social scope).
// Body: { playerId, text, url? }
// GET  /api/linkedin/post?playerId=... — connection status check.
import { NextRequest, NextResponse } from "next/server";
import { getStoredToken, LI_CLIENT_ID } from "../lib";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  if (!playerId) return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  if (!LI_CLIENT_ID) return NextResponse.json({ configured: false, connected: false });
  const tok = await getStoredToken(playerId);
  return NextResponse.json({ configured: true, connected: !!tok });
}

export async function POST(req: NextRequest) {
  const { playerId, text, url } = await req.json();
  if (!playerId || !text) {
    return NextResponse.json({ error: "Missing playerId or text" }, { status: 400 });
  }
  const tok = await getStoredToken(playerId);
  if (!tok) {
    return NextResponse.json(
      { error: "LinkedIn not connected (or token expired). Reconnect via /api/linkedin/auth." },
      { status: 401 }
    );
  }

  const body = {
    author: tok.memberUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: String(text).slice(0, 2900) },
        shareMediaCategory: url ? "ARTICLE" : "NONE",
        ...(url ? { media: [{ status: "READY", originalUrl: url }] } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (res.ok || res.status === 201) {
      const id = res.headers.get("x-restli-id") || "";
      return NextResponse.json({ ok: true, postId: id });
    }
    const detail = await res.text();
    return NextResponse.json({ error: `LinkedIn rejected the post (${res.status})`, detail: detail.slice(0, 400) }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "LinkedIn request failed" }, { status: 502 });
  }
}
