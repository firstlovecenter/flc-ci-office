'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { formatMoney } from '@/lib/format-money';
import { getDisplayRole } from '@/lib/roleDisplay';
import {
    TrendingUp, TrendingDown, Wallet, PlusCircle, Receipt, Building2,
    Users, Coins, Clock, ChevronRight, ChevronLeft,
    ShieldCheck, AlertCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useColorMode } from '@/app/providers';
import { getExpenseWindowStatus, getMsUntilExpenseWindowOpens } from '@/lib/expense-window';

// ── Animated counter ──────────────────────────────────────────────────────────

function useAnimatedValue(target: number, duration = 800) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        let startTime: number;
        let id: number;
        const animate = (ts: number) => {
            if (!startTime) startTime = ts;
            const p = Math.min((ts - startTime) / duration, 1);
            setValue((1 - Math.pow(1 - p, 3)) * target);
            if (p < 1) id = requestAnimationFrame(animate);
        };
        id = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(id);
    }, [target, duration]);
    return value;
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function MinimalStatCard({ title, amount, icon: Icon, color, isBlinking, onClick }: {
    title: string;
    amount: number | string;
    icon: React.ElementType;
    color?: string;
    isBlinking?: boolean;
    onClick?: () => void;
}) {
    const animated = useAnimatedValue(Number(amount) || 0);
    return (
        <div
            onClick={onClick}
            className={cn(
                'p-3 sm:p-4 h-full rounded-2xl bg-card border border-border flex items-center gap-2.5 sm:gap-4 transition-all duration-200 overflow-hidden',
                onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                isBlinking && 'ring-2 ring-destructive/25',
            )}
        >
            <div
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: color ? `${color}1A` : 'rgba(107,114,128,0.1)', color: color || 'var(--muted-foreground)' }}
            >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] sm:text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-0.5 leading-tight break-words">
                    {title}
                </p>
                <p className="text-[1.375rem] sm:text-[1.625rem] font-bold text-foreground leading-none tabular-nums">
                    {Math.round(animated).toLocaleString('en-US')}
                </p>
            </div>
        </div>
    );
}

function RegularStatCard({ title, amount, icon: Icon, color, currencySymbol, isBlinking }: {
    title: string;
    amount: number | string;
    icon: React.ElementType;
    color: string;
    currencySymbol?: string;
    isBlinking?: boolean;
}) {
    const animated = useAnimatedValue(Number(amount) || 0);
    const display = currencySymbol
        ? formatMoney(animated)
        : Math.round(animated).toLocaleString('en-US');
    return (
        <div className={cn(
            'relative p-5 sm:p-6 h-full rounded-[14px] bg-card border border-border',
            'flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5',
            isBlinking && 'ring-2 ring-destructive/25',
        )}>
            <div
                className="absolute top-4 bottom-4 left-0 w-0.5 rounded-full"
                style={{ backgroundColor: color, opacity: isBlinking ? 0.8 : 0.35 }}
            />
            <div className="min-w-0 flex-1 pl-2">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">
                    {title}
                </p>
                <div className="flex items-baseline gap-1 flex-wrap">
                    {currencySymbol && (
                        <span className="text-[0.95rem] font-medium text-muted-foreground">{currencySymbol}</span>
                    )}
                    <span className="text-[1.625rem] sm:text-[1.875rem] font-medium tracking-[-0.02em] text-foreground tabular-nums leading-none">
                        {display}
                    </span>
                </div>
            </div>
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1A`, color }}
            >
                <Icon className="h-5 w-5" />
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [stats, setStats] = useState<{
        income: string;
        expense: string;
        balance: string;
        weeklyIncome: string;
        chartData: { week: string; income: string; expense: string }[];
        superAdminStats: undefined | {
            users: number;
            departments: number;
            transactions: number;
            pendingApprovals: number;
            activeDepartments: number;
            activeCurrencies: number;
            todaysLogins: number;
            criticalErrors: number;
        };
    }>({ income: '0', expense: '0', balance: '0', weeklyIncome: '0', chartData: [], superAdminStats: undefined });

    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentLeader, setDepartmentLeader] = useState<{ name: string; image: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartOffset, setChartOffset] = useState(0);
    const [chartLoading, setChartLoading] = useState(false);
    const chartCache = useRef<Map<number, { week: string; income: string; expense: string }[]>>(new Map());
    const { data: session } = useSession();
    const router = useRouter();
    const { resolvedMode } = useColorMode();
    const isDark = resolvedMode === 'dark';

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

    const fetchBaseCurrency = useCallback(async () => {
        try {
            const res = await fetch('/api/users/me');
            if (!res.ok) return;
            const userData = await res.json();
            if (userData.baseCurrency) {
                setBaseCurrency({ code: userData.baseCurrency.code, symbol: userData.baseCurrency.symbol });
            }
            if (userData.department) {
                try {
                    const deptRes = await fetch(`/api/departments/${userData.department.id}`);
                    if (deptRes.ok) {
                        const deptData = await deptRes.json();
                        const leaderRole = deptData.userRoles?.find((ur: any) =>
                            ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'].includes(ur.role)
                        );
                        if (leaderRole?.user) setDepartmentLeader(leaderRole.user);
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }, []);

    const fetchStats = useCallback(async (offset?: number) => {
        const currentOffset = offset ?? chartOffset;
        const cached = chartCache.current.get(currentOffset);
        if (cached) {
            setStats(prev => ({ ...prev, chartData: cached }));
        } else {
            setChartLoading(true);
        }
        try {
            const res = await fetch(`/api/dashboard/stats?chartOffset=${currentOffset}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.chartData) chartCache.current.set(currentOffset, data.chartData);
                setStats(data);
            }
        } catch { /* ignore */ }
        finally {
            setLoading(false);
            setChartLoading(false);
        }
    }, [chartOffset]);

    useEffect(() => {
        fetchBaseCurrency();
        fetchStats();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchBaseCurrency();
                fetchStats();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchBaseCurrency, fetchStats]);

    useEffect(() => { fetchStats(chartOffset); }, [chartOffset]);

    // ── Quick links ──────────────────────────────────────────────────────────
    const quickLinks = useMemo(() => {
        const userRole = session?.user?.role as Role;
        const leaderRoles = [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
        const isLeader = userRole && leaderRoles.includes(userRole);

        const all = [
            {
                title: 'Request Expense', icon: Clock, href: '/transactions/new?type=EXPENSE',
                color: '#EF4444',
                roles: [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[],
            },
            {
                title: 'New Transaction', icon: PlusCircle, href: '/transactions/new',
                color: '#22C55E', roles: null as Role[] | null, excludeForLeaders: true,
            },
            {
                title: 'Transactions History', icon: Receipt, href: '/transactions',
                color: '#3B82F6', roles: null as Role[] | null,
            },
            {
                title: 'Churches', icon: Building2, href: '/departments',
                color: '#F59E0B', roles: null as Role[] | null, excludeForLeaders: true,
            },
        ];

        return all.filter(link => {
            if (link.roles && !link.roles.includes(userRole)) return false;
            if (isLeader && (link as any).excludeForLeaders) return false;
            return true;
        });
    }, [session?.user?.role]);

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <>
                <div className="mb-6">
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-5 w-72" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-2xl bg-card border border-border p-6">
                            <Skeleton className="h-4 w-24 mb-3" />
                            <Skeleton className="h-8 w-32" />
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl bg-card border border-border p-6">
                    <Skeleton className="h-5 w-48 mb-4" />
                    <Skeleton className="h-[280px] w-full rounded-lg" />
                </div>
            </>
        );
    }

    // ── Computed values ──────────────────────────────────────────────────────
    const userRole = session?.user?.role as Role;
    const leaderRoles = [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
    const isLeader = userRole && leaderRoles.includes(userRole);

    const getStatColor = (type: string, balance?: number | string): string => {
        const b = balance !== undefined ? Number(balance) : undefined;
        if (type === 'balance') {
            if (b !== undefined && b < 0) return '#EF4444';
            if (b !== undefined && b === 0) return '#F59E0B';
            if (b !== undefined && b < 5000) return '#D97706';
            return '#22C55E';
        }
        if (type === 'income') return '#22C55E';
        if (type === 'expense') return '#EF4444';
        if (type === 'weeklyIncome') return '#3B82F6';
        return '#6B7280';
    };

    const statCards = isSuperAdmin && stats.superAdminStats ? [
        { title: 'Total Users', amount: stats.superAdminStats.users, icon: Users, color: '#6B7280', isBlinking: false },
        { title: 'Total Departments', amount: stats.superAdminStats.departments, icon: Building2, color: '#F59E0B', isBlinking: false },
        { title: 'Total Transactions', amount: stats.superAdminStats.transactions, icon: Receipt, color: '#3B82F6', isBlinking: false },
        { title: 'Pending Approvals', amount: stats.superAdminStats.pendingApprovals, icon: Clock, color: '#EF4444', isBlinking: stats.superAdminStats.pendingApprovals > 0 },
        { title: "Today's Logins", amount: stats.superAdminStats.todaysLogins, icon: ShieldCheck, color: '#22C55E', isBlinking: false },
        { title: 'Active Currencies', amount: stats.superAdminStats.activeCurrencies, icon: Coins, color: '#6B7280', isBlinking: false },
        { title: 'Critical Errors (Today)', amount: stats.superAdminStats.criticalErrors, icon: AlertCircle, color: '#DC2626', isBlinking: stats.superAdminStats.criticalErrors > 0 },
        { title: 'Active Departments', amount: stats.superAdminStats.activeDepartments, icon: Building2, color: '#6B7280', isBlinking: false },
    ] : isLeader ? [
        { title: 'Account Balance', amount: stats.balance || 0, icon: Wallet, color: getStatColor('balance', stats.balance), isBlinking: Number(stats.balance || 0) < 5000 },
        { title: "This Week's Income", amount: stats.weeklyIncome || 0, icon: TrendingUp, color: getStatColor('weeklyIncome'), isBlinking: false },
    ] : [
        { title: 'Account Balance', amount: stats.balance || 0, icon: Wallet, color: getStatColor('balance', stats.balance), isBlinking: Number(stats.balance || 0) < 5000 },
        { title: 'Total Inflows', amount: stats.income || 0, icon: TrendingUp, color: getStatColor('income'), isBlinking: false },
        { title: 'Total Expenses', amount: stats.expense || 0, icon: TrendingDown, color: getStatColor('expense'), isBlinking: false },
        { title: "This Week's Income", amount: stats.weeklyIncome || 0, icon: TrendingUp, color: getStatColor('weeklyIncome'), isBlinking: false },
    ];

    // Recharts colors based on resolved mode
    const chartColors = {
        tickFill: isDark ? '#9AA3B1' : '#6B7280',
        axisStroke: isDark ? '#2A2D31' : '#E2E6EB',
        tooltipBg: isDark ? '#16181C' : '#FCFDFE',
        tooltipBorder: isDark ? '#2A2D31' : '#E2E6EB',
        labelFill: isDark ? '#F1F4F7' : '#161A1F',
        cursorFill: isDark ? 'rgba(241,244,247,0.04)' : 'rgba(22,26,31,0.04)',
    };

    const getAdminRoute = (title: string) => {
        switch (title) {
            case 'Total Users': return '/users';
            case 'Total Departments': return '/departments';
            case 'Total Transactions': return '/transactions';
            case 'Pending Approvals': return '/approvals';
            case "Today's Logins": return '/audit';
            case 'Active Currencies': return '/currencies';
            case 'Critical Errors (Today)': return '/audit';
            case 'Active Departments': return '/departments';
            default: return undefined;
        }
    };

    return (
        <>

            {/* Header */}
            <div className="mb-8 pb-6 border-b border-border flex items-start sm:items-end justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                    {isSuperAdmin ? (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                            <Building2 className="h-6 w-6" />
                        </div>
                    ) : departmentLeader ? (
                        <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border border-border shrink-0">
                            {departmentLeader.image && <AvatarImage src={departmentLeader.image} alt={departmentLeader.name} />}
                            <AvatarFallback className="text-xl">{departmentLeader.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-foreground/5 text-foreground">
                            <Wallet className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-1">
                            {isSuperAdmin ? 'Administration' : isLeader ? 'Leader overview' : 'Account overview'}
                        </p>
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <h1 className="text-[1.625rem] sm:text-[1.875rem] md:text-[2.25rem] font-medium tracking-[-0.02em] leading-[1.15] text-foreground">
                                {isSuperAdmin
                                    ? 'System management'
                                    : session?.user?.departmentName && session?.user?.departmentLevel
                                        ? `${session.user.departmentName} ${session.user.departmentLevel}`
                                        : session?.user?.departmentName || 'Dashboard'}
                            </h1>
                            {session?.user?.role && (
                                <Badge variant="outline" className="text-[0.625rem] uppercase tracking-[0.10em] font-medium h-[22px]">
                                    {getDisplayRole(session.user.role)}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 max-w-[580px]">
                            {isSuperAdmin
                                ? 'Manage every part of the system from one place.'
                                : departmentLeader
                                    ? `Led by ${departmentLeader.name}`
                                    : "Here's what's happening with your finances today."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className={cn(
                'grid gap-4 mb-8',
                isSuperAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2',
            )}>
                {statCards.map((card, i) => {
                    const route = isSuperAdmin ? getAdminRoute(card.title) : undefined;
                    return (
                        <div key={i}>
                            {isSuperAdmin ? (
                                <MinimalStatCard
                                    title={card.title}
                                    amount={card.amount}
                                    icon={card.icon}
                                    color={card.color}
                                    isBlinking={card.isBlinking}
                                    onClick={route ? () => router.push(route) : undefined}
                                />
                            ) : (
                                <RegularStatCard
                                    title={card.title}
                                    amount={card.amount}
                                    icon={card.icon}
                                    color={card.color}
                                    currencySymbol={baseCurrency?.symbol}
                                    isBlinking={card.isBlinking}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Cash flow chart */}
            {stats.chartData && stats.chartData.length > 0 && (
                <div className="rounded-[14px] bg-card border border-border p-5 sm:p-8 mt-4 md:mt-0">
                    <div className="mb-5">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-1">
                            Cash flow
                        </p>
                        <h2 className="text-[1.0625rem] sm:text-[1.25rem] font-medium tracking-[-0.015em] text-foreground">
                            {chartOffset === 0 ? 'Weekly income & expense, last 4 weeks' : 'Weekly income & expense'}
                        </h2>
                    </div>

                    <div
                        className="w-full transition-opacity duration-200"
                        style={{ height: 'clamp(280px, 35vw, 350px)', opacity: chartLoading ? 0.5 : 1 }}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.chartData}
                                margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
                                style={{ backgroundColor: 'transparent' }}
                            >
                                <XAxis
                                    dataKey="week"
                                    tick={{ fill: chartColors.tickFill, fontSize: 12 }}
                                    axisLine={{ stroke: chartColors.axisStroke }}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => {
                                        const label = name === 'income' ? 'Income' : name === 'expense' ? 'Expense' : name;
                                        const formatted = baseCurrency
                                            ? `${baseCurrency.symbol}${formatMoney(value)}`
                                            : formatMoney(value);
                                        return [formatted, label];
                                    }}
                                    contentStyle={{
                                        backgroundColor: chartColors.tooltipBg,
                                        border: `1px solid ${chartColors.tooltipBorder}`,
                                        borderRadius: 10,
                                        boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.55)' : '0 16px 40px rgba(20,17,15,0.08)',
                                        fontSize: '0.8125rem',
                                    }}
                                    labelStyle={{
                                        color: chartColors.labelFill,
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        marginBottom: 4,
                                    }}
                                    cursor={{ fill: chartColors.cursorFill, radius: 4 } as any}
                                />
                                <Bar dataKey="income" radius={[6, 6, 0, 0] as any} barSize={35} fill="#22C55E">
                                    <LabelList
                                        dataKey="income"
                                        position="top"
                                        fill={chartColors.labelFill}
                                        fontSize={11}
                                        formatter={(v: any) => baseCurrency ? `${baseCurrency.symbol}${Number(v).toLocaleString()}` : Number(v).toLocaleString()}
                                    />
                                </Bar>
                                <Bar dataKey="expense" radius={[6, 6, 0, 0] as any} barSize={35} fill="#EF4444">
                                    <LabelList
                                        dataKey="expense"
                                        position="top"
                                        fill={chartColors.labelFill}
                                        fontSize={11}
                                        formatter={(v: any) => baseCurrency ? `${baseCurrency.symbol}${Number(v).toLocaleString()}` : Number(v).toLocaleString()}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Chart navigation */}
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setChartOffset(p => p + 1)}
                            disabled={chartLoading}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground min-w-[100px] text-center">
                            {chartOffset === 0 ? 'Current' : `${chartOffset * 4} weeks ago`}
                        </span>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setChartOffset(p => Math.max(0, p - 1))}
                            disabled={chartOffset === 0 || chartLoading}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick links — hidden for SuperAdmin */}
            {!isSuperAdmin && (
                <div className="mt-8 flex flex-col gap-3">
                    {/* Time window banner for leaders */}
                    {isLeader && (() => {
                        const win = getExpenseWindowStatus();
                        const hoursUntilOpen = win.isOpen ? 0 : Math.ceil(getMsUntilExpenseWindowOpens(win.now) / (1000 * 60 * 60));
                        return (
                            <div className={cn(
                                'px-3 py-2.5 rounded-xl flex items-center gap-2',
                                win.isOpen
                                    ? 'bg-success/8 border border-success/25'
                                    : 'bg-warning/8 border border-warning/25',
                            )}>
                                <div className={cn(
                                    'w-2 h-2 rounded-full shrink-0',
                                    win.isOpen ? 'bg-success animate-pulse' : 'bg-warning',
                                )} />
                                <span className={cn(
                                    'text-xs font-semibold',
                                    win.isOpen ? 'text-success' : 'text-warning',
                                )}>
                                    {win.isOpen
                                        ? 'Expense submissions open · Closes at 3:00 PM'
                                        : win.isSunday
                                            ? 'Submissions closed on Sundays · Opens Monday 6:00 AM'
                                            : `Submissions closed · Opens at 6:00 AM (in ~${hoursUntilOpen}h)`}
                                </span>
                            </div>
                        );
                    })()}

                    {quickLinks.map(link => (
                        <div
                            key={link.title}
                            onClick={() => router.push(link.href)}
                            className="group rounded-xl border border-border bg-card cursor-pointer transition-colors duration-150 hover:bg-foreground/[0.02]"
                            style={{ '--hover-border': link.color } as React.CSSProperties}
                        >
                            <div className="px-4 py-3.5 flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-[7px] flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${link.color}14`, color: link.color }}
                                >
                                    <link.icon className="h-[18px] w-[18px]" />
                                </div>
                                <span className="text-[0.9375rem] font-medium text-foreground tracking-[-0.005em]">
                                    {link.title}
                                </span>
                                <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-foreground" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
