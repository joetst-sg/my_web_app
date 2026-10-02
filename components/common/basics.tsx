import Image from 'next/image'
import Link from '@/components/i18n/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hueFor, initials } from '@/lib/images'

export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
  as: Tag = 'h2',
  className,
}: {
  title: string
  subtitle?: string | null
  href?: string
  // Required with href: pass the translated label (e.g. t('common.viewAll')).
  linkLabel?: string
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div>
        <Tag className={cn('font-display font-bold', Tag === 'h1' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}>{title}</Tag>
        {subtitle && <p className="mt-1 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline hover:underline-offset-4">
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <h2 className="font-sans text-lg font-semibold tracking-normal">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function BrandMark({
  name,
  logoUrl,
  size = 40,
  className,
}: {
  name: string
  logoUrl?: string | null
  size?: number
  className?: string
}) {
  if (logoUrl) {
    return (
      <Image src={logoUrl} alt="" width={size} height={size} className={cn('shrink-0 rounded-xl border bg-white object-contain', className)} />
    )
  }
  const hue = hueFor(name)
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-xl font-display font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `oklch(0.42 0.09 ${hue})` }}
    >
      {initials(name)}
    </span>
  )
}

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    neutral: 'bg-muted text-foreground',
    info: 'bg-[oklch(0.94_0.04_250)] text-[oklch(0.35_0.1_250)]',
    success: 'bg-[oklch(0.94_0.05_155)] text-[oklch(0.35_0.09_155)]',
    warning: 'bg-[oklch(0.95_0.06_75)] text-[oklch(0.4_0.1_60)]',
    danger: 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.17_25)]',
    accent: 'bg-highlight text-highlight-foreground',
  }
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string | null
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 border-b pb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
