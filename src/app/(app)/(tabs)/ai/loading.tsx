/** Skeleton layar asisten AI. */
export default function AiLoading() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5 pb-[90px]">
      <div className="flex items-center gap-2.5">
        <div className="bg-skeleton anim-pulse-soft h-9 w-9 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <div className="bg-skeleton anim-pulse-soft h-4 w-24 rounded-md" />
          <div className="bg-skeleton anim-pulse-soft h-3 w-32 rounded-md" />
        </div>
      </div>
      <div className="bg-skeleton anim-pulse-soft h-14 w-3/4 rounded-2xl [animation-delay:.15s]" />
      <div className="bg-skeleton anim-pulse-soft h-14 w-2/3 self-end rounded-2xl [animation-delay:.3s]" />
    </div>
  );
}
