'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Never shows the raw error to users; logs it for developers.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main id="main" className="container-page flex min-h-[60vh] flex-col items-start justify-center gap-4 py-20">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display text-4xl font-bold">That didn’t load properly.</h1>
      <p className="max-w-lg text-lg text-muted-foreground">Please try again. If it keeps happening, come back in a few minutes.</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex gap-2">
        <Button size="lg" onClick={reset}>Try again</Button>
        <Button asChild size="lg" variant="outline"><Link href="/">Go home</Link></Button>
      </div>
    </main>
  )
}
