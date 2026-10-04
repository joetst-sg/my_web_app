'use client'

import { Bookmark, LogOut, Rss, Settings, Shield, Store, User } from 'lucide-react'
import Link from '@/components/i18n/link'
import { useT } from '@/components/i18n/provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/actions/auth'
import { initials } from '@/lib/images'

export type MenuViewer = {
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  username: string | null
  isSeller: boolean
  isStaff: boolean
}

export function UserMenu({ viewer }: { viewer: MenuViewer }) {
  const t = useT()
  const name = viewer.displayName || viewer.username || viewer.email || t('nav.account')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label={t('nav.openAccountMenu')}>
        <Avatar className="size-9">
          {viewer.avatarUrl && <AvatarImage src={viewer.avatarUrl} alt="" />}
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{name}</span>
          {viewer.email && <span className="block truncate text-xs text-muted-foreground">{viewer.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link href="/account/feed"><Rss />{t('account.nav.feed')}</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account/saved"><Bookmark />{t('account.nav.saved')}</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account"><User />{t('nav.account')}</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account/preferences"><Settings />{t('nav.settings')}</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {viewer.isSeller ? (
            <DropdownMenuItem asChild><Link href="/seller/dashboard"><Store />{t('nav.sellerDashboard')}</Link></DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild><Link href="/seller"><Store />{t('nav.sellOnLoupe')}</Link></DropdownMenuItem>
          )}
          {viewer.isStaff && (
            // The admin area is English-only: a full page load switches language cleanly.
            <DropdownMenuItem asChild><a href="/admin/dashboard"><Shield />{t('nav.admin')}</a></DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut />{t('nav.logout')}</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
