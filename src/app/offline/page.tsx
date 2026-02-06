'use client';

import { Box, Typography, Button, Container } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function OfflinePage() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 3,
        }}
      >
        <CloudOffIcon sx={{ fontSize: 120, color: 'text.secondary', opacity: 0.5 }} />
        
        <Typography variant="h3" component="h1" gutterBottom>
          You&apos;re Offline
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          It looks like you&apos;re not connected to the internet. Some features may be limited.
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          Don&apos;t worry! Your data is safe and will sync automatically when you&apos;re back online.
        </Typography>

        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => window.location.reload()}
          size="large"
        >
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
