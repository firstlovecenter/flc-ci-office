'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { User, Building2, Receipt, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SearchResult {
    type: 'user' | 'transaction' | 'organisation';
    id: string;
    title: string;
    subtitle: string;
    status?: string;
    date?: string;
    url: string;
}

const typeIcon = (type: string) => {
    if (type === 'user') return User;
    if (type === 'organisation') return Building2;
    return Receipt;
};

const typeBgColor = (type: string) => {
    if (type === 'user') return 'bg-blue-500/10 text-blue-500';
    if (type === 'organisation') return 'bg-primary/10 text-primary';
    return 'bg-success/10 text-success';
};

export function SearchPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (query) performSearch(query);
    }, [query]);

    const performSearch = async (q: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); setSearched(true); }
    };

    return (
        <div className="p-4 max-w-[800px] mx-auto">
            <h1 className="text-[1.25rem] font-semibold tracking-tight text-foreground mb-6">
                Search results for &ldquo;{query}&rdquo;
            </h1>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : results.length > 0 ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {results.map((result, i) => {
                        const Icon = typeIcon(result.type);
                        return (
                            <button
                                key={`${result.type}-${result.id}`}
                                onClick={() => router.push(result.url)}
                                className={cn(
                                    'w-full text-left flex items-center gap-3 px-4 py-3.5',
                                    'hover:bg-muted/20 transition-colors duration-100',
                                    i > 0 && 'border-t border-border',
                                )}
                            >
                                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', typeBgColor(result.type))}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 justify-between">
                                        <p className="font-semibold text-foreground truncate">{result.title}</p>
                                        <Badge variant="secondary" className="capitalize text-xs shrink-0">{result.type === 'organisation' ? 'church' : result.type}</Badge>
                                    </div>
                                    <p className="text-sm text-foreground mt-0.5 truncate">{result.subtitle}</p>
                                    {result.status && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Status: {result.status}
                                            {result.date ? ` · ${format(new Date(result.date), 'MMM d, yyyy')}` : ''}
                                        </p>
                                    )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                        );
                    })}
                </div>
            ) : searched ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-lg font-medium text-muted-foreground">No results found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Try adjusting your search to find what you&apos;re looking for.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
