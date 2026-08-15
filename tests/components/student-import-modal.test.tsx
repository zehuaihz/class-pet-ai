import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StudentImportModal } from "@/components/students/StudentImportModal"

const apiRequestMock = vi.hoisted(() => vi.fn())
const parseStudentsWorkbookMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiRequest: apiRequestMock }
})

vi.mock("@/lib/excel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/excel")>()
  return { ...actual, parseStudentsWorkbook: parseStudentsWorkbookMock, downloadStudentsTemplate: vi.fn() }
})

const rows = [
  { name: "小明", studentNo: "001" },
  { name: "小红", studentNo: "002" },
]

async function uploadFile(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(/Excel/)
  await user.upload(input, new File(["x"], "students.xlsx"))
}

describe("StudentImportModal", () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    parseStudentsWorkbookMock.mockReset()
    parseStudentsWorkbookMock.mockResolvedValue(rows)
  })

  it("parses an uploaded file and imports successfully, then closes", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<StudentImportModal open classroomId="classroom_1" onClose={onClose} onSaved={onSaved} />)

    await uploadFile(user)
    expect(screen.getByText("解析出 2 名学生")).toBeVisible()

    apiRequestMock.mockResolvedValue({ createdCount: 2, updatedCount: 0, failedCount: 0, failures: [] })
    await user.click(screen.getByRole("button", { name: "确认导入" }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/v1/classrooms/classroom_1/students/import",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ students: rows }) }),
      )
    })
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("keeps the modal open on partial failure, refreshes the list, and prevents re-submitting the same rows", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(<StudentImportModal open classroomId="classroom_1" onClose={onClose} onSaved={onSaved} />)

    await uploadFile(user)
    apiRequestMock.mockResolvedValue({ createdCount: 1, updatedCount: 0, failedCount: 1, failures: [{ row: 1, reason: "name required" }] })
    await user.click(screen.getByRole("button", { name: "确认导入" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText("导入 1 人，1 行失败")).toBeVisible()
    expect(screen.getByText("第 2 行：name required")).toBeVisible()
    expect(screen.getByRole("button", { name: "已导入，请重新选择" })).toBeDisabled()

    // 重新打开时应重置状态，回到上传区域，不再残留上一次的数据。
    rerender(<StudentImportModal open={false} classroomId="classroom_1" onClose={onClose} onSaved={onSaved} />)
    rerender(<StudentImportModal open classroomId="classroom_1" onClose={onClose} onSaved={onSaved} />)
    expect(screen.getByText(/点击选择 Excel 文件上传/)).toBeVisible()
  })

  it("shows a friendly error when the workbook has no student rows", async () => {
    const user = userEvent.setup()
    render(<StudentImportModal open classroomId="classroom_1" onClose={() => undefined} onSaved={() => undefined} />)

    parseStudentsWorkbookMock.mockResolvedValue([])
    await uploadFile(user)

    expect(screen.getByText("模板中没有学生数据，请填写后再导入")).toBeVisible()
    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
