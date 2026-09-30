import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/common/basics'

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } }

export default function ContactPage() {
  const rows = [
    ['Report a listing', 'Use “Report this listing” on any product page. Reports go straight to the editors.', null],
    ['Makers and brands', 'Submit your product, or message the editors from your submission page.', '/submit'],
    ['Your account', 'Change your email, password and notifications in your account settings.', '/account/preferences'],
  ] as const
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow="Contact" title="Get in touch" description="The fastest way to reach us depends on what you need." />
      <ul className="mt-10 divide-y rounded-2xl border">
        {rows.map(([title, body, href]) => (
          <li key={title} className="p-6">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 text-muted-foreground">{body}</p>
            {href && <Link href={href} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">Go</Link>}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">A general contact email will be listed here once the site launches publicly.</p>
    </div>
  )
}
