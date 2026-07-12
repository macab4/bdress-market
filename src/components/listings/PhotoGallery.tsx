'use client'

import { useState } from 'react'
import Image from 'next/image'

interface PhotoGalleryProps {
  photos: string[]
  title: string
}

export default function PhotoGallery({ photos, title }: PhotoGalleryProps) {
  const [active, setActive] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
        Sin fotos
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
        <Image
          src={photos[active]}
          alt={title}
          fill
          className="object-cover"
          priority
        />
      </div>
      {photos.length > 1 && (
        <div className="grid grid-cols-5 gap-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`aspect-square bg-gray-100 relative overflow-hidden border-2 transition ${
                active === i ? 'border-black' : 'border-transparent'
              }`}
            >
              <Image src={photo} alt={`${title} ${i + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
