import { ENVIRONMENT } from "@/config/environment";
import { GoogleGenAI } from "@google/genai";

export function createAI() {
  if (!ENVIRONMENT.googleGenAIKey) {
    throw new Error("AI API Key is missing");
  }
  const ai = new GoogleGenAI({
    apiKey: ENVIRONMENT.googleGenAIKey,
  });

  return ai;
}

// True kalau error berasal dari kuota/rate limit habis (429 / RESOURCE_EXHAUSTED),
// sehingga aman untuk dicoba ulang ke model free berikutnya.
export function isQuotaError(error: unknown): boolean {
  const err = error as {
    status?: number | string;
    code?: number;
    message?: string;
  };
  const message = (err?.message ?? "").toLowerCase();
  return (
    err?.status === 429 ||
    err?.status === "RESOURCE_EXHAUSTED" ||
    err?.code === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429")
  );
}
