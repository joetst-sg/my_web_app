// Language codes used for translations. 'zh-HK' is the site's Traditional
// Chinese locale (/zh); the text is written to read naturally for both Hong
// Kong and Taiwan readers.
export type TargetLanguage = 'en' | 'zh-HK'

export type TranslationInput = {
  // Original Japanese content (the source of truth).
  title: string
  shortDescription: string | null
  description: string | null
  brand: string | null
  // For consistency: the English product name, when translating to Chinese.
  englishTitle?: string | null
}

export type TranslationOutput = {
  title: string
  shortDescription: string | null
  description: string | null
  seoTitle: string
  seoDescription: string
  imageAlt: string
}

export interface TranslationProvider {
  readonly name: string
  readonly model: string
  translate(input: TranslationInput, target: TargetLanguage): Promise<TranslationOutput>
}

export class TranslationError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message)
  }
}
