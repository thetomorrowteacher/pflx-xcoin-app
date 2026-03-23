// Global "Saved to cloud" toast — works from any component or module
// Injects a fixed-position toast into the DOM and auto-fades

let toastEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function getOrCreateToast(): HTMLDivElement {
  if (toastEl && document.body.contains(toastEl)) return toastEl;

  toastEl = document.createElement("div");
  toastEl.id = "pflx-save-toast";
  toastEl.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: linear-gradient(135deg, #00d4ff, #7c3aed);
    color: #fff;
    padding: 10px 28px;
    border-radius: 8px;
    font-family: 'Orbitron', 'Rajdhani', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    z-index: 99999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
  `;
  document.body.appendChild(toastEl);
  return toastEl;
}

export function showSaveToast(msg = "Saved to cloud ✓") {
  if (typeof window === "undefined") return; // SSR guard
  const el = getOrCreateToast();
  el.textContent = msg;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
  }, 2200);
}
