'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
    Button,
    IconButton,
    Chip,
    TextField,
    MenuItem,
    Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';

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
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
    
    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [parentFilter, setParentFilter] = useState('');

    useEffect(() => {
        fetchDepartments();
        fetchAllDepartments();
    }, [parentParam]);

    const fetchDepartments = async () => {
        try {
            const response = await fetch(`/api/departments?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });
            if (response.ok) {
                const data = await response.json();
                console.log('Fetched departments:', data);
                // Filter by parent if parentParam is present
                if (parentParam) {
                    const filtered = data.filter((dept: any) => dept.parentId === parentParam);
                    setDepartments(filtered);
                } else {
                    setDepartments(data);
                }
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
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
            console.error('Error fetching all departments:', error);
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
                fetchDepartments();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete department');
            }
        } catch (error) {
            console.error('Error deleting department:', error);
            alert('Error deleting department');
        }
    };

    const handleSaveEdit = () => {
        fetchDepartments();
        fetchAllDepartments();
    };

    // Filter departments based on search and filters
    const filteredDepartments = departments.filter((dept: any) => {
        const matchesSearch = searchQuery === '' || 
            dept.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesLevel = levelFilter === '' || dept.level === levelFilter;
        
        const matchesParent = parentFilter === '' || 
            (parentFilter === 'none' ? dept.parentId === null : dept.parentId === parentFilter);
        
        return matchesSearch && matchesLevel && matchesParent;
    });

    const handleClearFilters = () => {
        setSearchQuery('');
        setLevelFilter('');
        setParentFilter('');
    };

    const levels = ['INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'DISTRICT', 'LOCAL'];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Departments</Typography>
                <Link href="/departments/new">
                    <Button variant="contained" startIcon={<AddIcon />}>
                        Add Department
                    </Button>
                </Link>
            </Box>

            {/* Filter Section */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FilterListIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Filters</Typography>
                </Box>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField
                            label="Search by name"
                            variant="outlined"
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Enter department name..."
                            sx={{ minWidth: 200, flex: 1 }}
                        />
                        <TextField
                            select
                            label="Level"
                            variant="outlined"
                            size="small"
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            sx={{ minWidth: 150, flex: 1 }}
                        >
                            <MenuItem value="">All Levels</MenuItem>
                            {levels.map((level) => (
                                <MenuItem key={level} value={level}>
                                    {level}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Parent Department"
                            variant="outlined"
                            size="small"
                            value={parentFilter}
                            onChange={(e) => setParentFilter(e.target.value)}
                            sx={{ minWidth: 200, flex: 1 }}
                        >
                            <MenuItem value="">All Parents</MenuItem>
                            <MenuItem value="none">No Parent (Top Level)</MenuItem>
                            {allDepartments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Button
                            variant="outlined"
                            onClick={handleClearFilters}
                            sx={{ height: '40px' }}
                        >
                            Clear Filters
                        </Button>
                    </Box>
                </Stack>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Showing {filteredDepartments.length} of {departments.length} departments
                    </Typography>
                </Box>
            </Paper>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Level</TableCell>
                            <TableCell>Parent Department</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredDepartments.map((dept: any) => (
                            <TableRow 
                                key={dept.id}
                                sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    }
                                }}
                                onClick={() => router.push(`/departments/${dept.id}/dashboard`)}
                            >
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>
                                    <Chip label={dept.level} size="small" color="primary" variant="outlined" />
                                </TableCell>
                                <TableCell>{dept.parent?.name || '-'}</TableCell>
                                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                    <IconButton 
                                        size="small" 
                                        color="primary"
                                        onClick={() => handleEdit(dept)}
                                        title="Edit department"
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton 
                                        size="small" 
                                        color="info"
                                        onClick={() => router.push(`/departments/${dept.id}/dashboard`)}
                                        title="View dashboard"
                                    >
                                        <OpenInNewIcon />
                                    </IconButton>
                                    {session?.user.role === 'SUPERADMIN' && (
                                        <IconButton 
                                            size="small" 
                                            color="error"
                                            onClick={() => handleDelete(dept.id)}
                                            title="Delete department"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredDepartments.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    {departments.length === 0 ? 'No departments found' : 'No departments match the current filters'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <EditDepartmentDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                department={selectedDepartment}
                departments={allDepartments}
                onSave={handleSaveEdit}
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
