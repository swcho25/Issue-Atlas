// /admin — 관리자 첫 화면(운영 요약 자리). 들어오는 것은 app/(app)/admin/layout.tsx 의 AdminLayout 이 ADMIN 만 통과시킨다.
// 운영 요약 숫자(GET /v1/admin/overview)는 화면 작업에서 채운다
export function AdminOverviewPage() {
  return (
    <main className="flex flex-col gap-2 p-8">
      <h1 className="text-heading-24 text-text-1">운영 요약</h1>
      <p className="text-body-14 text-text-2">
        관리자 화면입니다. 왼쪽 띠의 관리 메뉴에서 검수 · 카드 · 데이터 소스로 이동합니다.
      </p>
    </main>
  );
}
