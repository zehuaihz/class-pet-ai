export function buildSafeAiContext(input: Record<string, unknown>) {
  const allowedKeys = ["studentId", "classroomId", "tone", "pointsTrend", "checkinRate", "teacherNote", "timeRange", "subject", "goal", "difficulty", "durationMinutes"]
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowedKeys.includes(key)))
}
