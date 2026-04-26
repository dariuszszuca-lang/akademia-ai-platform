/** @type {import('next').NextConfig} */

const securityHeaders = [
  // HSTS - wymuszamy HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Anty-clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Anty MIME sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Referrer
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Wylacz dostep do kamery/mikrofonu/geolokalizacji ktorych i tak nie uzywamy
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // DNS prefetch dla performance
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // Wyłączamy x-powered-by zeby nie ujawniac ze to Next.js
  poweredByHeader: false,
}

export default nextConfig
