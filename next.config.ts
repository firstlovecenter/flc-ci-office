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
    ],
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  // Optimize output
  outputFileTracingIncludes: {
    '/api/**/*': ['./prisma/schema.prisma'],
  },
};

export default nextConfig;
// export default withPWA(nextConfig);
