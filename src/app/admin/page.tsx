import Content from "./content"
import { requireAdminPage } from "@/server/auth/page-guards"

export default async function Page() {
  await requireAdminPage()
  return <Content />
}
