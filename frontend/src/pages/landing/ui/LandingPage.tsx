import { LoginDialogProvider } from "../model/login-dialog";
import { AskSection } from "./AskSection";
import { Journey } from "./Journey";
import styles from "./LandingPage.module.css";
import { LoginDialog } from "./LoginDialog";
import { Sections } from "./Sections";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * 랜딩(공개): 히어로 지구 → 구름 → 서울 지도 도착 → 설명 섹션 셋 → 시작 버튼 → 푸터.
 * 로그인하지 않은 사람만 본다. 헤더 「로그인」 · OPEN THE ATLAS 가 로그인 창을 열고, 로그인하면 새 질문(관리자는 운영 요약)
 */
export function LandingPage() {
  return (
    <LoginDialogProvider>
      <div className={styles.page}>
        <SiteHeader />
        <main>
          <Journey />
          <Sections />
          <AskSection />
        </main>
        <SiteFooter />
      </div>
      <LoginDialog />
    </LoginDialogProvider>
  );
}
