import { Star } from 'lucide-react'

interface Props {
  rating: number
  count: number
  size?: number
}

export default function RatingBadge({ rating, count, size = 12 }: Props) {
  if (count === 0) return null

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
      <Star size={size} className="fill-[#8DA988] text-[#8DA988]" />
      {rating.toFixed(1)}
      <span className="text-gray-300">({count})</span>
    </span>
  )
}
