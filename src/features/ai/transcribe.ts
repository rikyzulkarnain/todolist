"use server";

import {
  ALL_QUOTA_EXHAUSTED_MESSAGE,
  ASSISTANT_MODELS,
} from "@/constants/assistant-constant";
import { createAI, isQuotaError } from "@/features/ai/instance";
import { Content } from "@google/genai";

const PROMPT = `Transkrip audio berikut menjadi teks Bahasa Indonesia PERSIS seperti yang diucapkan.
Aturan:
- Balas HANYA hasil transkripnya, tanpa tanda kutip, tanpa penjelasan, tanpa teks tambahan.
- Jangan menerjemahkan; pertahankan istilah asli.
- Jika audio tidak jelas atau kosong, balas string kosong.`;

/**
 * Transkripsi audio (base64 inlineData) menjadi teks Bahasa Indonesia lewat
 * Gemini — jauh lebih akurat untuk Bahasa Indonesia dibanding Web Speech API
 * bawaan browser. Dipakai fitur "bicara" di chat asisten (voice → task).
 */
export async function transcribeAudio(audio: {
  mimeType: string;
  base64: string;
}): Promise<{ text?: string; error?: string }> {
  const ai = createAI();
  const contents: Content[] = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
        { text: PROMPT },
      ],
    },
  ];

  let lastError: unknown;
  for (const model of ASSISTANT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { temperature: 0 },
      });
      const text = (response.text ?? "").trim();
      return { text };
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) continue;
      return {
        error:
          error instanceof Error ? error.message : "Gagal memproses suara.",
      };
    }
  }
  return {
    error: isQuotaError(lastError)
      ? ALL_QUOTA_EXHAUSTED_MESSAGE
      : "Gagal memproses suara.",
  };
}
