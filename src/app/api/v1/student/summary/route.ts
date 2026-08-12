import { BadgeStatus, PetStatus } from "@prisma/client"
import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { getClassroomThresholds } from "@/server/services/pet-level-config.service"
import { buildStudentPetView } from "@/server/services/student-pet.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      include: {
        classroom: { select: { id: true, name: true } },
        group: { select: { name: true } },
        studentPets: {
          where: { status: PetStatus.GROWING },
          include: { species: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    if (!student) return jsonOk({ student: null })

    const [thresholds, availableBadges] = await Promise.all([
      getClassroomThresholds(student.classroom.id),
      prisma.badge.count({ where: { studentId: student.id, status: BadgeStatus.AVAILABLE } }),
    ])
    const pet = student.studentPets[0] ?? null

    return jsonOk({
      student: {
        id: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
        group: student.group?.name ?? null,
        classroom: { id: student.classroom.id, name: student.classroom.name },
        availableBadges,
        pet: pet ? buildStudentPetView(pet, thresholds) : null,
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
