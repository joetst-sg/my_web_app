import { GeminiProvider } from './gemini'
import type { AIProvider } from './types'

// AI used to write product summaries and translations. Not configured →
// null (Green Funding falls back to machine translation of its Japanese
// summary; Indiegogo imports wait until an AI provider is set).
export function aiConfig() {
  return {
    provider: (process.env.AI_PROVIDER || '').trim().toLowerCase(),
    apiKey: process.env.AI_API_KEY || null,
    model: (process.env.AI_MODEL || 'gemini-3.8-flash').trim(),
    maxWordRetries: 2,
  }
}

export function createAIProvider(): AIProvider | null {
  const c = aiConfig()
  if (!c.provider || !c.apiKey) return null
  switch (c.provider) {
    case 'gemini':
      return new GeminiProvider(c.apiKey, c.model)
    default:
      throw new Error(`Unknown AI_PROVIDER "${c.provider}". Available: gemini.`)
  }
}
