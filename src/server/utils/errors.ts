export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public status = statusFromCode(code),
    public details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export function statusFromCode(code: AppErrorCode) {
  switch (code) {
    case "UNAUTHORIZED":
      return 401
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "VALIDATION_ERROR":
      return 422
    case "CONFLICT":
      return 409
    default:
      return 500
  }
}
