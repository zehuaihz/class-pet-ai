import Content from "./content"
import { requireTeacherPage } from "@/server/auth/page-guards"

export default async function Page() {
  await requireTeacherPage()
  return <Content />
}
