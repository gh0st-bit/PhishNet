import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTenantPreferences } from "@/hooks/use-tenant-preferences";
import { useNavigation } from "./navigation";

/** "Search or jump to…" palette. Lists only pages the signed-in role can already open. */
export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { sections } = useNavigation();
  const { t } = useTenantPreferences();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const pages = useMemo(() => {
    const seen = new Set<string>();
    return sections.flatMap(section => section.items.map(item => ({ ...item, section: section.name })))
      .filter(page => !seen.has(page.href) && seen.add(page.href));
  }, [sections]);
  const q = query.trim().toLowerCase();
  const results = q ? pages.filter(page => t(page.name).toLowerCase().includes(q) || t(page.section).toLowerCase().includes(q)) : pages;

  const close = (next: boolean) => { onOpenChange(next); if (!next) { setQuery(""); setActive(0); } };
  const go = (href: string) => { close(false); navigate(href); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="pn-palette top-[12vh] translate-y-0 max-w-[560px] p-3 gap-0">
        <DialogTitle className="sr-only">Jump to a page</DialogTitle>
        <DialogDescription className="sr-only">Type to filter pages, use the arrow keys to choose, and press Enter to open.</DialogDescription>
        <input
          autoFocus
          value={query}
          placeholder="Jump to a page…"
          aria-label="Jump to a page"
          aria-controls="pn-palette-results"
          aria-activedescendant={results[active] ? `pn-palette-${active}` : undefined}
          className="pn-palette-input"
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            else if (event.key === "Enter" && results[active]) { event.preventDefault(); go(results[active].href); }
          }}
        />
        <div id="pn-palette-results" role="listbox" aria-label="Pages" className="pn-palette-list">
          {results.map((page, index) => (
            <button
              key={page.href}
              id={`pn-palette-${index}`}
              type="button"
              role="option"
              aria-selected={index === active}
              className="pn-palette-item"
              onMouseEnter={() => setActive(index)}
              onClick={() => go(page.href)}
            >
              <span>{t(page.name)}</span>
              <span className="text-muted-foreground">{t(page.section)}</span>
            </button>
          ))}
          {!results.length && <p className="px-3 py-4 text-sm text-muted-foreground">No matching pages.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
