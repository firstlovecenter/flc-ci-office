'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SearchPageContent } from './search-content';

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    );
}
