"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; costBadges: number; stock: number | null; enabled: boolean }
interface Redemption { id: string; status: string; student: { name: string }; rewardItem: { name: string } }

export default function RewardsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [items, setItems] = useState<RewardItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const [rewards, redemptionData] = await Promise.all([
        apiRequest<{ items: RewardItem[] }>(`/api/v1/classrooms/${classroomId}/rewards`),
        apiRequest<{ items: Redemption[] }>(`/api/v1/classrooms/${classroomId}/redemptions`),
      ])
      setItems(rewards.items)
      setRedemptions(redemptionData.items)
    } catch {
      setError("加载奖励失败")
    }
  }

  useEffect(() => { void load() }, [classroomId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(redemptionId: string, action: "approve" | "fulfill" | "cancel") {
    try {
      await apiRequest(`/api/v1/redemptions/${redemptionId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) })
      await load()
    } catch {
      setError("操作失败，请重试")
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">小卖部</h1><p className="text-slate-600">学生用毕业徽章兑换奖励，教师审核与履约。</p></div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">奖励商品</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-slate-500">🏅 {item.costBadges} 徽章 · 库存 {item.stock ?? "无限"}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">兑换申请</h2>
          <div className="mt-4 space-y-3">
            {redemptions.map((redemption) => (
              <div key={redemption.id} className="flex items-center justify-between rounded-lg border p-3">
                <div><div className="font-medium">{redemption.student.name} · {redemption.rewardItem.name}</div><div className="text-sm text-slate-500">{redemption.status}</div></div>
                <div className="flex gap-2">
                  {redemption.status === "PENDING" ? <button className="rounded-lg bg-green-600 px-3 py-1 text-white" onClick={() => act(redemption.id, "approve")}>批准</button> : null}
                  {redemption.status === "APPROVED" ? <button className="rounded-lg bg-green-600 px-3 py-1 text-white" onClick={() => act(redemption.id, "fulfill")}>履约</button> : null}
                  {redemption.status === "PENDING" || redemption.status === "APPROVED" ? <button className="rounded-lg border px-3 py-1" onClick={() => act(redemption.id, "cancel")}>取消</button> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
