import { Suspense } from "react";

import { getMyQuestions } from "../api/getMyQuestions";
import { MyQuestionsView } from "./MyQuestionsView";

// /me/questions — 06 · 내 질문. 목록은 서버에서 세션 쿠키로 받고(결과를 읽는 화면), 고르기 · 다시 실행 · 회차 비교는 MyQuestionsView.
// Cache Components: 쿠키 · 데이터 읽기는 <Suspense> 안에서 한다
export function MyQuestionsPage() {
  return (
    <main className="relative h-full overflow-hidden bg-bg-app">
      <Suspense
        fallback={<p className="px-7 pt-6 text-body-13 text-text-3">내 질문을 불러오는 중이에요</p>}
      >
        <MyQuestionsContent />
      </Suspense>
    </main>
  );
}

async function MyQuestionsContent() {
  const { questions } = await getMyQuestions();
  return <MyQuestionsView questions={questions} />;
}
