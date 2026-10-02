'use client'

import { useState } from 'react'
import { Menu, Search } from 'lucide-react'
import Link from '@/components/i18n/link'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useT } from '@/components/i18n/provider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { MessageKey } from '@/lib/i18n/translate'
import { SearchBar } from './search-bar'

export function MobileNav({ nav, signedIn }: { nav: readonly { href: string; label: MessageKey }[]; signedIn: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const items: { href: string; label: MessageKey }[] = [...nav, { href: '/deals', label: 'nav.deals' }, { href: '/new', label: 'nav.new' }, { href: '/submit', label: 'nav.submitProductLong' }]
  return (
    <div className="flex items-center gap-1 xl:hidden">
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label={t('search.label')}>
            <Search className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="p-4 pt-12">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('search.label')}</SheetTitle>
            <SheetDescription>{t('search.description')}</SheetDescription>
          </SheetHeader>
          <SearchBar autoFocus onNavigate={() => setSearchOpen(false)} />
        </SheetContent>
      </Sheet>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label={t('nav.openMenu')}>
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('nav.menu')}</SheetTitle>
            <SheetDescription className="sr-only">{t('nav.siteNavigation')}</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col px-4" aria-label={t('nav.mobile')}>
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="border-b py-3.5 text-lg font-medium">
                {t(item.label)}
              </Link>
            ))}
            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t('lang.label')}</span>
              <LanguageSwitcher variant="full" />
            </div>
            {!signedIn && (
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild size="lg"><Link href="/signup" onClick={() => setOpen(false)}>{t('nav.createAccount')}</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/login" onClick={() => setOpen(false)}>{t('nav.login')}</Link></Button>
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
