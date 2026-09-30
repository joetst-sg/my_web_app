import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/common/basics'
import { site } from '@/lib/site'

export const metadata: Metadata = { title: 'About', description: `How ${site.name} finds, reviews and publishes products.`, alternates: { canonical: '/about' } }

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow="About" title={`Why ${site.name}`} description="A slower, more careful way to discover new products." />
      <div className="mt-10 flex flex-col gap-6 text-lg leading-relaxed">
        <p>{site.name} is a discovery platform for well-made gadgets and gear. Makers submit their products, and an editor reviews every submission before it’s published. Nothing appears on the site automatically.</p>
        <h2 className="font-display text-2xl font-bold">How it works</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Editorial review.</strong> Editors check that a product is real, correctly described and linked to a working store.</li>
          <li><strong>Independent scores.</strong> Editorial scores are written by our editors. Sellers can’t edit or buy them.</li>
          <li><strong>We link, we don’t sell.</strong> “Buy now” takes you to the maker’s own site. We don’t take payments.</li>
          <li><strong>Trending is earned.</strong> Rankings come from saves, collection adds, click-throughs, shares and views, weighted towards recent activity.</li>
        </ul>
        <p>Makers can <Link href="/submit" className="underline">submit a product</Link> for free.</p>
        <p className="text-base text-muted-foreground">All brands, products and articles currently shown are fictional demo content used to develop the platform.</p>
      </div>
    </div>
  )
}
