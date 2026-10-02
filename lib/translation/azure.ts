import { translateWithMachine } from './machine'
import { TranslationError, type TargetLanguage, type TranslationInput, type TranslationOutput, type TranslationProvider } from './types'

export { latinTerms, textToHtml } from './machine'

// Microsoft Azure AI Translator (Text Translation v3).
const TO: Record<TargetLanguage, string> = { en: 'en', 'zh-HK': 'zh-Hant' }

export class AzureTranslator implements TranslationProvider {
  readonly name = 'azure'
  readonly model = 'translator-v3'

  constructor(
    private readonly apiKey: string,
    private readonly region: string | null,
    private readonly endpoint = 'https://api.cognitive.microsofttranslator.com',
    private readonly timeoutMs = 60_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(texts: string[], target: TargetLanguage): Promise<string[]> {
    const url = `${this.endpoint.replace(/\/$/, '')}/translate?api-version=3.0&from=ja&to=${TO[target]}&textType=html`
    const headers: Record<string, string> = { 'Ocp-Apim-Subscription-Key': this.apiKey, 'Content-Type': 'application/json; charset=UTF-8' }
    if (this.region) headers['Ocp-Apim-Subscription-Region'] = this.region
    let res: Response
    try {
      res = await this.fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(texts.map((Text) => ({ Text }))), signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (e) {
      throw new TranslationError(`Translation request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null
      const code = body?.error?.code
      // 403001 = free-tier quota used up (resets monthly); 429xxx = too many requests.
      const retryable = res.status === 429 || res.status >= 500 || code === 403001
      throw new TranslationError(`Azure Translator ${res.status}${code ? ` (${code})` : ''}: ${body?.error?.message ?? 'request failed'}`, retryable)
    }
    const data = (await res.json()) as { translations?: { text: string }[] }[]
    return data.map((d) => d.translations?.[0]?.text ?? '')
  }

  translate(input: TranslationInput, target: TargetLanguage): Promise<TranslationOutput> {
    // Azure accepts up to 50,000 characters per request; one request per product and language.
    return translateWithMachine(input, target, (html, t) => this.call(html, t), 10_000)
  }
}
