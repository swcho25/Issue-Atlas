import { Button, type ButtonSize, type ButtonVariant } from "@/shared/ui/button";

const variants: ButtonVariant[] = ["primary", "secondary", "ghost"];
const sizes: ButtonSize[] = ["m", "s"];

// Figma v5/Button 의 아이콘 자리(16 · 14)
const plus = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.17" aria-hidden="true">
    <path d="M8 3.33v9.34M3.33 8h9.34" strokeLinecap="round" />
  </svg>
);

// v5 화면에서 쓰는 6 변형(Primary · Secondary · Ghost × M · S) + 아이콘 · 비활성.
// 각 칸의 data-figma 는 자동 대조용 Figma 변형 이름
export function ButtonPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">버튼</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">
          {'<Button variant="primary|secondary|ghost" size="m|s" icon={…}>'}
        </code>
        {" · "}링크는 <code className="font-mono">buttonClass(…)</code>
      </p>
      <div className="mt-6 grid gap-5">
        {sizes.map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-4">
            <span className="w-8 font-mono text-caption-12 text-text-3">{size.toUpperCase()}</span>
            {variants.map((variant) => (
              <Button key={variant} variant={variant} size={size} data-figma={`${variant}-${size}`}>
                버튼
              </Button>
            ))}
            {variants.map((variant) => (
              <Button key={`${variant}-icon`} variant={variant} size={size} icon={plus}>
                버튼
              </Button>
            ))}
            <Button size={size} disabled>
              비활성
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
