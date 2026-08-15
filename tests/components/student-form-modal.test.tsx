import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StudentFormModal } from "@/components/students/StudentFormModal"

const apiRequestMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiRequest: apiRequestMock }
})

const species = [
  { key: "cat-orange", name: "橘猫" },
  { key: "dog-golden", name: "金毛" },
]

function mockApi() {
  apiRequestMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith("/pet-species")) return { items: species }
    return { id: "student_new", classroomId: "classroom_1", name: "小明" }
  })
}

describe("StudentFormModal", () => {
  beforeEach(() => {
    mockApi()
  })

  it("renders available pet species in create mode and submits the selection", async () => {
    const user = userEvent.setup()
    render(<StudentFormModal open classroomId="classroom_1" editingStudent={null} onClose={() => undefined} onSaved={() => undefined} />)

    expect(await screen.findByText("橘猫")).toBeVisible()
    expect(screen.getByText("金毛")).toBeVisible()
    expect(screen.getByText("不分配宠物")).toBeVisible()

    await user.click(screen.getByRole("button", { name: /橘猫/ }))
    await user.type(screen.getByLabelText("姓名"), "小明")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/v1/classrooms/classroom_1/students",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "小明", studentNo: null, petSpeciesKey: "cat-orange" }),
        }),
      )
    })
  })

  it("submits without a pet species when the species list is empty", async () => {
    apiRequestMock.mockResolvedValue({ items: [] })
    const user = userEvent.setup()
    render(<StudentFormModal open classroomId="classroom_1" editingStudent={null} onClose={() => undefined} onSaved={() => undefined} />)

    expect(await screen.findByText("暂无可选宠物品种，学生将不分配宠物")).toBeVisible()

    await user.type(screen.getByLabelText("姓名"), "小明")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/v1/classrooms/classroom_1/students",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "小明", studentNo: null, petSpeciesKey: null }),
        }),
      )
    })
  })

  it("hides the pet section in edit mode and updates via PATCH without a pet species", async () => {
    const user = userEvent.setup()
    render(
      <StudentFormModal
        open
        classroomId="classroom_1"
        editingStudent={{ id: "s_1", name: "小明", studentNo: "001" }}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    )

    expect(screen.queryByText("分配宠物（可选）")).toBeNull()
    expect(apiRequestMock).not.toHaveBeenCalled()

    const nameInput = screen.getByLabelText("姓名")
    expect(nameInput).toHaveValue("小明")
    await user.clear(nameInput)
    await user.type(nameInput, "小明改")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/v1/students/s_1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "小明改", studentNo: "001" }),
        }),
      )
    })
  })
})
