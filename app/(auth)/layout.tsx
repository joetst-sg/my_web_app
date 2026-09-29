import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="container-page flex h-16 items-center">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-3xl border bg-background p-6 shadow-sm sm:p-8">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">Terms</Link> · <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      </footer>
    </div>
  )
}
