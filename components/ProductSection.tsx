'use client'

import { useState } from 'react'
import { useCart } from './CartContext'
import { swatches, type Product, type Section } from '@/lib/products'

function ProductCard({ product, color, preorder }: { product: Product; color: string; preorder: boolean }) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const { name, price, salePrice } = product

  return (
    <article className="card">
      <div className="img" style={{ background: color }}>
        <span className={`tag ${preorder ? 'preorder' : 'instock'}`}>{preorder ? 'Pre-order' : 'In stock'}</span>
        {salePrice && <span className="tag sale">Sale</span>}
        Photo
      </div>
      <div className="body">
        <h3>{name}</h3>
        <div className="price">
          {salePrice ? (
            <>
              <span className="now">HK${salePrice}</span>
              <s>HK${price}</s>
            </>
          ) : (
            `HK$${price}`
          )}
        </div>
        <button
          className={`add${added ? ' done' : ''}`}
          onClick={() => {
            if (added) return
            add()
            setAdded(true)
          }}
        >
          {added ? 'Added' : 'Add to cart'}
        </button>
      </div>
    </article>
  )
}

export default function ProductSection({ section, index }: { section: Section; index: number }) {
  return (
    <section className={`block${section.alt ? ' alt' : ''}`}>
      <div className="wrap">
        <div className="sec-head">
          <h2>{section.title}</h2>
          <a href="#">View all →</a>
        </div>
        <div className="grid">
          {section.items.map((product, i) => (
            <ProductCard
              key={product.name}
              product={product}
              color={swatches[(index * 2 + i) % swatches.length]}
              preorder={(index + i) % 3 === 2}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
