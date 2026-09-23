"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface Child { id: string; name: string; totalPoints: number; classroom: { id: string; name: string } }

interface ChildDetail {
  student: {
    id: string
    name: string
    studentNo: string | null
    status: string
    totalPoints: number
    group: { id: string; name: string } | null
    classroom: { id: string; name: string; grade: string | null }
  }
  pet: { name: string; level: number; mood: string } | null
  transactions: Array<{ id: string; delta: number; reason: string; source: string; createdAt: string }>
  checkins: Array<{ id: string; taskTitle: string; status: string; rewardPoints: number; submittedAt: string | null }>
  redemptions: Array<{ id: string; rewardName: string; pointsSpent: number; status: string; createdAt: string }>
}

const CHECKIN_LABELS: Record<string, string> = {
  PENDING: "待审批",
  COMPLETED: "已完成",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  MISSED: "未打卡",
}

const REDEMPTION_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  FULFILLED: "已发放",
  CANCELLED: "已取消",
}

export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ChildDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    apiRequest<{ items: Child[] }>("/api/v1/parent/children")
      .then((data) => {
        setChildren(data.items)
        setSelectedId((current) => current ?? data.items[0]?.id ?? null)
      })
      .catch(() => setError("加载孩子信息失败"))
  }, [])

  const loadDetail = useCallback(async (studentId: string) => {
    setLoadingDetail(true)
    try {
      setDetail(await apiRequest<ChildDetail>(`/api/v1/parent/children/${studentId}`))
      setError(null)
    } catch (err) {
      setDetail(null)
      setError(err instanceof Error ? err.message : "加载孩子详情失败")
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">家长端</h1>
          <p className="text-slate-600">查看孩子的积分、打卡和兑换情况（只读）。</p>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {children.length === 0 && !error ? <div className="rounded-xl bg-white p-5 text-slate-500 shadow-sm">暂无已绑定的孩子</div> : null}

        {children.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="选择孩子">
            {children.map((child) => (
              <button
                key={child.id}
                role="tab"
                aria-selected={child.id === selectedId}
                className={`rounded-lg border px-4 py-2 ${child.id === selectedId ? "border-green-600 bg-green-50 text-green-700" : ""}`}
                onClick={() => setSelectedId(child.id)}
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}

        {loadingDetail ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}

        {detail && !loadingDetail ? (
          <>
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">{detail.student.name}</div>
              <div className="mt-2 text-slate-500">
                {detail.student.classroom.name}
                {detail.student.group ? ` · ${detail.student.group.name}` : " · 未分组"}
                {" · "}
                {detail.student.totalPoints} 分
              </div>
              {detail.pet ? (
                <div className="mt-1 text-slate-500">班级宠物：{detail.pet.name} Lv.{detail.pet.level}</div>
              ) : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="font-semibold">最近积分记录</h2>
                {detail.transactions.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="font-medium">{transaction.reason}</div>
                          <div className="text-sm text-slate-500">{String(transaction.createdAt).slice(0, 10)}</div>
                        </div>
                        <div className={transaction.delta >= 0 ? "text-green-600" : "text-red-600"}>
                          {transaction.delta >= 0 ? "+" : ""}
                          {transaction.delta}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="font-semibold">打卡记录</h2>
                {detail.checkins.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无打卡记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.checkins.map((record) => (
                      <div key={record.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="font-medium">{record.taskTitle}</div>
                          <div className="text-sm text-slate-500">{record.submittedAt ? String(record.submittedAt).slice(0, 10) : "-"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-600">{CHECKIN_LABELS[record.status] ?? record.status}</div>
                          <div className="text-sm text-green-600">+{record.rewardPoints}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
                <h2 className="font-semibold">兑换记录</h2>
                {detail.redemptions.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无兑换记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.redemptions.map((redemption) => (
                      <div key={redemption.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="font-medium">{redemption.rewardName}</div>
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
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
