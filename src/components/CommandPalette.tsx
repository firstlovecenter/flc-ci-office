'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Building2, CornerDownLeft, Loader2, Receipt, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { visibleNav } from '@/lib/nav-config';

/**
 * ⌘K / Ctrl+K (or "/"): jump to a page, or find a user, church or
 * transaction by name. Pages come from nav-config, so the palette never
 * offers a page the sidebar hides. Records come from /api/search, which is
 * already scoped to the viewer's churches.
 */

interface PaletteCtx { open: () => void }
const Ctx = createContext<PaletteCtx>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

const noopSubscribe = () => () => {};
export function useShortcutLabel() {
    return useSyncExternalStore(
        noopSubscribe,
        () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'),
        () => 'Ctrl K',
    );
}

interface SearchResult {
    type: 'user' | 'organisation' | 'transaction';
    id: string;
    title: string;
    subtitle?: string;
    url: string;
}

interface Row {
    key: string;
    group: string;
    label: string;
    hint?: string;
    icon: React.ElementType;
    href: string;
}

const RECORD_GROUP: Record<SearchResult['type'], { group: string; icon: React.ElementType }> = {
    user: { group: 'People', icon: User },
    organisation: { group: 'Churches', icon: Building2 },
    transaction: { group: 'Transactions', icon: Receipt },
};

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setOpen] = useState(false);
    const open = useCallback(() => setOpen(true), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLElement &&
                (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
            if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(o => !o);
            } else if (e.key === '/' && !typing) {
                e.preventDefault();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <Ctx.Provider value={{ open }}>
            {children}
            <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
                {isOpen && <PaletteBody close={() => setOpen(false)} />}
            </DialogPrimitive.Root>
        </Ctx.Provider>
    );
}

function PaletteBody({ close }: { close: () => void }) {
    const router = useRouter();
    const perms = usePermissions();
    const [query, setQuery] = useState('');
    const [records, setRecords] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Debounced record search; stale responses are dropped.
    const onQuery = (value: string) => {
        setQuery(value);
        setActive(0);
        const q = value.trim();
        setSearching(q.length >= 2);
        if (q.length < 2) setRecords([]);
    };
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) return;
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
                const d = r.ok ? await r.json() : { results: [] };
                setRecords(d.results ?? []);
                setActive(0);
            } catch { /* aborted or offline */ }
            finally { if (!ctrl.signal.aborted) setSearching(false); }
        }, 200);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [query]);

    const rows = useMemo<Row[]>(() => {
        const q = query.trim().toLowerCase();
        const pages: Row[] = visibleNav(perms).flatMap(g => g.items)
            .filter(i => !q || [i.name, ...(i.keywords ?? [])].some(w => w.toLowerCase().includes(q)))
            .map(i => ({ key: `nav:${i.href}`, group: 'Go to', label: i.name, icon: i.icon, href: i.href }));
        const found: Row[] = records.map(r => ({
            key: `${r.type}:${r.id}`,
            group: RECORD_GROUP[r.type]?.group ?? 'Results',
            label: r.title,
            // Church levels arrive as enums ("CAMPUS"); never show those raw.
            hint: r.type === 'organisation' && r.subtitle && /^[A-Z_]+$/.test(r.subtitle)
                ? r.subtitle.charAt(0) + r.subtitle.slice(1).toLowerCase().replace(/_/g, ' ')
                : r.subtitle,
            icon: RECORD_GROUP[r.type]?.icon ?? ArrowRight,
            href: r.url,
        }));
        const all = [...pages, ...found];
        if (q.length >= 2) all.push({ key: 'all', group: 'More', label: `See all results for “${query.trim()}”`, icon: Search, href: `/search?q=${encodeURIComponent(query.trim())}` });
        return all;
    }, [query, records, perms]);

    const go = (row: Row | undefined) => {
        if (!row) return;
        close();
        router.push(row.href);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); go(rows[active]); }
    };

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    let lastGroup = '';
    return (
        <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    onKeyDown={onKeyDown}
                    className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
                >
                    <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">Jump to a page, or find a person, church or transaction.</DialogPrimitive.Description>
                    <div className="flex items-center gap-3 border-b border-border px-4">
                        {searching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <input
                            autoFocus
                            value={query}
                            onChange={e => onQuery(e.target.value)}
                            placeholder="Search pages, people, churches, transactions…"
                            aria-label="Search"
                            role="combobox"
                            aria-expanded
                            aria-controls="palette-list"
                            aria-activedescendant={rows[active] ? `palette-${active}` : undefined}
                            className="h-14 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
                        />
                        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
                    </div>
                    <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                        {rows.length === 0 && !searching && (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                Nothing matches “{query}”. Try a name, a church, or part of a description.
                            </p>
                        )}
                        {rows.map((row, i) => {
                            const header = row.group !== lastGroup ? row.group : null;
                            lastGroup = row.group;
                            const Icon = row.icon;
                            return (
                                <React.Fragment key={row.key}>
                                    {header && <p className="px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:pt-1">{header}</p>}
                                    <button
                                        id={`palette-${i}`}
                                        data-index={i}
                                        role="option"
                                        aria-selected={i === active}
                                        onMouseMove={() => setActive(i)}
                                        onClick={() => go(row)}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                                            i === active ? 'bg-accent text-foreground' : 'text-foreground/90',
                                        )}
                                    >
                                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', i === active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">{row.label}</span>
                                            {row.hint && <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>}
                                        </span>
                                        {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                        <span><kbd className="font-mono">↑↓</kbd> move</span>
                        <span><kbd className="font-mono">↵</kbd> open</span>
                        <span className="ml-auto">Results only include churches you oversee</span>
                    </div>
                </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}
