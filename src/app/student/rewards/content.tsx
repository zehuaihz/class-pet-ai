"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; description: string | null; costBadges: number; stock: number | null }
interface Redemption { id: string; badgesSpent: number; status: string; rewardItem: { name: string }; createdAt: string }

const REDEMPTION_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  FULFILLED: "已发放",
  CANCELLED: "已取消",
}

export default function StudentRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [availableBadges, setAvailableBadges] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: RewardItem[]; availableBadges: number; redemptions: Redemption[] }>(
        "/api/v1/student/rewards",
      )
      setItems(data.items)
      setAvailableBadges(data.availableBadges)
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
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🛍️</span>奖励商城</h1>
          <div className="sticker-dot !h-9 !w-auto bg-butter px-3 text-sm">🏅 我的徽章 <span className="font-display text-lg">{availableBadges}</span></div>
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}

        {items.length === 0 ? (
          <div className="sticker sticker-quiet rise-in stagger-2 p-8 text-center text-ink-soft">商城还没有上架奖励商品</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item, index) => {
              const soldOut = item.stock !== null && item.stock <= 0
              const affordable = availableBadges >= item.costBadges
              return (
                <div key={item.id} className={`sticker rise-in stagger-${Math.min(index + 1, 6)} p-4 ${soldOut ? "opacity-60" : "sticker-hover"}`}>
                  <div className="font-display flex items-center gap-2 text-lg font-bold text-ink">
                    <span aria-hidden="true">{["🍭", "🎈", "📗", "🎟️", "🧩"][index % 5]}</span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.description ? <div className="mt-1 text-sm text-ink-soft">{item.description}</div> : null}
                  <div className="font-display mt-2 text-sm font-bold text-tangerine">🏅 {item.costBadges} 徽章 · 库存 {item.stock ?? "无限"}</div>
                  <button
                    className="btn-tangerine mt-3 w-full !py-1.5 text-sm disabled:opacity-40"
                    disabled={!affordable || soldOut || pendingId === item.id}
                    onClick={() => redeem(item)}
                  >
                    {soldOut ? "已售罄" : pendingId === item.id ? "提交中..." : affordable ? "兑换" : "徽章不足"}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <section className="sticker sticker-quiet rise-in stagger-4 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📮</span>我的兑换记录</h2>
          {redemptions.length === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无兑换记录</div>
          ) : (
            <div className="mt-3 space-y-2">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{redemption.rewardItem.name}</div>
                    <div className="text-sm text-ink-faint">{String(redemption.createdAt).slice(0, 10)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-ink-soft">{REDEMPTION_LABELS[redemption.status] ?? redemption.status}</div>
                    <div className="font-display font-bold text-tangerine">-{redemption.badgesSpent} 徽章</div>
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
