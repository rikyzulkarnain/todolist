import {
  getConversations,
  getOrCreateConversation,
} from "@/features/assistant/action";
import { getQuota } from "@/features/profile/action";
import { redirect } from "next/navigation";
import AssistantView from "./_components/assistant-view";

export default async function AiPage() {
  const [init, conversations, quota] = await Promise.all([
    getOrCreateConversation(),
    getConversations(),
    getQuota(),
  ]);
  if (!init) redirect("/login");

  return (
    <AssistantView
      init={init}
      initialConversations={conversations}
      initialQuota={quota}
    />
  );
}
