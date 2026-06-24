import type { AgentQuestionAnswer, AgentQuestionnaire } from "./contract";

const ANSWERS_HEADER = "Answers";

export function hasActiveAgentQuestionnaire(
  questionnaire: AgentQuestionnaire | null | undefined,
): boolean {
  return Boolean(questionnaire && questionnaire.questions.length > 0);
}

export function formatAgentQuestionnaireAnswersMessage(
  answers: readonly AgentQuestionAnswer[],
): string {
  const lines = [ANSWERS_HEADER];

  for (const entry of answers) {
    lines.push("", `Q: ${entry.prompt.trim()}`, `A: ${entry.answer.trim()}`);
  }

  return lines.join("\n");
}

export function parseAgentQuestionnaireAnswersMessage(
  value: string,
): AgentQuestionAnswer[] | null {
  const trimmed = value.trim();

  if (!trimmed.startsWith(ANSWERS_HEADER)) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);

  if ((lines[0] ?? "").trim() !== ANSWERS_HEADER) {
    return null;
  }

  const answers: AgentQuestionAnswer[] = [];
  let currentPrompt = "";
  let currentAnswer = "";

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("Q: ")) {
      if (currentPrompt && currentAnswer) {
        answers.push({
          questionId: `answer_${answers.length + 1}`,
          prompt: currentPrompt,
          answer: currentAnswer,
        });
      }

      currentPrompt = line.slice(3).trim();
      currentAnswer = "";
      continue;
    }

    if (line.startsWith("A: ")) {
      currentAnswer = line.slice(3).trim();
      continue;
    }

    return null;
  }

  if (currentPrompt && currentAnswer) {
    answers.push({
      questionId: `answer_${answers.length + 1}`,
      prompt: currentPrompt,
      answer: currentAnswer,
    });
  }

  return answers.length > 0 ? answers : null;
}
