"use client";

import { useEffect } from "react";

import { StateCard } from "./StateCard";

// 결과를 불러오지 못했을 때(API 500 · 시간 초과 · 응답 형식 불일치 — 404 는 ResultNotFound).
// Next 16 error 경계: Client Component, props error · retry(구간을 다시 받아 그린다).
// 서버에서 난 오류는 운영에서 메시지가 감춰지고 digest(서버 기록과 맞출 번호)만 온다 — 그 번호를 적어 둔다
export function ResultError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateCard
      role="alert"
      icon="alert"
      tone="red"
      title="결과를 불러오지 못했어요"
      reason={[
        "서버가 잠시 응답하지 않았거나 결과 형식이 맞지 않아요",
        digest && `오류 번호 ${digest}`,
      ]
        .filter(Boolean)
        .join(" · ")}
      choices={[
        {
          label: "다시 시도",
          note: "같은 결과를 한 번 더 불러와요. 질문을 다시 실행하지는 않아요.",
          onClick: retry,
        },
        {
          label: "내 질문으로",
          note: "질문은 내 질문에 저장돼요. 나중에 다시 열 수 있어요.",
          href: "/me/questions",
        },
      ]}
    />
  );
}
