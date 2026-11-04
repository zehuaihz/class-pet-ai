import * as XLSX from "xlsx"

export interface ImportStudent {
  name: string
  studentNo: string | null
}

export const TEMPLATE_HEADERS = ["姓名", "学号"]

/** 生成学生导入模板（表头 + 两行示例），返回 xlsx 二进制。 */
export function buildStudentTemplate(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["张小明", "2026001"],
    ["李小红", "2026002"],
  ])
  sheet["!cols"] = [{ wch: 16 }, { wch: 16 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "学生名单")
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

/**
 * 把「第一个工作表」解析为学生数组。
 * 规则：第一行为表头，按列名（姓名/学号）取值（列顺序无关）；
 * 姓名/学号都为空的行跳过；表头缺少「姓名」列报错。
 */
export function parseStudentWorkbook(data: ArrayBuffer): ImportStudent[] {
  const workbook = XLSX.read(data, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Excel 中没有工作表")
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" })
  return rowsToStudents(matrix)
}

export function rowsToStudents(matrix: unknown[][]): ImportStudent[] {
  if (matrix.length === 0) return []
  const header = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim())
  const nameIndex = header.indexOf("姓名")
  const studentNoIndex = header.indexOf("学号")
  if (nameIndex === -1) throw new Error('表头缺少「姓名」列，请使用下载的模板')

  const students: ImportStudent[] = []
  for (const row of matrix.slice(1)) {
    const name = String(row?.[nameIndex] ?? "").trim()
    const studentNo = studentNoIndex === -1 ? "" : String(row?.[studentNoIndex] ?? "").trim()
    if (!name && !studentNo) continue
    students.push({ name, studentNo: studentNo || null })
  }
  return students
}
