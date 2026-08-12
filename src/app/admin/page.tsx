"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface AdminUser { id: string; role: string; name: string; email: string | null; status: string }

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: AdminUser[] }>("/api/v1/admin/users")
      .then((data) => setUsers(data.items))
      .catch(() => setError("加载用户列表失败"))
  }, [])

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">管理后台</h1>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-slate-500"><th>姓名</th><th>角色</th><th>邮箱</th><th>状态</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t"><td className="py-2">{user.name}</td><td>{user.role}</td><td>{user.email ?? "-"}</td><td>{user.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
