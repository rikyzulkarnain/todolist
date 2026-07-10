"use client";

import { generateActivityNote } from "@/features/tasks/completion-ai";
import { addTaskLog } from "@/features/tasks/logs";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { Attachment, downscaleImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useCompletionLogStore } from "@/stores/completion-log-store";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Pop-up yang muncul saat sebuah task dicentang SELESAI: mengajak pengguna
 * mendokumentasikan hasil kegiatan lewat ketikan / suara / foto. Lampiran suara
 * & foto dirangkum otomatis oleh Multimodal AI menjadi draf catatan yang bisa
 * disunting. Bersifat opsional — pengguna boleh "Lewati". Tersimpan sebagai
 * entri task_logs (referensi progres untuk jadwal berikutnya).
 */
export default function TaskCompletionSheet() {
  const { task, close } = useCompletionLogStore();
  const queryClient = useQueryClient();

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Attachment | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [audio, setAudio] = useState<Attachment | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Reset isi saat task yang didokumentasikan berganti.
  useEffect(() => {
    setNote("");
    setPhoto(null);
    setPhotoPreview("");
    setAudio(null);
    setAiBusy(false);
    setBusy(false);
  }, [task?.id]);

  // Rangkum lampiran dengan AI → isi/ganti draf catatan. Dipanggil otomatis
  // setelah foto/suara ditambahkan; override dipakai agar tidak kena state basi.
  async function runAI(next: { photo?: Attachment | null; audio?: Attachment | null }) {
    if (!task) return;
    const p = next.photo !== undefined ? next.photo : photo;
    const a = next.audio !== undefined ? next.audio : audio;
    if (!p && !a) return;
    setAiBusy(true);
    try {
      const res = await generateActivityNote({
        taskTitle: task.title,
        note: note.trim() || null,
        photo: p,
        audio: a,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.text) setNote(res.text);
    } finally {
      setAiBusy(false);
    }
  }

  const { recording, toggle } = useAudioRecorder({
    onRecorded: (a) => {
      setAudio(a);
      runAI({ audio: a });
    },
  });

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar ya.");
      return;
    }
    try {
      const att = await downscaleImage(file);
      setPhoto(att);
      setPhotoPreview(`data:image/jpeg;base64,${att.base64}`);
      runAI({ photo: att });
    } catch {
      toast.error("Gagal memproses foto.");
    }
  }

  if (!task) return null;

  const hasContent = note.trim() || photo || audio;

  async function onSave() {
    if (!hasContent || busy) return;
    setBusy(true);
    try {
      const res = await addTaskLog({
        taskId: task!.id,
        note: note.trim() || null,
        photo,
        audio,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["task-logs", task!.id] });
      toast.success("Kegiatan terdokumentasi 📝");
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={close}
        className="absolute inset-0 z-[60] bg-[rgba(9,40,37,.45)]"
      />
      <div className="anim-sheet-up absolute right-0 bottom-0 left-0 z-[61] max-h-[88%] overflow-y-auto rounded-t-3xl bg-white px-5 pt-3.5 pb-6">
        <div className="bg-line-3 mx-auto mb-3 h-1.5 w-11 rounded-full" />

        <div className="text-teal text-[13px] font-extrabold">Task selesai 🎉</div>
        <div className="text-ink mt-0.5 text-[17px] leading-tight font-extrabold">
          {task.title}
        </div>
        <p className="text-slate mt-1.5 text-[13px] font-semibold">
          Apa yang sudah kamu lakukan? Dokumentasikan hasilnya (opsional) — bisa
          diketik, direkam suara, atau difoto.
        </p>

        <div className="relative mt-3.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tulis hasil kegiatanmu…"
            rows={3}
            className="border-line-2 bg-soft text-ink-2 focus:border-teal w-full resize-none rounded-xl border-[1.5px] px-3 py-2.5 text-[14px] outline-none focus:bg-white"
          />
          {aiBusy && (
            <div className="text-teal bg-mint-2 absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              AI merangkum…
            </div>
          )}
        </div>

        {/* Pratinjau lampiran */}
        {(photoPreview || audio) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {photoPreview && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Pratinjau foto"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview("");
                  }}
                  aria-label="Hapus foto"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {audio && (
              <div className="bg-mint-2 text-teal flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-bold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
                </svg>
                Suara siap
                <button
                  onClick={() => setAudio(null)}
                  aria-label="Hapus suara"
                  className="text-teal/70 hover:text-teal"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickPhoto}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="border-line-2 text-slate hover:border-teal hover:text-teal flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-white text-[13px] font-bold transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Foto
          </button>
          <button
            onClick={toggle}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] text-[13px] font-bold transition",
              recording
                ? "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]"
                : "border-line-2 text-slate hover:border-teal hover:text-teal bg-white",
            )}
          >
            {recording ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
              </svg>
            )}
            {recording ? "Berhenti" : "Suara"}
          </button>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={close}
            disabled={busy}
            className="border-line-2 text-slate h-[50px] flex-1 rounded-[14px] border-[1.5px] bg-white text-[15px] font-bold transition hover:bg-[#F7FAF9] disabled:opacity-60"
          >
            Lewati
          </button>
          <button
            onClick={onSave}
            disabled={!hasContent || busy || aiBusy}
            className="bg-teal hover:bg-teal-deep h-[50px] flex-[1.4] rounded-[14px] text-[15px] font-bold text-white transition disabled:opacity-40"
          >
            {busy ? "Menyimpan…" : "Simpan dokumentasi"}
          </button>
        </div>
      </div>
    </>
  );
}
