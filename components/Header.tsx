'use client'

import { useState } from 'react'
import { useCart } from './CartContext'

const categories = [
  'Backpacks',
  'Travel gear',
  'Tents & shelters',
  'Sleeping bags',
  'Camp furniture',
  'Cooking',
  'Lighting',
  'Hydration',
  'Apparel',
  'Accessories',
]

const links = ['In stock', 'Clearance', 'Shipping', 'Blog', 'Membership', 'Contact']

export default function Header() {
  const { count } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)

  const toggleProducts = (e: React.MouseEvent) => {
    if (window.matchMedia('(max-width: 720px)').matches) {
      e.preventDefault()
      setProductsOpen((o) => !o)
    }
  }

  return (
    <header className="site">
      <div className="wrap head-row">
        <a className="logo" href="#">
          HELOO
        </a>
        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <input id="q" type="search" placeholder="Search products" aria-label="Search products" />
          <button type="submit">Search</button>
        </form>
        <div className="head-icons">
          <a href="#">Log in</a>
          <a className="cart" href="#">
            Cart <b>{count}</b>
          </a>
          <button
            className="menu-btn"
            aria-expanded={menuOpen}
            aria-controls="nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
      </div>
      <nav className={`main${menuOpen ? ' open' : ''}`} id="nav" aria-label="Main">
        <ul className="wrap">
          <li>
            <a href="#">Home</a>
          </li>
          <li className={productsOpen ? 'open' : undefined}>
            <a href="#" aria-haspopup="true" onClick={toggleProducts}>
              Products ▾
            </a>
            <ul className="dropdown">
              {categories.map((c) => (
                <li key={c}>
                  <a href="#">{c}</a>
                </li>
              ))}
            </ul>
          </li>
          {links.map((l) => (
            <li key={l}>
              <a href="#">{l}</a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
