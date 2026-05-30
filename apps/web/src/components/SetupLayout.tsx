import type { ReactNode } from "react";
import { useAppContext } from "@/context/app-context";

interface SetupLayoutProps {
  children: ReactNode;
}

export function SetupLayout({ children }: SetupLayoutProps) {
  const { error } = useAppContext();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border/50 px-6 py-4">
        <img
          src="/tinyclaw.png"
          alt="TinyClaw"
          className="size-8 shrink-0 rounded-lg object-contain"
        />
        <p className="type-brand">TinyClaw</p>
      </header>

      {error ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center px-6 py-10">
        <main className="w-full max-w-lg">{children}</main>
      </div>
    </div>
  );
}
