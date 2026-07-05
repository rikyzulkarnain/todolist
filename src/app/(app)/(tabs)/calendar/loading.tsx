/** Skeleton kalender (strip hari + daftar) sesuai prototype. */
export default function CalendarLoading() {
  return (
    <div className="flex flex-col gap-2.5 px-5 pt-[22px] pb-[90px]">
      <div className="bg-skeleton anim-pulse-soft h-7 w-32 rounded-md" />
      <div className="bg-skeleton anim-pulse-soft h-16 rounded-2xl" />
      <div className="bg-skeleton anim-pulse-soft h-16 rounded-2xl [animation-delay:.15s]" />
      <div className="bg-skeleton anim-pulse-soft h-16 rounded-2xl [animation-delay:.3s]" />
    </div>
  );
}
