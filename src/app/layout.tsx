// ⚠️ گام ۰ مشترک تیم — Placeholder حداقلی
// مالک نهایی این فایل طبق TEAM.md: امیرعلی (Amirali) — تم گوتیک/Vazirmatn در موج ۱ او جایگزین می‌شود.
// این نسخه فقط برای قابل‌اجرا شدن اسکلت Next.js و صفحات /preview/* هر سه عضو ساخته شده است.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "پرده سرخ: تماشاخانه اُرفه‌ئو",
  description:
    "اتاق فرار آنلاین اول‌شخص چندنفره (۳ تا ۸ بازیکن) — فصل آغازین",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
