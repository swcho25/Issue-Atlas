import type { Me, MyQuestion } from "@/shared/api";

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
