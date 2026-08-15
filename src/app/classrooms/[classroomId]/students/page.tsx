"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { PetVisual } from "@/components/pets/PetVisual"
import { StudentFormModal } from "@/components/students/StudentFormModal"
import { StudentImportModal } from "@/components/students/StudentImportModal"
import { apiRequest } from "@/lib/api-client"
import type { PetView, ZooItem } from "@/lib/zoo-types"

interface Student {
  id: string
  name: string
  studentNo?: string | null
  totalPoints: number
  group?: { id: string; name: string } | null
}

export default function StudentsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [students, setStudents] = useState<Student[]>([])
  const [keyword, setKeyword] = useState("")
  const [groupId, setGroupId] = useState("all")
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zooMap, setZooMap] = useState<Record<string, { pet: PetView | null; badgeCount: number }>>({})
  const [assigning, setAssigning] = useState(false)

  async function loadStudents() {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (keyword.trim()) query.set("keyword", keyword.trim())
      if (groupId !== "all") query.set("groupId", groupId)
      const data = await apiRequest<{ items: Student[] }>(`/api/v1/classrooms/${classroomId}/students?${query}`)
      setStudents(data.items)
      const zoo = await apiRequest<{ items: ZooItem[] }>(`/api/v1/classrooms/${classroomId}/zoo`)
      setZooMap(Object.fromEntries(zoo.items.map((item) => [item.student.id, { pet: item.pet, badgeCount: item.badgeCount }])))
    } catch {
      setError("加载学生失败")
    } finally {
      setLoading(false)
    }
  }

  async function assignPets() {
    if (!window.confirm("一键为尚未拥有宠物的学生随机分配宠物？")) return
    setAssigning(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/pets/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      await loadStudents()
    } catch {
      setError("分配宠物失败")
    } finally {
      setAssigning(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadStudents, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, keyword, groupId])

  function openCreate() {
    setEditingStudent(null)
    setShowForm(true)
  }

  function openEdit(student: Student) {
    setEditingStudent(student)
    setShowForm(true)
  }

  async function removeStudent(studentId: string) {
    if (!window.confirm("确定删除该学生？")) return
    try {
      await apiRequest(`/api/v1/students/${studentId}`, { method: "DELETE" })
      await loadStudents()
    } catch {
      setError("删除学生失败")
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">学生管理</h1><p className="text-slate-600">导入学生、分配宠物、编辑与删除。</p></div>
          <div className="flex gap-2">
            <button className="rounded-lg border px-4 py-2" onClick={() => setShowImport(true)}>导入学生</button>
            <button className="rounded-lg border px-4 py-2 text-green-700 disabled:opacity-50" onClick={assignPets} disabled={assigning}>{assigning ? "分配中..." : "一键分配宠物"}</button>
            <button className="rounded-lg bg-green-600 px-4 py-2 text-white" onClick={openCreate}>添加学生</button>
          </div>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex gap-3"><label className="sr-only" htmlFor="student-search">搜索学生</label><input id="student-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="rounded-lg border px-3 py-2" placeholder="搜索学生" /><label className="sr-only" htmlFor="group-filter">分组筛选</label><select id="group-filter" value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-lg border px-3 py-2"><option value="all">全部分组</option></select></div>
          {loading ? <div className="p-4 text-slate-500">加载中...</div> : null}
          {!loading && students.length === 0 ? <div className="p-4 text-slate-500">暂无学生</div> : null}
          <div className="grid gap-4 md:grid-cols-3">{students.map((student) => {
            const zoo = zooMap[student.id]
            const pet = zoo?.pet ?? null
            return (
              <article key={student.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">{student.name}</div>
                  {pet ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      <PetVisual speciesKey={pet.speciesKey} level={pet.level} size="text-base" /> Lv.{pet.level}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">无宠物</span>
                  )}
                </div>
                <div className="mt-1 text-slate-500">{student.totalPoints}分 · {student.group?.name ?? "未分组"}</div>
                {pet ? (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{pet.speciesName}</span>
                      <span>{pet.graduated ? "🎓 已毕业" : pet.nextThreshold != null ? `还差 ${pet.remainingToNext}` : ""}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round(pet.progressRatio * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg border px-3 py-1" onClick={() => openEdit(student)}>编辑</button>
                  <button className="rounded-lg border px-3 py-1 text-red-600" onClick={() => removeStudent(student.id)}>删除</button>
                </div>
              </article>
            )
          })}</div>
        </div>
      </div>

      <StudentFormModal
        open={showForm}
        editingStudent={editingStudent}
        classroomId={classroomId}
        onClose={() => setShowForm(false)}
        onSaved={loadStudents}
      />
      <StudentImportModal
        open={showImport}
        classroomId={classroomId}
        onClose={() => setShowImport(false)}
        onSaved={loadStudents}
      />
    </AppShell>
  )
}
