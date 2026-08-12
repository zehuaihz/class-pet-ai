import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ClassSwitcher } from "@/components/classrooms/ClassSwitcher"
import {
  CLASSROOM_CHANGE_EVENT,
  LAST_CLASSROOM_STORAGE_KEY,
} from "@/lib/last-classroom"

const classrooms = [
  { id: "class_1", name: "三年级2班" },
  { id: "class_2", name: "四年级1班" },
]

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameValue,
  useRouter: () => ({ push: pushMock }),
}))

let pathnameValue = "/dashboard"
const pushMock = vi.fn()

function lastClassroomChangeHandler() {
  return new Promise<string>((resolve) => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ classroomId: string }>).detail
      window.removeEventListener(CLASSROOM_CHANGE_EVENT, handler)
      resolve(detail.classroomId)
    }
    window.addEventListener(CLASSROOM_CHANGE_EVENT, handler)
  })
}

describe("ClassSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear()
    pushMock.mockClear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("surfaces the persisted class on non-scoped routes", () => {
    pathnameValue = "/dashboard"
    window.localStorage.setItem(LAST_CLASSROOM_STORAGE_KEY, "class_2")

    render(<ClassSwitcher classrooms={classrooms} />)

    expect(screen.getByLabelText("班级切换器")).toHaveValue("class_2")
  })

  it("persists the selection and broadcasts a change event", async () => {
    pathnameValue = "/dashboard"
    const change = lastClassroomChangeHandler()

    render(<ClassSwitcher classrooms={classrooms} />)
    await userEvent.selectOptions(screen.getByLabelText("班级切换器"), "class_2")

    expect(window.localStorage.getItem(LAST_CLASSROOM_STORAGE_KEY)).toBe("class_2")
    expect(await change).toBe("class_2")
  })

  it("stays on the dashboard instead of navigating when switching class", async () => {
    pathnameValue = "/dashboard"

    render(<ClassSwitcher classrooms={classrooms} />)
    await userEvent.selectOptions(screen.getByLabelText("班级切换器"), "class_2")

    expect(pushMock).not.toHaveBeenCalled()
  })

  it("rewrites the URL sub-page on classroom-scoped routes", async () => {
    pathnameValue = "/classrooms/class_1/ai"

    render(<ClassSwitcher classrooms={classrooms} currentClassroomId="class_1" />)
    await userEvent.selectOptions(screen.getByLabelText("班级切换器"), "class_2")

    expect(pushMock).toHaveBeenCalledWith("/classrooms/class_2/ai")
  })

  it("renders nothing when the teacher has no classrooms", () => {
    const { container } = render(<ClassSwitcher classrooms={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
