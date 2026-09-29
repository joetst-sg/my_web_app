import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer, safeNext } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Log in', robots: { index: false } }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/')
  if (await getViewer()) redirect(next)
  return (
    <>
      <h1 className="font-display text-3xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-muted-foreground">Log in to see your saved products, collections and feed.</p>
      {sp.error === 'link' && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That link is invalid or has expired. Please log in, or request a new link.
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Loupe? <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-foreground underline underline-offset-4">Create an account</Link>
      </p>
    </>
  )
}
