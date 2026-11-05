import { BackButton, GlassIconButton } from "@/shared/ui/button";

import { mapLike } from "./GlassPreview";

// Figma Button/뒤로(흰 화면 머리) · Glass/Icon button(지도 · 결과 위). 각 칸의 data-figma 는 자동 대조용
export function NavButtonsPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">뒤로 · 유리 아이콘 버튼</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">{"<BackButton onClick={…} />"}</code>
        {" · "}
        <code className="font-mono">
          {'<GlassIconButton icon="copy" label="각주 복사" showLabel? />'}
        </code>
      </p>
      <div className="mt-6 flex flex-wrap items-start gap-10">
        <figure className="grid justify-items-center gap-2">
          <div className="grid size-24 place-items-center rounded-xl bg-surface-1 shadow-xs">
            <BackButton />
          </div>
          <figcaption className="text-caption-12 text-text-3">
            뒤로 36 · 동작은 onClick(이전 화면 · 패널 닫기)
          </figcaption>
        </figure>
        <figure className="grid gap-2">
          <div className="flex items-center gap-3 rounded-xl p-8" style={mapLike}>
            <GlassIconButton icon="copy" label="각주 복사" data-figma="glass-icon" />
            <GlassIconButton icon="bookmark" label="저장" />
            <GlassIconButton icon="refresh" label="다시 실행" />
            <GlassIconButton icon="play" label="2회차 실행" showLabel data-figma="glass-label" />
          </div>
          <figcaption className="text-caption-12 text-text-3">
            유리 아이콘 40 · 글자 형태 · 지도 위
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
