'use client';

import { useEffect, useState, useRef } from 'react';
import { Typography, TypographyProps } from '@mui/material';

interface AnimatedCounterProps extends Omit<TypographyProps, 'children'> {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    formatter?: (value: number) => string;
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
    const [displayValue, setDisplayValue] = useState(0);
    const previousValue = useRef(0);
    const animationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const startValue = previousValue.current;
        const endValue = value;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const currentValue = startValue + (endValue - startValue) * easeOut;
            setDisplayValue(currentValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                previousValue.current = endValue;
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [value, duration]);

    const formattedValue = formatter 
        ? formatter(displayValue)
        : displayValue.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });

    return (
        <Typography {...typographyProps}>
            {prefix}{formattedValue}{suffix}
        </Typography>
    );
}
