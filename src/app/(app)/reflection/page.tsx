import { getTodayReflection } from "@/features/reflection/action";
import ReflectionView from "./_components/reflection-view";

export default async function ReflectionPage() {
  const reflection = await getTodayReflection();
  return <ReflectionView initial={reflection} />;
}
