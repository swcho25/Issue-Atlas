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
 * 일반 사용자는 시작 버튼으로 바로 새 질문, 헤더 「로그인」 은 관리자용(로그인 정책 A안)
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
