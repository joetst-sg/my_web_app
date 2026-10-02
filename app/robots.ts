import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'
import { localePrefix, locales } from '@/lib/i18n/config'

const PRIVATE = ['/account', '/seller', '/onboarding', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/search']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private pages in every language, plus routes that only exist unprefixed.
        disallow: [...locales.flatMap((l) => PRIVATE.map((p) => `${localePrefix[l]}${p}`)), '/admin', '/api', '/go/', '/auth'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}
