import { useTenantPreferences } from '@/hooks/use-tenant-preferences';
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigation } from "./navigation";

// Page layouts remount during routing. Keep the rail's scroll position for each
// signed-in user so changing pages does not move the menu.
const railScroll = new Map<number, number>();

/**
 * Icon rail with glass flyouts (desktop), or a bottom tab bar with the flyout above
 * it (phones). Sections and links come from useNavigation(), which applies the same
 * role rules as before. A section with a single link navigates directly.
 */
export default function Sidebar() {
  const { sections, location } = useNavigation();
  const { user } = useAuth();
  const { t } = useTenantPreferences();
  const [open, setOpen] = useState<string | null>(null);
  const wrapRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || !user) return;
    rail.scrollTop = railScroll.get(user.id) ?? 0;
    return () => { railScroll.set(user.id, rail.scrollTop); };
  }, [user?.id]);

  // Navigating closes the flyout.
  useEffect(() => { setOpen(null); }, [location]);

  // Click outside or Escape closes it; Escape returns focus to its rail button.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(null);
      wrapRef.current?.querySelector<HTMLElement>(`[data-section="${CSS.escape(open)}"]`)?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openSection = sections.find(section => section.name === open && section.items.length > 1);

  return (
    <aside ref={wrapRef} className="pn-rail-wrap">
      <nav ref={railRef} className="pn-rail glass glass-soft" aria-label="Sections">
        {sections.map(section => {
          const active = section.items.some(item => item.href === location);
          if (section.items.length === 1) {
            const only = section.items[0];
            return (
              <Link key={section.name} href={only.href} className="pn-rail-btn" data-active={active} aria-current={active ? 'page' : undefined}>
                <span className="pn-rail-icon">{section.icon}</span>
                <span>{t(section.name)}</span>
              </Link>
            );
          }
          return (
            <button
              key={section.name}
              type="button"
              className="pn-rail-btn"
              data-section={section.name}
              data-active={active}
              aria-expanded={open === section.name}
              aria-controls={open === section.name ? 'pn-flyout' : undefined}
              onClick={() => setOpen(open === section.name ? null : section.name)}
            >
              <span className="pn-rail-icon">{section.icon}</span>
              <span>{t(section.name)}</span>
            </button>
          );
        })}
      </nav>
      {openSection && (
        <nav id="pn-flyout" className="pn-flyout glass-float" aria-label={`${t(openSection.name)} pages`}>
          <h3>{t(openSection.name)}</h3>
          {openSection.items.map(item => {
            const current = item.href === location;
            return (
              <Link key={item.href} href={item.href} className={cn("pn-fly-link")} aria-current={current ? 'page' : undefined} onClick={() => setOpen(null)}>
                <span className="pn-fly-icon">{item.icon}</span>
                <span>{t(item.name)}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
