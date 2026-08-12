"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { QuickAddModal } from "@/components/points/QuickAddModal"

type Student = { id: string; name: string; totalPoints: number }
type Rule = { id: string; name: string; pointDelta: number }
type Transaction = { id: string; name: string; reason: string; delta: number; time: string; reversalOfId?: string | null }

export default function PointsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [students, setStudents] = useState<Student[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [groups, setGroups] = useState<{ rank: number; name: string; totalPoints: number }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsResponse, transactionsResponse, rulesResponse, rankingsResponse] = await Promise.all([
        fetch(`/api/v1/classrooms/${classroomId}/students`),
        fetch(`/api/v1/classrooms/${classroomId}/points/transactions`),
        fetch(`/api/v1/classrooms/${classroomId}/point-rules`),
        fetch(`/api/v1/classrooms/${classroomId}/points/rankings`),
      ])

      if (!studentsResponse.ok || !transactionsResponse.ok) throw new Error("load failed")

      const studentsPayload = await studentsResponse.json()
      const transactionsPayload = await transactionsResponse.json()
      const rulesPayload = rulesResponse.ok ? await rulesResponse.json() : { data: { items: [] } }
      const rankingsPayload = rankingsResponse.ok ? await rankingsResponse.json() : { data: { groups: [] } }
      const nextStudents = studentsPayload.data.items ?? []

      setStudents(nextStudents)
      setTransactions(transactionsPayload.data.items ?? [])
      setRules(rulesPayload.data.items ?? [])
      setGroups(rankingsPayload.data.groups ?? [])
      setSelectedStudent(nextStudents[0] ?? null)
    } catch {
      setError("加载积分数据失败")
    } finally {
      setLoading(false)
    }
  }, [classroomId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(input: { studentId: string; delta: number; reason: string }) {
    const response = await fetch("/api/v1/points/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classroomId,
        studentId: input.studentId,
        delta: input.delta,
        reason: input.reason,
        source: "MANUAL",
      }),
    })

    if (!response.ok) {
      setError("加分失败，请重试")
      throw new Error("point transaction failed")
    }

    await loadData()
  }

  async function handleReverse(transactionId: string) {
    if (!window.confirm("确定撤销这条积分流水？")) return
    const response = await fetch(`/api/v1/points/transactions/${transactionId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "录入错误" }),
    })
    if (!response.ok) {
      setError("撤销失败，请重试")
      return
    }
    await loadData()
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">积分管理</h1>
            <p className="text-slate-600">快捷加分、流水追踪、排行榜和撤销。</p>
          </div>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white" onClick={() => setOpen(true)} disabled={students.length === 0}>快捷加分</button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">积分流水</h2>
            <div className="mt-4 space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{tx.name}</div>
                    <div className="text-sm text-slate-500">{tx.reason} · {tx.time}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${tx.delta >= 0 ? "text-green-600" : "text-red-600"}`}>{tx.delta >= 0 ? "+" : ""}{tx.delta}</span>
                    {!tx.reversalOfId && <button className="text-sm text-slate-500" onClick={() => handleReverse(tx.id)}>撤销</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">排行榜</h2>
            <div className="mt-4 space-y-3">
              {students.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{index + 1}. {student.name}</div>
                    <div className="text-sm text-slate-500">{student.totalPoints} 分</div>
                  </div>
                  <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => {
                    setSelectedStudent(student)
                    setOpen(true)
                  }}>+1</button>
                </div>
              ))}
            </div>
            {groups.length > 0 ? (
              <div className="mt-6">
                <h3 className="font-semibold">小组榜</h3>
                <div className="mt-3 space-y-2">
                  {groups.map((group) => (
                    <div key={group.rank} className="flex items-center justify-between rounded-lg border p-3">
                      <div><div className="font-medium">{group.rank}. {group.name}</div><div className="text-sm text-slate-500">{group.totalPoints} 分</div></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <QuickAddModal
          open={open}
          student={selectedStudent}
          defaultRules={rules}
          onOpenChange={setOpen}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  )
}
