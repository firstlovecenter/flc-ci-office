'use client';

import { useMemo } from 'react';
import { useColorMode } from '@/app/providers';

/**
 * One chart palette for the whole app, read from the design tokens.
 *
 * Replaces the three divergent hardcoded palettes that previously lived in
 * dashboard, reports and analytics — two of which used a slate ramp unrelated
 * to the app's actual border and muted colours.
 *
 * Recharts needs concrete colour strings rather than CSS custom properties for
 * SVG fills, so tokens are resolved to `hsl(...)` here.
 */
export function useChartTheme() {
    const { resolvedMode } = useColorMode();
    const isDark = resolvedMode === 'dark';

    return useMemo(() => {
        const t = (name: string, alpha?: number) =>
            alpha === undefined ? `hsl(var(--${name}))` : `hsl(var(--${name}) / ${alpha})`;

        return {
            isDark,
            /** Ordered series palette — use for any categorical breakdown. */
            series: [t('chart-1'), t('chart-2'), t('chart-3'), t('chart-4'), t('chart-5')],
            income: t('success'),
            expense: t('destructive'),
            net: t('accounts'),
            grid: t('border'),
            axis: t('border'),
            tick: t('muted-foreground'),
            label: t('foreground'),
            tooltipBg: t('card'),
            tooltipBorder: t('border'),
            cursor: t('foreground', 0.04),
            tooltipStyle: {
                backgroundColor: t('card'),
                border: `1px solid ${t('border')}`,
                borderRadius: 10,
                fontSize: '0.8125rem',
                color: t('card-foreground'),
            } as const,
            labelStyle: {
                color: t('foreground'),
                fontWeight: 600,
            } as const,
        };
    }, [isDark]);
}
