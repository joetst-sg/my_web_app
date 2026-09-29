'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { deleteCollection, reorderCollection, setInCollection, updateCollection } from '@/lib/actions/engagement'
import { productImageUrl } from '@/lib/images'

type Item = { id: string; name: string; slug: string; brand: string | null; image: string | null }

function Row({ item, onRemove, disabled }: { item: Item; onRemove: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-3 bg-background p-3 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${item.name}. Use space and arrow keys.`} className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing">
        <GripVertical className="size-4" />
      </button>
      {item.image && <Image src={productImageUrl(item.image)!} alt="" width={120} height={90} className="aspect-[4/3] w-16 rounded-md object-cover" />}
      <div className="min-w-0 flex-1">
        <Link href={`/products/${item.slug}`} className="font-medium hover:underline">{item.name}</Link>
        {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
      </div>
      <Button variant="ghost" size="icon-lg" aria-label={`Remove ${item.name}`} onClick={onRemove} disabled={disabled}><Trash2 /></Button>
    </li>
  )
}

export function CollectionEditor({
  collection,
  products,
}: {
  collection: { id: string; slug: string; title: string; description: string; visibility: string }
  products: Item[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(products)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  function save(formData: FormData) {
    setError(null)
    start(async () => {
      const res = await updateCollection(collection.id, {
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? ''),
        visibility: formData.get('public') === 'on' ? 'public' : 'private',
      })
      if (!res.ok) setError(res.error)
      else {
        toast.success('Collection saved')
        router.refresh()
      }
    })
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const next = arrayMove(items, items.findIndex((i) => i.id === e.active.id), items.findIndex((i) => i.id === e.over!.id))
    setItems(next)
    start(async () => {
      const res = await reorderCollection(collection.id, next.map((i) => i.id))
      if (!res.ok) toast.error(res.error)
    })
  }

  function remove(item: Item) {
    const before = items
    setItems(items.filter((i) => i.id !== item.id))
    start(async () => {
      const res = await setInCollection(collection.id, item.id, false)
      if (!res.ok) {
        setItems(before)
        toast.error(res.error)
      } else toast.success(`Removed ${item.name}`)
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/account/collections" className="hover:text-foreground">Your collections</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{collection.title}</h1>
        </div>
        <Button asChild variant="outline"><Link href={`/collections/${collection.slug}`}><ExternalLink />View collection</Link></Button>
      </div>

      <form action={save} className="grid max-w-2xl gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Name</Label>
          <Input id="title" name="title" defaultValue={collection.title} required minLength={2} maxLength={80} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" defaultValue={collection.description} maxLength={600} rows={3} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="public" name="public" defaultChecked={collection.visibility === 'public'} />
          <Label htmlFor="public" className="font-normal">Public — anyone with the link can see it</Label>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div><Button type="submit" size="lg" disabled={pending}>Save changes</Button></div>
      </form>

      <section aria-labelledby="products-h">
        <h2 id="products-h" className="font-sans text-lg font-semibold tracking-normal">Products ({items.length})</h2>
        <p className="mb-4 text-sm text-muted-foreground">Drag to reorder. Changes save automatically.</p>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No products yet. Use “Add to collection” on any product page.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y overflow-hidden rounded-2xl border">
                {items.map((item) => <Row key={item.id} item={item} onRemove={() => remove(item)} disabled={pending} />)}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section className="rounded-2xl border border-destructive/30 p-5">
        <h2 className="font-sans text-base font-semibold tracking-normal">Delete collection</h2>
        <p className="mt-1 text-sm text-muted-foreground">The products stay on Loupe; only this list is deleted.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-3">Delete collection</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{collection.title}”?</AlertDialogTitle>
              <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  start(async () => {
                    const res = await deleteCollection(collection.id)
                    if (!res.ok) toast.error(res.error)
                    else {
                      toast.success('Collection deleted')
                      router.push('/account/collections')
                    }
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}
