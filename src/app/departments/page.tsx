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
    Button,
    IconButton,
    Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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

export default function DepartmentsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<any>(null);

    useEffect(() => {
        fetchDepartments();
        fetchAllDepartments();
    }, []);

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
                setDepartments(data);
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
                        {departments.map((dept: any) => (
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
                        {departments.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    No departments found
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
