import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import { EmailForm, PasswordForm } from './forms'

export const metadata: Metadata = { title: 'Security', robots: { index: false } }

export default async function SecurityPage() {
  const viewer = await requireViewer('/account/security')
  return (
    <div className="flex max-w-xl flex-col gap-12">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Security</h1>
        <p className="mt-1 text-muted-foreground">Signed in as {viewer.email}.</p>
      </div>
      <section aria-labelledby="pw-h">
        <h2 id="pw-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">Change password</h2>
        <PasswordForm />
      </section>
      <section aria-labelledby="email-h">
        <h2 id="email-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">Change email</h2>
        <EmailForm current={viewer.email ?? ''} />
      </section>
    </div>
  )
}
