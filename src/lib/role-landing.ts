/**
 * Single source of truth for where each role lands after login, so the login
 * page and the role guards cannot drift apart.
 */
export function landingPathForRole(role: string | null | undefined): string {
  switch (role) {
    case "STUDENT":
      return "/student"
    case "PARENT":
      return "/parent"
    case "ADMIN":
      return "/admin"
    default:
      return "/dashboard"
  }
}
