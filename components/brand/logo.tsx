import Link from '@/components/i18n/link'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import { site } from '@/lib/site'

// The Loupe mark: a lens with a small highlight and a handle.
export function LoupeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <circle cx="13" cy="13" r="9.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="13" cy="13" r="6.5" className="fill-highlight" />
      <path d="M9.5 10.5a4.5 4.5 0 0 1 4-2.5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      <path d="M20.2 20.2 28 28" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

export async function Logo({ className }: { className?: string }) {
  const t = await getT()
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2 rounded-md', className)} aria-label={t('common.homeLink', { name: site.name })}>
      <LoupeMark />
      <span className="font-display text-xl font-bold tracking-tight">{site.name}</span>
    </Link>
  )
}
