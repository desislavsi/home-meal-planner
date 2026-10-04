import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function getBusyButtonLabel(label: string, busy: boolean, busyLabel: string) {
  return busy ? busyLabel : label;
}

export function ActivityIndicator({ label, inline = false }: { label: string; inline?: boolean }) {
  return <span className={inline ? 'activity-indicator inline' : 'activity-indicator'} role="status" aria-live="polite"><span className="button-spinner" aria-hidden="true" />{label}</span>;
}

type BusyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  busyLabel: string;
  busy?: boolean;
  children?: ReactNode;
};

export function BusyButton({ label, busyLabel, busy = false, children, className = '', disabled, ...props }: BusyButtonProps) {
  return <button {...props} className={`${className}${busy ? ' is-busy' : ''}`} disabled={disabled || busy} aria-busy={busy}>
    {busy && <span className="button-spinner" aria-hidden="true" />}
    {getBusyButtonLabel(label, busy, busyLabel)}
    {!busy && children}
  </button>;
}
