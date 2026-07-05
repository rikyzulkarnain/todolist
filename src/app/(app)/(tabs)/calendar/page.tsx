import { getTasks } from "@/features/tasks/action";
import CalendarView from "./_components/calendar-view";

export default async function CalendarPage() {
  const tasks = await getTasks();
  return <CalendarView initialTasks={tasks} />;
}
