"use client";
import { useMemo, useState } from "react";
import { COIN_CATEGORIES } from "../lib/data";

// Inventory picker for X-Tracker badge requests.
// Shows the live Digital Badge catalog (the same list the host manages in
// Digital Badge Management) for ONE of Primary / Premium / Executive.
// Signature badges are never requestable, and retired (legacy) badges are hidden.

export type PickableBadgeCategory = "primary" | "premium" | "executive";

export interface InventoryBadge { name: string; image?: string; xc: number; }

export function inventoryFor(category: PickableBadgeCategory): InventoryBadge[] {
  const out: InventoryBadge[] = [];
  try {
    COIN_CATEGORIES.forEach(cat => {
      if (!String(cat.name || "").toLowerCase().startsWith(category)) return;
      (cat.coins || []).forEach(c => {
        if (c && c.name && !c.legacy) out.push({ name: c.name, image: c.image, xc: c.xc || 0 });
      });
    });
  } catch { /* ignore */ }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export default function BadgePicker({
  category, value, onChange, accent, compact,
}: {
  category: PickableBadgeCategory;
  value: string;
  onChange: (name: string) => void;
  accent: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const items = useMemo(() => inventoryFor(category), [category]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter(b => b.name.toLowerCase().includes(t)) : items;
  }, [items, q]);
  const tile = compact ? 64 : 84;

  return (
    <div>
      <input
        type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search the badge inventory…"
        style={{
          width: "100%", boxSizing: "border-box", padding: compact ? "7px 10px" : "9px 12px", borderRadius: "10px", marginBottom: "8px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0e8ff",
          fontSize: compact ? "11px" : "12px", outline: "none",
        }}
      />
      {items.length === 0 ? (
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", padding: "8px 2px" }}>No badges in this category yet.</div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))`, gap: "8px",
          maxHeight: compact ? "190px" : "260px", overflowY: "auto", padding: "2px",
        }}>
          {shown.map(b => {
            const on = value === b.name;
            return (
              <button
                key={b.name} type="button" onClick={() => onChange(on ? "" : b.name)} title={b.name}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 4px", borderRadius: "10px", cursor: "pointer",
                  background: on ? `${accent}26` : "rgba(255,255,255,0.03)",
                  border: on ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: on ? `0 0 12px ${accent}66` : "none",
                }}
              >
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image} alt="" style={{ width: compact ? 38 : 50, height: compact ? 38 : 50, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: compact ? 38 : 50, height: compact ? 38 : 50, borderRadius: "10px", background: `${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🏅</div>
                )}
                <span style={{ fontSize: compact ? "9px" : "10px", lineHeight: 1.15, color: on ? "#fff" : "rgba(255,255,255,0.7)", textAlign: "center", fontWeight: 700 }}>{b.name}</span>
              </button>
            );
          })}
          {shown.length === 0 && <div style={{ gridColumn: "1/-1", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>No badge matches “{q}”.</div>}
        </div>
      )}
    </div>
  );
}
