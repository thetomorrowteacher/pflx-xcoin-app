"use client";
/**
 * X-Coin Economy Settings — the economy-only admin surface for PFLX.
 *
 * After the separation-of-concerns split, X-Coin stops owning Season /
 * Checkpoint / Project / Task CRUD (that moved to Mission Control) and
 * instead owns three things:
 *
 *   1. PER-ENTITY ECONOMY OVERRIDES — for each Season, Checkpoint, Project
 *      and Task already owned by Mission Control, X-Coin can layer on:
 *      upgrade whitelist, task value multipliers, wager caps, badge weights.
 *
 *   2. FINE / TAX RULE ENGINE — a trigger → amount table that says
 *      "when event X occurs in DarkCampus / X-Bot / Slack / Discord,
 *      deduct N XC from the offender". Also supports recurring taxes.
 *
 *   3. UPGRADE STORE CATALOG — items, prices, prerequisites, windows.
 *
 * All state is persisted via saveAndToast → Supabase + postMessage to
 * Mission Control so the host sees the economy layer alongside the
 * parent entities they own.
 */

import { useEffect, useState } from "react";
import { saveAndToast } from "../../lib/saveToast";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

type EntityScope = "global" | "season" | "checkpoint" | "project" | "task";

export interface EconomyOverride {
  id: string;
  scope: EntityScope;
  entityId: string | null;          // null when scope === "global"
  upgradeWhitelist: string[];       // upgrade ids players can buy in this scope
  taskValueMultiplier: number;      // e.g. 1.5 = double-XC window
  wagerCapXC: number | null;        // per-match wager ceiling in Battle Arena
  badgeWeightOverrides: Record<string, number>; // badgeId → weight for suggestion engine
  updatedAt: string;
}

export type FineTriggerSource =
  | "darkcampus"
  | "xbot"
  | "slack"
  | "discord"
  | "arena"
  | "mission-control";

export type FineTriggerKind =
  | "profanity"
  | "missed-deadline"
  | "absent-standup"
  | "unauthorized-post"
  | "no-show-arena"
  | "griefing"
  | "harassment"
  | "spam"
  | "custom";

export interface FineRule {
  id: string;
  label: string;
  source: FineTriggerSource;
  kind: FineTriggerKind;
  amountXC: number;
  recurring: boolean;               // apply every time it fires, not just once
  cooldownMinutes: number;          // minimum time between repeated charges
  notifyPlayer: boolean;            // post violation DM via X-Bot
  escalateToHost: boolean;          // flag in mc-panel-approvals for host review
  enabled: boolean;
  createdAt: string;
}

export interface RecurringTax {
  id: string;
  label: string;
  amountXC: number;
  cadence: "daily" | "weekly" | "biweekly" | "monthly";
  appliesTo: "all" | "unonboarded" | "specific-cohort";
  cohortId: string | null;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

const STORAGE_OVERRIDES = "pflx_economy_overrides";
const STORAGE_FINES = "pflx_economy_fines";
const STORAGE_TAXES = "pflx_economy_taxes";

export default function EconomySettingsPage() {
  const [overrides, setOverrides] = useState<EconomyOverride[]>([]);
  const [fines, setFines] = useState<FineRule[]>([]);
  const [taxes, setTaxes] = useState<RecurringTax[]>([]);
  const [tab, setTab] = useState<"overrides" | "fines" | "taxes">("overrides");

  // ── Load from localStorage (Supabase sync happens via PflxBridge) ──
  useEffect(() => {
    try {
      const o = localStorage.getItem(STORAGE_OVERRIDES);
      if (o) setOverrides(JSON.parse(o));
      const f = localStorage.getItem(STORAGE_FINES);
      if (f) setFines(JSON.parse(f));
      const t = localStorage.getItem(STORAGE_TAXES);
      if (t) setTaxes(JSON.parse(t));
    } catch {}
  }, []);

  // ── Persist helpers ──
  const persistOverrides = (next: EconomyOverride[]) => {
    setOverrides(next);
    saveAndToast(
      [() => localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(next))],
      "Economy overrides saved"
    );
    broadcastToMC("pflx_economy_overrides_updated", next);
  };
  const persistFines = (next: FineRule[]) => {
    setFines(next);
    saveAndToast(
      [() => localStorage.setItem(STORAGE_FINES, JSON.stringify(next))],
      "Fine rules saved"
    );
    broadcastToMC("pflx_economy_fines_updated", next);
  };
  const persistTaxes = (next: RecurringTax[]) => {
    setTaxes(next);
    saveAndToast(
      [() => localStorage.setItem(STORAGE_TAXES, JSON.stringify(next))],
      "Recurring taxes saved"
    );
    broadcastToMC("pflx_economy_taxes_updated", next);
  };

  // ── CRUD actions ──
  const addOverride = () => {
    const now = new Date().toISOString();
    persistOverrides([
      ...overrides,
      {
        id: `override-${Date.now()}`,
        scope: "global",
        entityId: null,
        upgradeWhitelist: [],
        taskValueMultiplier: 1,
        wagerCapXC: null,
        badgeWeightOverrides: {},
        updatedAt: now,
      },
    ]);
  };
  const removeOverride = (id: string) =>
    persistOverrides(overrides.filter((o) => o.id !== id));

  const addFine = () => {
    persistFines([
      ...fines,
      {
        id: `fine-${Date.now()}`,
        label: "New fine rule",
        source: "darkcampus",
        kind: "profanity",
        amountXC: 25,
        recurring: true,
        cooldownMinutes: 10,
        notifyPlayer: true,
        escalateToHost: false,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  };
  const removeFine = (id: string) =>
    persistFines(fines.filter((f) => f.id !== id));

  const addTax = () => {
    persistTaxes([
      ...taxes,
      {
        id: `tax-${Date.now()}`,
        label: "Weekly inactivity tax",
        amountXC: 10,
        cadence: "weekly",
        appliesTo: "unonboarded",
        cohortId: null,
        enabled: true,
      },
    ]);
  };
  const removeTax = (id: string) =>
    persistTaxes(taxes.filter((t) => t.id !== id));

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>
        Economy Settings
      </h1>
      <p style={{ opacity: 0.7, marginBottom: 20 }}>
        X-Coin owns the economy layer — upgrade whitelists, value multipliers,
        fine rules, and recurring taxes. Parent entities (Seasons / Checkpoints
        / Projects / Tasks) are authored in Mission Control; this surface
        layers economy rules on top of them.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["overrides", "fines", "taxes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.18)",
              background:
                tab === t
                  ? "linear-gradient(135deg,#f5c842,#f59e0b)"
                  : "rgba(255,255,255,0.05)",
              color: tab === t ? "#000" : "#fff",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: 12,
            }}
          >
            {t === "overrides"
              ? "Entity Overrides"
              : t === "fines"
              ? "Fine Rules"
              : "Recurring Taxes"}
          </button>
        ))}
      </div>

      {tab === "overrides" && (
        <OverridesTab
          overrides={overrides}
          onChange={persistOverrides}
          onAdd={addOverride}
          onRemove={removeOverride}
        />
      )}
      {tab === "fines" && (
        <FinesTab
          fines={fines}
          onChange={persistFines}
          onAdd={addFine}
          onRemove={removeFine}
        />
      )}
      {tab === "taxes" && (
        <TaxesTab
          taxes={taxes}
          onChange={persistTaxes}
          onAdd={addTax}
          onRemove={removeTax}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function broadcastToMC(type: string, data: unknown) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ type, data }), "*");
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function OverridesTab({
  overrides,
  onChange,
  onAdd,
  onRemove,
}: {
  overrides: EconomyOverride[];
  onChange: (next: EconomyOverride[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onAdd}
        style={{
          padding: "10px 18px",
          background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 800,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        + Add Economy Override
      </button>
      {overrides.length === 0 && (
        <p style={{ opacity: 0.5 }}>
          No overrides yet. Global upgrade catalog and default task values
          apply everywhere.
        </p>
      )}
      {overrides.map((o) => (
        <div
          key={o.id}
          style={{
            padding: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              value={o.scope}
              onChange={(e) => {
                const next = overrides.map((x) =>
                  x.id === o.id ? { ...x, scope: e.target.value as EntityScope } : x
                );
                onChange(next);
              }}
              style={selectStyle}
            >
              <option value="global">Global</option>
              <option value="season">Season</option>
              <option value="checkpoint">Checkpoint</option>
              <option value="project">Project</option>
              <option value="task">Task</option>
            </select>
            <input
              placeholder="Entity ID"
              value={o.entityId || ""}
              onChange={(e) => {
                const next = overrides.map((x) =>
                  x.id === o.id ? { ...x, entityId: e.target.value || null } : x
                );
                onChange(next);
              }}
              disabled={o.scope === "global"}
              style={inputStyle}
            />
            <label style={{ fontSize: 12, opacity: 0.7 }}>Task ×</label>
            <input
              type="number"
              step="0.1"
              value={o.taskValueMultiplier}
              onChange={(e) => {
                const next = overrides.map((x) =>
                  x.id === o.id
                    ? { ...x, taskValueMultiplier: parseFloat(e.target.value) || 1 }
                    : x
                );
                onChange(next);
              }}
              style={{ ...inputStyle, width: 80 }}
            />
            <label style={{ fontSize: 12, opacity: 0.7 }}>Wager Cap</label>
            <input
              type="number"
              placeholder="∞"
              value={o.wagerCapXC ?? ""}
              onChange={(e) => {
                const next = overrides.map((x) =>
                  x.id === o.id
                    ? {
                        ...x,
                        wagerCapXC: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      }
                    : x
                );
                onChange(next);
              }}
              style={{ ...inputStyle, width: 100 }}
            />
            <button
              onClick={() => onRemove(o.id)}
              style={{ ...btnGhostStyle, marginLeft: "auto", color: "#ef4444" }}
            >
              Remove
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            Upgrade whitelist: {o.upgradeWhitelist.length || "all upgrades"}
            {" · "}Badge weight keys: {Object.keys(o.badgeWeightOverrides).length || "default"}
          </div>
        </div>
      ))}
    </div>
  );
}

function FinesTab({
  fines,
  onChange,
  onAdd,
  onRemove,
}: {
  fines: FineRule[];
  onChange: (next: FineRule[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <button onClick={onAdd} style={btnPrimaryStyle}>
        + Add Fine Rule
      </button>
      {fines.length === 0 && (
        <p style={{ opacity: 0.5, marginTop: 12 }}>
          No fine rules yet. Fines fire when triggers from DarkCampus / X-Bot /
          Slack / Discord / Arena / Mission Control match.
        </p>
      )}
      {fines.map((f) => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10 }}>
            <input
              value={f.label}
              placeholder="Label"
              onChange={(e) =>
                onChange(fines.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))
              }
              style={inputStyle}
            />
            <select
              value={f.source}
              onChange={(e) =>
                onChange(
                  fines.map((x) =>
                    x.id === f.id ? { ...x, source: e.target.value as FineTriggerSource } : x
                  )
                )
              }
              style={selectStyle}
            >
              <option value="darkcampus">DarkCampus</option>
              <option value="xbot">X-Bot</option>
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
              <option value="arena">Battle Arena</option>
              <option value="mission-control">Mission Control</option>
            </select>
            <select
              value={f.kind}
              onChange={(e) =>
                onChange(
                  fines.map((x) =>
                    x.id === f.id ? { ...x, kind: e.target.value as FineTriggerKind } : x
                  )
                )
              }
              style={selectStyle}
            >
              <option value="profanity">Profanity</option>
              <option value="missed-deadline">Missed deadline</option>
              <option value="absent-standup">Absent standup</option>
              <option value="unauthorized-post">Unauthorized post</option>
              <option value="no-show-arena">No-show (Arena)</option>
              <option value="griefing">Griefing</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="custom">Custom</option>
            </select>
            <input
              type="number"
              value={f.amountXC}
              placeholder="XC"
              onChange={(e) =>
                onChange(
                  fines.map((x) =>
                    x.id === f.id ? { ...x, amountXC: parseInt(e.target.value) || 0 } : x
                  )
                )
              }
              style={inputStyle}
            />
            <button onClick={() => onRemove(f.id)} style={btnGhostStyle}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, flexWrap: "wrap" }}>
            <label>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) =>
                  onChange(fines.map((x) => (x.id === f.id ? { ...x, enabled: e.target.checked } : x)))
                }
              />{" "}
              Enabled
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.recurring}
                onChange={(e) =>
                  onChange(
                    fines.map((x) => (x.id === f.id ? { ...x, recurring: e.target.checked } : x))
                  )
                }
              />{" "}
              Recurring
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.notifyPlayer}
                onChange={(e) =>
                  onChange(
                    fines.map((x) =>
                      x.id === f.id ? { ...x, notifyPlayer: e.target.checked } : x
                    )
                  )
                }
              />{" "}
              DM player
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.escalateToHost}
                onChange={(e) =>
                  onChange(
                    fines.map((x) =>
                      x.id === f.id ? { ...x, escalateToHost: e.target.checked } : x
                    )
                  )
                }
              />{" "}
              Host approval
            </label>
            <label>
              Cooldown:{" "}
              <input
                type="number"
                value={f.cooldownMinutes}
                onChange={(e) =>
                  onChange(
                    fines.map((x) =>
                      x.id === f.id
                        ? { ...x, cooldownMinutes: parseInt(e.target.value) || 0 }
                        : x
                    )
                  )
                }
                style={{ ...inputStyle, width: 70, display: "inline-block" }}
              />{" "}
              min
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaxesTab({
  taxes,
  onChange,
  onAdd,
  onRemove,
}: {
  taxes: RecurringTax[];
  onChange: (next: RecurringTax[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <button onClick={onAdd} style={btnPrimaryStyle}>
        + Add Recurring Tax
      </button>
      {taxes.map((t) => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 180px auto", gap: 10 }}>
            <input
              value={t.label}
              onChange={(e) =>
                onChange(taxes.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))
              }
              style={inputStyle}
            />
            <input
              type="number"
              value={t.amountXC}
              onChange={(e) =>
                onChange(
                  taxes.map((x) =>
                    x.id === t.id ? { ...x, amountXC: parseInt(e.target.value) || 0 } : x
                  )
                )
              }
              style={inputStyle}
            />
            <select
              value={t.cadence}
              onChange={(e) =>
                onChange(
                  taxes.map((x) =>
                    x.id === t.id
                      ? { ...x, cadence: e.target.value as RecurringTax["cadence"] }
                      : x
                  )
                )
              }
              style={selectStyle}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={t.appliesTo}
              onChange={(e) =>
                onChange(
                  taxes.map((x) =>
                    x.id === t.id
                      ? { ...x, appliesTo: e.target.value as RecurringTax["appliesTo"] }
                      : x
                  )
                )
              }
              style={selectStyle}
            >
              <option value="all">All players</option>
              <option value="unonboarded">Unonboarded only</option>
              <option value="specific-cohort">Specific cohort</option>
            </select>
            <button onClick={() => onRemove(t.id)} style={btnGhostStyle}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared styles ──
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  fontSize: 13,
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const btnPrimaryStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "linear-gradient(135deg,#f5c842,#f59e0b)",
  color: "#000",
  border: "none",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: 12,
};
const btnGhostStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
};
const cardStyle: React.CSSProperties = {
  padding: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  marginBottom: 10,
  marginTop: 12,
};
