'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WIZARD_STEPS } from '@/lib/wizard'


export function WizardProgress({ current, productId, reachable }: { current: number; productId?: string; reachable: number }) {
  return (
    <nav aria-label="Submission steps" className="mb-8">
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {WIZARD_STEPS.map((label, i) => {
          const step = i + 1
          const done = step < current
          const isCurrent = step === current
          const canGo = productId && step <= reachable
          const inner = (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  isCurrent ? 'bg-primary text-primary-foreground' : done ? 'bg-highlight text-highlight-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : step}
              </span>
              <span className={cn('whitespace-nowrap text-sm', isCurrent ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
            </span>
          )
          return (
            <li key={label} className="flex items-center gap-1">
              {canGo && !isCurrent ? (
                <Link href={`/seller/products/${productId}/edit?step=${step}`} className="rounded-full px-2 py-1 hover:bg-muted">{inner}</Link>
              ) : (
                <span className="px-2 py-1" aria-current={isCurrent ? 'step' : undefined}>{inner}</span>
              )}
              {step < WIZARD_STEPS.length && <span className="h-px w-4 bg-border sm:w-8" aria-hidden />}
            </li>
          )
        })}
      </ol>
      {!productId && (
        <p className="mt-2 text-sm text-muted-foreground">Fill in the basic info and click <strong>Save &amp; continue</strong> — the next steps unlock once your draft is saved.</p>
      )}
      <p className="sr-only" aria-live="polite">Step {current} of {WIZARD_STEPS.length}: {WIZARD_STEPS[current - 1]}</p>
    </nav>
  )
}

// Warns before leaving the page with unsaved changes.
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

export function StepActions({
  pending,
  onSave,
  onContinue,
  backHref,
  continueLabel = 'Save & continue',
}: {
  pending: boolean
  onSave?: () => void
  onContinue: () => void
  backHref?: string
  continueLabel?: string
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      {backHref ? <Button asChild variant="ghost" size="lg"><Link href={backHref}>Back</Link></Button> : <span />}
      <div className="flex gap-2">
        {onSave && <Button type="button" variant="outline" size="lg" onClick={onSave} disabled={pending}>Save draft</Button>}
        <Button type="button" size="lg" onClick={onContinue} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {continueLabel}
        </Button>
      </div>
    </div>
  )
}

export function FieldHelp({ id, error, hint }: { id: string; error?: string[]; hint?: string }) {
  if (error?.length) return <p id={id} role="alert" className="text-sm text-destructive">{error[0]}</p>
  if (hint) return <p id={id} className="text-xs text-muted-foreground">{hint}</p>
  return null
}
