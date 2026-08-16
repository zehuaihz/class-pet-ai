"use client"

import { FormEvent, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { ApiClientError, apiRequest } from "@/lib/api-client"

interface AdminUser {
  id: string
  role: "ADMIN" | "TEACHER"
  name: string
  email: string | null
  status: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "系统管理员",
  TEACHER: "班级管理员",
}

const ROLES = ["ADMIN", "TEACHER"] as const

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "TEACHER" })

  async function load() {
    try {
      const data = await apiRequest<{ items: AdminUser[] }>("/api/v1/admin/users")
      setUsers(data.items)
    } catch {
      setError("加载用户列表失败")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await apiRequest("/api/v1/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      setShowCreate(false)
      setForm({ name: "", email: "", password: "", role: "TEACHER" })
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "创建用户失败")
    } finally {
      setCreating(false)
    }
  }

  async function updateUser(user: AdminUser, patch: { role?: string; status?: string }) {
    setError(null)
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "更新用户失败")
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">用户管理</h1>
            <p className="text-slate-600">管理班级管理员与系统管理员账号，设置角色与启用状态。</p>
          </div>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white" onClick={() => setShowCreate(true)}>创建用户</button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2">姓名</th>
                  <th>角色</th>
                  <th>账号</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="py-2 font-medium">{user.name}</td>
                    <td>
                      <select
                        aria-label={`${user.name} 的角色`}
                        className="rounded-lg border px-2 py-1"
                        value={user.role}
                        onChange={(event) => updateUser(user, { role: event.target.value })}
                      >
                        {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </td>
                    <td>{user.email ?? "-"}</td>
                    <td>
                      <button
                        className={`rounded-full px-3 py-1 text-xs ${user.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                        onClick={() => updateUser(user, { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                      >
                        {user.status === "ACTIVE" ? "启用" : "已禁用"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-slate-400">暂无用户</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setShowCreate(false)}>
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">创建用户</h2>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="姓名" />
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="登录账号（邮箱）" />
            <input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="密码（至少 8 位）" />
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-lg border px-3 py-2" aria-label="角色">
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setShowCreate(false)}>取消</button>
              <button className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={creating}>
                {creating ? "创建中..." : "创建"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  )
}
