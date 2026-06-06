'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import AutoLogout from '@/components/AutoLogout';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ColorModeContextType {
  toggleColorMode: () => void;
  setMode: (mode: ThemeMode) => void;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
}

const ColorModeContext = createContext<ColorModeContextType>({
  toggleColorMode: () => {},
  setMode: () => {},
  mode: 'system',
  resolvedMode: 'light',
});

export const useColorMode = () => useContext(ColorModeContext);

function ThemeManager({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  // Sync resolved mode and apply .dark class to <html>
  useEffect(() => {
    const applyTheme = (resolved: 'light' | 'dark') => {
      setResolvedMode(resolved);
      const html = document.documentElement;
      if (resolved === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    };

    const savedMode = (localStorage.getItem('themeMode') as ThemeMode) || 'system';
    setModeState(savedMode);

    if (savedMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(savedMode);
    }
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('themeMode', newMode);

    if (newMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = isDark ? 'dark' : 'light';
      setResolvedMode(resolved);
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      setResolvedMode(newMode);
      document.documentElement.classList.toggle('dark', newMode === 'dark');
    }
  };

  const toggleColorMode = () => {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
  };

  return (
    <ColorModeContext.Provider value={{ toggleColorMode, setMode, mode, resolvedMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

const SESSION_REFRESH_INTERVAL_SECONDS = 300;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={SESSION_REFRESH_INTERVAL_SECONDS} refetchOnWindowFocus={true}>
      <ThemeManager>
        <AutoLogout />
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'bg-card border border-border text-foreground shadow-lg rounded-xl',
              title: 'font-semibold text-foreground',
              description: 'text-muted-foreground text-sm',
              success: 'border-success/30 [&_[data-icon]]:text-success',
              error: 'border-destructive/30 [&_[data-icon]]:text-destructive',
            },
          }}
        />
        {children}
      </ThemeManager>
    </SessionProvider>
  );
}
