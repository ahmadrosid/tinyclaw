import type { ProviderModelOption } from "./contract";
import { inferProviderFromApiKey, type UserProviderConfig, type UserProviderName } from "./user-config";

export interface ProviderSetupPromptOptions {
  question: (prompt: string) => Promise<string>;
  writeLine: (line: string) => void;
  getModelsForProvider: (provider: UserProviderName) => ProviderModelOption[];
  getDefaultModel: (provider: UserProviderName) => string;
  getModelById: (modelId: string) => ProviderModelOption | undefined;
}

export async function promptForProviderConfig(
  options: ProviderSetupPromptOptions,
): Promise<UserProviderConfig> {
  const { question, writeLine, getModelsForProvider, getDefaultModel, getModelById } =
    options;

  while (true) {
    const apiKey = (await question("API key: ")).trim();

    if (!apiKey) {
      writeLine("API key is required.\n");
      continue;
    }

    const provider = inferProviderFromApiKey(apiKey);
    const models = getModelsForProvider(provider);
    writeLine(`\nDetected provider: ${provider}`);
    writeLine("\nAvailable models:");

    for (const [index, model] of models.entries()) {
      const suffix = model.default ? " (default)" : "";
      writeLine(`  ${index + 1}) ${model.name}${suffix}`);
    }

    const modelInput = (await question("\nModel (optional): ")).trim();
    const selectedModel = resolveModelChoice(modelInput, provider, {
      getDefaultModel,
      getModelById,
      getModelsForProvider,
    });

    return {
      provider: getModelById(selectedModel)?.provider ?? provider,
      apiKey,
      model: selectedModel,
    };
  }
}

function resolveModelChoice(
  input: string,
  provider: UserProviderName,
  options: Pick<
    ProviderSetupPromptOptions,
    "getDefaultModel" | "getModelById" | "getModelsForProvider"
  >,
): string {
  if (!input) {
    return options.getDefaultModel(provider);
  }

  const match = options.getModelById(input);

  if (match && match.provider === provider) {
    return match.id;
  }

  const numeric = Number(input);
  const models = options.getModelsForProvider(provider);

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= models.length) {
    return models[numeric - 1]!.id;
  }

  return options.getDefaultModel(provider);
}
