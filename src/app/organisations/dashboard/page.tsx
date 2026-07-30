'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, formatCurrency } from '@/lib/utils';
import { isBankAccount } from '@/lib/org-model';
import { useColorMode } from '@/app/providers';
import EditOrganisationDialog from '@/components/EditOrganisationDialog';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

function StatCard({ title, amount, currencySymbol, colorClass }: {
    title: string; amount: number; currencySymbol: string; colorClass: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.07em] text-muted-foreground mb-2">{title}</p>
            <p className={cn('text-[1.375rem] font-bold tracking-tight', colorClass)}>
                {currencySymbol}{Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
    );
}

export default function OrganisationDashboardPage() {
    const router = useRouter();
    const { resolvedMode } = useColorMode();
    const { data: session } = useSession();

    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [organisation, setOrganisation] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [allOrganisations, setAllOrganisations] = useState<any[]>([]);
    const [organisationLeader, setOrganisationLeader] = useState<{ name: string; image: string | null } | null>(null);
    const [stats, setStats] = useState({
        income: 0, expense: 0, balance: 0, weeklyIncome: 0,
        chartData: [] as { week: string; income: number; expense: number }[],
        currency: { code: 'GHS', symbol: '₵' },
    });
    const [loading, setLoading] = useState(true);
    const [chartOffset, setChartOffset] = useState(0);
    const [chartLoading, setChartLoading] = useState(false);
    const chartCache = useRef<Map<number, { week: string; income: number; expense: number }[]>>(new Map());

    useEffect(() => {
        const getCookie = (name: string) => {
            if (typeof document === 'undefined') return '';
            const parts = `; ${document.cookie}`.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
            return '';
        };
        const id = getCookie('activeOrganisationId');
        if (id) setOrganisationId(id);
        else router.push('/dashboard');
    }, [router]);

    useEffect(() => {
        if (organisationId) { fetchOrganisation(); fetchStats(); fetchAllOrganisations(); }
    }, [organisationId]);

    useEffect(() => {
        if (organisationId) fetchStats(chartOffset);
    }, [chartOffset, organisationId]);

    const fetchOrganisation = async () => {
        try {
            const res = await fetch(`/api/organisations/${organisationId}`);
            if (res.ok) {
                const data = await res.json();
                setOrganisation(data);
                const leaderRole = data.userRoles?.find((ur: any) =>
                    ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'].includes(ur.role)
                );
                if (leaderRole?.user) setOrganisationLeader(leaderRole.user);
            }
        } catch (e) { console.error(e); }
    };

    const fetchStats = async (offset?: number) => {
        const cur = offset ?? chartOffset;
        const cached = chartCache.current.get(cur);
        if (cached) setStats(prev => ({ ...prev, chartData: cached }));
        else setChartLoading(true);
        try {
            const res = await fetch(`/api/organisations/${organisationId}/stats?chartOffset=${cur}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.chartData) chartCache.current.set(cur, data.chartData);
                setStats(data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); setChartLoading(false); }
    };

    const fetchAllOrganisations = async () => {
        try {
            const res = await fetch('/api/organisations?all=true');
            if (res.ok) setAllOrganisations(await res.json());
        } catch (e) { console.error(e); }
    };

    const quickLinks = useMemo(() => {
        const links: { title: string; href: string }[] = [];
        if (organisation?.level && organisation.level !== 'COUNCIL') {
            if (organisation.level === 'CAMPUS') {
                links.push({ title: 'View accounts', href: `/accounts?campus=${organisationId}` });
            } else {
                links.push({ title: 'View churches', href: `/organisations?parent=${organisationId}` });
            }
        }
        return [...links,
            { title: 'Transactions History', href: `/transactions?dept=${organisationId}` },
            { title: 'View Trends', href: `/reports?dept=${organisationId}` },
        ];
    }, [organisationId, organisation]);

    if (loading) return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
        </div>
    );

    const isLeader = session?.user?.role?.includes('LEADER');
    const canEdit = !isLeader;
    const userRole = session?.user?.role;
    const isAdvancedView = userRole && (userRole === 'SUPERADMIN' || userRole.includes('ADMIN') || ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER'].includes(userRole));

    const getBalanceColor = (bal: number) => {
        if (bal < 0) return 'text-destructive';
        if (bal === 0) return 'text-warning';
        if (bal < 5000) return 'text-warning';
        return 'text-success';
    };

    const isDark = resolvedMode === 'dark';
    const chartColors = {
        income: '#22C55E',
        expense: '#EF4444',
        text: isDark ? '#94A3B8' : '#64748B',
        divider: isDark ? '#1E293B' : '#E2E8F0',
        bg: isDark ? '#0F172A' : '#FFFFFF',
        tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
    };

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {organisationLeader ? (
                        <Avatar className="w-13 h-13 sm:w-15 sm:h-15 shrink-0 border border-border">
                            {organisationLeader.image && <AvatarImage src={organisationLeader.image} alt={organisationLeader.name} />}
                            <AvatarFallback className="text-lg font-semibold">{organisationLeader.name[0]}</AvatarFallback>
                        </Avatar>
                    ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                            <Wallet className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">
                            {isBankAccount(organisation?.level) ? 'Account' : 'Church'}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground leading-[1.15]">
                                {organisation?.name || (isBankAccount(organisation?.level) ? 'Account dashboard' : 'Church dashboard')}
                            </h1>
                            {canEdit && (
                                <button onClick={() => setEditDialogOpen(true)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
                                    <Pencil className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.75">
                            {isBankAccount(organisation?.level) && organisationLeader
                                ? (organisationLeader.name === session?.user?.name
                                    ? 'You hold this account.'
                                    : `Held by ${organisationLeader.name}`)
                                : organisationLeader
                                    ? `Led by ${organisationLeader.name}`
                                    : "Here's what's happening with your finances today."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div className={cn('grid gap-3 sm:gap-4 mb-6', isAdvancedView ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>
                <StatCard title="Account Balance" amount={stats.balance} currencySymbol={stats.currency.symbol} colorClass={getBalanceColor(stats.balance)} />
                <StatCard title="This Week's Income" amount={stats.weeklyIncome} currencySymbol={stats.currency.symbol} colorClass="text-success" />
                {isAdvancedView && <>
                    <StatCard title="Total Inflows" amount={stats.income} currencySymbol={stats.currency.symbol} colorClass="text-blue-500" />
                    <StatCard title="Total Expenses" amount={stats.expense} currencySymbol={stats.currency.symbol} colorClass="text-destructive" />
                </>}
            </div>

            {/* Weekly chart */}
            {stats.chartData && stats.chartData.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6 mb-6">
                    <p className="font-bold text-foreground mb-4 text-[0.95rem] sm:text-[1.1rem]">
                        {chartOffset === 0 ? 'Weekly Income & Expense (Last 4 Weeks)' : 'Weekly Income & Expense'}
                    </p>
                    <div className={cn('w-full transition-opacity duration-200', chartLoading && 'opacity-50')} style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.chartData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                                <XAxis dataKey="week" tick={{ fill: chartColors.text, fontSize: 12 }} axisLine={{ stroke: chartColors.divider }} tickLine={false} />
                                <Tooltip
                                    formatter={(value: any, name: any) => {
                                        const formatted = `${stats.currency.symbol}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                        return [formatted, name === 'income' ? 'Income' : 'Expense'];
                                    }}
                                    contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.divider}`, borderRadius: 10, fontSize: '0.8125rem' }}
                                    labelStyle={{ color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: 600 }}
                                />
                                <Bar dataKey="income" radius={[6, 6, 0, 0]} barSize={35} fill={chartColors.income}>
                                    <LabelList dataKey="income" position="top" fill={isDark ? '#94A3B8' : '#475569'} fontSize={11}
                                        formatter={(v: any) => `${stats.currency.symbol}${Number(v).toLocaleString()}`} />
                                </Bar>
                                <Bar dataKey="expense" radius={[6, 6, 0, 0]} barSize={35} fill={chartColors.expense}>
                                    <LabelList dataKey="expense" position="top" fill={isDark ? '#94A3B8' : '#475569'} fontSize={11}
                                        formatter={(v: any) => `${stats.currency.symbol}${Number(v).toLocaleString()}`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center items-center gap-4 mt-3">
                        <Button variant="outline" size="icon-sm" onClick={() => setChartOffset(p => p + 1)} disabled={chartLoading}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                            {chartOffset === 0 ? 'Current' : `${chartOffset * 4} weeks ago`}
                        </span>
                        <Button variant="outline" size="icon-sm" onClick={() => setChartOffset(p => Math.max(0, p - 1))} disabled={chartOffset === 0 || chartLoading}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick links */}
            <div className="flex flex-col gap-3">
                {quickLinks.map(link => (
                    <button
                        key={link.title}
                        onClick={() => router.push(link.href)}
                        className="w-full py-4 px-6 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-colors duration-150"
                    >
                        <span className="font-bold text-primary text-[1rem]">{link.title}</span>
                    </button>
                ))}
            </div>

            <EditOrganisationDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                organisation={organisation}
                organisations={allOrganisations}
                onSave={async () => { await fetchOrganisation(); await fetchStats(); setEditDialogOpen(false); }}
                onOrganisationClosed={() => router.push('/dashboard')}
            />
        </div>
    );
}
