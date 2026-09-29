import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer, safeNext } from '@/lib/auth'
import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Create account', robots: { index: false } }

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/onboarding')
  if (await getViewer()) redirect('/')
  return (
    <>
      <h1 className="font-display text-3xl font-bold">Create your account</h1>
      <p className="mb-6 mt-1 text-muted-foreground">Save products, build collections, follow brands and get reminders.</p>
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-foreground underline underline-offset-4">Log in</Link>
      </p>
    </>
  )
}
