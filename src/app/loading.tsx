export default function Loading() {
  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="bg-black py-10" />
      <div className="bg-white border-b border-gray-100 h-[72px]" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white">
              <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 bg-gray-100 animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
