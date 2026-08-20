import { render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/layout/AppShell"

let pathnameValue = "/classrooms/class_1/settings"
const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameValue,
  useRouter: () => ({ push: pushMock }),
}))

function mockFetch(role: "ADMIN" | "TEACHER", classrooms = [{ id: "class_1", name: "三年级2班" }]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === "/api/v1/classrooms") {
        return Response.json({ data: { items: classrooms } })
      }
      if (url === "/api/v1/system-settings") {
        return Response.json({ data: { name: "班级动物园" } })
      }
      if (url === "/api/v1/me") {
        return Response.json({ data: { role } })
      }
      return new Response(null, { status: 404 })
    }),
  )
}

describe("AppShell settings navigation", () => {
  beforeEach(() => {
    pathnameValue = "/classrooms/class_1/settings"
    pushMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows data ledger, class screen, and user management as settings second-level menu items for admins", async () => {
    mockFetch("ADMIN")

    render(<AppShell>内容</AppShell>)

    const submenus = await screen.findAllByLabelText("设置二级菜单")
    expect(submenus).toHaveLength(2)
    const submenu = submenus[0]
    expect(within(submenu).getByRole("link", { name: "数据台账" })).toHaveAttribute("href", "/classrooms/class_1/audit")
    expect(within(submenu).getByRole("link", { name: "班级大屏" })).toHaveAttribute("href", "/classrooms/class_1/screen")
    expect(within(submenu).getByRole("link", { name: "用户管理" })).toHaveAttribute("href", "/admin")
    expect(screen.getAllByRole("link", { name: "设置" })[0]).toHaveAttribute("href", "/classrooms/class_1/settings")
  })

  it("hides user management from non-admin settings second-level menu", async () => {
    mockFetch("TEACHER")

    render(<AppShell>内容</AppShell>)

    const submenus = await screen.findAllByLabelText("设置二级菜单")
    expect(submenus).toHaveLength(2)
    const submenu = submenus[0]
    expect(within(submenu).getByRole("link", { name: "数据台账" })).toBeVisible()
    expect(within(submenu).getByRole("link", { name: "班级大屏" })).toBeVisible()
    await waitFor(() => expect(within(submenu).queryByRole("link", { name: "用户管理" })).not.toBeInTheDocument())
  })

  it("keeps user management reachable for admins without a current classroom", async () => {
    pathnameValue = "/dashboard"
    mockFetch("ADMIN", [])

    render(<AppShell>内容</AppShell>)

    await waitFor(() => expect(screen.getAllByRole("link", { name: "用户管理" })[0]).toHaveAttribute("href", "/admin"))
    expect(screen.queryByLabelText("设置二级菜单")).not.toBeInTheDocument()
  })
})
