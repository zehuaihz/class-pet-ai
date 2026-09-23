"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { RewardItemForm, type RewardItemFormValues } from "@/components/rewards/RewardItemForm"
import { apiRequest } from "@/lib/api-client"

interface RewardItem { id: string; name: string; description: string | null; costPoints: number; stock: number | null; enabled: boolean }
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

  async function createItem(values: { name: string; description?: string; costPoints: number; stock: number | null; enabled: boolean }) {
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

  async function updateItem(itemId: string, values: { name: string; description?: string; costPoints: number; stock: number | null; enabled: boolean }) {
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
        costPoints: editing.costPoints,
        stock: editing.stock === null ? "" : String(editing.stock),
        enabled: editing.enabled,
      }
    : undefined

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">奖励兑换</h1><p className="text-slate-600">管理奖励商品和兑换申请。</p></div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div> : null}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">新建奖励商品</h2>
          <div className="mt-4">
            <RewardItemForm submitLabel={busy ? "提交中..." : "创建"} disabled={busy} onSubmit={createItem} />
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">奖励商品</h2>
          {items.length === 0 ? <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">还没有奖励商品</div> : null}
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {item.name}
                      {!item.enabled ? <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">已下架</span> : null}
                    </div>
                    <div className="text-sm text-slate-500">{item.costPoints} 分 · 库存 {item.stock ?? "无限"}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border px-3 py-1" onClick={() => setEditing(editing?.id === item.id ? null : item)}>
                      {editing?.id === item.id ? "收起" : "编辑"}
                    </button>
                    {item.enabled ? (
                      <button className="rounded-lg border px-3 py-1 disabled:opacity-50" disabled={busy} onClick={() => removeItem(item)}>
                        下架
                      </button>
                    ) : null}
                  </div>
                </div>
                {editing?.id === item.id ? (
                  <div className="mt-4 border-t pt-4">
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

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">兑换申请</h2>
          {redemptions.length === 0 ? <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无兑换申请</div> : null}
          <div className="mt-4 space-y-3">
            {redemptions.map((redemption) => (
              <div key={redemption.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{redemption.student.name} · {redemption.rewardItem.name}</div>
                  <div className="text-sm text-slate-500">{REDEMPTION_LABELS[redemption.status] ?? redemption.status}</div>
                </div>
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
