/** Skeleton daftar tugas (label grup + kartu) sesuai prototype. */
export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-2.5 px-5 pt-[22px] pb-[90px]">
      <div className="bg-skeleton anim-pulse-soft h-7 w-24 rounded-md" />
      <div className="bg-skeleton anim-pulse-soft h-11 rounded-xl" />
      <div className="bg-skeleton anim-pulse-soft h-5 w-[90px] rounded-md" />
      <div className="bg-skeleton anim-pulse-soft h-[68px] rounded-2xl [animation-delay:.1s]" />
      <div className="bg-skeleton anim-pulse-soft h-[68px] rounded-2xl [animation-delay:.2s]" />
      <div className="bg-skeleton anim-pulse-soft mt-2 h-5 w-[110px] rounded-md [animation-delay:.3s]" />
      <div className="bg-skeleton anim-pulse-soft h-[68px] rounded-2xl [animation-delay:.4s]" />
    </div>
  );
}
