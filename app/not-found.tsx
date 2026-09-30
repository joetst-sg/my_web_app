import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center"><Logo /></header>
      <main id="main" className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-20">
        <p className="eyebrow">404</p>
        <h1 className="font-display text-4xl font-bold sm:text-6xl">We couldn’t find that page.</h1>
        <p className="max-w-lg text-lg text-muted-foreground">It may have been moved, unpublished, or never existed. Try searching, or start from the homepage.</p>
        <div className="flex gap-2">
          <Button asChild size="lg"><Link href="/">Go home</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/search">Search products</Link></Button>
        </div>
      </main>
    </div>
  )
}
