import AddTaskSheet from "@/components/common/add-task-sheet";
import AlarmOverlay from "@/components/common/alarm-overlay";
import BottomNav from "@/components/common/bottom-nav";
import OfflineBanner from "@/components/common/offline-banner";
import ReminderScheduler from "@/components/common/reminder-scheduler";
import TaskCompletionSheet from "@/components/common/task-completion-sheet";
import TaskDetailSheet from "@/components/common/task-detail-sheet";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <OfflineBanner />
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
      <AddTaskSheet />
      <TaskDetailSheet />
      <TaskCompletionSheet />
      <ReminderScheduler />
      <AlarmOverlay />
      <BottomNav />
    </>
  );
}
