"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui/button";

import { logout } from "../api/logout";

/**
 * 로그아웃하고 랜딩(/)으로 간다. 받아 둔 데이터는 지운다(다음에 같은 창에서 로그인하는 사람에게 남지 않게).
 * 세션 쿠키가 남아 있어도 랜딩 앞(proxy)이 끝난 세션을 확인하고 지운다
 */
export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/");
    },
  });

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
