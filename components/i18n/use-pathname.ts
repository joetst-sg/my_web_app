'use client'

import { usePathname as useNextPathname } from 'next/navigation'
import { splitLocale } from '@/lib/i18n/config'

// The current path without the language prefix ("/zh/account" → "/account").
// Use this for active-link checks so they behave the same in every language.
export function usePathname() {
  return splitLocale(useNextPathname() ?? '/').path
}
