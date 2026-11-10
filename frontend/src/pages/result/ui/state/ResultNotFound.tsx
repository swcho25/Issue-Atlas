import { StateCard } from "./StateCard";

// 없는 결과(API 404 — 주소의 run_id 가 없거나 지워짐). getArgument 가 notFound() 를 부르면 이 화면
export function ResultNotFound() {
  return (
    <StateCard
      icon="search"
      tone="gray"
      title="결과를 찾을 수 없어요"
      reason="주소가 틀렸거나 지워진 결과예요"
      choices={[
        {
          label: "내 질문 보기",
          note: "내가 물은 질문과 실행 결과를 모아 볼 수 있어요.",
          href: "/me/questions",
        },
        {
          label: "새 질문 만들기",
          note: "지역 · 이슈 · 기간을 골라 다시 물어보세요.",
          href: "/ask",
        },
      ]}
    />
  );
}
