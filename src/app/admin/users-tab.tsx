"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface AdminUser {
  id: string
  role: string
  name: string
  email: string | null
  status: string
}

interface SchoolOption {
  id: string
  name: string
}

const ROLES = ["", "TEACHER", "STUDENT", "PARENT", "ADMIN"]
const STATUSES = ["", "ACTIVE", "SUSPENDED"]
const PAGE_SIZE = 20

const EMPTY_FORM = { name: "", email: "", password: "", schoolId: "" }

export default function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const loadSchools = useCallback(() => {
    apiRequest<{ items: SchoolOption[] }>("/api/v1/admin/schools")
      .then((data) => setSchools(data.items))
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (roleFilter) params.set("role", roleFilter)
    if (statusFilter) params.set("status", statusFilter)
    if (keyword.trim()) params.set("keyword", keyword.trim())
    try {
      const data = await apiRequest<{ items: AdminUser[]; meta: { total: number } }>(
        `/api/v1/admin/users?${params.toString()}`,
      )
      setUsers(data.items)
      setTotal(data.meta?.total ?? data.items.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用户列表失败")
    }
  }, [page, roleFilter, statusFilter, keyword])

  useEffect(() => {
    void load()
    loadSchools()
  }, [load, loadSchools])

  async function changeStatus(user: AdminUser, status: "ACTIVE" | "SUSPENDED") {
    setBusyId(user.id)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      setNotice(`${user.name} 已${status === "SUSPENDED" ? "停用" : "启用"}，其登录会话已失效`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改状态失败")
    } finally {
      setBusyId(null)
    }
  }

  async function createTeacher(event: React.FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      const teacher = await apiRequest<{ name: string; email: string; schoolName: string | null }>("/api/v1/admin/teachers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          schoolId: form.schoolId || undefined,
        }),
      })
      setNotice(`✅ 教师账号已开通：${teacher.name}（${teacher.email}）${teacher.schoolName ? ` · ${teacher.schoolName}` : ""}`)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "开通教师账号失败")
    } finally {
      setCreating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
      {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}

      <section className="sticker sticker-quiet rise-in stagger-1 p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🪄</span>开通教师账号</h2>
        <p className="mt-1 text-xs text-ink-faint">创建后教师即可用邮箱 + 初始密码登录（建议提醒教师尽快修改密码）。</p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createTeacher}>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">姓名 *</span>
            <input className="sticker-input mt-1 w-full" required maxLength={50} value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="李老师" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">邮箱 *</span>
            <input className="sticker-input mt-1 w-full" required type="email" value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="li@example.com" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">初始密码 *（至少 8 位）</span>
            <input className="sticker-input mt-1 w-full" required minLength={8} type="text" value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="建议随机生成并线下交付" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">所属学校</span>
            <select className="sticker-input mt-1 w-full cursor-pointer" value={form.schoolId}
              onChange={(event) => setForm((current) => ({ ...current, schoolId: event.target.value }))}>
              <option value="">（不挂学校）</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="btn-ink disabled:opacity-40" disabled={creating}>
              {creating ? "开通中..." : "✅ 开通账号"}
            </button>
          </div>
        </form>
      </section>

      <div className="sticker sticker-quiet rise-in stagger-2 flex flex-wrap items-end gap-3 p-5">
        <label className="text-sm">
          <span className="font-semibold text-ink-soft">角色</span>
          <select className="sticker-input mt-1 block cursor-pointer" value={roleFilter}
            onChange={(event) => { setPage(1); setRoleFilter(event.target.value) }}>
            {ROLES.map((role) => (
              <option key={role} value={role}>{role || "全部"}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold text-ink-soft">状态</span>
          <select className="sticker-input mt-1 block cursor-pointer" value={statusFilter}
            onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status || "全部"}</option>
            ))}
          </select>
        </label>
        <label className="min-w-48 flex-1 text-sm">
          <span className="font-semibold text-ink-soft">姓名关键字</span>
          <input className="sticker-input mt-1 w-full" value={keyword}
            onChange={(event) => { setPage(1); setKeyword(event.target.value) }} placeholder="🔍 搜索用户姓名" />
        </label>
      </div>

      {users.length === 0 ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">暂无用户</div> : null}

      {users.length > 0 ? (
        <div className="sticker sticker-quiet rise-in stagger-3 overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-display text-ink-soft">
                <th className="py-2">姓名</th>
                <th>角色</th>
                <th>邮箱</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t-2 border-dashed border-ink/20">
                  <td className="py-2.5 font-semibold text-ink">{user.name}</td>
                  <td className="text-ink-soft">{user.role}</td>
                  <td className="text-ink-soft">{user.email ?? "-"}</td>
                  <td>
                    <span className={`inline-block rounded-full border-2 px-2 py-0.5 text-xs font-bold ${user.status === "ACTIVE" ? "border-forest bg-forest-mist text-forest-deep" : "border-berry bg-berry-soft text-berry"}`}>{user.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40"
                      disabled={busyId === user.id}
                      onClick={() => changeStatus(user, user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                    >
                      {busyId === user.id ? "处理中..." : user.status === "ACTIVE" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <span className="font-display font-bold">共 {total} 条 · 第 {page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40" disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}>← 上一页</button>
              <button className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40" disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}>下一页 →</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
