'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { htmlLang, localeLabel, locales, splitLocale } from '@/lib/i18n/config'
import { useLocale, useT } from './provider'

// "EN | 中文" switcher. Plain links (full page load) to the same page in the
// other language; the proxy stores the choice in a cookie.
export function LanguageSwitcher({ className, variant = 'compact' }: { className?: string; variant?: 'compact' | 'full' }) {
  const t = useT()
  const current = useLocale()
  const pathname = usePathname() ?? '/'
  const search = useSearchParams()
  const { path } = splitLocale(pathname)

  function hrefFor(locale: string) {
    const params = new URLSearchParams(search)
    params.set('set-lang', locale)
    return `${path}?${params}`
  }

  return (
    <nav aria-label={t('lang.switch')} className={cn('flex items-center', className)}>
      {variant === 'compact' && <Languages className="mr-1 size-4 text-muted-foreground" aria-hidden />}
      <ul className="flex items-center rounded-full border p-0.5 text-xs font-semibold">
        {locales.map((locale) => {
          const active = locale === current
          return (
            <li key={locale}>
              <a
                href={hrefFor(locale)}
                hrefLang={htmlLang[locale]}
                lang={htmlLang[locale]}
                aria-current={active ? 'true' : undefined}
                aria-label={active ? t('lang.current', { name: localeLabel[locale].long }) : t('lang.switchTo', { name: localeLabel[locale].long })}
                className={cn(
                  'block rounded-full px-2.5 py-1.5 transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {variant === 'full' ? localeLabel[locale].long : localeLabel[locale].short}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
