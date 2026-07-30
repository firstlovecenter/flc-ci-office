'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function OrganisationRedirect() {
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const id = typeof params.id === 'string' ? params.id : params.id?.[0];
        if (id) {
            document.cookie = `activeOrganisationId=${id}; path=/; max-age=86400`;
            router.replace('/organisations/dashboard');
        } else {
            router.push('/organisations');
        }
    }, [params, router]);

    return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
    );
}
