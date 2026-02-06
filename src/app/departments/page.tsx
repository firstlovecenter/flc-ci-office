'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Box,
    Typography,
    Button,
    TextField,
    Card,
    CardActionArea,
    Avatar,
    InputAdornment,
    IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';
import { formatDepartmentLevel } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';

type Department = {
    id: string;
    name: string;
    level: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
};
import { useSession } from 'next-auth/react';

function DepartmentsPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const { showSuccess, showError } = useToast();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [parentDepartment, setParentDepartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
    
    // Filter state
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (session) {
            fetchDepartments(parentParam);
            fetchAllDepartments();
        }
        if (parentParam) {
            fetchParentDepartment();
        } else {
            setParentDepartment(null);
        }
    }, [parentParam, session]);

    const fetchParentDepartment = async () => {
        if (!parentParam) return;
        try {
            const response = await fetch(`/api/departments/${parentParam}?t=${Date.now()}`, {
                cache: 'no-store',
            });
            if (response.ok) {
                const data = await response.json();
                setParentDepartment(data);
            }
        } catch (error) {
        }
    };

    const fetchDepartments = async (currentParentParam: string | null) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/departments?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Filter by parent if parentParam is present
                if (currentParentParam) {
                    const filtered = data.filter((dept: any) => dept.parentId === currentParentParam);
                    setDepartments(filtered);
                } else {
                    // No parent param - show all departments the user has access to
                    // The API already filters by user's permissions, so just show all
                    setDepartments(data);
                }
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const fetchAllDepartments = async () => {
        try {
            const response = await fetch(`/api/departments?all=true&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });
            if (response.ok) {
                const data = await response.json();
                setAllDepartments(data);
            }
        } catch (error) {
        }
    };

    const handleEdit = (dept: any) => {
        setSelectedDepartment(dept);
        setEditDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this department?')) {
            return;
        }

        try {
            const response = await fetch(`/api/departments/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                showSuccess('Department deleted successfully');
                fetchDepartments(parentParam);
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to delete department');
            }
        } catch (error) {
            showError('Error deleting department');
        }
    };

    const handleSaveEdit = () => {
        showSuccess('Department updated successfully');
        fetchDepartments(parentParam);
        fetchAllDepartments();
    };

    const handleDepartmentClosed = () => {
        // Redirect to the parent department list or main departments page
        if (parentParam) {
            // If viewing a parent's children, go back to main departments
            router.push('/departments');
        } else {
            // Just refresh the current list
            fetchDepartments(parentParam);
            fetchAllDepartments();
        }
    };

    // Filter departments based on search
    const filteredDepartments = departments.filter((dept: any) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        
        // Search by name or leader name
        const leaderName = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user?.name || '';
        const adminName = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user?.name || '';
        
        return dept.name.toLowerCase().includes(query) ||
            leaderName.toLowerCase().includes(query) ||
            adminName.toLowerCase().includes(query);
    }).sort((a: any, b: any) => {
        // Sort by most active (transaction count) descending
        const aTransactions = a._count?.transactions || 0;
        const bTransactions = b._count?.transactions || 0;
        return bTransactions - aTransactions;
    });

    // Get sub-department level name for display
    const getSubLevelName = (level: string) => {
        const levelMap: Record<string, string> = {
            'DENOMINATION': 'Oversights',
            'OVERSIGHT': 'Campuses',
            'CAMPUS': 'Streams',
            'STREAM': 'Councils',
            'COUNCIL': 'Councils',
        };
        return levelMap[level] || 'Sub-churches';
    };

    // Get parent leader and admin
    const getParentLeader = () => {
        if (!parentDepartment?.userRoles) return null;
        const leaderRole = parentDepartment.userRoles.find((ur: any) => ur.role?.includes('LEADER'));
        return leaderRole?.user;
    };

    const getParentAdmin = () => {
        if (!parentDepartment?.userRoles) return null;
        const adminRole = parentDepartment.userRoles.find((ur: any) => ur.role?.includes('ADMIN'));
        return adminRole?.user;
    };

    const parentLeader = getParentLeader();
    const parentAdmin = getParentAdmin();

    const levels = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS', 'STREAM', 'COUNCIL'];

    const isLeader = session?.user?.role?.includes('LEADER');
    const canCreateDepartment = !isLeader; // Only admins and superadmin can create

    const handleRefresh = () => {
        fetchDepartments(parentParam);
        if (parentParam) fetchParentDepartment();
        fetchAllDepartments();
    };

    return (
        <Box>
            {/* Back and Refresh Buttons - show when viewing sub-churches */}
            {parentParam && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <IconButton 
                        onClick={() => router.back()}
                        sx={{ 
                            color: 'text.secondary',
                            '&:hover': { color: 'text.primary' }
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <IconButton 
                        onClick={handleRefresh}
                        sx={{ 
                            color: 'text.secondary',
                            '&:hover': { color: 'text.primary' }
                        }}
                    >
                        <RefreshIcon />
                    </IconButton>
                </Box>
            )}

            {/* Header Section */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                        <Typography variant="h5" fontWeight="700">
                            {parentDepartment ? `${parentDepartment.name} ${getSubLevelName(parentDepartment.level)}` : 'Churches'}
                        </Typography>
                        {parentLeader && (
                            <Typography variant="body2" color="text.secondary">
                                <Box component="span" sx={{ color: 'warning.main' }}>Overseer:</Box>{' '}
                                <Box component="span" sx={{ color: 'text.primary' }}>{parentLeader.name || parentLeader.email}</Box>
                            </Typography>
                        )}
                        {parentAdmin && (
                            <Typography variant="body2" color="text.secondary">
                                <Box component="span" sx={{ color: 'warning.main' }}>Admin:</Box>{' '}
                                <Box component="span" sx={{ color: 'text.primary' }}>{parentAdmin.name || parentAdmin.email}</Box>
                            </Typography>
                        )}
                    </Box>
                    {canCreateDepartment && (
                        <Link href={parentParam ? `/departments/new?parent=${parentParam}` : '/departments/new'}>
                            <Button variant="contained" startIcon={<AddIcon />} size="small">
                                Add New
                            </Button>
                        </Link>
                    )}
                </Box>
            </Box>

            {/* Stats Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Box>
                    <Typography variant="caption" color="text.secondary">
                        {parentDepartment ? getSubLevelName(parentDepartment.level) : 'Churches'}
                    </Typography>
                    <Typography variant="h4" fontWeight="700" color="primary.main">
                        {departments.length}
                    </Typography>
                </Box>
            </Box>

            {/* Search Bar */}
            <TextField
                fullWidth
                placeholder={parentDepartment 
                    ? `Search ${getSubLevelName(parentDepartment.level)} or Leader` 
                    : 'Search Churches or Leader'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    ),
                }}
                sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                    }
                }}
                size="small"
            />

            {/* Church Cards List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filteredDepartments.map((dept: any) => {
                    const leader = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                    const admin = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
                    const subDeptCount = dept._count?.children || 0;
                    
                    return (
                        <Card 
                            key={dept.id}
                            sx={{ 
                                borderRadius: 2,
                                boxShadow: 1,
                                '&:hover': {
                                    boxShadow: 3,
                                },
                            }}
                        >
                            <CardActionArea 
                                onClick={() => router.push(`/departments/${dept.id}/dashboard`)}
                                sx={{ py: 1.5, px: 2 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar
                                        src={leader?.image || undefined}
                                        sx={{
                                            width: 50,
                                            height: 50,
                                            bgcolor: 'primary.main',
                                            fontSize: '1.25rem',
                                        }}
                                    >
                                        {leader?.name?.[0]?.toUpperCase() || dept.name[0]?.toUpperCase() || 'D'}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography 
                                            variant="subtitle1" 
                                            fontWeight={600}
                                            sx={{ 
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {dept.name} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{formatDepartmentLevel(dept.level)}</Box>
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                                            {leader && (
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ color: 'success.main' }}
                                                >
                                                    {leader.name || leader.email}
                                                </Typography>
                                            )}
                                            {admin && (
                                                <Typography 
                                                    variant="body2" 
                                                    color="text.secondary"
                                                >
                                                    {leader ? ' | ' : ''}<Box component="span" sx={{ color: 'warning.main' }}>Admin:</Box> {admin.name || admin.email}
                                                </Typography>
                                            )}
                                        </Box>
                                        {subDeptCount > 0 && (
                                            <Typography 
                                                variant="caption" 
                                                color="text.secondary"
                                            >
                                                {subDeptCount} {getSubLevelName(dept.level)}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </CardActionArea>
                        </Card>
                    );
                })}
                {filteredDepartments.length === 0 && !loading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                            {departments.length === 0 
                                ? 'No churches found' 
                                : 'No churches match your search'
                            }
                        </Typography>
                    </Box>
                )}
            </Box>

            <EditDepartmentDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                department={selectedDepartment}
                departments={allDepartments}
                onSave={handleSaveEdit}
                onDepartmentClosed={handleDepartmentClosed}
            />
        </Box>
    );
}

export default function DepartmentsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DepartmentsPageContent />
        </Suspense>
    );
}
