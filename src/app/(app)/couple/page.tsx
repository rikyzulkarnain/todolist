import { getMySpace } from "@/features/space/action";
import CoupleView from "./_components/couple-view";

export default async function CouplePage() {
  const space = await getMySpace();
  return <CoupleView initialSpace={space} />;
}
