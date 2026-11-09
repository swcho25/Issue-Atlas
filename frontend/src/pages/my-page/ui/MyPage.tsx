import Link from "next/link";
import { type ReactNode, Suspense } from "react";

import { ThemeSwitch } from "@/features/switch-theme";
import { Icon } from "@/shared/ui/icon";

import { getAccount } from "../api/getAccount";
import { counts, recentQuestions, roleLabel } from "../model/summary";
import { LogoutButton } from "./LogoutButton";

// /me — 마이페이지. 가운데 한 줄: 프로필 · 로그아웃 → 숫자 셋 → 묶음(화면 · 최근 질문).
// 계정은 관리자가 발급하므로 이름 · 비밀번호 바꾸기는 없다. Cache Components: 쿠키 · 데이터 읽기는 <Suspense> 안에서
export function MyPage() {
  return (
    <main className="h-full overflow-y-auto bg-bg-app">
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-7 pt-6 pb-16">
        <h1 className="text-heading-24 text-text-1">마이페이지</h1>
        <Suspense fallback={<p className="text-body-13 text-text-3">불러오는 중이에요</p>}>
          <MyPageContent />
        </Suspense>
      </div>
    </main>
  );
}

async function MyPageContent() {
  const { me, questions } = await getAccount();
  const recent = recentQuestions(questions);

  return (
    <>
      <section aria-label="계정" className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-full bg-surface-3 text-heading-24 text-text-1"
        >
          {me.name.slice(0, 1)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex items-baseline gap-2">
            <span className="truncate text-heading-20 text-text-1">{me.name}</span>
            <span className="shrink-0 text-label-12 text-text-3">{roleLabel[me.role]}</span>
          </p>
          <p className="truncate text-body-14 text-text-2">{me.email}</p>
        </div>
        <LogoutButton />
      </section>

      <dl className="flex gap-10">
        {counts(questions).map((c) => (
          <div key={c.label} className="flex flex-col-reverse gap-1">
            <dt className="text-body-13 text-text-3">{c.label}</dt>
            <dd className="text-number-32 text-text-1">{c.value}</dd>
          </div>
        ))}
      </dl>

      <Group title="화면">
        <li className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-title-14 text-text-1">어두운 화면</span>
          <ThemeSwitch />
        </li>
      </Group>

      <Group title="최근 질문">
        {recent.length === 0 && (
          <li className="px-4 py-3 text-body-13 text-text-3">아직 저장한 질문이 없어요</li>
        )}
        {recent.map((q) => (
          <li key={q.id}>
            <RowLink href={q.href}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-title-14 text-text-1">{q.title}</span>
                <span className="text-body-13 text-text-3">{q.meta}</span>
              </span>
            </RowLink>
          </li>
        ))}
        <li>
          <RowLink href={recent.length === 0 ? "/ask" : "/me/questions"}>
            <span className="text-title-14 text-text-1">
              {recent.length === 0 ? "새 질문" : "내 질문 전체 보기"}
            </span>
          </RowLink>
        </li>
      </Group>
    </>
  );
}

/** 이름 붙은 묶음: 제목 아래 한 판에 줄을 쌓는다 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-label-13 text-text-3">{title}</h2>
      <ul className="flex flex-col overflow-hidden rounded-xl bg-surface-2">{children}</ul>
    </section>
  );
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-3"
    >
      {children}
      <Icon name="chevronRight" className="size-4 shrink-0 text-text-3" />
    </Link>
  );
}
