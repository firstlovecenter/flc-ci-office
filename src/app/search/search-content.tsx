'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Typography, Paper, CircularProgress, Chip, Divider, List, ListItem, ListItemText, ListItemIcon, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { format } from 'date-fns';

interface SearchResult {
    type: 'user' | 'transaction' | 'department';
    id: string;
    title: string;
    subtitle: string;
    status?: string;
    date?: string;
    url: string;
}

export function SearchPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const query = searchParams.get('q');
    
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (query) {
            performSearch(query);
        }
    }, [query]);

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                setResults(data.results);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'user': return <PersonIcon />;
            case 'department': return <BusinessIcon />;
            case 'transaction': return <ReceiptIcon />;
            default: return <PersonIcon />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'user': return theme.palette.info.main;
            case 'department': return theme.palette.primary.main;
            case 'transaction': return theme.palette.success.main;
            default: return theme.palette.text.secondary;
        }
    };

    return (
        <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Search Results for "{query}"
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {results.length > 0 ? (
                        <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
                            {results.map((result, index) => (
                                <React.Fragment key={`${result.type}-${result.id}`}>
                                    <ListItem 
                                        alignItems="flex-start"
                                        component="div"
                                        sx={{ 
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                            '&:hover': { bgcolor: theme.palette.action.hover }
                                        }}
                                        onClick={() => router.push(result.url)}
                                    >
                                        <ListItemIcon sx={{ minWidth: 50 }}>
                                            <Avatar sx={{ bgcolor: getColor(result.type) }}>
                                                {getIcon(result.type)}
                                            </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                        {result.title}
                                                    </Typography>
                                                    <Chip 
                                                        label={result.type} 
                                                        size="small" 
                                                        sx={{ 
                                                            height: 20, 
                                                            fontSize: '0.7rem', 
                                                            textTransform: 'capitalize',
                                                            bgcolor: theme.palette.action.selected 
                                                        }} 
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                                                    <Typography variant="body2" color="text.primary" component="span">
                                                        {result.subtitle}
                                                    </Typography>
                                                    {result.status && (
                                                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Status: {result.status} • {result.date ? format(new Date(result.date), 'MMM d, yyyy') : ''}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                        <ArrowForwardIosIcon sx={{ fontSize: 16, color: 'text.disabled', alignSelf: 'center', ml: 1 }} />
                                    </ListItem>
                                    {index < results.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                    ) : (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary">
                                No results found
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Try adjusting your search or filter to find what you're looking for.
                            </Typography>
                        </Paper>
                    )}
                </>
            )}
        </Box>
    );
}
