"use client";

import { useMutation } from "@tanstack/react-query";

import { Button } from "@/shared/ui/button";

import { logout } from "../api/logout";
import { reloadToLanding } from "../lib/reload";

/**
 * 로그아웃하고 랜딩(/)을 페이지째 새로 연다(화면에 남은 앞 사람의 상태 · 데이터가 함께 사라진다).
 * 세션 쿠키가 남아 있어도 랜딩 앞(proxy)이 끝난 세션을 확인하고 지운다
 */
export function LogoutButton() {
  const signOut = useMutation({ mutationFn: logout, onSuccess: reloadToLanding });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending || signOut.isSuccess}
      >
        로그아웃
      </Button>
      {signOut.isError && (
        <p role="alert" className="text-body-13 text-status-red">
          로그아웃하지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
