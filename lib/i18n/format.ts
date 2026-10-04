import { intlLocale, type Locale } from './config'

// Locale-aware number/date formatting. Prices keep the product's currency.
export function formatters(locale: Locale) {
  const lang = intlLocale[locale]
  const date = (value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
    value ? new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...opts }).format(new Date(value)) : ''
  return {
    price(value: number | string | null | undefined, currency = 'USD') {
      if (value === null || value === undefined || value === '') return null
      const n = typeof value === 'string' ? Number(value) : value
      if (!Number.isFinite(n)) return null
      return new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)
    },
    // Short money amounts for headline figures, e.g. "US$3.4M" / "¥689萬".
    moneyCompact(value: number | string | null | undefined, currency = 'USD') {
      if (value === null || value === undefined || value === '') return null
      const n = typeof value === 'string' ? Number(value) : value
      if (!Number.isFinite(n)) return null
      const out = new Intl.NumberFormat(lang, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n)
      // Next to HK$ amounts, a bare "$" would be ambiguous.
      return currency === 'USD' && out.startsWith('$') ? `US${out}` : out
    },
    date,
    dateTime: (value: string | Date | null | undefined) => date(value, { dateStyle: 'medium', timeStyle: 'short' }),
    timeAgo(value: string | Date | null | undefined) {
      if (!value) return ''
      const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
      const abs = Math.abs(seconds)
      if (abs < 60) return rtf.format(-seconds, 'second')
      if (abs < 3600) return rtf.format(-Math.round(seconds / 60), 'minute')
      if (abs < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour')
      if (abs < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), 'day')
      return date(value)
    },
    compact: (n: number | null | undefined) => new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0),
    number: (n: number | null | undefined) => new Intl.NumberFormat(lang).format(n ?? 0),
  }
}

export type Formatters = ReturnType<typeof formatters>
