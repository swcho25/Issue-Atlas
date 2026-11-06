"use client";

import { useLoginDialog } from "../model/login-dialog";
import styles from "./LandingPage.module.css";

/** OPEN THE ATLAS: 랜딩은 로그인하지 않은 사람만 보므로 로그인 창을 연다 */
export function StartButton() {
  const login = useLoginDialog();
  return (
    <button type="button" className={styles.start} onClick={(e) => login.open(e.currentTarget)}>
      OPEN THE ATLAS <span aria-hidden="true">→</span>
    </button>
  );
}
