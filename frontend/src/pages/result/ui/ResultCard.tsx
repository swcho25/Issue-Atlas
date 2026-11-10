import type { Argument, RunStatus } from "@/shared/api";
import { ProvBadge, StatusBadge } from "@/shared/ui/badge";
import { Icon, type IconName } from "@/shared/ui/icon";
import { TabBar } from "@/shared/ui/tab-bar";

import {
  claimLevelLabel,
  comparabilityLabel,
  evidenceKindShort,
  evidenceStatusBadge,
  judgmentBadge,
  kstDate,
  provKind,
  qualifierGrade,
  runStatusInfo,
  unmetConditions,
  yearSpan,
} from "../model/labels";
import { emptyRefsText, kindCount } from "../model/sources";
import { CardShell } from "./card/CardShell";
import { resultTabs } from "./tabs";

// 04 · 결과 · 지도 먼저: 지도 위에 떠 있는 결과 카드(Figma 04 「변화형 · 청년 유출」 Panel).
// 근거 4종 → 비교 조건 → 판단 순서로 쌓는다(근거 먼저). 머리(뒤로 · 제목 · 탭)는 CardShell

/** 실행 상태 배지(Figma 「ready · 근거 갖춤」). 색은 05 패널과 같다 */
const runStatusText: Record<RunStatus, string> = {
  ready: "ready · 근거 갖춤",
  partial: "partial · 일부 근거",
  blocked: "blocked · 근거 부족",
  unsupported: "unsupported · 카드 밖",
};
// 카드는 있는데 적용 조건을 못 채운 unsupported(C2 v1)는 「카드 밖」이 아니다(Figma 08 「unsupported · 카드 조건 밖」)
const statusText = (a: Argument) =>
  a.run_status === "unsupported" && a.question.card_id !== null
    ? "unsupported · 카드 조건 밖"
    : runStatusText[a.run_status];

/** 머리 아래 한 줄: 「2023–2025 · 실행 10-28 10:00」(회차는 응답에 없어 실행 시각) */
function metaLine(a: Argument) {
  const at = kstDate(a.created_at, true).slice(5);
  return [yearSpan(a.question.period_start, a.question.period_end), `실행 ${at}`].join(" · ");
}

/** 판단 상자 아래 한 줄: 「계산값 · 근거 충실도 상 · A 출처 2 · 독립 근거 3」 */
function claimNote(a: Argument) {
  const c = a.qualifier.components;
  return [
    claimLevelLabel[a.claim.level],
    `근거 충실도 ${qualifierGrade[a.qualifier.grade].label}`,
    `A 출처 ${c.a_grade_sources}`,
    `독립 근거 ${c.independent_evidence}`,
  ].join(" · ");
}

/** 칸 이름(Label 12 text-1) + 설명(Caption 11 text-3), 사이 6 */
function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <h2 className="shrink-0 text-label-12 text-text-1">{title}</h2>
      <p className="min-w-0 text-caption-11 text-text-3">{note}</p>
    </div>
  );
}

export function ResultCard({ argument }: { argument: Argument }) {
  const { question, claim } = argument;
  const status = runStatusInfo[argument.run_status];
  const conditions = Object.entries(argument.comparability) as [
    keyof typeof comparabilityLabel,
    Argument["comparability"][keyof typeof comparabilityLabel],
  ][];
  const passed = conditions.filter(([, c]) => c.passed === true).length;
  const badge = judgmentBadge(argument);
  const unmet = unmetConditions(argument);

  return (
    <CardShell
      title={`${question.place_name} · ${question.card_name ?? "목록에 없는 질문"}`}
      tabs={<TabBar variant="clear" items={resultTabs(argument)} current="summary" />}
    >
      {/* 기간 · 실행 시각(Figma 13 Regular text-3 · 줄 높이 16 — 글자 스타일이 없어 Body 13 에 줄 높이만 16) */}
      <p className="text-body-13 leading-4 text-text-3">{metaLine(argument)}</p>

      {/* 실행 상태 + 카드 · 규칙 판 */}
      <div className="flex items-center gap-2">
        <StatusBadge tone={status.tone}>{statusText(argument)}</StatusBadge>
        <span className="min-w-0 text-caption-11 text-text-3">
          {[
            argument.card_version !== null && `카드 v${argument.card_version}`,
            argument.formula_version && `규칙 ${argument.formula_version}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {/* 적용 조건을 못 채우면(C2 v1) 근거 4종 · 비교 조건 대신 못 채운 조건만(Figma 08 「카드 조건 밖」) */}
      {unmet.length ? (
        <UnmetConditions unmet={unmet} />
      ) : (
        <>
          {/* ① 근거 4종: 줄 높이 36 · surface-2 · 모서리 8 · 안쪽 7 · 10 · 사이 8, 줄 사이 6 */}
          <section aria-label="근거 4종" className="flex flex-col gap-1.5">
            <SectionHead title="① 근거 4종" note="있는 것 · 없는 것 먼저" />
            <ul className="contents">
              {argument.evidence_table.map((row) => {
                const st = evidenceStatusBadge[row.status];
                const count = kindCount(argument, row);
                // 가운데 칸: 검수 대기가 있으면 그것, 0건이면 사유(길면 한 줄로 자르고 전체는 툴팁)
                const note =
                  row.review_pending_count > 0
                    ? `검수 대기 ${row.review_pending_count} 별도`
                    : count === 0
                      ? emptyRefsText(row, 0)
                      : "";
                return (
                  <li
                    key={row.kind}
                    className="flex h-9 items-center gap-2 rounded-lg bg-surface-2 px-2.5"
                  >
                    <span className="shrink-0 text-label-12 text-text-1">
                      {evidenceKindShort[row.kind]}
                    </span>
                    <span className="shrink-0 text-caption-11 text-text-3">
                      {row.required ? "필수" : "선택"}
                    </span>
                    <span
                      title={note || undefined}
                      className="min-w-0 flex-1 truncate text-caption-11 text-text-3"
                    >
                      {note}
                    </span>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    <span className="shrink-0 text-label-12 text-text-1">{count}건</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ② 비교 조건: 칩(모서리 6 · 안쪽 3 · 8 · 3 · 6 · 아이콘 12 · Caption 11), 칩 사이 6 */}
          <section aria-label="비교 조건" className="flex flex-col gap-1">
            <SectionHead
              title={`② 비교 조건 ${passed} / ${conditions.length}`}
              note="4개 모두 충족해야 판정할 수 있어요"
            />
            <ul className="flex flex-wrap gap-1.5">
              {conditions.map(([key, c]) => {
                // 통과는 Figma 그대로 초록 체크. 실패 · 검사 안 함은 수요표 탭과 같게 빨강 ✕ · 회색 —
                const look: { icon: IconName; cls: string; say: string } =
                  c.passed === true
                    ? { icon: "check", cls: "bg-status-green-soft text-status-green", say: "충족" }
                    : c.passed === false
                      ? {
                          icon: "close",
                          cls: "bg-status-red-soft text-status-red",
                          say: "충족 안 됨",
                        }
                      : {
                          icon: "minus",
                          cls: "bg-status-gray-soft text-status-gray",
                          say: "검사 안 함",
                        };
                return (
                  <li
                    key={key}
                    title={c.note ?? undefined}
                    className={`flex h-5 items-center gap-1 rounded-md pr-2 pl-1.5 text-caption-11 ${look.cls}`}
                  >
                    <Icon name={look.icon} label={look.say} className="size-3" />
                    {comparabilityLabel[key]}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* ③ 판단: surface-2 · 모서리 12 · 안쪽 14 · 사이 8 */}
      <section aria-label="판단" className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-label-12 text-text-1">③ 판단</h2>
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          <ProvBadge kind={provKind[claim.provenance]} />
        </div>
        <p className="text-heading-16 text-text-1">{claim.text ?? "판단 문장이 없어요."}</p>
        <p className="text-caption-12 text-text-2">{claimNote(argument)}</p>
      </section>

      {/* 말하지 않는 것: Label 12 text-2, 줄(close 12 + Caption 12 text-2 · 사이 6), 줄 사이 4 */}
      <section aria-label="말하지 않는 것" className="flex flex-col gap-1">
        <h2 className="text-label-12 text-text-2">말하지 않는 것</h2>
        {argument.ceiling.items.length ? (
          <ul className="contents">
            {argument.ceiling.items.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Icon name="close" className="size-3 shrink-0 text-text-3" />
                <span className="text-caption-12 text-text-2">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption-12 text-text-3">
            {question.card_id ? "카드에 적힌 상한선이 없어요." : "카드가 없어 상한선이 없어요."}
          </p>
        )}
      </section>
    </CardShell>
  );
}

/**
 * 못 채운 적용 조건(Figma 08 「Unmet applicability」: 사이 8, 머리 Bold 13 + 11 · 줄 status-red-soft · 모서리 8 · 안쪽 9 · 10 · 사이 8
 * (✕ 빨강 · 조건 Medium 13 · 사유 12 text-2) · 아래 안내 12 text-2). 머리 보조 글자는 연 값 · 측정소 부족처럼 근거를 찾은 뒤 멈춘
 * 경우도 있어 Figma 「근거를 찾기 전에 멈춤」 대신 「판단 전에 멈춤」
 */
function UnmetConditions({ unmet }: { unmet: Argument["applicability"] }) {
  return (
    <section aria-label="못 채운 적용 조건" className="flex flex-col gap-2">
      <SectionHead title="① 못 채운 적용 조건" note="카드 B6 · 판단 전에 멈춤" />
      <ul className="flex flex-col gap-2">
        {unmet.map((c) => (
          <li
            key={c.condition}
            className="flex items-center gap-2 rounded-lg bg-status-red-soft px-2.5 py-2.25"
          >
            <Icon name="close" label="못 채움" className="size-3 shrink-0 text-status-red" />
            <span className="shrink-0 text-label-13 text-text-1">{c.label}</span>
            {c.note && (
              <span className="min-w-0 truncate text-caption-12 text-text-2">{c.note}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-caption-12 text-text-2">
        근거 4종과 비교 조건은 보지 않아요. 조건을 채우는 지역이나 다른 이슈로 다시 물어보세요.
      </p>
    </section>
  );
}
