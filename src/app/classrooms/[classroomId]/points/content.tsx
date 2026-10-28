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

  async function handleSubmit(input: { studentId: string; delta: number; reason: string; ruleId?: string; idempotencyKey: string }) {
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rise-in flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink">
              <span aria-hidden="true">✨</span>积分管理
            </h1>
            <p className="mt-1 text-sm text-ink-soft">快捷加分、流水追踪、排行榜和撤销。</p>
          </div>
          <button className="btn-tangerine disabled:opacity-40" onClick={() => setOpen(true)} disabled={students.length === 0}>＋ 快捷加分</button>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="sticker sticker-quiet rise-in stagger-2 p-5 lg:col-span-2">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📜</span>积分流水</h2>
            <div className="mt-4 space-y-2.5">
              {transactions.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-ink/30 px-4 py-6 text-center text-sm text-ink-faint">还没有积分流水</p>
              ) : transactions.map((tx) => (
                <div key={tx.id} className={`flex items-center justify-between gap-3 rounded-xl border-2 p-3 ${tx.reversalOfId ? "border-ink/10 bg-paper-deep/60 opacity-70" : "border-ink/15 bg-white"}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{tx.name}{tx.reversalOfId ? <span className="ml-2 rounded-full bg-berry-soft px-2 py-0.5 text-xs font-semibold text-berry">已撤销</span> : null}</div>
                    <div className="truncate text-sm text-ink-soft">{tx.reason} · {tx.time}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`font-display text-lg font-bold ${tx.delta >= 0 ? "text-forest" : "text-berry"}`}>{tx.delta >= 0 ? "+" : ""}{tx.delta}</span>
                    {!tx.reversalOfId && <button className="btn-outline !px-2.5 !py-0.5 text-xs" onClick={() => handleReverse(tx.id)}>撤销</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="sticker sticker-quiet rise-in stagger-3 p-5">
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🏆</span>排行榜</h2>
              <div className="mt-4 space-y-2.5">
                {studentRankings.map((student, index) => {
                  const target = students.find((item) => item.id === student.studentId) ?? { id: student.studentId, name: student.name, totalPoints: student.totalPoints }
                  return <div key={student.studentId} className={`flex items-center justify-between gap-3 rounded-xl border-2 p-3 ${index === 0 ? "border-ink bg-butter-soft shadow-sticker-sm" : "border-ink/15 bg-white"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <span className="sticker-dot !h-6 !w-6 !text-xs" aria-hidden="true">{["🥇", "🥈", "🥉"][index] ?? student.rank}</span>
                        <span className="truncate">{student.name}</span>
                      </div>
                      <div className="font-display mt-0.5 text-sm font-bold text-ink-soft">{student.totalPoints} 分</div>
                    </div>
                    <button className="btn-outline !px-2.5 !py-0.5 text-xs" onClick={() => {
                      setSelectedStudent(target)
                      setOpen(true)
                    }}>+1</button>
                  </div>
                })}
                {studentRankings.length === 0 ? (
                  <p className="rounded-xl border-2 border-dashed border-ink/30 px-4 py-6 text-center text-sm text-ink-faint">暂无排名</p>
                ) : null}
              </div>
            </div>
            {groups.length > 0 ? (
              <div className="sticker sticker-quiet rise-in stagger-4 p-5">
                <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🤝</span>小组榜</h3>
                <div className="mt-3 space-y-2">
                  {groups.map((group, index) => (
                    <div key={group.rank} className={`flex items-center justify-between rounded-xl border-2 p-3 ${index === 0 ? "border-ink bg-butter-soft shadow-sticker-sm" : "border-ink/15 bg-white"}`}>
                      <div className="min-w-0"><div className="font-semibold text-ink">{group.rank}. {group.name}</div><div className="font-display text-sm font-bold text-ink-soft">{group.totalPoints} 分</div></div>
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
