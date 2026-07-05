import { getGoals } from "@/features/goals/action";
import GoalsView from "./_components/goals-view";

export default async function GoalsPage() {
  const goals = await getGoals();
  return <GoalsView initialGoals={goals} />;
}
