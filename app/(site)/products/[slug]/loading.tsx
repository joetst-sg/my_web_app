export default function Loading() {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1.15fr_1fr]" aria-busy="true" aria-label="Loading product">
      <div className="aspect-[4/3] animate-pulse rounded-3xl bg-muted" />
      <div className="flex flex-col gap-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-12 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-10 w-40 animate-pulse rounded bg-muted" />
        <div className="h-11 w-72 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}
