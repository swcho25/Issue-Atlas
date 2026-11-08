"use client";

import { useTheme } from "@/shared/lib/theme";
import { Lockup } from "@/shared/ui/logo";

import styles from "./LandingPage.module.css";

/** 로고 전체형(헤더와 같은 비율, 심벌 25) + 만든 곳. 어두운 화면에서는 밝은 로고(paper) */
export function SiteFooter() {
  const dark = useTheme() === "dark";
  return (
    <footer className={styles.foot}>
      <Lockup className={styles.lock} tone={dark ? "paper" : "ink"} />
      <small>SSAFY 15기 광주 C108 × 스테디윈스 · 2026</small>
    </footer>
  );
}
