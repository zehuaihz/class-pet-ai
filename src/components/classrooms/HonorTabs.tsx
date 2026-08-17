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
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      <Link
        href={`/classrooms/${classroomId}/badges`}
        className={`rounded-md px-4 py-1.5 text-sm ${isBadges ? "bg-white font-medium text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
      >
        徽章
      </Link>
      <Link
        href={`/classrooms/${classroomId}/leaderboard`}
        className={`rounded-md px-4 py-1.5 text-sm ${!isBadges ? "bg-white font-medium text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
      >
        排行
      </Link>
    </div>
  )
}
