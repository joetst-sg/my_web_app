import 'server-only'
import { site } from '@/lib/site'
import type { Rendered } from './templates'

// Email provider abstraction. Add a provider by implementing `send` and
// selecting it in getEmailProvider(). The rest of the app only knows about
// the outbox table and this interface.
export interface EmailProvider {
  name: string
  send(to: string, email: Rendered): Promise<void>
}

class ConsoleProvider implements EmailProvider {
  name = 'console'
  async send(to: string, email: Rendered) {
    console.info(`[email:console] to=${to} subject="${email.subject}"\n${email.text}`)
  }
}

class ResendProvider implements EmailProvider {
  name = 'resend'
  constructor(private apiKey: string, private from: string) {}
  async send(to: string, email: Rendered) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject: email.subject, html: email.html, text: email.text }),
    })
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
}

// EMAIL_PROVIDER=resend|console (default: resend when a key is set, console
// in development, none in production).
export function getEmailProvider(): EmailProvider | null {
  const key = process.env.EMAIL_PROVIDER_API_KEY
  const choice = process.env.EMAIL_PROVIDER ?? (key ? 'resend' : process.env.NODE_ENV === 'production' ? 'none' : 'console')
  if (choice === 'resend' && key) return new ResendProvider(key, process.env.EMAIL_FROM ?? `${site.name} <notifications@example.com>`)
  if (choice === 'console') return new ConsoleProvider()
  return null
}
