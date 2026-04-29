import type { NextConfig } from "next";
// import withPWAInit from '@ducanh2912/next-pwa';

// const withPWA = withPWAInit({
//   dest: 'public',
//   cacheOnFrontEndNav: true,
//   aggressiveFrontEndNavCaching: true,
//   reloadOnOnline: true,
//   disable: false,
//   workboxOptions: {
//     disableDevLogs: true,
//   },
// });

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // turbopack: {}, // Disabled due to NextAuth v4 compatibility issues with Next.js 16
  serverExternalPackages: ['@prisma/client', '.prisma/client', 'pg'],
  // Allow access from local network IPs and custom domains (dev mode host validation)
  allowedDevOrigins: ['*'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    // Image optimization
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  // Experimental optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      'recharts',
      'date-fns',
    ],
  },
  // Headers for caching and security
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Strict-Transport-Security',
        // Removed 'preload' and 'includeSubDomains': preload permanently locks mobile Safari
        // into HTTPS-only for 2 years with no bypass option — if SSL fails on any domain,
        // mobile gets "can't connect" with zero recovery path until the cache expires.
        value: 'max-age=31536000',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com",
          "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];

    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
          {
            key: 'Vary',
            value: 'Cookie, Authorization',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icon-:size.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Optimize output
  outputFileTracingIncludes: {
    '/api/**/*': ['./prisma/schema.prisma'],
  },
};

export default nextConfig;
// export default withPWA(nextConfig);
