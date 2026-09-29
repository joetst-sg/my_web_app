import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock, Eye, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Submit a product',
  description: 'Makers and brands can submit products to Loupe for free. Every submission is reviewed by an editor.',
  alternates: { canonical: '/submit' },
}

export default async function SubmitPage() {
  const viewer = await getViewer()
  const href = !viewer ? '/signup?next=/seller' : viewer.isSeller ? '/seller/products/new' : '/seller'
  const steps = [
    [Send, 'Submit', 'Add your product details, images, price and a link to where people can buy it. Save as a draft at any step.'],
    [Eye, 'Editorial review', 'An editor checks every submission, usually within a few days. They may ask for changes — you’ll get a message.'],
    [Clock, 'Scheduled', 'Approved products are scheduled for a publish date that fits our editorial calendar.'],
    [CheckCircle2, 'Published', 'Your product goes live with a Buy Now button that links straight to your store. We never take a cut.'],
  ] as const
  return (
    <div className="container-page py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">For makers and brands</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-6xl">Get your product in front of people who care about the details.</h1>
        <p className="mt-5 text-xl text-muted-foreground">Submitting is free. Every product is reviewed by an editor before it’s published — we don’t sell placements in reviews or scores.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base"><Link href={href}>{viewer?.isSeller ? 'Submit a product' : 'Get started'}</Link></Button>
          {viewer?.isSeller && <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-base"><Link href="/seller/dashboard">Seller dashboard</Link></Button>}
        </div>
      </div>
      <ol className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([Icon, title, body], i) => (
          <li key={title} className="rounded-2xl border p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-highlight text-highlight-foreground"><Icon className="size-4" aria-hidden /></span>
              <span className="text-sm text-muted-foreground">Step {i + 1}</span>
            </div>
            <h2 className="mt-4 font-sans text-lg font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-2xl font-bold">What we look for</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>A real, shipping (or crowdfunding) product with a working HTTPS product page.</li>
          <li>Clear, original images at least 600×400 pixels — lifestyle shots help.</li>
          <li>An honest description and the key specifications buyers need.</li>
          <li>No duplicates: if your product is already listed, message us to update it instead.</li>
        </ul>
      </section>
    </div>
  )
}
