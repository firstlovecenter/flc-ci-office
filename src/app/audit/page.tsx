'use client';

import { useState, useEffect } from 'react';
import { Search, History, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AuditLog = {
    id: string;
    userId: string;
    user: { name: string | null; email: string };
    actionType: string;
    entityType: string;
    entityId: string;
    beforeData: any;
    afterData: any;
    timestamp: string;
    ipAddress: string | null;
};

const actionBadgeVariant = (action: string): 'default' | 'destructive' | 'success' | 'warning' | 'secondary' => {
    if (action === 'CREATE') return 'success';
    if (action === 'DELETE') return 'destructive';
    if (action === 'UPDATE') return 'default';
    if (action === 'LOGIN') return 'secondary';
    return 'warning';
};

export default function AuditPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [entityFilter, setEntityFilter] = useState('ALL');
    const [page, setPage] = useState(0);
    const [rowsPerPage] = useState(25);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        if (session?.user?.role && session.user.role !== 'SUPERADMIN') router.push('/dashboard');
    }, [session, router]);

    useEffect(() => { fetchLogs(); }, []);

    useEffect(() => {
        let filtered = [...logs];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(l =>
                l.user?.name?.toLowerCase().includes(q) ||
                l.user?.email?.toLowerCase().includes(q) ||
                l.entityType.toLowerCase().includes(q) ||
                l.entityId.toLowerCase().includes(q)
            );
        }
        if (actionFilter !== 'ALL') filtered = filtered.filter(l => l.actionType === actionFilter);
        if (entityFilter !== 'ALL') filtered = filtered.filter(l => l.entityType === entityFilter);
        setFilteredLogs(filtered);
        setPage(0);
    }, [logs, searchTerm, actionFilter, entityFilter]);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/audit');
            if (res.ok) setLogs(await res.json());
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    if (!session || session.user.role !== 'SUPERADMIN') return null;

    const paged = filteredLogs.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

    return (
        <div className="px-4 sm:px-6 md:px-8 py-6">
            {/* Header */}
            <div className="flex items-start gap-4 mb-8 pb-6 border-b border-border flex-wrap">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                    <History className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">System</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Audit trail</h1>
                    <p className="text-sm text-muted-foreground mt-1">Every system action and change, with full attribution.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Action" /></SelectTrigger>
                    <SelectContent>
                        {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'ROLE_CHANGE', 'LOCK_OVERRIDE', 'FILE_UPLOAD'].map(v => (
                            <SelectItem key={v} value={v}>{v === 'ALL' ? 'All Actions' : v.replace('_', ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Entity" /></SelectTrigger>
                    <SelectContent>
                        {[['ALL', 'All Entities'], ['Transaction', 'Transaction'], ['User', 'User'], ['Department', 'Department']].map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : paged.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                        No audit logs found
                    </div>
                ) : paged.map(log => (
                    <button
                        key={log.id}
                        onClick={() => { setSelectedLog(log); setDetailsOpen(true); }}
                        className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 transition-colors w-full"
                    >
                        <div className="flex justify-between items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate">{log.user?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(log.timestamp).toLocaleString()} · {log.entityType}
                                </p>
                            </div>
                            <Badge variant={actionBadgeVariant(log.actionType)}>{log.actionType}</Badge>
                        </div>
                    </button>
                ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/30">
                                {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address'].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : paged.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : paged.map(log => (
                                <tr
                                    key={log.id}
                                    className="border-t border-border hover:bg-muted/20 cursor-pointer transition-colors"
                                    onClick={() => { setSelectedLog(log); setDetailsOpen(true); }}
                                >
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-foreground">{log.user?.name || 'Unknown'}</p>
                                        <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={actionBadgeVariant(log.actionType)}>{log.actionType}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-foreground">{log.entityType}</td>
                                    <td className="px-4 py-3">
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                            {log.entityId.substring(0, 8)}…
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{log.ipAddress || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {!loading && filteredLogs.length > rowsPerPage && (
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-xs text-muted-foreground">
                        Showing {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, filteredLogs.length)} of {filteredLogs.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                        <Button variant="outline" size="icon-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Detail dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Audit Log Details</DialogTitle></DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Action</p>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-foreground">{selectedLog.actionType}</p>
                                    <Badge variant={actionBadgeVariant(selectedLog.actionType)}>{selectedLog.actionType}</Badge>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">User</p>
                                <p className="text-foreground">{selectedLog.user?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{selectedLog.user?.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Date & Time</p>
                                <p className="text-foreground">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Entity Type</p>
                                    <p className="text-foreground">{selectedLog.entityType}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Entity ID</p>
                                    <p className="text-xs font-mono text-foreground break-all">{selectedLog.entityId}</p>
                                </div>
                            </div>
                            {selectedLog.ipAddress && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                                    <p className="text-foreground">{selectedLog.ipAddress}</p>
                                </div>
                            )}
                            {(selectedLog.beforeData || selectedLog.afterData) && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">Changes</p>
                                    <div className="rounded-lg border border-border bg-background p-3 max-h-[180px] overflow-auto">
                                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                                            {JSON.stringify({ before: selectedLog.beforeData, after: selectedLog.afterData }, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
