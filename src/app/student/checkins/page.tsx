import Content from "./content"
import { requireStudentPage } from "@/server/auth/page-guards"

export default async function Page() {
  await requireStudentPage()
  return <Content />
}
