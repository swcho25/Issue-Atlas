"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { EvidenceRef } from "@/shared/api";
import { Icon, type IconName } from "@/shared/ui/icon";

import { useCardFootnotes } from "../copy/useCardFootnotes";
import { copyIcon, useCopy } from "../copy/useCopy";
import { type ReportTarget, useReport } from "./report";

// 칸의 ⋯ 메뉴(Figma 05 · 논증 카드 Menu): 원문 보기 · 각주 복사 · 오류 신고 · 수정 제안.
// 판(surface-1 · 테두리 1 · 모서리 8 · 안쪽 6 · 줄 사이 2 · Shadow md), 줄(안쪽 6 · 10 · 아이콘 13 과 글자 사이 8 · 모서리 6 · Label 12).
// 가리킨 줄은 primary-soft · primary-text(Figma 의 「오류 신고」 줄 모습). 키보드: 위아래로 옮기고 Enter 로 고르고 Esc 로 닫는다

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-label-12 text-text-1 whitespace-nowrap outline-none hover:bg-primary-soft hover:text-primary-text focus-visible:bg-primary-soft focus-visible:text-primary-text";

function ItemIcon({ name }: { name: IconName }) {
  return <Icon name={name} className="size-3.25 shrink-0" />;
}

const copyLabels = { idle: "각주 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

export function CellMenu({
  target,
  sourcesHref,
  refs,
}: {
  target: ReportTarget;
  /** 원문 보기가 여는 원문 탭(근거 칸은 첫 근거를 고른 채로) */
  sourcesHref: string;
  /** 각주 복사에 쓸 근거 */
  refs: EvidenceRef[];
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const report = useReport();
  const { result, copy } = useCopy();
  const footnotes = useCardFootnotes(refs);

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  // 열면 첫 줄로 초점, 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={`${target.title} 칸 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="grid size-3.5 place-items-center rounded-sm text-text-3 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-text-1"
      >
        <Icon name="more" className="size-3.5" />
      </button>
      <span role="status" className="sr-only">
        {result === "idle" ? "" : `각주를 ${copyLabels[result]}`}
      </span>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`${target.title} 칸 메뉴`}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-popover mt-1 flex w-max flex-col gap-0.5 rounded-lg border border-border-1 bg-surface-1 p-1.5 shadow-md"
        >
          <Link
            href={sourcesHref}
            role="menuitem"
            tabIndex={-1}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <ItemIcon name="external" />
            원문 보기
          </Link>
          {refs.length > 0 && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={itemClass}
              onClick={() => {
                close();
                void copy(footnotes());
              }}
            >
              <ItemIcon name={copyIcon(result)} />
              각주 복사
            </button>
          )}
          {report ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={itemClass}
              onClick={() => {
                // ⋯ 로 초점을 먼저 돌려 둔다. 창은 연 때 초점이 있던 곳으로 닫히며 돌아간다(메뉴 줄은 사라지므로)
                close();
                report(target);
              }}
            >
              <ItemIcon name="alert" />
              오류 신고 · 수정 제안
            </button>
          ) : (
            // 카드가 없는 결과(카드 밖)는 신고할 카드가 없다. 줄은 남기고 왜 안 되는지 보인다
            <span
              role="menuitem"
              tabIndex={-1}
              aria-disabled="true"
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-label-12 whitespace-nowrap text-text-3 outline-none focus-visible:bg-surface-2"
            >
              <ItemIcon name="alert" />
              오류 신고 — 카드가 없는 결과예요
            </span>
          )}
        </div>
      )}
    </div>
  );
}
