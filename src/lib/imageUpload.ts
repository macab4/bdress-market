import type { Area } from 'react-easy-crop'

// Reduce el peso de una foto recién subida (redimensiona y comprime a JPEG)
// antes de guardarla — así no dependemos de que Vercel la optimice al vuelo.
// Si algo falla o el resultado queda más pesado que el original, se usa tal cual.
export async function compressImage(file: File, maxDimension = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  if (!bitmap) return file

  let { width, height } = bitmap
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

// Recorta una imagen a partir del área elegida en el editor y devuelve un JPEG.
export async function getCroppedImageBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = document.createElement('img')
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    image.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = area.width
  canvas.height = area.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar el recorte')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo procesar el recorte'))), 'image/jpeg', 0.92)
  })
}
