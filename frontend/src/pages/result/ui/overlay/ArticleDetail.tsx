"use client";

import Link from "next/link";

import type { ArgumentArticle } from "@/shared/api";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import type { ApproxGroup, ArticleDot } from "../../model/articles";
import { sourcesHref } from "../tabs";
import { MapPopover } from "./MapPopover";

// 04 기사 창(11/01 대표 결정 「근거 기사 2클릭 → 원문」 — 기사 점 누름 → 이 창 → 원문). Figma 에 그림이 없어
// 측정소 창과 같은 지점 상세 틀(MapPopover, DESIGN.md 「지점을 누르면 그 점 옆에 작은 창」)에 담는다.
// 기사 하나: 요약 · 위치 정밀도 · 출처 등급, 「원문 보기」(근거 ID 가 있으면 원문 탭 근거 상세 ?e=) · 「원문 사이트」(새 창).
// 위치 근사 묶음: 「위치 근사 · ○○ 중심 N건」 목록(스크롤), 줄마다 원문으로. 기사 본문은 저장하지 않는다(11/01 #1)

const precisionText: Record<ArgumentArticle["precision"], string> = {
  exact: "정확한 위치",
  address: "주소로 찍은 위치",
  admin_centroid: "위치 근사(행정구역 중심)",
  none: "위치 없음",
};

/** 기사 한 줄의 원문: 근거 ID 가 있으면 원문 탭(근거 상세), 없으면 원문 사이트(새 창), 둘 다 없으면 없음 */
function sourceOf(a: ArgumentArticle, runId: string) {
  if (a.evidence_id) return { href: sourcesHref(runId, a.evidence_id), external: false } as const;
  if (a.url) return { href: a.url, external: true } as const;
  return null;
}

const meta = (a: ArgumentArticle) => [a.place_name, a.date].filter(Boolean).join(" · ");

export function ArticleDetail({
  article,
  at,
  markKey,
  runId,
  onClose,
}: {
  article: ArgumentArticle;
  at: [number, number];
  markKey: string;
  runId: string;
  onClose: (refocus: boolean) => void;
}) {
  return (
    <MapPopover
      at={at}
      focusKey={markKey}
      titleId={`article-${article.id}`}
      title={meta(article) || "기사"}
      onClose={onClose}
    >
      <p className="relative text-caption-12 text-text-3">
        {[
          "보도 기사",
          precisionText[article.precision],
          article.source_grade && `출처 등급 ${article.source_grade}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="relative text-body-14 text-text-1">
        {article.summary ?? "요약이 없는 기사예요."}
      </p>
      {article.summary && (
        <p className="relative text-caption-11 text-text-3">
          AI 요약 · 기사 본문은 저장하지 않아요
        </p>
      )}
      <div className="relative flex gap-2">
        {article.evidence_id && (
          <Link
            href={sourcesHref(runId, article.evidence_id)}
            className={buttonClass({ variant: "secondary", className: "flex-1" })}
          >
            <Icon name="doc" />
            원문 보기
          </Link>
        )}
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ className: "flex-1" })}
          >
            <Icon name="external" />
            원문 사이트
            <span className="sr-only">(새 창)</span>
          </a>
        )}
        {!article.evidence_id && !article.url && (
          <p className="text-caption-12 text-text-3">원문 링크가 없는 기사예요.</p>
        )}
      </div>
    </MapPopover>
  );
}

/** 위치 근사 묶음 목록 창 */
export function ArticleGroupDetail({
  group,
  ...rest
}: {
  group: ApproxGroup;
  /** 묶음에 든 기사(최신 순) */
  articles: ArgumentArticle[];
  runId: string;
  markKey: string;
  onClose: (refocus: boolean) => void;
}) {
  return (
    <ArticleListDetail
      {...rest}
      at={group.at}
      title={group.name}
      note={`구가 적히지 않은 기사라 ${group.area} 중심에 모아 두었어요 · 실제 위치가 아니에요`}
    />
  );
}

/** 같은 자리(같은 주소) 기사 목록 창: 「여수세계박람회장 · 기사 7건」 */
export function ArticleStackDetail({
  dot,
  ...rest
}: {
  dot: ArticleDot;
  articles: ArgumentArticle[];
  runId: string;
  markKey: string;
  onClose: (refocus: boolean) => void;
}) {
  return (
    <ArticleListDetail
      {...rest}
      at={dot.at}
      title={dot.name}
      note="보도 기사 · 주소로 찍은 같은 자리"
    />
  );
}

function ArticleListDetail({
  at,
  title,
  note,
  articles,
  runId,
  markKey,
  onClose,
}: {
  at: [number, number];
  title: string;
  note: string;
  articles: ArgumentArticle[];
  runId: string;
  markKey: string;
  onClose: (refocus: boolean) => void;
}) {
  return (
    <MapPopover
      at={at}
      focusKey={markKey}
      titleId={`article-list-${markKey}`}
      title={title}
      onClose={onClose}
    >
      <p className="relative text-caption-12 text-text-3">{note}</p>
      <ul className="relative -mx-1 flex max-h-[320px] [scrollbar-width:thin] flex-col gap-1 overflow-y-auto px-1">
        {articles.map((a) => {
          const source = sourceOf(a, runId);
          const body = (
            <>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="line-clamp-2 text-label-13 text-text-1">
                  {a.summary ?? "기사"}
                </span>
                <span className="text-caption-11 text-text-3">{meta(a)}</span>
              </span>
              {source && (
                <Icon
                  name={source.external ? "external" : "chevronRight"}
                  className="mt-0.5 size-3.5 shrink-0 text-text-3"
                />
              )}
            </>
          );
          const row = "flex gap-2 rounded-lg px-2.5 py-2";
          return (
            <li key={a.id}>
              {source?.external ? (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${row} outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-text-1`}
                >
                  {body}
                  <span className="sr-only">(새 창)</span>
                </a>
              ) : source ? (
                <Link
                  href={source.href}
                  className={`${row} outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-text-1`}
                >
                  {body}
                </Link>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </MapPopover>
  );
}
