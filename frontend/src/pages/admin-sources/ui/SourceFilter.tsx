"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { JobStatus } from "@/shared/api";

import { sourcesHref } from "../model/query";

// 수집 기록 출처 거르기: 고르면 주소(?source)를 바꾼다. 위 출처 상태 표의 줄을 누르는 것과 같은 주소라 둘이 늘 같은 값이다
export function SourceFilter({
  sources,
  value,
  status,
}: {
  sources: { source_id: string; name: string }[];
  value: string | null;
  status: JobStatus | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2">
      <span className="text-label-12 text-text-3">출처</span>
      <select
        value={value ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(() =>
            router.push(sourcesHref({ source: e.target.value || null, status }), {
              scroll: false,
            }),
          )
        }
        className="h-8 w-60 rounded-lg border border-border-1 bg-surface-1 px-3 text-body-13 text-text-1 outline-none focus:border-border-2"
      >
        <option value="">전체 출처</option>
        {sources.map((s) => (
          <option key={s.source_id} value={s.source_id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
