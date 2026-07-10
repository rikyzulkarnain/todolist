"use client";

import {
  addTaskLog,
  deleteTaskLog,
  getTaskLogs,
} from "@/features/tasks/logs";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { Attachment, downscaleImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { TaskLogView } from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Log Kegiatan: timeline dokumentasi apa yang sudah dilakukan pada task, plus
 * composer untuk menambah entri baru (catatan opsional + lampiran foto & suara).
 * Suara ditranskrip di server agar bisa jadi referensi AI untuk jadwal berikut.
 */
export default function TaskLogSection({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["task-logs", taskId],
    queryFn: () => getTaskLogs(taskId),
  });

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Attachment | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [audio, setAudio] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { recording, toggle } = useAudioRecorder({
    onRecorded: (a) => setAudio(a),
  });

  const hasContent = note.trim() || photo || audio;

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
    } catch {
      toast.error("Gagal memproses foto.");
    }
  }

  function resetComposer() {
    setNote("");
    setPhoto(null);
    setPhotoPreview("");
    setAudio(null);
  }

  async function onSave() {
    if (!hasContent || busy) return;
    setBusy(true);
    try {
      const res = await addTaskLog({
        taskId,
        note: note.trim() || null,
        photo,
        audio,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      resetComposer();
      queryClient.invalidateQueries({ queryKey: ["task-logs", taskId] });
      toast.success("Kegiatan tercatat");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    const res = await deleteTaskLog(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["task-logs", taskId] });
  }

  return (
    <div>
      {/* Composer */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Apa yang kamu lakukan? (opsional)"
        rows={2}
        className="border-line-2 bg-soft text-ink-2 focus:border-teal w-full resize-none rounded-xl border-[1.5px] px-3 py-2.5 text-[13.5px] outline-none focus:bg-white"
      />

      {/* Preview lampiran yang belum disimpan */}
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

      <div className="mt-2 flex items-center gap-2">
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
          className="border-line-2 text-slate hover:border-teal hover:text-teal flex h-9 items-center gap-1.5 rounded-lg border-[1.5px] bg-white px-3 text-[12.5px] font-bold transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Foto
        </button>
        <button
          onClick={toggle}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg border-[1.5px] px-3 text-[12.5px] font-bold transition",
            recording
              ? "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]"
              : "border-line-2 text-slate hover:border-teal hover:text-teal bg-white",
          )}
        >
          {recording ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
            </svg>
          )}
          {recording ? "Berhenti" : "Suara"}
        </button>
        <button
          onClick={onSave}
          disabled={!hasContent || busy}
          className="bg-teal hover:bg-teal-deep ml-auto flex h-9 items-center rounded-lg px-4 text-[12.5px] font-bold text-white transition disabled:opacity-40"
        >
          {busy ? "Menyimpan…" : "Catat"}
        </button>
      </div>

      {/* Timeline */}
      <div className="mt-4 flex flex-col gap-3">
        {isLoading && (
          <div className="text-mute text-[12.5px] font-semibold">Memuat…</div>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="text-mute text-[12.5px] font-semibold">
            Belum ada catatan kegiatan. Dokumentasikan apa yang kamu lakukan agar
            jadi referensi berikutnya.
          </div>
        )}
        {logs.map((log) => (
          <LogItem key={log.id} log={log} onDelete={() => onDelete(log.id)} />
        ))}
      </div>
    </div>
  );
}

function LogItem({
  log,
  onDelete,
}: {
  log: TaskLogView;
  onDelete: () => void;
}) {
  return (
    <div className="border-line-2 bg-soft rounded-xl border-[1.5px] p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-mute text-[11.5px] font-bold">
          {formatWhen(log.created_at)}
        </span>
        <button
          onClick={onDelete}
          aria-label="Hapus log"
          className="text-mute -mt-0.5 -mr-0.5 flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>

      {log.note && (
        <p className="text-ink-2 mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {log.note}
        </p>
      )}

      {log.photoUrl && (
        <a href={log.photoUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={log.photoUrl}
            alt="Dokumentasi kegiatan"
            className="mt-2 max-h-52 w-full rounded-lg object-cover"
          />
        </a>
      )}

      {log.audioUrl && (
        <audio src={log.audioUrl} controls className="mt-2 h-9 w-full" />
      )}

      {log.transcript && (
        <p className="text-slate mt-2 flex gap-1.5 text-[12px] leading-relaxed italic">
          <svg className="mt-0.5 flex-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
          </svg>
          {log.transcript}
        </p>
      )}
    </div>
  );
}
