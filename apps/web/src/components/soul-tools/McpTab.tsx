import type { CreateMcpServerRequest, McpServerSummary } from "@tinyclaw/core/contract";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { client } from "@/lib/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMcpServersQuery } from "@/hooks/use-app-queries";
import {
  useConnectMcpServerMutation,
  useCreateMcpServerMutation,
  useDeleteMcpServerMutation,
  useSyncMcpServerMutation,
} from "@/hooks/use-resource-mutations";
import { formatError } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const sectionClass = "rounded-md border border-border bg-card";

export function McpTab() {
  const queryClient = useQueryClient();
  const { data: servers = [], isLoading, error, isFetching } = useMcpServersQuery();
  const createMutation = useCreateMcpServerMutation();
  const deleteMutation = useDeleteMcpServerMutation();
  const connectMutation = useConnectMcpServerMutation();
  const syncMutation = useSyncMcpServerMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loading = isLoading && servers.length === 0;
  const refreshing = isFetching && !loading;
  const busy =
    createMutation.isPending ||
    deleteMutation.isPending ||
    connectMutation.isPending ||
    syncMutation.isPending;
  const errorMessage = actionError ?? (error ? formatError(error) : null);

  async function refresh() {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
  }

  async function handleDelete(server: McpServerSummary) {
    if (
      !window.confirm(
        `Delete MCP server "${server.name}"? This removes it from every profile.`,
      )
    ) {
      return;
    }

    setActionError(null);

    try {
      await deleteMutation.mutateAsync(server.id);
    } catch (err) {
      setActionError(formatError(err));
    }
  }

  async function handleConnect(serverId: string) {
    setActionError(null);

    try {
      await connectMutation.mutateAsync(serverId);
    } catch (err) {
      setActionError(formatError(err));
    }
  }

  async function handleSync(serverId: string) {
    setActionError(null);

    try {
      await syncMutation.mutateAsync(serverId);
    } catch (err) {
      setActionError(formatError(err));
    }
  }

  if (loading) {
    return <PageState message="Loading MCP servers…" />;
  }

  return (
    <>
      {errorMessage ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <section className={cn(sectionClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h2 className="type-section-title">MCP servers</h2>
            <p className="type-body mt-1 text-xs">
              {servers.length === 0
                ? "No MCP servers registered yet"
                : `${servers.length} registered`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || refreshing}
              aria-label="Refresh MCP servers"
              onClick={() => void refresh()}
            >
              {refreshing ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCwIcon className="size-4" aria-hidden />
              )}
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" aria-hidden />
              Add server
            </Button>
          </div>
        </div>

        {servers.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Register MCP servers here, then assign them to profiles on the Profiles page.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {servers.map((server) => (
              <li key={server.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{server.name}</p>
                      <StatusBadge status={server.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {server.toolCount} tool{server.toolCount === 1 ? "" : "s"}
                      {server.lastError ? ` · ${server.lastError}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleConnect(server.id)}
                    >
                      <PlugIcon className="size-4" aria-hidden />
                      Connect
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleSync(server.id)}
                    >
                      Sync
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleDelete(server)}
                    >
                      <Trash2Icon className="size-4" aria-hidden />
                      Delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={expandedId === server.id ? "Collapse tools" : "Expand tools"}
                      onClick={() =>
                        setExpandedId((current) => (current === server.id ? null : server.id))
                      }
                    >
                      {expandedId === server.id ? (
                        <ChevronDownIcon className="size-4" aria-hidden />
                      ) : (
                        <ChevronRightIcon className="size-4" aria-hidden />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedId === server.id ? (
                  <ServerToolsPreview serverId={server.id} toolCount={server.toolCount} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateMcpServerDialog
        open={createOpen}
        busy={createMutation.isPending}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setActionError(null);
          }
        }}
        onSubmit={async (request) => {
          setActionError(null);

          try {
            await createMutation.mutateAsync(request);
            setCreateOpen(false);
          } catch (err) {
            const message = formatError(err);
            setActionError(message);
            throw new Error(message);
          }
        }}
      />
    </>
  );
}

function ServerToolsPreview({
  serverId,
  toolCount,
}: {
  serverId: string;
  toolCount: number;
}) {
  const [tools, setTools] = useState<Array<{ name: string; description: string }> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (toolCount === 0) {
      return;
    }

    let cancelled = false;

    async function loadTools() {
      setLoading(true);
      setError(null);

      try {
        const response = await client.getMcpServer(serverId);

        if (!cancelled) {
          setTools(
            response.server.cachedTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTools();

    return () => {
      cancelled = true;
    };
  }, [serverId, toolCount]);

  if (toolCount === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No cached tools yet. Connect and sync this server.
      </p>
    );
  }

  if (loading && tools === null) {
    return <p className="mt-3 text-xs text-muted-foreground">Loading tools…</p>;
  }

  if (error) {
    return <p className="mt-3 text-xs text-destructive">{error}</p>;
  }

  if (!tools || tools.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-2 rounded-md border border-border bg-muted/20 p-3">
      {tools.map((tool) => (
        <li key={tool.name}>
          <p className="text-sm text-foreground">{tool.name}</p>
          <p className="text-xs text-muted-foreground">{tool.description}</p>
        </li>
      ))}
    </ul>
  );
}

function CreateMcpServerDialog({
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: CreateMcpServerRequest) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    toolCount: number;
    message: string;
  } | null>(null);

  const canSubmit = name.trim().length > 0 && url.trim().length > 0;

  function reset() {
    setName("");
    setUrl("");
    setHeaders("");
    setSubmitError(null);
    setTestResult(null);
    setTesting(false);
  }

  function buildRequest(connect: boolean): CreateMcpServerRequest {
    return {
      name: name.trim(),
      transport: "http",
      config: {
        url: url.trim(),
        headers: parseHeaders(headers),
      },
      connect,
    };
  }

  async function handleTestConnection() {
    if (!canSubmit) {
      return;
    }

    setTesting(true);
    setSubmitError(null);
    setTestResult(null);

    try {
      const result = await client.testMcpServer(buildRequest(false));

      if (result.ok) {
        setTestResult({
          ok: true,
          toolCount: result.toolCount,
          message:
            result.toolCount === 0
              ? "Connected, but no tools were returned."
              : `Connected. Found ${result.toolCount} tool${result.toolCount === 1 ? "" : "s"}.`,
        });
        return;
      }

      setTestResult({
        ok: false,
        toolCount: 0,
        message: result.error ?? "Connection test failed.",
      });
    } catch (error) {
      setTestResult({
        ok: false,
        toolCount: 0,
        message: formatError(error),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!canSubmit || busy) {
      return;
    }

    setSubmitError(null);

    try {
      await onSubmit(buildRequest(true));
      reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : formatError(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <DialogContent className="gap-6 p-6 sm:max-w-lg">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <DialogHeader className="gap-2">
            <DialogTitle>Add MCP server</DialogTitle>
            <DialogDescription>
              Register a server, then assign it to profiles on the Profiles page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <McpFormField label="Name" htmlFor="mcp-name">
              <Input
                id="mcp-name"
                value={name}
                disabled={busy || testing}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                  setTestResult(null);
                }}
                placeholder="github"
              />
            </McpFormField>

            <McpFormField label="URL" htmlFor="mcp-url">
              <Input
                id="mcp-url"
                value={url}
                disabled={busy || testing}
                className="font-mono text-sm"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setTestResult(null);
                }}
                placeholder="https://example.com/mcp"
              />
            </McpFormField>

            <McpFormField label="Headers" htmlFor="mcp-headers" hint="Optional">
              <Textarea
                id="mcp-headers"
                value={headers}
                disabled={busy || testing}
                rows={3}
                className="min-h-20 resize-y font-mono text-sm"
                onChange={(event) => {
                  setHeaders(event.target.value);
                  setTestResult(null);
                }}
                placeholder="Authorization: Bearer token"
              />
            </McpFormField>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={busy || testing || !canSubmit}
              onClick={() => void handleTestConnection()}
            >
              {testing ? <Spinner className="size-4" /> : "Test connection"}
            </Button>

            {testResult ? (
              <p
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm",
                  testResult.ok
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-destructive/10 text-destructive",
                )}
                role="status"
              >
                {testResult.message}
              </p>
            ) : null}

            {submitError ? (
              <p
                className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-3 border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy || testing}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || testing || !canSubmit}>
              {busy ? <Spinner className="size-4" /> : "Add server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function McpFormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="text-xs text-muted-foreground/80">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: McpServerSummary["status"] }) {
  const label =
    status === "connected" ? "Connected" : status === "error" ? "Error" : "Disconnected";

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        status === "connected" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "error" && "bg-destructive/10 text-destructive",
        status === "disconnected" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function PageState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      {message}
    </div>
  );
}

function parseHeaders(value: string): Record<string, string> | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const headers: Record<string, string> = {};

  for (const line of trimmed.split(/\r?\n/)) {
    const entry = line.trim();

    if (!entry) {
      continue;
    }

    const colonIndex = entry.indexOf(":");

    if (colonIndex === -1) {
      continue;
    }

    const key = entry.slice(0, colonIndex).trim();
    const headerValue = entry.slice(colonIndex + 1).trim();

    if (key && headerValue) {
      headers[key] = headerValue;
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}
