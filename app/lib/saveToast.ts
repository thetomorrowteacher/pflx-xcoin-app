// Global "Saved to cloud" toast — works from any component or module
// Injects a fixed-position toast into the DOM and auto-fades
// Sound import is lazy to prevent module-level failures

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

export function showSaveToast(msg = "Saved to cloud ✓", playSound = true) {
  if (typeof window === "undefined") return; // SSR guard
  const el = getOrCreateToast();
  el.textContent = msg;
  el.style.background = "linear-gradient(135deg, #00d4ff, #7c3aed)";
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";

  // Lazy-load sound to avoid import failures crashing this module
  if (playSound) {
    import("./sounds").then(m => { try { m.playSave(); } catch {} }).catch(() => {});
  }

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
  }, 2200);
}

export function showErrorToast(msg = "Save failed — retrying...") {
  if (typeof window === "undefined") return;
  const el = getOrCreateToast();
  el.textContent = msg;
  el.style.background = "linear-gradient(135deg, #ef4444, #b91c1c)";
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
  }, 3000);
}

/**
 * Helper: save collections, show toast on success, show error on failure.
 * Use: saveAndToast([saveUsers, saveTransactions], "Badges saved to cloud ✓")
 */
export async function saveAndToast(
  saveFns: Array<() => Promise<boolean>>,
  successMsg = "Saved to cloud ✓",
): Promise<boolean> {
  console.log("[saveAndToast] Saving", saveFns.length, "collection(s)...");
  try {
    const results = await Promise.all(saveFns.map(fn => fn()));
    console.log("[saveAndToast] Results:", results);
    const allOk = results.every(r => r === true);
    if (allOk) {
      console.log("[saveAndToast] ✓ All saved successfully");
      showSaveToast(successMsg);
    } else {
      // Some saves returned false — retry once
      console.warn("[saveAndToast] Some saves returned false, retrying...");
      const retryResults = await Promise.all(saveFns.map(fn => fn()));
      console.log("[saveAndToast] Retry results:", retryResults);
      const retryOk = retryResults.every(r => r === true);
      if (retryOk) {
        showSaveToast(successMsg);
      } else {
        showErrorToast("Some data may not have saved — check connection");
      }
    }
    return allOk;
  } catch (err) {
    console.error("[saveAndToast] Error:", err);
    showErrorToast("Save failed — check connection");
    return false;
  }
}
