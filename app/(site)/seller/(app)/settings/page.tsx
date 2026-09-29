import type { Metadata } from 'next'
import Link from 'next/link'
import { requireViewer } from '@/lib/auth'

export const metadata: Metadata = { title: 'Seller settings', robots: { index: false } }

export default async function SellerSettingsPage() {
  const viewer = await requireViewer('/seller/settings')
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Settings</h1>
      <p className="mb-8 mt-1 text-muted-foreground">Account-wide settings are shared with your Loupe account.</p>
      <ul className="divide-y rounded-2xl border">
        {[
          ['/seller/profile', 'Seller profile', 'Company name, contact email and links editors see.'],
          ['/account/preferences', 'Notifications', 'Submission updates (approved, changes requested, published) are always emailed to you.'],
          ['/account/security', 'Password & email', `Signed in as ${viewer.email}.`],
          ['/account/profile', 'Public profile', 'Your name and avatar on public collections.'],
        ].map(([href, title, body]) => (
          <li key={href}>
            <Link href={href} className="block p-5 hover:bg-surface">
              <span className="font-medium">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Submission limit: 10 products per day. Contact the editors if you need to submit more for a launch.
      </p>
    </div>
  )
}
