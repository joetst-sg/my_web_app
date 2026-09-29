import type { Metadata } from 'next'
import { BasicsForm } from '@/components/seller/basics-form'
import { WizardProgress } from '@/components/seller/wizard-shared'
import { requireViewer } from '@/lib/auth'
import { wizardOptions } from '@/lib/db/seller'

export const metadata: Metadata = { title: 'New product', robots: { index: false } }

export default async function NewProductPage() {
  const viewer = await requireViewer('/seller/products/new')
  const options = await wizardOptions(viewer.id)
  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">New product</h1>
      <p className="mb-8 mt-1 text-muted-foreground">Start with the basics. Your draft is saved when you continue, and you can come back any time.</p>
      <WizardProgress current={1} reachable={1} />
      <BasicsForm options={options} />
    </div>
  )
}
