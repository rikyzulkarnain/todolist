"use client";

import {
  ASSISTANT_GREETING,
  ASSISTANT_MODELS,
  AssistantModel,
  DEFAULT_ASSISTANT_MODEL,
  FREE_DAILY_QUOTA,
  MODEL_LABELS,
  supportsThinking,
  SUGGESTED_CHIPS,
} from "@/constants/assistant-constant";
import {
  AssistantInit,
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
  saveTurn,
} from "@/features/assistant/action";
import { assistantChat } from "@/features/assistant/chat";
import { QuotaInfo } from "@/features/profile/action";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { AssistantMessage, ConversationSummary } from "@/types/ai";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssistantView({
  init,
  initialConversations,
  initialQuota,
}: {
  init: AssistantInit;
  initialConversations: ConversationSummary[];
  initialQuota: QuotaInfo;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const online = useOnline();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<AssistantMessage[]>(init.messages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState(initialQuota.used);
  const [model, setModel] = useState<AssistantModel>(DEFAULT_ASSISTANT_MODEL);
  const [thinking, setThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [conversationId, setConversationId] = useState(init.conversationId);
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSent = useRef(false);

  const { recording, toggle: toggleVoice } = useAudioRecorder({
    onRecorded: (audio) => send({ audio }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  // Ingat pilihan model & thinking antar sesi.
  useEffect(() => {
    const m = localStorage.getItem("aios-ai-model");
    if (m && (ASSISTANT_MODELS as readonly string[]).includes(m))
      setModel(m as AssistantModel);
    setThinking(localStorage.getItem("aios-ai-thinking") === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("aios-ai-model", model);
  }, [model]);
  useEffect(() => {
    localStorage.setItem("aios-ai-thinking", thinking ? "1" : "0");
  }, [thinking]);

  // Tombol "Saya bingung hari ini" di Home mengarah ke /ai?q=... — kirim otomatis.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSent.current && !busy) {
      autoSent.current = true;
      send({ text: q });
      router.replace("/ai", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(payload: {
    text?: string;
    audio?: { mimeType: string; base64: string };
    image?: { mimeType: string; base64: string };
  }) {
    const text = payload.text?.trim() ?? "";
    if (!text && !payload.audio && !payload.image) return;
    if (busy) return;

    const history = messages;
    // Placeholder pesan user (untuk suara, diganti transkripnya setelah selesai).
    const shownText =
      text || (payload.audio ? "🎤 Pesan suara…" : "📷 Foto dikirim");
    setMessages((prev) => [...prev, { role: "user", text: shownText }]);
    setInput("");
    setBusy(true);

    try {
      const res = await assistantChat({
        history,
        text: payload.text,
        audio: payload.audio,
        image: payload.image,
        model,
        thinking,
      });

      if (res.error) {
        toast.error(res.error);
        setMessages((prev) => prev.slice(0, -1));
        if (res.quotaUsed !== undefined) setQuotaUsed(res.quotaUsed);
        return;
      }

      const userText =
        text ||
        res.transcript ||
        (payload.image ? "(Foto) Buat task dari gambar ini" : shownText);
      const modelMsg: AssistantMessage = {
        role: "model",
        text: res.reply ?? "",
        agenda: res.agenda,
        thought: res.thought,
      };
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "user", text: userText },
        modelMsg,
      ]);
      if (res.quotaUsed !== undefined) setQuotaUsed(res.quotaUsed);
      if (res.changed)
        queryClient.invalidateQueries({ queryKey: ["tasks"] });

      await saveTurn(conversationId, userText, modelMsg.text, res.agenda);
      getConversations().then(setConversations);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Terjadi kesalahan pada asisten AI.",
      );
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar ya.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      send({ text: input, image: { mimeType: file.type, base64 } });
    } catch {
      toast.error("Gagal membaca gambar.");
    }
  }

  function applyAgenda() {
    toast.success("Fokus Hari Ini diperbarui");
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    router.push("/home");
  }

  async function onNewChat() {
    if (busy) return;
    const res = await createConversation();
    if (!res) return;
    setConversationId(res.conversationId);
    setMessages([]);
    setShowHistory(false);
    autoSent.current = true; // cegah auto-kirim query lama
    getConversations().then(setConversations);
  }

  async function onOpenConversation(id: string) {
    if (busy || id === conversationId) {
      setShowHistory(false);
      return;
    }
    const msgs = await getConversationMessages(id);
    setConversationId(id);
    setMessages(msgs);
    setShowHistory(false);
  }

  async function onDeleteConversation(id: string) {
    const res = await deleteConversation(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const next = conversations.filter((c) => c.id !== id);
    setConversations(next);
    // Kalau yang dihapus adalah chat aktif, pindah ke chat lain / buat baru.
    if (id === conversationId) {
      if (next.length > 0) {
        await onOpenConversation(next[0].id);
      } else {
        await onNewChat();
      }
    }
    toast.success("Chat dihapus");
  }

  const shownMessages: AssistantMessage[] = messages.length
    ? messages
    : [{ role: "model", text: ASSISTANT_GREETING }];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex flex-none items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-teal flex h-9 w-9 items-center justify-center rounded-xl">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
            </svg>
          </div>
          <div>
            <div className="text-ink text-base font-extrabold">Asisten AI</div>
            <div className="text-mute text-[11px] font-semibold">
              {MODEL_LABELS[model]} · {quotaUsed}/{FREE_DAILY_QUOTA} kuota
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewChat}
            aria-label="Chat baru"
            className="border-line-2 text-slate hover:bg-mint-3 flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] bg-white transition"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            onClick={() => setShowHistory(true)}
            aria-label="Riwayat chat"
            className="border-line-2 text-slate hover:bg-mint-3 flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] bg-white transition"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Pengaturan AI"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] transition",
              showSettings
                ? "border-teal bg-mint-2 text-teal"
                : "border-line-2 text-slate hover:bg-mint-3 bg-white",
            )}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* drawer riwayat chat */}
      {showHistory && (
        <>
          <div
            onClick={() => setShowHistory(false)}
            className="absolute inset-0 z-50 bg-[rgba(9,40,37,.45)]"
          />
          <div className="anim-slide-right absolute top-0 right-0 bottom-0 z-[51] flex w-[82%] max-w-[340px] flex-col bg-white shadow-[-8px_0_24px_rgba(0,0,0,.12)]">
            <div className="border-line flex items-center justify-between border-b px-4 py-3.5">
              <div className="text-ink text-[15px] font-extrabold">
                Riwayat chat
              </div>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Tutup"
                className="text-slate flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F1F5F4]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={onNewChat}
              className="text-teal border-line-soft hover:bg-mint-3 flex items-center gap-2 border-b px-4 py-3 text-sm font-bold transition"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Chat baru
            </button>
            <div className="flex-1 overflow-auto p-2">
              {conversations.length === 0 ? (
                <div className="text-mute-2 px-3 py-6 text-center text-[13px]">
                  Belum ada riwayat.
                </div>
              ) : (
                conversations.map((c) => {
                  const active = c.id === conversationId;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "group mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 transition",
                        active ? "bg-mint-2" : "hover:bg-soft",
                      )}
                    >
                      <button
                        onClick={() => onOpenConversation(c.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div
                          className={cn(
                            "truncate text-[13.5px] font-semibold",
                            active ? "text-teal" : "text-ink-2",
                          )}
                        >
                          {c.title?.trim() || "Chat baru"}
                        </div>
                        <div className="text-mute-2 text-[11px]">
                          {new Date(c.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </button>
                      <button
                        onClick={() => onDeleteConversation(c.id)}
                        aria-label="Hapus chat"
                        className="text-mute-2 flex h-7 w-7 flex-none items-center justify-center rounded-lg transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* pengaturan: pilih model + mode berpikir */}
      {showSettings && (
        <div className="anim-slide-down border-line mx-5 mb-2 flex flex-col gap-3 rounded-2xl border bg-white p-3.5">
          <div>
            <div className="text-slate mb-1.5 text-[11px] font-extrabold tracking-[.5px] uppercase">
              Model AI
            </div>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as AssistantModel)}
                className="border-line-2 bg-soft text-ink-2 focus:border-teal h-10 w-full appearance-none rounded-xl border-[1.5px] px-3 pr-9 text-[13px] font-semibold outline-none focus:bg-white"
              >
                {ASSISTANT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </option>
                ))}
              </select>
              <svg
                className="text-mute pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <div className="text-mute-2 mt-1 text-[10.5px]">
              Ganti model bila kuota model tertentu habis.
            </div>
          </div>
          <button
            onClick={() => setThinking((v) => !v)}
            disabled={!supportsThinking(model)}
            className="flex items-center justify-between disabled:opacity-50"
          >
            <div className="text-left">
              <div className="text-ink-2 text-[13px] font-bold">
                Mode berpikir 💭
              </div>
              <div className="text-mute-2 text-[10.5px]">
                {supportsThinking(model)
                  ? "Tampilkan alur berpikir model (bisa di-minimize)"
                  : "Tidak didukung model ini"}
              </div>
            </div>
            <span
              className={cn(
                "relative h-6 w-11 flex-none rounded-full transition",
                thinking && supportsThinking(model)
                  ? "bg-teal"
                  : "bg-line-3",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  thinking && supportsThinking(model) ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        </div>
      )}

      {!online ? (
        /* offline state */
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EDF1F0]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8AA09C"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M1 1l22 22" />
              <path d="M16.7 11.6A11 11 0 0 0 12 10.5c-2 0-3.9.5-5.5 1.5" />
              <path d="M5 8.5A16 16 0 0 1 12 6c2.5 0 4.9.6 7 1.6" />
              <path d="M8.5 15.4a6 6 0 0 1 3.5-1.1c1.3 0 2.5.4 3.5 1.1" />
              <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="text-ink text-[15.5px] font-extrabold">
            AI butuh koneksi internet
          </div>
          <div className="text-mute max-w-[240px] text-[13px] leading-[1.55] text-pretty">
            Task dan kalendermu tetap bisa diakses offline. Coba lagi saat
            kembali online.
          </div>
        </div>
      ) : (
        <>
          {/* percakapan */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-3 overflow-auto px-5 pt-2 pb-3"
          >
            {shownMessages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={i}
                  className={cn(
                    "anim-fade-in flex flex-col",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  {!isUser && m.thought && <ThoughtBlock text={m.thought} />}
                  {m.text && (
                    <div
                      className={cn(
                        "chat-md max-w-[82%] px-3.5 py-[11px] text-[13.5px] leading-normal font-medium",
                        isUser
                          ? "bg-teal rounded-[16px_16px_6px_16px] text-white"
                          : "text-ink-2 border-line rounded-[16px_16px_16px_6px] border bg-white",
                      )}
                    >
                      <Markdown>{m.text}</Markdown>
                    </div>
                  )}

                  {m.agenda && m.agenda.length > 0 && (
                    <div className="border-line mt-2 w-full overflow-hidden rounded-[18px] border bg-white">
                      <div className="bg-mint-3 border-line flex items-center gap-2 border-b px-4 py-[13px]">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0F766E"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                        </svg>
                        <span className="text-ink text-[12.5px] font-extrabold">
                          Agenda prioritasmu hari ini
                        </span>
                      </div>
                      <div className="px-4 py-1.5">
                        {m.agenda.map((a) => (
                          <div
                            key={a.num}
                            className="border-line-soft flex gap-3 border-b py-[11px] last:border-b-0"
                          >
                            <div className="bg-mint text-teal flex h-6 w-6 flex-none items-center justify-center rounded-lg text-xs font-extrabold">
                              {a.num}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-ink-2 text-[13.5px] font-bold">
                                  {a.title}
                                </span>
                                <span className="text-slate rounded-[5px] bg-[#EDF1F0] px-[7px] py-0.5 text-[10.5px] font-bold">
                                  {a.time}
                                </span>
                              </div>
                              <div className="text-mute mt-[3px] text-xs leading-[1.45]">
                                {a.reason}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3">
                        <button
                          onClick={applyAgenda}
                          className="bg-teal hover:bg-teal-deep h-[42px] w-full rounded-[11px] text-[13px] font-bold text-white transition"
                        >
                          Terapkan ke Fokus Hari Ini
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-2.5">
                <div className="border-line flex items-center gap-[5px] rounded-[16px_16px_16px_6px] border bg-white px-4 py-[13px]">
                  <div className="bg-teal anim-blink h-[7px] w-[7px] rounded-full" />
                  <div className="bg-teal anim-blink h-[7px] w-[7px] rounded-full [animation-delay:.2s]" />
                  <div className="bg-teal anim-blink h-[7px] w-[7px] rounded-full [animation-delay:.4s]" />
                </div>
                <span className="text-mute-2 text-[11.5px] font-semibold">
                  AI sedang berpikir…
                </span>
              </div>
            )}
          </div>

          {/* chips + input */}
          <div className="flex-none px-5 pb-3.5">
            <div className="mb-2.5 flex flex-wrap gap-2">
              {SUGGESTED_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => send({ text: c })}
                  disabled={busy}
                  className="border-line-4 text-teal hover:bg-mint-2 hover:border-teal h-[34px] rounded-[17px] border-[1.5px] bg-white px-[13px] text-xs font-bold transition disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickImage}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="Kirim foto (OCR → task)"
                className="border-line-2 text-teal hover:bg-mint-3 flex h-12 w-12 flex-none items-center justify-center rounded-full border-[1.5px] bg-white transition disabled:opacity-50"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <button
                onClick={toggleVoice}
                disabled={busy}
                aria-label={recording ? "Berhenti merekam" : "Rekam suara"}
                className={cn(
                  "flex h-12 w-12 flex-none items-center justify-center rounded-full border-[1.5px] transition disabled:opacity-50",
                  recording
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-line-2 text-teal hover:bg-mint-3 bg-white",
                )}
              >
                {recording ? (
                  <div className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                ) : (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <path d="M12 19v4" />
                  </svg>
                )}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send({ text: input })}
                placeholder="Tulis pesan…"
                className="border-line-2 text-ink-2 focus:border-teal h-12 min-w-0 flex-1 rounded-3xl border-[1.5px] bg-white px-[18px] text-sm outline-none"
              />
              <button
                onClick={() => send({ text: input })}
                disabled={busy}
                aria-label="Kirim"
                className="bg-teal hover:bg-teal-deep flex h-12 w-12 flex-none items-center justify-center rounded-full transition disabled:opacity-50"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Blok alur berpikir model — bisa dibuka/tutup (default tertutup). */
function ThoughtBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1.5 w-full max-w-[82%]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-mute hover:text-slate flex items-center gap-1.5 text-[11.5px] font-bold transition"
      >
        <span>💭</span>
        Proses berpikir
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-transform", open && "rotate-90")}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-line-2 text-mute mt-1.5 rounded-xl border bg-[#FBFCFC] px-3 py-2.5 text-[12px] leading-[1.55] whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
