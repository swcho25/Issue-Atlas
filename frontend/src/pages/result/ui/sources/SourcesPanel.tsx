import type { Argument } from "@/shared/api";

import { evidenceKindLabel } from "../../model/labels";
import { articleRef, kindCount, sourcesTotal } from "../../model/sources";

// 05 · 원문 패널: 「원문 N건」 종류별 건수(surface-2 · 모서리 12 · 안쪽 14 · 칸 사이 6) +
// 「링크만」 소스 안내(테두리 1 · 안쪽 14 · 칸 사이 6). 근거 상세가 없는 기사는 링크만으로 센다

export function SourcesPanel({ argument }: { argument: Argument }) {
  const rows = argument.evidence_table.map((row) => {
    const refs = argument.data[row.kind];
    // 근거 상세가 없는 기사(지난 실행 결과 등)만 원문 사이트로만 열려 링크만으로 센다
    const articles =
      row.kind === "documents" ? argument.articles.filter((a) => !articleRef(a)).length : 0;
    const linkOnly = refs.filter((r) => r.storage_scope === "link_only").length + articles;
    // 건수는 수요표의 전체 건수, 링크만은 목록에 온 자료(대표 자료 · 기사)에서 센다
    return { kind: row.kind, count: kindCount(argument, row), linkOnly };
  });
  const total = sourcesTotal(argument);
  return (
    <>
      <section aria-label="원문 건수" className="grid gap-1.5 rounded-xl bg-surface-2 p-3.5">
        <h2 className="text-label-12 text-text-1">원문 {total}건</h2>
        <ul className="contents">
          {rows.map((r) => (
            <li key={r.kind} className="flex gap-2">
              <span className="min-w-0 flex-1 text-caption-12 text-text-2">
                {evidenceKindLabel[r.kind]}
              </span>
              <span className="text-label-12 text-text-1">
                {r.linkOnly ? `${r.count} · 링크만 ${r.linkOnly}` : r.count}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-1.5 rounded-xl border border-border-1 p-3.5">
        <h2 className="text-label-13 text-text-1">「링크만」 소스</h2>
        <p className="text-caption-12 text-text-2">
          이용 조건상 원문을 저장하지 않는 자료예요. 미리보기 없이 원문 사이트로만 열어요.
        </p>
      </section>
    </>
  );
}
