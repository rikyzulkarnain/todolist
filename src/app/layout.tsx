import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import QueryProvider from "@/providers/query-client";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  applicationName: "AI Life OS",
  title: "AI Life OS — Selalu tahu apa yang harus dikerjakan",
  description:
    "Personal operating system: task, kalender, reminder, dan AI yang memahami tujuan serta kebiasaanmu.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full antialiased", jakarta.variable)}>
      <body className="font-sans min-h-full">
        <QueryProvider>
          {/* Shell ponsel 390px — di layar lebar tampil sebagai frame di tengah
              (persis canvas prototype), di ponsel memenuhi layar. */}
          <div className="min-h-dvh flex items-center justify-center sm:p-4">
            <div className="relative flex flex-col w-full h-dvh bg-shell overflow-hidden sm:w-[390px] sm:h-[800px] sm:max-h-[96vh] sm:rounded-[28px] sm:shadow-[0_24px_60px_rgba(13,60,56,.18)]">
              {children}
            </div>
          </div>
          <Toaster position="top-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
