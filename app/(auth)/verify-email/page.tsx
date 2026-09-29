import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { ResendForm } from './resend-form'

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } }

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const sp = await searchParams
  const email = typeof sp.email === 'string' ? sp.email : ''
  return (
    <>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <MailCheck className="size-6" aria-hidden />
      </div>
      <h1 className="font-display text-3xl font-bold">Check your inbox</h1>
      <p className="mt-2 text-muted-foreground">
        We sent a confirmation link{email && <> to <strong className="text-foreground">{email}</strong></>}. Click it to activate your account — then you&apos;ll pick your interests.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">Didn&apos;t get it? Check your spam folder or send it again.</p>
      <ResendForm email={email} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already confirmed? <Link href="/login" className="font-medium text-foreground underline underline-offset-4">Log in</Link>
      </p>
    </>
  )
}
