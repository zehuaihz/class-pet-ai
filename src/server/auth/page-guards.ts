import { redirect } from "next/navigation"
import { UserRole } from "@prisma/client"
import { getCurrentUser, type CurrentUser } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"

const LOGIN_PATH = "/auth/login"
const FORBIDDEN_PATH = "/forbidden"

/**
 * Server-side authorization boundary for App Router pages. Client navigation
 * filtering in AppShell is a UX affordance only and must never be relied on.
 */
export async function requireRolePage(allowed: UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(LOGIN_PATH)
  if (!allowed.includes(user.role)) redirect(FORBIDDEN_PATH)
  return user
}

export async function requireTeacherPage() {
  const user = await requireRolePage([UserRole.TEACHER])
  if (!user.teacherProfileId) redirect(FORBIDDEN_PATH)
  return user as CurrentUser & { teacherProfileId: string }
}

export async function requireStudentPage() {
  const user = await requireRolePage([UserRole.STUDENT])
  if (!user.studentId) redirect(FORBIDDEN_PATH)
  return user as CurrentUser & { studentId: string }
}

export async function requireParentPage() {
  const user = await requireRolePage([UserRole.PARENT])
  return user as CurrentUser & { childStudentIds: string[] }
}

export async function requireAdminPage() {
  return requireRolePage([UserRole.ADMIN])
}

/**
 * Teacher page guard plus classroom ownership, so a teacher cannot reach
 * another teacher's classroom pages by editing the URL.
 */
export async function requireTeacherClassroomPage(classroomId: string) {
  const user = await requireTeacherPage()
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: user.teacherProfileId },
    select: { id: true },
  })
  if (!classroom) redirect(FORBIDDEN_PATH)
  return { user, classroomId: classroom.id }
}
