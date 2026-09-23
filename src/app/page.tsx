import { redirect } from "next/navigation"
import { getCurrentUser } from "@/server/auth/session"
import { landingPathForRole } from "@/lib/role-landing"

export default async function HomePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")
  redirect(landingPathForRole(user.role))
}
