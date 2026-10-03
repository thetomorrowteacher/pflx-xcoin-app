"use client";
import { useEffect } from "react";

const SOUND_ROOT = "https://www.prototypeflx.com/public/sounds/";
const SOUNDS: Record<string, string> = {
  hover: "pflx-library/02_UI_Blips/blip_039.mp3", // Ennis locked blip_039 as THE hover sound (matches Console v263 / X-Live v0.87 / DarkCampus). Was pflx-ui/ui_hover_soft.mp3.
  click: "pflx-library/01_UI_Clicks/click_041.mp3", // same smooth click as the Console (v243) and X-Live
};
const UI_SEL =
  'button, a[href], [onclick], [role="button"], .tab, select, input[type="checkbox"], input[type="radio"], label';
const PREF_KEY = "pflx_ui_sfx_on_v1";

export function pflxUiSfxOn(): boolean {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function pflxUiSfxSetOn(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {}
}

const pool: Record<string, HTMLAudioElement[]> = {};

function playSfx(name: string, gain: number): boolean {
  if (!pflxUiSfxOn() || typeof Audio === "undefined") return false;
  const path = SOUNDS[name];
  if (!path) return false;
  const p = pool[name] || (pool[name] = []);
  let a = p.find((x) => x.paused || x.ended);
  if (!a) {
    if (p.length >= 4) {
      a = p[0];
    } else {
      a = new Audio(SOUND_ROOT + path);
      a.preload = "auto";
      p.push(a);
    }
  }
  try {
    a.volume = Math.max(0, Math.min(1, gain));
    a.currentTime = 0;
    const pr = a.play();
    if (pr && typeof pr.catch === "function") pr.catch(() => {});
  } catch {
    return false;
  }
  return true;
}

function target(el: EventTarget | null): Element | null {
  if (!el || !(el instanceof Element) || !el.closest) return null;
  const t = el.closest(UI_SEL);
  if (!t) return null;
  if ((t as HTMLButtonElement).disabled) return null;
  if (t.getAttribute("aria-disabled") === "true") return null;
  if (t.hasAttribute("data-nosfx")) return null;
  return t;
}

export default function UiSfx() {
  useEffect(() => {
    let lastHover: Element | null = null;
    let lastHoverAt = 0;
    let lastClickAt = 0;

    function onOver(e: PointerEvent) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const t = target(e.target);
      if (!t || t === lastHover) return;
      if (e.relatedTarget && t.contains(e.relatedTarget as Node)) return;
      lastHover = t;
      const now = Date.now();
      if (now - lastHoverAt < 70) return;
      lastHoverAt = now;
      playSfx("hover", 0.35);
    }
    function onOut(e: PointerEvent) {
      const t = target(e.target);
      if (t && t === lastHover && !(e.relatedTarget && t.contains(e.relatedTarget as Node))) {
        lastHover = null;
      }
    }
    function onDown(e: PointerEvent) {
      if (e.button != null && e.button !== 0) return;
      const t = target(e.target);
      if (!t) return;
      const now = Date.now();
      if (now - lastClickAt < 60) return;
      lastClickAt = now;
      playSfx("click", 0.45);
    }

    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });

    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return null;
}
