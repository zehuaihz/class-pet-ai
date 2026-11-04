"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"
import type { ImportStudent } from "@/lib/student-import"

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
  groupId: string
}

interface Group {
  id: string
  name: string
}

export default function StudentsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [keyword, setKeyword] = useState("")
  const [groupId, setGroupId] = useState("all")
  const [form, setForm] = useState<StudentForm>({ name: "", studentNo: "", groupId: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [importStudents, setImportStudents] = useState<ImportStudent[]>([])
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importFailures, setImportFailures] = useState<{ row: number; reason: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStudents() {
    if (!classroomId) return
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (keyword.trim()) query.set("keyword", keyword.trim())
      if (groupId !== "all") query.set("groupId", groupId)
      const [studentData, groupData] = await Promise.all([
        apiRequest<{ items: Student[] }>(`/api/v1/classrooms/${classroomId}/students?${query}`),
        apiRequest<{ items: Group[] }>(`/api/v1/classrooms/${classroomId}/groups`),
      ])
      setStudents(studentData.items)
      setGroups(groupData.items)
    } catch {
      setError("加载学生或分组失败")
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
    setForm({ name: "", studentNo: "", groupId: "" })
    setShowForm(true)
  }

  function openEdit(student: Student) {
    setEditingId(student.id)
    setForm({ name: student.name, studentNo: student.studentNo ?? "", groupId: student.group?.id ?? "" })
    setShowForm(true)
  }

  async function saveStudent(event: React.FormEvent) {
    event.preventDefault()
    try {
      const url = editingId ? `/api/v1/students/${editingId}` : `/api/v1/classrooms/${classroomId}/students`
      await apiRequest(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, studentNo: form.studentNo || null, groupId: form.groupId || null }),
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

  async function downloadTemplate() {
    const { buildStudentTemplate } = await import("@/lib/student-import")
    const blob = new Blob([buildStudentTemplate()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "学生导入模板.xlsx"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportError(null)
    setImportFailures([])
    try {
      const { parseStudentWorkbook } = await import("@/lib/student-import")
      const parsed = parseStudentWorkbook(await file.arrayBuffer())
      if (parsed.length === 0) {
        setImportStudents([])
        setImportError("没有解析到学生数据：请检查表格里是否有数据行")
        return
      }
      setImportStudents(parsed)
    } catch (error) {
      setImportStudents([])
      setImportError(error instanceof Error ? error.message : "Excel 解析失败，请使用下载的模板")
    }
  }

  async function submitImport(event: React.FormEvent) {
    event.preventDefault()
    if (importStudents.length === 0) {
      setImportError("请先选择要导入的 Excel 文件")
      return
    }
    setImporting(true)
    try {
      const data = await apiRequest<{ createdCount: number; failedCount: number; failures?: { row: number; reason: string }[] }>(`/api/v1/classrooms/${classroomId}/students/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ students: importStudents }),
      })
      if (data.failedCount > 0) {
        setImportFailures(data.failures ?? [])
        setError(`导入 ${data.createdCount} 人，${data.failedCount} 行失败，请修正后重试`)
      } else {
        setShowImport(false)
        setError(null)
      }
      setImportStudents([])
      setImportFileName(null)
      await loadStudents()
    } catch {
      setImportError("导入学生失败，请稍后重试")
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🧒</span>学生管理</h1>
            <p className="mt-1 text-sm text-ink-soft">导入学生、查看积分、执行快捷加分。</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => setShowImport(true)}>📥 导入学生</button>
            <button className="btn-tangerine" onClick={openCreate}>＋ 添加学生</button>
          </div>
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        <div className="sticker sticker-quiet rise-in stagger-2 p-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="student-search">搜索学生</label>
            <input id="student-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="sticker-input" placeholder="🔍 搜索学生" />
            <label className="sr-only" htmlFor="group-filter">分组筛选</label>
            <select id="group-filter" value={groupId} onChange={(event) => setGroupId(event.target.value)} className="sticker-input cursor-pointer">
              <option value="all">全部分组</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </div>
          {loading ? <div className="animate-pulse p-4 text-ink-soft">加载中...</div> : null}
          {!loading && students.length === 0 ? <div className="rounded-xl border-2 border-dashed border-ink/30 p-8 text-center text-ink-faint">暂无学生，点击「添加学生」开始</div> : null}
          <div className="grid gap-4 md:grid-cols-3">
            {students.map((student, index) => (
              <article key={student.id} className={`rise-in stagger-${Math.min(index + 1, 6)} rounded-sticker border-2 border-ink/15 bg-white p-4 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-sticker-sm`}>
                <div className="font-display text-lg font-bold text-ink">{student.name}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  <span className="font-display font-bold text-forest">{student.totalPoints}</span> 分 · {student.group?.name ?? "未分组"}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-outline !px-3 !py-1 text-sm" onClick={() => openEdit(student)}>编辑</button>
                  <button className="btn-outline !px-3 !py-1 text-sm !text-berry hover:!bg-berry-soft" onClick={() => removeStudent(student.id)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      {showForm ? (
        <div className="fixed inset-0 grid place-items-center bg-ink/50 p-4" onMouseDown={() => setShowForm(false)}>
          <form onSubmit={saveStudent} className="animate-pop-in w-full max-w-md space-y-4 rounded-sticker-lg border-2 border-ink bg-paper p-6 shadow-sticker-lg" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-ink">{editingId ? "✏️ 编辑学生" : "🧒 添加学生"}</h2>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="sticker-input w-full" placeholder="姓名" />
            <input value={form.studentNo} onChange={(event) => setForm({ ...form, studentNo: event.target.value })} className="sticker-input w-full" placeholder="学号（可选）" />
            <select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })} className="sticker-input w-full cursor-pointer">
              <option value="">未分组</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn-tangerine">保存</button>
            </div>
          </form>
        </div>
      ) : null}
      {showImport ? (
        <div className="fixed inset-0 grid place-items-center bg-ink/50 p-4" onMouseDown={() => setShowImport(false)}>
          <form onSubmit={submitImport} className="animate-pop-in w-full max-w-lg space-y-4 rounded-sticker-lg border-2 border-ink bg-paper p-6 shadow-sticker-lg" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-ink">📥 导入学生（Excel）</h2>
            <p className="text-sm text-ink-soft">
              第一步：下载模板，按格式填写「姓名」「学号」；第二步：选择填好的文件导入。学号可留空。
            </p>
            <button type="button" className="btn-outline w-full" onClick={downloadTemplate}>📄 下载 Excel 模板</button>

            <label htmlFor="student-import-file" className="sticker-input flex w-full cursor-pointer items-center justify-between gap-3 !rounded-xl text-sm">
              <span className={importFileName ? "font-semibold text-ink" : "text-ink-soft"}>
                {importFileName ?? "点击选择 .xlsx 文件"}
              </span>
              <span aria-hidden="true">📂</span>
            </label>
            <input id="student-import-file" type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleFileChange} />

            {importStudents.length > 0 ? (
              <div className="rounded-xl border-2 border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">
                ✓ 已解析 {importStudents.length} 名学生（{importFileName}），点击「开始导入」提交
              </div>
            ) : null}
            {importError ? <div className="rounded-xl border-2 border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{importError}</div> : null}
            {importFailures.length > 0 ? (
              <ul className="max-h-32 space-y-1 overflow-auto rounded-xl border-2 border-berry/40 bg-white p-3 text-xs text-ink">
                {importFailures.map((failure) => (
                  <li key={`${failure.row}-${failure.reason}`}>第 {failure.row} 行：{failure.reason === "name required" ? "姓名不能为空" : failure.reason}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setShowImport(false)}>取消</button>
              <button className="btn-tangerine" disabled={importing || importStudents.length === 0}>{importing ? "导入中…" : "开始导入"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  )
}
