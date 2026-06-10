import type {
  ConfigureActorSecretsResult,
  ConfigureServantSecretsResult,
  RevealSecretResult,
  RevealSecretToolInput,
} from "../../engine/core/secrets";
import type { ToolResult } from "../runtime/tool-result";

import {
  configureActorSecrets,
  configureServantSecrets,
  revealSecret,
} from "../../engine/core/secrets";
import { parseRevealSecretToolInput } from "../../engine/core/secrets-schema";

import { runDomainEventTool } from "./domain-tool-runner";

type RevealSecretToolResult =
  | { kind: "configure"; result: ConfigureActorSecretsResult | ConfigureServantSecretsResult }
  | { kind: "reveal"; result: RevealSecretResult };

export function revealSecretTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => executeSecretTool(parseRevealSecretToolInput(params, "reveal_secret 参数")),
    details: secretDetails,
    message: secretMessage,
  });
}

function executeSecretTool(input: RevealSecretToolInput): RevealSecretToolResult {
  if (input.kind === "configure-servant-secrets") {
    return { kind: "configure", result: configureServantSecrets(input) };
  }
  if (input.kind === "configure-actor-secrets") {
    return { kind: "configure", result: configureActorSecrets(input) };
  }
  return { kind: "reveal", result: revealSecret(input) };
}

function secretDetails(output: RevealSecretToolResult): Record<string, unknown> {
  if (output.kind === "configure") {
    return { result: output.result };
  }
  return { outcome: output.result.outcome };
}

function secretMessage(output: RevealSecretToolResult): string {
  if (output.kind === "configure") {
    return output.result.message;
  }
  return output.result.playerSafeMessage;
}
