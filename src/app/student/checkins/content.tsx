"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface TaskRecord {
  id: string
  status: string
  evidenceUrl: string | null
  submittedAt: string | null
}

interface StudentTask {
  id: string
  title: string
  description: string | null
  rewardPoints: number
  requireEvidence: boolean
  deadlineAt: string | null
  overdue: boolean
  record: TaskRecord | null
}

interface CheckinPayload {
  student: { id: string; name: string; totalPoints: number }
  tasks: StudentTask[]
  records: Array<{
    id: string
    taskTitle: string
    status: string
    rewardPoints: number
    submittedAt: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待老师审批",
  COMPLETED: "已完成",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  MISSED: "未打卡",
}

export default function StudentCheckinsPage() {
  const [data, setData] = useState<CheckinPayload | null>(null)
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await apiRequest<CheckinPayload>("/api/v1/student/checkins"))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载打卡任务失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submit(task: StudentTask) {
    if (task.requireEvidence && !evidence[task.id]?.trim()) {
      setError("该任务需要提交证据链接")
      return
    }
    setSubmittingId(task.id)
    setError(null)
    setNotice(null)
    try {
      await apiRequest("/api/v1/student/checkins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, evidenceUrl: evidence[task.id]?.trim() || null }),
      })
      setNotice(`"${task.title}" 打卡已提交`)
      setEvidence((current) => ({ ...current, [task.id]: "" }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "打卡失败，请重试")
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">📅</span>我的打卡</h1>
            <p className="mt-1 text-sm text-ink-soft">提交打卡任务并查看审批状态。</p>
          </div>
          {data ? (
            <div className="sticker-dot !h-9 !w-auto bg-forest-mist px-3 text-sm">✨ 当前积分 <span className="font-display text-lg">{data.student.totalPoints}</span></div>
          ) : null}
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        <section className="space-y-3 rise-in stagger-2">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🌱</span>进行中的任务</h2>
          {!loading && (data?.tasks.length ?? 0) === 0 ? (
            <div className="sticker sticker-quiet p-8 text-center text-ink-soft">当前没有可打卡的任务</div>
          ) : null}
          {data?.tasks.map((task) => {
            const submitted = task.record !== null
            return (
              <div key={task.id} className={`sticker sticker-quiet p-4 ${task.overdue && !submitted ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold text-ink">{task.title}</div>
                    {task.description ? <div className="text-sm text-ink-soft">{task.description}</div> : null}
                    <div className="mt-1 text-sm text-ink-soft">
                      <span className="font-display font-bold text-forest">+{task.rewardPoints} 分</span>
                      {task.requireEvidence ? " · 📎 需要证据" : ""}
                      {task.deadlineAt ? ` · 截止 ${String(task.deadlineAt).slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border-2 px-3 py-1 text-sm font-semibold ${submitted ? "border-ink/20 bg-paper-deep text-ink-soft" : "border-ink bg-butter text-ink shadow-sticker-sm"}`}>
                    {submitted ? STATUS_LABELS[task.record?.status ?? ""] ?? task.record?.status : "可打卡"}
                  </span>
                </div>

                {!submitted ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="min-w-48 flex-1">
                      <span className="text-sm font-semibold text-ink-soft">证据链接{task.requireEvidence ? "" : "（可选）"}</span>
                      <input
                        type="url"
                        value={evidence[task.id] ?? ""}
                        onChange={(event) => setEvidence((current) => ({ ...current, [task.id]: event.target.value }))}
                        placeholder="https://..."
                        className="sticker-input mt-1 w-full"
                      />
                    </label>
                    <button
                      className="btn-tangerine disabled:opacity-40"
                      disabled={submittingId === task.id || task.overdue}
                      onClick={() => submit(task)}
                    >
                      {submittingId === task.id ? "提交中..." : "✅ 打卡"}
                    </button>
                  </div>
                ) : null}
                {!submitted && task.overdue ? <div className="mt-2 text-sm font-semibold text-tangerine">⏰ 任务已过截止时间，无法打卡</div> : null}
              </div>
            )
          })}
        </section>

        <section className="sticker sticker-quiet rise-in stagger-3 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📖</span>打卡记录</h2>
          {(data?.records.length ?? 0) === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">暂无打卡记录</div>
          ) : (
            <div className="mt-3 space-y-2">
              {data?.records.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{record.taskTitle}</div>
                    <div className="text-sm text-ink-faint">{record.submittedAt ? String(record.submittedAt).slice(0, 10) : "-"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-ink-soft">{STATUS_LABELS[record.status] ?? record.status}</div>
                    <div className="font-display font-bold text-forest">+{record.rewardPoints}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
