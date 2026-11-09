import { yearSpan } from "@/entities/argument";
import type { Me, MyQuestion } from "@/shared/api";

// 한국 날짜의 월-일(11-08). 서버 표기(Z · +09:00)가 달라도 같은 날로
const monthDay = (iso: string) =>
  new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(5, 10);

export const roleLabel: Record<Me["role"], string> = { ADMIN: "관리자", VIEWER: "조회자" };

/** 숫자 셋: 저장한 질문 · 실행(새 이슈 후보까지 모든 회차) · 새 이슈 후보 */
export function counts(questions: MyQuestion[]) {
  const saved = questions.filter((q) => !q.candidate);
  return [
    { label: "저장한 질문", value: saved.length },
    { label: "실행", value: questions.reduce((n, q) => n + q.runs.length, 0) },
    { label: "새 이슈 후보", value: questions.length - saved.length },
  ];
}

/**
 * 최근 질문: 실행한 적 있는 저장한 질문을 응답 순서(마지막 실행이 새것부터) 그대로 앞에서 몇 개.
 * 아래 글은 내 질문 화면과 같은 차례(기간 · 회차 · 마지막 실행 날짜). 누르면 마지막 회차 결과로 간다
 */
export function recentQuestions(questions: MyQuestion[], limit = 3) {
  return questions
    .filter((q) => !q.candidate && q.runs.length > 0)
    .slice(0, limit)
    .map((q) => ({
      id: q.question_id,
      title: [q.place_name, q.card_name].join(" · "),
      meta: [
        yearSpan(q.period_start, q.period_end),
        `${q.runs.length}회`,
        monthDay(q.runs[0].created_at),
      ].join(" · "),
      href: `/results/${encodeURIComponent(q.runs[0].run_id)}`,
    }));
}
