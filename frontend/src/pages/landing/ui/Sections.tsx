import styles from "./LandingPage.module.css";
import { ThemeImage } from "./ThemeImage";
import { Tour } from "./Tour";

/**
 * 지도 다음 설명 섹션 셋: 결과 화면 · 판단과 말하지 않는 것 · 출처와 각주.
 * 예시 그림은 실제 결과 화면(dev · 여수시 청년 유출·정착)에서 잘라 낸 조각이다. 크기는 찍은 조각의 CSS 크기(파일은 2배)
 */
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
            <div className={`${styles.panel} ${styles.shot}`} aria-hidden="true">
              <ThemeImage src="/landing/example-verdict" width={584} height={340} alt="" />
            </div>
            <span className={styles.num}>01</span>
            <h3>결론은 짧고 분명하게</h3>
            <p>
              「증가 · 감소 · 뚜렷하지 않음」처럼 정해진 표현으로만 말해요. 같은 자료로 다시 물어도
              같은 결론이 나와요.
            </p>
          </article>
          <article className={styles.feat}>
            <div className={`${styles.panel} ${styles.shot}`} aria-hidden="true">
              <ThemeImage src="/landing/example-unsaid" width={566} height={230} alt="" />
            </div>
            <span className={styles.num}>02</span>
            <h3>알 수 없는 것도 함께 보여 줘요</h3>
            <p>
              떠난 이유, 정책의 효과, 앞으로의 추세는 이 숫자만으로 말할 수 없어요. 결과 옆에 그
              점을 같이 적어 둬요.
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
            <div className={`${styles.panel} ${styles.shot}`} aria-hidden="true">
              <ThemeImage src="/landing/example-evidence" width={292} height={121} alt="" />
            </div>
            <span className={styles.num}>1</span>
            <h3>근거를 골라요</h3>
            <p>통계 · 기사마다 출처 등급이 붙어 있어요</p>
          </li>
          <li className={styles.step}>
            <div className={`${styles.panel} ${styles.shot}`} aria-hidden="true">
              <ThemeImage src="/landing/example-source" width={327} height={182} alt="" />
            </div>
            <span className={styles.num}>2</span>
            <h3>출처를 확인해요</h3>
            <p>어디서 · 언제 나온 자료인지 바로 보여요</p>
          </li>
          <li className={styles.step}>
            <div className={`${styles.panel} ${styles.shot}`} aria-hidden="true">
              <ThemeImage src="/landing/example-footnote" width={327} height={192} alt="" />
            </div>
            <span className={styles.num}>3</span>
            <h3>각주를 복사해요</h3>
            <p>출처 · 자료명 · 날짜 · 조회일이 한 줄로 복사돼요</p>
          </li>
        </ol>
      </section>
    </>
  );
}
