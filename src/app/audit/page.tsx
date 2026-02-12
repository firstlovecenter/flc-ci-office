'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TablePagination,
    useTheme,
    useMediaQuery,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui';

type AuditLog = {
    id: string;
    userId: string;
    user: {
        name: string | null;
        email: string;
    };
    actionType: string;
    entityType: string;
    entityId: string;
    beforeData: any;
    afterData: any;
    timestamp: string;
    ipAddress: string | null;
};

export default function AuditPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [entityFilter, setEntityFilter] = useState('ALL');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    // Redirect non-superadmins
    useEffect(() => {
        if (session?.user?.role && session.user.role !== 'SUPERADMIN') {
            router.push('/dashboard');
        }
    }, [session, router]);

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        filterLogs();
    }, [logs, searchTerm, actionFilter, entityFilter]);

    const fetchLogs = async () => {
        try {
            const response = await fetch('/api/audit');
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const filterLogs = () => {
        let filtered = [...logs];

        if (searchTerm) {
            filtered = filtered.filter(
                (log) =>
                    log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.entityId.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (actionFilter !== 'ALL') {
            filtered = filtered.filter((log) => log.actionType === actionFilter);
        }

        if (entityFilter !== 'ALL') {
            filtered = filtered.filter((log) => log.entityType === entityFilter);
        }

        setFilteredLogs(filtered);
        setPage(0);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE':
                return 'success';
            case 'UPDATE':
                return 'info';
            case 'DELETE':
                return 'error';
            case 'LOGIN':
                return 'default';
            default:
                return 'warning';
        }
    };

    if (!session || session.user.role !== 'SUPERADMIN') {
        return null;
    }

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="700">
                    Audit Trail
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    View all system activity and changes
                </Typography>
            </Box>

            {/* Filters */}
            <GlassCard sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ flexGrow: 1, minWidth: 250 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Action</InputLabel>
                        <Select
                            value={actionFilter}
                            label="Action"
                            onChange={(e) => setActionFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Actions</MenuItem>
                            <MenuItem value="CREATE">Create</MenuItem>
                            <MenuItem value="UPDATE">Update</MenuItem>
                            <MenuItem value="DELETE">Delete</MenuItem>
                            <MenuItem value="LOGIN">Login</MenuItem>
                            <MenuItem value="ROLE_CHANGE">Role Change</MenuItem>
                            <MenuItem value="LOCK_OVERRIDE">Lock Override</MenuItem>
                            <MenuItem value="FILE_UPLOAD">File Upload</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Entity</InputLabel>
                        <Select
                            value={entityFilter}
                            label="Entity"
                            onChange={(e) => setEntityFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Entities</MenuItem>
                            <MenuItem value="Transaction">Transaction</MenuItem>
                            <MenuItem value="User">User</MenuItem>
                            <MenuItem value="Department">Department</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </GlassCard>

            {/* Audit Logs Table */}
            {isMobile ? (
                 <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {loading ? (
                        <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                             Loading audit logs...
                        </Typography>
                    ) : filteredLogs.length === 0 ? (
                        <GlassCard sx={{ p: 4, textAlign: 'center' }}>
                             <Typography variant="body1" color="text.secondary">
                                 No audit logs found
                             </Typography>
                        </GlassCard>
                    ) : (
                        <>
                        {filteredLogs
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((log) => (
                                <GlassCard 
                                    key={log.id} 
                                    sx={{ 
                                        p: 2,
                                        position: 'relative', 
                                        overflow: 'hidden',
                                        '&:active': { bgcolor: 'action.hover' }
                                    }}
                                    onClick={() => {
                                        setSelectedLog(log);
                                        setDetailsOpen(true);
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                                            <Typography variant="subtitle2" fontWeight={600} noWrap>
                                                {log.user?.name || 'Unknown'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(log.timestamp).toLocaleString()} • {log.entityType}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={log.actionType}
                                            color={getActionColor(log.actionType) as any}
                                            size="small"
                                        />
                                    </Box>
                                </GlassCard>
                            ))
                        }
                         <TablePagination
                            rowsPerPageOptions={[25, 50, 100]}
                            component="div"
                            count={filteredLogs.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            labelRowsPerPage="Rows:"
                        />
                        </>
                    )}
                 </Box>
            ) : (
            <TableContainer component={GlassCard}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Entity Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Entity ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>IP Address</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Loading audit logs...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((log) => (
                                    <TableRow key={log.id} hover>
                                        <TableCell>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {log.user?.name || 'Unknown'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {log.user?.email}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={log.actionType}
                                                color={getActionColor(log.actionType) as any}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{log.entityType}</TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    fontFamily: 'monospace',
                                                    bgcolor: 'action.hover',
                                                    px: 1,
                                                    py: 0.5,
                                                    borderRadius: 1,
                                                }}
                                            >
                                                {log.entityId.substring(0, 8)}...
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">
                                                {log.ipAddress || '-'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                        )}
                        {!loading && filteredLogs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No audit logs found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[25, 50, 100]}
                    component="div"
                    count={filteredLogs.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </TableContainer>
            )}

            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Audit Log Details</DialogTitle>
                <DialogContent>
                    {selectedLog && (
                        <Box sx={{ pt: 2 }}>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Action</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body1" fontWeight={600}>{selectedLog.actionType}</Typography>
                                        <Chip
                                            label={selectedLog.actionType}
                                            color={getActionColor(selectedLog.actionType) as any}
                                            size="small"
                                        />
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">User</Typography>
                                    <Typography variant="body1">{selectedLog.user?.name || 'Unknown'}</Typography>
                                    <Typography variant="caption">{selectedLog.user?.email}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                                    <Typography variant="body1">
                                        {new Date(selectedLog.timestamp).toLocaleString()}
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid size={6}>
                                        <Typography variant="caption" color="text.secondary">Entity Type</Typography>
                                        <Typography variant="body1">{selectedLog.entityType}</Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="caption" color="text.secondary">Entity ID</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                            {selectedLog.entityId}
                                        </Typography>
                                    </Grid>
                                </Grid>
                                {selectedLog.ipAddress && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">IP Address</Typography>
                                        <Typography variant="body1">{selectedLog.ipAddress}</Typography>
                                    </Box>
                                )}
                                {(selectedLog.beforeData || selectedLog.afterData) && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Changes</Typography>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', mt: 1, maxHeight: 200, overflow: 'auto' }}>
                                            <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                                                {JSON.stringify({ 
                                                    before: selectedLog.beforeData, 
                                                    after: selectedLog.afterData 
                                                }, null, 2)}
                                            </pre>
                                        </Paper>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
