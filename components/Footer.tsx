'use client'

import { useState } from 'react'

export default function Footer() {
  const [subscribed, setSubscribed] = useState(false)

  return (
    <footer className="site">
      <div className="wrap foot-grid">
        <div>
          <h4>Customer service</h4>
          <ul>
            <li>Showroom: 12 Example Street, Kowloon</li>
            <li>Mon–Sat, 11:00–19:00</li>
            <li>WhatsApp: +852 0000 0000</li>
          </ul>
        </div>
        <div>
          <h4>Pages</h4>
          <ul>
            <li><a href="#">About us</a></li>
            <li><a href="#">Shipping</a></li>
            <li><a href="#">Returns</a></li>
            <li><a href="#">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4>Products</h4>
          <ul>
            <li><a href="#">Backpacks</a></li>
            <li><a href="#">Camping</a></li>
            <li><a href="#">Lighting</a></li>
            <li><a href="#">Travel</a></li>
          </ul>
        </div>
        <div>
          <h4>Newsletter</h4>
          <p style={{ margin: 0 }}>New arrivals and offers, once a month.</p>
          <form
            className="news"
            onSubmit={(e) => {
              e.preventDefault()
              setSubscribed(true)
            }}
          >
            <input id="email" type="email" placeholder="Your email" aria-label="Your email" required />
            <button type="submit">{subscribed ? 'Subscribed' : 'Subscribe'}</button>
          </form>
          <div className="social">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">ig</a>
            <a href="#" aria-label="YouTube">yt</a>
          </div>
        </div>
      </div>
      <div className="wrap foot-bottom">
        <span>© 2026 HELOO</span>
        <div className="pay">
          <span>VISA</span>
          <span>Mastercard</span>
          <span>PayMe</span>
          <span>FPS</span>
          <span>Octopus</span>
        </div>
      </div>
    </footer>
  )
}
