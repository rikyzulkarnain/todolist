export type ProductiveTime = "Pagi" | "Siang" | "Malam";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: "free" | "pro";
  productive_time: ProductiveTime | null;
  onboarding_completed: boolean;
  created_at: string;
};
