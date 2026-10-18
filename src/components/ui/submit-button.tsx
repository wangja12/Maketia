"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  variant = "primary",
  className,
  disabled,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} pending={pending} disabled={disabled} className={className}>
      {children}
    </Button>
  );
}
