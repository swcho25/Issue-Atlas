import type { Me } from "@/shared/api";

// 로그인 응답 모양(meSchema)은 로그인 확인(AuthLayout)과 함께 쓰여 @/shared/api 로 옮겼다
export { type Me, meSchema } from "@/shared/api";

/** 로그인한 뒤 가는 곳: 관리자는 운영 요약, 그 밖은 새 질문 */
export const homeOf = (me: Me) => (me.role === "ADMIN" ? "/admin" : "/ask");
