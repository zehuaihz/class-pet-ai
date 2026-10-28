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
    <main className="font-display min-h-screen p-6 text-[#F3ECDC]" style={{ background: "radial-gradient(1200px 600px at 50% -10%, #1F3524 0%, #12211A 55%, #0D1812 100%)" }}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? <div className="rounded-2xl border-2 border-[#D64550] bg-[#D64550]/15 p-4 font-semibold text-[#F5A9AD]">{error}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/80 px-6 py-5 shadow-[6px_6px_0_0_rgba(47,125,79,0.35)]">
          <div>
            <h1 className="text-4xl font-bold tracking-wide">🐾 {screen?.classroomName ?? "班级大屏"}</h1>
            <p className="mt-1.5 text-lg text-[#B9C9B9]">班级宠物：{screen?.pet.name ?? (error ? "暂无数据" : "加载中...")}</p>
          </div>
          <div className="flex gap-2">
            {fullScreen ? (
              <button className="rounded-xl border-2 border-[#F3ECDC]/30 px-5 py-2.5 font-semibold transition hover:border-[#F3ECDC]" onClick={exitFullScreen}>退出全屏</button>
            ) : (
              <button className="rounded-xl border-2 border-[#FFD666] bg-[#FFD666] px-5 py-2.5 font-bold text-[#1F3524] shadow-[3px_3px_0_0_rgba(255,214,102,0.35)] transition hover:translate-y-0.5 hover:shadow-none" onClick={enterFullScreen}>⛶ 全屏展示</button>
            )}
          </div>
        </div>

        <section className="rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/60 p-12 shadow-[6px_6px_0_0_rgba(47,125,79,0.3)]">
          <div className="animate-floaty text-center text-[9rem] leading-none">🐉</div>
          <div className="mt-8 text-center text-5xl font-bold text-[#FFD666]">成长值 {screen ? `${screen.pet.growthValue} / 1000` : "--"}</div>
          <div className="mt-4 text-center text-2xl text-[#B9C9B9]">{screen?.slogan ?? (error ? "暂时无法加载班级数据" : "加载中...")}</div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            ["今日加分", screen ? `${screen.todayPointCount}` : "--", "✨"],
            ["打卡率", screen ? `${Math.round(screen.checkinRate * 100)}%` : "--", "📅"],
            ["宠物等级", screen ? `Lv.${screen.pet.level}` : "--", "🐾"],
          ].map(([label, value, icon]) => (
            <div key={label} className="rounded-sticker border-2 border-[#2F7D4F] bg-[#1F3524]/70 p-7 text-center shadow-[5px_5px_0_0_rgba(47,125,79,0.3)]">
              <div className="text-sm tracking-widest text-[#8FAE93]">{icon} {label}</div>
              <div className="mt-3 text-5xl font-bold text-[#F08C2E]">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/70 p-7 shadow-[6px_6px_0_0_rgba(47,125,79,0.3)]">
          <h2 className="text-2xl font-bold">🏆 排行榜</h2>
          <div className="mt-5 space-y-3">
            {(screen?.rankings ?? []).map((student, index) => (
              <div key={student.id} className={`flex items-center justify-between gap-4 rounded-xl border-2 px-5 py-3.5 text-xl ${index === 0 ? "border-[#FFD666] bg-[#FFD666]/10" : "border-[#2F7D4F]/60 bg-[#15271B]"}`}>
                <div className="flex items-center gap-3">
                  <span className="sticker-dot !h-9 !w-9 border-[#F3ECDC] text-base !shadow-none" style={{ background: index === 0 ? "#FFD666" : index < 3 ? "#F08C2E" : "#2F7D4F", color: "#12211A" }} aria-hidden="true">
                    {["🥇", "🥈", "🥉"][index] ?? index + 1}
                  </span>
                  <span className="font-semibold">{student.name}</span>
                </div>
                <div className="font-bold text-[#7BD99B]">{student.totalPoints} 分</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
