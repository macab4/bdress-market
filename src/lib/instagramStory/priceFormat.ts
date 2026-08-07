export function formatStoryPrice(price: number): string {
  return `$${Math.round(price).toLocaleString('es-CL')}`
}
