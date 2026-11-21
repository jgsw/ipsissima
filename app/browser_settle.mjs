/* browser_settle.mjs — wait for what a fixed sleep waited for, and stop when it has happened.
 *
 *   import { settle } from "./browser_settle.mjs";
 *   await settle(page, 900);     // where a suite used to say  await page.waitForTimeout(900)
 *
 * WHY. The browser suites waited a fixed time after each click: 900 to 1600 ms, for a glide of
 * 350. On 21 Nov 2026 that was 211 of the rendered-map suite's 307 seconds and 52 of the clarity
 * suite's 72 (docs/TEST-SPEED-AUDIT.md), and the suites now run side by side, where a fixed sleep
 * on a busy machine can also look at a map mid-glide.
 *
 * THE PROMISE: NOTHING THE OLD SLEEP WOULD HAVE LET HAPPEN IS MISSED. A sleep of N ms lets three
 * kinds of thing finish, and each is waited for explicitly:
 *   - every timer the page has set that falls due within the N ms. The page's own setTimeout is
 *     wrapped to keep that list, so a 750 ms offer after load, a 300 ms preview debounce after
 *     typing and a long-press timer under a held finger are all waited for -- until they fire
 *     or are cleared -- exactly as the sleep would have;
 *   - every animation frame requested, and every finite CSS animation or transition running;
 *   - and anything else asynchronous (a FileReader on a drop), by requiring the document to have
 *     been still for QUIET ms.
 * When all three are true it returns. It never waits longer than N, and reaching N simply
 * returns, as the sleep did. Timers due after N are ignored, as the sleep ignored them.
 *
 * THE FIRST CALL ON A PAGE IS A PLAIN SLEEP. The record of timers has to exist BEFORE the action
 * that sets them, so the first call installs it (on this page now, and on every later load of it)
 * and then sleeps the full N. Anything that could not be watched is waited for the old way.
 *
 * Infinite animations (the walkthrough's pulse, a blinking caret) are ignored: they never end.
 */

export const QUIET = 120;

/** In the page: keep a record of pending timers and animation frames. Idempotent. */
function install() {
  const w = /** @type {any} */ (window);
  if (w.__ipsSettle) return;
  const pending = new Map();           // timer id -> when it falls due (performance.now())
  let frames = 0;
  const st = window.setTimeout, ct = window.clearTimeout;
  const raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
  const frameIds = new Set();
  /** @type {any} */
  const wrapped = function (fn, ms, ...args) {
    const due = performance.now() + (Number(ms) || 0);
    const id = st.call(window, function () {
      pending.delete(id);
      if (typeof fn === "function") return fn.apply(this, args);
    }, ms);
    pending.set(id, due);
    return id;
  };
  window.setTimeout = wrapped;
  window.clearTimeout = /** @type {any} */ (function (id) { pending.delete(id); return ct.call(window, id); });
  window.requestAnimationFrame = function (cb) {
    const id = raf.call(window, t => { frameIds.delete(id); frames = frameIds.size; cb(t); });
    frameIds.add(id); frames = frameIds.size;
    return id;
  };
  window.cancelAnimationFrame = function (id) { frameIds.delete(id); frames = frameIds.size; return caf.call(window, id); };
  w.__ipsSettle = {
    /** Timers still to fire at or before `until`. */
    timersBefore: until => { let n = 0; for (const due of pending.values()) if (due <= until) n++; return n; },
    frames: () => frames,
    // The wait's own pauses go round the record, or they would be the timer it waits for.
    pause: ms => new Promise(r => st.call(window, r, ms))
  };
}

/** @type {WeakSet<object>} */
const armed = new WeakSet();

/**
 * @param {import("playwright").Page} page
 * @param {number} maxMs   the fixed sleep this replaces: the most it will ever wait
 * @returns {Promise<"settled"|"cap">}
 */
export async function settle(page, maxMs) {
  const began = Date.now();
  const sleepRest = async () => {
    const left = maxMs - (Date.now() - began);
    if (left > 0) await new Promise(r => setTimeout(r, left));
    return /** @type {"cap"} */ ("cap");
  };
  if (!armed.has(page)) {
    armed.add(page);
    await page.addInitScript(install);
    try { await page.evaluate(install); } catch (e) { void e; }
    return sleepRest();
  }
  try {
    const r = await page.evaluate(async ({ maxMs, quiet }) => {
      const S = /** @type {any} */ (window).__ipsSettle;
      if (!S) return "unwatched";            // a page loaded in a way the init script missed
      const t0 = performance.now(), cap = t0 + maxMs;
      let last = t0;
      const mo = new MutationObserver(() => { last = performance.now(); });
      mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      const moving = () => document.getAnimations().some(a => {
        if (a.playState !== "running" && !a.pending) return false;
        const t = a.effect && a.effect.getComputedTiming();
        return !t || t.iterations !== Infinity;
      });
      try {
        for (;;) {
          await S.pause(20);
          const now = performance.now();
          if (now >= cap) return "cap";
          if (S.timersBefore(cap) || S.frames() || moving()) { last = now; continue; }
          if (now - last >= quiet && now - t0 >= quiet) return "settled";
        }
      } finally { mo.disconnect(); }
    }, { maxMs, quiet: QUIET });
    return r === "unwatched" ? sleepRest() : r;
  } catch (e) {
    // The page navigated under the wait, tearing down the context it ran in. Sit out the rest of
    // the old sleep, as it would have, and let the next step meet whatever is there.
    void e;
    return sleepRest();
  }
}
