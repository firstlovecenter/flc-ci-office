'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart2, Download, Printer, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatOrganisationLevel, formatCurrency } from '@/lib/utils';
import { roundMoney, sumMoney } from '@/lib/format-money';
import { useColorMode } from '@/app/providers';
import { useToast } from '@/components/ToastProvider';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

function ReportsPageContent() {
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const { data: session } = useSession();
    const { showError } = useToast();
    const { resolvedMode } = useColorMode();
    const isDark = resolvedMode === 'dark';

    const [organisations, setOrganisations] = useState<any[]>([]);
    const [selectedOrganisation, setSelectedOrganisation] = useState('');
    const [fixedOrganisation, setFixedOrganisation] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [includeSubOrganisations, setIncludeSubOrganisations] = useState(true);
    const [chartData, setChartData] = useState<{ week: string; income: number; expense: number }[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [userOrganisationId, setUserOrganisationId] = useState<string | null>(null);
    const [userOrganisationName, setUserOrganisationName] = useState<string | null>(null);
    const [isLeader, setIsLeader] = useState(false);
    const [hasSubOrganisations, setHasSubOrganisations] = useState(false);

    const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];

    useEffect(() => {
        fetchOrganisations(); fetchBaseCurrency();
        if (deptParam) { fetchFixedOrganisation(); fetchChartDataForDept(deptParam); }
        else fetchChartData();
    }, [deptParam]);

    useEffect(() => {
        if (deptParam) setSelectedOrganisation(deptParam);
        else if (userOrganisationId && !selectedOrganisation) setSelectedOrganisation(userOrganisationId);
    }, [userOrganisationId, deptParam]);

    const fetchFixedOrganisation = async () => {
        if (!deptParam) return;
        const r = await fetch(`/api/organisations/${deptParam}`);
        if (r.ok) setFixedOrganisation(await r.json());
    };

    const fetchChartDataForDept = async (deptId: string) => {
        setChartLoading(true);
        try {
            const r = await fetch(`/api/organisations/${deptId}/stats`, { cache: 'no-store' });
            if (r.ok) { const d = await r.json(); if (d.chartData) setChartData(d.chartData); if (d.currency) setBaseCurrency({ id: '', code: d.currency.code, symbol: d.currency.symbol }); }
        } catch {} finally { setChartLoading(false); }
    };

    const fetchBaseCurrency = async () => {
        try {
            const r = await fetch('/api/users/me');
            if (r.ok) {
                const d = await r.json(); setBaseCurrency(d.baseCurrency);
                const activeUserRole = d.activeUserRole || d.userRoles?.[0];
                const activeRole = activeUserRole?.role || d.role;
                const activeDeptId = activeUserRole?.organisationId || d.organisationId;
                const activeDeptName = activeUserRole?.organisation?.name || d.organisation?.name;
                if (activeDeptId) setUserOrganisationId(activeDeptId);
                if (activeDeptName) setUserOrganisationName(activeDeptName);
                if (activeRole && leaderRoles.includes(activeRole)) setIsLeader(true);
            }
        } catch {}
    };

    const fetchOrganisations = async () => {
        const r = await fetch('/api/organisations');
        if (r.ok) { const d = await r.json(); setOrganisations(d); if (d.length > 1) setHasSubOrganisations(true); }
    };

    const fetchChartData = async () => {
        setChartLoading(true);
        try { const r = await fetch('/api/dashboard/stats', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); if (d.chartData) setChartData(d.chartData); } }
        catch {} finally { setChartLoading(false); }
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            let opening = 0;
            if (startDate) {
                let openUrl = '/api/transactions?status=APPROVED&';
                if (selectedOrganisation) { openUrl += `organisationId=${selectedOrganisation}&`; if (!includeSubOrganisations) openUrl += `exactOrganisation=true&`; }
                openUrl += `endDate=${new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0]}`;
                const or = await fetch(openUrl);
                if (or.ok) { const od = await or.json(); opening = roundMoney(sumMoney(od.filter((t: any) => t.type === 'INCOME').map((t: any) => t.amountInBase || t.amount)) - sumMoney(od.filter((t: any) => t.type === 'EXPENSE').map((t: any) => t.amountInBase || t.amount))); }
            }
            setOpeningBalance(opening);

            let url = '/api/transactions?status=APPROVED&';
            if (selectedOrganisation) { url += `organisationId=${selectedOrganisation}&`; if (!includeSubOrganisations) url += `exactOrganisation=true&`; }
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}&`;

            const r = await fetch(url);
            if (r.ok) {
                const data = await r.json();
                const sorted = [...data].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                setTransactions(sorted);
                const income = sumMoney(data.filter((t: any) => t.type === 'INCOME').map((t: any) => t.amountInBase || t.amount));
                const expense = sumMoney(data.filter((t: any) => t.type === 'EXPENSE').map((t: any) => t.amountInBase || t.amount));
                setClosingBalance(roundMoney(opening + income - expense));
                setStats({ income, expense, balance: roundMoney(income - expense) });
            }
        } catch {} finally { setLoading(false); }
    };

    const handleDownload = () => {
        const sym = baseCurrency?.code || 'GHS';
        let bal = openingBalance;
        const headers = `Date,Description,Church,Debit (${sym}),Credit (${sym}),Balance (${sym})\n`;
        const rows = transactions.map(tx => {
            const debit = tx.type === 'EXPENSE' ? Number(tx.amountInBase || tx.amount) : 0;
            const credit = tx.type === 'INCOME' ? Number(tx.amountInBase || tx.amount) : 0;
            bal = roundMoney(bal + credit - debit);
            return `${new Date(tx.createdAt).toLocaleDateString()},${tx.description},${tx.organisation.name},${debit || ''},${credit || ''},${bal}`;
        }).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `full-report-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = async () => {
        if (isLeader && !userOrganisationId) { showError('Please wait for user data to load, then try again.'); return; }
        const deptToUse = isLeader ? userOrganisationId : selectedOrganisation;
        try {
            const r = await fetch('/api/reports/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organisationId: deptToUse, startDate, endDate, reportType: 'statement', includeSubOrganisations: isLeader ? true : includeSubOrganisations }) });
            if (!r.ok) { let msg = 'Unknown error'; try { const d = await r.json(); msg = d.error || d.details || msg; } catch { msg = `Server error: ${r.status} ${r.statusText}`; } showError(`Failed to generate PDF: ${msg}`); return; }
            const blob = await r.blob();
            if (blob.type !== 'application/pdf') { showError('Failed to generate PDF: Invalid response format'); return; }
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `statement-report-${new Date().toISOString().split('T')[0]}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { showError(`Failed to download PDF: ${e instanceof Error ? e.message : 'Please try again.'}`); }
    };

    const fmtCurr = (v: number) => baseCurrency ? formatCurrency(v, baseCurrency.code, baseCurrency.symbol) : formatCurrency(v);

    const deptName = fixedOrganisation ? `${fixedOrganisation.name} (${formatOrganisationLevel(fixedOrganisation.level)})`
        : isLeader ? userOrganisationName || 'My church'
        : selectedOrganisation ? organisations.find(d => d.id === selectedOrganisation)?.name || 'All churches'
        : 'All churches';

    const chartColors = { income: '#22C55E', expense: '#EF4444', grid: isDark ? '#1E293B' : '#E2E8F0', text: isDark ? '#94A3B8' : '#64748B', tooltipBg: isDark ? '#1E293B' : '#FFFFFF', tooltipBorder: isDark ? '#334155' : '#E2E8F0' };

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-4 flex-wrap mb-8 pb-6 border-b border-border print:hidden">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                    <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">Analytics</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                        {fixedOrganisation ? `${fixedOrganisation.name} trends` : 'Trends'}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {fixedOrganisation ? 'Financial trends for this church and its sub-churches.' : 'Income and expense movements over time.'}
                    </p>
                </div>
            </div>

            {/* Chart card */}
            <div className="rounded-xl border border-border bg-card p-5 mb-5">
                <p className="font-semibold text-foreground mb-4">Income vs Expense Trends</p>
                {chartLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 10, right: 16, left: 10, bottom: 5 }}>
                            <XAxis dataKey="week" tick={{ fill: chartColors.text, fontSize: 12 }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                            <Tooltip formatter={(v: any, name: string) => [fmtCurr(v), name === 'income' ? 'Income' : 'Expense']} contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 10, fontSize: '0.8125rem' }} />
                            <Bar dataKey="income" name="Income" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Expense" fill={chartColors.expense} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Filters / generate */}
            <div className="rounded-xl border border-border bg-card p-5 mb-5 print:hidden">
                <p className="font-semibold text-foreground mb-4">Generate Full Report</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    {!fixedOrganisation && !isLeader && hasSubOrganisations && (
                        <>
                            <div className="space-y-1.5 w-full sm:w-auto">
                                <Label>Church (Optional)</Label>
                                <Select value={selectedOrganisation || "none"} onValueChange={(v) => setSelectedOrganisation(v === "none" ? "" : v)}>
                                    <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All churches" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">All churches</SelectItem>
                                        {organisations.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({formatOrganisationLevel(d.level)})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedOrganisation && (
                                <div className="space-y-1.5 w-full sm:w-auto">
                                    <Label>Scope</Label>
                                    <Select value={includeSubOrganisations ? 'include' : 'exact'} onValueChange={v => setIncludeSubOrganisations(v === 'include')}>
                                        <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="include">Include related churches</SelectItem>
                                            <SelectItem value="exact">Selected church only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </>
                    )}
                    <Button onClick={generateReport} disabled={loading} size="lg">
                        {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Generating…</> : 'Generate Report'}
                    </Button>
                </div>

                {transactions.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-border">
                        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
                        <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                        <Button onClick={handleDownloadPDF}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                    </div>
                )}
            </div>

            {/* Stats summary */}
            {transactions.length > 0 && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 print:hidden">
                        <div className={cn('rounded-xl p-5 text-white', stats.balance < 5000 ? 'bg-destructive animate-pulse' : stats.balance >= 0 ? 'bg-success' : 'bg-destructive')}>
                            <p className="text-sm opacity-90 font-semibold mb-1">Account Balance</p>
                            <p className="text-[1.5rem] font-bold">{fmtCurr(stats.balance)}</p>
                        </div>
                        <div className="rounded-xl p-5 text-white bg-success">
                            <p className="text-sm opacity-90 font-semibold mb-1">Total Inflows</p>
                            <p className="text-[1.5rem] font-bold">{fmtCurr(stats.income)}</p>
                        </div>
                        <div className="rounded-xl p-5 text-white bg-destructive">
                            <p className="text-sm opacity-90 font-semibold mb-1">Total Expenses</p>
                            <p className="text-[1.5rem] font-bold">{fmtCurr(stats.expense)}</p>
                        </div>
                    </div>

                    {/* Statement */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden print-content">
                        {/* Statement header */}
                        <div className="p-5 border-b border-border text-center">
                            <h2 className="text-xl font-bold text-foreground mb-1">Full Report</h2>
                            <p className="text-sm text-muted-foreground">{deptName}</p>
                            {baseCurrency && <p className="text-sm text-muted-foreground">Currency: {baseCurrency.code} ({baseCurrency.symbol})</p>}
                            {(startDate || endDate) && <p className="text-sm text-muted-foreground">Period: {startDate ? new Date(startDate).toLocaleDateString() : 'Start'} — {endDate ? new Date(endDate).toLocaleDateString() : 'End'}</p>}
                        </div>

                        <div className="flex justify-between items-center px-5 py-3 border-b border-border bg-muted/30">
                            <span className="font-bold text-foreground">Opening Balance:</span>
                            <span className={cn('font-bold', openingBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtCurr(openingBalance)}</span>
                        </div>

                        {/* Mobile statement */}
                        <div className="flex flex-col gap-3 p-4 md:hidden">
                            {(() => { let bal = openingBalance; return transactions.map((tx, i) => {
                                const amt = Number(tx.amountInBase || tx.amount);
                                const debit = tx.type === 'EXPENSE' ? amt : 0;
                                const credit = tx.type === 'INCOME' ? amt : 0;
                                bal = roundMoney(bal + credit - debit);
                                return (
                                    <div key={tx.id} className={cn('rounded-xl border border-border p-3', i % 2 === 0 ? 'bg-muted/20' : 'bg-card')}>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-bold text-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                            <p className="text-xs text-muted-foreground">{tx.organisation.name}</p>
                                        </div>
                                        <p className="text-sm text-foreground mb-2">{tx.description}</p>
                                        {tx.currency && baseCurrency && tx.currency.code !== baseCurrency.code && <p className="text-xs text-muted-foreground mb-2">(Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code})</p>}
                                        <div className="flex justify-between items-center">
                                            <div>{debit > 0 && <p className="text-sm font-semibold text-destructive">−{fmtCurr(debit)}</p>}{credit > 0 && <p className="text-sm font-semibold text-success">+{fmtCurr(credit)}</p>}</div>
                                            <div className="text-right"><p className="text-xs text-muted-foreground">Balance</p><p className={cn('text-sm font-bold', bal >= 0 ? 'text-success' : 'text-destructive')}>{fmtCurr(bal)}</p></div>
                                        </div>
                                    </div>
                                );
                            }); })()}
                            <div className="rounded-xl border border-border bg-muted/40 p-4 mt-2">
                                <p className="font-bold text-foreground mb-2">Totals</p>
                                <div className="flex justify-between mb-1"><span className="text-sm text-muted-foreground">Expense</span><span className="text-sm font-bold text-destructive">{fmtCurr(stats.expense)}</span></div>
                                <div className="flex justify-between mb-2"><span className="text-sm text-muted-foreground">Income</span><span className="text-sm font-bold text-success">{fmtCurr(stats.income)}</span></div>
                                <div className="border-t border-border pt-2 flex justify-between"><span className="text-sm font-bold text-foreground">Net</span><span className="text-sm font-bold text-foreground">{fmtCurr(stats.balance)}</span></div>
                            </div>
                        </div>

                        {/* Desktop statement table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-primary text-white">
                                    <tr>{['Date', 'Description', 'Church', 'Debit', 'Credit', 'Balance'].map((h, i) => <th key={h} className={cn('py-3 px-4 font-bold', i >= 3 ? 'text-right' : 'text-left')}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {(() => { let bal = openingBalance; return transactions.map((tx, i) => {
                                        const amt = Number(tx.amountInBase || tx.amount);
                                        const debit = tx.type === 'EXPENSE' ? amt : 0;
                                        const credit = tx.type === 'INCOME' ? amt : 0;
                                        bal = roundMoney(bal + credit - debit);
                                        return (
                                            <tr key={tx.id} className={cn('border-b border-border', i % 2 === 0 ? 'bg-muted/15' : 'bg-card')}>
                                                <td className="py-2.5 px-4 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                                <td className="py-2.5 px-4"><span className="text-foreground">{tx.description}</span>{tx.currency && baseCurrency && tx.currency.code !== baseCurrency.code && <span className="block text-xs text-muted-foreground">(Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code})</span>}</td>
                                                <td className="py-2.5 px-4 text-foreground">{tx.organisation.name}</td>
                                                <td className={cn('py-2.5 px-4 text-right font-medium', debit ? 'text-destructive' : 'text-muted-foreground')}>{debit ? fmtCurr(debit) : '—'}</td>
                                                <td className={cn('py-2.5 px-4 text-right font-medium', credit ? 'text-success' : 'text-muted-foreground')}>{credit ? fmtCurr(credit) : '—'}</td>
                                                <td className={cn('py-2.5 px-4 text-right font-bold', bal >= 0 ? 'text-success' : 'text-destructive')}>{fmtCurr(bal)}</td>
                                            </tr>
                                        );
                                    }); })()}
                                    <tr className="bg-muted/40 border-t-2 border-border">
                                        <td colSpan={3} className="py-3 px-4 font-bold text-foreground">Totals</td>
                                        <td className="py-3 px-4 text-right font-bold text-destructive">{fmtCurr(stats.expense)}</td>
                                        <td className="py-3 px-4 text-right font-bold text-success">{fmtCurr(stats.income)}</td>
                                        <td className="py-3 px-4 text-right font-bold text-foreground">{fmtCurr(stats.balance)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center px-5 py-4 border-t-2 border-border">
                            <span className="text-lg font-bold text-foreground">Closing Balance:</span>
                            <span className={cn('text-lg font-bold', closingBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtCurr(closingBalance)}</span>
                        </div>
                    </div>
                </>
            )}

            {!loading && transactions.length === 0 && (selectedOrganisation || startDate || endDate) && (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-lg font-semibold text-foreground mb-1">No Transactions Found</p>
                    <p className="text-sm text-muted-foreground">There are no transactions for the selected criteria. Try adjusting your filters or date range.</p>
                </div>
            )}
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}>
            <ReportsPageContent />
        </Suspense>
    );
}
