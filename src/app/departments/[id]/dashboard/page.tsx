'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DepartmentRedirect() {
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const id = typeof params.id === 'string' ? params.id : params.id?.[0];
        if (id) {
            document.cookie = `activeDepartmentId=${id}; path=/; max-age=86400`;
            router.replace('/departments/dashboard');
        } else {
            router.push('/departments');
        }
    }, [params, router]);

    return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
    );
}
