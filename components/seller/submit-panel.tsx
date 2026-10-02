'use client'

import Link from '@/components/i18n/link'
import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import type { MessageKey } from '@/lib/i18n/translate'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkDuplicates, submitForReview } from '@/lib/actions/seller'

// find_duplicate_products() reasons are English; map them to dictionary keys.
const DUP_KEYS: Record<string, MessageKey> = {
  'Same product URL': 'seller.dupes.url',
  'Same SKU/model': 'seller.dupes.sku',
  'Similar name': 'seller.dupes.name',
  'Same brand, similar name': 'seller.dupes.brandName',
}

export function SubmitPanel({ productId, missing, isResubmit }: { productId: string; missing: MessageKey[]; isResubmit: boolean }) {
  const router = useLocalizedRouter()
  const t = useT()
  const [pending, start] = useTransition()
  const [dupes, setDupes] = useState<{ name: string; slug: string; reasons: string[] }[]>([])

  useEffect(() => {
    void checkDuplicates(productId).then((r) => r.ok && setDupes(r.data))
  }, [productId])

  function submit() {
    start(async () => {
      const res = await submitForReview(productId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(isResubmit ? t('seller.submit.resubmitted') : t('act.submitted'))
      router.push('/seller/submissions')
      router.refresh()
    })
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      {missing.length > 0 && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('seller.submit.missing', { items: missing.map((k) => t(k)).join(t('seller.submit.listSep')) })}
        </p>
      )}
      {dupes.length > 0 && (
        <div role="status" className="rounded-xl bg-[oklch(0.96_0.05_80)] p-3 text-sm">
          <p className="font-medium">{t('seller.dupes.title')}</p>
          <ul className="mt-1 list-disc pl-5">
            {dupes.map((d) => (
              <li key={d.slug}><Link href={`/products/${d.slug}`} className="underline" target="_blank">{d.name}</Link> — {d.reasons.map((r) => (DUP_KEYS[r] ? t(DUP_KEYS[r]) : r)).join(t('seller.submit.listSep'))}</li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">{t('seller.dupes.body')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="lg"><Link href={`/seller/products/${productId}/edit?step=5`}>{t('common.back')}</Link></Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg"><Link href="/seller/products">{t('seller.submit.saveExit')}</Link></Button>
          <Button size="lg" onClick={submit} disabled={pending || missing.length > 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            {isResubmit ? t('seller.submit.resubmit') : t('seller.submit.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
