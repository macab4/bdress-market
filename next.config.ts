import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shareCard/index.ts e instagramStory/index.ts leen fuentes/logo con
  // fs.readFile(join(process.cwd(), ...)) en tiempo de ejecución — el
  // tracer de Next no detecta esas rutas dinámicas para incluirlas en el
  // bundle serverless de Vercel (por eso funcionaban en local pero
  // devolvían 500 en producción: assets/fonts y public/logo*.png no
  // viajaban con la función). Hay que declararlos a mano acá.
  // sharp ya está en la lista de paquetes que Next trata como "externos"
  // (no los mete en el bundle de webpack), pero en producción tiró
  // "Error: Could not load the sharp module" — el tracer de archivos de
  // Vercel no estaba llevándose los binarios nativos de sharp (los .node
  // compilados, distintos por plataforma) junto con la función. Se
  // incluyen a mano para las dos rutas que usan sharp (vía
  // instagramStory/imageValidation.ts) — mismo motivo que las fuentes/logo
  // de abajo.
  outputFileTracingIncludes: {
    '/api/listings/\\[id\\]/share-image': [
      './assets/fonts/**/*', './public/logo.png',
      './node_modules/sharp/**/*', './node_modules/@img/**/*',
    ],
    '/api/cron/instagram-story': [
      './assets/fonts/**/*', './public/logo-white.png',
      './node_modules/sharp/**/*', './node_modules/@img/**/*',
    ],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
