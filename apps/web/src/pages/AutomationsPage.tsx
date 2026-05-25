import type {
  AutomationRunRecord,
  AutomationRunStatus,
  AutomationTrigger,
  StoredAutomation,
} from "@tinyclaw/core/contract";
import {
  BotIcon,
  CalendarClockIcon,
  HandIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { client, formatError } from "@/lib/client";
import { formatFutureRelativeTime, formatSessionRelativeTime, formatSessionTimestamp } from "@/lib/chat-history";
import { cn } from "@/lib/utils";

export function AutomationsPage() {
  const [automations, setAutomations] = useState<StoredAutomation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AutomationRunRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredAutomation | null>(null);
  const [editDraft, setEditDraft] = useState<StoredAutomation | null>(null);

  const selected = automations.find((automation) => automation.id === selectedId) ?? null;

  const filteredAutomations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return automations;
    }

    return automations.filter((automation) => {
      return (
        automation.name.toLowerCase().includes(query) ||
        automation.description.toLowerCase().includes(query) ||
        automation.id.toLowerCase().includes(query)
      );
    });
  }, [automations, searchQuery]);

  const refreshAutomations = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setRefreshing(true);
      }
      setError(null);

      try {
        const next = await client.listAutomations();
        setAutomations(next);

        if (next.length === 0) {
          setSelectedId(null);
        } else if (!selectedId || !next.some((automation) => automation.id === selectedId)) {
          setSelectedId(next[0]!.id);
        }
      } catch (err) {
        setError(formatError(err));
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [selectedId],
  );

  const loadRuns = useCallback(async (automationId: string) => {
    setRunsLoading(true);

    try {
      setRuns(await client.listAutomationRuns(automationId));
    } catch (err) {
      setError(formatError(err));
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAutomations();
  }, [refreshAutomations]);

  useEffect(() => {
    if (!selectedId) {
      setRuns([]);
      return;
    }

    void loadRuns(selectedId);
  }, [loadRuns, selectedId]);

  async function handleSaveEdit() {
    if (!editDraft || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await client.updateAutomation(editDraft.id, {
        name: editDraft.name,
        description: editDraft.description,
        prompt: editDraft.prompt,
        trigger: editDraft.trigger,
        enabled: editDraft.enabled,
      });
      setEditDraft(null);
      await refreshAutomations({ silent: true });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await client.deleteAutomation(deleteTarget.id);
      setDeleteTarget(null);
      if (editDraft?.id === deleteTarget.id) {
        setEditDraft(null);
      }
      await refreshAutomations({ silent: true });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRun(automationId: string) {
    if (busy || runningId) {
      return;
    }

    setRunningId(automationId);
    setError(null);

    try {
      await client.runAutomation(automationId);
      await loadRuns(automationId);
      await refreshAutomations({ silent: true });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRunningId(null);
    }
  }

  function openEdit(automation: StoredAutomation) {
    setEditDraft({ ...automation });
  }

  function updateEditDraft(patch: Partial<StoredAutomation>) {
    if (!editDraft) {
      return;
    }

    setEditDraft({ ...editDraft, ...patch });
  }

  return (
    <div>
      {error ? (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                  <BotIcon className="size-5 text-foreground" aria-hidden />
                </div>
                <div>
                  <CardTitle>Saved</CardTitle>
                  <CardDescription className="mt-1">
                    {automations.length} automation{automations.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={refreshing || busy}
                aria-label="Refresh automations"
                onClick={() => void refreshAutomations()}
              >
                {refreshing ? <Spinner className="size-4" /> : <RefreshCwIcon className="size-4" />}
              </Button>
            </div>

            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search automations…"
                disabled={initialLoading || automations.length === 0}
                className="pl-9"
                aria-label="Search automations"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {initialLoading ? (
              <AutomationListSkeleton />
            ) : automations.length === 0 ? (
              <AutomationsEmptyState />
            ) : filteredAutomations.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <SearchIcon className="mx-auto size-5 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm font-medium text-foreground">No matching automations</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border px-2 pb-2">
                {filteredAutomations.map((automation) => (
                  <li key={automation.id}>
                    <AutomationListItem
                      automation={automation}
                      selected={selectedId === automation.id}
                      onSelect={() => setSelectedId(automation.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <main>
          {selected ? (
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-medium text-foreground">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.nextRunAt
                      ? `Next run ${formatFutureRelativeTime(selected.nextRunAt)}`
                      : selected.lastRunAt
                        ? `Last run ${formatSessionRelativeTime(selected.lastRunAt)}`
                        : "Not run yet"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={busy || runningId !== null}
                    aria-label="Run now"
                    onClick={() => void handleRun(selected.id)}
                  >
                    {runningId === selected.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <PlayIcon className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={busy}
                    aria-label="Edit automation"
                    onClick={() => openEdit(selected)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label="Delete automation"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              <section className="border-t border-border px-6 py-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-foreground">Run history</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={runsLoading || busy}
                    aria-label="Refresh run history"
                    onClick={() => void loadRuns(selected.id)}
                  >
                    {runsLoading ? (
                      <Spinner className="size-4" />
                    ) : (
                      <RefreshCwIcon className="size-4" />
                    )}
                  </Button>
                </div>

                {runsLoading ? (
                  <ListSkeleton rows={2} />
                ) : runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {runs.map((run) => (
                      <RunHistoryItem key={run.id} run={run} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Select an automation to view runs.
            </p>
          )}
        </main>
      </div>

      <Dialog
        open={editDraft !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {editDraft ? (
            <>
              <DialogHeader className="gap-2 border-b border-border px-6 py-5">
                <DialogTitle>Edit automation</DialogTitle>
                <DialogDescription>{editDraft.name}</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <AutomationEditorForm
                  automation={editDraft}
                  busy={busy}
                  onChange={updateEditDraft}
                />
              </div>

              <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 border-t border-border bg-muted/30 px-6 py-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditDraft(null)}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={busy} onClick={() => void handleSaveEdit()}>
                  {busy ? <Spinner className="size-4" /> : "Save"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="gap-6 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle>Delete automation?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium text-foreground">{deleteTarget?.name}</span>{" "}
              and its run history permanently.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mx-0 mb-0 gap-2 border-0 bg-transparent p-0 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleDeleteConfirm()}
            >
              {busy ? <Spinner className="size-4" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationListItem({
  automation,
  selected,
  onSelect,
}: {
  automation: StoredAutomation;
  selected: boolean;
  onSelect: () => void;
}) {
  const TriggerIcon = automation.trigger.type === "schedule" ? CalendarClockIcon : HandIcon;

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-primary/5 ring-1 ring-primary/20",
      )}
      onClick={onSelect}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
        <TriggerIcon className="size-4 text-muted-foreground" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {formatTrigger(automation.trigger)}
        </p>
        <div className="mt-2">
          <StatusBadge
            label={automation.enabled ? "Enabled" : "Disabled"}
            tone={automation.enabled ? "ok" : "neutral"}
          />
        </div>
      </div>
    </button>
  );
}

function AutomationEditorForm({
  automation,
  busy,
  onChange,
}: {
  automation: StoredAutomation;
  busy: boolean;
  onChange: (patch: Partial<StoredAutomation>) => void;
}) {
  const scheduleTrigger = automation.trigger.type === "schedule" ? automation.trigger : null;
  const isSchedule = scheduleTrigger !== null;

  return (
    <div className="grid gap-5">
      <Field label="Name">
        <Input
          value={automation.name}
          disabled={busy}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <Field label="Description">
        <Input
          value={automation.description}
          disabled={busy}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>

      <Field label="Prompt">
        <Textarea
          className="min-h-32"
          value={automation.prompt}
          disabled={busy}
          onChange={(event) => onChange({ prompt: event.target.value })}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Trigger">
          <Select
            value={automation.trigger.type}
            disabled={busy}
            onValueChange={(value) => {
              const type = String(value);

              if (type === "manual") {
                onChange({ trigger: { type: "manual" } });
                return;
              }

              onChange({
                trigger: {
                  type: "schedule",
                  cron: scheduleTrigger?.cron ?? "0 8 * * *",
                  timezone: scheduleTrigger?.timezone,
                },
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Enabled">
          <label className="flex h-8 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={automation.enabled}
              disabled={busy}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            Run on schedule
          </label>
        </Field>
      </div>

      {isSchedule ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Cron">
            <Input
              value={scheduleTrigger.cron}
              disabled={busy}
              onChange={(event) =>
                onChange({
                  trigger: {
                    type: "schedule",
                    cron: event.target.value,
                    timezone: scheduleTrigger.timezone,
                  },
                })
              }
            />
          </Field>
          <Field label="Timezone">
            <Input
              value={scheduleTrigger.timezone ?? ""}
              placeholder="UTC"
              disabled={busy}
              onChange={(event) =>
                onChange({
                  trigger: {
                    type: "schedule",
                    cron: scheduleTrigger.cron,
                    timezone: event.target.value || undefined,
                  },
                })
              }
            />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <MetaRow
          label="Next run"
          value={
            automation.nextRunAt
              ? formatFutureRelativeTime(automation.nextRunAt)
              : "Not scheduled"
          }
          hint={automation.nextRunAt ? formatSessionTimestamp(automation.nextRunAt) : undefined}
        />
        <MetaRow
          label="Last run"
          value={
            automation.lastRunAt ? formatSessionRelativeTime(automation.lastRunAt) : "Never run"
          }
          hint={automation.lastRunAt ? formatSessionTimestamp(automation.lastRunAt) : undefined}
        />
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
      : "border-border bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClass,
      )}
    >
      {label}
    </span>
  );
}

function AutomationsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <BotIcon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="type-section-title">No automations yet</p>
        <p className="type-body text-muted-foreground">
          Ask the agent in Chat to create a scheduled or manual automation for you.
        </p>
      </div>
    </div>
  );
}

function AutomationListSkeleton() {
  return (
    <div className="space-y-2 px-2 pb-2" aria-busy="true" aria-label="Loading automations">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-md px-3 py-3">
          <div className="size-8 animate-pulse rounded-md bg-muted/50" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RunHistoryItem({ run }: { run: AutomationRunRecord }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className={runStatusClass(run.status)}>{run.status}</span>
        <span className="text-xs text-muted-foreground" title={formatSessionTimestamp(run.startedAt)}>
          {formatSessionRelativeTime(run.startedAt)}
        </span>
      </div>

      {run.output ? (
        <div className="mt-3">
          <MessageResponse>{run.output}</MessageResponse>
        </div>
      ) : null}

      {run.error ? <p className="mt-3 text-sm text-destructive">{run.error}</p> : null}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MetaRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground" title={hint}>
        {value}
      </p>
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-muted/40" />
      ))}
    </div>
  );
}

function runStatusClass(status: AutomationRunStatus): string {
  if (status === "completed") {
    return "font-medium text-foreground";
  }

  if (status === "failed") {
    return "font-medium text-destructive";
  }

  return "font-medium text-muted-foreground";
}

function formatTrigger(trigger: AutomationTrigger): string {
  if (trigger.type === "manual") {
    return "Manual trigger";
  }

  return `Schedule · ${trigger.cron}${trigger.timezone ? ` (${trigger.timezone})` : ""}`;
}
