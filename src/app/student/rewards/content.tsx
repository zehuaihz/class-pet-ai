"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; description: string | null; costPoints: number; stock: number | null }
interface Redemption { id: string; pointsSpent: number; status: string; rewardItem: { name: string }; createdAt: string }

const REDEMPTION_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  FULFILLED: "已发放",
  CANCELLED: "已取消",
}

export default function StudentRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: RewardItem[]; totalPoints: number; redemptions: Redemption[] }>(
        "/api/v1/student/rewards",
      )
      setItems(data.items)
      setTotalPoints(data.totalPoints)
      setRedemptions(data.redemptions ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载奖励失败")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function redeem(item: RewardItem) {
    setPendingId(item.id)
    setError(null)
    setNotice(null)
    try {
      // A fresh per-attempt key keeps network retries safe without blocking a
      // genuine second redemption of the same item.
      await apiRequest(`/api/v1/student/rewards/${item.id}/redeem`, {
        method: "POST",
        headers: { "Idempotency-Key": `redeem-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
      })
      setNotice(`已提交兑换申请：${item.name}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "兑换失败，请重试")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">奖励商城</h1>
        <div className="text-slate-600">我的积分：{totalPoints}</div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const soldOut = item.stock !== null && item.stock <= 0
            const affordable = totalPoints >= item.costPoints
            return (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="font-medium">{item.name}</div>
                {item.description ? <div className="mt-1 text-sm text-slate-500">{item.description}</div> : null}
                <div className="mt-2 text-sm text-slate-500">{item.costPoints} 分 · 库存 {item.stock ?? "无限"}</div>
                <button
                  className="mt-3 rounded-lg bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                  disabled={!affordable || soldOut || pendingId === item.id}
                  onClick={() => redeem(item)}
                >
                  {soldOut ? "已售罄" : pendingId === item.id ? "提交中..." : affordable ? "兑换" : "积分不足"}
                </button>
              </div>
            )
          })}
        </div>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">我的兑换记录</h2>
          {redemptions.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无兑换记录</div>
          ) : (
            <div className="mt-3 space-y-2">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <div className="font-medium">{redemption.rewardItem.name}</div>
                    <div className="text-sm text-slate-500">{String(redemption.createdAt).slice(0, 10)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">{REDEMPTION_LABELS[redemption.status] ?? redemption.status}</div>
                    <div className="text-sm text-slate-500">-{redemption.pointsSpent} 分</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
