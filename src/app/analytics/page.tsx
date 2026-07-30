'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, CheckCircle, Clock, Building2, Users, BarChart2, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { useColorMode } from '@/app/providers';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface OverviewData {
    totalIncome: number; totalExpense: number; netCashFlow: number; totalTransactions: number;
    pendingCount: number; approvedCount: number; rejectedCount: number;
    approvalRate: number; avgApprovalTime: number; activeOrganisations: number; activeUsers: number;
}

const ALLOWED_ROLES = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'DENOMINATION_LEADER', 'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER'];

function KpiCard({ title, value, sub, Icon, gradient }: { title: string; value: string; sub?: string; Icon: any; gradient: string }) {
    return (
        <div className={cn('rounded-xl p-4 text-white flex justify-between items-start', gradient)}>
            <div>
                <p className="text-[0.75rem] opacity-90 mb-1">{title}</p>
                <p className="text-[1.15rem] font-semibold">{value}</p>
                {sub && <p className="text-[0.7rem] opacity-80 mt-0.5">{sub}</p>}
            </div>
            <Icon className="h-8 w-8 opacity-60" />
        </div>
    );
}

function SecondaryKpi({ label, value, Icon, colorClass }: { label: string; value: any; Icon: any; colorClass: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
            <Icon className={cn('h-6 w-6 mx-auto mb-1.5', colorClass)} />
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

export default function AnalyticsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { resolvedMode } = useColorMode();

    const normalizedRole = (session?.user?.role || '').toUpperCase();
    const hasAccess = ALLOWED_ROLES.includes(normalizedRole);

    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [trends, setTrends] = useState<any[]>([]);
    const [currencyDistribution, setCurrencyDistribution] = useState<any[]>([]);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOrganisation, setSelectedOrganisation] = useState('');
    const [period, setPeriod] = useState('monthly');
    const [departmentLimit, setOrganisationLimit] = useState(10);

    useEffect(() => { if (session && !hasAccess) router.push('/dashboard'); }, [session, hasAccess, router]);
    useEffect(() => { if (hasAccess) fetchAllData(); }, [hasAccess, startDate, endDate, selectedOrganisation, period, departmentLimit]);

    const buildParams = (extra: Record<string, string | number> = {}) => {
        const p = new URLSearchParams();
        if (startDate) p.append('startDate', startDate);
        if (endDate) p.append('endDate', endDate);
        if (selectedOrganisation) p.append('organisationId', selectedOrganisation);
        Object.entries(extra).forEach(([k, v]) => p.append(k, String(v)));
        return p;
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetch(`/api/analytics/overview?${buildParams()}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setOverview(d.overview); setMonthlyTrend(d.monthlyTrend || []); } }),
                fetch(`/api/analytics/organisations?${buildParams({ limit: departmentLimit })}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setOrganisations(d.organisations || []); }),
                fetch(`/api/analytics/trends?${buildParams({ period })}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setTrends(d.trends || []); setCurrencyDistribution(d.currencyDistribution || []); } }),
            ]);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    if (!hasAccess) return null;

    const isDark = resolvedMode === 'dark';
    const chartColors = {
        text: isDark ? '#94A3B8' : '#64748B',
        grid: isDark ? '#1E293B' : '#E2E8F0',
        tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
        tooltipBorder: isDark ? '#334155' : '#E2E8F0',
        income: '#22C55E', incomeLight: isDark ? '#14532D' : '#DCFCE7',
        expense: '#EF4444', expenseLight: isDark ? '#450A0A' : '#FEE2E2',
        primary: '#FF4266', net: '#3B82F6', currency: '#8B5CF6',
    };

    const COLORS = ['#FF4266', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6'];
    const statusData = overview ? [
        { name: 'Pending', value: overview.pendingCount, color: '#F59E0B' },
        { name: 'Approved', value: overview.approvedCount, color: '#22C55E' },
        { name: 'Rejected', value: overview.rejectedCount, color: '#EF4444' },
    ] : [];

    const tooltipStyle = { backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 10, fontSize: '0.8125rem' };
    const labelStyle = { color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: 600 };
    const axisStyle = { fill: chartColors.text, fontSize: 12 };

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                    <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">Insights</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Analytics</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Approval rates, status breakdown, and church performance.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 mb-5">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end">
                    <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full sm:w-40 h-9 text-sm" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full sm:w-40 h-9 text-sm" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Period</Label>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-full sm:w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Top churches</Label>
                        <Select value={String(departmentLimit)} onValueChange={v => setOrganisationLimit(Number(v))}>
                            <SelectTrigger className="w-full sm:w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="5">Top 5</SelectItem><SelectItem value="10">Top 10</SelectItem><SelectItem value="20">Top 20</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" className="col-span-2 sm:col-span-1" onClick={() => { setStartDate(''); setEndDate(''); setSelectedOrganisation(''); setPeriod('monthly'); setOrganisationLimit(10); }}>Reset</Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="space-y-5">
                    {/* Primary KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard title="Total Income" value={formatCurrency(overview?.totalIncome || 0)} Icon={TrendingUp} gradient="bg-gradient-to-br from-green-500 to-green-700" />
                        <KpiCard title="Total Expense" value={formatCurrency(overview?.totalExpense || 0)} Icon={TrendingDown} gradient="bg-gradient-to-br from-red-500 to-red-700" />
                        <KpiCard title="Net Cash Flow" value={formatCurrency(overview?.netCashFlow || 0)} Icon={Wallet} gradient="bg-gradient-to-br from-primary to-rose-700" />
                        <KpiCard title="Approval Rate" value={`${overview?.approvalRate.toFixed(1)}%`} sub={`Avg: ${overview?.avgApprovalTime.toFixed(1)}h`} Icon={CheckCircle} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
                    </div>

                    {/* Secondary KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <SecondaryKpi label="Pending" value={overview?.pendingCount} Icon={Clock} colorClass="text-warning" />
                        <SecondaryKpi label="Approved" value={overview?.approvedCount} Icon={CheckCircle} colorClass="text-success" />
                        <SecondaryKpi label="Active churches" value={overview?.activeOrganisations} Icon={Building2} colorClass="text-primary" />
                        <SecondaryKpi label="Active Users" value={overview?.activeUsers} Icon={Users} colorClass="text-blue-500" />
                    </div>

                    {/* Area chart + Pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-5">
                            <p className="font-semibold text-foreground mb-4">Income vs Expense Trend</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                                    <YAxis tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} tickFormatter={v => formatCurrency(v)} />
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} labelStyle={labelStyle} />
                                    <Legend />
                                    <Area type="monotone" dataKey="income" stroke={chartColors.income} fill={chartColors.incomeLight} name="Income" />
                                    <Area type="monotone" dataKey="expense" stroke={chartColors.expense} fill={chartColors.expenseLight} name="Expense" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                            <p className="font-semibold text-foreground mb-4">Transaction Status</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={entry => `${entry.name}: ${entry.value}`} labelLine={false}>
                                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar chart + Line chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4 sm:p-5">
                            <p className="font-semibold text-foreground mb-4">Top churches by volume</p>
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={organisations}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis dataKey="name" tick={axisStyle} angle={-45} textAnchor="end" height={100} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                                    <YAxis tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} tickFormatter={v => formatCurrency(v)} />
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} labelStyle={labelStyle} />
                                    <Legend />
                                    <Bar dataKey="income" fill={chartColors.income} name="Income" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" fill={chartColors.expense} name="Expense" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-5">
                            <p className="font-semibold text-foreground mb-4">Net Cash Flow Trend</p>
                            <ResponsiveContainer width="100%" height={320}>
                                <LineChart data={trends}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis dataKey="period" tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                                    <YAxis tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} tickFormatter={v => formatCurrency(v)} />
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} labelStyle={labelStyle} />
                                    <Line type="monotone" dataKey="net" stroke={chartColors.net} strokeWidth={2} name="Net Flow" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Currency distribution */}
                    {currencyDistribution.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                            <p className="font-semibold text-foreground mb-4">Currency Distribution</p>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={currencyDistribution} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis type="number" tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                                    <YAxis type="category" dataKey="currency" width={80} tick={axisStyle} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                                    <Tooltip formatter={(v: number) => v.toLocaleString()} contentStyle={tooltipStyle} labelStyle={labelStyle} />
                                    <Bar dataKey="count" name="Transactions" radius={[0, 4, 4, 0]}>
                                        {currencyDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
