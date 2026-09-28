// Example products (placeholder content) until real data comes from Supabase.

export type Product = {
  name: string
  price: number
  salePrice?: number
}

export type Section = {
  title: string
  alt?: boolean
  items: Product[]
}

export const swatches = ['#d81e1e', '#2f6b45', '#2d4f8a', '#c46a00', '#5b3a8a', '#1f7a7a', '#8a2d4f', '#445066']

export const sections: Section[] = [
  {
    title: 'Travel',
    items: [
      { name: 'Packable daypack 20L', price: 380 },
      { name: 'Cable organiser pouch', price: 120 },
      { name: 'Compression packing cubes (set of 3)', price: 260 },
      { name: 'Neck pillow', price: 180 },
    ],
  },
  {
    title: 'Clearance',
    alt: true,
    items: [
      { name: 'Trekking poles, carbon', price: 680, salePrice: 450 },
      { name: 'Rain shell jacket', price: 980, salePrice: 590 },
      { name: 'Dry bag 10L', price: 160, salePrice: 90 },
      { name: 'Camp mug', price: 98, salePrice: 60 },
    ],
  },
  {
    title: 'Hiking & camping',
    items: [
      { name: '2-person dome tent', price: 1680 },
      { name: 'Ultralight sleeping mat', price: 720 },
      { name: 'Folding camp chair', price: 460 },
      { name: 'Down sleeping bag, 5°C', price: 1380 },
    ],
  },
  {
    title: 'Bags & backpacks',
    alt: true,
    items: [
      { name: 'Trail pack 35L', price: 980 },
      { name: 'Waterproof roll-top 25L', price: 560 },
      { name: 'Hip pack', price: 240 },
      { name: 'Hydration vest 8L', price: 620 },
    ],
  },
  {
    title: 'Lighting',
    items: [
      { name: 'Rechargeable headlamp 400lm', price: 320 },
      { name: 'Camp lantern', price: 280 },
      { name: 'String lights, USB', price: 150 },
      { name: 'Pocket torch', price: 180 },
    ],
  },
  {
    title: 'New arrivals',
    alt: true,
    items: [
      { name: 'Titanium cook pot', price: 420 },
      { name: 'Insulated bottle 750ml', price: 260 },
      { name: 'Sun hoodie', price: 390 },
      { name: 'Trail runner socks (2 pairs)', price: 140 },
    ],
  },
]
