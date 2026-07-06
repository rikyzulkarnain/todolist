"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  SharedSpace,
  ShoppingItem,
  SpaceMember,
  SpaceWithMembers,
} from "@/types/space";
import { Task } from "@/types/task";
import { revalidatePath } from "next/cache";

function revalidateCouple() {
  revalidatePath("/couple");
  revalidatePath("/home");
}

function randomInviteCode(): string {
  // Tanpa karakter ambigu (0/O, 1/I) agar mudah dibagikan lisan.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Ruang berbagi pertama yang diikuti user (MVP: satu couple space). */
export async function getMySpace(): Promise<SpaceWithMembers | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: myMembership } = await supabase
    .from("space_members")
    .select("space_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ space_id: string; role: SpaceMember["role"] }>();

  if (!myMembership) return null;

  const [{ data: space }, { data: members }] = await Promise.all([
    supabase
      .from("shared_spaces")
      .select("*")
      .eq("id", myMembership.space_id)
      .maybeSingle<SharedSpace>(),
    supabase
      .from("space_members")
      .select("*")
      .eq("space_id", myMembership.space_id)
      .order("created_at", { ascending: true })
      .returns<SpaceMember[]>(),
  ]);

  if (!space) return null;
  return { space, members: members ?? [], myRole: myMembership.role };
}

export async function createSpace(
  name: string,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const clean = name.trim() || "Ruang Kami";

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle<{ name: string | null; email: string | null }>();
  const displayName =
    profile?.name ?? profile?.email?.split("@")[0] ?? "Aku";

  // Retry bila kode undangan bentrok (kecil kemungkinannya).
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite = randomInviteCode();
    const { data: space, error } = await supabase
      .from("shared_spaces")
      .insert({
        name: clean,
        type: "couple",
        invite_code: invite,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") continue; // unique_violation → coba kode lain
      return { error: error.message };
    }

    const { error: memberError } = await supabase.from("space_members").insert({
      space_id: space.id,
      user_id: user.id,
      role: "owner",
      display_name: displayName,
    });
    if (memberError) return { error: memberError.message };

    revalidateCouple();
    return { id: space.id as string };
  }
  return { error: "Gagal membuat ruang. Coba lagi." };
}

export async function joinSpace(
  code: string,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const clean = code.trim().toUpperCase();
  if (clean.length < 4) return { error: "Kode undangan tidak valid" };

  const { data, error } = await supabase.rpc("join_space_by_code", {
    p_code: clean,
  });
  if (error) return { error: error.message };

  revalidateCouple();
  return { id: data as string };
}

/** Keluar dari space (hapus keanggotaan sendiri). */
export async function leaveSpace(
  spaceId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

// ---- Task berbagi ---------------------------------------------------------

export async function getSharedTasks(spaceId: string): Promise<Task[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("space_id", spaceId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<Task[]>();

  return data ?? [];
}

export async function addSharedTask(
  spaceId: string,
  title: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const clean = title.trim();
  if (!clean) return { error: "Tulis judul dulu" };

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    space_id: spaceId,
    title: clean,
    life_area: "Keluarga",
    priority: "sedang",
    reminder: "none",
  });
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

export async function toggleSharedTask(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  // RLS "own or shared tasks" mengizinkan anggota space membaca & mengubah.
  const { data: task } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", id)
    .maybeSingle<{ status: string }>();
  if (!task) return { error: "Task tidak ditemukan." };

  const done = task.status === "done";
  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "todo" : "done",
      completed_at: done ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

export async function deleteSharedTask(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

// ---- Shopping list --------------------------------------------------------

export async function getShoppingItems(
  spaceId: string,
): Promise<ShoppingItem[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("space_id", spaceId)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<ShoppingItem[]>();

  return data ?? [];
}

export async function addShoppingItem(
  spaceId: string,
  name: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const clean = name.trim();
  if (!clean) return {};

  const { error } = await supabase.from("shopping_items").insert({
    space_id: spaceId,
    name: clean,
    added_by: user.id,
  });
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

export async function toggleShoppingItem(
  id: string,
  checked: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("shopping_items")
    .update({ checked, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}

export async function deleteShoppingItem(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCouple();
  return {};
}
