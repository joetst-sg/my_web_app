'use client'

import { Check, Copy, Mail, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { trackEvent } from '@/lib/actions/engagement'

export function ShareButton({ url, title, productId, className }: { url: string; title: string; productId?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const track = (channel: string) => {
    if (productId) void trackEvent({ event: 'product_share', productId, channel }).catch(() => {})
  }
  const enc = encodeURIComponent
  const targets = [
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['x', 'X', `https://x.com/intent/post?url=${enc(url)}&text=${enc(title)}`],
    ['linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(`${title} ${url}`)}`],
  ] as const

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the address bar and copy the link instead.')
    }
    track('copy_link')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className={className} aria-label={`Share ${title}`}>
          <Share2 />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void copy() }}>
          {copied ? <Check /> : <Copy />}
          Copy link
        </DropdownMenuItem>
        {targets.map(([key, label, href]) => (
          <DropdownMenuItem key={key} asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(key)}>{label}</a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <a href={`mailto:?subject=${enc(title)}&body=${enc(url)}`} onClick={() => track('email')}>
            <Mail />
            Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
