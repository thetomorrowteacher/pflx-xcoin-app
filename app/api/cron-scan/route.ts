import { NextResponse } from "next/server";

// Vercel Cron Job — triggers the scan-comms endpoint every 4 hours
export async function GET(req: Request) {
  // Verify this is a legit cron call (Vercel sets this header)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Call the scan-comms endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://pflx-xcoin-app.vercel.app";

    const res = await fetch(`${baseUrl}/api/scan-comms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "both" }),
    });

    const result = await res.json();
    console.log("[cron-scan] Completed:", result.message);

    return NextResponse.json({
      success: true,
      message: result.message,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron-scan] Error:", err);
    return NextResponse.json({ success: false, error: "Cron scan failed" }, { status: 500 });
  }
}
