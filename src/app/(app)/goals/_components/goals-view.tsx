"use client";

import {
  alphaColor,
  areaColor,
  LIFE_AREA_NAMES,
  LIFE_AREAS,
} from "@/constants/life-area-constant";
import {
  addGoal,
  deleteGoal,
  getGoals,
  updateGoalStatus,
} from "@/features/goals/action";
import { cn } from "@/lib/utils";
import { GoalNode, LifeArea } from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function GoalsView({
  initialGoals,
}: {
  initialGoals: GoalNode[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<LifeArea | null>(null);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: () => getGoals(),
    initialData: initialGoals,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["goals"] });

  async function submitGoal() {
    const clean = title.trim();
    if (!clean) return;
    const res = await addGoal({ title: clean, lifeArea: area });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setTitle("");
    setArea(null);
    setAdding(false);
    refresh();
    toast.success("Goal ditambahkan");
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-5 pt-5 pb-8">
      {/* header + back */}
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
        <div className="flex-1">
          <div className="text-ink text-lg font-extrabold">Goals</div>
          <div className="text-mute text-[12.5px]">
            Tujuan besar &amp; milestone-nya
          </div>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="bg-teal hover:bg-teal-deep flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold text-white transition"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Goal
        </button>
      </div>

      {/* form tambah goal */}
      {adding && (
        <div className="border-line anim-fade-in mb-4 rounded-2xl border bg-white p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitGoal()}
            autoFocus
            placeholder="Apa tujuan besarmu?"
            className="border-line-2 bg-soft text-ink-2 focus:border-teal h-11 w-full rounded-xl border-[1.5px] px-3.5 text-sm outline-none focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LIFE_AREA_NAMES.map((a) => {
              const sel = area === a;
              const c = LIFE_AREAS[a];
              return (
                <button
                  key={a}
                  onClick={() => setArea(sel ? null : a)}
                  className="h-7 rounded-2xl border-[1.5px] px-2.5 text-[11px] font-bold transition"
                  style={{
                    borderColor: sel ? c : "#D6E1DF",
                    background: sel ? alphaColor(c, 0.14) : "#fff",
                    color: sel ? c : "#5B7370",
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <button
            onClick={submitGoal}
            className="bg-teal hover:bg-teal-deep mt-3.5 h-10 w-full rounded-xl text-[13.5px] font-bold text-white transition"
          >
            Simpan goal
          </button>
        </div>
      )}

      {goals.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <div className="text-4xl">🎯</div>
          <div className="text-ink mt-1 text-base font-extrabold">
            Belum ada goal
          </div>
          <div className="text-mute max-w-[240px] text-[13px] leading-[1.55]">
            Tetapkan 1–3 tujuan besar, pecah jadi milestone, lalu kaitkan task
            harianmu ke sana.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onChanged,
  child = false,
}: {
  goal: GoalNode;
  onChanged: () => void;
  child?: boolean;
}) {
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const done = goal.status === "done";
  const c = goal.life_area ? areaColor(goal.life_area) : "#0F766E";
  const pct = goal.taskTotal
    ? Math.round((goal.taskDone / goal.taskTotal) * 100)
    : 0;

  async function toggleDone() {
    const res = await updateGoalStatus(goal.id, done ? "active" : "done");
    if (res.error) toast.error(res.error);
    else onChanged();
  }

  async function remove() {
    const res = await deleteGoal(goal.id);
    if (res.error) toast.error(res.error);
    else {
      onChanged();
      toast.success("Goal dihapus");
    }
  }

  async function submitMilestone() {
    const clean = msTitle.trim();
    if (!clean) return;
    const res = await addGoal({ title: clean, parentId: goal.id });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setMsTitle("");
    setAddingMilestone(false);
    onChanged();
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white",
        child ? "border-line-soft" : "border-line",
      )}
      style={!child ? { borderLeft: `3px solid ${c}` } : undefined}
    >
      <div className="flex items-start gap-3 p-3.5">
        <button
          onClick={toggleDone}
          aria-label={done ? "Aktifkan lagi" : "Tandai selesai"}
          className={cn(
            "mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] transition",
            done ? "border-teal bg-teal" : "border-line-3 bg-white hover:border-teal",
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
              "text-ink-2 text-sm font-bold",
              done && "text-mute line-through",
            )}
          >
            {goal.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {goal.life_area && (
              <span
                className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                style={{ background: alphaColor(c, 0.12), color: c }}
              >
                {goal.life_area}
              </span>
            )}
            {goal.taskTotal > 0 && (
              <span className="text-mute-2 text-[11px] font-semibold">
                {goal.taskDone}/{goal.taskTotal} task
              </span>
            )}
          </div>
          {goal.taskTotal > 0 && (
            <div className="bg-seg mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: c }}
              />
            </div>
          )}
        </div>
        <button
          onClick={remove}
          aria-label="Hapus goal"
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

      {/* milestones */}
      {(goal.children.length > 0 || addingMilestone) && (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5 pl-8">
          {goal.children.map((child) => (
            <GoalCard
              key={child.id}
              goal={child}
              onChanged={onChanged}
              child
            />
          ))}
          {addingMilestone && (
            <div className="flex gap-2">
              <input
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitMilestone()}
                autoFocus
                placeholder="Milestone…"
                className="border-line-2 bg-soft text-ink-2 focus:border-teal h-9 flex-1 rounded-lg border-[1.5px] px-3 text-[13px] outline-none focus:bg-white"
              />
              <button
                onClick={submitMilestone}
                className="bg-teal h-9 rounded-lg px-3 text-[12.5px] font-bold text-white"
              >
                Tambah
              </button>
            </div>
          )}
        </div>
      )}

      {!child && (
        <button
          onClick={() => setAddingMilestone((v) => !v)}
          className="text-teal border-line-soft flex w-full items-center gap-1.5 border-t px-3.5 py-2.5 text-[12.5px] font-bold transition hover:bg-[#FBFDFD]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Milestone
        </button>
      )}
    </div>
  );
}
