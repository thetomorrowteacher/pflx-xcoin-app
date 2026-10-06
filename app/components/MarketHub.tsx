"use client";
// MarketHub — the X-Coin face of the ONE connected PFLX marketplace.
// It draws platform upgrades, game upgrades (Battle Arena), session upgrades (X-Live)
// and taxes & fines with the shared card module (public/pflx-market.js — the same
// file Battle Arena and X-Live carry). X-Coin owns platform upgrades and taxes/fines:
// those are bought and edited here. Game and session upgrades are browse-only here and
// send the player on to the app that sells them (Console message `pflx_open_app`).
import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { mockModifiers, PFLXModifier, User } from "../lib/data";

type Tab = "all" | "platform" | "game" | "session" | "tax";

const FALLBACK_URL: Record<string, string> = {
  arena: "https://pflx-battle-arena.vercel.app",
  xlive: "https://thetomorrowteacher.github.io/x-live/",
};

function loadModule(): Promise<any> {
  const w = window as any;
  if (w.PflxMarket) return Promise.resolve(w.PflxMarket);
  if (w.__pflxMarketLoading) return w.__pflxMarketLoading;
  w.__pflxMarketLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/pflx-market.js";
    s.onload = () => (w.PflxMarket ? resolve(w.PflxMarket) : reject(new Error("PflxMarket missing")));
    s.onerror = () => reject(new Error("pflx-market.js failed to load"));
    document.head.appendChild(s);
  });
  return w.__pflxMarketLoading;
}

async function kv(key: string): Promise<any> {
  const { data, error } = await supabase.from("app_data").select("data").eq("key", key).maybeSingle();
  if (error) return null;
  return (data as any)?.data ?? null;
}

interface Props {
  user: User;
  host?: boolean;
  initialTab?: Tab;
  /** player view: ids of the platform upgrades this player is allowed to see */
  visibleIds?: string[];
  /** player view: buy a platform upgrade (the page owns the wallet logic) */
  onBuy?: (mod: PFLXModifier) => void;
  /** host view: open the existing editor for a platform upgrade or a tax */
  onEdit?: (mod: PFLXModifier) => void;
  /** bump this when the wallet changed so the cards re-check affordability */
  version?: number;
}

export default function MarketHub({ user, host, initialTab, visibleIds, onBuy, onEdit, version }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);
  const openedEdit = useRef<string | null>(null);
  // latest props, read by the module's callbacks (the module is created once)
  const live = useRef({ user, host, visibleIds, onBuy, onEdit });
  live.current = { user, host, visibleIds, onBuy, onEdit };

  useEffect(() => {
    let dead = false;
    const onMsg = (ev: MessageEvent) => {
      const d: any = ev.data;
      if (!d || d.type !== "pflx_market_open" || !modelRef.current) return;
      const tabNow = modelRef.current.tab;
      if (d.tab && d.tab !== tabNow) modelRef.current.tab = d.tab;
      (window as any).PflxMarket.attach(modelRef.current, rootRef.current);
      // "Edit in X-Coin" from Battle Arena / X-Live: open the editor once for that item (hosts only)
      if (d.edit && d.itemId && live.current.host && live.current.onEdit && openedEdit.current !== d.itemId) {
        const mod = mockModifiers.find(x => x.id === d.itemId);
        if (mod) { openedEdit.current = d.itemId; live.current.onEdit(mod); }
      }
    };
    window.addEventListener("message", onMsg);

    loadModule().then(PM => {
      if (dead || !rootRef.current) return;
      const urlTab = new URLSearchParams(window.location.search).get("market_tab") as Tab | null;
      const m = PM.create({
        app: "xcoin",
        tab: urlTab || initialTab || "platform",
        kv,
        isHost: !!host,
        balance: host ? null : () => live.current.user.xcoin,
        balanceNote: host ? null : "Platform upgrades are bought here. Game and session upgrades are bought where they live.",
        // platform upgrades are the only thing sold from X-Coin
        buy: host ? {} : { platform: (it: any) => {
          const mod = mockModifiers.find(x => x.id === it.rawId);
          if (mod && live.current.onBuy) live.current.onBuy(mod);
        } },
        canBuy: (it: any) => {
          const u = live.current.user;
          if ((u.xcoin || 0) < it.cost) return { ok: false, label: "NOT ENOUGH", why: "Not enough X-Coin" };
          if ((u.digitalBadges || 0) < (it.badge || 0)) return { ok: false, label: "NOT ENOUGH", why: "Not enough badges" };
          return { ok: true };
        },
        // players only see the upgrades their rank / level / cohort / studio allows (same rule the page always used)
        canSee: (it: any) => {
          if (live.current.host || it.kind !== "platform") return true;
          const ids = live.current.visibleIds;
          return !ids || ids.indexOf(it.rawId) >= 0;
        },
        // X-Coin's own list is the live one (it already holds unsaved host edits)
        afterLoad: (d: any) => {
          if (!mockModifiers.length) return;
          d.platform = []; d.tax = [];
          mockModifiers.forEach(mod => {
            const it = PM.fromModifier(mod);
            if (it) d[it.kind].push(it);
          });
          d.ok.platform = true;
        },
        goto: (app: string, x: any) => {
          const msg = { type: "pflx_open_app", app, tab: x && x.tab, itemId: x && x.itemId, edit: !!(x && x.edit) };
          try {
            if (window.parent && window.parent !== window) { window.parent.postMessage(msg, "*"); return; }
          } catch (e) { /* fall through */ }
          const url = FALLBACK_URL[app];
          if (url) window.open(url + (x && x.tab ? "#market=" + encodeURIComponent(x.tab) : ""), "_blank", "noopener");
        },
        edit: (it: any) => {
          const mod = mockModifiers.find(x => x.id === it.rawId);
          if (mod && live.current.onEdit) live.current.onEdit(mod);
        },
      });
      modelRef.current = m;
      PM.attach(m, rootRef.current);
      m.refresh();
    }).catch(() => {
      if (rootRef.current) rootRef.current.textContent = "The marketplace could not load. Refresh to try again.";
    });
    return () => { dead = true; window.removeEventListener("message", onMsg); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // wallet / visibility changed → repaint the cards (no network)
  useEffect(() => {
    const m = modelRef.current, PM = (window as any).PflxMarket;
    if (m && PM && rootRef.current) PM.attach(m, rootRef.current);
  }, [version, user.xcoin, user.digitalBadges, visibleIds]);

  // the editor saved something → pull the fresh local list
  useEffect(() => {
    const m = modelRef.current;
    if (m) m.refresh();
  }, [version]);

  return <div ref={rootRef} style={{ minHeight: 120 }} />;
}
