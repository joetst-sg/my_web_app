import { Bell } from 'lucide-react'
import Link from '@/components/i18n/link'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'
import { getAuthUser, getViewer } from '@/lib/auth'
import { getT } from '@/lib/i18n/server'
import { mainNav } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { SearchBar } from './search-bar'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'

async function unreadCount(userId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function SiteHeader() {
  const authUser = await getAuthUser()
  const [viewer, unread, t] = await Promise.all([getViewer(), authUser ? unreadCount(authUser.id) : Promise.resolve(0), getT()])

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        {t('common.skipToContent')}
      </a>
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <nav aria-label={t('nav.main')} className="ml-4 hidden items-center gap-1 xl:flex">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {t(item.label)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SearchBar className="hidden w-56 xl:block 2xl:w-72" />
          <LanguageSwitcher className="hidden sm:flex" />
          <Button asChild variant="outline" className="hidden h-10 rounded-full px-4 md:inline-flex xl:hidden 2xl:inline-flex">
            <Link href="/submit">{t('nav.submitProduct')}</Link>
          </Button>
          {viewer ? (
            <>
              <Button asChild variant="ghost" size="icon-lg" className="relative rounded-full">
                <Link href="/account/notifications" aria-label={unread ? t('nav.notificationsUnread', { count: unread }) : t('nav.notifications')}>
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              </Button>
              <UserMenu
                viewer={{
                  displayName: viewer.displayName,
                  email: viewer.email,
                  avatarUrl: viewer.avatarUrl,
                  username: viewer.username,
                  isSeller: viewer.isSeller,
                  isStaff: viewer.isStaff,
                }}
              />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" className="h-10 rounded-full px-4"><Link href="/login">{t('nav.login')}</Link></Button>
              <Button asChild className="h-10 rounded-full px-4"><Link href="/signup">{t('nav.signup')}</Link></Button>
            </div>
          )}
          <MobileNav nav={mainNav} signedIn={Boolean(viewer)} />
        </div>
      </div>
    </header>
  )
}
