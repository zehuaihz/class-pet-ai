"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type ScreenData = {
  classroomName: string
  pet: { name: string; level: number; growthValue: number }
  todayPointCount: number
  checkinRate: number
  rankings: Array<{ id: string; name: string; totalPoints: number }>
  slogan: string
}

export default function ScreenPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [screen, setScreen] = useState<ScreenData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    if (!classroomId) return
    const load = async () => {
      const response = await fetch(`/api/v1/classrooms/${classroomId}/screen`)
      if (!response.ok) {
        setError("加载大屏数据失败")
        return
      }
      const payload = await response.json()
      setError(null)
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
    <main className={`min-h-screen bg-slate-900 p-6 text-white ${fullScreen ? "" : ""}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-4 text-red-200">{error}</div> : null}
        <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-5 py-4">
          <div>
            <h1 className="text-3xl font-bold">{screen?.classroomName ?? "班级大屏"}</h1>
            <p className="mt-1 text-slate-300">班级宠物：{screen?.pet.name ?? (error ? "暂无数据" : "加载中...")}</p>
          </div>
          <div className="flex gap-2">
            {fullScreen ? (
              <button className="rounded-lg border border-white/20 px-4 py-2" onClick={exitFullScreen}>退出全屏</button>
            ) : (
              <button className="rounded-lg bg-green-500 px-4 py-2 text-slate-950" onClick={enterFullScreen}>全屏展示</button>
            )}
          </div>
        </div>

        <section className="rounded-3xl bg-slate-800 p-10 shadow-2xl">
          <div className="text-center text-9xl">🐉</div>
          <div className="mt-6 text-center text-4xl font-semibold">成长值 {screen ? `${screen.pet.growthValue} / 1000` : "--"}</div>
          <div className="mt-3 text-center text-lg text-slate-300">{screen?.slogan ?? (error ? "暂时无法加载班级数据" : "加载中...")}</div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["今日加分", screen ? `${screen.todayPointCount}` : "--"],
            ["打卡率", screen ? `${Math.round(screen.checkinRate * 100)}%` : "--"],
            ["宠物等级", screen ? `Lv.${screen.pet.level}` : "--"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-800 p-6 text-center shadow-lg">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-2 text-4xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <h2 className="font-semibold">排行榜</h2>
          <div className="mt-4 space-y-3">
            {(screen?.rankings ?? []).map((student, index) => (
              <div key={student.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-700 px-4 py-3">
                <div>{index + 1}. {student.name}</div>
                <div className="font-semibold text-green-400">{student.totalPoints} 分</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
