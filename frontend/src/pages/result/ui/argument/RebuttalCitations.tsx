"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Argument } from "@/shared/api";
import { ProvBadge, StatusBadge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { groupCitations } from "../../model/citations";
import { provKind, rebuttalBadge } from "../../model/labels";

type Rebuttal = Argument["rebuttals"][number];

/**
 * ⑤ 「근거 있음」 반박의 근거 기사(-343). 줄 끝 「근거 N」 버튼이 인용 모달을 연다(시안 D, 수정 제안 모달과 같은
 * 규격). 원문은 언론사 페이지를 새 탭으로 연다. 인용이 없는 반박은 아무것도 그리지 않는다.
 */
export function RebuttalCitations({ rebuttal }: { rebuttal: Rebuttal }) {
  const [open, setOpen] = useState(false);
  const count = rebuttal.citations?.length ?? 0;
  if (!count) return null;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-7 shrink-0 items-center gap-0.5 rounded-md bg-primary-soft pr-1.5 pl-2 text-label-12 whitespace-nowrap text-primary-text hover:bg-primary-line/40 focus-visible:outline-2 focus-visible:outline-text-1"
      >
        근거 {count}
        <Icon name="chevronRight" className="size-3.5" />
      </button>
      {open && <CitationDialog rebuttal={rebuttal} onClose={() => setOpen(false)} />}
    </>
  );
}

function CitationDialog({ rebuttal, onClose }: { rebuttal: Rebuttal; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const groups = groupCitations(rebuttal.citations ?? []);
  const badge = rebuttalBadge[rebuttal.status];

  // 모달로 열어 바깥 초점을 막고, Esc · 닫기로 닫는다(초점은 「근거 N」 버튼으로 돌아간다)
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[560px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-1 px-7 pt-6 pb-5.5 shadow-md backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="min-w-0 flex-1 text-heading-20 text-text-1">
            다른 해석의 근거
          </h2>
          <ProvBadge kind={provKind[rebuttal.provenance]} />
          <button
            type="button"
            aria-label="닫기"
            onClick={() => ref.current?.close()}
            className="flex size-8 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-text-1"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-body-13 text-text-1">{rebuttal.text}</p>
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        </div>

        <p className="text-caption-12 text-text-2">
          이 지역 · 기간 기사 요약에서 AI 가 글자 그대로 옮긴 문장이에요. 판단을 약하게 할 수 있는
          다른 설명이니 원문에서 직접 확인해 주세요.
        </p>

        <ol className="flex flex-col">
          {groups.map((g) => (
            <li key={g.quote} className="flex gap-3 border-t border-border-1 py-3">
              <div className="grid min-w-0 flex-1 gap-1">
                {g.title && <p className="text-label-13 text-text-1">{g.title}</p>}
                <q className="text-body-13 text-text-2 [quotes:'「'_'」']">{g.quote}</q>
                <p className="text-caption-11 text-text-3">
                  {g.count > 1 ? `${g.date} 외 · 같은 내용 기사 ${g.count}건` : g.date} · 빅카인즈
                  기사 요약
                </p>
              </div>
              {g.url && (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`원문 기사 새 탭에서 열기${g.title ? `: ${g.title}` : ""}`}
                  className="flex h-7 shrink-0 items-center gap-0.75 self-start text-label-12 text-primary-text"
                >
                  원문
                  <Icon name="external" className="size-3 text-primary" />
                </a>
              )}
            </li>
          ))}
        </ol>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => ref.current?.close()}>
            닫기
          </Button>
        </div>
      </div>
    </dialog>
  );
}
