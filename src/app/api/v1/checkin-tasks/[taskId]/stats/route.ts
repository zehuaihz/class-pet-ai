import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { getCheckinTaskStats } from "@/server/services/checkin-task.service"

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { taskId } = await context.params
    const stats = await getCheckinTaskStats(teacher.teacherProfileId, taskId)
    return jsonOk(stats)
  } catch (error) {
    return jsonError(error)
  }
}
