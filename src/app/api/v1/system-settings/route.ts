import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { getSystemName, setSystemName } from "@/server/services/system-setting.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    await requireTeacher()
    return jsonOk({ name: await getSystemName() })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireTeacher()
    const body = await request.json()
    return jsonOk({ name: await setSystemName(String(body.name ?? "")) })
  } catch (error) {
    return jsonError(error)
  }
}
