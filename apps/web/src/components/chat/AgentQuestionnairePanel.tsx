import { hasActiveAgentQuestionnaire } from "@tinyclaw/core/agent-questionnaire";
import type { AgentQuestionAnswer, AgentQuestionnaire } from "@tinyclaw/core/contract";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AgentQuestionnairePanelProps {
  questionnaire: AgentQuestionnaire | null;
  disabled?: boolean;
  onSubmit: (answers: AgentQuestionAnswer[]) => void;
}

interface DraftAnswerState {
  selectedChoiceId: string | null;
  selectedChoiceLabel: string | null;
  customAnswer: string;
}

function isCustomChoice(choice: { id: string; label: string }): boolean {
  const value = `${choice.id} ${choice.label}`.toLowerCase();
  return value.includes("other") || value.includes("custom");
}

export function AgentQuestionnairePanel({
  questionnaire,
  disabled = false,
  onSubmit,
}: AgentQuestionnairePanelProps) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswerState>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    if (!questionnaire) {
      setAnswers({});
      setCurrentQuestionIndex(0);
      return;
    }

    setAnswers(
      Object.fromEntries(
        questionnaire.questions.map((question) => [
          question.id,
          {
            selectedChoiceId: null,
            selectedChoiceLabel: null,
            customAnswer: "",
          },
        ]),
      ),
    );
    setCurrentQuestionIndex(0);
  }, [questionnaire]);

  const resolvedAnswers = useMemo(() => {
    if (!questionnaire) {
      return [];
    }

    return questionnaire.questions.map((question) => {
      const state = answers[question.id];
      const customChoice = question.choices.find((choice) => isCustomChoice(choice));
      const useCustomAnswer =
        (question.allowCustomAnswer || Boolean(customChoice)) &&
        (state?.customAnswer.trim().length ?? 0) > 0;
      const answer = useCustomAnswer
        ? state?.customAnswer.trim() ?? ""
        : state?.selectedChoiceLabel ?? "";
      return {
        questionId: question.id,
        prompt: question.prompt,
        answer,
      };
    });
  }, [answers, questionnaire]);

  if (!hasActiveAgentQuestionnaire(questionnaire)) {
    return null;
  }

  const activeQuestionnaire = questionnaire!;
  const activeQuestion = activeQuestionnaire.questions[currentQuestionIndex]!;
  const activeState = answers[activeQuestion.id] ?? {
    selectedChoiceId: null,
    selectedChoiceLabel: null,
    customAnswer: "",
  };
  const customChoice = activeQuestion.choices.find((choice) => isCustomChoice(choice));
  const showCustomInput = activeQuestion.allowCustomAnswer || Boolean(customChoice);
  const canGoPrevious = currentQuestionIndex > 0;
  const canGoNext = currentQuestionIndex < activeQuestionnaire.questions.length - 1;
  const activeAnswer = resolvedAnswers[currentQuestionIndex]?.answer.trim() ?? "";
  const canSubmit = resolvedAnswers.some((answer) => answer.answer.trim().length > 0);

  function handleSkip(): void {
    if (canGoNext) {
      setCurrentQuestionIndex((current) => current + 1);
      return;
    }

    onSubmit(resolvedAnswers);
  }

  return (
    <div className="px-3">
      <aside
        className="w-full overflow-hidden rounded-t-xl rounded-b-none border border-border bg-card shadow-xs"
        aria-label="Agent questions"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Questions</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || !canGoPrevious}
              onClick={() => setCurrentQuestionIndex((current) => current - 1)}
              aria-label="Previous question"
              className="size-6 text-muted-foreground"
            >
              <ChevronUpIcon className="size-3.5" aria-hidden />
            </Button>
            <span className="min-w-10 text-center">
              {currentQuestionIndex + 1} of {activeQuestionnaire.questions.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || !canGoNext || activeAnswer.length === 0}
              onClick={() => setCurrentQuestionIndex((current) => current + 1)}
              aria-label="Next question"
              className="size-6 text-muted-foreground"
            >
              <ChevronDownIcon className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="space-y-4 px-3 py-3">
          <section key={activeQuestion.id} className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">
              {currentQuestionIndex + 1}. {activeQuestion.prompt}
            </p>
            {activeQuestion.choices.length > 0 ? (
              <div className="space-y-1">
                {activeQuestion.choices.map((choice) => {
                  if (isCustomChoice(choice)) {
                    const selected = activeState.selectedChoiceId === choice.id;

                    return (
                      <div key={choice.id} className="flex items-center gap-2.5 py-0.5">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [activeQuestion.id]: {
                                ...activeState,
                                selectedChoiceId: choice.id,
                                selectedChoiceLabel: choice.label,
                              },
                            }))
                          }
                          className={cn(
                            "flex shrink-0 items-center gap-2.5 text-left text-sm transition-colors",
                            selected ? "text-primary" : "text-foreground",
                            disabled && "pointer-events-none opacity-50",
                          )}
                          aria-label={choice.label}
                        >
                          <span
                            className={cn(
                              "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-primary" : "border-muted-foreground/40",
                            )}
                            aria-hidden
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full bg-primary transition-opacity",
                                selected ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </span>
                        </button>
                        <Input
                          value={activeState.customAnswer}
                          disabled={disabled}
                          placeholder={choice.label}
                          className="h-auto flex-1 border-0 bg-transparent! px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onFocus={() =>
                            setAnswers((current) => ({
                              ...current,
                              [activeQuestion.id]: {
                                ...activeState,
                                selectedChoiceId: choice.id,
                                selectedChoiceLabel: choice.label,
                              },
                            }))
                          }
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [activeQuestion.id]: {
                                ...activeState,
                                selectedChoiceId: choice.id,
                                selectedChoiceLabel: choice.label,
                                customAnswer: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    );
                  }

                  const selected = activeState.selectedChoiceId === choice.id;

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [activeQuestion.id]: {
                            ...activeState,
                            selectedChoiceId: choice.id,
                            selectedChoiceLabel: choice.label,
                          },
                        }))
                      }
                      className={cn(
                        "flex w-full items-center gap-2.5 py-1 text-left text-sm transition-colors",
                        selected ? "text-primary" : "text-foreground",
                        disabled && "pointer-events-none opacity-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-primary" : "border-muted-foreground/40",
                        )}
                        aria-hidden
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full bg-primary transition-opacity",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </span>
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showCustomInput && !customChoice ? (
              <Input
                value={activeState.customAnswer}
                disabled={disabled}
                placeholder={activeQuestion.placeholder || "Other (custom)"}
                onFocus={() =>
                  setAnswers((current) => ({
                    ...current,
                    [activeQuestion.id]: {
                      ...activeState,
                      selectedChoiceId: activeState.selectedChoiceId,
                      selectedChoiceLabel: activeState.selectedChoiceLabel,
                    },
                  }))
                }
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [activeQuestion.id]: {
                      ...activeState,
                      selectedChoiceId: activeState.selectedChoiceId,
                      selectedChoiceLabel: activeState.selectedChoiceLabel,
                      customAnswer: event.target.value,
                    },
                  }))
                }
              />
            ) : null}
          </section>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={handleSkip}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Skip
            </button>
            <Button
              type="button"
              disabled={disabled || (canGoNext ? activeAnswer.length === 0 : !canSubmit)}
              onClick={() =>
                canGoNext
                  ? setCurrentQuestionIndex((current) => current + 1)
                  : onSubmit(resolvedAnswers)
              }
            >
              {canGoNext ? "Continue" : "Submit"}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
