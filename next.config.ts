import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shareCard/index.ts e instagramStory/index.ts leen fuentes/logo con
  // fs.readFile(join(process.cwd(), ...)) en tiempo de ejecución — el
  // tracer de Next no detecta esas rutas dinámicas para incluirlas en el
  // bundle serverless de Vercel (por eso funcionaban en local pero
  // devolvían 500 en producción: assets/fonts y public/logo*.png no
  // viajaban con la función). Hay que declararlos a mano acá.
  outputFileTracingIncludes: {
    '/api/listings/\\[id\\]/share-image': ['./assets/fonts/**/*', './public/logo.png'],
    '/api/cron/instagram-story': ['./assets/fonts/**/*', './public/logo-white.png'],
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
