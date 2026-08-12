"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface Student {
  id: string
  name: string
  studentNo?: string | null
  totalPoints: number
  group?: { id: string; name: string } | null
}

interface StudentForm {
  name: string
  studentNo: string
}

export default function StudentsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [students, setStudents] = useState<Student[]>([])
  const [keyword, setKeyword] = useState("")
  const [groupId, setGroupId] = useState("all")
  const [form, setForm] = useState<StudentForm>({ name: "", studentNo: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [importText, setImportText] = useState("")
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStudents() {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (keyword.trim()) query.set("keyword", keyword.trim())
      if (groupId !== "all") query.set("groupId", groupId)
      const data = await apiRequest<{ items: Student[] }>(`/api/v1/classrooms/${classroomId}/students?${query}`)
      setStudents(data.items)
    } catch {
      setError("加载学生失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadStudents, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, keyword, groupId])

  function openCreate() {
    setEditingId(null)
    setForm({ name: "", studentNo: "" })
    setShowForm(true)
  }

  function openEdit(student: Student) {
    setEditingId(student.id)
    setForm({ name: student.name, studentNo: student.studentNo ?? "" })
    setShowForm(true)
  }

  async function saveStudent(event: React.FormEvent) {
    event.preventDefault()
    try {
      const url = editingId ? `/api/v1/students/${editingId}` : `/api/v1/classrooms/${classroomId}/students`
      await apiRequest(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, studentNo: form.studentNo || null }),
      })
      setShowForm(false)
      await loadStudents()
    } catch {
      setError("保存学生失败")
    }
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

  async function importStudents(event: React.FormEvent) {
    event.preventDefault()
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch {
      setError("导入学生失败，请检查 JSON 格式")
      return
    }
    try {
      const data = await apiRequest<{ createdCount: number; failedCount: number; failures?: { row: number; reason: string }[] }>(`/api/v1/classrooms/${classroomId}/students/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ students: parsed }),
      })
      setShowImport(false)
      setImportText("")
      setError(data.failedCount > 0 ? `导入 ${data.createdCount} 人，${data.failedCount} 行失败` : null)
      await loadStudents()
    } catch {
      setError("导入学生失败，请检查 JSON 格式")
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">学生管理</h1><p className="text-slate-600">导入学生、查看积分、执行快捷加分。</p></div>
          <div className="flex gap-2"><button className="rounded-lg border px-4 py-2" onClick={() => setShowImport(true)}>导入学生</button><button className="rounded-lg bg-green-600 px-4 py-2 text-white" onClick={openCreate}>添加学生</button></div>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex gap-3"><label className="sr-only" htmlFor="student-search">搜索学生</label><input id="student-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="rounded-lg border px-3 py-2" placeholder="搜索学生" /><label className="sr-only" htmlFor="group-filter">分组筛选</label><select id="group-filter" value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-lg border px-3 py-2"><option value="all">全部分组</option></select></div>
          {loading ? <div className="p-4 text-slate-500">加载中...</div> : null}
          {!loading && students.length === 0 ? <div className="p-4 text-slate-500">暂无学生</div> : null}
          <div className="grid gap-4 md:grid-cols-3">{students.map((student) => <article key={student.id} className="rounded-xl border p-4"><div className="text-lg font-semibold">{student.name}</div><div className="mt-1 text-slate-500">{student.totalPoints}分 · {student.group?.name ?? "未分组"}</div><div className="mt-3 flex gap-2"><button className="rounded-lg border px-3 py-1" onClick={() => openEdit(student)}>编辑</button><button className="rounded-lg border px-3 py-1 text-red-600" onClick={() => removeStudent(student.id)}>删除</button></div></article>)}</div>
        </div>
      </div>
      {showForm ? <div className="fixed inset-0 grid place-items-center bg-black/30 p-4"><form onSubmit={saveStudent} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6"><h2 className="text-lg font-semibold">{editingId ? "编辑学生" : "添加学生"}</h2><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="姓名" /><input value={form.studentNo} onChange={(event) => setForm({ ...form, studentNo: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="学号（可选）" /><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={() => setShowForm(false)}>取消</button><button className="rounded-lg bg-green-600 px-4 py-2 text-white">保存</button></div></form></div> : null}
      {showImport ? <div className="fixed inset-0 grid place-items-center bg-black/30 p-4"><form onSubmit={importStudents} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6"><h2 className="text-lg font-semibold">导入学生 JSON</h2><textarea required value={importText} onChange={(event) => setImportText(event.target.value)} className="h-48 w-full rounded-lg border p-3" placeholder='[{"name":"小明","studentNo":"001"}]' /><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={() => setShowImport(false)}>取消</button><button className="rounded-lg bg-green-600 px-4 py-2 text-white">导入</button></div></form></div> : null}
    </AppShell>
  )
}
