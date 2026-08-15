export interface ExcelStudentRow {
  name: string
  studentNo: string | null
}

/**
 * 解析教师上传的 Excel 学生模板。
 * 模板第一行为表头（姓名/学号），数据从第二行开始。按列位置取值，
 * 只读取已知列并 String 兜底，不透传整行，规避 xlsx 原型污染风险。
 * 返回的数组与 Excel 数据行一一对应（首数据行为下标 0）。
 * 依赖 SheetJS 动态加载，仅在使用时进入客户端 bundle。
 */
export async function parseStudentsWorkbook(file: File): Promise<ExcelStudentRow[]> {
  const buffer = await file.arrayBuffer()
  const mod = await import("xlsx")
  const XLSX = mod.default ?? mod

  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("文件为空或格式无法识别")

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1 })
  const data = rows.slice(1).map((row) => ({
    name: String(row?.[0] ?? "").trim(),
    studentNo: row?.[1] != null && String(row[1]).trim() !== "" ? String(row[1]).trim() : null,
  }))

  // 裁剪尾部全空行，保持数组下标与 Excel 数据行一致，便于错误提示定位行号。
  while (data.length > 0 && data[data.length - 1].name === "" && data[data.length - 1].studentNo === null) {
    data.pop()
  }

  return data
}

/** 下载带表头（姓名/学号）的 Excel 导入模板。 */
export async function downloadStudentsTemplate(): Promise<void> {
  const mod = await import("xlsx")
  const XLSX = mod.default ?? mod

  const worksheet = XLSX.utils.aoa_to_sheet([["姓名", "学号"]])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "学生")

  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = "学生导入模板.xlsx"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // 延迟释放，避免部分浏览器在下载尚未开始时取消链接。
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
