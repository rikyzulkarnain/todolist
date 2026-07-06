"use client";

import {
  addSharedTask,
  addShoppingItem,
  createSpace,
  deleteSharedTask,
  deleteShoppingItem,
  getMySpace,
  getSharedTasks,
  getShoppingItems,
  joinSpace,
  leaveSpace,
  toggleSharedTask,
  toggleShoppingItem,
} from "@/features/space/action";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SpaceWithMembers } from "@/types/space";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CoupleView({
  initialSpace,
}: {
  initialSpace: SpaceWithMembers | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: space } = useQuery({
    queryKey: ["my-space"],
    queryFn: () => getMySpace(),
    initialData: initialSpace,
  });

  const spaceId = space?.space.id;

  // Realtime: sinkronkan task & shopping berbagi antar anggota.
  useEffect(() => {
    if (!spaceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`space-${spaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `space_id=eq.${spaceId}`,
        },
        () =>
          queryClient.invalidateQueries({ queryKey: ["shopping", spaceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `space_id=eq.${spaceId}`,
        },
        () =>
          queryClient.invalidateQueries({ queryKey: ["shared-tasks", spaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, queryClient]);

  return (
    <div className="flex flex-1 flex-col overflow-auto px-5 pt-5 pb-8">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push("/home")}
          aria-label="Kembali"
          className="border-line-2 text-slate hover:bg-soft flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] bg-white transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <div className="text-ink text-lg font-extrabold">Couple Mode</div>
          <div className="text-mute text-[12.5px]">
            {space ? space.space.name : "Berbagi task, kalender & belanja"}
          </div>
        </div>
      </div>

      {!space ? (
        <SpaceOnboarding
          onDone={() =>
            queryClient.invalidateQueries({ queryKey: ["my-space"] })
          }
        />
      ) : (
        <SpaceDashboard space={space} />
      )}
    </div>
  );
}

function SpaceOnboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createSpace(name);
      if (res.error) return toast.error(res.error);
      toast.success("Ruang dibuat — bagikan kodenya ke pasanganmu");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await joinSpace(code);
      if (res.error) return toast.error(res.error);
      toast.success("Berhasil bergabung 🎉");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[20px] bg-[linear-gradient(150deg,#0F766E,#0A5750)] p-5 text-white">
        <div className="text-2xl">💞</div>
        <div className="mt-2 text-[17px] font-extrabold">Buat ruang berdua</div>
        <div className="mt-1 text-[13px] leading-[1.55] text-[#B9E6E0]">
          Task, kalender, dan daftar belanja yang tersinkron real-time untuk kamu
          dan pasangan.
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama ruang (mis. Rumah Kami)"
          className="mt-4 h-11 w-full rounded-xl border-0 bg-white/95 px-3.5 text-sm text-[#0B3B36] outline-none placeholder:text-[#6B8A85]"
        />
        <button
          onClick={create}
          disabled={busy}
          className="text-teal mt-3 h-11 w-full rounded-xl bg-white text-sm font-extrabold transition hover:opacity-90 disabled:opacity-60"
        >
          Buat ruang
        </button>
      </div>

      <div className="border-line rounded-[18px] border bg-white p-5">
        <div className="text-ink text-[15px] font-extrabold">Punya kode?</div>
        <div className="text-mute mt-1 text-[12.5px]">
          Masukkan kode undangan dari pasanganmu untuk bergabung.
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="mis. K7P2QX"
            maxLength={6}
            className="border-line-2 bg-soft text-ink-2 focus:border-teal h-11 min-w-0 flex-1 rounded-xl border-[1.5px] px-3.5 text-sm font-bold tracking-[2px] uppercase outline-none focus:bg-white"
          />
          <button
            onClick={join}
            disabled={busy}
            className="bg-teal hover:bg-teal-deep h-11 rounded-xl px-4 text-[13.5px] font-bold text-white transition disabled:opacity-60"
          >
            Gabung
          </button>
        </div>
      </div>
    </div>
  );
}

function SpaceDashboard({ space }: { space: SpaceWithMembers }) {
  const queryClient = useQueryClient();
  const spaceId = space.space.id;
  const nameOf = (userId: string | null) =>
    space.members.find((m) => m.user_id === userId)?.display_name ?? "Anggota";

  const { data: tasks = [] } = useQuery({
    queryKey: ["shared-tasks", spaceId],
    queryFn: () => getSharedTasks(spaceId),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["shopping", spaceId],
    queryFn: () => getShoppingItems(spaceId),
  });

  const [taskInput, setTaskInput] = useState("");
  const [itemInput, setItemInput] = useState("");

  const refetchTasks = () =>
    queryClient.invalidateQueries({ queryKey: ["shared-tasks", spaceId] });
  const refetchItems = () =>
    queryClient.invalidateQueries({ queryKey: ["shopping", spaceId] });

  async function onAddTask() {
    const clean = taskInput.trim();
    if (!clean) return;
    setTaskInput("");
    const res = await addSharedTask(spaceId, clean);
    if (res.error) toast.error(res.error);
    refetchTasks();
  }
  async function onAddItem() {
    const clean = itemInput.trim();
    if (!clean) return;
    setItemInput("");
    const res = await addShoppingItem(spaceId, clean);
    if (res.error) toast.error(res.error);
    refetchItems();
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(space.space.invite_code);
      toast.success("Kode disalin");
    } catch {
      toast(space.space.invite_code);
    }
  }
  async function onLeave() {
    const res = await leaveSpace(spaceId);
    if (res.error) return toast.error(res.error);
    toast.success("Kamu keluar dari ruang ini");
    queryClient.invalidateQueries({ queryKey: ["my-space"] });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* kode undangan + anggota */}
      <div className="border-line rounded-[18px] border bg-white p-4">
        <div className="text-slate text-[11.5px] font-extrabold tracking-[.5px] uppercase">
          Kode undangan
        </div>
        <button
          onClick={copyCode}
          className="border-line-2 hover:border-teal group mt-2 flex w-full items-center justify-between rounded-xl border-[1.5px] border-dashed bg-[#FBFDFD] px-4 py-3 transition"
        >
          <span className="text-ink text-xl font-extrabold tracking-[4px]">
            {space.space.invite_code}
          </span>
          <span className="text-teal flex items-center gap-1.5 text-[12px] font-bold">
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
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Salin
          </span>
        </button>

        <div className="mt-3 flex flex-wrap gap-2">
          {space.members.map((m) => (
            <div
              key={m.user_id}
              className="bg-soft flex items-center gap-2 rounded-full py-1 pr-3 pl-1"
            >
              <div className="bg-teal flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white">
                {(m.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="text-ink-2 text-[12.5px] font-bold">
                {m.display_name ?? "Anggota"}
              </span>
              {m.role === "owner" && (
                <span className="text-mute-2 text-[10px] font-bold uppercase">
                  owner
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* task berbagi */}
      <Section title="Task berbagi" count={tasks.length}>
        <div className="mb-2.5 flex gap-2">
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddTask()}
            placeholder="Tambah task bersama…"
            className="border-line-2 bg-soft text-ink-2 focus:border-teal h-10 min-w-0 flex-1 rounded-xl border-[1.5px] px-3.5 text-[13.5px] outline-none focus:bg-white"
          />
          <button
            onClick={onAddTask}
            className="bg-teal hover:bg-teal-deep h-10 rounded-xl px-3.5 text-[13px] font-bold text-white transition"
          >
            Tambah
          </button>
        </div>
        {tasks.length === 0 ? (
          <Empty label="Belum ada task bersama" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.map((t) => {
              const done = t.status === "done";
              return (
                <Row
                  key={t.id}
                  done={done}
                  onToggle={async () => {
                    await toggleSharedTask(t.id);
                    refetchTasks();
                  }}
                  onDelete={async () => {
                    await deleteSharedTask(t.id);
                    refetchTasks();
                  }}
                  title={t.title}
                  sub={`oleh ${nameOf(t.user_id)}`}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* shopping list */}
      <Section title="Daftar belanja" count={items.length}>
        <div className="mb-2.5 flex gap-2">
          <input
            value={itemInput}
            onChange={(e) => setItemInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddItem()}
            placeholder="Tambah barang…"
            className="border-line-2 bg-soft text-ink-2 focus:border-teal h-10 min-w-0 flex-1 rounded-xl border-[1.5px] px-3.5 text-[13.5px] outline-none focus:bg-white"
          />
          <button
            onClick={onAddItem}
            className="bg-teal hover:bg-teal-deep h-10 rounded-xl px-3.5 text-[13px] font-bold text-white transition"
          >
            Tambah
          </button>
        </div>
        {items.length === 0 ? (
          <Empty label="Daftar belanja kosong" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((it) => (
              <Row
                key={it.id}
                done={it.checked}
                onToggle={async () => {
                  await toggleShoppingItem(it.id, !it.checked);
                  refetchItems();
                }}
                onDelete={async () => {
                  await deleteShoppingItem(it.id);
                  refetchItems();
                }}
                title={it.name}
                sub={`oleh ${nameOf(it.added_by)}`}
              />
            ))}
          </div>
        )}
      </Section>

      <button
        onClick={onLeave}
        className="border-danger-line text-danger mt-2 h-12 rounded-[14px] border-[1.5px] bg-white text-sm font-bold transition hover:bg-[#FBF3F2]"
      >
        Keluar dari ruang
      </button>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-slate mb-2.5 flex items-center gap-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
        {title}
        <span className="text-mute-2">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="border-line-4 rounded-xl border border-dashed bg-white px-4 py-5 text-center">
      <div className="text-slate-2 text-[13px] font-semibold">{label}</div>
    </div>
  );
}

function Row({
  done,
  title,
  sub,
  onToggle,
  onDelete,
}: {
  done: boolean;
  title: string;
  sub: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-line flex items-center gap-3 rounded-[13px] border bg-white px-3 py-2.5">
      <button
        onClick={onToggle}
        aria-label={done ? "Batalkan" : "Tandai selesai"}
        className={cn(
          "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] transition",
          done ? "bg-teal border-teal" : "border-line-3 bg-white hover:border-teal",
        )}
      >
        {done && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-ink-2 text-[13.5px] font-semibold",
            done && "text-mute line-through",
          )}
        >
          {title}
        </div>
        <div className="text-mute-2 text-[11px]">{sub}</div>
      </div>
      <button
        onClick={onDelete}
        aria-label="Hapus"
        className="text-mute-2 flex h-7 w-7 flex-none items-center justify-center rounded-lg transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
      >
        <svg
          width="14"
          height="14"
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
}
