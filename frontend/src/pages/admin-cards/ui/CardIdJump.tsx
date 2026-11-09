"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

/** 카드 ID 로 카드 열기(관리자 카드 목록 API 가 없어 요청이 없는 카드는 ID 로 연다) */
export function CardIdJump() {
  const router = useRouter();
  const [id, setId] = useState("");
  const value = id.trim().toUpperCase();
  return (
    <form
      className="mt-auto flex items-center gap-2 border-t border-border-1 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) router.push(`/admin/cards/${encodeURIComponent(value)}`);
      }}
    >
      <label className="sr-only" htmlFor="card-id">
        카드 ID
      </label>
      <input
        id="card-id"
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="카드 ID (예: C1)"
        className="h-9 min-w-0 flex-1 rounded-lg border border-border-1 bg-surface-1 px-3 text-body-14 text-text-1 outline-none placeholder:text-text-3 focus:border-border-2"
      />
      <Button type="submit" variant="secondary" disabled={!value}>
        열기
      </Button>
    </form>
  );
}
