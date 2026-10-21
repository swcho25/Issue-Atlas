import type { NextConfig } from "next";

// 서버 전용 주소. src/shared/config 의 API_BASE_URL 과 같은 값이다.
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 브라우저는 같은 출처의 /api/* 만 부르고, Next 서버가 Spring 으로 넘긴다(CORS · 주소 노출 없음).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiBaseUrl}/:path*` }];
  },
};

export default nextConfig;
