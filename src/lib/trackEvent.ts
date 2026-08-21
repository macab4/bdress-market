// Fire-and-forget, nunca bloquea ni rompe la navegación del CTA que lo
// dispara — ver src/app/api/track/route.ts para qué eventos acepta.
export function trackEvent(event: string) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {})
}
