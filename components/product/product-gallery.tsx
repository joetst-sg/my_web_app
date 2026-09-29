'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Img = { id: string; src: string; alt: string; width: number; height: number }

export function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [full, setFull] = useState(false)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const track = useRef<HTMLDivElement>(null)

  // Mobile: swipeable scroll-snap track keeps the index in sync.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function goTo(i: number) {
    const next = (i + images.length) % images.length
    setIndex(next)
    track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' })
  }

  if (images.length === 0) return <div className="aspect-[4/3] rounded-3xl bg-muted" />
  const current = images[index] ?? images[0]

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile swipe */}
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl bg-muted [scrollbar-width:none] md:hidden"
        aria-label={`${name} images, swipe to see more`}
      >
        {images.map((img, i) => (
          <button key={img.id} type="button" onClick={() => setFull(true)} className="w-full shrink-0 snap-center" aria-label={`Open image ${i + 1} of ${images.length} full screen`}>
            <Image src={img.src} alt={img.alt} width={img.width} height={img.height} priority={i === 0} sizes="100vw" className="aspect-[4/3] w-full object-cover" />
          </button>
        ))}
      </div>

      {/* Desktop: hover to zoom, click for full screen */}
      <div className="relative hidden overflow-hidden rounded-3xl bg-muted md:block">
        <button
          type="button"
          className="block w-full cursor-zoom-in"
          onClick={() => setFull(true)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
          }}
          onMouseLeave={() => setZoom(null)}
          aria-label="Open image full screen"
        >
          <Image
            src={current.src}
            alt={current.alt}
            width={current.width}
            height={current.height}
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="aspect-[4/3] w-full object-cover transition-transform duration-200"
            style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        </button>
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">
          <Expand className="size-3.5" aria-hidden /> Hover to zoom
        </span>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose image">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Image ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn('shrink-0 overflow-hidden rounded-xl border-2 transition-colors', i === index ? 'border-foreground' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <Image src={img.src} alt="" width={160} height={120} sizes="96px" className="aspect-[4/3] w-20 object-cover sm:w-24" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-[min(96vw,1400px)] border-0 bg-black p-0 sm:max-w-[min(96vw,1400px)]" onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(index + 1)
          if (e.key === 'ArrowLeft') goTo(index - 1)
        }}>
          <DialogTitle className="sr-only">{name} — image {index + 1} of {images.length}</DialogTitle>
          <DialogDescription className="sr-only">Use the arrow keys to move between images.</DialogDescription>
          <Image src={current.src} alt={current.alt} width={current.width} height={current.height} sizes="96vw" className="max-h-[88dvh] w-full rounded-lg object-contain" />
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black">
                <ChevronLeft />
              </button>
              <button type="button" onClick={() => goTo(index + 1)} aria-label="Next image" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black">
                <ChevronRight />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
