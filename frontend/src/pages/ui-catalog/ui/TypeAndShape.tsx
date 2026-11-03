import { radii, textStyles } from "../model/tokens";

// 글자 스타일 IA5/ 15개와 모서리. 옆의 숫자는 Figma 값이라 화면과 대 보면 된다
export function TypeAndShape() {
  return (
    <>
      <section className="mt-12">
        <h2 className="text-heading-20">글자 스타일</h2>
        <div className="mt-4 grid gap-4">
          {textStyles.map(({ className, spec }) => (
            <div key={className} className="grid grid-cols-[160px_1fr] items-baseline gap-x-4">
              <div>
                <div className="font-mono text-caption-12">{className}</div>
                <div className="text-caption-11 text-text-3">{spec}</div>
              </div>
              <p className={className}>근거로 읽는 지역 문제 Issue Atlas 2,262</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-heading-20">모서리</h2>
        <div className="mt-4 flex flex-wrap gap-6">
          {radii.map(({ className, spec }) => (
            <div key={className} className="grid justify-items-center gap-2">
              <div className={`size-20 border border-border-2 bg-surface-2 ${className}`} />
              <div className="font-mono text-caption-12">{className}</div>
              <div className="text-caption-11 text-text-3">{spec}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
