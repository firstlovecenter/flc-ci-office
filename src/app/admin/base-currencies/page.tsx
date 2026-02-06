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
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSession } from 'next-auth/react';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface OversightDepartment {
  departmentId: string;
  departmentName: string;
  baseCurrency: Currency | null;
  isCustom: boolean;
  setBy: {
    name: string;
    email: string;
  } | null;
  setAt: string | null;
}

export default function BaseCurrenciesAdminPage() {
  const { data: session, status } = useSession();
  const [departments, setDepartments] = useState<OversightDepartment[]>([]);
  const [systemBase, setSystemBase] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBaseCurrencies();
  }, []);

  const fetchBaseCurrencies = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/base-currencies');
      if (!response.ok) {
        throw new Error('Failed to fetch base currencies');
      }

      const data = await response.json();
      setDepartments(data.oversightDepartments);
      setSystemBase(data.systemBase);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBaseCurrency = async (departmentId: string, departmentName: string) => {
    if (!confirm(`Are you sure you want to delete the custom base currency for ${departmentName}?\n\nThe department will revert to using the system default currency.`)) {
      return;
    }

    try {
      setDeletingId(departmentId);
      const response = await fetch(`/api/admin/base-currencies?departmentId=${departmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete base currency');
      }

      // Refresh the list
      await fetchBaseCurrencies();
      alert('Base currency deleted successfully');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const customizedCount = departments.filter((d) => d.isCustom).length;
  const usingSystemCount = departments.length - customizedCount;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Oversight Base Currencies
      </Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Total Oversight Departments
          </Typography>
          <Typography variant="h4">{departments.length}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Custom Base Currency
          </Typography>
          <Typography variant="h4">{customizedCount}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Using System Default
          </Typography>
          <Typography variant="h4">{usingSystemCount}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            System Base Currency
          </Typography>
          <Typography variant="h4">
            {systemBase?.code || 'N/A'} ({systemBase?.symbol || ''})
          </Typography>
        </Paper>
      </Box>

      {/* Departments Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Department</TableCell>
              <TableCell>Base Currency</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Set By</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.departmentId}>
                <TableCell>
                  <Typography variant="body1" fontWeight="medium">
                    {dept.departmentName}
                  </Typography>
                </TableCell>
                <TableCell>
                  {dept.baseCurrency ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {dept.baseCurrency.code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({dept.baseCurrency.symbol}) - {dept.baseCurrency.name}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Not Set
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {dept.isCustom ? (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="Custom"
                      color="primary"
                      size="small"
                    />
                  ) : (
                    <Chip
                      icon={<InfoIcon />}
                      label="System Default"
                      variant="outlined"
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {dept.setBy ? (
                    <Box>
                      <Typography variant="body2">{dept.setBy.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dept.setBy.email}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {dept.setAt ? (
                    <Typography variant="body2">
                      {new Date(dept.setAt).toLocaleDateString()} at{' '}
                      {new Date(dept.setAt).toLocaleTimeString()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  {session?.user?.roles?.includes('SUPERADMIN') && dept.isCustom ? (
                    <Tooltip title="Delete custom base currency (revert to system default)">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteBaseCurrency(dept.departmentId, dept.departmentName)}
                        disabled={deletingId === dept.departmentId}
                      >
                        {deletingId === dept.departmentId ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
