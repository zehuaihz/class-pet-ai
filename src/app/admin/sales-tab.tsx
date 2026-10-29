"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface SubscriptionOrder {
  id: string
  plan: string
  seats: number
  amountCents: number
  status: string
  startedAt: string
  expiresAt: string | null
  note: string | null
  createdAt: string
  schoolName: string | null
  teacherName: string | null
}

interface SchoolOption {
  id: string
  name: string
}

const PLANS = [
  { value: "YEARLY", label: "年付" },
  { value: "MONTHLY", label: "月付" },
]

const STATUSES = [
  { value: "PAID", label: "已支付" },
  { value: "PENDING", label: "待支付" },
  { value: "REFUNDED", label: "已退款" },
  { value: "CANCELLED", label: "已取消" },
]

const EMPTY_FORM = { schoolId: "", plan: "YEARLY", seats: "1", amountYuan: "", status: "PAID", expiresAt: "", note: "" }

function formatYuan(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusBadge(status: string) {
  if (status === "PAID") return "border-forest bg-forest-mist text-forest-deep"
  if (status === "PENDING") return "border-tangerine bg-butter-soft text-tangerine-deep"
  return "border-ink/30 bg-white text-ink-soft"
}

export default function SalesTab() {
  const [orders, setOrders] = useState<SubscriptionOrder[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: SubscriptionOrder[] }>("/api/v1/admin/subscriptions")
      setOrders(data.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载订单列表失败")
    }
  }, [])

  useEffect(() => {
    void load()
    apiRequest<{ items: SchoolOption[] }>("/api/v1/admin/schools")
      .then((data) => setSchools(data.items))
      .catch(() => undefined)
  }, [load])

  async function createOrder(event: React.FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      const seats = Number.parseInt(form.seats, 10)
      const amountCents = Math.round(Number.parseFloat(form.amountYuan || "0") * 100)
      await apiRequest("/api/v1/admin/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schoolId: form.schoolId || undefined,
          plan: form.plan,
          seats: Number.isFinite(seats) && seats > 0 ? seats : 1,
          amountCents: Number.isFinite(amountCents) && amountCents >= 0 ? amountCents : 0,
          status: form.status,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          note: form.note.trim() || undefined,
        }),
      })
      setNotice("✅ 订单已录入")
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "录入订单失败")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
      {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}

      <section className="sticker sticker-quiet rise-in stagger-1 p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🧾</span>录入订单</h2>
        <p className="mt-1 text-xs text-ink-faint">记录每一笔销售（卖了多少份），概览页的销量统计只统计「已支付」订单。</p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={createOrder}>
          <label className="text-sm md:col-span-1">
            <span className="font-semibold text-ink-soft">学校 *</span>
            <select className="sticker-input mt-1 w-full cursor-pointer" required value={form.schoolId}
              onChange={(event) => setForm((current) => ({ ...current, schoolId: event.target.value }))}>
              <option value="">请选择学校</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">套餐</span>
            <select className="sticker-input mt-1 w-full cursor-pointer" value={form.plan}
              onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}>
              {PLANS.map((plan) => (
                <option key={plan.value} value={plan.value}>{plan.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">份数（座位）</span>
            <input className="sticker-input mt-1 w-full" type="number" min={1} max={10000} value={form.seats}
              onChange={(event) => setForm((current) => ({ ...current, seats: event.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">金额（元）</span>
            <input className="sticker-input mt-1 w-full" type="number" min={0} step="0.01" value={form.amountYuan}
              onChange={(event) => setForm((current) => ({ ...current, amountYuan: event.target.value }))} placeholder="例如 1980.00" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">状态</span>
            <select className="sticker-input mt-1 w-full cursor-pointer" value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">到期日（可选）</span>
            <input className="sticker-input mt-1 w-full" type="date" value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-semibold text-ink-soft">备注</span>
            <input className="sticker-input mt-1 w-full" maxLength={200} value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="续费 / 新签 / 赠送..." />
          </label>
          <div className="flex items-end md:col-span-1">
            <button type="submit" className="btn-tangerine disabled:opacity-40" disabled={creating || !form.schoolId}>
              {creating ? "录入中..." : "✅ 录入订单"}
            </button>
          </div>
        </form>
      </section>

      {orders.length === 0 ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">还没有订单记录</div> : null}

      {orders.length > 0 ? (
        <div className="sticker sticker-quiet rise-in stagger-3 overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-display text-ink-soft">
                <th className="py-2">学校 / 教师</th>
                <th>套餐</th>
                <th>份数</th>
                <th>金额</th>
                <th>状态</th>
                <th>到期日</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t-2 border-dashed border-ink/20">
                  <td className="py-2.5 font-semibold text-ink">{order.schoolName ?? order.teacherName ?? "-"}</td>
                  <td className="text-ink-soft">{order.plan === "YEARLY" ? "年付" : "月付"}</td>
                  <td className="font-bold tabular-nums text-ink">{order.seats}</td>
                  <td className="font-bold tabular-nums text-tangerine-deep">{formatYuan(order.amountCents)}</td>
                  <td>
                    <span className={`inline-block rounded-full border-2 px-2 py-0.5 text-xs font-bold ${statusBadge(order.status)}`}>
                      {STATUSES.find((status) => status.value === order.status)?.label ?? order.status}
                    </span>
                  </td>
                  <td className="tabular-nums text-ink-soft">{order.expiresAt ? String(order.expiresAt).slice(0, 10) : "-"}</td>
                  <td className="text-ink-soft">{order.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
