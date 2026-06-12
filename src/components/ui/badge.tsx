import { cn } from "@/lib/utils";

const badgeStyles = {
  default: "bg-surface text-muted border border-border",
  gold: "bg-gold/20 text-gold border border-gold/30",
  green: "bg-green/20 text-green border border-green/30",
  red: "bg-red/20 text-red border border-red/30",
  blue: "bg-blue-accent/20 text-blue-accent border border-blue-accent/30",
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof badgeStyles;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium",
        badgeStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
