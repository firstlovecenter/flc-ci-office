'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

export default function DepartmentRedirect() {
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const id = typeof params.id === 'string' ? params.id : params.id?.[0];
        if (id) {
            // Set cookie and redirect to the clean URL
            document.cookie = `activeDepartmentId=${id}; path=/; max-age=86400`;
            router.replace('/departments/dashboard');
        } else {
            router.push('/departments');
        }
    }, [params, router]);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <CircularProgress />
        </Box>
    );
}
