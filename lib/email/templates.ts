import { site } from '@/lib/site'

// Transactional email templates. Every dynamic value is HTML-escaped.
// Sign-up confirmation, password reset and email change are sent by
// Supabase Auth itself (see supabase/templates/).

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const link = (path: unknown) => {
  const p = String(path ?? '/')
  return p.startsWith('/') ? `${site.url}${p}` : site.url
}

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4">
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1b1d24;background:#fff">
<p style="font-size:20px;font-weight:700;margin:0 0 24px">${esc(site.name)}</p>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6">${body}</div>
${cta ? `<p style="margin:28px 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#1b1d24;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(cta.label)}</a></p>` : ''}
<p style="font-size:12px;color:#6b6f7b;margin-top:32px">You're receiving this because you have an account on ${esc(site.name)}. Manage email preferences at ${esc(`${site.url}/account/preferences`)}.</p>
</div></body></html>`
}

type Payload = Record<string, unknown>
export type Rendered = { subject: string; html: string; text: string }

export const templates: Record<string, (p: Payload) => Rendered> = {
  welcome: (p) => ({
    subject: `Welcome to ${site.name}`,
    html: layout(`Welcome${p.display_name ? `, ${esc(p.display_name)}` : ''}`, `<p>Your account is ready. Follow categories and brands to build your feed, save products for later and set reminders for launches and sales.</p>`, { label: 'Explore products', href: link('/discover') }),
    text: `Welcome to ${site.name}. Explore products: ${link('/discover')}`,
  }),
  submission_received: (p) => ({
    subject: `We received “${p.product_name}”`,
    html: layout('Submission received', `<p>Thanks for submitting <strong>${esc(p.product_name)}</strong>. An editor will review it, usually within a few days. We'll email you when there's an update.</p>`, { label: 'View submission', href: link(p.link) }),
    text: `We received "${p.product_name}". Track it: ${link(p.link)}`,
  }),
  changes_requested: (p) => ({
    subject: `Changes requested for “${p.product_name}”`,
    html: layout('An editor asked for changes', `<p>Before we can publish <strong>${esc(p.product_name)}</strong>, please update the following:</p><blockquote style="border-left:4px solid #e8b04a;margin:16px 0;padding:4px 16px;color:#333">${esc(p.message)}</blockquote><p>Your draft is saved. Update it and resubmit when you're ready.</p>`, { label: 'Update submission', href: link(p.link) }),
    text: `Changes requested for "${p.product_name}": ${p.message}\n${link(p.link)}`,
  }),
  product_approved: (p) => ({
    subject: `“${p.product_name}” was approved`,
    html: layout('Your product was approved', `<p><strong>${esc(p.product_name)}</strong> passed editorial review and will be published soon.</p>`, { label: 'View submission', href: link(p.link) }),
    text: `"${p.product_name}" was approved. ${link(p.link)}`,
  }),
  product_rejected: (p) => ({
    subject: `Update on “${p.product_name}”`,
    html: layout('Your submission was not accepted', `<p>We're not able to publish <strong>${esc(p.product_name)}</strong>. The editor's note:</p><blockquote style="border-left:4px solid #d0d0d0;margin:16px 0;padding:4px 16px;color:#333">${esc(p.message)}</blockquote><p>You can reply to the editors from the submission page.</p>`, { label: 'View submission', href: link(p.link) }),
    text: `"${p.product_name}" was not accepted: ${p.message}\n${link(p.link)}`,
  }),
  product_published: (p) => ({
    subject: `“${p.product_name}” is live on ${site.name}`,
    html: layout('Your product is live', `<p><strong>${esc(p.product_name)}</strong> is now published. Share the link and track views and clicks in your seller dashboard.</p>`, { label: 'See it live', href: link(p.link) }),
    text: `"${p.product_name}" is live: ${link(p.link)}`,
  }),
  price_drop: (p) => ({
    subject: `Price drop: ${p.product_name}`,
    html: layout(`${esc(p.product_name)} just got cheaper`, `<p>A product you saved dropped from <s>${esc(p.currency)} ${esc(p.old_price)}</s> to <strong>${esc(p.currency)} ${esc(p.new_price)}</strong>.</p>`, { label: 'View product', href: link(p.link) }),
    text: `${p.product_name}: now ${p.currency} ${p.new_price} (was ${p.old_price}). ${link(p.link)}`,
  }),
  reminder: (p) => ({
    subject: p.type === 'launch' ? `${p.product_name} is available now` : p.type === 'sale' ? `${p.product_name} is on sale` : `Reminder: ${p.product_name}`,
    html: layout(
      p.type === 'launch' ? `${esc(p.product_name)} has launched` : p.type === 'sale' ? `${esc(p.product_name)} is on sale` : `Your reminder for ${esc(p.product_name)}`,
      `<p>You asked us to remind you about this product.</p>`,
      { label: 'View product', href: link(p.link) },
    ),
    text: `Reminder: ${p.product_name} ${link(p.link)}`,
  }),
}

// Used to check that email delivery works end to end.
templates.test = () => ({
  subject: `${site.name} email test`,
  html: layout('Email delivery works', `<p>This is a test message from ${esc(site.name)}. If you can read it, notification emails are being delivered.</p>`),
  text: `This is a test message from ${site.name}. Notification emails are being delivered.`,
})

export function renderEmail(template: string, payload: Payload): Rendered | null {
  const fn = templates[template]
  return fn ? fn(payload ?? {}) : null
}
