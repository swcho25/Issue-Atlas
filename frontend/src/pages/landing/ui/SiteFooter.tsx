import { Lockup } from "@/shared/ui/logo";

import styles from "./LandingPage.module.css";

/** 로고 전체형(헤더와 같은 비율, 심벌 25) + 만든 곳 */
export function SiteFooter() {
  return (
    <footer className={styles.foot}>
      <Lockup className={styles.lock} />
      <small>SSAFY 15기 광주 C108 × 스테디윈스 · 2026</small>
    </footer>
  );
}
