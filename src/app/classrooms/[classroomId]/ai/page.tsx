import Content from "./content"
import { requireTeacherClassroomPage } from "@/server/auth/page-guards"

export default async function Page({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params
  await requireTeacherClassroomPage(classroomId)
  return <Content />
}
