// Diagnostic endpoint: check Supabase connection + data status
// GET /api/diag — returns which collections exist and their sizes

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
      url: url ? "set" : "MISSING",
      key: key ? "set" : "MISSING",
    });
  }

  try {
    const supabase = createClient(url, key);

    // Try to fetch all rows from app_data
    const { data, error } = await supabase
      .from("app_data")
      .select("key, updated_at, data");

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        supabaseUrl: url,
      });
    }

    // Summarize each collection
    const collections: Record<string, { items: number; updatedAt: string | null; sizeKB: number }> = {};
    let totalSizeKB = 0;
    for (const row of (data || [])) {
      const arr = Array.isArray(row.data) ? row.data : [];
      const sizeKB = Math.round(JSON.stringify(row.data).length / 1024);
      totalSizeKB += sizeKB;
      collections[row.key] = {
        items: arr.length,
        updatedAt: row.updated_at,
        sizeKB,
      };
    }

    return NextResponse.json({
      ok: true,
      supabaseUrl: url,
      totalRows: (data || []).length,
      totalSizeKB,
      collections,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || String(err),
      supabaseUrl: url,
    });
  }
}
