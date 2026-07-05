/** Skeleton profil sesuai pola skeleton layar lain. */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-[90px]">
      <div className="bg-skeleton anim-pulse-soft h-7 w-24 rounded-md" />
      <div className="bg-skeleton anim-pulse-soft h-[92px] rounded-[18px]" />
      <div className="bg-skeleton anim-pulse-soft h-[110px] rounded-[18px] [animation-delay:.15s]" />
      <div className="bg-skeleton anim-pulse-soft h-[140px] rounded-[18px] [animation-delay:.3s]" />
    </div>
  );
}
