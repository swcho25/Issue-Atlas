import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, apiGet, meSchema, myQuestionListSchema } from "@/shared/api";

// 마이페이지(서버 전용): 로그인한 사람(/v1/auth/me)과 그 사람의 질문(/v1/me/questions)을 함께 받는다.
// 서버 세션 쿠키(JSESSIONID)를 그대로 실어 부르고(AuthLayout 과 같은 방법), 그 사이 세션이 끝났으면(401) 랜딩으로
export async function getAccount() {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const init = { headers: { cookie }, cache: "no-store" } as const;
  try {
    const [me, { questions }] = await Promise.all([
      apiGet("/v1/auth/me", meSchema, init),
      apiGet("/v1/me/questions", myQuestionListSchema, init),
    ]);
    return { me, questions };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/");
    throw e;
  }
}
