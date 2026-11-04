"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/shared/api";
import { AtlasMark } from "@/shared/ui/logo";

import { login } from "../api/login";
import { useLoginDialog } from "../model/login-dialog";
import { homeOf } from "../model/schema";
import styles from "./LoginDialog.module.css";

type Empty = { email: boolean; password: boolean };

const emptyMessage = (e: Empty) =>
  e.email && e.password
    ? "이메일과 비밀번호를 입력해 주세요"
    : e.email
      ? "이메일을 입력해 주세요"
      : "비밀번호를 입력해 주세요";

/**
 * 랜딩 위 로그인 창. 일반 사용자는 로그인 없이 쓰고, 로그인은 관리자만 한다(로그인 정책 A안).
 * 닫기 · 바깥 · Esc 로 닫고, Tab 은 창 안에서만 돈다. 계정은 관리자가 만든다(가입 화면 없음)
 */
export function LoginDialog() {
  const dialog = useLoginDialog();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [empty, setEmpty] = useState<Empty>({ email: false, password: false });
  const [note, setNote] = useState("");
  const signIn = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (me) => router.push(homeOf(me)),
    onError: (e) =>
      setNote(
        e instanceof ApiError && (e.status === 400 || e.status === 401)
          ? "이메일 또는 비밀번호가 맞지 않아요"
          : "지금은 로그인할 수 없어요. 잠시 뒤 다시 시도해 주세요",
      ),
  });

  // 열면 첫 칸에 초점, 페이지 스크롤은 막는다
  useEffect(() => {
    if (!dialog.isOpen) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const focus = window.setTimeout(() => form.current?.querySelector("input")?.focus(), 50);
    return () => {
      root.style.overflow = "";
      window.clearTimeout(focus);
    };
  }, [dialog.isOpen]);

  // 닫으면 입력 안내를 지운다
  const close = () => {
    setEmpty({ email: false, password: false });
    setNote("");
    dialog.close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key !== "Tab" || !form.current) return;
    const items = [...form.current.querySelectorAll<HTMLElement>("button, input")];
    const first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next = { email: !email, password: !password };
    setEmpty(next);
    if (next.email || next.password) {
      setNote(emptyMessage(next));
      e.currentTarget
        .querySelector<HTMLInputElement>(next.email ? "input[name=email]" : "input[name=password]")
        ?.focus();
      return;
    }
    setNote("");
    signIn.mutate({ email, password });
  };

  const clear = (field: keyof Empty) => {
    setEmpty((v) => ({ ...v, [field]: false }));
    setNote("");
  };

  return (
    <div
      className={`${styles.root} ${dialog.isOpen ? styles.open : ""} z-modal`}
      aria-hidden={!dialog.isOpen}
      onKeyDown={onKeyDown}
    >
      <div className={styles.scrim} onClick={close} />
      <form
        ref={form}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        noValidate
        onSubmit={onSubmit}
      >
        <button type="button" className={styles.close} aria-label="닫기" onClick={close}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.46"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className={styles.lock}>
          <AtlasMark />
          Issue Atlas
        </div>
        <h2 id="login-title">로그인</h2>
        <label className={styles.field}>
          <span>이메일</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="name@example.com"
            spellCheck={false}
            aria-invalid={empty.email}
            onInput={() => clear("email")}
          />
        </label>
        <label className={styles.field}>
          <span>비밀번호</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={empty.password}
            onInput={() => clear("password")}
          />
        </label>
        {note && (
          <p className={styles.note} role="status">
            {note}
          </p>
        )}
        <button className={styles.primary} type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? "로그인 중…" : "로그인"}
        </button>
        <p className={styles.help}>비밀번호를 잊었나요? 관리자에게 초기화를 요청하세요.</p>
      </form>
    </div>
  );
}
