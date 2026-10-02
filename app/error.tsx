'use client'

import { useEffect } from 'react'
import Link from '@/components/i18n/link'
import { useT } from '@/components/i18n/provider'
import { Button } from '@/components/ui/button'

// Never shows the raw error to users; logs it for developers.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main id="main" className="container-page flex min-h-[60vh] flex-col items-start justify-center gap-4 py-20">
      <p className="eyebrow">{t('pages.error.eyebrow')}</p>
      <h1 className="font-display text-4xl font-bold">{t('pages.error.title')}</h1>
      <p className="max-w-lg text-lg text-muted-foreground">{t('pages.error.description')}</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">{t('pages.error.reference', { id: error.digest })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={reset}>{t('common.tryAgain')}</Button>
        <Button asChild size="lg" variant="outline"><Link href="/">{t('common.goHome')}</Link></Button>
      </div>
    </main>
  )
}
