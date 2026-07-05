"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductiveTime } from "@/types/profile";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

type OnboardingInput = {
  goals: string[]; // maks 3 goal awal
  productiveTime: ProductiveTime;
  firstTask?: string;
};

/** Simpan hasil onboarding: goal awal, jam produktif, task pertama. */
export async function finishOnboardingAction(
  input: OnboardingInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  const goals = input.goals
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (goals.length) {
    const { error } = await supabase
      .from("goals")
      .insert(goals.map((title) => ({ user_id: user.id, title })));
    if (error) return { error: error.message };
  }

  const firstTask = input.firstTask?.trim();
  if (firstTask) {
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: firstTask,
      life_area: "Pribadi",
      priority: "sedang",
      due_date: format(new Date(), "yyyy-MM-dd"),
      ai_reason: "Task pertamamu — mulai kecil",
    });
    if (error) return { error: error.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      productive_time: input.productiveTime,
      onboarding_completed: true,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

/** Lewati onboarding tanpa data awal. */
export async function skipOnboardingAction(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
