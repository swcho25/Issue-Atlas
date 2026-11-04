import { browserPost } from "@/shared/api";

import { meSchema } from "../model/schema";

/** 이메일 · 비밀번호로 로그인한다. 세션 쿠키는 응답이 심고, 틀리면 ApiError(401) */
export function login(email: string, password: string) {
  return browserPost("/v1/auth/login", { email, password }, meSchema);
}
