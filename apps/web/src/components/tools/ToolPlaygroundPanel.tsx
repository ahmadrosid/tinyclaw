import type { ToolDetail } from "@tinyclaw/core/contract";
import { PlayIcon, SparklesIcon, WrenchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import { client, formatError } from "@/lib/client";
import { buildSuperBotFixDraft } from "@/lib/tool-playground-draft";
import { cn } from "@/lib/utils";

interface ToolPlaygroundPanelProps {
  tool: ToolDetail;
  superBotProfileId: string | null;
  showHeader?: boolean;
}

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: unknown; parameters: Record<string, unknown> }
  | { status: "error"; error: string; parameters: Record<string, unknown> };

function parseParametersJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function formatResult(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolPlaygroundPanel({
  tool,
  superBotProfileId,
  showHeader = true,
}: ToolPlaygroundPanelProps) {
  const { navigateToNewChat } = useAppNavigation();
  const [parametersJson, setParametersJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [assistPrompt, setAssistPrompt] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSuggestParams() {
    const prompt = assistPrompt.trim();

    if (!prompt) {
      setActionError("Describe what you want to test first.");
      return;
    }

    setSuggesting(true);
    setActionError(null);

    try {
      const response = await client.suggestToolParams(tool.id, { prompt });
      setParametersJson(JSON.stringify(response.parameters ?? {}, null, 2));
      setJsonError(null);
    } catch (error) {
      setActionError(formatError(error));
    } finally {
      setSuggesting(false);
    }
  }

  async function handleRun() {
    const parameters = parseParametersJson(parametersJson);

    if (!parameters) {
      setJsonError("Enter valid JSON parameters before running.");
      return;
    }

    setJsonError(null);
    setActionError(null);
    setRunState({ status: "running" });

    try {
      const response = await client.runTool(tool.id, { parameters });

      if (!response.ok) {
        setRunState({
          status: "error",
          error: response.error ?? "Tool run failed.",
          parameters,
        });
        return;
      }

      setRunState({ status: "success", result: response.result, parameters });
    } catch (error) {
      setRunState({
        status: "error",
        error: formatError(error),
        parameters,
      });
    }
  }

  function handleFixWithSuperBot() {
    if (runState.status !== "error" || !superBotProfileId) {
      return;
    }

    const draft = buildSuperBotFixDraft({
      toolName: tool.name,
      parameters: runState.parameters,
      error: runState.error,
    });

    navigateToNewChat(superBotProfileId, { draft });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      {showHeader ? (
        <>
          <div className="flex items-center gap-2">
            <WrenchIcon className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">Playground</p>
          </div>

          <p className="text-xs text-muted-foreground">
            Run this tool outside chat with real execution. Side effects apply.
          </p>
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Relative paths resolve against the assigned profile workspace under{" "}
        <code className="type-code">~/.tinyclaw/orgs/…/profiles/…/</code>, not the server
        process directory.
      </p>

      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-medium text-foreground" htmlFor={`${tool.id}-assist`}>
          Describe test (optional)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={`${tool.id}-assist`}
            value={assistPrompt}
            onChange={(event) => setAssistPrompt(event.target.value)}
            placeholder="e.g. search for tinyclaw docs"
            disabled={suggesting || runState.status === "running"}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={suggesting || runState.status === "running"}
            onClick={() => void handleSuggestParams()}
          >
            {suggesting ? <Spinner className="size-4" /> : <SparklesIcon className="size-4" />}
            Suggest params
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-medium text-foreground" htmlFor={`${tool.id}-params`}>
          Parameters (JSON)
        </label>
        <Textarea
          id={`${tool.id}-params`}
          value={parametersJson}
          onChange={(event) => {
            setParametersJson(event.target.value);
            setJsonError(null);
          }}
          rows={6}
          className="font-mono text-xs"
          spellCheck={false}
          disabled={runState.status === "running"}
        />
        {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={runState.status === "running"}
          onClick={() => void handleRun()}
        >
          {runState.status === "running" ? (
            <Spinner className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
          Run
        </Button>

        {runState.status === "error" && superBotProfileId ? (
          <Button type="button" size="sm" variant="outline" onClick={handleFixWithSuperBot}>
            Fix with Super Bot
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      {runState.status === "success" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Result</p>
          <pre
            className={cn(
              "max-h-56 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed",
            )}
          >
            {formatResult(runState.result)}
          </pre>
        </div>
      ) : null}

      {runState.status === "error" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-destructive">Error</p>
          <pre className="max-h-56 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
            {runState.error}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
