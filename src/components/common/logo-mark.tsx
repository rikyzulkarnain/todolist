import { cn } from "@/lib/utils";

/** Ikon sparkle AI Life OS (dari prototype) di dalam kotak teal. */
export default function LogoMark({
  size = 64,
  icon = 32,
  className,
}: {
  size?: number;
  icon?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-teal flex items-center justify-center rounded-[20px]",
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * 0.31 }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <circle cx="19" cy="5" r="1.6" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
}
