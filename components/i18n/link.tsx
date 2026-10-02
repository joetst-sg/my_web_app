'use client'

import NextLink from 'next/link'
import { forwardRef } from 'react'
import { localizePath } from '@/lib/i18n/config'
import { useLocale } from './provider'

// Drop-in replacement for next/link that adds the current language prefix
// to internal links (/products → /zh/products when browsing in Chinese).
const Link = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof NextLink>>(function Link({ href, ...props }, ref) {
  const locale = useLocale()
  const localized = typeof href === 'string' ? localizePath(href, locale) : href
  return <NextLink ref={ref} href={localized} {...props} />
})

export default Link
