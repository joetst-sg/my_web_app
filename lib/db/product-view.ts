import 'server-only'
import type { ProductView } from '@/components/product/product-detail-view'
import { productImageUrl } from '@/lib/images'
import type { ProductDetail } from './products'

// Normalises a product row (with relations) into the shape the product page,
// the seller preview and the editor preview all render.
export function toProductView(p: ProductDetail): ProductView {
  const price = p.pricing?.price ?? p.price
  const compareAt = p.pricing?.compare_at_price ?? p.original_price
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    key_features: p.key_features ?? [],
    benefits: p.benefits ?? [],
    currency: p.currency,
    price: price === null ? null : Number(price),
    compareAt: compareAt === null || compareAt === undefined ? null : Number(compareAt),
    discount: p.pricing?.discount_percent ?? 0,
    availability: p.availability,
    status: p.status,
    published_at: p.published_at,
    external_url: p.external_url,
    dealEndsAt: p.pricing?.deal_id ? p.pricing.deal_ends_at : null,
    brand: p.brand
      ? { ...p.brand, social_links: (p.brand.social_links ?? {}) as Record<string, string> }
      : null,
    images: p.images.map((i) => ({
      id: i.id,
      src: productImageUrl(i.storage_path)!,
      alt: i.alt || p.name,
      width: i.width ?? 1200,
      height: i.height ?? 900,
    })),
    videos: p.videos.map((v) => ({ id: v.id, url: v.url, title: v.title })),
    specs: p.specs.map((s) => ({ label: s.label, value: s.value })),
    category: p.primaryCategory ? { slug: p.primaryCategory.slug, name: p.primaryCategory.name } : null,
    tags: (p.tags ?? []).map((t) => t.tag).filter((t): t is { slug: string; name: string } => Boolean(t)),
    score: p.score
      ? {
          overall: Number(p.score.overall),
          design: p.score.design === null ? null : Number(p.score.design),
          innovation: p.score.innovation === null ? null : Number(p.score.innovation),
          usability: p.score.usability === null ? null : Number(p.score.usability),
          value: p.score.value === null ? null : Number(p.score.value),
          features: p.score.features === null ? null : Number(p.score.features),
          verdict: p.score.verdict,
        }
      : null,
  }
}
