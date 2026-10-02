import { AnthropicTranslator } from './anthropic'
import type { TranslationProvider } from './types'

export function translationConfig() {
  const retries = Number(process.env.TRANSLATION_MAX_RETRIES)
  return {
    provider: (process.env.TRANSLATION_PROVIDER || 'anthropic').trim().toLowerCase(),
    apiKey: process.env.TRANSLATION_API_KEY || null,
    model: (process.env.TRANSLATION_MODEL || 'claude-sonnet-5-5').trim(),
    maxRetries: Number.isInteger(retries) && retries >= 1 && retries <= 10 ? retries : 3,
    jobsPerRun: Math.min(Math.max(Number(process.env.TRANSLATION_JOBS_PER_RUN) || 2, 1), 10),
  }
}

// The configured provider, or null when no API key is set (jobs then wait
// in the queue without using up their retries).
export function createTranslator(): TranslationProvider | null {
  const c = translationConfig()
  if (!c.apiKey) return null
  switch (c.provider) {
    case 'anthropic':
      return new AnthropicTranslator(c.apiKey, c.model)
    default:
      throw new Error(`Unknown TRANSLATION_PROVIDER "${c.provider}". Available: anthropic.`)
  }
}
