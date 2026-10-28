"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"
import { formatAppDateTime, parseAppDateInput } from "@/lib/time"

interface Transaction {
  id: string
  name: string
  reason: string
  delta: number
  createdAt: string
  reversalOfId?: string | null
}

export default function AuditPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cutoff, setCutoff] = useState("")

  useEffect(() => {
    apiRequest<{ items: Transaction[] }>(`/api/v1/classrooms/${classroomId}/points/transactions`)
      .then((data) => setItems(data.items))
      .catch(() => setError("加载操作日志失败"))
      .finally(() => setLoading(false))
  }, [classroomId])

  async function cleanup() {
    if (!cutoff) {
      setError("请选择清理日期")
      return
    }
    const before = parseAppDateInput(cutoff)
    if (!window.confirm(`确定清理 ${cutoff} 之前的所有操作日志？当前余额与宠物进度不受影响，该操作不可恢复。`)) return
    setCleaning(true)
    setError(null)
    try {
      const data = await apiRequest<{ deleted: number }>(`/api/v1/classrooms/${classroomId}/audit`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ before: before.toISOString() }),
      })
      setError(null)
      window.alert(`已清理 ${data.deleted} 条日志`)
      setCutoff("")
      const refreshed = await apiRequest<{ items: Transaction[] }>(`/api/v1/classrooms/${classroomId}/points/transactions`)
      setItems(refreshed.items)
    } catch {
      setError("清理失败")
    } finally {
      setCleaning(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🧾</span>数据台账</h1>
            <p className="mt-1 text-sm text-ink-soft">全部加扣分、撤销操作永久留痕，可导出 CSV 或按日期清理。</p>
          </div>
          <a className="btn-tangerine" href={`/api/v1/classrooms/${classroomId}/audit/export`}>📤 导出 CSV</a>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        <section className="sticker sticker-quiet rise-in stagger-2 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🧹</span>日志清理</h2>
          <p className="mt-1 text-sm text-ink-soft">仅删除指定日期前的日志，学生余额和宠物进度不受影响。</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="sticker-input flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-semibold text-ink-soft">截止</span>
              <input type="date" value={cutoff} onChange={(event) => setCutoff(event.target.value)} className="cursor-pointer bg-transparent font-semibold text-ink outline-none" />
            </label>
            <button className="btn-outline !text-berry hover:!bg-berry-soft disabled:opacity-40" disabled={cleaning} onClick={cleanup}>
              {cleaning ? "清理中..." : "清理此日期前的日志"}
            </button>
          </div>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-3 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📖</span>成长记录（共 {items.length} 条）</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-display border-b-2 border-ink text-left text-ink-soft">
                  <th className="py-2 pr-4">时间</th>
                  <th className="py-2 pr-4">学生</th>
                  <th className="py-2 pr-4">操作事项</th>
                  <th className="py-2 pr-4">变动积分</th>
                  <th className="py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} className="border-b border-dashed border-ink/20 last:border-0">
                    <td className="py-2.5 pr-4 text-ink-faint">{formatAppDateTime(tx.createdAt)}</td>
                    <td className="py-2.5 pr-4 font-semibold text-ink">{tx.name}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{tx.reason}</td>
                    <td className={`font-display py-2.5 pr-4 text-base font-bold ${tx.delta >= 0 ? "text-forest" : "text-berry"}`}>
                      {tx.delta >= 0 ? "+" : ""}{tx.delta}
                    </td>
                    <td className="py-2.5">
                      {tx.reversalOfId ? (
                        <span className="rounded-full border-2 border-ink/15 bg-paper-deep px-2 py-0.5 text-xs font-semibold text-ink-faint">已撤销</span>
                      ) : (
                        <span className="rounded-full border-2 border-forest bg-forest-mist px-2 py-0.5 text-xs font-bold text-forest-deep">有效</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && !loading ? <div className="py-8 text-center text-ink-faint">暂无日志</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
