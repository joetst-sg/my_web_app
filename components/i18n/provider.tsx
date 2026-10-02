'use client'

import { createContext, useContext, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { localizePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { formatters } from '@/lib/i18n/format'
import { createTranslator, type Translate } from '@/lib/i18n/translate'

type Ctx = { locale: Locale; t: Translate; messages: Dictionary }
const I18nContext = createContext<Ctx | null>(null)

// Receives only the current locale's dictionary from the root layout.
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Dictionary; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, messages, t: createTranslator(locale, messages, messages) }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}

export const useT = () => useI18n().t
export const useLocale = () => useI18n().locale
export const useMessages = () => useI18n().messages
export function useFormatters() {
  const locale = useLocale()
  return useMemo(() => formatters(locale), [locale])
}

// router.push/replace that keep the current language.
export function useLocalizedRouter() {
  const router = useRouter()
  const locale = useLocale()
  return useMemo(
    () => ({
      ...router,
      push: (href: string, opts?: Parameters<typeof router.push>[1]) => router.push(localizePath(href, locale), opts),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) => router.replace(localizePath(href, locale), opts),
    }),
    [router, locale],
  )
}
