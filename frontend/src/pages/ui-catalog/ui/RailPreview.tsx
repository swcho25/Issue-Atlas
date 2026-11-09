import { AppRail } from "@/widgets/app-rail";

// Figma v5/Rail 변형 중 둘(조회자 · 새 질문, 관리자 · 검수). 높이는 Figma 900 대신 견본용으로 줄였다
export function RailPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">왼쪽 띠</h2>
      <div className="mt-4 flex gap-8">
        <figure className="grid gap-2">
          <AppRail currentPath="/ask" className="h-[560px]" />
          <figcaption className="text-caption-12 text-text-3">조회자 · 새 질문</figcaption>
        </figure>
        <figure className="grid gap-2">
          <AppRail
            role="admin"
            currentPath="/admin/reviews"
            user={{ name: "정우현", email: "name@example.com" }}
            className="h-[560px]"
          />
          <figcaption className="text-caption-12 text-text-3">관리자 · 검수</figcaption>
        </figure>
      </div>
    </section>
  );
}
