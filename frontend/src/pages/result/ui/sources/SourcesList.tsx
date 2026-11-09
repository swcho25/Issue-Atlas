import Link from "next/link";

import type { Argument, EvidenceRef } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";

import { evidenceKindLabel, yearSpan } from "../../model/labels";
import { articleRef, emptyRefsText, kindCount } from "../../model/sources";

// 05 · 원문 왼쪽 목록(Figma List: 폭 300 · surface-2 · 안쪽 16 · 12 · 칸 사이 4).
// 근거 종류별 묶음 머리(이름 · 건수) 아래 근거 줄. 고른 줄은 surface-1 + 테두리, 등급 칸은 앰버.
// 줄을 누르면 ?e=<evidence_id> 로 읽기 칸이 바뀐다. 기사도 근거 ID 가 있으면 같고, 없으면 원문 사이트로 바로 연다

/** 근거 줄: 등급 칸 20 + 제목(Label 13) · 출처 · 기간(Caption 11) */
function RefItem({ item, href, selected }: { item: EvidenceRef; href: string; selected: boolean }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`flex gap-2.5 rounded-lg px-2.5 py-2.25 ${selected ? "border border-border-1 bg-surface-1" : "hover:bg-surface-1/60"}`}
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-sm text-label-12 ${selected ? "bg-primary-soft text-primary-text" : "bg-surface-3 text-text-2"}`}
      >
        <span className="sr-only">출처 등급 </span>
        {item.source_grade}
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="text-label-13 text-text-1">{item.title}</span>
        <span className="text-caption-11 text-text-3">
          {[item.source_name, yearSpan(item.period_start, item.period_end)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

/**
 * 기사 줄. 문서 근거(evidence_id · 등급)가 있으면 근거 줄처럼 ?e= 로 근거 상세를 연다(-318).
 * 없으면(지난 실행 결과 · 등급 없는 출처) 원문 사이트로 바로 연다(새 창). 본문은 저장하지 않는다
 */
function ArticleItem({
  article,
  hrefOf,
  selectedId,
}: {
  article: Argument["articles"][number];
  hrefOf: (evidenceId: string) => string;
  selectedId: string | null;
}) {
  const ref = articleRef(article);
  if (ref) {
    return (
      <RefItem
        item={{
          ...ref,
          source_name: [article.place_name, article.date].filter(Boolean).join(" · "),
        }}
        href={hrefOf(ref.evidence_id)}
        selected={ref.evidence_id === selectedId}
      />
    );
  }
  const body = (
    <>
      {/* 기사는 응답에 출처 등급이 없어 등급 칸을 비운다(Figma 묶음 줄도 빈 칸) */}
      <span aria-hidden className="size-5 shrink-0 rounded-sm bg-surface-3" />
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="text-label-13 text-text-1">{article.summary ?? "기사"}</span>
        <span className="text-caption-11 text-text-3">
          {[article.place_name, article.date].filter(Boolean).join(" · ")}
        </span>
      </span>
      <StatusBadge tone="gray">본문 저장 안 함</StatusBadge>
    </>
  );
  const className = "flex items-start gap-2.5 rounded-lg px-2.5 py-2.25";
  return article.url ? (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:bg-surface-1/60`}
    >
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function SourcesList({
  argument,
  selectedId,
  hrefOf,
}: {
  argument: Argument;
  selectedId: string | null;
  hrefOf: (evidenceId: string) => string;
}) {
  return (
    <nav
      aria-label="원문 목록"
      className="flex w-[300px] shrink-0 flex-col gap-1 overflow-y-auto bg-surface-2 px-3 py-4"
    >
      {/* 수요표와 같은 순서 · 같은 4묶음 */}
      {argument.evidence_table.map((row) => {
        const refs = argument.data[row.kind];
        const articles = row.kind === "documents" ? argument.articles : [];
        // 건수는 수요표의 전체 건수. 목록(data)에는 대표 자료만 있어 나머지는 「… 외 N건」 줄로
        const count = kindCount(argument, row);
        const rest = count - refs.length - articles.length;
        return (
          <section
            key={row.kind}
            aria-label={evidenceKindLabel[row.kind]}
            className="flex flex-col gap-1"
          >
            <h2 className="flex gap-1.5 px-2 pt-2.5 pb-1">
              <span className="min-w-0 flex-1 text-label-12 text-text-2">
                {evidenceKindLabel[row.kind]}
              </span>
              <span className="text-caption-11 text-text-3">{count}</span>
            </h2>
            {count === 0 && (
              // 자료가 없으면 수요표의 사유, 없으면 상태(미수집 · 미공표 …)
              <p className="px-2 pb-1 text-caption-11 text-text-3">{emptyRefsText(row, 0)}</p>
            )}
            {refs.map((ref) => (
              <RefItem
                key={ref.evidence_id}
                item={ref}
                href={hrefOf(ref.evidence_id)}
                selected={ref.evidence_id === selectedId}
              />
            ))}
            {articles.map((a) => (
              <ArticleItem key={a.id} article={a} hrefOf={hrefOf} selectedId={selectedId} />
            ))}
            {rest > 0 && (
              // Figma 「… 외 10건」 줄: 빈 등급 칸 + Label 13 + Caption 11
              <div className="flex gap-2.5 px-2.5 py-2.25">
                <span aria-hidden className="size-5 shrink-0 rounded-sm bg-surface-3" />
                <span className="grid min-w-0 flex-1 gap-px">
                  <span className="text-label-13 text-text-1">
                    {refs.length + articles.length ? `… 외 ${rest}건` : `자료 ${rest}건`}
                  </span>
                  <span className="text-caption-11 text-text-3">
                    이 결과에는 대표 자료만 목록으로 와요
                  </span>
                </span>
              </div>
            )}
          </section>
        );
      })}
    </nav>
  );
}
