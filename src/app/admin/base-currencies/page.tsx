'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Info, Trash2, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ToastProvider';
import { cn } from '@/lib/utils';

interface Currency { id: string; code: string; name: string; symbol: string; }
interface OversightDepartment {
    departmentId: string;
    departmentName: string;
    baseCurrency: Currency | null;
    isCustom: boolean;
    setBy: { name: string; email: string } | null;
    setAt: string | null;
}

export default function BaseCurrenciesAdminPage() {
    const { data: session } = useSession();
    const { showSuccess, showError } = useToast();
    const [departments, setDepartments] = useState<OversightDepartment[]>([]);
    const [systemBase, setSystemBase] = useState<Currency | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => { fetchBaseCurrencies(); }, []);

    const fetchBaseCurrencies = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/base-currencies');
            if (!res.ok) throw new Error('Failed to fetch base currencies');
            const data = await res.json();
            setDepartments(data.oversightDepartments);
            setSystemBase(data.systemBase);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (departmentId: string, departmentName: string) => {
        if (!confirm(`Delete the custom base currency for ${departmentName}? The department will revert to the system default.`)) return;
        try {
            setDeletingId(departmentId);
            const res = await fetch(`/api/admin/base-currencies?departmentId=${departmentId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete base currency');
            }
            await fetchBaseCurrencies();
            showSuccess('Base currency deleted successfully');
        } catch (err: any) {
            showError(`Error: ${err.message}`);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            </div>
        );
    }

    const customizedCount = departments.filter(d => d.isCustom).length;
    const usingSystemCount = departments.length - customizedCount;

    return (
        <TooltipProvider>
            <div className="p-4 sm:p-6">
                <h1 className="text-[1.5rem] font-semibold tracking-tight text-foreground mb-6">
                    Oversight Base Currencies
                </h1>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Total Oversight Departments', value: departments.length },
                        { label: 'Custom Base Currency', value: customizedCount, highlight: true },
                        { label: 'Using System Default', value: usingSystemCount },
                        { label: 'System Base Currency', value: systemBase ? `${systemBase.code} (${systemBase.symbol})` : 'N/A', highlight: true },
                    ].map(t => (
                        <div key={t.label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                            <p className="text-xs text-muted-foreground mb-1">{t.label}</p>
                            <p className={cn('text-2xl font-bold', t.highlight && 'text-primary')}>
                                {t.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/40">
                                    {['Department', 'Base Currency', 'Status', 'Set By', 'Last Updated', 'Actions'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {departments.map(dept => (
                                    <tr key={dept.departmentId} className="border-t border-border hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">{dept.departmentName}</td>
                                        <td className="px-4 py-3">
                                            {dept.baseCurrency ? (
                                                <span className="text-foreground">
                                                    <strong>{dept.baseCurrency.code}</strong>
                                                    <span className="text-muted-foreground ml-1">({dept.baseCurrency.symbol}) — {dept.baseCurrency.name}</span>
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">Not Set</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {dept.isCustom ? (
                                                <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Custom</Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" />System Default</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {dept.setBy ? (
                                                <div>
                                                    <p className="text-foreground">{dept.setBy.name}</p>
                                                    <p className="text-xs text-muted-foreground">{dept.setBy.email}</p>
                                                </div>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {dept.setAt
                                                ? `${new Date(dept.setAt).toLocaleDateString()} at ${new Date(dept.setAt).toLocaleTimeString()}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {session?.user?.roles?.includes('SUPERADMIN') && dept.isCustom ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(dept.departmentId, dept.departmentName)}
                                                            disabled={deletingId === dept.departmentId}
                                                        >
                                                            {deletingId === dept.departmentId
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />
                                                            }
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete custom base currency (revert to system default)</TooltipContent>
                                                </Tooltip>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
