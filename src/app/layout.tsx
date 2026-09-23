import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "班级宠物积分 AI 教辅系统",
  description: "教师端网页版班级积分、打卡、宠物成长和 AI 教辅系统",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
