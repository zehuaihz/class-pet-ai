import { NextResponse } from "next/server"
import { AppError } from "./errors"
import { fail, ok } from "./response-envelope"

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(ok(data), init)
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(fail(error.code, error.message, error.details), {
      status: error.status,
    })
  }

  console.error(error)
  return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error"), {
    status: 500,
  })
}
