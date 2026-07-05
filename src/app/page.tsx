import { getProfile } from "@/features/profile/action";
import { redirect } from "next/navigation";

export default async function RootPage() {
  // Kalau sudah login, langsung ke halaman utama (atau onboarding bila belum
  // selesai). Kalau belum, layar Login adalah pintu masuknya.
  const profile = await getProfile();
  if (profile) {
    redirect(profile.onboarding_completed ? "/home" : "/onboarding");
  }
  redirect("/login");
}
