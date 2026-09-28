import Header from '@/components/Header'
import HeroCarousel from '@/components/HeroCarousel'
import ProductSection from '@/components/ProductSection'
import Footer from '@/components/Footer'
import { CartProvider } from '@/components/CartContext'
import { sections } from '@/lib/products'

export default function Home() {
  return (
    <CartProvider>
      <div className="topbar">
        <div className="wrap">
          <span>Free delivery on orders over HK$800</span>
          <span>
            <a href="#">中文</a> | <a href="#">English</a>
          </span>
        </div>
      </div>

      <Header />

      <main>
        <HeroCarousel />

        <section className="block">
          <div className="wrap story">
            <div className="story-img">
              <span>HELOO</span>
            </div>
            <div>
              <h2>Our story</h2>
              <p>
                HELOO started as a small group of hikers who wanted better gear without the wait. We test what we
                sell on real trails before it goes on the shelf.
              </p>
              <p>Visit our showroom to try packs and tents in person, or order online for delivery across Hong Kong.</p>
              <a className="btn red" href="#">
                Read more
              </a>
            </div>
          </div>
        </section>

        {sections.map((section, i) => (
          <ProductSection key={section.title} section={section} index={i} />
        ))}
      </main>

      <Footer />
    </CartProvider>
  )
}
