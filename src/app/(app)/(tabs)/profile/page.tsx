import { getGoogleStatus } from "@/features/google/action";
import { getProfile, getQuota } from "@/features/profile/action";
import { getTelegramStatus } from "@/features/telegram/action";
import { redirect } from "next/navigation";
import ProfileView from "./_components/profile-view";

export default async function ProfilePage() {
  // Status integrasi diambil di server agar tidak "berkedip" saat refresh.
  const [profile, quota, telegram, google] = await Promise.all([
    getProfile(),
    getQuota(),
    getTelegramStatus(),
    getGoogleStatus(),
  ]);
  if (!profile) redirect("/login");

  return (
    <ProfileView
      profile={profile}
      quota={quota}
      initialTelegram={telegram}
      initialGoogle={google}
    />
  );
}
