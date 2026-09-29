'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { setAvatar } from '@/lib/actions/account'
import { initials } from '@/lib/images'
import { prepareImage, uploadWithProgress, UploadError } from '@/lib/upload'

export function AvatarUploader({ userId, name, current }: { userId: string; name: string; current: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(current)
  const [progress, setProgress] = useState<number | null>(null)
  const [pending, start] = useTransition()

  async function onFile(file: File) {
    try {
      setProgress(0)
      const img = await prepareImage(file, { minWidth: 128, minHeight: 128, maxSize: 512, maxBytes: 8 * 1024 * 1024 })
      const publicUrl = await uploadWithProgress('avatars', `${userId}/${crypto.randomUUID()}.webp`, img.blob, setProgress)
      start(async () => {
        const res = await setAvatar(publicUrl)
        if (res.ok) {
          setUrl(publicUrl)
          toast.success('Avatar updated')
        } else toast.error(res.error)
      })
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : 'Upload failed. Please try again.')
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar className="size-20">
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => input.current?.click()} disabled={progress !== null || pending}>
            <Upload />
            {url ? 'Change avatar' : 'Upload avatar'}
          </Button>
          {url && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await setAvatar(null)
                if (res.ok) setUrl(null)
              })}
            >
              Remove
            </Button>
          )}
        </div>
        {progress !== null ? <Progress value={progress * 100} className="w-48" aria-label="Upload progress" /> : <p className="text-xs text-muted-foreground">JPG, PNG or WebP, at least 128×128.</p>}
      </div>
    </div>
  )
}
