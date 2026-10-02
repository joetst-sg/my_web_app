'use client'

import Link from '@/components/i18n/link'
import { usePathname } from '@/components/i18n/use-pathname'
import { Bell, Bookmark, BellRing, FolderHeart, Heart, LayoutGrid, Lock, Rss, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n/provider'

const items = [
  ['/account', 'account.nav.overview', LayoutGrid],
  ['/account/feed', 'account.nav.feed', Rss],
  ['/account/saved', 'account.nav.saved', Bookmark],
  ['/account/collections', 'account.nav.collections', FolderHeart],
  ['/account/following', 'account.nav.following', Heart],
  ['/account/reminders', 'account.nav.reminders', BellRing],
  ['/account/notifications', 'account.nav.notifications', Bell],
  ['/account/profile', 'account.nav.profile', User],
  ['/account/preferences', 'account.nav.preferences', Settings],
  ['/account/security', 'account.nav.security', Lock],
] as const

export function AccountNav() {
  const pathname = usePathname()
  const t = useT()
  return (
    <nav aria-label={t('account.nav.label')} className="lg:w-56 lg:shrink-0">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:px-0 lg:sticky lg:top-24">
        {items.map(([href, label, Icon]) => {
          const active = href === '/account' ? pathname === href : pathname.startsWith(href)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
