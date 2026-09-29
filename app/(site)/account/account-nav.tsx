'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Bookmark, BellRing, FolderHeart, Heart, LayoutGrid, Lock, Rss, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  ['/account', 'Overview', LayoutGrid],
  ['/account/feed', 'Your feed', Rss],
  ['/account/saved', 'Saved', Bookmark],
  ['/account/collections', 'Collections', FolderHeart],
  ['/account/following', 'Following', Heart],
  ['/account/reminders', 'Reminders', BellRing],
  ['/account/notifications', 'Notifications', Bell],
  ['/account/profile', 'Profile', User],
  ['/account/preferences', 'Preferences', Settings],
  ['/account/security', 'Security', Lock],
] as const

export function AccountNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Account" className="lg:w-56 lg:shrink-0">
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
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
