'use client'

import { useCallback, useEffect, useState } from 'react'

const slides = [
  {
    className: 's1',
    title: 'Gear up for the weekend',
    text: 'Tents, packs and lights for every trail in Hong Kong.',
    cta: 'Shop new arrivals',
  },
  {
    className: 's2',
    title: 'Camp season is here',
    text: 'Everything you need for a night at Sai Kung, in one cart.',
    cta: 'Shop camping',
  },
  {
    className: 's3',
    title: 'Travel light, travel far',
    text: 'Packable bags and organisers that fit carry-on limits.',
    cta: 'Shop travel',
  },
]

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  // Bumped on manual navigation so the autoplay timer restarts.
  const [manual, setManual] = useState(0)

  const go = useCallback((i: number) => {
    setCurrent((i + slides.length) % slides.length)
    setManual((m) => m + 1)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000)
    return () => clearInterval(timer)
  }, [manual])

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured">
      <div className="slides" style={{ transform: `translateX(-${current * 100}%)` }}>
        {slides.map((s) => (
          <div key={s.className} className={`slide ${s.className}`}>
            <div className="wrap">
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <a className="btn" href="#">
                {s.cta}
              </a>
            </div>
          </div>
        ))}
      </div>
      <button className="hero-arrow prev" aria-label="Previous slide" onClick={() => go(current - 1)}>
        ‹
      </button>
      <button className="hero-arrow next" aria-label="Next slide" onClick={() => go(current + 1)}>
        ›
      </button>
      <div className="dots">
        {slides.map((s, i) => (
          <button
            key={s.className}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === current}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  )
}
