import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, apiGet, myQuestionListSchema } from "@/shared/api";

// 내 질문 목록(서버 전용). 로그인한 사람의 것이라 서버 세션 쿠키(JSESSIONID)를 그대로 실어 부른다(AuthLayout 과 같은 방법).
// 그 사이 세션이 끝났으면(401) 랜딩으로
export async function getMyQuestions() {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    return await apiGet("/v1/me/questions", myQuestionListSchema, {
      headers: { cookie },
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/");
    throw e;
  }
}
