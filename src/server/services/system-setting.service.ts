import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"

export const SYSTEM_NAME_KEY = "systemName"
export const DEFAULT_SYSTEM_NAME = "班级动物园"

export async function getSystemName(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: SYSTEM_NAME_KEY } })
  return setting?.value ?? DEFAULT_SYSTEM_NAME
}

export async function setSystemName(value: string): Promise<string> {
  const name = value.trim()
  if (!name) throw new AppError("VALIDATION_ERROR", "name required", 422)
  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_NAME_KEY },
    update: { value: name },
    create: { key: SYSTEM_NAME_KEY, value: name },
  })
  return getSystemName()
}
