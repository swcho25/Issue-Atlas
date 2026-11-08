import Image from "next/image";

import styles from "./LandingPage.module.css";

/**
 * 밝은 · 어두운 캡처 한 벌. src 는 확장자 없이(`/landing/tour-summary` → tour-summary.webp · tour-summary-dark.webp).
 * 화면 테마에 맞는 쪽만 보이고(LandingPage.module.css 의 .light · .dark), 숨은 쪽은 늦게 읽기라 받지 않는다
 */
export function ThemeImage({
  src,
  width,
  height,
  alt,
  className = "",
  hidden,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
  hidden?: boolean;
}) {
  return (["light", "dark"] as const).map((theme) => (
    <Image
      key={theme}
      className={`${styles[theme]} ${className}`}
      src={`${src}${theme === "dark" ? "-dark" : ""}.webp`}
      width={width}
      height={height}
      alt={alt}
      aria-hidden={hidden}
    />
  ));
}
