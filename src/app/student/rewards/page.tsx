"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; costPoints: number; stock: number | null }

export default function StudentRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: RewardItem[]; totalPoints: number }>("/api/v1/student/rewards")
      .then((data) => { setItems(data.items); setTotalPoints(data.totalPoints) })
      .catch(() => setError("加载奖励失败"))
  }, [])

  async function redeem(itemId: string) {
    try {
      await apiRequest(`/api/v1/student/rewards/${itemId}/redeem`, { method: "POST" })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "兑换失败")
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">奖励商城</h1>
        <div className="text-slate-600">我的积分：{totalPoints}</div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-slate-500">{item.costPoints} 分 · 库存 {item.stock ?? "无限"}</div>
              <button className="mt-3 rounded-lg bg-green-600 px-3 py-1 text-white" disabled={totalPoints < item.costPoints} onClick={() => redeem(item.id)}>兑换</button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
