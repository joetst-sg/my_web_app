import type { Locale } from './config'
import { en, type Dictionary } from './dictionaries/en'
import { zhHK } from './dictionaries/zh-HK'

// Register dictionaries here when adding a language.
export const dictionaries: Record<Locale, Dictionary> = {
  en,
  'zh-HK': zhHK,
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en
}

export { en as fallbackDictionary }
