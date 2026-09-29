'use client'

import Link from 'next/link'
import { Bookmark, FolderHeart, LogOut, Rss, Settings, Shield, Store, User } from 'lucide-react'
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
  const name = viewer.displayName || viewer.username || viewer.email || 'Account'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Open account menu">
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
          <DropdownMenuItem asChild><Link href="/account/feed"><Rss />Your feed</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account/saved"><Bookmark />Saved products</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account/collections"><FolderHeart />Collections</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account"><User />Account</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account/preferences"><Settings />Settings</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {viewer.isSeller ? (
            <DropdownMenuItem asChild><Link href="/seller/dashboard"><Store />Seller dashboard</Link></DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild><Link href="/seller"><Store />Sell on Loupe</Link></DropdownMenuItem>
          )}
          {viewer.isStaff && (
            <DropdownMenuItem asChild><Link href="/admin/dashboard"><Shield />Editorial & admin</Link></DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut />Log out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

