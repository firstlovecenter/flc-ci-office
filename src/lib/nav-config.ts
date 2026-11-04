import {
    BarChart2, Building2, ClipboardList, Home, Inbox, PlusCircle, Receipt,
    Settings, TrendingUp, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { Permissions } from '@/hooks/usePermissions';

/**
 * The app's navigation, as data. The sidebar, the mobile drawer and the ⌘K
 * palette all read this list, so who can see an item is declared once and
 * cannot drift between the three.
 */

export type NavArea = 'home' | 'money' | 'people' | 'insight';

/** Live counts the shell fetches from /api/pending-counts. */
export type NavBadgeKey = 'approvals' | 'transactions' | 'publicRequests';

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    area: NavArea;
    /** Visible when this returns true. Omitted = everyone signed in. */
    show?: (p: Permissions) => boolean;
    badge?: NavBadgeKey;
    /** Extra words the palette matches on. */
    keywords?: string[];
    /** Treat only an exact path match as active (e.g. /dashboard). */
    exact?: boolean;
}

export interface NavGroup {
    label: string | null;
    items: NavItem[];
}

export const NAV: NavGroup[] = [
    {
        label: null,
        items: [
            { name: 'Home', href: '/dashboard', icon: Home, area: 'home', exact: true, keywords: ['dashboard', 'overview'] },
            {
                name: 'Request withdrawal', href: '/transactions?new=expense', icon: PlusCircle, area: 'money',
                show: p => !p.isSuperAdmin && !!p.isLeader, keywords: ['expense', 'new', 'withdraw'],
            },
            { name: 'Transaction history', href: '/transactions', icon: Receipt, area: 'money', exact: true, badge: 'transactions', keywords: ['ledger', 'deposits', 'withdrawals', 'statement'] },
        ],
    },
    {
        label: 'Management',
        items: [
            { name: 'Approvals', href: '/approvals', icon: ClipboardList, area: 'money', show: p => p.canApprove, badge: 'approvals', keywords: ['pending', 'review', 'queue', 'decline'] },
            { name: 'Public requests', href: '/public-requests', icon: Inbox, area: 'money', show: p => p.role === 'CAMPUS_ADMIN', badge: 'publicRequests', keywords: ['form', 'external'] },
            { name: 'Users', href: '/users', icon: Users, area: 'people', show: p => p.canManageUsers, keywords: ['people', 'leaders', 'roles'] },
            { name: 'Churches', href: '/organisations', icon: Building2, area: 'people', show: p => p.canSeeChurches, keywords: ['campus', 'oversight', 'organisations'] },
            { name: 'Accounts', href: '/accounts', icon: Wallet, area: 'money', show: p => p.canSeeAccounts, keywords: ['bank', 'balances'] },
            { name: 'Settings', href: '/settings', icon: Settings, area: 'insight', show: p => p.canEditExpenseWindow, keywords: ['expense window', 'hours'] },
        ],
    },
    {
        label: 'Analytics',
        items: [
            { name: 'Reports', href: '/reports', icon: BarChart2, area: 'insight', keywords: ['pdf', 'export', 'statement'] },
            { name: 'Analytics', href: '/analytics', icon: TrendingUp, area: 'insight', show: p => p.canSeeAnalytics, keywords: ['charts', 'trends'] },
        ],
    },
];

/** The groups this person may see, with empty groups dropped. */
export function visibleNav(p: Permissions): NavGroup[] {
    return NAV
        .map(g => ({ ...g, items: g.items.filter(i => !i.show || i.show(p)) }))
        .filter(g => g.items.length > 0);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
    const path = item.href.split('?')[0];
    if (item.href.includes('?')) return false; // action links are never "where you are"
    if (item.exact) return pathname === path;
    return pathname === path || pathname.startsWith(path + '/');
}
