"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"
import { formatAppTime, parseAppDateInput } from "@/lib/time"

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
      alert(`已清理 ${data.deleted} 条日志`)
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">数据台账</h1>
            <p className="text-slate-600">全部加扣分、撤销操作永久留痕，可导出 CSV 或按日期清理。</p>
          </div>
          <a className="rounded-lg bg-green-600 px-4 py-2 text-white" href={`/api/v1/classrooms/${classroomId}/audit/export`}>导出 CSV</a>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">加载中...</div> : null}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">日志清理</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="date" value={cutoff} onChange={(event) => setCutoff(event.target.value)} className="rounded-lg border px-3 py-2" />
            <button className="rounded-lg border px-4 py-2 text-red-600 disabled:opacity-50" disabled={cleaning} onClick={cleanup}>
              {cleaning ? "清理中..." : "清理此日期前的日志"}
            </button>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">成长记录（共 {items.length} 条）</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-4">时间</th>
                  <th className="py-2 pr-4">学生</th>
                  <th className="py-2 pr-4">操作事项</th>
                  <th className="py-2 pr-4">变动积分</th>
                  <th className="py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-slate-500">{formatAppTime(tx.createdAt)}</td>
                    <td className="py-2 pr-4 font-medium">{tx.name}</td>
                    <td className="py-2 pr-4">{tx.reason}</td>
                    <td className={`py-2 pr-4 font-semibold ${tx.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.delta >= 0 ? "+" : ""}{tx.delta}
                    </td>
                    <td className="py-2">{tx.reversalOfId ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">已撤销</span> : <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">有效</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? <div className="py-6 text-center text-slate-400">暂无日志</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
