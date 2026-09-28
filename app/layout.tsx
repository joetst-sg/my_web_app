import type { Metadata } from 'next'
import { Bagel_Fat_One, Figtree } from 'next/font/google'
import './globals.css'

const display = Bagel_Fat_One({ weight: '400', subsets: ['latin'], variable: '--font-display' })
const body = Figtree({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'HELOO Store',
  description: 'Outdoor and travel gear, delivered across Hong Kong.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
