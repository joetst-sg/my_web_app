'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImagePlus, Plus, RefreshCw, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { addProductImage, deleteProductImage, reorderProductImages, saveVideos, updateImageAlt } from '@/lib/actions/seller'
import { productImageUrl } from '@/lib/images'
import { prepareImage, uploadWithProgress, UploadError } from '@/lib/upload'
import { StepActions } from './wizard-shared'

type Img = { id: string; path: string; alt: string | null; src: string }
type Uploading = { key: string; name: string; progress: number; preview?: string; error?: string }

const MAX = 12

function Thumb({ img, index, onDelete, onReplace, onAlt, onPrimary, busy }: {
  img: Img
  index: number
  onDelete: () => void
  onReplace: (f: File) => void
  onAlt: (alt: string) => void
  onPrimary: () => void
  busy: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id })
  const replaceInput = useRef<HTMLInputElement>(null)
  const [alt, setAlt] = useState(img.alt ?? '')
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex flex-col gap-2 rounded-2xl border bg-background p-2', isDragging && 'z-10 shadow-xl')}>
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <Image src={img.src} alt={alt || `Product image ${index + 1}`} width={600} height={450} sizes="240px" className="aspect-[4/3] w-full object-cover" />
        {index === 0 && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-highlight-foreground"><Star className="size-3 fill-current" />Primary</span>}
        <button type="button" {...attributes} {...listeners} aria-label={`Drag to reorder image ${index + 1}. Use space and arrow keys.`} className="absolute right-2 top-2 cursor-grab rounded-lg bg-background/90 p-1.5 active:cursor-grabbing">
          <GripVertical className="size-4" />
        </button>
      </div>
      <Label htmlFor={`alt-${img.id}`} className="sr-only">Alt text for image {index + 1}</Label>
      <Input id={`alt-${img.id}`} placeholder="Describe the image (alt text)" value={alt} onChange={(e) => setAlt(e.target.value)} onBlur={() => alt !== (img.alt ?? '') && onAlt(alt)} maxLength={200} className="h-9 text-sm" />
      <div className="flex flex-wrap gap-1">
        {index !== 0 && <Button type="button" variant="ghost" size="sm" onClick={onPrimary} disabled={busy}><Star />Make primary</Button>}
        <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} tabIndex={-1} />
        <Button type="button" variant="ghost" size="sm" onClick={() => replaceInput.current?.click()} disabled={busy}><RefreshCw />Replace</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={busy} className="text-destructive"><Trash2 />Delete</Button>
      </div>
    </li>
  )
}

export function MediaManager({
  productId,
  initialImages,
  initialVideos,
  mode = 'wizard',
}: {
  productId: string
  initialImages: { id: string; storage_path: string; alt: string | null }[]
  initialVideos: string[]
  // 'standalone' is used on the admin product page: no wizard navigation.
  mode?: 'wizard' | 'standalone'
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<Img[]>(initialImages.map((i) => ({ id: i.id, path: i.storage_path, alt: i.alt, src: productImageUrl(i.storage_path)! })))
  const [uploads, setUploads] = useState<Uploading[]>([])
  const [videos, setVideos] = useState<string[]>(initialVideos.length ? initialVideos : [''])
  const [dragOver, setDragOver] = useState(false)
  const [pending, start] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  async function uploadOne(file: File, replaceAt?: number): Promise<Img | null> {
    const key = crypto.randomUUID()
    setUploads((u) => [...u, { key, name: file.name, progress: 0 }])
    const update = (patch: Partial<Uploading>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)))
    try {
      const prepared = await prepareImage(file)
      update({ preview: prepared.previewUrl })
      const path = `products/${productId}/${crypto.randomUUID()}.${prepared.ext}`
      await uploadWithProgress('product-images', path, prepared.blob, (p) => update({ progress: p }))
      const res = await addProductImage(productId, { path, width: prepared.width, height: prepared.height })
      if (!res.ok) throw new UploadError(res.error)
      setUploads((u) => u.filter((x) => x.key !== key))
      const img = { id: res.data.id, path, alt: null, src: productImageUrl(path)! }
      if (replaceAt === undefined) setImages((cur) => [...cur, img])
      return img
    } catch (e) {
      update({ error: e instanceof UploadError ? e.message : 'Upload failed. Please try again.' })
      return null
    }
  }

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const room = MAX - images.length - uploads.filter((u) => !u.error).length
    if (list.length > room) toast.error(`You can add ${room} more image${room === 1 ? '' : 's'} (${MAX} maximum).`)
    // Upload in sequence so the order matches the selection.
    for (const f of list.slice(0, Math.max(room, 0))) await uploadOne(f)
    router.refresh()
  }

  function persistOrder(next: Img[]) {
    setImages(next)
    start(async () => {
      const res = await reorderProductImages(productId, next.map((i) => i.id))
      if (!res.ok) toast.error(res.error)
    })
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    persistOrder(arrayMove(images, images.findIndex((i) => i.id === e.active.id), images.findIndex((i) => i.id === e.over!.id)))
  }

  function remove(img: Img) {
    start(async () => {
      const res = await deleteProductImage(productId, img.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setImages((cur) => cur.filter((i) => i.id !== img.id))
      toast.success('Image deleted')
    })
  }

  async function replace(img: Img, file: File) {
    const index = images.findIndex((i) => i.id === img.id)
    const added = await uploadOne(file, index)
    if (!added) return
    const next = [...images]
    next[index] = added
    const del = await deleteProductImage(productId, img.id)
    if (!del.ok) toast.error(del.error)
    persistOrder(next)
    toast.success('Image replaced')
  }

  function saveAll(andContinue: boolean) {
    start(async () => {
      const res = await saveVideos(productId, videos)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (images.length === 0 && andContinue) toast.warning('Add at least one image before you submit.')
      else toast.success('Media saved')
      if (andContinue) router.push(`/seller/products/${productId}/edit?step=4`)
      router.refresh()
    })
  }

  const busy = pending || uploads.some((u) => !u.error)
  return (
    <div className={cn('flex flex-col gap-8', mode === 'wizard' && 'max-w-4xl')}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files) }}
        className={cn('flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors', dragOver ? 'border-foreground bg-surface' : 'border-border')}
      >
        <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Drop images here</p>
        <p className="text-sm text-muted-foreground">or</p>
        <input ref={input} id="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = '' }} />
        <Button type="button" variant="outline" size="lg" onClick={() => input.current?.click()} disabled={images.length >= MAX}>Browse files</Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP or AVIF · at least 600×400 · up to 15 MB each · {images.length}/{MAX} images. We convert everything to optimized WebP (JPEG in Safari).</p>
      </div>

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-3 rounded-xl border p-3">
              {u.preview ? <Image src={u.preview} alt="" width={64} height={48} unoptimized className="h-12 w-16 rounded-md object-cover" /> : <div className="h-12 w-16 rounded-md bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                {u.error ? <p role="alert" className="text-sm text-destructive">{u.error}</p> : <Progress value={u.progress * 100} aria-label={`Uploading ${u.name}`} className="mt-1.5" />}
              </div>
              {u.error && <Button type="button" variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}><X /></Button>}
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <section aria-labelledby="images-h">
          <h2 id="images-h" className="mb-1 font-sans text-base font-semibold tracking-normal">Your images</h2>
          <p className="mb-4 text-sm text-muted-foreground">The first image is the primary image on cards and search. Drag to reorder.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {images.map((img, i) => (
                  <Thumb
                    key={img.id}
                    img={img}
                    index={i}
                    busy={busy}
                    onDelete={() => remove(img)}
                    onReplace={(f) => void replace(img, f)}
                    onAlt={(alt) => start(async () => { const r = await updateImageAlt(img.id, alt); if (!r.ok) toast.error(r.error) })}
                    onPrimary={() => persistOrder([img, ...images.filter((x) => x.id !== img.id)])}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      )}

      <section aria-labelledby="video-h" className="flex flex-col gap-3">
        <h2 id="video-h" className="font-sans text-base font-semibold tracking-normal">Product video (optional)</h2>
        {videos.map((url, i) => (
          <div key={i} className="flex gap-2">
            <Label htmlFor={`video-${i}`} className="sr-only">Video URL {i + 1}</Label>
            <Input id={`video-${i}`} type="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setVideos((v) => v.map((x, j) => (j === i ? e.target.value : x)))} className="h-11" />
            {videos.length > 1 && <Button type="button" variant="ghost" size="icon-lg" aria-label="Remove video" onClick={() => setVideos((v) => v.filter((_, j) => j !== i))}><X /></Button>}
          </div>
        ))}
        {videos.length < 4 && <Button type="button" variant="ghost" className="self-start" onClick={() => setVideos((v) => [...v, ''])}><Plus />Add another video</Button>}
        <p className="text-xs text-muted-foreground">YouTube and Vimeo links are embedded on your product page.</p>
      </section>

      {mode === 'wizard' ? (
        <StepActions pending={busy} onSave={() => saveAll(false)} onContinue={() => saveAll(true)} backHref={`/seller/products/${productId}/edit?step=2`} />
      ) : (
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => saveAll(false)} disabled={busy}>Save video links</Button>
          <span className="text-xs text-muted-foreground">Images save automatically as you upload, reorder or delete them.</span>
        </div>
      )}
    </div>
  )
}
