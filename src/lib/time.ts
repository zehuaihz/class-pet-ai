export const APP_TIME_ZONE = "Asia/Shanghai"
const APP_TIME_ZONE_OFFSET_MINUTES = 8 * 60

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIME_ZONE,
})

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
})

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIME_ZONE,
})

interface DateParts {
  year: string
  month: string
  day: string
}

interface DateTimeParts extends DateParts {
  hour: string
  minute: string
}

function getDateParts(value: Date): DateParts {
  const parts = dateFormatter.formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  if (!year || !month || !day) {
    throw new Error("Failed to resolve app date parts")
  }
  return { year, month, day }
}

function getDateTimeParts(value: Date): DateTimeParts {
  const parts = dateTimeFormatter.formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  const hour = parts.find((part) => part.type === "hour")?.value ?? ""
  const minute = parts.find((part) => part.type === "minute")?.value ?? ""
  if (!year || !month || !day || !hour || !minute) {
    throw new Error("Failed to resolve app date-time parts")
  }
  return { year, month, day, hour, minute }
}

export function formatAppTime(value: string | number | Date): string {
  return timeFormatter.format(new Date(value))
}

export function formatAppDateTime(value: string | number | Date): string {
  const { year, month, day, hour, minute } = getDateTimeParts(new Date(value))
  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function startOfAppDay(value: string | number | Date = new Date()): Date {
  const { year, month, day } = getDateParts(new Date(value))
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)) - APP_TIME_ZONE_OFFSET_MINUTES * 60_000)
}

export function parseAppDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("Invalid app date input")
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return new Date(Date.UTC(year, month - 1, day) - APP_TIME_ZONE_OFFSET_MINUTES * 60_000)
}
