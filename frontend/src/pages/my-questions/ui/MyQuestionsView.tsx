"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { claimBadge } from "@/entities/argument";
import { ApiError, type MyQuestion } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";
import { Button, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { rerunQuestion } from "../api/queries";
import { questionMeta, questionTitle } from "../model/text";
import { ComparePanel } from "./ComparePanel";

type Tab = "saved" | "candidate";

const TABS: { id: Tab; label: string }[] = [
  { id: "saved", label: "저장한 질문" },
  { id: "candidate", label: "새 이슈 후보" },
];

/**
 * 내 질문(Figma 06 「내 질문」): 탭(저장한 질문 · 새 이슈 후보) → 질문 줄 → 오른쪽 회차 비교.
 * 다시 실행하면 같은 질문의 새 회차가 생기고, 목록을 서버에서 다시 받아(router.refresh) 비교가 새 회차로 바뀐다.
 * 「내 수정 제안」 탭은 정우현 님 몫이라 여기 없다
 */
export function MyQuestionsView({ questions }: { questions: MyQuestion[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("saved");
  const [selectedId, setSelectedId] = useState<string>();
  const [refreshing, startRefresh] = useTransition();
  const lists: Record<Tab, MyQuestion[]> = {
    saved: questions.filter((q) => !q.candidate),
    candidate: questions.filter((q) => q.candidate),
  };
  const list = lists[tab];
  const selected = list.find((q) => q.question_id === selectedId) ?? list[0];

  const rerun = useMutation({
    mutationFn: (questionId: string) => rerunQuestion(questionId),
    onSuccess: () => startRefresh(() => router.refresh()),
  });
  // 쓰는 중에 세션이 끝났으면(401) 랜딩으로 — 다시 로그인한다
  const expired = rerun.error instanceof ApiError && rerun.error.status === 401;
  useEffect(() => {
    if (expired) router.replace("/");
  }, [expired, router]);

  const running = (q: MyQuestion) =>
    (rerun.isPending || refreshing) && rerun.variables === q.question_id;
  const again = (q: MyQuestion) => {
    setSelectedId(q.question_id);
    rerun.mutate(q.question_id);
  };

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pt-6 pb-10">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-24 text-text-1">내 질문</h1>
            <p className="text-body-13 text-text-3">
              저장한 질문은 그대로 다시 실행할 수 있어요 · 그 사이 검수 · 새 자료가 반영돼요
            </p>
          </div>
          <Link href="/ask" className={buttonClass({ variant: "secondary" })}>
            새 질문
          </Link>
        </header>

        <div
          role="tablist"
          aria-label="내 질문 종류"
          className="inline-flex w-fit gap-0.5 rounded-lg bg-surface-2 p-0.75"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-label-13 ${
                tab === t.id
                  ? "bg-surface-1 text-text-1 shadow-xs"
                  : "text-text-2 hover:text-text-1"
              }`}
            >
              {t.label}
              <span className="text-caption-11 text-text-3">{lists[t.id].length}</span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="text-body-13 text-text-3">
            {tab === "saved"
              ? "아직 저장한 질문이 없어요. 새 질문에서 물으면 여기에 모여요."
              : "만든 새 이슈 후보가 없어요. 문장으로 질문했을 때 맞는 이슈가 없으면 후보로 만들 수 있어요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((q) => (
              <QuestionRow
                key={q.question_id}
                question={q}
                selected={q.question_id === selected?.question_id}
                onSelect={() => setSelectedId(q.question_id)}
                onRerun={q.candidate ? undefined : () => again(q)}
                running={running(q)}
              />
            ))}
          </ul>
        )}
        {rerun.isError && !expired && (
          <p role="alert" className="text-body-13 text-status-red">
            다시 실행하지 못했어요. 잠시 뒤 다시 시도해 주세요.
          </p>
        )}
      </section>

      {selected && (
        <ComparePanel
          question={selected}
          onRerun={() => again(selected)}
          running={running(selected)}
        />
      )}
    </div>
  );
}

/** 질문 한 줄(Figma: 높이 67 · 모서리 8 · 아이콘 16 · 제목 Title 14 · 아래 Body 13 · 판단 배지 · 다시 실행) */
function QuestionRow({
  question: q,
  selected,
  onSelect,
  onRerun,
  running,
}: {
  question: MyQuestion;
  selected: boolean;
  onSelect: () => void;
  onRerun?: () => void;
  running: boolean;
}) {
  const last = q.runs[0];
  const badge = q.candidate
    ? { tone: "gray" as const, label: "후보로 저장" }
    : last && claimBadge[last.claim];
  return (
    <li
      className={`relative flex items-center gap-3.5 rounded-lg py-3.5 pr-4 pl-4 ${
        selected
          ? "bg-primary-soft inset-ring inset-ring-primary"
          : "bg-surface-1 inset-ring inset-ring-border-1 hover:bg-surface-2"
      }`}
    >
      <Icon
        name="bookmark"
        className={`size-4 shrink-0 ${selected ? "text-primary-text" : "text-text-3"}`}
      />
      {/* 줄 전체를 눌러 고른다(다시 실행 버튼은 그 위에 따로 눌린다) */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col gap-0.75 text-left after:absolute after:inset-0 after:rounded-lg"
      >
        <span className="truncate text-title-14 text-text-1">{questionTitle(q)}</span>
        <span className="truncate text-body-13 text-text-3">{questionMeta(q)}</span>
      </button>
      {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
      {onRerun && (
        <Button
          variant="secondary"
          size="s"
          icon={<Icon name="refresh" />}
          onClick={onRerun}
          disabled={running}
          className="relative"
        >
          {running ? "실행 중" : "다시 실행"}
        </Button>
      )}
    </li>
  );
}
