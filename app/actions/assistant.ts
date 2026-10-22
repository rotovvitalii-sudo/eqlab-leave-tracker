"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getCurrentEmployee } from "@/lib/session";
import { assistantEnabled, runAssistant, type ChatMessage, type Draft } from "@/lib/ai/assistant";

const MAX_HISTORY = 10;
const MAX_LENGTH = 500;

export type AssistantResult = { reply: string | null; draft: Draft | null; error: string | null };

// Питання до ІІ-асистента (spec §5.10). Історія живе лише в браузері; тут — обрізання й виклик Claude.
export async function askAssistant(history: ChatMessage[]): Promise<AssistantResult> {
  if (!assistantEnabled()) return { reply: null, draft: null, error: "Асистент не налаштований." };

  const clean = (Array.isArray(history) ? history : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_LENGTH) }))
    .slice(-MAX_HISTORY);
  // Розмова має починатися й закінчуватися питанням користувача.
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") {
    return { reply: null, draft: null, error: "Напишіть питання." };
  }

  const employee = await getCurrentEmployee();
  try {
    const { reply, draft } = await runAssistant(clean, employee);
    return { reply, draft, error: null };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { reply: null, draft: null, error: "Забагато запитів до асистента. Спробуйте за хвилину." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { reply: null, draft: null, error: "Асистент не налаштований: перевірте ключ Anthropic." };
    }
    if (error instanceof Anthropic.APIError) {
      return { reply: null, draft: null, error: "Асистент тимчасово недоступний. Спробуйте ще раз." };
    }
    throw error;
  }
}
