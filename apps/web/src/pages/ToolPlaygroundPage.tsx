import { BlocksIcon, ChevronLeftIcon } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ToolPlaygroundPanel } from "@/components/tools/ToolPlaygroundPanel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { useProfilesQuery, useToolQuery } from "@/hooks/use-app-queries";
import { formatError } from "@/lib/client";
import {
  canAccessSystemPage,
  canUseToolPlayground,
  toolsTabPath,
} from "@/lib/navigation";
import { findSuperBotProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

const sectionClass = "rounded-md border border-border bg-card";

export function ToolPlaygroundPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const { user, activeOrg, isLoading: authLoading } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const canAccess = canAccessSystemPage(isPlatformAdmin, activeOrg?.role);
  const canUsePlayground = canUseToolPlayground(isPlatformAdmin, activeOrg?.role);

  const {
    data: tool,
    isLoading: toolLoading,
    error: toolError,
  } = useToolQuery(toolId ?? null);
  const { data: profiles = [] } = useProfilesQuery();
  const superBotProfileId = findSuperBotProfile(profiles)?.id ?? null;

  if (authLoading) {
    return <PageState message="Loading…" />;
  }

  if (!canAccess || !canUsePlayground) {
    return <Navigate to="/chat" replace />;
  }

  if (!toolId) {
    return <Navigate to={toolsTabPath()} replace />;
  }

  if (toolLoading && !tool) {
    return <PageState message="Loading tool…" />;
  }

  if (toolError && !tool) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formatError(toolError)}
        </p>
      </div>
    );
  }

  if (!tool) {
    return <Navigate to={toolsTabPath()} replace />;
  }

  const isJavascriptTool = tool.handlerType === "javascript";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink />

      <header className={cn(sectionClass, "space-y-3 p-5 sm:p-6")}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-emerald-700 dark:text-emerald-300">
            <BlocksIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="type-section-title">{tool.name}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {tool.handlerType}
          </span>
          <span className="type-code text-xs text-muted-foreground">{tool.id}</span>
        </div>
      </header>

      {isJavascriptTool ? (
        <ToolPlaygroundPanel
          tool={tool}
          superBotProfileId={superBotProfileId}
          showHeader={false}
        />
      ) : (
        <p
          className="rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          Playground is available for custom JavaScript tools only. Built-in and MCP tools cannot
          be run here.{" "}
          <Link to={toolsTabPath()} className="font-medium underline underline-offset-2">
            Back to tools
          </Link>
        </p>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link to={toolsTabPath()} />}>
      <ChevronLeftIcon className="size-4" aria-hidden />
      Tools
    </Button>
  );
}

function PageState({ message }: { message: string }) {
  return (
    <div
      className={cn(
        sectionClass,
        "mx-auto flex min-h-64 max-w-3xl flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground",
      )}
    >
      <Spinner className="size-5" />
      {message}
    </div>
  );
}
