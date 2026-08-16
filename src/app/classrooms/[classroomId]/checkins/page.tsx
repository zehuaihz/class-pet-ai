"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"

type Task = { id: string; title: string; rewardPoints: number; stats?: { completedCount: number; totalStudents: number; pendingCount: number; missedCount: number; completionRate: number } }
type PendingRecord = { id: string; studentName: string; taskTitle: string; evidenceUrl?: string | null; status: string }

export default function CheckinsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [tasks, setTasks] = useState<Task[]>([])
  const [records, setRecords] = useState<PendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [tasksResponse, recordsResponse] = await Promise.all([
          fetch(`/api/v1/classrooms/${classroomId}/checkin-tasks`),
          fetch(`/api/v1/classrooms/${classroomId}/checkin-records`),
        ])
        if (!tasksResponse.ok || !recordsResponse.ok) throw new Error("load failed")
        const tasksPayload = await tasksResponse.json()
        const recordsPayload = await recordsResponse.json()
        const items = tasksPayload.data.items ?? []
        setTasks(items.map((task: Task) => task))
        setRecords(recordsPayload.data.items ?? [])
      } catch {
        setError("加载打卡任务失败")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [classroomId])

  async function updateRecord(recordId: string, action: "approve" | "reject") {
    try {
      const response = await fetch(`/api/v1/checkin-records/${recordId}/${action}`, { method: "PATCH" })
      if (!response.ok) throw new Error("request failed")
      setRecords((current) => current.filter((record) => record.id !== recordId))
    } catch {
      setError(action === "approve" ? "批准失败，请重试" : "驳回失败，请重试")
    }
  }

  async function handleApprove(recordId: string) {
    await updateRecord(recordId, "approve")
  }

  async function handleReject(recordId: string) {
    await updateRecord(recordId, "reject")
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">打卡任务</h1>
            <p className="text-slate-600">创建任务、查看完成率、补录和审批。</p>
          </div>
          <Link href={`/classrooms/${classroomId}/checkins/new`} className="rounded-lg bg-green-600 px-4 py-2 text-white">创建任务</Link>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{task.title}</div>
                  <div className="text-sm text-slate-500">完成 {task.stats?.completedCount ?? 0}/{task.stats?.totalStudents ?? 0} · 待审 {task.stats?.pendingCount ?? 0} · 漏卡 {task.stats?.missedCount ?? 0} · {Math.round((task.stats?.completionRate ?? 0) * 100)}%</div>
                </div>
                <span className="font-semibold text-green-600">+{task.rewardPoints}</span>
              </div>
            </div>
          ))}
        </div>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">待审批</h2>
          <div className="mt-4 space-y-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{record.studentName}</div>
                    <div className="text-sm text-slate-500">{record.taskTitle}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border px-3 py-1" onClick={() => handleReject(record.id)}>驳回</button>
                    <button className="rounded-lg bg-green-600 px-3 py-1 text-white" onClick={() => handleApprove(record.id)}>通过</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
