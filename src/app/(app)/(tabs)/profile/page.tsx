import { getProfile, getQuota } from "@/features/profile/action";
import { redirect } from "next/navigation";
import ProfileView from "./_components/profile-view";

export default async function ProfilePage() {
  const [profile, quota] = await Promise.all([getProfile(), getQuota()]);
  if (!profile) redirect("/login");

  return <ProfileView profile={profile} quota={quota} />;
}
