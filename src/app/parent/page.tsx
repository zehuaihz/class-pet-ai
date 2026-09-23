import Content from "./content"
import { requireParentPage } from "@/server/auth/page-guards"

export default async function Page() {
  await requireParentPage()
  return <Content />
}
