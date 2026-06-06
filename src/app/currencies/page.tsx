'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Currency { id: string; code: string; name: string; symbol: string; isBase: boolean; isActive: boolean; }
interface ExchangeRate { id: string; fromCurrency: Currency; toCurrency: Currency; rate: string; effectiveDate: string; createdBy: string; }

const TABS = ['Currencies', 'Exchange Rates', 'Base Currencies'];

export default function CurrenciesPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [tab, setTab] = useState(0);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
    const [baseCurrencies, setBaseCurrencies] = useState<any[]>([]);
    const [systemBase, setSystemBase] = useState<any>(null);
    const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
    const [rateDialogOpen, setRateDialogOpen] = useState(false);
    const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
    const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', symbol: '', isBase: false });
    const [rateForm, setRateForm] = useState({ fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        if (session?.user?.role && !['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(session.user.role)) router.push('/dashboard');
    }, [session, router]);

    useEffect(() => { fetchCurrencies(); fetchExchangeRates(); fetchBaseCurrencies(); }, []);

    const fetchCurrencies = async () => { const r = await fetch('/api/currencies'); if (r.ok) setCurrencies(await r.json()); };
    const fetchExchangeRates = async () => { const r = await fetch('/api/exchange-rates'); if (r.ok) setExchangeRates(await r.json()); };
    const fetchBaseCurrencies = async () => {
        const r = await fetch('/api/admin/base-currencies');
        if (r.ok) { const d = await r.json(); setBaseCurrencies(d.oversightDepartments || []); setSystemBase(d.systemBase); }
    };

    const handleCreateCurrency = async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch(editingCurrency ? `/api/currencies/${editingCurrency.id}` : '/api/currencies', { method: editingCurrency ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currencyForm) });
            if (!r.ok) throw new Error(await r.text());
            setSuccess(editingCurrency ? 'Currency updated successfully' : 'Currency created successfully');
            setCurrencyDialogOpen(false); setEditingCurrency(null); setCurrencyForm({ code: '', name: '', symbol: '', isBase: false });
            fetchCurrencies();
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleCreateExchangeRate = async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch(editingRate ? `/api/exchange-rates/${editingRate.id}` : '/api/exchange-rates', { method: editingRate ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rateForm) });
            if (!r.ok) throw new Error(await r.text());
            setSuccess(editingRate ? 'Exchange rate updated' : 'Exchange rate created');
            setRateDialogOpen(false); setEditingRate(null); setRateForm({ fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0] });
            fetchExchangeRates();
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleEditCurrency = (c: Currency) => { setEditingCurrency(c); setCurrencyForm({ code: c.code, name: c.name, symbol: c.symbol, isBase: c.isBase }); setCurrencyDialogOpen(true); };
    const handleEditRate = (r: ExchangeRate) => { setEditingRate(r); setRateForm({ fromCurrencyId: r.fromCurrency.id, toCurrencyId: r.toCurrency.id, rate: r.rate, effectiveDate: new Date(r.effectiveDate).toISOString().split('T')[0] }); setRateDialogOpen(true); };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        const r = await fetch(`/api/currencies/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) });
        if (r.ok) fetchCurrencies();
    };

    const handleDeleteRate = async (id: string) => {
        if (!confirm('Are you sure you want to delete this exchange rate?')) return;
        const r = await fetch(`/api/exchange-rates/${id}`, { method: 'DELETE' });
        if (r.ok) { setSuccess('Exchange rate deleted'); fetchExchangeRates(); } else setError(await r.text());
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                    <Coins className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">Configuration</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Currencies</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage currencies, exchange rates, and department defaults.</p>
                </div>
            </div>

            {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="mb-4 border-success/30 bg-success/8"><AlertDescription className="text-success">{success}</AlertDescription></Alert>}

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 mb-5 w-fit">
                {TABS.map((t, i) => (
                    <button key={t} onClick={() => setTab(i)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === i ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground')}>{t}</button>
                ))}
            </div>

            {/* --- Tab 0: Currencies --- */}
            {tab === 0 && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-foreground">Active Currencies</h2>
                        <Button onClick={() => setCurrencyDialogOpen(true)} size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Currency</Button>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                        {currencies.map(c => (
                            <button key={c.id} className="text-left rounded-xl border border-border bg-card p-4 w-full" onClick={() => handleEditCurrency(c)}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-foreground">{c.code}</span>
                                        <span className="text-sm text-muted-foreground">{c.name}</span>
                                    </div>
                                    <span className="text-xl font-semibold text-foreground">{c.symbol}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className={c.isActive ? 'bg-success/10 text-success border-success/25' : 'bg-muted text-muted-foreground'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                                        {c.isBase && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25">Base</Badge>}
                                    </div>
                                    <button className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', c.isActive ? 'bg-success' : 'bg-muted-foreground/30')} onClick={e => { e.stopPropagation(); handleToggleActive(c.id, c.isActive); }}>
                                        <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', c.isActive ? 'translate-x-4' : 'translate-x-1')} />
                                    </button>
                                </div>
                            </button>
                        ))}
                        {currencies.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No currencies found</p>}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>{['Code', 'Name', 'Symbol', 'Status', 'Base Currency', 'Actions'].map(h => <th key={h} className="py-3 px-4 text-left font-semibold text-foreground">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {currencies.map(c => (
                                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="py-3 px-4 font-bold text-foreground">{c.code}</td>
                                        <td className="py-3 px-4 text-foreground">{c.name}</td>
                                        <td className="py-3 px-4 text-foreground">{c.symbol}</td>
                                        <td className="py-3 px-4"><Badge variant="outline" className={c.isActive ? 'bg-success/10 text-success border-success/25' : 'bg-muted text-muted-foreground'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></td>
                                        <td className="py-3 px-4">{c.isBase && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25">Base</Badge>}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2 items-center justify-end">
                                                <button className="p-1.5 rounded-lg hover:bg-muted text-primary" onClick={() => handleEditCurrency(c)}><Pencil className="h-4 w-4" /></button>
                                                <button className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', c.isActive ? 'bg-success' : 'bg-muted-foreground/30')} onClick={() => handleToggleActive(c.id, c.isActive)}>
                                                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', c.isActive ? 'translate-x-4' : 'translate-x-1')} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {currencies.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No currencies found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- Tab 1: Exchange Rates --- */}
            {tab === 1 && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-foreground">Exchange Rates</h2>
                        <Button onClick={() => setRateDialogOpen(true)} size="sm"><Plus className="mr-1.5 h-4 w-4" />Set Exchange Rate</Button>
                    </div>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>{['From Currency', 'To Currency', 'Exchange Rate', 'Effective Date', 'Actions'].map(h => <th key={h} className="py-3 px-4 text-left font-semibold text-foreground">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {exchangeRates.map(r => (
                                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="py-3 px-4"><span className="font-bold text-foreground">{r.fromCurrency.code}</span> — {r.fromCurrency.name}</td>
                                        <td className="py-3 px-4"><span className="font-bold text-foreground">{r.toCurrency.code}</span> — {r.toCurrency.name}</td>
                                        <td className="py-3 px-4 font-semibold text-foreground">{r.rate}</td>
                                        <td className="py-3 px-4 text-muted-foreground">{new Date(r.effectiveDate).toLocaleDateString()}</td>
                                        <td className="py-3 px-4">
                                            {(session?.user?.id === r.createdBy || session?.user?.role === 'SUPERADMIN') && (
                                                <div className="flex gap-1">
                                                    <button className="p-1.5 rounded-lg hover:bg-muted text-primary" onClick={() => handleEditRate(r)}><Pencil className="h-4 w-4" /></button>
                                                    {session?.user?.role === 'SUPERADMIN' && <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => handleDeleteRate(r.id)}><Trash2 className="h-4 w-4" /></button>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {exchangeRates.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No exchange rates found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- Tab 2: Base Currencies --- */}
            {tab === 2 && (
                <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4">Oversight Base Currencies</h2>
                    {systemBase && (
                        <Alert className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                            <AlertDescription className="text-blue-700 dark:text-blue-300">System Default: <strong>{systemBase.code} ({systemBase.name})</strong></AlertDescription>
                        </Alert>
                    )}
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>{['Oversight Department', 'Base Currency', 'Status', 'Set By', 'Date Set'].map(h => <th key={h} className="py-3 px-4 text-left font-semibold text-foreground">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {baseCurrencies.map((d: any) => (
                                    <tr key={d.departmentId} className="hover:bg-muted/20 transition-colors">
                                        <td className="py-3 px-4 font-bold text-foreground">{d.departmentName}</td>
                                        <td className="py-3 px-4 text-foreground">{d.baseCurrency ? `${d.baseCurrency.code} — ${d.baseCurrency.name}` : <span className="text-muted-foreground">Using system default</span>}</td>
                                        <td className="py-3 px-4"><Badge variant="outline" className={d.isCustom ? 'bg-primary/10 text-primary border-primary/25' : 'bg-muted text-muted-foreground'}>{d.isCustom ? 'Custom' : 'Default'}</Badge></td>
                                        <td className="py-3 px-4 text-muted-foreground">{d.setBy?.name || '—'}</td>
                                        <td className="py-3 px-4 text-muted-foreground">{d.setAt ? new Date(d.setAt).toLocaleDateString() : '—'}</td>
                                    </tr>
                                ))}
                                {baseCurrencies.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No oversight departments found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Currency Dialog */}
            <Dialog open={currencyDialogOpen} onOpenChange={v => { if (!v) { setCurrencyDialogOpen(false); setEditingCurrency(null); setCurrencyForm({ code: '', name: '', symbol: '', isBase: false }); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{editingCurrency ? 'Edit Currency' : 'Add Currency'}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                        <div className="space-y-1.5">
                            <Label>Currency Code <span className="text-destructive">*</span></Label>
                            <Input maxLength={3} placeholder="e.g., USD, EUR, GHS" value={currencyForm.code} onChange={e => setCurrencyForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} disabled={!!editingCurrency} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Currency Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="e.g., US Dollar, Euro" value={currencyForm.name} onChange={e => setCurrencyForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Symbol <span className="text-destructive">*</span></Label>
                            <Input placeholder="e.g., $, €, ₵" value={currencyForm.symbol} onChange={e => setCurrencyForm(f => ({ ...f, symbol: e.target.value }))} />
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <button role="switch" aria-checked={currencyForm.isBase} onClick={() => setCurrencyForm(f => ({ ...f, isBase: !f.isBase }))} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', currencyForm.isBase ? 'bg-primary' : 'bg-muted-foreground/30')}>
                                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', currencyForm.isBase ? 'translate-x-4' : 'translate-x-1')} />
                            </button>
                            <span className="text-sm text-foreground">Set as base currency</span>
                        </label>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setCurrencyDialogOpen(false); setEditingCurrency(null); setCurrencyForm({ code: '', name: '', symbol: '', isBase: false }); }}>Cancel</Button>
                        <Button onClick={handleCreateCurrency} disabled={loading}>{loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : editingCurrency ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Exchange Rate Dialog */}
            <Dialog open={rateDialogOpen} onOpenChange={v => { if (!v) { setRateDialogOpen(false); setEditingRate(null); setRateForm({ fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0] }); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{editingRate ? 'Edit Exchange Rate' : 'Set Exchange Rate'}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                        <div className="space-y-1.5">
                            <Label>From Currency <span className="text-destructive">*</span></Label>
                            <Select value={rateForm.fromCurrencyId} onValueChange={v => setRateForm(f => ({ ...f, fromCurrencyId: v }))} disabled={!!editingRate}>
                                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                <SelectContent>{currencies.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>To Currency <span className="text-destructive">*</span></Label>
                            <Select value={rateForm.toCurrencyId} onValueChange={v => setRateForm(f => ({ ...f, toCurrencyId: v }))} disabled={!!editingRate}>
                                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                <SelectContent>{currencies.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Exchange Rate <span className="text-destructive">*</span></Label>
                            <Input type="number" step="0.0001" min="0" placeholder="e.g., 1.25" value={rateForm.rate} onChange={e => setRateForm(f => ({ ...f, rate: e.target.value }))} />
                            <p className="text-xs text-muted-foreground">Units of 'To Currency' per 1 unit of 'From Currency'</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Effective Date</Label>
                            <Input type="date" value={rateForm.effectiveDate} onChange={e => setRateForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                            <p className="text-xs text-muted-foreground">The date when this rate becomes active</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setRateDialogOpen(false); setEditingRate(null); setRateForm({ fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0] }); }}>Cancel</Button>
                        <Button onClick={handleCreateExchangeRate} disabled={loading}>{loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : editingRate ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
