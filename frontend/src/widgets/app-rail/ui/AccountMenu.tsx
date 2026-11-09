"use client";

import { useMutation } from "@tanstack/react-query";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { logout } from "../api/logout";
import { reloadToLanding } from "../lib/reload";

export type RailUser = { name: string; email: string };

// 띠 맨 아래 첫 글자 동그라미 → 오른쪽에 뜨는 작은 판: 이름 · 이메일 · 권한, 그 아래 로그아웃.
// 판 모양은 결과 칸 메뉴(CellMenu)와 같다(surface-1 · 테두리 1 · 모서리 8 · 안쪽 6 · Shadow md, 가리킨 줄은 primary-soft).
// 바깥을 누르거나 Esc 로 닫는다. 계정은 관리자가 발급하므로 이름 · 비밀번호 바꾸기는 없다
export function AccountMenu({ user, role }: { user: RailUser; role: "viewer" | "admin" }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // 로그아웃하면 랜딩을 페이지째 새로 연다(화면에 남은 앞 사람의 상태 · 데이터가 함께 사라진다)
  const signOut = useMutation({ mutationFn: logout, onSuccess: reloadToLanding });

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  // 열면 로그아웃에 초점, 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button")?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-label={`계정 · ${user.name}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="grid size-[calc(32*var(--u))] place-items-center rounded-full bg-surface-3 text-[length:calc(13*var(--u))] font-bold text-text-1 hover:bg-border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 aria-expanded:inset-ring-2 aria-expanded:inset-ring-text-1"
      >
        {user.name.slice(0, 1)}
      </button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          className="absolute bottom-0 left-full z-popover ml-3 flex w-64 flex-col gap-0.5 rounded-lg bg-surface-1 p-1.5 shadow-md inset-ring inset-ring-border-1"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-heading-16 text-text-1"
            >
              {user.name.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-title-14 text-text-1">{user.name}</span>
              <span className="truncate text-body-13 text-text-3">
                {user.email} · {role === "admin" ? "관리자" : "조회자"}
              </span>
            </span>
          </div>
          <div role="separator" className="mx-1 my-1 h-px bg-border-1" />
          <button
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending || signOut.isSuccess}
            className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-label-13 text-text-1 outline-none hover:bg-primary-soft hover:text-primary-text focus-visible:bg-primary-soft focus-visible:text-primary-text disabled:opacity-40"
          >
            로그아웃
          </button>
          {signOut.isError && (
            <p role="alert" className="px-2.5 pb-1 text-label-12 text-status-red">
              로그아웃하지 못했어요. 잠시 뒤 다시 시도해 주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
