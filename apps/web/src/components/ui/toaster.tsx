import { CheckCircle2Icon } from "lucide-react";
import { useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg",
            "animate-in fade-in-0 slide-in-from-bottom-2",
          )}
        >
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-sm text-foreground">{item.message}</p>
        </div>
      ))}
    </div>
  );
}
