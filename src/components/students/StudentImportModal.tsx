"use client"

import { useEffect, useRef, useState } from "react"
import { ApiClientError, apiRequest } from "@/lib/api-client"
import { downloadStudentsTemplate, parseStudentsWorkbook, type ExcelStudentRow } from "@/lib/excel"

interface ImportResult {
  createdCount: number
  updatedCount: number
  failedCount: number
  failures?: Array<{ row: number; reason: string }>
}

interface StudentImportModalProps {
  open: boolean
  classroomId: string
  onClose: () => void
  onSaved: () => void
}

const MAX_ROWS = 500
const MAX_FILE_BYTES = 5 * 1024 * 1024

export function StudentImportModal({ open, classroomId, onClose, onSaved }: StudentImportModalProps) {
  const [rows, setRows] = useState<ExcelStudentRow[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState<Array<{ row: number; reason: string }>>([])
  // 导入结果已展示（含部分失败）后，禁止再次提交同一批数据，避免重复导入。
  const [settled, setSettled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setRows(null)
    setFileName("")
    setParsing(false)
    setImporting(false)
    setError(null)
    setFailures([])
    setSettled(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // 每次打开都重置，避免上一次的文件/失败结果残留。
  useEffect(() => {
    if (open) reset()
  }, [open])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleDownloadTemplate() {
    setError(null)
    try {
      await downloadStudentsTemplate()
    } catch {
      setError("模板下载失败，请重试")
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    // 允许再次选择同一个文件。
    event.target.value = ""
    setError(null)
    setFailures([])
    setRows(null)
    if (file.size > MAX_FILE_BYTES) {
      setError("文件过大，请拆分后重试（最大 5MB）")
      return
    }
    setParsing(true)
    try {
      const parsed = await parseStudentsWorkbook(file)
      if (parsed.length > MAX_ROWS) {
        setError(`一次最多导入 ${MAX_ROWS} 名学生，请拆分后重试`)
        return
      }
      if (parsed.length === 0) {
        setError("模板中没有学生数据，请填写后再导入")
        return
      }
      setFileName(file.name)
      setRows(parsed)
    } catch {
      setError("无法解析文件，请使用下载的模板填写后上传")
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!rows || rows.length === 0 || importing || settled) return
    setImporting(true)
    setError(null)
    setFailures([])
    try {
      const data = await apiRequest<ImportResult>(`/api/v1/classrooms/${classroomId}/students/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ students: rows }),
      })
      if (data.failedCount > 0) {
        // 部分成功：刷新列表让新学生可见，但保留弹窗展示失败行；禁止重复提交。
        setFailures(data.failures ?? [])
        setError(`导入 ${data.createdCount} 人，${data.failedCount} 行失败`)
        setSettled(true)
        onSaved()
        return
      }
      reset()
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "导入学生失败")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="导入学生"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">导入学生</h2>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

          <button type="button" className="rounded-lg border px-4 py-2 text-green-700" onClick={handleDownloadTemplate}>
            下载模板
          </button>

          {!rows ? (
            <div>
              <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500 hover:border-green-400">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleFileChange} />
                {parsing ? "解析中..." : "点击选择 Excel 文件上传"}
              </label>
              <p className="mt-2 text-xs text-slate-400">第一行为表头（姓名/学号），请勿修改表头；学号列请使用文本格式，避免前导零丢失。</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="font-medium">{fileName}</div>
                <div className="text-sm text-slate-500">解析出 {rows.length} 名学生</div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-lg border px-4 py-2" onClick={reset}>重新选择</button>
                <button type="button" disabled={importing || settled} className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" onClick={handleImport}>
                  {settled ? "已导入，请重新选择" : importing ? "导入中..." : "确认导入"}
                </button>
              </div>
            </div>
          )}

          {failures.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 text-sm font-medium text-amber-800">以下行导入失败（数据首行为第 2 行）：</div>
              <ul className="space-y-1 text-sm text-amber-700">
                {failures.slice(0, 20).map((failure) => (
                  <li key={failure.row}>第 {failure.row + 1} 行：{failure.reason}</li>
                ))}
                {failures.length > 20 ? <li>… 等共 {failures.length} 行失败</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
