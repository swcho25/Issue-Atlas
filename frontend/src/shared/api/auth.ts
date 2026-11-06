import { z } from "zod";

// 로그인한 사람(백엔드 MeResponse). POST /v1/auth/login · GET /v1/auth/me 가 같은 모양을 준다.
// 로그인은 서버 세션 쿠키(JSESSIONID, HttpOnly) 방식이라 화면은 쿠키를 읽지 못한다. 로그인 여부는 /v1/auth/me 의 401 로 안다
export const meSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export type Me = z.infer<typeof meSchema>;

/** 로그인한 뒤 가는 첫 화면: 관리자는 운영 요약, 그 밖은 새 질문. 로그인 창과 랜딩 앞(proxy)이 같이 쓴다 */
export const homeOf = (me: Me) => (me.role === "ADMIN" ? "/admin" : "/ask");
