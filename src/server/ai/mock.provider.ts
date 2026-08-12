import type { AiProvider, CommentContext, ProviderResult } from "@/server/ai/ai-provider"

export class MockAiProvider implements AiProvider {
  constructor(private readonly modelName = "mock-model") {}

  async generateCommentDraft(context: CommentContext): Promise<ProviderResult> {
    const text = `${context.studentName}同学本期获得 ${context.totalPoints} 分，成长值 ${context.recentGrowth}。${context.notes ? `教师备注：${context.notes}。` : ""}建议继续保持良好表现。`
    return {
      text,
      provider: "mock",
      modelName: this.modelName,
      latencyMs: 0,
    }
  }
}
