'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkDuplicates, submitForReview } from '@/lib/actions/seller'

export function SubmitPanel({ productId, missing, isResubmit }: { productId: string; missing: string[]; isResubmit: boolean }) {
  const router = useRouter()
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
      toast.success(isResubmit ? 'Resubmitted for review' : 'Submitted for review')
      router.push('/seller/submissions')
      router.refresh()
    })
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      {missing.length > 0 && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Before submitting, add {missing.join(', ')}.
        </p>
      )}
      {dupes.length > 0 && (
        <div role="status" className="rounded-xl bg-[oklch(0.96_0.05_80)] p-3 text-sm">
          <p className="font-medium">A similar product already exists:</p>
          <ul className="mt-1 list-disc pl-5">
            {dupes.map((d) => (
              <li key={d.slug}><Link href={`/products/${d.slug}`} className="underline" target="_blank">{d.name}</Link> — {d.reasons.join(', ').toLowerCase()}</li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">You can still submit. Editors will decide whether to merge or reject duplicates.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="lg"><Link href={`/seller/products/${productId}/edit?step=5`}>Back</Link></Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg"><Link href="/seller/products">Save draft & exit</Link></Button>
          <Button size="lg" onClick={submit} disabled={pending || missing.length > 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            {isResubmit ? 'Resubmit for review' : 'Submit for review'}
          </Button>
        </div>
      </div>
    </div>
  )
}
