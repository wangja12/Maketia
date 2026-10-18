import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "pressable inline-flex h-9 select-none items-center justify-center gap-2 rounded-control px-3.5 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50";

// Hover colors only on devices that really hover: touch fires a sticky hover on tap.
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-fg shadow-raised [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-surface-sunken",
  ghost:
    "text-muted [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-surface-sunken [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:text-fg",
  danger:
    "bg-danger text-white [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-danger-hover",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pending?: boolean;
};

/** `pending` keeps the label (no layout shift), adds a spinner and blocks repeat submits. */
export function Button({ variant = "primary", pending = false, className = "", children, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, className)}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="spinner size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
