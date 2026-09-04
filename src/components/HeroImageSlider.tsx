'use client'

import { useState, useEffect } from 'react'

const IMAGES = [
  '/images/slider-1.png',
  '/images/slider-2.png',
  '/images/slider-3.png',
  '/images/slider-4.png',
  '/images/slider-5.png',
]

export default function HeroImageSlider({ intervalMs = 3200 }: { intervalMs?: number }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % IMAGES.length), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      {IMAGES.map((src, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: idx === i ? 1 : 0,
            transition: 'opacity .7s ease',
          }}
        />
      ))}
    </div>
  )
}
