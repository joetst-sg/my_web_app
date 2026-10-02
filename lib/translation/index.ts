import { AnthropicTranslator } from './anthropic'
import { AzureTranslator } from './azure'
import { GoogleTranslator } from './google'
import type { TranslationProvider } from './types'

export function translationConfig() {
  const retries = Number(process.env.TRANSLATION_MAX_RETRIES)
  const provider = (process.env.TRANSLATION_PROVIDER || 'anthropic').trim().toLowerCase()
  return {
    provider,
    apiKey: process.env.TRANSLATION_API_KEY || null,
    model: provider === 'azure' ? 'translator-v3' : provider === 'google' ? 'translate-v2' : (process.env.TRANSLATION_MODEL || 'claude-sonnet-5-5').trim(),
    // Azure: the resource's region (e.g. eastasia); required for regional resources.
    azureRegion: process.env.AZURE_TRANSLATOR_REGION?.trim() || null,
    azureEndpoint: process.env.AZURE_TRANSLATOR_ENDPOINT?.trim() || 'https://api.cognitive.microsofttranslator.com',
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
    case 'azure':
      return new AzureTranslator(c.apiKey, c.azureRegion, c.azureEndpoint)
    case 'google':
      return new GoogleTranslator(c.apiKey)
    default:
      throw new Error(`Unknown TRANSLATION_PROVIDER "${c.provider}". Available: google, azure, anthropic.`)
  }
}
