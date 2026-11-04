"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type LoginDialog = {
  isOpen: boolean;
  /** 연 버튼을 넘기면 닫을 때 그 버튼으로 초점을 돌려준다 */
  open: (opener?: HTMLElement | null) => void;
  close: () => void;
};

const LoginDialogContext = createContext<LoginDialog | null>(null);

/** 헤더 「로그인」 이 여는 로그인 창의 열림 상태 */
export function LoginDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback((from?: HTMLElement | null) => {
    opener.current = from ?? null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <LoginDialogContext value={value}>{children}</LoginDialogContext>;
}

export function useLoginDialog() {
  const value = useContext(LoginDialogContext);
  if (!value) throw new Error("useLoginDialog 는 LoginDialogProvider 안에서 쓴다");
  return value;
}
