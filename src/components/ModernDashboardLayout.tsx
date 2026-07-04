'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Receipt, PlusCircle, Building2, Sun, Moon, Monitor,
  LogOut, Menu, ChevronLeft, ChevronRight, ChevronDown, X,
  Search, ClipboardList, BarChart2, TrendingUp,
  Users, CircleDollarSign, Inbox, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useColorMode } from '@/app/providers';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getDisplayRole } from '@/lib/roleDisplay';
import ImpersonationBanner from './ImpersonationBanner';
import PullToRefresh from './PullToRefresh';
import RoleSwitcher from './RoleSwitcher';

const SIDEBAR_WIDTH = 256;
const SIDEBAR_MINI_WIDTH = 60;

function getDeptNavLabel(role: string): string {
  if (role.includes('DENOMINATION')) return 'Oversights';
  if (role.includes('OVERSIGHT')) return 'Campuses';
  if (role.includes('CAMPUS')) return 'Streams';
  return 'Churches';
}

interface NavItem {
  text: string;
  icon: React.ElementType;
  path: string;
  show: boolean;
  badge: number;
}
interface NavSection {
  title: string | null;
  items: NavItem[];
}

interface SidebarBodyProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  setMobileOpen: (v: boolean) => void;
  navSections: NavSection[];
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
  colorMode: ReturnType<typeof useColorMode>;
  userName: string;
  userInitial: string;
  userImage: string | undefined;
  userRole: string;
  handleLogout: () => void;
}

function SidebarBody({
  isMobile, sidebarOpen, setSidebarOpen, setMobileOpen,
  navSections, isActive, navigate, colorMode,
  userName, userInitial, userImage, userRole, handleLogout,
}: SidebarBodyProps) {
  const showLabels = isMobile || sidebarOpen;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo row */}
      <div
        className={cn('flex items-center gap-2.5 px-3 py-3 shrink-0', !showLabels && 'justify-center')}
        style={isMobile ? { paddingTop: 'max(0.75rem, env(safe-area-inset-top))' } : undefined}
      >
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card overflow-hidden shrink-0">
          <Image src="/flc-logo.webp" alt="CI Office" width={20} height={20} />
        </div>
        {showLabels && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[0.9375rem] font-semibold tracking-tight text-foreground truncate">CI Office</span>
            <span className="text-[0.5625rem] font-semibold tracking-[0.18em] uppercase text-primary">Accounts</span>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn('ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors', !showLabels && 'hidden')}
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {!showLabels && !isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex justify-center p-1.5 mx-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {/* Search bar */}
      {showLabels && (
        <div className="px-2 pb-1 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent text-muted-foreground text-sm cursor-text"
            onClick={() => navigate('/search')}
          >
            <Search className="size-3.5 shrink-0" />
            <span className="truncate text-xs">Search…</span>
            <kbd className="ml-auto text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 hidden sm:inline">/</kbd>
          </div>
        </div>
      )}

      <Separator className="mx-2 w-auto mb-1" />

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5">
        {navSections.map((section, si) => {
          const visible = section.items.filter(i => i.show);
          if (!visible.length) return null;
          return (
            <div key={si} className="mb-1">
              {section.title && showLabels && (
                <p className={cn('px-2 pt-3 pb-1 text-[0.625rem] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60', si === 0 && 'pt-1')}>
                  {section.title}
                </p>
              )}
              {section.title && !showLabels && si > 0 && <Separator className="my-1.5" />}
              {visible.map((item) => {
                const active = isActive(item.path);
                const NavIcon = item.icon;
                const btn = (
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'flex items-center w-full rounded-lg transition-colors text-sm font-medium',
                      showLabels ? 'gap-2.5 px-2 py-1.5' : 'justify-center py-2',
                      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    <div className="relative shrink-0">
                      <NavIcon className={cn('size-[18px]', active && 'text-foreground')} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-4 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </div>
                    {showLabels && <span className={cn('truncate', active && 'font-semibold')}>{item.text}</span>}
                  </button>
                );
                return !showLabels ? (
                  <TooltipProvider key={item.path} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right">{item.text}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div key={item.path}>{btn}</div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <Separator className="mx-2 w-auto" />

      {/* Bottom user section */}
      <div className="p-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn('flex items-center w-full rounded-lg p-2 transition-colors hover:bg-accent', !showLabels && 'justify-center p-1.5')}>
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={userImage} />
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{userInitial}</AvatarFallback>
              </Avatar>
              {showLabels && (
                <>
                  <div className="ml-2 flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{userRole}</p>
                  </div>
                  <ChevronDown className="ml-1 size-4 text-muted-foreground shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={4}
            style={showLabels ? { width: sidebarOpen ? `${SIDEBAR_WIDTH - 24}px` : '200px' } : {}}
          >
            <DropdownMenuLabel className="font-normal pb-2">
              <div className="font-semibold text-foreground text-sm">{userName}</div>
              <div className="text-xs text-muted-foreground">{userRole}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
              <Avatar className="size-4">
                <AvatarImage src={userImage} />
                <AvatarFallback className="text-[9px]">{userInitial}</AvatarFallback>
              </Avatar>
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {([
              { label: 'Light mode', value: 'light', Icon: Sun },
              { label: 'Dark mode', value: 'dark', Icon: Moon },
              { label: 'System', value: 'system', Icon: Monitor },
            ] as const).map(({ label, value, Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => colorMode.setMode(value)}
                className={cn('gap-2', colorMode.mode === value && 'text-primary font-medium')}
              >
                <Icon className="size-4" />
                {label}
                {colorMode.mode === value && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function ModernDashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const colorMode = useColorMode();
  const [pendingCounts, setPendingCounts] = useState({ approvals: 0, transactions: 0, publicRequests: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (session?.user) {
      fetchPendingCounts();
      const interval = setInterval(fetchPendingCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchPendingCounts = async () => {
    try {
      const res = await fetch('/api/pending-counts');
      if (res.ok) setPendingCounts(await res.json());
    } catch {}
  };

  const normalizedRole = (session?.user?.role || '').toUpperCase();
  const normalizedRoles = (session?.user?.roles || []).map((r: string) => r.toUpperCase());
  const isSuperAdmin = normalizedRole === 'SUPERADMIN' || normalizedRoles.includes('SUPERADMIN');
  const leaderAndAdminRoles = [
    'DENOMINATION_ADMIN', 'DENOMINATION_LEADER',
    'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER',
    'CAMPUS_ADMIN', 'CAMPUS_LEADER',
    'STREAM_LEADER', 'COUNCIL_LEADER',
  ];
  const isLeaderOrAdmin = normalizedRole && leaderAndAdminRoles.includes(normalizedRole);
  const isAdmin = normalizedRole && normalizedRole.endsWith('_ADMIN');
  const isLeader = normalizedRole && normalizedRole.endsWith('_LEADER');
  const hasAnalytics = isAdmin || isSuperAdmin || ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER'].includes(normalizedRole);

  const isActive = (path: string) => {
    const clean = path.split('?')[0];
    if (clean === '/dashboard') return pathname === '/dashboard';
    if (clean === '/transactions') return pathname === '/transactions';
    return pathname === clean || pathname.startsWith(clean + '/');
  };

  const navSections: NavSection[] = [
    {
      title: null,
      items: [
        { text: 'Home', icon: Home, path: '/dashboard', show: true, badge: 0 },
        { text: 'Request Expense', icon: PlusCircle, path: '/transactions/new?type=EXPENSE', show: !isSuperAdmin && !!isLeader, badge: 0 },
        { text: 'Transaction History', icon: Receipt, path: '/transactions', show: true, badge: pendingCounts.transactions },
      ],
    },
    {
      title: 'Management',
      items: [
        { text: 'Approvals', icon: ClipboardList, path: '/approvals', show: !!(isAdmin || isSuperAdmin), badge: pendingCounts.approvals },
        { text: 'Public Requests', icon: Inbox, path: '/public-requests', show: normalizedRole === 'OVERSIGHT_ADMIN', badge: pendingCounts.publicRequests },
        { text: 'Users', icon: Users, path: '/users', show: !!(isAdmin || isSuperAdmin), badge: 0 },
        { text: getDeptNavLabel(normalizedRole), icon: Building2, path: '/departments', show: !!(isSuperAdmin || isLeaderOrAdmin), badge: 0 },
        { text: 'Currencies', icon: CircleDollarSign, path: '/currencies', show: !!(isSuperAdmin || normalizedRole === 'DENOMINATION_ADMIN'), badge: 0 },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { text: 'Reports', icon: BarChart2, path: '/reports', show: true, badge: 0 },
        { text: 'Analytics', icon: TrendingUp, path: '/analytics', show: !!hasAnalytics, badge: 0 },
      ],
    },
  ];

  const navigate = (path: string) => {
    setMobileOpen(false);
    router.push(path);
  };

  const handleLogout = () => {
    setMobileOpen(false);
    signOut({ callbackUrl: '/auth/login' });
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setMobileOpen(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const userName = session?.user?.name || 'User';
  const userInitial = userName[0]?.toUpperCase() || 'U';
  const userImage = session?.user?.image || undefined;
  const userRole = getDisplayRole(session?.user?.role);
  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_MINI_WIDTH;

  const sharedSidebarProps: Omit<SidebarBodyProps, 'isMobile'> = {
    sidebarOpen, setSidebarOpen, setMobileOpen,
    navSections, isActive, navigate, colorMode,
    userName, userInitial, userImage, userRole, handleLogout,
  };

  return (
    <TooltipProvider>
      <ImpersonationBanner />

      {/* Fixed top bar */}
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-3',
          'bg-background/80 backdrop-blur-xl backdrop-saturate-150 border-b border-border',
          'transition-[padding-left] duration-300 ease-in-out',
          sidebarOpen ? 'md:pl-[268px]' : 'md:pl-[72px]',
        )}
        style={{ height: 'calc(3.5rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Button variant="ghost" size="icon-sm" className="md:hidden shrink-0" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>

        <div className="hidden md:flex items-center gap-2 min-w-0" />

        {/* Center search — desktop */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search transactions, users, churches…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={cn(
                'w-full h-8 rounded-full bg-accent pl-8 pr-3 text-sm',
                'border border-transparent focus:border-border focus:bg-card',
                'placeholder:text-muted-foreground outline-none transition-all'
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto md:ml-0">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => router.push('/search')}>
            <Search className="size-4.5" />
          </Button>
          <RoleSwitcher />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-30',
          'bg-sidebar-background border-r border-sidebar-border',
          'transition-[width] duration-300 ease-in-out overflow-hidden'
        )}
        style={{ width: sidebarWidth }}
      >
        <SidebarBody isMobile={false} {...sharedSidebarProps} />
      </aside>

      {/* Mobile sidebar — sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar-background border-r border-sidebar-border [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarBody isMobile={true} {...sharedSidebarProps} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main
        className={cn(
          'min-h-screen bg-background transition-[padding-left] duration-300 ease-in-out',
          sidebarOpen ? 'md:pl-[256px]' : 'md:pl-[60px]',
        )}
        style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <PullToRefresh>
          <div className="px-4 py-4 md:px-6 md:py-5 max-w-[1600px] mx-auto">
            {children}
          </div>
        </PullToRefresh>
      </main>
    </TooltipProvider>
  );
}
