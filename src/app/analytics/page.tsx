'use client';

import { useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Alert,
} from '@mui/material';
import { ShowChart as ShowChartIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AnalyticsPage() {
    const { data: session } = useSession();
    const router = useRouter();

    // Check if user has access (CAMPUS_ADMIN and above)
    const hasAccess = session?.user?.role && [
        'SUPERADMIN',
        'GLOBAL_ADMIN',
        'INTERNATIONAL_ADMIN',
        'NATIONAL_ADMIN',
        'REGIONAL_ADMIN',
        'CAMPUS_ADMIN'
    ].includes(session.user.role);

    useEffect(() => {
        if (session && !hasAccess) {
            router.push('/dashboard');
        }
    }, [session, hasAccess, router]);

    if (!hasAccess) {
        return null;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    Analytics
                </Typography>
            </Box>

            {/* Coming Soon Message */}
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 8, 
                    textAlign: 'center',
                    border: '1px solid', 
                    borderColor: 'divider',
                    borderRadius: 2
                }}
            >
                <ShowChartIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom fontWeight="600">
                    Analytics Coming Soon
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 3 }}>
                    We're working on powerful analytics features including interactive charts, 
                    trend analysis, and comprehensive financial insights. Check back soon!
                </Typography>
            </Paper>
        </Box>
    );
}
