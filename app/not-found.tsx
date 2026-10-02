import Link from '@/components/i18n/link'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { getT } from '@/lib/i18n/server'

export default async function NotFound() {
  const t = await getT()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center"><Logo /></header>
      <main id="main" className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-20">
        <p className="eyebrow">404</p>
        <h1 className="font-display text-4xl font-bold sm:text-6xl">{t('pages.notFound.title')}</h1>
        <p className="max-w-lg text-lg text-muted-foreground">{t('pages.notFound.description')}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg"><Link href="/">{t('common.goHome')}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/search">{t('common.searchProducts')}</Link></Button>
        </div>
      </main>
    </div>
  )
}
