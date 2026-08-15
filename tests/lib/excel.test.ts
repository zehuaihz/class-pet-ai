import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { parseStudentsWorkbook } from "@/lib/excel"

function makeWorkbookFile(rows: unknown[][]): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "学生")
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  // jsdom 的 File 未实现 arrayBuffer()，这里只暴露解析所需的接口。
  return { arrayBuffer: async () => out } as unknown as File
}

describe("parseStudentsWorkbook", () => {
  it("maps rows after the header into name/studentNo pairs by column position", async () => {
    const file = makeWorkbookFile([
      ["姓名", "学号"],
      ["小明", "001"],
      ["小红", 2],
    ])

    expect(await parseStudentsWorkbook(file)).toEqual([
      { name: "小明", studentNo: "001" },
      { name: "小红", studentNo: "2" },
    ])
  })

  it("returns an empty array for a header-only sheet", async () => {
    const file = makeWorkbookFile([["姓名", "学号"]])

    expect(await parseStudentsWorkbook(file)).toEqual([])
  })

  it("keeps a blank middle row but trims trailing blank rows", async () => {
    const file = makeWorkbookFile([
      ["姓名", "学号"],
      ["小明", "001"],
      [null, null],
      ["小红", null],
      [null, null],
    ])

    expect(await parseStudentsWorkbook(file)).toEqual([
      { name: "小明", studentNo: "001" },
      { name: "", studentNo: null },
      { name: "小红", studentNo: null },
    ])
  })

  it("rejects a non-Excel file", async () => {
    const file = new File(["not an excel file"], "notes.txt")

    await expect(parseStudentsWorkbook(file)).rejects.toThrow()
  })
})
