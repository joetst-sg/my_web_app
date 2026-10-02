'use client'

import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteDraft } from '@/lib/actions/seller'

export function DeleteDraftButton({ productId }: { productId: string }) {
  const router = useLocalizedRouter()
  const t = useT()
  const [pending, start] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}><Trash2 />{t('seller.deleteDraft.button')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('seller.deleteDraft.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('seller.deleteDraft.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const res = await deleteDraft(productId)
                if (!res.ok) toast.error(res.error)
                else {
                  toast.success(t('act.draftDeleted'))
                  router.push('/seller/products')
                }
              })
            }
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
