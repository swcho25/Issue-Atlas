import type { EvidenceRef } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { getEvidence } from "../../api/getResult";
import {
  kstDate,
  locatorLine,
  periodRange,
  sourceGradeTone,
  storageScopeBadge,
} from "../../model/labels";
import { FootnoteCopyButton } from "./FootnoteCopyButton";

// 05 · 원문 읽기 칸(Figma Reader: 안쪽 24 · 28 · 칸 사이 14). 계약의 근거 상세를 그대로 보여 준다 —
// 출처 · 등급 · 이용 조건 · 저장 범위 → 제목 → 기간 · 공표 · 수집 → 이 질문에 쓴 값 → 원문 위치 → 각주 → 버튼

/** 배지 줄: 출처(gray) · 출처 등급 · 이용 조건(gray) · 저장 범위 */
function Badges({
  source,
  grade,
  license,
  scope,
}: {
  source: string;
  grade: EvidenceRef["source_grade"];
  license?: string;
  scope: EvidenceRef["storage_scope"];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone="gray">{source}</StatusBadge>
      <StatusBadge tone={sourceGradeTone[grade]}>출처 등급 {grade}</StatusBadge>
      {license && <StatusBadge tone="gray">{license}</StatusBadge>}
      <StatusBadge tone={storageScopeBadge[scope].tone}>
        {storageScopeBadge[scope].label}
      </StatusBadge>
    </div>
  );
}

/** 이름(Caption 11 text-3) 위 값(Label 12) 한 칸 */
function Meta({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-caption-11 text-text-3">{name}</dt>
      <dd className="text-label-12 text-text-1">{value}</dd>
    </div>
  );
}

const shell = "flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto px-7 py-6";

/** 근거 상세를 받는 동안(목록 · 패널은 먼저 보인다) */
export function SourceReaderFallback() {
  return (
    <article aria-busy="true" className={shell}>
      <p className="text-body-13 text-text-3">근거 상세를 불러오는 중이에요…</p>
    </article>
  );
}

export async function SourceReader({ item }: { item: EvidenceRef | null }) {
  if (!item) {
    return (
      <article className={shell}>
        <p className="text-body-13 text-text-3">이 질문에 쓴 원문이 없어요.</p>
      </article>
    );
  }

  const evidence = await getEvidence(item.evidence_id);
  if (!evidence) {
    // 상세를 못 받아도 목록에 있던 값(출처 · 등급 · 저장 범위 · 제목)은 보여 준다
    return (
      <article className={shell}>
        <Badges source={item.source_name} grade={item.source_grade} scope={item.storage_scope} />
        <h2 className="text-heading-20 text-text-1">{item.title}</h2>
        <p className="flex items-center gap-2 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-caption-12 text-text-2">
          <Icon name="alert" className="size-3.5 text-text-3" />
          근거 상세를 불러오지 못했어요. 기간 · 원문 위치 · 각주는 잠시 뒤 다시 열어 보세요.
        </p>
      </article>
    );
  }

  const locator = locatorLine(evidence.locator);
  const period = periodRange(evidence.period_start, evidence.period_end);
  return (
    // 근거가 바뀌면 복사 버튼의 「복사했어요」 상태도 새로 시작한다
    <article key={evidence.evidence_id} className={shell}>
      <Badges
        source={evidence.source_name}
        grade={evidence.source_grade}
        license={evidence.license_type}
        scope={evidence.storage_scope}
      />
      <h2 className="text-heading-20 text-text-1">{evidence.title}</h2>

      <dl className="flex flex-wrap gap-4">
        {/* 기간은 끝 미포함이라 하루 당겨 보여 준다(각주 「2023–2025」와 같은 기간) */}
        {period && <Meta name="기간" value={period} />}
        {evidence.observed_at && <Meta name="관측" value={kstDate(evidence.observed_at, true)} />}
        {evidence.published_at && <Meta name="공표" value={kstDate(evidence.published_at)} />}
        <Meta name="수집" value={kstDate(evidence.collected_at, true)} />
      </dl>

      <section className="grid gap-1.5 rounded-[10px] bg-surface-2 p-3.5">
        <h3 className="text-caption-11 text-text-3">이 질문에 쓴 값</h3>
        {evidence.display ? (
          <p className="text-body-14 text-text-1">{evidence.display}</p>
        ) : evidence.storage_scope === "link_only" ? (
          // 링크만(link_only) 자료는 이용 조건상 내용을 저장하지 않아 보여 줄 값이 없다
          <p className="text-body-13 text-text-3">
            이용 조건상 원문을 저장하지 않는 자료예요. 원문 사이트에서 확인해 주세요.
          </p>
        ) : (
          <p className="text-body-13 text-text-3">이 근거에는 따로 적어 둔 값이 없어요.</p>
        )}
      </section>

      {locator && (
        <section className="grid gap-1">
          <h3 className="text-caption-11 text-text-3">원문 위치 (locator)</h3>
          <p className="text-caption-12 break-all text-text-2">{locator}</p>
        </section>
      )}

      {/* 각주 상자: 테두리 1 이 자리를 차지한다(Figma 안쪽 14 + 1) */}
      <section className="grid gap-1.5 rounded-[10px] border border-border-1 p-3.5">
        <div className="flex items-center gap-1.5">
          <h3 className="min-w-0 flex-1 text-label-12 text-text-1">각주</h3>
          <FootnoteCopyButton footnote={evidence.footnote} variant="icon" />
        </div>
        <p className="text-body-13 break-all text-text-1">{evidence.footnote}</p>
      </section>

      <div className="flex gap-2">
        <FootnoteCopyButton footnote={evidence.footnote} />
        {evidence.url && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "secondary", size: "s" })}
          >
            <Icon name="external" />
            원문 사이트 열기
          </a>
        )}
      </div>
    </article>
  );
}
