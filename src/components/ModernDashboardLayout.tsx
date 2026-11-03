'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  Sun, Moon, Monitor, LogOut, Menu, ChevronsUpDown, PanelLeftClose, PanelLeft, Search, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useColorMode } from '@/app/providers';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ImpersonationBanner from './ImpersonationBanner';
import PullToRefresh from './PullToRefresh';
import RoleSwitcher from './RoleSwitcher';
import { CommandPaletteProvider, useCommandPalette, useShortcutLabel } from './CommandPalette';
import { useWithdrawalEligibility, resetWithdrawalEligibility } from '@/hooks/useWithdrawalEligibility';
import { usePermissions } from '@/hooks/usePermissions';
import { isNavItemActive, visibleNav, type NavBadgeKey, type NavItem } from '@/lib/nav-config';
import { PENDING_COUNTS_EVENT } from '@/lib/pending-counts';

type PendingCounts = Record<NavBadgeKey, number>;

/* ── Collapse state, remembered on this device ─────────────────── */
const COLLAPSE_KEY = 'ci-sidebar-collapsed';
const collapseListeners = new Set<() => void>();
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; } };
const subscribeCollapsed = (l: () => void) => { collapseListeners.add(l); return () => { collapseListeners.delete(l); }; };
function useCollapsed(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const set = useCallback((v: boolean) => {
    try { localStorage.setItem(COLLAPSE_KEY, String(v)); } catch { /* storage unavailable */ }
    collapseListeners.forEach(l => l());
  }, []);
  return [value, set];
}

/* ── Pieces ────────────────────────────────────────────────────── */
function NavLink({ item, active, collapsed, badge, disabledReason, onClick }: {
  item: NavItem; active: boolean; collapsed: boolean; badge: number;
  disabledReason?: string | null; onClick?: () => void;
}) {
  const Icon = item.icon;
  const disabled = !!disabledReason;
  const cls = cn(
    'group relative flex h-10 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors',
    disabled
      ? 'cursor-not-allowed text-muted-foreground/50'
      : active
        ? 'bg-foreground text-background shadow-xs'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    collapsed && 'mx-auto w-10 justify-center px-0',
  );
  const inner = (
    <>
      <span className="relative shrink-0">
        <Icon className={cn('size-[18px]', !active && !disabled && 'opacity-80 group-hover:opacity-100')} />
        {collapsed && badge > 0 && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-sidebar-background" />}
      </span>
      {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
      {!collapsed && badge > 0 && (
        <span className={cn(
          'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums',
          active ? 'bg-background/20 text-background' : 'bg-primary text-primary-foreground',
        )}>{badge > 99 ? '99+' : badge}</span>
      )}
      {!collapsed && active && badge === 0 && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />}
    </>
  );
  const el = disabled
    ? <span aria-disabled className={cls}>{inner}</span>
    : <Link href={item.href} onClick={onClick} aria-current={active ? 'page' : undefined} className={cls}>{inner}</Link>;
  const tip = collapsed ? item.name : disabledReason;
  if (!tip) return el;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="block">{el}</span></TooltipTrigger>
      <TooltipContent side="right">{collapsed && disabledReason ? `${item.name} — ${disabledReason}` : tip}</TooltipContent>
    </Tooltip>
  );
}

function SearchButton({ collapsed, onOpen }: { collapsed: boolean; onOpen: () => void }) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search pages and records"
      title={`Search (${shortcut})`}
      className={cn(
        'flex h-10 w-full items-center gap-3 rounded-full border border-sidebar-border bg-background/60 px-3.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        collapsed && 'mx-auto w-10 justify-center px-0',
      )}
    >
      <Search className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md border border-sidebar-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium">{shortcut}</kbd>
        </>
      )}
    </button>
  );
}

function AccountMenu({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { data: session } = useSession();
  const colorMode = useColorMode();
  const name = session?.user?.name || 'User';
  const initial = name[0]?.toUpperCase() || 'U';
  const image = session?.user?.image || undefined;
  const subtitle = session?.user?.organisationName || '';

  const logout = () => {
    onNavigate?.();
    resetWithdrawalEligibility();
    signOut({ callbackUrl: '/auth/login' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn('flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition-colors hover:bg-accent', collapsed && 'justify-center p-1.5')}>
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={image} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initial}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-foreground">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="pb-2 font-normal">
          <div className="text-sm font-semibold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/profile" onClick={onNavigate}><UserCircle className="size-4" />Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {([
          { label: 'Light', value: 'light', Icon: Sun },
          { label: 'Dark', value: 'dark', Icon: Moon },
          { label: 'System', value: 'system', Icon: Monitor },
        ] as const).map(({ label, value, Icon }) => (
          <DropdownMenuItem key={value} onClick={() => colorMode.setMode(value)} className={cn('gap-2', colorMode.mode === value && 'font-medium text-primary')}>
            <Icon className="size-4" />{label}
            {colorMode.mode === value && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="size-4" />Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ collapsed, counts, onToggle, onNavigate, floating }: {
  collapsed: boolean; counts: PendingCounts; floating: boolean;
  onToggle?: () => void; onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const perms = usePermissions();
  const palette = useCommandPalette();
  const eligibility = useWithdrawalEligibility();
  const groups = visibleNav(perms);

  return (
    <div className={cn(
      'flex h-full flex-col bg-sidebar-background',
      floating && 'overflow-hidden rounded-[1.75rem] border border-sidebar-border shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-20px_rgb(0_0_0/0.18)]',
    )}>
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 px-4 pb-3 pt-4', collapsed && 'flex-col px-2')}>
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
          <Image src="/flc-logo.webp" alt="" width={22} height={22} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[0.9375rem] font-semibold tracking-tight text-foreground">CI Office</p>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-primary">Accounts</p>
          </div>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <SearchButton collapsed={collapsed} onOpen={() => { onNavigate?.(); palette.open(); }} />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-2">
        {groups.map((g, gi) => (
          <div key={g.label ?? gi} className="space-y-1">
            {g.label && !collapsed && (
              <p className="px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{g.label}</p>
            )}
            {g.label && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />}
            {g.items.map(item => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isNavItemActive(item, pathname)}
                badge={item.badge ? counts[item.badge] ?? 0 : 0}
                disabledReason={item.href.startsWith('/transactions?new=') && !eligibility.loading && !eligibility.canSubmit ? (eligibility.reason || 'Not available right now') : null}
                onClick={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const palette = useCommandPalette();
  const [collapsed, setCollapsed] = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<PendingCounts>({ approvals: 0, transactions: 0, publicRequests: 0 });

  useEffect(() => {
    if (!session?.user) return;
    const load = async () => {
      try {
        const r = await fetch('/api/pending-counts');
        if (r.ok) setCounts(await r.json());
      } catch { /* offline — keep the last counts */ }
    };
    load();
    const id = setInterval(load, 60000);
    // Pages announce changes (a decision, a new request) so badges don't lag.
    window.addEventListener(PENDING_COUNTS_EVENT, load);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(id);
      window.removeEventListener(PENDING_COUNTS_EVENT, load);
      window.removeEventListener('focus', load);
    };
  }, [session]);

  return (
    <TooltipProvider delayDuration={0}>
      <ImpersonationBanner />

      {/* Desktop: floating sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-30 hidden h-screen p-3 pr-0 transition-[width] duration-200 ease-out md:block',
        collapsed ? 'w-[84px]' : 'w-[272px]',
      )}>
        <SidebarBody collapsed={collapsed} counts={counts} floating onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {/* Mobile: drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-r-0 bg-sidebar-background p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody collapsed={false} counts={counts} floating={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn('min-h-screen bg-background transition-[padding] duration-200 ease-out', collapsed ? 'md:pl-[84px]' : 'md:pl-[272px]')}>
        {/* Header: menu + search on mobile, role switcher everywhere */}
        <header
          className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-background/80 px-4 backdrop-blur-xl md:px-6 lg:px-8"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={palette.open} aria-label="Search">
              <Search className="size-[18px]" />
            </Button>
            <RoleSwitcher />
          </div>
        </header>

        <main>
          <PullToRefresh>
            <div className="mx-auto max-w-[1600px] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 md:px-6 lg:px-8">
              {children}
            </div>
          </PullToRefresh>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default function ModernDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <Shell>{children}</Shell>
    </CommandPaletteProvider>
  );
}
