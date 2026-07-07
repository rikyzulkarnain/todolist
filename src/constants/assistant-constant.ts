// Daftar model Gemini free (urut prioritas). Jika model yang dipilih kena limit
// kuota (429 / RESOURCE_EXHAUSTED), asisten otomatis turun ke model berikutnya.
export const ASSISTANT_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export type AssistantModel = (typeof ASSISTANT_MODELS)[number];

export const DEFAULT_ASSISTANT_MODEL: AssistantModel = "gemini-3.5-flash";

// Label ramah untuk selector model di layar AI.
export const MODEL_LABELS: Record<AssistantModel, string> = {
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite",
};

// Model yang mendukung mode "thinking" (menampilkan alur berpikir). Model 2.0
// tidak berpikir sehingga thinkingConfig tak dikirim untuknya.
export function supportsThinking(model: AssistantModel): boolean {
  return /gemini-(3|2\.5)/.test(model);
}

// Pesan saat SEMUA model free kehabisan kuota.
export const ALL_QUOTA_EXHAUSTED_MESSAGE =
  "Semua model AI gratis sedang kehabisan kuota 😔. Tunggu sebentar lalu coba lagi ya.";

// Kuota chat AI harian untuk plan Free (dihitung dari pesan user hari ini).
export const FREE_DAILY_QUOTA = 10;

export const QUOTA_EXCEEDED_MESSAGE =
  "Kuota AI harianmu sudah habis. Kuota di-reset setiap pukul 00.00 — atau upgrade ke Pro untuk AI tanpa batas.";

// Saran perintah cepat di layar AI (chips).
export const SUGGESTED_CHIPS = [
  "Saya bingung hari ini",
  "Apa yang urgent minggu ini?",
];

export const ASSISTANT_GREETING =
  "Halo! Aku sudah melihat task-mu hari ini. Ceritakan kondisimu, atau ketuk salah satu saran di bawah.";
