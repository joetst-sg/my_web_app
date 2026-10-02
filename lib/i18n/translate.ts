import type { Locale } from './config'
import type { Dictionary } from './dictionaries/en'

// Dot-separated keys of the dictionary, e.g. "nav.discover".
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Dictionary>
export type Vars = Record<string, string | number | null | undefined>
export type Translate = (key: MessageKey, vars?: Vars) => string

function lookup(dict: unknown, key: string): string | undefined {
  let node = dict as Record<string, unknown> | undefined
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = node[part] as Record<string, unknown> | undefined
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(text: string, vars?: Vars) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name]
    return v === undefined || v === null ? match : String(v)
  })
}

// Translator with English fallback: a missing key in a locale shows the
// English text (and warns in development) instead of "undefined".
export function createTranslator(locale: Locale, messages: unknown, fallback: unknown): Translate {
  return (key, vars) => {
    let text = lookup(messages, key)
    if (text === undefined) {
      text = lookup(fallback, key)
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing "${key}" for ${locale}`)
    }
    if (text === undefined) return key.split('.').pop() ?? key
    return interpolate(text, vars)
  }
}

// Looks up a key that is only known at runtime (e.g. an enum value).
export function hasMessage(messages: unknown, key: string) {
  return lookup(messages, key) !== undefined
}
