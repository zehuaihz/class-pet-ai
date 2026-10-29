"use client"

import { FormEvent, useState } from "react"
import {
  lastClassroomBelongsToUser,
  readLastClassroomId,
  rememberClassroomUser,
} from "@/lib/last-classroom"
import { landingPathForRole } from "@/lib/role-landing"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [asAdmin, setAsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier,
        password,
        loginType: "password",
        ...(asAdmin ? { role: "ADMIN" } : {}),
      }),
    })

    if (!response.ok) {
      setError("登录失败，请检查账号")
      return
    }

    const payload = await response.json()
    const userId: string | undefined = payload?.data?.user?.id
    const role: string | undefined = payload?.data?.user?.role
    const lastClassroomId = readLastClassroomId()

    // Only resume the last class when it belonged to the same teacher; another
    // teacher on a shared browser should land on the dashboard instead.
    const resumeClassroomId =
      role === "TEACHER" && userId && lastClassroomId && lastClassroomBelongsToUser(userId)
        ? lastClassroomId
        : null

    if (userId) {
      rememberClassroomUser(userId)
    }

    window.location.href = resumeClassroomId
      ? `/classrooms/${resumeClassroomId}/students`
      : landingPathForRole(role)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* 漂浮的动物园伙伴 */}
      <span aria-hidden="true" className="animate-floaty absolute left-[12%] top-[18%] text-5xl opacity-30 select-none">🐱</span>
      <span aria-hidden="true" className="animate-floaty absolute right-[15%] top-[24%] text-5xl opacity-30 select-none [animation-delay:0.7s]">🐶</span>
      <span aria-hidden="true" className="animate-floaty absolute bottom-[16%] left-[20%] text-5xl opacity-30 select-none [animation-delay:1.4s]">🐼</span>
      <span aria-hidden="true" className="animate-floaty absolute bottom-[22%] right-[18%] text-5xl opacity-30 select-none [animation-delay:2.1s]">🐰</span>

      <section className="rise-in sticker relative z-10 w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="animate-floaty inline-block text-5xl">🐾</span>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">班级动物园</h1>
            <p className="mt-0.5 text-sm text-ink-soft">积分 · 打卡 · 宠物成长</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">教师登录后，可管理班级、积分、打卡和宠物成长。</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex gap-2" role="group" aria-label="登录身份">
            <button
              type="button"
              className={`flex-1 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition ${!asAdmin ? "border-ink bg-butter text-ink shadow-[3px_3px_0_0_rgba(28,25,23,0.25)]" : "border-ink/15 bg-white text-ink-soft hover:border-ink/40"}`}
              onClick={() => setAsAdmin(false)}
            >
              👩‍🏫 教师
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition ${asAdmin ? "border-ink bg-butter text-ink shadow-[3px_3px_0_0_rgba(28,25,23,0.25)]" : "border-ink/15 bg-white text-ink-soft hover:border-ink/40"}`}
              onClick={() => setAsAdmin(true)}
            >
              🛠️ 管理员
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">{asAdmin ? "管理员账号" : "账号"}</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="sticker-input mt-1 w-full"
              placeholder={asAdmin ? "管理员邮箱" : "输入账号"}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="sticker-input mt-1 w-full"
              placeholder="输入密码"
            />
          </label>
          {error ? <p className="text-sm font-semibold text-berry">{error}</p> : null}
          <button className="btn-tangerine w-full !py-2.5 !text-base">登录 →</button>
        </form>
      </section>
    </main>
  )
}
