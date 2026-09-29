'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/actions/engagement'

type Event = Parameters<typeof trackEvent>[0]

// Fires one analytics event after mount (views, searches). Runs after the
// page is interactive so it never blocks rendering.
export function TrackOnMount({ event }: { event: Event }) {
  const sent = useRef<string | null>(null)
  const key = JSON.stringify(event)
  useEffect(() => {
    if (sent.current === key) return
    sent.current = key
    const t = setTimeout(() => void trackEvent(event).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [key, event])
  return null
}
