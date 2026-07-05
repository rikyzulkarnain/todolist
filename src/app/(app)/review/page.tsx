import { getWeeklyReview } from "@/features/review/action";
import ReviewView from "./_components/review-view";

export default async function ReviewPage() {
  const review = await getWeeklyReview();
  return <ReviewView review={review} />;
}
