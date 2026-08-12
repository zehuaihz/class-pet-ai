"use client"

import { FormEvent, useState } from "react"
import {
  lastClassroomBelongsToUser,
  readLastClassroomId,
  rememberClassroomUser,
} from "@/lib/last-classroom"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password, loginType: "password" }),
    })

    if (!response.ok) {
      setError("登录失败，请检查账号")
      return
    }

    const payload = await response.json()
    const userId: string | undefined = payload?.data?.user?.id
    const lastClassroomId = readLastClassroomId()

    // Only resume the last class when it belonged to the same teacher; another
    // teacher on a shared browser should land on the dashboard instead.
    const resumeClassroomId =
      userId && lastClassroomId && lastClassroomBelongsToUser(userId)
        ? lastClassroomId
        : null

    if (userId) {
      rememberClassroomUser(userId)
    }

    window.location.href = resumeClassroomId
      ? `/classrooms/${resumeClassroomId}/students`
      : "/dashboard"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-sky-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">班级宠物积分系统</h1>
        <p className="mt-2 text-sm text-slate-600">教师登录后，可管理班级、积分、打卡和宠物成长。</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">账号</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="输入账号"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="输入密码"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">登录</button>
        </form>
      </section>
    </main>
  )
}
