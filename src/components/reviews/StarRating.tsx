import { Star } from 'lucide-react'

export default function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'fill-[#8DA988] text-[#8DA988]' : 'text-gray-200'}
        />
      ))}
    </div>
  )
}
