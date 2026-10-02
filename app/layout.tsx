import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/components/i18n/provider'
import { cn } from '@/lib/utils'
import { site } from '@/lib/site'
import { htmlLang, ogLocale, locales } from '@/lib/i18n/config'
import { getI18n } from '@/lib/i18n/server'
import './globals.css'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n()
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name} — ${t('site.tagline')}`, template: `%s · ${site.name}` },
    description: t('site.description'),
    applicationName: site.name,
    openGraph: {
      type: 'website',
      siteName: site.name,
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
    },
    twitter: { card: 'summary_large_image' },
    alternates: { types: { 'application/rss+xml': `${site.url}/feed.xml` } },
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getI18n()
  return (
    <html lang={htmlLang[locale]} className={cn(display.variable, sans.variable, mono.variable)}>
      <body className="min-h-dvh bg-background">
        <I18nProvider locale={locale} messages={dict}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </I18nProvider>
      </body>
    </html>
  )
}
