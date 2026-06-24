export function buildSuperBotFixDraft(input: {
  toolName: string;
  parameters: unknown;
  error: string;
}): string {
  const paramsText = JSON.stringify(input.parameters, null, 2);

  return [
    `The tool "${input.toolName}" failed in the playground.`,
    "",
    "Parameters used:",
    paramsText,
    "",
    "Error:",
    input.error,
    "",
    "Please fix the JavaScript tool module so it works with these parameters.",
  ].join("\n");
}
