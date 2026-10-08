"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "../lib/data";
import BadgePicker, { PickableBadgeCategory } from "./BadgePicker";

// ═══════════════════════════════════════════════════════════════════
// Quick X-Track — the fast lane of the X-Tracker, inside the player's
// X-Bot (PFLX Coach) panel.
//   · Same record shape, same storage key and same postMessage as
//     /player/submit ("Request a Reward"), so the host sees these in the
//     same Approvals queue and the full X-Tracker page lists them too.
//   · Proof is a link here (files stay on the full page).
//   · useXTrackerSync keeps "My requests" current even while the player is
//     on another X-Coin page (the full page only listens while it is open).
// ═══════════════════════════════════════════════════════════════════

type RewardType = "xc" | "badge";
type BadgeCategory = "primary" | "premium" | "executive" | "signature";

export interface QuickRewardRequest {
  id: string;
  playerId: string;
  brand: string;
  type: RewardType;
  amount?: number;
  badgeCategory?: BadgeCategory;
  badgeName?: string;
  description: string;
  proofLink?: string;
  proofFileName?: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  reviewerNote?: string;
}

// Same key the full X-Tracker page uses.
const REQUESTS_KEY = "pflx_xtracker_requests";
const UPDATED_EVENT = "pflx-xtracker-updated";

const BADGE_CATEGORIES: { id: BadgeCategory; name: string; color: string; icon: string }[] = [
  { id: "primary",   name: "Primary",   color: "#22c55e", icon: "🟢" },
  { id: "premium",   name: "Premium",   color: "#3b82f6", icon: "🔵" },
  { id: "executive", name: "Executive", color: "#a78bfa", icon: "🟣" },
];
// Signature badges are not requestable here; players choose Primary, Premium or Executive from the inventory.

function loadRequests(): QuickRewardRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as QuickRewardRequest[]) : [];
  } catch { return []; }
}
function saveRequests(list: QuickRewardRequest[]) {
  try { localStorage.setItem(REQUESTS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function shortId(prefix: string) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
}
function postToParent(payload: Record<string, unknown>) {
  try {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage(JSON.stringify(payload), "*");
    }
  } catch { /* ignore */ }
}

// Always-mounted listener (call it from the X-Bot, which lives on every player page).
// Merges host approve/deny broadcasts into the stored list, tells open views to
// refresh, and lets the caller say something in chat.
export function useXTrackerSync(playerId: string | undefined, onResolved?: (r: QuickRewardRequest) => void) {
  const cb = useRef(onResolved);
  cb.current = onResolved;
  useEffect(() => {
    if (!playerId) return;
    function onMsg(ev: MessageEvent) {
      let m: { type?: string; request?: QuickRewardRequest } | null = null;
      try { m = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (!m || m.type !== "pflx_reward_request_resolved" || !m.request) return;
      const updated = m.request;
      if (updated.playerId !== playerId) return;
      const all = loadRequests();
      const i = all.findIndex(r => r.id === updated.id);
      const was = i >= 0 ? all[i].status : "";
      if (i >= 0) all[i] = updated; else all.unshift(updated);
      saveRequests(all);
      try { window.dispatchEvent(new Event(UPDATED_EVENT)); } catch { /* ignore */ }
      if (updated.status !== "pending" && was !== updated.status && cb.current) cb.current(updated);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [playerId]);
}

const ACCENT = "#a855f7";
const GOLD = "#f5c842";
const CYAN = "#00d4ff";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: "5px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "10px",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#f0e8ff", fontSize: "12px", outline: "none", fontFamily: "inherit",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: "rgba(245,200,66,0.14)", fg: "#f5c842", label: "PENDING" },
  approved: { bg: "rgba(34,197,94,0.16)",  fg: "#22c55e", label: "APPROVED" },
  denied:   { bg: "rgba(239,68,68,0.16)",  fg: "#ef4444", label: "DENIED" },
};

export default function QuickXTracker({ user, onOpenFull }: { user: User; onOpenFull: () => void }) {
  const [type, setType] = useState<RewardType>("xc");
  const [amount, setAmount] = useState("100");
  const [badgeCat, setBadgeCat] = useState<BadgeCategory>("primary");
  const [badgeName, setBadgeName] = useState("");
  const [description, setDescription] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [requests, setRequests] = useState<QuickRewardRequest[]>([]);

  const refresh = useCallback(() => {
    setRequests(loadRequests().filter(r => r.playerId === user.id));
  }, [user.id]);

  useEffect(() => {
    refresh();
    window.addEventListener(UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(UPDATED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);

  const submit = useCallback(() => {
    if (busy) return;
    setMsg(null);
    if (type === "xc") {
      const n = parseInt(amount, 10);
      if (!Number.isFinite(n) || n <= 0) { setMsg({ kind: "err", text: "Enter a positive XC amount." }); return; }
    }
    if (type === "badge" && !badgeName.trim()) { setMsg({ kind: "err", text: "Choose the badge from the inventory." }); return; }
    if (!description.trim()) { setMsg({ kind: "err", text: "Tell your host what you did." }); return; }
    const link = proofLink.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(link)) { setMsg({ kind: "err", text: "Add a proof link that starts with https:// (Drive, Figma, GitHub…)." }); return; }
    setBusy(true);
    const req: QuickRewardRequest = {
      id: shortId("req"),
      playerId: user.id,
      brand: (user.brandName as string) || (user.name as string) || "Player",
      type,
      amount: type === "xc" ? parseInt(amount, 10) : undefined,
      badgeCategory: type === "badge" ? badgeCat : undefined,
      badgeName: type === "badge" ? (badgeName.trim() || undefined) : undefined,
      description: description.trim(),
      proofLink: link,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    saveRequests([req, ...loadRequests()]);
    refresh();
    // The Console stages this in the host Approvals queue (same message the full X-Tracker sends).
    postToParent({ type: "pflx_reward_request_submitted", request: req, attachmentDataUrl: null });
    setDescription(""); setProofLink(""); setBadgeName("");
    setBusy(false);
    setMsg({ kind: "ok", text: "Sent! Your host will review it — you'll see the result here." });
  }, [busy, type, amount, badgeCat, badgeName, description, proofLink, user, refresh]);

  const toggleBtn = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: "8px 6px", borderRadius: "10px", cursor: "pointer", fontSize: "11px", fontWeight: 800,
    letterSpacing: "0.04em",
    background: active ? `${color}22` : "rgba(255,255,255,0.03)",
    border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
    color: active ? color : "rgba(255,255,255,0.5)",
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "11px", lineHeight: 1.5, color: "rgba(255,255,255,0.6)" }}>
        Did something worth rewarding? Log it here fast — your host approves it and the XC or badge lands on your account.
      </div>

      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={() => setType("xc")} style={toggleBtn(type === "xc", GOLD)}>⚡ XC</button>
        <button onClick={() => setType("badge")} style={toggleBtn(type === "badge", CYAN)}>🏅 BADGE</button>
      </div>

      {type === "xc" ? (
        <div>
          <label style={labelStyle}>XC requested</label>
          <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
            style={{ ...inputStyle, fontFamily: "'Share Tech Mono', monospace", fontSize: "14px", color: GOLD }} />
        </div>
      ) : (
        <>
          <div>
            <label style={labelStyle}>Badge type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              {BADGE_CATEGORIES.map(b => (
                <button key={b.id} onClick={() => { setBadgeCat(b.id); setBadgeName(""); }} style={{
                  padding: "7px 8px", borderRadius: "10px", cursor: "pointer", fontSize: "11px", fontWeight: 800, textAlign: "left",
                  background: badgeCat === b.id ? `${b.color}22` : "rgba(255,255,255,0.03)",
                  border: badgeCat === b.id ? `1px solid ${b.color}` : "1px solid rgba(255,255,255,0.08)",
                  color: badgeCat === b.id ? b.color : "rgba(255,255,255,0.5)",
                }}>{b.icon} {b.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Choose the badge from the inventory</label>
            <BadgePicker
              category={badgeCat as PickableBadgeCategory}
              value={badgeName} onChange={setBadgeName} compact
              accent={(BADGE_CATEGORIES.find(b => b.id === badgeCat) || BADGE_CATEGORIES[0]).color}
            />
            {badgeName && <div style={{ marginTop: "6px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Selected: <b style={{ color: "#fff" }}>{badgeName}</b></div>}
          </div>
        </>
      )}

      <div>
        <label style={labelStyle}>What did you do?</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: "vertical" }} placeholder="Describe the work, project or contribution." />
      </div>
      <div>
        <label style={labelStyle}>Proof link</label>
        <input type="url" value={proofLink} onChange={e => setProofLink(e.target.value)}
          style={inputStyle} placeholder="https://… (Drive, Figma, GitHub…)" />
      </div>

      {msg && (
        <div style={{
          padding: "8px 10px", borderRadius: "10px", fontSize: "11px", lineHeight: 1.5,
          background: msg.kind === "ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${msg.kind === "ok" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: msg.kind === "ok" ? "#86efac" : "#fca5a5",
        }}>{msg.text}</div>
      )}

      <button onClick={submit} disabled={busy} style={{
        padding: "10px", borderRadius: "12px", border: "none", cursor: busy ? "default" : "pointer",
        background: `linear-gradient(135deg, ${ACCENT}, #7c3aed)`, color: "#fff",
        fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em",
      }}>🚀 SEND TO HOST</button>

      <div style={{ marginTop: "4px" }}>
        <div style={{ ...labelStyle, marginBottom: "6px" }}>My recent requests</div>
        {requests.length === 0 ? (
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Nothing yet — your first request shows up here.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {requests.slice(0, 5).map(r => {
              const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
              return (
                <div key={r.id} style={{ padding: "8px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#f0e8ff" }}>
                      {r.type === "xc" ? `⚡ ${r.amount} XC` : `🏅 ${r.badgeName || (r.badgeCategory ? r.badgeCategory[0].toUpperCase() + r.badgeCategory.slice(1) : "Badge")}`}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: "8px", background: st.bg, color: st.fg }}>{st.label}</span>
                  </div>
                  {r.status === "denied" && r.reviewerNote && (
                    <div style={{ fontSize: "10px", color: "#fca5a5", marginTop: "4px" }}>Host note: {r.reviewerNote}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={onOpenFull} style={{
        padding: "9px", borderRadius: "12px", cursor: "pointer", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em",
        background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.3)", color: CYAN,
      }}>OPEN FULL X-TRACKER (file proof · Peer Trade) →</button>
    </div>
  );
}
