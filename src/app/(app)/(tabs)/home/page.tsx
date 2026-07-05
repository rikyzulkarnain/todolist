import { getProfile } from "@/features/profile/action";
import { getTasks } from "@/features/tasks/action";
import { redirect } from "next/navigation";
import HomeView from "./_components/home-view";

export default async function HomePage() {
  const [profile, tasks] = await Promise.all([getProfile(), getTasks()]);
  if (!profile) redirect("/login");
  if (!profile.onboarding_completed) redirect("/onboarding");

  return (
    <HomeView
      name={profile.name?.split(" ")[0] ?? "kamu"}
      initialTasks={tasks}
    />
  );
}
