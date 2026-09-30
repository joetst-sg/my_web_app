import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/seller', '/admin', '/api', '/go/', '/onboarding', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/auth', '/search'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}
