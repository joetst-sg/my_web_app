import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect as nextRedirect } from 'next/navigation'
import { defaultLocale, htmlLang, isLocale, LOCALE_HEADER, localePrefix, locales, localizePath, type Locale } from './config'
import { fallbackDictionary, getDictionary } from './dictionaries'
import { formatters } from './format'
import { createTranslator } from './translate'

// The locale of the current request, set by the proxy from the URL prefix.
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await headers()).get(LOCALE_HEADER)
  return isLocale(value) ? value : defaultLocale
})

export const getT = cache(async () => {
  const locale = await getLocale()
  return createTranslator(locale, getDictionary(locale), fallbackDictionary)
})

export const getI18n = cache(async () => {
  const locale = await getLocale()
  return { locale, t: await getT(), f: formatters(locale), dict: getDictionary(locale) }
})

// Same as next/navigation redirect, keeping the current language.
export async function redirect(path: string): Promise<never> {
  return nextRedirect(localizePath(path, await getLocale()))
}

// Canonical + hreflang alternates for a page path (without locale prefix).
export async function alternatesFor(path: string) {
  const locale = await getLocale()
  const languages: Record<string, string> = {}
  for (const l of locales) languages[htmlLang[l]] = `${localePrefix[l]}${path === '/' && localePrefix[l] ? '' : path}` || '/'
  languages['x-default'] = path
  return { canonical: localizePath(path, locale), languages }
}
