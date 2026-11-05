import type { NextConfig } from "next";
import path from "node:path";

// 서버 전용 주소. src/shared/config 의 API_BASE_URL 과 같은 값이다.
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
// OpenNext #1450/#1318: Cache Components의 staged render가 workerd에서 멈출 수 있다.
// Workers에서만 이 최적화를 끈다. 서버 컴포넌트·SSR·일반 로컬 개발은 유지한다.
const workersBuild = process.env.ISSUEATLAS_WORKERS_BUILD === "1";
const ec2Build = process.env.ISSUEATLAS_EC2_BUILD === "1";

const nextConfig: NextConfig = {
  ...(ec2Build
    ? { output: "standalone", outputFileTracingRoot: path.resolve(import.meta.dirname, "..") }
    : {}),
  cacheComponents: !workersBuild,
  partialPrefetching: !workersBuild,
  // 브라우저는 같은 출처의 /api/* 만 부르고, Next 서버가 Spring 으로 넘긴다(CORS · 주소 노출 없음).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiBaseUrl}/:path*` }];
  },
};

export default nextConfig;
