import { getT } from '@/lib/i18n/server'

export default async function Loading() {
  const t = await getT()
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('common.loading')}>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}
