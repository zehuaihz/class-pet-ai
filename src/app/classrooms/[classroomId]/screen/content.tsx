"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PetVisual } from "@/components/pets/PetVisual"

type ScreenData = {
  classroomName: string
  pet: {
    name: string
    level: number
    speciesKey: string | null
    growthValue: number
    totalPets: number
    nextThreshold: number | null
    progressRatio: number
    remainingToNext: number | null
    graduated: boolean
  }
  todayPointCount: number
  checkinRate: number
  rankings: Array<{ id: string; name: string; totalPoints: number }>
  slogan: string
}

const RANK_STYLES = [
  { badge: "🥇", background: "#FFD666", label: "text-[#FFD666]" },
  { badge: "🥈", background: "#E8E3D5", label: "text-[#E8E3D5]" },
  { badge: "🥉", background: "#F08C2E", label: "text-[#F08C2E]" },
]

export default function ScreenPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [screen, setScreen] = useState<ScreenData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)

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

  useEffect(() => {
    setNow(new Date())
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(clock)
  }, [])

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

  const pet = screen?.pet
  const progressPercent = Math.round((pet?.progressRatio ?? 0) * 100)

  return (
    <main
      className="font-display min-h-screen p-6 text-[#F3ECDC]"
      style={{ background: "radial-gradient(1400px 700px at 50% -10%, #1F3524 0%, #12211A 55%, #0D1812 100%)" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        {error ? (
          <div className="rounded-2xl border-2 border-[#D64550] bg-[#D64550]/15 p-4 font-semibold text-[#F5A9AD]">{error}</div>
        ) : null}

        {/* 顶栏：班级标识 · 时钟 · 全屏 */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/80 px-7 py-5 shadow-[6px_6px_0_0_rgba(47,125,79,0.35)]">
          <div className="flex items-center gap-4">
            <span className="sticker-dot h-12 w-12 border-[#F3ECDC] text-2xl" style={{ background: "#FFD666", color: "#12211A" }} aria-hidden="true">🐾</span>
            <div>
              <h1 className="text-4xl font-bold tracking-wide">{screen?.classroomName ?? "班级大屏"}</h1>
              <p className="mt-1 text-base text-[#8FAE93]">班级宠物 · 深夜动物园</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-[#FFD666]">
              {now ? now.toLocaleTimeString("zh-CN", { hour12: false }) : "--:--:--"}
            </div>
            <div className="mt-0.5 text-sm text-[#8FAE93]">
              {now ? now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }) : ""}
            </div>
          </div>
          {fullScreen ? (
            <button
              className="rounded-xl border-2 border-[#F3ECDC]/30 px-5 py-2.5 font-semibold transition hover:border-[#F3ECDC]"
              onClick={exitFullScreen}
            >
              退出全屏
            </button>
          ) : (
            <button
              className="rounded-xl border-2 border-[#FFD666] bg-[#FFD666] px-5 py-2.5 font-bold text-[#1F3524] shadow-[3px_3px_0_0_rgba(255,214,102,0.35)] transition hover:translate-y-0.5 hover:shadow-none"
              onClick={enterFullScreen}
            >
              ⛶ 全屏展示
            </button>
          )}
        </header>

        <div className="grid flex-1 items-stretch gap-5 lg:grid-cols-5">
          {/* 左列：宠物主舞台 + 数据带 */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/60 p-8 text-center shadow-[6px_6px_0_0_rgba(47,125,79,0.3)]">
              {/* 月光聚光 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(420px 320px at 50% 38%, rgba(255,214,102,0.14) 0%, transparent 70%)" }}
              />
              <div className="flex items-center gap-3">
                <span className="rounded-xl border-2 border-[#FFD666] bg-[#FFD666]/15 px-4 py-1.5 text-xl font-bold text-[#FFD666]">
                  {pet && pet.totalPets > 0 ? `Lv.${pet.level}` : "Lv.0"}
                </span>
                <span className="text-lg text-[#8FAE93]">{pet && pet.totalPets > 0 ? `${pet.totalPets} 只成长中` : "等待领养"}</span>
                {pet?.graduated ? <span className="rounded-xl border-2 border-[#7BD99B] bg-[#7BD99B]/15 px-4 py-1.5 text-lg font-bold text-[#7BD99B]">🎓 满级毕业</span> : null}
              </div>

              <div className="animate-floaty my-6">
                {pet && pet.totalPets > 0 && pet.speciesKey ? (
                  <PetVisual speciesKey={pet.speciesKey} level={pet.level} size="text-[10rem]" />
                ) : (
                  <div className="text-[10rem] leading-none opacity-60">🥚</div>
                )}
              </div>

              {pet && pet.totalPets > 0 ? (
                <div className="w-full max-w-xl">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#FFD666]">
                      成长值 <span className="text-4xl tabular-nums">{pet.growthValue}</span>
                      {pet.nextThreshold !== null ? <span className="text-2xl text-[#8FAE93]"> / {pet.nextThreshold}</span> : null}
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-[#7BD99B]">{progressPercent}%</span>
                  </div>
                  <div className="mt-3 h-5 overflow-hidden rounded-full border-2 border-[#2F7D4F] bg-[#0D1812]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, #2F7D4F, #F08C2E 70%, #FFD666)" }}
                    />
                  </div>
                  {pet.remainingToNext !== null ? (
                    <p className="mt-2 text-sm text-[#8FAE93]">再获得 {pet.remainingToNext} 点成长值即可升级</p>
                  ) : null}
                </div>
              ) : (
                <div className="w-full max-w-xl rounded-xl border-2 border-dashed border-[#2F7D4F] p-6 text-lg text-[#8FAE93]">
                  还没有宠物 · 快到「班级动物园」领养第一只吧
                </div>
              )}

              <p className="mt-7 text-xl text-[#B9C9B9]">🌿 {screen?.slogan ?? (error ? "暂时无法加载班级数据" : "加载中...")}</p>
            </section>

            {/* 数据带 */}
            <section className="grid grid-cols-3 gap-4">
              {[
                { label: "今日加分", value: screen ? `${screen.todayPointCount}` : "--", icon: "✨" },
                { label: "打卡率", value: screen ? `${Math.round(screen.checkinRate * 100)}%` : "--", icon: "📅" },
                { label: "成长中宠物", value: screen ? `${screen.pet.totalPets} 只` : "--", icon: "🐾" },
              ].map((card) => (
                <div key={card.label} className="rounded-sticker border-2 border-[#2F7D4F] bg-[#1F3524]/70 px-4 py-6 text-center shadow-[5px_5px_0_0_rgba(47,125,79,0.3)]">
                  <div className="text-sm tracking-widest text-[#8FAE93]">{card.icon} {card.label}</div>
                  <div className="mt-2.5 text-5xl font-bold tabular-nums text-[#F08C2E]">{card.value}</div>
                </div>
              ))}
            </section>
          </div>

          {/* 右列：排行榜 */}
          <section className="flex flex-col rounded-sticker-lg border-2 border-[#2F7D4F] bg-[#1F3524]/70 p-6 shadow-[6px_6px_0_0_rgba(47,125,79,0.3)] lg:col-span-2">
            <h2 className="flex items-center gap-2.5 border-b-2 border-dashed border-[#2F7D4F]/70 pb-4 text-3xl font-bold">🏆 排行榜</h2>
            <div className="mt-4 flex-1 space-y-2.5">
              {(screen?.rankings ?? []).length === 0 && !error ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-[#2F7D4F] p-6 text-center text-lg text-[#8FAE93]">
                  还没有上榜数据
                </div>
              ) : null}
              {(screen?.rankings ?? []).map((student, index) => {
                const style = RANK_STYLES[index]
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between gap-4 rounded-xl border-2 px-5 py-3.5 ${index === 0 ? "border-[#FFD666] bg-[#FFD666]/10" : "border-[#2F7D4F]/60 bg-[#15271B]"}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className="sticker-dot !h-10 !w-10 border-[#F3ECDC] text-base !shadow-none"
                        style={{ background: style?.background ?? "#2F7D4F", color: "#12211A" }}
                        aria-hidden="true"
                      >
                        {style?.badge ?? index + 1}
                      </span>
                      <span className="text-2xl font-semibold">{student.name}</span>
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${style?.label ?? "text-[#7BD99B]"}`}>{student.totalPoints} 分</div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
