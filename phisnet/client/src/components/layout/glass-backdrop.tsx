import { useEffect } from "react";

/**
 * Fixed background layer for the glass restyle (admin layout and login only),
 * plus two page-wide visual behaviours that need no changes to existing components:
 *  - a spotlight that follows the pointer inside any `.glass-tile` (sets --mx / --my);
 *  - a one-time count-up for numbers marked `.glass-countup`.
 * Both are skipped for users who prefer reduced motion.
 */

const COUNT_MS = 900;
const NUMBER = /^(\d+(?:\.\d+)?)([\s\S]*)$/;
// Seen once per element. Zero placeholders (shown while loading) wait for the real value.
const counted = new WeakSet<Element>();
const writing = new WeakMap<Element, string>();

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function countUp(el: Element) {
  if (counted.has(el) || writing.has(el)) return;
  const text = el.textContent ?? "";
  const match = NUMBER.exec(text);
  // Only plain leading numbers in a single text node; anything else is left exactly as rendered.
  if (!match || el.childNodes.length !== 1 || el.firstChild?.nodeType !== Node.TEXT_NODE) return;
  const target = Number(match[1]);
  if (!(target > 0)) return;
  counted.add(el);
  if (reducedMotion()) return;
  const decimals = match[1].split(".")[1]?.length ?? 0;
  const suffix = match[2];
  const node = el.firstChild as Text;
  const start = performance.now();
  const frame = (now: number) => {
    // React replaced the value mid-animation: stop and leave its text alone.
    if (node.parentNode !== el || node.nodeValue !== writing.get(el)) { writing.delete(el); return; }
    const t = Math.min(1, (now - start) / COUNT_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    const next = t < 1 ? (target * eased).toFixed(decimals) + suffix : text;
    node.nodeValue = next;
    writing.set(el, next);
    if (t < 1) requestAnimationFrame(frame); else writing.delete(el);
  };
  const first = (0).toFixed(decimals) + suffix;
  node.nodeValue = first;
  writing.set(el, first);
  requestAnimationFrame(frame);
}

export default function GlassBackdrop() {
  useEffect(() => {
    // Spotlight: one delegated listener instead of per-tile handlers.
    let pending: PointerEvent | null = null;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const event = pending;
      if (!event) return;
      const tile = (event.target as Element | null)?.closest?.(".glass-tile") as HTMLElement | null;
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      tile.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pending = event;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });

    // Count-up: numbers present now, inserted later, or filled in when data arrives.
    const scan = (root: ParentNode) => root.querySelectorAll?.(".glass-countup").forEach(countUp);
    scan(document);
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        const host = m.target.nodeType === Node.TEXT_NODE ? m.target.parentElement : (m.target as Element);
        const marked = host?.closest?.(".glass-countup");
        if (marked) countUp(marked);
        m.addedNodes.forEach(n => { if (n.nodeType === Node.ELEMENT_NODE) { if ((n as Element).matches(".glass-countup")) countUp(n as Element); scan(n as Element); } });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Pages each mount their own layout; a clock-based delay keeps the glows' drift
  // continuous across navigations instead of jumping back to the start.
  const seconds = Date.now() / 1000;
  return (
    <div className="glass-backdrop" aria-hidden="true">
      <div className="glass-backdrop__glow glass-backdrop__glow--orange" style={{ animationDelay: `-${seconds % 44}s` }} />
      <div className="glass-backdrop__glow glass-backdrop__glow--grey" style={{ animationDelay: `-${seconds % 50}s` }} />
      <div className="glass-backdrop__grid" />
    </div>
  );
}
