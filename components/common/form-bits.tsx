'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SubmitButton({ children, pendingLabel, className, ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending || props.disabled} className={cn('h-11', className)} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingLabel ?? 'Please wait…' : children}
    </Button>
  )
}

export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {messages[0]}
    </p>
  )
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
  if (message) return <p role="status" className="rounded-lg bg-[oklch(0.95_0.05_155)] px-3 py-2 text-sm text-[oklch(0.35_0.09_155)]">{message}</p>
  return null
}
