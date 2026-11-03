import { layers, shadows } from "../model/tokens";

// 그림자 · 겹침 순서. 옆의 값은 Figma 효과 값이라 화면과 대 보면 된다
export function Effects() {
  return (
    <>
      <EffectShadows />
      <EffectLayers />
    </>
  );
}

function EffectShadows() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">그림자</h2>
      <p className="mt-1 text-body-13 text-text-2">
        누르는 것 · 고른 것의 앰버는 짧게 <code className="font-mono">bg-primary</code>
      </p>
      <div className="mt-6 grid grid-cols-4 gap-x-8 gap-y-10 bg-bg-canvas p-8">
        {shadows.map(({ className, spec }) => (
          <div key={className} className="grid gap-3">
            <div className={`h-20 rounded-xl bg-surface-1 ${className}`} />
            <div>
              <div className="font-mono text-caption-12">{className}</div>
              <div className="text-caption-11 text-text-3">{spec}</div>
            </div>
          </div>
        ))}
        <div className="grid gap-3">
          <div className="grid h-20 place-items-center rounded-full bg-primary text-label-13 text-text-on-primary">
            bg-primary
          </div>
          <div className="text-caption-11 text-text-3">primary-base · #FFB000</div>
        </div>
      </div>
    </section>
  );
}

// 일부러 위층부터 먼저 그린다. 이름이 없으면 나중 것(지도)이 맨 위에 오고, 이름이 맞으면 모달이 맨 위에 온다
function EffectLayers() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">겹침 순서</h2>
      <div className="relative mt-6 h-72">
        {[...layers].reverse().map(({ className, spec }, i) => (
          <div
            key={className}
            className={`absolute h-24 w-72 rounded-xl border border-border-2 bg-surface-1 p-3 shadow-md ${className}`}
            style={{ left: (layers.length - 1 - i) * 40, top: (layers.length - 1 - i) * 32 }}
          >
            <div className="font-mono text-caption-12">{className}</div>
            <div className="text-caption-11 text-text-3">{spec}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
