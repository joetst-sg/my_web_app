export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}
