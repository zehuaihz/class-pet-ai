import { describe, expect, it } from "vitest"
import { buildStudentTemplate, parseStudentWorkbook, rowsToStudents } from "@/lib/student-import"

describe("rowsToStudents", () => {
  it("reads students by header name regardless of column order", () => {
    const students = rowsToStudents([
      ["学号", "姓名"],
      ["2026001", "张小明"],
      ["2026002", "李小红"],
    ])
    expect(students).toEqual([
      { name: "张小明", studentNo: "2026001" },
      { name: "李小红", studentNo: "2026002" },
    ])
  })

  it("keeps students without studentNo as null", () => {
    const students = rowsToStudents([
      ["姓名", "学号"],
      ["王同学", ""],
      ["赵同学", undefined],
    ])
    expect(students).toEqual([
      { name: "王同学", studentNo: null },
      { name: "赵同学", studentNo: null },
    ])
  })

  it("skips fully blank rows", () => {
    const students = rowsToStudents([
      ["姓名", "学号"],
      ["", ""],
      ["小明", "001"],
      [undefined, ""],
    ])
    expect(students).toEqual([{ name: "小明", studentNo: "001" }])
  })

  it("trims whitespace from cells", () => {
    const students = rowsToStudents([
      ["姓名", "学号"],
      ["  小刚  ", " 012 "],
    ])
    expect(students).toEqual([{ name: "小刚", studentNo: "012" }])
  })

  it("throws when 姓名 column is missing", () => {
    expect(() => rowsToStudents([["学号"], ["001"]])).toThrow(/表头缺少「姓名」列/)
  })

  it("returns empty for empty sheet", () => {
    expect(rowsToStudents([])).toEqual([])
  })
})

describe("buildStudentTemplate + parseStudentWorkbook", () => {
  it("round-trips: template parses back into the two example students", () => {
    const buffer = buildStudentTemplate()
    const students = parseStudentWorkbook(buffer)
    expect(students).toEqual([
      { name: "张小明", studentNo: "2026001" },
      { name: "李小红", studentNo: "2026002" },
    ])
  })

  it("parses a workbook without 学号 column and keeps names", () => {
    const sheet = [
      ["姓名"],
      ["小美"],
      ["", ""],
      ["小强"],
    ]
    const students = rowsToStudents(sheet)
    expect(students).toEqual([
      { name: "小美", studentNo: null },
      { name: "小强", studentNo: null },
    ])
  })
})
