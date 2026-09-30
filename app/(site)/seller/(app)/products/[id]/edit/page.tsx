import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ProductDetailView } from '@/components/product/product-detail-view'
import { BasicsForm } from '@/components/seller/basics-form'
import { BrandForm } from '@/components/seller/brand-form'
import { FeaturesForm } from '@/components/seller/features-form'
import { MediaManager } from '@/components/seller/media-manager'
import { PricingForm } from '@/components/seller/pricing-form'
import { SubmitPanel } from '@/components/seller/submit-panel'
import { WizardProgress } from '@/components/seller/wizard-shared'
import { WIZARD_STEPS } from '@/lib/wizard'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { requireViewer } from '@/lib/auth'
import { toProductView } from '@/lib/db/product-view'
import { getEditableProduct, missingFields, wizardOptions } from '@/lib/db/seller'
import type { ProductDetail } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Edit product', robots: { index: false } }

export default async function EditProductPage({ params, searchParams }: PageProps<'/seller/products/[id]/edit'>) {
  const { id } = await params
  const sp = await searchParams
  const viewer = await requireViewer(`/seller/products/${id}/edit`)
  const product = await getEditableProduct(id)
  if (!product) notFound()
  const step = Math.min(Math.max(Number(sp.step) || 1, 1), WIZARD_STEPS.length)
  // Staff can edit any product at any stage; sellers only their own drafts.
  const editable = viewer.isStaff || ((product.status === 'draft' || product.status === 'changes_requested') && product.seller_id === viewer.id)

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow"><Link href="/seller/products" className="hover:text-foreground">Products</Link></p>
        <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
      </div>
      {product.submission && <SubmissionStatusBadge status={product.submission.status} />}
    </div>
  )

  if (!editable) {
    return (
      <div>
        {header}
        <div className="rounded-2xl border bg-surface p-6">
          <p className="font-medium">This product can&apos;t be edited right now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Products are locked while editors review, schedule or publish them. If you need a change, send the editors a message on the submission page.
          </p>
          <div className="mt-4 flex gap-2">
            {product.submission && <Button asChild><Link href={`/seller/submissions/${product.submission.id}`}>Open submission</Link></Button>}
            <Button asChild variant="outline"><Link href={`/seller/products/${product.id}`}>View product</Link></Button>
          </div>
        </div>
      </div>
    )
  }

  const reachable = WIZARD_STEPS.length
  let body: React.ReactNode
  if (step === 1) {
    const options = await wizardOptions(viewer.id)
    const primary = product.categories?.find((c) => c.is_primary)?.category
    const secondary = product.categories?.find((c) => !c.is_primary)?.category
    // Include the product's current brand if the seller doesn't own it.
    const brands = product.brand && !options.brands.some((b) => b.id === product.brand!.id) ? [{ id: product.brand.id, name: product.brand.name }, ...options.brands] : options.brands
    body = (
      <BasicsForm
        productId={product.id}
        options={{ ...options, brands }}
        initial={{
          name: product.name,
          brand_id: product.brand?.id ?? 'new',
          external_url: product.external_url ?? '',
          tagline: product.tagline ?? '',
          description: product.description ?? '',
          category_id: primary?.id ?? '',
          subcategory_id: secondary?.id ?? '',
          tags: (product.tags ?? []).map((t) => t.tag?.name).filter(Boolean).join(', '),
          sku: product.sku ?? '',
        }}
      />
    )
  } else if (step === 2) {
    body = (
      <PricingForm
        productId={product.id}
        initial={{
          price: product.price === null ? null : Number(product.price),
          original_price: product.original_price === null ? null : Number(product.original_price),
          currency: product.currency,
          availability: product.availability,
          sale_starts_at: product.sale_starts_at,
          sale_ends_at: product.sale_ends_at,
        }}
      />
    )
  } else if (step === 3) {
    body = <MediaManager productId={product.id} initialImages={product.images} initialVideos={product.videos.map((v) => v.url)} />
  } else if (step === 4) {
    body = <FeaturesForm productId={product.id} initial={{ key_features: product.key_features, benefits: product.benefits, specs: product.specs.map((s) => ({ label: s.label, value: s.value })) }} />
  } else if (step === 5) {
    const supabase = await createClient()
    const { data: seller } = await supabase.from('seller_profiles').select('company_name, contact_email').eq('user_id', product.seller_id ?? viewer.id).maybeSingle()
    body = (
      <BrandForm
        productId={product.id}
        brand={product.brand ? { ...product.brand, social_links: (product.brand.social_links ?? {}) as Record<string, string> } : null}
        isOwner={Boolean(product.brand && (product.brand.owner_id === viewer.id || viewer.isStaff))}
        seller={seller}
      />
    )
  } else {
    const view = toProductView(product as unknown as ProductDetail)
    body = (
      <div className="flex flex-col gap-6">
        <p className="text-muted-foreground">This is exactly how your product page will look once it&apos;s published. Buttons are disabled in the preview.</p>
        <div className="rounded-3xl border p-4 sm:p-8">
          <ProductDetailView product={view} preview />
        </div>
        <SubmitPanel productId={product.id} missing={missingFields(product)} isResubmit={product.status === 'changes_requested'} />
      </div>
    )
  }

  return (
    <div>
      {header}
      {product.status === 'changes_requested' && product.submission && (
        <p role="status" className="mb-6 rounded-xl bg-[oklch(0.96_0.05_80)] px-4 py-3 text-sm">
          Editors asked for changes. <Link href={`/seller/submissions/${product.submission.id}`} className="font-medium underline">Read their message</Link>, update your product, then resubmit from the last step.
        </p>
      )}
      <WizardProgress current={step} productId={product.id} reachable={reachable} />
      {body}
    </div>
  )
}
