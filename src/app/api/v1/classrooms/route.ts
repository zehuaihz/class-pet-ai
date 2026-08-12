import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { createInviteCode } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET() {
  try {
    const teacher = await requireTeacher()
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: teacher.teacherProfileId },
      include: { _count: { select: { students: true } }, pet: true },
      orderBy: { createdAt: "desc" },
    })

    return jsonOk({
      items: classrooms.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        grade: classroom.grade,
        schoolName: classroom.schoolName,
        studentCount: classroom._count.students,
        petLevel: classroom.pet?.level ?? 1,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireTeacher()
    const body = await request.json()
    const name = String(body.name ?? "").trim()

    if (!name) throw new AppError("VALIDATION_ERROR", "classroom name required", 422)

    const classroom = await prisma.classroom.create({
      data: {
        teacherId: teacher.teacherProfileId,
        name,
        grade: body.grade ?? null,
        schoolName: body.schoolName ?? null,
        inviteCode: createInviteCode(),
        pet: { create: { name: "云朵龙", species: "dragon" } },
      },
    })

    return jsonOk(classroom)
  } catch (error) {
    return jsonError(error)
  }
}
