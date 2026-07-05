import { getProfile } from "@/features/profile/action";
import { redirect } from "next/navigation";
import OnboardingView from "./_components/onboarding-view";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarding_completed) redirect("/home");

  return <OnboardingView name={profile.name?.split(" ")[0] ?? "kamu"} />;
}
