"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PetVisual } from "@/components/pets/PetVisual"
import type { PetView } from "@/lib/zoo-types"

interface GloryRow {
  student: { id: string; name: string }
  badgeCount: number
  pet: { speciesKey: string; level: number } | null
}

interface ScreenData {
  classroomName: string
  systemName: string
  todayPointCount: number
  zoo: Array<{ student: { id: string; name: string }; badgeCount: number; pet: PetView | null }>
  gloryBoard: GloryRow[]
  slogan: string
}

const MEDALS = ["🥇", "🥈", "🥉"]

export default function ScreenPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [screen, setScreen] = useState<ScreenData | null>(null)
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/v1/classrooms/${classroomId}/screen`)
      if (!response.ok) return
      const payload = await response.json()
      setScreen(payload.data)
    }

    const timer = window.setInterval(load, 3000)
    load().catch(() => undefined)
    return () => window.clearInterval(timer)
  }, [classroomId])

  async function enterFullScreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setFullScreen(true)
    }
  }

  function exitFullScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    }
    setFullScreen(false)
  }

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-5 py-4">
          <div>
            <h1 className="text-3xl font-bold">{screen?.classroomName ?? "班级大屏"}</h1>
            <p className="mt-1 text-slate-300">{screen?.systemName ?? "班级动物园"} · 今日加分 {screen?.todayPointCount ?? 0}</p>
          </div>
          <div className="flex gap-2">
            {fullScreen ? (
              <button className="rounded-lg border border-white/20 px-4 py-2" onClick={exitFullScreen}>退出全屏</button>
            ) : (
              <button className="rounded-lg bg-green-500 px-4 py-2 text-slate-950" onClick={enterFullScreen}>全屏展示</button>
            )}
          </div>
        </div>

        <section className="rounded-3xl bg-slate-800 p-6 shadow-2xl">
          <div className="mb-4 text-center text-xl font-semibold text-slate-200">🐾 班级动物园 · {screen?.slogan ?? ""}</div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {(screen?.zoo ?? []).map((item) => (
              <div key={item.student.id} className="flex flex-col items-center rounded-2xl bg-slate-700/60 p-3 text-center">
                <div className="flex h-20 items-center justify-center">
                  {item.pet ? (
                    <PetVisual speciesKey={item.pet.speciesKey} level={item.pet.level} size="text-5xl" />
                  ) : (
                    <span className="text-5xl">🐾</span>
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-semibold">{item.student.name}</div>
                {item.pet ? (
                  <>
                    <div className="text-xs text-green-400">Lv.{item.pet.level}</div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-600">
                      <div className="h-full rounded-full bg-green-400" style={{ width: `${Math.round((item.pet.progressRatio ?? 0) * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400">未分配</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <h2 className="font-semibold">光荣榜（徽章排行）</h2>
          <div className="mt-4 space-y-3">
            {(screen?.gloryBoard ?? []).map((row, index) => (
              <div key={row.student.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-700 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg">{MEDALS[index] ?? `${index + 1}`}</span>
                  {row.pet ? <PetVisual speciesKey={row.pet.speciesKey} level={row.pet.level} size="text-2xl" /> : <span className="text-2xl">🐾</span>}
                  <span>{row.student.name}</span>
                </div>
                <div className="font-semibold text-amber-400">🏅 {row.badgeCount}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
