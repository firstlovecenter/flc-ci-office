'use client';

import { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { SearchPageContent } from './search-content';

export default function SearchPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        }>
            <SearchPageContent />
        </Suspense>
    );
}
