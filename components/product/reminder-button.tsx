'use client'

import { useState, useTransition } from 'react'
import { BellPlus, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LoginPrompt } from '@/components/common/login-prompt'
import { createReminder } from '@/lib/actions/engagement'
import { LOGIN_REQUIRED } from '@/lib/errors'
import { useT } from '@/components/i18n/provider'

type ReminderType = 'launch' | 'sale' | 'custom'

export function ReminderButton({
  productId,
  productName,
  availability,
  initialSet = false,
  variant = 'icon',
  className,
}: {
  productId: string
  productName: string
  availability?: string | null
  initialSet?: boolean
  variant?: 'icon' | 'full'
  className?: string
}) {
  const t = useT()
  const upcoming = availability === 'coming_soon' || availability === 'crowdfunding' || availability === 'preorder'
  const [open, setOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [isSet, setIsSet] = useState(initialSet)
  const [type, setType] = useState<ReminderType>(upcoming ? 'launch' : 'sale')
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createReminder({
        productId,
        type,
        remindAt: type === 'custom' && date ? new Date(date).toISOString() : undefined,
      })
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) {
          setOpen(false)
          setLoginOpen(true)
        } else setError(res.error)
        return
      }
      setIsSet(true)
      setOpen(false)
      toast.success(res.message ?? t('reminder.setToast'))
    })
  }

  const minDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  const Icon = isSet ? BellRing : BellPlus

  return (
    <>
      {variant === 'icon' ? (
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          aria-label={t('reminder.ariaLabel', { name: productName })}
          title={isSet ? t('reminder.isSet') : t('reminder.remindMe')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          className={cn('rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background', className)}
        >
          <Icon className={cn('size-4', isSet && 'text-highlight-foreground')} />
        </Button>
      ) : (
        <Button type="button" size="lg" variant="outline" onClick={() => setOpen(true)} className={className}>
          <Icon />
          {isSet ? t('reminder.isSet') : t('reminder.remindMe')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('reminder.title', { name: productName })}</DialogTitle>
            <DialogDescription>{t('reminder.description')}</DialogDescription>
          </DialogHeader>
          <RadioGroup value={type} onValueChange={(v) => setType(v as ReminderType)} className="gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground">
              <RadioGroupItem value="launch" id={`r-launch-${productId}`} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{t('reminder.launch')}</span>
                <span className="block text-xs text-muted-foreground">{t('reminder.launchHint')}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground">
              <RadioGroupItem value="sale" id={`r-sale-${productId}`} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{t('reminder.sale')}</span>
                <span className="block text-xs text-muted-foreground">{t('reminder.saleHint')}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground">
              <RadioGroupItem value="custom" id={`r-custom-${productId}`} className="mt-0.5" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{t('reminder.custom')}</span>
                {type === 'custom' && (
                  <span className="mt-2 block">
                    <Label htmlFor={`r-date-${productId}`} className="sr-only">{t('reminder.dateLabel')}</Label>
                    <Input id={`r-date-${productId}`} type="datetime-local" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
                  </span>
                )}
              </span>
            </label>
          </RadioGroup>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button size="lg" onClick={submit} disabled={pending || (type === 'custom' && !date)}>
              {pending ? t('reminder.setting') : t('reminder.set')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason="loginPrompt.reasonRemind" />
    </>
  )
}
