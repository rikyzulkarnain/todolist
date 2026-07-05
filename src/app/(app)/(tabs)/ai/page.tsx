import { getOrCreateConversation } from "@/features/assistant/action";
import { getQuota } from "@/features/profile/action";
import { redirect } from "next/navigation";
import AssistantView from "./_components/assistant-view";

export default async function AiPage() {
  const [init, quota] = await Promise.all([
    getOrCreateConversation(),
    getQuota(),
  ]);
  if (!init) redirect("/login");

  return <AssistantView init={init} initialQuota={quota} />;
}
