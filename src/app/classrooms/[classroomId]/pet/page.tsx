import { redirect } from "next/navigation"
import { requireTeacherClassroomPage } from "@/server/auth/page-guards"

// 旧"班级宠物"入口兼容：整体替换为 zoo 体系后，旧链接/收藏夹仍重定向到动物园。
export default async function PetPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params
  await requireTeacherClassroomPage(classroomId)
  redirect(`/classrooms/${classroomId}/zoo`)
}
