import { redirect } from "next/navigation"

export default async function PetPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params
  redirect(`/classrooms/${classroomId}/zoo`)
}
