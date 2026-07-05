import { getTasks } from "@/features/tasks/action";
import TasksView from "./_components/tasks-view";

export default async function TasksPage() {
  const tasks = await getTasks();
  return <TasksView initialTasks={tasks} />;
}
