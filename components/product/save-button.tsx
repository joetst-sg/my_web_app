'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LoginPrompt } from '@/components/common/login-prompt'
import { toggleSave } from '@/lib/actions/engagement'
import { LOGIN_REQUIRED } from '@/lib/errors'

export function SaveButton({
  productId,
  productName,
  initialSaved = false,
  variant = 'icon',
  className,
}: {
  productId: string
  productName: string
  initialSaved?: boolean
  variant?: 'icon' | 'full'
  className?: string
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [optimistic, setOptimistic] = useOptimistic(saved)
  const [pending, startTransition] = useTransition()
  const [loginOpen, setLoginOpen] = useState(false)

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = !saved
    startTransition(async () => {
      setOptimistic(next)
      const res = await toggleSave(productId, next)
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) setLoginOpen(true)
        else toast.error(res.error)
        return
      }
      setSaved(next)
      toast.success(next ? `Saved ${productName}` : 'Removed from saved')
    })
  }

  const label = optimistic ? `Remove ${productName} from saved` : `Save ${productName}`
  return (
    <>
      {variant === 'icon' ? (
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          aria-pressed={optimistic}
          aria-label={label}
          title={optimistic ? 'Saved' : 'Save'}
          onClick={onClick}
          disabled={pending}
          className={cn('rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background', className)}
        >
          <Bookmark className={cn('size-4', optimistic && 'fill-current')} />
        </Button>
      ) : (
        <Button type="button" size="lg" variant="outline" aria-pressed={optimistic} onClick={onClick} disabled={pending} className={className}>
          <Bookmark className={cn(optimistic && 'fill-current')} />
          {optimistic ? 'Saved' : 'Save'}
        </Button>
      )}
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
