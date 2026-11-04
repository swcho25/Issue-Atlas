import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 디자인 토큰 센서: className · style 에 토큰 밖 값을 직접 쓰면 막는다.
// 토큰 목록과 쓰는 법은 src/app/styles/globals.css(Tailwind 설정) · docs/design/DESIGN.md.
// 토큰에서 계산한 값(rounded-[calc(14*var(--u))] 등)과 크기(h-[68px] 등)는 막지 않는다
const tokenRules = [
  {
    pattern: "-\\[#",
    message:
      "색을 직접 쓰지 않는다. Figma 색 토큰 클래스(bg-surface-1 · text-text-2 · bg-primary …)를 쓰고, 투명도는 bg-text-1/7 처럼 /숫자. 목록은 src/app/styles/globals.css",
  },
  {
    pattern: "(^|\\s|:)text-\\[\\d",
    message:
      "글자 크기를 직접 쓰지 않는다. IA5 글자 스타일(text-body-14 · text-label-13 …)을 쓴다. 목록은 src/app/styles/globals.css 의 --text-*",
  },
  {
    pattern: "(^|\\s|:)shadow-\\[",
    message:
      "그림자를 직접 쓰지 않는다. shadow-xs · sm · md · drawer · frame · card · legend 중에서 고른다(src/app/styles/globals.css 의 --shadow-*)",
  },
  {
    pattern: "(^|\\s|:)-?z-(\\d|\\[)",
    message:
      "겹침 순서를 숫자로 쓰지 않는다. z-map · z-control · z-panel · z-popover · z-toast · z-modal 중에서 고른다(src/app/styles/globals.css)",
  },
];

const classNameSelectors = tokenRules.flatMap(({ pattern, message }) => [
  { selector: `JSXAttribute[name.name='className'] Literal[value=/${pattern}/]`, message },
  {
    selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${pattern}/]`,
    message,
  },
]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...classNameSelectors,
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "style 에 색을 직접 쓰지 않는다. 토큰 클래스나 var(--토큰)(예: var(--map-region))을 쓴다. 목록은 src/app/styles/globals.css",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
