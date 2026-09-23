import { NextRequest } from "next/server"
import { PointTransactionSource } from "@prisma/client"
import { requireTeacher } from "@/server/auth/session"
import { createPointTransaction } from "@/server/services/point-transaction.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireTeacher()
    const body = await request.json()
    const classroomId = String(body.classroomId ?? "")
    const delta = Number(body.delta)
    const reason = String(body.reason ?? "").trim()

    if (!classroomId || !Number.isInteger(delta) || !reason || Math.abs(delta) > 1000) {
      throw new AppError("VALIDATION_ERROR", "classroomId, integer delta within range, and reason required", 422)
    }

    const result = await createPointTransaction({
      actorTeacherId: teacher.teacherProfileId,
      classroomId,
      studentId: body.studentId ?? null,
      groupId: body.groupId ?? null,
      ruleId: body.ruleId ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
      syncPetGrowth: body.syncPetGrowth !== false,
      delta,
      reason,
      source: body.source && body.source in PointTransactionSource ? body.source : "MANUAL",
      meta: body.meta,
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
