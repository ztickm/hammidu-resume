/**
 * Model registry — maps a model key to a LangChain BaseChatModel.
 *
 * Supported providers:
 *   - Anthropic  (requires ANTHROPIC_API_KEY)
 *   - DeepSeek   (requires DEEPSEEK_API_KEY; uses OpenAI-compatible API)
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const MODEL_KEYS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "deepseek-chat",
  "deepseek-reasoner",
] as const;

export type ModelKey = (typeof MODEL_KEYS)[number];

export const DEFAULT_MODEL: ModelKey = "claude-opus-4-5";

const MODEL_LABELS: Record<ModelKey, string> = {
  "claude-opus-4-5": "Claude Opus 4.5 (Anthropic)",
  "claude-sonnet-4-5": "Claude Sonnet 4.5 (Anthropic)",
  "deepseek-chat": "DeepSeek Chat (DeepSeek-V3)",
  "deepseek-reasoner": "DeepSeek Reasoner (R1)",
};

export function modelLabel(key: ModelKey): string {
  return MODEL_LABELS[key];
}

/**
 * Returns the withStructuredOutput options appropriate for the given model.
 * DeepSeek rejects both response_format:json_schema and forced tool_choice,
 * so we use jsonMode which sends response_format:json_object and injects the
 * schema into the prompt — supported by all DeepSeek models including R1.
 */
export function structuredOutputMethod(key: ModelKey): { method?: "jsonMode" } {
  return key.startsWith("deepseek") ? { method: "jsonMode" } : {};
}

/**
 * Returns a system-prompt suffix that instructs the model to use exact field
 * names. Only needed for DeepSeek (jsonMode) — Anthropic uses native tool-call
 * structured output which enforces field names automatically.
 */
export function fieldNamesInstruction(key: ModelKey, fieldNames: string[]): string {
  if (!key.startsWith("deepseek")) return "";
  return `\n\nIMPORTANT: Your JSON response MUST use EXACTLY these field names (no renaming): ${fieldNames.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Factory — returns a BaseChatModel configured for the chosen key
// ---------------------------------------------------------------------------

interface ModelOptions {
  /** Max tokens for the completion (applies to both providers). */
  maxTokens?: number;
}

// ChatAnthropic is used as the unified return type because both ChatAnthropic
// and ChatOpenAI expose the same withStructuredOutput / invoke API we rely on.
export function createChatModel(key: ModelKey, opts: ModelOptions = {}): ChatAnthropic {
  const { maxTokens } = opts;

  switch (key) {
    case "claude-opus-4-5":
      return new ChatAnthropic({
        model: "claude-opus-4-5-20251101",
        temperature: 1,
        maxTokens: maxTokens ?? 8192,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        invocationKwargs: { top_p: undefined },
      });

    case "claude-sonnet-4-5":
      return new ChatAnthropic({
        model: "claude-sonnet-4-5-20251001",
        temperature: 1,
        maxTokens: maxTokens ?? 8192,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        invocationKwargs: { top_p: undefined },
      });

    case "deepseek-chat":
      return new ChatOpenAI({
        model: "deepseek-chat",
        temperature: 1,
        maxTokens: maxTokens ?? 8192,
        apiKey: process.env.DEEPSEEK_API_KEY,
        configuration: { baseURL: "https://api.deepseek.com/v1" },
      }) as unknown as ChatAnthropic;

    case "deepseek-reasoner":
      return new ChatOpenAI({
        model: "deepseek-reasoner",
        maxTokens: maxTokens ?? 8192,
        apiKey: process.env.DEEPSEEK_API_KEY,
        configuration: { baseURL: "https://api.deepseek.com/v1" },
      }) as unknown as ChatAnthropic;
  }
}
