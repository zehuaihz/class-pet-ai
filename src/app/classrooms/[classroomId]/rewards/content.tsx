"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { RewardItemForm, type RewardItemFormValues } from "@/components/rewards/RewardItemForm"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; description: string | null; costBadges: number; stock: number | null; enabled: boolean }
interface Redemption { id: string; status: string; student: { name: string }; rewardItem: { name: string } }

const REDEMPTION_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  FULFILLED: "已发放",
  CANCELLED: "已取消",
}

export default function RewardsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [items, setItems] = useState<RewardItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<RewardItem | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const [rewards, redemptionData] = await Promise.all([
        apiRequest<{ items: RewardItem[] }>(`/api/v1/classrooms/${classroomId}/rewards`),
        apiRequest<{ items: Redemption[] }>(`/api/v1/classrooms/${classroomId}/redemptions`),
      ])
      setItems(rewards.items)
      setRedemptions(redemptionData.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载奖励失败")
    }
  }, [classroomId])

  useEffect(() => { void load() }, [load])

  async function createItem(values: { name: string; description?: string; costBadges: number; stock: number | null; enabled: boolean }) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/rewards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      })
      setNotice(`已创建奖励商品：${values.name}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请重试")
    } finally {
      setBusy(false)
    }
  }

  async function updateItem(itemId: string, values: { name: string; description?: string; costBadges: number; stock: number | null; enabled: boolean }) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/rewards/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      })
      setNotice("已保存修改")
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试")
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(item: RewardItem) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/rewards/${item.id}`, { method: "DELETE" })
      setNotice(`已下架：${item.name}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "下架失败，请重试")
    } finally {
      setBusy(false)
    }
  }

  async function act(redemptionId: string, action: "approve" | "fulfill" | "cancel") {
    try {
      await apiRequest(`/api/v1/redemptions/${redemptionId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试")
    }
  }

  const editingValues: Partial<RewardItemFormValues> | undefined = editing
    ? {
        name: editing.name,
        description: editing.description ?? "",
        costBadges: editing.costBadges,
        stock: editing.stock === null ? "" : String(editing.stock),
        enabled: editing.enabled,
      }
    : undefined

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rise-in">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🛍️</span>小卖部</h1>
          <p className="mt-1 text-sm text-ink-soft">管理奖励商品和兑换申请，学生用毕业徽章兑换心愿。</p>
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}

        <section className="sticker sticker-quiet rise-in stagger-2 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🧾</span>新建奖励商品</h2>
          <div className="mt-4">
            <RewardItemForm submitLabel={busy ? "提交中..." : "创建"} disabled={busy} onSubmit={createItem} />
          </div>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-3 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🎁</span>奖励商品</h2>
          {items.length === 0 ? <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">还没有奖励商品</div> : null}
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className={`rounded-xl border-2 p-4 ${editing?.id === item.id ? "border-ink bg-butter-soft shadow-sticker-sm" : "border-ink/15 bg-white"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <span aria-hidden="true">{["🍭", "🎈", "📗", "🎟️", "🧩"][index % 5]}</span>
                      <span className="truncate">{item.name}</span>
                      {!item.enabled ? <span className="rounded-full bg-paper-deep px-2 py-0.5 text-xs font-semibold text-ink-faint">已下架</span> : null}
                    </div>
                    <div className="font-display mt-0.5 text-sm font-bold text-tangerine">🏅 {item.costBadges} 徽章 · 库存 {item.stock ?? "无限"}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="btn-outline !px-3 !py-1 text-sm" onClick={() => setEditing(editing?.id === item.id ? null : item)}>
                      {editing?.id === item.id ? "收起" : "编辑"}
                    </button>
                    {item.enabled ? (
                      <button className="btn-outline !px-3 !py-1 text-sm disabled:opacity-40" disabled={busy} onClick={() => removeItem(item)}>
                        下架
                      </button>
                    ) : null}
                  </div>
                </div>
                {editing?.id === item.id ? (
                  <div className="mt-4 border-t-2 border-dashed border-ink/30 pt-4">
                    <RewardItemForm
                      initialValues={editingValues}
                      submitLabel={busy ? "保存中..." : "保存"}
                      disabled={busy}
                      onSubmit={(values) => updateItem(item.id, values)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-4 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📮</span>兑换申请</h2>
          {redemptions.length === 0 ? <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无兑换申请</div> : null}
          <div className="mt-4 space-y-3">
            {redemptions.map((redemption) => (
              <div key={redemption.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{redemption.student.name} · {redemption.rewardItem.name}</div>
                  <div className="text-sm text-ink-soft">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${redemption.status === "PENDING" ? "bg-tangerine-soft text-tangerine" : redemption.status === "CANCELLED" ? "bg-paper-deep text-ink-faint" : "bg-forest-mist text-forest-deep"}`}>
                      {REDEMPTION_LABELS[redemption.status] ?? redemption.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {redemption.status === "PENDING" ? <button className="btn-ink !px-3 !py-1 text-sm" onClick={() => act(redemption.id, "approve")}>批准</button> : null}
                  {redemption.status === "APPROVED" ? <button className="btn-ink !px-3 !py-1 text-sm" onClick={() => act(redemption.id, "fulfill")}>履约</button> : null}
                  {redemption.status === "PENDING" || redemption.status === "APPROVED" ? <button className="btn-outline !px-3 !py-1 text-sm" onClick={() => act(redemption.id, "cancel")}>取消</button> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
