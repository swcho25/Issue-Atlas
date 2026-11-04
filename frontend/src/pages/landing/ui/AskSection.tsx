import Link from "next/link";

import styles from "./LandingPage.module.css";

// 지역 줄: 「*」 가 붙은 곳만 지금 볼 수 있는 곳(테두리 + 앰버 점). 끊김 없이 돌도록 같은 줄을 두 번 이어 붙인다
const ROWS = [
  "도쿄 서울 타이베이 부산 오사카 *광주 제주 *여수 홍콩 싱가포르 하노이 방콕 시드니 뭄바이 두바이",
  "이스탄불 베를린 파리 런던 암스테르담 스톡홀름 나이로비 뉴욕 토론토 샌프란시스코 멕시코시티 상파울루 부에노스아이레스 케이프타운 오클랜드",
];

/** 마지막: 어느 지역부터 + 시작 버튼(로그인 없이 바로 새 질문) + 지역 줄 */
export function AskSection() {
  return (
    <section className={`${styles.sec} ${styles.ask}`}>
      <h2>
        어느 지역부터
        <br />
        볼까요?
      </h2>
      <Link className={styles.start} href="/ask">
        OPEN THE ATLAS <span aria-hidden="true">→</span>
      </Link>
      <div className={styles.places} role="img" aria-label="지금 볼 수 있는 곳: 광주 · 여수">
        {ROWS.map((row, r) => (
          <div key={row} className={`${styles.row} ${r ? styles.rev : ""}`}>
            {[0, 1].flatMap((copy) =>
              row.split(" ").map((name) => (
                <span
                  key={`${copy}-${name}`}
                  className={`${styles.chip} ${name.startsWith("*") ? styles.open : ""}`}
                >
                  {name.replace("*", "")}
                </span>
              )),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
