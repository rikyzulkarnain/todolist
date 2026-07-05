/** Skeleton Home (kartu fokus + tombol AI + jadwal) sesuai prototype. */
export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-[90px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="bg-skeleton anim-pulse-soft h-6 w-44 rounded-md" />
          <div className="bg-skeleton anim-pulse-soft h-3.5 w-32 rounded-md" />
        </div>
        <div className="bg-skeleton anim-pulse-soft h-11 w-11 rounded-full" />
      </div>
      <div className="bg-skeleton anim-pulse-soft h-[170px] rounded-[18px]" />
      <div className="bg-skeleton anim-pulse-soft h-16 rounded-2xl [animation-delay:.15s]" />
      <div className="bg-skeleton anim-pulse-soft h-[180px] rounded-[18px] [animation-delay:.3s]" />
    </div>
  );
}
