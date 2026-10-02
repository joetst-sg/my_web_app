'use client'

import Link from '@/components/i18n/link'
import { useLocalizedRouter, useT } from '@/components/i18n/provider'
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
import { prepareImage, uploadWithProgress, uploadErrorText } from '@/lib/upload'
import { FieldHelp, StepActions, useUnsavedChanges } from './wizard-shared'

type Brand = { id: string; name: string; tagline: string | null; description: string | null; website_url: string | null; logo_url: string | null; social_links: Record<string, string>; owner_id: string | null }

export function BrandForm({ productId, brand, isOwner, seller }: { productId: string; brand: Brand | null; isOwner: boolean; seller: { company_name: string; contact_email: string | null } | null }) {
  const router = useLocalizedRouter()
  const t = useT()
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

  if (!brand) return <p className="text-muted-foreground">{t('seller.brand.chooseFirst')}</p>

  if (!isOwner) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <p className="rounded-xl bg-surface p-4 text-sm">
          <strong>{brand.name}</strong>{t('seller.brand.managed')}
        </p>
        <StepActions pending={false} onContinue={() => router.push(next)} backHref={`/seller/products/${productId}/edit?step=4`} />
      </div>
    )
  }

  async function uploadLogo(file: File) {
    try {
      setProgress(0)
      const img = await prepareImage(file, { minWidth: 128, minHeight: 128, maxSize: 512 })
      const url = await uploadWithProgress('brand-images', `brands/${brand!.id}/${crypto.randomUUID()}.${img.ext}`, img.blob, setProgress)
      setLogo(url)
      setDirty(true)
    } catch (e) {
      toast.error(uploadErrorText(e, t))
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
      toast.success(t('seller.brand.saved'))
      if (andContinue) router.push(next)
      router.refresh()
    })
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setV((c) => ({ ...c, [k]: e.target.value })); setDirty(true) }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-6" noValidate>
      {seller && (
        <p className="text-sm text-muted-foreground">
          {t('seller.brand.submittingAs')}<strong className="text-foreground">{seller.company_name}</strong>{seller.contact_email && ` (${seller.contact_email})`}{t('seller.brand.period')} <Link href="/seller/profile" className="underline">{t('seller.brand.editProfile')}</Link>
        </p>
      )}
      <div className="flex items-center gap-4">
        <BrandMark name={brand.name} logoUrl={logo} size={72} />
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{brand.name}</p>
          <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
          <Button type="button" variant="outline" onClick={() => logoInput.current?.click()} disabled={progress !== null}><Upload />{logo ? t('seller.brand.changeLogo') : t('seller.brand.uploadLogo')}</Button>
          {progress !== null && <Progress value={progress * 100} className="w-40" aria-label={t('seller.brand.logoProgress')} />}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-website">{t('seller.brand.website')}</Label>
        <Input id="b-website" type="url" value={v.website_url} onChange={set('website_url')} placeholder="https://…" className="h-11" aria-describedby="b-website-help" />
        <FieldHelp id="b-website-help" error={errors.website_url} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-tagline">{t('seller.brand.tagline')}</Label>
        <Input id="b-tagline" value={v.tagline} onChange={set('tagline')} maxLength={160} className="h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="b-description">{t('seller.brand.about')}</Label>
        <Textarea id="b-description" value={v.description} onChange={set('description')} maxLength={4000} rows={4} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['instagram', 'x', 'youtube'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-2">
            <Label htmlFor={`b-${k}`} className="">{k === 'x' ? 'X' : k === 'youtube' ? 'YouTube' : 'Instagram'}</Label>
            <Input id={`b-${k}`} type="url" value={v[k]} onChange={set(k)} placeholder="https://…" className="h-11" aria-describedby={`b-${k}-help`} />
            <FieldHelp id={`b-${k}-help`} error={errors[k]} />
          </div>
        ))}
      </div>
      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} backHref={`/seller/products/${productId}/edit?step=4`} />
    </form>
  )
}
