import styles from "./LandingPage.module.css";
import { Tour } from "./Tour";

/** 지도 다음 설명 섹션 셋: 결과 화면 · 판단과 말하지 않는 것 · 출처와 각주 */
export function Sections() {
  return (
    <>
      <section className={styles.sec}>
        <p className={styles.eyebrow}>우리 지역이 궁금할 때</p>
        <h2>
          판단보다,
          <br />
          근거부터 먼저
        </h2>
        <p className={styles.lede}>
          질문 하나면 통계 · 보도자료 · 정책 문서를 한 화면에 모아 보여 드려요
        </p>
        <Tour />
      </section>

      <section className={styles.sec}>
        <p className={styles.eyebrow}>결과는 이렇게 나와요</p>
        <h2>
          숫자가 말하는 만큼만
          <br />
          말해요
        </h2>
        <p className={styles.lede}>
          통계로 확인되는 것만 결론으로 말하고, 알 수 없는 건 따로 알려 드려요
        </p>
        <div className={`${styles.grid} ${styles.feats}`}>
          <article className={styles.feat}>
            <div className={styles.panel} aria-hidden="true">
              <p className={styles.subject}>여수시 청년(19–39세) 순유출 · 명</p>
              <dl className={styles.years}>
                <dt>2023</dt>
                <dd>−1,537</dd>
                <dt>2024</dt>
                <dd>−1,935</dd>
                <dt>2025</dt>
                <dd className={styles.now}>−2,262</dd>
              </dl>
              <span className={styles.verdict}>
                <b>결론</b>
                <strong>해마다 늘었어요</strong>
              </span>
            </div>
            <span className={styles.num}>01</span>
            <h3>결론은 짧고 분명하게</h3>
            <p>
              「늘었다 · 줄었다 · 판단하기 어렵다」처럼 정해진 표현으로만 말해요. 같은 자료로 다시
              물어도 같은 결론이 나와요.
            </p>
          </article>
          <article className={styles.feat}>
            <div className={styles.panel} aria-hidden="true">
              <div className={styles.notsay}>
                <h4>이 숫자로 알 수 없는 것</h4>
                <ul>
                  <li>청년이 왜 떠나는지</li>
                  <li>고령화 때문인지</li>
                  <li>어디로 옮겨 갔는지</li>
                </ul>
              </div>
            </div>
            <span className={styles.num}>02</span>
            <h3>알 수 없는 것도 함께 보여 줘요</h3>
            <p>
              이유, 정책의 효과, 앞으로의 변화는 이 숫자만으로 말할 수 없어요. 결과 옆에 그 점을
              같이 적어 둬요.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.sec}>
        <p className={styles.eyebrow}>보고서 · 기사를 쓸 때</p>
        <h2>
          출처는 바로,
          <br />
          각주는 복사해서
        </h2>
        <p className={styles.lede}>모든 숫자에 출처가 붙어 있어 원문을 바로 열 수 있어요</p>
        <ol className={`${styles.grid} ${styles.steps}`}>
          <li className={styles.step}>
            <div className={styles.panel} aria-hidden="true">
              <div className={`${styles.slip} ${styles.pick}`}>
                <small>2025 · 여수시 청년 순유출</small>
                <strong>−2,262명</strong>
              </div>
            </div>
            <span className={styles.num}>1</span>
            <h3>숫자를 눌러요</h3>
            <p>어느 통계에서 온 숫자인지 바로 보여요</p>
          </li>
          <li className={styles.step}>
            <div className={styles.panel} aria-hidden="true">
              <div className={styles.slip}>
                <small>출처</small>
                <strong className={styles.link}>통계청 KOSIS 국내인구이동통계 ↗</strong>
              </div>
            </div>
            <span className={styles.num}>2</span>
            <h3>원문으로 가요</h3>
            <p>통계청 · 보도자료 원문을 바로 열어요</p>
          </li>
          <li className={styles.step}>
            <div className={styles.panel} aria-hidden="true">
              <div className={`${styles.slip} ${styles.note}`}>
                <p>
                  통계청 KOSIS · 국내인구이동통계
                  <br />
                  여수시 · 19–39세 · 2023–2025
                  <br />
                  조회 2026-10-21
                </p>
                <em>각주 복사</em>
              </div>
            </div>
            <span className={styles.num}>3</span>
            <h3>각주를 복사해요</h3>
            <p>출처 · 자료명 · 기간 · 조회일이 한 줄로 복사돼요</p>
          </li>
        </ol>
      </section>
    </>
  );
}
