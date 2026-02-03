import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 보안 헤더
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // 이미지 최적화 설정
  images: {
    // 최신 이미지 포맷 사용 (AVIF > WebP > 원본)
    formats: ['image/avif', 'image/webp'],

    // 디바이스 크기별 이미지 생성
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],

    // 작은 이미지용 크기
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Supabase Storage 및 기타 도메인
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],

    // 이미지 캐시 TTL (초)
    minimumCacheTTL: 60 * 60 * 24,  // 24시간

    // 동시 이미지 최적화 제한
    // dangerouslyAllowSVG: true,  // SVG 허용 (필요시)
  },

  // 실험적 기능
  experimental: {
    // Next.js 15에서는 serverActions가 기본 활성화
  },

  // 빌드 최적화
  poweredByHeader: false,

  // 번들 최적화
  compiler: {
    // 프로덕션에서 console.log 제거
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // 모듈 최적화
  modularizeImports: {
    // Lucide 아이콘 트리쉐이킹
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // 번들 분석 (ANALYZE=true npm run build 로 실행)
  // 사용법: ANALYZE=true npm run build

  // 출력 최적화
  output: 'standalone',

  // 성능 최적화 (프로덕션)
  productionBrowserSourceMaps: false,  // 소스맵 비활성화 (보안+성능)
};

export default nextConfig;
