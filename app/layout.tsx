import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const serif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "未定稿", template: "%s｜未定稿" },
  description: "面向非技术创作者的 AI 产品驻留计划。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
