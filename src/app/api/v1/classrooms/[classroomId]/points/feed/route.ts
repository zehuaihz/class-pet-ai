import { NextRequest } from "next/server"
import { PointTransactionSource } from "@prisma/client"
import { requireTeacher } from "@/server/auth/session"
import { createBatchPointTransaction } from "@/server/services/point-transaction.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const body = await request.json()

    const delta = Number(body.delta)
    const reason = String(body.reason ?? "").trim()
    if (!Number.isFinite(delta) || delta === 0 || !reason) {
      throw new AppError("VALIDATION_ERROR", "delta (non-zero) and reason required", 422)
    }

    const result = await createBatchPointTransaction({
      actorTeacherId: teacher.teacherProfileId,
      classroomId,
      studentIds: body.studentIds,
      allStudents: body.allStudents === true,
      ruleId: body.ruleId ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
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
