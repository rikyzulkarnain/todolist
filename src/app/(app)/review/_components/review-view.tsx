"use client";

import { areaColor } from "@/constants/life-area-constant";
import { WeeklyReview } from "@/features/review/action";
import { useRouter } from "next/navigation";

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];

export default function ReviewView({ review }: { review: WeeklyReview }) {
  const router = useRouter();
  const pct = Math.round(review.completionRate * 100);

  return (
    <div className="flex flex-1 flex-col overflow-auto px-5 pt-5 pb-8">
      {/* header + back */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push("/home")}
          aria-label="Kembali"
          className="border-line-2 text-slate hover:bg-soft flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] bg-white transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <div className="text-ink text-lg font-extrabold">Tinjauan mingguan</div>
          <div className="text-mute text-[12.5px]">{review.rangeLabel}</div>
        </div>
      </div>

      {/* kartu ringkas completion */}
      <div className="rounded-[20px] bg-[linear-gradient(150deg,#0F766E,#0A5750)] p-5 text-white">
        <div className="text-aqua-2 text-xs font-bold tracking-[.8px] uppercase">
          Penyelesaian task
        </div>
        <div className="mt-2 flex items-end gap-2">
          <div className="text-[40px] leading-none font-extrabold">{pct}%</div>
          <div className="text-aqua-2 mb-1 text-[13px] font-semibold">
            {review.done} dari {review.total} task
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.18]">
          <div
            className="bg-aqua h-full rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* stat kecil */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="border-line rounded-[16px] border bg-white p-4">
          <div className="text-mute text-[11.5px] font-bold tracking-[.4px] uppercase">
            Hari produktif
          </div>
          <div className="text-ink mt-1.5 text-lg font-extrabold">
            {review.bestDay ?? "—"}
          </div>
          <div className="text-mute-2 text-[11.5px] font-semibold">
            {review.bestDayCount
              ? `${review.bestDayCount} task selesai`
              : "Belum ada"}
          </div>
        </div>
        <div className="border-line rounded-[16px] border bg-white p-4">
          <div className="text-mute text-[11.5px] font-bold tracking-[.4px] uppercase">
            Mood rata-rata
          </div>
          <div className="text-ink mt-1.5 flex items-center gap-1.5 text-lg font-extrabold">
            {review.avgMood !== null ? (
              <>
                <span className="text-xl">
                  {MOOD_EMOJI[Math.round(review.avgMood)]}
                </span>
                {review.avgMood}/5
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="text-mute-2 text-[11.5px] font-semibold">
            {review.reflectionDays}/7 hari refleksi
          </div>
        </div>
      </div>

      {/* per Life Area */}
      {review.byArea.length > 0 && (
        <>
          <div className="text-slate mt-6 mb-2.5 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
            Per Life Area
          </div>
          <div className="border-line flex flex-col gap-3 rounded-[16px] border bg-white p-4">
            {review.byArea.map((a) => {
              const areaPct = a.total ? Math.round((a.done / a.total) * 100) : 0;
              const c = areaColor(a.area);
              return (
                <div key={a.area}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-ink-2 text-[13px] font-bold">
                      {a.area}
                    </span>
                    <span className="text-mute text-[11.5px] font-semibold">
                      {a.done}/{a.total}
                    </span>
                  </div>
                  <div className="bg-seg h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${areaPct}%`, background: c }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* insight */}
      <div className="text-slate mt-6 mb-2.5 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
        Insight
      </div>
      <div className="flex flex-col gap-2">
        {review.insights.map((text, i) => (
          <div
            key={i}
            className="border-line flex items-start gap-2.5 rounded-[14px] border bg-white px-3.5 py-3"
          >
            <div className="bg-mint mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0F766E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              </svg>
            </div>
            <div className="text-ink-2 text-[13px] leading-[1.5] font-medium">
              {text}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push("/reflection")}
        className="border-line-4 text-teal hover:bg-mint-3 mt-6 h-12 rounded-[14px] border-[1.5px] bg-white text-sm font-bold transition"
      >
        Tulis refleksi hari ini
      </button>
    </div>
  );
}
