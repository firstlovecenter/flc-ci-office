'use client';

import { useEffect, useState, useRef } from 'react';
import { Typography, TypographyProps } from '@mui/material';
import { formatMoney } from '@/lib/format-money';

interface AnimatedCounterProps extends Omit<TypographyProps, 'children'> {
    /**
     * The target value. Pass strings (preferred) or numbers. Strings preserve
     * the exact stored precision; numbers are accepted but may lose trailing
     * digits beyond JS Number precision.
     */
    value: string | number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    /** Minimum fraction digits when formatting (default 2). Stored extra precision is preserved. */
    decimals?: number;
    /** Custom formatter. Receives the *exact* target value (string when prop was string). */
    formatter?: (value: string) => string;
}

export default function AnimatedCounter({
    value,
    duration = 1000,
    prefix = '',
    suffix = '',
    decimals = 2,
    formatter,
    ...typographyProps
}: AnimatedCounterProps) {
    const targetNum = typeof value === 'number' ? value : Number(value);
    const [displayValue, setDisplayValue] = useState(0);
    const [settled, setSettled] = useState(false);
    const previousValue = useRef(0);
    const animationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const startValue = previousValue.current;
        const endValue = Number.isFinite(targetNum) ? targetNum : 0;
        const startTime = performance.now();
        setSettled(false);

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            const currentValue = startValue + (endValue - startValue) * easeOut;
            setDisplayValue(currentValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                previousValue.current = endValue;
                setSettled(true);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [targetNum, duration]);

    // Once the animation settles, render the *exact* target value (preserving
    // any precision beyond JS Number) by passing through formatMoney/formatter.
    let formattedValue: string;
    if (settled) {
        const exactStr = typeof value === 'string' ? value : String(value);
        formattedValue = formatter ? formatter(exactStr) : formatMoney(exactStr, decimals);
    } else if (formatter) {
        formattedValue = formatter(displayValue.toString());
    } else {
        formattedValue = formatMoney(displayValue, decimals);
    }

    return (
        <Typography {...typographyProps}>
            {prefix}{formattedValue}{suffix}
        </Typography>
    );
}
