"use server";

import {
  ALL_QUOTA_EXHAUSTED_MESSAGE,
  ASSISTANT_MODELS,
  AssistantModel,
  DEFAULT_ASSISTANT_MODEL,
  FREE_DAILY_QUOTA,
  QUOTA_EXCEEDED_MESSAGE,
} from "@/constants/assistant-constant";
import {
  findEmbedding,
  generateTaskEmbedding,
} from "@/features/ai/embedding";
import { createAI, isQuotaError } from "@/features/ai/instance";
import { transcribeAudio } from "@/features/ai/transcribe";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { AgendaItem, AssistantMessage } from "@/types/ai";
import {
  Content,
  FunctionCall,
  FunctionDeclaration,
  GenerateContentResponse,
  Part,
  Type,
} from "@google/genai";
import { addDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { getAssistantContext } from "./context";
import { buildAssistantSystemInstruction } from "./prompt";

export type AssistantChatResult = {
  error?: string;
  reply?: string;
  /** Kartu "Agenda prioritasmu hari ini" bila AI menyusunnya. */
  agenda?: AgendaItem[];
  /** true jika AI mengubah data task (tambah/selesai/hapus). */
  changed?: boolean;
  /** Transkrip teks dari input suara (untuk ditampilkan sebagai pesan user). */
  transcript?: string;
  quotaUsed?: number;
};

// ---- Function declarations (dipahami Gemini) -----------------------------

const createTaskDeclaration: FunctionDeclaration = {
  name: "create_task",
  description:
    "Buat SATU task baru untuk pengguna. Panggil sekali untuk tiap task (mis. hasil ekstraksi foto whiteboard/catatan, pesan suara, atau permintaan teks).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description:
          "Judul task, ringkas, huruf pertama kapital, Bahasa Indonesia.",
      },
      life_area: {
        type: Type.STRING,
        description:
          "Salah satu dari: Karier, Kesehatan, Keuangan, Keluarga, Ibadah, Belajar, Pribadi.",
      },
      priority: {
        type: Type.STRING,
        description: "Salah satu dari: urgent, tinggi, sedang, rendah.",
      },
      day_offset: {
        type: Type.NUMBER,
        description: "Jatuh tempo: 0 = hari ini, 1 = besok, dst. Default 0.",
      },
      time: {
        type: Type.STRING,
        description: "Jam 'HH:mm' bila pengguna menyebut waktu. Opsional.",
      },
    },
    required: ["title", "life_area", "priority"],
  },
};

const completeTaskDeclaration: FunctionDeclaration = {
  name: "complete_task",
  description:
    "Tandai task SELESAI. Wajib pakai id dari daftar task pada system instruction.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "id task yang selesai." },
    },
    required: ["id"],
  },
};

const deleteTaskDeclaration: FunctionDeclaration = {
  name: "delete_task",
  description:
    "Hapus task pengguna. Wajib pakai id dari daftar task pada system instruction.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "id task yang akan dihapus." },
    },
    required: ["id"],
  },
};

const proposeAgendaDeclaration: FunctionDeclaration = {
  name: "propose_agenda",
  description:
    "Susun agenda prioritas HARI INI dari task yang sudah ada (untuk pengguna yang bingung). Item terurut dari yang paling penting. Jangan mengarang task baru.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            task_id: {
              type: Type.STRING,
              description: "id task dari daftar (wajib bila item dari task).",
            },
            title: { type: Type.STRING, description: "Judul task." },
            time: {
              type: Type.STRING,
              description: "Jam 'HH:mm' atau kata 'fleksibel'.",
            },
            reason: {
              type: Type.STRING,
              description:
                "Alasan singkat & memotivasi kenapa dikerjakan di urutan ini.",
            },
          },
          required: ["title", "time", "reason"],
        },
      },
    },
    required: ["items"],
  },
};

const searchTasksDeclaration: FunctionDeclaration = {
  name: "search_tasks",
  description:
    "Cari task pengguna secara SEMANTIK (vector similarity, pola get_transaction fina-app). Pakai saat task yang disebut pengguna tidak ada di daftar system instruction (mis. task lama atau lebih dari 7 hari ke depan), atau pengguna bertanya tentang task terkait topik tertentu.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          "Deskripsi/kata kunci pencarian dalam Bahasa Indonesia (mis. 'tagihan listrik', 'olahraga minggu lalu').",
      },
    },
    required: ["query"],
  },
};

const DECLARATIONS = [
  createTaskDeclaration,
  completeTaskDeclaration,
  deleteTaskDeclaration,
  proposeAgendaDeclaration,
  searchTasksDeclaration,
];

async function callModel(
  contents: Content[],
  systemInstruction: string,
  preferred: AssistantModel,
): Promise<GenerateContentResponse> {
  const ai = createAI();
  let lastError: unknown;
  // Model pilihan dicoba dulu, sisanya jadi fallback saat kuota model habis.
  const models = [
    preferred,
    ...ASSISTANT_MODELS.filter((m) => m !== preferred),
  ];
  for (const model of models) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          temperature: 0.4,
          systemInstruction,
          tools: [{ functionDeclarations: DECLARATIONS }],
        },
      });
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) continue;
      throw error;
    }
  }
  if (isQuotaError(lastError)) throw new Error(ALL_QUOTA_EXHAUSTED_MESSAGE);
  throw lastError ?? new Error("AI tidak dapat memproses pesan.");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function executeFunctionCall(
  supabase: Supabase,
  userId: string,
  fc: FunctionCall,
  collector: { agenda: AgendaItem[] | null; changed: boolean },
): Promise<Record<string, unknown>> {
  const args = (fc.args ?? {}) as Record<string, unknown>;

  switch (fc.name) {
    case "create_task": {
      const offset = Math.max(0, Math.round(Number(args.day_offset) || 0));
      const fields = {
        title: String(args.title ?? "Task"),
        life_area: String(args.life_area ?? "Pribadi"),
        priority: String(args.priority ?? "sedang"),
        due_date: format(addDays(new Date(), offset), "yyyy-MM-dd"),
        due_time: args.time ? String(args.time) : null,
      };
      // Embedding untuk pencarian semantik (pola createTransaction fina-app).
      const embedding = await generateTaskEmbedding(fields);
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          ...fields,
          source: "ai",
          ...(embedding ? { embedding } : {}),
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      collector.changed = true;
      return { success: true, id: data.id, title: args.title };
    }

    case "search_tasks": {
      // Semantic search via RPC match_tasks — RLS membatasi ke task user ini.
      try {
        const data = await findEmbedding(String(args.query ?? ""), 0.3, 15);
        return { success: true, tasks: data ?? [] };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Pencarian gagal.",
        };
      }
    }

    case "complete_task": {
      const id = String(args.id ?? "");
      if (!id) return { success: false, error: "id tidak diberikan" };
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return { success: false, error: error.message };
      collector.changed = true;
      return { success: true, id };
    }

    case "delete_task": {
      const id = String(args.id ?? "");
      if (!id) return { success: false, error: "id tidak diberikan" };
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return { success: false, error: error.message };
      collector.changed = true;
      return { success: true, id };
    }

    case "propose_agenda": {
      const rawItems = Array.isArray(args.items) ? args.items : [];
      const items: AgendaItem[] = rawItems.map(
        (it: Record<string, unknown>, i: number) => ({
          num: i + 1,
          title: String(it.title ?? ""),
          time: String(it.time ?? "fleksibel"),
          reason: String(it.reason ?? ""),
          task_id: it.task_id ? String(it.task_id) : undefined,
        }),
      );
      collector.agenda = items;

      // Simpan alasan AI ke task terkait agar muncul di "Fokus Hari Ini".
      await Promise.all(
        items
          .filter((it) => it.task_id)
          .map((it) =>
            supabase
              .from("tasks")
              .update({ ai_reason: it.reason })
              .eq("id", it.task_id!)
              .eq("user_id", userId),
          ),
      );
      return { success: true, count: items.length };
    }

    default:
      return { success: false, error: `fungsi tidak dikenal: ${fc.name}` };
  }
}

/**
 * Chat asisten multimodal dengan function calling. Bisa menerima teks, pesan
 * suara (audio base64), dan/atau foto whiteboard/catatan/struk (image base64).
 * AI dapat membuat/menyelesaikan/menghapus task dan menyusun agenda prioritas.
 */
export async function assistantChat(input: {
  history: AssistantMessage[];
  text?: string;
  audio?: { mimeType: string; base64: string };
  image?: { mimeType: string; base64: string };
  model?: AssistantModel;
}): Promise<AssistantChatResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  // Kuota harian plan Free — dihitung dari pesan user hari ini (PRD §6.6).
  const startOfDay = `${format(new Date(), "yyyy-MM-dd")}T00:00:00`;
  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", startOfDay);
  const quotaUsed = count ?? 0;
  if (quotaUsed >= FREE_DAILY_QUOTA) {
    return { error: QUOTA_EXCEEDED_MESSAGE, quotaUsed };
  }

  // Suara: transkrip dulu jadi teks (akurat, Bahasa Indonesia) lalu diproses
  // seperti input teks biasa. Transkripnya dikembalikan untuk ditampilkan.
  let transcript: string | undefined;
  let text = input.text?.trim() ?? "";
  if (input.audio) {
    const t = await transcribeAudio(input.audio);
    if (t.error) return { error: t.error };
    transcript = t.text?.trim() ?? "";
    if (!transcript && !input.image)
      return { error: "Suaranya kurang jelas. Coba ulangi ya." };
    text = [text, transcript].filter(Boolean).join(" ").trim();
  }

  const parts: Part[] = [];
  if (input.image)
    parts.push({
      inlineData: { mimeType: input.image.mimeType, data: input.image.base64 },
    });
  if (text) parts.push({ text });
  if (parts.length === 0) return { error: "Tulis atau ceritakan dulu ya." };
  if (input.image && !text)
    parts.push({
      text: "(Foto) Ekstrak semua hal yang bisa jadi task dari gambar ini, lalu catat.",
    });

  // Teks (termasuk hasil transkrip suara) dipakai sebagai query RAG memori.
  const ctx = await getAssistantContext(text);
  const systemInstruction = buildAssistantSystemInstruction(ctx);
  const model = input.model ?? DEFAULT_ASSISTANT_MODEL;

  // Riwayat percakapan (teks saja) + giliran user saat ini.
  const contents: Content[] = [
    ...input.history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user", parts },
  ];

  const collector: { agenda: AgendaItem[] | null; changed: boolean } = {
    agenda: null,
    changed: false,
  };
  let reply = "";

  try {
    for (let turn = 0; turn < 5; turn++) {
      const response = await callModel(contents, systemInstruction, model);
      const respParts = response.candidates?.[0]?.content?.parts ?? [];
      const functionCalls: FunctionCall[] = [];
      const modelParts: Part[] = [];

      for (const part of respParts) {
        modelParts.push(part);
        if (part.functionCall) functionCalls.push(part.functionCall);
        else if (part.text) reply += part.text;
      }

      if (functionCalls.length === 0) break;

      contents.push({ role: "model", parts: modelParts });
      const responseParts: Part[] = [];
      for (const fc of functionCalls) {
        const result = await executeFunctionCall(
          supabase,
          user.id,
          fc,
          collector,
        );
        responseParts.push({
          functionResponse: {
            name: fc.name ?? "",
            id: fc.id,
            response: { result },
          },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "AI gagal memproses pesan.",
      quotaUsed,
    };
  }

  if (collector.changed) {
    revalidatePath("/home");
    revalidatePath("/tasks");
    revalidatePath("/calendar");
  }

  return {
    reply:
      reply.trim() ||
      (collector.agenda
        ? "Tenang — ini urutan yang kusarankan untuk harimu:"
        : "Sudah kucatat. Kalau bingung mulai dari mana, ketik \"Saya bingung hari ini\" ya."),
    agenda: collector.agenda ?? undefined,
    changed: collector.changed,
    transcript,
    quotaUsed: quotaUsed + 1,
  };
}
