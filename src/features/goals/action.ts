"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Goal, GoalNode, GoalStatus, LifeArea } from "@/types/task";
import { revalidatePath } from "next/cache";

function revalidateGoalScreens() {
  revalidatePath("/goals");
  revalidatePath("/home");
}

/**
 * Goal Tree: goal besar (top-level) → milestone (anak, parent_goal_id).
 * Tiap node dilengkapi progress task terkait (tasks.goal_id).
 */
export async function getGoals(): Promise<GoalNode[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const [{ data: goals }, { data: tasks }] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: true })
      .returns<Goal[]>(),
    supabase
      .from("tasks")
      .select("goal_id, status")
      .eq("user_id", user.id)
      .not("goal_id", "is", null)
      .returns<{ goal_id: string; status: string }[]>(),
  ]);

  const progress = new Map<string, { done: number; total: number }>();
  for (const t of tasks ?? []) {
    const cur = progress.get(t.goal_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    progress.set(t.goal_id, cur);
  }

  const nodes = new Map<string, GoalNode>();
  for (const g of goals ?? []) {
    const p = progress.get(g.id) ?? { done: 0, total: 0 };
    nodes.set(g.id, {
      ...g,
      children: [],
      taskDone: p.done,
      taskTotal: p.total,
    });
  }

  const roots: GoalNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_goal_id
      ? nodes.get(node.parent_goal_id)
      : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Goal aktif (flat) untuk selector pada sheet detail task. */
export async function getActiveGoals(): Promise<
  Pick<Goal, "id" | "title">[]
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("goals")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<Pick<Goal, "id" | "title">[]>();

  return data ?? [];
}

export async function addGoal(input: {
  title: string;
  lifeArea?: LifeArea | null;
  parentId?: string | null;
  targetDate?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const title = input.title.trim();
  if (!title) return { error: "Tulis judul goal dulu" };

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      life_area: input.lifeArea ?? null,
      parent_goal_id: input.parentId ?? null,
      target_date: input.targetDate ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateGoalScreens();
  return { id: data.id as string };
}

export async function updateGoalStatus(
  id: string,
  status: GoalStatus,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateGoalScreens();
  return {};
}

/** Hapus goal. Milestone anak jadi top-level (FK parent on delete set null),
 *  task terkait dilepas dari goal (tasks.goal_id → null). */
export async function deleteGoal(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateGoalScreens();
  return {};
}
