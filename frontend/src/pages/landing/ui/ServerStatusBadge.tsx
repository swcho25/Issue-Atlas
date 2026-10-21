"use client";

import { useQuery } from "@tanstack/react-query";

import { serverStatusQuery } from "../api/serverStatusQuery";

export function ServerStatusBadge() {
  const { data, isPending, isError } = useQuery(serverStatusQuery);

  // 응답이 없거나 계약과 다른 경우(isError)와, 응답은 왔지만 UP 이 아닌 경우를 나눠 보여 준다
  const label = isPending
    ? "서버 확인 중"
    : isError
      ? "서버 응답 없음"
      : data.status === "UP"
        ? "서버 정상"
        : "서버 점검 중";

  return (
    <p role="status" className="rounded-full border px-3 py-1 text-xs opacity-80">
      {label}
    </p>
  );
}
