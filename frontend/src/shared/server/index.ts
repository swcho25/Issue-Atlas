import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { z } from "zod";

import { ApiError, apiGet } from "@/shared/api";

// 관리자 화면(서버 컴포넌트)에서 Spring API 를 부른다. 로그인 세션 쿠키(JSESSIONID)를 그대로 싣고 캐시하지 않는다.
// 그 사이 세션이 끝났거나 관리자가 아니면(401 · 403) 랜딩으로, 없는 대상(404)은 Next 의 404 로.
// next/headers 를 쓰므로 `@/shared/api` 묶음에 넣지 않는다(브라우저 쪽 코드가 같이 끌려가면 빌드가 막힌다)
export async function adminGet<S extends z.ZodType>(path: string, schema: S) {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    return await apiGet(path, schema, { headers: { cookie }, cache: "no-store" });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
