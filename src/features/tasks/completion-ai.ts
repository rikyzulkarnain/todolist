"use server";

import {
  ALL_QUOTA_EXHAUSTED_MESSAGE,
  ASSISTANT_MODELS,
} from "@/constants/assistant-constant";
import { createAI, isQuotaError } from "@/features/ai/instance";
import { Content, Part } from "@google/genai";

type Attachment = { mimeType: string; base64: string };

function buildPrompt(taskTitle: string, note?: string | null): string {
  return `Pengguna baru saja MENYELESAIKAN task berjudul "${taskTitle}".
Dari lampiran (foto hasil/kegiatan, rekaman suara berisi cerita, dan/atau catatan singkat) di bawah,
tuliskan RANGKUMAN singkat apa yang sudah pengguna lakukan/capai — 1-2 kalimat, Bahasa Indonesia,
sudut pandang orang pertama ("Aku sudah ..."), konkret dan faktual sesuai bukti di lampiran.
${note ? `\nCatatan awal pengguna: "${note}"` : ""}
Aturan:
- Balas HANYA teks rangkumannya, tanpa tanda kutip, tanpa awalan "Rangkuman:", tanpa markdown.
- Jangan mengarang detail yang tidak ada di lampiran.
- Jika tidak ada informasi yang bisa dirangkum, balas string kosong.`;
}

/**
 * Rangkum "apa yang sudah dilakukan" saat sebuah task diselesaikan, dari input
 * multimodal (foto + suara + teks) lewat Gemini. Dipakai pop-up dokumentasi
 * selesai: hasilnya jadi draf catatan yang bisa disunting pengguna sebelum
 * disimpan. Best-effort dengan fallback antar model saat kuota habis.
 */
export async function generateActivityNote(input: {
  taskTitle: string;
  note?: string | null;
  photo?: Attachment | null;
  audio?: Attachment | null;
}): Promise<{ text?: string; error?: string }> {
  if (!input.photo && !input.audio && !input.note?.trim())
    return { text: "" };

  const ai = createAI();
  const parts: Part[] = [];
  if (input.photo)
    parts.push({
      inlineData: { mimeType: input.photo.mimeType, data: input.photo.base64 },
    });
  if (input.audio)
    parts.push({
      inlineData: { mimeType: input.audio.mimeType, data: input.audio.base64 },
    });
  parts.push({ text: buildPrompt(input.taskTitle, input.note) });

  const contents: Content[] = [{ role: "user", parts }];

  let lastError: unknown;
  for (const model of ASSISTANT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { temperature: 0.3 },
      });
      return { text: (response.text ?? "").trim() };
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) continue;
      return {
        error:
          error instanceof Error ? error.message : "Gagal merangkum kegiatan.",
      };
    }
  }
  return {
    error: isQuotaError(lastError)
      ? ALL_QUOTA_EXHAUSTED_MESSAGE
      : "Gagal merangkum kegiatan.",
  };
}
