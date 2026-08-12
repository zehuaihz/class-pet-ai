import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { reversePointTransaction } from "@/server/services/point-transaction.service"

export async function POST(request: NextRequest, context: { params: Promise<{ transactionId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { transactionId } = await context.params
    const body = await request.json()
    const reversed = await reversePointTransaction(teacher.teacherProfileId, transactionId, String(body.reason ?? "录入错误"))
    return jsonOk(reversed)
  } catch (error) {
    return jsonError(error)
  }
}
