"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminUser } from "@/entities/admin-user";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { uploadImport } from "../api/imports";
import { sourcesHref } from "../model/query";

// CSV 올리기: 파일 · 반영 담당자를 골라 올리면 서버가 양식 검증까지 끝내고 요청을 만든다(오류가 있어도 검증 실패로 보관).
// request_key 는 고른 파일 · 담당자마다 새로 만든다. 같은 것을 다시 보내면(네트워크 재시도) 같은 요청을 돌려받는다
const failText = (e: unknown) => {
  if (e instanceof ApiError && e.status === 413) return "2 MiB 를 넘는 파일이에요.";
  if (e instanceof ApiError && e.status === 400) return "파일 형식 · 반영 담당자를 확인해 주세요.";
  if (e instanceof ApiError && e.status === 409)
    return "같은 요청 키로 다른 내용이 이미 올라갔어요. 파일을 다시 골라 주세요.";
  if (e instanceof ApiError && (e.status === 401 || e.status === 403))
    return "세션이 끝났어요. 다시 로그인해 주세요.";
  return "올리지 못했어요. 다시 시도해 주세요.";
};

export function UploadForm({
  admins,
  meId,
  maxBytes,
}: {
  admins: AdminUser[];
  meId: number;
  maxBytes: number;
}) {
  const router = useRouter();
  const [moving, startMove] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [assignee, setAssignee] = useState<number | null>(() => admins[0]?.id ?? null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const upload = useMutation({
    mutationFn: (input: { file: File; assigneeId: number }) =>
      uploadImport({ ...input, requestKey }),
    onSuccess: (r) =>
      startMove(() => router.push(sourcesHref({ view: "imports", id: r.import_id }))),
  });
  const busy = upload.isPending || moving;
  const tooBig = !!file && file.size > maxBytes;
  // 파일이나 담당자를 바꾸면 다른 요청이므로 키도 바꾼다
  const renew = () => setRequestKey(crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border-1 bg-surface-1 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (file && assignee !== null && !tooBig) upload.mutate({ file, assigneeId: assignee });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-label-12 text-text-3">CSV 파일</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            renew();
          }}
          className="text-body-13 text-text-1 file:mr-3 file:h-9 file:rounded-md file:border file:border-border-1 file:bg-surface-1 file:px-3 file:text-label-13 file:text-text-1 hover:file:bg-surface-2"
        />
        {tooBig && <span className="text-caption-12 text-status-red">2 MiB 초과</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label-12 text-text-3">반영 담당자</span>
        <select
          value={assignee ?? ""}
          disabled={busy}
          onChange={(e) => {
            setAssignee(Number(e.target.value));
            renew();
          }}
          className="h-9 w-72 rounded-lg border border-border-1 bg-surface-1 px-3 text-body-14 text-text-1 outline-none focus:border-border-2"
        >
          {admins.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.id === meId ? " (나)" : ""}
            </option>
          ))}
        </select>
      </label>
      {upload.isError && (
        <p role="alert" className="text-body-13 text-status-red">
          {failText(upload.error)}
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        disabled={!file || assignee === null || tooBig || busy}
        icon={<Icon name="check" />}
      >
        {busy ? "올리는 중" : "올리고 검증"}
      </Button>
    </form>
  );
}
