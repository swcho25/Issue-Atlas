import { Lockup } from "@/shared/ui/logo";

import { AtlasScene } from "./AtlasScene";
import styles from "./LandingPage.module.css";

/** 확정 랜딩: 아틀라스 석상이 받친 지구, 양옆 Issue · Atlas 라벨, 문장 한 줄과 시작 버튼 */
export function LandingPage() {
  return (
    <main className={`${styles.page} text-landing-ink`}>
      <div className={styles.frame}>
        <span
          className={`${styles.at} ${styles.px} ${styles.word} ${styles.wordLeft} font-mono text-landing-word`}
          aria-hidden="true"
        >
          Issue
          <i className={`${styles.rule} bg-landing-rule`} />
        </span>
        <span
          className={`${styles.at} ${styles.px} ${styles.word} ${styles.wordRight} font-mono text-landing-word`}
          aria-hidden="true"
        >
          <i className={`${styles.rule} bg-landing-rule`} />
          Atlas
        </span>
        <AtlasScene />
        <nav className={`${styles.at} ${styles.nav}`}>
          <Lockup className={styles.brand} />
          <button
            type="button"
            className={`${styles.px} ${styles.login} border-landing-line bg-landing-surface text-landing-button`}
          >
            로그인
          </button>
        </nav>
        <h1 className={`${styles.at} ${styles.px} ${styles.line}`}>
          우리 지역에 이 문제가 정말 있는가?
        </h1>
        <button
          type="button"
          className={`${styles.at} ${styles.px} ${styles.cta} bg-cta text-cta-foreground`}
        >
          질문 시작하기
        </button>
      </div>
    </main>
  );
}
