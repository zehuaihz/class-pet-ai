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
  { badge: "🥇", background: "#FFD666", label: "text-tangerine-deep" },
  { badge: "🥈", background: "#E8E3D5", label: "text-ink-soft" },
  { badge: "🥉", background: "#F08C2E", label: "text-tangerine-deep" },
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
    <main className="font-display min-h-screen bg-transparent p-6 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        {error ? (
          <div className="rounded-2xl border-2 border-berry bg-berry-soft p-4 font-semibold text-berry">{error}</div>
        ) : null}

        {/* 顶栏：班级标识 · 时钟 · 全屏 */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-sticker-lg border-2 border-ink bg-white px-7 py-5 shadow-sticker">
          <div className="flex items-center gap-4">
            <span className="sticker-dot h-12 w-12 border-[#F3ECDC]" style={{ background: "#FFD666", color: "#12211A" }} aria-hidden="true">🐾</span>
            <div>
              <h1 className="text-4xl font-bold tracking-wide text-ink">{screen?.classroomName ?? "班级大屏"}</h1>
              <p className="mt-1 text-base text-ink-soft">班级宠物 · 深夜动物园</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-tangerine-deep">
              {now ? now.toLocaleTimeString("zh-CN", { hour12: false }) : "--:--:--"}
            </div>
            <div className="mt-0.5 text-sm text-ink-faint">
              {now ? now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }) : ""}
            </div>
          </div>
          {fullScreen ? (
            <button className="btn-outline" onClick={exitFullScreen}>
              退出全屏
            </button>
          ) : (
            <button className="btn-tangerine" onClick={enterFullScreen}>
              ⛶ 全屏展示
            </button>
          )}
        </header>

        <div className="grid flex-1 items-stretch gap-5 lg:grid-cols-5">
          {/* 左列：宠物主舞台 + 数据带 */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-sticker-lg border-2 border-ink bg-butter-soft p-8 text-center shadow-sticker">
              {/* 柔光聚光 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(420px 320px at 50% 38%, rgba(255,214,102,0.25) 0%, transparent 70%)" }}
              />
              <div className="flex items-center gap-3">
                <span className="rounded-xl border-2 border-tangerine bg-butter px-4 py-1.5 text-xl font-bold text-tangerine-deep">
                  {pet && pet.totalPets > 0 ? `Lv.${pet.level}` : "Lv.0"}
                </span>
                <span className="text-lg text-ink-soft">{pet && pet.totalPets > 0 ? `${pet.totalPets} 只成长中` : "等待领养"}</span>
                {pet?.graduated ? <span className="rounded-xl border-2 border-forest bg-forest-mist px-4 py-1.5 text-lg font-bold text-forest-deep">🎓 满级毕业</span> : null}
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
                    <span className="text-2xl font-bold text-ink">
                      成长值 <span className="text-4xl tabular-nums text-tangerine-deep">{pet.growthValue}</span>
                      {pet.nextThreshold !== null ? <span className="text-2xl text-ink-faint"> / {pet.nextThreshold}</span> : null}
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-forest-deep">{progressPercent}%</span>
                  </div>
                  <div className="mt-3 h-5 overflow-hidden rounded-full border-2 border-ink/15 bg-white">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, #2F7D4F, #F08C2E 70%, #FFD666)" }}
                    />
                  </div>
                  {pet.remainingToNext !== null ? (
                    <p className="mt-2 text-sm text-ink-faint">再获得 {pet.remainingToNext} 点成长值即可升级</p>
                  ) : null}
                </div>
              ) : (
                <div className="w-full max-w-xl rounded-xl border-2 border-dashed border-ink/30 p-6 text-lg text-ink-soft">
                  还没有宠物 · 快到「班级动物园」领养第一只吧
                </div>
              )}

              <p className="mt-7 text-xl text-ink-soft">🌿 {screen?.slogan ?? (error ? "暂时无法加载班级数据" : "加载中...")}</p>
            </section>

            {/* 数据带 */}
            <section className="grid grid-cols-3 gap-4">
              {[
                { label: "今日加分", value: screen ? `${screen.todayPointCount}` : "--", icon: "✨" },
                { label: "打卡率", value: screen ? `${Math.round(screen.checkinRate * 100)}%` : "--", icon: "📅" },
                { label: "成长中宠物", value: screen ? `${screen.pet.totalPets} 只` : "--", icon: "🐾" },
              ].map((card) => (
                <div key={card.label} className="rounded-sticker border-2 border-ink bg-white px-4 py-6 text-center shadow-sticker-sm">
                  <div className="text-sm tracking-widest text-ink-soft">{card.icon} {card.label}</div>
                  <div className="mt-2.5 text-5xl font-bold tabular-nums text-tangerine-deep">{card.value}</div>
                </div>
              ))}
            </section>
          </div>

          {/* 右列：排行榜 */}
          <section className="flex flex-col rounded-sticker-lg border-2 border-ink bg-white p-6 shadow-sticker lg:col-span-2">
            <h2 className="flex items-center gap-2.5 border-b-2 border-dashed border-ink/20 pb-4 text-3xl font-bold text-ink">🏆 排行榜</h2>
            <div className="mt-4 flex-1 space-y-2.5">
              {(screen?.rankings ?? []).length === 0 && !error ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-ink/30 p-6 text-center text-lg text-ink-soft">
                  还没有上榜数据
                </div>
              ) : null}
              {(screen?.rankings ?? []).map((student, index) => {
                const style = RANK_STYLES[index]
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between gap-4 rounded-xl border-2 px-5 py-3.5 ${index === 0 ? "border-tangerine bg-butter-soft" : "border-ink/15 bg-white"}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className="sticker-dot !h-10 !w-10 border-[#F3ECDC] text-base !shadow-none"
                        style={{ background: style?.background ?? "#E8E3D5", color: "#12211A" }}
                        aria-hidden="true"
                      >
                        {style?.badge ?? index + 1}
                      </span>
                      <span className="text-2xl font-semibold text-ink">{student.name}</span>
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${style?.label ?? "text-ink"}`}>{student.totalPoints} 分</div>
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
