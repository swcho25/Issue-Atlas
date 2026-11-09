import { Suspense } from "react";

import { ThemeSwitch } from "@/features/switch-theme";

import { getAccount } from "../api/getAccount";
import { counts, roleLabel } from "../model/summary";
import { LogoutButton } from "./LogoutButton";

// /me — 마이페이지. 가운데 한 줄: 프로필 · 로그아웃 → 숫자 셋 → 화면 설정. 질문 목록은 내 질문(/me/questions)에 있어 여기 두지 않는다.
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

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-label-13 text-text-3">화면</h2>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-title-14 text-text-1">어두운 화면</span>
          <ThemeSwitch />
        </div>
      </section>
    </>
  );
}
