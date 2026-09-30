import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

export const alt = `${site.name} — ${site.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Default social preview for pages without their own image.
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#ffffff', color: '#1b1d24', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, border: '8px solid #1b1d24', background: '#e8b04a' }} />
          <div style={{ fontSize: 56, fontWeight: 800 }}>{site.name}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 950 }}>{site.tagline}</div>
        <div style={{ fontSize: 28, color: '#6b6f7b' }}>Gadgets, smart home, audio, travel and more — reviewed by editors.</div>
      </div>
    ),
    size,
  )
}
