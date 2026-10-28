"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

/** 荣誉墙 Tab：在徽章墙与光荣榜之间切换（两者合并为一个导航项）。 */
export function HonorTabs() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const pathname = usePathname()
  const isBadges = pathname.endsWith("/badges")

  return (
    <div className="inline-flex gap-1.5 rounded-full border-2 border-ink bg-paper-deep p-1.5 shadow-sticker-sm">
      <Link
        href={`/classrooms/${classroomId}/badges`}
        className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${isBadges ? "border-2 border-ink bg-butter text-ink shadow-sticker-sm" : "border-2 border-transparent text-ink-soft hover:text-ink"}`}
      >
        🏅 徽章
      </Link>
      <Link
        href={`/classrooms/${classroomId}/leaderboard`}
        className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${!isBadges ? "border-2 border-ink bg-butter text-ink shadow-sticker-sm" : "border-2 border-transparent text-ink-soft hover:text-ink"}`}
      >
        🏆 排行
      </Link>
    </div>
  )
}
