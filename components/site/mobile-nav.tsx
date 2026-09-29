'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SearchBar } from './search-bar'

export function MobileNav({ nav, signedIn }: { nav: readonly { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <div className="flex items-center gap-1 lg:hidden">
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label="Search">
            <Search className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="p-4 pt-12">
          <SheetHeader className="sr-only">
            <SheetTitle>Search</SheetTitle>
            <SheetDescription>Search products, brands and categories</SheetDescription>
          </SheetHeader>
          <SearchBar autoFocus onNavigate={() => setSearchOpen(false)} />
        </SheetContent>
      </Sheet>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] max-w-sm">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription className="sr-only">Site navigation</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col px-4" aria-label="Mobile">
            {[...nav, { href: '/deals', label: 'Deals' }, { href: '/new', label: 'New' }].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="border-b py-3.5 text-lg font-medium">
                {item.label}
              </Link>
            ))}
            <Link href="/submit" onClick={() => setOpen(false)} className="border-b py-3.5 text-lg font-medium">Submit a product</Link>
            {!signedIn && (
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild size="lg"><Link href="/signup" onClick={() => setOpen(false)}>Create account</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/login" onClick={() => setOpen(false)}>Log in</Link></Button>
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
