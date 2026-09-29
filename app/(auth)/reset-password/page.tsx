import type { Metadata } from 'next'
import Link from 'next/link'
import { getViewer } from '@/lib/auth'
import { ResetForm } from './reset-form'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }

// Reached from the reset email via /auth/confirm, which signs the user in
// with a short-lived recovery session.
export default async function ResetPasswordPage() {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <>
        <h1 className="font-display text-3xl font-bold">Link expired</h1>
        <p className="mt-2 text-muted-foreground">This reset link is invalid or has expired. Request a new one to continue.</p>
        <Link href="/forgot-password" className="mt-6 inline-block font-medium underline underline-offset-4">Request a new link</Link>
      </>
    )
  }
  return (
    <>
      <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-muted-foreground">For {viewer.email}</p>
      <ResetForm />
    </>
  )
}
