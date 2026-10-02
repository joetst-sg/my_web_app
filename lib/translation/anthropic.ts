import { normalizeOutput, systemPrompt, TOOL, userPrompt } from './prompt'
import { TranslationError, type TargetLanguage, type TranslationInput, type TranslationOutput, type TranslationProvider } from './types'

// Anthropic Messages API over plain fetch (no SDK dependency). The model must
// answer through the save_translation tool, so the output is always JSON.
export class AnthropicTranslator implements TranslationProvider {
  readonly name = 'anthropic'

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs = 120_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async translate(input: TranslationInput, target: TargetLanguage): Promise<TranslationOutput> {
    let res: Response
    try {
      res = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8000,
          system: systemPrompt(target),
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{ role: 'user', content: userPrompt(input) }],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (e) {
      throw new TranslationError(`Translation request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // 400/401/403/404 won't succeed on retry (bad key, model or request).
      const retryable = res.status === 429 || res.status >= 500
      throw new TranslationError(`Anthropic API ${res.status}: ${body.slice(0, 300)}`, retryable)
    }
    const data = (await res.json()) as { content?: { type: string; name?: string; input?: Record<string, unknown> }[]; stop_reason?: string }
    const call = data.content?.find((c) => c.type === 'tool_use' && c.name === TOOL.name)
    if (!call?.input) throw new TranslationError(`No translation returned (stop reason: ${data.stop_reason ?? 'unknown'}).`)
    try {
      return normalizeOutput(call.input)
    } catch (e) {
      throw new TranslationError(e instanceof Error ? e.message : 'Invalid translation output.')
    }
  }
}
