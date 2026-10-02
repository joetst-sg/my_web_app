// Small dependency-free daily bar chart (SVG) with an accessible table.
export function DailyBarChart({
  dayLabel = 'Day',
  data,
  series,
  height = 160,
  label,
}: {
  data: { day: string; values: Record<string, number> }[]
  series: { key: string; label: string; color: string }[]
  height?: number
  label: string
  dayLabel?: string
}) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)))
  const w = 100 / Math.max(data.length, 1)
  const barW = (w * 0.8) / series.length
  const ticks = [0, Math.round(max / 2), max]
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[0.7rem] tabular-nums text-muted-foreground" style={{ height }} aria-hidden>
          {[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}
        </div>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={label}>
          {ticks.map((t) => (
            <line key={t} x1="0" x2="100" y1={height - (t / max) * height} y2={height - (t / max) * height} stroke="var(--border)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) =>
            series.map((s, j) => {
              const v = d.values[s.key] ?? 0
              const h = (v / max) * height
              return <rect key={`${d.day}-${s.key}`} x={i * w + w * 0.1 + j * barW} y={height - h} width={barW} height={h} fill={s.color} rx="0.4" />
            }),
          )}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
        ))}
        {data.length > 0 && <span className="ml-auto tabular-nums">{data[0].day} – {data[data.length - 1].day}</span>}
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>{dayLabel}</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td>{series.map((s) => <td key={s.key}>{d.values[s.key] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  )
}

export function lastNDays(n: number) {
  const days: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}
