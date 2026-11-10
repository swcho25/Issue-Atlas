"use client";

import Link from "next/link";

import type { EvidenceRef } from "@/shared/api";
import { StatusBadge, type StatusTone } from "@/shared/ui/badge";
import { Button, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { type AqGrade, type StationPoint, stationValueText } from "../../model/distribution";
import { evidenceStatusBadge, yearSpan } from "../../model/labels";
import { copyIcon, useCopy } from "../copy/useCopy";
import { useCardFootnotes } from "../copy/useCardFootnotes";
import { sourcesHref } from "../tabs";
import { MapPopover } from "./MapPopover";

// 04 측정소 상세 창(Figma 「결과 · 측정소 누름 → 상세 창」). 창 틀(자리 · 꼬리 · 닫기 · 초점)은 MapPopover.
// 머리(「○○ 측정소」 · 닫기) · 출처 줄 · 고른 달 값(Number 32) + 단위 · 월평균 + 등급 배지 · 「이 값의 근거 N건」 줄 · 원문 보기 · 각주 복사.
// Figma 의 측정소 종류(도시대기) · 시간값 수 · 확정일 · 측정소 정보 · 고시 근거는 계약에 없어 카드의 통계 근거만 보인다

/** 등급 배지 색: 점 색(좋음 파랑 · 보통 초록 · 나쁨 앰버 · 매우나쁨 빨강)과 같은 계열, Figma 나쁨 = amber */
const gradeTone: Record<AqGrade["key"], StatusTone> = {
  good: "blue",
  moderate: "green",
  bad: "amber",
  veryBad: "red",
};

const copyLabels = { idle: "각주 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

export function StationDetail({
  point,
  month,
  unit,
  refs,
  runId,
  onClose,
}: {
  point: StationPoint;
  month: string;
  unit: string | null;
  /** 이 값의 근거(카드의 통계 근거) */
  refs: EvidenceRef[];
  runId: string;
  /** refocus: 닫은 뒤 점으로 초점을 돌릴지(닫기 · Esc) */
  onClose: (refocus: boolean) => void;
}) {
  const { result, copy } = useCopy();
  const footnotes = useCardFootnotes(refs);
  const main = refs[0];

  return (
    <MapPopover
      at={point.at}
      focusKey={point.id}
      titleId={`station-${point.id}`}
      title={`${point.name} 측정소`}
      onClose={onClose}
    >
      <p className="relative text-caption-12 text-text-3">
        {["실좌표", main?.title, main && `출처 등급 ${main.source_grade}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="relative flex flex-wrap items-baseline gap-2">
        <span className={`text-number-32 ${point.value == null ? "text-text-3" : "text-text-1"}`}>
          {point.value == null ? "—" : stationValueText(point.value)}
        </span>
        <span className="text-caption-12 text-text-2">
          {[unit, `${month} 월평균`].filter(Boolean).join(" · ")}
        </span>
        {point.value == null ? (
          <StatusBadge tone="gray" className="self-center">
            {point.status === "available" ? "값 없음" : evidenceStatusBadge[point.status].label}
          </StatusBadge>
        ) : (
          point.grade && (
            <StatusBadge tone={gradeTone[point.grade.key]} className="self-center">
              {point.grade.label}
            </StatusBadge>
          )
        )}
      </div>
      {refs.length > 0 && (
        <>
          <hr className="relative border-border-1" />
          <h3 className="relative text-label-12 text-text-2">이 값의 근거 {refs.length}건</h3>
          <ul className="relative flex flex-col gap-3">
            {refs.map((ref, i) => (
              <li
                key={ref.evidence_id}
                className={`flex gap-2.5 rounded-lg px-3 py-2.5 ${i === 0 ? "bg-primary-soft" : "bg-surface-2"}`}
              >
                <span className="grid size-5.5 shrink-0 place-items-center rounded-sm bg-surface-2 text-label-12 text-text-1">
                  <span className="sr-only">출처 등급 </span>
                  {ref.source_grade}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-label-13 text-text-1">{ref.title}</span>
                  <span className="text-caption-11 text-text-3">
                    {[ref.source_name, yearSpan(ref.period_start, ref.period_end)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Link
                  href={sourcesHref(runId, ref.evidence_id)}
                  className="flex shrink-0 items-center gap-0.75 self-start rounded-sm text-label-12 text-primary-text hover:underline"
                >
                  원문
                  <span className="sr-only">: {ref.title}</span>
                  <Icon name="external" className="size-3 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="relative flex gap-2">
        <Link
          href={sourcesHref(runId, main?.evidence_id)}
          className={buttonClass({ variant: "secondary", className: "flex-1" })}
        >
          <Icon name="doc" />
          원문 보기
        </Link>
        <Button
          className="flex-1"
          icon={<Icon name={copyIcon(result)} />}
          disabled={!refs.length}
          onClick={() => copy(footnotes())}
        >
          {copyLabels[result]}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {result === "idle" ? "" : `각주 ${refs.length}건을 ${copyLabels[result]}`}
      </span>
    </MapPopover>
  );
}
