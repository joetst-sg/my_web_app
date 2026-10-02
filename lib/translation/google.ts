import { translateWithMachine } from './machine'
import { TranslationError, type TargetLanguage, type TranslationInput, type TranslationOutput, type TranslationProvider } from './types'

// Google Cloud Translation – Basic (v2) with an API key.
// zh-TW is Google's code for Traditional Chinese.
const TO: Record<TargetLanguage, string> = { en: 'en', 'zh-HK': 'zh-TW' }

// Google recommends at most ~5,000 characters per request; text is chunked
// and sent in several small requests.
const MAX_CHUNK = 4500
const MAX_REQUEST_CHARS = 5000

export class GoogleTranslator implements TranslationProvider {
  readonly name = 'google'
  readonly model = 'translate-v2'

  constructor(
    private readonly apiKey: string,
    private readonly endpoint = 'https://translation.googleapis.com/language/translate/v2',
    private readonly timeoutMs = 60_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(q: string[], target: TargetLanguage): Promise<string[]> {
    let res: Response
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        // The key goes in a header, not the URL, so it never appears in logs.
        headers: { 'X-Goog-Api-Key': this.apiKey, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ q, source: 'ja', target: TO[target], format: 'html' }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (e) {
      throw new TranslationError(`Translation request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string; errors?: { reason?: string }[] } } | null
      const reason = body?.error?.errors?.[0]?.reason ?? ''
      // Quota/rate limits clear by themselves; a bad key, disabled API or billing problem doesn't.
      const quota = res.status === 429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded|RESOURCE_EXHAUSTED/.test(reason + (body?.error?.message ?? ''))
      const retryable = quota || res.status >= 500
      throw new TranslationError(`Google Cloud Translation ${res.status}${reason ? ` (${reason})` : ''}: ${body?.error?.message ?? 'request failed'}`, retryable, quota)
    }
    const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
    const out = data.data?.translations?.map((t) => t.translatedText) ?? []
    if (out.length !== q.length) throw new TranslationError('Google Cloud Translation returned an unexpected response.')
    return out
  }

  private async call(texts: string[], target: TargetLanguage): Promise<string[]> {
    // Batch strings into requests of at most MAX_REQUEST_CHARS characters, in order.
    const results: string[] = []
    let batch: string[] = []
    let size = 0
    const flush = async () => {
      if (batch.length) results.push(...(await this.request(batch, target)))
      batch = []
      size = 0
    }
    for (const text of texts) {
      if (batch.length && size + text.length > MAX_REQUEST_CHARS) await flush()
      batch.push(text)
      size += text.length
    }
    await flush()
    return results
  }

  translate(input: TranslationInput, target: TargetLanguage): Promise<TranslationOutput> {
    // Google leaves Latin-script names alone by itself; extra no-translate
    // markup made it repeat or garble names, so it isn't used here.
    return translateWithMachine(input, target, (html, t) => this.call(html, t), MAX_CHUNK, false)
  }
}
