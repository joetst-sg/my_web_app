'use client'

import { Check, Plus } from 'lucide-react'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoginPrompt } from '@/components/common/login-prompt'
import { toggleCollectionFollow, toggleFollow } from '@/lib/actions/engagement'
import { LOGIN_REQUIRED } from '@/lib/errors'

export function FollowButton({
  kind,
  id,
  name,
  initialFollowing,
  className,
  size = 'lg',
}: {
  kind: 'brand' | 'category' | 'collection'
  id: string
  name: string
  initialFollowing: boolean
  className?: string
  size?: 'lg' | 'default' | 'sm'
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [optimistic, setOptimistic] = useOptimistic(following)
  const [pending, start] = useTransition()
  const [loginOpen, setLoginOpen] = useState(false)
  const verb = kind === 'collection' ? ['Save collection', 'Saved'] : ['Follow', 'Following']

  function onClick() {
    const next = !following
    start(async () => {
      setOptimistic(next)
      const res = kind === 'collection' ? await toggleCollectionFollow(id, next) : await toggleFollow(kind, id, next)
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) setLoginOpen(true)
        else toast.error(res.error)
        return
      }
      setFollowing(next)
      toast.success(next ? `${kind === 'collection' ? 'Saved' : 'Following'} ${name}` : `${kind === 'collection' ? 'Removed' : 'Unfollowed'} ${name}`)
    })
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={optimistic ? 'outline' : 'default'}
        aria-pressed={optimistic}
        onClick={onClick}
        disabled={pending}
        className={className}
      >
        {optimistic ? <Check /> : <Plus />}
        {optimistic ? verb[1] : verb[0]}
      </Button>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason={`follow ${name} and get a personalised feed`} />
    </>
  )
}
