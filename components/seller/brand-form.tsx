'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { BrandMark } from '@/components/common/basics'
import { saveBrandInfo } from '@/lib/actions/seller'
import { prepareImage, uploadWithProgress, UploadError } from '@/lib/upload'
import { FieldHelp, StepActions, useUnsavedChanges } from './wizard-shared'

type Brand = { id: string; name: string; tagline: string | null; description: string | null; website_url: string | null; logo_url: string | null; social_links: Record<string, string>; owner_id: string | null }

export function BrandForm({ productId, brand, isOwner, seller }: { productId: string; brand: Brand | null; isOwner: boolean; seller: { company_name: string; contact_email: string | null } | null }) {
  const router = useRouter()
  const logoInput = useRef<HTMLInputElement>(null)
  const [v, setV] = useState({
    website_url: brand?.website_url ?? '',
    tagline: brand?.tagline ?? '',
    description: brand?.description ?? '',
    instagram: brand?.social_links?.instagram ?? '',
    x: brand?.social_links?.x ?? '',
    youtube: brand?.social_links?.youtube ?? '',
  })
  const [logo, setLogo] = useState<string | null>(brand?.logo_url ?? null)
  const [progress, setProgress] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [dirty, setDirty] = useState(false)
  const [pending, start] = useTransition()
  useUnsavedChanges(dirty)
  const next = `/seller/products/${productId}/edit?step=6`

  if (!brand) return <p className="text-muted-foreground">Choose a brand in step 1 first.</p>

  if (!isOwner) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <p className="rounded-xl bg-surface p-4 text-sm">
          <strong>{brand.name}</strong> is managed by its owner or our editors, so its details can&apos;t be changed here. If something is wrong, send the editors a message after you submit.
        </p>
        <StepActions pending={false} onContinue={() => router.push(next)} backHref={`/seller/products/${productId}/edit?step=4`} />
      </div>
    )
  }

  async function uploadLogo(file: File) {
    try {
      setProgress(0)
      const img = await prepareImage(file, { minWidth: 128, minHeight: 128, maxSize: 512 })
      const url = await uploadWithProgress('brand-images', `brands/${brand!.id}/${crypto.randomUUID()}.webp`, img.blob, setProgress)
      setLogo(url)
      setDirty(true)
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : 'Upload failed. Please try again.')
    } finally {
      setProgress(null)
    }
  }

  function save(andContinue: boolean) {
    setErrors({})
    start(async () => {
      const res = await saveBrandInfo({ brand_id: brand!.id, ...v, logo_url: logo })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      setDirty(false)
      toast.success('Brand details saved')
      if (andContinue) router.push(next)
      router.refresh()
    })
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setV((c) => ({ ...c, [k]: e.target.value })); setDirty(true) }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-6" noValidate>
      {seller && (
        <p className="text-sm text-muted-foreground">
          Submitting as <strong className="text-foreground">{seller.company_name}</strong>{seller.contact_email && ` (${seller.contact_email})`}. <Link href="/seller/profile" className="underline">Edit seller profile</Link>
        </p>
      )}
      <div className="flex items-center gap-4">
        <BrandMark name={brand.name} logoUrl={logo} size={72} />
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{brand.name}</p>
          <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
          <Button type="button" variant="outline" onClick={() => logoInput.current?.click()} disabled={progress !== null}><Upload />{logo ? 'Change logo' : 'Upload logo'}</Button>
          {progress !== null && <Progress value={progress * 100} className="w-40" aria-label="Logo upload progress" />}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-website">Brand website</Label>
        <Input id="b-website" type="url" value={v.website_url} onChange={set('website_url')} placeholder="https://…" className="h-11" aria-describedby="b-website-help" />
        <FieldHelp id="b-website-help" error={errors.website_url} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-tagline">Brand tagline</Label>
        <Input id="b-tagline" value={v.tagline} onChange={set('tagline')} maxLength={160} className="h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-description">About the brand</Label>
        <Textarea id="b-description" value={v.description} onChange={set('description')} maxLength={4000} rows={4} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['instagram', 'x', 'youtube'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-2">
            <Label htmlFor={`b-${k}`} className="capitalize">{k === 'x' ? 'X' : k}</Label>
            <Input id={`b-${k}`} type="url" value={v[k]} onChange={set(k)} placeholder="https://…" className="h-11" aria-describedby={`b-${k}-help`} />
            <FieldHelp id={`b-${k}-help`} error={errors[k]} />
          </div>
        ))}
      </div>
      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} backHref={`/seller/products/${productId}/edit?step=4`} />
    </form>
  )
}
