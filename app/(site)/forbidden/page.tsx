import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'No access', robots: { index: false } }

export default function ForbiddenPage() {
  return (
    <div className="container-page py-20">
      <EmptyState icon={ShieldAlert} title="You don't have permission to view this page." description="This area is for Loupe editors and administrators." action={<Button asChild><Link href="/">Go to the homepage</Link></Button>} />
    </div>
  )
}
