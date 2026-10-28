import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  assertTeacherOwnsClassroom: vi.fn(),
  studentFindFirst: vi.fn(),
  studentCommentCreate: vi.fn(),
  studentCommentFindMany: vi.fn(),
}))

vi.mock("@/server/auth/session", () => ({
  requireTeacher: routeMocks.requireTeacher,
}))

vi.mock("@/server/services/classroom.service", () => ({
  assertTeacherOwnsClassroom: routeMocks.assertTeacherOwnsClassroom,
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    student: { findFirst: routeMocks.studentFindFirst },
    studentComment: { create: routeMocks.studentCommentCreate, findMany: routeMocks.studentCommentFindMany },
  },
}))

import { GET, POST } from "@/app/api/v1/classrooms/[classroomId]/comments/route"

function makeContext(classroomId = "class_1") {
  return { params: Promise.resolve({ classroomId }) }
}

describe("classroom student comments API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.requireTeacher.mockResolvedValue({ teacherProfileId: "teacher_1" })
    routeMocks.assertTeacherOwnsClassroom.mockResolvedValue(undefined)
  })

  it("saves a teacher-confirmed comment and returns it with the student included", async () => {
    routeMocks.studentFindFirst.mockResolvedValue({ id: "student_1", name: "毛豆" })
    routeMocks.studentCommentCreate.mockResolvedValue({
      id: "comment_1",
      content: "毛豆同学本期表现优秀。",
      tone: "鼓励",
      student: { id: "student_1", name: "毛豆", studentNo: "001" },
    })

    const request = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId: "student_1", content: "毛豆同学本期表现优秀。", tone: "鼓励" }),
    })
    const response = await POST(request as never, makeContext())
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.id).toBe("comment_1")
    expect(payload.data.student.name).toBe("毛豆")
    expect(routeMocks.studentCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classroomId: "class_1",
          studentId: "student_1",
          content: "毛豆同学本期表现优秀。",
          tone: "鼓励",
        }),
      }),
    )
  })

  it("rejects an empty comment body", async () => {
    const request = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId: "student_1", content: "   " }),
    })
    const response = await POST(request as never, makeContext())

    expect(response.status).toBe(422)
    expect(routeMocks.studentCommentCreate).not.toHaveBeenCalled()
  })

  it("returns 404 when the student does not belong to the classroom", async () => {
    routeMocks.studentFindFirst.mockResolvedValue(null)

    const request = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId: "student_other", content: "内容" }),
    })
    const response = await POST(request as never, makeContext())

    expect(response.status).toBe(404)
    expect(routeMocks.studentCommentCreate).not.toHaveBeenCalled()
  })

  it("lists saved comments newest first with optional student filter", async () => {
    routeMocks.studentCommentFindMany.mockResolvedValue([
      { id: "comment_2", content: "第二条", student: { id: "student_1", name: "毛豆", studentNo: null } },
    ])

    const response = await GET(new Request("http://test.local?studentId=student_1") as never, makeContext())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.items).toHaveLength(1)
    expect(routeMocks.studentCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classroomId: "class_1", studentId: "student_1" },
        orderBy: { createdAt: "desc" },
      }),
    )
  })
})
