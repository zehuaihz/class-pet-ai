"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface Child { id: string; name: string; totalPoints: number; classroom: { name: string } }

export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: Child[] }>("/api/v1/parent/children")
      .then((data) => setChildren(data.items))
      .catch(() => setError("加载孩子信息失败"))
  }, [])

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">家长端</h1>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <div key={child.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">{child.name}</div>
              <div className="mt-2 text-slate-500">{child.classroom.name} · {child.totalPoints} 分</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
