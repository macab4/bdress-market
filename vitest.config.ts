import { defineConfig } from 'vitest/config'
import path from 'path'

// Cobertura mínima de lógica pura y aislable (margen, transiciones de
// estado internacional, cálculo de fees) — no hay infraestructura para
// probar automáticamente webhooks/pagos/condiciones de carrera reales
// (necesitaría mockear Supabase + sandbox de Mercado Pago); esos flujos
// quedan cubiertos por el checklist de QA manual de la entrega.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})
