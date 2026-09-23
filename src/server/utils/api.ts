import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
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

  // Log only the error shape: Prisma messages embed field values (which can be
  // an email or phone number) in their metadata.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[api] prisma ${error.code} ${error.name}`)
  } else if (error instanceof Error) {
    console.error(`[api] ${error.name}: ${error.message}`)
  } else {
    console.error("[api] unknown error")
  }

  return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error"), {
    status: 500,
  })
}
