"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User } from "../../lib/data";

// ═══════════════════════════════════════════════════════════════════
// X-Tracker — rebuilt for v2
//   This is NOT the task-submission flow (that's in Mission Control).
//   X-Tracker is two things:
//     1. Request a Reward    — player asks the host for XC or a badge
//                               with a description + proof link/upload.
//                               Host approves in MC → bus fires award.
//     2. Peer Trade          — player-to-player barter. Offer XC and/or
//                               a service, request XC and/or a service
//                               in return. Other player accepts/declines.
//
//   Requests + trades persist in localStorage and are posted to the
//   PFLX Platform parent so the Console can stage them for host review
//   (Approvals queue) or notify the trade recipient.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────────
type RewardType = "xc" | "badge";
type BadgeCategory = "primary" | "premium" | "executive" | "signature";

interface RewardRequest {
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

interface TradeOffer {
  id: string;
  fromPlayerId: string;
  fromBrand: string;
  toPlayerId: string;
  toBrand: string;
  offerXc: number;
  offerService: string;
  requestXc: number;
  requestService: string;
  notes: string;
  // Trade lifecycle:
  //   pending          — sender proposed, awaiting recipient
  //   accepted         — recipient accepted, awaiting host approval
  //   declined         — recipient declined
  //   cancelled        — sender cancelled before recipient acted
  //   host_approved    — host signed off, XC moved via bus, trade settled
  //   host_denied      — host rejected the accepted trade
  //   completed        — synonym of host_approved (rendered the same)
  status: "pending" | "accepted" | "declined" | "cancelled" | "host_approved" | "host_denied" | "completed";
  createdAt: string;
  actedAt?: string;
  hostNote?: string;
}

interface RosterPlayer {
  id: string;
  brand?: string;
  brandName?: string;
  name?: string;
  role?: string;
}

const REQUESTS_KEY = "pflx_xtracker_requests";
const TRADES_KEY = "pflx_xtracker_trades";

const BADGE_CATEGORIES: { id: BadgeCategory; name: string; color: string; icon: string }[] = [
  { id: "primary",   name: "Primary (Behavior)",        color: "#22c55e", icon: "🟢" },
  { id: "premium",   name: "Premium (Achievement)",     color: "#3b82f6", icon: "🔵" },
  { id: "executive", name: "Executive (Jobs)",          color: "#a78bfa", icon: "🟣" },
  { id: "signature", name: "Signature (Skill Mastery)", color: "#f5c842", icon: "🟡" },
];

// ─── Helpers ───────────────────────────────────────────────────────
function loadRequests(): RewardRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    return raw ? (JSON.parse(raw) as RewardRequest[]) : [];
  } catch { return []; }
}
function saveRequests(list: RewardRequest[]) {
  try { localStorage.setItem(REQUESTS_KEY, JSON.stringify(list)); } catch {}
}
function loadTrades(): TradeOffer[] {
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    return raw ? (JSON.parse(raw) as TradeOffer[]) : [];
  } catch { return []; }
}
function saveTrades(list: TradeOffer[]) {
  try { localStorage.setItem(TRADES_KEY, JSON.stringify(list)); } catch {}
}
function shortId(prefix: string) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
}

// Post a message to the Platform parent — the Console picks these up via
// its message router, stages the request, and (for reward requests) shows
// it in the MC Approvals queue. For trades, the Console notifies the
// other player via the bus.
function postToParent(payload: Record<string, unknown>) {
  try {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage(JSON.stringify(payload), "*");
    }
  } catch {}
}

// ─── Page ──────────────────────────────────────────────────────────
export default function XTrackerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"request" | "trade">("request");

  // ── Auth gate ──────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("pflx_user");
    if (!raw) { router.push("/"); return; }
    try {
      const u = JSON.parse(raw) as User;
      const role = localStorage.getItem("pflx_active_role");
      if (u.role !== "player" && role !== "player") { router.push("/admin"); return; }
      setUser(u);
    } catch { router.push("/"); }
  }, [router]);

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto", paddingBottom: "60px" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>🚀 X-TRACKER</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
            [ REQUEST REWARDS · TRADE WITH PEERS ]
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { id: "request" as const, label: "REQUEST REWARD", icon: "🎯" },
            { id: "trade" as const,   label: "PEER TRADE",     icon: "🤝" },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 22px", background: "none",
                border: "none", borderBottom: tab === t.id ? "2px solid #00d4ff" : "2px solid transparent",
                color: tab === t.id ? "#00d4ff" : "rgba(255,255,255,0.4)",
                fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.1em", cursor: "pointer", marginBottom: "-1px",
              }}
            >{t.icon} {t.label}</button>
          ))}
        </div>

        {tab === "request" ? <RequestRewardTab user={user} /> : <PeerTradeTab user={user} />}
      </main>
    </div>
  );
}

// ─── Tab 1 — Request a Reward ──────────────────────────────────────
function RequestRewardTab({ user }: { user: User }) {
  const [type, setType] = useState<RewardType>("xc");
  const [amount, setAmount] = useState<string>("100");
  const [badgeCat, setBadgeCat] = useState<BadgeCategory>("primary");
  const [badgeName, setBadgeName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [proofLink, setProofLink] = useState<string>("");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [proofData, setProofData] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [requests, setRequests] = useState<RewardRequest[]>([]);

  useEffect(() => { setRequests(loadRequests().filter(r => r.playerId === user.id)); }, [user.id]);

  // Listen for host approve/deny broadcasts from the Console parent.
  // When the host clicks Approve or Deny in their Approvals card, the
  // Console posts pflx_reward_request_resolved with the updated record;
  // we merge it into local state so the 'My recent requests' list
  // flips from PENDING → APPROVED/DENIED in real time.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      let m: { type?: string; request?: RewardRequest } | null = null;
      try { m = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (!m || m.type !== "pflx_reward_request_resolved" || !m.request) return;
      const updated = m.request;
      const all = loadRequests();
      const i = all.findIndex(r => r.id === updated.id);
      if (i >= 0) all[i] = updated;
      else all.unshift(updated);
      saveRequests(all);
      setRequests(all.filter(r => r.playerId === user.id));
      if (updated.status === "approved") {
        setMsg({ kind: "success", text: "✓ Host approved your request — rewards are on your account." });
      } else if (updated.status === "denied") {
        setMsg({ kind: "error", text: "Host denied this request" + (updated.reviewerNote ? ": " + updated.reviewerNote : ".") });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [user.id]);

  const onFile = useCallback((f: File | null) => {
    if (!f) { setProofFileName(""); setProofData(""); return; }
    if (f.size > 2 * 1024 * 1024) {
      setMsg({ kind: "error", text: "File too large. Pick something under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setProofFileName(f.name);
      setProofData(String(e.target?.result || ""));
    };
    reader.readAsDataURL(f);
  }, []);

  const submit = useCallback(() => {
    setMsg(null);
    if (!description.trim()) { setMsg({ kind: "error", text: "A description is required." }); return; }
    if (type === "xc") {
      const n = parseInt(amount, 10);
      if (!Number.isFinite(n) || n <= 0) { setMsg({ kind: "error", text: "Enter a positive XC amount." }); return; }
    }
    if (!proofLink.trim() && !proofFileName) {
      setMsg({ kind: "error", text: "Add a link or upload a file as proof." });
      return;
    }
    setSubmitting(true);
    const req: RewardRequest = {
      id: shortId("req"),
      playerId: user.id,
      brand: (user.brandName as string) || (user.name as string) || "Player",
      type,
      amount: type === "xc" ? parseInt(amount, 10) : undefined,
      badgeCategory: type === "badge" ? badgeCat : undefined,
      badgeName: type === "badge" ? (badgeName.trim() || undefined) : undefined,
      description: description.trim(),
      proofLink: proofLink.trim() || undefined,
      proofFileName: proofFileName || undefined,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    const next = [req, ...loadRequests()];
    saveRequests(next);
    setRequests(next.filter(r => r.playerId === user.id));
    // Notify the Console — its message router stages this in the MC Approvals queue.
    postToParent({
      type: "pflx_reward_request_submitted",
      request: req,
      // attachment is split out so the Console can choose whether to persist
      // the data URL or just keep the file name as a reference.
      attachmentDataUrl: proofData || null,
    });
    // Reset form
    setDescription("");
    setProofLink("");
    setProofFileName("");
    setProofData("");
    setSubmitting(false);
    setMsg({ kind: "success", text: "Request sent to your host for review. You'll see the result on your Home dashboard." });
  }, [user, type, amount, badgeCat, badgeName, description, proofLink, proofFileName, proofData]);

  return (
    <div>
      {/* Form card */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Submit a reward request</div>

        {/* Type toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {(["xc", "badge"] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
              background: type === t ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.02)",
              border: type === t ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.06)",
              color: type === t ? "#00d4ff" : "rgba(255,255,255,0.5)",
              fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em",
            }}>{t === "xc" ? "⚡ X-COIN" : "🏅 DIGITAL BADGE"}</button>
          ))}
        </div>

        {/* XC amount or Badge picker */}
        {type === "xc" ? (
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Amount Requested</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", color: "#f5c842" }}
              placeholder="100" />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Badge Category</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
                {BADGE_CATEGORIES.map(b => (
                  <button key={b.id} onClick={() => setBadgeCat(b.id)} style={{
                    padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                    background: badgeCat === b.id ? `${b.color}22` : "rgba(255,255,255,0.02)",
                    border: badgeCat === b.id ? `1px solid ${b.color}` : "1px solid rgba(255,255,255,0.06)",
                    color: badgeCat === b.id ? b.color : "rgba(255,255,255,0.5)",
                    fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em",
                    textAlign: "left",
                  }}>{b.icon} {b.name}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Specific badge name (optional)</label>
              <input type="text" value={badgeName} onChange={e => setBadgeName(e.target.value)} style={inputStyle}
                placeholder="e.g. Cipher Victor · Studio Founder · CS Mastery" />
            </div>
          </>
        )}

        {/* Description */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>What did you do? (host will read this)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "'Jura', sans-serif" }}
            placeholder="Describe the achievement, project completion, or contribution you're claiming credit for." />
        </div>

        {/* Proof — link OR file */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Proof (link OR upload)</label>
          <input type="url" value={proofLink} onChange={e => setProofLink(e.target.value)} style={inputStyle}
            placeholder="https://… (Drive, Figma, GitHub, etc.)" />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
            <label style={{
              padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
              background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)",
              color: "#a78bfa", fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", fontWeight: 700,
            }}>
              CHOOSE FILE
              <input type="file" onChange={e => onFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </label>
            {proofFileName && (
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                📎 {proofFileName} <button onClick={() => onFile(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "4px" }}>×</button>
              </span>
            )}
          </div>
        </div>

        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "12px",
            background: msg.kind === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: msg.kind === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
            color: msg.kind === "success" ? "#22c55e" : "#ef4444",
          }}>{msg.text}</div>
        )}

        <button onClick={submit} disabled={submitting}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px",
            background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
            color: "#fff", border: "none", cursor: submitting ? "default" : "pointer",
            fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", fontWeight: 800, letterSpacing: "0.08em",
            opacity: submitting ? 0.5 : 1,
          }}>{submitting ? "SUBMITTING…" : "SUBMIT TO HOST"}</button>
      </div>

      {/* My recent requests */}
      <div style={{ marginTop: "28px" }}>
        <div style={cardTitleStyle}>My recent requests</div>
        {requests.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
            No requests submitted yet. Use the form above to ask your host for XC or a badge.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {requests.slice(0, 10).map(r => (
              <div key={r.id} style={{
                padding: "12px 14px", borderRadius: "10px",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", color: "#e0e0ff", marginBottom: "3px" }}>
                    {r.type === "xc" ? `⚡ ${r.amount} XC` : `🏅 ${BADGE_CATEGORIES.find(b => b.id === r.badgeCategory)?.icon || "🏅"} ${r.badgeName || (r.badgeCategory || "Badge")}`}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.description}
                  </div>
                </div>
                <div style={{
                  padding: "3px 10px", borderRadius: "999px",
                  background: r.status === "approved" ? "rgba(34,197,94,0.15)" : r.status === "denied" ? "rgba(239,68,68,0.15)" : "rgba(245,200,66,0.15)",
                  color: r.status === "approved" ? "#22c55e" : r.status === "denied" ? "#ef4444" : "#f5c842",
                  fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                  fontFamily: "'Share Tech Mono', monospace", flexShrink: 0,
                }}>{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2 — Peer Trade ────────────────────────────────────────────
function PeerTradeTab({ user }: { user: User }) {
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [toPlayerId, setToPlayerId] = useState<string>("");
  const [offerXc, setOfferXc] = useState<string>("0");
  const [offerService, setOfferService] = useState<string>("");
  const [requestXc, setRequestXc] = useState<string>("0");
  const [requestService, setRequestService] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Pull the roster from the Console via the canonical bus type.
  useEffect(() => {
    function onList(ev: Event) {
      const e = ev as CustomEvent<{ players: RosterPlayer[] }>;
      const list = (e.detail?.players || []).filter(p => p && p.id && p.id !== user.id);
      setRoster(list);
    }
    window.addEventListener("pflx-players-list", onList as EventListener);
    try {
      if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({
          type: "pflx_players_list_request",
          filter: { role: "player" },
        }), "*");
      }
    } catch {}
    return () => window.removeEventListener("pflx-players-list", onList as EventListener);
  }, [user.id]);

  useEffect(() => {
    setTrades(loadTrades().filter(t => t.fromPlayerId === user.id || t.toPlayerId === user.id));
  }, [user.id]);

  // Listen for trade updates broadcast by the Console — covers:
  //   pflx_trade_inbox    : recipient receives a fresh proposal
  //   pflx_trade_updated  : status changed (accepted / declined / settled)
  useEffect(() => {
    function mergeTrade(t: TradeOffer) {
      const all = loadTrades();
      const idx = all.findIndex(x => x.id === t.id);
      if (idx >= 0) all[idx] = t;
      else all.unshift(t);
      saveTrades(all);
      setTrades(all.filter(x => x.fromPlayerId === user.id || x.toPlayerId === user.id));
    }
    function onMsg(ev: MessageEvent) {
      let m: { type?: string; trade?: TradeOffer } | null = null;
      try { m = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (!m || typeof m !== "object") return;
      if ((m.type === "pflx_trade_inbox" || m.type === "pflx_trade_updated") && m.trade) {
        mergeTrade(m.trade);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [user.id]);

  // Send a status-change action to the Console. The Console validates,
  // updates the canonical trade record, and broadcasts pflx_trade_updated
  // to both parties (and the host for host-approval steps).
  const actOnTrade = useCallback((tradeId: string, action: "accept" | "decline" | "cancel") => {
    postToParent({ type: "pflx_trade_action", tradeId, action });
    // Optimistic local update so the buttons disappear instantly. The
    // canonical record will arrive via pflx_trade_updated and overwrite.
    const all = loadTrades();
    const idx = all.findIndex(x => x.id === tradeId);
    if (idx >= 0) {
      const optimistic: TradeOffer["status"] =
        action === "accept"  ? "accepted"
        : action === "decline" ? "declined"
        : "cancelled";
      all[idx] = { ...all[idx], status: optimistic, actedAt: new Date().toISOString() };
      saveTrades(all);
      setTrades(all.filter(x => x.fromPlayerId === user.id || x.toPlayerId === user.id));
    }
  }, [user.id]);

  const submit = useCallback(() => {
    setMsg(null);
    if (!toPlayerId) { setMsg({ kind: "error", text: "Pick a player to trade with." }); return; }
    const offerN = parseInt(offerXc, 10) || 0;
    const reqN   = parseInt(requestXc, 10) || 0;
    if (offerN === 0 && !offerService.trim()) {
      setMsg({ kind: "error", text: "Offer at least some XC or a service." });
      return;
    }
    if (reqN === 0 && !requestService.trim()) {
      setMsg({ kind: "error", text: "Request at least some XC or a service in return." });
      return;
    }
    const recipient = roster.find(p => p.id === toPlayerId);
    if (!recipient) { setMsg({ kind: "error", text: "Recipient not found." }); return; }

    const offer: TradeOffer = {
      id: shortId("trade"),
      fromPlayerId: user.id,
      fromBrand: (user.brandName as string) || (user.name as string) || "Player",
      toPlayerId: recipient.id,
      toBrand: recipient.brand || recipient.brandName || recipient.name || "Player",
      offerXc: offerN,
      offerService: offerService.trim(),
      requestXc: reqN,
      requestService: requestService.trim(),
      notes: notes.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const next = [offer, ...loadTrades()];
    saveTrades(next);
    setTrades(next.filter(t => t.fromPlayerId === user.id || t.toPlayerId === user.id));
    postToParent({ type: "pflx_trade_proposed", trade: offer });
    // Reset
    setOfferXc("0"); setOfferService(""); setRequestXc("0"); setRequestService(""); setNotes("");
    setMsg({ kind: "success", text: `Trade offer sent to @${offer.toBrand}. They'll see it on their X-Tracker.` });
  }, [user, toPlayerId, offerXc, offerService, requestXc, requestService, notes, roster]);

  return (
    <div>
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Propose a trade</div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Trade with</label>
          <select value={toPlayerId} onChange={e => setToPlayerId(e.target.value)} style={inputStyle}>
            <option value="">— Choose a player —</option>
            {roster.map(p => (
              <option key={p.id} value={p.id}>{p.brand || p.brandName || p.name || p.id}</option>
            ))}
          </select>
          {roster.length === 0 && (
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
              Waiting for roster from the Platform…
            </div>
          )}
        </div>

        {/* Two columns: I OFFER / I REQUEST */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "16px" }}>
          <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#22c55e", marginBottom: "10px" }}>I OFFER ⬆</div>
            <label style={labelStyle}>X-Coin amount</label>
            <input type="number" min={0} value={offerXc} onChange={e => setOfferXc(e.target.value)} style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: "10px" }}>Service / work</label>
            <textarea value={offerService} onChange={e => setOfferService(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }}
              placeholder="e.g. I'll design 3 social media graphics" />
          </div>
          <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#a78bfa", marginBottom: "10px" }}>I REQUEST ⬇</div>
            <label style={labelStyle}>X-Coin amount</label>
            <input type="number" min={0} value={requestXc} onChange={e => setRequestXc(e.target.value)} style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: "10px" }}>Service / work</label>
            <textarea value={requestService} onChange={e => setRequestService(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }}
              placeholder="e.g. You write the script + voiceover" />
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Timeline, conditions, anything else they should know." />
        </div>

        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "12px",
            background: msg.kind === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: msg.kind === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
            color: msg.kind === "success" ? "#22c55e" : "#ef4444",
          }}>{msg.text}</div>
        )}

        <button onClick={submit}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px",
            background: "linear-gradient(135deg,#22c55e,#a78bfa)",
            color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", fontWeight: 800, letterSpacing: "0.08em",
          }}>SEND TRADE OFFER</button>
      </div>

      {/* My trades */}
      <div style={{ marginTop: "28px" }}>
        <div style={cardTitleStyle}>My trades</div>
        {trades.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
            No trades yet. Send an offer to a peer above to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {trades.slice(0, 12).map(t => {
              const isMine = t.fromPlayerId === user.id;
              // Status color + label
              const statusInfo = (() => {
                switch (t.status) {
                  case "pending":       return { color: "#f5c842", label: "AWAITING RECIPIENT" };
                  case "accepted":      return { color: "#3b82f6", label: "AWAITING HOST APPROVAL" };
                  case "host_approved":
                  case "completed":     return { color: "#22c55e", label: "COMPLETED" };
                  case "declined":      return { color: "#ef4444", label: "DECLINED" };
                  case "host_denied":   return { color: "#ef4444", label: "HOST DENIED" };
                  case "cancelled":     return { color: "#6b7280", label: "CANCELLED" };
                  default:              return { color: "#f5c842", label: String(t.status).toUpperCase() };
                }
              })();
              // What actions can the active player take right now?
              const canRecipientAct = !isMine && t.status === "pending";
              const canSenderCancel =  isMine && t.status === "pending";
              return (
                <div key={t.id} style={{
                  padding: "14px 16px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#e0e0ff" }}>
                      {isMine ? `→ @${t.toBrand}` : `← @${t.fromBrand}`}
                    </div>
                    <div style={{
                      padding: "3px 10px", borderRadius: "999px",
                      background: `${statusInfo.color}22`, color: statusInfo.color,
                      fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>{statusInfo.label}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                    <div style={{ color: "#22c55e" }}>
                      <div style={{ fontSize: "9px", letterSpacing: "0.12em", opacity: 0.7 }}>{isMine ? "YOU OFFER" : "THEY OFFER"}</div>
                      <div>⚡ {t.offerXc} XC{t.offerService ? ` + ${t.offerService}` : ""}</div>
                    </div>
                    <div style={{ color: "#a78bfa" }}>
                      <div style={{ fontSize: "9px", letterSpacing: "0.12em", opacity: 0.7 }}>{isMine ? "YOU REQUEST" : "THEY REQUEST"}</div>
                      <div>⚡ {t.requestXc} XC{t.requestService ? ` + ${t.requestService}` : ""}</div>
                    </div>
                  </div>
                  {t.notes && <div style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>📝 {t.notes}</div>}
                  {t.hostNote && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "#a78bfa", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", padding: "6px 10px", borderRadius: "6px" }}>
                      🛡 Host: {t.hostNote}
                    </div>
                  )}
                  {/* Action buttons */}
                  {(canRecipientAct || canSenderCancel) && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                      {canRecipientAct && (
                        <>
                          <button onClick={() => actOnTrade(t.id, "accept")} style={{
                            flex: 1, minWidth: "100px",
                            padding: "8px 14px", borderRadius: "8px",
                            background: "linear-gradient(135deg,#22c55e,#16a34a)",
                            color: "#fff", border: "none", cursor: "pointer",
                            fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em",
                          }}>✓ ACCEPT</button>
                          <button onClick={() => actOnTrade(t.id, "decline")} style={{
                            flex: 1, minWidth: "100px",
                            padding: "8px 14px", borderRadius: "8px",
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
                            color: "#ef4444", cursor: "pointer",
                            fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em",
                          }}>✕ DECLINE</button>
                        </>
                      )}
                      {canSenderCancel && (
                        <button onClick={() => actOnTrade(t.id, "cancel")} style={{
                          padding: "8px 14px", borderRadius: "8px",
                          background: "rgba(107,114,128,0.1)", border: "1px solid rgba(107,114,128,0.3)",
                          color: "rgba(255,255,255,0.5)", cursor: "pointer",
                          fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
                        }}>CANCEL OFFER</button>
                      )}
                    </div>
                  )}
                  {/* Helper text for awaiting-host state */}
                  {t.status === "accepted" && (
                    <div style={{ marginTop: "8px", fontSize: "10px", color: "rgba(59,130,246,0.7)", fontStyle: "italic" }}>
                      🛡 Waiting for the host to approve the XC transfer. You'll be notified when it settles.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  padding: "20px 22px", borderRadius: "16px",
  background: "rgba(22,22,31,0.6)", border: "1px solid rgba(0,212,255,0.12)",
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Orbitron', sans-serif", fontSize: "13px", fontWeight: 800,
  letterSpacing: "0.08em", color: "#00d4ff", textTransform: "uppercase",
  marginBottom: "16px",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "6px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", fontSize: "13px", fontFamily: "'Jura', sans-serif", outline: "none",
};
