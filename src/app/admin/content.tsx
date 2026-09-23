"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface AdminUser {
  id: string
  role: string
  name: string
  email: string | null
  status: string
}

const ROLES = ["", "TEACHER", "STUDENT", "PARENT", "ADMIN"]
const STATUSES = ["", "ACTIVE", "SUSPENDED"]
const PAGE_SIZE = 20

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
  }, [load])

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">管理后台</h1>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div> : null}

        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow-sm">
          <label className="text-sm">
            <span className="text-slate-600">角色</span>
            <select
              className="mt-1 block rounded-lg border px-3 py-2"
              value={roleFilter}
              onChange={(event) => {
                setPage(1)
                setRoleFilter(event.target.value)
              }}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role || "全部"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">状态</span>
            <select
              className="mt-1 block rounded-lg border px-3 py-2"
              value={statusFilter}
              onChange={(event) => {
                setPage(1)
                setStatusFilter(event.target.value)
              }}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status || "全部"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm">
            <span className="text-slate-600">姓名关键字</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={keyword}
              onChange={(event) => {
                setPage(1)
                setKeyword(event.target.value)
              }}
              placeholder="搜索用户姓名"
            />
          </label>
        </div>

        {users.length === 0 ? <div className="rounded-xl bg-white p-5 text-slate-500 shadow-sm">暂无用户</div> : null}

        {users.length > 0 ? (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2">姓名</th>
                  <th>角色</th>
                  <th>邮箱</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="py-2">{user.name}</td>
                    <td>{user.role}</td>
                    <td>{user.email ?? "-"}</td>
                    <td>
                      <span className={user.status === "ACTIVE" ? "text-green-700" : "text-red-600"}>{user.status}</span>
                    </td>
                    <td>
                      <button
                        className="rounded-lg border px-3 py-1 disabled:opacity-50"
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

            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                共 {total} 条 · 第 {page}/{totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border px-3 py-1 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </button>
                <button
                  className="rounded-lg border px-3 py-1 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
