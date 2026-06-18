import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ThinkingContentProps {
  children: ReactNode;
  className?: string;
}

export function ThinkingContent({ children, className }: ThinkingContentProps) {
  return (
    <div
      className={cn(
        "max-h-36 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground",
        "[mask-image:linear-gradient(to_bottom,transparent,black_1rem,black_calc(100%-1rem),transparent)]",
        "[-webkit-mask-image:linear-gradient(to_bottom,transparent,black_1rem,black_calc(100%-1rem),transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
