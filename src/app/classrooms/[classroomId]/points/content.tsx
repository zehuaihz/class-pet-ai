"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { QuickAddModal } from "@/components/points/QuickAddModal"
import { apiRequest } from "@/lib/api-client"

type Student = { id: string; name: string; totalPoints: number }
type Rule = { id: string; name: string; pointDelta: number }
type Transaction = { id: string; name: string; reason: string; delta: number; time: string; reversalOfId?: string | null }
type StudentRanking = { rank: number; studentId: string; name: string; totalPoints: number }
type GroupRanking = { rank: number; groupId: string; name: string; totalPoints: number }

export default function PointsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [students, setStudents] = useState<Student[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [studentRankings, setStudentRankings] = useState<StudentRanking[]>([])
  const [groups, setGroups] = useState<GroupRanking[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsData, transactionsData, rulesData, rankingsData] = await Promise.all([
        apiRequest<{ items: Student[] }>(`/api/v1/classrooms/${classroomId}/students`),
        apiRequest<{ items: Transaction[] }>(`/api/v1/classrooms/${classroomId}/points/transactions`),
        apiRequest<{ items: Rule[] }>(`/api/v1/classrooms/${classroomId}/point-rules`),
        apiRequest<{ students: StudentRanking[]; groups: GroupRanking[] }>(`/api/v1/classrooms/${classroomId}/points/rankings`),
      ])
      const nextStudents = studentsData.items

      setStudents(nextStudents)
      setTransactions(transactionsData.items)
      setRules(rulesData.items)
      setStudentRankings(rankingsData.students)
      setGroups(rankingsData.groups)
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

  async function handleSubmit(input: { studentId: string; delta: number; reason: string; ruleId?: string; syncPetGrowth: boolean; idempotencyKey: string }) {
    try {
      await apiRequest("/api/v1/points/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classroomId,
          studentId: input.studentId,
          delta: input.delta,
          reason: input.reason,
          ruleId: input.ruleId,
          syncPetGrowth: input.syncPetGrowth,
          source: "MANUAL",
          idempotencyKey: input.idempotencyKey,
        }),
      })
      await loadData()
    } catch {
      setError("加分失败，请重试")
      throw new Error("point transaction failed")
    }
  }

  async function handleReverse(transactionId: string) {
    if (!window.confirm("确定撤销这条积分流水？")) return
    try {
      await apiRequest(`/api/v1/points/transactions/${transactionId}/reverse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "录入错误" }),
      })
      await loadData()
    } catch {
      setError("撤销失败，请重试")
    }
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
              {studentRankings.map((student) => {
                const target = students.find((item) => item.id === student.studentId) ?? { id: student.studentId, name: student.name, totalPoints: student.totalPoints }
                return <div key={student.studentId} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{student.rank}. {student.name}</div>
                    <div className="text-sm text-slate-500">{student.totalPoints} 分</div>
                  </div>
                  <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => {
                    setSelectedStudent(target)
                    setOpen(true)
                  }}>+1</button>
                </div>
              })}
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
