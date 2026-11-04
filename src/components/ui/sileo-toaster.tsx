'use client';

import { Toaster as SileoToasterPrimitive } from 'sileo';
import type { ComponentProps } from 'react';
import { useColorMode } from '@/app/providers';

type SileoToasterProps = ComponentProps<typeof SileoToasterPrimitive>;

/** The same toaster BMS uses: one morphing pill, top centre. */
export function SileoToaster(props: SileoToasterProps) {
  const { resolvedMode } = useColorMode();

  return (
    <SileoToasterPrimitive
      position="top-center"
      // Sileo inverts on purpose: the light theme renders a dark pill.
      theme={resolvedMode === 'dark' ? 'dark' : 'light'}
      {...props}
    />
  );
}
