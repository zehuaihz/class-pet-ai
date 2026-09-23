import { NextRequest } from "next/server"
import { requireStudent } from "@/server/auth/session"
import { listStudentCheckins, submitStudentCheckin } from "@/server/services/checkin-record.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    return jsonOk(await listStudentCheckins(user.studentId))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStudent()
    const record = await submitStudentCheckin(user.studentId, await request.json())
    return jsonOk(record)
  } catch (error) {
    return jsonError(error)
  }
}
