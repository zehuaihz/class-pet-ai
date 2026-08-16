import { NextRequest } from "next/server"
import { PetStatus, UserRole } from "@prisma/client"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { createInviteCode } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET() {
  try {
    const teacher = await requireTeacher()
    const classrooms = await prisma.classroom.findMany({
      where: teacher.role === UserRole.ADMIN ? {} : { teacherId: teacher.teacherProfileId },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
    })

    const classroomIds = classrooms.map((classroom) => classroom.id)
    const graduatedRows = classroomIds.length > 0
      ? await prisma.studentPet.findMany({
          where: { status: PetStatus.GRADUATED, student: { classroomId: { in: classroomIds } } },
          select: { student: { select: { classroomId: true } } },
        })
      : []
    const graduatedByClassroom = new Map<string, number>()
    for (const row of graduatedRows) {
      const classroomId = row.student.classroomId
      graduatedByClassroom.set(classroomId, (graduatedByClassroom.get(classroomId) ?? 0) + 1)
    }

    return jsonOk({
      items: classrooms.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        grade: classroom.grade,
        schoolName: classroom.schoolName,
        studentCount: classroom._count.students,
        graduatedPetCount: graduatedByClassroom.get(classroom.id) ?? 0,
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
      },
    })

    return jsonOk(classroom)
  } catch (error) {
    return jsonError(error)
  }
}
