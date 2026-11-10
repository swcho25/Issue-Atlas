// 유리 견본. 유리는 아래에 볼 것이 있어야 하므로 지도 비슷한 바탕(토큰 색 줄무늬) 위에 Figma 크기 그대로 놓는다
export const mapLike = {
  backgroundImage: [
    "repeating-linear-gradient(135deg, var(--map-region-fill) 0 18px, transparent 18px 36px)",
    "radial-gradient(circle at 30% 40%, var(--aq-moderate) 0 60px, transparent 61px)",
    "radial-gradient(circle at 75% 65%, var(--data-navy) 0 80px, transparent 81px)",
    "linear-gradient(var(--bg-canvas), var(--bg-canvas))",
  ].join(", "),
};

export function GlassPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">유리</h2>
      <p className="mt-1 text-body-13 text-text-2">
        Figma Glass/Control. 채움만 다르다: <code className="font-mono">glass</code> 32% ·{" "}
        <code className="font-mono">glass glass-strong</code> 45% ·{" "}
        <code className="font-mono">glass glass-thin</code> 8%. 어두운 화면에서는 어두운 채움(53 ·
        60 · 40%)으로 바뀐다(왼쪽 띠의 테마 버튼). 칸 덧칠은{" "}
        <code className="font-mono">bg-glass-hover</code> ·{" "}
        <code className="font-mono">bg-glass-press</code>
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-10 rounded-xl p-10" style={mapLike}>
        <figure className="grid justify-items-center gap-2">
          <div className="grid size-10 place-items-center rounded-full glass text-label-13 glass-strong">
            ⧉
          </div>
          <figcaption className="text-caption-12">아이콘 버튼 40 · strong</figcaption>
        </figure>
        <figure className="grid justify-items-center gap-2">
          <div className="grid h-[68px] w-[276px] place-items-center rounded-full glass text-title-14 glass-thin">
            여수시 · 질문 시작하기
          </div>
          <figcaption className="text-caption-12">질문 바 276 × 68 · thin</figcaption>
        </figure>
        <figure className="grid justify-items-center gap-2">
          <div className="grid h-[208px] w-[300px] place-items-center rounded-[20px] glass text-title-14">
            지도 레이어
          </div>
          <figcaption className="text-caption-12">레이어 판 300 × 208 · 기본</figcaption>
        </figure>
      </div>
    </section>
  );
}
