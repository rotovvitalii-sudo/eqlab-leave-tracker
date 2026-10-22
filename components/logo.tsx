import { cn } from "@/lib/utils";

// Логотип у стилі eql.systems: «EQLa/b» зі слешем акцентного кольору.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-bold text-foreground", className)}>
      EQLa<span className="text-primary">/</span>b
    </span>
  );
}
