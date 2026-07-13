'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ReviewFormProps {
  orderId: string
  reviewedId: string
  reviewedName: string
}

export default function ReviewForm({ orderId, reviewedId, reviewedName }: ReviewFormProps) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError('Selecciona una calificación'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error: insertError } = await supabase.from('reviews').insert({
      reviewer_id: user.id,
      reviewed_id: reviewedId,
      order_id: orderId,
      rating,
      comment: comment.trim() || null,
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }

    setSubmitted(true)
    setLoading(false)
    router.refresh()
  }

  if (submitted) {
    return <p className="text-xs text-[#5a7a55] mt-2">¡Gracias por tu reseña!</p>
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      <p className="text-xs text-gray-500">Califica a {reviewedName}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(i)}
            aria-label={`${i} estrellas`}>
            <Star size={20} className={i <= (hovered || rating) ? 'fill-[#8DA988] text-[#8DA988]' : 'text-gray-200'} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)}
        rows={2} placeholder="Comenta cómo fue la experiencia (opcional)"
        className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" disabled={loading}
        className="text-[10px] tracking-widest uppercase bg-black text-white px-4 py-2 hover:bg-gray-800 transition disabled:opacity-50">
        {loading ? 'Enviando...' : 'Enviar reseña'}
      </button>
    </form>
  )
}
