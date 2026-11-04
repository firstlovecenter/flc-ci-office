import { createElement, Fragment, type ReactNode } from 'react';
import { sileo } from 'sileo';
import type { SileoOptions } from 'sileo';

type ToastState = 'success' | 'error' | 'warning' | 'info';

type ToastOptions = {
  description?: ReactNode;
  duration?: number;
  /**
   * Toasts share one pill by default, so each new toast morphs the current
   * one. Giving an id keeps a separate pill, and showing that id again morphs
   * it in place.
   */
  id?: string | number;
  /** Replaces the state's default badge icon. */
  icon?: ReactNode;
  /** Optional call-to-action shown inside the expanded toast. */
  action?: { label: string; onClick: () => void };
};

type SettleOptions = Omit<ToastOptions, 'id'>;

// Sileo reads `id` at runtime (it is how its own promise() morphs the loading
// toast) but leaves it out of the published type.
type SileoToastOptions = SileoOptions & { id?: string };

// Sileo's title is one non-wrapping line in a 350px pill. Most of our messages
// fit, but plenty of error strings are whole sentences and would be clipped, so
// those move into the expandable description under a short label instead.
const TITLE_MAX = 36;

const STATE_LABEL: Record<ToastState, string> = {
  success: 'Done',
  error: 'Something went wrong',
  warning: 'Heads up',
  info: 'Notice',
};

// A long message keeps its place as the first line, above its description.
function describe(message: string, description: ReactNode): ReactNode {
  if (description === undefined || description === null) return message;
  return createElement(
    Fragment,
    null,
    createElement('span', { style: { display: 'block', fontWeight: 500 } }, message),
    description
  );
}

function toSileo(title: string, label: string, options?: ToastOptions): SileoToastOptions {
  const long = title.length > TITLE_MAX;
  return {
    title: long ? label : title,
    description: long ? describe(title, options?.description) : options?.description,
    duration: options?.duration,
    icon: options?.icon,
    id: options?.id === undefined ? undefined : String(options.id),
    button: options?.action && {
      title: options.action.label,
      onClick: options.action.onClick,
    },
  };
}

function show(state: ToastState, message: string, options?: ToastOptions): string {
  return sileo[state](toSileo(message, STATE_LABEL[state], options));
}

export interface LoadingToast {
  success: (message: string, options?: SettleOptions) => void;
  error: (message: string, options?: SettleOptions) => void;
  warning: (message: string, options?: SettleOptions) => void;
  info: (message: string, options?: SettleOptions) => void;
  dismiss: () => void;
}

let loadingSeq = 0;

/**
 * Shows a spinner that stays up until the work settles, then morphs into the
 * outcome. Use it where one action can end several ways (sent, queued
 * offline, redirected); for a single promise, `toast.promise` is shorter.
 */
function loading(message: string, options?: Omit<ToastOptions, 'duration'>): LoadingToast {
  const id = String(options?.id ?? `loading-${++loadingSeq}`);
  sileo.show({
    ...toSileo(message, 'Working…', { ...options, id }),
    type: 'loading',
    duration: null,
  });
  const settle = (state: ToastState) => (next: string, nextOptions?: SettleOptions) => {
    show(state, next, { ...nextOptions, id });
  };
  return {
    success: settle('success'),
    error: settle('error'),
    warning: settle('warning'),
    info: settle('info'),
    dismiss: () => sileo.dismiss(id),
  };
}

function dismiss(id?: string | number) {
  if (id === undefined) sileo.clear();
  else sileo.dismiss(String(id));
}

/** Sonner-compatible toast API backed by Sileo. */
export const toast = Object.assign(
  (message: string, options?: ToastOptions) => show('info', message, options),
  {
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    info: (message: string, options?: ToastOptions) => show('info', message, options),
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    loading,
    promise: sileo.promise,
    dismiss,
  }
);
