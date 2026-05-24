import * as readline from "node:readline/promises";
import {
  getUserConfigPath,
  loadUserConfig,
  promptForProviderConfig,
  saveUserConfig,
  type ProviderClient,
  type UserProviderConfig,
} from "@tinyclaw/core";
import {
  createProviderFromSources,
  getDefaultModel,
  getModelsForProvider,
  getModelById,
} from "./providers";

export interface ProviderBootstrap {
  provider: ProviderClient | null;
  userConfig: UserProviderConfig | null;
}

export async function ensureProviderConfigured(): Promise<ProviderBootstrap> {
  let userConfig = await loadUserConfig();
  let provider = createProviderFromSources(process.env, userConfig);

  if (provider) {
    return { provider, userConfig };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return { provider: null, userConfig: null };
  }

  console.log("TinyClaw server setup\n");
  console.log("No API key found. Let's configure one.\n");

  userConfig = await promptForProviderConfigWithReadline();
  await saveUserConfig(userConfig);
  console.log(`\nSaved to ${getUserConfigPath()}\n`);

  provider = createProviderFromSources(process.env, userConfig);

  return { provider, userConfig };
}

async function promptForProviderConfigWithReadline(): Promise<UserProviderConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await promptForProviderConfig({
      question: (prompt) => rl.question(prompt),
      writeLine: (line) => console.log(line),
      getModelsForProvider,
      getDefaultModel,
      getModelById,
    });
  } finally {
    rl.close();
  }
}
