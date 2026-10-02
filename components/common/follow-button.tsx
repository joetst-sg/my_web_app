'use client'

import { Check, Plus } from 'lucide-react'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/provider'
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
  const t = useT()
  const [following, setFollowing] = useState(initialFollowing)
  const [optimistic, setOptimistic] = useOptimistic(following)
  const [pending, start] = useTransition()
  const [loginOpen, setLoginOpen] = useState(false)
  const isCollection = kind === 'collection'

  function onClick() {
    const next = !following
    start(async () => {
      setOptimistic(next)
      const res = isCollection ? await toggleCollectionFollow(id, next) : await toggleFollow(kind, id, next)
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) setLoginOpen(true)
        else toast.error(res.error)
        return
      }
      setFollowing(next)
      toast.success(
        isCollection
          ? t(next ? 'follow.savedCollectionToast' : 'follow.removedCollectionToast', { name })
          : t(next ? 'follow.followingToast' : 'follow.unfollowedToast', { name }),
      )
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
        {isCollection ? t(optimistic ? 'follow.savedCollection' : 'follow.saveCollection') : t(optimistic ? 'follow.following' : 'follow.follow')}
      </Button>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason="loginPrompt.reasonFollow" />
    </>
  )
}
