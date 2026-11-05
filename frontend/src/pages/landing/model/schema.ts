import { z } from "zod";

/** POST /v1/auth/login 응답(백엔드 MeResponse). 화면은 역할로 갈 곳을 정한다 */
export const meSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export type Me = z.infer<typeof meSchema>;

/** 로그인한 뒤 가는 곳: 관리자는 운영 요약, 그 밖은 새 질문 */
export const homeOf = (me: Me) => (me.role === "ADMIN" ? "/admin" : "/ask");
