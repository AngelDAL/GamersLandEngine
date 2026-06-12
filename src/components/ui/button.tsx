import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-gold text-background hover:bg-gold-hover font-bold",
  primary: "bg-blue-accent text-white hover:bg-[#0288A0]",
  ghost: "bg-transparent hover:bg-surface text-foreground",
  danger: "bg-red text-white hover:bg-[#D03047]",
  outline: "border border-gold text-gold hover:bg-gold/10",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  default: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "p-2",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
