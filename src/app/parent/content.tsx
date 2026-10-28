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
  pet: { name: string; level: number; speciesKey: string } | null
  transactions: Array<{ id: string; delta: number; reason: string; source: string; createdAt: string }>
  checkins: Array<{ id: string; taskTitle: string; status: string; rewardPoints: number; submittedAt: string | null }>
  redemptions: Array<{ id: string; rewardName: string; badgesSpent: number; status: string; createdAt: string }>
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
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rise-in">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🏡</span>家长端</h1>
          <p className="mt-1 text-sm text-ink-soft">查看孩子的积分、打卡和兑换情况（只读）。</p>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {children.length === 0 && !error ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">暂无已绑定的孩子</div> : null}

        {children.length > 1 ? (
          <div className="rise-in stagger-2 flex flex-wrap gap-2" role="tablist" aria-label="选择孩子">
            {children.map((child) => (
              <button
                key={child.id}
                role="tab"
                aria-selected={child.id === selectedId}
                className={`rounded-full border-2 px-5 py-2 font-semibold transition ${child.id === selectedId ? "border-ink bg-butter text-ink shadow-sticker-sm" : "border-ink/25 bg-white text-ink-soft hover:border-ink"}`}
                onClick={() => setSelectedId(child.id)}
              >
                🧒 {child.name}
              </button>
            ))}
          </div>
        ) : null}

        {loadingDetail ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        {detail && !loadingDetail ? (
          <>
            <section className="sticker sticker-quiet rise-in stagger-2 p-5">
              <div className="font-display text-xl font-bold text-ink">{detail.student.name}</div>
              <div className="mt-2 text-ink-soft">
                {detail.student.classroom.name}
                {detail.student.group ? ` · ${detail.student.group.name}` : " · 未分组"}
                {" · "}
                <span className="font-display font-bold text-forest">{detail.student.totalPoints} 分</span>
              </div>
              {detail.pet ? (
                <div className="mt-1 text-ink-soft">🐾 宠物：<span className="font-semibold text-ink">{detail.pet.name}</span> Lv.{detail.pet.level}</div>
              ) : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="sticker sticker-quiet rise-in stagger-3 p-5">
                <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">✨</span>最近积分记录</h2>
                {detail.transactions.length === 0 ? (
                  <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{transaction.reason}</div>
                          <div className="text-sm text-ink-faint">{String(transaction.createdAt).slice(0, 10)}</div>
                        </div>
                        <div className={`font-display shrink-0 text-lg font-bold ${transaction.delta >= 0 ? "text-forest" : "text-berry"}`}>
                          {transaction.delta >= 0 ? "+" : ""}
                          {transaction.delta}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="sticker sticker-quiet rise-in stagger-4 p-5">
                <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📅</span>打卡记录</h2>
                {detail.checkins.length === 0 ? (
                  <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无打卡记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.checkins.map((record) => (
                      <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{record.taskTitle}</div>
                          <div className="text-sm text-ink-faint">{record.submittedAt ? String(record.submittedAt).slice(0, 10) : "-"}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm text-ink-soft">{CHECKIN_LABELS[record.status] ?? record.status}</div>
                          <div className="font-display font-bold text-forest">+{record.rewardPoints}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="sticker sticker-quiet rise-in stagger-5 p-5 lg:col-span-2">
                <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🛍️</span>兑换记录</h2>
                {detail.redemptions.length === 0 ? (
                  <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无兑换记录</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.redemptions.map((redemption) => (
                      <div key={redemption.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{redemption.rewardName}</div>
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
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
